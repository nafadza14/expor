"""Bulk extraction from directory-style pages the agent has opened:
importer lists published by trade-promotion bodies (often PDFs),
association member lists, trade-fair exhibitor lists.

The LLM only proposes rows; every row is checked against the page text
(name must be on the page; email/phone kept only if they literally
appear), Indonesian companies and non-target countries are dropped.
"""

from __future__ import annotations
import json
import re
from typing import Any, Optional

from slugify import slugify

from ..shared import llm
from ..shared.commodities import load as load_config
from .verify import name_on_page, BUYER_TYPES
from .web import Page, host_of, is_non_company_host

PROMPT = (
    "You extract company entries from a directory text (importer list, association member list, "
    "trade fair exhibitor list) for a B2B buyer database. Reply with JSON only: "
    '{"companies":[{"name":...,"country":...,"city":...,"website":...,"email":...,"phone":...,'
    '"type":"importer|distributor|wholesaler|manufacturer|processor|roaster|trader|retail_chain|brand|agent|other",'
    '"products":...}]}. Copy values exactly as written in the text; use null when absent. '
    "Include only real companies listed in the text, at most 60. Skip the publisher, sponsors, "
    "navigation, and companies located in Indonesia."
)

TYPE_MAP = {t: t for t in BUYER_TYPES}


def _country_code(value: Optional[str], fallback: str) -> Optional[str]:
    cfg = load_config()["countries"]
    if not value:
        return fallback
    v = value.strip()
    if len(v) == 2 and v.upper() in {c["iso2"] for c in cfg}:
        return v.upper()
    vl = v.lower()
    aliases = {"usa": "US", "united states of america": "US", "uk": "GB", "england": "GB", "great britain": "GB",
               "holland": "NL", "the netherlands": "NL", "uae": "AE", "korea": "KR", "republic of korea": "KR",
               "deutschland": "DE", "allemagne": "DE", "france": "FR", "nederland": "NL", "belgique": "BE",
               "belgië": "BE", "italia": "IT", "españa": "ES", "japan": "JP", "日本": "JP"}
    if vl in aliases:
        return aliases[vl]
    for c in cfg:
        if c["name"].lower() == vl:
            return c["iso2"]
    if vl in ("indonesia", "id"):
        return "ID"
    return None


def _chunks(text: str, size: int = 9000, max_chunks: int = 5) -> list[str]:
    out, i = [], 0
    while i < len(text) and len(out) < max_chunks:
        j = min(len(text), i + size)
        # cut at a sentence/line-ish boundary
        k = text.rfind(" ", i + int(size * 0.8), j) if j < len(text) else j
        k = k if k > i else j
        out.append(text[i:k])
        i = k
    return out


async def harvest(page: Page, *, commodity: dict, mission_country: str, listing_type: str,
                  model: Optional[str] = None) -> tuple[list[dict], dict]:
    """Returns (records ready for Store.save, stats)."""
    stats = {"proposed": 0, "kept": 0, "dropped_name": 0, "dropped_country": 0, "tokens": 0}
    text = page.text or ""
    if len(text) < 200:
        return [], stats
    norm_text = re.sub(r"\s+", " ", text).lower()
    digits_text = re.sub(r"\D", "", text)
    page_emails = {e.lower() for e in page.emails}
    allowed = {c["iso2"] for c in load_config()["countries"]}
    seen: set[str] = set()
    records: list[dict] = []
    for chunk in _chunks(text):
        try:
            msg = await llm.chat([{"role": "system", "content": PROMPT},
                                  {"role": "user", "content": f"Listing type: {listing_type}. Product focus: {commodity['label_en']}.\n\n{chunk}"}],
                                 json_mode=True, max_tokens=4000, model=model)
        except llm.LLMUnavailable:
            raise
        stats["tokens"] += int((msg.get("_usage") or {}).get("total_tokens") or 0)
        data = llm.parse_json_loose(msg.get("content") or "") or {}
        for c in (data.get("companies") or []) if isinstance(data, dict) else []:
            if not isinstance(c, dict):
                continue
            name = (c.get("name") or "").strip()
            if len(name) < 3:
                continue
            stats["proposed"] += 1
            if not name_on_page(name, chunk):
                stats["dropped_name"] += 1
                continue
            cc = _country_code(c.get("country"), mission_country)
            if not cc or cc == "ID" or cc not in allowed:
                stats["dropped_country"] += 1
                continue
            key = f"{name.lower()}|{cc}"
            if key in seen:
                continue
            seen.add(key)
            email = (c.get("email") or "").strip().lower() or None
            if email and email not in page_emails and email not in norm_text:
                email = None
            phone = (c.get("phone") or "").strip() or None
            if phone and re.sub(r"\D", "", phone) not in digits_text:
                phone = None
            website = (c.get("website") or "").strip() or None
            if website:
                h = host_of(website if "://" in website else "https://" + website)
                website = f"https://{h}" if h and h in norm_text and not is_non_company_host(h) else None
            btype = TYPE_MAP.get((c.get("type") or "").strip().lower())
            if not btype and re.search(r"import", listing_type, re.I):
                btype = "importer"
            conf = 58 + (8 if email else 0) + (4 if phone else 0) + (4 if website else 0)
            hs4 = commodity["hs4"]
            records.append({
                "source": "trade_directory",
                "source_id": f"dir:{slugify(name)[:60]}:{cc.lower()}",
                "name": name[:200], "country": cc, "city": (c.get("city") or None),
                "website": website, "email": email, "phone": phone,
                "industry": f"{(commodity['label_en'].split('(')[0]).strip().lower()} {btype or 'buyer'}",
                "hs_codes": [hs4], "data_confidence": conf,
                "buyer_type": btype, "evidence_url": page.final_url,
                "email_status": ("role" if email and re.match(r"^(info|sales|purchas|import|einkauf|contact|office|mail|order|trade)", email) else ("domain" if email else None)),
                "email_source_url": page.final_url if email else None,
                "raw": {"directory_url": page.final_url, "listing_type": listing_type, "products": c.get("products")},
            })
            stats["kept"] += 1
    return records, stats
