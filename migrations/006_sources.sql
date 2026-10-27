-- EksporIn | self-expanding source registry
--
-- The discovery job keeps searching the web for NEW lists of buyers
-- (importer lists of trade-promotion bodies, association member lists,
-- trade-fair exhibitor lists, certification registers) and records every
-- list it finds here. The harvest job then reads each list, extracts the
-- companies (verified against the page text) and records the yield, so
-- good sources are revisited and empty ones are retired.

CREATE TABLE IF NOT EXISTS buyer_sources (
  id                BIGSERIAL PRIMARY KEY,
  url               TEXT NOT NULL UNIQUE,
  host              TEXT NOT NULL,
  kind              TEXT,                 -- importer_list | members | exhibitors | registry | directory
  title             TEXT,
  hs4               TEXT,                 -- main commodity (4-digit HS) or NULL for mixed lists
  country           TEXT,                 -- ISO2 of the listed companies, NULL = several
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'rejected', 'error')),
  judge_score       INTEGER,              -- 0-100 from the page check at discovery
  est_companies     INTEGER,
  discovered_query  TEXT,
  discovered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_harvested_at TIMESTAMPTZ,
  harvest_runs      INTEGER NOT NULL DEFAULT 0,
  pages_read        INTEGER NOT NULL DEFAULT 0,
  buyers_kept       INTEGER NOT NULL DEFAULT 0,
  buyers_new        INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  meta              JSONB
);
CREATE INDEX IF NOT EXISTS idx_buyer_sources_queue ON buyer_sources (status, last_harvested_at NULLS FIRST, judge_score DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_sources_host ON buyer_sources (host);

-- Every search the discovery job has run, so it always moves on to new ones.
CREATE TABLE IF NOT EXISTS source_queries (
  query        TEXT PRIMARY KEY,
  hs4          TEXT,
  country      TEXT,
  lang         TEXT,
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  results      INTEGER NOT NULL DEFAULT 0,
  new_sources  INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE buyer_sources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_queries ENABLE ROW LEVEL SECURITY;
