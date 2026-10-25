"""SIRENE France via recherche-entreprises.api.gouv.fr.

The Direction Interministerielle du Numerique publishes a free, unlimited,
no-auth JSON API on top of the INSEE SIRENE / SIRET base plus the DGFIP
enrichment. Every French registered entity is in there, including small
importers relevant to coffee and spices. Response includes SIREN,
official name, primary NAF activity code (used as our industry hint),
head office address, first opening date, and whether the entity is still
active.
"""

from __future__ import annotations
import httpx
from urllib.parse import quote

from ..shared.schema import BuyerRecord


SOURCE = "sirene_fr"
BASE = "https://recherche-entreprises.api.gouv.fr/search"

UA = "EksporIn/1.0 (+https://ekspor.zieads.com; hello@eksporin.id)"

# NAF -> compact English industry label. Not exhaustive; if not mapped we
# keep the raw code so the admin can spot patterns later.
NAF_INDUSTRY = {
    "10.": "food manufacturing",
    "11.": "beverage manufacturing",
    "46.": "wholesale trade",
    "47.": "retail trade",
    "56.": "food service",
    "10.83": "coffee and tea processing",
    "46.37": "coffee, tea and spice wholesale",
    "46.31": "fruit and vegetable wholesale",
    "10.84": "spice manufacturing",
    "10.82": "cocoa and chocolate manufacturing",
    "46.36": "sugar, chocolate and confectionery wholesale",
    "10.41": "oils and fats manufacturing",
    "46.33": "dairy, eggs and edible oils wholesale",
    "46.38A": "fish and seafood wholesale",
    "10.20": "fish and seafood processing",
    "46.38B": "specialised food wholesale",
    "46.39": "food wholesale",
    "10.39": "fruit and vegetable processing",
    "10.89": "food manufacturing",
    "20.53": "essential oils manufacturing",
    "20.59": "chemical products manufacturing",
    "46.75": "chemical products wholesale",
    "46.45": "perfume and cosmetics wholesale",
    "46.76": "intermediate products wholesale",
    "22.19": "rubber products manufacturing",
    "46.47": "furniture and home furnishing wholesale",
    "46.49": "household goods wholesale",
}


def _industry_from_naf(naf: str | None) -> str | None:
    if not naf:
        return None
    # Longest prefix first so "46.37" beats the generic "46.".
    for prefix, label in sorted(NAF_INDUSTRY.items(), key=lambda kv: -len(kv[0])):
        if naf.startswith(prefix):
            return label
    return f"NAF {naf}"


def _size_from_effectif(tranche: str | None) -> str | None:
    """INSEE tranche_effectif_salarie codes:
    NN / 00 = unknown, 01 = 1-2, 02 = 3-5, 03 = 6-9 -> small
    11 = 10-19, 12 = 20-49, 21 = 50-99                -> medium
    22..53 = 100+                                     -> large
    """
    if not tranche:
        return None
    try:
        n = int(tranche)
    except (TypeError, ValueError):
        return None
    if n <= 3:
        return "small"
    if n <= 21:
        return "medium"
    return "large"


async def crawl_one(keyword: str, country: str, hs_code: str | None = None,
                    per_page: int = 50) -> list[BuyerRecord]:
    if country.upper() != "FR":
        return []
    # Map every seed HS to the most relevant NAF codes so we can query by
    # activity (INDUSTRY-FIRST) instead of relying on a keyword hitting
    # the company name. This surfaces real coffee/spice wholesalers that
    # never call themselves "coffee" or "vanilla" but ARE the buyers.
    # NAF codes per HS live in config/commodities.json (`naf`).
    from ..shared.commodities import by_hs
    com = by_hs(hs_code or "")
    naf_focus = list((com or {}).get("naf") or [])
    if not naf_focus:
        return []
    # Employee band 6+ (10+ staff). 12+ was too tight combined with the
    # narrow NAF filter; the intersection was near-empty.
    # Do NOT quote() the comma-separated NAF list. The API expects the
    # commas literally; percent-encoding them makes the server treat the
    # whole thing as one nonsense code and silently drop the filter,
    # which returns unrelated companies whose name happens to look right.
    # Do NOT set minimal=true; that strips libelle_commune and other
    # human-readable fields we want to surface.
    # Walk pages until the API stops returning or we hit max_pages.
    # SIRENE per NAF has a few hundred rows; 5 x 50 = up to 250.
    max_pages = 5
    results = []
    try:
        async with httpx.AsyncClient(timeout=25.0, headers={"User-Agent": UA}) as client:
            for page in range(1, max_pages + 1):
                params = [
                    f"page={page}",
                    f"per_page={per_page}",
                    "etat_administratif=A",
                    "tranche_effectif_salarie=03,11,12,21,22,31,32,41,42,51,52,53",
                    f"activite_principale={','.join(naf_focus)}",
                ]
                url = f"{BASE}?{'&'.join(params)}"
                res = await client.get(url)
                if res.status_code != 200:
                    break
                batch = (res.json() or {}).get("results") or []
                if not batch:
                    break
                results.extend(batch)
                if len(batch) < per_page:
                    break
    except Exception:
        pass

    out: list[BuyerRecord] = []
    for r in results:
        siren = str(r.get("siren") or "")
        name = (r.get("nom_complet") or r.get("nom_raison_sociale") or "").strip()
        if not siren or not name:
            continue
        siege = r.get("siege") or {}
        adresse = siege.get("adresse")
        postal = siege.get("code_postal")
        # Prefer libelle_commune (human name); fall back to parsing the
        # address line "XX RUE FOO 26000 VALENCE" -> "VALENCE".
        city = siege.get("libelle_commune")
        if not city and isinstance(adresse, str) and postal:
            after_postal = adresse.split(str(postal), 1)[-1].strip()
            if after_postal:
                city = after_postal
        address_line = ", ".join(x for x in [adresse, "France"] if x and x != "France")
        if not address_line:
            address_line = ", ".join(x for x in [postal, city, "France"] if x)
        naf = siege.get("activite_principale") or r.get("activite_principale")
        industry = _industry_from_naf(naf)
        size = _size_from_effectif(r.get("tranche_effectif_salarie") or siege.get("tranche_effectif_salarie"))

        out.append(BuyerRecord(
            source=SOURCE, source_id=siren,
            name=name, country="FR",
            city=city, address=address_line or None,
            industry=industry, size_bucket=size,
            hs_codes=[hs_code] if hs_code else [],
            data_confidence=80,
            raw={"siren": siren, "naf": naf, "url": url},
        ))
    return out
