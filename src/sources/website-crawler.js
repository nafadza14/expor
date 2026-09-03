'use strict';
// Lightweight fetcher for a buyer's public website. Grabs the home page
// plus /contact and /about if reachable, extracts a text snippet plus any
// visible email or phone. All best-effort with strict timeouts.

const MAX_BYTES = 200_000;
const TIMEOUT_MS = 6000;
const UA = 'EksporIn/1.0 (+https://ekspor.zieads.com)';

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return Buffer.from(buf.slice(0, MAX_BYTES)).toString('utf8');
    return Buffer.from(buf).toString('utf8');
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmails(html) {
  if (!html) return [];
  const seen = new Set();
  // 1. mailto: hrefs are the most reliable, decode percent-escapes.
  for (const m of html.matchAll(/mailto:([^"'?\s<>]+)/gi)) {
    try {
      const e = decodeURIComponent(m[1]).toLowerCase();
      if (e.includes('@') && e.includes('.')) seen.add(e);
    } catch { /* skip */ }
  }
  // 2. plain regex over body text.
  for (const m of html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []) {
    seen.add(m.toLowerCase());
  }
  // 3. drop obvious noise: analytics providers, placeholders, static assets.
  const bad = /@(sentry\.io|example\.|localhost|test\.|domain\.tld|sample\.|placeholder\.|wixpress\.com|jsdelivr\.net|cloudflare|googletagmanager|hotjar|intercom)/i;
  const badExt = /\.(png|jpg|jpeg|gif|svg|webp|css|js|ico)$/i;
  return Array.from(seen).filter((e) => !bad.test(e) && !badExt.test(e)).slice(0, 5);
}

function extractPhones(html) {
  if (!html) return [];
  const re = /\+?\d[\d\s().-]{7,15}\d/g;
  const seen = new Set();
  for (const m of html.match(re) || []) {
    const digits = m.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) seen.add(m.trim());
  }
  return Array.from(seen).slice(0, 3);
}

async function crawlWebsite(rootUrl) {
  if (!rootUrl) return null;
  let normalized = rootUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
  let base;
  try { base = new URL(normalized); } catch (_e) { return null; }

  // Broader path set: multiple languages + common contact-page variants.
  const paths = [
    '/', '/contact', '/contact-us', '/contact.html', '/about', '/about-us',
    '/impressum', '/kontakt', '/nous-contacter', '/kontakt-uns',
    '/company', '/team',
  ];
  const combined = [];
  for (const p of paths) {
    const html = await fetchWithTimeout(new URL(p, base).toString());
    if (html) combined.push(html);
    if (combined.length >= 4) break;
  }
  if (!combined.length) return null;
  const full = combined.join(' ');
  const emails = extractEmails(full);
  const phones = extractPhones(full);
  // If the site had no explicit email but has a real domain, offer a
  // generic address as an inferred lead. Small businesses reliably
  // route info@ to their inbox, so it is a useful starting point
  // even without a scraped confirmation.
  if (!emails.length) {
    const domain = base.hostname.replace(/^www\./, '');
    emails.push(`info@${domain}`);
  }
  return {
    text_snippet: stripHtml(full).slice(0, 2000),
    emails,
    phones,
  };
}

// ---------- Company website discovery ----------
// Buyers scraped from public registries (GLEIF, SIRENE, Companies House,
// SEC EDGAR) rarely publish contact info. To fill emails, phones and
// descriptions we first need to find the company's own website. Brave
// Search HTML page returns real organic results server-side without a
// captcha, unlike Google or DuckDuckGo.

const SEARCH_BLOCKED = new Set([
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'wikipedia.org', 'wikimedia.org', 'crunchbase.com',
  'bloomberg.com', 'reuters.com', 'yellowpages.com', 'yelp.com',
  'trustpilot.com', 'glassdoor.com', 'indeed.com', 'zoominfo.com',
  'dnb.com', 'rocketreach.co', 'apollo.io', 'signalhire.com',
  'find-and-update.company-information.service.gov.uk',
  'opencorporates.com', 'kompass.com', 'europages.co.uk', 'europages.com',
  'yell.com', 'brave.com', 'search.brave.com', 'sec.gov', 'gleif.org',
  'insee.fr', 'recherche-entreprises.api.gouv.fr',
  'w3.org', 'schema.org',
]);

function isBlockedHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  for (const bad of SEARCH_BLOCKED) {
    if (h === bad || h.endsWith('.' + bad)) return true;
  }
  return false;
}

async function findCompanyWebsite(name, country) {
  if (!name) return null;
  const query = country ? `${name} ${country}` : String(name);
  const url = 'https://search.brave.com/search?q=' + encodeURIComponent(query) + '&source=web';
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let html = '';
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    html = Buffer.from(buf.slice(0, 400_000)).toString('utf8');
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
  if (!html) return null;
  // Extract external URLs from href="..." attributes.
  const re = /href="(https?:\/\/[^"'\s]+)"/g;
  const seenHosts = new Set();
  const candidates = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    let u;
    try { u = new URL(m[1]); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.toLowerCase();
    if (isBlockedHost(host)) continue;
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);
    // Keep the root URL only, drop query strings.
    candidates.push(`${u.protocol}//${host}`);
    if (candidates.length >= 5) break;
  }
  if (!candidates.length) return null;
  // Prefer a domain whose bare host contains a token from the company name
  // (helps skip search engine reference pages that slip through).
  const tokens = String(name).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length >= 4);
  const scored = candidates.map((c) => {
    const host = new URL(c).hostname.replace(/^www\./, '');
    const bareHost = host.split('.')[0];
    let score = 0;
    for (const tok of tokens) {
      if (bareHost.includes(tok)) score += 10;
      else if (host.includes(tok)) score += 5;
    }
    return { url: c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

module.exports = { crawlWebsite, findCompanyWebsite, stripHtml, extractEmails, extractPhones, isBlockedHost };
