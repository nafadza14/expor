/* EksporIn SPA | vanilla JS, zero dependencies */
'use strict';

// ================= helpers =================
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('id-ID');
const fmtN = (n) => n == null ? '-' : nf.format(Math.round(n));
const fmtUSD = (n) => n == null ? '-' : '$' + nf.format(Math.round(n));
const fmtKg = (n) => n == null ? '-' : (n >= 1e6 ? nf.format(+(n / 1e6).toFixed(1)) + ' rb ton' : n >= 1000 ? nf.format(Math.round(n / 1000)) + ' ton' : nf.format(Math.round(n)) + ' kg');
const fmtIDR = (n) => 'Rp ' + nf.format(n);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDate = (s) => { if (!s) return '-'; const d = new Date(s.slice(0, 10)); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const FLAG = { US: '🇺🇸', JP: '🇯🇵', NL: '🇳🇱', AE: '🇦🇪', AU: '🇦🇺', ID: '🇮🇩', VN: '🇻🇳', BR: '🇧🇷', CO: '🇨🇴', IN: '🇮🇳', TH: '🇹🇭', CN: '🇨🇳', MY: '🇲🇾', EC: '🇪🇨', ET: '🇪🇹' };
const CNAME = { US: 'Amerika Serikat', JP: 'Jepang', NL: 'Belanda', AE: 'Uni Emirat Arab', AU: 'Australia', ID: 'Indonesia', VN: 'Vietnam', BR: 'Brasil', CO: 'Kolombia', IN: 'India', TH: 'Thailand', CN: 'Tiongkok', MY: 'Malaysia', EC: 'Ekuador', ET: 'Ethiopia' };
const flag = (c) => FLAG[c] || '🌐';
const scorePill = (score, label) => {
  if (score == null) return '<span class="pill pill-neutral">N/A</span>';
  const cls = label === 'Hot' ? 'pill-danger' : label === 'Warm' ? 'pill-warning' : label === 'Cold' ? 'pill-info' : 'pill-neutral';
  return `<span class="pill ${cls} num">${score} · ${label}</span>`;
};
const statusPill = (st) => {
  const map = {
    prospect: ['Prospect', 'pill-neutral'],
    contacted: ['Contacted', 'pill-info'],
    negotiating: ['Negotiating', 'pill-warning'],
    qualified: ['Qualified', 'pill-violet'],
    winning: ['Winning', 'pill-orange'],
    won: ['Won ✓', 'pill-success'],
    lost: ['Lost', 'pill-danger'],
    // Aliases for legacy stored rows
    new: ['Prospect', 'pill-neutral'],
    responded: ['Qualified', 'pill-violet'],
  };
  const [t, c] = map[st] || [st, 'pill-neutral'];
  return `<span class="pill ${c}">${t}</span>`;
};
// Spec F5: 6 pipeline stages in this order. `lost` retained as a separate
// terminal state for closed-lost deals (not part of the active pipeline).
const STATUSES = ['prospect', 'contacted', 'negotiating', 'qualified', 'winning', 'won', 'lost'];
const STATUS_LBL = {
  prospect: 'Prospect', contacted: 'Contacted', negotiating: 'Negotiating',
  qualified: 'Qualified', winning: 'Winning', won: 'Won', lost: 'Lost',
  // Backward-compatible aliases in case any stored row still uses the old names:
  new: 'Prospect', responded: 'Qualified',
};

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
  ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m23 18-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16M4 6h16M4 18h16"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

// EksporIn logo SVG (8-petal flower, orange)
const LOGO_SVG = `<svg viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="6" r="3.5" fill="#ef4d23"/><circle cx="16" cy="26" r="3.5" fill="#ef4d23"/><circle cx="6" cy="16" r="3.5" fill="#ef4d23"/><circle cx="26" cy="16" r="3.5" fill="#ef4d23"/><circle cx="8.9" cy="8.9" r="3.5" fill="#ef4d23"/><circle cx="23.1" cy="23.1" r="3.5" fill="#ef4d23"/><circle cx="23.1" cy="8.9" r="3.5" fill="#ef4d23"/><circle cx="8.9" cy="23.1" r="3.5" fill="#ef4d23"/><circle cx="16" cy="16" r="3.5" fill="#ef4d23"/></svg>`;

// Arc gauge (Convix-style tick marks)
function arcGauge(value, { color = '#ef4d23', showLabels = false, min = '', max = '' } = {}) {
  const ticks = 40;
  const active = Math.round((value / 100) * ticks);
  const cx = 100, cy = 100, r = 80;
  let lines = '';
  for (let i = 0; i < ticks; i++) {
    const angle = Math.PI + (i / (ticks - 1)) * Math.PI;
    const x1 = cx + (r - 10) * Math.cos(angle);
    const y1 = cy + (r - 10) * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const c = i < active ? color : '#d4d4d8';
    lines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  let html = `<div class="arc-gauge"><svg viewBox="0 0 200 120" style="max-width:220px;width:100%">${lines}
    <text x="100" y="105" text-anchor="middle" font-size="22" font-weight="600" fill="currentColor">${value}%</text></svg>`;
  if (showLabels) html += `<div class="arc-gauge-labels"><span>${esc(min)}</span><span>${esc(max)}</span></div>`;
  html += '</div>';
  return html;
}

// state
let ME = null;

// ================= API =================
// Re-sync the Supabase session into a local backend cookie. Used both at boot
// and to auto-recover from 401s on cold serverless instances (Vercel).
async function syncSupabaseSession() {
  if (!window.sb) return false;
  try {
    const { data } = await window.sb.auth.getSession();
    if (!data || !data.session || !data.session.access_token) return false;
    const r = await fetch('/api/auth/supabase-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: data.session.access_token }),
    });
    return r.ok;
  } catch (e) { console.warn('[eksporin] supabase-sync failed:', e); return false; }
}

async function currentSbToken() {
  if (!window.sb) return null;
  try {
    const { data } = await window.sb.auth.getSession();
    return data && data.session && data.session.access_token || null;
  } catch { return null; }
}

async function rawFetch(path, opts) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  // Attach Supabase Bearer token so serverless cold instances can identify the user
  // without relying on a persistent session cookie.
  const tok = await currentSbToken();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  // Abort after 12s so a stuck serverless function can never freeze the UI.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), opts.timeout || 12000);
  try {
    return await fetch(path, { credentials: 'same-origin', ...opts, headers, signal: ac.signal, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } finally { clearTimeout(t); }
}

async function api(path, opts = {}) {
  let res = await rawFetch(path, opts);
  // Auto-recover from 401 on protected endpoints: refresh Supabase session and retry once.
  if (res.status === 401 && !path.includes('/auth/') && window.sb) {
    const synced = await syncSupabaseSession();
    if (synced) res = await rawFetch(path, opts);
  }
  const ct = res.headers.get('content-type') || '';
  let data;
  if (ct.includes('json')) {
    try { data = await res.json(); } catch (e) { data = null; }
  } else {
    const text = await res.text();
    // Defensive: if the API returned HTML (e.g. Vercel SPA fallback catching an
    // /api/* path because rewrites are wrong), synthesize a clear error object
    // so callers never receive a string where they expect a JSON object.
    if (/^\s*<!doctype|^\s*<html/i.test(text)) {
      throw { status: res.status || 502, data: { error: 'API endpoint not reachable — got HTML instead of JSON. Check Vercel routing.' } };
    }
    data = text;
  }
  if (res.status === 401 && !path.includes('/auth/')) {
    if (path !== '/api/me') location.hash = '#/login';
    throw { status: 401, data };
  }
  if (res.status === 402) { upgradeModal(data && data.error); throw { status: 402, data, handled: true }; }
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
  const col = score >= 80 ? '#B91C1C' : score >= 60 ? '#ef4d23' : score >= 40 ? '#B45309' : '#9a9a9a';
  return arcGauge(score, { color: col, showLabels: false });
}
function scoreBars(components) {
  const rows = [['Aktivitas impor', components.activity, '30%'], ['Pertumbuhan', components.growth, '20%'], ['Kecocokan produk', components.product_fit, '25%'], ['Kontak tersedia', components.reachability, '15%'], ['Belum dari RI', components.untapped, '10%']];
  return `<div class="score-bars">${rows.map(([lbl, v, w]) => `
    <div class="sb-row"><span class="muted">${lbl} <span class="muted-3">(${w})</span></span>
    <div class="sb-track"><div class="sb-fill" style="width:${v ?? 0}%;background:${(v ?? 0) >= 70 ? 'var(--viz-2)' : (v ?? 0) >= 40 ? 'var(--viz-1)' : 'var(--viz-3)'}"></div></div>
    <b class="num">${v ?? '-'}</b></div>`).join('')}</div>`;
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
    if (m) {
      try { await fn(app, m, params); }
      catch (e) {
        if (e && e.handled) return;
        console.error('[eksporin] route error:', e);
        const detail = (e && (e.data?.error || e.message)) ? String(e.data?.error || e.message) : 'Coba muat ulang halaman.';
        const stack = (e && e.stack) ? String(e.stack).split('\n').slice(0, 3).join('\n') : '';
        const errHtml = `<div class="empty" style="padding:60px 20px;text-align:center;max-width:600px;margin:0 auto">
          <div class="ic" style="font-size:48px">⚠️</div>
          <h3 style="margin:12px 0">Terjadi kesalahan</h3>
          <p class="muted" style="margin-bottom:8px">${esc(detail)}</p>
          ${stack ? `<pre style="text-align:left;background:#f5f5f5;padding:12px;border-radius:8px;font-size:11px;overflow:auto;max-height:120px">${esc(stack)}</pre>` : ''}
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
            <button class="btn btn-primary" onclick="location.reload()">Muat ulang</button>
            <button class="btn btn-neutral" onclick="location.hash='#/'">Ke Beranda</button>
          </div>
        </div>`;
        try { app.innerHTML = shell(errHtml); bindShell(); }
        catch { app.innerHTML = errHtml; }
      }
      return;
    }
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
  const planPill = { free: 'pill-neutral', starter: 'pill-orange', growth: 'pill-success', business: 'pill-violet' }[u.plan] || 'pill-neutral';
  return `<div class="app-shell">
  <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
  <aside class="sidebar" id="sidebar">
    <button class="sidebar-close" id="sidebar-close" aria-label="Tutup menu">${I.x}</button>
    <div class="sidebar-brand"><span class="logo">${I.logoW}</span>EksporIn</div>
    <div class="sidebar-user"><span class="avatar">${esc((u.name || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase())}</span>
      <div style="min-width:0"><div class="nm">${esc(u.name)}</div><div class="em">${esc(u.org_name || u.email)}</div></div></div>
    <nav class="nav">
      ${navItem('#/dashboard', I.home, 'Overview')}
      ${navItem('#/discover', I.ai, 'AI Find Buyer')}
      ${navItem('#/direktori', I.grid, 'Direktori HS')}
      ${navItem('#/cari', I.search, 'Cari Buyer')}
      ${navItem('#/shipments', I.ship, 'Shipment Explorer')}
      <div class="nav-sep overline">Workspace</div>
      ${navItem('#/lists', I.bookmark, 'Daftar Tersimpan')}
      ${navItem('#/outreach', I.send, 'Outreach')}
      ${navItem('#/alerts', I.bell, 'Notifikasi', u.unread_alerts)}
      <div class="nav-sep overline">Akun</div>
      ${navItem('#/settings', I.settings, 'Settings & Profile')}
      ${navItem('#/billing', I.card, 'Paket & Tagihan')}
      <a class="nav-item" href="#" id="nav-logout">${I.out}<span>Keluar</span></a>
    </nav>
    ${u.plan === 'free' || u.plan === 'starter' ? `<div class="sidebar-cta"><h4>Upgrade ke Growth</h4><p>Buka kontak buyer, 500 pencarian, & alert tanpa batas.</p><button class="btn" onclick="location.hash='#/billing'">Lihat paket</button></div>` : '<div style="margin-top:auto"></div>'}
  </aside>
  <div class="main">
    <header class="topbar">
      <button class="topbar-menu" id="topbar-menu" aria-label="Menu">${I.menu}</button>
      <div class="topbar-brand-mobile"><span class="logo" style="width:28px;height:28px;border-radius:8px;background:var(--orange);display:inline-flex;align-items:center;justify-content:center">${I.logoW}</span><span style="font-weight:700">EksporIn</span></div>
      <div class="search-wrap">${I.search}<input class="input" id="global-search" placeholder="Cari buyer atau HS code… (Enter)"></div>
      <div class="topbar-right">
        <span class="pill ${planPill} plan-pill">Paket ${esc(u.plan_name)}</span>
        <button class="bell" onclick="location.hash='#/alerts'" title="Notifikasi">${I.bell}${u.unread_alerts ? '<span class="dot"></span>' : ''}</button>
      </div>
    </header>
    <div class="content">${content}</div>
  </div></div>`;
}
function bindShell() {
  $('#nav-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (window.sb) { try { await window.sb.auth.signOut(); } catch {} }
    await api('/api/auth/logout', { method: 'POST' });
    ME = null; location.hash = '#/';
  });
  $('#global-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const v = e.target.value.trim();
      location.hash = /^\d{2,6}$/.test(v) ? `#/cari?hs=${v}` : `#/cari?q=${encodeURIComponent(v)}`;
    }
  });
  // Mobile sidebar drawer
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebar-backdrop');
  const openSidebar = () => { sidebar?.classList.add('open'); backdrop?.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const closeSidebar = () => { sidebar?.classList.remove('open'); backdrop?.classList.remove('open'); document.body.style.overflow = ''; };
  $('#topbar-menu')?.addEventListener('click', openSidebar);
  $('#sidebar-close')?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);
  // Auto-close when a nav link is clicked (on mobile)
  $$('.sidebar .nav-item').forEach((el) => el.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
  }));
}
// If the wizard just finished but backend saves were slow/failed, we keep the
// user unstuck by remembering the optimistic onboarded=true state locally.
function hasPendingOnboarding() {
  try { return !!localStorage.getItem('eksporin_pending_onboarding'); } catch { return false; }
}
async function retryPendingOnboarding() {
  let raw = null;
  try { raw = localStorage.getItem('eksporin_pending_onboarding'); } catch {}
  if (!raw) return;
  let payload; try { payload = JSON.parse(raw); } catch { return; }
  let sbOk = false;
  if (window.sb) {
    try {
      const { data: sess } = await window.sb.auth.getSession();
      const sbUser = sess && sess.session && sess.session.user;
      if (sbUser) {
        const { error } = await window.sb.from('profiles').upsert({
          id: sbUser.id, email: sbUser.email,
          hs_focus: payload.hs_focus, target_countries: payload.target_countries,
          export_status: payload.export_status, goal: payload.goal,
          org_name: payload.org_name, onboarded: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        if (!error) sbOk = true;
      }
    } catch {}
  }
  let localOk = false;
  try { await api('/api/me/onboarding', { method: 'POST', body: payload }); localOk = true; } catch {}
  if (sbOk) { try { await syncSupabaseSession(); } catch {} }
  if (sbOk || localOk) { try { localStorage.removeItem('eksporin_pending_onboarding'); } catch {} }
}

// Sticky onboarded flag — once a user finishes onboarding in ANY session, we
// remember locally so they're never bounced back to the wizard even if the
// backend save didn't persist (Vercel serverless cold-start re-seeds DB).
function isStickyOnboarded() { try { return localStorage.getItem('eksporin_onboarded') === '1'; } catch { return false; } }
function setStickyOnboarded() { try { localStorage.setItem('eksporin_onboarded', '1'); } catch {} }
// Read user profile directly from Supabase — avoids Vercel serverless
// cold-start latency on the /api/me call. Returns a ME-shaped object.
async function loadMeFromSupabase() {
  if (!window.sb) return null;
  try {
    const { data: sess } = await window.sb.auth.getSession();
    const sbUser = sess && sess.session && sess.session.user;
    if (!sbUser) return null;
    let profile = {};
    try {
      const { data, error } = await window.sb.from('profiles').select('*').eq('id', sbUser.id).maybeSingle();
      if (!error && data) profile = data;
    } catch (e) { console.warn('[eksporin] SB profile read:', e); }
    const plan = profile.plan || 'free';
    const planNames = { free: 'Free', starter: 'Starter', growth: 'Growth', business: 'Business' };
    return {
      id: sbUser.id,
      email: sbUser.email,
      name: profile.name || (sbUser.user_metadata && sbUser.user_metadata.name) || sbUser.email.split('@')[0],
      org_name: profile.org_name || null,
      plan,
      plan_name: planNames[plan] || 'Free',
      onboarded: !!profile.onboarded,
      hs_focus: Array.isArray(profile.hs_focus) ? profile.hs_focus : [],
      target_countries: Array.isArray(profile.target_countries) ? profile.target_countries : [],
      export_status: profile.export_status || null,
      goal: profile.goal || null,
      quotas: {
        search: { used: 0, limit: 20 },
        profile: { used: 0, limit: 3 },
        send: { used: 0, limit: 5 },
        export: { used: 0, limit: 0 },
      },
      contacts_visible: false,
      saved: { used: 0, limit: 10 },
      unread_alerts: 0,
      _fromSupabase: true,
    };
  } catch (e) { console.warn('[eksporin] loadMeFromSupabase:', e); return null; }
}

async function requireMe() {
  if (!ME) {
    // Prefer direct Supabase read (fast, bypasses Vercel serverless cold start).
    ME = await loadMeFromSupabase();
    if (!ME) {
      // Fallback for demo account (lives only in local backend).
      try { ME = await api('/api/me'); }
      catch { location.hash = '#/login'; throw { handled: true }; }
    }
  }
  // Preserve optimistic onboarded=true when a save is still pending, OR when
  // the user completed onboarding in a previous session (sticky flag).
  if (!ME.onboarded && (hasPendingOnboarding() || isStickyOnboarded())) {
    ME.onboarded = true;
    if (hasPendingOnboarding()) retryPendingOnboarding();
  }
  if (!ME.onboarded && parseHash().path !== '/onboarding') { location.hash = '#/onboarding'; throw { handled: true }; }
  return ME;
}
async function refreshMe() {
  try {
    const prev = ME;
    // Prefer Supabase-direct read (skips slow Vercel serverless).
    let fresh = await loadMeFromSupabase();
    if (!fresh) fresh = await api('/api/me');
    // Never revert an onboarded-in-this-tab user back to onboarded=false just
    // because the backend save hasn't caught up.
    if (((prev && prev.onboarded) || isStickyOnboarded()) && !fresh.onboarded) fresh.onboarded = true;
    // Preserve locally-set hs_focus & target_countries if backend hasn't caught up
    // (fire-and-forget saves on Vercel cold starts may still be in flight).
    if (prev && Array.isArray(prev.hs_focus) && prev.hs_focus.length && (!Array.isArray(fresh.hs_focus) || !fresh.hs_focus.length)) {
      fresh.hs_focus = prev.hs_focus;
    }
    if (prev && Array.isArray(prev.target_countries) && prev.target_countries.length && (!Array.isArray(fresh.target_countries) || !fresh.target_countries.length)) {
      fresh.target_countries = prev.target_countries;
    }
    ME = fresh;
  } catch {}
}

// ================= landing =================
route(/^\/$/, async (app) => {
  // Always render the landing page on `/`. Do NOT auto-redirect logged-in users
  // — a stale session without onboarding would bounce them to the onboarding wizard
  // and hide the homepage. Users click Masuk or the dashboard link in the nav explicitly.
  let loggedIn = false;
  try { ME = await api('/api/me'); loggedIn = !!ME; } catch { /* not logged in — expected */ }
  const FLOWER = `<svg class="flower-logo" viewBox="0 0 32 32" fill="#ef4d23">${Array.from({length:8}).map((_,i)=>{const a=i*Math.PI/4;return `<circle cx="${(16+10*Math.cos(a)).toFixed(2)}" cy="${(16+10*Math.sin(a)).toFixed(2)}" r="3.5"/>`;}).join('')}<circle cx="16" cy="16" r="3.5"/></svg>`;
  const CHEVRON_DOWN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  const CART_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';
  const MENU_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>';
  const X_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  const TREND_DOWN = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>';
  const TREND_UP = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';

  app.innerHTML = `
  <div class="landing-wrap">
    <!-- Hero container (clipped) -->
    <div class="landing-hero-container">
      <video class="landing-video" autoplay loop muted playsinline preload="auto" disableremoteplayback
        webkit-playsinline="true" x5-playsinline="true"
        poster="https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4" type="video/mp4">
      </video>
      <div class="landing-video-overlay"></div>
      <div class="landing-fg">
        <!-- Floating pill navbar -->
        <div class="pill-nav-wrap">
          <div class="pill-nav" id="pillNav">
            <div class="pill-logo">${FLOWER}<span>EksporIn</span></div>
            <div class="pill-nav-links">
              <a href="#/" class="active"><span class="dot"></span> Home</a>
              <a href="javascript:void(0)" onclick="document.getElementById('features')?.scrollIntoView({behavior:'smooth'})">Fitur</a>
              <a href="javascript:void(0)" onclick="document.getElementById('how')?.scrollIntoView({behavior:'smooth'})">Tentang</a>
              <a href="javascript:void(0)" onclick="document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})" class="chev">Halaman ${CHEVRON_DOWN}</a>
            </div>
            <div class="pill-nav-right">
              <a href="#/login" class="pill-signin">Masuk</a>
              <a href="#/register" class="pill-cta">
                <span class="cta-full">Daftar gratis</span><span class="cta-short">Daftar</span>
                <span class="arrow-circle">${CHEVRON_RIGHT}</span>
              </a>
              <button class="pill-menu" onclick="document.getElementById('pillMenuPanel').classList.toggle('open')" aria-label="Menu">${MENU_ICON}</button>
            </div>
            <div class="pill-menu-panel" id="pillMenuPanel">
              <a href="#/" class="active"><span class="dot"></span> Home</a>
              <a href="javascript:void(0)" onclick="document.getElementById('features')?.scrollIntoView({behavior:'smooth'});document.getElementById('pillMenuPanel').classList.remove('open')">Fitur</a>
              <a href="javascript:void(0)" onclick="document.getElementById('how')?.scrollIntoView({behavior:'smooth'});document.getElementById('pillMenuPanel').classList.remove('open')">Tentang</a>
              <a href="javascript:void(0)" onclick="document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'});document.getElementById('pillMenuPanel').classList.remove('open')">Halaman</a>
              <a href="#/login">Masuk</a>
              <a href="#/register">Daftar gratis</a>
              ${loggedIn ? '<a href="#/dashboard">Buka Dashboard</a>' : ''}
            </div>
          </div>
        </div>

        <!-- Hero content -->
        <div class="hero-content">
          <div class="hero-badge"><span class="dot"></span> EksporIn Platform</div>
          <h1 class="hero-headline">
            Shaping <span class="serif-italic">Exporters</span><br>of tomorrow
          </h1>
          <p class="hero-sub">Platform intelijen buyer global untuk eksportir Indonesia. Data bea cukai, skor prioritas, dan kontak decision maker dalam satu dashboard.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px">
            <a class="hero-cta" href="#/register" style="margin-top:0">
              <span>Daftar Gratis</span>
              <span class="arrow-circle">${CHEVRON_RIGHT}</span>
            </a>
            <a class="hero-cta" href="#/login" style="margin-top:0;background:#fff;color:#0b0f1a;border:1px solid rgba(0,0,0,.1)">
              <span>Masuk</span>
              <span class="arrow-circle" style="background:rgba(0,0,0,.08)">${CHEVRON_RIGHT}</span>
            </a>
          </div>
          <p class="hero-demo-hint">Akun demo: demo@eksporin.id / demo1234 · <a href="#/login">Masuk sekarang</a></p>
        </div>

        <!-- Dashboard preview tray -->
        <div class="dash-preview-wrap">
          <div class="dash-preview-tray">
            <div class="dash-preview-grid">
              <!-- Card 1: Buyer aktif -->
              <div class="preview-card">
                <div class="pc-header"><span class="label">Buyer Aktif</span><span class="muted">Bulan Ini</span></div>
                <div class="pc-big">6.896</div>
                <div class="pc-row">
                  <span class="pc-pill-danger">${TREND_DOWN} -3.382 (33%)</span>
                </div>
                <div class="pc-small">Dibanding bulan lalu</div>
                <div class="pc-target-label">Target bulan tercapai</div>
                ${arcGauge(92, { color: '#ef4d23', showLabels: true, min: '389K', max: '425K' })}
                <div class="toggle-pill">
                  <button class="active">Impresi</button><button>Klik</button>
                </div>
              </div>

              <!-- Card 2: Form -->
              <div class="preview-card preview-form">
                <div class="pc-form-group">
                  <label>Tampilkan data untuk</label>
                  <button class="pc-select">Bulan ini ${CHEVRON_DOWN}</button>
                </div>
                <div class="pc-form-group">
                  <label>Bandingkan periode</label>
                  <button class="pc-select">Month-to-date (MTD) ${CHEVRON_DOWN}</button>
                </div>
                <div class="pc-form-group">
                  <label>Target buyer (bulan ini)</label>
                  <div class="pc-input"><span class="pc-hash">#</span><span>10</span></div>
                </div>
                <div class="pc-form-group">
                  <label>Target buyer (tahun ini)</label>
                  <div class="pc-input"><span class="pc-hash">#</span><span>100</span></div>
                </div>
                <div class="pc-form-footer">
                  <button class="pc-save">Simpan</button>
                  <a class="pc-cancel">Batal</a>
                  <button class="pc-x" aria-label="Tutup">${X_ICON}</button>
                </div>
              </div>

              <!-- Card 3: Match Score -->
              <div class="preview-card">
                <div class="pc-header"><span class="label">Match Score</span><span class="muted">hari ini</span></div>
                <div class="pc-big">0</div>
                <div class="pc-row">
                  <span class="pc-pill-neutral">${TREND_UP} 0</span>
                </div>
                <div class="pc-small">Dibanding kemarin</div>
                ${arcGauge(68, { color: '#9ca3af' })}
                <div class="toggle-pill">
                  <button class="active">Hot Leads</button><button>Pipeline</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Features -->
    <section class="landing-section" id="features">
      <div class="landing-section-inner">
        <div class="overline" style="text-align:center;margin-bottom:8px;text-transform:none;letter-spacing:0;font-size:13px;color:var(--orange)">Fitur Utama</div>
        <h2 style="text-align:center;font-size:28px;margin-bottom:8px">Semua yang Anda butuhkan untuk ekspor</h2>
        <p class="muted" style="text-align:center;max-width:520px;margin:0 auto 40px">Dari pencarian buyer sampai kirim pesan pertama, dalam satu platform.</p>
        <div class="feature-grid">
          ${[
            {
              title: 'AI Buyer Discovery',
              desc: 'Deskripsikan komoditas dalam bahasa alami. AI memetakan HS code, mencari importir aktif, dan memberi skor prioritas.',
              panel: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
                <rect x="24" y="24" width="152" height="52" rx="14" fill="#fff" stroke="#f4c9a8" stroke-width="1.2"/>
                <circle cx="46" cy="50" r="8" fill="#ffdfca"/>
                <path d="M42 50 L46 54 L50 46" stroke="#ef4d23" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <rect x="60" y="42" width="90" height="6" rx="3" fill="#e8dfd6"/>
                <rect x="60" y="54" width="60" height="5" rx="2.5" fill="#f0e6dc"/>
                <path d="M100 78 L100 96" stroke="#ef4d23" stroke-width="1.6" stroke-dasharray="3 3"/>
                <path d="M100 90 L96 86 M100 90 L104 86" stroke="#ef4d23" stroke-width="1.6" stroke-linecap="round"/>
                <g transform="translate(160 90)">
                  <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#ef4d23"/>
                </g>
              </svg>`,
              icon: 'sparkle',
            },
            {
              title: 'Direktori HS Code',
              desc: 'Telusuri buyer per kategori produk dengan data volume, nilai, dan negara asal. Drill-down dari bab sampai sub-heading 6-digit.',
              panel: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
                <rect x="24" y="22" width="152" height="14" rx="4" fill="#ffe9d8"/>
                <text x="34" y="32" fill="#ef4d23" font-size="8" font-weight="700" font-family="system-ui">HS 0901</text>
                <rect x="130" y="26" width="30" height="6" rx="3" fill="#ef4d23"/>
                <rect x="24" y="42" width="70" height="30" rx="6" fill="#fff" stroke="#f4c9a8" stroke-width="1"/>
                <rect x="30" y="48" width="20" height="4" rx="2" fill="#ffe0c9"/>
                <text x="30" y="62" fill="#282828" font-size="7" font-weight="700" font-family="system-ui">4,240 buyer</text>
                <rect x="106" y="42" width="70" height="30" rx="6" fill="#fff" stroke="#f4c9a8" stroke-width="1"/>
                <rect x="112" y="48" width="20" height="4" rx="2" fill="#ffe0c9"/>
                <text x="112" y="62" fill="#282828" font-size="7" font-weight="700" font-family="system-ui">218k ton</text>
                <rect x="24" y="80" width="152" height="18" rx="6" fill="#fffaf6" stroke="#f4c9a8" stroke-width="1"/>
                <circle cx="36" cy="89" r="4" fill="#ef4d23"/>
                <rect x="46" y="86" width="80" height="4" rx="2" fill="#e8dfd6"/>
                <rect x="46" y="92" width="50" height="3" rx="1.5" fill="#f0e6dc"/>
              </svg>`,
              icon: 'grid',
            },
            {
              title: 'Shipment Explorer',
              desc: 'Telusuri data bill of lading lintas buyer untuk analisis mendalam. Filter per HS code, negara, eksportir, dan periode.',
              panel: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
                <path d="M20 96 Q100 88 180 96" stroke="#f4c9a8" stroke-width="1" fill="none" stroke-dasharray="2 3"/>
                <rect x="60" y="52" width="80" height="30" rx="3" fill="#ef4d23"/>
                <rect x="66" y="42" width="16" height="14" rx="1.5" fill="#c53d18"/>
                <rect x="86" y="42" width="16" height="14" rx="1.5" fill="#c53d18"/>
                <rect x="106" y="42" width="16" height="14" rx="1.5" fill="#c53d18"/>
                <rect x="126" y="42" width="14" height="14" rx="1.5" fill="#c53d18"/>
                <path d="M40 82 L60 82 L64 74 L136 74 L140 82 L160 82 L156 92 L44 92 Z" fill="#fff" stroke="#282828" stroke-width="1.4"/>
                <rect x="90" y="30" width="4" height="14" fill="#282828"/>
                <path d="M94 30 L94 40 L108 36 Z" fill="#ef4d23"/>
                <text x="18" y="28" fill="#ef4d23" font-size="7" font-weight="700" font-family="system-ui">🇮🇩 → 🇺🇸</text>
              </svg>`,
              icon: 'ship',
            },
            {
              title: 'Match Score 0–100',
              desc: 'Setiap buyer mendapat skor berdasarkan aktivitas impor, pertumbuhan, kecocokan produk, dan ketersediaan kontak.',
              panel: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
                <path d="M40 100 A60 60 0 0 1 160 100" stroke="#f4d0b0" stroke-width="8" fill="none" stroke-linecap="round"/>
                <path d="M40 100 A60 60 0 0 1 148 62" stroke="#ef4d23" stroke-width="8" fill="none" stroke-linecap="round"/>
                <text x="100" y="94" text-anchor="middle" fill="#282828" font-size="22" font-weight="700" font-family="system-ui">87</text>
                <rect x="76" y="18" width="48" height="14" rx="7" fill="#ef4d23"/>
                <text x="100" y="28" text-anchor="middle" fill="#fff" font-size="8" font-weight="700" font-family="system-ui">HOT LEAD</text>
              </svg>`,
              icon: 'target',
            },
            {
              title: 'Kontak Decision Maker',
              desc: 'Nama, email terverifikasi, dan profil LinkedIn dari Procurement Manager, Sourcing Director, dan posisi kunci lainnya.',
              panel: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
                <rect x="24" y="30" width="152" height="26" rx="8" fill="#fff" stroke="#f4c9a8" stroke-width="1.2"/>
                <circle cx="40" cy="43" r="7" fill="#ffdfca"/>
                <text x="40" y="46" text-anchor="middle" fill="#ef4d23" font-size="7" font-weight="700" font-family="system-ui">JT</text>
                <rect x="54" y="37" width="80" height="4" rx="2" fill="#282828"/>
                <rect x="54" y="45" width="60" height="3" rx="1.5" fill="#a99a8c"/>
                <g transform="translate(148 43)">
                  <circle r="6" fill="#4d8c35"/>
                  <path d="M-2.5 0 L-0.5 2 L3 -2" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
                <rect x="24" y="64" width="152" height="26" rx="8" fill="#fffaf6" stroke="#f4c9a8" stroke-width="1"/>
                <circle cx="40" cy="77" r="7" fill="#ffdfca"/>
                <text x="40" y="80" text-anchor="middle" fill="#ef4d23" font-size="7" font-weight="700" font-family="system-ui">MK</text>
                <rect x="54" y="71" width="70" height="4" rx="2" fill="#282828"/>
                <rect x="54" y="79" width="50" height="3" rx="1.5" fill="#a99a8c"/>
                <g transform="translate(148 77)">
                  <circle r="6" fill="#4d8c35"/>
                  <path d="M-2.5 0 L-0.5 2 L3 -2" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
              </svg>`,
              icon: 'user',
            },
            {
              title: 'Template Outreach',
              desc: 'Template multi-bahasa siap kirim dengan variabel otomatis. Lacak open rate dan reply rate dari dashboard.',
              panel: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
                <rect x="30" y="30" width="140" height="60" rx="8" fill="#fff" stroke="#f4c9a8" stroke-width="1.4"/>
                <path d="M30 38 L100 68 L170 38" stroke="#ef4d23" stroke-width="1.6" fill="none"/>
                <rect x="46" y="46" width="60" height="3" rx="1.5" fill="#e8dfd6"/>
                <rect x="46" y="52" width="80" height="3" rx="1.5" fill="#e8dfd6"/>
                <rect x="46" y="58" width="50" height="3" rx="1.5" fill="#e8dfd6"/>
                <g transform="translate(154 96)">
                  <circle r="10" fill="#ef4d23"/>
                  <path d="M-4 0 L-1 3 L4 -3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </g>
                <text x="24" y="106" fill="#4d8c35" font-size="8" font-weight="700" font-family="system-ui">EN · ES · ZH · JA</text>
              </svg>`,
              icon: 'mail',
            },
          ].map((f) => `
            <article class="feature-card">
              <div class="feature-panel">${f.panel}</div>
              <div class="feature-copy">
                <h3>${f.title}</h3>
                <p>${f.desc}</p>
                <span class="feature-corner">${{
                  sparkle: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1 L9.4 6.6 L15 8 L9.4 9.4 L8 15 L6.6 9.4 L1 8 L6.6 6.6 Z"/></svg>',
                  grid: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.4"/><rect x="9" y="1" width="6" height="6" rx="1.4"/><rect x="1" y="9" width="6" height="6" rx="1.4"/><rect x="9" y="9" width="6" height="6" rx="1.4"/></svg>',
                  ship: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 11 L14 11 L13 14 L3 14 Z"/><rect x="5" y="6" width="6" height="4" rx="0.5"/><rect x="7" y="2" width="2" height="4"/></svg>',
                  target: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg>',
                  user: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14 Q2 9 8 9 Q14 9 14 14 Z"/></svg>',
                  mail: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="M1.5 4 L8 9 L14.5 4"/></svg>',
                }[f.icon]}</span>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="landing-section" id="how" style="background:var(--bg-surface)">
      <div class="landing-section-inner">
        <div class="overline" style="text-align:center;margin-bottom:8px;text-transform:none;letter-spacing:0;font-size:13px;color:var(--orange)">Cara Kerja</div>
        <h2 style="text-align:center;font-size:28px;margin-bottom:40px">4 langkah menuju buyer pertama Anda</h2>
        <div class="grid grid-4" style="gap:20px">
          ${[
            ['1', 'Deskripsikan produk', 'Masukkan komoditas dalam bahasa Indonesia atau Inggris. AI langsung memetakan ke HS code 6-digit.'],
            ['2', 'Temukan buyer', 'Pipeline AI mencari importir aktif dari database bill of lading dan meng-enrich kontak decision maker.'],
            ['3', 'Evaluasi dan simpan', 'Lihat match score, riwayat shipment, dan outreach angle per buyer. Simpan yang potensial ke daftar.'],
            ['4', 'Kirim outreach', 'Gunakan template multi-bahasa untuk menghubungi buyer. Lacak status pesan dari dashboard.'],
          ].map(([n, title, desc]) => `
            <div style="text-align:center">
              <div style="width:40px;height:40px;border-radius:50%;background:var(--orange);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;margin-bottom:12px">${n}</div>
              <h4 style="margin-bottom:6px">${title}</h4>
              <p class="muted body-sm">${desc}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <!-- Social proof -->
    <section class="landing-section">
      <div class="landing-section-inner">
        <div class="grid grid-4" style="gap:20px;text-align:center">
          <div><div class="numeric-xl" style="color:var(--orange)">200+</div><p class="muted body-sm" style="margin-top:4px">Buyer dari 5 negara</p></div>
          <div><div class="numeric-xl" style="color:var(--orange)">50+</div><p class="muted body-sm" style="margin-top:4px">Kategori HS code</p></div>
          <div><div class="numeric-xl" style="color:var(--orange)">10rb+</div><p class="muted body-sm" style="margin-top:4px">Data shipment</p></div>
          <div><div class="numeric-xl" style="color:var(--orange)">4 step</div><p class="muted body-sm" style="margin-top:4px">AI Discovery pipeline</p></div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="landing-section" id="pricing" style="background:var(--orange);color:#fff;text-align:center">
      <div class="landing-section-inner">
        <h2 style="color:#fff;font-size:28px;margin-bottom:8px">Siap menemukan buyer pertama Anda?</h2>
        <p style="opacity:.9;max-width:440px;margin:0 auto 28px">Mulai dengan paket gratis, tanpa kartu kredit. Upgrade kapan saja sesuai kebutuhan bisnis Anda.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="#/register" class="btn" style="background:#fff;color:var(--orange);border-radius:var(--radius-full);padding:14px 32px;font-size:16px;font-weight:600">Daftar gratis</a>
          <a href="#/login" class="btn" style="background:rgba(255,255,255,.2);color:#fff;border-radius:var(--radius-full);padding:14px 32px;font-size:16px;font-weight:600;border:1px solid rgba(255,255,255,.3)">Masuk</a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-section-inner" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700">${LOGO_SVG} EksporIn</div>
        <p class="caption muted-3">&copy; 2024 EksporIn. Platform intelijen buyer untuk eksportir Indonesia.</p>
      </div>
    </footer>
  </div>`;
});

// ================= auth =================
function authHero() {
  return `<div class="auth-hero">
    <img class="auth-bg" src="https://images.pexels.com/photos/3848793/pexels-photo-3848793.jpeg?auto=compress&cs=tinysrgb&w=1600&q=80" alt="" aria-hidden="true">
    <div class="auth-bg-tint"></div>
    <div class="auth-brand">${LOGO_SVG.replace(/#ef4d23/g, '#fff')} <span>EksporIn</span></div>
    <div class="auth-copy auth-glass">
      <h1>Buyer luar negeri, tinggal <span class="serif-italic">satu klik</span></h1>
      <p>Data bea cukai, skor prioritas, dan kontak decision maker. Diorganisir agar UKM Indonesia bisa menemukan buyer tepat dalam hitungan menit.</p>
      <ul class="auth-checklist">
        <li><span class="chk-dot"></span>AI Buyer Discovery, cari pakai bahasa alami</li>
        <li><span class="chk-dot"></span>Skor prioritas otomatis 0–100 per buyer</li>
        <li><span class="chk-dot"></span>Kontak decision maker terverifikasi</li>
        <li><span class="chk-dot"></span>Template outreach multi-bahasa siap kirim</li>
      </ul>
    </div>
  </div>`;
}
route(/^\/login$/, (app) => {
  app.innerHTML = `<div class="auth-page">${authHero()}<div class="auth-form-side"><div class="auth-card card">
    <h2 style="margin-bottom:4px">Masuk</h2><p class="muted body-sm" style="margin-bottom:20px">Belum punya akun? <a href="#/register">Daftar gratis</a></p>
    <form id="f"><div class="field"><label>Email</label><input class="input" name="email" type="email" required value="demo@eksporin.id"></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" required value="demo1234"></div>
    <button class="btn btn-primary" style="width:100%">Masuk</button></form>
    <p class="caption muted-3" style="margin-top:14px;text-align:center">Akun demo sudah terisi, langsung klik Masuk.</p></div></div></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const isDemo = email === 'demo@eksporin.id';
    try {
      // Demo account uses local backend only (not in Supabase).
      if (isDemo) {
        const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        ME = null; location.hash = r.onboarded ? '#/dashboard' : '#/onboarding';
        return;
      }
      // Primary: Supabase auth
      if (window.sb) {
        const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (/email not confirmed|not.*verified/i.test(msg)) {
            toast('Email Anda belum dikonfirmasi. Cek inbox untuk link konfirmasi.', true);
          } else if (/invalid login credentials/i.test(msg)) {
            toast('Email atau password salah.', true);
          } else {
            toast(error.message || 'Gagal masuk', true);
          }
          return;
        }
        if (!data || !data.session) {
          toast('Login gagal — cek email konfirmasi Anda.', true);
          return;
        }
        // Sync to backend (best-effort — Bearer token also auto-attaches on subsequent requests)
        try { await api('/api/auth/supabase-sync', { method: 'POST', body: { access_token: data.session.access_token } }); } catch (e) { console.warn('[eksporin] sync warn:', e); }
        // Fetch /api/me to determine onboarded state (uses Bearer token)
        let onboarded = false;
        try { const me = await api('/api/me'); onboarded = !!me.onboarded; } catch {}
        ME = null; location.hash = onboarded ? '#/dashboard' : '#/onboarding';
        return;
      }
      // Fallback (Supabase SDK failed to load) — local backend
      const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      ME = null; location.hash = r.onboarded ? '#/dashboard' : '#/onboarding';
    } catch (err) { toast(err.data?.error || err.message || 'Gagal masuk', true); }
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
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const name = String(fd.get('name') || '').trim();
    const org_name = String(fd.get('org_name') || '').trim() || null;
    const submitBtn = e.target.querySelector('button[type=submit], button:not([type])');
    const origLabel = submitBtn && submitBtn.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Mendaftar…'; }
    try {
      if (!window.sb) {
        // Fallback (Supabase SDK failed to load) — local backend only.
        await api('/api/auth/register', { method: 'POST', body: { email, password, name, org_name } });
        ME = null; location.hash = '#/onboarding';
        return;
      }
      // Supabase signUp — this is the primary path.
      const { data, error } = await window.sb.auth.signUp({
        email, password,
        options: {
          data: { name, org_name },
          emailRedirectTo: window.location.origin + '/',
        },
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (/already registered|user already exists|already been registered/i.test(msg)) {
          toast('Email sudah terdaftar. Silakan masuk.', true);
          setTimeout(() => { location.hash = '#/login'; }, 800);
        } else if (/password/i.test(msg) && /short|weak|character/i.test(msg)) {
          toast('Password terlalu lemah. Minimal 8 karakter dengan campuran huruf & angka.', true);
        } else if (/invalid.*email/i.test(msg)) {
          toast('Format email tidak valid.', true);
        } else {
          toast(error.message || 'Gagal mendaftar', true);
        }
        return;
      }
      // If Supabase requires email confirmation, no session is returned yet.
      if (!data || !data.session) {
        toast('Akun dibuat. Cek email Anda untuk link konfirmasi, lalu masuk.', false);
        setTimeout(() => { location.hash = '#/login'; }, 1200);
        return;
      }
      // Session ready — sync to backend so local user + cookie exist too (best-effort).
      try {
        await api('/api/auth/supabase-sync', { method: 'POST', body: { access_token: data.session.access_token } });
      } catch (syncErr) { console.warn('[eksporin] sync warn:', syncErr); }
      ME = null;
      toast('Akun berhasil dibuat! Yuk lengkapi profil.', false);
      location.hash = '#/onboarding';
    } catch (err) {
      console.error('[eksporin] register error:', err);
      toast(err.data?.error || err.message || 'Gagal mendaftar. Coba lagi.', true);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origLabel || 'Buat akun'; }
    }
  });
});

// ================= onboarding wizard =================
// Hardcoded fallback HS leaves — used when /api/hs/leaf fails (cold-start, timeout, etc.)
const FALLBACK_HS_LEAVES = [
  { code: '030343', description_en: 'Skipjack / stripe-bellied bonito, frozen', description_id: 'Cakalang beku' },
  { code: '030389', description_en: 'Other fish, frozen', description_id: 'Ikan beku lainnya' },
  { code: '030616', description_en: 'Cold-water shrimps and prawns, frozen', description_id: 'Udang air dingin beku' },
  { code: '030617', description_en: 'Other shrimps and prawns, frozen', description_id: 'Udang beku lainnya' },
  { code: '090111', description_en: 'Coffee, not roasted, not decaffeinated', description_id: 'Kopi biji, belum disangrai' },
  { code: '090121', description_en: 'Coffee, roasted, not decaffeinated', description_id: 'Kopi sangrai' },
  { code: '090411', description_en: 'Pepper, neither crushed nor ground', description_id: 'Lada utuh' },
  { code: '090510', description_en: 'Vanilla, neither crushed nor ground', description_id: 'Vanili utuh (polong kering)' },
  { code: '090520', description_en: 'Vanilla, crushed or ground', description_id: 'Vanili bubuk' },
  { code: '090811', description_en: 'Nutmeg, neither crushed nor ground', description_id: 'Pala utuh' },
  { code: '151311', description_en: 'Coconut (copra) oil, crude', description_id: 'Minyak kelapa mentah' },
  { code: '160414', description_en: 'Tunas, skipjack, prepared/preserved', description_id: 'Tuna/cakalang olahan (kaleng)' },
  { code: '160521', description_en: 'Shrimps and prawns, not in airtight containers', description_id: 'Udang olahan (non-kaleng)' },
  { code: '400122', description_en: 'Technically specified natural rubber (TSNR)', description_id: 'Karet alam spesifikasi teknis (TSNR/SIR)' },
  { code: '441231', description_en: 'Plywood of tropical wood', description_id: 'Kayu lapis kayu tropis' },
  { code: '460212', description_en: 'Basketwork of rattan', description_id: 'Anyaman rotan' },
  { code: '940161', description_en: 'Seats with wooden frames, upholstered', description_id: 'Kursi rangka kayu, berlapis' },
  { code: '940169', description_en: 'Seats with wooden frames, other', description_id: 'Kursi rangka kayu lainnya' },
  { code: '940330', description_en: 'Wooden furniture for offices', description_id: 'Perabot kayu untuk kantor' },
  { code: '940350', description_en: 'Wooden furniture for bedrooms', description_id: 'Perabot kayu untuk kamar tidur' },
  { code: '940360', description_en: 'Other wooden furniture', description_id: 'Perabot kayu lainnya' },
];
route(/^\/onboarding$/, async (app) => {
  // Read user from Supabase directly — no dependency on local backend cold start.
  if (!ME) {
    ME = await loadMeFromSupabase();
  }
  if (!ME) {
    // Demo account fallback (local backend only).
    try { ME = await api('/api/me', { timeout: 20000 }); } catch { location.hash = '#/login'; return; }
  }
  // Fetch HS leaf codes with fallback — onboarding must never break even if API is down
  let leaves;
  try { leaves = await api('/api/hs/leaf', { timeout: 20000 }); } catch (e) { console.warn('[eksporin] /api/hs/leaf failed, using fallback:', e); }
  if (!Array.isArray(leaves) || !leaves.length) leaves = FALLBACK_HS_LEAVES;
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
    app.innerHTML = `<div class="wizard"><div style="display:flex;align-items:center;gap:10px;padding:0 0 20px;font-weight:700;font-size:18px">${LOGO_SVG} EksporIn</div>
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
      console.log('[eksporin] finish() invoked, state:', { step: state.step, hsN: state.hs.length, countriesN: state.countries.length, goal: state.goal });
      // GUARANTEE redirect no matter what happens below. Set up a forced
      // navigation that fires after a short delay if we somehow don't get there.
      const forceRedirect = () => {
        try { app.innerHTML = '<div class="boot-splash"><div class="spinner"></div><p style="margin-top:20px;color:#737373;font-size:14px">Membuka dashboard…</p></div>'; } catch {}
        if (location.hash !== '#/dashboard') {
          try { location.hash = '#/dashboard'; } catch {}
          setTimeout(() => { if (location.hash !== '#/dashboard') { try { location.replace(location.pathname + '#/dashboard'); } catch {} } }, 100);
        }
      };
      // Immediate visual feedback so user knows click registered
      try {
        app.innerHTML = '<div class="boot-splash"><div class="spinner"></div><p style="margin-top:20px;color:#737373;font-size:14px">Membuka dashboard…</p></div>';
      } catch (e) { console.error('[eksporin] splash render failed:', e); }

      let payload;
      try {
        payload = {
          hs_focus: Array.isArray(state.hs) ? state.hs : [],
          target_countries: Array.isArray(state.countries) ? state.countries : [],
          export_status: state.export_status || null,
          goal: state.goal || null,
          org_name: state.org || null,
        };
      } catch (e) { console.error('[eksporin] payload build failed:', e); payload = { hs_focus: [], target_countries: [] }; }

      // Cache the payload FIRST so retryPendingOnboarding() can pick it up
      try { localStorage.setItem('eksporin_pending_onboarding', JSON.stringify(payload)); } catch (e) { console.warn('[eksporin] localStorage set failed:', e); }
      // Sticky onboarded flag — user stays onboarded across sessions even if
      // backend re-seeds (Vercel cold-start) or Supabase sync fails.
      setStickyOnboarded();

      // Optimistically patch ME so requireMe() on /dashboard doesn't bounce.
      try {
        if (ME) {
          ME.hs_focus = payload.hs_focus;
          ME.target_countries = payload.target_countries;
          ME.export_status = payload.export_status;
          ME.goal = payload.goal;
          ME.org_name = payload.org_name || ME.org_name || null;
          ME.onboarded = true;
        }
      } catch (e) { console.error('[eksporin] ME patch failed:', e); }

      // Redirect to dashboard IMMEDIATELY — do not await any I/O.
      try { toast('Selamat datang di EksporIn! 🎉'); } catch (e) { console.warn('[eksporin] toast failed:', e); }
      forceRedirect();

      // Fire-and-forget saves. Timeout each so a stuck Vercel cold-start
      // never leaves data unwritten forever — the retry loop from
      // requireMe() will pick up any leftover in localStorage.
      const withTimeout = (p, ms, label) => Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout ' + ms + 'ms')), ms)),
      ]);
      (async () => {
        let sbSaved = false, localSaved = false;
        if (window.sb) {
          try {
            const { data: sess } = await withTimeout(window.sb.auth.getSession(), 4000, 'getSession');
            const sbUser = sess && sess.session && sess.session.user;
            if (sbUser) {
              const upsertPromise = window.sb.from('profiles').upsert({
                id: sbUser.id,
                email: sbUser.email,
                name: ME && ME.name,
                org_name: state.org || null,
                hs_focus: state.hs,
                target_countries: state.countries,
                export_status: state.export_status,
                goal: state.goal,
                onboarded: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' });
              const { error } = await withTimeout(upsertPromise, 8000, 'SB upsert');
              if (!error) sbSaved = true;
              else console.warn('[eksporin] SB upsert error:', error);
            }
          } catch (e) { console.warn('[eksporin] SB save:', e); }
        }
        try {
          await withTimeout(api('/api/me/onboarding', { method: 'POST', body: payload }), 8000, 'local save');
          localSaved = true;
        } catch (e) { console.warn('[eksporin] Local save:', e); }
        if (sbSaved) {
          try { await withTimeout(syncSupabaseSession(), 5000, 'sync'); } catch {}
        }
        if (sbSaved || localSaved) {
          try { localStorage.removeItem('eksporin_pending_onboarding'); } catch {}
        }
      })();
    };
    $('#w-skip').onclick = async () => { try { await finish(); } catch (e) { console.error('[eksporin] skip finish err:', e); location.hash = '#/dashboard'; } };
    $('#w-next').onclick = async () => {
      try {
        if (state.step === 0) { const el = $('#w-org'); if (el) state.org = el.value.trim(); }
        // Show a friendly hint when the user hasn't selected anything on optional
        // steps, but don't block them — they can always refine choices later.
        if (state.step === 1 && !state.hs.length) toast('Tip: pilih HS untuk rekomendasi lebih akurat. Anda bisa lewati juga.', false);
        if (state.step === 2 && !state.countries.length) toast('Tip: pilih negara target agar alert lebih relevan.', false);
        if (state.step < 4) { state.step++; draw(); } else await finish();
      } catch (e) {
        console.error('[eksporin] w-next handler err:', e);
        // Never leave the user stuck — force redirect to dashboard on catastrophic failure.
        if (state.step === 4) { try { location.hash = '#/dashboard'; } catch {} }
      }
    };
  };
  draw();
});

// ================= dashboard =================
route(/^\/dashboard$/, async (app) => {
  try { await requireMe(); } catch (e) {
    if (e && e.handled) throw e; // redirect already scheduled
    console.error('[dashboard] requireMe failed:', e);
    // Fall through — use whatever ME we have or make a minimal one
    if (!ME) ME = { email: 'guest@eksporin.id', name: 'Guest', onboarded: true, hs_focus: [], target_countries: [], plan: 'free', plan_name: 'Free', quotas: {}, unread_alerts: 0 };
  }
  ME = ME || {};
  // Ensure ME has all required fields with safe defaults — a partial ME (from
  // cold-start Supabase sync race) must never crash the dashboard render.
  ME.name = ME.name || (ME.email ? String(ME.email).split('@')[0] : 'User');
  ME.hs_focus = Array.isArray(ME.hs_focus) ? ME.hs_focus : [];
  ME.target_countries = Array.isArray(ME.target_countries) ? ME.target_countries : [];
  ME.plan = ME.plan || 'free';
  ME.plan_name = ME.plan_name || 'Free';
  ME.unread_alerts = ME.unread_alerts || 0;
  ME.quotas = ME.quotas || { search: { used: 0, limit: null }, profile: { used: 0, limit: null }, send: { used: 0, limit: null }, export: { used: 0, limit: null } };
  // Render the shell with placeholders immediately so the user sees the app
  // structure even if /api/dashboard is slow on a Vercel cold instance.
  try {
    app.innerHTML = shell(`<div class="hero-card" style="margin-bottom:24px;text-align:center;padding:40px">
      <div class="spinner" style="margin:0 auto 12px"></div>
      <p class="muted">Memuat data dashboard…</p>
    </div>`);
    bindShell();
  } catch (e) { console.warn('[eksporin] shell render failed:', e); }
  let d;
  try {
    d = await api('/api/dashboard', { timeout: 20000 });
  } catch (e) {
    console.warn('[eksporin] /api/dashboard failed, showing fallback:', e);
    // Fallback: minimal dashboard so user sees SOMETHING even if backend is down.
    d = null;
  }
  // Fire-and-forget refreshMe — don't block dashboard render on it.
  refreshMe().catch(() => {});
  // Normalize dashboard payload with safe defaults for every field.
  d = d || {};
  d.saved = d.saved || 0;
  d.outreach = d.outreach || { total: 0, opened: 0, replied: 0 };
  d.pipeline = Array.isArray(d.pipeline) ? d.pipeline : [];
  d.alerts_unread = d.alerts_unread || 0;
  d.trend = Array.isArray(d.trend) ? d.trend : [];
  d.country_breakdown = Array.isArray(d.country_breakdown) ? d.country_breakdown : [];
  d.recommendations = Array.isArray(d.recommendations) ? d.recommendations : [];
  const pl = Object.fromEntries(d.pipeline.map((p) => [p.status || 'unknown', p.n || 0]));
  const q = ME.quotas || {};
  // Ensure each quota bucket exists with safe defaults
  ['search', 'profile', 'send', 'export'].forEach((k) => { if (!q[k]) q[k] = { used: 0, limit: null }; });
  const quotaRow = (lbl, m) => {
    m = m || { used: 0, limit: null };
    const pct = m.limit ? Math.min(100, (m.used / m.limit) * 100) : 0;
    return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span class="muted">${lbl}</span><b class="num">${m.used || 0}${m.limit ? ' / ' + m.limit : ' · tanpa batas'}</b></div>
      <div class="progressbar ${pct > 80 ? 'warn' : ''}"><div style="width:${m.limit ? pct : 4}%"></div></div></div>`;
  };
  // Safe HS code slice — handle non-string values
  const firstHs = ME.hs_focus[0];
  const hsQuery = (typeof firstHs === 'string' && firstHs.length >= 4) ? '?hs=' + firstHs.slice(0, 4) : '';
  const firstName = (typeof ME.name === 'string' ? ME.name : 'User').split(' ')[0] || 'User';
  try {
  app.innerHTML = shell(`
    <div class="hero-card" style="margin-bottom:24px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
      <div><h1 style="margin-bottom:6px">Halo, ${esc(firstName)} 👋</h1>
      <p class="muted">Fokus Anda: ${ME.hs_focus.map((h) => `<span class="hs-code-chip">${String(h).replace(/^(\d{4})/, '$1.')}</span>`).join(' ') || '<span class="muted">belum diatur</span>'} di ${ME.target_countries.map((c) => flag(c) + ' ' + (CNAME[c] || c)).join(', ') || 'semua negara'}</p></div>
      <button class="btn btn-primary" onclick="location.hash='#/cari${hsQuery}'">${I.search} Cari buyer sekarang</button></div></div>
    <div class="grid grid-4" style="margin-bottom:24px">
      <div class="card card-compact metric-card"><div class="lbl">Buyer tersimpan</div><div class="numeric-lg">${fmtN(d.saved)}</div><div class="caption muted-3">di semua daftar</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Outreach terkirim</div><div class="numeric-lg">${fmtN(d.outreach.total || 0)}</div><div class="caption muted-3">${d.outreach.opened || 0} dibuka · ${d.outreach.replied || 0} dibalas</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Sedang negosiasi</div><div class="numeric-lg">${fmtN((pl.negotiating || 0) + (pl.qualified || 0) + (pl.winning || 0) + (pl.responded || 0))}</div><div class="caption muted-3">${pl.won || 0} deal tercapai 🎉</div></div>
      <div class="card card-compact metric-card"><div class="lbl">Notifikasi baru</div><div class="numeric-lg">${fmtN(d.alerts_unread)}</div><div class="caption"><a href="#/alerts">Lihat semua →</a></div></div>
    </div>
    <div class="card" id="comtrade-widget" style="margin-bottom:24px">
      <div class="card-header">
        <div><h3>🌐 Ekspor Indonesia (data resmi UN Comtrade)</h3>
        <span class="caption muted-3">Sumber: UN Comtrade+ · nilai FOB tahunan untuk HS fokus Anda</span></div>
        <span class="pill pill-info">Live</span>
      </div>
      <div id="comtrade-body"><div class="empty muted body-sm" style="padding:20px 12px"><span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px"></span>Memuat data UN Comtrade…</div></div>
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
    <div class="card"><div class="card-header"><h3>Rekomendasi buyer untuk Anda</h3><a class="btn btn-sm btn-ghost" href="#/cari${hsQuery}">Lihat semua →</a></div>
      ${d.recommendations.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Buyer</th><th>Negara</th><th>Industri</th><th class="r">Shipment 12 bln</th><th class="r">Volume 12 bln</th><th>Skor</th><th></th></tr></thead><tbody>
      ${d.recommendations.map((b) => `<tr class="clickable" onclick="location.hash='#/buyer/${b.id}'">
        <td><b>${esc(b.name)}</b>${b.has_indonesian_supplier ? '' : ' <span class="pill pill-success" title="Belum pernah impor dari Indonesia">Untapped</span>'}</td>
        <td>${flag(b.country)} ${esc(b.country_name)}</td><td class="muted">${esc(b.industry)}</td>
        <td class="r num">${fmtN(b.shipments_12mo)}</td><td class="r num">${fmtKg(b.volume_12mo_kg)}</td>
        <td>${scorePill(b.score, b.score_label)}</td>
        <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();saveToList(${b.id})">+ Simpan</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty"><div class="ic">🔎</div><h3>Belum ada rekomendasi</h3><p class="muted">Lengkapi HS fokus & negara target di onboarding.</p></div>'}</div>`);
  bindShell();
  // Load real UN Comtrade data for the user's first HS focus (async, non-blocking)
  (async () => {
    const body = document.getElementById('comtrade-body');
    if (!body) return;
    const hs = typeof firstHs === 'string' && firstHs.length >= 4 ? firstHs : null;
    if (!hs) { body.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px">Pilih HS focus di Settings agar data UN Comtrade muncul di sini.</div>'; return; }
    try {
      const r = await api('/api/comtrade/indonesia-exports?hs=' + encodeURIComponent(hs), { timeout: 20000 });
      if (!r || !r.ok || !Array.isArray(r.by_country) || !r.by_country.length) {
        body.innerHTML = `<div class="empty muted body-sm" style="padding:20px 12px">${esc(r?.message || 'Belum ada data Comtrade untuk HS ' + hs + '.')}</div>`;
        return;
      }
      const top = r.by_country.slice(0, 8);
      const max = top[0].value_usd || 1;
      const rows = top.map((c) => `
        <div style="display:grid;grid-template-columns:170px 1fr 110px;gap:12px;align-items:center;margin-bottom:8px">
          <span class="body-sm"><span style="font-size:16px">${c.flag || '🏳️'}</span> ${esc(c.name)}</span>
          <div class="progressbar"><div style="width:${(c.value_usd / max) * 100}%"></div></div>
          <b class="num body-sm" style="text-align:right">${fmtUSD(c.value_usd)}</b>
        </div>`).join('');
      body.innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px">
          <div><div class="caption muted-3">HS ${esc(hs)}</div><b class="num">${esc(String(r.year))}</b></div>
          <div><div class="caption muted-3">Total nilai ekspor</div><b class="num" style="color:var(--orange)">${fmtUSD(r.total_value_usd)}</b></div>
          <div><div class="caption muted-3">Volume</div><b class="num">${fmtKg(r.total_net_wgt_kg)}</b></div>
          <div><div class="caption muted-3">Negara tujuan</div><b class="num">${r.by_country.length}</b></div>
        </div>
        ${rows}
        <p class="caption muted-3" style="margin-top:12px">Menampilkan Top 8 dari ${r.by_country.length} negara tujuan · Data cached 24 jam</p>`;
    } catch (e) {
      body.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px">Gagal muat data UN Comtrade. Coba refresh dashboard.</div>';
    }
  })();
  } catch (renderErr) {
    console.error('[eksporin] dashboard render failed:', renderErr);
    // Fallback minimal dashboard so user is never stuck on error page
    try {
      app.innerHTML = shell(`<div class="hero-card" style="margin-bottom:24px"><h1 style="margin-bottom:6px">Halo, ${esc(firstName)} 👋</h1>
        <p class="muted">Dashboard sedang dimuat. Beberapa data belum tersedia.</p>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="location.hash='#/discover'">${I.ai || ''} AI Find Buyer</button>
          <button class="btn btn-secondary" onclick="location.hash='#/cari${hsQuery}'">${I.search || ''} Cari buyer</button>
          <button class="btn btn-neutral" onclick="location.reload()">Muat ulang</button>
        </div></div>`);
      bindShell();
    } catch {}
  }
});

// ================= AI Buyer Discovery Engine =================
route(/^\/discover$/, async (app) => {
  await requireMe();
  let loading = false;
  let result = null;
  let pipelineStep = 0;

  const PIPELINE = [
    { icon: '🧠', name: 'Input Interpretation & HS Mapping', desc: 'LLM memetakan input ke HS Code 6-digit, sinonim kargo internasional, dan target industri buyer.' },
    { icon: '🚢', name: 'Trade Records & Company Retrieval', desc: 'Query database B/L (US Customs feeds) untuk mengambil daftar entitas importir (Consignee).' },
    { icon: '👤', name: 'Decision Maker Enrichment', desc: 'Hit API enrichment untuk mencari PIC dengan jabatan relevan (Procurement, Sourcing, Supply Chain).' },
    { icon: '🎯', name: 'Scoring & Final Synthesis', desc: 'LLM memberikan Match Score (0-100) dan Outreach Angle yang dipersonalisasi.' },
  ];

  const draw = () => {
    app.innerHTML = shell(`
      <!-- Hero search card -->
      <div class="hero-card" style="margin-bottom:24px">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="width:52px;height:52px;border-radius:16px;background:var(--orange);display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div style="flex:1">
            <h1 style="margin-bottom:4px;letter-spacing:-.02em">AI Buyer <span class="serif-italic">Discovery</span> Engine</h1>
            <p class="muted body-sm">Deskripsikan komoditas ekspor Anda. AI akan menjalankan pipeline 4-step: HS mapping, trade retrieval, contact enrichment, dan lead scoring.</p>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <input class="input" id="ai-query" placeholder="Contoh: Vanili polong kering grade A untuk ekspor…" style="flex:1;font-size:15px;padding:12px 18px;border-radius:var(--radius-full)" value="">
          <button class="btn btn-primary btn-lg" id="ai-go" style="padding:12px 28px" ${loading ? 'disabled' : ''}>${loading ? '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:6px"></span> Menganalisis...' : I.search + ' Cari Buyer'}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          ${['Vanili polong kering grade A', 'Kopi arabica Gayo', 'Udang vannamei beku', 'Furnitur jati Jepara', 'Lada hitam Muntok', 'Minyak kelapa mentah', 'Kayu manis cassia', 'Kakao biji fermentasi'].map((s) => `<button class="btn btn-sm btn-neutral ai-suggest" style="border-radius:var(--radius-full)">${s}</button>`).join('')}
        </div>
      </div>

      ${loading ? `
      <!-- Pipeline progress animation -->
      <div class="card" style="margin-bottom:20px">
        <h3 style="margin-bottom:16px">Pipeline sedang berjalan...</h3>
        <div class="pipeline-steps">
          ${PIPELINE.map((p, i) => `
            <div class="pipeline-step ${i < pipelineStep ? 'done' : i === pipelineStep ? 'active' : ''}">
              <div class="step-num">${i < pipelineStep ? '✓' : i + 1}</div>
              <div class="caption" style="font-weight:600">${esc(p.name.split(' & ')[0])}</div>
              <div class="caption muted-3" style="margin-top:4px">${i < pipelineStep ? 'Selesai' : i === pipelineStep ? 'Memproses...' : 'Menunggu'}</div>
              ${i < 3 ? '<div class="pipeline-connector"></div>' : ''}
            </div>`).join('')}
        </div>
      </div>` : ''}

      ${result ? renderDiscoverResult(result) : !loading ? `
      <!-- 4-step pipeline explanation cards -->
      <div class="grid grid-4" style="margin-bottom:24px">
        ${PIPELINE.map((p, i) => `
          <div class="card card-compact" style="text-align:center">
            <div style="font-size:28px;margin-bottom:8px">${p.icon}</div>
            <div style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--orange-light);color:var(--orange);font-size:13px;font-weight:700;margin-bottom:6px">${i + 1}</div>
            <h4 style="margin-bottom:6px">${esc(p.name)}</h4>
            <p class="muted body-sm">${esc(p.desc)}</p>
          </div>`).join('')}
      </div>
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">🔍</div>
        <h2 style="margin-bottom:8px">Mulai Pencarian Buyer</h2>
        <p class="muted" style="max-width:480px;margin:0 auto">Masukkan deskripsi komoditas di atas, bahasa Indonesia atau Inggris. AI akan otomatis memetakan ke HS code dan menemukan buyer aktif.</p>
      </div>` : ''}`);
    bindShell();

    $('#ai-go')?.addEventListener('click', runDiscover);
    $('#ai-query')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runDiscover(); });
    $$('.ai-suggest').forEach((el) => el.addEventListener('click', () => {
      if ($('#ai-query')) { $('#ai-query').value = el.textContent; runDiscover(); }
    }));
  };

  const runDiscover = async () => {
    const q = $('#ai-query')?.value?.trim();
    if (!q) return toast('Masukkan deskripsi produk', true);
    loading = true; result = null; pipelineStep = 0; draw();
    // Simulate pipeline steps
    const stepTimer = setInterval(() => { if (pipelineStep < 3) { pipelineStep++; draw(); } }, 800);
    try {
      result = await api('/api/discover', { method: 'POST', body: { query: q } });
    } catch (e) {
      toast(e.data?.error || 'Gagal menjalankan discovery', true);
    }
    clearInterval(stepTimer);
    loading = false; draw();
  };
  draw();
});

function renderDiscoverResult(r) {
  const interp = r.interpretation;
  return `
    <!-- Pipeline completed -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Pipeline Execution</h3><span class="pill pill-success">4/4 Selesai</span></div>
      <div class="pipeline-steps" style="margin-top:12px">
        ${r.pipeline_steps.map((s, i) => `
          <div class="pipeline-step done">
            <div class="step-num">✓</div>
            <div class="caption" style="font-weight:600">${esc(s.name)}</div>
            <div class="caption" style="margin-top:4px;color:var(--orange)">${esc(s.result)}</div>
            ${i < 3 ? '<div class="pipeline-connector" style="background:var(--success-text)"></div>' : ''}
          </div>`).join('')}
      </div>
    </div>

    <!-- Interpretation + Summary -->
    <div class="grid grid-2" style="margin-bottom:16px">
      <div class="card">
        <h3 style="margin-bottom:14px">Interpretasi AI</h3>
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px">
          <div><div class="caption muted-3">HS Code</div><span class="hs-code-chip" style="font-size:16px;margin-top:4px;display:inline-block">${esc(interp.hs_code_6_digit)}</span></div>
          <div style="flex:1"><div class="caption muted-3">Deskripsi</div><b style="margin-top:4px;display:inline-block">${esc(interp.hs_code_description)}</b></div>
        </div>
        <div style="margin-bottom:10px"><div class="caption muted-3" style="margin-bottom:4px">Target Industri</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${interp.target_industry_segments.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div></div>
        <div style="margin-bottom:10px"><div class="caption muted-3" style="margin-bottom:4px">Jabatan PIC Target</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${interp.buyer_job_titles_to_target.map((s) => `<span class="pill pill-orange">${esc(s)}</span>`).join('')}</div></div>
        ${interp.trade_manifest_keywords?.length ? `<div><div class="caption muted-3" style="margin-bottom:4px">Kata Kunci Kargo B/L</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${interp.trade_manifest_keywords.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div></div>` : ''}
      </div>
      <div class="card">
        <h3 style="margin-bottom:14px">Ringkasan Pencarian</h3>
        <div class="grid grid-2" style="gap:12px">
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg" style="color:var(--orange)">${r.total_leads}</div><div class="caption muted">Total Leads</div></div>
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg" style="color:var(--danger-text)">${r.leads.filter((l) => l.scoring.match_score >= 60).length}</div><div class="caption muted">Hot/Warm</div></div>
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg" style="color:var(--success-text)">${r.leads.reduce((a, l) => a + l.decision_makers.length, 0)}</div><div class="caption muted">Kontak</div></div>
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg">${new Set(r.leads.map((l) => l.company.country)).size}</div><div class="caption muted">Negara</div></div>
        </div>
      </div>
    </div>

    <!-- Leads -->
    <div class="card">
      <div class="card-header"><h3>Leads Siap Eksekusi</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="caption muted">${r.total_leads} buyer ditemukan</span>
          ${r.leads.length ? `<button class="btn btn-sm btn-primary" onclick="batchSaveLeads([${r.leads.map((l) => l.company.id).join(',')}])">Simpan semua</button>` : ''}
        </div></div>
      <div id="leads-list">${r.leads.map((lead) => `
        <div class="lead-card ${lead.scoring.match_score >= 80 ? 'hot' : lead.scoring.match_score >= 60 ? 'warm' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
            <div style="flex:1;min-width:280px">
              <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
                <span style="width:28px;height:28px;border-radius:50%;background:var(--bg-surface-alt);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--text-secondary)">${lead.rank}</span>
                <h3 style="margin:0"><a href="#/buyer/${lead.company.id}" style="color:inherit">${esc(lead.company.name)}</a></h3>
                ${scorePill(lead.scoring.match_score, lead.scoring.score_label)}
                ${!lead.trade_data.has_indonesian_supplier ? '<span class="pill pill-success">Untapped</span>' : ''}
              </div>
              <p class="muted body-sm">${flag(lead.company.country)} ${esc(lead.company.country_name)} · ${esc(lead.company.city || '')} · ${esc(lead.company.industry || '')} · ${esc(lead.company.company_tier)}</p>
              <div style="display:flex;gap:20px;margin-top:12px;flex-wrap:wrap">
                <div><span class="caption muted-3">Shipment/tahun</span><br><b class="num">${fmtN(lead.trade_data.shipments_12mo)}</b></div>
                <div><span class="caption muted-3">Volume 12 bln</span><br><b class="num">${fmtKg(lead.trade_data.volume_12mo_kg)}</b></div>
                <div><span class="caption muted-3">Nilai 12 bln</span><br><b class="num">${fmtUSD(lead.trade_data.value_12mo_usd)}</b></div>
                <div><span class="caption muted-3">Growth YoY</span><br><b class="num" style="color:${(lead.trade_data.yoy_percent || 0) >= 0 ? 'var(--success-text)' : 'var(--danger-text)'}">${(lead.trade_data.yoy_percent || 0) >= 0 ? '↑' : '↓'} ${Math.abs(lead.trade_data.yoy_percent || 0)}%</b></div>
              </div>
            </div>
            <div style="min-width:280px">
              <div class="caption muted-3" style="margin-bottom:6px">Decision Makers</div>
              ${lead.decision_makers.map((dm) => `
                <div style="padding:8px 0;border-bottom:1px dotted var(--border-subtle)">
                  <b class="body-sm">${esc(dm.full_name)}</b> <span class="caption muted">· ${esc(dm.job_title)}</span>
                  <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap">
                    ${dm.email ? `<span class="caption" title="${dm.email_status}">✉️ ${esc(dm.email)} ${dm.email_status === 'verified' ? '<span class="pill pill-success" style="font-size:9px">verified</span>' : ''}</span>` : ''}
                    ${dm.linkedin_url ? `<a class="caption" href="${esc(dm.linkedin_url)}" target="_blank" style="color:var(--orange)">LinkedIn</a>` : ''}
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <div class="lead-pitch">
            <div class="caption muted-3" style="margin-bottom:4px">Outreach Angle</div>
            <p class="body-sm" style="line-height:20px;margin:0">${esc(lead.scoring.customized_pitch_angle)}</p>
          </div>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn btn-primary btn-sm" onclick="location.hash='#/buyer/${lead.company.id}'">Lihat Profil</button>
            <button class="btn btn-secondary btn-sm" onclick="saveToList(${lead.company.id})">+ Simpan</button>
            <button class="btn btn-neutral btn-sm" onclick="composeTo(${lead.company.id})">Kirim Outreach</button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
}

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
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div>
        <h1 style="margin-bottom:4px">Direktori HS Code</h1>
        <p class="muted">Telusuri kategori produk. Data ekspor real diambil langsung dari <b>UN Comtrade+</b>.</p>
      </div>
      <span class="pill pill-info" style="align-self:center">🌐 Live UN Comtrade</span>
    </div>
    ${crumb}
    <div class="hs-grid">${nodes.map((n) => `
      <div class="hs-card" data-code="${n.code}" data-level="${n.level}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <span class="hs-code-chip">${n.code.replace(/^(\d{4})/, '$1.')}</span>
          <span class="caption muted-3" data-comtrade-badge>Level ${n.level === 2 ? 'Bab' : n.level === 4 ? 'Heading' : 'Sub'}</span></div>
        <h3 style="margin-bottom:2px">${esc(n.description_id)}</h3>
        <p class="caption muted" style="margin-bottom:12px">${esc(n.description_en)}</p>
        <div class="hs-stats" data-comtrade-stats>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div><div class="caption muted-3">Nilai ekspor</div><b class="num" data-slot="value"><span class="skeleton" style="display:inline-block;width:60px;height:12px;border-radius:6px"></span></b></div>
            <div><div class="caption muted-3">Volume</div><b class="num" data-slot="volume"><span class="skeleton" style="display:inline-block;width:52px;height:12px;border-radius:6px"></span></b></div>
            <div><div class="caption muted-3">Negara tujuan</div><b class="num" data-slot="countries"><span class="skeleton" style="display:inline-block;width:24px;height:12px;border-radius:6px"></span></b></div>
          </div>
          <div style="margin-top:8px"><div class="caption muted-3">Top pasar</div><b data-slot="top">…</b></div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-subtle)" data-usitc>
            <div class="caption muted-3">🇺🇸 Bea masuk USA (USITC HTS)</div>
            <b class="num body-sm" data-slot="usitc"><span class="skeleton" style="display:inline-block;width:80px;height:12px;border-radius:6px"></span></b>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          ${n.level < 6 ? `<button class="btn btn-sm btn-neutral drill">Drill-down →</button>` : ''}
          <button class="btn btn-sm btn-primary see">Lihat buyer</button></div>
      </div>`).join('')}</div>`);
  bindShell();
  $$('.hs-card').forEach((el) => {
    el.querySelector('.drill')?.addEventListener('click', (e) => { e.stopPropagation(); location.hash = `#/direktori?parent=${el.dataset.code}`; });
    el.querySelector('.see')?.addEventListener('click', (e) => { e.stopPropagation(); location.hash = `#/cari?hs=${el.dataset.code}`; });
    el.addEventListener('click', () => { location.hash = el.dataset.level < 6 ? `#/direktori?parent=${el.dataset.code}` : `#/cari?hs=${el.dataset.code}`; });
  });

  // Progressively enrich each visible card with real UN Comtrade data.
  // We throttle concurrent requests (max 3 in flight) to be gentle on the API.
  const queue = [...document.querySelectorAll('.hs-card')];
  let inFlight = 0;
  const enrich = async (el) => {
    const code = el.dataset.code;
    const stats = el.querySelector('[data-comtrade-stats]');
    const badge = el.querySelector('[data-comtrade-badge]');
    const seeBtn = el.querySelector('.see');
    const usitcSlot = stats?.querySelector('[data-slot="usitc"]');
    // Fetch Comtrade and USITC in parallel — they're independent.
    const [comtrade, usitc] = await Promise.allSettled([
      api('/api/comtrade/indonesia-exports?hs=' + encodeURIComponent(code), { timeout: 20000 }),
      api('/api/usitc/hts?hs=' + encodeURIComponent(code), { timeout: 15000 }),
    ]);
    // Comtrade rendering
    try {
      const r = comtrade.status === 'fulfilled' ? comtrade.value : null;
      if (!r || !r.ok || !Array.isArray(r.by_country) || !r.by_country.length) {
        stats.querySelector('[data-slot="value"]').textContent = '-';
        stats.querySelector('[data-slot="volume"]').textContent = '-';
        stats.querySelector('[data-slot="countries"]').textContent = '-';
        stats.querySelector('[data-slot="top"]').innerHTML = '<span class="muted-3">Belum ada data</span>';
      } else {
        stats.querySelector('[data-slot="value"]').innerHTML = `<span style="color:var(--orange)">${fmtUSD(r.total_value_usd)}</span>`;
        stats.querySelector('[data-slot="volume"]').textContent = fmtKg(r.total_net_wgt_kg);
        stats.querySelector('[data-slot="countries"]').textContent = r.by_country.length;
        const top5 = r.by_country.slice(0, 5).map((c) => `<span title="${esc(c.name)}: ${fmtUSD(c.value_usd)}" style="font-size:16px">${c.flag || '🏳️'}</span>`).join(' ');
        stats.querySelector('[data-slot="top"]').innerHTML = top5;
        if (badge) badge.innerHTML = `🌐 <span style="color:var(--success-text)">${r.year}</span>`;
        if (seeBtn) seeBtn.textContent = `Lihat buyer (${r.by_country.length}+ negara)`;
      }
    } catch (e) { /* ignore */ }
    // USITC rendering — official US import duty rate
    try {
      if (!usitcSlot) return;
      const u = usitc.status === 'fulfilled' ? usitc.value : null;
      if (!u || !u.ok || !u.summary) {
        usitcSlot.innerHTML = '<span class="muted-3">Belum ada data tarif</span>';
        return;
      }
      const rate = u.summary.general_rate || 'Free';
      const isFree = /^\s*free\s*$/i.test(rate);
      const rateColor = isFree ? 'var(--success-text)' : 'var(--warning-text)';
      const special = u.summary.special_rate ? ` <span class="caption muted-3" title="${esc(u.summary.special_rate)}">· ada special rate</span>` : '';
      usitcSlot.innerHTML = `<span style="color:${rateColor}">${esc(rate)}</span> <span class="caption muted-3" title="${esc(u.summary.description || '')}">${esc(u.summary.htsno || '')}</span>${special}`;
    } catch (e) { if (usitcSlot) usitcSlot.innerHTML = '<span class="muted-3">Tarif belum tersedia</span>'; }
  };
  const pump = async () => {
    while (queue.length && inFlight < 3) {
      inFlight++;
      const el = queue.shift();
      enrich(el).finally(() => { inFlight--; pump(); });
    }
  };
  pump();
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
        ${ME.plan === 'free' && d.total > 20 ? '<div class="banner banner-warning">🔒 Paket Free menampilkan detail 20 buyer teratas. Baris selanjutnya diblur. <a href="#/billing">Upgrade</a></div>' : ''}
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
      ${lists.map((l) => `<option value="${l.id}">${esc(l.name)} (${l.buyer_count})</option>`).join('')}</select></div>` : '<p class="muted body-sm" style="margin-bottom:12px">Anda belum punya daftar, buat dulu di bawah.</p>'}
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

window.batchSaveLeads = async (buyerIds) => {
  const lists = await api('/api/lists');
  modal(`<h2 style="margin-bottom:16px">Simpan ${buyerIds.length} buyer ke daftar</h2>
    ${lists.length ? `<div class="field"><label>Pilih daftar</label><select class="input" id="sl-list">
      ${lists.map((l) => `<option value="${l.id}">${esc(l.name)} (${l.buyer_count})</option>`).join('')}</select></div>` : '<p class="muted body-sm" style="margin-bottom:12px">Anda belum punya daftar, buat dulu di bawah.</p>'}
    <div class="field"><label>Atau buat daftar baru</label><input class="input" id="sl-new" placeholder="mis. Leads Vanili Discovery"></div>
    <button class="btn btn-primary" id="sl-save" style="width:100%">Simpan ${buyerIds.length} buyer</button>`);
  $('#sl-save').onclick = async () => {
    try {
      let listId = $('#sl-list')?.value;
      const newName = $('#sl-new').value.trim();
      if (newName) { const nl = await api('/api/lists', { method: 'POST', body: { name: newName } }); listId = nl.id; }
      if (!listId) return toast('Pilih atau buat daftar dulu', true);
      let saved = 0;
      for (const bid of buyerIds) {
        try { await api(`/api/lists/${listId}/buyers`, { method: 'POST', body: { buyer_id: bid } }); saved++; }
        catch (e) { if (e.status === 402) { toast(e.data?.error || 'Kuota simpan habis', true); break; } }
      }
      closeModal(); toast(`${saved} buyer berhasil disimpan`);
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
          ${b.has_indonesian_supplier ? '<span class="pill pill-info">Pernah impor dari 🇮🇩</span>' : '<span class="pill pill-success">Untapped, belum dari 🇮🇩</span>'}</div>
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
      <div class="card"><h3 style="margin-bottom:14px">Skor EksporIn: komponen</h3>${scoreBars(b.score_components)}
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
    body.innerHTML = `<div class="banner banner-info">💡 Pemasok 🇮🇩 Indonesia adalah <b>kompetitor langsung Anda</b>. Pelajari volume & HS code mereka.</div>
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
      <p class="muted" style="margin-bottom:20px">Telusuri data bill of lading lintas buyer untuk analisis mendalam & intel kompetitor.</p>
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
        <td class="body-sm">${{ low: 'Rendah', medium: 'Sedang', high: '<b style="color:var(--warning-text)">Tinggi</b>', urgent: '<b style="color:var(--danger-text)">Urgent</b>' }[b.priority] || '-'}</td>
        <td>${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</td>
        <td class="r">${scorePill(b.score, b.score_label)}</td>
        <td class="caption num">${b.reminder_at ? '⏰ ' + fmtDate(b.reminder_at) : '-'}</td>
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
      <div class="field"><label>Isi pesan untuk ${esc(prev.buyer_name)}${ids.length > 1 ? ` (+${ids.length - 1} buyer lain, variabel otomatis per buyer)` : ''}</label>
      <div class="input" style="height:auto;white-space:pre-wrap;background:var(--bg-surface-alt);max-height:260px;overflow-y:auto">${esc(prev.body)}</div></div>
      <p class="caption ${prev.contacts_visible ? 'muted' : ''}" style="margin-bottom:12px">
        ${prev.to_email ? `📧 Tujuan: <b>${esc(prev.to_email)}</b>` : '📧 Email buyer belum tersedia. Gunakan mode salin.'}
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

// ================= settings & profile =================
route(/^\/settings$/, async (app) => {
  await requireMe();
  const COUNTRY_OPTS = ['US', 'JP', 'NL', 'AE', 'AU'];
  const COUNTRY_LABEL = { US: '🇺🇸 Amerika Serikat', JP: '🇯🇵 Jepang', NL: '🇳🇱 Belanda', AE: '🇦🇪 Uni Emirat Arab', AU: '🇦🇺 Australia' };
  const STATUS_OPTS = [
    ['never', 'Belum pernah ekspor', 'Sedang mempersiapkan ekspor pertama'],
    ['occasional', 'Pernah beberapa kali', 'Sudah 1–5 kali ekspor, biasanya via broker'],
    ['regular', 'Rutin ekspor', 'Ekspor berkala ke satu atau lebih negara'],
  ];
  const GOAL_OPTS = [
    ['find_buyers', 'Cari buyer baru', 'Temukan & hubungi importir potensial'],
    ['market_analysis', 'Analisis pasar', 'Pahami tren demand & harga per negara'],
    ['competitor_intel', 'Intel kompetitor', 'Lihat ke mana kompetitor mengekspor'],
  ];

  // Load HS leaf codes (with fallback so the page still works if backend is slow)
  let leaves;
  try { leaves = await api('/api/hs/leaf', { timeout: 15000 }); } catch { leaves = FALLBACK_HS_LEAVES; }
  if (!Array.isArray(leaves) || !leaves.length) leaves = FALLBACK_HS_LEAVES;

  const state = {
    name: ME.name || '',
    org: ME.org_name || '',
    hs: Array.isArray(ME.hs_focus) ? [...ME.hs_focus] : [],
    countries: Array.isArray(ME.target_countries) ? [...ME.target_countries] : [],
    export_status: ME.export_status || null,
    goal: ME.goal || null,
  };

  const draw = () => {
    app.innerHTML = shell(`
      <h1 style="margin-bottom:6px">Settings & Profile</h1>
      <p class="muted" style="margin-bottom:24px">Ubah preferensi onboarding kapan saja. Perubahan akan langsung mempengaruhi rekomendasi buyer & alert.</p>

      <div class="grid grid-2" style="align-items:start">
        <div class="card">
          <h3 style="margin-bottom:16px">Profil Anda</h3>
          <div class="field">
            <label>Nama lengkap</label>
            <input class="input" id="s-name" value="${esc(state.name)}" placeholder="Nama lengkap Anda">
          </div>
          <div class="field">
            <label>Nama usaha</label>
            <input class="input" id="s-org" value="${esc(state.org)}" placeholder="PT / CV / UD nama usaha">
          </div>
          <div class="field">
            <label>Email</label>
            <input class="input" value="${esc(ME.email || '')}" disabled style="background:var(--bg-surface-alt)">
            <div class="help">Email tidak bisa diubah. Hubungi support kalau perlu ganti.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-bottom:16px">Status ekspor Anda</h3>
          ${STATUS_OPTS.map(([v, t, d]) => `
            <div class="option-card ${state.export_status === v ? 'selected' : ''}" data-status="${v}">
              <div><b>${t}</b><div class="caption muted">${d}</div></div>
            </div>`).join('')}

          <h3 style="margin:24px 0 16px">Tujuan utama</h3>
          ${GOAL_OPTS.map(([v, t, d]) => `
            <div class="option-card ${state.goal === v ? 'selected' : ''}" data-goal="${v}">
              <div><b>${t}</b><div class="caption muted">${d}</div></div>
            </div>`).join('')}
        </div>

        <div class="card" style="grid-column:1/-1">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">
            <h3>Produk yang Anda ekspor</h3>
            <span class="caption muted">${state.hs.length} / 5 dipilih</span>
          </div>
          <p class="muted body-sm" style="margin-bottom:14px">Pilih 1–5 kode HS. Ini menentukan rekomendasi & alert Anda.</p>
          <div style="max-height:320px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
            ${leaves.map((l) => `
              <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}" style="margin-bottom:0">
                <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span>
                <div><b>${esc(l.description_id)}</b><div class="caption muted">${esc(l.description_en)}</div></div>
              </div>`).join('')}
          </div>
        </div>

        <div class="card" style="grid-column:1/-1">
          <h3 style="margin-bottom:12px">Negara target</h3>
          <p class="muted body-sm" style="margin-bottom:14px">Pilih pasar yang ingin Anda masuki (boleh lebih dari satu).</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${COUNTRY_OPTS.map((c) => `
              <div class="option-card ${state.countries.includes(c) ? 'selected' : ''}" data-country="${c}" style="margin-bottom:0">
                <b>${COUNTRY_LABEL[c]}</b>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:24px;position:sticky;bottom:16px">
        <button class="btn btn-neutral" id="s-reset">Batal perubahan</button>
        <button class="btn btn-primary" id="s-save">Simpan preferensi</button>
      </div>
    `);
    bindShell();

    // Bind interactions
    $('#s-name').oninput = (e) => { state.name = e.target.value; };
    $('#s-org').oninput = (e) => { state.org = e.target.value; };
    $$('.option-card[data-status]').forEach((el) => el.onclick = () => { state.export_status = el.dataset.status; draw(); });
    $$('.option-card[data-goal]').forEach((el) => el.onclick = () => { state.goal = el.dataset.goal; draw(); });
    $$('.option-card[data-country]').forEach((el) => el.onclick = () => {
      const c = el.dataset.country;
      state.countries = state.countries.includes(c) ? state.countries.filter((x) => x !== c) : [...state.countries, c];
      draw();
    });
    $$('.option-card[data-hs]').forEach((el) => el.onclick = () => {
      const c = el.dataset.hs;
      if (state.hs.includes(c)) state.hs = state.hs.filter((x) => x !== c);
      else if (state.hs.length < 5) state.hs = [...state.hs, c];
      else return toast('Maksimal 5 kode HS. Hapus salah satu dulu.', true);
      draw();
    });
    $('#s-reset').onclick = () => {
      state.name = ME.name || '';
      state.org = ME.org_name || '';
      state.hs = Array.isArray(ME.hs_focus) ? [...ME.hs_focus] : [];
      state.countries = Array.isArray(ME.target_countries) ? [...ME.target_countries] : [];
      state.export_status = ME.export_status || null;
      state.goal = ME.goal || null;
      draw();
      toast('Perubahan dibatalkan.');
    };
    $('#s-save').onclick = async () => {
      const btn = $('#s-save');
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Menyimpan…';
      const payload = {
        hs_focus: state.hs, target_countries: state.countries,
        export_status: state.export_status, goal: state.goal,
        org_name: state.org || null,
      };
      let sbSaved = false, localSaved = false;
      if (window.sb) {
        try {
          const { data: sess } = await window.sb.auth.getSession();
          const sbUser = sess && sess.session && sess.session.user;
          if (sbUser) {
            const { error } = await window.sb.from('profiles').upsert({
              id: sbUser.id, email: sbUser.email,
              name: state.name || null,
              org_name: state.org || null,
              hs_focus: state.hs, target_countries: state.countries,
              export_status: state.export_status, goal: state.goal,
              onboarded: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
            if (!error) sbSaved = true;
          }
        } catch (e) { console.warn('[settings] SB upsert:', e); }
      }
      try {
        await api('/api/me/onboarding', { method: 'POST', body: payload });
        localSaved = true;
      } catch (e) { console.warn('[settings] Local save:', e); }
      if (sbSaved) { try { await syncSupabaseSession(); } catch {} }
      if (ME) {
        ME.name = state.name || ME.name;
        ME.org_name = state.org || null;
        ME.hs_focus = state.hs;
        ME.target_countries = state.countries;
        ME.export_status = state.export_status;
        ME.goal = state.goal;
      }
      btn.disabled = false;
      btn.textContent = originalLabel;
      if (sbSaved || localSaved) toast('Preferensi tersimpan ✓');
      else toast('Gagal menyimpan sepenuhnya. Coba lagi.', true);
    };
  };
  draw();
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
        <div class="caption muted-3" style="margin-top:6px">${p.price ? 'Metode: Sumopod QRIS (scan pakai apa saja: GoPay, OVO, DANA, ShopeePay, m-Banking)' : 'Turun ke paket gratis (fitur premium dinonaktifkan)'}</div></div>
      <button class="btn btn-primary" id="pay-now" style="width:100%">${p.price ? 'Bayar sekarang via QRIS' : 'Ganti ke Free'}</button>`);
    $('#pay-now').onclick = async () => {
      const btn = $('#pay-now');
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = 'Menyiapkan…';
      try {
        if (!p.price) {
          // Free downgrade — no payment needed
          await api('/api/me/plan', { method: 'POST', body: { plan: code } });
          closeModal(); toast('Paket Free aktif.');
          ME = null; render();
          return;
        }
        // Create Sumopod payment
        const r = await api('/api/billing/checkout', { method: 'POST', body: { plan: code, method: 'QRIS' } });
        if (!r.payment_url) {
          throw new Error('Sumopod tidak mengembalikan URL pembayaran.');
        }
        // Remember what plan we're paying for, so on return we can auto-verify
        try { localStorage.setItem('eksporin_pending_payment', JSON.stringify({ order_id: r.order_id, plan: code, amount: r.amount, at: String(Date.now()) })); } catch {}
        closeModal();
        toast('Mengarahkan ke halaman pembayaran QRIS Sumopod…');
        // Redirect user to Sumopod hosted checkout
        window.location.href = r.payment_url;
      } catch (e) {
        console.error('[billing] checkout failed:', e);
        btn.disabled = false; btn.textContent = orig;
        toast(e.data?.error || e.message || 'Gagal membuat pembayaran.', true);
      }
    };
  });
  // Auto-verify: if the user just returned from Sumopod checkout, poll the verify endpoint.
  (async () => {
    try {
      const raw = localStorage.getItem('eksporin_pending_payment');
      if (!raw) return;
      const p = JSON.parse(raw);
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      const cameBack = params.get('paid') === '1' || params.get('order') === p.order_id;
      if (!cameBack) return;
      toast('Memverifikasi pembayaran…');
      // Poll a few times in case Sumopod webhook is still catching up
      for (let i = 0; i < 6; i++) {
        try {
          const v = await api('/api/billing/verify', { method: 'POST', body: { order_id: p.order_id, plan: p.plan } });
          if (v.paid) {
            try { localStorage.removeItem('eksporin_pending_payment'); } catch {}
            toast(`Pembayaran sukses. Paket ${p.plan} aktif ✓`);
            ME = null; render();
            return;
          }
        } catch (e) { console.warn('[billing] verify attempt failed:', e); }
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast('Pembayaran belum terkonfirmasi. Refresh halaman ini kalau QRIS-nya sudah dibayar.', true);
    } catch {}
  })();
});

// boot: if a Supabase session exists in localStorage (returning user),
// sync it to the local backend BEFORE the router runs so protected APIs work.
async function boot() {
  // Sumopod payment callback: return URL comes back as `/?paid=1&order=X&plan=Y`
  // (Sumopod strips hash fragments). Forward those query params into the SPA
  // hash router at #/billing so the verify-and-poll flow picks them up.
  if (window.location.search) {
    const q = new URLSearchParams(window.location.search);
    if (q.get('paid') === '1' || q.get('cancelled') === '1') {
      const hashParams = new URLSearchParams();
      for (const k of ['paid', 'cancelled', 'order', 'plan']) if (q.get(k)) hashParams.set(k, q.get(k));
      window.history.replaceState(null, '', window.location.pathname + '#/billing?' + hashParams.toString());
    }
  }
  await syncSupabaseSession();
  render();
}
boot();
