/* EksporIn SPA — vanilla JS, zero dependencies */
'use strict';

// ================= helpers =================
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('id-ID');
const fmtN = (n) => n == null ? '—' : nf.format(Math.round(n));
const fmtUSD = (n) => n == null ? '—' : '$' + nf.format(Math.round(n));
const fmtKg = (n) => n == null ? '—' : (n >= 1e6 ? nf.format(+(n / 1e6).toFixed(1)) + ' rb ton' : n >= 1000 ? nf.format(Math.round(n / 1000)) + ' ton' : nf.format(Math.round(n)) + ' kg');
const fmtIDR = (n) => 'Rp ' + nf.format(n);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDate = (s) => { if (!s) return '—'; const d = new Date(s.slice(0, 10)); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const FLAG = { US: '🇺🇸', JP: '🇯🇵', NL: '🇳🇱', AE: '🇦🇪', AU: '🇦🇺', ID: '🇮🇩', VN: '🇻🇳', BR: '🇧🇷', CO: '🇨🇴', IN: '🇮🇳', TH: '🇹🇭', CN: '🇨🇳', MY: '🇲🇾', EC: '🇪🇨', ET: '🇪🇹' };
const CNAME = { US: 'Amerika Serikat', JP: 'Jepang', NL: 'Belanda', AE: 'Uni Emirat Arab', AU: 'Australia', ID: 'Indonesia', VN: 'Vietnam', BR: 'Brasil', CO: 'Kolombia', IN: 'India', TH: 'Thailand', CN: 'Tiongkok', MY: 'Malaysia', EC: 'Ekuador', ET: 'Ethiopia' };
const flag = (c) => FLAG[c] || '🌐';
const scorePill = (score, label) => {
  if (score == null) return '<span class="pill pill-neutral">N/A</span>';
  const cls = label === 'Hot' ? 'pill-danger' : label === 'Warm' ? 'pill-warning' : label === 'Cold' ? 'pill-info' : 'pill-neutral';
  return `<span class="pill ${cls} num">${score} · ${label}</span>`;
};
const statusPill = (st) => {
  const map = { new: ['Baru', 'pill-neutral'], contacted: ['Dihubungi', 'pill-info'], responded: ['Merespons', 'pill-violet'], negotiating: ['Negosiasi', 'pill-warning'], won: ['Deal ✓', 'pill-success'], lost: ['Batal', 'pill-danger'] };
  const [t, c] = map[st] || [st, 'pill-neutral'];
  return `<span class="pill ${c}">${t}</span>`;
};
const STATUSES = ['new', 'contacted', 'responded', 'negotiating', 'won', 'lost'];
const STATUS_LBL = { new: 'Baru', contacted: 'Dihubungi', responded: 'Merespons', negotiating: 'Negosiasi', won: 'Deal', lost: 'Batal' };

// icons (Lucide-style, stroke 1.5)
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  ship: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.4 15 22 12l-3-1-1.7-4.3a1 1 0 0 0-.9-.7H7.6a1 1 0 0 0-.9.7L5 11l-3 1 2.6 3"/><path d="M12 6V3"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  logoW: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 22 L14 12 L18 17 L24 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// state
let ME = null;

// ================= API =================
async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (res.status === 401 && !path.includes('/auth/')) {
    if (path !== '/api/me') location.hash = '#/login'; // landing & requireMe handle /api/me themselves
    throw { status: 401, data };
  }
  if (res.status === 402) { upgradeModal(data.error); throw { status: 402, data, handled: true }; }
  if (!res.ok) throw { status: res.status, data };
  return data;
}

// ================= toast & modal =================
function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.innerHTML = esc(msg);
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
function modal(html, { wide = false } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-overlay"><div class="modal ${wide ? 'modal-wide' : ''}">
    <button class="close-x" onclick="closeModal()">${I.x}</button>${html}</div></div>`;
  $('.modal-overlay', root).addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(); });
}
window.closeModal = () => { $('#modal-root').innerHTML = ''; };
function upgradeModal(msg) {
  modal(`<h2 style="margin-bottom:8px">Kuota Anda habis</h2>
    <p class="muted" style="margin-bottom:20px">${esc(msg || 'Fitur ini membutuhkan paket lebih tinggi.')}</p>
    <div style="display:flex;gap:10px"><button class="btn btn-upgrade" onclick="closeModal();location.hash='#/billing'">Lihat paket & upgrade</button>
    <button class="btn btn-neutral" onclick="closeModal()">Nanti saja</button></div>`);
}

// ================= SVG charts =================
function lineChart(points, { w = 640, hgt = 200, color = 'var(--viz-1)', fmtY = fmtN, labelKey = 'ym', valKey = 'v' } = {}) {
  if (!points || points.length < 2) return '<div class="empty muted">Belum cukup data untuk grafik.</div>';
  const vals = points.map((p) => p[valKey] || 0);
  const max = Math.max(...vals) * 1.1 || 1;
  const px = (i) => 40 + (i / (points.length - 1)) * (w - 60);
  const py = (v) => hgt - 28 - (v / max) * (hgt - 48);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p[valKey] || 0).toFixed(1)}`).join(' ');
  const area = path + ` L${px(points.length - 1)},${hgt - 28} L${px(0)},${hgt - 28} Z`;
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="40" x2="${w - 20}" y1="${py(max * f / 1.1)}" y2="${py(max * f / 1.1)}" stroke="var(--viz-grid)" stroke-dasharray="4 4"/>`).join('');
  const labels = points.map((p, i) => (points.length > 8 && i % 2) ? '' : `<text x="${px(i)}" y="${hgt - 8}" font-size="10" fill="var(--viz-axis)" text-anchor="middle">${esc(String(p[labelKey]).slice(2))}</text>`).join('');
  const dots = points.map((p, i) => `<circle cx="${px(i)}" cy="${py(p[valKey] || 0)}" r="3" fill="${color}"><title>${esc(p[labelKey])}: ${fmtY(p[valKey])}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${hgt}" style="width:100%;height:auto">${gridLines}
    <path d="${area}" fill="${color}" opacity="0.08"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>${dots}${labels}</svg>`;
}
function barChart(points, { w = 640, hgt = 190, color = 'var(--viz-1)', labelKey = 'ym', valKey = 'v', fmtY = fmtN } = {}) {
  if (!points || !points.length) return '<div class="empty muted">Belum ada data.</div>';
  const max = Math.max(...points.map((p) => p[valKey] || 0)) || 1;
  const bw = Math.min(38, (w - 60) / points.length - 6);
  const bars = points.map((p, i) => {
    const x = 40 + i * ((w - 60) / points.length);
    const bh = ((p[valKey] || 0) / max) * (hgt - 48);
    return `<rect x="${x}" y="${hgt - 28 - bh}" width="${bw}" height="${Math.max(1, bh)}" rx="3" fill="${color}"><title>${esc(p[labelKey])}: ${fmtY(p[valKey])}</title></rect>
      ${points.length <= 13 ? `<text x="${x + bw / 2}" y="${hgt - 10}" font-size="10" fill="var(--viz-axis)" text-anchor="middle">${esc(String(p[labelKey]).slice(2))}</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${hgt}" style="width:100%;height:auto">${bars}</svg>`;
}
function gauge(score) {
  if (score == null) return '<div class="muted">N/A</div>';
  const r = 44, c = 2 * Math.PI * r, frac = score / 100;
  const col = score >= 80 ? '#B91C1C' : score >= 60 ? '#B45309' : score >= 40 ? '#1D4ED8' : '#94A3B8';
  return `<svg viewBox="0 0 110 110" width="110" height="110">
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--border-subtle)" stroke-width="10"/>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 55 55)"/>
    <text x="55" y="52" text-anchor="middle" font-size="26" font-weight="700" fill="var(--text-primary)">${score}</text>
    <text x="55" y="70" text-anchor="middle" font-size="10" fill="var(--text-secondary)">EksporIn Score</text></svg>`;
}
function scoreBars(components) {
  const rows = [['Aktivitas impor', components.activity, '30%'], ['Pertumbuhan', components.growth, '20%'], ['Kecocokan produk', components.product_fit, '25%'], ['Kontak tersedia', components.reachability, '15%'], ['Belum dari RI', components.untapped, '10%']];
  return `<div class="score-bars">${rows.map(([lbl, v, w]) => `
    <div class="sb-row"><span class="muted">${lbl} <span class="muted-3">(${w})</span></span>
    <div class="sb-track"><div class="sb-fill" style="width:${v ?? 0}%;background:${(v ?? 0) >= 70 ? 'var(--viz-2)' : (v ?? 0) >= 40 ? 'var(--viz-1)' : 'var(--viz-3)'}"></div></div>
    <b class="num">${v ?? '—'}</b></div>`).join('')}</div>`;
}

// ================= router =================
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}
const routes = [];
const route = (rx, fn) => routes.push([rx, fn]);
async function render() {
  const { path, params } = parseHash();
  const app = $('#app');
  for (const [rx, fn] of routes) {
    const m = path.match(rx);
    if (m) { try { await fn(app, m, params); } catch (e) { if (!e.handled) { console.error(e); app.innerHTML = shell(`<div class="empty"><div class="ic">⚠️</div><h3>Terjadi kesalahan</h3><p class="muted">${esc(e.data?.error || 'Coba muat ulang halaman.')}</p></div>`); bindShell(); } } return; }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', render);

// ================= app shell =================
function navItem(href, icon, label, badge = 0) {
  const active = ('#' + parseHash().path).startsWith(href.split('?')[0]) ? 'active' : '';
  return `<a class="nav-item ${active}" href="${href}">${icon}<span>${label}</span>${badge ? `<span class="cnt">${badge}</span>` : ''}</a>`;
}
function shell(content) {
  const u = ME;
  const planPill = { free: 'pill-neutral', starter: 'pill-info', growth: 'pill-success', business: 'pill-violet' }[u.plan] || 'pill-neutral';
  return `<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-brand"><span class="logo">${I.logoW}</span>EksporIn</div>
    <div class="sidebar-user"><span class="avatar">${esc((u.name || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase())}</span>
      <div style="min-width:0"><div class="nm">${esc(u.name)}</div><div class="em">${esc(u.org_name || u.email)}</div></div></div>
    <nav class="nav">
      ${navItem('#/dashboard', I.home, 'Dashboard')}
      ${navItem('#/direktori', I.grid, 'Direktori HS')}
      ${navItem('#/cari', I.search, 'Cari Buyer')}
      ${navItem('#/shipments', I.ship, 'Shipment Explorer')}
      <div class="nav-sep overline">Workspace</div>
      ${navItem('#/lists', I.bookmark, 'Daftar Tersimpan')}
      ${navItem('#/outreach', I.send, 'Outreach')}
      ${navItem('#/alerts', I.bell, 'Notifikasi', u.unread_alerts)}
      <div class="nav-sep overline">Akun</div>
      ${navItem('#/billing', I.card, 'Paket & Tagihan')}
      <a class="nav-item" href="#" id="nav-logout">${I.out}<span>Keluar</span></a>
    </nav>
    ${u.plan === 'free' || u.plan === 'starter' ? `<div class="sidebar-cta"><h4>Upgrade ke Growth</h4><p>Buka kontak buyer, 500 pencarian, & alert tanpa batas.</p><button class="btn" onclick="location.hash='#/billing'">Lihat paket</button></div>` : '<div style="margin-top:auto"></div>'}
  </aside>
  <div class="main">
    <header class="topbar">
      <div class="search-wrap">${I.search}<input class="input" id="global-search" placeholder="Cari buyer atau HS code… (Enter)"></div>
      <div class="topbar-right">
        <span class="pill ${planPill}">Paket ${esc(u.plan_name)}</span>
        <button class="bell" onclick="location.hash='#/alerts'" title="Notifikasi">${I.bell}${u.unread_alerts ? '<span class="dot"></span>' : ''}</button>
      </div>
    </header>
    <div class="content">${content}</div>
  </div></div>`;
}
function bindShell() {
  $('#nav-logout')?.addEventListener('click', async (e) => { e.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); ME = null; location.hash = '#/'; });
  $('#global-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const v = e.target.value.trim();
      location.hash = /^\d{2,6}$/.test(v) ? `#/cari?hs=${v}` : `#/cari?q=${encodeURIComponent(v)}`;
    }
  });
}
async function requireMe() {
  if (!ME) { try { ME = await api('/api/me'); } catch { location.hash = '#/login'; throw { handled: true }; } }
  if (!ME.onboarded && parseHash().path !== '/onboarding') { location.hash = '#/onboarding'; throw { handled: true }; }
  return ME;
}
async function refreshMe() { ME = await api('/api/me'); }

// ================= landing =================
route(/^\/$/, async (app) => {
  try { ME = await api('/api/me'); if (ME) { location.hash = '#/dashboard'; return; } } catch { /* not logged in */ }
  app.innerHTML = `
  <nav class="landing-nav"><div class="sidebar-brand" style="padding:0"><span class="logo">${I.logoW}</span>EksporIn</div>
    <div style="display:flex;gap:10px"><a class="btn btn-ghost" href="#/login">Masuk</a><a class="btn btn-primary" href="#/register">Daftar gratis</a></div></nav>
  <section class="landing-hero">
    <span class="pill pill-info" style="margin-bottom:16px">🇮🇩 Dibuat untuk UKM eksportir Indonesia</span>
    <h1>Temukan buyer luar negeri dari data bea cukai — bukan tebak-tebakan</h1>
    <p>Direktori importir global terorganisir per HS code, lengkap dengan riwayat shipment, skor prioritas, dan template outreach. Harga 1/20 dari Panjiva.</p>
    <div style="display:flex;gap:12px;justify-content:center"><a class="btn btn-lg btn-primary" href="#/register">Mulai gratis — tanpa kartu kredit</a><a class="btn btn-lg btn-neutral" href="#/login">Coba akun demo</a></div>
    <p class="caption" style="margin-top:14px;color:var(--text-tertiary)">Akun demo: demo@eksporin.id · demo1234</p>
  </section>
  <section class="landing-feats">
    ${[['📦', 'Direktori per HS Code', 'Telusuri ribuan importir aktif per kategori produk — kopi, furnitur, seafood, rempah, dan lainnya.'],
      ['🎯', 'EksporIn Score', 'Skor 0–100 per buyer berdasarkan aktivitas, pertumbuhan, kecocokan produk, dan ketersediaan kontak.'],
      ['🚢', 'Riwayat Shipment', 'Data bill of lading level: tanggal, volume, pelabuhan, nilai, dan siapa pemasok kompetitor Anda.'],
      ['✉️', 'Outreach Toolkit', 'Template email 5+ bahasa dengan variabel otomatis. Lacak terkirim, dibuka, dan dibalas.']]
      .map(([ic, t, d]) => `<div class="card"><div style="font-size:28px;margin-bottom:10px">${ic}</div><h3 style="margin-bottom:6px">${t}</h3><p class="muted body-sm">${d}</p></div>`).join('')}
  </section>`;
});

// ================= auth =================
function authHero() {
  return `<div class="auth-hero">
    <div class="sidebar-brand" style="padding:0;color:#fff"><span class="logo" style="background:rgba(255,255,255,.2)">${I.logoW}</span>EksporIn</div>
    <h1>Pipeline buyer global Anda dimulai dari sini.</h1>
    <p>Data customs jutaan shipment, diorganisir agar UKM Indonesia bisa menemukan buyer yang tepat dalam hitungan menit — bukan 40 jam per minggu.</p>
    <ul><li>✅ &nbsp;Direktori buyer per HS code dengan filter negara & volume</li>
    <li>✅ &nbsp;Skor prioritas otomatis per buyer</li>
    <li>✅ &nbsp;Template outreach multi-bahasa siap kirim</li>
    <li>✅ &nbsp;Alert saat buyer baru muncul di produk Anda</li></ul></div>`;
}
route(/^\/login$/, (app) => {
  app.innerHTML = `<div class="auth-page">${authHero()}<div class="auth-form-side"><div class="auth-card card">
    <h2 style="margin-bottom:4px">Masuk</h2><p class="muted body-sm" style="margin-bottom:20px">Belum punya akun? <a href="#/register">Daftar gratis</a></p>
    <form id="f"><div class="field"><label>Email</label><input class="input" name="email" type="email" required value="demo@eksporin.id"></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" required value="demo1234"></div>
    <button class="btn btn-primary" style="width:100%">Masuk</button></form>
    <p class="caption muted-3" style="margin-top:14px;text-align:center">Akun demo sudah terisi — langsung klik Masuk.</p></div></div></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
      ME = null; location.hash = r.onboarded ? '#/dashboard' : '#/onboarding';
    } catch (err) { toast(err.data?.error || 'Gagal masuk', true); }
  });
});
route(/^\/register$/, (app) => {
  app.innerHTML = `<div class="auth-page">${authHero()}<div class="auth-form-side"><div class="auth-card card">
    <h2 style="margin-bottom:4px">Daftar gratis</h2><p class="muted body-sm" style="margin-bottom:20px">Sudah punya akun? <a href="#/login">Masuk</a></p>
    <form id="f"><div class="field"><label>Nama lengkap</label><input class="input" name="name" required placeholder="Andi Prasetyo"></div>
    <div class="field"><label>Nama usaha (opsional)</label><input class="input" name="org_name" placeholder="PT Kopi Nusantara"></div>
    <div class="field"><label>Email</label><input class="input" name="email" type="email" required placeholder="anda@usaha.co.id"></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" required minlength="8" placeholder="Minimal 8 karakter"></div>
    <button class="btn btn-primary" style="width:100%">Buat akun</button></form></div></div></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/auth/register', { method: 'POST', body: Object.fromEntries(fd) });
      ME = null; location.hash = '#/onboarding';
    } catch (err) { toast(err.data?.error || 'Gagal mendaftar', true); }
  });
});

// ================= onboarding wizard =================
route(/^\/onboarding$/, async (app) => {
  try { ME = ME || await api('/api/me'); } catch { location.hash = '#/login'; return; }
  const leaves = await api('/api/hs/leaf');
  const state = { step: 0, hs: [], countries: [], export_status: null, goal: null, org: ME.org_name || '' };
  const COUNTRY_OPTS = ['US', 'JP', 'NL', 'AE', 'AU'];
  const draw = () => {
    const steps = [
      // 1: business
      () => `<h2>Profil usaha Anda</h2><p class="muted" style="margin-bottom:20px">Agar rekomendasi buyer relevan dengan bisnis Anda.</p>
        <div class="field"><label>Nama usaha</label><input class="input" id="w-org" value="${esc(state.org)}" placeholder="PT / CV / UD nama usaha"></div>`,
      // 2: products
      () => `<h2>Produk yang Anda ekspor</h2><p class="muted" style="margin-bottom:16px">Pilih 1–5 kode HS. Ini menentukan rekomendasi & alert Anda.</p>
        <div style="max-height:340px;overflow-y:auto">${leaves.map((l) => `
          <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}">
          <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span><div><b>${esc(l.description_id)}</b><div class="caption muted">${esc(l.description_en)}</div></div></div>`).join('')}</div>`,
      // 3: countries
      () => `<h2>Negara target</h2><p class="muted" style="margin-bottom:16px">Pilih pasar yang ingin Anda masuki.</p>
        ${COUNTRY_OPTS.map((c) => `<div class="option-card ${state.countries.includes(c) ? 'selected' : ''}" data-country="${c}">
          <span class="flag" style="font-size:22px">${flag(c)}</span><b>${CNAME[c]}</b></div>`).join('')}`,
      // 4: status
      () => `<h2>Status ekspor Anda saat ini</h2><p class="muted" style="margin-bottom:16px"></p>
        ${[['never', 'Belum pernah ekspor', 'Sedang mempersiapkan ekspor pertama'], ['occasional', 'Pernah beberapa kali', 'Sudah 1–5 kali ekspor, biasanya via broker'], ['regular', 'Rutin ekspor', 'Ekspor berkala ke satu atau lebih negara']].map(([v, t, d]) => `
        <div class="option-card ${state.export_status === v ? 'selected' : ''}" data-status="${v}"><div><b>${t}</b><div class="caption muted">${d}</div></div></div>`).join('')}`,
      // 5: goal
      () => `<h2>Tujuan utama Anda</h2><p class="muted" style="margin-bottom:16px"></p>
        ${[['find_buyers', 'Cari buyer baru', 'Temukan & hubungi importir potensial'], ['market_analysis', 'Analisis pasar', 'Pahami tren demand & harga per negara'], ['competitor_intel', 'Intel kompetitor', 'Lihat ke mana kompetitor mengekspor']].map(([v, t, d]) => `
        <div class="option-card ${state.goal === v ? 'selected' : ''}" data-goal="${v}"><div><b>${t}</b><div class="caption muted">${d}</div></div></div>`).join('')}`,
    ];
    app.innerHTML = `<div class="wizard"><div class="sidebar-brand" style="padding:0 0 20px"><span class="logo">${I.logoW}</span>EksporIn</div>
      <div class="wizard-steps">${[0, 1, 2, 3, 4].map((i) => `<div class="${i <= state.step ? 'done' : ''}"></div>`).join('')}</div>
      <div class="card">${steps[state.step]()}
      <div style="display:flex;justify-content:space-between;margin-top:24px">
        <button class="btn btn-ghost" id="w-back" ${state.step === 0 ? 'style="visibility:hidden"' : ''}>← Kembali</button>
        <div style="display:flex;gap:8px"><button class="btn btn-neutral" id="w-skip">Lewati</button>
        <button class="btn btn-primary" id="w-next">${state.step === 4 ? 'Selesai & buka dashboard' : 'Lanjut →'}</button></div></div></div></div>`;
    // bind
    $$('.option-card[data-hs]').forEach((el) => el.onclick = () => {
      const c = el.dataset.hs;
      state.hs = state.hs.includes(c) ? state.hs.filter((x) => x !== c) : (state.hs.length < 5 ? [...state.hs, c] : (toast('Maksimal 5 kode HS', true), state.hs));
      draw();
    });
    $$('.option-card[data-country]').forEach((el) => el.onclick = () => {
      const c = el.dataset.country;
      state.countries = state.countries.includes(c) ? state.countries.filter((x) => x !== c) : [...state.countries, c];
      draw();
    });
    $$('.option-card[data-status]').forEach((el) => el.onclick = () => { state.export_status = el.dataset.status; draw(); });
    $$('.option-card[data-goal]').forEach((el) => el.onclick = () => { state.goal = el.dataset.goal; draw(); });
    $('#w-back').onclick = () => { state.step = Math.max(0, state.step - 1); draw(); };
    const finish = async () => {
      await api('/api/me/onboarding', { method: 'POST', body: { hs_focus: state.hs, target_countries: state.countries, export_status: state.export_status, goal: state.goal, org_name: state.org || null } });
      ME = null; toast('Selamat datang di EksporIn! 🎉'); location.hash = '#/dashboard';
    };
    $('#w-skip').onclick = finish;
    $('#w-next').onclick = async () => {
      if (state.step === 0) state.org = $('#w-org').value.trim();
      if (state.step === 1 && !state.hs.length) return toast('Pilih minimal 1 kode HS', true);
      if (state.step === 2 && !state.countries.length) return toast('Pilih minimal 1 negara', true);
      if (state.step < 4) { state.step++; draw(); } else await finish();
    };
  };
  draw();
});

// ================= dashboard =================
route(/^\/dashboard$/, async (app) => {
  await requireMe();
  const d = await api('/api/dashboard');
  await refreshMe();
  const pl = Object.fromEntries(d.pipeline.map((p) => [p.status, p.n]));
  const q = ME.quotas;
  const quotaRow = (lbl, m) => {
    const pct = m.limit ? Math.min(100, (m.used / m.limit) * 100) : 0;
    return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span class="muted">${lbl}</span><b class="num">${m.used}${m.limit ? ' / ' + m.limit : ' · tanpa batas'}</b></div>
      <div class="progressbar ${pct > 80 ? 'warn' : ''}"><div style="width:${m.limit ? pct : 4}%"></div></div></div>`;
  };
  app.innerHTML = shell(`
    <div class="hero-card" style="margin-bottom:24px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
      <div><h1 style="margin-bottom:6px">Halo, ${esc(ME.name.split(' ')[0])} 👋</h1>
      <p class="muted">Fokus Anda: ${ME.hs_focus.map((h) => `<span class="hs-code-chip">${h.replace(/^(\d{4})/, '$1.')}</span>`).join(' ')} di ${ME.target_countries.map((c) => flag(c) + ' ' + CNAME[c]).join(', ') || 'semua negara'}</p></div>
      <button class="btn btn-primary" onclick="location.hash='#/cari${ME.hs_focus[0] ? '?hs=' + ME.hs_focus[0].slice(0, 4) : ''}'">${I.search} Cari buyer sekarang</button></div></div>
    <div class="grid grid-4" style="margin-bottom:24px">
      <div class="card card-compact metric-card"><div class="lbl">Buyer tersimpan</div><div class="numeric-lg">${fmtN(d.saved)}</div><div class="caption muted-3">di semua daftar</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Outreach terkirim</div><div class="numeric-lg">${fmtN(d.outreach.total || 0)}</div><div class="caption muted-3">${d.outreach.opened || 0} dibuka · ${d.outreach.replied || 0} dibalas</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Sedang negosiasi</div><div class="numeric-lg">${fmtN((pl.negotiating || 0) + (pl.responded || 0))}</div><div class="caption muted-3">${pl.won || 0} deal tercapai 🎉</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Notifikasi baru</div><div class="numeric-lg">${fmtN(d.alerts_unread)}</div><div class="caption"><a href="#/alerts">Lihat semua →</a></div></div>
    </div>
    <div class="grid grid-2" style="margin-bottom:24px">
      <div class="card"><div class="card-header"><h3>Tren pasar produk Anda</h3><span class="caption muted-3">Volume shipment 12 bulan</span></div>
        ${lineChart(d.trend, { valKey: 'w', fmtY: fmtKg })}</div>
      <div class="card"><div class="card-header"><h3>Buyer per negara</h3><span class="caption muted-3">untuk HS fokus Anda</span></div>
        ${d.country_breakdown.length ? d.country_breakdown.map((c) => {
          const max = d.country_breakdown[0].n;
          return `<div style="display:grid;grid-template-columns:150px 1fr 40px;gap:10px;align-items:center;margin-bottom:10px">
          <span class="body-sm">${flag(c.country)} ${esc(c.name)}</span>
          <div class="progressbar"><div style="width:${(c.n / max) * 100}%"></div></div><b class="num body-sm">${c.n}</b></div>`;
        }).join('') : '<div class="empty muted">Lengkapi onboarding untuk melihat data.</div>'}
        <div style="margin-top:14px">${quotaRow('Kuota pencarian', q.search)}${quotaRow('Kuota profil lengkap', q.profile)}${quotaRow('Kuota kirim outreach', q.send)}</div></div>
    </div>
    <div class="card"><div class="card-header"><h3>Rekomendasi buyer untuk Anda</h3><a class="btn btn-sm btn-ghost" href="#/cari${ME.hs_focus[0] ? '?hs=' + ME.hs_focus[0].slice(0, 4) : ''}">Lihat semua →</a></div>
      ${d.recommendations.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Buyer</th><th>Negara</th><th>Industri</th><th class="r">Shipment 12 bln</th><th class="r">Volume 12 bln</th><th>Skor</th><th></th></tr></thead><tbody>
      ${d.recommendations.map((b) => `<tr class="clickable" onclick="location.hash='#/buyer/${b.id}'">
        <td><b>${esc(b.name)}</b>${b.has_indonesian_supplier ? '' : ' <span class="pill pill-success" title="Belum pernah impor dari Indonesia">Untapped</span>'}</td>
        <td>${flag(b.country)} ${esc(b.country_name)}</td><td class="muted">${esc(b.industry)}</td>
        <td class="r num">${fmtN(b.shipments_12mo)}</td><td class="r num">${fmtKg(b.volume_12mo_kg)}</td>
        <td>${scorePill(b.score, b.score_label)}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();saveToList(${b.id})">+ Simpan</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><div class="ic">🔎</div><h3>Belum ada rekomendasi</h3><p class="muted">Lengkapi HS fokus & negara target di onboarding.</p></div>'}</div>`);
  bindShell();
});

// ================= HS directory =================
route(/^\/direktori$/, async (app, m, params) => {
  await requireMe();
  const parent = params.get('parent') || '';
  const nodes = await api('/api/hs' + (parent ? `?parent=${parent}` : ''));
  let crumb = '';
  if (parent) {
    const chain = [];
    let code = parent;
    while (code) { chain.unshift(code); code = code.length > 2 ? code.slice(0, code.length - 2) : null; }
    crumb = `<div class="breadcrumb"><a href="#/direktori">Semua bab</a>${chain.map((c) => `<span class="sep">/</span><a href="#/direktori?parent=${c}">${c.replace(/^(\d{4})/, '$1.')}</a>`).join('')}</div>`;
  }
  app.innerHTML = shell(`
    <h1 style="margin-bottom:4px">Direktori HS Code</h1>
    <p class="muted" style="margin-bottom:20px">Telusuri buyer per kategori produk — klik untuk drill-down, atau langsung lihat buyer di level manapun.</p>
    ${crumb}
    <div class="hs-grid">${nodes.map((n) => `
      <div class="hs-card" data-code="${n.code}" data-level="${n.level}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <span class="hs-code-chip">${n.code.replace(/^(\d{4})/, '$1.')}</span>
          <span class="caption muted-3">Level ${n.level === 2 ? 'Bab' : n.level === 4 ? 'Heading' : 'Sub'}</span></div>
        <h3 style="margin-bottom:2px">${esc(n.description_id)}</h3>
        <p class="caption muted" style="margin-bottom:12px">${esc(n.description_en)}</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div><div class="caption muted-3">Buyer</div><b class="num">${fmtN(n.buyer_count)}</b></div>
          <div><div class="caption muted-3">Volume total</div><b class="num">${fmtKg(n.volume_kg)}</b></div>
          <div><div class="caption muted-3">Top negara</div><b>${n.top_countries.map((t) => flag(t.country)).join(' ') || '—'}</b></div></div>
        <div style="display:flex;gap:8px;margin-top:14px">
          ${n.level < 6 ? `<button class="btn btn-sm btn-neutral drill">Drill-down →</button>` : ''}
          <button class="btn btn-sm btn-primary see">Lihat buyer (${n.buyer_count})</button></div>
      </div>`).join('')}</div>`);
  bindShell();
  $$('.hs-card').forEach((el) => {
    el.querySelector('.drill')?.addEventListener('click', (e) => { e.stopPropagation(); location.hash = `#/direktori?parent=${el.dataset.code}`; });
    el.querySelector('.see')?.addEventListener('click', (e) => { e.stopPropagation(); location.hash = `#/cari?hs=${el.dataset.code}`; });
    el.addEventListener('click', () => { location.hash = el.dataset.level < 6 ? `#/direktori?parent=${el.dataset.code}` : `#/cari?hs=${el.dataset.code}`; });
  });
});

// ================= search (F1) =================
route(/^\/cari$/, async (app, m, params) => {
  await requireMe();
  const state = {
    hs: params.get('hs') || '', q: params.get('q') || '', countries: (params.get('countries') || '').split(',').filter(Boolean),
    sizes: [], activity: '', has: [], min_score: 0, sort: 'score', page: 1,
  };
  const doSearch = async () => {
    const qs = new URLSearchParams();
    if (state.hs) qs.set('hs', state.hs);
    if (state.q) qs.set('q', state.q);
    if (state.countries.length) qs.set('countries', state.countries.join(','));
    if (state.sizes.length) qs.set('sizes', state.sizes.join(','));
    if (state.activity) qs.set('activity', state.activity);
    if (state.has.length) qs.set('has', state.has.join(','));
    if (state.min_score) qs.set('min_score', state.min_score);
    qs.set('sort', state.sort); qs.set('page', state.page);
    return api('/api/search/buyers?' + qs);
  };
  const draw = async () => {
    let d;
    try { d = await doSearch(); } catch (e) { if (e.status === 402) { app.innerHTML = shell(`<div class="empty"><div class="ic">🔒</div><h3>Kuota pencarian habis</h3><p class="muted">Upgrade paket untuk melanjutkan pencarian bulan ini.</p><button class="btn btn-upgrade" onclick="location.hash='#/billing'">Lihat paket</button></div>`); bindShell(); return; } throw e; }
    const totalPages = Math.max(1, Math.ceil(d.total / d.per));
    const chkGroup = (title, key, opts) => `<div class="filter-group"><h5>${title}</h5>${opts.map(([v, lbl]) => `
      <label class="chk"><input type="checkbox" data-k="${key}" value="${v}" ${state[key].includes(v) ? 'checked' : ''}> ${lbl}</label>`).join('')}</div>`;
    app.innerHTML = shell(`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div><h1 style="margin-bottom:2px">Cari Buyer</h1>
        <p class="muted body-sm">${d.total} buyer ditemukan${state.hs ? ` · HS ${esc(state.hs)}` : ''} · Kuota pencarian: <b class="num">${d.quota.used}${d.quota.limit ? '/' + d.quota.limit : ''}</b></p></div>
        <button class="btn btn-neutral btn-sm" id="btn-export">⬇ Ekspor CSV</button></div>
      <div class="search-layout"><div>
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <input class="input" id="f-hs" placeholder="Kode HS (mis. 0901)" value="${esc(state.hs)}" style="max-width:170px">
          <input class="input" id="f-q" placeholder="Nama buyer…" value="${esc(state.q)}">
          <select class="input" id="f-sort" style="max-width:190px">
            ${[['score', 'Urut: Skor tertinggi'], ['volume', 'Urut: Volume 12 bln'], ['shipments', 'Urut: Frekuensi'], ['recent', 'Urut: Shipment terbaru'], ['name', 'Urut: Nama A-Z']].map(([v, l]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        ${ME.plan === 'free' && d.total > 20 ? '<div class="banner banner-warning">🔒 Paket Free menampilkan detail 20 buyer teratas — baris selanjutnya diblur. <a href="#/billing">Upgrade</a></div>' : ''}
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>#</th><th>Buyer</th><th>Negara</th><th class="r">Volume 12 bln</th><th class="r">Frek/thn</th><th>Shipment terakhir</th><th>Skor</th><th></th></tr></thead><tbody>
          ${d.results.length ? d.results.map((b) => `<tr class="clickable ${b.blurred ? 'row-blurred' : ''}" ${b.blurred ? '' : `onclick="location.hash='#/buyer/${b.id}'"`}>
            <td class="muted num">${b.rank}</td>
            <td><b>${esc(b.name)}</b><div class="caption muted-3">${esc(b.city || '')} · ${esc(b.industry || '')} · ${b.size_bucket}</div></td>
            <td>${flag(b.country)} ${esc(b.country_name)}</td>
            <td class="r num">${fmtKg(b.volume_12mo_kg)}<div class="caption muted-3">${fmtUSD(b.value_12mo_usd)}</div></td>
            <td class="r num">${b.shipments_12mo}</td>
            <td class="num body-sm">${fmtDate(b.last_shipment_date)} ${b.yoy_percent != null ? `<div class="caption ${b.yoy_percent >= 0 ? 'delta-up' : 'delta-down'}" style="color:${b.yoy_percent >= 0 ? 'var(--secondary-600)' : 'var(--danger-text)'}">${b.yoy_percent >= 0 ? '↑' : '↓'} ${Math.abs(b.yoy_percent)}% YoY</div>` : ''}</td>
            <td>${scorePill(b.score, b.score_label)}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();saveToList(${b.id})">+ Simpan</button></td></tr>`).join('')
          : '<tr><td colspan="8"><div class="empty"><div class="ic">🕵️</div><h3>Tidak ada hasil</h3><p class="muted">Coba perluas filter atau gunakan kode HS level lebih tinggi (mis. 09 alih-alih 090111).</p></div></td></tr>'}
        </tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <span class="caption muted">Halaman ${d.page} dari ${totalPages}</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-neutral" id="pg-prev" ${d.page <= 1 ? 'disabled' : ''}>← Sebelumnya</button>
            <button class="btn btn-sm btn-neutral" id="pg-next" ${d.page >= totalPages ? 'disabled' : ''}>Berikutnya →</button></div></div>
      </div>
      <aside class="filter-panel card card-compact">
        <h4 style="margin-bottom:14px">Filter</h4>
        ${chkGroup('Negara', 'countries', d.facets.country.map((f) => [f.value, `${flag(f.value)} ${CNAME[f.value] || f.value} <span class="muted-3">(${f.count})</span>`]))}
        ${chkGroup('Ukuran buyer', 'sizes', [['S', 'Small'], ['M', 'Medium'], ['L', 'Large'], ['XL', 'Extra Large']])}
        <div class="filter-group"><h5>Aktivitas impor</h5><select class="input" id="f-activity">
          ${[['', 'Semua'], ['very_active', 'Sangat aktif (>12/thn)'], ['active', 'Aktif (4–12/thn)'], ['occasional', 'Sesekali (1–3/thn)'], ['inactive', 'Tidak aktif 12 bln']].map(([v, l]) => `<option value="${v}" ${state.activity === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${chkGroup('Punya kontak', 'has', [['email', '✉️ Email'], ['phone', '📞 Telepon'], ['linkedin', '💼 LinkedIn'], ['website', '🌐 Website']])}
        <div class="filter-group"><h5>Skor minimum: <span id="ms-val">${state.min_score}</span></h5>
          <input type="range" id="f-score" min="0" max="100" step="5" value="${state.min_score}" style="width:100%"></div>
        <button class="btn btn-sm btn-ghost" id="f-reset" style="width:100%">Reset filter</button>
      </aside></div>`);
    bindShell();
    // bindings
    const requery = () => { state.page = 1; draw(); };
    $$('input[type=checkbox][data-k]').forEach((el) => el.onchange = () => {
      const k = el.dataset.k;
      state[k] = el.checked ? [...state[k], el.value] : state[k].filter((x) => x !== el.value);
      requery();
    });
    $('#f-hs').onchange = (e) => { state.hs = e.target.value.trim(); requery(); };
    $('#f-q').onchange = (e) => { state.q = e.target.value.trim(); requery(); };
    $('#f-sort').onchange = (e) => { state.sort = e.target.value; requery(); };
    $('#f-activity').onchange = (e) => { state.activity = e.target.value; requery(); };
    $('#f-score').onchange = (e) => { state.min_score = +e.target.value; requery(); };
    $('#f-score').oninput = (e) => { $('#ms-val').textContent = e.target.value; };
    $('#f-reset').onclick = () => { Object.assign(state, { countries: [], sizes: [], activity: '', has: [], min_score: 0, q: '', page: 1 }); draw(); };
    $('#pg-prev').onclick = () => { state.page--; draw(); };
    $('#pg-next').onclick = () => { state.page++; draw(); };
    $('#btn-export').onclick = async () => {
      if (!ME.quotas.export.limit && ME.plan === 'free') return upgradeModal('Ekspor CSV tersedia mulai paket Starter.');
      window.open('/api/export/shipments' + (state.hs ? '' : ''), '_blank');
    };
  };
  await draw();
});

// ================= save to list =================
window.saveToList = async (buyerId) => {
  const lists = await api('/api/lists');
  modal(`<h2 style="margin-bottom:16px">Simpan buyer ke daftar</h2>
    ${lists.length ? `<div class="field"><label>Pilih daftar</label><select class="input" id="sl-list">
      ${lists.map((l) => `<option value="${l.id}">${esc(l.name)} (${l.buyer_count})</option>`).join('')}</select></div>` : '<p class="muted body-sm" style="margin-bottom:12px">Anda belum punya daftar — buat dulu di bawah.</p>'}
    <div class="field"><label>Atau buat daftar baru</label><input class="input" id="sl-new" placeholder="mis. Prospek Furnitur Jepang"></div>
    <button class="btn btn-primary" id="sl-save" style="width:100%">Simpan</button>`);
  $('#sl-save').onclick = async () => {
    try {
      let listId = $('#sl-list')?.value;
      const newName = $('#sl-new').value.trim();
      if (newName) { const nl = await api('/api/lists', { method: 'POST', body: { name: newName } }); listId = nl.id; }
      if (!listId) return toast('Pilih atau buat daftar dulu', true);
      await api(`/api/lists/${listId}/buyers`, { method: 'POST', body: { buyer_id: buyerId } });
      closeModal(); toast('Buyer disimpan ✓');
    } catch (e) { if (!e.handled) toast(e.data?.error || 'Gagal menyimpan', true); }
  };
};

// ================= buyer profile (F2) =================
route(/^\/buyer\/(\d+)$/, async (app, m, params) => {
  await requireMe();
  const id = m[1];
  let b;
  try { b = await api('/api/buyers/' + id); }
  catch (e) {
    if (e.status === 402) { app.innerHTML = shell(`<div class="empty"><div class="ic">🔒</div><h3>Kuota profil lengkap habis</h3><p class="muted">${esc(e.data.error)}</p><button class="btn btn-upgrade" onclick="location.hash='#/billing'">Upgrade paket</button></div>`); bindShell(); e.handled = true; closeModal(); return; }
    throw e;
  }
  const tab = params.get('tab') || 'overview';
  const tabs = [['overview', 'Ringkasan'], ['shipments', 'Riwayat Shipment'], ['suppliers', 'Pemasok'], ['products', 'Produk (HS)'], ['insights', 'Insight'], ['notes', 'Catatan & Aktivitas']];
  const header = `
    <div class="breadcrumb"><a href="#/cari">Cari Buyer</a><span class="sep">/</span><span>${esc(b.name)}</span></div>
    <div class="card" style="margin-bottom:24px"><div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <span class="avatar avatar-lg">${esc(b.name.slice(0, 2).toUpperCase())}</span>
      <div style="flex:1;min-width:240px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h1>${esc(b.name)}</h1>
          ${b.has_indonesian_supplier ? '<span class="pill pill-info">Pernah impor dari 🇮🇩</span>' : '<span class="pill pill-success">Untapped — belum dari 🇮🇩</span>'}</div>
        <p class="muted" style="margin:4px 0 10px">${flag(b.country)} ${esc(b.address || b.city || '')} · ${esc(b.country_name)} · ${esc(b.industry || '')} · Ukuran ${b.size_bucket}</p>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div><div class="caption muted-3">Total shipment</div><b class="num">${fmtN(b.total_shipments)}</b></div>
          <div><div class="caption muted-3">Volume 12 bln</div><b class="num">${fmtKg(b.volume_12mo_kg)}</b></div>
          <div><div class="caption muted-3">Nilai 12 bln</div><b class="num">${fmtUSD(b.value_12mo_usd)}</b></div>
          <div><div class="caption muted-3">Shipment pertama</div><b class="num">${fmtDate(b.first_shipment_date)}</b></div>
          <div><div class="caption muted-3">Terakhir</div><b class="num">${fmtDate(b.last_shipment_date)}</b></div></div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="composeTo(${b.id})">${I.send} Kirim outreach</button>
          <button class="btn btn-secondary btn-sm" onclick="saveToList(${b.id})">+ Simpan ke daftar</button>
          ${b.website ? `<a class="btn btn-neutral btn-sm" href="${esc(b.website)}" target="_blank" rel="noopener">🌐 Website</a>` : ''}</div>
        ${b.in_lists.length ? `<p class="caption muted" style="margin-top:10px">Tersimpan di: ${b.in_lists.map((l) => `<a href="#/list/${l.id}">${esc(l.name)}</a> ${statusPill(l.status)}`).join(' · ')}</p>` : ''}
      </div>
      <div class="gauge-wrap" style="flex-direction:column;align-items:center">${gauge(b.score)}
        <span class="caption muted-3">Data confidence: ${b.data_confidence}%</span></div>
    </div></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="tab-body"><div class="skeleton" style="height:220px"></div></div>`;
  app.innerHTML = shell(header);
  bindShell();
  $$('.tab').forEach((el) => el.onclick = () => { location.hash = `#/buyer/${id}?tab=${el.dataset.tab}`; });
  const body = $('#tab-body');

  if (tab === 'overview') {
    body.innerHTML = `<div class="grid grid-2">
      <div class="card"><h3 style="margin-bottom:14px">Skor EksporIn — komponen</h3>${scoreBars(b.score_components)}
        <p class="caption muted-3" style="margin-top:10px">Kecocokan produk dihitung dari HS fokus Anda vs produk yang diimpor buyer ini. Bobot per Buyer Scoring Engine (F4).</p></div>
      <div class="card"><h3 style="margin-bottom:14px">Kontak</h3>
        ${!b.contacts.length ? '<p class="muted">Belum ada kontak ter-enrich untuk buyer ini.</p>' : b.contacts.map((c) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px dotted var(--border-subtle)">
            <div><span class="caption muted-3" style="text-transform:capitalize">${c.contact_type}${c.person_name ? ` · ${esc(c.person_name)} (${esc(c.person_title || '')})` : ''}</span><br>
            ${c.masked ? `<span class="masked-chip">${esc(c.value)} 🔒</span>` : c.contact_type === 'website' || c.contact_type === 'linkedin' ? `<a href="${esc(c.value)}" target="_blank" rel="noopener">${esc(c.value)}</a>` : `<b>${esc(c.value)}</b>`}</div>
            <span class="caption muted-3">conf. ${c.confidence}%</span></div>`).join('')}
        ${!b.contacts_visible && b.contacts.length ? `<div class="banner banner-info" style="margin-top:12px">🔒 Kontak lengkap tersedia mulai paket <b>Growth</b>. <a href="#/billing">Upgrade</a></div>` : ''}</div>
      <div class="card" style="grid-column:1/-1"><h3 style="margin-bottom:14px">Produk yang diimpor</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${b.hs_codes.map((h) => `<span class="tag"><b>${h.hs_code.replace(/^(\d{4})/, '$1.')}</b> ${esc(h.description_id)} · ${h.shipment_count}×</span>`).join('')}</div>
        <p class="caption muted-3" style="margin-top:12px">Sumber data: catatan customs publik. Terakhir diperbarui: ${fmtDate(b.last_shipment_date)}.</p></div></div>`;
  } else if (tab === 'shipments') {
    const d = await api(`/api/buyers/${id}/shipments?page=${params.get('p') || 1}`);
    const totalPages = Math.max(1, Math.ceil(d.total / d.per));
    const pageN = +(params.get('p') || 1);
    body.innerHTML = `
      <div class="card" style="margin-bottom:24px"><div class="card-header"><h3>Volume bulanan (24 bulan)</h3>
        <button class="btn btn-sm btn-neutral" onclick="window.open('/api/export/shipments?buyer_id=${id}','_blank')">⬇ CSV</button></div>
        ${barChart(d.monthly, { valKey: 'w', fmtY: fmtKg })}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>HS</th><th>Deskripsi barang</th><th>Eksportir</th><th>Rute</th><th class="r">Berat</th><th class="r">Nilai est.</th></tr></thead><tbody>
        ${d.rows.map((s) => `<tr><td class="num body-sm">${fmtDate(s.shipment_date)}</td>
          <td><span class="hs-code-chip">${s.hs_code.replace(/^(\d{4})/, '$1.')}</span></td>
          <td class="body-sm">${esc(s.goods_description)}<div class="caption muted-3">${s.container_count} kontainer · ${fmtN(s.quantity)} ${s.quantity_unit} · sumber: ${esc(s.source)}</div></td>
          <td class="body-sm">${flag(s.exporter_country)} ${esc(s.exporter_name)} ${s.is_indonesian ? '<span class="pill pill-info">🇮🇩</span>' : ''}</td>
          <td class="caption muted">${esc(s.origin_port)} → ${esc(s.dest_port)}</td>
          <td class="r num">${fmtKg(s.weight_kg)}</td><td class="r num">${fmtUSD(s.value_usd)}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="display:flex;justify-content:space-between;margin-top:14px"><span class="caption muted">${d.total} shipment · halaman ${pageN}/${totalPages}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-neutral" ${pageN <= 1 ? 'disabled' : ''} onclick="location.hash='#/buyer/${id}?tab=shipments&p=${pageN - 1}'">←</button>
          <button class="btn btn-sm btn-neutral" ${pageN >= totalPages ? 'disabled' : ''} onclick="location.hash='#/buyer/${id}?tab=shipments&p=${pageN + 1}'">→</button></div></div>`;
  } else if (tab === 'suppliers') {
    const rows = await api(`/api/buyers/${id}/suppliers`);
    body.innerHTML = `<div class="banner banner-info">💡 Pemasok 🇮🇩 Indonesia adalah <b>kompetitor langsung Anda</b> — pelajari volume & HS code mereka.</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Pemasok</th><th>Negara</th><th class="r">Shipment</th><th class="r">Volume</th><th class="r">Nilai</th><th>Periode</th><th>HS</th></tr></thead><tbody>
      ${rows.map((s, i) => `<tr style="${s.is_indonesian ? 'background:var(--primary-50)' : ''}"><td class="muted num">${i + 1}</td>
        <td><b>${esc(s.name)}</b> ${s.is_indonesian ? '<span class="pill pill-info">Kompetitor 🇮🇩</span>' : ''}</td>
        <td>${flag(s.country)} ${esc(s.country_name)}</td>
        <td class="r num">${s.shipments}</td><td class="r num">${fmtKg(s.volume_kg)}</td><td class="r num">${fmtUSD(s.value_usd)}</td>
        <td class="caption num">${fmtDate(s.first_date)} – ${fmtDate(s.last_date)}</td>
        <td class="caption">${(s.hs_codes || '').split(',').slice(0, 3).map((h) => `<span class="tag">${h}</span>`).join(' ')}</td></tr>`).join('')}
      </tbody></table></div>`;
  } else if (tab === 'products') {
    body.innerHTML = `<div class="grid grid-2">${b.hs_codes.filter((h) => h.shipment_count > 0).map((h) => `
      <div class="card"><div class="card-header"><div><span class="hs-code-chip">${h.hs_code.replace(/^(\d{4})/, '$1.')}</span>
        <h3 style="display:inline;margin-left:8px">${esc(h.description_id)}</h3></div></div>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div><div class="caption muted-3">Shipment</div><b class="num">${h.shipment_count}</b></div>
          <div><div class="caption muted-3">Volume</div><b class="num">${fmtKg(h.total_volume_kg)}</b></div>
          <div><div class="caption muted-3">Nilai</div><b class="num">${fmtUSD(h.total_value_usd)}</b></div>
          <div><div class="caption muted-3">Periode</div><b class="num body-sm">${fmtDate(h.first_seen)} – ${fmtDate(h.last_seen)}</b></div></div></div>`).join('')}</div>`;
  } else if (tab === 'insights') {
    const d = await api(`/api/buyers/${id}/insights`);
    body.innerHTML = `<div class="grid grid-2">
      <div class="card"><h3 style="margin-bottom:14px">💡 Insight otomatis</h3>
        ${d.insights.map((t) => `<p style="padding:10px 0;border-bottom:1px dotted var(--border-subtle);line-height:22px">${esc(t)}</p>`).join('')}</div>
      <div>
        <div class="card" style="margin-bottom:24px;border-left:3px solid var(--primary-600)"><h3 style="margin-bottom:8px">🎯 Angle outreach yang disarankan</h3>
          <p style="line-height:22px">${esc(d.recommended_angle)}</p>
          <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="composeTo(${id})">Tulis pesan sekarang →</button></div>
        <div class="card"><h3 style="margin-bottom:12px">Buyer serupa</h3>
          ${d.similar.map((s) => `<div class="clickable" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dotted var(--border-subtle);cursor:pointer" onclick="location.hash='#/buyer/${s.id}'">
            <span>${flag(s.country)} <b>${esc(s.name)}</b></span><span class="pill pill-neutral num">${s.base_score}</span></div>`).join('')}</div></div></div>`;
  } else if (tab === 'notes') {
    const [notes, msgs] = await Promise.all([api('/api/notes?buyer_id=' + id), api('/api/outreach/messages?buyer_id=' + id)]);
    body.innerHTML = `<div class="grid grid-2">
      <div class="card"><h3 style="margin-bottom:12px">Catatan internal</h3>
        <textarea class="input" id="note-body" placeholder="Tulis catatan… (hanya terlihat oleh Anda)"></textarea>
        <button class="btn btn-primary btn-sm" id="note-add" style="margin-top:10px">Simpan catatan</button>
        <div style="margin-top:16px">${notes.map((n) => `<div style="padding:12px;border:1px solid var(--border-subtle);border-radius:10px;margin-bottom:8px;background:var(--bg-surface-alt)">
          <p style="line-height:20px">${esc(n.body)}</p><div class="caption muted-3" style="margin-top:6px;display:flex;justify-content:space-between"><span>${fmtDate(n.created_at)}</span>
          <a href="#" data-del-note="${n.id}" style="color:var(--danger-text)">Hapus</a></div></div>`).join('') || '<p class="muted body-sm">Belum ada catatan.</p>'}</div></div>
      <div class="card"><h3 style="margin-bottom:12px">Riwayat outreach</h3>
        ${msgs.length ? msgs.map((mg) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dotted var(--border-subtle)">
          <div><b class="body-sm">${esc(mg.subject || '(WhatsApp)')}</b><div class="caption muted-3">${fmtDate(mg.sent_at)} · via ${mg.channel}</div></div>
          ${msgStatusPill(mg.status)}</div>`).join('') : '<p class="muted body-sm">Belum ada pesan terkirim ke buyer ini.</p>'}</div></div>`;
    $('#note-add').onclick = async () => {
      const v = $('#note-body').value.trim();
      if (!v) return;
      await api('/api/notes', { method: 'POST', body: { buyer_id: +id, body: v } });
      toast('Catatan disimpan ✓'); render();
    };
    $$('[data-del-note]').forEach((el) => el.onclick = async (e) => {
      e.preventDefault(); await api('/api/notes/' + el.dataset.delNote, { method: 'DELETE' }); render();
    });
  }
});
const msgStatusPill = (st) => ({
  sent: '<span class="pill pill-neutral">Terkirim</span>', delivered: '<span class="pill pill-info">Sampai</span>',
  opened: '<span class="pill pill-warning">Dibuka 👀</span>', replied: '<span class="pill pill-success">Dibalas ✓</span>',
  bounced: '<span class="pill pill-danger">Gagal</span>',
}[st] || st);

// ================= shipment explorer (F3) =================
route(/^\/shipments$/, async (app, m, params) => {
  await requireMe();
  const state = { hs: params.get('hs') || '', buyer_q: '', exporter_q: '', origin: '', dest: '', group_by: '', page: 1 };
  const draw = async () => {
    const qs = new URLSearchParams();
    for (const k of ['hs', 'buyer_q', 'exporter_q', 'origin', 'dest', 'group_by']) if (state[k]) qs.set(k, state[k]);
    qs.set('page', state.page);
    const d = await api('/api/shipments?' + qs);
    const selOpt = (opts, cur) => opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('');
    app.innerHTML = shell(`
      <h1 style="margin-bottom:4px">Shipment Explorer</h1>
      <p class="muted" style="margin-bottom:20px">Telusuri data bill of lading lintas buyer — untuk analisis mendalam & intel kompetitor.</p>
      <div class="card card-compact" style="margin-bottom:20px"><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">
        <input class="input" id="s-hs" placeholder="Kode HS" value="${esc(state.hs)}">
        <input class="input" id="s-buyer" placeholder="Nama buyer" value="${esc(state.buyer_q)}">
        <input class="input" id="s-exp" placeholder="Nama eksportir" value="${esc(state.exporter_q)}">
        <select class="input" id="s-origin"><option value="">Asal: semua</option>${selOpt(Object.entries(CNAME).map(([c, n]) => [c, flag(c) + ' ' + n]), state.origin)}</select>
        <select class="input" id="s-dest"><option value="">Tujuan: semua</option>${selOpt(['US', 'JP', 'NL', 'AE', 'AU'].map((c) => [c, flag(c) + ' ' + CNAME[c]]), state.dest)}</select>
        <select class="input" id="s-group"><option value="">Tampilan: baris detail</option>${selOpt([['buyer', 'Grup per buyer'], ['exporter', 'Grup per eksportir'], ['hs', 'Grup per HS'], ['month', 'Grup per bulan']], state.group_by)}</select>
      </div></div>
      ${d.grouped ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${{ buyer: 'Buyer', exporter: 'Eksportir', hs: 'HS Code', month: 'Bulan' }[state.group_by]}</th><th class="r">Shipment</th><th class="r">Volume</th><th class="r">Nilai est.</th></tr></thead><tbody>
        ${d.rows.map((r) => `<tr><td><b>${esc(r.grp)}</b></td><td class="r num">${fmtN(r.shipments)}</td><td class="r num">${fmtKg(r.volume_kg)}</td><td class="r num">${fmtUSD(r.value_usd)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>HS</th><th>Buyer</th><th>Eksportir</th><th>Rute</th><th class="r">Berat</th><th class="r">Nilai</th></tr></thead><tbody>
        ${d.rows.length ? d.rows.map((s) => `<tr class="clickable" onclick="location.hash='#/buyer/${s.buyer_id}'">
          <td class="num body-sm">${fmtDate(s.shipment_date)}</td>
          <td><span class="hs-code-chip">${s.hs_code.replace(/^(\d{4})/, '$1.')}</span></td>
          <td><b class="body-sm">${esc(s.buyer_name)}</b> <span class="caption">${flag(s.buyer_country)}</span></td>
          <td class="body-sm">${flag(s.exporter_country)} ${esc(s.exporter_name)} ${s.is_indonesian ? '<span class="pill pill-info">🇮🇩</span>' : ''}</td>
          <td class="caption muted">${esc(s.origin_port)} → ${esc(s.dest_port)}</td>
          <td class="r num">${fmtKg(s.weight_kg)}</td><td class="r num">${fmtUSD(s.value_usd)}</td></tr>`).join('')
        : '<tr><td colspan="7"><div class="empty"><div class="ic">🚢</div><h3>Tidak ada shipment</h3><p class="muted">Perluas filter untuk melihat data.</p></div></td></tr>'}
        </tbody></table></div>
        <div style="display:flex;justify-content:space-between;margin-top:14px"><span class="caption muted">${fmtN(d.total)} shipment</span>
        <div style="display:flex;gap:8px"><button class="btn btn-sm btn-neutral" id="sp-prev" ${d.page <= 1 ? 'disabled' : ''}>←</button>
        <button class="btn btn-sm btn-neutral" id="sp-next" ${d.page * d.per >= d.total ? 'disabled' : ''}>→</button></div></div>`}`);
    bindShell();
    const rq = () => { state.page = 1; draw(); };
    $('#s-hs').onchange = (e) => { state.hs = e.target.value.trim(); rq(); };
    $('#s-buyer').onchange = (e) => { state.buyer_q = e.target.value.trim(); rq(); };
    $('#s-exp').onchange = (e) => { state.exporter_q = e.target.value.trim(); rq(); };
    $('#s-origin').onchange = (e) => { state.origin = e.target.value; rq(); };
    $('#s-dest').onchange = (e) => { state.dest = e.target.value; rq(); };
    $('#s-group').onchange = (e) => { state.group_by = e.target.value; rq(); };
    $('#sp-prev') && ($('#sp-prev').onclick = () => { state.page--; draw(); });
    $('#sp-next') && ($('#sp-next').onclick = () => { state.page++; draw(); });
  };
  await draw();
});

// ================= lists (F5) =================
route(/^\/lists$/, async (app) => {
  await requireMe();
  const lists = await api('/api/lists');
  app.innerHTML = shell(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div><h1>Daftar Tersimpan</h1><p class="muted body-sm">CRM-lite untuk pipeline buyer Anda${ME.saved.limit ? ` · ${ME.saved.used}/${ME.saved.limit} buyer tersimpan (paket ${ME.plan_name})` : ''}</p></div>
      <button class="btn btn-primary" id="new-list">+ Daftar baru</button></div>
    ${lists.length ? `<div class="grid grid-3">${lists.map((l) => `
      <div class="card clickable" style="cursor:pointer;border-top:3px solid ${esc(l.color)}" onclick="location.hash='#/list/${l.id}'">
        <div class="card-header"><h3>${esc(l.name)}</h3><span class="pill pill-neutral num">${l.buyer_count} buyer</span></div>
        <p class="muted body-sm">${esc(l.description || 'Tanpa deskripsi')}</p>
        <p class="caption muted-3" style="margin-top:10px">Dibuat ${fmtDate(l.created_at)}</p></div>`).join('')}</div>`
    : `<div class="card empty"><div class="ic">📑</div><h3>Belum ada daftar</h3><p class="muted" style="margin-bottom:16px">Simpan buyer dari hasil pencarian untuk mulai membangun pipeline.</p><a class="btn btn-primary" href="#/cari">Cari buyer →</a></div>`}`);
  bindShell();
  $('#new-list').onclick = () => {
    modal(`<h2 style="margin-bottom:16px">Daftar baru</h2>
      <div class="field"><label>Nama</label><input class="input" id="nl-name" placeholder="mis. Prospek Kopi US Q3"></div>
      <div class="field"><label>Deskripsi</label><input class="input" id="nl-desc"></div>
      <div class="field"><label>Warna</label><select class="input" id="nl-color">
        <option value="#2563EB">Biru</option><option value="#10B981">Hijau</option><option value="#F59E0B">Amber</option><option value="#8B5CF6">Ungu</option><option value="#EC4899">Pink</option></select></div>
      <button class="btn btn-primary" id="nl-save" style="width:100%">Buat daftar</button>`);
    $('#nl-save').onclick = async () => {
      const name = $('#nl-name').value.trim();
      if (!name) return toast('Nama wajib diisi', true);
      await api('/api/lists', { method: 'POST', body: { name, description: $('#nl-desc').value, color: $('#nl-color').value } });
      closeModal(); render();
    };
  };
});

route(/^\/list\/(\d+)$/, async (app, m, params) => {
  await requireMe();
  const l = await api('/api/lists/' + m[1]);
  const view = params.get('view') || 'table';
  const editRow = (b) => {
    modal(`<h2 style="margin-bottom:4px">${esc(b.name)}</h2><p class="muted body-sm" style="margin-bottom:16px">${flag(b.country)} ${esc(b.country_name)} · ${esc(b.industry || '')}</p>
      <div class="field"><label>Status pipeline</label><select class="input" id="eb-status">
        ${STATUSES.map((s) => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${STATUS_LBL[s]}</option>`).join('')}</select></div>
      <div class="field"><label>Prioritas</label><select class="input" id="eb-pri">
        ${['low', 'medium', 'high', 'urgent'].map((p) => `<option value="${p}" ${b.priority === p ? 'selected' : ''}>${{ low: 'Rendah', medium: 'Sedang', high: 'Tinggi', urgent: 'Urgent' }[p]}</option>`).join('')}</select></div>
      <div class="field"><label>Tag (pisahkan dengan koma)</label><input class="input" id="eb-tags" value="${esc(b.tags.join(', '))}"></div>
      <div class="field"><label>Ingatkan saya pada</label><input class="input" id="eb-rem" type="date" value="${b.reminder_at ? b.reminder_at.slice(0, 10) : ''}"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="eb-save" style="flex:1">Simpan</button>
        <button class="btn btn-neutral" onclick="closeModal();location.hash='#/buyer/${b.buyer_id}'">Lihat profil</button>
        <button class="btn btn-danger" id="eb-del">Hapus</button></div>`);
    $('#eb-save').onclick = async () => {
      await api(`/api/lists/${l.id}/buyers/${b.buyer_id}`, { method: 'PATCH', body: {
        status: $('#eb-status').value, priority: $('#eb-pri').value,
        tags: $('#eb-tags').value.split(',').map((x) => x.trim()).filter(Boolean),
        reminder_at: $('#eb-rem').value ? $('#eb-rem').value + ' 09:00:00' : null,
      } });
      closeModal(); toast('Tersimpan ✓'); render();
    };
    $('#eb-del').onclick = async () => {
      await api(`/api/lists/${l.id}/buyers/${b.buyer_id}`, { method: 'DELETE' });
      closeModal(); render();
    };
  };
  app.innerHTML = shell(`
    <div class="breadcrumb"><a href="#/lists">Daftar</a><span class="sep">/</span><span>${esc(l.name)}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div><h1 style="border-left:4px solid ${esc(l.color)};padding-left:12px">${esc(l.name)}</h1>
        <p class="muted body-sm" style="margin-top:4px">${esc(l.description || '')} · ${l.buyers.length} buyer</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-neutral'}" onclick="location.hash='#/list/${l.id}?view=table'">☰ Tabel</button>
        <button class="btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-neutral'}" onclick="location.hash='#/list/${l.id}?view=kanban'">▦ Kanban</button>
        <button class="btn btn-sm btn-secondary" id="bulk-outreach">✉ Outreach massal</button>
        <button class="btn btn-sm btn-danger" id="del-list">Hapus daftar</button></div></div>
    ${!l.buyers.length ? `<div class="card empty"><div class="ic">📭</div><h3>Daftar kosong</h3><p class="muted" style="margin-bottom:14px">Tambahkan buyer dari pencarian.</p><a class="btn btn-primary" href="#/cari">Cari buyer →</a></div>`
    : view === 'kanban' ? `<div class="kanban">${STATUSES.map((st) => {
        const items = l.buyers.filter((b) => b.status === st);
        return `<div class="kanban-col"><h5>${STATUS_LBL[st]} <span>${items.length}</span></h5>
          ${items.map((b) => `<div class="kanban-card" data-bid="${b.buyer_id}">
            <div class="knm">${flag(b.country)} ${esc(b.name)}</div>
            <div class="caption muted-3">${esc(b.industry || '')}</div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;align-items:center">
              ${scorePill(b.score, b.score_label)}
              ${b.priority === 'high' || b.priority === 'urgent' ? '<span class="caption" style="color:var(--danger-text)">▲ ' + (b.priority === 'urgent' ? 'Urgent' : 'Tinggi') + '</span>' : ''}</div>
            ${b.tags.length ? `<div style="margin-top:6px">${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</div>` : ''}</div>`).join('')}</div>`;
      }).join('')}</div>`
    : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Buyer</th><th>Status</th><th>Prioritas</th><th>Tag</th><th class="r">Skor</th><th>Reminder</th><th>Shipment terakhir</th><th></th></tr></thead><tbody>
      ${l.buyers.map((b) => `<tr>
        <td><input type="checkbox" class="sel-buyer" value="${b.buyer_id}" style="width:16px;height:16px;accent-color:var(--primary-600)"></td>
        <td class="clickable" onclick="location.hash='#/buyer/${b.buyer_id}'"><b>${esc(b.name)}</b><div class="caption muted-3">${flag(b.country)} ${esc(b.country_name)} · ${esc(b.industry || '')}</div></td>
        <td>${statusPill(b.status)}</td>
        <td class="body-sm">${{ low: 'Rendah', medium: 'Sedang', high: '<b style="color:var(--warning-text)">Tinggi</b>', urgent: '<b style="color:var(--danger-text)">Urgent</b>' }[b.priority] || '—'}</td>
        <td>${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</td>
        <td class="r">${scorePill(b.score, b.score_label)}</td>
        <td class="caption num">${b.reminder_at ? '⏰ ' + fmtDate(b.reminder_at) : '—'}</td>
        <td class="caption num">${fmtDate(b.last_shipment_date)}</td>
        <td><button class="btn btn-sm btn-neutral edit-b" data-bid="${b.buyer_id}">Kelola</button></td></tr>`).join('')}
      </tbody></table></div>`}`);
  bindShell();
  $$('.edit-b').forEach((el) => el.onclick = () => editRow(l.buyers.find((b) => b.buyer_id == el.dataset.bid)));
  $$('.kanban-card').forEach((el) => el.onclick = () => editRow(l.buyers.find((b) => b.buyer_id == el.dataset.bid)));
  $('#del-list')?.addEventListener('click', () => {
    modal(`<h2 style="margin-bottom:10px">Hapus daftar?</h2><p class="muted" style="margin-bottom:20px">"${esc(l.name)}" dan ${l.buyers.length} buyer di dalamnya akan dihapus dari workspace (data buyer tetap ada di direktori).</p>
      <div style="display:flex;gap:8px"><button class="btn btn-danger" id="cd-yes">Ya, hapus</button><button class="btn btn-neutral" onclick="closeModal()">Batal</button></div>`);
    $('#cd-yes').onclick = async () => { await api('/api/lists/' + l.id, { method: 'DELETE' }); closeModal(); location.hash = '#/lists'; };
  });
  $('#bulk-outreach')?.addEventListener('click', () => {
    const sel = $$('.sel-buyer:checked').map((x) => +x.value);
    const ids = sel.length ? sel : l.buyers.map((b) => b.buyer_id);
    composeTo(ids);
  });
});

// ================= outreach (F6) =================
window.composeTo = async (buyerIds) => {
  const ids = Array.isArray(buyerIds) ? buyerIds : [buyerIds];
  const t = await api('/api/templates');
  const all = [...t.system.filter((x) => !x.locked), ...t.own];
  const locked = t.system.filter((x) => x.locked);
  let tplId = all[0]?.id;
  const drawPreview = async () => {
    const prev = await api('/api/outreach/preview', { method: 'POST', body: { template_id: tplId, buyer_id: ids[0] } });
    $('#cp-preview').innerHTML = `
      ${prev.subject ? `<div class="field"><label>Subjek</label><div class="input" style="height:auto;background:var(--bg-surface-alt)">${esc(prev.subject)}</div></div>` : ''}
      <div class="field"><label>Isi pesan — untuk ${esc(prev.buyer_name)}${ids.length > 1 ? ` (+${ids.length - 1} buyer lain, variabel otomatis per buyer)` : ''}</label>
      <div class="input" style="height:auto;white-space:pre-wrap;background:var(--bg-surface-alt);max-height:260px;overflow-y:auto">${esc(prev.body)}</div></div>
      <p class="caption ${prev.contacts_visible ? 'muted' : ''}" style="margin-bottom:12px">
        ${prev.to_email ? `📧 Tujuan: <b>${esc(prev.to_email)}</b>` : '📧 Email buyer belum tersedia — gunakan mode salin.'}
        ${!prev.contacts_visible && prev.to_email ? ' <span class="masked-chip">🔒 kontak penuh di paket Growth+</span>' : ''}</p>`;
  };
  modal(`<h2 style="margin-bottom:4px">Kirim outreach</h2>
    <p class="muted body-sm" style="margin-bottom:16px">${ids.length} buyer dipilih · Kuota kirim: <b class="num">${ME.quotas.send.used}${ME.quotas.send.limit ? '/' + ME.quotas.send.limit : ''}</b></p>
    <div class="field"><label>Template</label><select class="input" id="cp-tpl">
      ${all.map((x) => `<option value="${x.id}">${esc(x.name)} · ${x.channel === 'email' ? '✉️' : '💬'} ${x.language.toUpperCase()}</option>`).join('')}
      ${locked.length ? `<option disabled>―― 🔒 ${locked.length} template lain terkunci (upgrade) ――</option>` : ''}</select></div>
    <div id="cp-preview"><div class="skeleton" style="height:140px"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" id="cp-send" style="flex:1">🚀 Kirim (${ids.length})</button>
      <button class="btn btn-neutral" id="cp-copy">📋 Salin</button>
      <button class="btn btn-neutral" id="cp-mailto">✉️ Buka di email</button></div>
    <p class="caption muted-3" style="margin-top:10px">Mode terkirim = tercatat & terlacak di platform (simulasi pengiriman). Anti-spam: template sama tidak bisa dikirim ulang ke buyer sama dalam 14 hari.</p>`, { wide: true });
  $('#cp-tpl').onchange = (e) => { tplId = +e.target.value; drawPreview(); };
  await drawPreview();
  $('#cp-copy').onclick = () => {
    const txt = $('#cp-preview').innerText;
    navigator.clipboard?.writeText(txt).then(() => toast('Disalin ke clipboard ✓'));
  };
  $('#cp-mailto').onclick = async () => {
    const prev = await api('/api/outreach/preview', { method: 'POST', body: { template_id: tplId, buyer_id: ids[0] } });
    location.href = `mailto:?subject=${encodeURIComponent(prev.subject || '')}&body=${encodeURIComponent(prev.body)}`;
  };
  $('#cp-send').onclick = async () => {
    try {
      const r = await api('/api/outreach/send', { method: 'POST', body: { template_id: tplId, buyer_ids: ids, channel: 'email' } });
      const ok = r.sent.filter((x) => x.ok).length, skip = r.sent.filter((x) => x.skipped).length;
      closeModal();
      toast(`${ok} pesan terkirim ✓${skip ? ` · ${skip} dilewati (duplikat 14 hari)` : ''}`);
      await refreshMe(); render();
    } catch (e) { if (!e.handled) toast(e.data?.error || 'Gagal mengirim', true); }
  };
};

route(/^\/outreach$/, async (app, m, params) => {
  await requireMe();
  const tab = params.get('tab') || 'log';
  const [t, msgs] = await Promise.all([api('/api/templates'), api('/api/outreach/messages')]);
  const stats = { total: msgs.length, opened: msgs.filter((x) => ['opened', 'replied'].includes(x.status)).length, replied: msgs.filter((x) => x.status === 'replied').length };
  app.innerHTML = shell(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div><h1>Outreach</h1><p class="muted body-sm">Template multi-bahasa & pelacakan pesan</p></div>
      <button class="btn btn-primary" onclick="location.hash='#/lists'">Kirim dari daftar →</button></div>
    <div class="grid grid-3" style="margin-bottom:24px">
      <div class="card card-compact metric-card"><div class="lbl">Terkirim (semua waktu)</div><div class="numeric-lg">${stats.total}</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Open rate</div><div class="numeric-lg">${stats.total ? Math.round((stats.opened / stats.total) * 100) : 0}%</div><div class="caption muted-3">${stats.opened} dibuka</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Reply rate</div><div class="numeric-lg">${stats.total ? Math.round((stats.replied / stats.total) * 100) : 0}%</div><div class="caption muted-3">${stats.replied} dibalas</div></div></div>
    <div class="tabs">
      <button class="tab ${tab === 'log' ? 'active' : ''}" onclick="location.hash='#/outreach?tab=log'">Riwayat pesan</button>
      <button class="tab ${tab === 'templates' ? 'active' : ''}" onclick="location.hash='#/outreach?tab=templates'">Template (${t.system.length + t.own.length})</button></div>
    ${tab === 'templates' ? `
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px"><button class="btn btn-sm btn-secondary" id="new-tpl">+ Template sendiri</button></div>
      <div class="grid grid-2">
        ${[...t.system, ...t.own].map((x) => `<div class="card ${x.locked ? '' : 'clickable'}" style="${x.locked ? 'opacity:.55' : ''}">
          <div class="card-header"><h3>${x.locked ? '🔒 ' : ''}${esc(x.name)}</h3>
            <div style="display:flex;gap:6px"><span class="pill pill-neutral">${x.channel === 'email' ? '✉️ Email' : '💬 WhatsApp'}</span><span class="pill pill-info">${x.language.toUpperCase()}</span>${x.user_id ? '<span class="pill pill-success">Milik Anda</span>' : ''}</div></div>
          ${x.subject ? `<p class="body-sm" style="margin-bottom:6px"><b>Subjek:</b> ${esc(x.subject)}</p>` : ''}
          <p class="body-sm muted" style="white-space:pre-wrap;max-height:120px;overflow:hidden">${esc(x.body.slice(0, 260))}${x.body.length > 260 ? '…' : ''}</p>
          ${x.locked ? `<button class="btn btn-sm btn-upgrade" style="margin-top:12px" onclick="location.hash='#/billing'">Buka dengan upgrade</button>` : ''}</div>`).join('')}</div>`
    : `${msgs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Buyer</th><th>Subjek</th><th>Channel</th><th>Dikirim</th><th>Status</th></tr></thead><tbody>
        ${msgs.map((mg) => `<tr class="clickable" onclick="location.hash='#/buyer/${mg.buyer_id}'">
          <td><b>${esc(mg.buyer_name)}</b> ${flag(mg.buyer_country)}</td>
          <td class="body-sm muted">${esc(mg.subject || '(WhatsApp)')}</td>
          <td>${mg.channel === 'email' ? '✉️' : '💬'} ${mg.channel}</td>
          <td class="num body-sm">${fmtDate(mg.sent_at)}</td><td>${msgStatusPill(mg.status)}</td></tr>`).join('')}
        </tbody></table></div>`
      : `<div class="card empty"><div class="ic">📮</div><h3>Belum ada pesan terkirim</h3><p class="muted" style="margin-bottom:14px">Pilih buyer dari daftar tersimpan lalu kirim template pertama Anda.</p><a class="btn btn-primary" href="#/lists">Buka daftar →</a></div>`}`}`);
  bindShell();
  $('#new-tpl')?.addEventListener('click', () => {
    modal(`<h2 style="margin-bottom:16px">Template baru</h2>
      <div class="field"><label>Nama template</label><input class="input" id="nt-name" placeholder="mis. Intro kopi specialty (EN)"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>Channel</label><select class="input" id="nt-ch"><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></div>
        <div class="field"><label>Bahasa</label><select class="input" id="nt-lang">${['en', 'es', 'ar', 'zh', 'ja'].map((x) => `<option>${x}</option>`).join('')}</select></div></div>
      <div class="field"><label>Subjek (untuk email)</label><input class="input" id="nt-subj" placeholder="Boleh pakai {{hs_description}}, {{buyer_name}}…"></div>
      <div class="field"><label>Isi pesan</label><textarea class="input" id="nt-body" style="min-height:160px" placeholder="Variabel tersedia: {{buyer_name}} {{buyer_country}} {{hs_code}} {{hs_description}} {{user_name}} {{org_name}}"></textarea></div>
      <button class="btn btn-primary" id="nt-save" style="width:100%">Simpan template</button>`, { wide: true });
    $('#nt-save').onclick = async () => {
      const name = $('#nt-name').value.trim(), bodyv = $('#nt-body').value.trim();
      if (!name || !bodyv) return toast('Nama dan isi wajib diisi', true);
      await api('/api/templates', { method: 'POST', body: { name, channel: $('#nt-ch').value, language: $('#nt-lang').value, subject: $('#nt-subj').value || null, body: bodyv } });
      closeModal(); toast('Template tersimpan ✓'); render();
    };
  });
});

// ================= alerts (F7) =================
route(/^\/alerts$/, async (app) => {
  await requireMe();
  const d = await api('/api/alerts');
  const IC = { new_buyer: ['🆕', 'var(--info-bg)'], buyer_activity: ['📦', 'var(--success-bg)'], competitor: ['⚔️', 'var(--warning-bg)'], reminder: ['⏰', 'var(--danger-bg)'] };
  app.innerHTML = shell(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div><h1>Notifikasi</h1><p class="muted body-sm">Intel proaktif: buyer baru, aktivitas shipment, gerakan kompetitor, dan pengingat follow-up.</p></div>
      ${!d.locked && d.alerts.length ? '<button class="btn btn-sm btn-neutral" id="mark-all">Tandai semua dibaca</button>' : ''}</div>
    ${d.locked ? `<div class="card empty"><div class="ic">🔔</div><h3>Alert tersedia mulai paket Starter</h3>
      <p class="muted" style="margin-bottom:16px">Dapatkan notifikasi saat buyer baru muncul di HS code Anda, buyer tersimpan punya shipment baru, atau kompetitor Indonesia bergerak.</p>
      <button class="btn btn-upgrade" onclick="location.hash='#/billing'">Upgrade sekarang</button></div>`
    : d.alerts.length ? `<div class="tbl-wrap" style="background:#fff">${d.alerts.map((a) => `
      <div class="alert-row ${a.read ? '' : 'unread'} ${a.buyer_id ? 'clickable' : ''}" style="cursor:${a.buyer_id ? 'pointer' : 'default'}" data-id="${a.id}" data-buyer="${a.buyer_id || ''}">
        <div class="alert-ic" style="background:${IC[a.type]?.[1] || 'var(--bg-surface-alt)'}">${IC[a.type]?.[0] || '🔔'}</div>
        <div style="flex:1"><b>${esc(a.title)}</b><p class="body-sm muted" style="margin-top:2px">${esc(a.body || '')}</p>
          <span class="caption muted-3">${fmtDate(a.created_at)}${a.hs_code ? ` · HS ${a.hs_code}` : ''}</span></div>
        ${a.read ? '' : '<span class="pill pill-info">Baru</span>'}</div>`).join('')}</div>
      ${d.capped ? `<div class="banner banner-warning" style="margin-top:16px">Paket ${esc(ME.plan_name)} menampilkan maksimal ${d.capped} alert. <a href="#/billing">Upgrade</a> untuk alert tanpa batas.</div>` : ''}`
    : `<div class="card empty"><div class="ic">📭</div><h3>Belum ada notifikasi</h3><p class="muted">Simpan buyer dan ikuti HS code untuk mulai menerima intel.</p></div>`}`);
  bindShell();
  $('#mark-all')?.addEventListener('click', async () => { await api('/api/alerts/read', { method: 'POST', body: {} }); await refreshMe(); render(); });
  $$('.alert-row').forEach((el) => el.onclick = async () => {
    await api('/api/alerts/read', { method: 'POST', body: { id: +el.dataset.id } });
    if (el.dataset.buyer) location.hash = '#/buyer/' + el.dataset.buyer; else { await refreshMe(); render(); }
  });
});

// ================= billing =================
route(/^\/billing$/, async (app) => {
  await requireMe();
  const plans = await api('/api/plans');
  const feats = {
    free: ['20 pencarian/bulan', '3 profil lengkap/bulan', 'Simpan 10 buyer', '5 kirim outreach', '3 template sistem'],
    starter: ['100 pencarian/bulan', '50 profil lengkap/bulan', 'Simpan tanpa batas', '50 kirim/bulan', '5 alert aktif', 'Ekspor 100 baris CSV'],
    growth: ['500 pencarian/bulan', '300 profil lengkap/bulan', '✨ Kontak buyer terbuka penuh', '300 kirim/bulan', 'Alert tanpa batas', 'Semua template', 'Ekspor 500 baris'],
    business: ['Pencarian & profil tanpa batas', 'Kontak terbuka penuh', '2.000 kirim/bulan', 'Intel kompetitor', 'Ekspor 10.000 baris', '3 kursi tim', 'Success manager'],
  };
  app.innerHTML = shell(`
    <h1 style="margin-bottom:4px">Paket & Tagihan</h1>
    <p class="muted" style="margin-bottom:24px">Paket Anda saat ini: <b>${esc(ME.plan_name)}</b>. Pembayaran via Midtrans/Xendit (disimulasikan di demo ini). Garansi 7 hari uang kembali.</p>
    <div class="plan-grid">${plans.map((p) => `
      <div class="plan-card ${p.code === ME.plan ? 'current' : ''}">
        <div class="overline">${esc(p.name)}</div>
        <div class="pr num">${p.price ? fmtIDR(p.price) : 'Gratis'}</div>
        <div class="caption muted-3">${p.price ? 'per bulan · hemat 17% tahunan' : 'selamanya'}</div>
        <ul>${feats[p.code].map((f) => `<li>${f}</li>`).join('')}</ul>
        ${p.code === ME.plan ? '<button class="btn btn-neutral" disabled>Paket aktif ✓</button>'
        : `<button class="btn ${p.price > (plans.find((x) => x.code === ME.plan)?.price || 0) ? 'btn-upgrade' : 'btn-neutral'}" data-plan="${p.code}">${p.price > (plans.find((x) => x.code === ME.plan)?.price || 0) ? 'Upgrade' : 'Pilih'}</button>`}</div>`).join('')}</div>
    <div class="card" style="margin-top:24px"><h3 style="margin-bottom:12px">Pemakaian bulan ini</h3>
      <div class="grid grid-4">${Object.entries({ search: 'Pencarian', profile: 'Profil lengkap', send: 'Kirim outreach', export: 'Baris ekspor' }).map(([k, lbl]) => {
        const mtr = ME.quotas[k];
        return `<div><div class="caption muted">${lbl}</div><div class="numeric-lg num">${mtr.used}<span class="muted-3" style="font-size:14px">${mtr.limit ? ' / ' + mtr.limit : ' · ∞'}</span></div></div>`;
      }).join('')}</div></div>`);
  bindShell();
  $$('[data-plan]').forEach((el) => el.onclick = () => {
    const code = el.dataset.plan;
    const p = plans.find((x) => x.code === code);
    modal(`<h2 style="margin-bottom:10px">Konfirmasi ${p.price ? 'pembayaran' : 'perubahan paket'}</h2>
      <div class="card card-compact" style="margin-bottom:16px;background:var(--bg-surface-alt)">
        <div style="display:flex;justify-content:space-between"><span>Paket ${esc(p.name)} (bulanan)</span><b class="num">${p.price ? fmtIDR(p.price) : 'Rp 0'}</b></div>
        <div class="caption muted-3" style="margin-top:6px">Metode: Midtrans — QRIS / VA / kartu (simulasi demo)</div></div>
      <button class="btn btn-primary" id="pay-now" style="width:100%">${p.price ? 'Bayar & aktifkan' : 'Ganti ke Free'}</button>`);
    $('#pay-now').onclick = async () => {
      const r = await api('/api/me/plan', { method: 'POST', body: { plan: code } });
      closeModal(); toast(`Paket ${p.name} aktif! Invoice ${r.invoice.number} (${r.invoice.provider})`);
      ME = null; render();
    };
  });
});

// boot
render();
