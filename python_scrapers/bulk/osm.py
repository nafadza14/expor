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
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app; ops@eksporin.id)"

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
    ("shop", "furniture", ["9403", "9401", "4602"], "furniture retailer", "retail_chain"),
]
# Small queries finish fast and fail alone; furniture is by far the largest.
GROUPS = [TAGS[:3], TAGS[3:8], TAGS[8:]]

# Biggest markets for Indonesian products first, so a short run still
# covers them.
ORDER = ["US", "DE", "NL", "JP", "GB", "FR", "AU", "AE", "SA", "KR", "CN", "IT", "BE", "ES", "CA", "SG",
         "MY", "IN", "TW", "TR", "CH", "PL", "SE", "NZ", "AT", "DK", "NO", "IE", "PT", "EG", "TH", "VN",
         "PH", "MX", "BR", "ZA", "PK", "BD"]


def query(iso2: str, tags=None) -> str:
    parts = "\n".join(f'  nwr["{k}"="{v}"]["name"](area.c);' for k, v, *_ in (tags or TAGS))
    return f"""[out:json][timeout:110];
area["ISO3166-1"="{iso2}"][admin_level=2]->.c;
(
{parts}
);
out center tags;"""


class Overpass:
    """Rotates endpoints; an endpoint that keeps failing is tried last."""

    def __init__(self) -> None:
        self.fails = {u: 0 for u in ENDPOINTS}
        self.client = httpx.Client(timeout=httpx.Timeout(130, connect=15),
                                   headers={"User-Agent": UA, "Accept": "application/json"})

    def run(self, q: str, deadline: float) -> Optional[list[dict]]:
        last = None
        for attempt in range(4):
            if time.time() > deadline:
                break
            url = sorted(ENDPOINTS, key=lambda u: self.fails[u])[attempt % len(ENDPOINTS)]
            try:
                r = self.client.post(url, data={"data": q})
                if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
                    self.fails[url] = max(0, self.fails[url] - 1)
                    return r.json().get("elements") or []
                last = f"{url.split('/')[2]} HTTP {r.status_code}"
            except Exception as e:
                last = f"{url.split('/')[2]} {type(e).__name__}"
            self.fails[url] += 1
            time.sleep(4 + attempt * 6)
        print(f"[osm] query failed: {last}")
        return None


def fetch(iso2: str, op: Optional["Overpass"] = None, deadline: Optional[float] = None) -> list[dict]:
    op = op or Overpass()
    deadline = deadline or time.time() + 600
    out: list[dict] = []
    for group in GROUPS:
        els = op.run(query(iso2, group), deadline)
        if els is None:
            print(f"::warning::Overpass {iso2} group {group[0][1]} failed")
            continue
        out += els
    return out


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


def run(writer, countries: Optional[list[str]] = None, limit: Optional[int] = None,
        shard: int = 0, shards: int = 1, minutes: float = 120) -> None:
    configured = [c["iso2"] for c in target_countries(9)]
    codes = countries or [c for c in ORDER if c in configured] + [c for c in configured if c not in ORDER]
    codes = [c for i, c in enumerate(codes) if i % max(1, shards) == shard % max(1, shards)]
    stop = time.time() + minutes * 60
    op = Overpass()
    n = 0
    for iso2 in codes:
        if time.time() > stop:
            print(f"::warning::OSM time budget used; not reached: {iso2} and later")
            break
        # At most 12 minutes per country so one slow country cannot eat the run.
        els = fetch(iso2, op, min(stop, time.time() + 12 * 60))
        kept = 0
        for el in els:
            rec = to_record(el, iso2)
            if rec:
                writer.add(rec)
                kept += 1
                n += 1
                if limit and n >= limit:
                    return
        writer.flush()
        print(f"[osm] {iso2}: {len(els)} elements, {kept} kept")
        time.sleep(2)
