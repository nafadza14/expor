'use strict';
// EksporIn billing: 30-day plans paid by QRIS (Sumopod), a prepaid balance
// for pay-as-you-go use after a plan's quota runs out, and per-account
// usage meters. All state lives in Postgres (see migrations/005_billing.sql)
// keyed by email, because sql.js users/sessions reset on serverless cold
// starts.
//
// Money rules (kept in one place, checked on the server only):
//   - prices and per-use rates are integers in rupiah
//   - top-up: minimum Rp10.000, multiples of Rp10.000, maximum Rp5.000.000
//   - a paid order is applied exactly once (status transition guard)
//   - the balance can never go below zero (CHECK constraint + guarded UPDATE)

const crypto = require('node:crypto');
const pg = require('./pg');

const DAY = 24 * 3600 * 1000;

// Quota per 30-day plan. null = unlimited. 0 = not included (paid from balance).
const PLANS = {
  trial:    { name: 'Trial', price: 0,      days: 3,  public: false, search: 100,  profile: 30,   contact: 5,   find_contact: 5,   send: 10,   export: 0,    saved: 50,   alerts: 3,    sys_templates: 5,    competitor: false },
  hemat:    { name: 'Hemat', price: 14000,  days: 30, public: true,  search: 100,  profile: 30,   contact: 15,  find_contact: 10,  send: 20,   export: 0,    saved: 50,   alerts: 3,    sys_templates: 5,    competitor: false },
  growth:   { name: 'Growth', price: 99000, days: 30, public: true,  search: 1000, profile: 300,  contact: 150, find_contact: 100, send: 300,  export: 300,  saved: null, alerts: null, sys_templates: null, competitor: false },
  business: { name: 'Business', price: 299000, days: 30, public: true, search: null, profile: null, contact: 600, find_contact: 400, send: 2000, export: 3000, saved: null, alerts: null, sys_templates: null, competitor: true },
  expired:  { name: 'Tidak aktif', price: 0, days: 0, public: false, search: 0, profile: 0, contact: 0, find_contact: 0, send: 0, export: 0, saved: 50, alerts: 0, sys_templates: 3, competitor: false },
};
// Pay-as-you-go rates from the balance (rupiah per unit).
const RATES = { search: 100, profile: 300, contact: 1000, find_contact: 1000, send: 200, export: 100 };
const METERS = Object.keys(RATES);
const METER_LABEL = {
  search: 'pencarian', profile: 'buka profil', contact: 'buka kontak', find_contact: 'cari kontak',
  send: 'kirim outreach', export: 'baris ekspor',
};
const TOPUP = { min: 10000, step: 10000, max: 5000000 };

// Accounts that are always on a plan (internal testers / demo).
const FORCED = {
  'admin@super-vanilla.com': 'business',
  'demo@eksporin.id': 'growth',
};

function enabled() { return pg.hasPostgres(); }

function validateTopup(amount) {
  const n = Number(amount);
  if (!Number.isInteger(n)) return 'Nominal top-up harus angka bulat.';
  if (n < TOPUP.min) return `Minimal top-up Rp${TOPUP.min.toLocaleString('id-ID')}.`;
  if (n % TOPUP.step !== 0) return `Top-up harus kelipatan Rp${TOPUP.step.toLocaleString('id-ID')}.`;
  if (n > TOPUP.max) return `Maksimal top-up Rp${TOPUP.max.toLocaleString('id-ID')} per transaksi.`;
  return null;
}

function normEmail(e) { return String(e || '').trim().toLowerCase(); }

// ---------------------------------------------------------------- accounts

async function ensureAccount(email) {
  email = normEmail(email);
  const forced = FORCED[email];
  await pg.query(
    `INSERT INTO billing_accounts (email, plan, plan_started_at, plan_expires_at)
     VALUES ($1, $2, NOW(), CASE WHEN $2 = 'trial' THEN NOW() + INTERVAL '3 days' ELSE NOW() + INTERVAL '100 years' END)
     ON CONFLICT (email) DO NOTHING`, [email, forced || 'trial']);
  if (forced) {
    await pg.query(`UPDATE billing_accounts SET plan = $2, plan_expires_at = GREATEST(plan_expires_at, NOW() + INTERVAL '10 years')
                     WHERE email = $1 AND (plan <> $2 OR plan_expires_at < NOW() + INTERVAL '1 year')`, [email, forced]);
  }
  return pg.one('SELECT * FROM billing_accounts WHERE email = $1', [email]);
}

function effectivePlan(acct) {
  if (!acct) return 'expired';
  return new Date(acct.plan_expires_at).getTime() > Date.now() ? acct.plan : 'expired';
}

function cycleKey(acct) { return new Date(acct.plan_started_at).toISOString(); }

// State used by every request: plan, limits, usage this cycle, balance.
async function load(user) {
  if (!enabled()) return devAccount(user);
  const acct = await ensureAccount(user.email);
  const planCode = effectivePlan(acct);
  const cfg = PLANS[planCode] || PLANS.expired;
  const ck = cycleKey(acct);
  const rows = await pg.query('SELECT meter, used FROM billing_usage WHERE email = $1 AND cycle_key = $2', [acct.email, ck]);
  const used = Object.fromEntries(rows.map((r) => [r.meter, Number(r.used)]));
  return {
    dev: false, email: acct.email, plan: planCode, base_plan: acct.plan, cfg, cycle: ck,
    expires_at: acct.plan_expires_at, started_at: acct.plan_started_at,
    balance: Number(acct.balance_idr), used,
  };
}

function devAccount(user) {
  // No Postgres configured (local demo): everything allowed, nothing charged.
  return { dev: true, email: normEmail(user.email), plan: 'business', base_plan: 'business', cfg: PLANS.business,
    cycle: 'dev', expires_at: new Date(Date.now() + 365 * DAY).toISOString(), started_at: new Date().toISOString(), balance: 0, used: {} };
}

function quotaLeft(acct, meter) {
  const limit = acct.cfg[meter];
  if (limit === null || limit === undefined) return Infinity;
  return Math.max(0, limit - (acct.used[meter] || 0));
}

// Can the account do `n` units of `meter` right now (quota first, then balance)?
function canAfford(acct, meter, n = 1) {
  if (acct.dev) return { ok: true };
  const left = quotaLeft(acct, meter);
  const fromQuota = Math.min(left, n);
  const cost = (n - fromQuota) * RATES[meter];
  if (cost <= acct.balance) return { ok: true, fromQuota, cost };
  return { ok: false, fromQuota, cost, balance: acct.balance };
}

function paymentRequired(acct, meter, n = 1) {
  const a = canAfford(acct, meter, n);
  const rate = RATES[meter];
  const label = METER_LABEL[meter];
  const planActive = acct.plan !== 'expired';
  const why = planActive ? `Kuota ${label} paket ${acct.cfg.name} Anda sudah habis.` : 'Paket Anda sudah tidak aktif.';
  return {
    error: `${why} Lanjutkan dengan saldo (Rp${rate.toLocaleString('id-ID')} per ${label}) atau beli paket.`,
    upgrade: true, topup: true, meter, rate, needed: a.cost, balance: acct.balance, plan: acct.plan,
  };
}

// Atomically take `n` units: quota first, the rest from the balance.
// Returns { ok, fromQuota, cost, balance } and updates `acct` in place.
async function consume(acct, meter, n = 1, ref = null) {
  if (acct.dev) return { ok: true, fromQuota: n, cost: 0 };
  if (!RATES[meter]) throw new Error('unknown meter ' + meter);
  const client = await pg.getPool().connect();
  try {
    await client.query('BEGIN');
    const limit = acct.cfg[meter];
    let fromQuota = 0;
    if (limit === null || limit === undefined) {
      fromQuota = n;
    } else if (limit > 0) {
      // Lock the meter row, then take what is left of the quota.
      await client.query(`INSERT INTO billing_usage (email, cycle_key, meter, used) VALUES ($1, $2, $3, 0)
                          ON CONFLICT DO NOTHING`, [acct.email, acct.cycle, meter]);
      const r = await client.query('SELECT used FROM billing_usage WHERE email=$1 AND cycle_key=$2 AND meter=$3 FOR UPDATE',
        [acct.email, acct.cycle, meter]);
      const used = Number(r.rows[0].used);
      fromQuota = Math.max(0, Math.min(n, limit - used));
    }
    if (fromQuota > 0) {
      await client.query(`INSERT INTO billing_usage (email, cycle_key, meter, used) VALUES ($1, $2, $3, $4)
                          ON CONFLICT (email, cycle_key, meter) DO UPDATE SET used = billing_usage.used + EXCLUDED.used`,
      [acct.email, acct.cycle, meter, fromQuota]);
    }
    const cost = (n - fromQuota) * RATES[meter];
    let balance = acct.balance;
    if (cost > 0) {
      const b = await client.query(`UPDATE billing_accounts SET balance_idr = balance_idr - $2, updated_at = NOW()
                                     WHERE email = $1 AND balance_idr >= $2 RETURNING balance_idr`, [acct.email, cost]);
      if (!b.rows.length) {
        await client.query('ROLLBACK');
        const cur = await pg.one('SELECT balance_idr FROM billing_accounts WHERE email=$1', [acct.email]);
        acct.balance = Number(cur?.balance_idr || 0);
        return { ok: false, fromQuota: 0, cost, balance: acct.balance };
      }
      balance = Number(b.rows[0].balance_idr);
      await client.query(`INSERT INTO billing_ledger (email, delta_idr, balance_after, reason, ref) VALUES ($1, $2, $3, $4, $5)`,
        [acct.email, -cost, balance, `usage:${meter}`, ref ? `${ref} x${n - fromQuota}` : `x${n - fromQuota}`]);
    }
    await client.query('COMMIT');
    acct.used[meter] = (acct.used[meter] || 0) + fromQuota;
    acct.balance = balance;
    return { ok: true, fromQuota, cost, balance };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- unlocks

async function isUnlocked(acct, kind, buyerId) {
  if (acct.dev) return true;
  const ck = kind === 'contact' ? '*' : acct.cycle;
  const r = await pg.one('SELECT 1 AS x FROM billing_unlocks WHERE email=$1 AND kind=$2 AND buyer_id=$3 AND cycle_key=$4',
    [acct.email, kind, buyerId, ck]);
  return !!r;
}

async function unlockedSet(acct, kind, buyerIds) {
  if (acct.dev) return new Set(buyerIds.map(Number));
  if (!buyerIds.length) return new Set();
  const ck = kind === 'contact' ? '*' : acct.cycle;
  const rows = await pg.query('SELECT buyer_id FROM billing_unlocks WHERE email=$1 AND kind=$2 AND cycle_key=$3 AND buyer_id = ANY($4::bigint[])',
    [acct.email, kind, ck, buyerIds.map(Number)]);
  return new Set(rows.map((r) => Number(r.buyer_id)));
}

// Pay for a buyer profile / contacts once. Returns { ok, already, charged }.
async function unlock(acct, kind, buyerId) {
  if (acct.dev) return { ok: true, already: true };
  if (await isUnlocked(acct, kind, buyerId)) return { ok: true, already: true };
  const meter = kind === 'contact' ? 'contact' : 'profile';
  const c = await consume(acct, meter, 1, `buyer:${buyerId}`);
  if (!c.ok) return { ok: false, ...c };
  const ck = kind === 'contact' ? '*' : acct.cycle;
  await pg.query(`INSERT INTO billing_unlocks (email, kind, buyer_id, cycle_key, paid_with) VALUES ($1,$2,$3,$4,$5)
                  ON CONFLICT DO NOTHING`, [acct.email, kind, buyerId, ck, c.cost > 0 ? 'balance' : 'quota']);
  return { ok: true, already: false, charged: c.cost };
}

// ---------------------------------------------------------------- orders

function newOrderId(kind) {
  return `EKS-${kind === 'plan' ? 'P' : 'T'}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
}

async function createOrder({ email, kind, plan, amount }) {
  const orderId = newOrderId(kind);
  await pg.query(`INSERT INTO billing_orders (order_id, email, kind, plan, amount_idr) VALUES ($1,$2,$3,$4,$5)`,
    [orderId, normEmail(email), kind, plan || null, amount]);
  return orderId;
}

async function attachPayment(orderId, { payment_id, payment_url, fee, net, raw }) {
  await pg.query(`UPDATE billing_orders SET payment_id=$2, payment_url=$3, fee_idr=$4, net_idr=$5, raw=$6 WHERE order_id=$1`,
    [orderId, payment_id || null, payment_url || null, fee ?? null, net ?? null, raw ? JSON.stringify(raw) : null]);
}

async function getOrder(orderId) {
  return pg.one('SELECT * FROM billing_orders WHERE order_id = $1', [orderId]);
}

// Mark an order paid and apply its effect exactly once. `paidAmount` is
// what the gateway says was paid; it must equal the order amount.
async function applyPaid(orderId, { paidAmount, raw } = {}) {
  const client = await pg.getPool().connect();
  try {
    await client.query('BEGIN');
    const o = (await client.query('SELECT * FROM billing_orders WHERE order_id=$1 FOR UPDATE', [orderId])).rows[0];
    if (!o) { await client.query('ROLLBACK'); return { ok: false, reason: 'order_not_found' }; }
    if (o.applied_at) { await client.query('ROLLBACK'); return { ok: true, already: true, order: o }; }
    if (paidAmount !== undefined && paidAmount !== null && Number(paidAmount) !== Number(o.amount_idr)) {
      await client.query(`UPDATE billing_orders SET raw = COALESCE(raw,'{}'::jsonb) || $2::jsonb WHERE order_id=$1`,
        [orderId, JSON.stringify({ amount_mismatch: { expected: o.amount_idr, got: paidAmount } })]);
      await client.query('COMMIT');
      return { ok: false, reason: 'amount_mismatch' };
    }
    await client.query(`INSERT INTO billing_accounts (email) VALUES ($1) ON CONFLICT DO NOTHING`, [o.email]);
    const acct = (await client.query('SELECT * FROM billing_accounts WHERE email=$1 FOR UPDATE', [o.email])).rows[0];
    if (o.kind === 'topup') {
      const nb = Number(acct.balance_idr) + Number(o.amount_idr);
      await client.query('UPDATE billing_accounts SET balance_idr=$2, updated_at=NOW() WHERE email=$1', [o.email, nb]);
      await client.query(`INSERT INTO billing_ledger (email, delta_idr, balance_after, reason, ref) VALUES ($1,$2,$3,'topup',$4)`,
        [o.email, o.amount_idr, nb, orderId]);
    } else {
      const cfg = PLANS[o.plan];
      if (!cfg || !cfg.public) throw new Error('order has invalid plan ' + o.plan);
      const now = Date.now();
      const curExp = new Date(acct.plan_expires_at).getTime();
      // Renewing the same, still-active plan extends it; anything else starts now.
      const sameActive = acct.plan === o.plan && curExp > now;
      const expires = new Date((sameActive ? curExp : now) + cfg.days * DAY);
      await client.query(`UPDATE billing_accounts SET plan=$2, plan_started_at=NOW(), plan_expires_at=$3, updated_at=NOW() WHERE email=$1`,
        [o.email, o.plan, expires.toISOString()]);
    }
    await client.query(`UPDATE billing_orders SET status='paid', paid_at=COALESCE(paid_at, NOW()), applied_at=NOW(),
                          raw = COALESCE(raw,'{}'::jsonb) || $2::jsonb WHERE order_id=$1`,
    [orderId, JSON.stringify({ paid: raw || null })]);
    await client.query('COMMIT');
    return { ok: true, already: false, order: { ...o, status: 'paid' } };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

async function markOrder(orderId, status) {
  if (!['expired', 'failed'].includes(status)) return;
  await pg.query(`UPDATE billing_orders SET status=$2 WHERE order_id=$1 AND status='pending'`, [orderId, status]);
}

async function history(email, limit = 20) {
  email = normEmail(email);
  const [orders, ledger] = await Promise.all([
    pg.query(`SELECT order_id, kind, plan, amount_idr, status, payment_url, created_at, paid_at
                FROM billing_orders WHERE email=$1 ORDER BY created_at DESC LIMIT $2`, [email, limit]),
    pg.query(`SELECT delta_idr, balance_after, reason, ref, created_at FROM billing_ledger WHERE email=$1 ORDER BY id DESC LIMIT $2`, [email, limit]),
  ]);
  return { orders, ledger };
}

async function adminSetPlan(email, plan, days = 30) {
  if (!PLANS[plan] || plan === 'expired') throw new Error('plan tidak dikenal');
  await pg.query(`INSERT INTO billing_accounts (email) VALUES ($1) ON CONFLICT DO NOTHING`, [normEmail(email)]);
  await pg.query(`UPDATE billing_accounts SET plan=$2, plan_started_at=NOW(), plan_expires_at=NOW() + ($3 || ' days')::interval, updated_at=NOW() WHERE email=$1`,
    [normEmail(email), plan, String(plan === 'trial' ? 3 : days)]);
}

// ---------------------------------------------------------------- summary

function publicCatalog() {
  return Object.entries(PLANS).filter(([, p]) => p.public).map(([code, p]) => ({
    code, name: p.name, price: p.price, days: p.days,
    quotas: Object.fromEntries(METERS.map((m) => [m, p[m]])),
    saved: p.saved, alerts: p.alerts, sys_templates: p.sys_templates, competitor: p.competitor,
  }));
}

function summarize(acct) {
  const quotas = {};
  for (const m of METERS) {
    const limit = acct.cfg[m];
    quotas[m] = { used: acct.used[m] || 0, limit: limit === undefined ? null : limit, rate: RATES[m] };
  }
  const exp = new Date(acct.expires_at).getTime();
  return {
    plan: acct.plan, plan_name: (PLANS[acct.plan] || PLANS.expired).name,
    base_plan: acct.base_plan, active: acct.plan !== 'expired',
    expires_at: acct.expires_at, days_left: Math.max(0, Math.ceil((exp - Date.now()) / DAY)),
    balance: acct.balance, quotas, rates: RATES, topup: TOPUP, dev: !!acct.dev,
  };
}

module.exports = {
  PLANS, RATES, METERS, METER_LABEL, TOPUP, enabled, validateTopup,
  ensureAccount, load, canAfford, paymentRequired, consume, quotaLeft,
  isUnlocked, unlockedSet, unlock,
  createOrder, attachPayment, getOrder, applyPaid, markOrder, history, adminSetPlan,
  publicCatalog, summarize, normEmail,
};
