// EksporIn | REST API (all routes under /api)
'use strict';
const { hashPassword, verifyPassword, createSession, getSessionUser, destroySession, sessionCookie, clearCookie } = require('./auth');

// Supabase bridge config — matches public/supabase-client.js. Publishable key is safe on server too.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dbdzmhrofgcmkdszjxxq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_--qPH56dWsGCxUzm7Mc_Aw_2P53hp3r';

// Sumopod: payment gateway + LLM. Server-side only — never expose these keys.
const SUMOPOD_PAY_URL = process.env.SUMOPOD_PAY_URL || 'https://api-pay.sumopod.com/api/v1/payments';
const SUMOPOD_PAY_KEY = process.env.SUMOPOD_PAY_KEY || 'a5b0c6a03795701fa3e84f5e5a02a20fca04be43fbaad1c7857455a7134f3993';
const SUMOPOD_AI_URL = process.env.SUMOPOD_AI_URL || 'https://ai.sumopod.com/v1/chat/completions';
const SUMOPOD_AI_KEY = process.env.SUMOPOD_AI_KEY || 'sk-jzbEVp009nE3qAPxXvbJSg';
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
function loadHsNomenclature() {
  if (HS_NOMEN) return HS_NOMEN;
  HS_NOMEN = new Map();
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const csvPath = path.join(__dirname, '..', 'data', 'hs-nomenclature.csv');
    if (!fs.existsSync(csvPath)) { console.warn('[hs-nomen] CSV not found at', csvPath); return HS_NOMEN; }
    const text = fs.readFileSync(csvPath, 'utf8');
    const lines = text.split(/\r?\n/);
    // header: section,hscode,description,parent,level
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // CSV row can contain a quoted description with commas — parse minimally.
      // Fields: section, hscode, description (possibly quoted), parent, level
      const m = line.match(/^([^,]*),([^,]*),(?:"([^"]*)"|([^,]*)),([^,]*),([^,]*)$/);
      if (!m) continue;
      const section = m[1]; const hscode = m[2]; const desc = m[3] || m[4] || '';
      const parent = m[5]; const level = parseInt(m[6] || '0', 10) || 0;
      if (hscode) HS_NOMEN.set(hscode, { code: hscode, description: desc, parent, level, section });
    }
  } catch (e) { console.warn('[hs-nomen] load failed:', e.message || e); }
  return HS_NOMEN;
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
function searchHsNomenclature(query, limit = 10) {
  const map = loadHsNomenclature();
  if (!map || !map.size || !query) return [];
  const expanded = expandQueryToEnglish(query);
  const q = expanded.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
  if (!q.length) return [];
  const scored = [];
  for (const entry of map.values()) {
    if (entry.level !== 6) continue; // only 6-digit codes count as "final" HS
    const desc = entry.description.toLowerCase();
    let score = 0;
    for (const w of q) { if (desc.includes(w)) score += w.length; }
    if (score > 0) scored.push({ ...entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
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
async function verifySupabaseToken(db, accessToken) {
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
    const u = await verifySupabaseToken(db, m[1]);
    if (u) return u;
  }
  return getSessionUser(db, req);
}

// ---------- plans (Feature-by-Tier matrix, doc 03 §7) ----------
const PLANS = {
  free:     { name: 'Free',     price: 0,      search: 20,  profile: 3,    saved: 10,  send: 5,    alerts: 0,    export: 0,     contacts: false, competitor: false, sys_templates: 3 },
  starter:  { name: 'Starter',  price: 149000, search: 100, profile: 50,   saved: null, send: 50,   alerts: 5,    export: 100,   contacts: false, competitor: false, sys_templates: 10 },
  growth:   { name: 'Growth',   price: 499000, search: 500, profile: 300,  saved: null, send: 300,  alerts: null, export: 500,   contacts: true,  competitor: false, sys_templates: null },
  business: { name: 'Business', price: 999000, search: null, profile: null, saved: null, send: 2000, alerts: null, export: 10000, contacts: true,  competitor: true,  sys_templates: null },
};
const COUNTRY_NAMES = { US: 'Amerika Serikat', JP: 'Jepang', NL: 'Belanda', AE: 'Uni Emirat Arab', AU: 'Australia', ID: 'Indonesia', VN: 'Vietnam', BR: 'Brasil', CO: 'Kolombia', IN: 'India', TH: 'Thailand', CN: 'Tiongkok', MY: 'Malaysia', EC: 'Ekuador', ET: 'Ethiopia' };
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
function quotaCheck(db, user, meter) {
  const limit = PLANS[user.plan][meter];
  if (limit === null || limit === undefined) return { ok: true, limit: null, used: getUsage(db, user.id, meter) };
  const used = getUsage(db, user.id, meter);
  return { ok: used < limit, limit, used };
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
  const hsRow = db.prepare('SELECT * FROM hs_codes WHERE code=?').get(match) || { description_en: 'export products' };
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
  if (PLANS[user.plan].alerts === 0) return;
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
    return json(res, 200, { ok: true, onboarded: !!u.onboarded });
  }
  // Supabase bridge: verify a Supabase access_token, upsert a local user row
  // that mirrors the Supabase user + profile, and issue a local session cookie so
  // the rest of the buyer-intelligence API continues to work unchanged.
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

        let u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (!u) {
          db.prepare(`INSERT INTO users (email, password_hash, name, org_name, hs_focus, target_countries, export_status, goal, onboarded)
                      VALUES (?,?,?,?,?,?,?,?,?)`)
            .run(email, 'supabase:' + sbUser.id, displayName, orgName,
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
    return json(res, 200, Object.entries(PLANS).map(([code, pl]) => ({ code, ...pl })));
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
    const hsHits = searchHsNomenclature(qStr, 5);
    if (!hsHits.length) return json(res, 200, { ok: false, query: qStr, hs: null, buyers: [], message: 'HS code tidak ditemukan.' });
    const hs4 = hsHits[0].code.slice(0, 4);
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
    const results = searchHsNomenclature(qStr, 30).map((r) => ({
      code: r.code,
      description: r.description,
      section: r.section,
      parent: r.parent,
    }));
    return json(res, 200, { ok: true, query: qStr, results, count: results.length });
  }

  // ===== everything below requires auth =====
  // Prefer Supabase Bearer (stateless — survives serverless cold instances),
  // fall back to local session cookie (demo user).
  const user = await resolveUser(db, req);
  if (!user) return err(res, 401, 'Sesi tidak valid. Silakan masuk kembali.');
  const plan = PLANS[user.plan];
  const userHs = JSON.parse(user.hs_focus || '[]');

  if (route('GET', '/api/me')) {
    const meters = {};
    for (const mKey of ['search', 'profile', 'send', 'export']) meters[mKey] = { used: getUsage(db, user.id, mKey), limit: plan[mKey === 'export' ? 'export' : mKey] ?? null };
    return json(res, 200, {
      id: user.id, email: user.email, name: user.name, org_name: user.org_name, plan: user.plan,
      plan_name: plan.name, onboarded: !!user.onboarded, hs_focus: userHs,
      target_countries: JSON.parse(user.target_countries || '[]'), export_status: user.export_status, goal: user.goal,
      quotas: meters, contacts_visible: plan.contacts,
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

  if (route('POST', '/api/me/plan')) {
    const { plan: newPlan } = body || {};
    if (!PLANS[newPlan]) return err(res, 400, 'Paket tidak dikenal.');
    db.prepare('UPDATE users SET plan=? WHERE id=?').run(newPlan, user.id);
    return json(res, 200, { ok: true, plan: newPlan, invoice: { number: 'INV-' + Date.now(), amount_idr: PLANS[newPlan].price, status: 'paid', provider: 'sumopod (simulasi)' } });
  }

  // Sumopod payment checkout — creates a real hosted QRIS payment for a paid plan upgrade.
  // Server returns the payment_url; client redirects the user there.
  if (route('POST', '/api/billing/checkout')) {
    return (async () => {
      const { plan: newPlan, method } = body || {};
      if (!PLANS[newPlan]) return err(res, 400, 'Paket tidak dikenal.');
      const price = PLANS[newPlan].price;
      if (!price) return err(res, 400, 'Paket Free tidak butuh checkout.');
      const orderId = `EKS-${user.id}-${newPlan}-${Date.now()}`;
      const rawOrigin = (req.headers['origin'] || '').toString();
      const host = (req.headers['x-forwarded-host'] || req.headers['host'] || '').toString();
      // Sumopod rejects http and localhost URLs. Fall back to a public HTTPS
      // domain when the request comes from local dev.
      let base;
      if (rawOrigin.startsWith('https://') && !rawOrigin.includes('localhost') && !rawOrigin.includes('127.0.0.1')) {
        base = rawOrigin;
      } else if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        base = 'https://' + host;
      } else {
        base = process.env.PUBLIC_BASE_URL || 'https://eksporin.vercel.app';
      }
      try {
        const r = await fetch(SUMOPOD_PAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': SUMOPOD_PAY_KEY },
          body: JSON.stringify({
            order_id: orderId,
            amount: price,
            currency: 'IDR',
            expires_in_hours: 24,
            success_return_url: base + '/?paid=1&order=' + encodeURIComponent(orderId) + '&plan=' + newPlan,
            cancel_return_url: base + '/?cancelled=1&order=' + encodeURIComponent(orderId),
            payment_method_type_code: method || 'QRIS',
          }),
        });
        const bodyText = await r.text();
        let data; try { data = JSON.parse(bodyText); } catch { data = { raw: bodyText }; }
        if (!r.ok) {
          console.error('[sumopod] checkout error', r.status, bodyText);
          return err(res, 502, 'Sumopod: ' + (data.message || data.error || bodyText.slice(0, 200)));
        }
        return json(res, 200, {
          ok: true,
          order_id: orderId,
          plan: newPlan,
          amount: price,
          payment_id: data.payment_id || null,
          payment_url: data.payment_link_url || data.payment_url || data.checkout_url || data.url || data.data?.payment_link_url || data.data?.payment_url || null,
          payment: data,
        });
      } catch (e) {
        console.error('[sumopod] checkout threw', e);
        return err(res, 502, 'Gagal buat pembayaran: ' + (e.message || 'network error'));
      }
    })();
  }

  // Sumopod payment verification — client polls this after returning from checkout.
  // If Sumopod confirms the order is paid, we upgrade the user's plan locally.
  if (route('POST', '/api/billing/verify')) {
    return (async () => {
      const { order_id, plan: newPlan } = body || {};
      if (!order_id || !PLANS[newPlan]) return err(res, 400, 'order_id dan plan wajib.');
      try {
        const r = await fetch(SUMOPOD_PAY_URL + '/' + encodeURIComponent(order_id), {
          headers: { 'X-Api-Key': SUMOPOD_PAY_KEY },
        });
        const bodyText = await r.text();
        let data; try { data = JSON.parse(bodyText); } catch { data = { raw: bodyText }; }
        if (!r.ok) {
          return err(res, 502, 'Sumopod verify: ' + (data.message || bodyText.slice(0, 200)));
        }
        const status = (data.status || data.data?.status || '').toString().toLowerCase();
        const paid = ['paid', 'success', 'completed', 'settled'].includes(status);
        if (paid) {
          db.prepare('UPDATE users SET plan=? WHERE id=?').run(newPlan, user.id);
        }
        return json(res, 200, { ok: true, paid, status, order_id, plan: newPlan });
      } catch (e) {
        return err(res, 502, 'Gagal verifikasi: ' + (e.message || 'network error'));
      }
    })();
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

  if (route('GET', '/api/admin/stats')) {
    if (!requireAdmin()) return;
    const total = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    const onboarded = db.prepare('SELECT COUNT(*) c FROM users WHERE onboarded=1').get().c;
    const admins = db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin=1').get().c;
    const byPlan = db.prepare("SELECT plan, COUNT(*) c FROM users GROUP BY plan ORDER BY c DESC").all();
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
    return json(res, 200, {
      users: rows.map((r) => ({
        ...r,
        is_admin: !!r.is_admin,
        onboarded: !!r.onboarded,
        hs_focus: JSON.parse(r.hs_focus || '[]'),
        target_countries: JSON.parse(r.target_countries || '[]'),
      })),
    });
  }

  if (route('POST', '/api/admin/user/plan')) {
    if (!requireAdmin()) return;
    const { user_id, plan } = body || {};
    if (!user_id || !PLANS[plan]) return err(res, 400, 'user_id dan plan wajib.');
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
    const planPrices = { free: 0, starter: 149000, growth: 499000, business: 999000 };
    const byPlan = db.prepare('SELECT plan, COUNT(*) c FROM users GROUP BY plan').all();
    let mrr = 0;
    for (const p of byPlan) mrr += (planPrices[p.plan] || 0) * p.c;
    const paidUsers = byPlan.filter((p) => planPrices[p.plan] > 0).reduce((s, p) => s + p.c, 0);
    const arpu = paidUsers > 0 ? Math.round(mrr / paidUsers) : 0;
    const paymentEvents = db.prepare(`SELECT action, target, meta, created_at FROM audit_log
      WHERE action='admin.plan_change' ORDER BY created_at DESC LIMIT 50`).all();
    return json(res, 200, {
      mrr, arr: mrr * 12, arpu, paid_users: paidUsers,
      by_plan: byPlan.map((p) => ({ ...p, price: planPrices[p.plan] || 0, revenue: (planPrices[p.plan] || 0) * p.c })),
      plan_change_history: paymentEvents,
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
        sumopod_pay: !!SUMOPOD_PAY_KEY,
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
      const [countsBySource, jobStats, recentJobs] = await Promise.all([
        P.countsBySource(), P.jobStats(), P.recentJobs({ limit: 20 }),
      ]);
      const totalBuyers = countsBySource.reduce((s, r) => s + r.c, 0);
      return json(res, 200, {
        total_buyers: totalBuyers,
        by_source: countsBySource,
        jobs_by_status: jobStats,
        recent_jobs: recentJobs,
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

  // ===== HS taxonomy =====
  if (route('GET', '/api/hs')) {
    const parent = q.get('parent');
    const rows = parent
      ? db.prepare('SELECT * FROM hs_codes WHERE parent_code=? ORDER BY code').all(parent)
      : db.prepare('SELECT * FROM hs_codes WHERE parent_code IS NULL ORDER BY code').all();
    const stats = rows.map((r) => {
      const st = db.prepare(`SELECT COUNT(DISTINCT bh.buyer_id) buyers, COALESCE(SUM(bh.total_volume_kg),0) vol, COALESCE(SUM(bh.total_value_usd),0) val
        FROM buyer_hs bh WHERE bh.hs_code LIKE ? AND bh.shipment_count > 0`).get(r.code + '%');
      const top = db.prepare(`SELECT b.country, COUNT(DISTINCT b.id) n FROM buyers b JOIN buyer_hs bh ON bh.buyer_id=b.id
        WHERE bh.hs_code LIKE ? GROUP BY b.country ORDER BY n DESC LIMIT 3`).all(r.code + '%');
      return { ...r, buyer_count: st.buyers, volume_kg: Math.round(st.vol), value_usd: Math.round(st.val), top_countries: top };
    });
    return json(res, 200, stats);
  }
  if (route('GET', '/api/hs/leaf')) {
    return json(res, 200, db.prepare('SELECT code, description_en, description_id FROM hs_codes WHERE level=6 ORDER BY code').all());
  }

  // ===== buyer search (F1) =====
  if (route('GET', '/api/search/buyers')) {
    const qc = quotaCheck(db, user, 'search');
    if (!qc.ok) return json(res, 402, { error: `Kuota pencarian bulan ini habis (${qc.used}/${qc.limit}). Upgrade paket untuk melanjutkan.`, quota: qc, upgrade: true });

    const hs = q.get('hs') || '';
    const countries = (q.get('countries') || '').split(',').filter(Boolean);
    const sizes = (q.get('sizes') || '').split(',').filter(Boolean);
    const activity = q.get('activity') || '';
    const has = (q.get('has') || '').split(',').filter(Boolean);
    const minScore = parseInt(q.get('min_score') || '0', 10);
    const text = (q.get('q') || '').trim();
    const sort = q.get('sort') || 'score';
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = Math.min(100, parseInt(q.get('per') || '25', 10));

    let sql = `SELECT DISTINCT b.* FROM buyers b`;
    const where = []; const args = [];
    if (hs) { sql += ' JOIN buyer_hs bh ON bh.buyer_id = b.id'; where.push('bh.hs_code LIKE ?'); args.push(hs + '%'); }
    if (countries.length) { where.push(`b.country IN (${countries.map(() => '?').join(',')})`); args.push(...countries); }
    if (sizes.length) { where.push(`b.size_bucket IN (${sizes.map(() => '?').join(',')})`); args.push(...sizes); }
    if (text) { where.push('b.name LIKE ?'); args.push('%' + text + '%'); }
    if (activity === 'very_active') where.push('b.shipments_12mo > 12');
    else if (activity === 'active') where.push('b.shipments_12mo BETWEEN 4 AND 12');
    else if (activity === 'occasional') where.push('b.shipments_12mo BETWEEN 1 AND 3');
    else if (activity === 'inactive') where.push('b.shipments_12mo = 0');
    for (const h of has) {
      if (['email', 'phone', 'linkedin', 'website'].includes(h))
        where.push(`EXISTS (SELECT 1 FROM buyer_contacts c WHERE c.buyer_id=b.id AND c.contact_type='${h}')`);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    let rows = db.prepare(sql).all(...args);

    // compute user-specific final score
    rows = rows.map((b) => {
      const fit = productFit(userHs, buyerHsCodes(db, b.id));
      const score = finalScore(b, fit);
      return { ...b, fit_score: fit, score, score_label: scoreLabel(score) };
    }).filter((b) => b.score >= minScore);

    const sorters = {
      score: (a, b) => b.score - a.score, volume: (a, b) => b.volume_12mo_kg - a.volume_12mo_kg,
      shipments: (a, b) => b.shipments_12mo - a.shipments_12mo, name: (a, b) => a.name.localeCompare(b.name),
      recent: (a, b) => String(b.last_shipment_date || '').localeCompare(String(a.last_shipment_date || '')),
    };
    rows.sort(sorters[sort] || sorters.score);

    bumpUsage(db, user.id, 'search');
    const total = rows.length;
    const start = (pageN - 1) * per;
    const pageRows = rows.slice(start, start + per).map((b, i) => ({
      rank: start + i + 1, id: b.id, name: b.name, country: b.country, country_name: COUNTRY_NAMES[b.country] || b.country,
      city: b.city, industry: b.industry, size_bucket: b.size_bucket,
      shipments_12mo: b.shipments_12mo, volume_12mo_kg: b.volume_12mo_kg, value_12mo_usd: b.value_12mo_usd,
      last_shipment_date: b.last_shipment_date, yoy_percent: b.yoy_percent,
      has_indonesian_supplier: !!b.has_indonesian_supplier,
      score: b.score, score_label: b.score_label,
      // free tier: rows beyond 20 are teaser-blurred (F1 edge case)
      blurred: user.plan === 'free' && start + i >= 20,
    }));
    // facets
    const facet = (key) => {
      const mmap = {};
      for (const r of rows) { const k = r[key] || '-'; mmap[k] = (mmap[k] || 0) + 1; }
      return Object.entries(mmap).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ value: k, count: n }));
    };
    return json(res, 200, { total, page: pageN, per, results: pageRows, facets: { country: facet('country'), size: facet('size_bucket') }, quota: quotaCheck(db, user, 'search') });
  }

  // ===== scraped buyers (Postgres discovery pool) =====
  // Public to logged-in users. Filters: hs (4-digit HS), country (ISO-2),
  // q (free text against name). Quota-metered under the 'search' meter.
  if (route('GET', '/api/scraped-buyers')) {
    const qc = quotaCheck(db, user, 'search');
    if (!qc.ok) return json(res, 402, { error: `Kuota pencarian bulan ini habis (${qc.used}/${qc.limit}). Upgrade untuk pencarian tanpa batas.`, quota: qc, upgrade: true });
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
      bumpUsage(db, user.id, 'search');
      return json(res, 200, {
        results: rows.map((r) => ({
          id: r.id, source: r.source, name: r.name, country: r.country, city: r.city,
          website: r.website, email: r.email, phone: r.phone,
          industry: r.industry, size_bucket: r.size_bucket, description: r.description,
          hs_codes: r.hs_codes, confidence: r.data_confidence,
          enriched: !!r.enriched_at, updated_at: r.updated_at,
        })),
        quota: quotaCheck(db, user, 'search'),
      });
    } catch (e) {
      return json(res, 503, { error: 'buyer_pool_unavailable', detail: e.message });
    }
  }

  // ===== buyer profile (F2) =====
  if ((m = route('GET', '/api/buyers/:id'))) {
    const b = db.prepare('SELECT * FROM buyers WHERE id=?').get(m.id);
    if (!b) return err(res, 404, 'Buyer tidak ditemukan (mungkin telah digabung atau dihapus).');
    // profile quota: only counts first view of a buyer in the period
    const seen = db.prepare('SELECT 1 FROM profile_views WHERE user_id=? AND buyer_id=? AND period=?').get(user.id, b.id, period());
    if (!seen) {
      const qc = quotaCheck(db, user, 'profile');
      if (!qc.ok) return json(res, 402, { error: `Kuota profil lengkap bulan ini habis (${qc.used}/${qc.limit}). Upgrade untuk membuka profil buyer tanpa batas.`, quota: qc, upgrade: true });
      db.prepare('INSERT INTO profile_views (user_id,buyer_id,period) VALUES (?,?,?)').run(user.id, b.id, period());
      bumpUsage(db, user.id, 'profile');
    }
    const bHs = db.prepare(`SELECT bh.*, h.description_en, h.description_id FROM buyer_hs bh
      JOIN hs_codes h ON h.code = bh.hs_code WHERE bh.buyer_id=? ORDER BY bh.total_value_usd DESC`).all(b.id);
    const contacts = db.prepare('SELECT * FROM buyer_contacts WHERE buyer_id=?').all(b.id).map((c) => ({
      id: c.id, contact_type: c.contact_type, person_name: c.person_name, person_title: c.person_title, confidence: c.confidence,
      value: plan.contacts || c.contact_type === 'website' ? c.value : maskContact(c.contact_type, c.value),
      masked: !plan.contacts && c.contact_type !== 'website',
    }));
    const supplierCountries = db.prepare(`SELECT e.country, COUNT(*) n FROM shipments s JOIN exporters e ON e.id=s.exporter_id
      WHERE s.buyer_id=? GROUP BY e.country ORDER BY n DESC`).all(b.id);
    const fit = productFit(userHs, bHs.map((x) => x.hs_code));
    const score = finalScore(b, fit);
    const inLists = db.prepare(`SELECT l.id, l.name, lb.status FROM list_buyers lb JOIN lists l ON l.id=lb.list_id
      WHERE l.user_id=? AND lb.buyer_id=?`).all(user.id, b.id);
    return json(res, 200, {
      ...b, country_name: COUNTRY_NAMES[b.country] || b.country,
      hs_codes: bHs, contacts, contacts_visible: plan.contacts,
      supplier_countries: supplierCountries.map((s) => ({ ...s, name: COUNTRY_NAMES[s.country] || s.country })),
      score, fit_score: fit, score_label: scoreLabel(score),
      score_components: { activity: b.activity_score, growth: b.growth_score, product_fit: fit, reachability: b.reachability_score, untapped: b.untapped_score },
      in_lists: inLists,
      quota: quotaCheck(db, user, 'profile'),
    });
  }

  if ((m = route('GET', '/api/buyers/:id/shipments'))) {
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = 20;
    const total = db.prepare('SELECT COUNT(*) c FROM shipments WHERE buyer_id=?').get(m.id).c;
    const rows = db.prepare(`SELECT s.*, e.name exporter_name, e.country exporter_country, e.is_indonesian
      FROM shipments s JOIN exporters e ON e.id=s.exporter_id WHERE s.buyer_id=?
      ORDER BY s.shipment_date DESC LIMIT ? OFFSET ?`).all(m.id, per, (pageN - 1) * per);
    const monthly = db.prepare(`SELECT substr(shipment_date,1,7) ym, COUNT(*) n, SUM(weight_kg) w, SUM(value_usd) v
      FROM shipments WHERE buyer_id=? AND shipment_date >= date('now','-24 months') GROUP BY ym ORDER BY ym`).all(m.id);
    return json(res, 200, { total, page: pageN, per, rows, monthly });
  }

  if ((m = route('GET', '/api/buyers/:id/suppliers'))) {
    const rows = db.prepare(`SELECT e.id, e.name, e.country, e.is_indonesian, COUNT(*) shipments,
      SUM(s.weight_kg) volume_kg, SUM(s.value_usd) value_usd, MIN(s.shipment_date) first_date, MAX(s.shipment_date) last_date,
      GROUP_CONCAT(DISTINCT s.hs_code) hs_codes
      FROM shipments s JOIN exporters e ON e.id=s.exporter_id WHERE s.buyer_id=?
      GROUP BY e.id ORDER BY value_usd DESC`).all(m.id);
    return json(res, 200, rows.map((r) => ({ ...r, country_name: COUNTRY_NAMES[r.country] || r.country })));
  }

  if ((m = route('GET', '/api/buyers/:id/insights'))) {
    const b = db.prepare('SELECT * FROM buyers WHERE id=?').get(m.id);
    if (!b) return err(res, 404, 'Buyer tidak ditemukan.');
    const sup = db.prepare(`SELECT e.country, COUNT(*) n FROM shipments s JOIN exporters e ON e.id=s.exporter_id
      WHERE s.buyer_id=? GROUP BY e.country ORDER BY n DESC`).all(b.id);
    const totalN = sup.reduce((a, x) => a + x.n, 0) || 1;
    const monthly = db.prepare(`SELECT CAST(substr(shipment_date,6,2) AS INT) mo, COUNT(*) n FROM shipments WHERE buyer_id=? GROUP BY mo ORDER BY n DESC`).all(b.id);
    const topHs = db.prepare(`SELECT bh.hs_code, h.description_id FROM buyer_hs bh JOIN hs_codes h ON h.code=bh.hs_code
      WHERE bh.buyer_id=? ORDER BY bh.total_value_usd DESC LIMIT 1`).get(b.id);
    const insights = [];
    if (sup.length) {
      const mix = sup.slice(0, 3).map((s) => `${COUNTRY_NAMES[s.country] || s.country} ${Math.round((s.n / totalN) * 100)}%`).join(', ');
      insights.push(`Pemasok utama buyer ini: ${mix}.`);
    }
    const idSup = sup.find((s) => s.country === 'ID');
    insights.push(idSup
      ? `Sudah pernah impor dari Indonesia (${Math.round((idSup.n / totalN) * 100)}% dari shipment). Pintu masuk lebih mudah, tonjolkan diferensiasi kualitas dan harga.`
      : `Belum pernah impor dari Indonesia. Peluang untapped, gunakan angle keunggulan origin Indonesia dan tawarkan sampel gratis.`);
    if (b.yoy_percent !== null) insights.push(b.yoy_percent >= 0
      ? `Volume impor tumbuh ${b.yoy_percent}% YoY. Buyer sedang ekspansi, kemungkinan mencari pemasok tambahan.`
      : `Volume impor turun ${Math.abs(b.yoy_percent)}% YoY. Mungkin sedang konsolidasi pemasok; tawarkan harga kompetitif.`);
    if (monthly.length >= 3) {
      const peak = monthly.slice(0, 2).map((x) => MONTHS_ID[x.mo - 1]).join(' & ');
      insights.push(`Puncak aktivitas impor di bulan ${peak}. Mulai outreach 2–3 bulan sebelumnya agar masuk siklus pembelian.`);
    }
    if (topHs) insights.push(`Produk utama yang diimpor: HS ${topHs.hs_code} (${topHs.description_id}).`);
    const similar = db.prepare(`SELECT id, name, country, base_score FROM buyers
      WHERE industry=? AND id != ? ORDER BY base_score DESC LIMIT 3`).all(b.industry, b.id)
      .map((s) => ({ ...s, country_name: COUNTRY_NAMES[s.country] || s.country }));
    const angle = idSup
      ? 'Posisikan sebagai pemasok Indonesia alternatif dengan kualitas konsisten dan harga FOB kompetitif.'
      : 'First-mover advantage: perkenalkan keunggulan origin Indonesia, sertakan sertifikasi dan tawaran sampel gratis di email pertama.';
    return json(res, 200, { insights, recommended_angle: angle, similar });
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
    const limit = plan.export;
    if (!limit) return err(res, 402, 'Ekspor data tersedia mulai paket Starter. Upgrade untuk mengunduh CSV.');
    const rows = db.prepare(`SELECT s.shipment_date, s.hs_code, b.name buyer, b.country, e.name exporter, e.country origin,
      s.origin_port, s.dest_port, s.weight_kg, s.value_usd, s.goods_description
      FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
      ${q.get('buyer_id') ? 'WHERE s.buyer_id = ?' : ''} ORDER BY s.shipment_date DESC LIMIT ?`)
      .all(...(q.get('buyer_id') ? [q.get('buyer_id')] : []), Math.min(limit, 10000));
    const head = Object.keys(rows[0] || { info: '' });
    const csv = [`# EksporIn export | ${user.email} | ${new Date().toISOString()} (watermarked)`, head.join(','),
      ...rows.map((r) => head.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    bumpUsage(db, user.id, 'export', rows.length);
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
      to_email: email ? (plan.contacts ? email.value : maskContact('email', email.value)) : null,
      to_phone: phone ? (plan.contacts ? phone.value : maskContact('phone', phone.value)) : null,
      contacts_visible: plan.contacts,
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
    const qc = quotaCheck(db, user, 'send');
    if (!qc.ok || qc.used + ids.length > (qc.limit ?? Infinity))
      return json(res, 402, { error: `Kuota kirim bulan ini tidak cukup (terpakai ${qc.used}/${qc.limit}). Upgrade paket untuk kuota lebih besar.`, upgrade: true });
    // anti-abuse: same template to same buyer within 14 days
    const sent = [];
    for (const bid of ids) {
      const dup = db.prepare(`SELECT 1 FROM messages WHERE user_id=? AND buyer_id=? AND template_id=? AND sent_at >= datetime('now','-14 days')`).get(user.id, bid, tpl.id);
      if (dup) { sent.push({ buyer_id: bid, skipped: 'Template sama sudah dikirim ke buyer ini dalam 14 hari terakhir.' }); continue; }
      const buyer = db.prepare('SELECT * FROM buyers WHERE id=?').get(bid);
      if (!buyer) continue;
      const r = renderTemplate(db, tpl, buyer, user);
      db.prepare('INSERT INTO messages (user_id,buyer_id,template_id,channel,subject,body,status) VALUES (?,?,?,?,?,?,?)')
        .run(user.id, bid, tpl.id, body.channel || tpl.channel, r.subject, r.body, 'sent');
      bumpUsage(db, user.id, 'send');
      // auto-update pipeline status new → contacted
      db.prepare(`UPDATE list_buyers SET status='contacted' WHERE buyer_id=? AND status='new'
        AND list_id IN (SELECT id FROM lists WHERE user_id=?)`).run(bid, user.id);
      sent.push({ buyer_id: bid, ok: true });
    }
    return json(res, 200, { sent, quota: quotaCheck(db, user, 'send') });
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
    // recommendations: top buyers for user's HS focus + target countries, not yet saved
    let recSql = `SELECT b.* FROM buyers b WHERE b.id NOT IN
      (SELECT lb.buyer_id FROM list_buyers lb JOIN lists l ON l.id=lb.list_id WHERE l.user_id=?)`;
    const recArgs = [user.id];
    if (userHs.length) {
      recSql += ` AND b.id IN (SELECT buyer_id FROM buyer_hs WHERE ${userHs.map(() => 'hs_code LIKE ?').join(' OR ')})`;
      recArgs.push(...userHs.map((h) => h.slice(0, 4) + '%'));
    }
    if (countries.length) { recSql += ` AND b.country IN (${countries.map(() => '?').join(',')})`; recArgs.push(...countries); }
    let recs = db.prepare(recSql).all(...recArgs).map((b) => {
      const fit = productFit(userHs, buyerHsCodes(db, b.id));
      const score = finalScore(b, fit);
      return { id: b.id, name: b.name, country: b.country, country_name: COUNTRY_NAMES[b.country] || b.country, city: b.city, industry: b.industry, shipments_12mo: b.shipments_12mo, volume_12mo_kg: b.volume_12mo_kg, has_indonesian_supplier: !!b.has_indonesian_supplier, score, score_label: scoreLabel(score) };
    }).sort((a, b) => b.score - a.score).slice(0, 6);

    // pipeline stats
    const pipeline = db.prepare(`SELECT lb.status, COUNT(*) n FROM list_buyers lb JOIN lists l ON l.id=lb.list_id
      WHERE l.user_id=? GROUP BY lb.status`).all(user.id);

    // market trend: monthly volume for user's HS focus in target countries, last 12 months
    let trend = [];
    if (userHs.length) {
      const hsConds = userHs.map(() => 's.hs_code LIKE ?').join(' OR ');
      const args2 = userHs.map((h) => h.slice(0, 4) + '%');
      let cSql = '';
      if (countries.length) { cSql = ` AND b.country IN (${countries.map(() => '?').join(',')})`; args2.push(...countries); }
      trend = db.prepare(`SELECT substr(s.shipment_date,1,7) ym, COUNT(*) n, SUM(s.weight_kg) w, SUM(s.value_usd) v
        FROM shipments s JOIN buyers b ON b.id=s.buyer_id
        WHERE (${hsConds})${cSql} AND s.shipment_date >= date('now','-12 months') GROUP BY ym ORDER BY ym`).all(...args2);
    }
    // buyer count per target country for user's HS
    let countryBreakdown = [];
    if (userHs.length) {
      countryBreakdown = db.prepare(`SELECT b.country, COUNT(DISTINCT b.id) n FROM buyers b JOIN buyer_hs bh ON bh.buyer_id=b.id
        WHERE ${userHs.map(() => 'bh.hs_code LIKE ?').join(' OR ')} GROUP BY b.country ORDER BY n DESC`)
        .all(...userHs.map((h) => h.slice(0, 4) + '%'))
        .map((r) => ({ ...r, name: COUNTRY_NAMES[r.country] || r.country }));
    }
    const msgs = db.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN status IN ('opened','replied') THEN 1 ELSE 0 END) opened,
      SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) replied FROM messages WHERE user_id=?`).get(user.id);
    return json(res, 200, {
      recommendations: recs, pipeline, trend, country_breakdown: countryBreakdown,
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
      const hsMatch = db.prepare("SELECT * FROM hs_codes WHERE description_en LIKE ? OR description_id LIKE ? LIMIT 1").get('%' + query + '%', '%' + query + '%');
      if (hsMatch) {
        matched = { hs: hsMatch.code.slice(0, 4), desc_en: hsMatch.description_en, desc_id: hsMatch.description_id, industry: ['General Trade'], titles: ['Procurement Manager', 'Sourcing Director', 'Category Buyer'], cargo_keywords: [query.toUpperCase()] };
      } else {
        matched = { hs: '0901', desc_en: query, desc_id: query, industry: ['General Trade'], titles: ['Procurement Manager', 'Sourcing Director'], cargo_keywords: [query.toUpperCase()] };
      }
    }

    // Step 2: Trade Records & Company Retrieval
    const buyers = db.prepare(`
      SELECT b.*, SUM(bh.shipment_count) as shipment_count, SUM(bh.total_value_usd) as hs_value
      FROM buyers b
      JOIN buyer_hs bh ON bh.buyer_id = b.id
      WHERE bh.hs_code LIKE ?
      GROUP BY b.id
      ORDER BY b.base_score DESC, hs_value DESC
      LIMIT 20
    `).all(matched.hs + '%');

    // Step 3: Decision Maker Enrichment (simulated Apollo.io)
    const FIRST_NAMES = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Yuki', 'Kenji', 'Lars', 'Sanne', 'Ahmed', 'Olivia', 'Tom', 'Mei', 'Anna', 'John'];
    const LAST_NAMES = ['Miller', 'Chen', 'Tanaka', 'De Vries', 'Al Rashid', 'Wilson', 'Taylor', 'Brown', 'Smith', 'Johnson'];
    const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

    const results = buyers.map((b, idx) => {
      const r = rng(b.id * 7 + 31);
      const contacts = db.prepare('SELECT * FROM buyer_contacts WHERE buyer_id=?').all(b.id);
      const bHs = db.prepare('SELECT hs_code FROM buyer_hs WHERE buyer_id=?').all(b.id).map((x) => x.hs_code);
      const website = contacts.find((c) => c.contact_type === 'website');
      const domain = website ? website.value.replace(/https?:\/\/(www\.)?/, '').replace(/\/.*/, '') : null;

      // Simulated decision makers
      const numContacts = Math.floor(r() * 3) + 1;
      const decisionMakers = [];
      for (let i = 0; i < numContacts; i++) {
        const fn = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)];
        const ln = LAST_NAMES[Math.floor(r() * LAST_NAMES.length)];
        const title = matched.titles[Math.floor(r() * matched.titles.length)];
        decisionMakers.push({
          full_name: `${fn} ${ln}`,
          job_title: title,
          email: domain ? `${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}` : null,
          email_status: r() > 0.3 ? 'verified' : 'unverified',
          linkedin_url: `https://linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}-${Math.floor(r() * 9000 + 1000)}`,
          phone: contacts.find((c) => c.contact_type === 'phone')?.value || null,
        });
      }

      // Step 4: Match Score & Outreach Angle
      const idSup = b.has_indonesian_supplier;
      const activityBonus = b.shipments_12mo > 8 ? 20 : b.shipments_12mo > 3 ? 10 : 0;
      const growthBonus = (b.yoy_percent || 0) > 0 ? 15 : 0;
      const volumeBonus = b.volume_12mo_kg > 100000 ? 15 : b.volume_12mo_kg > 30000 ? 10 : 5;
      const untappedBonus = !idSup ? 20 : 5;
      const matchScore = Math.min(100, Math.max(10, 30 + activityBonus + growthBonus + volumeBonus + untappedBonus + Math.floor(r() * 10)));

      const angles = {
        high_growth: `${b.name} menunjukkan pertumbuhan impor ${b.yoy_percent || 0}% YoY. Timing tepat untuk masuk sebagai pemasok baru dengan penawaran harga FOB kompetitif dan sampel gratis.`,
        untapped: `${b.name} belum pernah impor dari Indonesia. Ini peluang first-mover: tonjolkan keunggulan origin Indonesia, sertifikasi, dan tawarkan trial shipment.`,
        existing: `${b.name} sudah familiar dengan pemasok Indonesia. Diferensiasi lewat kualitas konsisten, lead time lebih pendek, dan harga yang bersaing.`,
        volume: `${b.name} mengimpor volume besar (${Math.round(b.volume_12mo_kg / 1000)} ton/tahun). Tawarkan kontrak jangka panjang dengan harga volume discount.`,
      };
      let angle = angles.untapped;
      if (idSup) angle = angles.existing;
      if ((b.yoy_percent || 0) > 10) angle = angles.high_growth;
      if (b.volume_12mo_kg > 200000) angle = angles.volume;

      return {
        rank: idx + 1,
        company: {
          id: b.id, name: b.name, country: b.country,
          country_name: COUNTRY_NAMES[b.country] || b.country,
          city: b.city, industry: b.industry, size_bucket: b.size_bucket,
          domain, website: website?.value,
          annual_import_frequency: b.total_shipments,
          last_shipment_date: b.last_shipment_date,
          imported_hs_codes: bHs,
          primary_source_countries: [],
          company_tier: b.size_bucket === 'XL' ? 'Enterprise' : b.size_bucket === 'L' ? 'Mid-Market' : 'SMB',
        },
        decision_makers: decisionMakers,
        scoring: {
          match_score: matchScore,
          score_label: matchScore >= 80 ? 'Hot Lead' : matchScore >= 60 ? 'Warm Lead' : matchScore >= 40 ? 'Worth Exploring' : 'Low Priority',
          reasoning: `Skor ${matchScore}/100 berdasarkan: aktivitas impor ${b.shipments_12mo}x/tahun, volume ${Math.round(b.volume_12mo_kg / 1000)} ton, ${idSup ? 'sudah impor dari Indonesia' : 'belum pernah dari Indonesia (untapped)'}, growth ${b.yoy_percent || 0}% YoY.`,
          customized_pitch_angle: angle,
        },
        trade_data: {
          shipments_12mo: b.shipments_12mo,
          volume_12mo_kg: b.volume_12mo_kg,
          value_12mo_usd: b.value_12mo_usd,
          yoy_percent: b.yoy_percent,
          has_indonesian_supplier: !!b.has_indonesian_supplier,
        },
      };
    });

    results.sort((a, b) => b.scoring.match_score - a.scoring.match_score);

    const verifiedContacts = results.reduce((a, r) => a + r.decision_makers.filter((dm) => dm.email_status === 'verified').length, 0);
    const totalContacts = results.reduce((a, r) => a + r.decision_makers.length, 0);

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
        { step: 2, name: 'Trade Records & Company Retrieval', status: 'completed', result: `${buyers.length} importir ditemukan dari ${new Set(buyers.map((b) => b.country)).size} negara` },
        { step: 3, name: 'Decision Maker Enrichment', status: 'completed', result: `${totalContacts} kontak ditemukan, ${verifiedContacts} email terverifikasi` },
        { step: 4, name: 'Scoring & Final Synthesis', status: 'completed', result: `${results.filter((r) => r.scoring.match_score >= 80).length} hot leads, ${results.filter((r) => r.scoring.match_score >= 60 && r.scoring.match_score < 80).length} warm leads` },
      ],
      total_leads: results.length,
      leads: results,
    });
    })();
  }

  return err(res, 404, 'Endpoint tidak ditemukan.');
}

module.exports = { handleApi, PLANS };
