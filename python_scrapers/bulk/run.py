"""Bulk buyer import.

  python -m python_scrapers.bulk.run --source uk        # Companies House (GB)
  python -m python_scrapers.bulk.run --source fr        # SIRENE (FR)
  python -m python_scrapers.bulk.run --source no        # Brønnøysund (NO)
  python -m python_scrapers.bulk.run --source bio       # Agence BIO organic importers (FR)
  python -m python_scrapers.bulk.run --source osm       # OpenStreetMap, all target countries
  python -m python_scrapers.bulk.run --source counts    # print totals only

  --dry-run out.jsonl   write JSONL instead of the database
  --limit N             stop after N accepted rows (testing)
  --countries DE,NL     OSM only

Prints GitHub Actions ::notice:: lines so totals are visible on the run page.
"""

from __future__ import annotations
import argparse
import json
import os
import sys

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    __package__ = "python_scrapers.bulk"  # noqa: A001

from .writer import BulkWriter  # noqa: E402

SOURCES = {
    "uk": "companies_house_uk",
    "fr": "sirene_fr",
    "no": "brreg_no",
    "bio": "agencebio_fr",
    "osm": "osm",
}


def counts() -> dict:
    from ..shared import db as db_mod
    with db_mod.conn() as c, c.cursor() as cur:
        cur.execute("""SELECT COUNT(*)::int,
                              COUNT(*) FILTER (WHERE NOT is_hidden)::int,
                              COUNT(*) FILTER (WHERE NOT is_hidden AND (email IS NOT NULL OR phone IS NOT NULL))::int,
                              COUNT(*) FILTER (WHERE NOT is_hidden AND email IS NOT NULL)::int,
                              COUNT(DISTINCT country) FILTER (WHERE NOT is_hidden)::int
                         FROM scraped_buyers""")
        total, visible, contact, email, ncountry = cur.fetchone()
        cur.execute("""SELECT source, COUNT(*)::int, COUNT(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int
                         FROM scraped_buyers WHERE NOT is_hidden GROUP BY 1 ORDER BY 2 DESC""")
        by_source = cur.fetchall()
        cur.execute("""SELECT country, COUNT(*)::int FROM scraped_buyers WHERE NOT is_hidden
                        GROUP BY 1 ORDER BY 2 DESC LIMIT 12""")
        by_country = cur.fetchall()
        cur.execute("""SELECT h, COUNT(*)::int, COUNT(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int
                         FROM scraped_buyers, UNNEST(hs_codes) h WHERE NOT is_hidden GROUP BY 1 ORDER BY 2 DESC""")
        by_hs = cur.fetchall()
    rep = {"total": total, "visible": visible, "with_contact": contact, "with_email": email, "countries": ncountry,
           "by_source": by_source, "by_country": by_country, "by_hs": by_hs}
    print(f"::notice title=Buyer total::total={total} visible={visible} with_contact={contact} with_email={email} countries={ncountry}")
    print("::notice title=By source::" + " | ".join(f"{s}={n} (kontak {k})" for s, n, k in by_source))
    print("::notice title=By country::" + " | ".join(f"{c}={n}" for c, n in by_country))
    print("::notice title=By HS::" + " | ".join(f"{h}={n}/{k}" for h, n, k in by_hs))
    return rep


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, choices=list(SOURCES) + ["counts"])
    ap.add_argument("--dry-run")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--countries")
    ap.add_argument("--zip", help="uk: use a local BasicCompanyData zip")
    args = ap.parse_args()

    if args.source == "counts":
        rep = counts()
        os.makedirs("reports", exist_ok=True)
        with open("reports/counts.json", "w") as fh:
            json.dump(rep, fh, indent=1, default=str)
        return 0

    with BulkWriter(SOURCES[args.source], dry_run_path=args.dry_run) as w:
        if args.source == "uk":
            from . import uk_companies_house as m
            m.run(w, workdir=os.environ.get("RUNNER_TEMP", "/tmp"), zip_path=args.zip, limit=args.limit)
        elif args.source == "fr":
            from . import fr_sirene as m
            m.run(w, limit=args.limit)
        elif args.source == "no":
            from . import no_brreg as m
            m.run(w, limit=args.limit)
        elif args.source == "bio":
            from . import fr_agencebio as m
            m.run(w, limit=args.limit)
        elif args.source == "osm":
            from . import osm as m
            m.run(w, countries=args.countries.split(",") if args.countries else None, limit=args.limit)
    s = w.summary()
    print(f"::notice title=Import {args.source}::" + " ".join(f"{k}={v}" for k, v in s.items()))
    return 0 if s["read"] else 1


if __name__ == "__main__":
    sys.exit(main())
