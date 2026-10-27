"""Australia: ABN Bulk Extract (data.gov.au, CC BY 3.0 AU).

Every active Australian Business Number with the legal name, registered
business / trading names, entity type and state + postcode. There is no
activity code, so a company is kept only when its legal or business name
names a commodity and says it trades (mapping.classify_name), e.g.
"Pacific Coffee Imports Pty Ltd", "Bali Spice Traders".

The extract is two ZIP files of XML (about 1 GB in total); they are read
as streams, record by record.
"""

from __future__ import annotations
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Iterator, Optional

import httpx

from .mapping import classify_name

PACKAGE = "https://data.gov.au/data/api/3/action/package_show?id=abn-bulk-extract"
UA = "EksporIn bulk importer (+https://exporin-eight.vercel.app)"
STATE_CITY = {"NSW": "Sydney", "VIC": "Melbourne", "QLD": "Brisbane", "WA": "Perth", "SA": "Adelaide",
              "TAS": "Hobart", "ACT": "Canberra", "NT": "Darwin"}


def zip_urls(client: httpx.Client) -> list[str]:
    r = client.get(PACKAGE)
    r.raise_for_status()
    res = (r.json().get("result") or {}).get("resources") or []
    urls = [x.get("url") for x in res if str(x.get("url", "")).lower().endswith(".zip") and "public_split" in str(x.get("url", "")).lower()]
    return sorted(set(urls))


def download(client: httpx.Client, url: str, dest: str) -> str:
    with client.stream("GET", url, timeout=httpx.Timeout(60, read=600), follow_redirects=True) as r:
        r.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in r.iter_bytes(1 << 20):
                fh.write(chunk)
    return dest


def records(zip_path: str) -> Iterator[dict]:
    with zipfile.ZipFile(zip_path) as z:
        for name in sorted(n for n in z.namelist() if n.lower().endswith(".xml")):
            with z.open(name) as fh:
                for _, el in ET.iterparse(fh, events=("end",)):
                    if el.tag != "ABR":
                        continue
                    abn = el.find("ABN")
                    rec = {
                        "abn": (abn.text or "").strip() if abn is not None else "",
                        "status": abn.get("status") if abn is not None else None,
                        "type": (el.findtext("EntityType/EntityTypeInd") or "").strip(),
                        "name": (el.findtext("MainEntity/NonIndividualName/NonIndividualNameText") or "").strip(),
                        "state": (el.findtext("MainEntity/BusinessAddress/AddressDetails/State") or "").strip(),
                        "postcode": (el.findtext("MainEntity/BusinessAddress/AddressDetails/Postcode") or "").strip(),
                        "other": [(x.text or "").strip() for x in el.findall("OtherEntity/NonIndividualName/NonIndividualNameText")],
                    }
                    el.clear()
                    yield rec


def to_record(r: dict) -> Optional[dict]:
    if r.get("status") != "ACT" or not r.get("abn") or not r.get("name"):
        return None
    if r.get("type") == "IND":
        return None  # sole traders
    names = [r["name"]] + [o for o in r.get("other") or [] if o]
    hit = None
    display = r["name"]
    for n in names:
        hit = classify_name(n)
        if hit:
            display = n if n != r["name"] and len(n) > 3 else r["name"]
            break
    if not hit:
        return None
    state = r.get("state") or None
    return {
        "source_id": r["abn"], "name": display, "country": "AU",
        "city": STATE_CITY.get(state or ""), "address": ", ".join(x for x in [state, r.get("postcode"), "Australia"] if x),
        "industry": hit["industry"], "buyer_type": hit["buyer_type"], "hs_codes": hit["hs_codes"],
        "data_confidence": 66,
        "evidence_url": f"https://abr.business.gov.au/ABN/View?abn={r['abn']}",
        "raw": {"abn": r["abn"], "legal_name": r["name"], "entity_type": r.get("type"), "state": state,
                "business_names": (r.get("other") or [])[:5]},
    }


def run(writer, workdir: str = "/tmp", limit: Optional[int] = None, zips: Optional[list[str]] = None) -> None:
    n = 0
    with httpx.Client(timeout=60, headers={"User-Agent": UA}, follow_redirects=True) as client:
        paths = zips or []
        if not paths:
            urls = zip_urls(client)
            if not urls:
                raise RuntimeError("ABN bulk extract: no public_split zip found in the data.gov.au package")
            for i, u in enumerate(urls):
                print(f"[au] downloading {u}")
                paths.append(download(client, u, os.path.join(workdir, f"abn_{i}.zip")))
        for p in paths:
            seen = kept = 0
            for r in records(p):
                seen += 1
                rec = to_record(r)
                if rec:
                    writer.add(rec)
                    kept += 1
                    n += 1
                    if limit and n >= limit:
                        return
            writer.flush()
            print(f"[au] {os.path.basename(p)}: {seen} ABNs read, {kept} buyers kept")
            if not zips:
                os.remove(p)
    # Full run finished: rows from an older run that no longer qualify
    # (cancelled ABN, stricter rules) are removed, unless another source
    # also lists the company.
    if not limit and not zips and getattr(writer, "_conn", None) is not None:
        with writer._conn.cursor() as cur:
            cur.execute("""DELETE FROM scraped_buyers WHERE source = 'abn_au' AND updated_at < %s
                              AND sources_seen = ARRAY['abn_au']::text[]""", (writer._db_start,))
            print(f"[au] removed {cur.rowcount} rows that no longer qualify")
