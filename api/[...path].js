// Vercel serverless catch-all for /api/* routes
'use strict';
const { getDb } = require('../src/db');
const { handleApi } = require('../src/api');

module.exports = async (req, res) => {
  const db = getDb();
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);

  // CORS headers (optional, for dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

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
    return handleApi(db, req, res, url, body || {});
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Terjadi kesalahan internal.' }));
  }
};
