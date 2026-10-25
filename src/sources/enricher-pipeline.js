'use strict';
// Single-buyer / small-batch contact enrichment for the web app (on-demand
// "Cari kontak" button and the admin console). The heavy batch work runs in
// GitHub Actions (python_scrapers/enrich); this mirrors the same rules.

const pg = require('../pg');
const { crawlWebsite, findCompanyWebsite } = require('./website-crawler');
const { enrichBuyer } = require('./enrich');

async function enrichOne(buyer, { useAi = false } = {}) {
  let website = buyer.website || null;
  let method = website ? 'known' : null;
  if (!website) {
    try { website = await findCompanyWebsite(buyer.name, buyer.country); if (website) method = 'discovered'; } catch (_e) { /* none */ }
  }
  const site = website ? await crawlWebsite(website).catch(() => null) : null;
  const ai = useAi ? await enrichBuyer(buyer, { websiteSnippet: site?.text_snippet }).catch(() => null) : null;

  const email = buyer.email ? null : (site?.email || null);
  const phone = buyer.phone ? null : (site?.phones?.[0] || null);
  const found = !!(website || email || phone);
  const bump = (method === 'discovered' ? 5 : 0) + (email ? 12 : 0) + (phone ? 5 : 0);

  const v2 = `
    UPDATE scraped_buyers SET
      website = COALESCE(website, $2),
      website_method = COALESCE(website_method, $3),
      email = COALESCE(email, $4),
      email_status = CASE WHEN $4::text IS NOT NULL THEN $5 ELSE email_status END,
      email_source_url = CASE WHEN $4::text IS NOT NULL THEN $6 ELSE email_source_url END,
      phone = COALESCE(phone, $7),
      phone_source_url = CASE WHEN phone IS NULL AND $7::text IS NOT NULL THEN $8 ELSE phone_source_url END,
      description = COALESCE(description, $9, $10),
      industry = COALESCE(industry, $11),
      contact_checked_at = NOW(), contact_attempts = contact_attempts + 1,
      enriched_at = CASE WHEN $12 THEN NOW() ELSE enriched_at END,
      data_confidence = LEAST(100, data_confidence + $13),
      updated_at = NOW()
    WHERE id = $1`;
  const params = [buyer.id, website, method, email, site?.email_status || null, site?.email_source_url || null,
    phone, site?.phone_source_url || null, site?.description || null, ai?.description || null, ai?.industry || null, found, bump];
  try {
    await pg.getPool().query(v2, params);
    await pg.getPool().query(`UPDATE scraped_buyers sb SET quality_score = eksporin_quality(sb),
        hidden_reason = eksporin_hidden_reason(sb), is_hidden = eksporin_hidden_reason(sb) IS NOT NULL WHERE id = $1`, [buyer.id]);
  } catch (e) {
    if (e.code !== '42703' && e.code !== '42883') throw e; // migration 004 not applied yet
    await pg.getPool().query(`UPDATE scraped_buyers SET website = COALESCE(website, $2), email = COALESCE(email, $3),
        phone = COALESCE(phone, $4), enriched_at = CASE WHEN $5 THEN NOW() ELSE enriched_at END, updated_at = NOW() WHERE id = $1`,
    [buyer.id, website, email, phone, found]);
  }
  return {
    id: buyer.id, website, website_method: method,
    got_website: !!website && !buyer.website, got_email: !!email, got_phone: !!phone, ai_used: !!ai,
  };
}

async function enrichBatch({ max = 5 } = {}) {
  let rows;
  try {
    rows = await pg.query(`SELECT id, name, country, city, website, email, phone, industry, size_bucket, description
        FROM scraped_buyers WHERE is_hidden = FALSE AND contact_checked_at IS NULL
        ORDER BY data_confidence DESC, id LIMIT $1`, [max]);
  } catch (_e) {
    rows = await pg.query(`SELECT id, name, country, website, email, phone, industry, size_bucket, description
        FROM scraped_buyers WHERE email IS NULL ORDER BY id LIMIT $1`, [max]);
  }
  const results = [];
  for (const b of rows) {
    try { results.push({ ok: true, ...(await enrichOne(b)) }); } catch (err) { results.push({ ok: false, id: b.id, error: err.message }); }
  }
  return results;
}

module.exports = { enrichOne, enrichBatch };
