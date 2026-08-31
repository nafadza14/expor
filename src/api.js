// EksporIn | REST API (all routes under /api)
'use strict';
const { hashPassword, verifyPassword, createSession, getSessionUser, destroySession, sessionCookie, clearCookie } = require('./auth');

// ---------- plans (Feature-by-Tier matrix, doc 03 §7) ----------
const PLANS = {
  free:     { name: 'Free',     price: 0,      search: 20,  profile: 3,    saved: 10,  send: 5,    alerts: 0,    export: 0,     contacts: false, competitor: false, sys_templates: 3 },
  starter:  { name: 'Starter',  price: 149000, search: 100, profile: 50,   saved: null, send: 50,   alerts: 5,    export: 100,   contacts: false, competitor: false, sys_templates: 10 },
  growth:   { name: 'Growth',   price: 499000, search: 500, profile: 300,  saved: null, send: 300,  alerts: null, export: 500,   contacts: true,  competitor: false, sys_templates: null },
  business: { name: 'Business', price: 999000, search: null, profile: null, saved: null, send: 2000, alerts: null, export: 10000, contacts: true,  competitor: true,  sys_templates: null },
};
const COUNTRY_NAMES = { US: 'Amerika Serikat', JP: 'Jepang', NL: 'Belanda', AE: 'Uni Emirat Arab', AU: 'Australia', ID: 'Indonesia', VN: 'Vietnam', BR: 'Brasil', CO: 'Kolombia', IN: 'India', TH: 'Thailand', CN: 'Tiongkok', MY: 'Malaysia', EC: 'Ekuador', ET: 'Ethiopia' };
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ---------- helpers ----------
const period = () => new Date().toISOString().slice(0, 7);
const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
const err = (res, code, message) => json(res, code, { error: message });

function getUsage(db, userId, meter) {
  const r = db.prepare('SELECT used FROM usage_meters WHERE user_id=? AND meter=? AND period=?').get(userId, meter, period());
  return r ? r.used : 0;
}
function bumpUsage(db, userId, meter, n = 1) {
  db.prepare(`INSERT INTO usage_meters (user_id,meter,period,used) VALUES (?,?,?,?)
    ON CONFLICT(user_id,meter,period) DO UPDATE SET used = used + excluded.used`).run(userId, meter, period(), n);
}
function quotaCheck(db, user, meter) {
  const limit = PLANS[user.plan][meter];
  if (limit === null || limit === undefined) return { ok: true, limit: null, used: getUsage(db, user.id, meter) };
  const used = getUsage(db, user.id, meter);
  return { ok: used < limit, limit, used };
}

// Product Fit (F4): user's HS focus vs buyer's HS codes
function productFit(userHs, buyerHs) {
  if (!userHs.length || !buyerHs.length) return 50;
  let best = 15;
  for (const u of userHs) for (const b of buyerHs) {
    if (u === b) best = Math.max(best, 100);
    else if (u.slice(0, 4) === b.slice(0, 4)) best = Math.max(best, 75);
    else if (u.slice(0, 2) === b.slice(0, 2)) best = Math.max(best, 50);
  }
  return best;
}
function finalScore(b, fit) {
  const g = b.growth_score === null ? 50 : b.growth_score;
  return Math.min(100, Math.round(
    b.activity_score * 0.30 + g * 0.20 + fit * 0.25 + b.reachability_score * 0.15 + b.untapped_score * 0.10));
}
const scoreLabel = (s) => (s >= 80 ? 'Hot' : s >= 60 ? 'Warm' : s >= 40 ? 'Cold' : 'Low');

function maskContact(type, value) {
  if (type === 'website') return value; // websites are public
  if (type === 'email') { const [l, d] = value.split('@'); return l[0] + '•'.repeat(Math.max(3, l.length - 1)) + '@•••••.' + (d ? d.split('.').pop() : 'com'); }
  if (type === 'phone') return value.slice(0, 4) + ' ••• ••• ••' + value.slice(-2);
  return value.replace(/(https?:\/\/[^/]+\/).*/, '$1••••••');
}

function savedCount(db, userId) {
  return db.prepare('SELECT COUNT(DISTINCT lb.buyer_id) AS c FROM list_buyers lb JOIN lists l ON l.id=lb.list_id WHERE l.user_id=?').get(userId).c;
}

function buyerHsCodes(db, buyerId) {
  return db.prepare('SELECT hs_code FROM buyer_hs WHERE buyer_id=?').all(buyerId).map((r) => r.hs_code);
}

function renderTemplate(db, tpl, buyer, user) {
  const userHs = JSON.parse(user.hs_focus || '[]');
  const bHs = buyerHsCodes(db, buyer.id);
  const match = userHs.find((u) => bHs.some((b) => b.slice(0, 4) === u.slice(0, 4))) || bHs[0] || (userHs[0] || '090111');
  const hsRow = db.prepare('SELECT * FROM hs_codes WHERE code=?').get(match) || { description_en: 'export products' };
  let note = '';
  if (buyer.last_shipment_date) {
    const d = new Date(buyer.last_shipment_date);
    note = `, most recently in ${['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()]} ${d.getFullYear()}`;
  }
  const vars = {
    buyer_name: buyer.name, buyer_country: COUNTRY_NAMES[buyer.country] || buyer.country,
    hs_code: match.replace(/^(\d{4})(\d{2})$/, '$1.$2'), hs_description: hsRow.description_en.toLowerCase(),
    user_name: user.name, org_name: user.org_name || user.name, last_shipment_note: note,
  };
  const sub = (s) => (s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  return { subject: sub(tpl.subject), body: sub(tpl.body) };
}

// simulated engagement tracking (deterministic by message id + elapsed time)
function simulateTracking(db, msg) {
  if (msg.status === 'replied') return msg;
  const ageMin = (Date.now() - new Date(msg.sent_at + 'Z').getTime()) / 60000;
  const h = (msg.id * 2654435761) % 100;
  let status = msg.status, opened = msg.opened_at, replied = msg.replied_at;
  if (ageMin > 2 && h < 65 && !opened) { status = 'opened'; opened = new Date().toISOString().slice(0, 19).replace('T', ' '); }
  if (ageMin > 6 && h < 25 && opened && !replied) { status = 'replied'; replied = new Date().toISOString().slice(0, 19).replace('T', ' '); }
  if (status !== msg.status) {
    db.prepare('UPDATE messages SET status=?, opened_at=?, replied_at=? WHERE id=?').run(status, opened, replied, msg.id);
    return { ...msg, status, opened_at: opened, replied_at: replied };
  }
  return msg;
}

// ---------- alerts materialization ----------
function materializeAlerts(db, user) {
  if (PLANS[user.plan].alerts === 0) return;
  const hsFocus = JSON.parse(user.hs_focus || '[]');
  const countries = JSON.parse(user.target_countries || '[]');
  const ins = db.prepare(`INSERT OR IGNORE INTO alerts (user_id,dedup_key,type,title,body,buyer_id,hs_code) VALUES (?,?,?,?,?,?,?)`);

  // 1) new buyers in followed HS + countries (first shipment within 45 days)
  if (hsFocus.length) {
    const prefixes = hsFocus.map((h) => h.slice(0, 4));
    const rows = db.prepare(`SELECT DISTINCT b.id, b.name, b.country, bh.hs_code FROM buyers b
      JOIN buyer_hs bh ON bh.buyer_id = b.id
      WHERE b.first_shipment_date >= date('now','-45 days')
      ${countries.length ? `AND b.country IN (${countries.map(() => '?').join(',')})` : ''}`).all(...countries);
    for (const r of rows) {
      if (!prefixes.includes(r.hs_code.slice(0, 4))) continue;
      ins.run(user.id, `nb:${r.id}`, 'new_buyer', `Buyer baru: ${r.name}`,
        `Importir baru terdeteksi di HS ${r.hs_code} (${COUNTRY_NAMES[r.country] || r.country}). Belum banyak yang menghubungi. Peluang first-mover.`, r.id, r.hs_code);
    }
  }
  // 2) activity on saved buyers (shipment in last 21 days)
  const saved = db.prepare(`SELECT DISTINCT b.id, b.name, b.last_shipment_date FROM buyers b
    JOIN list_buyers lb ON lb.buyer_id = b.id JOIN lists l ON l.id = lb.list_id
    WHERE l.user_id=? AND b.last_shipment_date >= date('now','-21 days')`).all(user.id);
  for (const r of saved) {
    ins.run(user.id, `act:${r.id}:${r.last_shipment_date}`, 'buyer_activity', `${r.name} punya shipment baru`,
      `Buyer di daftar Anda menerima kiriman baru pada ${r.last_shipment_date}. Momentum bagus untuk follow-up.`, r.id, null);
  }
  // 3) competitor: Indonesian exporter shipped to saved buyer in last 30 days
  const comp = db.prepare(`SELECT s.buyer_id, b.name, e.name AS exporter, MAX(s.shipment_date) AS d
    FROM shipments s JOIN exporters e ON e.id=s.exporter_id JOIN buyers b ON b.id=s.buyer_id
    JOIN list_buyers lb ON lb.buyer_id = s.buyer_id JOIN lists l ON l.id = lb.list_id
    WHERE l.user_id=? AND e.is_indonesian=1 AND s.shipment_date >= date('now','-30 days')
    GROUP BY s.buyer_id`).all(user.id);
  for (const r of comp) {
    ins.run(user.id, `comp:${r.buyer_id}:${r.d.slice(0, 7)}`, 'competitor', `Kompetitor Indonesia mengirim ke ${r.name}`,
      `${r.exporter} mengekspor ke buyer di daftar Anda pada ${r.d}. Buyer ini terbukti mau membeli dari Indonesia.`, r.buyer_id, null);
  }
  // 4) reminders due
  const rem = db.prepare(`SELECT lb.list_id, lb.buyer_id, lb.reminder_at, b.name FROM list_buyers lb
    JOIN lists l ON l.id=lb.list_id JOIN buyers b ON b.id=lb.buyer_id
    WHERE l.user_id=? AND lb.reminder_at IS NOT NULL AND lb.reminder_at <= datetime('now')`).all(user.id);
  for (const r of rem) {
    ins.run(user.id, `rem:${r.list_id}:${r.buyer_id}:${r.reminder_at}`, 'reminder', `Waktunya follow-up: ${r.name}`,
      `Pengingat yang Anda pasang jatuh tempo (${r.reminder_at.slice(0, 10)}).`, r.buyer_id, null);
  }
}

// ---------- route table ----------
function handleApi(db, req, res, url, body) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;
  const method = req.method;
  const route = (m, pattern) => {
    if (m !== method) return null;
    const rx = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    const match = p.match(rx);
    return match ? (match.groups || {}) : null;
  };
  let m;

  // ===== auth (public) =====
  if (route('POST', '/api/auth/register')) {
    const { email, password, name, org_name } = body || {};
    if (!email || !password || !name) return err(res, 400, 'Nama, email, dan password wajib diisi.');
    if (password.length < 8) return err(res, 400, 'Password minimal 8 karakter.');
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return err(res, 409, 'Email sudah terdaftar. Silakan masuk.');
    db.prepare('INSERT INTO users (email,password_hash,name,org_name) VALUES (?,?,?,?)').run(email, hashPassword(password), name, org_name || null);
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    res.setHeader('Set-Cookie', sessionCookie(createSession(db, u.id)));
    return json(res, 201, { ok: true, onboarded: false });
  }
  if (route('POST', '/api/auth/login')) {
    const { email, password } = body || {};
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email || '');
    if (!u || !verifyPassword(password || '', u.password_hash)) return err(res, 401, 'Email atau password salah.');
    res.setHeader('Set-Cookie', sessionCookie(createSession(db, u.id)));
    return json(res, 200, { ok: true, onboarded: !!u.onboarded });
  }
  if (route('POST', '/api/auth/logout')) {
    destroySession(db, req);
    res.setHeader('Set-Cookie', clearCookie());
    return json(res, 200, { ok: true });
  }
  if (route('GET', '/api/plans')) {
    return json(res, 200, Object.entries(PLANS).map(([code, pl]) => ({ code, ...pl })));
  }

  // ===== everything below requires auth =====
  const user = getSessionUser(db, req);
  if (!user) return err(res, 401, 'Sesi tidak valid. Silakan masuk kembali.');
  const plan = PLANS[user.plan];
  const userHs = JSON.parse(user.hs_focus || '[]');

  if (route('GET', '/api/me')) {
    const meters = {};
    for (const mKey of ['search', 'profile', 'send', 'export']) meters[mKey] = { used: getUsage(db, user.id, mKey), limit: plan[mKey === 'export' ? 'export' : mKey] ?? null };
    return json(res, 200, {
      id: user.id, email: user.email, name: user.name, org_name: user.org_name, plan: user.plan,
      plan_name: plan.name, onboarded: !!user.onboarded, hs_focus: userHs,
      target_countries: JSON.parse(user.target_countries || '[]'), export_status: user.export_status, goal: user.goal,
      quotas: meters, contacts_visible: plan.contacts,
      saved: { used: savedCount(db, user.id), limit: plan.saved },
      unread_alerts: db.prepare('SELECT COUNT(*) c FROM alerts WHERE user_id=? AND read=0').get(user.id).c,
    });
  }

  if (route('POST', '/api/me/onboarding')) {
    const { hs_focus = [], target_countries = [], export_status, goal, org_name } = body || {};
    db.prepare('UPDATE users SET hs_focus=?, target_countries=?, export_status=?, goal=?, org_name=COALESCE(?,org_name), onboarded=1 WHERE id=?')
      .run(JSON.stringify(hs_focus.slice(0, 5)), JSON.stringify(target_countries), export_status || null, goal || null, org_name || null, user.id);
    return json(res, 200, { ok: true });
  }

  if (route('POST', '/api/me/plan')) {
    const { plan: newPlan } = body || {};
    if (!PLANS[newPlan]) return err(res, 400, 'Paket tidak dikenal.');
    db.prepare('UPDATE users SET plan=? WHERE id=?').run(newPlan, user.id);
    return json(res, 200, { ok: true, plan: newPlan, invoice: { number: 'INV-' + Date.now(), amount_idr: PLANS[newPlan].price, status: 'paid', provider: 'midtrans (simulasi)' } });
  }

  // ===== HS taxonomy =====
  if (route('GET', '/api/hs')) {
    const parent = q.get('parent');
    const rows = parent
      ? db.prepare('SELECT * FROM hs_codes WHERE parent_code=? ORDER BY code').all(parent)
      : db.prepare('SELECT * FROM hs_codes WHERE parent_code IS NULL ORDER BY code').all();
    const stats = rows.map((r) => {
      const st = db.prepare(`SELECT COUNT(DISTINCT bh.buyer_id) buyers, COALESCE(SUM(bh.total_volume_kg),0) vol, COALESCE(SUM(bh.total_value_usd),0) val
        FROM buyer_hs bh WHERE bh.hs_code LIKE ? AND bh.shipment_count > 0`).get(r.code + '%');
      const top = db.prepare(`SELECT b.country, COUNT(DISTINCT b.id) n FROM buyers b JOIN buyer_hs bh ON bh.buyer_id=b.id
        WHERE bh.hs_code LIKE ? GROUP BY b.country ORDER BY n DESC LIMIT 3`).all(r.code + '%');
      return { ...r, buyer_count: st.buyers, volume_kg: Math.round(st.vol), value_usd: Math.round(st.val), top_countries: top };
    });
    return json(res, 200, stats);
  }
  if (route('GET', '/api/hs/leaf')) {
    return json(res, 200, db.prepare('SELECT code, description_en, description_id FROM hs_codes WHERE level=6 ORDER BY code').all());
  }

  // ===== buyer search (F1) =====
  if (route('GET', '/api/search/buyers')) {
    const qc = quotaCheck(db, user, 'search');
    if (!qc.ok) return json(res, 402, { error: `Kuota pencarian bulan ini habis (${qc.used}/${qc.limit}). Upgrade paket untuk melanjutkan.`, quota: qc, upgrade: true });

    const hs = q.get('hs') || '';
    const countries = (q.get('countries') || '').split(',').filter(Boolean);
    const sizes = (q.get('sizes') || '').split(',').filter(Boolean);
    const activity = q.get('activity') || '';
    const has = (q.get('has') || '').split(',').filter(Boolean);
    const minScore = parseInt(q.get('min_score') || '0', 10);
    const text = (q.get('q') || '').trim();
    const sort = q.get('sort') || 'score';
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = Math.min(100, parseInt(q.get('per') || '25', 10));

    let sql = `SELECT DISTINCT b.* FROM buyers b`;
    const where = []; const args = [];
    if (hs) { sql += ' JOIN buyer_hs bh ON bh.buyer_id = b.id'; where.push('bh.hs_code LIKE ?'); args.push(hs + '%'); }
    if (countries.length) { where.push(`b.country IN (${countries.map(() => '?').join(',')})`); args.push(...countries); }
    if (sizes.length) { where.push(`b.size_bucket IN (${sizes.map(() => '?').join(',')})`); args.push(...sizes); }
    if (text) { where.push('b.name LIKE ?'); args.push('%' + text + '%'); }
    if (activity === 'very_active') where.push('b.shipments_12mo > 12');
    else if (activity === 'active') where.push('b.shipments_12mo BETWEEN 4 AND 12');
    else if (activity === 'occasional') where.push('b.shipments_12mo BETWEEN 1 AND 3');
    else if (activity === 'inactive') where.push('b.shipments_12mo = 0');
    for (const h of has) {
      if (['email', 'phone', 'linkedin', 'website'].includes(h))
        where.push(`EXISTS (SELECT 1 FROM buyer_contacts c WHERE c.buyer_id=b.id AND c.contact_type='${h}')`);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    let rows = db.prepare(sql).all(...args);

    // compute user-specific final score
    rows = rows.map((b) => {
      const fit = productFit(userHs, buyerHsCodes(db, b.id));
      const score = finalScore(b, fit);
      return { ...b, fit_score: fit, score, score_label: scoreLabel(score) };
    }).filter((b) => b.score >= minScore);

    const sorters = {
      score: (a, b) => b.score - a.score, volume: (a, b) => b.volume_12mo_kg - a.volume_12mo_kg,
      shipments: (a, b) => b.shipments_12mo - a.shipments_12mo, name: (a, b) => a.name.localeCompare(b.name),
      recent: (a, b) => String(b.last_shipment_date || '').localeCompare(String(a.last_shipment_date || '')),
    };
    rows.sort(sorters[sort] || sorters.score);

    bumpUsage(db, user.id, 'search');
    const total = rows.length;
    const start = (pageN - 1) * per;
    const pageRows = rows.slice(start, start + per).map((b, i) => ({
      rank: start + i + 1, id: b.id, name: b.name, country: b.country, country_name: COUNTRY_NAMES[b.country] || b.country,
      city: b.city, industry: b.industry, size_bucket: b.size_bucket,
      shipments_12mo: b.shipments_12mo, volume_12mo_kg: b.volume_12mo_kg, value_12mo_usd: b.value_12mo_usd,
      last_shipment_date: b.last_shipment_date, yoy_percent: b.yoy_percent,
      has_indonesian_supplier: !!b.has_indonesian_supplier,
      score: b.score, score_label: b.score_label,
      // free tier: rows beyond 20 are teaser-blurred (F1 edge case)
      blurred: user.plan === 'free' && start + i >= 20,
    }));
    // facets
    const facet = (key) => {
      const mmap = {};
      for (const r of rows) { const k = r[key] || '-'; mmap[k] = (mmap[k] || 0) + 1; }
      return Object.entries(mmap).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ value: k, count: n }));
    };
    return json(res, 200, { total, page: pageN, per, results: pageRows, facets: { country: facet('country'), size: facet('size_bucket') }, quota: quotaCheck(db, user, 'search') });
  }

  // ===== buyer profile (F2) =====
  if ((m = route('GET', '/api/buyers/:id'))) {
    const b = db.prepare('SELECT * FROM buyers WHERE id=?').get(m.id);
    if (!b) return err(res, 404, 'Buyer tidak ditemukan (mungkin telah digabung atau dihapus).');
    // profile quota: only counts first view of a buyer in the period
    const seen = db.prepare('SELECT 1 FROM profile_views WHERE user_id=? AND buyer_id=? AND period=?').get(user.id, b.id, period());
    if (!seen) {
      const qc = quotaCheck(db, user, 'profile');
      if (!qc.ok) return json(res, 402, { error: `Kuota profil lengkap bulan ini habis (${qc.used}/${qc.limit}). Upgrade untuk membuka profil buyer tanpa batas.`, quota: qc, upgrade: true });
      db.prepare('INSERT INTO profile_views (user_id,buyer_id,period) VALUES (?,?,?)').run(user.id, b.id, period());
      bumpUsage(db, user.id, 'profile');
    }
    const bHs = db.prepare(`SELECT bh.*, h.description_en, h.description_id FROM buyer_hs bh
      JOIN hs_codes h ON h.code = bh.hs_code WHERE bh.buyer_id=? ORDER BY bh.total_value_usd DESC`).all(b.id);
    const contacts = db.prepare('SELECT * FROM buyer_contacts WHERE buyer_id=?').all(b.id).map((c) => ({
      id: c.id, contact_type: c.contact_type, person_name: c.person_name, person_title: c.person_title, confidence: c.confidence,
      value: plan.contacts || c.contact_type === 'website' ? c.value : maskContact(c.contact_type, c.value),
      masked: !plan.contacts && c.contact_type !== 'website',
    }));
    const supplierCountries = db.prepare(`SELECT e.country, COUNT(*) n FROM shipments s JOIN exporters e ON e.id=s.exporter_id
      WHERE s.buyer_id=? GROUP BY e.country ORDER BY n DESC`).all(b.id);
    const fit = productFit(userHs, bHs.map((x) => x.hs_code));
    const score = finalScore(b, fit);
    const inLists = db.prepare(`SELECT l.id, l.name, lb.status FROM list_buyers lb JOIN lists l ON l.id=lb.list_id
      WHERE l.user_id=? AND lb.buyer_id=?`).all(user.id, b.id);
    return json(res, 200, {
      ...b, country_name: COUNTRY_NAMES[b.country] || b.country,
      hs_codes: bHs, contacts, contacts_visible: plan.contacts,
      supplier_countries: supplierCountries.map((s) => ({ ...s, name: COUNTRY_NAMES[s.country] || s.country })),
      score, fit_score: fit, score_label: scoreLabel(score),
      score_components: { activity: b.activity_score, growth: b.growth_score, product_fit: fit, reachability: b.reachability_score, untapped: b.untapped_score },
      in_lists: inLists,
      quota: quotaCheck(db, user, 'profile'),
    });
  }

  if ((m = route('GET', '/api/buyers/:id/shipments'))) {
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = 20;
    const total = db.prepare('SELECT COUNT(*) c FROM shipments WHERE buyer_id=?').get(m.id).c;
    const rows = db.prepare(`SELECT s.*, e.name exporter_name, e.country exporter_country, e.is_indonesian
      FROM shipments s JOIN exporters e ON e.id=s.exporter_id WHERE s.buyer_id=?
      ORDER BY s.shipment_date DESC LIMIT ? OFFSET ?`).all(m.id, per, (pageN - 1) * per);
    const monthly = db.prepare(`SELECT substr(shipment_date,1,7) ym, COUNT(*) n, SUM(weight_kg) w, SUM(value_usd) v
      FROM shipments WHERE buyer_id=? AND shipment_date >= date('now','-24 months') GROUP BY ym ORDER BY ym`).all(m.id);
    return json(res, 200, { total, page: pageN, per, rows, monthly });
  }

  if ((m = route('GET', '/api/buyers/:id/suppliers'))) {
    const rows = db.prepare(`SELECT e.id, e.name, e.country, e.is_indonesian, COUNT(*) shipments,
      SUM(s.weight_kg) volume_kg, SUM(s.value_usd) value_usd, MIN(s.shipment_date) first_date, MAX(s.shipment_date) last_date,
      GROUP_CONCAT(DISTINCT s.hs_code) hs_codes
      FROM shipments s JOIN exporters e ON e.id=s.exporter_id WHERE s.buyer_id=?
      GROUP BY e.id ORDER BY value_usd DESC`).all(m.id);
    return json(res, 200, rows.map((r) => ({ ...r, country_name: COUNTRY_NAMES[r.country] || r.country })));
  }

  if ((m = route('GET', '/api/buyers/:id/insights'))) {
    const b = db.prepare('SELECT * FROM buyers WHERE id=?').get(m.id);
    if (!b) return err(res, 404, 'Buyer tidak ditemukan.');
    const sup = db.prepare(`SELECT e.country, COUNT(*) n FROM shipments s JOIN exporters e ON e.id=s.exporter_id
      WHERE s.buyer_id=? GROUP BY e.country ORDER BY n DESC`).all(b.id);
    const totalN = sup.reduce((a, x) => a + x.n, 0) || 1;
    const monthly = db.prepare(`SELECT CAST(substr(shipment_date,6,2) AS INT) mo, COUNT(*) n FROM shipments WHERE buyer_id=? GROUP BY mo ORDER BY n DESC`).all(b.id);
    const topHs = db.prepare(`SELECT bh.hs_code, h.description_id FROM buyer_hs bh JOIN hs_codes h ON h.code=bh.hs_code
      WHERE bh.buyer_id=? ORDER BY bh.total_value_usd DESC LIMIT 1`).get(b.id);
    const insights = [];
    if (sup.length) {
      const mix = sup.slice(0, 3).map((s) => `${COUNTRY_NAMES[s.country] || s.country} ${Math.round((s.n / totalN) * 100)}%`).join(', ');
      insights.push(`Pemasok utama buyer ini: ${mix}.`);
    }
    const idSup = sup.find((s) => s.country === 'ID');
    insights.push(idSup
      ? `Sudah pernah impor dari Indonesia (${Math.round((idSup.n / totalN) * 100)}% dari shipment). Pintu masuk lebih mudah, tonjolkan diferensiasi kualitas dan harga.`
      : `Belum pernah impor dari Indonesia. Peluang untapped, gunakan angle keunggulan origin Indonesia dan tawarkan sampel gratis.`);
    if (b.yoy_percent !== null) insights.push(b.yoy_percent >= 0
      ? `Volume impor tumbuh ${b.yoy_percent}% YoY. Buyer sedang ekspansi, kemungkinan mencari pemasok tambahan.`
      : `Volume impor turun ${Math.abs(b.yoy_percent)}% YoY. Mungkin sedang konsolidasi pemasok; tawarkan harga kompetitif.`);
    if (monthly.length >= 3) {
      const peak = monthly.slice(0, 2).map((x) => MONTHS_ID[x.mo - 1]).join(' & ');
      insights.push(`Puncak aktivitas impor di bulan ${peak}. Mulai outreach 2–3 bulan sebelumnya agar masuk siklus pembelian.`);
    }
    if (topHs) insights.push(`Produk utama yang diimpor: HS ${topHs.hs_code} (${topHs.description_id}).`);
    const similar = db.prepare(`SELECT id, name, country, base_score FROM buyers
      WHERE industry=? AND id != ? ORDER BY base_score DESC LIMIT 3`).all(b.industry, b.id)
      .map((s) => ({ ...s, country_name: COUNTRY_NAMES[s.country] || s.country }));
    const angle = idSup
      ? 'Posisikan sebagai pemasok Indonesia alternatif dengan kualitas konsisten dan harga FOB kompetitif.'
      : 'First-mover advantage: perkenalkan keunggulan origin Indonesia, sertakan sertifikasi dan tawaran sampel gratis di email pertama.';
    return json(res, 200, { insights, recommended_angle: angle, similar });
  }

  // ===== shipment explorer (F3) =====
  if (route('GET', '/api/shipments')) {
    const where = []; const args = [];
    const add = (cond, v) => { where.push(cond); args.push(v); };
    if (q.get('hs')) add('s.hs_code LIKE ?', q.get('hs') + '%');
    if (q.get('buyer_q')) add('b.name LIKE ?', '%' + q.get('buyer_q') + '%');
    if (q.get('exporter_q')) add('e.name LIKE ?', '%' + q.get('exporter_q') + '%');
    if (q.get('origin')) add('e.country = ?', q.get('origin'));
    if (q.get('dest')) add('b.country = ?', q.get('dest'));
    if (q.get('from')) add('s.shipment_date >= ?', q.get('from'));
    if (q.get('to')) add('s.shipment_date <= ?', q.get('to'));
    const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const groupBy = q.get('group_by');
    if (groupBy) {
      const keyMap = {
        buyer: ["b.name || ' · ' || b.country", 'b.name'], exporter: ["e.name || ' · ' || e.country", 'e.name'],
        hs: ['s.hs_code', 's.hs_code'], month: ["substr(s.shipment_date,1,7)", "substr(s.shipment_date,1,7)"],
      }[groupBy];
      if (!keyMap) return err(res, 400, 'group_by tidak valid.');
      const rows = db.prepare(`SELECT ${keyMap[0]} grp, COUNT(*) shipments, SUM(s.weight_kg) volume_kg, SUM(s.value_usd) value_usd
        FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
        ${W} GROUP BY ${keyMap[1]} ORDER BY value_usd DESC LIMIT 100`).all(...args);
      return json(res, 200, { grouped: true, rows });
    }
    const pageN = Math.max(1, parseInt(q.get('page') || '1', 10));
    const per = 25;
    const total = db.prepare(`SELECT COUNT(*) c FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id ${W}`).get(...args).c;
    const rows = db.prepare(`SELECT s.*, b.name buyer_name, b.country buyer_country, e.name exporter_name, e.country exporter_country, e.is_indonesian
      FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
      ${W} ORDER BY s.shipment_date DESC LIMIT ? OFFSET ?`).all(...args, per, (pageN - 1) * per);
    return json(res, 200, { grouped: false, total, page: pageN, per, rows });
  }

  // ===== export CSV =====
  if (route('GET', '/api/export/shipments')) {
    const limit = plan.export;
    if (!limit) return err(res, 402, 'Ekspor data tersedia mulai paket Starter. Upgrade untuk mengunduh CSV.');
    const rows = db.prepare(`SELECT s.shipment_date, s.hs_code, b.name buyer, b.country, e.name exporter, e.country origin,
      s.origin_port, s.dest_port, s.weight_kg, s.value_usd, s.goods_description
      FROM shipments s JOIN buyers b ON b.id=s.buyer_id JOIN exporters e ON e.id=s.exporter_id
      ${q.get('buyer_id') ? 'WHERE s.buyer_id = ?' : ''} ORDER BY s.shipment_date DESC LIMIT ?`)
      .all(...(q.get('buyer_id') ? [q.get('buyer_id')] : []), Math.min(limit, 10000));
    const head = Object.keys(rows[0] || { info: '' });
    const csv = [`# EksporIn export | ${user.email} | ${new Date().toISOString()} (watermarked)`, head.join(','),
      ...rows.map((r) => head.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    bumpUsage(db, user.id, 'export', rows.length);
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="eksporin-shipments.csv"' });
    return res.end(csv);
  }

  // ===== lists (F5) =====
  if (route('GET', '/api/lists')) {
    const rows = db.prepare(`SELECT l.*, (SELECT COUNT(*) FROM list_buyers lb WHERE lb.list_id=l.id) buyer_count
      FROM lists l WHERE l.user_id=? ORDER BY l.created_at DESC`).all(user.id);
    return json(res, 200, rows);
  }
  if (route('POST', '/api/lists')) {
    const { name, description, color } = body || {};
    if (!name) return err(res, 400, 'Nama daftar wajib diisi.');
    db.prepare('INSERT INTO lists (user_id,name,description,color) VALUES (?,?,?,?)').run(user.id, name, description || null, color || '#2563EB');
    return json(res, 201, db.prepare('SELECT * FROM lists WHERE id = last_insert_rowid()').get());
  }
  if ((m = route('GET', '/api/lists/:id'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    const buyers = db.prepare(`SELECT lb.*, b.name, b.country, b.city, b.industry, b.size_bucket, b.base_score,
      b.shipments_12mo, b.last_shipment_date FROM list_buyers lb JOIN buyers b ON b.id=lb.buyer_id
      WHERE lb.list_id=? ORDER BY lb.added_at DESC`).all(m.id);
    return json(res, 200, { ...l, buyers: buyers.map((x) => {
      const fit = productFit(userHs, buyerHsCodes(db, x.buyer_id));
      const bb = db.prepare('SELECT * FROM buyers WHERE id=?').get(x.buyer_id);
      const score = finalScore(bb, fit);
      return { ...x, tags: JSON.parse(x.tags || '[]'), country_name: COUNTRY_NAMES[x.country] || x.country, score, score_label: scoreLabel(score) };
    }) });
  }
  if ((m = route('PATCH', '/api/lists/:id'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    db.prepare('UPDATE lists SET name=COALESCE(?,name), description=COALESCE(?,description), color=COALESCE(?,color) WHERE id=?')
      .run(body.name ?? null, body.description ?? null, body.color ?? null, m.id);
    return json(res, 200, { ok: true });
  }
  if ((m = route('DELETE', '/api/lists/:id'))) {
    db.prepare('DELETE FROM list_buyers WHERE list_id IN (SELECT id FROM lists WHERE id=? AND user_id=?)').run(m.id, user.id);
    db.prepare('DELETE FROM lists WHERE id=? AND user_id=?').run(m.id, user.id);
    return json(res, 200, { ok: true });
  }
  if ((m = route('POST', '/api/lists/:id/buyers'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    const cap = plan.saved;
    if (cap !== null && savedCount(db, user.id) >= cap)
      return json(res, 402, { error: `Paket ${plan.name} maksimal menyimpan ${cap} buyer. Upgrade untuk simpan tanpa batas.`, upgrade: true });
    db.prepare('INSERT OR IGNORE INTO list_buyers (list_id,buyer_id) VALUES (?,?)').run(m.id, body.buyer_id);
    return json(res, 201, { ok: true });
  }
  if ((m = route('PATCH', '/api/lists/:id/buyers/:bid'))) {
    const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(m.id, user.id);
    if (!l) return err(res, 404, 'Daftar tidak ditemukan.');
    db.prepare(`UPDATE list_buyers SET status=COALESCE(?,status), priority=COALESCE(?,priority),
      tags=COALESCE(?,tags), reminder_at=COALESCE(?,reminder_at) WHERE list_id=? AND buyer_id=?`)
      .run(body.status ?? null, body.priority ?? null, body.tags ? JSON.stringify(body.tags) : null, body.reminder_at ?? null, m.id, m.bid);
    return json(res, 200, { ok: true });
  }
  if ((m = route('DELETE', '/api/lists/:id/buyers/:bid'))) {
    db.prepare('DELETE FROM list_buyers WHERE list_id IN (SELECT id FROM lists WHERE id=? AND user_id=?) AND buyer_id=?').run(m.id, user.id, m.bid);
    return json(res, 200, { ok: true });
  }

  // ===== notes =====
  if (route('GET', '/api/notes')) {
    const rows = db.prepare('SELECT * FROM notes WHERE user_id=? AND buyer_id=? ORDER BY created_at DESC').all(user.id, q.get('buyer_id'));
    return json(res, 200, rows);
  }
  if (route('POST', '/api/notes')) {
    if (!body.buyer_id || !body.body) return err(res, 400, 'Isi catatan kosong.');
    db.prepare('INSERT INTO notes (user_id,buyer_id,body) VALUES (?,?,?)').run(user.id, body.buyer_id, body.body);
    return json(res, 201, { ok: true });
  }
  if ((m = route('DELETE', '/api/notes/:id'))) {
    db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(m.id, user.id);
    return json(res, 200, { ok: true });
  }

  // ===== outreach (F6) =====
  if (route('GET', '/api/templates')) {
    let sys = db.prepare('SELECT * FROM templates WHERE user_id IS NULL ORDER BY id').all();
    const capT = plan.sys_templates;
    if (capT !== null) sys = sys.map((t, i) => ({ ...t, locked: i >= capT }));
    const own = db.prepare('SELECT * FROM templates WHERE user_id=? ORDER BY id DESC').all(user.id);
    return json(res, 200, { system: sys, own });
  }
  if (route('POST', '/api/templates')) {
    const { name, category, language, channel, subject, body: tbody } = body || {};
    if (!name || !tbody) return err(res, 400, 'Nama dan isi template wajib diisi.');
    db.prepare('INSERT INTO templates (user_id,category,language,channel,name,subject,body) VALUES (?,?,?,?,?,?,?)')
      .run(user.id, category || 'first_touch', language || 'en', channel || 'email', name, subject || null, tbody);
    return json(res, 201, { ok: true });
  }
  if (route('POST', '/api/outreach/preview')) {
    const tpl = db.prepare('SELECT * FROM templates WHERE id=? AND (user_id IS NULL OR user_id=?)').get(body.template_id, user.id);
    const buyer = db.prepare('SELECT * FROM buyers WHERE id=?').get(body.buyer_id);
    if (!tpl || !buyer) return err(res, 404, 'Template atau buyer tidak ditemukan.');
    const rendered = renderTemplate(db, tpl, buyer, user);
    const email = db.prepare("SELECT value FROM buyer_contacts WHERE buyer_id=? AND contact_type='email' LIMIT 1").get(buyer.id);
    const phone = db.prepare("SELECT value FROM buyer_contacts WHERE buyer_id=? AND contact_type='phone' LIMIT 1").get(buyer.id);
    return json(res, 200, {
      ...rendered, buyer_name: buyer.name,
      to_email: email ? (plan.contacts ? email.value : maskContact('email', email.value)) : null,
      to_phone: phone ? (plan.contacts ? phone.value : maskContact('phone', phone.value)) : null,
      contacts_visible: plan.contacts,
    });
  }
  if (route('POST', '/api/outreach/send')) {
    const ids = (body.buyer_ids || []).slice(0, 50);
    if (!ids.length) return err(res, 400, 'Pilih minimal satu buyer.');
    const tpl = db.prepare('SELECT * FROM templates WHERE id=? AND (user_id IS NULL OR user_id=?)').get(body.template_id, user.id);
    if (!tpl) return err(res, 404, 'Template tidak ditemukan.');
    if (tpl.user_id === null && plan.sys_templates !== null) {
      const idx = db.prepare('SELECT COUNT(*) c FROM templates WHERE user_id IS NULL AND id < ?').get(tpl.id).c;
      if (idx >= plan.sys_templates) return json(res, 402, { error: 'Template ini terkunci di paket Anda. Upgrade untuk membuka semua template.', upgrade: true });
    }
    const qc = quotaCheck(db, user, 'send');
    if (!qc.ok || qc.used + ids.length > (qc.limit ?? Infinity))
      return json(res, 402, { error: `Kuota kirim bulan ini tidak cukup (terpakai ${qc.used}/${qc.limit}). Upgrade paket untuk kuota lebih besar.`, upgrade: true });
    // anti-abuse: same template to same buyer within 14 days
    const sent = [];
    for (const bid of ids) {
      const dup = db.prepare(`SELECT 1 FROM messages WHERE user_id=? AND buyer_id=? AND template_id=? AND sent_at >= datetime('now','-14 days')`).get(user.id, bid, tpl.id);
      if (dup) { sent.push({ buyer_id: bid, skipped: 'Template sama sudah dikirim ke buyer ini dalam 14 hari terakhir.' }); continue; }
      const buyer = db.prepare('SELECT * FROM buyers WHERE id=?').get(bid);
      if (!buyer) continue;
      const r = renderTemplate(db, tpl, buyer, user);
      db.prepare('INSERT INTO messages (user_id,buyer_id,template_id,channel,subject,body,status) VALUES (?,?,?,?,?,?,?)')
        .run(user.id, bid, tpl.id, body.channel || tpl.channel, r.subject, r.body, 'sent');
      bumpUsage(db, user.id, 'send');
      // auto-update pipeline status new → contacted
      db.prepare(`UPDATE list_buyers SET status='contacted' WHERE buyer_id=? AND status='new'
        AND list_id IN (SELECT id FROM lists WHERE user_id=?)`).run(bid, user.id);
      sent.push({ buyer_id: bid, ok: true });
    }
    return json(res, 200, { sent, quota: quotaCheck(db, user, 'send') });
  }
  if (route('GET', '/api/outreach/messages')) {
    let rows = db.prepare(`SELECT msg.*, b.name buyer_name, b.country buyer_country FROM messages msg
      JOIN buyers b ON b.id=msg.buyer_id WHERE msg.user_id=? ${q.get('buyer_id') ? 'AND msg.buyer_id=?' : ''}
      ORDER BY msg.sent_at DESC LIMIT 100`).all(...(q.get('buyer_id') ? [user.id, q.get('buyer_id')] : [user.id]));
    rows = rows.map((msg) => simulateTracking(db, msg));
    return json(res, 200, rows);
  }

  // ===== alerts (F7) =====
  if (route('GET', '/api/alerts')) {
    materializeAlerts(db, user);
    if (plan.alerts === 0) return json(res, 200, { locked: true, alerts: [] });
    let rows = db.prepare('SELECT * FROM alerts WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 100').all(user.id);
    if (plan.alerts !== null) rows = rows.slice(0, plan.alerts);
    return json(res, 200, { locked: false, capped: plan.alerts, alerts: rows });
  }
  if (route('POST', '/api/alerts/read')) {
    if (body.id) db.prepare('UPDATE alerts SET read=1 WHERE user_id=? AND id=?').run(user.id, body.id);
    else db.prepare('UPDATE alerts SET read=1 WHERE user_id=?').run(user.id);
    return json(res, 200, { ok: true });
  }

  // ===== dashboard =====
  if (route('GET', '/api/dashboard')) {
    materializeAlerts(db, user);
    const countries = JSON.parse(user.target_countries || '[]');
    // recommendations: top buyers for user's HS focus + target countries, not yet saved
    let recSql = `SELECT b.* FROM buyers b WHERE b.id NOT IN
      (SELECT lb.buyer_id FROM list_buyers lb JOIN lists l ON l.id=lb.list_id WHERE l.user_id=?)`;
    const recArgs = [user.id];
    if (userHs.length) {
      recSql += ` AND b.id IN (SELECT buyer_id FROM buyer_hs WHERE ${userHs.map(() => 'hs_code LIKE ?').join(' OR ')})`;
      recArgs.push(...userHs.map((h) => h.slice(0, 4) + '%'));
    }
    if (countries.length) { recSql += ` AND b.country IN (${countries.map(() => '?').join(',')})`; recArgs.push(...countries); }
    let recs = db.prepare(recSql).all(...recArgs).map((b) => {
      const fit = productFit(userHs, buyerHsCodes(db, b.id));
      const score = finalScore(b, fit);
      return { id: b.id, name: b.name, country: b.country, country_name: COUNTRY_NAMES[b.country] || b.country, city: b.city, industry: b.industry, shipments_12mo: b.shipments_12mo, volume_12mo_kg: b.volume_12mo_kg, has_indonesian_supplier: !!b.has_indonesian_supplier, score, score_label: scoreLabel(score) };
    }).sort((a, b) => b.score - a.score).slice(0, 6);

    // pipeline stats
    const pipeline = db.prepare(`SELECT lb.status, COUNT(*) n FROM list_buyers lb JOIN lists l ON l.id=lb.list_id
      WHERE l.user_id=? GROUP BY lb.status`).all(user.id);

    // market trend: monthly volume for user's HS focus in target countries, last 12 months
    let trend = [];
    if (userHs.length) {
      const hsConds = userHs.map(() => 's.hs_code LIKE ?').join(' OR ');
      const args2 = userHs.map((h) => h.slice(0, 4) + '%');
      let cSql = '';
      if (countries.length) { cSql = ` AND b.country IN (${countries.map(() => '?').join(',')})`; args2.push(...countries); }
      trend = db.prepare(`SELECT substr(s.shipment_date,1,7) ym, COUNT(*) n, SUM(s.weight_kg) w, SUM(s.value_usd) v
        FROM shipments s JOIN buyers b ON b.id=s.buyer_id
        WHERE (${hsConds})${cSql} AND s.shipment_date >= date('now','-12 months') GROUP BY ym ORDER BY ym`).all(...args2);
    }
    // buyer count per target country for user's HS
    let countryBreakdown = [];
    if (userHs.length) {
      countryBreakdown = db.prepare(`SELECT b.country, COUNT(DISTINCT b.id) n FROM buyers b JOIN buyer_hs bh ON bh.buyer_id=b.id
        WHERE ${userHs.map(() => 'bh.hs_code LIKE ?').join(' OR ')} GROUP BY b.country ORDER BY n DESC`)
        .all(...userHs.map((h) => h.slice(0, 4) + '%'))
        .map((r) => ({ ...r, name: COUNTRY_NAMES[r.country] || r.country }));
    }
    const msgs = db.prepare(`SELECT COUNT(*) total,
      SUM(CASE WHEN status IN ('opened','replied') THEN 1 ELSE 0 END) opened,
      SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) replied FROM messages WHERE user_id=?`).get(user.id);
    return json(res, 200, {
      recommendations: recs, pipeline, trend, country_breakdown: countryBreakdown,
      outreach: msgs, saved: savedCount(db, user.id),
      alerts_unread: db.prepare('SELECT COUNT(*) c FROM alerts WHERE user_id=? AND read=0').get(user.id).c,
    });
  }

  // ===== AI Buyer Discovery Engine =====
  if (route('POST', '/api/discover')) {
    const { query } = body || {};
    if (!query || query.trim().length < 3) return err(res, 400, 'Masukkan deskripsi produk yang ingin dicari buyer-nya.');

    // Step 1: HS Code Mapping (simulated LLM)
    const qLower = query.toLowerCase();
    const HS_MAP = [
      { keywords: ['vanili', 'vanilla', 'vanila', 'vanilla bean', 'vanili kering', 'vanili polong', 'tahitian', 'planifolia'], hs: '0905', desc_en: 'Vanilla beans', desc_id: 'Vanili', industry: ['Food & Beverage', 'Flavoring', 'Confectionery', 'Extract Manufacturing'], titles: ['Procurement Manager', 'Sourcing Director', 'Head of Purchasing', 'Supply Chain Director', 'Category Buyer'], cargo_keywords: ['VANILLA BEANS', 'VANILLA PODS', 'DRIED VANILLA', 'VANILLA EXTRACT', 'CURED VANILLA'] },
      { keywords: ['kopi', 'coffee', 'arabica', 'robusta', 'gayo', 'toraja', 'flores', 'java', 'luwak', 'green bean'], hs: '0901', desc_en: 'Coffee', desc_id: 'Kopi', industry: ['Coffee Roasters', 'Specialty Coffee', 'FMCG'], titles: ['Head of Sourcing', 'Green Coffee Buyer', 'Purchasing Manager'] },
      { keywords: ['lada', 'pepper', 'merica', 'lada hitam', 'lada putih', 'muntok'], hs: '0904', desc_en: 'Pepper', desc_id: 'Lada', industry: ['Spices', 'Food Ingredients'], titles: ['Procurement Manager', 'Sourcing Director'] },
      { keywords: ['pala', 'nutmeg', 'fuli', 'mace'], hs: '0908', desc_en: 'Nutmeg', desc_id: 'Pala', industry: ['Spices', 'Essential Oils'], titles: ['Category Buyer', 'Supply Chain Manager'] },
      { keywords: ['kayu manis', 'cinnamon', 'cassia', 'cinnamomum'], hs: '0906', desc_en: 'Cinnamon', desc_id: 'Kayu manis', industry: ['Spices', 'Food & Beverage', 'Bakery Ingredients'], titles: ['Procurement Manager', 'Category Buyer', 'Sourcing Director'] },
      { keywords: ['cengkeh', 'clove', 'cloves'], hs: '0907', desc_en: 'Cloves', desc_id: 'Cengkeh', industry: ['Spices', 'Cigarette Manufacturing', 'Essential Oils'], titles: ['Procurement Manager', 'Sourcing Director'] },
      { keywords: ['udang', 'shrimp', 'prawn', 'vannamei', 'lobster', 'kepiting', 'crab'], hs: '0306', desc_en: 'Shrimps and prawns', desc_id: 'Udang', industry: ['Seafood', 'Frozen Foods'], titles: ['Seafood Buyer', 'Procurement Lead'] },
      { keywords: ['tuna', 'cakalang', 'skipjack', 'ikan'], hs: '0303', desc_en: 'Fish, frozen', desc_id: 'Ikan beku', industry: ['Seafood', 'Marine Foods'], titles: ['Purchasing Manager', 'Import Director'] },
      { keywords: ['kelapa', 'coconut', 'kopra', 'coco', 'santan', 'coconut oil'], hs: '1513', desc_en: 'Coconut oil', desc_id: 'Minyak kelapa', industry: ['Agri-food', 'Oils & Fats'], titles: ['Commodity Trader', 'Procurement Manager'] },
      { keywords: ['kakao', 'cocoa', 'cokelat', 'chocolate', 'cacao'], hs: '1801', desc_en: 'Cocoa beans', desc_id: 'Biji kakao', industry: ['Chocolate Manufacturing', 'Confectionery', 'Food Processing'], titles: ['Cocoa Buyer', 'Procurement Manager', 'Sourcing Director'] },
      { keywords: ['sawit', 'palm oil', 'cpo', 'palm', 'minyak sawit'], hs: '1511', desc_en: 'Palm oil', desc_id: 'Minyak sawit', industry: ['Oils & Fats', 'FMCG', 'Oleochemicals'], titles: ['Commodity Trader', 'Procurement Manager', 'Supply Chain Director'] },
      { keywords: ['karet', 'rubber', 'sir', 'latex'], hs: '4001', desc_en: 'Natural rubber', desc_id: 'Karet alam', industry: ['Rubber', 'Industrial Materials'], titles: ['Purchasing Manager', 'Technical Buyer'] },
      { keywords: ['kayu', 'wood', 'plywood', 'timber', 'kayu lapis'], hs: '4412', desc_en: 'Plywood', desc_id: 'Kayu lapis', industry: ['Wood products', 'Building Materials'], titles: ['Procurement Lead', 'Import Manager'] },
      { keywords: ['rotan', 'rattan', 'anyaman', 'basket', 'kerajinan'], hs: '4602', desc_en: 'Basketwork of rattan', desc_id: 'Anyaman rotan', industry: ['Home & living', 'Decor'], titles: ['Product Sourcing Manager', 'Buyer'] },
      { keywords: ['furni', 'furniture', 'mebel', 'kursi', 'meja', 'teak', 'jati', 'jepara', 'mahogany'], hs: '9403', desc_en: 'Furniture', desc_id: 'Perabot', industry: ['Furniture', 'Interiors'], titles: ['Sourcing Director', 'Category Manager', 'Import Director'] },
      { keywords: ['tekstil', 'textile', 'garmen', 'garment', 'kain', 'fabric', 'batik'], hs: '6204', desc_en: 'Garments & textiles', desc_id: 'Tekstil & garmen', industry: ['Fashion', 'Textile Manufacturing', 'Retail'], titles: ['Sourcing Manager', 'Merchandiser', 'Import Director'] },
    ];

    let matched = HS_MAP.find((m) => m.keywords.some((k) => qLower.includes(k)));
    if (!matched) {
      // Fallback: search by text across HS codes in DB
      const hsMatch = db.prepare("SELECT * FROM hs_codes WHERE description_en LIKE ? OR description_id LIKE ? LIMIT 1").get('%' + query + '%', '%' + query + '%');
      if (hsMatch) {
        matched = { hs: hsMatch.code.slice(0, 4), desc_en: hsMatch.description_en, desc_id: hsMatch.description_id, industry: ['General Trade'], titles: ['Procurement Manager', 'Sourcing Director', 'Category Buyer'], cargo_keywords: [query.toUpperCase()] };
      } else {
        matched = { hs: '0901', desc_en: query, desc_id: query, industry: ['General Trade'], titles: ['Procurement Manager', 'Sourcing Director'], cargo_keywords: [query.toUpperCase()] };
      }
    }

    // Step 2: Trade Records & Company Retrieval
    const buyers = db.prepare(`
      SELECT b.*, SUM(bh.shipment_count) as shipment_count, SUM(bh.total_value_usd) as hs_value
      FROM buyers b
      JOIN buyer_hs bh ON bh.buyer_id = b.id
      WHERE bh.hs_code LIKE ?
      GROUP BY b.id
      ORDER BY b.base_score DESC, hs_value DESC
      LIMIT 20
    `).all(matched.hs + '%');

    // Step 3: Decision Maker Enrichment (simulated Apollo.io)
    const FIRST_NAMES = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Yuki', 'Kenji', 'Lars', 'Sanne', 'Ahmed', 'Olivia', 'Tom', 'Mei', 'Anna', 'John'];
    const LAST_NAMES = ['Miller', 'Chen', 'Tanaka', 'De Vries', 'Al Rashid', 'Wilson', 'Taylor', 'Brown', 'Smith', 'Johnson'];
    const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

    const results = buyers.map((b, idx) => {
      const r = rng(b.id * 7 + 31);
      const contacts = db.prepare('SELECT * FROM buyer_contacts WHERE buyer_id=?').all(b.id);
      const bHs = db.prepare('SELECT hs_code FROM buyer_hs WHERE buyer_id=?').all(b.id).map((x) => x.hs_code);
      const website = contacts.find((c) => c.contact_type === 'website');
      const domain = website ? website.value.replace(/https?:\/\/(www\.)?/, '').replace(/\/.*/, '') : null;

      // Simulated decision makers
      const numContacts = Math.floor(r() * 3) + 1;
      const decisionMakers = [];
      for (let i = 0; i < numContacts; i++) {
        const fn = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)];
        const ln = LAST_NAMES[Math.floor(r() * LAST_NAMES.length)];
        const title = matched.titles[Math.floor(r() * matched.titles.length)];
        decisionMakers.push({
          full_name: `${fn} ${ln}`,
          job_title: title,
          email: domain ? `${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}` : null,
          email_status: r() > 0.3 ? 'verified' : 'unverified',
          linkedin_url: `https://linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}-${Math.floor(r() * 9000 + 1000)}`,
          phone: contacts.find((c) => c.contact_type === 'phone')?.value || null,
        });
      }

      // Step 4: Match Score & Outreach Angle
      const idSup = b.has_indonesian_supplier;
      const activityBonus = b.shipments_12mo > 8 ? 20 : b.shipments_12mo > 3 ? 10 : 0;
      const growthBonus = (b.yoy_percent || 0) > 0 ? 15 : 0;
      const volumeBonus = b.volume_12mo_kg > 100000 ? 15 : b.volume_12mo_kg > 30000 ? 10 : 5;
      const untappedBonus = !idSup ? 20 : 5;
      const matchScore = Math.min(100, Math.max(10, 30 + activityBonus + growthBonus + volumeBonus + untappedBonus + Math.floor(r() * 10)));

      const angles = {
        high_growth: `${b.name} menunjukkan pertumbuhan impor ${b.yoy_percent || 0}% YoY. Timing tepat untuk masuk sebagai pemasok baru dengan penawaran harga FOB kompetitif dan sampel gratis.`,
        untapped: `${b.name} belum pernah impor dari Indonesia. Ini peluang first-mover: tonjolkan keunggulan origin Indonesia, sertifikasi, dan tawarkan trial shipment.`,
        existing: `${b.name} sudah familiar dengan pemasok Indonesia. Diferensiasi lewat kualitas konsisten, lead time lebih pendek, dan harga yang bersaing.`,
        volume: `${b.name} mengimpor volume besar (${Math.round(b.volume_12mo_kg / 1000)} ton/tahun). Tawarkan kontrak jangka panjang dengan harga volume discount.`,
      };
      let angle = angles.untapped;
      if (idSup) angle = angles.existing;
      if ((b.yoy_percent || 0) > 10) angle = angles.high_growth;
      if (b.volume_12mo_kg > 200000) angle = angles.volume;

      return {
        rank: idx + 1,
        company: {
          id: b.id, name: b.name, country: b.country,
          country_name: COUNTRY_NAMES[b.country] || b.country,
          city: b.city, industry: b.industry, size_bucket: b.size_bucket,
          domain, website: website?.value,
          annual_import_frequency: b.total_shipments,
          last_shipment_date: b.last_shipment_date,
          imported_hs_codes: bHs,
          primary_source_countries: [],
          company_tier: b.size_bucket === 'XL' ? 'Enterprise' : b.size_bucket === 'L' ? 'Mid-Market' : 'SMB',
        },
        decision_makers: decisionMakers,
        scoring: {
          match_score: matchScore,
          score_label: matchScore >= 80 ? 'Hot Lead' : matchScore >= 60 ? 'Warm Lead' : matchScore >= 40 ? 'Worth Exploring' : 'Low Priority',
          reasoning: `Skor ${matchScore}/100 berdasarkan: aktivitas impor ${b.shipments_12mo}x/tahun, volume ${Math.round(b.volume_12mo_kg / 1000)} ton, ${idSup ? 'sudah impor dari Indonesia' : 'belum pernah dari Indonesia (untapped)'}, growth ${b.yoy_percent || 0}% YoY.`,
          customized_pitch_angle: angle,
        },
        trade_data: {
          shipments_12mo: b.shipments_12mo,
          volume_12mo_kg: b.volume_12mo_kg,
          value_12mo_usd: b.value_12mo_usd,
          yoy_percent: b.yoy_percent,
          has_indonesian_supplier: !!b.has_indonesian_supplier,
        },
      };
    });

    results.sort((a, b) => b.scoring.match_score - a.scoring.match_score);

    const verifiedContacts = results.reduce((a, r) => a + r.decision_makers.filter((dm) => dm.email_status === 'verified').length, 0);
    const totalContacts = results.reduce((a, r) => a + r.decision_makers.length, 0);

    return json(res, 200, {
      query,
      interpretation: {
        hs_code_6_digit: matched.hs,
        hs_code_description: matched.desc_en,
        description_id: matched.desc_id,
        trade_manifest_keywords: matched.cargo_keywords || matched.keywords || [query],
        target_industry_segments: matched.industry,
        buyer_job_titles_to_target: matched.titles,
      },
      pipeline_steps: [
        { step: 1, name: 'Input Interpretation & HS Mapping', status: 'completed', result: `Mapped "${query}" → HS ${matched.hs} (${matched.desc_en})` },
        { step: 2, name: 'Trade Records & Company Retrieval', status: 'completed', result: `${buyers.length} importir ditemukan dari ${new Set(buyers.map((b) => b.country)).size} negara` },
        { step: 3, name: 'Decision Maker Enrichment', status: 'completed', result: `${totalContacts} kontak ditemukan, ${verifiedContacts} email terverifikasi` },
        { step: 4, name: 'Scoring & Final Synthesis', status: 'completed', result: `${results.filter((r) => r.scoring.match_score >= 80).length} hot leads, ${results.filter((r) => r.scoring.match_score >= 60 && r.scoring.match_score < 80).length} warm leads` },
      ],
      total_leads: results.length,
      leads: results,
    });
  }

  return err(res, 404, 'Endpoint tidak ditemukan.');
}

module.exports = { handleApi, PLANS };
