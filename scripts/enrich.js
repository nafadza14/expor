'use strict';
// CLI runner for enrichment. Used by the GH Actions nightly enrichment job.
// Loads .env.local for dev.

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
const { enrichBatch } = require('../src/sources/enricher-pipeline');

async function main() {
  const maxIdx = process.argv.indexOf('--max');
  const modeIdx = process.argv.indexOf('--mode');
  const concIdx = process.argv.indexOf('--concurrency');
  const max = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : 100;
  const mode = modeIdx > -1 ? String(process.argv[modeIdx + 1]) : 'fresh';
  const concurrency = concIdx > -1 ? Number(process.argv[concIdx + 1]) : 5;
  console.log(`[enrich] Mode ${mode}, up to ${max} buyers, concurrency ${concurrency}...`);
  const t0 = Date.now();
  const results = await enrichBatch({ max, mode, concurrency });
  const ok = results.filter((r) => r.ok).length;
  const ai = results.filter((r) => r.ai_used).length;
  const withSite = results.filter((r) => r.got_website).length;
  const withEmail = results.filter((r) => r.got_email).length;
  const withPhone = results.filter((r) => r.got_phone).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`[enrich] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s. ${results.length} processed. ok=${ok} ai=${ai} +site=${withSite} +email=${withEmail} +phone=${withPhone} failed=${failed}`);
  await pg.getPool().end().catch(() => {});
}

main().catch((err) => {
  console.error('[enrich] FAILED:', err.message);
  process.exit(1);
});
