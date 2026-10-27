"""Self-expanding buyer sources.

discover(): runs new search queries (sources/queries.py), opens each
result, keeps pages that are real LISTS of buyer companies (checked by a
cheap text test, then an LLM judge), and records them in buyer_sources.

harvest(): reads recorded lists (following pagination on the same site),
extracts the companies with agent/harvest.py (every name must appear on
the page; e-mail and phone are kept only if they appear on the page),
saves them through the bulk writer, and scores each source by its yield
so good lists are revisited and empty ones retired.

Paid data vendors and B2B marketplaces are never used as sources (their
listings are sellers, or their terms forbid reuse).
"""

from __future__ import annotations
import asyncio
import json
import re
import time
from typing import Any, Optional
from urllib.parse import urlparse

from ..agent import harvest as harvest_mod
from ..agent.web import Fetcher, Page, Searcher, host_of, is_non_company_host
from ..shared import llm
from ..shared.commodities import by_hs, commodities, countries
from . import queries as Q

BLOCKED_HOSTS = re.compile(
    r"(kompass|europages|alibaba|aliexpress|made-in-china|indiamart|tradeindia|ec21|ecplaza|go4worldbusiness|"
    r"tradekey|exporthub|globalsources|volza|importyeti|importgenius|panjiva|tendata|tradeint|seair|eximpedia|"
    r"zoominfo|dnb\.com|crunchbase|rocketreach|apollo\.io|lusha|kompass|thomasnet|yellowpages|yelp|tripadvisor|"
    r"amazon\.|ebay\.|etsy\.|walmart\.|scribd|slideshare|issuu|pinterest|facebook|linkedin|instagram|youtube|"
    r"wikipedia|reddit|quora|medium\.com|statista|researchandmarkets|mordorintelligence|grandviewresearch|"
    r"marketresearch|imarcgroup|expertmarketresearch|6wresearch|tridge|selina|exportgenius)", re.I)

COMPANY_SUFFIX = re.compile(
    r"\b(GmbH|Ltd\.?|Limited|Inc\.?|LLC|B\.?V\.?|N\.?V\.?|S\.?A\.?S?|SARL|S\.?r\.?l\.?|S\.?p\.?A\.?|Co\.,? ?Ltd|Corp\.?|"
    r"Pty|AG|KG|OHG|AB|A/S|AS|Oy|ApS|K\.?K\.?|Pte|Sdn|LLP|Kft|Sp\. z o\.o\.|株式会社|有限会社|有限公司|㈜)\b")

JUDGE_PROMPT = (
    "You check whether a web page is a LIST OF COMPANIES that BUY (import, wholesale, distribute, process or retail) "
    "a product category, e.g. an importer list from a trade-promotion office or embassy, an association member list, "
    "a trade-fair exhibitor list of importers/distributors, or a certification register of importers. "
    "Reply JSON only: {\"is_list\": true|false, \"listed_role\": \"buyers\"|\"sellers\"|\"mixed\"|\"other\", "
    "\"kind\": \"importer_list\"|\"members\"|\"exhibitors\"|\"registry\"|\"directory\"|\"other\", "
    "\"companies_on_page\": integer estimate, \"country_iso2\": two letters or null if several, "
    "\"hs4\": one code from the given list or null, \"confidence\": 0-100}. "
    "Exporters, suppliers, manufacturers selling from origin countries, news articles, market reports, "
    "single-company pages and paid databases are NOT buyer lists."
)


def _db():
    from ..shared import db as db_mod
    import psycopg
    return psycopg.connect(autocommit=True, prepare_threshold=None, **db_mod._parse_dsn())


def coverage(c) -> dict[tuple[str, str], int]:
    out: dict[tuple[str, str], int] = {}
    with c.cursor() as cur:
        cur.execute("""SELECT h, country, COUNT(*)::int FROM scraped_buyers, UNNEST(hs_codes) h
                        WHERE NOT is_hidden AND country IS NOT NULL GROUP BY 1, 2""")
        for h, co, n in cur.fetchall():
            out[(h, co)] = n
    return out


def looks_like_list(page: Page) -> tuple[bool, dict]:
    """Cheap pre-check before spending an LLM call."""
    text = page.text or ""
    suffixes = len(COMPANY_SUFFIX.findall(text))
    stats = {"chars": len(text), "suffixes": suffixes, "emails": len(page.emails)}
    if len(text) < 600:
        return False, stats
    ok = suffixes >= 10 or len(page.emails) >= 8 or (page.final_url.lower().endswith(".pdf") and suffixes >= 5)
    return ok, stats


async def judge(page: Page, hs_hint: Optional[str]) -> Optional[dict]:
    codes = ", ".join(f"{c['hs4']} {c['label_en']}" for c in commodities(3))
    excerpt = (page.text or "")[:6000]
    try:
        msg = await llm.chat([
            {"role": "system", "content": JUDGE_PROMPT},
            {"role": "user", "content": f"Product codes: {codes}\nLikely product: {hs_hint}\nURL: {page.final_url}\n"
                                        f"Title: {page.title}\n\n{excerpt}"},
        ], json_mode=True, max_tokens=300)
    except llm.LLMUnavailable:
        raise
    except Exception:
        return None
    data = llm.parse_json_loose(msg.get("content") or "")
    return data if isinstance(data, dict) else None


def accept(v: Optional[dict]) -> bool:
    if not v or not v.get("is_list"):
        return False
    if v.get("listed_role") not in ("buyers", "mixed"):
        return False
    try:
        return int(v.get("confidence") or 0) >= 60 and int(v.get("companies_on_page") or 0) >= 8
    except (TypeError, ValueError):
        return False


async def discover(minutes: float = 25, max_queries: int = 60, per_query: int = 8) -> dict:
    stats = {"queries": 0, "results": 0, "checked": 0, "prefilter_pass": 0, "judged": 0, "new_sources": 0}
    deadline = time.time() + minutes * 60
    searcher, fetcher = Searcher(), Fetcher()
    with _db() as c:
        cov = coverage(c)
        with c.cursor() as cur:
            cur.execute("SELECT query FROM source_queries")
            done = {r[0] for r in cur.fetchall()}
            cur.execute("SELECT url FROM buyer_sources")
            known = {r[0] for r in cur.fetchall()}
        for cand in Q.candidates(cov):
            if time.time() > deadline or stats["queries"] >= max_queries:
                break
            if cand["query"] in done:
                continue
            done.add(cand["query"])
            stats["queries"] += 1
            results = await searcher.search(cand["query"], n=per_query)
            stats["results"] += len(results)
            new_here = 0
            for res in results:
                url = res.url.split("#")[0]
                host = host_of(url)
                if not host or url in known or BLOCKED_HOSTS.search(host) or is_non_company_host(url):
                    continue
                known.add(url)
                page = await fetcher.fetch(url)
                stats["checked"] += 1
                if page.error and not page.text:
                    continue
                ok, pre = looks_like_list(page)
                if not ok:
                    continue
                stats["prefilter_pass"] += 1
                v = await judge(page, cand["hs4"])
                stats["judged"] += 1
                if not accept(v):
                    continue
                hs4 = v.get("hs4") if by_hs(str(v.get("hs4") or "")) else cand["hs4"]
                country = (v.get("country_iso2") or "").upper() or None
                with c.cursor() as cur:
                    cur.execute("""INSERT INTO buyer_sources (url, host, kind, title, hs4, country, judge_score, est_companies,
                                                              discovered_query, meta)
                                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (url) DO NOTHING""",
                                (page.final_url or url, host, v.get("kind"), (page.title or "")[:200], hs4, country,
                                 int(v.get("confidence") or 0), int(v.get("companies_on_page") or 0), cand["query"],
                                 json.dumps({"prefilter": pre, "lang": cand["lang"]})))
                    if cur.rowcount:
                        new_here += 1
                        stats["new_sources"] += 1
            with c.cursor() as cur:
                cur.execute("""INSERT INTO source_queries (query, hs4, country, lang, results, new_sources)
                               VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (query) DO NOTHING""",
                            (cand["query"], cand["hs4"], cand["country"], cand["lang"], len(results), new_here))
    stats["search_backends"] = searcher.stats
    return stats


NEXT_TEXT = re.compile(r"^(next|next page|›|»|>|weiter|nächste|suivant|suivante|volgende|siguiente|successiva|próxima|次へ|下一页|다음)$", re.I)
PAGE_PARAM = re.compile(r"([?&](page|p|pg|seite|pagina|start|offset)=\d+)|(/page/\d+)", re.I)


def pagination_links(page: Page, base: str) -> list[str]:
    """Same-site links that continue the list (next page, numbered pages, A-Z)."""
    root = urlparse(base)
    out: list[str] = []
    for href, label in page.links:
        u = urlparse(href)
        if u.netloc != root.netloc or href == base:
            continue
        same_path = u.path.rstrip("/") == root.path.rstrip("/") or u.path.startswith(root.path.rsplit("/", 1)[0])
        if NEXT_TEXT.match(label.strip()) or (same_path and (PAGE_PARAM.search(href) or re.fullmatch(r"\d{1,3}|[A-Z]", label.strip()))):
            if href not in out:
                out.append(href)
    return out[:40]


async def harvest(minutes: float = 35, shard: int = 0, shards: int = 1, max_sources: int = 40, max_pages: int = 25) -> dict:
    from ..bulk.writer import BulkWriter
    stats = {"sources": 0, "pages": 0, "kept": 0, "new": 0, "retired": 0, "llm_tokens": 0}
    deadline = time.time() + minutes * 60
    fetcher = Fetcher()
    with _db() as c, c.cursor() as cur:
        cur.execute("""SELECT id, url, kind, hs4, country, harvest_runs, buyers_kept FROM buyer_sources
                        WHERE status = 'active' AND (id %% %s) = %s
                          AND (last_harvested_at IS NULL OR last_harvested_at < NOW() - INTERVAL '30 days')
                        ORDER BY last_harvested_at NULLS FIRST, judge_score DESC NULLS LAST, id
                        LIMIT %s""", (max(1, shards), shard % max(1, shards), max_sources))
        queue = cur.fetchall()
    with BulkWriter("trade_directory") as w:
        for sid, url, kind, hs4, country, runs, kept_before in queue:
            if time.time() > deadline:
                break
            stats["sources"] += 1
            com = by_hs(hs4 or "") or {"hs4": hs4 or "0000", "label_en": "food, agricultural and consumer products"}
            todo, seen, pages, kept, err = [url], set(), 0, 0, None
            new_before = w.stats["new"]
            while todo and pages < max_pages and time.time() < deadline:
                u = todo.pop(0)
                if u in seen:
                    continue
                seen.add(u)
                page = await fetcher.fetch(u)
                pages += 1
                if page.error and not page.text:
                    err = page.error
                    continue
                recs, hst = await harvest_mod.harvest(page, commodity=com, mission_country=country or "",
                                                      listing_type=kind or "directory", max_chunks=30)
                stats["llm_tokens"] += hst.get("tokens", 0)
                for r in recs:
                    if w.add({**r, "contact_source_url": page.final_url}):
                        kept += 1
                for nxt in pagination_links(page, u):
                    if nxt not in seen and nxt not in todo:
                        todo.append(nxt)
            w.flush()
            new = w.stats["new"] - new_before
            stats["pages"] += pages
            stats["kept"] += kept
            stats["new"] += new
            # A list that gave nothing on its first read is retired; one whose
            # rows are all known already rests until next month.
            status = "active"
            if kept == 0 and (runs or 0) == 0:
                status = "rejected" if not err else "error"
            elif new == 0 and (runs or 0) >= 1:
                status = "exhausted"
            if status != "active":
                stats["retired"] += 1
            with _db() as c, c.cursor() as cur:
                cur.execute("""UPDATE buyer_sources SET last_harvested_at = NOW(), harvest_runs = harvest_runs + 1,
                                      pages_read = pages_read + %s, buyers_kept = buyers_kept + %s, buyers_new = buyers_new + %s,
                                      status = %s, last_error = %s WHERE id = %s""",
                            (pages, kept, new, status, err, sid))
    return stats


def report() -> dict:
    with _db() as c, c.cursor() as cur:
        cur.execute("SELECT status, COUNT(*)::int, COALESCE(SUM(buyers_kept),0)::int, COALESCE(SUM(buyers_new),0)::int FROM buyer_sources GROUP BY 1")
        by_status = cur.fetchall()
        cur.execute("SELECT COUNT(*)::int FROM source_queries")
        nq = cur.fetchone()[0]
        cur.execute("""SELECT host, buyers_new FROM buyer_sources WHERE buyers_new > 0 ORDER BY buyers_new DESC LIMIT 10""")
        top = cur.fetchall()
    return {"by_status": by_status, "queries_run": nq, "top_sources": top}
