"""Find a company's own website and harvest its public contact details.

Website discovery, cheapest first:
  1. the website we already have;
  2. domain guessing from the legal name + country TLD (no search engine
     needed; very effective for European registries such as SIRENE,
     Companies House, Handelsregister-style names);
  3. keyless web search (mojeek / bing / ddg / brave HTML).
Every candidate is verified by fetching it: the company name must appear
on the site, parked/for-sale domains are rejected.

Contact harvest: home + contact / Impressum / imprint / legal / about
pages (German & Austrian sites must publish an email in the Impressum).
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin

from ..agent.web import Fetcher, Searcher, Page, host_of, is_non_company_host, normalize_url
from ..agent.verify import name_tokens, name_on_page
from ..shared.commodities import country_name
from .validate import resolves, pick_email, normalize_phone, registrable

TLDS = {
    "DE": [".de", ".com"], "AT": [".at", ".com", ".de"], "CH": [".ch", ".com"], "NL": [".nl", ".com"],
    "BE": [".be", ".com"], "FR": [".fr", ".com"], "IT": [".it", ".com"], "ES": [".es", ".com"],
    "PT": [".pt", ".com"], "GB": [".co.uk", ".com", ".uk"], "IE": [".ie", ".com"], "DK": [".dk", ".com"],
    "SE": [".se", ".com"], "NO": [".no", ".com"], "PL": [".pl", ".com"], "US": [".com", ".us"],
    "CA": [".ca", ".com"], "AU": [".com.au", ".com"], "NZ": [".co.nz", ".com"], "JP": [".co.jp", ".jp", ".com"],
    "KR": [".co.kr", ".com"], "TW": [".com.tw", ".com"], "CN": [".com.cn", ".cn", ".com"], "SG": [".com.sg", ".com"],
    "MY": [".com.my", ".com"], "TH": [".co.th", ".com"], "VN": [".vn", ".com"], "PH": [".com.ph", ".com"],
    "IN": [".in", ".co.in", ".com"], "AE": [".ae", ".com"], "SA": [".com.sa", ".sa", ".com"], "TR": [".com.tr", ".com"],
    "EG": [".com.eg", ".com"], "ZA": [".co.za", ".com"], "BR": [".com.br", ".com"], "MX": [".com.mx", ".com"],
}
PARKED = re.compile(r"(domain (is )?for sale|buy this domain|this domain may be for sale|parked (free|domain)|"
                    r"domain parking|sedo\.com|dan\.com|hugedomains|afternic|godaddy\.com/domainsearch|"
                    r"under construction|coming soon|website is (currently )?unavailable|account suspended)", re.I)
CONTACT_PATHS = ["/impressum", "/kontakt", "/contact", "/contact-us", "/imprint", "/legal", "/legal-notice",
                 "/mentions-legales", "/aviso-legal", "/note-legali", "/contatti", "/contacto", "/about", "/about-us",
                 "/en/contact", "/de/kontakt", "/en/imprint", "/company/contact"]
CONTACT_PRIORITY = re.compile(r"(impressum|imprint|kontakt|contact|legal|mentions|aviso|contatti|contacto)", re.I)


@dataclass
class EnrichResult:
    website: Optional[str] = None
    website_found: bool = False
    website_method: Optional[str] = None
    email: Optional[str] = None
    email_status: Optional[str] = None
    email_source_url: Optional[str] = None
    phone: Optional[str] = None
    phone_source_url: Optional[str] = None
    description: Optional[str] = None
    pages: list[str] = field(default_factory=list)
    note: Optional[str] = None


def _slug_variants(name: str) -> list[str]:
    toks = [re.sub(r"[^a-z0-9]", "", t) for t in name_tokens(name)]
    toks = [t for t in toks if t]
    if not toks:
        return []
    v = ["".join(toks[:3]), "-".join(toks[:3]), "".join(toks[:2]), "-".join(toks[:2])]
    if len(toks[0]) >= 5:
        v.append(toks[0])
    out = []
    for x in v:
        if 3 <= len(x) <= 40 and x not in out:
            out.append(x)
    return out[:5]


def _site_matches(name: str, page: Page) -> bool:
    if page.error and not page.text:
        return False
    blob = f"{page.title} {page.text[:8000]}"
    if PARKED.search(blob[:3000]) or len(page.text) < 200:
        return False
    return name_on_page(name, blob)


class Discoverer:
    def __init__(self, fetcher: Optional[Fetcher] = None, searcher: Optional[Searcher] = None,
                 use_search: bool = True) -> None:
        self.fetcher = fetcher or Fetcher()
        self.searcher = searcher or Searcher()
        self.use_search = use_search
        self.stats = {"guess_hit": 0, "search_hit": 0, "known": 0, "miss": 0}

    async def _try_root(self, name: str, root: str) -> Optional[Page]:
        if is_non_company_host(root):
            return None
        page = await self.fetcher.fetch(root)
        return page if _site_matches(name, page) else None

    async def find_website(self, name: str, country: Optional[str], city: Optional[str]) -> tuple[Optional[str], Optional[Page], Optional[str]]:
        tlds = TLDS.get((country or "").upper(), [".com"])
        tried: set[str] = set()
        # 1) domain guessing
        for slug in _slug_variants(name):
            for tld in tlds:
                host = slug + tld
                if host in tried:
                    continue
                tried.add(host)
                if not await resolves(host) and not await resolves("www." + host):
                    continue
                page = await self._try_root(name, "https://" + host)
                if page:
                    self.stats["guess_hit"] += 1
                    return "https://" + host_of(page.final_url or host), page, "domain_guess"
        if not self.use_search:
            return None, None, None
        # 2) search engines
        core = " ".join(name_tokens(name)[:4]) or name
        cname = country_name(country or "") if country else ""
        queries = [f'"{name}" {city or ""} {cname}'.strip(), f"{core} {cname} company website"]
        seen_roots: set[str] = set()
        for q in queries:
            hits = await self.searcher.search(q, 8)
            toks = [t for t in name_tokens(name) if len(t) >= 4]
            ranked = []
            for h in hits:
                host = host_of(h.url)
                if not host or is_non_company_host(host) or host.endswith(".id"):
                    continue
                root = "https://" + host
                if root in seen_roots:
                    continue
                seen_roots.add(root)
                score = sum(3 for t in toks if t in host.replace("-", "")) + sum(1 for t in toks if t in h.title.lower())
                ranked.append((score, root))
            ranked.sort(reverse=True)
            for score, root in ranked[:3]:
                page = await self._try_root(name, root)
                if page:
                    self.stats["search_hit"] += 1
                    return root, page, "search"
        self.stats["miss"] += 1
        return None, None, None

    async def harvest(self, name: str, root: str, home: Optional[Page], country: Optional[str]) -> EnrichResult:
        res = EnrichResult(website=root)
        pages: list[Page] = []
        if home is None:
            home = await self.fetcher.fetch(root)
        if home and not home.error:
            pages.append(home)
        site_host = host_of(root)
        links = [l for l in (home.contact_links if home else []) if host_of(l) == site_host]
        links.sort(key=lambda u: 0 if CONTACT_PRIORITY.search(u) else 1)
        queue = links[:4] + [urljoin(root, p) for p in CONTACT_PATHS]
        seen = {p.final_url.rstrip("/") for p in pages}
        fetched = 0
        email_cands: dict[str, str] = {}
        for u in queue:
            if fetched >= 5:
                break
            key = u.rstrip("/")
            if key in seen:
                continue
            seen.add(key)
            pg = await self.fetcher.fetch(u)
            fetched += 1
            if pg.error or not pg.text:
                continue
            pages.append(pg)
            # Stop early once we have a same-domain email from an Impressum/contact page.
            if any(registrable(e.split("@")[-1]) == registrable(site_host) for e in pg.emails) and CONTACT_PRIORITY.search(u):
                break
        for pg in pages:
            for e in pg.emails:
                email_cands.setdefault(e, pg.final_url)
        best = await pick_email(email_cands, site_host)
        if best:
            res.email, res.email_status, res.email_source_url = best["email"], best["status"], best["source_url"]
        # phone: prefer contact/impressum page
        for pg in sorted(pages, key=lambda p: 0 if CONTACT_PRIORITY.search(p.final_url) else 1):
            for ph in pg.phones:
                n = normalize_phone(ph, country)
                if n:
                    res.phone, res.phone_source_url = n, pg.final_url
                    break
            if res.phone:
                break
        if home and home.meta_description and 40 <= len(home.meta_description) <= 400:
            res.description = home.meta_description
        res.pages = [p.final_url for p in pages]
        return res

    async def enrich(self, name: str, country: Optional[str], city: Optional[str], website: Optional[str]) -> EnrichResult:
        home = None
        method = None
        root = None
        if website:
            root = normalize_url(website)
            root = "https://" + host_of(root) if host_of(root) else None
            if root and is_non_company_host(root):
                root = None
            if root:
                home = await self.fetcher.fetch(root)
                if home.error and not home.text:
                    home = await self.fetcher.fetch(root.replace("https://", "http://"))
                method = "known"
                self.stats["known"] += 1
        if not root:
            root, home, method = await self.find_website(name, country, city)
        if not root:
            return EnrichResult(note="website_not_found")
        res = await self.harvest(name, root, home, country)
        res.website_found = method != "known"
        res.website_method = method
        return res
