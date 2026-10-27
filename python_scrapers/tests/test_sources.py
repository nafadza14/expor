"""Source discovery: list detection, pagination, judge acceptance, blocklist."""
from python_scrapers.sources import engine as E, queries as Q
from python_scrapers.agent.web import extract_page


def test_list_detection_and_pagination():
    rows = "".join(f"<tr><td>Kaffee Import {i} GmbH</td><td>Hamburg</td><td>info@kaffee{i}.de</td></tr>" for i in range(14))
    page = extract_page("https://www.verband.example/mitglieder",
                        f"<html><body><table>{rows}</table><a href='/mitglieder?page=2'>2</a><a href='/impressum'>Impressum</a></body></html>")
    page.final_url = page.url
    assert E.looks_like_list(page)[0]
    assert E.pagination_links(page, page.url) == ["https://www.verband.example/mitglieder?page=2"]
    assert not E.looks_like_list(extract_page("https://x.example/a", "<html><body>Coffee is nice.</body></html>"))[0]


def test_judge_rules_and_blocklist():
    assert E.accept({"is_list": True, "listed_role": "buyers", "confidence": 80, "companies_on_page": 14})
    assert not E.accept({"is_list": True, "listed_role": "sellers", "confidence": 95, "companies_on_page": 50})
    assert not E.accept({"is_list": True, "listed_role": "buyers", "confidence": 40, "companies_on_page": 50})
    for h in ["www.importyeti.com", "alibaba.com", "www.europages.de", "volza.com"]:
        assert E.BLOCKED_HOSTS.search(h)
    assert not E.BLOCKED_HOSTS.search("www.kaffeeverband.de")


def test_queries_are_multilingual_and_gap_first():
    it = Q.candidates({("0901", "US"): 500})
    first = [next(it) for _ in range(40)]
    assert not any(c["hs4"] == "0901" and c["country"] == "US" for c in first)
    allq = [c for c in Q.candidates({})]
    langs = {c["lang"] for c in allq}
    assert {"en", "de", "fr", "ja", "id"} <= langs
    assert len({c["query"] for c in allq}) > 10000
