"""Web access for the research agent: search + polite page fetching.

Search backends, tried in order:
  1. Brave Search API   (BRAVE_API_KEY set; free tier ~2k queries/month)
  2. Brave Search HTML  (no key; same backend the Node enricher uses)
  3. DuckDuckGo HTML    (no key; fallback when Brave throttles)

Fetching respects robots.txt, caps bytes, and rate-limits per host.
"""

from __future__ import annotations
import os
import re
import time
import asyncio
from dataclasses import dataclass, field
from urllib.parse import urlparse, urljoin, parse_qs, unquote, quote_plus
from urllib import robotparser

import httpx
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (compatible; EksporInResearchBot/1.0; +https://ekspor.zieads.com)"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
MAX_BYTES = 600_000
FETCH_TIMEOUT = 15.0
PER_HOST_DELAY = 1.0  # seconds between requests to the same host

# Hosts that are never a buyer's own website. Pages on them may still be
# opened as discovery evidence (e.g. an association member list), but a
# buyer's `website` field must not point at them.
NON_COMPANY_HOSTS = {
    "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com", "pinterest.com", "wikipedia.org", "wikimedia.org",
    "crunchbase.com", "bloomberg.com", "reuters.com", "yellowpages.com", "yelp.com",
    "trustpilot.com", "glassdoor.com", "indeed.com", "zoominfo.com", "dnb.com",
    "rocketreach.co", "apollo.io", "signalhire.com", "opencorporates.com",
    "kompass.com", "europages.com", "europages.co.uk", "yell.com", "alibaba.com",
    "made-in-china.com", "tradeindia.com", "indiamart.com", "globalsources.com",
    "tradekey.com", "go4worldbusiness.com", "ec21.com", "exportersindia.com",
    "importyeti.com", "panjiva.com", "volza.com", "tridge.com", "amazon.com",
    "ebay.com", "etsy.com", "google.com", "bing.com", "duckduckgo.com",
    "brave.com", "search.brave.com", "medium.com", "reddit.com", "quora.com",
    "find-and-update.company-information.service.gov.uk", "sec.gov", "gleif.org",
    "w3.org", "schema.org", "github.com", "wordpress.com", "blogspot.com",
}


def host_of(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return ""


def is_non_company_host(url_or_host: str) -> bool:
    h = host_of(url_or_host) if "/" in url_or_host else url_or_host.lower().removeprefix("www.")
    for bad in NON_COMPANY_HOSTS:
        if h == bad or h.endswith("." + bad):
            return True
    return False


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if url and not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


# ---------------------------------------------------------------- search

@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""


def _clean(s: str) -> str:
    return " ".join((s or "").split())


def parse_brave_html(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "lxml")
    out: list[SearchResult] = []
    seen: set[str] = set()
    blocks = soup.select('div.snippet[data-type="web"], div.snippet, div[data-type="web"]')
    for b in blocks:
        a = b.find("a", href=re.compile(r"^https?://"))
        if not a:
            continue
        url = a["href"]
        if host_of(url).endswith("brave.com") or url in seen:
            continue
        title_el = b.select_one(".title, .snippet-title") or a
        desc_el = b.select_one(".snippet-description, .description, .snippet-content, .content")
        seen.add(url)
        out.append(SearchResult(_clean(title_el.get_text(" ")), url, _clean(desc_el.get_text(" ")) if desc_el else ""))
    if out:
        return out
    # Generic fallback: any external anchor with meaningful text.
    for a in soup.find_all("a", href=re.compile(r"^https?://")):
        url = a["href"]
        text = _clean(a.get_text(" "))
        if len(text) < 12 or host_of(url).endswith("brave.com") or url in seen:
            continue
        seen.add(url)
        out.append(SearchResult(text, url))
    return out


def parse_ddg_html(html: str) -> list[SearchResult]:
    soup = BeautifulSoup(html, "lxml")
    out: list[SearchResult] = []
    for res in soup.select("div.result"):
        a = res.select_one("a.result__a")
        if not a or not a.get("href"):
            continue
        href = a["href"]
        if "duckduckgo.com/l/" in href or href.startswith("/l/"):
            qs = parse_qs(urlparse(href if href.startswith("http") else "https:" + href).query)
            href = unquote((qs.get("uddg") or [""])[0])
        if not href.startswith("http"):
            continue
        if "duckduckgo.com/y.js" in href:  # ads
            continue
        sn = res.select_one(".result__snippet")
        out.append(SearchResult(_clean(a.get_text(" ")), href, _clean(sn.get_text(" ")) if sn else ""))
    return out


class Searcher:
    def __init__(self) -> None:
        self.brave_key = os.environ.get("BRAVE_API_KEY", "").strip()
        self._brave_html_blocked_until = 0.0
        self._lock = asyncio.Lock()
        self._last = 0.0
        self.calls = 0

    async def _pace(self) -> None:
        # Global pacing for search engines: max ~1 query / 1.5s.
        async with self._lock:
            wait = 1.5 - (time.time() - self._last)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = time.time()

    async def search(self, query: str, n: int = 8) -> list[SearchResult]:
        await self._pace()
        self.calls += 1
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as c:
            if self.brave_key:
                try:
                    r = await c.get(
                        "https://api.search.brave.com/res/v1/web/search",
                        params={"q": query, "count": n},
                        headers={"X-Subscription-Token": self.brave_key, "Accept": "application/json"},
                    )
                    if r.status_code == 200:
                        items = ((r.json() or {}).get("web") or {}).get("results") or []
                        res = [SearchResult(_clean(i.get("title", "")), i.get("url", ""),
                                            _clean(re.sub(r"<[^>]+>", "", i.get("description", ""))))
                               for i in items if i.get("url")]
                        if res:
                            return res[:n]
                except Exception:
                    pass
            if time.time() > self._brave_html_blocked_until:
                try:
                    r = await c.get(
                        "https://search.brave.com/search",
                        params={"q": query, "source": "web"},
                        headers={"User-Agent": BROWSER_UA, "Accept": "text/html"},
                    )
                    if r.status_code == 200:
                        res = parse_brave_html(r.text)
                        if res:
                            return res[:n]
                    elif r.status_code in (403, 429):
                        self._brave_html_blocked_until = time.time() + 300
                except Exception:
                    pass
            try:
                r = await c.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": query},
                    headers={"User-Agent": BROWSER_UA, "Accept": "text/html"},
                )
                if r.status_code == 200:
                    return parse_ddg_html(r.text)[:n]
            except Exception:
                pass
        return []


# ---------------------------------------------------------------- fetch

EMAIL_RE = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:\+|00)\d[\d\s().-]{7,17}\d")
BAD_EMAIL = re.compile(
    r"@(sentry|example\.|localhost|test\.|domain\.|sample\.|placeholder\.|wixpress\.com|"
    r"jsdelivr|cloudflare|googletagmanager|hotjar|intercom|sentry-next)", re.I)
BAD_EMAIL_EXT = re.compile(r"\.(png|jpe?g|gif|svg|webp|css|js|ico)$", re.I)
CONTACT_HINT = re.compile(
    r"(contact|kontakt|contacto|contatti|impressum|about|over-ons|uber-uns|ueber-uns|"
    r"qui-sommes|nous-contacter|company|unternehmen|empresa|azienda|team|imprint|"
    r"会社|お問い合わせ|联系|关于|회사|문의)", re.I)


@dataclass
class Page:
    url: str
    final_url: str
    status: int
    title: str = ""
    text: str = ""
    emails: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    contact_links: list[str] = field(default_factory=list)
    error: str | None = None


def extract_page(url: str, html: str, status: int = 200) -> Page:
    soup = BeautifulSoup(html, "lxml")
    title = _clean(soup.title.get_text(" ")) if soup.title else ""
    emails: set[str] = set()
    for a in soup.select('a[href^="mailto:"]'):
        e = unquote(a["href"][7:].split("?")[0]).strip().lower()
        if "@" in e:
            emails.add(e)
    contact_links: list[str] = []
    base_host = host_of(url)
    for a in soup.find_all("a", href=True):
        href = a["href"]
        label = _clean(a.get_text(" "))
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absu = urljoin(url, href)
        if host_of(absu) != base_host:
            continue
        if CONTACT_HINT.search(href) or CONTACT_HINT.search(label):
            if absu not in contact_links:
                contact_links.append(absu)
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "template"]):
        tag.decompose()
    text = _clean(soup.get_text(" "))
    for m in EMAIL_RE.findall(text):
        emails.add(m.lower())
    emails_l = [e for e in emails if not BAD_EMAIL.search(e) and not BAD_EMAIL_EXT.search(e)]
    phones: list[str] = []
    for a in soup.select('a[href^="tel:"]'):
        phones.append(_clean(a["href"][4:]))
    for m in PHONE_RE.findall(text):
        digits = re.sub(r"\D", "", m)
        if 8 <= len(digits) <= 15:
            phones.append(m.strip())
    seen_d: set[str] = set()
    phones_u: list[str] = []
    for p in phones:
        d = re.sub(r"\D", "", p)
        if d and d not in seen_d:
            seen_d.add(d)
            phones_u.append(p)
    return Page(url=url, final_url=url, status=status, title=title, text=text,
                emails=sorted(emails_l)[:8], phones=phones_u[:5], contact_links=contact_links[:8])


class Fetcher:
    def __init__(self, respect_robots: bool = True) -> None:
        self.respect_robots = respect_robots
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self._host_last: dict[str, float] = {}
        self._host_locks: dict[str, asyncio.Lock] = {}
        self.calls = 0

    async def _allowed(self, client: httpx.AsyncClient, url: str) -> bool:
        if not self.respect_robots:
            return True
        p = urlparse(url)
        key = f"{p.scheme}://{p.netloc}"
        if key not in self._robots:
            rp: robotparser.RobotFileParser | None = robotparser.RobotFileParser()
            try:
                r = await client.get(key + "/robots.txt", timeout=8.0)
                if r.status_code == 200:
                    rp.parse(r.text.splitlines())
                else:
                    rp = None  # no robots.txt -> allowed
            except Exception:
                rp = None
            self._robots[key] = rp
        rp = self._robots[key]
        return True if rp is None else rp.can_fetch("EksporInResearchBot", url)

    async def fetch(self, url: str) -> Page:
        url = normalize_url(url)
        host = host_of(url)
        if not host:
            return Page(url=url, final_url=url, status=0, error="invalid url")
        lock = self._host_locks.setdefault(host, asyncio.Lock())
        async with lock:
            wait = PER_HOST_DELAY - (time.time() - self._host_last.get(host, 0))
            if wait > 0:
                await asyncio.sleep(wait)
            self._host_last[host] = time.time()
            self.calls += 1
            try:
                async with httpx.AsyncClient(
                    timeout=FETCH_TIMEOUT, follow_redirects=True,
                    headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml",
                             "Accept-Language": "en;q=0.9,*;q=0.5"},
                ) as c:
                    if not await self._allowed(c, url):
                        return Page(url=url, final_url=url, status=0, error="blocked by robots.txt")
                    async with c.stream("GET", url) as r:
                        ctype = r.headers.get("content-type", "")
                        if "html" not in ctype and "text" not in ctype:
                            return Page(url=url, final_url=str(r.url), status=r.status_code,
                                        error=f"non-html content ({ctype[:40]})")
                        buf = bytearray()
                        async for chunk in r.aiter_bytes():
                            buf.extend(chunk)
                            if len(buf) > MAX_BYTES:
                                break
                        html = buf.decode(r.encoding or "utf-8", errors="replace")
                        page = extract_page(str(r.url), html, r.status_code)
                        page.url = url
                        if r.status_code >= 400:
                            page.error = f"HTTP {r.status_code}"
                        return page
            except Exception as e:
                return Page(url=url, final_url=url, status=0, error=f"{type(e).__name__}: {str(e)[:120]}")


def search_queries_for(commodity: dict, country_name: str) -> list[str]:
    """Seed queries the agent can start from (it is free to invent more)."""
    qs: list[str] = []
    for term in (commodity.get("buyer_terms") or [])[:4]:
        qs.append(f"{term} {country_name}")
    kw = (commodity.get("keywords") or [commodity.get("label_en", "")])[0]
    qs.append(f"{kw} importers {country_name}")
    qs.append(f"{kw} distributor wholesale {country_name}")
    return qs


__all__ = [
    "Searcher", "Fetcher", "Page", "SearchResult", "host_of", "is_non_company_host",
    "normalize_url", "parse_brave_html", "parse_ddg_html", "extract_page", "search_queries_for",
    "quote_plus",
]
