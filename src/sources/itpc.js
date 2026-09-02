'use strict';
// Kemendag ITPC (Indonesian Trade Promotion Center) buyer inquiries.
//
// STATUS: placeholder. The public site at itpc.kemendag.go.id publishes
// buyer inquiries received via bilateral chambers, but the pages are
// rendered server-side with no stable JSON endpoint and no HS filter, so
// a reliable scraper needs a per-country page-by-page crawl + HTML
// extraction. Deferred until we can invest a day on it.
//
// The pipeline still enqueues ITPC jobs and marks them "skipped:pending_scraper"
// so admin can see what's missing.

async function searchItpc({ hs_code: _hs, country: _country, limit: _limit = 20 }) {
  const err = new Error('pending_scraper_implementation');
  err.skip = true;
  throw err;
}

module.exports = { searchItpc };
