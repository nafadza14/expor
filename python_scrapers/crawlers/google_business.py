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

# OSM tags per HS category. IMPORTER-FIRST filter: we only surface
# entities with the business scale to actually import (roasters,
# wholesalers, food processors, industrial food companies, office
# addresses tagged as commercial). Retail-only tags like shop=coffee
# (a cafe selling cups) or amenity=cafe (a coffee bar) are deliberately
# EXCLUDED. A local Berlin cafe does not import 20 tons of green
# coffee from Indonesia; they buy from the roaster who does. We want
# the roaster.
TAGS_BY_HS: dict[str, list[tuple[str, str]]] = {
    "0901": [
        ("shop", "roastery"),
        ("industry", "coffee_roasting"),
        ("craft", "coffee_roaster"),
        ("shop", "wholesale"),
        ("office", "company"),
    ],
    "0902": [
        ("shop", "wholesale"),
        ("industry", "tea_processing"),
        ("office", "company"),
    ],
    "0904": [  # pepper
        ("shop", "wholesale"),
        ("industry", "food_processing"),
        ("office", "company"),
    ],
    "0905": [  # vanilla
        ("shop", "wholesale"),
        ("industry", "food_processing"),
        ("office", "company"),
    ],
    "0906": [  # cinnamon
        ("shop", "wholesale"),
        ("industry", "food_processing"),
        ("office", "company"),
    ],
    "0907": [  # cloves
        ("shop", "wholesale"),
        ("industry", "food_processing"),
        ("office", "company"),
    ],
    "0908": [  # nutmeg
        ("shop", "wholesale"),
        ("industry", "food_processing"),
        ("office", "company"),
    ],
    "0910": [  # ginger, turmeric
        ("shop", "wholesale"),
        ("industry", "food_processing"),
        ("office", "company"),
    ],
}
DEFAULT_TAGS = [
    ("shop", "wholesale"),
    ("industry", "food_processing"),
    ("office", "company"),
    ("landuse", "commercial"),
]

# Retail signals: if any of these tags is present the entity is almost
# certainly a small consumer-facing shop, not an importer.
RETAIL_SIGNALS = {
    "takeaway", "outdoor_seating", "delivery",
    "seats", "wheelchair",
}
RETAIL_AMENITIES = {"cafe", "fast_food", "restaurant", "bar", "food_court"}
RETAIL_SHOPS = {"coffee", "tea", "spices", "greengrocer", "supermarket",
                "convenience", "bakery", "health_food", "confectionery"}

# OSM stores country boundaries with an ISO3166-1 tag on the top admin
# area. All countries in our seed matrix are represented.
COUNTRY_ISO_OK = {"US", "GB", "FR", "DE", "NL", "IT", "JP", "IN", "MY", "EG", "SG", "CN"}


def _size_from_osm(tags: dict) -> str | None:
    # Wholesale + industrial + registered offices are always at least
    # medium sized; coffee_roaster craft is usually medium.
    if (tags.get("shop") == "wholesale"
            or tags.get("industry") in ("food_processing", "coffee_roasting", "tea_processing")
            or tags.get("office") == "company"):
        return "medium"
    if tags.get("craft") == "coffee_roaster":
        return "medium"
    return "small"


def _industry_from_tags(tags: dict) -> str | None:
    industry = tags.get("industry")
    craft = tags.get("craft")
    shop = tags.get("shop")
    office = tags.get("office")
    if industry == "coffee_roasting" or craft == "coffee_roaster" or shop == "roastery":
        return "coffee roaster"
    if industry == "tea_processing":
        return "tea processor"
    if industry == "food_processing":
        return "food processor"
    if shop == "wholesale":
        return "food wholesale"
    if office == "company":
        return "food import / distribution"
    return industry or craft or shop


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

        # ---- Importer scale gate --------------------------------------
        # Reject rows that look like consumer-facing retail: cafes, bars,
        # takeaway shops, small grocery. These do not import in commercial
        # volumes even if their name contains "coffee".
        if tags.get("amenity") in RETAIL_AMENITIES:
            continue
        if tags.get("shop") in RETAIL_SHOPS:
            continue
        if any(sig in tags for sig in RETAIL_SIGNALS):
            continue
        # Reject rows with no contact / web / phone AND no wholesale
        # signal. A real importer nearly always publishes either a
        # website or a business phone. If it has none of that AND is
        # not tagged as wholesale/industry, treat as noise.
        has_contact = any(k in tags for k in (
            "website", "contact:website", "phone", "contact:phone",
            "email", "contact:email",
        ))
        has_scale_tag = (
            tags.get("shop") == "wholesale"
            or tags.get("industry") in ("food_processing", "coffee_roasting", "tea_processing")
            or tags.get("craft") == "coffee_roaster"
            or tags.get("office") == "company"
        )
        if not has_contact and not has_scale_tag:
            continue
        # ---------------------------------------------------------------

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
