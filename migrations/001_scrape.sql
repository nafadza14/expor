-- EksporIn | scrape data schema
-- Persists buyer + shipment records collected from public sources (ImportYeti,
-- Kemendag ITPC, GLEIF, Wikidata, web crawl). Existing users/sessions stay
-- on sql.js; this schema exists only for data that must survive Vercel cold
-- starts.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS scraped_buyers (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  industry TEXT,
  size_bucket TEXT,
  description TEXT,
  hs_codes TEXT[] NOT NULL DEFAULT '{}',
  total_shipments INTEGER DEFAULT 0,
  total_value_usd NUMERIC DEFAULT 0,
  last_shipment_date DATE,
  data_confidence INTEGER DEFAULT 60,
  raw_json JSONB,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_scraped_buyers_country ON scraped_buyers (country);
CREATE INDEX IF NOT EXISTS idx_scraped_buyers_hs ON scraped_buyers USING GIN (hs_codes);
CREATE INDEX IF NOT EXISTS idx_scraped_buyers_name_trgm ON scraped_buyers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scraped_buyers_created ON scraped_buyers (created_at DESC);

CREATE TABLE IF NOT EXISTS scraped_shipments (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES scraped_buyers(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  shipment_date DATE,
  hs_code TEXT,
  weight_kg NUMERIC,
  value_usd NUMERIC,
  origin_port TEXT,
  dest_port TEXT,
  exporter_name TEXT,
  goods_description TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scraped_shipments_buyer ON scraped_shipments (buyer_id, shipment_date DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_shipments_hs ON scraped_shipments (hs_code);

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  hs_code TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_count INTEGER,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_source ON scrape_jobs (source, created_at DESC);
