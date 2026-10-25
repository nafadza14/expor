'use strict';
// On-demand contact finder (Node port of python_scrapers/enrich), used by
// the "Cari kontak" button on a buyer profile and by the admin console.
// Same rules as the batch enricher:
//   - find the company's own site: known website -> domain guess -> keyless search
//   - verify the site really belongs to the company (name on page, not parked)
//   - harvest email/phone from home + contact / Impressum / legal pages
//     (mailto, plain text, "[at]/(dot)" obfuscation, Cloudflare cfemail, JSON-LD)
//   - keep only emails on the company's own domain (or a free-mail box),
//     with a working MX record; never invent addresses.

const dns = require('node:dns').promises;

const MAX_BYTES = 400_000;
const TIMEOUT_MS = 7000;
const UA = 'Mozilla/5.0 (compatible; EksporInResearchBot/1.0; +https://ekspor.zieads.com)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function fetchText(url, { ua = UA, method = 'GET', body = null, headers = {} } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method, body, redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml,*/*', ...headers },
    });
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok || !/html|text/.test(ctype)) return null;
    const buf = await res.arrayBuffer();
    return { url: res.url || url, html: Buffer.from(buf.slice(0, MAX_BYTES)).toString('utf8') };
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#64;/g, '@').replace(/&#46;/g, '.');
}

function stripHtml(html) {
  if (!html) return '';
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeCf(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch { return null; }
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const OBF_RE = /([a-z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|\s+at\s+|\s*\[@\]\s*|\s*\(@\)\s*)\s*([a-z0-9-]+(?:(?:\.(?=[a-z0-9])|\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+|\(\s*punkt\s*\)|\[\s*punkt\s*\])\s*)[a-z0-9-]+)+)/gi;
const BAD_EMAIL = /@(sentry|example\.|localhost|test\.|domain\.|sample\.|placeholder\.|wixpress\.com|jsdelivr|cloudflare|googletagmanager|hotjar|intercom)|\.(png|jpe?g|gif|svg|webp|css|js|ico)$/i;
const NOREPLY = /^(no-?reply|do-?not-?reply|bounce|mailer-daemon|postmaster|abuse|webmaster|privacy|datenschutz|gdpr|dpo|jobs|careers|karriere|bewerbung|hr|press|presse|newsletter)\b/i;

function extractEmails(html) {
  if (!html) return [];
  const seen = new Set();
  for (const m of html.matchAll(/mailto:([^"'?\s<>]+)/gi)) {
    try { seen.add(decodeURIComponent(m[1]).toLowerCase()); } catch { /* skip */ }
  }
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) { const e = decodeCf(m[1]); if (e) seen.add(e.toLowerCase()); }
  for (const m of html.matchAll(/email-protection#([0-9a-f]+)/gi)) { const e = decodeCf(m[1]); if (e) seen.add(e.toLowerCase()); }
  for (const m of html.matchAll(/"email"\s*:\s*"([^"]+@[^"]+)"/gi)) seen.add(m[1].replace(/^mailto:/i, '').toLowerCase());
  const text = stripHtml(html);
  for (const m of text.match(EMAIL_RE) || []) seen.add(m.toLowerCase());
  for (const m of text.matchAll(OBF_RE)) {
    const dom = m[2].replace(/\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+|\(\s*punkt\s*\)|\[\s*punkt\s*\])\s*/gi, '.').replace(/\s/g, '');
    seen.add(`${m[1]}@${dom}`.toLowerCase());
  }
  return [...seen].map((e) => e.replace(/[.,;:]+$/, '')).filter((e) => /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(e) && !BAD_EMAIL.test(e)).slice(0, 12);
}

function extractPhones(html) {
  if (!html) return [];
  const out = [];
  for (const m of html.matchAll(/href="tel:([^"]+)"/gi)) out.push(decodeURIComponent(m[1]).trim());
  for (const m of html.matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)) out.push(m[1].trim());
  const text = stripHtml(html);
  for (const m of text.matchAll(/(?:tel(?:efon|ephone|éfono)?|phone|fon|t\.)\s*[:.]?\s*(\+?\d[\d\s().\-/]{6,20}\d)/gi)) out.push(m[1].trim());
  for (const m of text.match(/(?:\+|00)\d[\d\s().-]{7,17}\d/g) || []) out.push(m.trim());
  const seen = new Set();
  return out.filter((p) => { const d = p.replace(/\D/g, ''); if (d.length < 8 || d.length > 15 || seen.has(d)) return false; seen.add(d); return true; }).slice(0, 4);
}

const NON_COMPANY = ['linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com',
  'wikipedia.org', 'crunchbase.com', 'bloomberg.com', 'reuters.com', 'yellowpages.com', 'yelp.com', 'trustpilot.com',
  'glassdoor.com', 'indeed.com', 'zoominfo.com', 'dnb.com', 'rocketreach.co', 'apollo.io', 'opencorporates.com',
  'kompass.com', 'europages.com', 'europages.co.uk', 'yell.com', 'alibaba.com', 'made-in-china.com', 'indiamart.com',
  'tradeindia.com', 'importyeti.com', 'panjiva.com', 'volza.com', 'tridge.com', 'amazon.com', 'ebay.com', 'google.com',
  'bing.com', 'duckduckgo.com', 'brave.com', 'mojeek.com', 'find-and-update.company-information.service.gov.uk',
  'sec.gov', 'gleif.org', 'pappers.fr', 'societe.com', 'northdata.com', 'northdata.de', 'firmenwissen.de',
  'insee.fr', 'recherche-entreprises.api.gouv.fr', 'annuaire-entreprises.data.gouv.fr', 'w3.org', 'schema.org'];

function hostOf(u) { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
function isBlockedHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return NON_COMPANY.some((bad) => h === bad || h.endsWith('.' + bad));
}
function registrable(host) {
  const p = host.toLowerCase().replace(/^www\./, '').split('.');
  if (p.length >= 3 && ['co', 'com', 'org', 'net', 'ac', 'or', 'ne'].includes(p[p.length - 2]) && p[p.length - 1].length === 2) return p.slice(-3).join('.');
  return p.slice(-2).join('.');
}

const LEGAL = /\b(inc|llc|ltd|limited|gmbh|ag|kg|co|corp|corporation|company|bv|b\.v|nv|sa|sas|sarl|srl|spa|s\.p\.a|plc|pty|oy|ab|as|kk|pte|sdn|bhd|llp|lp|the|and|und|et|de)\b\.?/gi;
function nameTokens(name) {
  return String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(LEGAL, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length >= 3);
}
function nameOnPage(name, text) {
  const toks = nameTokens(name);
  const t = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  if (!toks.length) return t.includes(String(name).toLowerCase());
  return toks.filter((x) => t.includes(x)).length / toks.length >= 0.6;
}
const PARKED = /(domain (is )?for sale|buy this domain|this domain may be for sale|parked (free|domain)|domain parking|sedo\.com|dan\.com|hugedomains|afternic|under construction|coming soon|account suspended)/i;

const TLDS = {
  DE: ['.de', '.com'], AT: ['.at', '.com'], CH: ['.ch', '.com'], NL: ['.nl', '.com'], BE: ['.be', '.com'], FR: ['.fr', '.com'],
  IT: ['.it', '.com'], ES: ['.es', '.com'], PT: ['.pt', '.com'], GB: ['.co.uk', '.com'], IE: ['.ie', '.com'], DK: ['.dk', '.com'],
  SE: ['.se', '.com'], NO: ['.no', '.com'], PL: ['.pl', '.com'], US: ['.com'], CA: ['.ca', '.com'], AU: ['.com.au', '.com'],
  NZ: ['.co.nz', '.com'], JP: ['.co.jp', '.com'], KR: ['.co.kr', '.com'], TW: ['.com.tw', '.com'], CN: ['.com.cn', '.com'],
  SG: ['.com.sg', '.com'], MY: ['.com.my', '.com'], AE: ['.ae', '.com'], SA: ['.com.sa', '.com'], TR: ['.com.tr', '.com'],
  IN: ['.in', '.com'], ZA: ['.co.za', '.com'], BR: ['.com.br', '.com'], MX: ['.com.mx', '.com'],
};

async function resolves(host) {
  try { await dns.lookup(host); return true; } catch { return false; }
}
async function hasMx(domain) {
  try { const r = await dns.resolveMx(domain); if (r && r.length) return true; } catch { /* fall through */ }
  return resolves(domain);
}

async function verifySite(name, root) {
  if (isBlockedHost(hostOf(root))) return null;
  const page = await fetchText(root);
  if (!page) return null;
  const text = stripHtml(page.html);
  const title = (page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  if (text.length < 200 || PARKED.test(text.slice(0, 3000))) return null;
  if (!nameOnPage(name, `${title} ${text.slice(0, 8000)}`)) return null;
  return { root: `https://${hostOf(page.url) || hostOf(root)}`, page };
}

function slugVariants(name) {
  const t = nameTokens(name);
  if (!t.length) return [];
  const v = [t.slice(0, 3).join(''), t.slice(0, 3).join('-'), t.slice(0, 2).join(''), t.slice(0, 2).join('-')];
  if (t[0].length >= 5) v.push(t[0]);
  return [...new Set(v)].filter((x) => x.length >= 3 && x.length <= 40).slice(0, 5);
}

async function guessWebsite(name, country) {
  for (const slug of slugVariants(name)) {
    for (const tld of TLDS[String(country || '').toUpperCase()] || ['.com']) {
      const host = slug + tld;
      if (!(await resolves(host)) && !(await resolves('www.' + host))) continue;
      const ok = await verifySite(name, 'https://' + host);
      if (ok) return ok;
    }
  }
  return null;
}

async function searchLinks(query) {
  const engines = [
    async () => {
      const r = await fetchText('https://www.mojeek.com/search?q=' + encodeURIComponent(query), { ua: BROWSER_UA });
      return r ? [...r.html.matchAll(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]+href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]) : [];
    },
    async () => {
      const r = await fetchText('https://www.bing.com/search?setlang=en&q=' + encodeURIComponent(query), { ua: BROWSER_UA });
      return r ? [...r.html.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]) : [];
    },
    async () => {
      const r = await fetchText('https://html.duckduckgo.com/html/', { ua: BROWSER_UA, method: 'POST', body: 'q=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      return r ? [...r.html.matchAll(/uddg=([^&"]+)/g)].map((m) => decodeURIComponent(m[1])) : [];
    },
  ];
  for (const e of engines) {
    try { const links = await e(); if (links.length) return links; } catch { /* next engine */ }
  }
  return [];
}

async function findCompanyWebsite(name, country) {
  if (!name) return null;
  const guessed = await guessWebsite(name, country);
  if (guessed) return guessed.root;
  const links = await searchLinks(`"${name}" ${country || ''}`.trim());
  const toks = nameTokens(name).filter((t) => t.length >= 4);
  const roots = [...new Set(links.map(hostOf).filter((h) => h && !isBlockedHost(h) && !h.endsWith('.id')))]
    .map((h) => ({ h, score: toks.filter((t) => h.replace(/-/g, '').includes(t)).length }))
    .sort((a, b) => b.score - a.score).slice(0, 3);
  for (const { h } of roots) {
    const ok = await verifySite(name, 'https://' + h);
    if (ok) return ok.root;
  }
  return null;
}

const CONTACT_PATHS = ['/impressum', '/kontakt', '/contact', '/contact-us', '/imprint', '/legal', '/mentions-legales', '/aviso-legal', '/contatti', '/about'];
const ROLE_RANK = [[/^(purchas|procure|buying|buyer|sourcing|einkauf|achat|compras|acquisti|inkoop|import)/, 0], [/^(trade|trading|commercial|export)/, 1],
  [/^(info|contact|kontakt|office|mail|hello|hallo|general|enquir|inquir)/, 2], [/^(sales|vertrieb|verkauf|ventas|order|service)/, 3]];
const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com', 'icloud.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de', 'orange.fr', 'wanadoo.fr', 'free.fr', 'libero.it', 'naver.com', 'qq.com', '163.com']);

async function pickEmail(cands, siteHost) {
  const reg = siteHost ? registrable(siteHost) : null;
  const scored = [];
  for (const [e, src] of cands) {
    const [local, dom] = e.split('@');
    if (!dom || NOREPLY.test(local)) continue;
    const same = reg && registrable(dom) === reg;
    const free = FREEMAIL.has(dom);
    if (reg && !same && !free) continue;
    let rank = 5; let kind = 'domain';
    for (const [re, r] of ROLE_RANK) if (re.test(local)) { rank = r; kind = 'role'; break; }
    if (kind !== 'role' && /^[a-z]{2,}[._-][a-z]{2,}$/.test(local)) { rank = 6; kind = 'personal'; }
    scored.push({ e, src, rank: (same ? 0 : 10) + rank, kind: free ? 'freemail' : kind, dom, free });
  }
  scored.sort((a, b) => a.rank - b.rank);
  for (const s of scored) {
    if (s.free || await hasMx(s.dom)) return { email: s.e, status: s.kind, source_url: s.src };
  }
  return null;
}

// Full contact harvest for one company. Returns observed data only.
async function crawlWebsite(rootUrl) {
  if (!rootUrl) return null;
  let base;
  try { base = new URL(/^https?:\/\//i.test(rootUrl) ? rootUrl : 'https://' + rootUrl); } catch { return null; }
  const pages = [];
  const home = await fetchText(base.origin + '/');
  if (home) pages.push(home);
  const links = home ? [...home.html.matchAll(/href="([^"#]+)"/gi)].map((m) => { try { return new URL(m[1], base).toString(); } catch { return null; } })
    .filter((u) => u && hostOf(u) === hostOf(base.toString()) && /(impressum|imprint|kontakt|contact|legal|mentions|aviso|contatti|about)/i.test(u)) : [];
  const queue = [...new Set([...links.slice(0, 4), ...CONTACT_PATHS.map((p) => base.origin + p)])];
  let fetched = 0;
  for (const u of queue) {
    if (fetched >= 5) break;
    fetched += 1;
    const pg = await fetchText(u);
    if (pg) pages.push(pg);
    if (pg && /(impressum|imprint|kontakt|contact)/i.test(u) && extractEmails(pg.html).some((e) => registrable(e.split('@')[1]) === registrable(base.hostname))) break;
  }
  if (!pages.length) return null;
  const cands = new Map();
  for (const p of pages) for (const e of extractEmails(p.html)) if (!cands.has(e)) cands.set(e, p.url);
  const best = await pickEmail(cands, base.hostname);
  let phone = null; let phoneSrc = null;
  for (const p of [...pages].sort((a, b) => (/(impressum|kontakt|contact)/i.test(b.url) ? 1 : 0) - (/(impressum|kontakt|contact)/i.test(a.url) ? 1 : 0))) {
    const ph = extractPhones(p.html)[0];
    if (ph) { phone = ph; phoneSrc = p.url; break; }
  }
  const md = home && (home.html.match(/<meta[^>]+name="description"[^>]+content="([^"]{40,400})"/i) || [])[1];
  return {
    text_snippet: stripHtml(pages.map((p) => p.html).join(' ')).slice(0, 2000),
    email: best?.email || null, email_status: best?.status || null, email_source_url: best?.source_url || null,
    emails: best ? [best.email] : [], phones: phone ? [phone] : [], phone_source_url: phoneSrc,
    description: md ? decodeEntities(md) : null,
  };
}

module.exports = { crawlWebsite, findCompanyWebsite, stripHtml, extractEmails, extractPhones, isBlockedHost, nameOnPage, guessWebsite };
