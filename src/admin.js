'use strict';
// Super admin dashboard API (/api/admin/v2/*). Everything comes from the
// Postgres database (buyers, users, payments, usage, sources), which is the
// only persistent store; sql.js resets on every serverless cold start.
// Admin-only: the caller has already passed requireAdmin().

const pg = require('./pg');

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}
const n = (v) => (v === null || v === undefined ? 0 : Number(v));
const safe = async (fn, fallback) => { try { return await fn(); } catch (e) { return fallback === undefined ? { error: e.message } : fallback; } };
const VISIBLE = "sb.is_hidden = false";

async function tableExists(name) {
  const r = await pg.one('SELECT to_regclass($1) AS t', ['public.' + name]);
  return !!(r && r.t);
}

// ------------------------------------------------------------------ overview
async function overview() {
  return cached('overview', 60_000, async () => {
    const buyersP = safe(() => pg.one(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ${VISIBLE})::int AS visible,
        COUNT(*) FILTER (WHERE ${VISIBLE} AND (email IS NOT NULL OR phone IS NOT NULL))::int AS with_contact,
        COUNT(*) FILTER (WHERE ${VISIBLE} AND email IS NOT NULL)::int AS with_email,
        COUNT(*) FILTER (WHERE ${VISIBLE} AND phone IS NOT NULL)::int AS with_phone,
        COUNT(*) FILTER (WHERE ${VISIBLE} AND website IS NOT NULL)::int AS with_website,
        COUNT(DISTINCT country) FILTER (WHERE ${VISIBLE})::int AS countries,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
        COUNT(*) FILTER (WHERE enriched_at > NOW() - INTERVAL '24 hours')::int AS enriched_24h,
        COUNT(*) FILTER (WHERE (sb.contact_checked_at) IS NULL AND ${VISIBLE})::int AS enrich_queue
      FROM scraped_buyers sb`), {});
    const usersP = safe(() => pg.one(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
        COUNT(*) FILTER (WHERE plan_expires_at > NOW() AND plan = 'trial')::int AS trial_active,
        COUNT(*) FILTER (WHERE plan_expires_at > NOW() AND plan IN ('hemat','growth','business'))::int AS paying_active,
        COUNT(*) FILTER (WHERE plan_expires_at <= NOW())::int AS expired,
        COUNT(*) FILTER (WHERE a.last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_24h,
        COUNT(*) FILTER (WHERE a.last_seen_at > NOW() - INTERVAL '7 days')::int AS active_7d,
        COALESCE(SUM(balance_idr), 0)::bigint AS balances
      FROM billing_accounts a`), {});
    const revenueP = safe(() => pg.one(`SELECT
        COALESCE(SUM(amount_idr) FILTER (WHERE status='paid'), 0)::bigint AS total,
        COALESCE(SUM(amount_idr) FILTER (WHERE status='paid' AND paid_at > NOW() - INTERVAL '24 hours'), 0)::bigint AS d1,
        COALESCE(SUM(amount_idr) FILTER (WHERE status='paid' AND paid_at > NOW() - INTERVAL '30 days'), 0)::bigint AS d30,
        COALESCE(SUM(net_idr) FILTER (WHERE status='paid' AND paid_at > NOW() - INTERVAL '30 days'), 0)::bigint AS d30_net,
        COUNT(*) FILTER (WHERE status='paid')::int AS paid_orders,
        COUNT(*) FILTER (WHERE status='pending' AND created_at > NOW() - INTERVAL '24 hours')::int AS pending_24h
      FROM billing_orders`), {});
    const sourcesP = safe(async () => (await tableExists('buyer_sources'))
      ? pg.one(`SELECT COUNT(*) FILTER (WHERE status='active')::int AS active, COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE discovered_at > NOW() - INTERVAL '24 hours')::int AS new_24h,
                       COALESCE(SUM(buyers_new),0)::int AS buyers_new,
                       (SELECT COUNT(*)::int FROM source_queries) AS queries,
                       (SELECT COUNT(*)::int FROM source_queries WHERE ran_at > NOW() - INTERVAL '24 hours') AS queries_24h
                  FROM buyer_sources`) : null, null);
    const days = 30;
    const seriesP = safe(async () => {
      const rows = await pg.query(`
        WITH d AS (SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS day),
        b AS (SELECT created_at::date AS day, COUNT(*)::int AS n FROM scraped_buyers
               WHERE created_at >= CURRENT_DATE - ($1::int - 1) GROUP BY 1),
        e AS (SELECT enriched_at::date AS day, COUNT(*)::int AS n FROM scraped_buyers
               WHERE enriched_at >= CURRENT_DATE - ($1::int - 1) GROUP BY 1),
        s AS (SELECT created_at::date AS day, COUNT(*)::int AS n FROM billing_accounts
               WHERE created_at >= CURRENT_DATE - ($1::int - 1) GROUP BY 1),
        r AS (SELECT paid_at::date AS day, SUM(amount_idr)::bigint AS n FROM billing_orders
               WHERE status = 'paid' AND paid_at >= CURRENT_DATE - ($1::int - 1) GROUP BY 1)
        SELECT d.day, COALESCE(b.n, 0) AS buyers, COALESCE(e.n, 0) AS enriched, COALESCE(s.n, 0) AS signups, COALESCE(r.n, 0) AS revenue
        FROM d LEFT JOIN b USING (day) LEFT JOIN e USING (day) LEFT JOIN s USING (day) LEFT JOIN r USING (day)
        ORDER BY d.day`, [days]);
      return rows.map((r) => ({ day: String(r.day instanceof Date ? r.day.toISOString().slice(0, 10) : r.day).slice(0, 10),
        buyers: n(r.buyers), enriched: n(r.enriched), signups: n(r.signups), revenue: n(r.revenue) }));
    }, []);
    const [buyers, users, revenue, sources, series] = await Promise.all([buyersP, usersP, revenueP, sourcesP, seriesP]);
    return { at: new Date().toISOString(), buyers, users, revenue, sources, series };
  });
}

// ------------------------------------------------------------------ buyers
async function buyers() {
  return cached('buyers', 120_000, async () => {
    const bySourceP = safe(() => pg.query(`SELECT source, COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ${VISIBLE})::int AS visible,
        COUNT(*) FILTER (WHERE ${VISIBLE} AND (email IS NOT NULL OR phone IS NOT NULL))::int AS contact,
        COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS email,
        COUNT(*) FILTER (WHERE website IS NOT NULL)::int AS website,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
        MAX(updated_at) AS last_update
      FROM scraped_buyers sb GROUP BY source ORDER BY total DESC`), []);
    const byCountryP = safe(() => pg.query(`SELECT country, COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int AS contact
      FROM scraped_buyers sb WHERE ${VISIBLE} GROUP BY country ORDER BY total DESC LIMIT 60`), []);
    const byHsP = safe(() => pg.query(`SELECT h AS hs4, COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int AS contact
      FROM scraped_buyers sb, UNNEST(hs_codes) h WHERE ${VISIBLE} GROUP BY h ORDER BY total DESC`), []);
    const hiddenP = safe(() => pg.query(`SELECT COALESCE(sb.hidden_reason, '(none)') AS reason, COUNT(*)::int AS n
      FROM scraped_buyers sb WHERE NOT (${VISIBLE}) GROUP BY 1 ORDER BY 2 DESC`), []);
    const qualityP = safe(() => pg.query(`SELECT LEAST(9, COALESCE(sb.quality_score, 0) / 10) AS bucket, COUNT(*)::int AS n
      FROM scraped_buyers sb WHERE ${VISIBLE} GROUP BY 1 ORDER BY 1`), []);
    const funnelP = safe(() => pg.one(`SELECT
        COUNT(*) FILTER (WHERE (sb.contact_checked_at) IS NULL)::int AS never_checked,
        COUNT(*) FILTER (WHERE (sb.contact_checked_at) IS NOT NULL)::int AS checked,
        COUNT(*) FILTER (WHERE (sb.contact_checked_at) IS NOT NULL AND website IS NOT NULL)::int AS checked_site,
        COUNT(*) FILTER (WHERE (sb.contact_checked_at) IS NOT NULL AND email IS NOT NULL)::int AS checked_email,
        COUNT(*) FILTER (WHERE sb.contact_checked_at > NOW() - INTERVAL '24 hours')::int AS checked_24h,
        COUNT(*) FILTER (WHERE enriched_at > NOW() - INTERVAL '24 hours')::int AS found_24h
      FROM scraped_buyers sb`), {});
    const emailStatusP = safe(() => pg.query(`SELECT COALESCE(sb.email_status, 'unknown') AS status, COUNT(*)::int AS n
      FROM scraped_buyers sb WHERE email IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`), []);
    const buyerTypeP = safe(() => pg.query(`SELECT COALESCE(sb.buyer_type, '(unknown)') AS type, COUNT(*)::int AS n
      FROM scraped_buyers sb WHERE ${VISIBLE} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`), []);
    const [bySource, byCountry, byHs, hidden, quality, funnel, emailStatus, buyerType] = await Promise.all([bySourceP, byCountryP, byHsP, hiddenP, qualityP, funnelP, emailStatusP, buyerTypeP]);
    return { bySource, byCountry, byHs, hidden, quality, funnel, emailStatus, buyerType };
  });
}

async function buyerList(q) {
  const params = [];
  const conds = [];
  if (q.get('q')) { params.push('%' + q.get('q') + '%'); conds.push(`name ILIKE $${params.length}`); }
  if (q.get('source')) { params.push(q.get('source')); conds.push(`source = $${params.length}`); }
  if (q.get('country')) { params.push(q.get('country').toUpperCase()); conds.push(`country = $${params.length}`); }
  if (q.get('hs')) { params.push(q.get('hs').slice(0, 4)); conds.push(`hs_codes @> ARRAY[$${params.length}]::text[]`); }
  if (q.get('contact') === '1') conds.push('(email IS NOT NULL OR phone IS NOT NULL)');
  if (q.get('hidden') === '1') conds.push(`NOT (${VISIBLE})`);
  if (q.get('hidden') === '0') conds.push(VISIBLE);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const sort = { recent: 'created_at DESC', updated: 'updated_at DESC', quality: "COALESCE(sb.quality_score,0) DESC" }[q.get('sort')] || 'created_at DESC';
  const page = Math.max(1, Number(q.get('page')) || 1);
  const per = 50;
  const total = await pg.one(`SELECT COUNT(*)::int AS c FROM scraped_buyers sb ${where}`, params);
  const rows = await pg.query(`SELECT id, source, name, country, city, website, email, phone, hs_codes, industry,
      sb.buyer_type AS buyer_type, sb.email_status AS email_status,
      sb.quality_score AS quality, sb.is_hidden AS hidden,
      sb.hidden_reason AS hidden_reason, sb.evidence_url AS evidence_url,
      sources_seen, created_at, updated_at, enriched_at
    FROM scraped_buyers sb ${where} ORDER BY ${sort} LIMIT ${per} OFFSET ${(page - 1) * per}`, params);
  return { total: total.c, page, per, rows };
}

// ------------------------------------------------------------------ sources & pipelines
async function sources() {
  return cached('sources', 60_000, async () => {
    if (!(await tableExists('buyer_sources'))) return { ready: false };
    const byStatus = await pg.query(`SELECT status, COUNT(*)::int AS n, COALESCE(SUM(buyers_kept),0)::int AS kept, COALESCE(SUM(buyers_new),0)::int AS new
                                       FROM buyer_sources GROUP BY 1 ORDER BY 2 DESC`);
    const byKind = await pg.query(`SELECT COALESCE(kind,'?') AS kind, COUNT(*)::int AS n, COALESCE(SUM(buyers_new),0)::int AS new FROM buyer_sources GROUP BY 1 ORDER BY 2 DESC`);
    const top = await pg.query(`SELECT id, url, host, kind, hs4, country, status, buyers_kept, buyers_new, pages_read, last_harvested_at
                                  FROM buyer_sources WHERE buyers_new > 0 ORDER BY buyers_new DESC LIMIT 25`);
    const recent = await pg.query(`SELECT id, url, host, title, kind, hs4, country, status, judge_score, est_companies, discovered_query,
                                          discovered_at, buyers_new, last_error FROM buyer_sources ORDER BY discovered_at DESC LIMIT 40`);
    const queries = await pg.query(`SELECT ran_at::date AS day, COUNT(*)::int AS queries, COALESCE(SUM(new_sources),0)::int AS found
                                      FROM source_queries WHERE ran_at > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1`);
    const byLang = await pg.query(`SELECT COALESCE(lang,'?') AS lang, COUNT(*)::int AS queries, COALESCE(SUM(new_sources),0)::int AS found
                                     FROM source_queries GROUP BY 1 ORDER BY 2 DESC`);
    const jobs = await safe(() => pg.query(`SELECT id, source, hs_code, country, status, result_count, error, started_at, finished_at
                                              FROM scrape_jobs ORDER BY COALESCE(finished_at, started_at) DESC NULLS LAST LIMIT 25`), []);
    return { ready: true, byStatus, byKind, top, recent, queries, byLang, jobs };
  });
}

async function pipelines() {
  return cached('pipelines', 180_000, async () => {
    const repo = process.env.GITHUB_REPO || 'nafadza14/expor';
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'eksporin-admin' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=80`, { headers, signal: AbortSignal.timeout(12000) });
      if (!r.ok) return { ok: false, error: `GitHub HTTP ${r.status}`, repo };
      const d = await r.json();
      const runs = (d.workflow_runs || []).map((x) => ({
        id: x.id, name: x.name, status: x.status, conclusion: x.conclusion, event: x.event,
        created_at: x.created_at, updated_at: x.updated_at, url: x.html_url, sha: (x.head_sha || '').slice(0, 7),
        minutes: x.run_started_at ? Math.round((new Date(x.updated_at) - new Date(x.run_started_at)) / 60000) : null,
      }));
      const byWorkflow = {};
      for (const run of runs) {
        const w = byWorkflow[run.name] || (byWorkflow[run.name] = { name: run.name, last: run, runs: 0, ok: 0, failed: 0 });
        w.runs++;
        if (run.conclusion === 'success') w.ok++;
        if (['failure', 'timed_out', 'cancelled'].includes(run.conclusion)) w.failed++;
      }
      return { ok: true, repo, workflows: Object.values(byWorkflow), runs: runs.slice(0, 40) };
    } catch (e) { return { ok: false, error: e.message, repo }; }
  });
}

// ------------------------------------------------------------------ users
async function users(q) {
  const params = [];
  let where = '';
  if (q.get('q')) { params.push('%' + q.get('q').toLowerCase() + '%'); where = `WHERE a.email ILIKE $1 OR COALESCE(a.name,'') ILIKE $1 OR COALESCE(a.org_name,'') ILIKE $1`; }
  const filter = q.get('plan');
  if (filter) {
    const cond = filter === 'expired' ? 'a.plan_expires_at <= NOW()' : `a.plan = '${filter.replace(/[^a-z]/g, '')}' AND a.plan_expires_at > NOW()`;
    where = where ? `${where} AND (${cond})` : `WHERE ${cond}`;
  }
  const rows = await pg.query(`SELECT a.email, a.name AS name, a.org_name AS org_name,
      a.plan, a.plan_expires_at, a.balance_idr, a.created_at, a.last_seen_at AS last_seen_at,
      CASE WHEN a.plan_expires_at > NOW() THEN a.plan ELSE 'expired' END AS effective_plan,
      (SELECT COALESCE(SUM(amount_idr),0) FROM billing_orders o WHERE o.email = a.email AND o.status='paid')::bigint AS paid_total,
      (SELECT COUNT(*) FROM billing_unlocks u WHERE u.email = a.email AND u.kind='contact')::int AS contacts_opened,
      (SELECT COALESCE(SUM(used),0) FROM billing_usage g WHERE g.email = a.email AND g.meter='search')::int AS searches
    FROM billing_accounts a ${where} ORDER BY a.created_at DESC LIMIT 300`, params);
  const byPlan = await pg.query(`SELECT CASE WHEN plan_expires_at > NOW() THEN plan ELSE 'expired' END AS plan, COUNT(*)::int AS n
                                   FROM billing_accounts GROUP BY 1 ORDER BY 2 DESC`);
  return { rows, byPlan };
}

async function userDetail(email) {
  const e = String(email || '').toLowerCase();
  const acct = await pg.one('SELECT * FROM billing_accounts WHERE email=$1', [e]);
  if (!acct) return null;
  const orders = await pg.query('SELECT order_id, kind, plan, amount_idr, status, created_at, paid_at FROM billing_orders WHERE email=$1 ORDER BY created_at DESC LIMIT 30', [e]);
  const ledger = await pg.query('SELECT delta_idr, balance_after, reason, ref, created_at FROM billing_ledger WHERE email=$1 ORDER BY created_at DESC LIMIT 40', [e]);
  const usage = await pg.query('SELECT cycle_key, meter, used FROM billing_usage WHERE email=$1 ORDER BY cycle_key DESC, meter', [e]);
  const unlocks = await pg.query(`SELECT u.kind, u.buyer_id, u.paid_with, u.created_at, b.name, b.country FROM billing_unlocks u
                                    LEFT JOIN scraped_buyers b ON b.id = u.buyer_id WHERE u.email=$1 ORDER BY u.created_at DESC LIMIT 40`, [e]);
  return { account: acct, orders, ledger, usage, unlocks };
}

async function adjustBalance(email, delta, note, adminEmail) {
  const e = String(email || '').toLowerCase();
  const d = Math.trunc(Number(delta));
  if (!e || !Number.isFinite(d) || d === 0 || Math.abs(d) > 10_000_000) throw new Error('Nominal tidak valid.');
  const client = await pg.getPool().connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('UPDATE billing_accounts SET balance_idr = balance_idr + $2, updated_at = NOW() WHERE email=$1 AND balance_idr + $2 >= 0 RETURNING balance_idr', [e, d]);
    if (!r.rows.length) { await client.query('ROLLBACK'); throw new Error('Akun tidak ditemukan atau saldo tidak cukup.'); }
    await client.query('INSERT INTO billing_ledger (email, delta_idr, balance_after, reason, ref) VALUES ($1,$2,$3,$4,$5)',
      [e, d, r.rows[0].balance_idr, 'admin', `${adminEmail}: ${String(note || '').slice(0, 120)}`]);
    await client.query('COMMIT');
    return Number(r.rows[0].balance_idr);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally { client.release(); }
}

// ------------------------------------------------------------------ revenue & usage
async function revenue() {
  return cached('revenue', 60_000, async () => {
    const monthly = await pg.query(`SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, kind,
        COUNT(*)::int AS orders, COALESCE(SUM(amount_idr),0)::bigint AS gross, COALESCE(SUM(fee_idr),0)::bigint AS fees, COALESCE(SUM(net_idr),0)::bigint AS net
      FROM billing_orders WHERE status='paid' GROUP BY 1, 2 ORDER BY 1 DESC, 2`);
    const byPlan = await pg.query(`SELECT COALESCE(plan, 'topup') AS item, COUNT(*)::int AS orders, COALESCE(SUM(amount_idr),0)::bigint AS gross
      FROM billing_orders WHERE status='paid' GROUP BY 1 ORDER BY 3 DESC`);
    const statuses = await pg.query(`SELECT status, COUNT(*)::int AS n, COALESCE(SUM(amount_idr),0)::bigint AS amount FROM billing_orders GROUP BY 1`);
    const orders = await pg.query(`SELECT order_id, email, kind, plan, amount_idr, fee_idr, net_idr, status, created_at, paid_at
      FROM billing_orders ORDER BY created_at DESC LIMIT 60`);
    const spend = await pg.query(`SELECT replace(reason, 'usage:', '') AS meter, COUNT(*)::int AS n, COALESCE(-SUM(delta_idr),0)::bigint AS rupiah
      FROM billing_ledger WHERE reason LIKE 'usage:%' AND created_at > NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 3 DESC`);
    return { monthly, byPlan, statuses, orders, spend };
  });
}

async function usage() {
  return cached('usage', 60_000, async () => {
    const daily = await safe(async () => (await tableExists('usage_daily'))
      ? pg.query(`SELECT day, meter, units, rupiah FROM usage_daily WHERE day > CURRENT_DATE - 30 ORDER BY day`) : [], []);
    const unlocks = await pg.query(`SELECT created_at::date AS day, kind, COUNT(*)::int AS n FROM billing_unlocks
                                      WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY 1, 2 ORDER BY 1`);
    const topUsers = await pg.query(`SELECT email, SUM(used)::int AS units FROM billing_usage GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);
    const topBuyers = await pg.query(`SELECT u.buyer_id, b.name, b.country, COUNT(*)::int AS opened FROM billing_unlocks u
                                        LEFT JOIN scraped_buyers b ON b.id = u.buyer_id WHERE u.kind='contact'
                                        GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 15`);
    const meters = await pg.query(`SELECT meter, SUM(used)::int AS used FROM billing_usage GROUP BY 1 ORDER BY 2 DESC`);
    return { daily, unlocks, topUsers, topBuyers, meters };
  });
}

// ------------------------------------------------------------------ system
async function system() {
  const tables = await safe(() => pg.query(`SELECT relname AS table, GREATEST(n_live_tup, (SELECT GREATEST(c.reltuples, 0) FROM pg_class c WHERE c.oid = relid))::bigint AS rows,
      pg_total_relation_size(relid)::bigint AS bytes FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 25`), []);
  const db = await safe(() => pg.one(`SELECT pg_database_size(current_database())::bigint AS bytes, current_database() AS name, version() AS version`), {});
  const migrations = await safe(() => pg.query(`SELECT name, applied_at FROM _migrations ORDER BY name`), []);
  const env = {
    DATABASE_URL_POSTGRESS: !!process.env.DATABASE_URL_POSTGRESS,
    SUMOPOD_PAY_KEY: !!process.env.SUMOPOD_PAY_KEY,
    SUMOPOD_WEBHOOK_SECRET: !!(process.env.SUMOPOD_WEBHOOK_SECRET || process.env.SUMOPOD_WEBHOOK_TOKEN),
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || null,
    ADMIN_TOKEN_SECRET: !!process.env.ADMIN_TOKEN_SECRET,
    SUPERADMIN_PASSWORD_HASH: !!process.env.SUPERADMIN_PASSWORD_HASH,
    SUMOPOD_AI_KEY: !!process.env.SUMOPOD_AI_KEY,
    COMTRADE_KEY: !!process.env.COMTRADE_KEY,
    GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
  };
  const hs = (() => { try { return require('./hs').load().length; } catch { return 0; } })();
  return { tables, db, migrations, env, hs_nodes: hs, node: process.version, region: process.env.VERCEL_REGION || null,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null };
}

// ------------------------------------------------------------------ router
async function handle(req, res, p, q, body, h) {
  const { json, err, user, billing } = h;
  if (!pg.hasPostgres()) return err(res, 503, 'Database Postgres belum dikonfigurasi.');
  const route = (m, path) => req.method === m && p === path;
  try {
    if (route('GET', '/api/admin/v2/overview')) return json(res, 200, await overview());
    if (route('GET', '/api/admin/v2/buyers')) return json(res, 200, await buyers());
    if (route('GET', '/api/admin/v2/buyers/list')) return json(res, 200, await buyerList(q));
    if (route('GET', '/api/admin/v2/sources')) return json(res, 200, await sources());
    if (route('GET', '/api/admin/v2/pipelines')) return json(res, 200, await pipelines());
    if (route('GET', '/api/admin/v2/users')) return json(res, 200, await users(q));
    if (route('GET', '/api/admin/v2/user')) {
      const d = await userDetail(q.get('email'));
      return d ? json(res, 200, d) : err(res, 404, 'User tidak ditemukan.');
    }
    if (route('POST', '/api/admin/v2/user/plan')) {
      const { email, plan, days } = body || {};
      if (!email || !billing.PLANS[plan] || plan === 'expired') return err(res, 400, 'email dan plan wajib.');
      await billing.adminSetPlan(String(email).toLowerCase(), plan, Math.min(Math.max(Number(days) || 30, 1), 366));
      cache.clear();
      return json(res, 200, { ok: true });
    }
    if (route('POST', '/api/admin/v2/user/balance')) {
      const { email, delta, note } = body || {};
      const bal = await adjustBalance(email, delta, note, user.email);
      cache.clear();
      return json(res, 200, { ok: true, balance: bal });
    }
    if (route('GET', '/api/admin/v2/revenue')) return json(res, 200, await revenue());
    if (route('GET', '/api/admin/v2/usage')) return json(res, 200, await usage());
    if (route('GET', '/api/admin/v2/system')) return json(res, 200, await system());
    if (route('POST', '/api/admin/v2/refresh')) { cache.clear(); return json(res, 200, { ok: true }); }
    return err(res, 404, 'Not found');
  } catch (e) {
    return err(res, 400, e.message || 'Gagal');
  }
}

module.exports = { handle, overview, buyers, sources, users, revenue, usage, system };
