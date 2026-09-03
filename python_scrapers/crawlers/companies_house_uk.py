"""Companies House UK crawler.

The public search page at find-and-update.company-information.service.gov.uk
returns 200 with rich HTML for any query. Each result links to
/company/{number}, whose profile page has name, registered address, SIC
industry code and status. Free, no API key needed, no bot protection.

Approach:
1. Fetch search results HTML for the keyword.
2. Parse out /company/{number} links + display names via BeautifulSoup
   (cheap, no LLM cost, HTML structure is stable).
3. For each hit, fetch the profile page and extract structured fields
   with the same LLM extractor the other crawlers use.
"""

from __future__ import annotations
import re
import httpx
import asyncio
from urllib.parse import quote_plus
from bs4 import BeautifulSoup

from ..shared.schema import BuyerRecord
from .llm_extractor import _clean_html
from ..shared.llm import extract_json


SOURCE = "companies_house_uk"
BASE = "https://find-and-update.company-information.service.gov.uk"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0 Safari/537.36"
)

PROFILE_PROMPT = (
    "You extract one UK company profile from a Companies House page. "
    "Return a single JSON object of shape {\"company\": {...}} with keys: "
    "name (string, required), address (string, one-line registered office), "
    "city (string), industry (short lowercase like 'coffee wholesaler'), "
    "size_bucket ('small'|'medium'|'large' guessed from SIC + status), "
    "description (one short English sentence from nature of business), "
    "status (string like 'active'|'dissolved'). Leave any unknown field null."
)


def _search_url(keyword: str) -> str:
    return f"{BASE}/search/companies?q={quote_plus(keyword)}"


def _parse_search(html: str) -> list[tuple[str, str]]:
    """Return [(company_number, display_name), ...] from a search page."""
    soup = BeautifulSoup(html, "lxml")
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for a in soup.select('a[href^="/company/"]'):
        href = a.get("href", "")
        m = re.match(r"^/company/([A-Z0-9]{6,10})$", href)
        if not m:
            continue
        num = m.group(1)
        if num in seen:
            continue
        seen.add(num)
        name = " ".join(a.get_text(" ", strip=True).split())
        if name:
            out.append((num, name))
    return out


async def _fetch_profile(client: httpx.AsyncClient, num: str) -> tuple[str, str] | None:
    url = f"{BASE}/company/{num}"
    try:
        res = await client.get(url)
    except Exception:
        return None
    if res.status_code != 200 or not res.text:
        return None
    return url, res.text


async def crawl_one(keyword: str, country: str, hs_code: str | None = None,
                    max_profiles: int = 15) -> list[BuyerRecord]:
    """Search for `keyword`, take first `max_profiles` hits, LLM-parse each."""
    if country.upper() != "GB":
        # Companies House only knows UK companies.
        return []

    async with httpx.AsyncClient(
        timeout=25.0, headers={"User-Agent": UA, "Accept-Language": "en"},
        follow_redirects=True,
    ) as client:
        try:
            search = await client.get(_search_url(keyword))
        except Exception:
            return []
        if search.status_code != 200:
            return []
        hits = _parse_search(search.text)[:max_profiles]
        if not hits:
            return []

        records: list[BuyerRecord] = []
        # Fetch profile pages concurrently but modestly (avoid burning our
        # welcome). LLM extraction happens after per profile.
        sem = asyncio.Semaphore(3)

        async def process(num: str, display_name: str) -> BuyerRecord | None:
            async with sem:
                fetched = await _fetch_profile(client, num)
                if not fetched:
                    return None
                url, html = fetched
                text = _clean_html(html)
                if not text:
                    return None
                parsed = await extract_json(
                    PROFILE_PROMPT,
                    f"Company number: {num}\nURL: {url}\n\n{text}",
                )
                comp = parsed.get("company") if isinstance(parsed, dict) else None
                if not isinstance(comp, dict):
                    return BuyerRecord(
                        source=SOURCE, source_id=num, name=display_name,
                        country="GB", data_confidence=70,
                        hs_codes=[hs_code] if hs_code else [],
                        raw={"url": url},
                    )
                name = (comp.get("name") or display_name).strip()
                if not name:
                    return None
                status = (comp.get("status") or "").lower()
                if "dissolved" in status:
                    # Skip closed companies; useless as buyers.
                    return None
                return BuyerRecord(
                    source=SOURCE, source_id=num, name=name, country="GB",
                    city=comp.get("city"), address=comp.get("address"),
                    industry=comp.get("industry"),
                    size_bucket=comp.get("size_bucket") if comp.get("size_bucket") in ("small", "medium", "large") else None,
                    description=comp.get("description"),
                    hs_codes=[hs_code] if hs_code else [],
                    data_confidence=80,
                    raw={"url": url, "raw_llm": comp},
                )

        results = await asyncio.gather(*(process(n, d) for n, d in hits), return_exceptions=False)
        for r in results:
            if r is not None:
                records.append(r)
        return records
