"""Norway: Brønnøysund Enhetsregisteret open data (data.brreg.no).

Filtering by næringskode (SN2007 = NACE with a third decimal) returns
every registered entity in that class. Records often carry the
company's website (hjemmeside) and phone (telefon / mobil), and
sometimes an e-mail address (epostadresse).
"""

from __future__ import annotations
import time
from typing import Iterator, Optional

import httpx

from .mapping import classify

BASE = "https://data.brreg.no/enhetsregisteret/api/enheter"
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"
SIZE = 100
# The API matches by prefix, so class level ("46.37") covers all subclasses.
# Fish processing (10.20) is left out: Norway's processors are exporters.
CODES = ["46.37", "10.83", "10.84", "10.82", "46.36", "46.38", "10.41", "46.33", "20.53", "22.19", "46.47", "46.31", "10.39"]


def entities(client: httpx.Client, code: str) -> Iterator[dict]:
    page = 0
    while True:
        r = client.get(BASE, params={"naeringskode": code, "size": SIZE, "page": page})
        if r.status_code != 200:
            print(f"::warning::Brreg {code} HTTP {r.status_code}")
            return
        data = r.json()
        items = ((data.get("_embedded") or {}).get("enheter")) or []
        yield from items
        pg = data.get("page") or {}
        if not items or page + 1 >= int(pg.get("totalPages") or 0) or (page + 1) * SIZE >= 10_000:
            return
        page += 1
        time.sleep(0.1)


def to_record(e: dict) -> Optional[dict]:
    if e.get("konkurs") or e.get("underAvvikling") or e.get("slettedato"):
        return None
    # Sole proprietorships: usually not importers, and their contact
    # details are a person's own.
    if (e.get("organisasjonsform") or {}).get("kode") == "ENK":
        return None
    codes = [(e.get(k) or {}).get("kode") for k in ("naeringskode1", "naeringskode2", "naeringskode3")]
    name = (e.get("navn") or "").strip()
    activity = " ".join(e.get("aktivitet") or e.get("vedtektsfestetFormaal") or [])
    hit = classify(codes, name, activity)
    if not hit:
        return None
    adr = e.get("forretningsadresse") or e.get("postadresse") or {}
    orgnr = str(e.get("organisasjonsnummer") or "")
    employees = e.get("antallAnsatte")
    size = None
    if isinstance(employees, int):
        size = "small" if employees < 10 else "medium" if employees < 100 else "large"
    return {
        "source_id": orgnr, "name": name, "country": "NO",
        "city": (adr.get("poststed") or "").title() or None,
        "address": ", ".join(x for x in (adr.get("adresse") or []) + [adr.get("postnummer"), adr.get("poststed")] if x) or None,
        "website": e.get("hjemmeside"), "email": e.get("epostadresse"),
        "phone": e.get("telefon") or e.get("mobil"),
        "industry": hit["industry"], "buyer_type": hit["buyer_type"], "hs_codes": hit["hs_codes"],
        "size_bucket": size, "description": activity[:400] or None,
        "data_confidence": 76,
        "evidence_url": f"https://virksomhet.brreg.no/oppslag/enheter/{orgnr}",
        "contact_source_url": f"https://virksomhet.brreg.no/oppslag/enheter/{orgnr}",
        "raw": {"nace": [c for c in codes if c], "orgform": (e.get("organisasjonsform") or {}).get("kode")},
    }


def run(writer, codes: Optional[list[str]] = None, limit: Optional[int] = None) -> None:
    n = 0
    with httpx.Client(timeout=30, headers={"User-Agent": UA, "Accept": "application/json"}) as c:
        for code in codes or CODES:
            for e in entities(c, code):
                rec = to_record(e)
                if rec:
                    writer.add(rec)
                    n += 1
                    if limit and n >= limit:
                        return
