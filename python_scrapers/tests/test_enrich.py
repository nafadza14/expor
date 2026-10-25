"""Offline tests for contact enrichment v2 (no network, no DB).

Run from repo root:  python -m python_scrapers.tests.test_enrich
"""

from __future__ import annotations
import asyncio

from python_scrapers.agent.web import extract_page, Page, SearchResult, parse_bing_html, parse_mojeek_html
from python_scrapers.enrich import discover as disc_mod, validate
from python_scrapers.enrich.discover import Discoverer

SITES = {
    "https://kaffeehaus-nord.de": """<html><head><title>Kaffeehaus Nord GmbH – Rohkaffee Import</title>
      <meta name="description" content="Kaffeehaus Nord GmbH importiert Rohkaffee aus Indonesien, Brasilien und Äthiopien für Röstereien."></head>
      <body><a href="/impressum">Impressum</a> Kaffeehaus Nord GmbH ist Ihr Partner für Rohkaffee seit 1990. """ + "x " * 150 + "</body></html>",
    "https://kaffeehaus-nord.de/impressum": """<html><body><h1>Impressum</h1>Kaffeehaus Nord GmbH, Am Sandtorkai 1, 20457 Hamburg.
      Telefon: +49 40 555 1234. E-Mail: einkauf (at) kaffeehaus-nord (dot) de. Webdesign: <a href="mailto:hello@agentur-xyz.de">agentur</a>
      Datenschutz: datenschutz@kaffeehaus-nord.de</body></html>""",
    "https://stl-spices.com": """<html><head><title>Spice Traders Ltd | Wholesale spices UK</title></head><body>
      Spice Traders Ltd imports pepper, cloves and nutmeg. Contact us: <a href="mailto:sales@stl-spices.com">sales</a>
      or info@stl-spices.com """ + "y " * 150 + "</body></html>",
    "https://parked-example.de": "<html><body>This domain is for sale! Buy this domain at sedo.com " + "z " * 150 + "</body></html>",
}


class FakeFetcher:
    calls = 0

    async def fetch(self, url):
        self.calls += 1
        url = url.rstrip("/")
        html = SITES.get(url)
        if html is None:
            return Page(url=url, final_url=url, status=404, error="HTTP 404")
        return extract_page(url, html)


class FakeSearcher:
    stats = {}

    async def search(self, q, n=8):
        return [SearchResult("Spice Traders Ltd - wholesale spices", "https://stl-spices.com/about", ""),
                SearchResult("Spice Traders on LinkedIn", "https://www.linkedin.com/company/spice-traders", "")]


async def fake_resolves(host):
    return host.removeprefix("www.") in {"kaffeehaus-nord.de", "parked-example.de", "stl-spices.com"}


async def fake_mx(domain):
    return True


def test_enrich():
    disc_mod.resolves = fake_resolves
    validate.has_mail_dns = fake_mx
    d = Discoverer(FakeFetcher(), FakeSearcher())
    r = asyncio.run(d.enrich("Kaffeehaus Nord GmbH", "DE", "Hamburg", None))
    assert r.website == "https://kaffeehaus-nord.de" and r.website_method == "domain_guess", r
    assert r.email == "einkauf@kaffeehaus-nord.de" and r.email_status == "role", r   # not the agency, not datenschutz@
    assert r.phone and "555" in r.phone and r.email_source_url.endswith("/impressum")
    assert r.description and "Rohkaffee" in r.description
    r2 = asyncio.run(d.enrich("Spice Traders Ltd", "GB", None, None))
    assert r2.website == "https://stl-spices.com" and r2.website_method == "search", r2
    assert r2.email == "info@stl-spices.com", r2.email   # info ranks above sales for buyers
    r3 = asyncio.run(d.enrich("Parked Example GmbH", "DE", None, None))
    assert r3.website is None, r3
    print("test_enrich OK", d.stats)


def test_validate_and_parsers():
    assert validate.classify("einkauf@x.de")[0] == "role"
    assert validate.classify("max.mustermann@x.de")[0] == "personal"
    assert validate.registrable("www.shop.example.co.uk") == "example.co.uk"
    bing = ('<li class="b_algo"><h2><a href="https://acme.de/">Acme Kaffee</a></h2>'
            '<div class="b_caption"><p>Rohkaffee Import</p></div></li>')
    assert parse_bing_html(bing)[0].url == "https://acme.de/"
    moj = '<ul class="results-standard"><li><a class="title" href="https://acme.nl/">Acme</a><p class="s">spices</p></li></ul>'
    assert parse_mojeek_html(moj)[0].url == "https://acme.nl/"
    print("test_validate_and_parsers OK")


if __name__ == "__main__":
    test_validate_and_parsers()
    test_enrich()
    print("ALL OK")
