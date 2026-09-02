'use strict';
// ImportYeti / US CBP bill-of-lading discovery.
//
// STATUS: disabled by default. ImportYeti's public site is behind
// Cloudflare bot protection; a server-side scrape returns 403 unless we
// route through a residential proxy pool or a paid scraping API. For a
// zero-cost MVP we mark ImportYeti jobs as "skipped:requires_paid_proxy"
// so they show up in the admin queue as a signal of what would unlock if
// we ever add a proxy service (ScraperAPI, Bright Data, etc).
//
// When you're ready to enable, set env vars:
//   SCRAPERAPI_KEY=...          (or similar proxy provider)
//   IMPORTYETI_ENABLED=1
// then swap the fetch call below to route through the proxy.

async function searchImportYeti({ hs_code: _hs, country: _country, limit: _limit = 20 }) {
  if (process.env.IMPORTYETI_ENABLED !== '1') {
    const err = new Error('requires_paid_scraping_proxy');
    err.skip = true;
    throw err;
  }
  // Placeholder for real implementation. Would call:
  //   fetch('https://api.scraperapi.com/?api_key=...&url=' + encodeURIComponent(
  //     'https://www.importyeti.com/search?q=' + hs
  //   ))
  // then parse the Next.js hydration payload for company cards.
  return [];
}

module.exports = { searchImportYeti };
