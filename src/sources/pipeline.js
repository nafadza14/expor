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
const { SEED_HS_CODES, SEED_COUNTRIES, KEYWORD_BY_HS } = require('../scrape-config');

const SOURCES = {
  gleif: {
    label: 'GLEIF LEI Registry',
    keyword_for_hs: (hs) => KEYWORD_BY_HS[hs] || KEYWORD_BY_HS[hs?.slice(0, 4)] || null,
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

// Seed the queue with the matrix: every configured source x seed HS x seed
// country, limited to priority <= maxPriority (config/commodities.json) so
// the expanded commodity list does not flood the queue. Used by admin
// "Seed queue" action and by GH Actions on first run.
async function seedQueue({ sources = ['gleif', 'wikidata', 'importyeti', 'itpc'], maxPriority = 1 } = {}) {
  const jobs = [];
  const hsList = SEED_HS_CODES.filter((h) => (h.priority || 2) <= maxPriority);
  const coList = SEED_COUNTRIES.filter((c) => (c.priority || 2) <= maxPriority);
  for (const source of sources) {
    for (const hs of hsList) {
      for (const co of coList) {
        const id = await enqueueJob({ source, hs_code: hs.code, country: co.iso2 });
        jobs.push({ id, source, hs_code: hs.code, country: co.iso2 });
      }
    }
  }
  return jobs;
}

module.exports = { SOURCES, runJob, drainQueue, enqueue, seedQueue };
