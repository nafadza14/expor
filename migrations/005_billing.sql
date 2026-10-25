-- EksporIn | billing: plans, prepaid balance, QRIS orders (Sumopod), usage
--
-- Users and sessions live in sql.js (per serverless instance, reset on cold
-- start), so everything that involves money lives here, keyed by the
-- user's email (stable across instances and across Supabase/local auth).
--
-- Plans are one-off 30-day passes paid by QRIS (no auto-renew). New users
-- get a 3-day trial. When a plan's quota runs out or the plan expires,
-- actions are paid from a prepaid balance (top-up min Rp10.000, multiples
-- of Rp10.000).

CREATE TABLE IF NOT EXISTS billing_accounts (
  email            TEXT PRIMARY KEY,
  plan             TEXT NOT NULL DEFAULT 'trial',
  plan_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plan_expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  balance_idr      BIGINT NOT NULL DEFAULT 0 CHECK (balance_idr >= 0),
  trial_used       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (account, plan cycle, meter). cycle_key = plan_started_at,
-- so buying / renewing a plan starts a fresh quota.
CREATE TABLE IF NOT EXISTS billing_usage (
  email      TEXT NOT NULL,
  cycle_key  TEXT NOT NULL,
  meter      TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (email, cycle_key, meter)
);

-- Things paid for once: a buyer profile (per cycle) or a buyer's contacts
-- (permanent, cycle_key = '*'), so re-opening never charges twice.
CREATE TABLE IF NOT EXISTS billing_unlocks (
  email      TEXT NOT NULL,
  kind       TEXT NOT NULL,           -- profile | contact
  buyer_id   BIGINT NOT NULL,
  cycle_key  TEXT NOT NULL,
  paid_with  TEXT NOT NULL,           -- quota | balance | free
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email, kind, buyer_id, cycle_key)
);

CREATE TABLE IF NOT EXISTS billing_orders (
  order_id      TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('plan', 'topup')),
  plan          TEXT,
  amount_idr    INTEGER NOT NULL CHECK (amount_idr > 0),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
  provider      TEXT NOT NULL DEFAULT 'sumopod',
  payment_id    TEXT,
  payment_url   TEXT,
  fee_idr       INTEGER,
  net_idr       INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ,
  applied_at    TIMESTAMPTZ,
  raw           JSONB
);
CREATE INDEX IF NOT EXISTS idx_billing_orders_email ON billing_orders (email, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_orders_payment ON billing_orders (payment_id) WHERE payment_id IS NOT NULL;

-- Every balance movement, append-only.
CREATE TABLE IF NOT EXISTS billing_ledger (
  id             BIGSERIAL PRIMARY KEY,
  email          TEXT NOT NULL,
  delta_idr      BIGINT NOT NULL,
  balance_after  BIGINT NOT NULL,
  reason         TEXT NOT NULL,        -- topup | usage:<meter> | admin
  ref            TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_email ON billing_ledger (email, created_at DESC);

-- Webhook deliveries, for idempotency and audit.
CREATE TABLE IF NOT EXISTS billing_events (
  event_key   TEXT PRIMARY KEY,         -- payment_id:event_type
  order_id    TEXT,
  event_type  TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw         JSONB
);

-- These tables live in Supabase's public schema, which PostgREST exposes
-- to the anon/authenticated roles. Enable RLS with NO policies so only the
-- server's own database role (which bypasses RLS) can read or write them.
-- The buyer pool is included: it is paid data and must not be readable
-- with the public anon key.
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_unlocks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_buyers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE _migrations       ENABLE ROW LEVEL SECURITY;
