"""Contact enrichment v2 runner (replaces the Node enricher).

    python -m python_scrapers.enrich.run --minutes 30 --max 600 --concurrency 8
    python -m python_scrapers.enrich.run --id 123          # one buyer
    python -m python_scrapers.enrich.run --dry-run --name "Kakao Handelshaus GmbH" --country DE

Queue order: never-checked rows first (highest confidence first), then
rows checked >30 days ago that still have no email. Each row is checked
at most once per run, so the run always advances through the table
(the old enricher re-processed the same "recently updated" rows forever).
"""

from __future__ import annotations
import argparse
import asyncio
import json
import os
import sys
import time
from typing import Optional

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    __package__ = "python_scrapers.enrich"  # noqa: A001

from ..shared import db as db_mod  # noqa: E402
from ..agent.web import Fetcher, Searcher  # noqa: E402
from .discover import Discoverer, EnrichResult  # noqa: E402

SELECT_QUEUE = """
SELECT id, name, country, city, website, email, phone, description
  FROM scraped_buyers
 WHERE is_hidden = FALSE
   AND (contact_checked_at IS NULL
        OR (email IS NULL AND contact_checked_at < NOW() - INTERVAL '30 days'))
 ORDER BY contact_checked_at NULLS FIRST,
          (source IN ('ai_agent','usda_oid','trade_directory')) DESC,
          (website IS NOT NULL) DESC,
          data_confidence DESC, id
 LIMIT %s"""

UPDATE_SQL = """
UPDATE scraped_buyers SET
  website = COALESCE(website, %(website)s),
  website_method = COALESCE(website_method, %(website_method)s),
  email = COALESCE(%(email)s, email),
  email_status = CASE WHEN %(email)s IS NOT NULL THEN %(email_status)s ELSE email_status END,
  email_source_url = CASE WHEN %(email)s IS NOT NULL THEN %(email_source_url)s ELSE email_source_url END,
  phone = COALESCE(phone, %(phone)s),
  phone_source_url = CASE WHEN phone IS NULL AND %(phone)s IS NOT NULL THEN %(phone_source_url)s ELSE phone_source_url END,
  description = COALESCE(description, %(description)s),
  contact_checked_at = NOW(),
  contact_attempts = contact_attempts + 1,
  enriched_at = CASE WHEN %(found)s THEN NOW() ELSE enriched_at END,
  data_confidence = LEAST(100, data_confidence + %(bump)s),
  updated_at = CASE WHEN %(found)s THEN NOW() ELSE updated_at END
WHERE id = %(id)s"""

REFRESH_SQL = """
UPDATE scraped_buyers sb SET quality_score = eksporin_quality(sb),
       hidden_reason = eksporin_hidden_reason(sb),
       is_hidden = eksporin_hidden_reason(sb) IS NOT NULL
 WHERE id = ANY(%s)"""


def _params(row_id: int, r: EnrichResult, had_email: bool, had_phone: bool, had_site: bool) -> dict:
    found = bool(r.website or r.email or r.phone)
    bump = (5 if (r.website and not had_site) else 0) + (12 if (r.email and not had_email) else 0) + (5 if (r.phone and not had_phone) else 0)
    return {
        "id": row_id, "website": r.website, "website_method": r.website_method,
        "email": None if had_email else r.email, "email_status": r.email_status, "email_source_url": r.email_source_url,
        "phone": r.phone, "phone_source_url": r.phone_source_url, "description": r.description,
        "found": found, "bump": bump,
    }


async def run(a: argparse.Namespace) -> int:
    fetcher, searcher = Fetcher(), Searcher()
    disc = Discoverer(fetcher, searcher, use_search=not a.no_search)

    if a.dry_run:
        r = await disc.enrich(a.name, a.country, a.city, a.website)
        print(json.dumps(r.__dict__, indent=1, ensure_ascii=False))
        return 0

    with db_mod.conn() as c, c.cursor() as cur:
        # Keep ranking / hiding current for rows written by any crawler.
        cur.execute("""UPDATE scraped_buyers sb SET quality_score = eksporin_quality(sb),
                              hidden_reason = eksporin_hidden_reason(sb),
                              is_hidden = eksporin_hidden_reason(sb) IS NOT NULL
                        WHERE quality_score IS DISTINCT FROM eksporin_quality(sb)
                           OR is_hidden IS DISTINCT FROM (eksporin_hidden_reason(sb) IS NOT NULL)""")
        if a.id:
            cur.execute("SELECT id, name, country, city, website, email, phone, description FROM scraped_buyers WHERE id=%s", (a.id,))
        else:
            cur.execute(SELECT_QUEUE, (a.max,))
        rows = cur.fetchall()
    print(f"[enrich] {len(rows)} buyers queued, concurrency {a.concurrency}, budget {a.minutes} min")
    deadline = time.time() + a.minutes * 60
    stats = {"done": 0, "site": 0, "new_site": 0, "email": 0, "phone": 0, "errors": 0}
    touched: list[int] = []
    q: asyncio.Queue = asyncio.Queue()
    for r in rows:
        q.put_nowait(r)

    async def worker():
        while not q.empty() and time.time() < deadline:
            row_id, name, country, city, website, email, phone, _desc = await q.get()
            try:
                res = await asyncio.wait_for(disc.enrich(name, country, city, website), timeout=120)
            except Exception as e:
                stats["errors"] += 1
                res = EnrichResult(note=f"error:{type(e).__name__}")
            p = _params(row_id, res, bool(email), bool(phone), bool(website))
            try:
                with db_mod.conn() as c, c.cursor() as cur:
                    cur.execute(UPDATE_SQL, p)
            except Exception as e:
                stats["errors"] += 1
                print(f"[enrich] db error {row_id}: {str(e)[:120]}")
                continue
            touched.append(row_id)
            stats["done"] += 1
            stats["site"] += int(bool(res.website))
            stats["new_site"] += int(bool(res.website and not website))
            stats["email"] += int(bool(res.email and not email))
            stats["phone"] += int(bool(res.phone and not phone))
            if stats["done"] % 25 == 0:
                print(f"[enrich] progress {json.dumps(stats)}")

    await asyncio.gather(*(worker() for _ in range(a.concurrency)))
    if touched:
        with db_mod.conn() as c, c.cursor() as cur:
            cur.execute(REFRESH_SQL, (touched,))
    summary = {**stats, "discovery": disc.stats, "search_backends": searcher.stats, "pages_fetched": fetcher.calls}
    print(f"[enrich] SUMMARY {json.dumps(summary)}")
    print(f"::notice title=enrich summary::{json.dumps(summary)}")
    return 0


def cli() -> None:
    p = argparse.ArgumentParser(description="EksporIn contact enrichment v2")
    p.add_argument("--minutes", type=float, default=30)
    p.add_argument("--max", type=int, default=600)
    p.add_argument("--concurrency", type=int, default=8)
    p.add_argument("--id", type=int)
    p.add_argument("--no-search", action="store_true", help="domain guessing only")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--name")
    p.add_argument("--country")
    p.add_argument("--city")
    p.add_argument("--website")
    a = p.parse_args()
    if not a.dry_run and not (os.environ.get("DATABASE_URL_POSTGRESS") or os.environ.get("DATABASE_URL")):
        print("::error::DATABASE_URL_POSTGRESS not set")
        sys.exit(1)
    sys.exit(asyncio.run(run(a)))


if __name__ == "__main__":
    cli()
