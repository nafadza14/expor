'use strict';
// Idempotent migration runner. Reads .env.local for local dev; on Vercel /
// GitHub Actions the DATABASE_URL_POSTGRESS env var is provided by the host.

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key]) continue;
    let value = rawValue;
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

loadEnvLocal();

const { getPool } = require('../src/pg');

async function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`[migrate] Running ${files.length} migrations from ${migrationsDir}`);

  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  let applied = 0;
  for (const f of files) {
    const check = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [f]);
    if (check.rows.length) { console.log(`[migrate] SKIP ${f}`); continue; }
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    console.log(`[migrate] APPLY ${f} ...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      applied++;
      console.log(`[migrate] APPLY ${f} OK`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(`[migrate] Done. ${applied} new migration(s) applied.`);
  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
