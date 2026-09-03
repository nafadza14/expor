"""Europages.com crawler. Global B2B directory covering most of Europe.
URL pattern: /companies/{country-slug}/{keyword}.html. LLM extractor
does the parse."""

from __future__ import annotations
import httpx
from typing import Optional
from urllib.parse import quote

from ..shared.schema import BuyerRecord
from .llm_extractor import extract_buyers, dedup_local


SOURCE = "europages"

COUNTRY_SLUG = {
    "DE": "germany", "FR": "france", "IT": "italy", "ES": "spain",
    "NL": "netherlands", "BE": "belgium", "AT": "austria", "CH": "switzerland",
    "SE": "sweden", "PL": "poland", "GB": "united-kingdom", "DK": "denmark",
    "US": "united-states-of-america", "PT": "portugal",
}

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0 Safari/537.36"
)


def _url_for(country: str, keyword: str) -> str:
    country = country.upper()
    slug = COUNTRY_SLUG.get(country)
    kw = quote(keyword.replace(" ", "-").lower())
    if slug:
        return f"https://www.europages.co.uk/companies/{slug}/{kw}.html"
    return f"https://www.europages.co.uk/companies/{kw}.html"


async def crawl_one(keyword: str, country: str, hs_code: Optional[str] = None) -> list[BuyerRecord]:
    url = _url_for(country, keyword)
    async with httpx.AsyncClient(
        timeout=25.0,
        headers={"User-Agent": UA, "Accept-Language": "en"},
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
