"""France: certified organic importers from Agence BIO's public
"API Professionnels du bio" (opendata.agencebio.org, open, no key).

Every operator here holds an organic certificate, and the "Importation"
activity means it imports organic products into the EU. Records list the
certified products (CPF codes), the certificate link and often a website
and phone number.
"""

from __future__ import annotations
import time
from typing import Iterator, Optional

import httpx

from .mapping import cpf_hs, words_hs

BASE = "https://opendata.agencebio.org/api/gouv/operateurs/"
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"
PAGE = 100
ACTIVITIES = ["Importation"]
LIVE = {"ENGAGEE", "SUSPENDUE"}


def operators(client: httpx.Client, activity: str) -> Iterator[dict]:
    start = 0
    while True:
        r = client.get(BASE, params={"activite": activity, "nb": PAGE, "debut": start})
        if r.status_code != 200:
            print(f"::warning::Agence BIO HTTP {r.status_code}")
            return
        data = r.json()
        items = data.get("items") or []
        yield from items
        total = int(data.get("nbTotal") or 0)
        start += PAGE
        if not items or start >= total:
            return
        time.sleep(0.05)


def to_record(o: dict) -> Optional[dict]:
    certs = o.get("certificats") or []
    if not any((c.get("etatCertification") or "") in LIVE for c in certs):
        return None
    name = (o.get("denominationcourante") or o.get("raisonSociale") or "").strip()
    if len(name) < 3 or name.strip("0") == "":
        return None
    products = o.get("productions") or []
    hs = cpf_hs(p.get("code") or "" for p in products)
    hs += [h for h in words_hs(name, " ".join(p.get("nom") or "" for p in products)) if h not in hs]
    if not hs:
        return None
    adrs = o.get("adressesOperateurs") or []
    adr = next((a for a in adrs if "Siège social" in (a.get("typeAdresseOperateurs") or [])), adrs[0] if adrs else {})
    if (adr.get("pays") or "FRANCE").upper() not in ("FRANCE", "FR"):
        return None
    sites = [s.get("url") for s in (o.get("siteWebs") or [])
             if s.get("url") and (s.get("typeSiteWeb") or {}).get("nom", "").lower().startswith("site")]
    cert = next((c for c in certs if (c.get("etatCertification") or "") in LIVE), {})
    ident = o.get("numeroBio") or o.get("id")
    return {
        "source_id": str(ident), "name": name, "country": "FR",
        "city": (adr.get("ville") or "").title() or None,
        "address": ", ".join(x for x in [adr.get("lieu"), adr.get("codePostal"), (adr.get("ville") or "").title()] if x) or None,
        "website": sites[0] if sites else None,
        "phone": o.get("telephoneCommerciale") or o.get("telephone"),
        "industry": "certified organic importer", "buyer_type": "importer", "hs_codes": hs,
        "description": ("Importateur bio certifié (" + (cert.get("organisme") or "organisme certificateur") + "). Produits : "
                        + ", ".join(sorted({p.get("nom") for p in products if p.get("nom")}))[:300]) if products else None,
        "data_confidence": 82,
        "evidence_url": cert.get("url") or "https://annuaire.agencebio.org/",
        "contact_source_url": "https://annuaire.agencebio.org/",
        "raw": {"numeroBio": o.get("numeroBio"), "siret": o.get("siret"), "naf": o.get("codeNAF"),
                "certificat": cert.get("numeroControleEu"), "organisme": cert.get("organisme")},
    }


def run(writer, limit: Optional[int] = None) -> None:
    n = 0
    with httpx.Client(timeout=40, headers={"User-Agent": UA, "Accept": "application/json"}) as c:
        for act in ACTIVITIES:
            for o in operators(c, act):
                rec = to_record(o)
                if rec:
                    writer.add(rec)
                    n += 1
                    if limit and n >= limit:
                        return
