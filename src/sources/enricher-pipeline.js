'use strict';
// Runs enrichment across un-enriched scraped_buyers rows. Called by the
// GH Actions nightly cron and by the "Enrich" button in admin.

const pg = require('../pg');
const { crawlWebsite } = require('./website-crawler');
const { enrichBuyer } = require('./enrich');

async function enrichOne(buyer) {
  const site = buyer.website ? await crawlWebsite(buyer.website).catch(() => null) : null;
  const ai = await enrichBuyer(buyer, { websiteSnippet: site?.text_snippet });

  const email = buyer.email || site?.emails?.[0] || null;
  const phone = buyer.phone || site?.phones?.[0] || null;

  await pg.getPool().query(`
    UPDATE scraped_buyers SET
      industry = COALESCE($2, industry),
      size_bucket = COALESCE($3, size_bucket),
      description = COALESCE($4, description),
      email = COALESCE($5, email),
      phone = COALESCE($6, phone),
      data_confidence = LEAST(100, data_confidence + $7),
      enriched_at = NOW(),
      updated_at = NOW()
     WHERE id = $1`,
    [buyer.id, ai.industry, ai.size_bucket, ai.description, email, phone, ai.ai_used ? 15 : 5],
  );

  return {
    id: buyer.id,
    ai_used: ai.ai_used,
    got_email: !!email && !buyer.email,
    got_phone: !!phone && !buyer.phone,
    got_industry: !!ai.industry && !buyer.industry,
  };
}

async function enrichBatch({ max = 25, sleepMs = 1500 } = {}) {
  const rows = await pg.query(
    `SELECT id, name, country, website, email, phone, industry, size_bucket, description
       FROM scraped_buyers
      WHERE enriched_at IS NULL
      ORDER BY updated_at DESC
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
