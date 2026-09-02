'use strict';
// Canonical BuyerRecord shape. Every source normalizes to this before
// hitting the persistence layer. Keeps the DB writer generic.
//
// BuyerRecord = {
//   source: 'gleif' | 'importyeti' | 'itpc' | 'wikidata' | ...
//   source_id: string,       // stable id from that source
//   name: string,            // required
//   country: string | null,  // ISO-2
//   city: string | null,
//   address: string | null,
//   website: string | null,
//   email: string | null,
//   phone: string | null,
//   industry: string | null,
//   size_bucket: 'small' | 'medium' | 'large' | null,
//   description: string | null,
//   hs_codes: string[],      // HS 4-digit codes buyer is interested in
//   data_confidence: number, // 0..100
//   raw: any,                // original source payload
//   shipments?: ShipmentRecord[],
// }
//
// ShipmentRecord = {
//   shipment_date: string | null,   // YYYY-MM-DD
//   hs_code: string | null,
//   weight_kg: number | null,
//   value_usd: number | null,
//   origin_port: string | null,
//   dest_port: string | null,
//   exporter_name: string | null,
//   goods_description: string | null,
//   raw: any,
// }

const M49_TO_ISO2 = {
  // Minimal map of common countries; extend as needed.
  '840': 'US', '276': 'DE', '528': 'NL', '380': 'IT', '392': 'JP',
  '356': 'IN', '458': 'MY', '818': 'EG', '702': 'SG', '156': 'CN',
  '410': 'KR', '608': 'PH', '360': 'ID', '764': 'TH', '704': 'VN',
  '826': 'GB', '250': 'FR', '724': 'ES', '036': 'AU', '124': 'CA',
};

function cleanString(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s+/g, ' ');
  return t.length ? t : null;
}

function toIso2(input) {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  if (s.length === 2) return s;
  if (/^\d{3}$/.test(s)) return M49_TO_ISO2[s] || null;
  return null;
}

function guessSizeBucket(nameOrDesc) {
  if (!nameOrDesc) return null;
  const t = String(nameOrDesc).toLowerCase();
  if (/\b(corporation|group|holdings|international|worldwide|global)\b/.test(t)) return 'large';
  if (/\b(pt|llc|gmbh|s\.?a\.?|s\.?r\.?l\.?|ltd|limited|bv)\b/.test(t)) return 'medium';
  return 'small';
}

function normalizeBuyer(partial, source) {
  if (!partial || !partial.name) return null;
  const source_id = cleanString(partial.source_id) || cleanString(partial.name);
  return {
    source,
    source_id,
    name: cleanString(partial.name),
    country: toIso2(partial.country),
    city: cleanString(partial.city),
    address: cleanString(partial.address),
    website: cleanString(partial.website),
    email: cleanString(partial.email),
    phone: cleanString(partial.phone),
    industry: cleanString(partial.industry),
    size_bucket: partial.size_bucket || guessSizeBucket(partial.name),
    description: cleanString(partial.description),
    hs_codes: Array.isArray(partial.hs_codes) ? partial.hs_codes.filter(Boolean) : [],
    data_confidence: typeof partial.data_confidence === 'number' ? partial.data_confidence : 60,
    raw: partial.raw || null,
    shipments: Array.isArray(partial.shipments) ? partial.shipments : [],
  };
}

function normalizeShipment(partial) {
  if (!partial) return null;
  return {
    shipment_date: cleanString(partial.shipment_date),
    hs_code: cleanString(partial.hs_code),
    weight_kg: typeof partial.weight_kg === 'number' ? partial.weight_kg : null,
    value_usd: typeof partial.value_usd === 'number' ? partial.value_usd : null,
    origin_port: cleanString(partial.origin_port),
    dest_port: cleanString(partial.dest_port),
    exporter_name: cleanString(partial.exporter_name),
    goods_description: cleanString(partial.goods_description),
    raw: partial.raw || null,
  };
}

module.exports = { normalizeBuyer, normalizeShipment, toIso2, cleanString };
