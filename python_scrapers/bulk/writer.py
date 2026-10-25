"""Fast writer for bulk imports.

The crawlers' DbStore opens a connection per row, which is fine for a
few hundred rows but far too slow for registry files with thousands.
This writer keeps one connection, loads the existing dedup hashes once,
inserts new rows in batches and only falls back to the per-row merge
(shared.db.upsert_buyer) when the same company already exists from a
different source.

dry_run_path writes JSONL instead of touching a database.
"""

from __future__ import annotations
import hashlib
import json
import os
import re
import time
from typing import Any, Optional
from urllib.parse import urlparse

from ..enrich.validate import EMAIL_OK, FREEMAIL, NOREPLY, classify as classify_email, normalize_phone

INSERT_SQL = """
INSERT INTO scraped_buyers (
    source, source_id, name, country, city, address, website, email, phone,
    industry, size_bucket, description, hs_codes, data_confidence, raw_json, sources_seen,
    buyer_type, evidence_url, email_status, email_source_url, phone_source_url,
    created_at, updated_at
) VALUES (
    %(source)s, %(source_id)s, %(name)s, %(country)s, %(city)s, %(address)s, %(website)s, %(email)s, %(phone)s,
    %(industry)s, %(size_bucket)s, %(description)s, %(hs_codes)s, %(data_confidence)s, %(raw_json)s, ARRAY[%(source)s]::text[],
    %(buyer_type)s, %(evidence_url)s, %(email_status)s, %(email_source_url)s, %(phone_source_url)s,
    NOW(), NOW()
)
ON CONFLICT (source, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    city = COALESCE(EXCLUDED.city, scraped_buyers.city),
    address = COALESCE(EXCLUDED.address, scraped_buyers.address),
    website = COALESCE(scraped_buyers.website, EXCLUDED.website),
    email = COALESCE(scraped_buyers.email, EXCLUDED.email),
    email_status = COALESCE(scraped_buyers.email_status, EXCLUDED.email_status),
    email_source_url = COALESCE(scraped_buyers.email_source_url, EXCLUDED.email_source_url),
    phone = COALESCE(scraped_buyers.phone, EXCLUDED.phone),
    phone_source_url = COALESCE(scraped_buyers.phone_source_url, EXCLUDED.phone_source_url),
    industry = COALESCE(EXCLUDED.industry, scraped_buyers.industry),
    size_bucket = COALESCE(EXCLUDED.size_bucket, scraped_buyers.size_bucket),
    hs_codes = (SELECT ARRAY(SELECT DISTINCT UNNEST(scraped_buyers.hs_codes || EXCLUDED.hs_codes))),
    buyer_type = COALESCE(scraped_buyers.buyer_type, EXCLUDED.buyer_type),
    evidence_url = COALESCE(scraped_buyers.evidence_url, EXCLUDED.evidence_url),
    raw_json = EXCLUDED.raw_json,
    updated_at = NOW()
"""

MERGE_SQL = """
UPDATE scraped_buyers SET
    city = COALESCE(city, %(city)s),
    address = COALESCE(address, %(address)s),
    website = COALESCE(website, %(website)s),
    email = COALESCE(email, %(email)s),
    email_status = CASE WHEN email IS NULL AND %(email)s IS NOT NULL THEN %(email_status)s ELSE email_status END,
    email_source_url = CASE WHEN email IS NULL AND %(email)s IS NOT NULL THEN %(email_source_url)s ELSE email_source_url END,
    phone = COALESCE(phone, %(phone)s),
    phone_source_url = CASE WHEN phone IS NULL AND %(phone)s IS NOT NULL THEN %(phone_source_url)s ELSE phone_source_url END,
    industry = COALESCE(industry, %(industry)s),
    buyer_type = COALESCE(buyer_type, %(buyer_type)s),
    hs_codes = (SELECT ARRAY(SELECT DISTINCT UNNEST(hs_codes || %(hs_codes)s::text[]))),
    sources_seen = (SELECT ARRAY(SELECT DISTINCT UNNEST(sources_seen || ARRAY[%(source)s]::text[]))),
    data_confidence = LEAST(100, GREATEST(data_confidence, %(data_confidence)s) + 5),
    updated_at = NOW()
WHERE id = %(id)s
"""

REFRESH_SQL = """
UPDATE scraped_buyers sb SET quality_score = eksporin_quality(sb),
       hidden_reason = eksporin_hidden_reason(sb),
       is_hidden = eksporin_hidden_reason(sb) IS NOT NULL
 WHERE sb.updated_at >= %s AND (sb.source = %s OR %s = ANY(sb.sources_seen))
"""

# Legal-form tokens kept upper case when a shouting registry name is
# turned into title case ("KAFFEE HAUS GMBH" -> "Kaffee Haus GmbH").
LEGAL = {
    "LTD": "Ltd", "LIMITED": "Limited", "PLC": "PLC", "LLP": "LLP", "LLC": "LLC", "INC": "Inc", "CO": "Co",
    "GMBH": "GmbH", "AG": "AG", "KG": "KG", "UG": "UG", "OHG": "OHG", "SA": "SA", "SAS": "SAS", "SASU": "SASU",
    "SARL": "SARL", "EURL": "EURL", "SCI": "SCI", "SNC": "SNC", "BV": "BV", "NV": "NV", "AS": "AS", "ASA": "ASA",
    "AB": "AB", "APS": "ApS", "OY": "Oy", "SL": "SL", "SRL": "Srl", "SPA": "SpA", "UK": "UK", "EU": "EU", "ENK": "ENK",
    "DA": "DA", "ANS": "ANS", "&": "&",
}


def tidy_name(name: str) -> str:
    name = re.sub(r"\s+", " ", (name or "").strip())
    letters = [c for c in name if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.8:
        parts = []
        for w in name.split(" "):
            key = w.strip(".,()").upper()
            if key in LEGAL:
                parts.append(w.upper().replace(key, LEGAL[key]))
            elif len(w) <= 3 and not any(ch in "AEIOUY" for ch in w.upper()):
                parts.append(w.upper())  # acronyms such as "JMK"
            else:
                parts.append("-".join(p[:1].upper() + p[1:].lower() for p in w.split("-")))
        name = " ".join(parts)
    return name[:200]


def norm_website(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    u = str(url).strip()
    if not u or " " in u:
        return None
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u.lstrip("/")
    try:
        p = urlparse(u)
    except Exception:
        return None
    host = (p.hostname or "").lower()
    if "." not in host or host.endswith((".local", ".invalid")):
        return None
    if re.search(r"(facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|google\.|goo\.gl|wa\.me|whatsapp)", host):
        return None
    return f"{p.scheme.lower()}://{host}"


def norm_email(email: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not email:
        return None, None
    e = str(email).strip().lower().removeprefix("mailto:").split("?")[0].split(";")[0].split(",")[0].strip()
    if not EMAIL_OK.match(e) or NOREPLY.match(e.split("@")[0]):
        return None, None
    dom = e.rsplit("@", 1)[-1]
    if dom in FREEMAIL:
        return e, "freemail"
    kind, _ = classify_email(e)
    return e, {"role": "role", "personal": "personal"}.get(kind, "domain")


def content_hash(name: str, country: Optional[str]) -> str:
    return hashlib.md5(((name or "").strip().lower() + "|" + (country or "")).encode("utf-8")).hexdigest()


class BulkWriter:
    def __init__(self, source: str, dry_run_path: Optional[str] = None, batch: int = 400) -> None:
        self.source = source
        self.dry = dry_run_path
        self.batch_size = batch
        self.pending: list[dict] = []
        self.seen: set[str] = set()
        self.existing: dict[str, tuple[int, str]] = {}
        self.stats = {"read": 0, "new": 0, "updated_same_source": 0, "merged": 0, "skipped_dupe": 0,
                      "with_email": 0, "with_phone": 0, "with_website": 0}
        self.started = time.time()
        self._conn = None
        self._fh = None

    # ------------------------------------------------------------ lifecycle
    def __enter__(self) -> "BulkWriter":
        if self.dry:
            os.makedirs(os.path.dirname(os.path.abspath(self.dry)) or ".", exist_ok=True)
            self._fh = open(self.dry, "a", encoding="utf-8")
            return self
        from ..shared import db as db_mod
        import psycopg
        self._conn = psycopg.connect(autocommit=True, prepare_threshold=None, **db_mod._parse_dsn())
        with self._conn.cursor() as cur:
            cur.execute("SELECT NOW()")
            self._db_start = cur.fetchone()[0]
            cur.execute("SELECT content_hash, id, source FROM scraped_buyers WHERE content_hash IS NOT NULL")
            for h, i, s in cur.fetchall():
                prev = self.existing.get(h)
                # Prefer remembering a row from this source, so re-runs update in place.
                if prev is None or s == self.source:
                    self.existing[h] = (i, s)
        return self

    def __exit__(self, *exc) -> None:
        try:
            self.flush()
            if self._conn is not None:
                with self._conn.cursor() as cur:
                    cur.execute(REFRESH_SQL, (self._db_start, self.source, self.source))
        finally:
            if self._conn is not None:
                self._conn.close()
            if self._fh:
                self._fh.close()

    # ------------------------------------------------------------ rows
    def add(self, rec: dict[str, Any]) -> bool:
        self.stats["read"] += 1
        name = tidy_name(rec.get("name") or "")
        country = (rec.get("country") or "").upper() or None
        if len(name) < 3 or not rec.get("source_id") or not rec.get("hs_codes"):
            return False
        h = content_hash(name, country)
        if h in self.seen:
            self.stats["skipped_dupe"] += 1
            return False
        self.seen.add(h)
        email, email_status = norm_email(rec.get("email"))
        phone = normalize_phone(rec["phone"], country) if rec.get("phone") else None
        website = norm_website(rec.get("website"))
        if not website and email and email_status in ("role", "domain", "personal"):
            website = "https://" + email.rsplit("@", 1)[-1]
        row = {
            "source": self.source, "source_id": str(rec["source_id"])[:200], "name": name, "country": country,
            "city": (rec.get("city") or None), "address": (rec.get("address") or None),
            "website": website, "email": email, "phone": phone,
            "industry": rec.get("industry"), "size_bucket": rec.get("size_bucket"), "description": rec.get("description"),
            "hs_codes": list(dict.fromkeys(rec["hs_codes"])), "data_confidence": int(rec.get("data_confidence") or 70),
            "raw_json": json.dumps(rec.get("raw"), ensure_ascii=False) if rec.get("raw") is not None else None,
            "buyer_type": rec.get("buyer_type"), "evidence_url": rec.get("evidence_url"),
            "email_status": email_status if email else None,
            "email_source_url": (rec.get("contact_source_url") or rec.get("evidence_url")) if email else None,
            "phone_source_url": (rec.get("contact_source_url") or rec.get("evidence_url")) if phone else None,
        }
        self.stats["with_email"] += bool(email)
        self.stats["with_phone"] += bool(phone)
        self.stats["with_website"] += bool(website)
        if self.dry:
            self._fh.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
            self.stats["new"] += 1
            return True
        prev = self.existing.get(h)
        if prev and prev[1] != self.source:
            with self._conn.cursor() as cur:
                cur.execute(MERGE_SQL, {**row, "id": prev[0]})
            self.stats["merged"] += 1
            return True
        self.stats["updated_same_source" if prev else "new"] += 1
        self.pending.append(row)
        if len(self.pending) >= self.batch_size:
            self.flush()
        return True

    def flush(self) -> None:
        if not self.pending or self._conn is None:
            self.pending = []
            return
        rows, self.pending = self.pending, []
        with self._conn.transaction(), self._conn.cursor() as cur:
            cur.executemany(INSERT_SQL, rows)

    def summary(self) -> dict:
        return {**self.stats, "seconds": round(time.time() - self.started)}
