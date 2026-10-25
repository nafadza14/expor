"""Offline tests for the AI research agent (no network, no DB, no LLM).

Run from repo root:  python -m python_scrapers.tests.test_agent
"""

from __future__ import annotations
import asyncio
import json
import os
import tempfile

from python_scrapers.shared import llm
from python_scrapers.shared.commodities import by_hs, hs_keywords, country_codes
from python_scrapers.agent import agent as agent_mod
from python_scrapers.agent.agent import ResearchAgent
from python_scrapers.agent.planner import plan
from python_scrapers.agent.store import DryRunStore
from python_scrapers.agent.verify import Session, verify_candidate, quote_on_page, name_on_page
from python_scrapers.agent.web import extract_page, parse_ddg_html, parse_brave_html, SearchResult

HOME = """<html><head><title>Kakao Handelshaus GmbH | Cocoa importer Hamburg</title></head><body>
<nav><a href="/kontakt">Kontakt</a> <a href="/ueber-uns">Über uns</a></nav>
<h1>Kakao Handelshaus GmbH</h1>
<p>Since 1998 we import fermented cocoa beans from Indonesia, Ghana and Ecuador for chocolate makers across Europe.</p>
<script>var x="noise@sentry.io";</script></body></html>"""
CONTACT = """<html><head><title>Kontakt</title></head><body>
<p>Kakao Handelshaus GmbH, Speicherstadt 12, 20457 Hamburg</p>
<p>E-Mail: <a href="mailto:einkauf@kakao-handelshaus.de">einkauf@kakao-handelshaus.de</a> Tel: +49 40 123 456 78</p>
</body></html>"""
ID_EXPORTER = """<html><head><title>PT Kakao Nusantara</title></head><body>
<p>PT Kakao Nusantara is an Indonesian exporter of cocoa beans based in Makassar, Sulawesi.</p></body></html>"""

PAGES = {
    "https://kakao-handelshaus.de": HOME,
    "https://kakao-handelshaus.de/kontakt": CONTACT,
    "https://kakaonusantara.com": ID_EXPORTER,
}


class FakeSearcher:
    calls = 0

    async def search(self, q, n=8):
        self.calls += 1
        return [SearchResult("Kakao Handelshaus GmbH", "https://kakao-handelshaus.de", "cocoa importer Hamburg"),
                SearchResult("PT Kakao Nusantara", "https://kakaonusantara.com", "exporter")]


class FakeFetcher:
    calls = 0

    async def fetch(self, url):
        self.calls += 1
        url = url.rstrip("/")
        html = PAGES.get(url)
        if html is None:
            from python_scrapers.agent.web import Page
            return Page(url=url, final_url=url, status=404, error="HTTP 404")
        return extract_page(url, html)


def _tc(i, name, args):
    return {"id": f"c{i}", "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


SCRIPT = [
    [_tc(1, "web_search", {"query": "Kakao Importeur Deutschland"})],
    [_tc(2, "open_page", {"url": "https://kakao-handelshaus.de"})],
    [_tc(3, "open_page", {"url": "https://kakao-handelshaus.de/kontakt"})],
    # hallucinated quote -> must be rejected
    [_tc(4, "save_buyer", {"name": "Kakao Handelshaus GmbH", "country": "DE", "buyer_type": "importer",
                           "website": "https://kakao-handelshaus.de", "evidence_url": "https://kakao-handelshaus.de",
                           "evidence_quote": "We are the largest cocoa buyer in the world with 900 staff",
                           "email": "ceo@kakao-handelshaus.de"})],
    # corrected; invented email must be dropped and the real one picked up
    [_tc(5, "save_buyer", {"name": "Kakao Handelshaus GmbH", "country": "DE", "buyer_type": "importer",
                           "website": "https://kakao-handelshaus.de", "evidence_url": "https://kakao-handelshaus.de",
                           "evidence_quote": "we import fermented cocoa beans from Indonesia, Ghana and Ecuador",
                           "email": "ceo@kakao-handelshaus.de", "city": "Hamburg",
                           "description": "Hamburg cocoa bean importer supplying European chocolate makers."})],
    [_tc(6, "open_page", {"url": "https://kakaonusantara.com"})],
    # Indonesian exporter must be rejected (country mismatch claims DE)
    [_tc(7, "save_buyer", {"name": "PT Kakao Nusantara", "country": "DE", "buyer_type": "trader",
                           "evidence_url": "https://kakaonusantara.com",
                           "evidence_quote": "PT Kakao Nusantara is an Indonesian exporter of cocoa beans"})],
    [_tc(8, "finish", {"summary": "found 1"})],
]


def test_mission():
    step = {"i": 0}

    async def fake_chat(messages, tools=None, **kw):
        i = step["i"]
        step["i"] += 1
        return {"role": "assistant", "content": "", "tool_calls": SCRIPT[i], "_usage": {"total_tokens": 100}}

    orig = llm.chat
    llm.chat = fake_chat
    agent_mod.llm.chat = fake_chat
    try:
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "o.jsonl")
            store = DryRunStore(out)
            ag = ResearchAgent(store, searcher=FakeSearcher(), fetcher=FakeFetcher(), verbose=True, target=5)
            res = asyncio.run(ag.run_mission(by_hs("1801"), "DE"))
            recs = [json.loads(l) for l in open(out)]
    finally:
        llm.chat = orig
        agent_mod.llm.chat = orig
    assert res.saved == 1, res
    assert res.rejected == 2, res
    r = recs[0]
    assert r["source"] == "ai_agent" and r["hs_codes"] == ["1801"] and r["country"] == "DE"
    assert r["email"] == "einkauf@kakao-handelshaus.de", r["email"]
    assert r["phone"] and "49" in r["phone"]
    assert r["website"] == "https://kakao-handelshaus.de"
    assert r["data_confidence"] >= 80, r["data_confidence"]
    assert any("dropped email" in w for w in r["raw"]["warnings"])
    print("test_mission OK", r["data_confidence"])


def test_verify_units():
    assert quote_on_page("we import fermented cocoa beans", "Since 1998 we import fermented cocoa beans from X")
    assert not quote_on_page("we are the biggest", "unrelated text here about shoes")
    assert name_on_page("Kakao Handelshaus GmbH", "welcome to kakao handelshaus")
    s = Session()
    s.add(extract_page("https://kakao-handelshaus.de", HOME))
    v = verify_candidate({"name": "Kakao Handelshaus GmbH", "country": "DE", "buyer_type": "importer",
                          "website": "https://www.linkedin.com/company/x", "evidence_url": "https://kakao-handelshaus.de",
                          "evidence_quote": "we import fermented cocoa beans from Indonesia"},
                         session=s, mission_country="DE", commodity=by_hs("1801"))
    assert v.ok and v.record["website"] is None, v
    v2 = verify_candidate({"name": "X", "country": "DE", "buyer_type": "importer",
                           "evidence_url": "https://never-opened.com", "evidence_quote": "aaaaaaaaaaaaaaaaaaaa"},
                          session=s, mission_country="DE", commodity=by_hs("1801"))
    assert not v2.ok
    print("test_verify_units OK")


def test_parsers_and_config():
    ddg = ('<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Facme.de%2F&rut=x">'
           'Acme Kaffee</a><a class="result__snippet">Rohkaffee Import</a></div>')
    r = parse_ddg_html(ddg)
    assert r and r[0].url == "https://acme.de/" and "Rohkaffee" in r[0].snippet
    brave = ('<div class="snippet" data-type="web"><a href="https://acme.de/"><div class="title">Acme</div></a>'
             '<div class="snippet-description">Green coffee importer</div></div>')
    b = parse_brave_html(brave)
    assert b and b[0].url == "https://acme.de/" and b[0].snippet
    assert len(hs_keywords()) > 50 and "DE" in country_codes()
    p = plan({}, 5, seed=1)
    assert len(p) == 5
    p2 = plan({("0901", "US"): {"last_agent_run": 9e12}}, 500)
    assert all(not (c["hs4"] == "0901" and co == "US") for c, co in p2)
    print("test_parsers_and_config OK")


def test_json_parsing():
    assert llm.parse_json_loose('<think>hmm {"x":1}</think>{"tool":"finish","args":{}}') == {"tool": "finish", "args": {}}
    assert llm.parse_json_loose('Sure!\n```json\n{"a": "b}"}\n```') == {"a": "b}"}
    assert llm.parse_json_loose('text {"a": {"b": 2}} tail') == {"a": {"b": 2}}
    assert llm.parse_json_loose("no json") is None
    print("test_json_parsing OK")


def test_mission_text_protocol():
    """Model ignores native tools and answers with JSON in content (with
    <think> blocks), as some MiniMax deployments do."""
    step = {"i": 0}

    async def fake_chat(messages, tools=None, **kw):
        i = step["i"]
        step["i"] += 1
        calls = SCRIPT[i - 1] if i else SCRIPT[0]
        if i == 0:
            return {"role": "assistant", "content": "<think>plan</think>I will search now.", "_usage": {}}
        fn = calls[0]["function"]
        body = json.dumps({"tool": fn["name"], "args": json.loads(fn["arguments"])})
        return {"role": "assistant", "content": f"<think>reasoning...</think>\n```json\n{body}\n```", "_usage": {}}

    orig = agent_mod.llm.chat
    agent_mod.llm.chat = fake_chat
    try:
        with tempfile.TemporaryDirectory() as d:
            store = DryRunStore(os.path.join(d, "o.jsonl"))
            ag = ResearchAgent(store, searcher=FakeSearcher(), fetcher=FakeFetcher(), verbose=False, target=5)
            res = asyncio.run(ag.run_mission(by_hs("1801"), "DE"))
    finally:
        agent_mod.llm.chat = orig
    assert not ag.native_tools
    assert res.saved == 1 and res.rejected == 2, res
    print("test_mission_text_protocol OK")


if __name__ == "__main__":
    test_json_parsing()
    test_mission_text_protocol()
    test_verify_units()
    test_parsers_and_config()
    test_mission()
    print("ALL OK")
