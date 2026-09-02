'use strict';
// Pipeline orchestrator. Reads pending jobs from Postgres, dispatches to
// the right source, normalizes, persists. Also has helpers for admins to
// enqueue jobs (single or bulk) and to run the entire queue synchronously
// (used by the GH Actions nightly job).

const { searchGleif } = require('./gleif');
const { searchWikidata } = require('./wikidata');
const { searchImportYeti } = require('./importyeti');
const { searchItpc } = require('./itpc');
const {
  persistBuyers, enqueueJob, claimNextJob, completeJob,
} = require('./persist');
const { SEED_HS_CODES, SEED_COUNTRIES } = require('../scrape-config');

const SOURCES = {
  gleif: {
    label: 'GLEIF LEI Registry',
    keyword_for_hs: (hs) => {
      const map = { '0901': 'coffee', '0902': 'tea', '0904': 'pepper',
        '0905': 'vanilla', '0906': 'cinnamon', '0907': 'clove',
        '0908': 'nutmeg', '0909': 'anise', '0910': 'ginger' };
      return map[hs] || map[hs?.slice(0, 4)] || null;
    },
    run: async ({ hs_code, country, limit = 20 }) => {
      const kw = SOURCES.gleif.keyword_for_hs(hs_code) || hs_code;
      return searchGleif({ query: kw, country, limit });
    },
  },
  wikidata: {
    label: 'Wikidata',
    keyword_for_hs: (hs) => SOURCES.gleif.keyword_for_hs(hs),
    run: async ({ hs_code, country, limit = 20 }) => {
      const kw = SOURCES.wikidata.keyword_for_hs(hs_code);
      if (!kw) return [];
      return searchWikidata({ keyword: kw, country, limit });
    },
  },
  importyeti: {
    label: 'ImportYeti (paid proxy required)',
    run: async ({ hs_code, country, limit = 20 }) => searchImportYeti({ hs_code, country, limit }),
  },
  itpc: {
    label: 'Kemendag ITPC (pending)',
    run: async ({ hs_code, country, limit = 20 }) => searchItpc({ hs_code, country, limit }),
  },
};

// Run a single job: dispatch, normalize, persist, mark job complete.
async function runJob(job) {
  const src = SOURCES[job.source];
  if (!src) return completeJob(job.id, { error: 'unknown_source' });
  try {
    const rows = await src.run({ hs_code: job.hs_code, country: job.country, limit: 25 });
    // Stamp the job's HS code onto every buyer so GIN(hs_codes) index is populated.
    if (job.hs_code) {
      for (const r of rows) {
        const set = new Set([...(r.hs_codes || []), job.hs_code]);
        r.hs_codes = Array.from(set);
      }
    }
    const result = await persistBuyers(rows);
    await completeJob(job.id, { result_count: result.inserted });
    return { jobId: job.id, ok: true, ...result };
  } catch (err) {
    const reason = err?.skip ? 'skipped:' + err.message : (err.message || 'error');
    await completeJob(job.id, { error: reason, result_count: 0 });
    return { jobId: job.id, ok: false, error: reason };
  }
}

// Drain up to `max` pending jobs from Postgres. Used by the cron worker.
async function drainQueue({ max = 50 } = {}) {
  const results = [];
  for (let i = 0; i < max; i++) {
    const job = await claimNextJob();
    if (!job) break;
    results.push(await runJob(job));
  }
  return results;
}

// Ad-hoc: enqueue a single job.
async function enqueue({ source, hs_code, country }) {
  return enqueueJob({ source, hs_code, country });
}

// Seed the queue with the MVP matrix: every configured source x every seed
// HS x every seed country. Used by admin "Seed queue" action and by GH
// Actions on first run.
async function seedQueue({ sources = ['gleif', 'wikidata', 'importyeti', 'itpc'] } = {}) {
  const jobs = [];
  for (const source of sources) {
    for (const hs of SEED_HS_CODES) {
      for (const co of SEED_COUNTRIES) {
        const id = await enqueueJob({ source, hs_code: hs.code, country: co.iso2 });
        jobs.push({ id, source, hs_code: hs.code, country: co.iso2 });
      }
    }
  }
  return jobs;
}

module.exports = { SOURCES, runJob, drainQueue, enqueue, seedQueue };
