'use strict';
// GLEIF LEI records. Public, unlimited, no auth. Best free source for
// verified legal entities across most jurisdictions.
// Docs: https://api.gleif.org/api/v1

const { normalizeBuyer } = require('./normalizer');

const BASE = 'https://api.gleif.org/api/v1/lei-records';

async function gleifFetch(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.api+json',
      'User-Agent': 'EksporIn/1.0 (+https://ekspor.zieads.com)',
    },
  });
  if (!res.ok) throw new Error(`GLEIF ${res.status}`);
  return res.json();
}

function mapRecord(rec) {
  const attrs = rec?.attributes || {};
  const entity = attrs.entity || {};
  const addr = entity.legalAddress || entity.headquartersAddress || {};
  return normalizeBuyer({
    source_id: rec.id,
    name: entity.legalName?.name,
    country: addr.country,
    city: addr.city,
    address: [addr.addressLines?.join(', '), addr.postalCode, addr.city, addr.country].filter(Boolean).join(', ') || null,
    industry: entity.category || null,
    data_confidence: 85,
    raw: rec,
  }, 'gleif');
}

// Search LEI records by name substring and country.
// query: string, country: ISO-2, limit: max results (default 20).
async function searchGleif({ query, country, limit = 20 }) {
  if (!query) return [];
  const url = new URL(BASE);
  url.searchParams.set('filter[entity.legalName]', query);
  if (country) url.searchParams.set('filter[entity.legalAddress.country]', country);
  url.searchParams.set('page[size]', String(Math.min(limit, 50)));
  const json = await gleifFetch(url.toString());
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map(mapRecord).filter(Boolean);
}

// Search by an industry-ish keyword like 'coffee' or 'spice' plus target
// country. GLEIF has no industry search per se; we rely on name matching.
async function discoverByKeyword({ keyword, country, limit = 20 }) {
  return searchGleif({ query: keyword, country, limit });
}

module.exports = { searchGleif, discoverByKeyword };
