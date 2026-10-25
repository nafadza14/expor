"""USDA Organic Integrity Database (OID) crawler.

Why: since the 2024 Strengthening Organic Enforcement rule every business
that imports organic products into the US must be certified, so OID is
the official list of organic importers / traders / handlers worldwide,
with products and (on most profiles) contact name, phone, email, website.
Public US-government data, no login, no API key.

How (browser automation, the site is a Blazor app):
  1. Advanced Search: scope = Handling, status = Certified, certified
     product contains <keyword> (coffee, cocoa, vanilla, ...).
  2. "Export to Excel" the result list; parse it with flexible header
     matching (column names have changed over time).
  3. For rows without contact columns, open the operation profile page
     and read the labelled contact fields.
Only operations located outside Indonesia, in our target countries, are
kept; product text is mapped to HS-4 via config/commodities.json.

    python -m python_scrapers.crawlers.usda_oid --keywords coffee,cocoa --max-profiles 200
"""

from __future__ import annotations
import argparse
import asyncio
import json
import os
import re
import sys
import time
from typing import Any, Optional

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    __package__ = "python_scrapers.crawlers"  # noqa: A001

from ..shared.commodities import load as load_config  # noqa: E402

BASE = "https://organic.ams.usda.gov/integrity/"
SOURCE = "usda_oid"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")

DEFAULT_KEYWORDS = ["coffee", "cocoa", "cacao", "vanilla", "pepper", "cinnamon", "clove", "nutmeg", "ginger",
                    "turmeric", "coconut", "palm sugar", "coconut sugar", "patchouli", "essential oil", "tea",
                    "cardamom", "seaweed", "cashew"]

COUNTRY_ALIASES = {"united states": "US", "united states of america": "US", "usa": "US", "u.s.a.": "US",
                   "united kingdom": "GB", "uk": "GB", "netherlands": "NL", "the netherlands": "NL",
                   "korea, republic of": "KR", "south korea": "KR", "republic of korea": "KR",
                   "taiwan, province of china": "TW", "viet nam": "VN", "united arab emirates": "AE",
                   "türkiye": "TR", "turkiye": "TR", "russian federation": "RU"}

# header -> canonical field (substring match on lowercased header)
HEADER_MAP = [
    ("operation name", "name"), ("operation", "name"), ("business name", "name"),
    ("contact first", "contact_first"), ("contact last", "contact_last"), ("contact name", "contact_name"),
    ("contact", "contact_name"),
    ("phone", "phone"), ("telephone", "phone"),
    ("email", "email"), ("e-mail", "email"),
    ("website", "website"), ("web site", "website"), ("url", "website"),
    ("physical address", "address"), ("street", "address"), ("address", "address"),
    ("city", "city"), ("state", "state"), ("country", "country"), ("zip", "zip"), ("postal", "zip"),
    ("certifier", "certifier"), ("status", "status"),
    ("handling", "handling"), ("scope", "scopes"),
    ("certified products", "products"), ("items", "products"), ("product", "products"),
    ("nop id", "nop_id"), ("operation id", "nop_id"), ("op id", "nop_id"),
    ("business type", "business_types"), ("services", "business_types"),
]


def canonical_headers(header: list[Any]) -> dict[int, str]:
    out: dict[int, str] = {}
    used: set[str] = set()
    for i, h in enumerate(header):
        hl = str(h or "").strip().lower()
        for pat, field in HEADER_MAP:
            if pat in hl and field not in used:
                out[i] = field
                used.add(field)
                break
    return out


def rows_from_xlsx(path: str) -> list[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    header: list[Any] = []
    # header is the first row with >= 4 non-empty cells
    for row in it:
        if sum(1 for c in row if c not in (None, "")) >= 4:
            header = list(row)
            break
    cols = canonical_headers(header)
    rows = []
    for row in it:
        d = {f: (str(row[i]).strip() if i < len(row) and row[i] is not None else None) for i, f in cols.items()}
        if d.get("name"):
            rows.append(d)
    return rows


def country_iso(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    v = v.strip()
    cfg = load_config()["countries"]
    if len(v) == 2:
        return v.upper()
    vl = v.lower()
    if vl in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[vl]
    for c in cfg:
        if c["name"].lower() == vl:
            return c["iso2"]
    if vl == "indonesia":
        return "ID"
    return None


def hs_for_products(text: str) -> list[str]:
    t = (text or "").lower()
    out = []
    for c in load_config()["commodities"]:
        words = [w.lower() for w in (c.get("keywords") or [])] + [c["label_en"].split("(")[0].strip().lower()]
        if any(w and re.search(r"\b" + re.escape(w) + r"s?\b", t) for w in words):
            out.append(c["hs4"])
    return out


def to_record(d: dict) -> Optional[dict]:
    cc = country_iso(d.get("country"))
    allowed = {c["iso2"] for c in load_config()["countries"]}
    if not cc or cc == "ID" or cc not in allowed:
        return None
    if d.get("status") and not re.search(r"certified", d["status"], re.I):
        return None
    hs = hs_for_products(d.get("products") or "")
    if not hs:
        return None
    email = (d.get("email") or "").strip().lower() or None
    if email and not re.fullmatch(r"[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+", email):
        email = None
    website = (d.get("website") or "").strip() or None
    if website and not website.startswith("http"):
        website = "https://" + website
    phone = (d.get("phone") or "").strip() or None
    btypes = (d.get("business_types") or "").lower()
    buyer_type = ("importer" if "import" in btypes else "trader" if ("broker" in btypes or "trader" in btypes)
                  else "distributor" if "distribut" in btypes else "processor" if "process" in btypes else "packer"
                  if "pack" in btypes else None)
    nid = d.get("nop_id") or f"{d['name'].lower()}|{cc}"
    products = (d.get("products") or "")[:600]
    conf = 70 + (10 if email else 0) + (5 if phone else 0)
    return {
        "source": SOURCE, "source_id": f"oid:{nid}"[:200],
        "name": d["name"][:200], "country": cc, "city": d.get("city"),
        "address": ", ".join(x for x in [d.get("address"), d.get("city"), d.get("state"), d.get("zip")] if x) or None,
        "website": website, "email": email, "phone": phone,
        "industry": f"certified organic {buyer_type or 'handler'}",
        "description": f"USDA-certified organic handler. Certified products include: {products[:220]}" if products else None,
        "hs_codes": hs, "data_confidence": min(95, conf),
        "buyer_type": buyer_type or "trader",
        "evidence_url": d.get("profile_url") or BASE,
        "email_status": None, "email_source_url": (d.get("profile_url") or BASE) if email else None,
        "raw": {"certifier": d.get("certifier"), "scopes": d.get("scopes"), "business_types": d.get("business_types"),
                "products": products, "nop_id": d.get("nop_id"), "contact_name_present": bool(d.get("contact_name") or d.get("contact_last"))},
    }


# ------------------------------------------------------------------ browser

async def _click_text(page, pattern: str, timeout: int = 15000) -> bool:
    loc = page.get_by_text(re.compile(pattern, re.I)).first
    try:
        await loc.wait_for(timeout=timeout)
        await loc.click()
        return True
    except Exception:
        return False


async def export_search(ctx, keyword: str, outdir: str, log) -> Optional[str]:
    """Run an Advanced Search for handlers certified for `keyword` and
    export the results. Returns the xlsx path or None."""
    page = await ctx.new_page()
    try:
        await page.goto(BASE, wait_until="networkidle", timeout=90000)
        if not await _click_text(page, r"^\s*Advanced Search\s*$|Advanced Search"):
            log("advanced_search_link_not_found")
            return None
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2500)
        # Certified products field: find an input whose label / placeholder mentions product.
        filled = False
        for sel in ['input[placeholder*="roduct" i]', 'input[aria-label*="roduct" i]', 'input[id*="roduct" i]', 'input[name*="roduct" i]']:
            loc = page.locator(sel).first
            if await loc.count():
                await loc.fill(keyword)
                filled = True
                break
        if not filled:
            lbl = page.get_by_label(re.compile(r"certified products|products", re.I)).first
            try:
                await lbl.fill(keyword, timeout=5000)
                filled = True
            except Exception:
                pass
        if not filled:
            log("product_field_not_found")
            return None
        # Scope: Handler / Handling only (best effort; untick "check all" first)
        for pat in (r"^\s*Handl(er|ing)\s*$",):
            try:
                cb = page.get_by_label(re.compile(pat, re.I)).first
                if await cb.count():
                    await cb.check(timeout=5000)
            except Exception:
                pass
        # Search button nearest the top of the page
        btn = page.get_by_role("button", name=re.compile(r"^\s*Search\s*$", re.I)).first
        try:
            await btn.click(timeout=10000)
        except Exception:
            if not await _click_text(page, r"^\s*Search\s*$"):
                log("search_button_not_found")
                return None
        await page.wait_for_load_state("networkidle", timeout=120000)
        await page.wait_for_timeout(4000)
        exp = page.get_by_text(re.compile(r"export\s*to\s*excel|export", re.I)).first
        try:
            async with page.expect_download(timeout=180000) as dl_info:
                await exp.click(timeout=15000)
            dl = await dl_info.value
            path = os.path.join(outdir, f"oid_{re.sub(r'[^a-z0-9]+', '_', keyword.lower())}.xlsx")
            await dl.save_as(path)
            return path
        except Exception as e:
            log(f"export_failed:{type(e).__name__}")
            return None
    finally:
        await page.close()


PROFILE_LABELS = {"contact": "contact_name", "phone": "phone", "telephone": "phone", "email": "email",
                  "website": "website", "web site": "website"}


async def read_profile(ctx, url: str) -> dict:
    page = await ctx.new_page()
    out: dict = {"profile_url": url}
    try:
        await page.goto(url, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(1500)
        pairs = await page.evaluate("""() => {
          const res = [];
          document.querySelectorAll('dt, th, label, strong, b, .label, .control-label').forEach(el => {
            const k = (el.innerText || '').trim().replace(/:$/, '');
            let v = '';
            const sib = el.nextElementSibling;
            if (sib) v = (sib.innerText || '').trim();
            if (!v && el.parentElement) v = (el.parentElement.innerText || '').replace(el.innerText, '').trim();
            if (k && v && k.length < 40) res.push([k, v.slice(0, 200)]);
          });
          document.querySelectorAll('a[href^="mailto:"]').forEach(a => res.push(['email', a.getAttribute('href').slice(7)]));
          return res;
        }""")
        for k, v in pairs:
            kl = k.lower()
            for lab, field in PROFILE_LABELS.items():
                if kl.startswith(lab) and field not in out and v:
                    out[field] = v.split("\n")[0].strip()
    except Exception as e:
        out["error"] = str(e)[:120]
    finally:
        await page.close()
    return out


async def run(keywords: list[str], outdir: str, dry_run: bool, max_profiles: int) -> dict:
    from playwright.async_api import async_playwright
    stats: dict = {"keywords": {}, "records": 0, "saved": 0, "errors": []}
    os.makedirs(outdir, exist_ok=True)
    all_recs: dict[str, dict] = {}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(user_agent=UA, accept_downloads=True, viewport={"width": 1400, "height": 1000})
        for kw in keywords:
            notes: list[str] = []
            path = await export_search(ctx, kw, outdir, notes.append)
            rows = rows_from_xlsx(path) if path else []
            recs = [r for r in (to_record(d) for d in rows) if r]
            stats["keywords"][kw] = {"rows": len(rows), "kept": len(recs), "notes": notes,
                                     "has_contact_cols": bool(rows and any(k in rows[0] for k in ("email", "phone")))}
            for r in recs:
                key = f"{r['name'].lower()}|{r['country']}"
                if key in all_recs:
                    all_recs[key]["hs_codes"] = sorted(set(all_recs[key]["hs_codes"]) | set(r["hs_codes"]))
                else:
                    all_recs[key] = r
            await asyncio.sleep(3)
        await browser.close()
    stats["records"] = len(all_recs)
    if dry_run:
        with open(os.path.join(outdir, "usda_oid_records.jsonl"), "w", encoding="utf-8") as f:
            for r in all_recs.values():
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        return stats
    from ..agent.store import DbStore
    store = DbStore()
    for r in all_recs.values():
        try:
            store.save(r)
            stats["saved"] += 1
        except Exception as e:
            stats["errors"].append(str(e)[:120])
    stats["errors"] = stats["errors"][:5]
    return stats


def cli() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--keywords", default=",".join(DEFAULT_KEYWORDS))
    p.add_argument("--outdir", default="oid_exports")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--max-profiles", type=int, default=0)
    a = p.parse_args()
    t0 = time.time()
    stats = asyncio.run(run([k.strip() for k in a.keywords.split(",") if k.strip()], a.outdir, a.dry_run, a.max_profiles))
    stats["seconds"] = round(time.time() - t0)
    print("[usda_oid] " + json.dumps(stats))
    print("::notice title=usda_oid::" + json.dumps({k: v for k, v in stats.items() if k != "errors"})[:3000])


if __name__ == "__main__":
    cli()
