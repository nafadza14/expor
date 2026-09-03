'use strict';
// Writes normalized BuyerRecord / ShipmentRecord into Postgres.
//
// Dedup strategy: content_hash = md5(lower(trim(name)) || '|' || country).
// The DB trigger populates it on insert. Before writing a new row we look
// up any existing row with the same hash. If it exists (regardless of
// source), we merge into that row's hs_codes + sources_seen instead of
// inserting a second row for the same entity. Same-source rediscovery
// still uses the (source, source_id) upsert path.

const crypto = require('node:crypto');
const pg = require('../pg');

function contentHash(name, country) {
  if (!name) return null;
  const s = String(name).trim().toLowerCase() + '|' + String(country || '').toUpperCase();
  return crypto.createHash('md5').update(s).digest('hex');
}

async function upsertBuyer(buyer) {
  if (!buyer || !buyer.name || !buyer.source || !buyer.source_id) return null;
  const hash = contentHash(buyer.name, buyer.country);

  // Look for an existing row for this same canonical entity, possibly
  // discovered by a different source.
  const existing = hash ? await pg.one(
    `SELECT id, source, source_id FROM scraped_buyers WHERE content_hash = $1 LIMIT 1`,
    [hash],
  ) : null;

  if (existing && existing.source !== buyer.source) {
    // Same canonical entity, different source: merge into the existing row.
    // We only overwrite null columns so a source that gave us richer data
    // does not get downgraded by a later source with less.
    await pg.getPool().query(`
      UPDATE scraped_buyers SET
        city = COALESCE(city, $2),
        address = COALESCE(address, $3),
        website = COALESCE(website, $4),
        email = COALESCE(email, $5),
        phone = COALESCE(phone, $6),
        industry = COALESCE(industry, $7),
        size_bucket = COALESCE(size_bucket, $8),
        description = COALESCE(description, $9),
        hs_codes = (SELECT ARRAY(SELECT DISTINCT UNNEST(hs_codes || $10::text[]))),
        sources_seen = (SELECT ARRAY(SELECT DISTINCT UNNEST(sources_seen || ARRAY[$11]::text[]))),
        data_confidence = LEAST(100, GREATEST(data_confidence, $12) + 5),
        updated_at = NOW()
       WHERE id = $1`,
      [existing.id, buyer.city, buyer.address, buyer.website, buyer.email, buyer.phone,
       buyer.industry, buyer.size_bucket, buyer.description,
       buyer.hs_codes || [], buyer.source, buyer.data_confidence ?? 60],
    );
    return existing.id;
  }

  // Fresh entity (or same source rediscovering it). Standard upsert on
  // the (source, source_id) natural key.
  const sql = `
    INSERT INTO scraped_buyers (
      source, source_id, name, country, city, address, website, email, phone,
      industry, size_bucket, description, hs_codes, data_confidence, raw_json,
      sources_seen, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, ARRAY[$1]::text[], NOW(), NOW())
    ON CONFLICT (source, source_id) DO UPDATE SET
      name = EXCLUDED.name,
      country = COALESCE(EXCLUDED.country, scraped_buyers.country),
      city = COALESCE(EXCLUDED.city, scraped_buyers.city),
      address = COALESCE(EXCLUDED.address, scraped_buyers.address),
      website = COALESCE(EXCLUDED.website, scraped_buyers.website),
      email = COALESCE(EXCLUDED.email, scraped_buyers.email),
      phone = COALESCE(EXCLUDED.phone, scraped_buyers.phone),
      industry = COALESCE(EXCLUDED.industry, scraped_buyers.industry),
      size_bucket = COALESCE(EXCLUDED.size_bucket, scraped_buyers.size_bucket),
      description = COALESCE(EXCLUDED.description, scraped_buyers.description),
      hs_codes = (SELECT ARRAY(SELECT DISTINCT UNNEST(scraped_buyers.hs_codes || EXCLUDED.hs_codes))),
      data_confidence = GREATEST(scraped_buyers.data_confidence, EXCLUDED.data_confidence),
      raw_json = EXCLUDED.raw_json,
      updated_at = NOW()
    RETURNING id`;
  const params = [
    buyer.source, buyer.source_id, buyer.name, buyer.country, buyer.city,
    buyer.address, buyer.website, buyer.email, buyer.phone, buyer.industry,
    buyer.size_bucket, buyer.description, buyer.hs_codes || [],
    buyer.data_confidence ?? 60, JSON.stringify(buyer.raw ?? null),
  ];
  const row = await pg.one(sql, params);
  return row?.id || null;
}

async function insertShipment(buyerId, shipment) {
  if (!buyerId || !shipment) return null;
  const sql = `
    INSERT INTO scraped_shipments (
      buyer_id, source, shipment_date, hs_code, weight_kg, value_usd,
      origin_port, dest_port, exporter_name, goods_description, raw_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id`;
  const params = [
    buyerId, shipment.source || 'unknown', shipment.shipment_date, shipment.hs_code,
    shipment.weight_kg, shipment.value_usd, shipment.origin_port, shipment.dest_port,
    shipment.exporter_name, shipment.goods_description, JSON.stringify(shipment.raw ?? null),
  ];
  const row = await pg.one(sql, params);
  return row?.id || null;
}

async function persistBuyers(buyers) {
  const result = { inserted: 0, updated: 0, shipments: 0, failed: 0 };
  for (const b of buyers) {
    try {
      const id = await upsertBuyer(b);
      if (!id) { result.failed++; continue; }
      result.inserted++;
      for (const s of b.shipments || []) {
        try { await insertShipment(id, { ...s, source: b.source }); result.shipments++; } catch (_e) { /* ignore */ }
      }
    } catch (_e) { result.failed++; }
  }
  return result;
}

async function enqueueJob({ source, hs_code, country }) {
  const sql = `INSERT INTO scrape_jobs (source, hs_code, country, status) VALUES ($1,$2,$3,'pending') RETURNING id`;
  const row = await pg.one(sql, [source, hs_code, country]);
  return row?.id || null;
}

async function claimNextJob() {
  const sql = `
    UPDATE scrape_jobs SET status='running', started_at=NOW()
    WHERE id = (SELECT id FROM scrape_jobs WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  return pg.one(sql, []);
}

async function completeJob(jobId, { result_count = 0, error = null } = {}) {
  const status = error ? 'failed' : 'done';
  await pg.getPool().query(
    `UPDATE scrape_jobs SET status=$1, result_count=$2, error=$3, finished_at=NOW() WHERE id=$4`,
    [status, result_count, error, jobId],
  );
}

async function listRecentBuyers({ limit = 50, source = null, country = null } = {}) {
  const conds = ['TRUE'];
  const params = [];
  if (source) { params.push(source); conds.push(`source = $${params.length}`); }
  if (country) { params.push(country); conds.push(`country = $${params.length}`); }
  params.push(limit);
  const sql = `SELECT id, source, source_id, name, country, city, website, industry, hs_codes,
                      data_confidence, created_at, updated_at
                 FROM scraped_buyers
                WHERE ${conds.join(' AND ')}
                ORDER BY updated_at DESC
                LIMIT $${params.length}`;
  return pg.query(sql, params);
}

async function countsBySource() {
  return pg.query('SELECT source, COUNT(*)::int AS c FROM scraped_buyers GROUP BY source ORDER BY c DESC');
}

async function jobStats() {
  return pg.query(`
    SELECT status, COUNT(*)::int AS c
      FROM scrape_jobs
     WHERE created_at > NOW() - INTERVAL '30 days'
     GROUP BY status`);
}

async function recentJobs({ limit = 20 } = {}) {
  return pg.query(`SELECT id, source, hs_code, country, status, result_count, error,
                          started_at, finished_at, created_at
                     FROM scrape_jobs
                    ORDER BY created_at DESC
                    LIMIT $1`, [limit]);
}

module.exports = {
  upsertBuyer, insertShipment, persistBuyers,
  enqueueJob, claimNextJob, completeJob,
  listRecentBuyers, countsBySource, jobStats, recentJobs,
};
