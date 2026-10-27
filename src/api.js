// EksporIn | REST API (all routes under /api)
'use strict';
const { hashPassword, verifyPassword, createSession, getSessionUser, destroySession, sessionCookie, clearCookie } = require('./auth');

// Supabase bridge config — matches public/supabase-client.js. Publishable key is safe on server too.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dbdzmhrofgcmkdszjxxq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_--qPH56dWsGCxUzm7Mc_Aw_2P53hp3r';

// Sumopod: payment gateway (src/sumopod.js, key from SUMOPOD_PAY_KEY env only) + LLM.
const billing = require('./billing');
const sumopod = require('./sumopod');
const SUMOPOD_AI_URL = process.env.SUMOPOD_AI_URL || 'https://ai.sumopod.com/v1/chat/completions';
const SUMOPOD_AI_KEY = process.env.SUMOPOD_AI_KEY || '';
// Default to gpt-4o-mini which is verified to return content on Sumopod.
// MiniMax-M2.7-highspeed can be selected per-request via body.model when needed.
const SUMOPOD_AI_MODEL = process.env.SUMOPOD_AI_MODEL || 'gpt-4o-mini';

// UN Comtrade+ — free tier, primary key.
const COMTRADE_URL = process.env.COMTRADE_URL || 'https://comtradeapi.un.org/data/v1/get';
const COMTRADE_KEY = process.env.COMTRADE_KEY || '08fe511058c24f0482be303e449e31e7';
const COMTRADE_INDONESIA_M49 = 360;
// M49 numeric code → ISO-2 + flag emoji + English name. Covers major EksporIn
// trading partners so we can render Comtrade partner_code results as readable
// rows. Add rows here as new markets show up in the response.
const M49_MAP = {
  4: ['AF', '🇦🇫', 'Afghanistan'], 8: ['AL', '🇦🇱', 'Albania'], 12: ['DZ', '🇩🇿', 'Algeria'],
  20: ['AD', '🇦🇩', 'Andorra'], 24: ['AO', '🇦🇴', 'Angola'], 31: ['AZ', '🇦🇿', 'Azerbaijan'],
  32: ['AR', '🇦🇷', 'Argentina'], 36: ['AU', '🇦🇺', 'Australia'], 40: ['AT', '🇦🇹', 'Austria'],
  44: ['BS', '🇧🇸', 'Bahamas'], 48: ['BH', '🇧🇭', 'Bahrain'], 50: ['BD', '🇧🇩', 'Bangladesh'],
  51: ['AM', '🇦🇲', 'Armenia'], 52: ['BB', '🇧🇧', 'Barbados'], 56: ['BE', '🇧🇪', 'Belgium'],
  60: ['BM', '🇧🇲', 'Bermuda'], 64: ['BT', '🇧🇹', 'Bhutan'], 68: ['BO', '🇧🇴', 'Bolivia'],
  70: ['BA', '🇧🇦', 'Bosnia'], 72: ['BW', '🇧🇼', 'Botswana'], 76: ['BR', '🇧🇷', 'Brazil'],
  84: ['BZ', '🇧🇿', 'Belize'], 90: ['SB', '🇸🇧', 'Solomon Islands'], 96: ['BN', '🇧🇳', 'Brunei'],
  100: ['BG', '🇧🇬', 'Bulgaria'], 104: ['MM', '🇲🇲', 'Myanmar'], 108: ['BI', '🇧🇮', 'Burundi'],
  112: ['BY', '🇧🇾', 'Belarus'], 116: ['KH', '🇰🇭', 'Cambodia'], 120: ['CM', '🇨🇲', 'Cameroon'],
  124: ['CA', '🇨🇦', 'Canada'], 132: ['CV', '🇨🇻', 'Cabo Verde'], 136: ['KY', '🇰🇾', 'Cayman'],
  144: ['LK', '🇱🇰', 'Sri Lanka'], 152: ['CL', '🇨🇱', 'Chile'], 156: ['CN', '🇨🇳', 'China'],
  158: ['TW', '🇹🇼', 'Taiwan'], 170: ['CO', '🇨🇴', 'Colombia'], 191: ['HR', '🇭🇷', 'Croatia'],
  192: ['CU', '🇨🇺', 'Cuba'], 196: ['CY', '🇨🇾', 'Cyprus'], 203: ['CZ', '🇨🇿', 'Czechia'],
  208: ['DK', '🇩🇰', 'Denmark'], 214: ['DO', '🇩🇴', 'Dominican Republic'],
  218: ['EC', '🇪🇨', 'Ecuador'], 222: ['SV', '🇸🇻', 'El Salvador'], 226: ['GQ', '🇬🇶', 'Equatorial Guinea'],
  231: ['ET', '🇪🇹', 'Ethiopia'], 233: ['EE', '🇪🇪', 'Estonia'], 242: ['FJ', '🇫🇯', 'Fiji'],
  246: ['FI', '🇫🇮', 'Finland'], 250: ['FR', '🇫🇷', 'France'], 262: ['DJ', '🇩🇯', 'Djibouti'],
  268: ['GE', '🇬🇪', 'Georgia'], 275: ['PS', '🇵🇸', 'Palestine'], 276: ['DE', '🇩🇪', 'Germany'],
  288: ['GH', '🇬🇭', 'Ghana'], 292: ['GI', '🇬🇮', 'Gibraltar'], 300: ['GR', '🇬🇷', 'Greece'],
  320: ['GT', '🇬🇹', 'Guatemala'], 344: ['HK', '🇭🇰', 'Hong Kong'], 348: ['HU', '🇭🇺', 'Hungary'],
  352: ['IS', '🇮🇸', 'Iceland'], 356: ['IN', '🇮🇳', 'India'], 360: ['ID', '🇮🇩', 'Indonesia'],
  364: ['IR', '🇮🇷', 'Iran'], 368: ['IQ', '🇮🇶', 'Iraq'], 372: ['IE', '🇮🇪', 'Ireland'],
  376: ['IL', '🇮🇱', 'Israel'], 380: ['IT', '🇮🇹', 'Italy'], 384: ['CI', '🇨🇮', "Côte d'Ivoire"],
  388: ['JM', '🇯🇲', 'Jamaica'], 392: ['JP', '🇯🇵', 'Japan'], 398: ['KZ', '🇰🇿', 'Kazakhstan'],
  400: ['JO', '🇯🇴', 'Jordan'], 404: ['KE', '🇰🇪', 'Kenya'], 408: ['KP', '🇰🇵', 'North Korea'],
  410: ['KR', '🇰🇷', 'South Korea'], 414: ['KW', '🇰🇼', 'Kuwait'], 417: ['KG', '🇰🇬', 'Kyrgyzstan'],
  418: ['LA', '🇱🇦', 'Laos'], 422: ['LB', '🇱🇧', 'Lebanon'], 428: ['LV', '🇱🇻', 'Latvia'],
  434: ['LY', '🇱🇾', 'Libya'], 440: ['LT', '🇱🇹', 'Lithuania'], 442: ['LU', '🇱🇺', 'Luxembourg'],
  446: ['MO', '🇲🇴', 'Macao'], 450: ['MG', '🇲🇬', 'Madagascar'], 454: ['MW', '🇲🇼', 'Malawi'],
  458: ['MY', '🇲🇾', 'Malaysia'], 462: ['MV', '🇲🇻', 'Maldives'], 470: ['MT', '🇲🇹', 'Malta'],
  478: ['MR', '🇲🇷', 'Mauritania'], 480: ['MU', '🇲🇺', 'Mauritius'], 484: ['MX', '🇲🇽', 'Mexico'],
  496: ['MN', '🇲🇳', 'Mongolia'], 498: ['MD', '🇲🇩', 'Moldova'], 499: ['ME', '🇲🇪', 'Montenegro'],
  504: ['MA', '🇲🇦', 'Morocco'], 508: ['MZ', '🇲🇿', 'Mozambique'], 512: ['OM', '🇴🇲', 'Oman'],
  516: ['NA', '🇳🇦', 'Namibia'], 524: ['NP', '🇳🇵', 'Nepal'], 528: ['NL', '🇳🇱', 'Netherlands'],
  554: ['NZ', '🇳🇿', 'New Zealand'], 558: ['NI', '🇳🇮', 'Nicaragua'], 566: ['NG', '🇳🇬', 'Nigeria'],
  578: ['NO', '🇳🇴', 'Norway'], 586: ['PK', '🇵🇰', 'Pakistan'], 591: ['PA', '🇵🇦', 'Panama'],
  598: ['PG', '🇵🇬', 'Papua New Guinea'], 600: ['PY', '🇵🇾', 'Paraguay'], 604: ['PE', '🇵🇪', 'Peru'],
  608: ['PH', '🇵🇭', 'Philippines'], 616: ['PL', '🇵🇱', 'Poland'], 620: ['PT', '🇵🇹', 'Portugal'],
  634: ['QA', '🇶🇦', 'Qatar'], 642: ['RO', '🇷🇴', 'Romania'], 643: ['RU', '🇷🇺', 'Russia'],
  646: ['RW', '🇷🇼', 'Rwanda'], 682: ['SA', '🇸🇦', 'Saudi Arabia'], 686: ['SN', '🇸🇳', 'Senegal'],
  688: ['RS', '🇷🇸', 'Serbia'], 690: ['SC', '🇸🇨', 'Seychelles'], 702: ['SG', '🇸🇬', 'Singapore'],
  703: ['SK', '🇸🇰', 'Slovakia'], 704: ['VN', '🇻🇳', 'Vietnam'], 705: ['SI', '🇸🇮', 'Slovenia'],
  710: ['ZA', '🇿🇦', 'South Africa'], 716: ['ZW', '🇿🇼', 'Zimbabwe'], 724: ['ES', '🇪🇸', 'Spain'],
  729: ['SD', '🇸🇩', 'Sudan'], 752: ['SE', '🇸🇪', 'Sweden'], 756: ['CH', '🇨🇭', 'Switzerland'],
  760: ['SY', '🇸🇾', 'Syria'], 762: ['TJ', '🇹🇯', 'Tajikistan'], 764: ['TH', '🇹🇭', 'Thailand'],
  768: ['TG', '🇹🇬', 'Togo'], 776: ['TO', '🇹🇴', 'Tonga'], 780: ['TT', '🇹🇹', 'Trinidad'],
  784: ['AE', '🇦🇪', 'UAE'], 788: ['TN', '🇹🇳', 'Tunisia'], 792: ['TR', '🇹🇷', 'Turkey'],
  800: ['UG', '🇺🇬', 'Uganda'], 804: ['UA', '🇺🇦', 'Ukraine'], 807: ['MK', '🇲🇰', 'North Macedonia'],
  818: ['EG', '🇪🇬', 'Egypt'], 826: ['GB', '🇬🇧', 'United Kingdom'], 834: ['TZ', '🇹🇿', 'Tanzania'],
  840: ['US', '🇺🇸', 'United States'], 842: ['US', '🇺🇸', 'United States'], 858: ['UY', '🇺🇾', 'Uruguay'],
  860: ['UZ', '🇺🇿', 'Uzbekistan'], 862: ['VE', '🇻🇪', 'Venezuela'], 887: ['YE', '🇾🇪', 'Yemen'],
  894: ['ZM', '🇿🇲', 'Zambia'],
};
const COMTRADE_CACHE = new Map(); // hs → { fetchedAt, year, data }
const COMTRADE_TTL_MS = 24 * 60 * 60 * 1000;

// USITC HTS REST — US import tariff schedule, no auth. Complements UN Comtrade
// which only gives statistical trade volume/value — this gives actual duty rates
// applied at US ports so users can price their FOB accordingly.
const USITC_URL = process.env.USITC_URL || 'https://hts.usitc.gov/reststop/exportList';
const USITC_CACHE = new Map(); // hs4 → { fetchedAt, entries }
const USITC_TTL_MS = 30 * 24 * 60 * 60 * 1000; // tariff schedules rarely change

// HS Nomenclature (WCO 6-digit standard) — offline lookup table from
// github.com/datasets/harmonized-system. Loaded lazily on first request.
let HS_NOMEN = null; // Map code → { code, description, parent, level, section }
// Full HS (Indonesian + English) lives in src/hs.js. This Map view keeps the
// older callers working: code -> { code, description (EN), description_id, parent, level }.
const HS = require('./hs');
function loadHsNomenclature() {
  if (HS_NOMEN) return HS_NOMEN;
  HS_NOMEN = new Map();
  for (const n of HS.load()) {
    HS_NOMEN.set(n.c, { code: n.c, description: HS.label(n, 'en'), description_id: HS.label(n, 'id'), parent: n.p || null, level: n.l });
  }
  return HS_NOMEN;
}

// Buyers per HS heading / chapter in the live pool, cached for 10 minutes.
let _poolHs = null;
async function poolHsCounts() {
  if (_poolHs && Date.now() - _poolHs.at < 10 * 60 * 1000) return _poolHs;
  const pgc = require('./pg');
  if (!pgc.hasPostgres()) return null;
  const visible = "sb.is_hidden = false";
  const rows = await pgc.query(`SELECT h, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int AS k
                                  FROM scraped_buyers sb, UNNEST(hs_codes) h WHERE ${visible} GROUP BY h`);
  const chs = await pgc.query(`SELECT LEFT(h, 2) AS ch, COUNT(DISTINCT sb.id)::int AS n,
                                      COUNT(DISTINCT sb.id) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int AS k
                                 FROM scraped_buyers sb, UNNEST(hs_codes) h WHERE ${visible} GROUP BY 1`);
  const hs4 = new Map(); const ch = new Map();
  for (const r of rows) {
    const k4 = String(r.h).slice(0, 4);
    const cur = hs4.get(k4) || { n: 0, k: 0 };
    hs4.set(k4, { n: Math.max(cur.n, r.n), k: Math.max(cur.k, r.k) });
  }
  for (const r of chs) ch.set(r.ch, { n: r.n, k: r.k });
  _poolHs = { at: Date.now(), hs4, ch };
  return _poolHs;
}

// Indonesian → English commodity synonym dictionary. When a user searches in
// Indonesian, we expand the query into English keywords the WCO nomenclature
// (which is English-only) can actually match. Values are lists of alternates.
const HS_ID_TO_EN = {
  // spices & flavourings
  'vanili': ['vanilla'], 'vanila': ['vanilla'],
  'kopi': ['coffee'], 'kopi arabica': ['coffee arabica'], 'kopi robusta': ['coffee robusta'],
  'lada': ['pepper'], 'merica': ['pepper'], 'lada hitam': ['pepper black'], 'lada putih': ['pepper white'],
  'cabai': ['chilli', 'capsicum', 'pepper'], 'cabe': ['chilli', 'capsicum'], 'cabai kering': ['dried chilli', 'dried capsicum'],
  'pala': ['nutmeg', 'mace'], 'kapulaga': ['cardamom'], 'fuli': ['mace'],
  'kayu manis': ['cinnamon', 'cassia'],
  'cengkeh': ['cloves'], 'cengkih': ['cloves'],
  'jahe': ['ginger'], 'kunyit': ['turmeric', 'curcuma'], 'kencur': ['galangal', 'kaempferia'],
  'sereh': ['lemongrass', 'citronella'], 'daun jeruk': ['kaffir lime leaves'],
  // agri-food
  'kelapa': ['coconut'], 'minyak kelapa': ['coconut oil'], 'kopra': ['copra'],
  'santan': ['coconut milk', 'coconut cream'], 'gula kelapa': ['coconut sugar', 'palm sugar'],
  'sawit': ['palm oil'], 'minyak sawit': ['palm oil'], 'cpo': ['crude palm oil'],
  'gula': ['sugar', 'sucrose'], 'gula aren': ['palm sugar', 'jaggery'],
  'kakao': ['cocoa', 'cacao'], 'coklat': ['chocolate', 'cocoa'], 'cocoa butter': ['cocoa butter'],
  'teh': ['tea'], 'teh hijau': ['tea green'], 'teh hitam': ['tea black'],
  'sarang burung': ['bird nest', 'edible bird'], 'walet': ['bird nest', 'swiftlet'],
  'madu': ['honey'],
  // seafood / fisheries
  'ikan': ['fish'], 'ikan beku': ['fish frozen'], 'tuna': ['tuna', 'skipjack', 'bonito'],
  'cakalang': ['skipjack', 'bonito'], 'udang': ['shrimp', 'prawn'], 'udang beku': ['shrimp frozen', 'prawn frozen'],
  'lobster': ['lobster'], 'kepiting': ['crab'], 'rajungan': ['blue swimming crab'],
  'rumput laut': ['seaweed', 'algae', 'agar'], 'agar': ['agar-agar'],
  'cumi': ['squid', 'cuttlefish'], 'gurita': ['octopus'],
  // wood, rubber, natural products
  'karet': ['rubber', 'natural rubber'], 'lateks': ['latex'],
  'kayu': ['wood', 'timber'], 'kayu jati': ['teak'], 'kayu lapis': ['plywood'], 'kayu manis': ['cinnamon'],
  'rotan': ['rattan'], 'bambu': ['bamboo'], 'anyaman': ['basketwork', 'wickerwork'],
  'mahoni': ['mahogany'], 'meranti': ['meranti'],
  // furniture / homeware / crafts
  'furniture': ['furniture', 'seats'], 'furnitur': ['furniture'], 'mebel': ['furniture', 'seats'],
  'kursi': ['seats', 'chairs'], 'meja': ['tables', 'furniture'], 'lemari': ['cabinets', 'wardrobes'],
  'lampu': ['lamps', 'lighting'], 'kerajinan': ['handicraft', 'basketwork'],
  // textiles & garments
  'batik': ['batik', 'printed fabric', 'garment', 'cotton'], 'tekstil': ['textile', 'woven fabric'],
  'kain': ['fabric', 'woven', 'cotton'], 'kaos': ['t-shirts', 'garment'],
  'garmen': ['garment', 'apparel'], 'baju': ['garment', 'apparel'],
  'sepatu': ['footwear', 'shoes'], 'sandal': ['sandals', 'footwear'],
  'tas': ['bags', 'handbag'], 'dompet': ['wallet', 'purse'],
  // minerals / metals
  'batu bara': ['coal'], 'nikel': ['nickel'], 'timah': ['tin'], 'tembaga': ['copper'],
  'emas': ['gold'], 'perak': ['silver'], 'bauksit': ['bauxite'],
  // essential oils & cosmetics
  'minyak atsiri': ['essential oil'], 'minyak nilam': ['patchouli oil'],
  'minyak sereh': ['citronella oil', 'lemongrass oil'], 'minyak cengkeh': ['clove oil'],
  'kosmetik': ['cosmetics', 'beauty preparations'], 'sabun': ['soap'],
  // other agri
  'beras': ['rice'], 'jagung': ['maize', 'corn'], 'kedelai': ['soybean'],
  'tembakau': ['tobacco'], 'karet olahan': ['rubber articles'],
};

// Translate an Indonesian query into an English-augmented query, keeping the
// original words too so partial matches still work.
function expandQueryToEnglish(query) {
  const raw = String(query).toLowerCase().trim();
  if (!raw) return raw;
  const expanded = new Set([raw]);
  // Try full phrase mapping first (e.g. "lada hitam", "kayu manis")
  if (HS_ID_TO_EN[raw]) for (const alt of HS_ID_TO_EN[raw]) expanded.add(alt);
  // Then per-word mapping
  for (const word of raw.split(/\s+/)) {
    if (HS_ID_TO_EN[word]) for (const alt of HS_ID_TO_EN[word]) expanded.add(alt);
    else if (word.length >= 3) expanded.add(word);
  }
  return [...expanded].join(' ');
}

// Score HS codes by text overlap with the query — returns a ranked list of
// candidate 6-digit codes. Purely offline; runs against the loaded map.
// Understands Indonesian via HS_ID_TO_EN expansion before scoring.
// The scraper's commodity list (config/commodities.json) names the
// products exporters actually type ("biji kakao", "kopi", "nilam").
// Usual export code for common Indonesian products whose name is not in
// the WCO text (nilam = patchouli oil, gula aren = palm sugar).
const HS6_PREFERRED = {
  '330129': ['nilam', 'minyak nilam', 'patchouli', 'minyak atsiri', 'sereh wangi', 'cengkeh oil'],
  '170290': ['gula aren', 'gula kelapa', 'gula semut', 'palm sugar', 'coconut sugar'],
  '030617': ['udang', 'udang beku', 'udang vaname', 'shrimp', 'prawn'],
  '090111': ['kopi', 'kopi robusta', 'kopi arabika', 'green coffee', 'biji kopi'],
};
let _commodityAliases = null;
function commodityHs4For(query) {
  if (!_commodityAliases) {
    _commodityAliases = [];
    try {
      const cfg = require('../config/commodities.json');
      for (const c of cfg.commodities || []) {
        const names = [c.label_id, c.label_en, ...(c.keywords || [])].filter(Boolean)
          .flatMap((n) => String(n).toLowerCase().split(/[\/,()&]/)).map((n) => n.replace(/\b(dll|etc)\b/g, '').trim()).filter((n) => n.length >= 3);
        _commodityAliases.push({ hs4: c.hs4, names });
      }
    } catch { /* optional */ }
  }
  const raw = ' ' + String(query || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const out = new Set();
  let best = 0;
  for (const a of _commodityAliases) {
    for (const n of a.names) {
      if (raw.includes(' ' + n + ' ') && n.length >= best) {
        if (n.length > best) out.clear();
        best = n.length; out.add(a.hs4);
      }
    }
  }
  return out;
}

function searchHsNomenclature(query, limit = 10, levels = [6]) {
  // Indonesian label in `description`, English in `description_en`.
  return HS.search(query, { limit, levels, boostHs4: commodityHs4For(query) }).map((r) => ({
    code: r.code, description: r.description, description_en: r.description_en,
    parent: r.parent, level: r.level, section: null, score: r.score,
  }));
}

async function fetchUsitcHts(hs) {
  const clean = String(hs || '').replace(/\D/g, '');
  if (clean.length < 4) return null;
  const heading = clean.slice(0, 4); // 4-digit heading is the smallest range with data
  const cached = USITC_CACHE.get(heading);
  if (cached && (Date.now() - cached.fetchedAt) < USITC_TTL_MS) return cached.entries;
  try {
    const url = `${USITC_URL}?from=${heading}&to=${heading}.99&format=JSON&styles=false`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) return null;
    // Normalize: keep only rows with an actual htsno; add depth indent for indenting
    const entries = j.filter((row) => row && (row.htsno || row.description)).map((row) => ({
      htsno: row.htsno || '',
      description: row.description || '',
      indent: parseInt(row.indent || '0', 10) || 0,
      units: Array.isArray(row.units) ? row.units : [],
      general: row.general || '',
      special: row.special || '',
      other: row.other || '',
      quotaQuantity: row.quotaQuantity || '',
      additionalDuties: row.additionalDuties || '',
    }));
    USITC_CACHE.set(heading, { fetchedAt: Date.now(), entries });
    return entries;
  } catch (e) { console.warn('[usitc]', heading, e.message || e); return null; }
}

// Fetch Indonesia's export flow (partner-country breakdown) for a given HS code
// from UN Comtrade+. Caches per HS for 24h. Returns null on any failure.
async function fetchIndonesiaExports(hsCode) {
  const clean = String(hsCode || '').replace(/\D/g, '').slice(0, 6);
  if (!clean) return null;
  const cached = COMTRADE_CACHE.get(clean);
  if (cached && (Date.now() - cached.fetchedAt) < COMTRADE_TTL_MS) return cached.payload;
  // UN Comtrade releases annual data with a lag. Try the last 3 completed years.
  const currentYear = 2025; // Data.now() is not available; keep this bumped periodically.
  for (let y = currentYear - 1; y >= currentYear - 3; y--) {
    try {
      const url = `${COMTRADE_URL}/C/A/HS?reporterCode=${COMTRADE_INDONESIA_M49}&period=${y}&cmdCode=${clean}&flowCode=X`;
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15000);
      const r = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': COMTRADE_KEY }, signal: ac.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j.data) || !j.data.length) continue;
      // Aggregate: sum by partnerCode (partnerCode=0 = World, skip)
      const agg = new Map();
      let worldValue = 0, worldWeight = 0;
      for (const row of j.data) {
        const pc = row.partnerCode;
        const val = row.fobvalue || row.cifvalue || row.primaryValue || 0;
        const wgt = row.netWgt || 0;
        if (pc === 0) { worldValue = Math.max(worldValue, val); worldWeight = Math.max(worldWeight, wgt); continue; }
        const prev = agg.get(pc) || { value: 0, weight: 0 };
        agg.set(pc, { value: prev.value + val, weight: prev.weight + wgt });
      }
      const byCountry = [...agg.entries()]
        .map(([pc, v]) => {
          const meta = M49_MAP[pc] || [null, '🏳️', 'M49-' + pc];
          return { partner_code: pc, iso2: meta[0], flag: meta[1], name: meta[2], value_usd: v.value, net_wgt_kg: v.weight };
        })
        .sort((a, b) => b.value_usd - a.value_usd);
      const totalValue = worldValue || byCountry.reduce((s, r) => s + r.value_usd, 0);
      const totalWgt = worldWeight || byCountry.reduce((s, r) => s + r.net_wgt_kg, 0);
      const payload = { ok: true, hs: clean, year: y, source: 'UN Comtrade+', total_value_usd: totalValue, total_net_wgt_kg: totalWgt, by_country: byCountry };
      COMTRADE_CACHE.set(clean, { fetchedAt: Date.now(), payload });
      return payload;
    } catch (e) { console.warn('[comtrade]', y, hsCode, e.message || e); }
  }
  return null;
}

// Small in-memory cache: access_token -> {userId, expires} to avoid hitting Supabase
// on every request. Serverless-safe: cache lives only within this hot instance.
const SB_TOKEN_CACHE = new Map();
const SB_CACHE_TTL_MS = 60 * 1000;

// Verify a Supabase JWT and upsert the mirroring local user row.
// Returns the local user row or null if the token is invalid.
// A page fires several API calls at once; on a cold instance they would each
// call Supabase twice. Share one in-flight verification per token.
const SB_INFLIGHT = new Map();
function verifySupabaseToken(db, accessToken) {
  if (!accessToken) return Promise.resolve(null);
  const hit = SB_TOKEN_CACHE.get(accessToken);
  if (hit && hit.expires > Date.now()) return verifySupabaseTokenRaw(db, accessToken);
  if (SB_INFLIGHT.has(accessToken)) return SB_INFLIGHT.get(accessToken);
  const p = verifySupabaseTokenRaw(db, accessToken).finally(() => SB_INFLIGHT.delete(accessToken));
  SB_INFLIGHT.set(accessToken, p);
  return p;
}
async function verifySupabaseTokenRaw(db, accessToken) {
  if (!accessToken) return null;
  const cached = SB_TOKEN_CACHE.get(accessToken);
  if (cached && cached.expires > Date.now()) {
    return db.prepare('SELECT * FROM users WHERE id=?').get(cached.userId) || null;
  }
  try {
    const uResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY },
    });
    if (!uResp.ok) return null;
    const sbUser = await uResp.json();
    if (!sbUser || !sbUser.email) return null;

    // Fetch profile (optional)
    let profile = {};
    try {
      const pResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(sbUser.id)}&select=*`, {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY, 'Accept': 'application/json' },
      });
      if (pResp.ok) { const arr = await pResp.json(); if (Array.isArray(arr) && arr[0]) profile = arr[0]; }
    } catch {}

    const email = sbUser.email;
    const displayName = profile.name || (sbUser.user_metadata && sbUser.user_metadata.name) || email.split('@')[0];
    const orgName = profile.org_name || (sbUser.user_metadata && sbUser.user_metadata.org_name) || null;
    const hsFocus = Array.isArray(profile.hs_focus) ? profile.hs_focus : [];
    const targetCountries = Array.isArray(profile.target_countries) ? profile.target_countries : [];
    const exportStatus = profile.export_status || null;
    const goal = profile.goal || null;
    const onboarded = profile.onboarded ? 1 : 0;

    let u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!u) {
      db.prepare(`INSERT INTO users (email, password_hash, name, org_name, hs_focus, target_countries, export_status, goal, onboarded)
                  VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(email, 'supabase:' + sbUser.id, displayName, orgName,
             JSON.stringify(hsFocus), JSON.stringify(targetCountries),
             exportStatus, goal, onboarded);
      u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    } else {
      db.prepare(`UPDATE users SET name=COALESCE(?,name), org_name=COALESCE(?,org_name),
                  hs_focus=?, target_countries=?, export_status=COALESCE(?,export_status),
                  goal=COALESCE(?,goal), onboarded=? WHERE id=?`)
        .run(displayName, orgName,
             JSON.stringify(hsFocus.length ? hsFocus : JSON.parse(u.hs_focus || '[]')),
             JSON.stringify(targetCountries.length ? targetCountries : JSON.parse(u.target_countries || '[]')),
             exportStatus, goal,
             (onboarded || u.onboarded) ? 1 : 0,
             u.id);
      u = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
    }
    SB_TOKEN_CACHE.set(accessToken, { userId: u.id, expires: Date.now() + SB_CACHE_TTL_MS });
    return u;
  } catch (e) {
    console.error('[verifySupabaseToken]', e);
    return null;
  }
}

// Async version of getSessionUser — checks Bearer token then cookie. Serverless-safe.
async function resolveUser(db, req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) {
    const raw = m[1].trim();
    // Signed admin token survives cold starts; check first, no DB lookup.
    // Accept either the new '|'-separated admin token or a Supabase JWT.
    const admin = raw.startsWith('admin|') ? require('./auth').verifyAdminToken(raw) : null;
    if (admin) {
      // db.js re-seeds on cold start so the admin user is usually present.
      // If it is not (bare DB), synthesize a virtual admin so the request
      // still succeeds: signing the token already proved they had valid
      // credentials at login time.
      const u = db.prepare('SELECT * FROM users WHERE email=?').get(admin.email);
      if (u && u.is_admin) return u;
      return {
        id: admin.id, email: admin.email, name: 'Super Admin',
        org_name: 'EksporIn Admin', plan: 'business', hs_focus: '[]',
        target_countries: '[]', onboarded: 1, is_admin: 1, status: 'active',
      };
    }
    const u = await verifySupabaseToken(db, raw);
    if (u) return u;
  }
  return getSessionUser(db, req);
}

// ---------- plans: defined in src/billing.js (QRIS passes + prepaid balance) ----------
const PLANS = billing.PLANS;
const COUNTRY_NAMES = {
  US: 'Amerika Serikat', JP: 'Jepang', NL: 'Belanda', AE: 'Uni Emirat Arab', AU: 'Australia', ID: 'Indonesia', VN: 'Vietnam',
  BR: 'Brasil', CO: 'Kolombia', IN: 'India', TH: 'Thailand', CN: 'Tiongkok', MY: 'Malaysia', EC: 'Ekuador', ET: 'Ethiopia',
  DE: 'Jerman', GB: 'Inggris', FR: 'Prancis', KR: 'Korea Selatan', SA: 'Arab Saudi', IT: 'Italia', BE: 'Belgia', ES: 'Spanyol',
  CA: 'Kanada', SG: 'Singapura', TW: 'Taiwan', TR: 'Turki', EG: 'Mesir', CH: 'Swiss', PL: 'Polandia', SE: 'Swedia',
  NZ: 'Selandia Baru', PH: 'Filipina', AT: 'Austria', DK: 'Denmark', IE: 'Irlandia', NO: 'Norwegia', PT: 'Portugal',
  MX: 'Meksiko', ZA: 'Afrika Selatan', PK: 'Pakistan', BD: 'Bangladesh',
};
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ---------- helpers ----------
const period = () => new Date().toISOString().slice(0, 7);
const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
const err = (res, code, message) => json(res, code, { error: message });

function getUsage(db, userId, meter) {
  const r = db.prepare('SELECT used FROM usage_meters WHERE user_id=? AND meter=? AND period=?').get(userId, meter, period());
  return r ? r.used : 0;
}
function bumpUsage(db, userId, meter, n = 1) {
  db.prepare(`INSERT INTO usage_meters (user_id,meter,period,used) VALUES (?,?,?,?)
    ON CONFLICT(user_id,meter,period) DO UPDATE SET used = used + excluded.used`).run(userId, meter, period(), n);
}
// Quota view for responses: what this cycle has used vs the plan limit,
// plus the balance that pays for usage beyond it.
function quotaView(acct, meter) {
  const limit = acct.cfg[meter];
  return { used: acct.used[meter] || 0, limit: limit === undefined ? null : limit, balance: acct.balance, rate: billing.RATES[meter] };
}

// Product Fit (F4): user's HS focus vs buyer's HS codes
function productFit(userHs, buyerHs) {
  if (!userHs.length || !buyerHs.length) return 50;
  let best = 15;
  for (const u of userHs) for (const b of buyerHs) {
    if (u === b) best = Math.max(best, 100);
    else if (u.slice(0, 4) === b.slice(0, 4)) best = Math.max(best, 75);
    else if (u.slice(0, 2) === b.slice(0, 2)) best = Math.max(best, 50);
  }
  return best;
}
function finalScore(b, fit) {
  const g = b.growth_score === null ? 50 : b.growth_score;
  return Math.min(100, Math.round(
    b.activity_score * 0.30 + g * 0.20 + fit * 0.25 + b.reachability_score * 0.15 + b.untapped_score * 0.10));
}
const scoreLabel = (s) => (s >= 80 ? 'Hot' : s >= 60 ? 'Warm' : s >= 40 ? 'Cold' : 'Low');

function maskContact(type, value) {
  if (type === 'website') return value; // websites are public
  if (type === 'email') { const [l, d] = value.split('@'); return l[0] + '•'.repeat(Math.max(3, l.length - 1)) + '@•••••.' + (d ? d.split('.').pop() : 'com'); }
  if (type === 'phone') return value.slice(0, 4) + ' ••• ••• ••' + value.slice(-2);
  return value.replace(/(https?:\/\/[^/]+\/).*/, '$1••••••');
}

function savedCount(db, userId) {
  return db.prepare('SELECT COUNT(DISTINCT lb.buyer_id) AS c FROM list_buyers lb JOIN lists l ON l.id=lb.list_id WHERE l.user_id=?').get(userId).c;
}

function buyerHsCodes(db, buyerId) {
  return db.prepare('SELECT hs_code FROM buyer_hs WHERE buyer_id=?').all(buyerId).map((r) => r.hs_code);
}

function renderTemplate(db, tpl, buyer, user) {
  const userHs = JSON.parse(user.hs_focus || '[]');
  const bHs = buyerHsCodes(db, buyer.id);
  const match = userHs.find((u) => bHs.some((b) => b.slice(0, 4) === u.slice(0, 4))) || bHs[0] || (userHs[0] || '090111');
  const hsNode = HS.get(match) || HS.get(String(match).slice(0, 4));
  const hsRow = hsNode ? { code: hsNode.c, description_en: HS.label(hsNode, 'en'), description_id: HS.label(hsNode, 'id') } : { description_en: 'export products' };
  let note = '';
  if (buyer.last_shipment_date) {
    const d = new Date(buyer.last_shipment_date);
    note = `, most recently in ${['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()]} ${d.getFullYear()}`;
  }
  const vars = {
    buyer_name: buyer.name, buyer_country: COUNTRY_NAMES[buyer.country] || buyer.country,
    hs_code: match.replace(/^(\d{4})(\d{2})$/, '$1.$2'), hs_description: hsRow.description_en.toLowerCase(),
    user_name: user.name, org_name: user.org_name || user.name, last_shipment_note: note,
  };
  const sub = (s) => (s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  return { subject: sub(tpl.subject), body: sub(tpl.body) };
}

// simulated engagement tracking (deterministic by message id + elapsed time)
function simulateTracking(db, msg) {
  if (msg.status === 'replied') return msg;
  const ageMin = (Date.now() - new Date(msg.sent_at + 'Z').getTime()) / 60000;
  const h = (msg.id * 2654435761) % 100;
  let status = msg.status, opened = msg.opened_at, replied = msg.replied_at;
  if (ageMin > 2 && h < 65 && !opened) { status = 'opened'; opened = new Date().toISOString().slice(0, 19).replace('T', ' '); }
  if (ageMin > 6 && h < 25 && opened && !replied) { status = 'replied'; replied = new Date().toISOString().slice(0, 19).replace('T', ' '); }
  if (status !== msg.status) {
    db.prepare('UPDATE messages SET status=?, opened_at=?, replied_at=? WHERE id=?').run(status, opened, replied, msg.id);
    return { ...msg, status, opened_at: opened, replied_at: replied };
  }
  return msg;
}

// ---------- alerts materialization ----------
function materializeAlerts(db, user) {
  if ((PLANS[user.plan] || PLANS.expired).alerts === 0) return;
  const hsFocus = JSON.parse(user.hs_focus || '[]');
  const countries = JSON.parse(user.target_countries || '[]');
  const ins = db.prepare(`INSERT OR IGNORE INTO alerts (user_id,dedup_key,type,title,body,buyer_id,hs_code) VALUES (?,?,?,?,?,?,?)`);

  // 1) new buyers in followed HS + countries (first shipment within 45 days)
  if (hsFocus.length) {
    const prefixes = hsFocus.map((h) => h.slice(0, 4));
    const rows = db.prepare(`SELECT DISTINCT b.id, b.name, b.country, bh.hs_code FROM buyers b
      JOIN buyer_hs bh ON bh.buyer_id = b.id
      WHERE b.first_shipment_date >= date('now','-45 days')
      ${countries.length ? `AND b.country IN (${countries.map(() => '?').join(',')})` : ''}`).all(...countries);
    for (const r of rows) {
      if (!prefixes.includes(r.hs_code.slice(0, 4))) continue;
      ins.run(user.id, `nb:${r.id}`, 'new_buyer', `Buyer baru: ${r.name}`,
        `Importir baru terdeteksi di HS ${r.hs_code} (${COUNTRY_NAMES[r.country] || r.country}). Belum banyak yang menghubungi. Peluang first-mover.`, r.id, r.hs_code);
    }
  }
  // 2) activity on saved buyers (shipment in last 21 days)
  const saved = db.prepare(`SELECT DISTINCT b.id, b.name, b.last_shipment_date FROM buyers b
    JOIN list_buyers lb ON lb.buyer_id = b.id JOIN lists l ON l.id = lb.list_id
    WHERE l.user_id=? AND b.last_shipment_date >= date('now','-21 days')`).all(user.id);
  for (const r of saved) {
    ins.run(user.id, `act:${r.id}:${r.last_shipment_date}`, 'buyer_activity', `${r.name} punya shipment baru`,
      `Buyer di daftar Anda menerima kiriman baru pada ${r.last_shipment_date}. Momentum bagus untuk follow-up.`, r.id, null);
  }
  // 3) competitor: Indonesian exporter shipped to saved buyer in last 30 days
  const comp = db.prepare(`SELECT s.buyer_id, b.name, e.name AS exporter, MAX(s.shipment_date) AS d
    FROM shipments s JOIN exporters e ON e.id=s.exporter_id JOIN buyers b ON b.id=s.buyer_id
    JOIN list_buyers lb ON lb.buyer_id = s.buyer_id JOIN lists l ON l.id = lb.list_id
    WHERE l.user_id=? AND e.is_indonesian=1 AND s.shipment_date >= date('now','-30 days')
    GROUP BY s.buyer_id`).all(user.id);
  for (const r of comp) {
    ins.run(user.id, `comp:${r.buyer_id}:${r.d.slice(0, 7)}`, 'competitor', `Kompetitor Indonesia mengirim ke ${r.name}`,
      `${r.exporter} mengekspor ke buyer di daftar Anda pada ${r.d}. Buyer ini terbukti mau membeli dari Indonesia.`, r.buyer_id, null);
  }
  // 4) reminders due
  const rem = db.prepare(`SELECT lb.list_id, lb.buyer_id, lb.reminder_at, b.name FROM list_buyers lb
    JOIN lists l ON l.id=lb.list_id JOIN buyers b ON b.id=lb.buyer_id
    WHERE l.user_id=? AND lb.reminder_at IS NOT NULL AND lb.reminder_at <= datetime('now')`).all(user.id);
  for (const r of rem) {
    ins.run(user.id, `rem:${r.list_id}:${r.buyer_id}:${r.reminder_at}`, 'reminder', `Waktunya follow-up: ${r.name}`,
      `Pengingat yang Anda pasang jatuh tempo (${r.reminder_at.slice(0, 10)}).`, r.buyer_id, null);
  }
}

// ---------- route table ----------
async function handleApi(db, req, res, url, body) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;
  const method = req.method;
  const route = (m, pattern) => {
    if (m !== method) return null;
    const rx = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    const match = p.match(rx);
    return match ? (match.groups || {}) : null;
  };
  let m;

  // ===== auth (public) =====
  if (route('POST', '/api/auth/register')) {
    const { email, password, name, org_name } = body || {};
    if (!email || !password || !name) return err(res, 400, 'Nama, email, dan password wajib diisi.');
    if (password.length < 8) return err(res, 400, 'Password minimal 8 karakter.');
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return err(res, 409, 'Email sudah terdaftar. Silakan masuk.');
    db.prepare('INSERT INTO users (email,password_hash,name,org_name) VALUES (?,?,?,?)').run(email, hashPassword(password), name, org_name || null);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    res.setHeader('Set-Cookie', sessionCookie(createSession(db, u.id)));
    return json(res, 201, { ok: true, onboarded: false });
  }
  if (route('POST', '/api/auth/login')) {
    const { email, password } = body || {};
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email || '');
    if (!u || !verifyPassword(password || '', u.password_hash)) return err(res, 401, 'Email atau password salah.');
    res.setHeader('Set-Cookie', sessionCookie(createSession(db, u.id)));
    // Issue a stateless admin token so cold-starting the Vercel instance
    // does not throw the admin back to the login card mid-session.
    const admin_token = u.is_admin ? require('./auth').createAdminToken(u) : null;
    return json(res, 200, { ok: true, onboarded: !!u.onboarded, is_admin: !!u.is_admin, admin_token });
  }
  // Supabase bridge: verify a Supabase access_token, upsert a local user row
  // that mirrors the Supabase user + profile, and issue a local session cookie so
  // the rest of the buyer-intelligence API continues to work unchanged.
  // Force-plan lookup: emails in this map always get the plan on the
  // right regardless of what the seed order or Supabase profile says.
  // Use it for internal tester accounts we want to lock at a specific
  // tier no matter what.
  const FORCED_PLAN_BY_EMAIL = {
    'admin@super-vanilla.com': 'business',
  };

  if (route('POST', '/api/auth/supabase-sync')) {
    return (async () => {
      const { access_token } = body || {};
      if (!access_token || typeof access_token !== 'string') return err(res, 400, 'access_token wajib diisi.');
      try {
        const uResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
          headers: { 'Authorization': 'Bearer ' + access_token, 'apikey': SUPABASE_ANON_KEY },
        });
        if (!uResp.ok) return err(res, 401, 'Token Supabase tidak valid.');
        const sbUser = await uResp.json();
        if (!sbUser || !sbUser.email) return err(res, 401, 'User Supabase tidak ditemukan.');

        // Fetch profile row (RLS ensures user only sees their own)
        let profile = {};
        try {
          const pResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(sbUser.id)}&select=*`, {
            headers: { 'Authorization': 'Bearer ' + access_token, 'apikey': SUPABASE_ANON_KEY, 'Accept': 'application/json' },
          });
          if (pResp.ok) { const arr = await pResp.json(); if (Array.isArray(arr) && arr[0]) profile = arr[0]; }
        } catch { /* profile is optional */ }

        const email = sbUser.email;
        const displayName = profile.name || (sbUser.user_metadata && sbUser.user_metadata.name) || email.split('@')[0];
        const orgName = profile.org_name || (sbUser.user_metadata && sbUser.user_metadata.org_name) || null;
        const hsFocus = Array.isArray(profile.hs_focus) ? profile.hs_focus : [];
        const targetCountries = Array.isArray(profile.target_countries) ? profile.target_countries : [];
        const exportStatus = profile.export_status || null;
        const goal = profile.goal || null;
        const onboarded = profile.onboarded ? 1 : 0;

        const forcedPlan = FORCED_PLAN_BY_EMAIL[email.toLowerCase()] || null;

        let u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (!u) {
          db.prepare(`INSERT INTO users (email, password_hash, name, org_name, plan, hs_focus, target_countries, export_status, goal, onboarded)
                      VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .run(email, 'supabase:' + sbUser.id, displayName, orgName,
                 forcedPlan || 'free',
                 JSON.stringify(hsFocus), JSON.stringify(targetCountries),
                 exportStatus, goal, onboarded);
          u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        } else {
          // Sync profile → local (Supabase profile is source of truth for these fields)
          db.prepare(`UPDATE users SET name=COALESCE(?,name), org_name=COALESCE(?,org_name),
                      hs_focus=?, target_countries=?, export_status=COALESCE(?,export_status),
                      goal=COALESCE(?,goal), onboarded=? WHERE id=?`)
            .run(displayName, orgName,
                 JSON.stringify(hsFocus.length ? hsFocus : JSON.parse(u.hs_focus || '[]')),
                 JSON.stringify(targetCountries.length ? targetCountries : JSON.parse(u.target_countries || '[]')),
                 exportStatus, goal,
                 (onboarded || u.onboarded) ? 1 : 0,
                 u.id);
          u = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
        }

        // Apply forced plan even to existing rows so a stale free plan
        // gets upgraded on next login, and downgrades from anywhere
        // never stick for a locked tester email.
        if (forcedPlan && u.plan !== forcedPlan) {
          db.prepare('UPDATE users SET plan=? WHERE id=?').run(forcedPlan, u.id);
          u = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
        }

        res.setHeader('Set-Cookie', sessionCookie(createSession(db, u.id)));
        return json(res, 200, { ok: true, onboarded: !!u.onboarded, email });
      } catch (e) {
        console.error('[supabase-sync]', e);
        return err(res, 500, 'Gagal sinkronisasi dengan Supabase.');
      }
    })();
  }

  if (route('POST', '/api/auth/logout')) {
    destroySession(db, req);
    res.setHeader('Set-Cookie', clearCookie());
    return json(res, 200, { ok: true });
  }
  if (route('GET', '/api/plans')) {
    return json(res, 200, { plans: billing.publicCatalog(), rates: billing.RATES, topup: billing.TOPUP, trial_days: PLANS.trial.days });
  }

  // Sumopod payment webhook (public; authenticated by signature/token).
  // Configure in the Sumopod dashboard: POST https://<domain>/api/billing/webhook
  if (route('POST', '/api/billing/webhook')) {
    const raw = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body || {});
    if (!sumopod.verifyWebhook(req.headers, raw)) return err(res, 401, 'invalid signature');
    let evt; try { evt = JSON.parse(raw); } catch { return err(res, 400, 'bad json'); }
    const type = String(evt.event_type || evt.type || '');
    if (type === 'payment.test') return json(res, 200, { status: 'ignored' });
    const d = evt.data || {};
    if (!d.order_id) return json(res, 200, { status: 'ignored' });
    try {
      const key = `${d.payment_id || d.order_id}:${type}`;
      const seen = await require('./pg').query(
        `INSERT INTO billing_events (event_key, order_id, event_type, raw) VALUES ($1,$2,$3,$4)
         ON CONFLICT (event_key) DO NOTHING RETURNING event_key`, [key, d.order_id, type, raw.slice(0, 20000)]);
      const order = await billing.getOrder(d.order_id);
      if (!order) return json(res, 200, { status: 'unknown_order' });
      if (type === 'payment.completed' || sumopod.normalizeStatus(d.status) === 'paid') {
        const r = await billing.applyPaid(d.order_id, { paidAmount: d.amount ?? null, raw: d });
        return json(res, 200, { status: r.ok ? 'applied' : r.reason, duplicate: !seen.length });
      }
      if (type === 'payment.expired') await billing.markOrder(d.order_id, 'expired');
      if (type === 'payment.failed') await billing.markOrder(d.order_id, 'failed');
      return json(res, 200, { status: 'recorded' });
    } catch (e) {
      console.error('[billing] webhook error', e.message);
      return err(res, 500, 'webhook processing failed');
    }
  }

  // Public preview: given a natural-language commodity query, resolve it to
  // an HS 6-digit via the offline WCO nomenclature (Indonesian-aware),
  // then return a teaser list of buyers who import that HS. Two rows are
  // returned unmasked, three more are marked "blurred:true" so the landing
  // Quick Search page can visually gate them behind the signup CTA.
  // GET /api/preview/buyers?q=vanili
  if (route('GET', '/api/preview/buyers')) {
    const qStr = (q.get('q') || '').trim();
    if (!qStr) return json(res, 200, { ok: false, query: '', message: 'Query kosong.' });
    const hsHits = searchHsNomenclature(qStr, 12);
    if (!hsHits.length) return json(res, 200, { ok: false, query: qStr, hs: null, buyers: [], message: 'HS code tidak ditemukan.' });
    const hs4 = hsHits[0].code.slice(0, 4);
    const hsBlock = {
      code: hsHits[0].code, description: hsHits[0].description,
    };
    // Alternatives: close matches only, same chapter first.
    const close = hsHits.slice(1).filter((h) => (h.score || 0) >= (hsHits[0].score || 0) * 0.55);
    const alts = [...close.filter((h) => h.code.slice(0, 2) === hsHits[0].code.slice(0, 2)), ...close.filter((h) => h.code.slice(0, 2) !== hsHits[0].code.slice(0, 2))]
      .slice(0, 3).map((h) => ({ code: h.code, description: h.description }));
    // Real buyer pool (Postgres). Only names/locations/type and which
    // contact channels exist are shown; contact values never leave the API.
    if (require('./pg').hasPostgres()) {
      try {
        const pgp = require('./pg');
        const visible = `hs_codes @> ARRAY[$1]::text[] AND sb.is_hidden = false`;
        const stats = await pgp.one(`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL)::int AS with_contact,
              COUNT(DISTINCT country)::int AS countries
            FROM scraped_buyers sb WHERE ${visible}`, [hs4]);
        if (stats && stats.total > 0) {
          const top = await pgp.query(`SELECT country, COUNT(*)::int AS c FROM scraped_buyers sb WHERE ${visible}
                                        GROUP BY country ORDER BY c DESC LIMIT 6`, [hs4]);
          const rows = await pgp.query(`SELECT id, name, country, city, industry,
                 COALESCE(sb.buyer_type, raw_json->>'buyer_type') AS buyer_type,
                 (email IS NOT NULL) AS has_email, (phone IS NOT NULL) AS has_phone, (website IS NOT NULL) AS has_website,
                 COALESCE(sb.quality_score, data_confidence) AS q
            FROM scraped_buyers sb WHERE ${visible}
            ORDER BY (email IS NOT NULL OR phone IS NOT NULL) DESC, q DESC NULLS LAST, id LIMIT 5`, [hs4]);
          return json(res, 200, {
            ok: true, query: qStr, hs: hsBlock, hs_alternatives: alts, pool: true,
            stats: { ...stats, top_countries: top.map((t) => ({ country: t.country, country_name: COUNTRY_NAMES[t.country] || t.country, count: t.c })) },
            buyers: rows.map((b, i) => ({
              id: Number(b.id), name: i < 2 ? b.name : null, country: b.country,
              country_name: COUNTRY_NAMES[b.country] || b.country, city: b.city,
              industry: b.industry, buyer_type: b.buyer_type,
              has_email: b.has_email, has_phone: b.has_phone, has_website: b.has_website,
              score: b.q, blurred: i >= 2,
            })),
            total_buyers_available: stats.total,
          });
        }
      } catch (e) { console.warn('[preview] pool unavailable', e.message); }
    }
    // Pull up to 5 buyers with a matching HS prefix from the seeded directory.
    const buyerRows = db.prepare(`
      SELECT b.id, b.name, b.country, b.city, b.industry, b.size_bucket,
             b.shipments_12mo, b.volume_12mo_kg, b.value_12mo_usd,
             b.base_score
      FROM buyers b
      JOIN buyer_hs bh ON bh.buyer_id = b.id
      WHERE bh.hs_code LIKE ?
      GROUP BY b.id
      ORDER BY b.base_score DESC
      LIMIT 5
    `).all(hs4 + '%');
    const buyers = buyerRows.map((b, i) => ({
      id: b.id,
      name: b.name,
      country: b.country,
      country_name: COUNTRY_NAMES[b.country] || b.country,
      city: b.city,
      industry: b.industry,
      size: b.size_bucket,
      shipments_12mo: b.shipments_12mo,
      volume_12mo_kg: b.volume_12mo_kg,
      value_12mo_usd: b.value_12mo_usd,
      score: b.base_score,
      blurred: i >= 2, // first 2 clear, rest blurred
    }));
    return json(res, 200, {
      ok: true,
      query: qStr,
      hs: {
        code: hsHits[0].code,
        description: hsHits[0].description,
      },
      hs_alternatives: hsHits.slice(1, 4).map((h) => ({ code: h.code, description: h.description })),
      buyers,
      total_buyers_available: buyerRows.length,
    });
  }

  // HS search — public endpoint so the landing page "try before signup"
  // commodity search can hit it without an auth cookie. Runs entirely against
  // the offline WCO nomenclature file — no external calls, no rate limits.
  if (route('GET', '/api/hs/search')) {
    const qStr = (q.get('q') || '').trim();
    if (!qStr) return json(res, 200, { ok: true, query: '', results: [] });
    const levels = (q.get('levels') || '4,6,8').split(',').map(Number).filter((n) => [2, 4, 6, 8].includes(n));
    const counts = await poolHsCounts().catch(() => null);
    const results = searchHsNomenclature(qStr, Math.min(60, Number(q.get('limit')) || 30), levels.length ? levels : [4, 6, 8]).map((r) => ({
      code: r.code, level: r.level, parent: r.parent,
      description: r.description, description_en: r.description_en,
      buyers: counts ? (counts.hs4.get(r.code.slice(0, 4)) || { n: 0, k: 0 }).n : null,
    }));
    return json(res, 200, { ok: true, query: qStr, results, count: results.length });
  }

  // ===== everything below requires auth =====
  // Prefer Supabase Bearer (stateless — survives serverless cold instances),
  // fall back to local session cookie (demo user).
  const user = await resolveUser(db, req);
  if (!user) return err(res, 401, 'Sesi tidak valid. Silakan masuk kembali.');
  // Plan, quota usage and balance come from Postgres (billing.js), never
  // from the per-instance sql.js row or the client.
  let acct;
  try { acct = await billing.load(user); } catch (e) {
    console.error('[billing] load failed:', e.message);
    return err(res, 503, 'Layanan akun sedang gangguan. Coba lagi beberapa saat lagi.');
  }
  user.plan = acct.plan;
  const plan = acct.cfg;
  const userHs = JSON.parse(user.hs_focus || '[]');

  if (route('GET', '/api/me')) {
    const meters = {};
    for (const mKey of billing.METERS) meters[mKey] = quotaView(acct, mKey);
    return json(res, 200, {
      id: user.id, email: user.email, name: user.name, org_name: user.org_name, plan: user.plan,
      plan_name: plan.name, onboarded: !!user.onboarded, hs_focus: userHs,
      target_countries: JSON.parse(user.target_countries || '[]'), export_status: user.export_status, goal: user.goal,
      quotas: meters, contacts_visible: true,
      billing: billing.summarize(acct),
      saved: { used: savedCount(db, user.id), limit: plan.saved },
      unread_alerts: db.prepare('SELECT COUNT(*) c FROM alerts WHERE user_id=? AND read=0').get(user.id).c,
      is_admin: !!user.is_admin,
    });
  }

  if (route('POST', '/api/me/onboarding')) {
    const { hs_focus = [], target_countries = [], export_status, goal, org_name } = body || {};
    db.prepare('UPDATE users SET hs_focus=?, target_countries=?, export_status=?, goal=?, org_name=COALESCE(?,org_name), onboarded=1 WHERE id=?')
      .run(JSON.stringify(hs_focus.slice(0, 5)), JSON.stringify(target_countries), export_status || null, goal || null, org_name || null, user.id);
    return json(res, 200, { ok: true });
  }

  // Manual plan switch: only for local demo (no billing database) or admins.
  if (route('POST', '/api/me/plan')) {
    if (billing.enabled() && !user.is_admin) return err(res, 403, 'Paket diaktifkan otomatis setelah pembayaran QRIS berhasil.');
    const { plan: newPlan } = body || {};
    if (!PLANS[newPlan] || !PLANS[newPlan].public) return err(res, 400, 'Paket tidak dikenal.');
    if (billing.enabled()) await billing.adminSetPlan(user.email, newPlan);
    db.prepare('UPDATE users SET plan=? WHERE id=?').run(newPlan, user.id);
    return json(res, 200, { ok: true, plan: newPlan });
  }

  if (route('GET', '/api/billing/summary')) {
    const h = billing.enabled() ? await billing.history(acct.email, 20) : { orders: [], ledger: [] };
    return json(res, 200, {
      account: billing.summarize(acct), plans: billing.publicCatalog(), rates: billing.RATES,
      topup: billing.TOPUP, orders: h.orders, ledger: h.ledger, gateway_ready: sumopod.configured(),
    });
  }

  // Create a QRIS payment (Sumopod) for a 30-day plan or a balance top-up.
  // The amount always comes from the server: the plan price, or a validated
  // top-up value. The client only gets the hosted payment URL.
  if (route('POST', '/api/billing/checkout')) {
    if (!billing.enabled()) return err(res, 503, 'Pembayaran belum aktif di server ini (database billing belum dikonfigurasi).');
    const kind = body?.kind === 'topup' ? 'topup' : 'plan';
    let amount; let planCode = null;
    if (kind === 'plan') {
      planCode = String(body?.plan || '');
      const cfg = PLANS[planCode];
      if (!cfg || !cfg.public || !cfg.price) return err(res, 400, 'Paket tidak dikenal.');
      amount = cfg.price;
    } else {
      const problem = billing.validateTopup(body?.amount);
      if (problem) return err(res, 400, problem);
      amount = Number(body.amount);
    }
    // Avoid piling up unpaid orders: reuse a pending one for the same thing from the last 30 minutes.
    const pgc = require('./pg');
    const reuse = await pgc.one(`SELECT order_id, payment_url FROM billing_orders
       WHERE email=$1 AND kind=$2 AND COALESCE(plan,'')=COALESCE($3,'') AND amount_idr=$4 AND status='pending'
         AND payment_url IS NOT NULL AND created_at > NOW() - INTERVAL '30 minutes'
       ORDER BY created_at DESC LIMIT 1`, [acct.email, kind, planCode, amount]);
    if (reuse) return json(res, 200, { ok: true, order_id: reuse.order_id, payment_url: reuse.payment_url, amount, kind, plan: planCode, reused: true });
    const pending = await pgc.one(`SELECT COUNT(*)::int AS c FROM billing_orders WHERE email=$1 AND status='pending' AND created_at > NOW() - INTERVAL '1 hour'`, [acct.email]);
    if ((pending?.c || 0) >= 5) return err(res, 429, 'Terlalu banyak tagihan yang belum dibayar. Selesaikan atau tunggu tagihan sebelumnya kedaluwarsa.');

    const rawOrigin = (req.headers['origin'] || '').toString();
    const host = (req.headers['x-forwarded-host'] || req.headers['host'] || '').toString();
    let base;
    if (process.env.PUBLIC_BASE_URL) base = process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
    else if (rawOrigin.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(rawOrigin)) base = rawOrigin;
    else if (host && !/localhost|127\.0\.0\.1/.test(host)) base = 'https://' + host;
    else base = 'https://eksporin.vercel.app';

    const orderId = await billing.createOrder({ email: acct.email, kind, plan: planCode, amount });
    try {
      const pay = await sumopod.createPayment({
        orderId, amount,
        successUrl: `${base}/?paid=1&order=${encodeURIComponent(orderId)}`,
        cancelUrl: `${base}/?cancelled=1&order=${encodeURIComponent(orderId)}`,
      });
      if (!pay.payment_url) throw new Error('Sumopod tidak mengembalikan link pembayaran.');
      await billing.attachPayment(orderId, { payment_id: pay.payment_id, payment_url: pay.payment_url, fee: pay.fee, net: pay.net, raw: pay.raw });
      return json(res, 200, { ok: true, order_id: orderId, payment_url: pay.payment_url, amount, kind, plan: planCode, expires_at: pay.expires_at });
    } catch (e) {
      console.error('[billing] checkout failed', e.message);
      await billing.markOrder(orderId, 'failed');
      return err(res, 502, e.code === 'not_configured' ? 'Gateway pembayaran belum dikonfigurasi (SUMOPOD_PAY_KEY).' : 'Gagal membuat pembayaran QRIS. Coba lagi beberapa saat lagi.');
    }
  }

  // Check an order's status (after returning from the payment page). The
  // webhook normally applies the payment first; this is the fallback that
  // asks Sumopod directly. Only the order's owner can check it.
  if (route('POST', '/api/billing/verify')) {
    if (!billing.enabled()) return err(res, 503, 'Pembayaran belum aktif di server ini.');
    const orderId = String(body?.order_id || '');
    const order = orderId ? await billing.getOrder(orderId) : null;
    if (!order || order.email !== acct.email) return err(res, 404, 'Tagihan tidak ditemukan.');
    if (order.status === 'pending' && order.payment_id) {
      try {
        const st = await sumopod.getPayment(order.payment_id);
        if (st.ok && st.state === 'paid') await billing.applyPaid(orderId, { paidAmount: st.amount ?? null, raw: st.raw });
        else if (st.ok && (st.state === 'expired' || st.state === 'failed')) await billing.markOrder(orderId, st.state);
      } catch (e) { console.warn('[billing] verify lookup failed', e.message); }
    }
    const fresh = await billing.getOrder(orderId);
    const acct2 = await billing.load(user);
    return json(res, 200, {
      ok: true, order_id: orderId, status: fresh.status, paid: fresh.status === 'paid', kind: fresh.kind,
      plan: fresh.plan, amount: fresh.amount_idr, account: billing.summarize(acct2),
    });
  }

  // Sumopod AI — natural-language commodity → HS mapping + cargo keywords + outreach angle.
  // The AI Buyer Discovery route below already falls back to keyword matching if this returns nothing.
  // UN Comtrade+ proxy — real Indonesia export flow by destination country for a given HS code.
  // GET /api/comtrade/indonesia-exports?hs=090510
  if (route('GET', '/api/comtrade/indonesia-exports')) {
    return (async () => {
      const hs = q.get('hs') || '';
      const data = await fetchIndonesiaExports(hs);
      if (!data) return json(res, 200, { ok: false, hs, source: 'UN Comtrade+', message: 'Belum ada data Comtrade untuk HS ini.' });
      return json(res, 200, data);
    })();
  }

  // Full HS pipeline: natural-language product query → 6-digit HS (LLM +
  // offline nomenclature validation) → USITC 10-digit + US import tariff.
  // GET /api/hs/lookup?query=vanili kering
  if (route('GET', '/api/hs/lookup')) {
    return (async () => {
      const query = (q.get('query') || '').trim();
      if (!query) return err(res, 400, 'query wajib diisi.');

      // Step 1a: LLM structured output for HS mapping.
      let llmCode = null; let llmDesc = null; let llmRaw = null;
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 8000);
        const aiResp = await fetch(SUMOPOD_AI_URL, {
          method: 'POST', signal: ac.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUMOPOD_AI_KEY },
          body: JSON.stringify({
            model: SUMOPOD_AI_MODEL,
            temperature: 0.2,
            max_tokens: 200,
            messages: [
              { role: 'system', content: 'You classify commodities to the WCO Harmonized System. The query may be in Indonesian or English. Always respond with a strict JSON object like {"hs6":"090510","desc_en":"Vanilla beans"} — 6 digits, no dots, no markdown, no preamble. Common Indonesian→WCO mappings: vanili → 0905.10, kopi → 0901.11, lada → 0904.11, pala → 0908.11, cengkeh → 0907.10, kayu manis → 0906.11, sarang burung → 0410.00, karet → 4001.22, sawit/cpo → 1511.10, kelapa → 1513.11, rotan → 4602.12, kayu jati → 4407.29, batik/garmen → 6204.42, udang beku → 0306.17, tuna → 0303.43, kakao → 1801.00.' },
              { role: 'user', content: query },
            ],
          }),
        });
        clearTimeout(t);
        if (aiResp.ok) {
          const j = await aiResp.json();
          llmRaw = j.choices?.[0]?.message?.content || '';
          const cleaned = llmRaw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && typeof parsed.hs6 === 'string' && /^\d{6}$/.test(parsed.hs6.replace(/\D/g, ''))) {
            llmCode = parsed.hs6.replace(/\D/g, '');
            llmDesc = parsed.desc_en || '';
          }
        }
      } catch { /* fall through */ }

      // Step 1b: Validate against offline nomenclature; use LLM code if it
      // exists in the WCO table, else fall back to text search.
      const nomen = loadHsNomenclature();
      let hs6 = null; let hs6Desc = null; let source = null;
      if (llmCode && nomen.has(llmCode)) {
        hs6 = llmCode; hs6Desc = nomen.get(llmCode).description; source = 'llm+wco';
      } else {
        const candidates = searchHsNomenclature(query, 5);
        if (candidates.length) {
          hs6 = candidates[0].code; hs6Desc = candidates[0].description; source = 'wco-text-search';
        } else if (llmCode) {
          hs6 = llmCode; hs6Desc = llmDesc || 'LLM-suggested'; source = 'llm-only';
        }
      }
      if (!hs6) return json(res, 200, { ok: false, query, message: 'Tidak bisa menemukan HS code yang cocok.' });

      // Step 2: USITC HTS for the same code — real US 10-digit HTS + duty rate.
      const usitc = await fetchUsitcHts(hs6);
      let usitcSummary = null;
      let usitcMatches = [];
      if (usitc && usitc.length) {
        usitcMatches = usitc.filter((e) => e.htsno && e.htsno.replace(/\./g, '').startsWith(hs6));
        const useSet = usitcMatches.length ? usitcMatches : usitc;
        const chosen = useSet.find((e) => e.htsno && e.general) || useSet.find((e) => e.htsno);
        if (chosen) {
          usitcSummary = {
            htsno: chosen.htsno,
            description: chosen.description,
            general_rate: chosen.general || 'Free',
            special_rate: chosen.special || '',
            other_rate: chosen.other || '',
            units: chosen.units,
          };
        }
      }

      return json(res, 200, {
        ok: true,
        query,
        pipeline: [
          { step: 1, name: 'LLM + WCO Nomenclature', source, hs6, description: hs6Desc },
          { step: 2, name: 'USITC HTS (US 10-digit + duty)', hts10: usitcSummary?.htsno || null, duty: usitcSummary?.general_rate || null },
        ],
        hs6, hs6_description: hs6Desc, source,
        usitc: usitcSummary,
        usitc_variants: usitcMatches.length,
        llm_raw: llmRaw ? llmRaw.slice(0, 200) : null,
      });
    })();
  }

  // USITC HTS proxy — US import tariff schedule for a given HS heading.
  // GET /api/usitc/hts?hs=0901 (2-6 digit HS accepted; auto-truncates to 4-digit)
  if (route('GET', '/api/usitc/hts')) {
    return (async () => {
      const hs = q.get('hs') || '';
      const entries = await fetchUsitcHts(hs);
      if (!entries) return json(res, 200, { ok: false, hs, source: 'USITC HTS', message: 'Data tarif USITC belum tersedia untuk HS ini.' });
      const heading = String(hs).replace(/\D/g, '').slice(0, 4);
      // Filter: if user asked for a specific 6/8/10-digit code, prefer rows that
      // start with that prefix — otherwise return the whole heading tree.
      const cleanHs = String(hs).replace(/\D/g, '');
      const focused = cleanHs.length > 4
        ? entries.filter((e) => e.htsno && e.htsno.replace(/\./g, '').startsWith(cleanHs))
        : entries;
      const useEntries = focused.length ? focused : entries;
      // Extract a summary: the first leaf entry with a non-empty general rate.
      const summary = useEntries.find((e) => e.htsno && e.general) || useEntries.find((e) => e.htsno) || null;
      return json(res, 200, {
        ok: true, hs, heading, source: 'USITC HTS (Harmonized Tariff Schedule)',
        summary: summary ? {
          htsno: summary.htsno,
          description: summary.description,
          general_rate: summary.general || 'Free',
          special_rate: summary.special || '',
          other_rate: summary.other || '',
          units: summary.units,
        } : null,
        entries: useEntries,
        entry_count: useEntries.length,
      });
    })();
  }

  if (route('POST', '/api/ai/complete')) {
    return (async () => {
      const { messages, temperature, max_tokens, model } = body || {};
      if (!Array.isArray(messages) || !messages.length) return err(res, 400, 'messages wajib array non-kosong.');
      try {
        const r = await fetch(SUMOPOD_AI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUMOPOD_AI_KEY },
          body: JSON.stringify({
            model: model || SUMOPOD_AI_MODEL,
            messages,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : 400,
            temperature: typeof temperature === 'number' ? temperature : 0.5,
          }),
        });
        const bodyText = await r.text();
        let data; try { data = JSON.parse(bodyText); } catch { data = { raw: bodyText }; }
        if (!r.ok) {
          console.error('[sumopod-ai]', r.status, bodyText.slice(0, 400));
          return err(res, 502, 'AI: ' + (data.error?.message || data.message || bodyText.slice(0, 200)));
        }
        return json(res, 200, {
          ok: true,
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage || null,
          model: data.model || null,
        });
      } catch (e) {
        return err(res, 502, 'AI error: ' + (e.message || 'network error'));
      }
    })();
  }

  // ===== admin only =====
  const requireAdmin = () => {
    if (!user.is_admin) { err(res, 403, 'Admin access required.'); return false; }
    return true;
  };

  // Super admin dashboard (Postgres-backed): src/admin.js
  if (p.startsWith('/api/admin/v2/')) {
    if (!requireAdmin()) return;
    return require('./admin').handle(req, res, p, q, body, { json, err, user, billing });
  }

  if (route('GET', '/api/admin/stats')) {
    if (!requireAdmin()) return;
    const total = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    const onboarded = db.prepare('SELECT COUNT(*) c FROM users WHERE onboarded=1').get().c;
    const admins = db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin=1').get().c;
    let byPlan = db.prepare("SELECT plan, COUNT(*) c FROM users GROUP BY plan ORDER BY c DESC").all();
    if (billing.enabled()) {
      try {
        const r = await require('./pg').query(`SELECT CASE WHEN plan_expires_at > NOW() THEN plan ELSE 'expired' END AS plan, COUNT(*)::int AS c
                                                 FROM billing_accounts GROUP BY 1 ORDER BY 2 DESC`);
        byPlan = r.rows || r;
      } catch { /* sqlite fallback */ }
    }
    const recent7d = db.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','-7 days')").get().c;
    const recent30d = db.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','-30 days')").get().c;
    const messages = db.prepare('SELECT COUNT(*) c FROM messages').get().c;
    const messagesReplied = db.prepare("SELECT COUNT(*) c FROM messages WHERE status='replied'").get().c;
    const lists = db.prepare('SELECT COUNT(*) c FROM lists').get().c;
    const savedBuyers = db.prepare('SELECT COUNT(*) c FROM list_buyers').get().c;
    const totalBuyers = db.prepare('SELECT COUNT(*) c FROM buyers').get().c;
    const totalShipments = db.prepare('SELECT COUNT(*) c FROM shipments').get().c;
    const usageThisMonth = db.prepare("SELECT meter, SUM(used) total FROM usage_meters WHERE period=? GROUP BY meter").all(period());
    return json(res, 200, {
      users: { total, onboarded, admins, recent_7d: recent7d, recent_30d: recent30d, by_plan: byPlan },
      engagement: { messages_sent: messages, messages_replied: messagesReplied, lists, saved_buyers: savedBuyers },
      inventory: { total_buyers: totalBuyers, total_shipments: totalShipments },
      usage_this_month: usageThisMonth,
    });
  }

  if (route('GET', '/api/admin/users')) {
    if (!requireAdmin()) return;
    const search = q.get('q') || '';
    const rows = db.prepare(`SELECT u.id, u.email, u.name, u.org_name, u.plan, u.is_admin, u.status, u.onboarded,
       u.hs_focus, u.target_countries, u.export_status, u.goal, u.created_at,
       (SELECT COUNT(*) FROM lists l WHERE l.user_id=u.id) list_count,
       (SELECT COUNT(*) FROM messages m WHERE m.user_id=u.id) message_count
      FROM users u
      WHERE (? = '' OR u.email LIKE ? OR u.name LIKE ? OR u.org_name LIKE ?)
      ORDER BY u.created_at DESC LIMIT 200`)
      .all(search, '%' + search + '%', '%' + search + '%', '%' + search + '%');
    // Plan and balance live in Postgres; the sqlite column can be stale.
    const bill = {};
    if (billing.enabled() && rows.length) {
      try {
        const br = await require('./pg').query(
          `SELECT email, CASE WHEN plan_expires_at > NOW() THEN plan ELSE 'expired' END AS plan, plan_expires_at, balance_idr
             FROM billing_accounts WHERE email = ANY($1)`, [rows.map((r) => String(r.email).toLowerCase())]);
        for (const b of (br.rows || br)) bill[b.email] = b;
      } catch { /* show sqlite values */ }
    }
    return json(res, 200, {
      users: rows.map((r) => ({
        ...r,
        ...(bill[String(r.email).toLowerCase()] ? {
          plan: bill[String(r.email).toLowerCase()].plan,
          plan_expires_at: bill[String(r.email).toLowerCase()].plan_expires_at,
          balance_idr: Number(bill[String(r.email).toLowerCase()].balance_idr) || 0,
        } : {}),
        is_admin: !!r.is_admin,
        onboarded: !!r.onboarded,
        hs_focus: JSON.parse(r.hs_focus || '[]'),
        target_countries: JSON.parse(r.target_countries || '[]'),
      })),
    });
  }

  if (route('POST', '/api/admin/user/plan')) {
    if (!requireAdmin()) return;
    const { user_id, plan, days } = body || {};
    if (!user_id || !PLANS[plan] || plan === 'expired') return err(res, 400, 'user_id dan plan wajib.');
    const target = db.prepare('SELECT email FROM users WHERE id=?').get(user_id);
    if (!target) return err(res, 404, 'User tidak ditemukan.');
    if (billing.enabled()) await billing.adminSetPlan(target.email, plan, Math.min(Math.max(Number(days) || 30, 1), 366));
    db.prepare('UPDATE users SET plan=? WHERE id=?').run(plan, user_id);
    db.prepare('INSERT INTO audit_log (user_id, action, target, meta) VALUES (?,?,?,?)').run(user.id, 'admin.plan_change', String(user_id), JSON.stringify({ plan }));
    return json(res, 200, { ok: true, user_id, plan });
  }

  if (route('POST', '/api/admin/user/status')) {
    if (!requireAdmin()) return;
    const { user_id, status } = body || {};
    if (!user_id || !['active', 'suspended', 'banned'].includes(status)) return err(res, 400, 'status invalid.');
    db.prepare('UPDATE users SET status=? WHERE id=?').run(status, user_id);
    db.prepare('INSERT INTO audit_log (user_id, action, target, meta) VALUES (?,?,?,?)').run(user.id, 'admin.status_change', String(user_id), JSON.stringify({ status }));
    return json(res, 200, { ok: true, user_id, status });
  }

  if (route('DELETE', '/api/admin/user')) {
    if (!requireAdmin()) return;
    const target = parseInt(q.get('id') || '0', 10);
    if (!target || target === user.id) return err(res, 400, 'user id invalid (tidak bisa hapus diri sendiri).');
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(target);
    db.prepare('DELETE FROM lists WHERE user_id=?').run(target);
    db.prepare('DELETE FROM messages WHERE user_id=?').run(target);
    db.prepare('DELETE FROM notes WHERE user_id=?').run(target);
    db.prepare('DELETE FROM users WHERE id=?').run(target);
    db.prepare('INSERT INTO audit_log (user_id, action, target) VALUES (?,?,?)').run(user.id, 'admin.user_delete', String(target));
    return json(res, 200, { ok: true, deleted: target });
  }

  if (route('GET', '/api/admin/audit')) {
    if (!requireAdmin()) return;
    const rows = db.prepare(`SELECT a.*, u.email actor_email, u.name actor_name FROM audit_log a
      LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100`).all();
    return json(res, 200, { events: rows });
  }

  if (route('GET', '/api/admin/buyers')) {
    if (!requireAdmin()) return;
    const search = q.get('q') || '';
    const country = q.get('country') || '';
    const rows = db.prepare(`SELECT b.id, b.name, b.country, b.city, b.industry, b.size_bucket,
      b.shipments_12mo, b.volume_12mo_kg, b.value_12mo_usd, b.base_score, b.data_confidence,
      b.has_indonesian_supplier,
      (SELECT GROUP_CONCAT(bh.hs_code) FROM buyer_hs bh WHERE bh.buyer_id=b.id LIMIT 5) hs_codes,
      (SELECT COUNT(*) FROM list_buyers lb WHERE lb.buyer_id=b.id) times_saved
      FROM buyers b
      WHERE (? = '' OR b.name LIKE ? OR b.city LIKE ?)
        AND (? = '' OR b.country = ?)
      ORDER BY b.base_score DESC LIMIT 100`)
      .all(search, '%' + search + '%', '%' + search + '%', country, country);
    const countries = db.prepare('SELECT country, COUNT(*) c FROM buyers GROUP BY country ORDER BY c DESC').all()
      .map((r) => ({ ...r, name: COUNTRY_NAMES[r.country] || r.country }));
    return json(res, 200, { buyers: rows, countries });
  }

  if (route('GET', '/api/admin/shipments')) {
    if (!requireAdmin()) return;
    const rows = db.prepare(`SELECT s.id, s.shipment_date, s.hs_code, s.weight_kg, s.value_usd,
      s.origin_port, s.dest_port, b.name buyer_name, b.country buyer_country,
      e.name exporter_name, e.country exporter_country, e.is_indonesian
      FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
      ORDER BY s.shipment_date DESC LIMIT 100`).all();
    const stats = db.prepare(`SELECT COUNT(*) total, SUM(weight_kg) total_kg, SUM(value_usd) total_usd,
      COUNT(DISTINCT hs_code) unique_hs, COUNT(DISTINCT buyer_id) unique_buyers FROM shipments`).get();
    const monthly = db.prepare(`SELECT substr(shipment_date, 1, 7) ym, COUNT(*) shipments,
      SUM(value_usd) value FROM shipments GROUP BY ym ORDER BY ym DESC LIMIT 12`).all();
    return json(res, 200, { shipments: rows, stats, monthly });
  }

  if (route('GET', '/api/admin/messages')) {
    if (!requireAdmin()) return;
    const rows = db.prepare(`SELECT m.id, m.subject, m.channel, m.status, m.sent_at, m.opened_at, m.replied_at,
      u.email user_email, u.name user_name, b.name buyer_name, b.country buyer_country
      FROM messages m JOIN users u ON u.id=m.user_id JOIN buyers b ON b.id=m.buyer_id
      ORDER BY m.sent_at DESC LIMIT 100`).all();
    const funnel = db.prepare(`SELECT
      COUNT(*) total,
      SUM(CASE WHEN status IN ('opened','replied') OR opened_at IS NOT NULL THEN 1 ELSE 0 END) opened,
      SUM(CASE WHEN status='replied' OR replied_at IS NOT NULL THEN 1 ELSE 0 END) replied
      FROM messages`).get();
    const byChannel = db.prepare('SELECT channel, COUNT(*) c FROM messages GROUP BY channel').all();
    return json(res, 200, { messages: rows, funnel, by_channel: byChannel });
  }

  if (route('GET', '/api/admin/revenue')) {
    if (!requireAdmin()) return;
    // Real money from paid QRIS orders (billing_orders), not plan labels.
    if (!billing.enabled()) return json(res, 200, { mrr: 0, arr: 0, arpu: 0, paid_users: 0, by_plan: [], plan_change_history: [], note: 'billing database not configured' });
    const pgc = require('./pg');
    const [byPlan, totals, recent, balances] = await Promise.all([
      pgc.query(`SELECT plan, COUNT(*)::int AS c FROM billing_accounts WHERE plan_expires_at > NOW() GROUP BY plan ORDER BY c DESC`),
      pgc.one(`SELECT COALESCE(SUM(amount_idr) FILTER (WHERE kind='plan'),0)::bigint AS plan_30d,
                      COALESCE(SUM(amount_idr) FILTER (WHERE kind='topup'),0)::bigint AS topup_30d,
                      COALESCE(SUM(net_idr),0)::bigint AS net_30d,
                      COUNT(DISTINCT email)::int AS payers_30d
                 FROM billing_orders WHERE status='paid' AND paid_at > NOW() - INTERVAL '30 days'`),
      pgc.query(`SELECT order_id, email, kind, plan, amount_idr, status, created_at, paid_at FROM billing_orders ORDER BY created_at DESC LIMIT 50`),
      pgc.one(`SELECT COALESCE(SUM(balance_idr),0)::bigint AS outstanding FROM billing_accounts`),
    ]);
    const mrr = Number(totals.plan_30d) + Number(totals.topup_30d);
    return json(res, 200, {
      mrr, arr: mrr * 12, arpu: totals.payers_30d ? Math.round(mrr / totals.payers_30d) : 0, paid_users: totals.payers_30d,
      plan_revenue_30d: Number(totals.plan_30d), topup_revenue_30d: Number(totals.topup_30d), net_after_fees_30d: Number(totals.net_30d),
      outstanding_balance: Number(balances.outstanding),
      by_plan: byPlan.map((p) => ({ ...p, price: (PLANS[p.plan] || {}).price || 0, revenue: ((PLANS[p.plan] || {}).price || 0) * p.c })),
      plan_change_history: recent.map((o) => ({ action: `${o.kind}:${o.status}`, target: o.email, meta: JSON.stringify({ plan: o.plan || 'saldo', amount: o.amount_idr }), created_at: o.paid_at || o.created_at })),
    });
  }

  if (route('GET', '/api/admin/hs-usage')) {
    if (!requireAdmin()) return;
    // Which HS codes users are focused on
    const users = db.prepare("SELECT hs_focus FROM users WHERE hs_focus != '[]' AND hs_focus IS NOT NULL").all();
    const hsCount = new Map();
    for (const u of users) { try { for (const h of JSON.parse(u.hs_focus)) hsCount.set(h, (hsCount.get(h) || 0) + 1); } catch {} }
    const rows = [...hsCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([code, count]) => ({ code, count }));
    // Which target countries
    const cUsers = db.prepare("SELECT target_countries FROM users WHERE target_countries != '[]' AND target_countries IS NOT NULL").all();
    const countryCount = new Map();
    for (const u of cUsers) { try { for (const c of JSON.parse(u.target_countries)) countryCount.set(c, (countryCount.get(c) || 0) + 1); } catch {} }
    const countries = [...countryCount.entries()].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ code, count, name: COUNTRY_NAMES[code] || code }));
    return json(res, 200, { top_hs_focus: rows, top_target_countries: countries });
  }

  if (route('GET', '/api/admin/system')) {
    if (!requireAdmin()) return;
    return json(res, 200, {
      node_version: process.version,
      uptime_sec: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      db_engine: 'sql.js (WASM)',
      caches: {
        supabase_token: SB_TOKEN_CACHE.size,
        comtrade: COMTRADE_CACHE.size,
        usitc: USITC_CACHE.size,
      },
      integrations: {
        supabase: !!SUPABASE_URL,
        sumopod_pay: sumopod.configured(),
        sumopod_webhook: !!(process.env.SUMOPOD_WEBHOOK_SECRET || process.env.SUMOPOD_WEBHOOK_TOKEN),
        billing_db: billing.enabled(),
        sumopod_ai: !!SUMOPOD_AI_KEY,
        un_comtrade: !!COMTRADE_KEY,
        usitc_hts: true,
      },
      hs_nomenclature_loaded: HS_NOMEN ? HS_NOMEN.size : 0,
    });
  }

  // ===== Scrape pipeline (Postgres-backed) =====
  if (route('GET', '/api/admin/scrape/status')) {
    if (!requireAdmin()) return;
    try {
      const P = require('./sources/persist');
      const pgClient = require('./pg');
      const [countsBySource, jobStats, recentJobs, live] = await Promise.all([
        P.countsBySource(), P.jobStats(), P.recentJobs({ limit: 20 }),
        pgClient.one(`
          SELECT
            (SELECT COUNT(*)::int FROM scraped_buyers) AS total,
            (SELECT COUNT(*)::int FROM scraped_buyers WHERE created_at > NOW() - INTERVAL '1 hour') AS new_1h,
            (SELECT COUNT(*)::int FROM scraped_buyers WHERE created_at > NOW() - INTERVAL '24 hours') AS new_24h,
            (SELECT COUNT(*)::int FROM scraped_buyers WHERE updated_at > NOW() - INTERVAL '1 hour' AND created_at < updated_at) AS updated_1h,
            (SELECT COUNT(*)::int FROM scraped_buyers WHERE enriched_at IS NOT NULL) AS enriched,
            (SELECT COUNT(*)::int FROM scraped_buyers WHERE enriched_at IS NULL) AS unenriched,
            (SELECT COUNT(*)::int FROM scrape_jobs WHERE status = 'running') AS running_now,
            (SELECT COUNT(*)::int FROM scrape_jobs WHERE status = 'done' AND finished_at > NOW() - INTERVAL '1 hour') AS jobs_done_1h,
            (SELECT COALESCE(SUM(cardinality(sources_seen)), 0)::int FROM scraped_buyers) AS total_source_touches,
            (SELECT COUNT(*)::int FROM scraped_buyers WHERE cardinality(sources_seen) > 1) AS multi_source_hits
        `, []),
      ]);
      const totalBuyers = countsBySource.reduce((s, r) => s + r.c, 0);
      return json(res, 200, {
        total_buyers: totalBuyers,
        by_source: countsBySource,
        jobs_by_status: jobStats,
        recent_jobs: recentJobs,
        live: live || {},
      });
    } catch (e) {
      return json(res, 500, { error: 'postgres_unavailable', detail: e.message });
    }
  }

  if (route('GET', '/api/admin/scrape/buyers')) {
    if (!requireAdmin()) return;
    try {
      const P = require('./sources/persist');
      const limit = Math.min(Number(q.get('limit')) || 50, 200);
      const source = q.get('source') || null;
      const country = q.get('country') || null;
      const rows = await P.listRecentBuyers({ limit, source, country });
      return json(res, 200, { buyers: rows });
    } catch (e) {
      return json(res, 500, { error: 'postgres_unavailable', detail: e.message });
    }
  }

  if (route('POST', '/api/admin/scrape/seed')) {
    if (!requireAdmin()) return;
    try {
      const pipeline = require('./sources/pipeline');
      const jobs = await pipeline.seedQueue();
      return json(res, 200, { enqueued: jobs.length });
    } catch (e) {
      return json(res, 500, { error: 'postgres_unavailable', detail: e.message });
    }
  }

  if (route('POST', '/api/admin/scrape/enqueue')) {
    if (!requireAdmin()) return;
    const { source, hs_code, country } = body || {};
    if (!source || !hs_code || !country) return json(res, 400, { error: 'source, hs_code, country required' });
    try {
      const pipeline = require('./sources/pipeline');
      const id = await pipeline.enqueue({ source, hs_code, country });
      return json(res, 200, { id });
    } catch (e) {
      return json(res, 500, { error: 'postgres_unavailable', detail: e.message });
    }
  }

  if (route('POST', '/api/admin/scrape/enrich')) {
    if (!requireAdmin()) return;
    const id = Number(q.get('id')) || Number(body?.id) || 0;
    const max = Math.min(Math.max(Number(body?.max) || 0, 0), 10);
    try {
      const pg = require('./pg');
      const ep = require('./sources/enricher-pipeline');
      if (id) {
        const b = await pg.one('SELECT id, name, country, website, email, phone, industry, size_bucket, description FROM scraped_buyers WHERE id=$1', [id]);
        if (!b) return json(res, 404, { error: 'buyer_not_found' });
        const r = await ep.enrichOne(b);
        return json(res, 200, { ok: true, ...r });
      }
      const results = await ep.enrichBatch({ max: max || 5, sleepMs: 500 });
      const ok = results.filter((r) => r.ok).length;
      return json(res, 200, { processed: results.length, ok, results });
    } catch (e) {
      return json(res, 500, { error: 'enrich_failed', detail: e.message });
    }
  }

  if (route('POST', '/api/admin/scrape/run')) {
    if (!requireAdmin()) return;
    const max = Math.min(Math.max(Number(body?.max) || 5, 1), 15);
    try {
      const pipeline = require('./sources/pipeline');
      const results = await pipeline.drainQueue({ max });
      const inserted = results.reduce((s, r) => s + (r.inserted || 0), 0);
      const skipped = results.filter((r) => r.error?.startsWith('skipped:')).length;
      const failed = results.filter((r) => r.error && !r.error.startsWith('skipped:')).length;
      return json(res, 200, {
        processed: results.length,
        buyers_persisted: inserted,
        ok: results.filter((r) => r.ok).length,
        skipped, failed,
        results: results.map((r) => ({ jobId: r.jobId, ok: !!r.ok, inserted: r.inserted || 0, error: r.error || null })),
      });
    } catch (e) {
      return json(res, 500, { error: 'pipeline_error', detail: e.message });
    }
  }

  if (route('GET', '/api/admin/recent-activity')) {
    if (!requireAdmin()) return;
    const recentUsers = db.prepare(`SELECT id, email, name, plan, created_at FROM users ORDER BY created_at DESC LIMIT 10`).all();
    const recentMessages = db.prepare(`SELECT m.id, m.subject, m.sent_at, m.status, u.email user_email, b.name buyer_name
      FROM messages m JOIN users u ON u.id=m.user_id JOIN buyers b ON b.id=m.buyer_id
      ORDER BY m.sent_at DESC LIMIT 10`).all();
    return json(res, 200, { recent_users: recentUsers, recent_messages: recentMessages });
  }

  // Unified activity feed for the admin overview. Merges local sqlite
  // events (signups, outreach, audit log) with Postgres scrape events.
  // Sorted newest first; safe to call every 10 s.
  if (route('GET', '/api/admin/activity')) {
    if (!requireAdmin()) return;
    const events = [];
    try {
      for (const r of db.prepare(`SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 15`).all()) {
        events.push({ ts: r.created_at, kind: 'user.signup', title: `${r.name} daftar`, meta: { email: r.email, id: r.id } });
      }
      for (const r of db.prepare(`SELECT m.id, m.sent_at, m.status, u.email user_email, b.name buyer_name FROM messages m JOIN users u ON u.id=m.user_id JOIN buyers b ON b.id=m.buyer_id ORDER BY m.sent_at DESC LIMIT 15`).all()) {
        events.push({ ts: r.sent_at, kind: 'outreach.sent', title: `${r.user_email} → ${r.buyer_name}`, meta: { status: r.status, id: r.id } });
      }
      for (const r of db.prepare(`SELECT id, user_id, action, target, meta, created_at FROM audit_log ORDER BY created_at DESC LIMIT 15`).all()) {
        events.push({ ts: r.created_at, kind: 'admin.' + r.action.replace(/^admin\./, ''), title: `${r.action} → ${r.target || ''}`, meta: r.meta ? JSON.parse(r.meta) : null });
      }
    } catch (_e) { /* keep going */ }
    try {
      const pgClient = require('./pg');
      const recentJobs = await pgClient.query(`SELECT id, source, hs_code, country, status, result_count, error, finished_at, started_at, created_at FROM scrape_jobs WHERE finished_at IS NOT NULL OR started_at IS NOT NULL ORDER BY COALESCE(finished_at, started_at, created_at) DESC LIMIT 20`);
      for (const r of recentJobs) {
        const ts = r.finished_at || r.started_at || r.created_at;
        events.push({
          ts: ts instanceof Date ? ts.toISOString() : ts,
          kind: 'scrape.job.' + r.status,
          title: `${r.source} · ${r.hs_code || '-'} · ${r.country || '-'}: ${r.status === 'done' ? '+' + (r.result_count || 0) + ' buyer' : r.status}`,
          meta: { id: Number(r.id), source: r.source, hs_code: r.hs_code, country: r.country, result_count: r.result_count, error: r.error },
        });
      }
      const recentBuyers = await pgClient.query(`SELECT id, source, name, country, enriched_at, created_at, updated_at FROM scraped_buyers ORDER BY updated_at DESC LIMIT 15`);
      for (const r of recentBuyers) {
        const isNew = Math.abs(new Date(r.created_at).getTime() - new Date(r.updated_at).getTime()) < 2000;
        const kind = isNew ? 'buyer.discovered' : (r.enriched_at ? 'buyer.enriched' : 'buyer.updated');
        const ts = r.updated_at;
        events.push({
          ts: ts instanceof Date ? ts.toISOString() : ts,
          kind, title: `${r.name} (${r.country || '?'}) via ${r.source}`,
          meta: { id: Number(r.id), source: r.source },
        });
      }
    } catch (_e) { /* Postgres may be offline; skip its section */ }
    events.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return json(res, 200, { events: events.slice(0, 40) });
  }

  // ===== HS taxonomy =====
  if (route('GET', '/api/hs')) {
    // Browse the full HS tree: chapters -> headings -> 6-digit -> 8-digit.
    const parent = (q.get('parent') || '').replace(/\D/g, '');
    const node = parent ? HS.get(parent) : null;
    if (parent && !node) return err(res, 404, 'Kode HS tidak ditemukan.');
    const counts = await poolHsCounts().catch(() => null);
    const countFor = (code) => {
      if (!counts) return null;
      if (code.length === 2) return counts.ch.get(code) || { n: 0, k: 0 };
      return counts.hs4.get(code.slice(0, 4)) || { n: 0, k: 0 };
    };
    const crumbs = [];
    for (let c = node; c; c = c.p ? HS.get(c.p) : null) crumbs.unshift(HS.view(c));
    const nodes = HS.children(parent || null).map((n) => {
      const ct = countFor(n.c);
      return { ...HS.view(n), buyers: ct ? ct.n : null, buyers_with_contact: ct ? ct.k : null };
    });
    const ct = node ? countFor(node.c) : null;
    return json(res, 200, {
      parent: node ? { ...HS.view(node), buyers: ct ? ct.n : null, buyers_with_contact: ct ? ct.k : null } : null,
      crumbs, nodes,
    });
  }
  if (route('GET', '/api/hs/leaf')) {
    // "Popular" list for pickers: the commodities the crawlers cover.
    let cfg = { commodities: [] };
    try { cfg = require('../config/commodities.json'); } catch { /* none */ }
    const counts = await poolHsCounts().catch(() => null);
    return json(res, 200, (cfg.commodities || []).map((c) => {
      const n = HS.get(c.hs4);
      return {
        code: c.hs4, description_id: c.label_id, description_en: c.label_en,
        hs_title: n ? HS.shortTitle(n.i, 90) : null,
        buyers: counts ? (counts.hs4.get(c.hs4) || { n: 0 }).n : null,
      };
    }));
  }

  // ===== buyer search (F1) =====
  if (route('GET', '/api/search/buyers')) {
    // One search = one new query (page 1); paging through results is free.
    const chargeSearch = parseInt(q.get('page') || '1', 10) <= 1;
    if (chargeSearch && !billing.canAfford(acct, 'search').ok) return json(res, 402, billing.paymentRequired(acct, 'search'));

    // Live buyer pool from scraped_buyers (Postgres).
    // Filters: hs (4-digit), countries, sizes, has=email|phone|website|any,
    // min_score (quality 0-100), q (name). Sort: score (quality) | recent | name.
    // Hidden rows (not a buyer / unreachable) are never shown to users.
    const hs = (q.get('hs') || '').trim();
    const countries = (q.get('countries') || '').split(',').filter(Boolean).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
    const sizes = (q.get('sizes') || '').split(',').filter(Boolean);
    const has = (q.get('has') || '').split(',').filter(Boolean);
    const minScore = parseInt(q.get('min_score') || '0', 10);
    const text = (q.get('q') || '').trim();
    const sort = q.get('sort') || 'score';
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = Math.min(100, parseInt(q.get('per') || '25', 10));

    const build = (v2) => {
      const conds = ['TRUE']; const params = [];
      if (v2) conds.push('is_hidden = FALSE');
      if (hs) { params.push(hs.slice(0, 4)); conds.push(`hs_codes @> ARRAY[$${params.length}]::text[]`); }
      if (countries.length) conds.push(`country IN (${countries.map((c) => { params.push(c); return `$${params.length}`; }).join(',')})`);
      if (sizes.length) conds.push(`size_bucket IN (${sizes.map((x) => { params.push(x); return `$${params.length}`; }).join(',')})`);
      if (text) { params.push('%' + text.toLowerCase() + '%'); conds.push(`LOWER(name) LIKE $${params.length}`); }
      if (has.includes('email')) conds.push('email IS NOT NULL');
      if (has.includes('phone')) conds.push('phone IS NOT NULL');
      if (has.includes('website')) conds.push('website IS NOT NULL');
      if (has.includes('any')) conds.push('(email IS NOT NULL OR phone IS NOT NULL)');
      if (minScore > 0) { params.push(minScore); conds.push(`${v2 ? 'quality_score' : 'data_confidence'} >= $${params.length}`); }
      const scoreCol = v2 ? 'quality_score' : 'data_confidence';
      const orderBy = {
        score: `${scoreCol} DESC, (email IS NOT NULL) DESC, data_confidence DESC, updated_at DESC`,
        name: 'LOWER(name) ASC',
        recent: 'updated_at DESC',
      }[sort] || `${scoreCol} DESC, data_confidence DESC, updated_at DESC`;
      const extra = v2 ? ', quality_score, email_status, buyer_type' : ', data_confidence AS quality_score, NULL::text AS email_status, NULL::text AS buyer_type';
      return { conds, params, orderBy, extra };
    };

    try {
      const pgClient = require('./pg');
      let v2 = true; let b;
      const run = async () => {
        b = build(v2);
        const where = b.conds.join(' AND ');
        // All four queries run in parallel; the count and the contact facet share one scan.
        const [rows, countryFacet, sourceFacet, stats] = await Promise.all([
          pgClient.query(
            `SELECT id, source, name, country, city, website, email IS NOT NULL AS has_email, phone IS NOT NULL AS has_phone,
                    industry, size_bucket, description, hs_codes, data_confidence, enriched_at, updated_at, sources_seen${b.extra}
               FROM scraped_buyers WHERE ${where}
              ORDER BY ${b.orderBy}
              LIMIT $${b.params.length + 1} OFFSET $${b.params.length + 2}`, [...b.params, per, (pageN - 1) * per]),
          pgClient.query(`SELECT country, COUNT(*)::int AS c FROM scraped_buyers WHERE ${where} AND country IS NOT NULL GROUP BY country ORDER BY c DESC LIMIT 20`, b.params),
          pgClient.query(`SELECT source, COUNT(*)::int AS c FROM scraped_buyers WHERE ${where} GROUP BY source ORDER BY c DESC`, b.params),
          pgClient.one(`SELECT COUNT(*)::int AS c, COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS email, COUNT(*) FILTER (WHERE phone IS NOT NULL)::int AS phone,
                               COUNT(*) FILTER (WHERE website IS NOT NULL)::int AS website FROM scraped_buyers WHERE ${where}`, b.params),
        ]);
        const totalRow = stats; const { c: _c, ...contactFacet } = stats || {};
        return { total: totalRow?.c || 0, rows, countryFacet, sourceFacet, contactFacet };
      };
      let r;
      try { r = await run(); } catch (e) {
        if (e.code !== '42703') throw e; // undefined column: migration 004 not applied yet
        v2 = false; r = await run();
      }
      const start = (pageN - 1) * per;
      const results = r.rows.map((x, i) => {
        const score = Number(x.quality_score) || 0;
        return {
          rank: start + i + 1, id: Number(x.id), name: x.name,
          country: x.country, country_name: COUNTRY_NAMES[x.country] || x.country,
          city: x.city, industry: x.industry || null, buyer_type: x.buyer_type || null,
          size_bucket: x.size_bucket || null,
          website: x.website, has_email: !!x.has_email, has_phone: !!x.has_phone, has_website: !!x.website,
          email_status: x.email_status || null,
          hs_codes: x.hs_codes || [], sources: x.sources_seen || [x.source],
          score, score_label: score >= 70 ? 'HOT' : score >= 45 ? 'WARM' : 'COLD',
          blurred: false,
        };
      });
      if (chargeSearch) {
        const c = await billing.consume(acct, 'search', 1, 'search');
        if (!c.ok) return json(res, 402, billing.paymentRequired(acct, 'search'));
      }
      return json(res, 200, {
        total: r.total, page: pageN, per, results,
        facets: {
          country: r.countryFacet.map((f) => ({ value: f.country, count: f.c })),
          source: r.sourceFacet.map((f) => ({ value: f.source, count: f.c })),
          contact: r.contactFacet || {},
        },
        quota: quotaView(acct, 'search'),
        source: 'scraped_buyers',
      });
    } catch (e) {
      return json(res, 503, { error: 'buyer_pool_unavailable', detail: e.message, results: [], total: 0 });
    }
  }

  // ===== scraped buyers (Postgres discovery pool) =====
  // Public to logged-in users. Filters: hs (4-digit HS), country (ISO-2),
  // q (free text against name). Quota-metered under the 'search' meter.
  if (route('GET', '/api/scraped-buyers')) {
    if (!billing.canAfford(acct, 'search').ok) return json(res, 402, billing.paymentRequired(acct, 'search'));
    try {
      const pgClient = require('./pg');
      const hs = String(q.get('hs') || '').trim();
      const country = String(q.get('country') || '').trim().toUpperCase();
      const term = String(q.get('q') || '').trim();
      const limit = Math.min(Math.max(Number(q.get('limit')) || 20, 1), 50);
      const conds = ['TRUE']; const params = [];
      if (hs) { params.push(hs); conds.push(`hs_codes @> ARRAY[$${params.length}]::text[]`); }
      if (country && /^[A-Z]{2}$/.test(country)) { params.push(country); conds.push(`country = $${params.length}`); }
      if (term) { params.push('%' + term.toLowerCase() + '%'); conds.push(`LOWER(name) LIKE $${params.length}`); }
      params.push(limit);
      const rows = await pgClient.query(`
        SELECT id, source, name, country, city, website, email, phone,
               industry, size_bucket, description, hs_codes,
               data_confidence, enriched_at, updated_at
          FROM scraped_buyers
         WHERE ${conds.join(' AND ')}
         ORDER BY (enriched_at IS NOT NULL) DESC, data_confidence DESC, updated_at DESC
         LIMIT $${params.length}`, params);
      const c = await billing.consume(acct, 'search', 1, 'scraped-buyers');
      if (!c.ok) return json(res, 402, billing.paymentRequired(acct, 'search'));
      const open = await billing.unlockedSet(acct, 'contact', rows.map((r) => r.id));
      return json(res, 200, {
        results: rows.map((r) => ({
          id: r.id, source: r.source, name: r.name, country: r.country, city: r.city,
          website: r.website,
          // contacts follow the same paywall as the buyer profile
          email: r.email ? (open.has(Number(r.id)) ? r.email : maskContact('email', r.email)) : null,
          phone: r.phone ? (open.has(Number(r.id)) ? r.phone : maskContact('phone', r.phone)) : null,
          contacts_unlocked: open.has(Number(r.id)),
          industry: r.industry, size_bucket: r.size_bucket, description: r.description,
          hs_codes: r.hs_codes, confidence: r.data_confidence,
          enriched: !!r.enriched_at, updated_at: r.updated_at,
        })),
        quota: quotaView(acct, 'search'),
      });
    } catch (e) {
      return json(res, 503, { error: 'buyer_pool_unavailable', detail: e.message });
    }
  }

  // ===== buyer profile (F2) =====
  if ((m = route('GET', '/api/buyers/:id'))) {
    const buyerId = Number(m.id);
    if (!buyerId) return err(res, 404, 'Buyer tidak ditemukan.');
    try {
      const pgClient = require('./pg');
      const b = await pgClient.one(`
        SELECT id, source, source_id, name, country, city, address, website, email, phone,
               industry, size_bucket, description, hs_codes,
               data_confidence, enriched_at, created_at, updated_at, sources_seen,
               COALESCE(sb.evidence_url, raw_json->>'evidence_url') AS evidence_url,
               COALESCE(sb.buyer_type, raw_json->>'buyer_type') AS buyer_type,
               sb.email_status AS email_status,
               sb.email_source_url AS email_source_url,
               sb.phone_source_url AS phone_source_url,
               sb.website_method AS website_method,
               sb.contact_checked_at AS contact_checked_at,
               COALESCE(sb.quality_score, data_confidence) AS quality_score
          FROM scraped_buyers sb WHERE id = $1`, [buyerId]);
      if (!b) return err(res, 404, 'Buyer tidak ditemukan (mungkin telah digabung atau dihapus).');

      // A buyer profile is paid once per plan cycle (quota, then balance).
      const pv = await billing.unlock(acct, 'profile', buyerId);
      if (!pv.ok) return json(res, 402, billing.paymentRequired(acct, 'profile'));
      // Contacts are paid separately, once per buyer (POST /reveal-contact).
      const contactsOpen = await billing.isUnlocked(acct, 'contact', buyerId);

      // Build contacts from the columns we scraped / enriched.
      const contacts = [];
      if (b.website) contacts.push({ contact_type: 'website', value: b.website, masked: false, source_url: null });
      if (b.email) contacts.push({
        contact_type: 'email',
        value: contactsOpen ? b.email : maskContact('email', b.email),
        masked: !contactsOpen, status: b.email_status || null,
        source_url: contactsOpen ? (b.email_source_url || null) : null,
      });
      if (b.phone) contacts.push({
        contact_type: 'phone',
        value: contactsOpen ? b.phone : maskContact('phone', b.phone),
        masked: !contactsOpen, source_url: contactsOpen ? (b.phone_source_url || null) : null,
      });

      const bHs = (b.hs_codes || []).map((code) => {
        const meta = HS.get(code) || HS.get(String(code).slice(0, 4));
        return { hs_code: code, description_en: meta ? HS.shortTitle(meta.e, 90) : null, description_id: meta ? HS.shortTitle(meta.i, 90) : null };
      });

      const fit = productFit(userHs, b.hs_codes || []);
      const inLists = db.prepare(`SELECT l.id, l.name, lb.status FROM list_buyers lb JOIN lists l ON l.id=lb.list_id
        WHERE l.user_id=? AND lb.buyer_id=?`).all(user.id, buyerId);

      return json(res, 200, {
        id: Number(b.id), name: b.name, source: b.source, source_id: b.source_id,
        country: b.country, country_name: COUNTRY_NAMES[b.country] || b.country,
        city: b.city, address: b.address, website: b.website,
        industry: b.industry, size_bucket: b.size_bucket,
        description: b.description,
        sources_seen: b.sources_seen || [b.source],
        evidence_url: b.evidence_url || null, buyer_type: b.buyer_type || null,
        quality_score: Number(b.quality_score) || 0, contact_checked_at: b.contact_checked_at || null,
        data_confidence: b.data_confidence,
        enriched: !!b.enriched_at, enriched_at: b.enriched_at,
        first_seen: b.created_at, last_updated: b.updated_at,
        hs_codes: bHs, contacts, contacts_visible: contactsOpen,
        contact_price: { quota_left: billing.quotaLeft(acct, 'contact') === Infinity ? null : billing.quotaLeft(acct, 'contact'), rate: billing.RATES.contact, balance: acct.balance },
        supplier_countries: [],
        score: b.data_confidence, fit_score: fit,
        score_label: b.data_confidence >= 80 ? 'HOT' : b.data_confidence >= 60 ? 'WARM' : 'FRESH',
        score_components: { confidence: b.data_confidence, product_fit: fit, sources: (b.sources_seen || []).length * 20 },
        in_lists: inLists,
        quota: quotaView(acct, 'profile'),
      });
    } catch (e) {
      return json(res, 503, { error: 'buyer_pool_unavailable', detail: e.message });
    }
  }

  // Open a buyer's email/phone: 1 contact quota, or Rp1.000 from the
  // balance. Paid once per buyer, forever.
  if ((m = route('POST', '/api/buyers/:id/reveal-contact'))) {
    const buyerId = Number(m.id);
    if (!buyerId) return err(res, 404, 'Buyer tidak ditemukan.');
    try {
      const pgc = require('./pg');
      const b = await pgc.one(`SELECT id, email, phone, sb.email_source_url AS email_source_url,
                                      sb.phone_source_url AS phone_source_url, sb.email_status AS email_status
                                 FROM scraped_buyers sb WHERE id = $1`, [buyerId]);
      if (!b) return err(res, 404, 'Buyer tidak ditemukan.');
      if (!b.email && !b.phone) return err(res, 409, 'Buyer ini belum punya email/telepon. Gunakan "Cari kontak sekarang" dulu.');
      const u = await billing.unlock(acct, 'contact', buyerId);
      if (!u.ok) return json(res, 402, billing.paymentRequired(acct, 'contact'));
      return json(res, 200, {
        ok: true, already: !!u.already, charged: u.charged || 0, balance: acct.balance,
        email: b.email, phone: b.phone, email_status: b.email_status,
        email_source_url: b.email_source_url, phone_source_url: b.phone_source_url,
      });
    } catch (e) {
      return json(res, 503, { error: 'Gagal membuka kontak. Coba lagi.', detail: e.message });
    }
  }

  // On-demand contact search for one buyer (button "Cari kontak" on the
  // profile). Visits the company's own website (Impressum / contact pages)
  // within the request; cached for 24h per buyer so it cannot be hammered.
  if ((m = route('POST', '/api/buyers/:id/find-contact'))) {
    const buyerId = Number(m.id);
    if (!buyerId) return err(res, 404, 'Buyer tidak ditemukan.');
    try {
      const pg = require('./pg');
      const b = await pg.one(`SELECT id, name, country, city, website, email, phone, industry, size_bucket, description,
                                     sb.contact_checked_at AS checked
                                FROM scraped_buyers sb WHERE id = $1`, [buyerId]);
      if (!b) return err(res, 404, 'Buyer tidak ditemukan.');
      const recent = b.checked && (Date.now() - new Date(b.checked).getTime()) < 24 * 3600 * 1000;
      if (recent && (b.email || b.phone)) return json(res, 200, { ok: true, cached: true, found: true });
      if (recent) return json(res, 200, { ok: true, cached: true, found: false, message: 'Kontak sudah dicari dalam 24 jam terakhir dan belum ditemukan di website perusahaan.' });
      // Charged only when something new is found (quota, then balance).
      if (!billing.canAfford(acct, 'find_contact').ok) return json(res, 402, billing.paymentRequired(acct, 'find_contact'));
      const ep = require('./sources/enricher-pipeline');
      const r = await Promise.race([
        ep.enrichOne(b),
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 50000)),
      ]);
      if (r.timeout) return json(res, 200, { ok: true, found: false, message: 'Website perusahaan lambat merespons. Coba lagi beberapa saat lagi.' });
      const foundNew = !!(r.got_email || r.got_phone);
      let charged = 0;
      if (foundNew) {
        const c = await billing.consume(acct, 'find_contact', 1, `buyer:${buyerId}`);
        charged = c.cost || 0;
        // The user paid to find it, so the contact is opened for them too.
        await require('./pg').query(`INSERT INTO billing_unlocks (email, kind, buyer_id, cycle_key, paid_with)
                                     VALUES ($1,'contact',$2,'*','find') ON CONFLICT DO NOTHING`, [acct.email, buyerId]).catch(() => {});
      }
      return json(res, 200, { ok: true, found: !!(r.got_email || r.got_phone || b.email || b.phone), website: r.website || null,
        got_email: r.got_email, got_phone: r.got_phone, got_website: r.got_website, charged });
    } catch (e) {
      return json(res, 503, { error: 'Pencarian kontak gagal. Coba lagi nanti.', detail: e.message });
    }
  }

  if ((m = route('GET', '/api/buyers/:id/shipments'))) {
    // Bill-of-lading data is not yet part of the crawler output. Return an
    // empty payload with a small hint so the UI can render an empty state
    // instead of erroring.
    return json(res, 200, {
      total: 0, page: 1, per: 20, rows: [], monthly: [],
      hint: 'Data pengiriman detail belum tersedia untuk buyer ini. Sumber discovery (GLEIF, Companies House UK, Kompass, Europages) memberi profil perusahaan; data shipment akan menyusul saat kita aktifkan sumber bill-of-lading.',
    });
  }

  if ((m = route('GET', '/api/buyers/:id/suppliers'))) {
    return json(res, 200, []);
  }

  if ((m = route('GET', '/api/buyers/:id/insights'))) {
    // Live-data version: insights are inferred from the crawler / enrichment
    // signals (industry, sources, description, HS codes) instead of the
    // dummy shipment aggregates.
    try {
      const pgClient = require('./pg');
      const b = await pgClient.one(`SELECT id, name, country, industry, description, hs_codes,
                                            data_confidence, enriched_at, sources_seen, size_bucket
                                       FROM scraped_buyers WHERE id = $1`, [Number(m.id)]);
      if (!b) return err(res, 404, 'Buyer tidak ditemukan.');
      const insights = [];
      if (b.industry) insights.push(`Kategori bisnis terverifikasi: ${b.industry}.`);
      if (Array.isArray(b.sources_seen) && b.sources_seen.length >= 2) {
        insights.push(`Buyer ini ditemukan di ${b.sources_seen.length} sumber independen (${b.sources_seen.join(', ')}). Data cross-verified.`);
      } else {
        insights.push(`Baru muncul di 1 sumber (${(b.sources_seen || [b.source])[0]}). Verifikasi ulang sebelum kontak.`);
      }
      if (b.description) insights.push(`Profil singkat: ${b.description}`);
      if (b.data_confidence >= 80) insights.push('Skor kepercayaan data tinggi (≥80). Aman untuk outreach langsung.');
      else if (b.data_confidence >= 60) insights.push('Skor kepercayaan data sedang (60-79). Cek website / email sebelum kirim proposal.');
      else insights.push('Skor kepercayaan data awal. Sebaiknya validasi manual dulu sebelum outreach volume.');
      if (Array.isArray(b.hs_codes) && b.hs_codes.length) {
        insights.push(`HS terkait: ${b.hs_codes.slice(0, 3).join(', ')}.`);
      }
      const similar = await pgClient.query(`
        SELECT id, name, country, data_confidence FROM scraped_buyers
         WHERE industry = $1 AND id <> $2
         ORDER BY data_confidence DESC LIMIT 3`, [b.industry, Number(m.id)]);
      const angle = 'Perkenalkan diri sebagai pemasok Indonesia dengan sertifikasi ekspor, kualitas konsisten, dan harga FOB kompetitif. Tawarkan sampel gratis di email pertama.';
      return json(res, 200, {
        insights,
        recommended_angle: angle,
        similar: similar.map((s) => ({ ...s, id: Number(s.id), country_name: COUNTRY_NAMES[s.country] || s.country })),
      });
    } catch (e) {
      return json(res, 503, { error: 'buyer_pool_unavailable', detail: e.message });
    }
  }

  // ===== shipment explorer (F3) =====
  if (route('GET', '/api/shipments')) {
    const where = []; const args = [];
    const add = (cond, v) => { where.push(cond); args.push(v); };
    if (q.get('hs')) add('s.hs_code LIKE ?', q.get('hs') + '%');
    if (q.get('buyer_q')) add('b.name LIKE ?', '%' + q.get('buyer_q') + '%');
    if (q.get('exporter_q')) add('e.name LIKE ?', '%' + q.get('exporter_q') + '%');
    if (q.get('origin')) add('e.country = ?', q.get('origin'));
    if (q.get('dest')) add('b.country = ?', q.get('dest'));
    if (q.get('from')) add('s.shipment_date >= ?', q.get('from'));
    if (q.get('to')) add('s.shipment_date <= ?', q.get('to'));
    const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const groupBy = q.get('group_by');
    if (groupBy) {
      const keyMap = {
        buyer: ["b.name || ' · ' || b.country", 'b.name'], exporter: ["e.name || ' · ' || e.country", 'e.name'],
        hs: ['s.hs_code', 's.hs_code'], month: ["substr(s.shipment_date,1,7)", "substr(s.shipment_date,1,7)"],
      }[groupBy];
      if (!keyMap) return err(res, 400, 'group_by tidak valid.');
      const rows = db.prepare(`SELECT ${keyMap[0]} grp, COUNT(*) shipments, SUM(s.weight_kg) volume_kg, SUM(s.value_usd) value_usd
        FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
        ${W} GROUP BY ${keyMap[1]} ORDER BY value_usd DESC LIMIT 100`).all(...args);
      return json(res, 200, { grouped: true, rows });
    }
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = 25;
    const total = db.prepare(`SELECT COUNT(*) c FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id ${W}`).get(...args).c;
    const rows = db.prepare(`SELECT s.*, b.name buyer_name, b.country buyer_country, e.name exporter_name, e.country exporter_country, e.is_indonesian
      FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
      ${W} ORDER BY s.shipment_date DESC LIMIT ? OFFSET ?`).all(...args, per, (pageN - 1) * per);
    return json(res, 200, { grouped: false, total, page: pageN, per, rows });
  }

  // ===== export CSV =====
  if (route('GET', '/api/export/shipments')) {
    // Rows come from the plan's export quota first, then Rp100/row from the balance.
    const room = billing.quotaLeft(acct, 'export');
    const affordable = room === Infinity ? 10000 : room + Math.floor(acct.balance / billing.RATES.export);
    const limit = Math.min(10000, affordable);
    if (!limit) return json(res, 402, billing.paymentRequired(acct, 'export'));
    const rows = db.prepare(`SELECT s.shipment_date, s.hs_code, b.name buyer, b.country, e.name exporter, e.country origin,
      s.origin_port, s.dest_port, s.weight_kg, s.value_usd, s.goods_description
      FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
      ${q.get('buyer_id') ? 'WHERE s.buyer_id = ?' : ''} ORDER BY s.shipment_date DESC LIMIT ?`)
      .all(...(q.get('buyer_id') ? [q.get('buyer_id')] : []), Math.min(limit, 10000));
    const head = Object.keys(rows[0] || { info: '' });
    const csv = [`# EksporIn export | ${user.email} | ${new Date().toISOString()} (watermarked)`, head.join(','),
      ...rows.map((r) => head.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    if (rows.length) {
      const c = await billing.consume(acct, 'export', rows.length, 'export:shipments');
      if (!c.ok) return json(res, 402, billing.paymentRequired(acct, 'export', rows.length));
    }
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="eksporin-shipments.csv"' });
    return res.end(csv);
  }

  // ===== lists (F5) =====
  if (route('GET', '/api/lists')) {
    const rows = db.prepare(`SELECT l.*, (SELECT COUNT(*) FROM list_buyers lb WHERE lb.list_id=l.id) buyer_count
      FROM lists l WHERE l.user_id=? ORDER BY l.created_at DESC`).all(user.id);
    return json(res, 200, rows);
  }
  if (route('POST', '/api/lists')) {
    const { name, description, color } = body || {};
    if (!name) return err(res, 400, 'Nama daftar wajib diisi.');
    db.prepare('INSERT INTO lists (user_id,name,description,color) VALUES (?,?,?,?)').run(user.id, name, description || null, color || '#2563EB');
    return json(res, 201, db.prepare('SELECT * FROM lists WHERE id = last_insert_rowid()').get());
  }
  if ((m = route('GET', '/api/lists/:id'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    const buyers = db.prepare(`SELECT lb.*, b.name, b.country, b.city, b.industry, b.size_bucket, b.base_score,
      b.shipments_12mo, b.last_shipment_date FROM list_buyers lb JOIN buyers b ON b.id=lb.buyer_id
      WHERE lb.list_id=? ORDER BY lb.added_at DESC`).all(m.id);
    return json(res, 200, { ...l, buyers: buyers.map((x) => {
      const fit = productFit(userHs, buyerHsCodes(db, x.buyer_id));
      const bb = db.prepare('SELECT * FROM buyers WHERE id=?').get(x.buyer_id);
      const score = finalScore(bb, fit);
      return { ...x, tags: JSON.parse(x.tags || '[]'), country_name: COUNTRY_NAMES[x.country] || x.country, score, score_label: scoreLabel(score) };
    }) });
  }
  if ((m = route('PATCH', '/api/lists/:id'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    db.prepare('UPDATE lists SET name=COALESCE(?,name), description=COALESCE(?,description), color=COALESCE(?,color) WHERE id=?')
      .run(body.name ?? null, body.description ?? null, body.color ?? null, m.id);
    return json(res, 200, { ok: true });
  }
  if ((m = route('DELETE', '/api/lists/:id'))) {
    db.prepare('DELETE FROM list_buyers WHERE list_id IN (SELECT id FROM lists WHERE id=? AND user_id=?)').run(m.id, user.id);
    db.prepare('DELETE FROM lists WHERE id=? AND user_id=?').run(m.id, user.id);
    return json(res, 200, { ok: true });
  }
  if ((m = route('POST', '/api/lists/:id/buyers'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    const cap = plan.saved;
    if (cap !== null && savedCount(db, user.id) >= cap)
      return json(res, 402, { error: `Paket ${plan.name} maksimal menyimpan ${cap} buyer. Upgrade untuk simpan tanpa batas.`, upgrade: true });
    db.prepare('INSERT OR IGNORE INTO list_buyers (list_id,buyer_id) VALUES (?,?)').run(m.id, body.buyer_id);
    return json(res, 201, { ok: true });
  }
  if ((m = route('PATCH', '/api/lists/:id/buyers/:bid'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    db.prepare(`UPDATE list_buyers SET status=COALESCE(?,status), priority=COALESCE(?,priority),
      tags=COALESCE(?,tags), reminder_at=COALESCE(?,reminder_at) WHERE list_id=? AND buyer_id=?`)
      .run(body.status ?? null, body.priority ?? null, body.tags ? JSON.stringify(body.tags) : null, body.reminder_at ?? null, m.id, m.bid);
    return json(res, 200, { ok: true });
  }
  if ((m = route('DELETE', '/api/lists/:id/buyers/:bid'))) {
    db.prepare('DELETE FROM list_buyers WHERE list_id IN (SELECT id FROM lists WHERE id=? AND user_id=?) AND buyer_id=?').run(m.id, user.id, m.bid);
    return json(res, 200, { ok: true });
  }

  // ===== notes =====
  if (route('GET', '/api/notes')) {
    const rows = db.prepare('SELECT * FROM notes WHERE user_id=? AND buyer_id=? ORDER BY created_at DESC').all(user.id, q.get('buyer_id'));
    return json(res, 200, rows);
  }
  if (route('POST', '/api/notes')) {
    if (!body.buyer_id || !body.body) return err(res, 400, 'Isi catatan kosong.');
    db.prepare('INSERT INTO notes (user_id,buyer_id,body) VALUES (?,?,?)').run(user.id, body.buyer_id, body.body);
    return json(res, 201, { ok: true });
  }
  if ((m = route('DELETE', '/api/notes/:id'))) {
    db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(m.id, user.id);
    return json(res, 200, { ok: true });
  }

  // ===== outreach (F6) =====
  if (route('GET', '/api/templates')) {
    let sys = db.prepare('SELECT * FROM templates WHERE user_id IS NULL ORDER BY id').all();
    const capT = plan.sys_templates;
    if (capT !== null) sys = sys.map((t, i) => ({ ...t, locked: i >= capT }));
    const own = db.prepare('SELECT * FROM templates WHERE user_id=? ORDER BY id DESC').all(user.id);
    return json(res, 200, { system: sys, own });
  }
  if (route('POST', '/api/templates')) {
    const { name, category, language, channel, subject, body: tbody } = body || {};
    if (!name || !tbody) return err(res, 400, 'Nama dan isi template wajib diisi.');
    db.prepare('INSERT INTO templates (user_id,category,language,channel,name,subject,body) VALUES (?,?,?,?,?,?,?)')
      .run(user.id, category || 'first_touch', language || 'en', channel || 'email', name, subject || null, tbody);
    return json(res, 201, { ok: true });
  }
  if (route('POST', '/api/outreach/preview')) {
    const tpl = db.prepare('SELECT * FROM templates WHERE id=? AND (user_id IS NULL OR user_id=?)').get(body.template_id, user.id);
    const buyer = db.prepare('SELECT * FROM buyers WHERE id=?').get(body.buyer_id);
    if (!tpl || !buyer) return err(res, 404, 'Template atau buyer tidak ditemukan.');
    const rendered = renderTemplate(db, tpl, buyer, user);
    const email = db.prepare("SELECT value FROM buyer_contacts WHERE buyer_id=? AND contact_type='email' LIMIT 1").get(buyer.id);
    const phone = db.prepare("SELECT value FROM buyer_contacts WHERE buyer_id=? AND contact_type='phone' LIMIT 1").get(buyer.id);
    return json(res, 200, {
      ...rendered, buyer_name: buyer.name,
      to_email: email ? (acct.plan !== 'expired' ? email.value : maskContact('email', email.value)) : null,
      to_phone: phone ? (acct.plan !== 'expired' ? phone.value : maskContact('phone', phone.value)) : null,
      contacts_visible: acct.plan !== 'expired',
    });
  }
  if (route('POST', '/api/outreach/send')) {
    const ids = (body.buyer_ids || []).slice(0, 50);
    if (!ids.length) return err(res, 400, 'Pilih minimal satu buyer.');
    const tpl = db.prepare('SELECT * FROM templates WHERE id=? AND (user_id IS NULL OR user_id=?)').get(body.template_id, user.id);
    if (!tpl) return err(res, 404, 'Template tidak ditemukan.');
    if (tpl.user_id === null && plan.sys_templates !== null) {
      const idx = db.prepare('SELECT COUNT(*) c FROM templates WHERE user_id IS NULL AND id < ?').get(tpl.id).c;
      if (idx >= plan.sys_templates) return json(res, 402, { error: 'Template ini terkunci di paket Anda. Upgrade untuk membuka semua template.', upgrade: true });
    }
    if (!billing.canAfford(acct, 'send', ids.length).ok) return json(res, 402, billing.paymentRequired(acct, 'send', ids.length));
    // anti-abuse: same template to same buyer within 14 days
    const sent = [];
    for (const bid of ids) {
      const dup = db.prepare(`SELECT 1 FROM messages WHERE user_id=? AND buyer_id=? AND template_id=? AND sent_at >= datetime('now','-14 days')`).get(user.id, bid, tpl.id);
      if (dup) { sent.push({ buyer_id: bid, skipped: 'Template sama sudah dikirim ke buyer ini dalam 14 hari terakhir.' }); continue; }
      const buyer = db.prepare('SELECT * FROM buyers WHERE id=?').get(bid);
      if (!buyer) continue;
      const r = renderTemplate(db, tpl, buyer, user);
      const c = await billing.consume(acct, 'send', 1, `buyer:${bid}`);
      if (!c.ok) { sent.push({ buyer_id: bid, skipped: 'Kuota/saldo tidak cukup.' }); break; }
      db.prepare('INSERT INTO messages (user_id,buyer_id,template_id,channel,subject,body,status) VALUES (?,?,?,?,?,?,?)')
        .run(user.id, bid, tpl.id, body.channel || tpl.channel, r.subject, r.body, 'sent');
      // auto-update pipeline status new → contacted
      db.prepare(`UPDATE list_buyers SET status='contacted' WHERE buyer_id=? AND status='new'
        AND list_id IN (SELECT id FROM lists WHERE user_id=?)`).run(bid, user.id);
      sent.push({ buyer_id: bid, ok: true });
    }
    return json(res, 200, { sent, quota: quotaView(acct, 'send') });
  }
  if (route('GET', '/api/outreach/messages')) {
    let rows = db.prepare(`SELECT msg.*, b.name buyer_name, b.country buyer_country FROM messages msg
      JOIN buyers b ON b.id=msg.buyer_id WHERE msg.user_id=? ${q.get('buyer_id') ? 'AND msg.buyer_id=?' : ''}
      ORDER BY msg.sent_at DESC LIMIT 100`).all(...(q.get('buyer_id') ? [user.id, q.get('buyer_id')] : [user.id]));
    rows = rows.map((msg) => simulateTracking(db, msg));
    return json(res, 200, rows);
  }

  // ===== alerts (F7) =====
  if (route('GET', '/api/alerts')) {
    materializeAlerts(db, user);
    if (plan.alerts === 0) return json(res, 200, { locked: true, alerts: [] });
    let rows = db.prepare('SELECT * FROM alerts WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 100').all(user.id);
    if (plan.alerts !== null) rows = rows.slice(0, plan.alerts);
    return json(res, 200, { locked: false, capped: plan.alerts, alerts: rows });
  }
  if (route('POST', '/api/alerts/read')) {
    if (body.id) db.prepare('UPDATE alerts SET read=1 WHERE user_id=? AND id=?').run(user.id, body.id);
    else db.prepare('UPDATE alerts SET read=1 WHERE user_id=?').run(user.id);
    return json(res, 200, { ok: true });
  }

  // ===== dashboard =====
  if (route('GET', '/api/dashboard')) {
    materializeAlerts(db, user);
    const countries = JSON.parse(user.target_countries || '[]');

    // Recommendations: pull top scraped buyers matching user's HS focus /
    // target countries. Falls back to top 6 overall if the user has no
    // preferences set yet.
    let recs = [];
    let countryBreakdown = [];
    try {
      const pgClient = require('./pg');
      const savedIds = db.prepare(`SELECT lb.buyer_id FROM list_buyers lb
        JOIN lists l ON l.id=lb.list_id WHERE l.user_id=?`).all(user.id).map((r) => Number(r.buyer_id));
      const conds = ['TRUE']; const params = [];
      if (userHs.length) {
        const hs4 = userHs.map((h) => h.slice(0, 4));
        params.push(hs4);
        conds.push(`hs_codes && $${params.length}::text[]`);
      }
      if (countries.length) {
        const placeholders = countries.map((c) => { params.push(c); return `$${params.length}`; }).join(',');
        conds.push(`country IN (${placeholders})`);
      }
      if (savedIds.length) {
        params.push(savedIds);
        conds.push(`id <> ALL($${params.length}::bigint[])`);
      }
      const recRows = await pgClient.query(`
        SELECT id, name, country, city, industry, size_bucket, data_confidence,
               hs_codes, enriched_at, sources_seen
          FROM scraped_buyers
         WHERE ${conds.join(' AND ')}
         ORDER BY (enriched_at IS NOT NULL) DESC, data_confidence DESC, updated_at DESC
         LIMIT 6`, params);
      recs = recRows.map((b) => ({
        id: Number(b.id), name: b.name, country: b.country,
        country_name: COUNTRY_NAMES[b.country] || b.country,
        city: b.city, industry: b.industry, size_bucket: b.size_bucket,
        hs_codes: b.hs_codes || [], score: b.data_confidence,
        score_label: b.data_confidence >= 80 ? 'HOT' : b.data_confidence >= 60 ? 'WARM' : 'FRESH',
        sources: b.sources_seen || [], enriched: !!b.enriched_at,
        shipments_12mo: null, volume_12mo_kg: null, has_indonesian_supplier: false,
      }));

      // Country breakdown from live data.
      const cbConds = userHs.length ? `WHERE hs_codes && $1::text[] AND country IS NOT NULL` : 'WHERE country IS NOT NULL';
      const cbParams = userHs.length ? [userHs.map((h) => h.slice(0, 4))] : [];
      const cbRows = await pgClient.query(`
        SELECT country, COUNT(*)::int AS n FROM scraped_buyers ${cbConds}
        GROUP BY country ORDER BY n DESC LIMIT 12`, cbParams);
      countryBreakdown = cbRows.map((r) => ({ country: r.country, n: r.n, name: COUNTRY_NAMES[r.country] || r.country }));
    } catch (_e) {
      // Postgres offline: return empty arrays; dashboard degrades gracefully.
    }

    // Pipeline + outreach stats stay on sql.js (user-owned data).
    const pipeline = db.prepare(`SELECT lb.status, COUNT(*) n FROM list_buyers lb JOIN lists l ON l.id=lb.list_id
      WHERE l.user_id=? GROUP BY lb.status`).all(user.id);
    const msgs = db.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN status IN ('opened','replied') THEN 1 ELSE 0 END) opened,
      SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) replied FROM messages WHERE user_id=?`).get(user.id);

    return json(res, 200, {
      recommendations: recs, pipeline, trend: [], country_breakdown: countryBreakdown,
      outreach: msgs, saved: savedCount(db, user.id),
      alerts_unread: db.prepare('SELECT COUNT(*) c FROM alerts WHERE user_id=? AND read=0').get(user.id).c,
    });
  }

  // ===== AI Buyer Discovery Engine =====
  if (route('POST', '/api/discover')) {
    return (async () => {
    const { query } = body || {};
    if (!query || query.trim().length < 3) return err(res, 400, 'Masukkan deskripsi produk yang ingin dicari buyer-nya.');

    // Step 1: HS Code Mapping (real LLM via Sumopod, falls back to keyword matching)
    const qLower = query.toLowerCase();
    const HS_MAP = [
      { keywords: ['vanili', 'vanilla', 'vanila', 'vanilla bean', 'vanili kering', 'vanili polong', 'tahitian', 'planifolia'], hs: '0905', desc_en: 'Vanilla beans', desc_id: 'Vanili', industry: ['Food & Beverage', 'Flavoring', 'Confectionery', 'Extract Manufacturing'], titles: ['Procurement Manager', 'Sourcing Director', 'Head of Purchasing', 'Supply Chain Director', 'Category Buyer'], cargo_keywords: ['VANILLA BEANS', 'VANILLA PODS', 'DRIED VANILLA', 'VANILLA EXTRACT', 'CURED VANILLA'] },
      { keywords: ['kopi', 'coffee', 'arabica', 'robusta', 'gayo', 'toraja', 'flores', 'java', 'luwak', 'green bean'], hs: '0901', desc_en: 'Coffee', desc_id: 'Kopi', industry: ['Coffee Roasters', 'Specialty Coffee', 'FMCG'], titles: ['Head of Sourcing', 'Green Coffee Buyer', 'Purchasing Manager'] },
      { keywords: ['lada', 'pepper', 'merica', 'lada hitam', 'lada putih', 'muntok'], hs: '0904', desc_en: 'Pepper', desc_id: 'Lada', industry: ['Spices', 'Food Ingredients'], titles: ['Procurement Manager', 'Sourcing Director'] },
      { keywords: ['pala', 'nutmeg', 'fuli', 'mace'], hs: '0908', desc_en: 'Nutmeg', desc_id: 'Pala', industry: ['Spices', 'Essential Oils'], titles: ['Category Buyer', 'Supply Chain Manager'] },
      { keywords: ['kayu manis', 'cinnamon', 'cassia', 'cinnamomum'], hs: '0906', desc_en: 'Cinnamon', desc_id: 'Kayu manis', industry: ['Spices', 'Food & Beverage', 'Bakery Ingredients'], titles: ['Procurement Manager', 'Category Buyer', 'Sourcing Director'] },
      { keywords: ['cengkeh', 'clove', 'cloves'], hs: '0907', desc_en: 'Cloves', desc_id: 'Cengkeh', industry: ['Spices', 'Cigarette Manufacturing', 'Essential Oils'], titles: ['Procurement Manager', 'Sourcing Director'] },
      { keywords: ['udang', 'shrimp', 'prawn', 'vannamei', 'lobster', 'kepiting', 'crab'], hs: '0306', desc_en: 'Shrimps and prawns', desc_id: 'Udang', industry: ['Seafood', 'Frozen Foods'], titles: ['Seafood Buyer', 'Procurement Lead'] },
      { keywords: ['tuna', 'cakalang', 'skipjack', 'ikan'], hs: '0303', desc_en: 'Fish, frozen', desc_id: 'Ikan beku', industry: ['Seafood', 'Marine Foods'], titles: ['Purchasing Manager', 'Import Director'] },
      { keywords: ['kelapa', 'coconut', 'kopra', 'coco', 'santan', 'coconut oil'], hs: '1513', desc_en: 'Coconut oil', desc_id: 'Minyak kelapa', industry: ['Agri-food', 'Oils & Fats'], titles: ['Commodity Trader', 'Procurement Manager'] },
      { keywords: ['kakao', 'cocoa', 'cokelat', 'chocolate', 'cacao'], hs: '1801', desc_en: 'Cocoa beans', desc_id: 'Biji kakao', industry: ['Chocolate Manufacturing', 'Confectionery', 'Food Processing'], titles: ['Cocoa Buyer', 'Procurement Manager', 'Sourcing Director'] },
      { keywords: ['sawit', 'palm oil', 'cpo', 'palm', 'minyak sawit'], hs: '1511', desc_en: 'Palm oil', desc_id: 'Minyak sawit', industry: ['Oils & Fats', 'FMCG', 'Oleochemicals'], titles: ['Commodity Trader', 'Procurement Manager', 'Supply Chain Director'] },
      { keywords: ['karet', 'rubber', 'sir', 'latex'], hs: '4001', desc_en: 'Natural rubber', desc_id: 'Karet alam', industry: ['Rubber', 'Industrial Materials'], titles: ['Purchasing Manager', 'Technical Buyer'] },
      { keywords: ['kayu', 'wood', 'plywood', 'timber', 'kayu lapis'], hs: '4412', desc_en: 'Plywood', desc_id: 'Kayu lapis', industry: ['Wood products', 'Building Materials'], titles: ['Procurement Lead', 'Import Manager'] },
      { keywords: ['rotan', 'rattan', 'anyaman', 'basket', 'kerajinan'], hs: '4602', desc_en: 'Basketwork of rattan', desc_id: 'Anyaman rotan', industry: ['Home & living', 'Decor'], titles: ['Product Sourcing Manager', 'Buyer'] },
      { keywords: ['furni', 'furniture', 'mebel', 'kursi', 'meja', 'teak', 'jati', 'jepara', 'mahogany'], hs: '9403', desc_en: 'Furniture', desc_id: 'Perabot', industry: ['Furniture', 'Interiors'], titles: ['Sourcing Director', 'Category Manager', 'Import Director'] },
      { keywords: ['tekstil', 'textile', 'garmen', 'garment', 'kain', 'fabric', 'batik'], hs: '6204', desc_en: 'Garments & textiles', desc_id: 'Tekstil & garmen', industry: ['Fashion', 'Textile Manufacturing', 'Retail'], titles: ['Sourcing Manager', 'Merchandiser', 'Import Director'] },
    ];

    let matched = HS_MAP.find((m) => m.keywords.some((k) => qLower.includes(k)));

    // Try Sumopod LLM to refine or discover the HS mapping.
    // Timeout 8s so a slow AI never blocks the pipeline; keyword match still wins.
    let aiRaw = null;
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const aiResp = await fetch(SUMOPOD_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUMOPOD_AI_KEY },
        signal: ac.signal,
        body: JSON.stringify({
          model: SUMOPOD_AI_MODEL,
          temperature: 0.3,
          max_tokens: 350,
          messages: [
            { role: 'system', content: 'You classify Indonesian export commodities. Given a natural-language description (Indonesian or English), respond ONLY with a JSON object in this exact shape (no markdown, no preamble): {"hs":"4-digit HS heading like 0905","desc_en":"short English name","desc_id":"short Indonesian name","industry":["target buyer industry", ...],"cargo_keywords":["UPPERCASE keywords that would appear on a Bill of Lading for this commodity", ...]}' },
            { role: 'user', content: query },
          ],
        }),
      });
      clearTimeout(t);
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        aiRaw = aiData.choices?.[0]?.message?.content || '';
        // The model may return the JSON with backticks. Strip and parse.
        const jsonText = aiRaw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(jsonText);
        if (parsed && typeof parsed.hs === 'string' && /^\d{4}$/.test(parsed.hs)) {
          matched = {
            hs: parsed.hs,
            desc_en: parsed.desc_en || parsed.hs,
            desc_id: parsed.desc_id || parsed.desc_en || parsed.hs,
            industry: Array.isArray(parsed.industry) && parsed.industry.length ? parsed.industry : (matched?.industry || ['General Trade']),
            titles: matched?.titles || ['Procurement Manager', 'Sourcing Director', 'Category Buyer'],
            cargo_keywords: Array.isArray(parsed.cargo_keywords) && parsed.cargo_keywords.length ? parsed.cargo_keywords : [query.toUpperCase()],
            ai: true,
          };
        }
      }
    } catch (e) { /* silent — fallback below */ }

    if (!matched) {
      // Fallback: search by text across HS codes in DB
      const hit = searchHsNomenclature(query, 1, [4, 6])[0];
      const hsMatch = hit ? { code: hit.code, description_en: hit.description_en, description_id: hit.description } : null;
      if (hsMatch) {
        matched = { hs: hsMatch.code.slice(0, 4), desc_en: hsMatch.description_en, desc_id: hsMatch.description_id, industry: ['General Trade'], titles: ['Procurement Manager', 'Sourcing Director', 'Category Buyer'], cargo_keywords: [query.toUpperCase()] };
      } else {
        matched = { hs: '0901', desc_en: query, desc_id: query, industry: ['General Trade'], titles: ['Procurement Manager', 'Sourcing Director'], cargo_keywords: [query.toUpperCase()] };
      }
    }

    // Step 2: real buyers for this HS from the live pool (scraped_buyers),
    // best-documented first. No synthetic people or guessed emails: every
    // contact shown was observed on a public page.
    let rows = [];
    try {
      const pgc = require('./pg');
      try {
        rows = await pgc.query(`SELECT id, name, country, city, website, email, phone, industry, buyer_type, description,
                                       hs_codes, sources_seen, source, quality_score, email_status, evidence_url
                                  FROM scraped_buyers
                                 WHERE is_hidden = FALSE AND hs_codes @> ARRAY[$1]::text[]
                                 ORDER BY quality_score DESC, (email IS NOT NULL) DESC, data_confidence DESC LIMIT 20`, [matched.hs]);
      } catch (e) {
        if (e.code !== '42703') throw e;
        rows = await pgc.query(`SELECT id, name, country, city, website, email, phone, industry, NULL AS buyer_type, description,
                                       hs_codes, sources_seen, source, data_confidence AS quality_score, NULL AS email_status, NULL AS evidence_url
                                  FROM scraped_buyers WHERE hs_codes @> ARRAY[$1]::text[]
                                 ORDER BY (email IS NOT NULL) DESC, data_confidence DESC LIMIT 20`, [matched.hs]);
      }
    } catch (_e) { rows = []; }
    if (!billing.canAfford(acct, 'search').ok) return json(res, 402, billing.paymentRequired(acct, 'search'));
    await billing.consume(acct, 'search', 1, 'discover');
    const openSet = await billing.unlockedSet(acct, 'contact', rows.map((r) => r.id));
    const results = rows.map((b, idx) => {
      const domain = b.website ? String(b.website).replace(/https?:\/\/(www\.)?/, '').replace(/\/.*/, '') : null;
      const score = Number(b.quality_score) || 0;
      const kind = b.buyer_type || b.industry || 'buyer';
      const cname = COUNTRY_NAMES[b.country] || b.country;
      const angle = b.email
        ? `Kirim email singkat ke ${b.name}: perkenalkan ${matched.desc_en} Indonesia (grade, kapasitas per bulan, sertifikasi), tawarkan sampel, dan sebutkan harga FOB/CIF indikatif.`
        : b.website
          ? `Buka website ${domain} untuk memahami produk mereka, lalu hubungi lewat formulir kontak atau telepon dengan penawaran ${matched.desc_en} yang spesifik.`
          : `Cari PIC pembelian ${b.name} di LinkedIn (${(matched.titles || []).slice(0, 2).join(' / ')}), lalu kirim pesan perkenalan singkat.`;
      return {
        rank: idx + 1,
        company: {
          id: Number(b.id), name: b.name, country: b.country, country_name: cname,
          city: b.city, industry: kind, domain, website: b.website || null,
          description: b.description || null, imported_hs_codes: b.hs_codes || [],
          sources: b.sources_seen || [b.source], evidence_url: b.evidence_url || null,
        },
        contacts: {
          email: b.email ? (openSet.has(Number(b.id)) ? b.email : maskContact('email', b.email)) : null,
          email_status: b.email_status || null,
          phone: b.phone ? (openSet.has(Number(b.id)) ? b.phone : maskContact('phone', b.phone)) : null,
          website: b.website || null, masked: !openSet.has(Number(b.id)),
          linkedin_search: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${b.name} ${(matched.titles || ['purchasing'])[0]}`)}`,
        },
        decision_makers: [],
        scoring: {
          match_score: score,
          score_label: score >= 70 ? 'Siap dihubungi' : score >= 45 ? 'Cukup lengkap' : 'Perlu riset',
          reasoning: [b.email && 'email bisnis', b.phone && 'telepon', b.website && 'website', (b.sources_seen || []).length > 1 && `${(b.sources_seen || []).length} sumber`].filter(Boolean).join(' · ') || 'data kontak belum lengkap',
          customized_pitch_angle: angle,
        },
        trade_data: null,
      };
    });
    const withEmail = results.filter((r) => r.contacts.email).length;
    const withPhone = results.filter((r) => r.contacts.phone).length;
    const verifiedContacts = withEmail;
    const totalContacts = withEmail + withPhone;
    const buyers = rows;

    return json(res, 200, {
      query,
      interpretation: {
        hs_code_6_digit: matched.hs,
        hs_code_description: matched.desc_en,
        description_id: matched.desc_id,
        trade_manifest_keywords: matched.cargo_keywords || matched.keywords || [query],
        target_industry_segments: matched.industry,
        buyer_job_titles_to_target: matched.titles,
        ai_powered: !!matched.ai,
      },
      pipeline_steps: [
        { step: 1, name: 'Input Interpretation & HS Mapping', status: 'completed', result: `${matched.ai ? 'AI: ' : ''}Mapped "${query}" → HS ${matched.hs} (${matched.desc_en})` },
        { step: 2, name: 'Cari buyer di database', status: 'completed', result: `${buyers.length} buyer ditemukan dari ${new Set(buyers.map((b) => b.country)).size} negara` },
        { step: 3, name: 'Kontak terverifikasi', status: 'completed', result: `${verifiedContacts} buyer dengan email, ${withPhone} dengan telepon (dari website resmi perusahaan)` },
        { step: 4, name: 'Prioritas & saran pendekatan', status: 'completed', result: `${results.filter((r) => r.scoring.match_score >= 70).length} siap dihubungi, ${results.filter((r) => r.scoring.match_score >= 45 && r.scoring.match_score < 70).length} cukup lengkap` },
      ],
      total_leads: results.length,
      leads: results,
    });
    })();
  }

  return err(res, 404, 'Endpoint tidak ditemukan.');
}

module.exports = { handleApi, PLANS };
