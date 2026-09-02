'use strict';
// Wikidata SPARQL. Free, unlimited, no auth. We query for companies whose
// industry matches a keyword (P452 -> industry Q) and whose HQ country is
// a given ISO-2 (P17 -> Q for country). Returns fewer rows than a paid
// firmographic DB but the data we get is high-quality and public.

const { normalizeBuyer } = require('./normalizer');

const ENDPOINT = 'https://query.wikidata.org/sparql';

// Map ISO-2 country to Wikidata QID for P17 filter.
const COUNTRY_QID = {
  US: 'Q30', DE: 'Q183', NL: 'Q55', IT: 'Q38', JP: 'Q17',
  IN: 'Q668', MY: 'Q833', EG: 'Q79', SG: 'Q334', CN: 'Q148',
  KR: 'Q884', PH: 'Q928', ID: 'Q252', TH: 'Q869', VN: 'Q881',
  GB: 'Q145', FR: 'Q142', ES: 'Q29', AU: 'Q408', CA: 'Q16',
};

// Loose keyword -> industry QIDs. Wikidata industry ontology is huge; we
// pick a handful of well-populated Q items per commodity.
const INDUSTRY_QIDS = {
  coffee: ['Q131748', 'Q3123753'],   // coffee industry, coffee roaster
  spice: ['Q42527', 'Q4407'],         // spice, food industry
  pepper: ['Q42527'],
  vanilla: ['Q42527'],
  cinnamon: ['Q42527'],
  clove: ['Q42527'],
  nutmeg: ['Q42527'],
  ginger: ['Q42527'],
  turmeric: ['Q42527'],
  seafood: ['Q1042844', 'Q4407'],     // seafood, food industry
  furniture: ['Q14748', 'Q1076486'],   // furniture, furniture industry
  textile: ['Q383770'],
  palm: ['Q4407'],
  rubber: ['Q11475'],
  cocoa: ['Q42527'],
  tea: ['Q42527'],
};

async function sparql(query) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'EksporIn/1.0 (+https://ekspor.zieads.com)',
    },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return res.json();
}

function pickIndustries(keyword) {
  if (!keyword) return [];
  const k = String(keyword).toLowerCase();
  for (const [key, qids] of Object.entries(INDUSTRY_QIDS)) {
    if (k.includes(key)) return qids;
  }
  return [];
}

// Use wbsearchentities to find candidate entities matching the keyword,
// then batch-check which ones sit in `country`. Two hops but each is fast
// (both indexed), unlike a FILTER scan over all instances of business.
async function searchWikidata({ keyword, country, limit = 20 }) {
  const countryQid = country ? COUNTRY_QID[country.toUpperCase()] : null;
  if (!keyword || !countryQid) return [];

  const searchUrl = new URL('https://www.wikidata.org/w/api.php');
  searchUrl.searchParams.set('action', 'wbsearchentities');
  searchUrl.searchParams.set('search', keyword);
  searchUrl.searchParams.set('language', 'en');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('type', 'item');
  searchUrl.searchParams.set('limit', String(Math.min(limit * 4, 50)));
  const searchRes = await fetch(searchUrl.toString(), {
    headers: { 'User-Agent': 'EksporIn/1.0 (+https://ekspor.zieads.com)' },
  });
  if (!searchRes.ok) return [];
  const searchJson = await searchRes.json();
  const candidates = Array.isArray(searchJson?.search) ? searchJson.search : [];
  if (!candidates.length) return [];

  const qids = candidates.map((c) => c.id).slice(0, 50);
  const query = `
    SELECT ?item ?itemLabel ?website ?hqLabel WHERE {
      VALUES ?item { ${qids.map((q) => 'wd:' + q).join(' ')} }
      ?item wdt:P17 wd:${countryQid} .
      OPTIONAL { ?item wdt:P856 ?website . }
      OPTIONAL { ?item wdt:P159 ?hq . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT ${Math.min(limit, 50)}
  `.trim();

  const json = await sparql(query);
  const rows = json?.results?.bindings || [];
  return rows.map((r) => normalizeBuyer({
    source_id: r.item?.value?.split('/').pop(),
    name: r.itemLabel?.value,
    country,
    city: r.hqLabel?.value || null,
    website: r.website?.value || null,
    industry: keyword,
    data_confidence: 75,
    raw: r,
  }, 'wikidata')).filter(Boolean);
}

module.exports = { searchWikidata, pickIndustries, COUNTRY_QID };
