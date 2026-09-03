'use strict';
// One-shot purge of low-quality rows from scraped_buyers.
// Removes:
//   1. Shell / liquidated / trust entities (name-pattern match)
//   2. Rows with data_confidence below 55 AND still unenriched
//   3. GLEIF rows that never got a country populated
//   4. Duplicate rows sharing a content_hash (keeps the newest updated_at)
//
// Idempotent: safe to re-run. Reports count of rows deleted per bucket.
//
// Usage: npm run purge:junk  (or: node scripts/purge-junk.js)

const fs = require('fs');
const path = require('path');

(function loadEnv() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

const pg = require('../src/pg');

const JUNK_PATTERNS = [
  '%SPE LLC%', '%SPV %', '%SPECIAL PURPOSE%',
  '%IN LIQUIDAZIONE%', '%IN LIQUIDATION%', '%EN LIQUIDATION%',
  '%LIQUIDATED%', '%DISSOLVED%',
  '%HOLDING SPE%', '%TRUST %',
  '%(SUB)%', '%CAYMAN%', '%OFFSHORE%',
];

async function main() {
  const pool = pg.getPool();

  const before = await pg.one('SELECT COUNT(*)::int AS c FROM scraped_buyers');
  console.log(`[purge] starting from ${before.c} rows`);

  // 1. Shell / liquidated names.
  const nameConds = JUNK_PATTERNS.map((_, i) => `name ILIKE $${i + 1}`).join(' OR ');
  const junkNames = await pool.query(
    `DELETE FROM scraped_buyers WHERE ${nameConds} RETURNING id`,
    JUNK_PATTERNS,
  );
  console.log(`[purge] removed ${junkNames.rowCount} rows matching shell/liquidated patterns`);

  // 2. Low-confidence unenriched rows (< 55 and enriched_at IS NULL and no email/phone/website).
  const lowConf = await pool.query(`
    DELETE FROM scraped_buyers
      WHERE data_confidence < 55
        AND enriched_at IS NULL
        AND email IS NULL AND phone IS NULL AND website IS NULL
     RETURNING id
  `);
  console.log(`[purge] removed ${lowConf.rowCount} low-confidence bare rows`);

  // 3. Rows with no country.
  const noCountry = await pool.query(`
    DELETE FROM scraped_buyers WHERE country IS NULL RETURNING id
  `);
  console.log(`[purge] removed ${noCountry.rowCount} rows without a country`);

  // 3b. SIRENE rows classified under an unrelated NAF. Our sirene_fr
  // crawler labels the raw NAF as 'NAF XX.XXY' when the code is not in
  // our food/wholesale whitelist; those are exactly the false positives
  // that leaked in earlier when the API silently dropped a bad filter.
  const wrongNaf = await pool.query(`
    DELETE FROM scraped_buyers
      WHERE source = 'sirene_fr' AND industry LIKE 'NAF %'
     RETURNING id
  `);
  console.log(`[purge] removed ${wrongNaf.rowCount} SIRENE rows with off-topic NAF`);

  // 3c. google_business (OSM) rows that fell outside the tight
  // importer-scale filter. Only coffee roasters, tea processors,
  // spice producers, and food processors count. Everything else
  // (retail shops, generic offices=company that caught insurance /
  // NGOs / marine hardware, wholesale-anything, cafes) goes.
  const OSM_KEEP = [
    'coffee roaster', 'tea processor', 'spice producer', 'food processor',
  ];
  const placeholders = OSM_KEEP.map((_, i) => `$${i + 1}`).join(',');
  const osmNoise = await pool.query(
    `DELETE FROM scraped_buyers
       WHERE source = 'google_business'
         AND (industry IS NULL OR industry NOT IN (${placeholders}))
      RETURNING id`,
    OSM_KEEP,
  );
  console.log(`[purge] removed ${osmNoise.rowCount} google_business non-importer rows`);

  // 4. Cross-source duplicates: keep newest updated_at per content_hash.
  const dupes = await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY content_hash ORDER BY updated_at DESC, id DESC) AS rn
        FROM scraped_buyers
       WHERE content_hash IS NOT NULL
    )
    DELETE FROM scraped_buyers WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING id
  `);
  console.log(`[purge] removed ${dupes.rowCount} duplicate content_hash rows`);

  const after = await pg.one('SELECT COUNT(*)::int AS c FROM scraped_buyers');
  console.log(`[purge] done. rows: ${before.c} -> ${after.c} (removed ${before.c - after.c})`);
  await pool.end();
}

main().catch((err) => { console.error('[purge] FAILED:', err.message); process.exit(1); });
