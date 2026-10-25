"""UK Companies House "Free Company Data Product".

A free monthly snapshot of every live UK company, published as one ZIP
with one CSV (BasicCompanyDataAsOneFile-YYYY-MM-01.zip, about 450 MB)
at https://download.companieshouse.gov.uk/en_output.html.

Each row carries up to four SIC 2007 codes ("46370 - Wholesale of coffee,
tea, cocoa and spices"). We keep active companies whose SIC code is one
of the buyer classes in mapping.NACE. No contact data in the file; the
enrichment job finds website / email / phone afterwards.
"""

from __future__ import annotations
import csv
import io
import os
import re
import zipfile
from typing import Iterator, Optional

import httpx

from .mapping import classify

INDEX = "https://download.companieshouse.gov.uk/en_output.html"
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"


def find_zip_url(html: str) -> Optional[str]:
    m = re.findall(r'href="([^"]*BasicCompanyDataAsOneFile-\d{4}-\d{2}-\d{2}\.zip)"', html)
    if not m:
        return None
    href = sorted(m)[-1]
    return href if href.startswith("http") else "https://download.companieshouse.gov.uk/" + href.lstrip("/")


def download(dest: str) -> str:
    with httpx.Client(timeout=60, headers={"User-Agent": UA}, follow_redirects=True) as c:
        idx = c.get(INDEX)
        idx.raise_for_status()
        url = find_zip_url(idx.text)
        if not url:
            raise RuntimeError("Companies House: BasicCompanyDataAsOneFile link not found on the index page")
        print(f"[uk] downloading {url}")
        with c.stream("GET", url, timeout=httpx.Timeout(60, read=300)) as r:
            r.raise_for_status()
            with open(dest, "wb") as fh:
                for chunk in r.iter_bytes(1 << 20):
                    fh.write(chunk)
    return dest


def _rows(zip_path: str) -> Iterator[dict]:
    with zipfile.ZipFile(zip_path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        with z.open(name) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline=""))
            header = [h.strip() for h in next(reader)]
            for values in reader:
                yield dict(zip(header, values))


def parse(zip_path: str) -> Iterator[dict]:
    for r in _rows(zip_path):
        status = (r.get("CompanyStatus") or "").strip().lower()
        if status != "active":
            continue
        sics = [r.get(f"SICCode.SicText_{i}") or "" for i in range(1, 5)]
        codes = [s.split("-")[0].strip() for s in sics if s.strip()]
        name = (r.get("CompanyName") or "").strip()
        hit = classify(codes, name)
        if not hit:
            continue
        number = (r.get("CompanyNumber") or "").strip()
        town = (r.get("RegAddress.PostTown") or "").strip()
        addr = ", ".join(x.strip() for x in [r.get("RegAddress.AddressLine1"), r.get("RegAddress.AddressLine2"),
                                               town, r.get("RegAddress.PostCode")] if x and x.strip())
        yield {
            "source_id": number, "name": name, "country": "GB",
            "city": town.title() or None, "address": addr or None,
            "industry": hit["industry"], "buyer_type": hit["buyer_type"], "hs_codes": hit["hs_codes"],
            "data_confidence": 72,
            "evidence_url": f"https://find-and-update.company-information.service.gov.uk/company/{number}",
            "raw": {"sic": [s.strip() for s in sics if s.strip()], "incorporated": r.get("IncorporationDate"),
                    "category": r.get("CompanyCategory")},
        }


def run(writer, workdir: str = "/tmp", zip_path: Optional[str] = None, limit: Optional[int] = None) -> None:
    path = zip_path or os.path.join(workdir, "ch_basic.zip")
    if not zip_path:
        download(path)
    n = 0
    for rec in parse(path):
        writer.add(rec)
        n += 1
        if limit and n >= limit:
            break
