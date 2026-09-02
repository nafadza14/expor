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
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const seen = new Set();
  for (const m of html.match(re) || []) {
    const e = m.toLowerCase();
    if (!e.includes('@sentry.io') && !e.includes('@example.') && !e.endsWith('.png') && !e.endsWith('.jpg')) seen.add(e);
  }
  return Array.from(seen).slice(0, 5);
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

  const paths = ['/', '/contact', '/contact-us', '/about', '/impressum'];
  const combined = [];
  for (const p of paths) {
    const html = await fetchWithTimeout(new URL(p, base).toString());
    if (html) combined.push(html);
    if (combined.length >= 3) break;
  }
  if (!combined.length) return null;
  const full = combined.join(' ');
  return {
    text_snippet: stripHtml(full).slice(0, 2000),
    emails: extractEmails(full),
    phones: extractPhones(full),
  };
}

module.exports = { crawlWebsite, stripHtml, extractEmails, extractPhones };
