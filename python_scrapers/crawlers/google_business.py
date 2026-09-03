"""Google Business Crawler.

Google Maps itself blocks server-side scraping (bot detection, JS-heavy
render, IP throttling). To get the same class of data (name, address,
phone, website, category, coordinates) for coffee/spice/food-import
businesses without paying for SerpAPI or fighting captchas, we use the
free public OpenStreetMap Overpass API. OSM has the same long tail of
small businesses that GeoLeads-style tools pull from Google Maps, kept
current by the OSM community.

Discovery is CATEGORY + COUNTRY:
    (shop=coffee OR amenity=cafe OR shop=tea OR ...) in country=XX

For each hit we normalize to BuyerRecord. The country is authoritative
because we ask Overpass for entities inside that country's admin
polygon. The website crawler pass (src/sources/website-crawler.js)
handles the /contact page harvest for emails; a Sumopod AI call gives
industry classification and a short description.
"""

from __future__ import annotations
import asyncio
import httpx

from ..shared.schema import BuyerRecord


SOURCE = "google_business"
# Public Overpass mirrors. We rotate on failure since the main instance
# is often rate-limited during peak hours.
BASE_MIRRORS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

UA = "EksporIn/1.0 (contact: hello@eksporin.id; +https://ekspor.zieads.com)"

# OSM tags per HS category we care about. Each entry is a list of
# (key, value) filters; we OR them together in the Overpass query.
TAGS_BY_HS: dict[str, list[tuple[str, str]]] = {
    "0901": [
        ("shop", "coffee"), ("shop", "roastery"),
        ("amenity", "cafe"), ("industry", "coffee_roasting"),
    ],
    "0902": [
        ("shop", "tea"), ("amenity", "cafe"),
    ],
    "0904": [  # pepper
        ("shop", "spices"), ("shop", "greengrocer"),
    ],
    "0905": [  # vanilla
        ("shop", "spices"), ("shop", "confectionery"),
    ],
    "0906": [  # cinnamon
        ("shop", "spices"),
    ],
    "0907": [  # cloves
        ("shop", "spices"),
    ],
    "0908": [  # nutmeg
        ("shop", "spices"),
    ],
    "0910": [  # ginger, turmeric
        ("shop", "spices"), ("shop", "health_food"),
    ],
}
DEFAULT_TAGS = [("shop", "food"), ("shop", "wholesale"), ("shop", "supermarket")]

# OSM stores country boundaries with an ISO3166-1 tag on the top admin
# area. All countries in our seed matrix are represented.
COUNTRY_ISO_OK = {"US", "GB", "FR", "DE", "NL", "IT", "JP", "IN", "MY", "EG", "SG", "CN"}


def _size_from_osm(_tags: dict) -> str | None:
    # OSM has no size field; heuristic from shop type.
    return "small"


def _industry_from_tags(tags: dict) -> str | None:
    shop = tags.get("shop")
    amenity = tags.get("amenity")
    industry = tags.get("industry")
    if industry == "coffee_roasting":
        return "coffee roaster"
    if shop == "coffee" or shop == "roastery":
        return "coffee roaster"
    if shop == "tea":
        return "tea shop"
    if shop == "spices":
        return "spice shop"
    if shop == "wholesale":
        return "food wholesale"
    if amenity == "cafe":
        return "cafe"
    if shop == "health_food":
        return "health food store"
    if shop == "confectionery":
        return "confectionery"
    return shop or amenity or industry


def _build_query(tags: list[tuple[str, str]], country: str, limit: int = 50) -> str:
    body = "\n".join(
        f'  node["{k}"="{v}"](area.searchArea);\n  way["{k}"="{v}"](area.searchArea);'
        for k, v in tags
    )
    return (
        f"[out:json][timeout:25];\n"
        f'area["ISO3166-1"="{country}"]->.searchArea;\n'
        f"({body}\n);\n"
        f"out tags center {limit};"
    )


async def crawl_one(keyword: str, country: str, hs_code: str | None = None,
                    limit: int = 40) -> list[BuyerRecord]:
    country = (country or "").upper()
    if country not in COUNTRY_ISO_OK:
        return []
    tags = TAGS_BY_HS.get(hs_code or "", DEFAULT_TAGS)
    query = _build_query(tags, country, limit)

    payload = None
    async with httpx.AsyncClient(
        timeout=60.0,
        headers={"User-Agent": UA, "Accept": "application/json"},
    ) as client:
        for base in BASE_MIRRORS:
            try:
                res = await client.post(base, data={"data": query})
                if res.status_code == 200:
                    payload = res.json()
                    break
            except Exception:
                continue
    if not payload:
        return []

    elements = payload.get("elements") or []
    out: list[BuyerRecord] = []
    seen_names: set[str] = set()
    for el in elements:
        tags = el.get("tags") or {}
        name = (tags.get("name") or tags.get("name:en") or "").strip()
        if not name:
            continue
        # Skip duplicates within one response.
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)

        # OSM address parts.
        street = tags.get("addr:street")
        housenumber = tags.get("addr:housenumber")
        postcode = tags.get("addr:postcode")
        city = tags.get("addr:city") or tags.get("addr:town")
        address_line = " ".join(x for x in [housenumber, street] if x)
        if postcode or city:
            address_line = ", ".join(x for x in [address_line, postcode, city, country] if x)
        elif address_line:
            address_line = f"{address_line}, {country}"

        website = tags.get("contact:website") or tags.get("website")
        phone = tags.get("contact:phone") or tags.get("phone")
        email = tags.get("contact:email") or tags.get("email")

        # Stable source_id: prefer OSM's own id (node/12345 or way/6789).
        osm_type = el.get("type", "node")
        osm_id = el.get("id")
        source_id = f"osm:{osm_type}:{osm_id}" if osm_id else f"osm:{name.lower()}:{country}"

        out.append(BuyerRecord(
            source=SOURCE, source_id=source_id,
            name=name, country=country,
            city=city, address=address_line or None,
            website=website, phone=phone, email=email,
            industry=_industry_from_tags(tags),
            size_bucket=_size_from_osm(tags),
            hs_codes=[hs_code] if hs_code else [],
            data_confidence=75,
            raw={"osm_type": osm_type, "osm_id": osm_id, "tags": tags},
        ))
    return out
