"""Postgres access for the Python crawlers. Shares the same schema as
the Node.js worker: writes to scraped_buyers and scrape_jobs. Every
insert goes through upsert_buyer so cross-source dedup by content_hash
happens the same way as in src/sources/persist.js."""

from __future__ import annotations
import os
import re
import json
import hashlib
from contextlib import contextmanager
from typing import Iterator, Optional
from urllib.parse import unquote
import psycopg


def _parse_dsn() -> dict:
    """Parse DATABASE_URL_POSTGRESS into keyword args psycopg can consume
    directly. Bypasses libpq's strict URI decoder, which chokes on a
    literal % in the Supabase-supplied password."""
    uri = os.environ.get("DATABASE_URL_POSTGRESS") or os.environ.get("DATABASE_URL", "")
    if not uri:
        raise RuntimeError("DATABASE_URL_POSTGRESS not set")
    m = re.match(
        r"^postgres(?:ql)?://([^:]+):(.+)@([^:/]+):(\d+)/([^?]+)(?:\?(.*))?$",
        uri,
    )
    if not m:
        raise RuntimeError("Invalid Postgres URI shape")
    user, raw_pw, host, port, dbname, _ = m.groups()
    # Decode percent-escapes only if they yield a different string;
    # otherwise the % is a literal character in the password.
    try:
        decoded = unquote(raw_pw)
        password = decoded if decoded != raw_pw else raw_pw
    except Exception:
        password = raw_pw
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": int(port),
        "dbname": dbname,
        "sslmode": "require",
        "application_name": "eksporin-py",
    }


@contextmanager
def conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(autocommit=True, **_parse_dsn()) as c:
        yield c


def content_hash(name: str, country: Optional[str]) -> str:
    key = (name or "").strip().lower() + "|" + (country or "").upper()
    return hashlib.md5(key.encode("utf-8")).hexdigest()


def upsert_buyer(c: psycopg.Connection, buyer: dict) -> Optional[int]:
    """Insert a buyer or merge into an existing canonical row.

    Returns the row id on success. Mirrors the merge / same-source-upsert
    logic in src/sources/persist.js so both workers produce the same
    dedup outcome.
    """
    name = (buyer.get("name") or "").strip()
    if not name or not buyer.get("source") or not buyer.get("source_id"):
        return None
    country = (buyer.get("country") or "").upper() or None
    hs_codes = list(buyer.get("hs_codes") or [])
    hash_ = content_hash(name, country)

    with c.cursor() as cur:
        cur.execute(
            "SELECT id, source FROM scraped_buyers WHERE content_hash = %s LIMIT 1",
            (hash_,),
        )
        existing = cur.fetchone()

        if existing and existing[1] != buyer["source"]:
            existing_id = existing[0]
            cur.execute(
                """UPDATE scraped_buyers SET
                    city = COALESCE(city, %s),
                    address = COALESCE(address, %s),
                    website = COALESCE(website, %s),
                    email = COALESCE(email, %s),
                    phone = COALESCE(phone, %s),
                    industry = COALESCE(industry, %s),
                    size_bucket = COALESCE(size_bucket, %s),
                    description = COALESCE(description, %s),
                    hs_codes = (SELECT ARRAY(SELECT DISTINCT UNNEST(hs_codes || %s::text[]))),
                    sources_seen = (SELECT ARRAY(SELECT DISTINCT UNNEST(sources_seen || ARRAY[%s]::text[]))),
                    data_confidence = LEAST(100, GREATEST(data_confidence, %s) + 5),
                    updated_at = NOW()
                   WHERE id = %s""",
                (
                    buyer.get("city"), buyer.get("address"), buyer.get("website"),
                    buyer.get("email"), buyer.get("phone"), buyer.get("industry"),
                    buyer.get("size_bucket"), buyer.get("description"),
                    hs_codes, buyer["source"], buyer.get("data_confidence") or 60,
                    existing_id,
                ),
            )
            return existing_id

        raw = buyer.get("raw")
        cur.execute(
            """INSERT INTO scraped_buyers (
                source, source_id, name, country, city, address, website,
                email, phone, industry, size_bucket, description, hs_codes,
                data_confidence, raw_json, sources_seen, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                ARRAY[%s]::text[], NOW(), NOW()
            )
            ON CONFLICT (source, source_id) DO UPDATE SET
                name = EXCLUDED.name,
                country = COALESCE(EXCLUDED.country, scraped_buyers.country),
                city = COALESCE(EXCLUDED.city, scraped_buyers.city),
                address = COALESCE(EXCLUDED.address, scraped_buyers.address),
                website = COALESCE(EXCLUDED.website, scraped_buyers.website),
                email = COALESCE(EXCLUDED.email, scraped_buyers.email),
                phone = COALESCE(EXCLUDED.phone, scraped_buyers.phone),
                industry = COALESCE(EXCLUDED.industry, scraped_buyers.industry),
                size_bucket = COALESCE(EXCLUDED.size_bucket, scraped_buyers.size_bucket),
                description = COALESCE(EXCLUDED.description, scraped_buyers.description),
                hs_codes = (SELECT ARRAY(SELECT DISTINCT UNNEST(scraped_buyers.hs_codes || EXCLUDED.hs_codes))),
                data_confidence = GREATEST(scraped_buyers.data_confidence, EXCLUDED.data_confidence),
                raw_json = EXCLUDED.raw_json,
                updated_at = NOW()
            RETURNING id""",
            (
                buyer["source"], buyer["source_id"], name, country,
                buyer.get("city"), buyer.get("address"), buyer.get("website"),
                buyer.get("email"), buyer.get("phone"), buyer.get("industry"),
                buyer.get("size_bucket"), buyer.get("description"), hs_codes,
                buyer.get("data_confidence") or 60,
                json.dumps(raw) if raw is not None else None,
                buyer["source"],
            ),
        )
        row = cur.fetchone()
        return row[0] if row else None


def is_duplicate(c: psycopg.Connection, name: str, country: Optional[str]) -> bool:
    """Cheap pre-check callers can use to skip fetching / LLM-parsing
    a listing they already have. Returns True if the canonical
    (name, country) pair already lives in scraped_buyers."""
    hash_ = content_hash(name, country)
    with c.cursor() as cur:
        cur.execute("SELECT 1 FROM scraped_buyers WHERE content_hash = %s LIMIT 1", (hash_,))
        return cur.fetchone() is not None


def counts_by_source(c: psycopg.Connection) -> list[tuple[str, int]]:
    with c.cursor() as cur:
        cur.execute("SELECT source, COUNT(*) FROM scraped_buyers GROUP BY source ORDER BY 2 DESC")
        return list(cur.fetchall())
