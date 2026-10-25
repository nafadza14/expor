-- EksporIn | AI research agent
-- Provenance columns for buyers found by python_scrapers/agent, plus a
-- meta JSONB on scrape_jobs so each agent mission logs its stats
-- (steps, pages, tokens, buyers saved) for the admin activity feed.

ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS buyer_type TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE scraped_buyers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS meta JSONB;

-- Planner looks up the latest agent run per (hs, country).
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_agent_pair
  ON scrape_jobs (source, hs_code, country, finished_at DESC);
