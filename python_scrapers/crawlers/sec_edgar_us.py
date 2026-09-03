"""US SEC EDGAR full-text search of filings.

The SEC publishes a public JSON API at efts.sec.gov that indexes every
company's filed documents. A search like ?q=coffee%20importer&forms=10-K
returns filings whose text contains those words; each hit carries the
filer's display name and CIK so we can pull identity without scraping.
Only US-listed companies are in scope, so it works only for country=US.

We take at most `max_hits` distinct CIKs per keyword, look up each
company's registered name + business address via the submissions
endpoint, and normalize to a BuyerRecord.
"""

from __future__ import annotations
import asyncio
import httpx
from urllib.parse import quote


from ..shared.schema import BuyerRecord


SOURCE = "sec_edgar_us"
EFTS = "https://efts.sec.gov/LATEST/search-index"
DATA = "https://data.sec.gov/submissions"

UA = "EksporIn/1.0 (contact: hello@eksporin.id)"


def _size_from_sic(sic: str | None) -> str | None:
    # SEC filers are all listed companies, so bias to medium/large.
    if not sic:
        return "medium"
    return "large"


async def _get_company(client: httpx.AsyncClient, cik: str) -> dict | None:
    padded = cik.zfill(10)
    try:
        res = await client.get(f"{DATA}/CIK{padded}.json")
    except Exception:
        return None
    if res.status_code != 200:
        return None
    return res.json()


async def crawl_one(keyword: str, country: str, hs_code: str | None = None,
                    max_hits: int = 8) -> list[BuyerRecord]:
    if country.upper() != "US":
        return []

    async with httpx.AsyncClient(
        timeout=25.0,
        headers={"User-Agent": UA, "Accept": "application/json"},
        follow_redirects=True,
    ) as client:
        # SEC full-text search restricted to recent 10-K + 10-Q filings.
        query = f"{keyword} importer"
        url = f"{EFTS}?q={quote(query)}&forms=10-K,10-Q,8-K"
        try:
            res = await client.get(url)
        except Exception:
            return []
        if res.status_code != 200:
            return []
        hits = ((res.json() or {}).get("hits") or {}).get("hits") or []

        # Dedup by CIK.
        ciks: list[str] = []
        for h in hits:
            src = h.get("_source", {})
            display = src.get("display_names") or []
            for name in display:
                # display_name shape: "COMPANY NAME (CIK 0001234567) (Filer)"
                if "CIK" in name:
                    start = name.rfind("(CIK ") + 5
                    end = name.rfind(")", start)
                    cik = name[start:end].strip()
                    if cik.isdigit() and cik not in ciks:
                        ciks.append(cik)
                        break
            if len(ciks) >= max_hits:
                break

        # Fetch each CIK's company record; polite concurrency.
        sem = asyncio.Semaphore(3)

        async def fetch(cik: str) -> BuyerRecord | None:
            async with sem:
                data = await _get_company(client, cik)
                if not data:
                    return None
                name = (data.get("name") or "").strip()
                if not name:
                    return None
                addr = (data.get("addresses") or {}).get("business") or {}
                address_line = ", ".join(x for x in [
                    addr.get("street1"), addr.get("street2"),
                    addr.get("city"), addr.get("stateOrCountry"),
                    addr.get("zipCode"),
                ] if x)
                sic = str(data.get("sicDescription") or data.get("sic") or "").strip() or None
                return BuyerRecord(
                    source=SOURCE, source_id=str(cik),
                    name=name, country="US",
                    city=addr.get("city"),
                    address=address_line or None,
                    industry=sic or None,
                    size_bucket=_size_from_sic(sic),
                    website=(data.get("website") or None),
                    hs_codes=[hs_code] if hs_code else [],
                    data_confidence=85,
                    raw={"cik": cik, "tickers": data.get("tickers") or []},
                )

        results = await asyncio.gather(*(fetch(c) for c in ciks), return_exceptions=False)
        return [r for r in results if r is not None]
