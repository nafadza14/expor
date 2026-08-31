#!/usr/bin/env node
// EksporIn | Global Buyer Intelligence Platform untuk Eksportir Indonesia
// Zero-dependency full-stack server. Jalankan: node server.js
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('./src/db');
const { handleApi } = require('./src/api');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

let db = null;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('Payload terlalu besar')); req.destroy(); } });
    req.on('end', () => {
      if (!data) return resolve(null);
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      if (!db) db = await getDb();
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : null;
      return handleApi(db, req, res, url, body || {});
    }
    // static files (SPA)
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
    let full = path.join(PUBLIC_DIR, file);
    if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) full = path.join(PUBLIC_DIR, 'index.html'); // SPA fallback
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Terjadi kesalahan internal. Coba lagi.' }));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ┌────────────────────────────────────────────────────┐');
  console.log('  │  EksporIn | Global Buyer Intelligence Platform     │');
  console.log(`  │  ➜  http://localhost:${PORT}                          │`);
  console.log('  │                                                    │');
  console.log('  │  Akun demo:  demo@eksporin.id  /  demo1234         │');
  console.log('  └────────────────────────────────────────────────────┘');
  console.log('');
});
