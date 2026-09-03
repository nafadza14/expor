"""Generic LLM-powered extractor. Takes an HTML page + a hint about what
we are looking for and returns a list[BuyerRecord]. Every specific
crawler (Kompass, Europages, YellowPages, ...) delegates the parse step
here so we do not maintain hand-written CSS selectors per site."""

from __future__ import annotations
from typing import Iterable
from bs4 import BeautifulSoup
from slugify import slugify

from ..shared.llm import extract_json
from ..shared.schema import BuyerRecord


EXTRACTION_SYSTEM_PROMPT = (
    "You extract company listings from raw HTML for a B2B buyer directory. "
    "Reply with a single JSON object of shape {\"companies\": [ ... ]} and "
    "no prose. Each company entry may have these keys, all optional except name: "
    "name (string), city (string), address (string), website (string), "
    "email (string), phone (string), industry (short lowercase like 'coffee roaster'), "
    "size_bucket ('small'|'medium'|'large'), description (one short English sentence). "
    "Do NOT invent data; leave a field null if the HTML does not say. Skip entries "
    "that are clearly ads, navigation, or footers. Return at most 50 companies."
)


def _clean_html(html: str, max_chars: int = 12000) -> str:
    """Strip tags and boilerplate so the LLM sees mostly content."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "head"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ", strip=True).split())
    return text[:max_chars]


async def extract_buyers(
    html: str,
    source: str,
    country: str | None,
    hs_hint: str | None,
    url: str,
) -> list[BuyerRecord]:
    """Run one LLM extraction pass over one HTML page."""
    text = _clean_html(html)
    if not text or len(text) < 100:
        return []

    user_content = (
        f"Country focus: {country or 'any'}. Commodity focus: {hs_hint or 'any'}.\n"
        f"Source URL: {url}\n\n"
        f"HTML text content:\n{text}"
    )
    parsed = await extract_json(EXTRACTION_SYSTEM_PROMPT, user_content)
    if not parsed:
        return []
    companies = parsed.get("companies") if isinstance(parsed, dict) else None
    if not isinstance(companies, list):
        return []

    out: list[BuyerRecord] = []
    for c in companies:
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        if not name or len(name) < 2:
            continue
        size_bucket = c.get("size_bucket") if c.get("size_bucket") in ("small", "medium", "large") else None
        # Stable source_id derived from source + slugified name + country.
        source_id = f"{source}:{slugify(name)[:60]}:{(country or 'xx').lower()}"
        rec = BuyerRecord(
            source=source,
            source_id=source_id,
            name=name,
            country=country,
            city=c.get("city"),
            address=c.get("address"),
            website=c.get("website"),
            email=c.get("email"),
            phone=c.get("phone"),
            industry=c.get("industry"),
            size_bucket=size_bucket,
            description=c.get("description"),
            hs_codes=[hs_hint] if hs_hint else [],
            data_confidence=65,  # LLM-extracted, mid confidence
            raw={"url": url, "raw_llm": c},
        )
        out.append(rec)
    return out


def dedup_local(records: Iterable[BuyerRecord]) -> list[BuyerRecord]:
    """Drop duplicates within one LLM response before hitting the DB."""
    seen: set[str] = set()
    out: list[BuyerRecord] = []
    for r in records:
        key = (r.name.lower(), (r.country or "").upper())
        skey = f"{key[0]}|{key[1]}"
        if skey in seen:
            continue
        seen.add(skey)
        out.append(r)
    return out
