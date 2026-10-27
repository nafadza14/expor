-- EksporIn | super admin dashboard support
-- Who the users are (name/org mirrored from the app), when they were last
-- active, and a daily usage counter per meter for trend charts.

ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS org_name TEXT;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS usage_daily (
  day    DATE NOT NULL,
  meter  TEXT NOT NULL,
  units  INTEGER NOT NULL DEFAULT 0,
  rupiah BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, meter)
);
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_scraped_buyers_created ON scraped_buyers (created_at);
CREATE INDEX IF NOT EXISTS idx_scraped_buyers_enriched ON scraped_buyers (enriched_at);
CREATE INDEX IF NOT EXISTS idx_billing_orders_paid ON billing_orders (paid_at);
