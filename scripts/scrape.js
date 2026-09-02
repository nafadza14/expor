'use strict';
// CLI runner for the scrape pipeline. Used by GH Actions nightly cron and
// by admins running "node scripts/scrape.js seed" or "... drain" manually.
//
// Commands:
//   node scripts/scrape.js seed           enqueue the MVP matrix
//   node scripts/scrape.js drain [--max N]  process up to N pending jobs
//   node scripts/scrape.js run             = seed + drain in one go

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

const pipeline = require('../src/sources/pipeline');
const pg = require('../src/pg');

async function cmdSeed() {
  console.log('[scrape] Seeding queue with MVP matrix...');
  const jobs = await pipeline.seedQueue();
  console.log(`[scrape] Enqueued ${jobs.length} jobs.`);
}

async function cmdDrain(maxArg) {
  const max = Number(maxArg) || 200;
  console.log(`[scrape] Draining up to ${max} jobs...`);
  const results = await pipeline.drainQueue({ max });
  const ok = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => !r.ok && r.error?.startsWith('skipped:')).length;
  const failed = results.filter((r) => !r.ok && !r.error?.startsWith('skipped:')).length;
  const totalInserted = results.reduce((s, r) => s + (r.inserted || 0), 0);
  console.log(`[scrape] Done. ${results.length} processed. ok=${ok} skipped=${skipped} failed=${failed} buyers_persisted=${totalInserted}`);
  results.slice(0, 20).forEach((r) => {
    if (r.ok) console.log(`  ✓ job ${r.jobId}: +${r.inserted} buyers, +${r.shipments} shipments`);
    else console.log(`  x job ${r.jobId}: ${r.error}`);
  });
}

async function main() {
  const [, , cmd = 'run', flag, value] = process.argv;
  const maxIdx = process.argv.indexOf('--max');
  const maxVal = maxIdx > -1 ? process.argv[maxIdx + 1] : null;
  try {
    if (cmd === 'seed') await cmdSeed();
    else if (cmd === 'drain') await cmdDrain(maxVal);
    else if (cmd === 'run') { await cmdSeed(); await cmdDrain(maxVal); }
    else { console.error(`Unknown command: ${cmd}`); process.exit(2); }
  } finally {
    await pg.getPool().end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[scrape] FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
