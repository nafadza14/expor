"""Multi-agent crawler runner. Runs many (source, hs, country) crawls
concurrently, each LLM-extracting buyers, dedup + persist to Postgres.

Meant to be invoked by the GH Actions workflow (or manually) as:
    python -m python_scrapers.main run --minutes 25
or:
    python python_scrapers/main.py run --minutes 25

The run loop keeps pulling matrix triples until minutes elapse or the
matrix is exhausted, so a single GH Actions job can chip away at a big
target list without hitting the 6-hour job cap.
"""

from __future__ import annotations
import os
import sys
import time
import random
import asyncio
import argparse
from typing import Callable, Awaitable

# Support both `python -m python_scrapers.main` and direct invocation
# from repo root as `python python_scrapers/main.py`.
try:
    from .shared import db as db_mod
    from .shared.schema import BuyerRecord
    from .shared import commodities as com_cfg
    from .crawlers import kompass, europages, companies_house_uk, sirene_fr, sec_edgar_us, google_business
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from python_scrapers.shared import db as db_mod  # type: ignore
    from python_scrapers.shared.schema import BuyerRecord  # type: ignore
    from python_scrapers.shared import commodities as com_cfg  # type: ignore
    from python_scrapers.crawlers import kompass, europages, companies_house_uk, sirene_fr, sec_edgar_us, google_business  # type: ignore


# HS keywords + countries come from config/commodities.json (shared with
# the Node pipeline and the AI research agent).
HS_KEYWORDS: list[tuple[str, str]] = com_cfg.hs_keywords()
COUNTRIES: list[str] = com_cfg.country_codes()

Crawler = Callable[[str, str, str], Awaitable[list[BuyerRecord]]]

# Some crawlers only make sense for specific countries. If a crawler's
# `only_countries` set is non-empty, we skip (source, hs, other-country)
# slices for it.
ALL_CRAWLERS: dict[str, Crawler] = {
    "google_business": lambda kw, co, hs: google_business.crawl_one(kw, co, hs),
    "companies_house_uk": lambda kw, co, hs: companies_house_uk.crawl_one(kw, co, hs),
    "sirene_fr": lambda kw, co, hs: sirene_fr.crawl_one(kw, co, hs),
    "sec_edgar_us": lambda kw, co, hs: sec_edgar_us.crawl_one(kw, co, hs),
    "kompass": lambda kw, co, hs: kompass.crawl_one(kw, co, hs),
    "europages": lambda kw, co, hs: europages.crawl_one(kw, co, hs),
}

# Kompass (403 Cloudflare) and Europages (202 empty body) block GitHub
# runner IPs, so every slice they got returned 0 and wasted a third of
# the budget. They stay available but are off unless CRAWL_SOURCES lists
# them (e.g. CRAWL_SOURCES=kompass,europages behind a residential proxy).
DEFAULT_SOURCES = ["google_business", "companies_house_uk", "sirene_fr", "sec_edgar_us"]
_enabled = [s.strip() for s in (os.environ.get("CRAWL_SOURCES") or "").split(",") if s.strip()] or DEFAULT_SOURCES
CRAWLERS: dict[str, Crawler] = {k: v for k, v in ALL_CRAWLERS.items() if k in _enabled}

# Crawlers that query by HS category (NAF code / OSM tag), not by keyword.
# One slice per (hs, country) is enough; extra keywords just repeat the
# identical request.
KEYWORD_INSENSITIVE = {"sirene_fr", "google_business"}

ONLY_COUNTRIES: dict[str, set[str]] = {
    "companies_house_uk": {"GB"},
    "sirene_fr": {"FR"},
    "sec_edgar_us": {"US"},
    # google_business (OSM) works for any country in its ISO whitelist.
}


def build_matrix() -> list[tuple[str, str, str, str]]:
    """(source, hs_code, keyword, country) triples, randomized order so
    consecutive runs do not all hit the same site first."""
    triples: list[tuple[str, str, str, str]] = []
    for source in CRAWLERS.keys():
        only = ONLY_COUNTRIES.get(source)
        countries = [c for c in COUNTRIES if not only or c in only]
        seen_hs: set[str] = set()
        for hs, kw in HS_KEYWORDS:
            if source in KEYWORD_INSENSITIVE:
                if hs in seen_hs:
                    continue
                seen_hs.add(hs)
                if source == "google_business" and not google_business.tags_for(hs):
                    continue  # no industrial OSM tags for this commodity
            for co in countries:
                triples.append((source, hs, kw, co))
    random.shuffle(triples)
    return triples


async def run_one(source: str, hs: str, kw: str, country: str, sem: asyncio.Semaphore) -> dict:
    """Fetch + extract one crawl slice, persist results."""
    async with sem:
        try:
            crawler = CRAWLERS[source]
            records = await crawler(kw, country, hs)
        except Exception as e:
            return {"source": source, "hs": hs, "country": country, "ok": False, "error": str(e), "found": 0}

        if not records:
            return {"source": source, "hs": hs, "country": country, "ok": True, "found": 0}

        inserted = 0
        merged = 0
        try:
            with db_mod.conn() as c:
                for r in records:
                    d = r.as_dict()
                    row_id = db_mod.upsert_buyer(c, d)
                    if row_id:
                        # Cheap heuristic: if the row was already seen from
                        # another source we treat it as a merge.
                        with c.cursor() as cur:
                            cur.execute(
                                "SELECT array_length(sources_seen, 1) FROM scraped_buyers WHERE id = %s",
                                (row_id,),
                            )
                            n_sources = (cur.fetchone() or [1])[0] or 1
                        if n_sources > 1:
                            merged += 1
                        else:
                            inserted += 1
        except Exception as e:
            return {"source": source, "hs": hs, "country": country, "ok": False, "error": str(e), "found": len(records)}

        return {"source": source, "hs": hs, "country": country, "ok": True,
                "found": len(records), "inserted": inserted, "merged": merged}


async def run(minutes: int = 20, concurrency: int = 4) -> None:
    """Main loop: keep dispatching crawls until the wall-clock budget
    expires or the shuffled matrix is fully drained."""
    deadline = time.time() + minutes * 60
    matrix = build_matrix()
    print(f"[crawl] Matrix size: {len(matrix)}, budget: {minutes} min, concurrency: {concurrency}")

    sem = asyncio.Semaphore(concurrency)
    total = {"found": 0, "inserted": 0, "merged": 0, "ok": 0, "failed": 0}

    # Dispatch in mini-batches so the whole matrix does not race at once.
    idx = 0
    batch_size = concurrency * 4
    while idx < len(matrix) and time.time() < deadline:
        batch = matrix[idx:idx + batch_size]
        idx += batch_size
        tasks = [run_one(source, hs, kw, co, sem) for (source, hs, kw, co) in batch]
        results = await asyncio.gather(*tasks, return_exceptions=False)
        for r in results:
            if r.get("ok"):
                total["ok"] += 1
                total["found"] += r.get("found", 0)
                total["inserted"] += r.get("inserted", 0)
                total["merged"] += r.get("merged", 0)
            else:
                total["failed"] += 1
            marker = "OK" if r.get("ok") else "ERR"
            extra = f"inserted={r.get('inserted', 0)} merged={r.get('merged', 0)}" if r.get("ok") else f"error={r.get('error')}"
            print(f"[crawl] {marker} {r['source']:9s} {r['hs']} {r['country']} found={r.get('found', 0)} {extra}")

    print(f"[crawl] Done. slices_ok={total['ok']} failed={total['failed']} "
          f"found={total['found']} inserted={total['inserted']} merged={total['merged']}")


def cli() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("cmd", nargs="?", default="run", choices=["run"])
    p.add_argument("--minutes", type=int, default=20)
    p.add_argument("--concurrency", type=int, default=4)
    args = p.parse_args()
    asyncio.run(run(minutes=args.minutes, concurrency=args.concurrency))


if __name__ == "__main__":
    cli()
