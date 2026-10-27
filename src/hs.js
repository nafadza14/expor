'use strict';
// Full Harmonized System in Indonesian and English (data/hs-id.json, built
// from BTKI 2022 by scripts/build-hs.js): 97 chapters, 1.238 headings,
// 5.670 subheadings (6 digit) and 11.546 national lines (8 digit).
//
// search() understands everyday Indonesian ("kopi sangrai", "udang beku",
// "gula aren", "mebel rotan"), formal BTKI wording, English, and codes
// ("0901", "0901.11", "09011120").

const fs = require('node:fs');
const path = require('node:path');

let NODES = null;   // [{c,l,p,i,e,pi,pe,h}]
let BY_CODE = null; // Map code -> node
let KIDS = null;    // Map parent -> [codes]
let INDEX = null;   // [{n, own, ctx, head, en, enctx}] normalised text

const norm = (s) => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

function load() {
  if (NODES) return NODES;
  NODES = []; BY_CODE = new Map(); KIDS = new Map(); INDEX = [];
  try {
    const file = path.join(__dirname, '..', 'data', 'hs-id.json');
    NODES = JSON.parse(fs.readFileSync(file, 'utf8')).nodes || [];
  } catch (e) { console.warn('[hs] data/hs-id.json not loaded:', e.message); NODES = []; }
  for (const n of NODES) {
    BY_CODE.set(n.c, n);
    const k = n.p || '';
    if (!KIDS.has(k)) KIDS.set(k, []);
    KIDS.get(k).push(n.c);
  }
  for (const n of NODES) {
    const head = n.h ? BY_CODE.get(n.h) : null;
    INDEX.push({
      n,
      own: norm(n.i), ctx: norm(n.pi), head: norm(head ? head.i : ''),
      en: norm(n.e), enctx: norm((n.pe || '') + ' ' + (head ? head.e : '')),
    });
  }
  return NODES;
}

function shortTitle(text, max = 70) {
  let t = String(text || '').split(';')[0].replace(/\.$/, '').trim();
  if (t.length > max) t = t.slice(0, max).replace(/[ ,][^ ,]*$/, '') + '…';
  return t;
}

// Human label: "Kopi, tidak digongseng › Tidak dihilangkan kafeinnya › Arabika".
// The heading is shown only when the line has no context of its own.
function label(n, lang = 'id') {
  if (!n) return '';
  const own = ((lang === 'id' ? n.i : n.e) || '').replace(/\.$/, '');
  if (n.l <= 4) return own;
  const generic = (t) => !norm(t).replace(/\b(lain lain|lainnya|other|others)\b/g, '').trim();
  const ctx = String((lang === 'id' ? n.pi : n.pe) || '').split(' › ').filter((p) => p && !generic(p)).join(' › ');
  const head = BY_CODE.get(n.h);
  const parts = [];
  if (head && (!ctx || generic(own))) parts.push(shortTitle(lang === 'id' ? head.i : head.e));
  else if (head && ctx.length < 15) parts.push(String((lang === 'id' ? head.i : head.e) || '').split(/[,;(]/)[0].trim());
  if (ctx) parts.push(ctx);
  parts.push(own);
  return parts.filter((p, i) => p && (i === 0 || norm(p) !== norm(parts[i - 1]))).join(' › ');
}

function get(code) {
  load();
  const c = String(code || '').replace(/\D/g, '');
  return BY_CODE.get(c) || null;
}

function view(n, extra = {}) {
  return {
    code: n.c, level: n.l, parent: n.p || null,
    description: label(n, 'id'), description_en: label(n, 'en'),
    title_id: (n.i || '').replace(/\.$/, ''), title_en: (n.e || '').replace(/\.$/, ''),
    has_children: (KIDS.get(n.c) || []).length > 0,
    ...extra,
  };
}

function children(parent) {
  load();
  const key = parent ? String(parent).replace(/\D/g, '') : '';
  return (KIDS.get(key) || []).map((c) => BY_CODE.get(c));
}

// Everyday Indonesian (and a few English) words -> wording used in BTKI.
const SYNONYMS = {
  'sangrai': ['digongseng', 'roasted'], 'disangrai': ['digongseng', 'roasted'], 'roasting': ['digongseng'],
  'biji kopi': ['kopi tidak digongseng'], 'green bean': ['kopi tidak digongseng'], 'kopi bubuk': ['kopi digongseng ditumbuk'],
  'kopi luwak': ['kopi'], 'kopi instan': ['ekstrak esens konsentrat kopi'],
  'vanili': ['vanila', 'vanilla'], 'merica': ['lada', 'pepper'], 'cengkih': ['cengkeh', 'cloves'],
  'kunyit': ['turmeric', 'curcuma'], 'temulawak': ['curcuma'], 'kencur': ['jahe'],
  'sereh': ['serai'], 'sereh wangi': ['serai'], 'minyak sereh': ['minyak atsiri serai'],
  'nilam': ['nilam', 'patchouli'], 'minyak nilam': ['minyak atsiri nilam'], 'minyak cengkeh': ['minyak atsiri cengkeh'],
  'kemenyan': ['getah alam damar resin'], 'gambir': ['ekstrak penyamak nabati'],
  'cokelat': ['coklat', 'kakao', 'chocolate'], 'coklat': ['kakao', 'chocolate'], 'biji coklat': ['biji kakao'],
  'gula aren': ['gula', 'palm sugar'], 'gula kelapa': ['gula', 'palm sugar'], 'gula semut': ['gula', 'palm sugar'], 'gula palma': ['gula'],
  'kelapa parut': ['kelapa dikeringkan', 'desiccated'], 'kelapa kering': ['kelapa dikeringkan'],
  'sabut': ['serat kelapa', 'coir'], 'sabut kelapa': ['serat kelapa', 'coir'], 'cocopeat': ['serat kelapa'],
  'arang kelapa': ['arang tempurung kelapa'], 'briket': ['briket'], 'arang': ['arang'],
  'minyak sawit': ['minyak kelapa sawit', 'palm oil'], 'cpo': ['minyak kelapa sawit mentah'], 'minyak goreng': ['minyak kelapa sawit dimurnikan'],
  'kacang mete': ['kacang mede', 'cashew'], 'mete': ['mede', 'cashew'], 'jambu mete': ['kacang mede'],
  'porang': ['konjac', 'umbi'], 'iles iles': ['konjac', 'umbi'], 'singkong': ['ubi kayu', 'cassava'], 'tapioka': ['tapioka', 'pati ubi kayu'],
  'walet': ['sarang burung'], 'sarang walet': ['sarang burung'],
  'udang vaname': ['udang', 'shrimps'], 'udang windu': ['udang', 'prawns'], 'rajungan': ['kepiting', 'crabs'],
  'cumi cumi': ['cumi cumi', 'squid'], 'teripang': ['teripang'], 'ikan kaleng': ['ikan olahan diawetkan'],
  'mebel': ['perabotan', 'furniture'], 'meubel': ['perabotan', 'furniture'], 'furnitur': ['perabotan', 'furniture'], 'furniture': ['perabotan'],
  'kursi': ['tempat duduk', 'seats'], 'sofa': ['tempat duduk'], 'meja': ['perabotan'], 'lemari': ['perabotan'],
  'kayu lapis': ['kayu lapis', 'plywood'], 'plywood': ['kayu lapis'], 'kayu jati': ['jati'],
  'kerajinan': ['anyaman', 'barang dari kayu', 'handicraft'], 'anyaman': ['anyaman', 'keranjang'], 'keranjang': ['keranjang', 'anyaman'],
  'sepatu': ['alas kaki', 'footwear'], 'sandal': ['alas kaki'], 'sneakers': ['alas kaki'],
  'tas': ['tas tangan', 'handbags'], 'dompet': ['dompet', 'wallets'],
  'kaos': ['t shirt singlet', 'kaos'], 'kaus': ['t shirt singlet'], 'baju': ['pakaian'], 'garmen': ['pakaian'], 'hijab': ['kerudung selendang'],
  'batik': ['batik'], 'kain batik': ['batik'], 'sarung': ['sarung'],
  'mi instan': ['mi', 'pasta'], 'mie': ['mi', 'pasta'], 'mie instan': ['mi', 'pasta'],
  'kerupuk': ['olahan pati makanan ringan'], 'keripik': ['keripik', 'kripik'], 'sambal': ['saus'], 'kecap': ['saus kedelai'],
  'emping': ['melinjo', 'emping'], 'santan': ['santan'],
  'jamu': ['obat tradisional'], 'herbal': ['obat tradisional'],
  'perhiasan': ['perhiasan', 'jewellery'], 'emas': ['emas'], 'perak': ['perak'],
  'kosmetik': ['kosmetik', 'tata rias'], 'sabun': ['sabun'],
  'batu bara': ['batu bara', 'coal'], 'batubara': ['batu bara'],
  'karet alam': ['karet alam', 'natural rubber'], 'lateks': ['lateks'],
};

// Code a commodity is usually exported under, when the everyday name is
// not in the tariff text.
const PREFERRED = {
  '330129': ['nilam', 'minyak nilam', 'patchouli', 'minyak atsiri', 'sereh wangi', 'minyak sereh', 'minyak cengkeh'],
  '170290': ['gula aren', 'gula kelapa', 'gula semut', 'gula palma', 'palm sugar', 'coconut sugar'],
  '030617': ['udang', 'udang beku', 'udang vaname', 'udang windu', 'shrimp', 'prawn'],
  '090111': ['kopi', 'biji kopi', 'kopi robusta', 'kopi arabika', 'kopi arabica', 'green coffee', 'green bean'],
  '071490': ['porang', 'iles iles', 'konjac'],
  '080132': ['kacang mete', 'mete', 'jambu mete', 'cashew'],
  '080111': ['kelapa parut', 'kelapa kering', 'desiccated coconut'],
  '530500': ['sabut', 'sabut kelapa', 'cocopeat', 'coir'],
  '440290': ['arang kelapa', 'arang tempurung'],
  '041090': ['walet', 'sarang walet', 'sarang burung'],
  '130190': ['kemenyan', 'damar'],
  '320190': ['gambir'],
  '940360': ['mebel', 'meubel', 'furnitur', 'furniture', 'mebel kayu', 'furnitur kayu', 'perabot kayu', 'furniture kayu'],
  '330499': ['kosmetik', 'skincare', 'perawatan kulit'], '200820': ['nanas kaleng', 'nanas olahan'],
  '460212': ['rotan', 'mebel rotan', 'anyaman rotan', 'kerajinan rotan'],
  '151190': ['minyak goreng'], '151110': ['cpo', 'minyak sawit mentah'],
  '180100': ['kakao', 'biji kakao', 'biji coklat', 'cocoa beans'],
  '090411': ['lada', 'merica', 'lada hitam', 'lada putih'],
  '090510': ['vanili', 'vanila', 'vanilla'],
  '090710': ['cengkeh', 'cengkih'], '090611': ['kayu manis'], '090811': ['pala'],
  '091011': ['jahe'], '091030': ['kunyit'],
  '160414': ['tuna kaleng', 'ikan kaleng'], '121221': ['rumput laut'],
  '090210': ['teh hijau'], '090230': ['teh hitam', 'teh'],
  '400122': ['karet', 'karet alam', 'sir 20'],
  '640299': ['sepatu', 'sandal'], '610910': ['kaos', 'kaus'],
};
const PREFERRED_BY_TERM = new Map();
for (const [code, terms] of Object.entries(PREFERRED)) for (const t of terms) {
  const k = norm(t);
  if (!PREFERRED_BY_TERM.has(k)) PREFERRED_BY_TERM.set(k, []);
  PREFERRED_BY_TERM.get(k).push(code);
}

const STOP = new Set(['dan', 'atau', 'yang', 'dari', 'untuk', 'dengan', 'di', 'ke', 'the', 'of', 'and', 'or', 'for', 'hs', 'code', 'kode', 'produk', 'barang', 'ekspor', 'export']);

function expand(query) {
  const q = norm(query).trim();
  const phrases = new Set([q]);
  for (const [k, alts] of Object.entries(SYNONYMS)) {
    if ((' ' + q + ' ').includes(' ' + k + ' ')) for (const a of alts) phrases.add(norm(a).trim());
  }
  return [...phrases].filter(Boolean);
}

function wordHit(text, w) {
  if (text.includes(' ' + w + ' ')) return 2;                     // whole word
  if (w.length >= 5 && text.includes(' ' + w)) return 1;          // prefix (typing in progress)
  return 0;
}

// levels: which code lengths to return (default 4, 6, 8).
function search(query, { limit = 30, levels = [4, 6, 8], boostHs4 = null } = {}) {
  load();
  const raw = String(query || '').trim();
  if (!raw) return [];
  const digits = raw.replace(/[\s.]/g, '');
  if (/^\d{2,8}$/.test(digits)) {
    const out = [];
    for (const n of NODES) {
      if (n.c.startsWith(digits) && levels.includes(n.l)) out.push(n);
      if (out.length >= limit) break;
    }
    return out.map((n) => view(n, { score: 100 }));
  }
  const phrases = expand(raw);
  const baseWords = norm(raw).trim().split(' ').filter((w) => w.length >= 2 && !STOP.has(w));
  if (!baseWords.length) return [];
  const altWords = [...new Set(phrases.slice(1).flatMap((p) => p.split(' ')).filter((w) => w.length >= 2 && !STOP.has(w)))];
  const preferred = new Set(PREFERRED_BY_TERM.get(norm(raw)) || []);
  const fullPhrase = norm(raw).trim();

  const scored = [];
  for (const x of INDEX) {
    const n = x.n;
    if (!levels.includes(n.l)) continue;
    let score = 0; let matched = 0;
    for (const w of baseWords) {
      const s = Math.max(wordHit(x.own, w) * 6, wordHit(x.ctx, w) * 4, wordHit(x.head, w) * 2.5, wordHit(x.en, w) * 3, wordHit(x.enctx, w) * 1.5);
      if (s > 0) { matched++; score += s; }
    }
    let alt = 0;
    for (const w of altWords) {
      alt = Math.max(alt, Math.max(wordHit(x.own, w) * 4, wordHit(x.ctx, w) * 3, wordHit(x.head, w) * 2, wordHit(x.en, w) * 2.5, wordHit(x.enctx, w) * 1.2));
    }
    if (!matched && !alt && !preferred.has(n.c)) continue;
    score += alt;
    if (matched === baseWords.length) score += 10;            // every word found
    if (fullPhrase.length > 3 && (x.own.startsWith(' ' + fullPhrase) || x.head.startsWith(' ' + fullPhrase))) score += 12;
    if (preferred.has(n.c)) score += 40;
    if (boostHs4 && boostHs4.has(n.c.slice(0, 4))) score += 20;
    if (n.l === 8) score -= 2;                                // prefer the international code
    if (x.own.includes(' lain lain ') && matched === 0) score -= 3;
    scored.push([score, n]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].c.localeCompare(b[1].c));
  return scored.slice(0, limit).map(([score, n]) => view(n, { score: Math.round(score) }));
}

module.exports = { load, get, children, search, label, view, norm, shortTitle, SYNONYMS, PREFERRED };
