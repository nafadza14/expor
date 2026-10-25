"""Where agent results go.

DbStore    -> Supabase Postgres (scraped_buyers + scrape_jobs), i.e. the
              live platform. Uses the same upsert/dedup as the crawlers.
DryRunStore-> JSONL file, no database needed. For local testing.
"""

from __future__ import annotations
import json
import os
import time
from typing import Any, Optional, Protocol

from ..shared import db as db_mod


class Store(Protocol):
    def known_names(self, hs4: str, country: str, limit: int = 60) -> list[str]: ...
    def is_known(self, name: str, country: str) -> bool: ...
    def save(self, record: dict[str, Any]) -> tuple[Optional[int], bool]: ...
    def start_job(self, hs4: str, country: str, meta: dict) -> Optional[int]: ...
    def finish_job(self, job_id: Optional[int], *, saved: int, error: Optional[str], meta: dict) -> None: ...
    def coverage(self) -> dict[tuple[str, str], dict[str, Any]]: ...


class DbStore:
    def __init__(self) -> None:
        self._has_meta: Optional[bool] = None

    def known_names(self, hs4: str, country: str, limit: int = 60) -> list[str]:
        with db_mod.conn() as c, c.cursor() as cur:
            cur.execute(
                """SELECT name FROM scraped_buyers
                    WHERE country = %s AND hs_codes @> ARRAY[%s]::text[]
                    ORDER BY data_confidence DESC, updated_at DESC LIMIT %s""",
                (country, hs4, limit),
            )
            return [r[0] for r in cur.fetchall()]

    def is_known(self, name: str, country: str) -> bool:
        with db_mod.conn() as c:
            return db_mod.is_duplicate(c, name, country)

    def save(self, record: dict[str, Any]) -> tuple[Optional[int], bool]:
        """Returns (row_id, is_new)."""
        with db_mod.conn() as c:
            existed = db_mod.is_duplicate(c, record["name"], record["country"])
            row_id = db_mod.upsert_buyer(c, record)
            if row_id:
                try:
                    with c.cursor() as cur:
                        cur.execute(
                            """UPDATE scraped_buyers SET
                                  buyer_type = COALESCE(%s, buyer_type),
                                  evidence_url = COALESCE(%s, evidence_url),
                                  verified_at = NOW(),
                                  enriched_at = CASE WHEN %s THEN COALESCE(enriched_at, NOW()) ELSE enriched_at END
                                WHERE id = %s""",
                            (record.get("buyer_type"), record.get("evidence_url"),
                             bool(record.get("website") and record.get("email") and record.get("description")),
                             row_id),
                        )
                except Exception as e:  # migration 003 not applied yet
                    print(f"[agent] note: could not set buyer_type/evidence_url ({str(e)[:80]}); run migrations")
            return row_id, not existed

    def _meta_supported(self, cur) -> bool:
        if self._has_meta is None:
            cur.execute("""SELECT 1 FROM information_schema.columns
                            WHERE table_name='scrape_jobs' AND column_name='meta'""")
            self._has_meta = cur.fetchone() is not None
        return self._has_meta

    def start_job(self, hs4: str, country: str, meta: dict) -> Optional[int]:
        with db_mod.conn() as c, c.cursor() as cur:
            if self._meta_supported(cur):
                cur.execute(
                    """INSERT INTO scrape_jobs (source, hs_code, country, status, started_at, meta)
                       VALUES ('ai_agent', %s, %s, 'running', NOW(), %s::jsonb) RETURNING id""",
                    (hs4, country, json.dumps(meta)),
                )
            else:
                cur.execute(
                    """INSERT INTO scrape_jobs (source, hs_code, country, status, started_at)
                       VALUES ('ai_agent', %s, %s, 'running', NOW()) RETURNING id""",
                    (hs4, country),
                )
            row = cur.fetchone()
            return row[0] if row else None

    def finish_job(self, job_id: Optional[int], *, saved: int, error: Optional[str], meta: dict) -> None:
        if not job_id:
            return
        with db_mod.conn() as c, c.cursor() as cur:
            status = "failed" if error and saved == 0 else "done"
            if self._meta_supported(cur):
                cur.execute(
                    """UPDATE scrape_jobs SET status=%s, result_count=%s, error=%s, finished_at=NOW(),
                              meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb WHERE id=%s""",
                    (status, saved, error, json.dumps(meta), job_id),
                )
            else:
                cur.execute(
                    "UPDATE scrape_jobs SET status=%s, result_count=%s, error=%s, finished_at=NOW() WHERE id=%s",
                    (status, saved, error, job_id),
                )

    def coverage(self) -> dict[tuple[str, str], dict[str, Any]]:
        """{(hs4, country): {buyers, last_agent_run_epoch, last_agent_yield}}"""
        out: dict[tuple[str, str], dict[str, Any]] = {}
        with db_mod.conn() as c, c.cursor() as cur:
            cur.execute(
                """SELECT h AS hs, country, COUNT(*)::int
                     FROM scraped_buyers, UNNEST(hs_codes) AS h
                    WHERE country IS NOT NULL GROUP BY h, country""")
            for hs, co, n in cur.fetchall():
                out.setdefault((hs, co), {})["buyers"] = n
            cur.execute(
                """SELECT DISTINCT ON (hs_code, country) hs_code, country,
                          EXTRACT(EPOCH FROM COALESCE(finished_at, started_at))::bigint, result_count
                     FROM scrape_jobs WHERE source='ai_agent'
                    ORDER BY hs_code, country, COALESCE(finished_at, started_at) DESC""")
            for hs, co, ts, n in cur.fetchall():
                d = out.setdefault((hs, co), {})
                d["last_agent_run"] = ts
                d["last_agent_yield"] = n
        return out


class DryRunStore:
    """No database. Accepted records are appended to a JSONL file."""

    def __init__(self, path: str) -> None:
        self.path = path
        self._names: set[tuple[str, str]] = set()
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)

    def known_names(self, hs4: str, country: str, limit: int = 60) -> list[str]:
        return [n for (n, c) in self._names if c == country][:limit]

    def is_known(self, name: str, country: str) -> bool:
        return (name.strip().lower(), country.upper()) in {(n.lower(), c) for n, c in self._names}

    def save(self, record: dict[str, Any]) -> tuple[Optional[int], bool]:
        key = (record["name"].strip(), record["country"])
        is_new = key not in self._names
        self._names.add(key)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return len(self._names), is_new

    def start_job(self, hs4: str, country: str, meta: dict) -> Optional[int]:
        return int(time.time() * 1000) % 10_000_000

    def finish_job(self, job_id, *, saved: int, error, meta: dict) -> None:
        pass

    def coverage(self) -> dict:
        return {}
