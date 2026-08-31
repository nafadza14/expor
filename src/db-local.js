// EksporIn | database bootstrap (node:sqlite for local preview)
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = process.env.EKSPORIN_DB || path.join(__dirname, '..', 'data', 'eksporin.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, org_name TEXT, plan TEXT NOT NULL DEFAULT 'free', hs_focus TEXT NOT NULL DEFAULT '[]', target_countries TEXT NOT NULL DEFAULT '[]', export_status TEXT, goal TEXT, onboarded INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hs_codes (code TEXT PRIMARY KEY, parent_code TEXT, level INTEGER NOT NULL, description_en TEXT NOT NULL, description_id TEXT NOT NULL, chapter TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS buyers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT NOT NULL, city TEXT, address TEXT, industry TEXT, size_bucket TEXT, website TEXT, description TEXT, data_confidence INTEGER DEFAULT 70, first_shipment_date TEXT, last_shipment_date TEXT, total_shipments INTEGER DEFAULT 0, total_volume_kg REAL DEFAULT 0, total_value_usd REAL DEFAULT 0, shipments_12mo INTEGER DEFAULT 0, volume_12mo_kg REAL DEFAULT 0, value_12mo_usd REAL DEFAULT 0, yoy_percent REAL, has_indonesian_supplier INTEGER DEFAULT 0, activity_score INTEGER, growth_score INTEGER, reachability_score INTEGER, untapped_score INTEGER, base_score INTEGER);
CREATE TABLE IF NOT EXISTS buyer_hs (buyer_id INTEGER NOT NULL REFERENCES buyers(id), hs_code TEXT NOT NULL, shipment_count INTEGER DEFAULT 0, total_volume_kg REAL DEFAULT 0, total_value_usd REAL DEFAULT 0, first_seen TEXT, last_seen TEXT, PRIMARY KEY (buyer_id, hs_code));
CREATE TABLE IF NOT EXISTS buyer_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer_id INTEGER NOT NULL REFERENCES buyers(id), contact_type TEXT NOT NULL, value TEXT NOT NULL, person_name TEXT, person_title TEXT, confidence INTEGER DEFAULT 60);
CREATE TABLE IF NOT EXISTS exporters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, country TEXT NOT NULL, is_indonesian INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, shipment_date TEXT NOT NULL, hs_code TEXT NOT NULL, buyer_id INTEGER NOT NULL REFERENCES buyers(id), exporter_id INTEGER NOT NULL REFERENCES exporters(id), origin_port TEXT, dest_port TEXT, weight_kg REAL, quantity REAL, quantity_unit TEXT, value_usd REAL, container_count INTEGER, goods_description TEXT, source TEXT DEFAULT 'US CBP AMS');
CREATE INDEX IF NOT EXISTS idx_ship_buyer ON shipments(buyer_id, shipment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ship_hs ON shipments(hs_code, shipment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ship_exporter ON shipments(exporter_id);
CREATE TABLE IF NOT EXISTS lists (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT, color TEXT DEFAULT '#2563EB', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS list_buyers (list_id INTEGER NOT NULL REFERENCES lists(id), buyer_id INTEGER NOT NULL REFERENCES buyers(id), status TEXT NOT NULL DEFAULT 'new', priority TEXT DEFAULT 'medium', tags TEXT DEFAULT '[]', reminder_at TEXT, added_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (list_id, buyer_id));
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), buyer_id INTEGER NOT NULL REFERENCES buyers(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, category TEXT NOT NULL, language TEXT NOT NULL, channel TEXT NOT NULL, name TEXT NOT NULL, subject TEXT, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), buyer_id INTEGER NOT NULL REFERENCES buyers(id), template_id INTEGER, channel TEXT NOT NULL, subject TEXT, body TEXT, status TEXT NOT NULL DEFAULT 'sent', sent_at TEXT NOT NULL DEFAULT (datetime('now')), opened_at TEXT, replied_at TEXT);
CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), dedup_key TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, buyer_id INTEGER, hs_code TEXT, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, dedup_key));
CREATE TABLE IF NOT EXISTS profile_views (user_id INTEGER NOT NULL REFERENCES users(id), buyer_id INTEGER NOT NULL REFERENCES buyers(id), period TEXT NOT NULL, PRIMARY KEY (user_id, buyer_id, period));
CREATE TABLE IF NOT EXISTS usage_meters (user_id INTEGER NOT NULL REFERENCES users(id), meter TEXT NOT NULL, period TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, meter, period));
`;

let _db = null;
function getDb() {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const isNew = !fs.existsSync(DB_PATH);
  _db = new DatabaseSync(DB_PATH);
  try { _db.exec('PRAGMA journal_mode = WAL'); } catch (e) {}
  _db.exec(SCHEMA);
  const count = _db.prepare('SELECT COUNT(*) AS c FROM buyers').get().c;
  if (isNew || count === 0) {
    console.log('[eksporin] Seeding...');
    require('./seed').seed(_db);
    console.log('[eksporin] Seeding selesai.');
  }
  return _db;
}
module.exports = { getDb, DB_PATH };
