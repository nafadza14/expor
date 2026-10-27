"""United States: city business registries published on Socrata open-data
portals. There is no national US company register with activity codes, but
the largest import hubs publish every licensed business, most with a NAICS
code:

  Los Angeles  data.lacity.org     6rrh-rzua  Listing of Active Businesses (NAICS 6 digit)
  San Francisco data.sfgov.org     g8m3-pdis  Registered Business Locations (NAICS sector only)
  Seattle      data.seattle.gov    wnbq-64tb  Active Business License Tax Certificates (NAICS)

Columns differ per city, so they are discovered from the first rows. With a
6-digit NAICS code the company is classified by code (mapping.NAICS);
otherwise only by name (mapping.classify_name: commodity word + trade word).
"""

from __future__ import annotations
import re
import time
from typing import Iterator, Optional

import httpx

from .mapping import classify_name, classify_naics

UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"
PAGE = 50_000

CITIES = [
    {"key": "la", "domain": "data.lacity.org", "id": "6rrh-rzua", "city": "Los Angeles", "state": "CA"},
    {"key": "sf", "domain": "data.sfgov.org", "id": "g8m3-pdis", "city": "San Francisco", "state": "CA"},
    {"key": "sea", "domain": "data.seattle.gov", "id": "wnbq-64tb", "city": "Seattle", "state": "WA"},
]

NAME_KEYS = ["business_name", "business_legal_name", "legal_name", "ownership_name", "dba_name", "trade_name", "dba"]
DBA_KEYS = ["dba_name", "trade_name", "dba"]
NAICS_KEYS = ["naics", "naics_code", "naic_code", "primary_naics", "naicscode"]
NAICS_DESC = ["primary_naics_description", "naics_description", "naic_code_description", "naicsdescription"]
ADDR_KEYS = ["street_address", "full_business_address", "address", "business_address"]
CITY_KEYS = ["city", "business_city"]
ZIP_KEYS = ["zip_code", "business_zip", "zip", "zipcode"]
END_KEYS = ["location_end_date", "dba_end_date", "end_date", "license_end_date", "closed_date"]


def first(row: dict, keys: list[str]) -> Optional[str]:
    for k in keys:
        v = row.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, (int, float)):
            return str(v)
    return None


def rows(client: httpx.Client, c: dict) -> Iterator[dict]:
    offset = 0
    url = f"https://{c['domain']}/resource/{c['id']}.json"
    order = True
    while True:
        last = None
        r = None
        for attempt in range(4):
            params = {"$limit": PAGE, "$offset": offset}
            if order:
                params["$order"] = ":id"
            try:
                r = client.get(url, params=params)
                if r.status_code == 200:
                    break
                last = f"HTTP {r.status_code}: {r.text[:120]}"
                if r.status_code == 400 and order:
                    order = False  # some views do not allow ordering by :id
                    continue
            except Exception as e:
                last = f"{type(e).__name__}: {str(e)[:80]}"
            r = None
            time.sleep(5 + attempt * 10)
        if r is None or r.status_code != 200:
            print(f"::warning::{c['city']} registry unavailable at offset {offset}: {last}")
            return
        batch = r.json()
        if not isinstance(batch, list) or not batch:
            return
        yield from batch
        if len(batch) < PAGE:
            return
        offset += PAGE


def to_record(row: dict, c: dict) -> Optional[dict]:
    if first(row, END_KEYS):
        return None  # closed location
    legal = first(row, NAME_KEYS)
    dba = first(row, DBA_KEYS)
    name = dba if dba and len(dba) > 3 and not re.fullmatch(r"(n/?a|none|same)", dba, re.I) else legal
    if not name:
        return None
    naics = first(row, NAICS_KEYS) or ""
    desc = first(row, NAICS_DESC) or ""
    hit = None
    if re.sub(r"\D", "", naics)[:6].isdigit() and len(re.sub(r"\D", "", naics)) >= 6:
        hit = classify_naics([naics], name, legal, desc)
    if not hit and (not naics or len(re.sub(r"\D", "", naics)) < 6 or re.search(r"wholesale|manufactur", desc, re.I)):
        hit = classify_name(name, legal)
    if not hit:
        return None
    ident = first(row, ["location_account", "account_number", "ubi", "certificate_number", "uniqueid", "ttxid", "business_account_number"]) \
        or f"{name}|{first(row, ADDR_KEYS) or ''}"
    city = (first(row, CITY_KEYS) or c["city"]).title()
    addr = ", ".join(x for x in [first(row, ADDR_KEYS), city, c["state"], first(row, ZIP_KEYS)] if x)
    return {
        "source_id": f"{c['key']}:{ident}"[:190], "name": name, "country": "US",
        "city": city, "address": addr or None,
        "industry": hit["industry"], "buyer_type": hit["buyer_type"], "hs_codes": hit["hs_codes"],
        "data_confidence": 68,
        "evidence_url": f"https://{c['domain']}/d/{c['id']}",
        "raw": {"registry": c["key"], "naics": naics or None, "naics_desc": desc or None, "legal_name": legal},
    }


def run(writer, cities: Optional[list[str]] = None, limit: Optional[int] = None) -> None:
    n = 0
    with httpx.Client(timeout=httpx.Timeout(120, connect=20), follow_redirects=True, headers={"User-Agent": UA, "Accept": "application/json"}) as client:
        for c in CITIES:
            if cities and c["key"] not in cities:
                continue
            seen = kept = 0
            for row in rows(client, c):
                seen += 1
                rec = to_record(row, c)
                if rec:
                    writer.add(rec)
                    kept += 1
                    n += 1
                    if limit and n >= limit:
                        return
            writer.flush()
            print(f"[us] {c['city']}: {seen} businesses read, {kept} buyers kept")
