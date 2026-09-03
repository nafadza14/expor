"""Kompass.com crawler. Runs a per-country subdomain search for the
given keyword, delegates parse to the LLM extractor. Kompass uses
per-country subdomains (de.kompass.com, us.kompass.com, uk.kompass.com,
etc). We fall back to the global site when a subdomain does not exist
for the target country."""

from __future__ import annotations
import httpx
from typing import Optional
from urllib.parse import quote_plus

from ..shared.schema import BuyerRecord
from .llm_extractor import extract_buyers, dedup_local


SOURCE = "kompass"

COUNTRY_SUBDOMAIN = {
    "DE": "de", "US": "us", "GB": "uk", "FR": "fr", "IT": "it", "NL": "nl",
    "ES": "es", "JP": "jp", "SG": "sg", "MY": "my", "IN": "in", "EG": "eg",
    "AU": "au", "CA": "ca",
}

DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0 Safari/537.36"
)


def _url_for(country: str, keyword: str) -> str:
    sub = COUNTRY_SUBDOMAIN.get(country.upper(), "www")
    return f"https://{sub}.kompass.com/searchCompanies?q={quote_plus(keyword)}"


async def crawl_one(keyword: str, country: str, hs_code: Optional[str] = None) -> list[BuyerRecord]:
    url = _url_for(country, keyword)
    async with httpx.AsyncClient(
        timeout=25.0,
        headers={"User-Agent": DEFAULT_UA, "Accept-Language": "en"},
        follow_redirects=True,
    ) as client:
        try:
            res = await client.get(url)
        except Exception:
            return []
        if res.status_code != 200 or not res.text:
            return []
        html = res.text[:200_000]

    records = await extract_buyers(
        html=html,
        source=SOURCE,
        country=country.upper(),
        hs_hint=hs_code or keyword,
        url=url,
    )
    return dedup_local(records)
