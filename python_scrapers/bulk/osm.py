"""OpenStreetMap: coffee roasters, tea, spice and chocolate businesses
in the target countries, via the public Overpass API.

Many of these carry website, phone and e-mail tags, so they are usable
immediately. OSM data is (c) OpenStreetMap contributors, ODbL 1.0: the
source is shown on every buyer profile ("OpenStreetMap").
"""

from __future__ import annotations
import time
from typing import Iterator, Optional

import httpx

from ..shared.commodities import countries as target_countries
from .mapping import COCOA, COFFEE, SPICES, TEA

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"

# (key, value) -> (hs codes, industry label, buyer_type)
TAGS: list[tuple[str, str, list[str], str, str]] = [
    ("craft", "coffee_roaster", COFFEE, "coffee roaster", "roaster"),
    ("shop", "coffee", COFFEE + TEA, "coffee and tea retailer", "retail_chain"),
    ("industry", "coffee_roasting", COFFEE, "coffee roaster", "roaster"),
    ("shop", "tea", TEA, "tea retailer", "retail_chain"),
    ("shop", "spices", SPICES, "spice retailer", "retail_chain"),
    ("shop", "chocolate", COCOA, "chocolatier", "manufacturer"),
    ("craft", "chocolatier", COCOA, "chocolatier", "manufacturer"),
    ("craft", "confectionery", COCOA, "chocolate and confectionery maker", "manufacturer"),
]


def query(iso2: str) -> str:
    parts = "\n".join(f'  nwr["{k}"="{v}"]["name"](area.c);' for k, v, *_ in TAGS)
    return f"""[out:json][timeout:240];
area["ISO3166-1"="{iso2}"][admin_level=2]->.c;
(
{parts}
);
out center tags;"""


def fetch(iso2: str) -> list[dict]:
    q = query(iso2)
    last = None
    for attempt in range(6):
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            r = httpx.post(url, data={"data": q}, headers={"User-Agent": UA}, timeout=300)
            if r.status_code == 200:
                return r.json().get("elements") or []
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = str(e)[:120]
        time.sleep(10 + attempt * 10)
    print(f"::warning::Overpass {iso2} failed: {last}")
    return []


def to_record(el: dict, iso2: str) -> Optional[dict]:
    t = el.get("tags") or {}
    name = (t.get("name") or "").strip()
    if len(name) < 3:
        return None
    match = next(((hs, label, bt) for k, v, hs, label, bt in TAGS if t.get(k) == v), None)
    if not match:
        return None
    hs, label, btype = match
    # Coffee shops that only serve drinks are not buyers of beans.
    if t.get("amenity") in ("cafe", "restaurant", "bar", "fast_food") and t.get("craft") != "coffee_roaster":
        return None
    # Branches of chains (brand=Nespresso, Tchibo, Lindt...) are shops, not
    # the buying office; the company itself is covered by the registries.
    if (t.get("brand") or t.get("brand:wikidata")) and btype != "roaster":
        return None
    website = t.get("website") or t.get("contact:website") or t.get("url")
    email = t.get("email") or t.get("contact:email")
    phone = t.get("phone") or t.get("contact:phone") or t.get("contact:mobile")
    city = t.get("addr:city") or t.get("addr:town") or t.get("addr:village")
    street = " ".join(x for x in [t.get("addr:street"), t.get("addr:housenumber")] if x)
    osm_id = f"{el.get('type', 'n')[0]}{el.get('id')}"
    url = f"https://www.openstreetmap.org/{el.get('type', 'node')}/{el.get('id')}"
    return {
        "source_id": osm_id, "name": name, "country": iso2,
        "city": city, "address": ", ".join(x for x in [street, t.get("addr:postcode"), city] if x) or None,
        "website": website, "email": email, "phone": (phone or "").split(";")[0] or None,
        "industry": label, "buyer_type": btype, "hs_codes": hs,
        "size_bucket": "small", "data_confidence": 62,
        "evidence_url": url, "contact_source_url": url,
        "raw": {"osm": osm_id, "tags": {k: t[k] for k in t if k.startswith(("shop", "craft", "industry", "brand", "operator"))}},
    }


def run(writer, countries: Optional[list[str]] = None, limit: Optional[int] = None) -> None:
    codes = countries or [c["iso2"] for c in target_countries(9)]
    n = 0
    for iso2 in codes:
        els = fetch(iso2)
        print(f"[osm] {iso2}: {len(els)} elements")
        for el in els:
            rec = to_record(el, iso2)
            if rec:
                writer.add(rec)
                n += 1
                if limit and n >= limit:
                    return
        time.sleep(5)
