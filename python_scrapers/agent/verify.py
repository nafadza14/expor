"""Deterministic verification of buyer candidates proposed by the LLM.

The LLM proposes; this module disposes. A candidate is only accepted if
it is grounded in pages the agent actually fetched during this mission:
  - the evidence page was opened by the agent,
  - the evidence quote really appears on that page,
  - the company name appears on the evidence page or its own website,
  - contact details (email / phone) are kept only if seen on a fetched page,
  - the company is based in the mission country and is a buyer type
    (not an Indonesian exporter / origin supplier, not a directory).
Confidence is computed from the evidence, never taken from the LLM.
"""

from __future__ import annotations
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Optional

from slugify import slugify

from .web import Page, host_of, is_non_company_host, normalize_url

BUYER_TYPES = {
    "importer", "distributor", "wholesaler", "manufacturer", "processor",
    "roaster", "trader", "retail_chain", "brand", "packer", "agent",
}

IMPORT_SIGNALS = re.compile(
    r"\b(import(?:er|ers|ing|ed)?|sourcing|we source|origin|green coffee|raw material|"
    r"supplier partners?|distribut(?:or|ion|e)|wholesal(?:e|er)|bulk|trading|"
    r"importeur|großhandel|grosshandel|importateur|grossiste|importador|mayorista|"
    r"importatore|ingrosso|groothandel|輸入|进口|수입)\b", re.I)

LEGAL_SUFFIX = re.compile(
    r"\b(inc|llc|ltd|limited|gmbh|ag|kg|co|corp|corporation|company|bv|b\.v|nv|sa|sas|sarl|"
    r"srl|spa|s\.p\.a|plc|pty|oy|ab|as|kk|k\.k|pte|sdn|bhd|llp|lp|the|and|und|et|de)\b\.?", re.I)

ID_ORIGIN_SIGNALS = re.compile(
    r"(indonesian? (?:exporter|supplier|manufacturer|producer|factory)|"
    r"(?:exporter|supplier|manufacturer|producer) (?:from|in) indonesia|"
    r"\bPT\.? [A-Z][a-z]+|\bCV\.? [A-Z][a-z]+|jakarta|surabaya|bandung|medan|makassar|semarang)",
    re.I)


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", re.sub(r"[^\w@.+ ]", " ", s.lower())).strip()


def name_tokens(name: str) -> list[str]:
    core = LEGAL_SUFFIX.sub(" ", _norm(name))
    return [t for t in core.split() if len(t) >= 3]


def name_on_page(name: str, text: str) -> bool:
    toks = name_tokens(name)
    if not toks:
        return _norm(name) in _norm(text)
    t = _norm(text)
    hits = sum(1 for tok in toks if tok in t)
    return hits / len(toks) >= 0.6


def quote_on_page(quote: str, text: str) -> bool:
    q = _norm(quote)
    if len(q) < 15:
        return False
    t = _norm(text)
    if q in t:
        return True
    # Tolerate small paraphrase / ellipsis: 85% of the quote's content
    # words must appear on the page.
    words = [w for w in q.split() if len(w) >= 4]
    if len(words) < 3:
        return False
    return sum(1 for w in words if w in t) / len(words) >= 0.85


@dataclass
class Session:
    """Everything fetched during one mission; the ground truth for checks."""
    pages: dict[str, Page] = field(default_factory=dict)

    def add(self, page: Page) -> None:
        self.pages[page.url] = page
        self.pages.setdefault(page.final_url, page)

    def get(self, url: str) -> Optional[Page]:
        url = normalize_url(url)
        if url in self.pages:
            return self.pages[url]
        alt = url.rstrip("/") if url.endswith("/") else url + "/"
        return self.pages.get(alt)

    def pages_on_host(self, host: str) -> list[Page]:
        return [p for p in {id(p): p for p in self.pages.values()}.values()
                if host_of(p.final_url) == host or host_of(p.url) == host]

    def all_emails(self) -> set[str]:
        return {e for p in self.pages.values() for e in p.emails}

    def all_phone_digits(self) -> set[str]:
        return {re.sub(r"\D", "", ph) for p in self.pages.values() for ph in p.phones}


@dataclass
class Verdict:
    ok: bool
    reason: str = ""
    record: Optional[dict[str, Any]] = None
    warnings: list[str] = field(default_factory=list)


def verify_candidate(
    cand: dict[str, Any],
    *,
    session: Session,
    mission_country: str,
    commodity: dict[str, Any],
) -> Verdict:
    name = (cand.get("name") or "").strip()
    if len(name) < 2:
        return Verdict(False, "name is required")
    country = (cand.get("country") or mission_country or "").upper()
    if country != mission_country.upper():
        return Verdict(False, f"company country {country} != mission country {mission_country}; only save buyers based in {mission_country}")

    btype = (cand.get("buyer_type") or "").strip().lower().replace(" ", "_")
    if btype not in BUYER_TYPES:
        return Verdict(False, f"buyer_type must be one of {sorted(BUYER_TYPES)}")

    ev_url = normalize_url(cand.get("evidence_url") or "")
    ev_page = session.get(ev_url) if ev_url else None
    if not ev_page or ev_page.error:
        return Verdict(False, "evidence_url must be a page you successfully opened with open_page in this mission")
    quote = cand.get("evidence_quote") or ""
    if not quote_on_page(quote, ev_page.text):
        return Verdict(False, "evidence_quote was not found verbatim on evidence_url; copy an exact sentence from the page")

    warnings: list[str] = []
    website = normalize_url(cand.get("website") or "")
    site_host = host_of(website) if website else ""
    if website and is_non_company_host(site_host):
        warnings.append(f"dropped website {site_host}: directory/social host, not the company's own site")
        website, site_host = "", ""
    if site_host.endswith(".id") or site_host.endswith(".co.id"):
        return Verdict(False, "website is an Indonesian domain: this looks like an Indonesian supplier, not a foreign buyer")

    site_pages = session.pages_on_host(site_host) if site_host else []
    site_text = " ".join(p.text for p in site_pages if not p.error)
    if not (name_on_page(name, ev_page.text) or (site_text and name_on_page(name, site_text))):
        return Verdict(False, "company name does not appear on the evidence page or on its fetched website")

    own_text = site_text or (ev_page.text if not is_non_company_host(ev_page.final_url) else "")
    if own_text and ID_ORIGIN_SIGNALS.search(own_text[:4000]) and not IMPORT_SIGNALS.search(own_text):
        return Verdict(False, "page reads like an Indonesian exporter/producer, not a foreign buyer")

    # Contacts: keep only what was actually observed on fetched pages.
    seen_emails = session.all_emails()
    email = (cand.get("email") or "").strip().lower() or None
    if email and email not in seen_emails:
        warnings.append(f"dropped email {email}: not seen on any fetched page")
        email = None
    if not email and site_host:
        same_domain = sorted(e for e in seen_emails if e.split("@")[-1].removeprefix("www.").endswith(site_host))
        if same_domain:
            email = same_domain[0]
    phone = (cand.get("phone") or "").strip() or None
    if phone and re.sub(r"\D", "", phone) not in session.all_phone_digits():
        warnings.append(f"dropped phone {phone}: not seen on any fetched page")
        phone = None
    if not phone and site_pages:
        for p in site_pages:
            if p.phones:
                phone = p.phones[0]
                break

    # Evidence-based confidence (platform shows >=80 HOT, >=60 WARM).
    combined = f"{ev_page.text} {site_text}"
    kws = [k.lower() for k in (commodity.get("keywords") or [])] + [commodity.get("label_en", "").lower()]
    product_fit = any(k and _norm(k) in _norm(combined) for k in kws)
    import_signal = bool(IMPORT_SIGNALS.search(combined))
    conf = 55
    if site_pages:
        conf += 10
    if email:
        conf += 8
    if phone:
        conf += 4
    if import_signal:
        conf += 8
    if product_fit:
        conf += 7
    else:
        warnings.append("commodity keyword not found on fetched pages")
    if btype in ("importer", "distributor", "wholesaler", "trader", "roaster", "processor"):
        conf += 3
    conf = min(conf, 92)
    if not product_fit and not import_signal:
        return Verdict(False, "no evidence this company buys the commodity (no product or import wording on its pages)")

    hs4 = commodity["hs4"]
    sid_key = site_host or slugify(name)[:60]
    industry = (cand.get("industry") or "").strip().lower()[:80] or \
        f"{commodity.get('label_en', '').split('(')[0].strip().lower()} {btype.replace('_', ' ')}"
    size = cand.get("size_bucket") if cand.get("size_bucket") in ("small", "medium", "large") else None
    record = {
        "source": "ai_agent",
        "source_id": f"ai_agent:{sid_key}:{country.lower()}",
        "name": name[:200],
        "country": country,
        "city": (cand.get("city") or None),
        "address": (cand.get("address") or None),
        "website": (f"https://{site_host}" if site_host else None),
        "email": email,
        "phone": phone,
        "industry": industry,
        "size_bucket": size,
        "description": ((cand.get("description") or "").strip()[:400] or None),
        "hs_codes": [hs4],
        "data_confidence": conf,
        "buyer_type": btype,
        "evidence_url": ev_page.final_url,
        "raw": {
            "evidence_url": ev_page.final_url,
            "evidence_quote": quote[:400],
            "buyer_type": btype,
            "products": cand.get("products"),
            "pages_checked": [p.final_url for p in site_pages][:6],
            "warnings": warnings,
        },
    }
    return Verdict(True, "accepted", record, warnings)
