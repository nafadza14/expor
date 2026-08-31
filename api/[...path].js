// Vercel serverless catch-all for /api/* routes
'use strict';

const { handleApi } = require('../src/api');
let dbPromise = null;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Async DB init (sql.js WASM needs async loading)
  let db;
  try {
    if (!dbPromise) dbPromise = require('../src/db').getDb();
    db = await dbPromise;
  } catch (e) {
    console.error('[eksporin] DB init failed:', e.message, e.stack);
    dbPromise = null; // retry next request
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Database init gagal: ' + e.message }));
  }

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);

  let body = null;
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => { data += c; if (data.length > 1e6) { resolve(null); req.destroy(); } });
      req.on('end', () => {
        if (!data) return resolve(null);
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
  }

  try {
    return await handleApi(db, req, res, url, body || {});
  } catch (e) {
    console.error('[eksporin] API error:', e.message, e.stack);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error: ' + e.message }));
    }
  }
};
