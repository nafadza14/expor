"""France: every active company in a buyer NAF class, from the free
government search service recherche-entreprises.api.gouv.fr (SIRENE).

The older crawler (crawlers/sirene_fr.py) asks per keyword and stops at
a few pages; this walks each NAF class to the end. The service allows
25 results per page and about 7 calls per second, and stops at 10 000
results per query, so large classes are split by département.
"""

from __future__ import annotations
import time
from typing import Iterator, Optional

import httpx

from .mapping import classify

BASE = "https://recherche-entreprises.api.gouv.fr/search"
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"
PER_PAGE = 25
MAX_RESULTS = 10_000

NAF_CODES = [
    "46.37Z", "10.83Z", "10.84Z", "10.82Z", "46.36Z", "46.38A", "46.38B", "10.20Z",
    "10.41A", "10.41B", "46.33Z", "20.53Z", "22.19Z", "46.76Z", "46.47Z", "46.31Z", "10.39B",
    "46.42Z", "46.41Z", "46.48Z", "46.45Z", "46.44Z", "46.35Z", "46.39A", "46.39B", "46.73A", "46.73B",
    "46.75Z", "46.21Z", "46.46Z", "46.71Z", "46.49Z", "45.31Z",
]
DEPARTEMENTS = [f"{i:02d}" for i in range(1, 96) if i != 20] + ["2A", "2B", "971", "972", "973", "974", "976"]

SIZE = {"NN": None, "00": None, "01": "small", "02": "small", "03": "small",
        "11": "medium", "12": "medium", "21": "medium"}


class Client:
    def __init__(self) -> None:
        self.c = httpx.Client(timeout=30, headers={"User-Agent": UA, "Accept": "application/json"})
        self.last = 0.0

    def get(self, params: dict) -> dict:
        for attempt in range(5):
            wait = 0.16 - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            r = self.c.get(BASE, params=params)
            if r.status_code == 429:
                time.sleep(2 + attempt * 3)
                continue
            if r.status_code != 200:
                raise RuntimeError(f"SIRENE HTTP {r.status_code}: {r.text[:200]}")
            return r.json()
        raise RuntimeError("SIRENE: rate limited")


def _walk(client: Client, base_params: dict) -> Iterator[dict]:
    page = 1
    while True:
        data = client.get({**base_params, "page": page, "per_page": PER_PAGE})
        results = data.get("results") or []
        yield from results
        total_pages = int(data.get("total_pages") or 0)
        if not results or page >= total_pages or page * PER_PAGE >= MAX_RESULTS:
            return
        page += 1


def companies(client: Client, naf: str) -> Iterator[dict]:
    params = {"activite_principale": naf, "etat_administratif": "A"}
    first = client.get({**params, "page": 1, "per_page": 1})
    total = int(first.get("total_results") or 0)
    print(f"[fr] {naf}: {total} active companies")
    if total <= MAX_RESULTS:
        yield from _walk(client, params)
        return
    for dep in DEPARTEMENTS:
        yield from _walk(client, {**params, "departement": dep})


def to_record(r: dict, naf: str) -> Optional[dict]:
    siren = str(r.get("siren") or "")
    name = (r.get("nom_complet") or r.get("nom_raison_sociale") or "").strip()
    if not siren or not name:
        return None
    # Sole traders (nature juridique 1xxx) are rarely importers.
    if str(r.get("nature_juridique") or "").startswith("1"):
        return None
    siege = r.get("siege") or {}
    codes = [siege.get("activite_principale"), r.get("activite_principale"), naf]
    hit = classify(codes, name, r.get("nom_raison_sociale"), siege.get("liste_enseignes") and " ".join(siege.get("liste_enseignes") or []))
    if not hit:
        return None
    city = siege.get("libelle_commune")
    tranche = str(r.get("tranche_effectif_salarie") or "")
    return {
        "source_id": siren, "name": name, "country": "FR",
        "city": city.title() if isinstance(city, str) else None, "address": siege.get("adresse"),
        "industry": hit["industry"], "buyer_type": hit["buyer_type"], "hs_codes": hit["hs_codes"],
        "size_bucket": SIZE.get(tranche, "large" if tranche else None),
        "data_confidence": 74,
        "evidence_url": f"https://annuaire-entreprises.data.gouv.fr/entreprise/{siren}",
        "raw": {"naf": siege.get("activite_principale") or naf, "tranche": tranche or None,
                "created": r.get("date_creation")},
    }


def run(writer, naf_codes: Optional[list[str]] = None, limit: Optional[int] = None) -> None:
    client = Client()
    n = 0
    for naf in naf_codes or NAF_CODES:
        try:
            for r in companies(client, naf):
                rec = to_record(r, naf)
                if rec:
                    writer.add(rec)
                    n += 1
                    if limit and n >= limit:
                        return
        except Exception as e:
            print(f"::warning::SIRENE {naf} stopped: {str(e)[:200]}")
