"""Aggregate data-quality report for scraped_buyers (no company names,
no emails, no phones: counts and ratios only, safe for a public repo).

    python ops/db_report.py --out reports/db.json
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from python_scrapers.shared import db as db_mod  # noqa: E402


def q(cur, sql: str, params=()):
    cur.execute(sql, params)
    cols = [d.name for d in cur.description]
    return [dict(zip(cols, [float(v) if hasattr(v, "is_finite") else v for v in row])) for row in cur.fetchall()]


def main(out: str) -> None:
    rep: dict = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with db_mod.conn() as c, c.cursor() as cur:
        cols = {r["column_name"] for r in q(cur, "SELECT column_name FROM information_schema.columns WHERE table_name='scraped_buyers'")}
        rep["columns"] = sorted(cols)
        rep["totals"] = q(cur, """
            SELECT COUNT(*)::int AS buyers,
                   COUNT(*) FILTER (WHERE website IS NOT NULL)::int AS with_website,
                   COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS with_email,
                   COUNT(*) FILTER (WHERE phone IS NOT NULL)::int AS with_phone,
                   COUNT(*) FILTER (WHERE email IS NOT NULL AND website IS NOT NULL
                       AND email = 'info@' || regexp_replace(regexp_replace(website, '^https?://(www\\.)?', ''), '/.*$', ''))::int AS email_is_guessed_info,
                   COUNT(*) FILTER (WHERE enriched_at IS NOT NULL)::int AS enriched,
                   COUNT(*) FILTER (WHERE description IS NOT NULL)::int AS with_description,
                   COUNT(*) FILTER (WHERE cardinality(hs_codes) = 0)::int AS no_hs,
                   ROUND(AVG(data_confidence))::int AS avg_conf
              FROM scraped_buyers""")[0]
        rep["by_source"] = q(cur, """
            SELECT source, COUNT(*)::int AS n,
                   COUNT(*) FILTER (WHERE website IS NOT NULL)::int AS website,
                   COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS email,
                   COUNT(*) FILTER (WHERE phone IS NOT NULL)::int AS phone,
                   COUNT(*) FILTER (WHERE enriched_at IS NOT NULL)::int AS enriched,
                   ROUND(AVG(data_confidence))::int AS conf,
                   MAX(created_at)::text AS last_new
              FROM scraped_buyers GROUP BY source ORDER BY n DESC""")
        rep["by_country"] = q(cur, """SELECT country, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS email
              FROM scraped_buyers GROUP BY country ORDER BY n DESC LIMIT 25""")
        rep["by_hs"] = q(cur, """SELECT h AS hs, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS email
              FROM scraped_buyers, UNNEST(hs_codes) h GROUP BY h ORDER BY n DESC LIMIT 40""")
        rep["by_industry"] = q(cur, """SELECT COALESCE(industry,'(null)') AS industry, COUNT(*)::int AS n
              FROM scraped_buyers GROUP BY 1 ORDER BY n DESC LIMIT 30""")
        rep["enrich_activity"] = q(cur, """
            SELECT COUNT(*) FILTER (WHERE enriched_at > NOW() - INTERVAL '24 hours')::int AS enriched_24h,
                   COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours')::int AS updated_24h,
                   COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS created_24h,
                   COUNT(DISTINCT id) FILTER (WHERE updated_at > NOW() - INTERVAL '2 hours')::int AS touched_2h
              FROM scraped_buyers""")[0]
        rep["jobs_by_source"] = q(cur, """
            SELECT source, status, COUNT(*)::int AS n, COALESCE(SUM(result_count),0)::int AS results,
                   MAX(COALESCE(finished_at, started_at, created_at))::text AS last
              FROM scrape_jobs WHERE created_at > NOW() - INTERVAL '14 days'
             GROUP BY source, status ORDER BY source, status""")
        meta = "meta" in {r["column_name"] for r in q(cur, "SELECT column_name FROM information_schema.columns WHERE table_name='scrape_jobs'")}
        rep["agent_missions"] = q(cur, f"""
            SELECT hs_code, country, status, result_count,
                   LEFT(COALESCE(error,''), 140) AS error,
                   {"(meta->>'steps')::int AS steps, (meta->>'searches')::int AS searches, (meta->>'pages')::int AS pages, (meta->>'rejected')::int AS rejected, (meta->>'tokens')::int AS tokens, (meta->>'seconds')::float AS secs" if meta else "NULL AS steps"},
                   COALESCE(finished_at, started_at)::text AS at
              FROM scrape_jobs WHERE source = 'ai_agent'
             ORDER BY COALESCE(finished_at, started_at) DESC NULLS LAST LIMIT 40""")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=1, default=str)
    t = rep["totals"]
    print(f"::notice title=db totals::{json.dumps(t)}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="reports/db.json")
    main(p.parse_args().out)
