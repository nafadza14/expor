'use strict';
// EksporIn Postgres client. Persists scrape data across Vercel cold starts.
// Only used for scraped buyer / shipment / job data. Existing users, sessions
// and legacy demo data stay on sql.js so we do not have to refactor the
// synchronous callsites everywhere.

const { Pool } = require('pg');

function parsePgUri(uri) {
  // Handle passwords that contain a literal % (not URL-encoded).
  // Supabase copy-paste often keeps % raw, which breaks strict URL parsing.
  const m = uri.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/([^?]+)(?:\?(.*))?$/);
  if (!m) throw new Error('Invalid Postgres URI (expected postgres://user:pass@host:port/db)');
  const [, user, rawPassword, host, port, database] = m;
  let password = rawPassword;
  try {
    const decoded = decodeURIComponent(rawPassword);
    if (decoded !== rawPassword) password = decoded;
  } catch (_e) { /* keep raw password */ }
  return { user, password, host, port: Number(port), database };
}

let _pool = null;

function getPool() {
  if (_pool) return _pool;
  const uri = process.env.DATABASE_URL_POSTGRESS || process.env.DATABASE_URL || '';
  if (!uri) throw new Error('DATABASE_URL_POSTGRESS not set');
  const cfg = parsePgUri(uri);
  _pool = new Pool({
    ...cfg,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'eksporin',
  });
  _pool.on('error', (err) => console.error('[pg] pool error:', err.message));
  return _pool;
}

async function query(sql, params = []) {
  const res = await getPool().query(sql, params);
  return res.rows;
}

async function one(sql, params = []) {
  const res = await getPool().query(sql, params);
  return res.rows[0] || null;
}

async function exec(sql) {
  return getPool().query(sql);
}

async function ping() {
  const r = await one('SELECT NOW() AS now, current_database() AS db, version() AS version');
  return r;
}

function hasPostgres() {
  return !!(process.env.DATABASE_URL_POSTGRESS || process.env.DATABASE_URL);
}

module.exports = { getPool, query, one, exec, ping, hasPostgres, parsePgUri };
