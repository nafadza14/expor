"""Reachability + structure probe, run from a GitHub Actions runner.

Answers "what can our crawlers actually reach from CI, and what does the
page look like?" without exposing any personal data: it records HTTP
status codes, result counts, field LABELS (never field values), column
headers and URL patterns. Output: reports/probe.json.

    python ops/probe.py --out reports/probe.json
"""

from __future__ import annotations
import argparse
import asyncio
import json
import os
import re
import sys
import time
import traceback
from urllib.parse import urlparse

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from python_scrapers.agent.web import Searcher  # noqa: E402

BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")

SOURCES = {
    "usda_oid_home": "https://organic.ams.usda.gov/integrity/",
    "traces_organic_dir": "https://webgate.ec.europa.eu/tracesnt/directory/publication/organic-operator/index",
    "nca_directory": "https://www.ncausa.org/Industry-Resources/Business-Directory",
    "nca_members": "https://ncausa.org/Membership/Member-List",
    "fairtrade_finder": "https://www.fairtrade.net/en/fairtrade-finder.html",
    "flocert_search": "https://www.flocert.net/fairtrade-customer-search/",
    "srilanka_edb_pdf": "https://www.srilankabusiness.com/pdf/read_more_products/annex_10_importers_belgium.pdf",
    "anuga_exhibitor": "https://www.anuga.com/exhibitor/new_english_teas/",
    "dian_open_data": "https://www.dian.gov.co/atencionciudadano/Paginas/Datos-Abiertos.aspx",
    "msc_suppliers": "https://cert.msc.org/SupplierDirectory",
    "companies_house": "https://find-and-update.company-information.service.gov.uk/search/companies?q=coffee",
    "sirene": "https://recherche-entreprises.api.gouv.fr/search?q=cafe&per_page=1",
    "overpass": "https://overpass-api.de/api/status",
    "sumopod": "https://ai.sumopod.com/v1/models",
    "mojeek": "https://www.mojeek.com/search?q=cocoa+importer+germany",
    "bing": "https://www.bing.com/search?q=cocoa+importer+germany",
    "ddg_html": "https://html.duckduckgo.com/html/?q=cocoa+importer+germany",
    "brave_html": "https://search.brave.com/search?q=cocoa+importer+germany&source=web",
}


async def http_checks() -> dict:
    out = {}
    async with httpx.AsyncClient(timeout=25, follow_redirects=True,
                                 headers={"User-Agent": BROWSER_UA, "Accept": "text/html,*/*"}) as c:
        for k, url in SOURCES.items():
            t0 = time.time()
            try:
                r = await c.get(url)
                body = r.text[:200000] if "text" in r.headers.get("content-type", "") or "json" in r.headers.get("content-type", "") else ""
                out[k] = {
                    "status": r.status_code, "final_host": urlparse(str(r.url)).hostname,
                    "ctype": r.headers.get("content-type", "")[:60], "bytes": len(r.content),
                    "secs": round(time.time() - t0, 1),
                    "captcha_hint": bool(re.search(r"captcha|are you a robot|unusual traffic|cf-chl|challenge-platform", body, re.I)),
                    "title": (re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I).group(1).strip()[:120]
                              if re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I) else None),
                }
            except Exception as e:
                out[k] = {"error": f"{type(e).__name__}: {str(e)[:160]}", "secs": round(time.time() - t0, 1)}
    return out


async def search_checks() -> dict:
    """Run the agent's own Searcher backends one by one."""
    s = Searcher()
    out = {}
    queries = ["cocoa bean importer Germany", "Kaffee Rohkaffee Importeur Hamburg", "spice importer Netherlands"]
    backends = {
        "mojeek": s._mojeek, "bing": s._bing, "ddg": s._ddg, "brave_html": s._brave_html,
    }
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
        for name, fn in backends.items():
            res = []
            for q in queries:
                try:
                    hits = await fn(c, q, 8)
                    res.append({"q": q, "n": len(hits), "domains": sorted({urlparse(h.url).hostname or "" for h in hits})[:8]})
                except Exception as e:
                    res.append({"q": q, "error": f"{type(e).__name__}: {str(e)[:120]}"})
                await asyncio.sleep(1.5)
            out[name] = res
    return out


async def browser_checks() -> dict:
    """Load JS-heavy sources in Chromium and record their STRUCTURE only."""
    out: dict = {}
    try:
        from playwright.async_api import async_playwright
    except Exception as e:
        return {"error": f"playwright missing: {e}"}
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(user_agent=BROWSER_UA, accept_downloads=True, viewport={"width": 1400, "height": 1000})

        # ---------------- USDA Organic Integrity Database ----------------
        oid: dict = {"steps": []}
        page = await ctx.new_page()
        xhr: list[str] = []
        page.on("request", lambda r: xhr.append(f"{r.method} {r.url.split('?')[0]}") if r.resource_type in ("xhr", "fetch", "websocket") else None)
        try:
            await page.goto(SOURCES["usda_oid_home"], wait_until="networkidle", timeout=90000)
            oid["title"] = await page.title()
            oid["links"] = (await page.eval_on_selector_all("a", "els => els.map(e => (e.innerText||'').trim()+' => '+(e.getAttribute('href')||'')).filter(s=>s.length<160)"))[:80]
            oid["buttons"] = (await page.eval_on_selector_all("button,input[type=submit],input[type=button]", "els => els.map(e => (e.innerText||e.value||'').trim()).filter(Boolean)"))[:60]
            adv = page.get_by_text(re.compile("Advanced Search", re.I)).first
            if await adv.count():
                await adv.click()
                await page.wait_for_load_state("networkidle", timeout=60000)
                await page.wait_for_timeout(3000)
                oid["steps"].append("advanced_clicked")
                oid["adv_url"] = page.url
                oid["adv_labels"] = (await page.eval_on_selector_all("label", "els => els.map(e => (e.innerText||'').trim()).filter(Boolean)"))[:250]
                oid["adv_inputs"] = (await page.eval_on_selector_all("input,select,textarea", "els => els.map(e => [e.tagName, e.type||'', e.id||'', e.name||'', e.getAttribute('placeholder')||'', e.getAttribute('aria-label')||''].join('|'))"))[:250]
                oid["adv_buttons"] = (await page.eval_on_selector_all("button,a.btn,input[type=submit]", "els => els.map(e => (e.innerText||e.value||'').trim()).filter(Boolean)"))[:80]
                oid["adv_text_sample"] = (await page.inner_text("body"))[:6000]
            oid["xhr"] = sorted(set(xhr))[:60]
        except Exception as e:
            oid["error"] = f"{type(e).__name__}: {str(e)[:300]}"
            oid["trace"] = traceback.format_exc()[-1500:]
        out["usda_oid"] = oid

        # ---------------- EU TRACES organic operator directory ----------------
        tr: dict = {}
        page2 = await ctx.new_page()
        calls: list[dict] = []

        async def on_resp(r):
            if r.request.resource_type in ("xhr", "fetch"):
                item = {"method": r.request.method, "url": r.url.split("?")[0], "status": r.status}
                try:
                    if "json" in (r.headers.get("content-type") or ""):
                        j = await r.json()
                        item["json_keys"] = list(j.keys())[:30] if isinstance(j, dict) else f"list[{len(j)}]"
                        if r.request.method == "POST":
                            item["post_body_keys"] = list(json.loads(r.request.post_data or "{}").keys())[:30]
                except Exception:
                    pass
                calls.append(item)
        page2.on("response", lambda r: asyncio.ensure_future(on_resp(r)))
        try:
            await page2.goto(SOURCES["traces_organic_dir"], wait_until="networkidle", timeout=90000)
            await page2.wait_for_timeout(4000)
            tr["title"] = await page2.title()
            tr["labels"] = (await page2.eval_on_selector_all("label,th", "els => els.map(e => (e.innerText||'').trim()).filter(Boolean)"))[:120]
            tr["buttons"] = (await page2.eval_on_selector_all("button", "els => els.map(e => (e.innerText||'').trim()).filter(Boolean)"))[:60]
            tr["text_sample"] = (await page2.inner_text("body"))[:3000]
        except Exception as e:
            tr["error"] = f"{type(e).__name__}: {str(e)[:300]}"
        tr["calls"] = calls[:60]
        out["traces"] = tr

        # ---------------- NCA directory pager ----------------
        nca: dict = {}
        page3 = await ctx.new_page()
        try:
            await page3.goto(SOURCES["nca_directory"], wait_until="networkidle", timeout=60000)
            nca["title"] = await page3.title()
            nca["pager_links"] = (await page3.eval_on_selector_all("a", "els => els.map(e => (e.innerText||'').trim()+' => '+(e.getAttribute('href')||'')).filter(s => /page|next|\\d+ =>/i.test(s))"))[:40]
            nca["headings"] = (await page3.eval_on_selector_all("h2,h3,h4,th,.listing-title,.company", "els => els.map(e => (e.innerText||'').trim()).filter(Boolean)"))[:20]
        except Exception as e:
            nca["error"] = f"{type(e).__name__}: {str(e)[:300]}"
        out["nca"] = nca
        await b.close()
    return out


async def main_async(out_path: str) -> None:
    report = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    report["http"] = await http_checks()
    try:
        report["search"] = await search_checks()
    except Exception as e:
        report["search"] = {"error": str(e)}
    report["browser"] = await browser_checks()
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    ok = {k: v.get("status") for k, v in report["http"].items()}
    print("::notice title=probe http::" + json.dumps(ok))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="reports/probe.json")
    asyncio.run(main_async(p.parse_args().out))
