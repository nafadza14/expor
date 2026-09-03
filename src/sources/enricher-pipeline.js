'use strict';
// Runs enrichment across un-enriched scraped_buyers rows. Called by the
// GH Actions nightly cron and by the "Enrich" button in admin.

const pg = require('../pg');
const { crawlWebsite, findCompanyWebsite } = require('./website-crawler');
const { enrichBuyer } = require('./enrich');

async function enrichOne(buyer) {
  // Step 1: find company website if we do not have one yet. Public
  // registries (GLEIF, SIRENE, Companies House, SEC) rarely publish it,
  // so we search Brave for "{name} {country}" and take the best-scoring
  // organic result that isn't a directory / social profile / news site.
  let website = buyer.website || null;
  let websiteFound = false;
  if (!website) {
    try {
      website = await findCompanyWebsite(buyer.name, buyer.country);
      if (website) websiteFound = true;
    } catch (_e) { /* leave null */ }
  }

  // Step 2: crawl the site for description + emails + phones.
  const site = website ? await crawlWebsite(website).catch(() => null) : null;
  const ai = await enrichBuyer(buyer, { websiteSnippet: site?.text_snippet });

  const email = buyer.email || site?.emails?.[0] || null;
  const phone = buyer.phone || site?.phones?.[0] || null;

  // Bump confidence more when we discovered a website and got real
  // contacts back, less when we only ran the LLM heuristic.
  let confBump = 5;
  if (websiteFound) confBump += 5;
  if (email && !buyer.email) confBump += 10;
  if (phone && !buyer.phone) confBump += 5;
  if (ai.ai_used) confBump += 10;

  await pg.getPool().query(`
    UPDATE scraped_buyers SET
      website = COALESCE(website, $2),
      industry = COALESCE(industry, $3),
      size_bucket = COALESCE(size_bucket, $4),
      description = COALESCE(description, $5),
      email = COALESCE(email, $6),
      phone = COALESCE(phone, $7),
      data_confidence = LEAST(100, data_confidence + $8),
      enriched_at = NOW(),
      updated_at = NOW()
     WHERE id = $1`,
    [buyer.id, website, ai.industry, ai.size_bucket, ai.description, email, phone, confBump],
  );

  return {
    id: buyer.id,
    ai_used: ai.ai_used,
    got_website: !!website && !buyer.website,
    got_email: !!email && !buyer.email,
    got_phone: !!phone && !buyer.phone,
    got_industry: !!ai.industry && !buyer.industry,
  };
}

async function enrichBatch({ max = 25, sleepMs = 1500, mode = 'fresh' } = {}) {
  // mode 'fresh': only rows never enriched.
  // mode 'contacts': rows still missing website or email or phone,
  //                  even if a previous enrich pass ran.
  // mode 'all': every row, oldest updated_at first (re-enrichment sweep).
  const where = {
    fresh: 'enriched_at IS NULL',
    contacts: '(website IS NULL OR email IS NULL OR phone IS NULL)',
    all: 'TRUE',
  }[mode] || 'enriched_at IS NULL';
  const orderBy = mode === 'all' ? 'updated_at ASC' : 'updated_at DESC';
  const rows = await pg.query(
    `SELECT id, name, country, website, email, phone, industry, size_bucket, description
       FROM scraped_buyers
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $1`, [max],
  );
  const results = [];
  for (const b of rows) {
    try {
      const r = await enrichOne(b);
      results.push({ ok: true, ...r });
    } catch (err) {
      results.push({ ok: false, id: b.id, error: err.message });
    }
    if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
  }
  return results;
}

module.exports = { enrichOne, enrichBatch };
