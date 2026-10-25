'use strict';
// Seed HS codes and target countries for the scrape queue. The list now
// lives in config/commodities.json so the Python crawlers, the AI
// research agent and this Node pipeline all target the same matrix.
// Edit that JSON file to add/remove commodities or countries.

const CONFIG = require('../config/commodities.json');

const SEED_HS_CODES = CONFIG.commodities.map((c) => ({
  code: c.hs4,
  label_id: c.label_id,
  label_en: c.label_en,
  keywords: c.keywords || [],
  priority: c.priority || 2,
}));

const SEED_COUNTRIES = CONFIG.countries.map((c) => ({
  iso2: c.iso2,
  name: c.name,
  priority: c.priority || 2,
}));

// First English keyword per HS, used by keyword-based sources (GLEIF, Wikidata).
const KEYWORD_BY_HS = Object.fromEntries(
  CONFIG.commodities.map((c) => [c.hs4, (c.keywords || [])[0] || c.label_en.toLowerCase()]),
);

module.exports = { SEED_HS_CODES, SEED_COUNTRIES, KEYWORD_BY_HS };
