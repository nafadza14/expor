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
const flag = (c) => FLAG[c] || (/^[A-Z]{2}$/.test(String(c || '')) ? String.fromCodePoint(...[...String(c)].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '🌐');
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
  // EksporIn mark "Kawung Keluar": four kawung (batik) petals, the north-east one steps outward.
  logoW: '<svg viewBox="44 44 168 168" width="22" height="22" aria-hidden="true"><path fill="#fff" d="M111.51 127.51A43.77 43.77 0 0 1 54.95 70.95A43.77 43.77 0 0 1 111.51 127.51ZM111.51 144.49A43.77 43.77 0 0 1 54.95 201.05A43.77 43.77 0 0 1 111.51 144.49ZM128.49 144.49A43.77 43.77 0 0 1 185.05 201.05A43.77 43.77 0 0 1 128.49 144.49ZM146.87 109.13A43.77 43.77 0 0 1 203.44 52.56A43.77 43.77 0 0 1 146.87 109.13Z"/></svg>',
  ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m23 18-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16M4 6h16M4 18h16"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>',
  spider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 8V2M12 22v-6M8 12H2M22 12h-6M6 6l4 4M18 6l-4 4M6 18l4-4M18 18l-4-4"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15.5 9.5c0-1.1-1.1-2-2.5-2h-2c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2h2c1.4 0 2.5.9 2.5 2s-1.1 2-2.5 2h-2c-1.4 0-2.5-.9-2.5-2"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
};

// EksporIn logo "Kawung Keluar" (orange). Masters + concepts: brand/concepts/.
const LOGO_SVG = `<svg viewBox="44 44 168 168" width="32" height="32" aria-hidden="true"><path fill="#ef4d23" d="M111.51 127.51A43.77 43.77 0 0 1 54.95 70.95A43.77 43.77 0 0 1 111.51 127.51ZM111.51 144.49A43.77 43.77 0 0 1 54.95 201.05A43.77 43.77 0 0 1 111.51 144.49ZM128.49 144.49A43.77 43.77 0 0 1 185.05 201.05A43.77 43.77 0 0 1 128.49 144.49ZM146.87 109.13A43.77 43.77 0 0 1 203.44 52.56A43.77 43.77 0 0 1 146.87 109.13Z"/></svg>`;

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
  // Prefer the stateless admin token when present. It survives Vercel
  // cold starts because verification is HMAC-only (no DB lookup), so an
  // admin session never gets kicked out mid-navigation.
  const adminToken = (() => { try { return localStorage.getItem('eksporin_admin_token'); } catch { return null; } })();
  if (adminToken) {
    headers['Authorization'] = 'Bearer ' + adminToken;
  } else {
    const tok = await currentSbToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
  }
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
      throw { status: res.status || 502, data: { error: 'API endpoint not reachable. Got HTML instead of JSON. Check Vercel routing.' } };
    }
    data = text;
  }
  if (res.status === 401 && !path.includes('/auth/')) {
    // If the admin token is present, the 401 is a transient backend blip
    // (Vercel cold start, edge routing, etc). Do NOT redirect. Callers can
    // catch and decide. This keeps the admin's tab-clicks from ever
    // yanking them back to a login page.
    const hasAdminToken = (() => { try { return !!localStorage.getItem('eksporin_admin_token'); } catch { return false; } })();
    if (!hasAdminToken && path !== '/api/me') location.hash = '#/login';
    throw { status: 401, data };
  }
  if (res.status === 402) { upgradeModal(data && data.error, data); throw { status: 402, data, handled: true }; }
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
function upgradeModal(msg, info) {
  const bal = info && typeof info.balance === 'number' ? info.balance : null;
  const need = info && info.needed ? Math.max(10000, Math.ceil(info.needed / 10000) * 10000) : 10000;
  modal(`<h2 style="margin-bottom:8px">${info && info.plan === 'expired' ? 'Paket tidak aktif' : 'Kuota habis'}</h2>
    <p class="muted" style="margin-bottom:${bal !== null ? 8 : 20}px">${esc(msg || 'Kuota paket Anda sudah habis.')}</p>
    ${bal !== null ? `<p class="body-sm" style="margin-bottom:20px">Saldo Anda: <b>${fmtIDR(bal)}</b></p>` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="closeModal();openTopup(${need})">Isi saldo</button>
      <button class="btn btn-upgrade" onclick="closeModal();location.hash='#/billing'">Lihat paket</button>
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
  const planPill = { trial: 'pill-neutral', hemat: 'pill-orange', growth: 'pill-success', business: 'pill-violet', expired: 'pill-danger' }[u.plan] || 'pill-neutral';
  const bal = u.billing ? fmtIDR(u.billing.balance) : '';
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
    ${['trial', 'hemat', 'expired'].includes(u.plan) ? `<div class="sidebar-cta"><h4>${u.plan === 'expired' ? 'Paket tidak aktif' : u.plan === 'trial' ? 'Masa trial' : 'Butuh lebih banyak kontak?'}</h4><p>${u.plan === 'expired' ? 'Beli paket mulai Rp14.000 atau isi saldo untuk lanjut.' : 'Growth: 150 kontak & 1.000 pencarian per 30 hari.'}</p><button class="btn" onclick="location.hash='#/billing'">Lihat paket</button></div>` : '<div style="margin-top:auto"></div>'}
  </aside>
  <div class="main">
    <header class="topbar">
      <button class="topbar-menu" id="topbar-menu" aria-label="Menu">${I.menu}</button>
      <div class="topbar-brand-mobile"><span class="logo" style="width:28px;height:28px;border-radius:8px;background:var(--orange);display:inline-flex;align-items:center;justify-content:center">${I.logoW}</span><span style="font-weight:700">EksporIn</span></div>
      <div class="search-wrap">${I.search}<input class="input" id="global-search" placeholder="Cari buyer atau HS code… (Enter)"></div>
      <div class="topbar-right">
        <a class="pill ${planPill} plan-pill" href="#/billing" id="plan-pill" title="Paket & saldo">${esc(u.plan_name || '')}${bal ? ' · ' + bal : ''}</a>
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
    // Plan and balance are server-side (billing). Show a neutral placeholder
    // until syncBilling() fills them in; never trust profile.plan.
    const plan = 'trial';
    return {
      id: sbUser.id,
      email: sbUser.email,
      name: profile.name || (sbUser.user_metadata && sbUser.user_metadata.name) || sbUser.email.split('@')[0],
      org_name: profile.org_name || null,
      plan,
      plan_name: 'Paket',
      onboarded: !!profile.onboarded,
      hs_focus: Array.isArray(profile.hs_focus) ? profile.hs_focus : [],
      target_countries: Array.isArray(profile.target_countries) ? profile.target_countries : [],
      export_status: profile.export_status || null,
      goal: profile.goal || null,
      quotas: {
        search: { used: 0, limit: null }, profile: { used: 0, limit: null }, contact: { used: 0, limit: null },
        find_contact: { used: 0, limit: null }, send: { used: 0, limit: null }, export: { used: 0, limit: null },
      },
      contacts_visible: true,
      saved: { used: 0, limit: null },
      unread_alerts: 0,
      _fromSupabase: true,
    };
  } catch (e) { console.warn('[eksporin] loadMeFromSupabase:', e); return null; }
}

// Pull plan, quotas and balance from the server (Supabase profile has none we trust).
let BILLING_SYNC = null;
function syncBilling() {
  if (BILLING_SYNC) return BILLING_SYNC;
  BILLING_SYNC = api('/api/me').then((m) => {
    if (!ME || !m) return;
    Object.assign(ME, { plan: m.plan, plan_name: m.plan_name, quotas: m.quotas, billing: m.billing, saved: m.saved, contacts_visible: m.contacts_visible });
    const pill = document.getElementById('plan-pill');
    if (pill && m.billing) pill.textContent = `${m.plan_name} · ${fmtIDR(m.billing.balance)}`;
  }).catch(() => {}).finally(() => { setTimeout(() => { BILLING_SYNC = null; }, 30000); });
  return BILLING_SYNC;
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
  if (ME._fromSupabase && !ME.billing) await Promise.race([syncBilling(), new Promise((r) => setTimeout(r, 2500))]);
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
  const FLOWER = `<svg class="flower-logo" viewBox="44 44 168 168" aria-hidden="true"><path fill="#ef4d23" d="M111.51 127.51A43.77 43.77 0 0 1 54.95 70.95A43.77 43.77 0 0 1 111.51 127.51ZM111.51 144.49A43.77 43.77 0 0 1 54.95 201.05A43.77 43.77 0 0 1 111.51 144.49ZM128.49 144.49A43.77 43.77 0 0 1 185.05 201.05A43.77 43.77 0 0 1 128.49 144.49ZM146.87 109.13A43.77 43.77 0 0 1 203.44 52.56A43.77 43.77 0 0 1 146.87 109.13Z"/></svg>`;
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
      <div class="landing-hero-bg" role="img" aria-label="Kapal kontainer berlayar di laut lepas"></div>
      <div class="landing-video-overlay"></div>
      <div class="landing-fg">
        <!-- Floating pill navbar -->
        <div class="pill-nav-wrap">
          <div class="pill-nav" id="pillNav">
            <div class="pill-logo">${FLOWER}<span>EksporIn</span></div>
            <div class="pill-nav-links">
              ${[['how', 'Cara kerja'], ['contoh', 'Contoh hasil'], ['pricing', 'Harga'], ['faq', 'FAQ']].map(([id, l]) => `<a href="javascript:void(0)" onclick="document.getElementById('${id}')?.scrollIntoView({behavior:'smooth'})">${l}</a>`).join('')}
            </div>
            <div class="pill-nav-right">
              <a href="#/login" class="pill-signin">Masuk</a>
              <a href="#/register" class="pill-cta">
                <span class="cta-full">Coba gratis</span><span class="cta-short">Coba</span>
                <span class="arrow-circle">${CHEVRON_RIGHT}</span>
              </a>
              <button class="pill-menu" onclick="document.getElementById('pillMenuPanel').classList.toggle('open')" aria-label="Menu">${MENU_ICON}</button>
            </div>
            <div class="pill-menu-panel" id="pillMenuPanel">
              ${[['how', 'Cara kerja'], ['contoh', 'Contoh hasil'], ['pricing', 'Harga'], ['faq', 'FAQ']].map(([id, l]) => `<a href="javascript:void(0)" onclick="document.getElementById('${id}')?.scrollIntoView({behavior:'smooth'});document.getElementById('pillMenuPanel').classList.remove('open')">${l}</a>`).join('')}
              <a href="#/login">Masuk</a>
              <a href="#/register">Coba gratis 3 hari</a>
              ${loggedIn ? '<a href="#/dashboard">Buka Dashboard</a>' : ''}
            </div>
          </div>
        </div>

        <!-- Hero content -->
        <div class="hero-content">
          <div class="hero-badge"><span class="dot"></span> Untuk eksportir & UKM Indonesia</div>
          <h1 class="hero-headline lp-h1">
            Temukan buyer luar negeri,<br><span class="serif-italic">lengkap dengan kontaknya</span>
          </h1>
          <p class="hero-sub lp-sub">Ketik produk Anda. EksporIn mencarikan importir, distributor, dan pabrik di 38 negara tujuan, menunjukkan email dan telepon yang bisa dihubungi, lalu membantu Anda menulis email penawaran dalam bahasa mereka.</p>

          <!-- Interactive commodity search demo (public try-before-signup) -->
          <div class="hero-try">
            <form class="hero-search" id="hero-try-form" onsubmit="return false" autocomplete="off">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input id="hero-try-input" type="text" placeholder="Produk Anda, misal: biji kakao, kopi robusta, vanili…" autocomplete="off" aria-label="Produk yang ingin diekspor">
              <button type="submit" id="hero-try-btn">Cari buyer</button>
            </form>
            <div class="lp-try-chips">
              <span>Coba:</span>
              ${['Kopi robusta', 'Biji kakao', 'Vanili', 'Udang beku', 'Minyak nilam', 'Rotan'].map((c) => `<a href="#/quick-search?q=${encodeURIComponent(c)}">${c}</a>`).join('')}
            </div>
          </div>
          <ul class="lp-trust">
            <li>✓ Trial 3 hari gratis</li><li>✓ Tanpa kartu kredit</li><li>✓ Tidak perlu tahu HS code</li><li>✓ Mulai Rp14.000/30 hari</li>
          </ul>
        </div>

        <!-- Product preview: what a search result looks like -->
        <div class="dash-preview-wrap">
          <div class="dash-preview-tray lp-tray">
            <div class="lp-mock">
              <div class="lp-mock-bar">
                <div class="lp-mock-q"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> biji kakao <span class="lp-hs">HS 1801</span></div>
                <div class="lp-mock-filter"><span class="on">Ada kontak</span><span>Jerman</span><span>Belanda</span><span>Importir</span></div>
              </div>
              <div class="lp-mock-rows">
                ${[
                  { f: 'DE', loc: 'Hamburg, Jerman', type: 'Importir biji kakao', e: 1, p: 1, w: 1, s: 91 },
                  { f: 'NL', loc: 'Amsterdam, Belanda', type: 'Distributor bahan cokelat', e: 1, p: 1, w: 1, s: 84 },
                  { f: 'BE', loc: 'Antwerpen, Belgia', type: 'Pabrik cokelat', e: 1, p: 0, w: 1, s: 72 },
                ].map((r, i) => `
                  <div class="lp-row">
                    <div class="lp-row-main">
                      <div class="lp-row-name">${flag(r.f)} <span class="lp-blurname">${['Contoh Importir A', 'Contoh Distributor B', 'Contoh Pabrik C'][i]}</span></div>
                      <div class="lp-row-meta">${r.type} · ${r.loc}</div>
                    </div>
                    <div class="lp-row-ch">
                      <span class="${r.e ? 'on' : ''}">✉ Email</span><span class="${r.p ? 'on' : ''}">☎ Telepon</span><span class="${r.w ? 'on' : ''}">🌐 Web</span>
                    </div>
                    <div class="lp-row-score"><b>${r.s}</b><small>skor</small></div>
                    <div class="lp-row-btn">Buka kontak</div>
                  </div>`).join('')}
              </div>
              <div class="lp-mock-cap">Contoh tampilan hasil pencarian. Ketik produk Anda di atas untuk melihat buyer sungguhan.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Problem → solution -->
    <section class="landing-section" id="masalah">
      <div class="landing-section-inner">
        <div class="section-eyebrow">Kenapa EksporIn</div>
        <h2 class="section-title">Mencari buyer ekspor tidak harus makan waktu berbulan-bulan</h2>
        <p class="section-lead">Kebanyakan eksportir pemula terjebak di tiga cara ini. Semuanya bisa jalan, tapi mahal di waktu atau biaya.</p>
        <div class="lp-pain-grid">
          ${[
            { ic: '🔎', t: 'Googling dan LinkedIn', d: 'Hasilnya campur aduk: toko ritel, blog, kompetitor. Butuh berminggu-minggu untuk dapat segelintir importir yang benar-benar membeli produk Anda.' },
            { ic: '💳', t: 'Platform data impor global', d: 'Datanya lengkap, tapi paket termurah sekitar US$199 per bulan (±Rp3,5 juta), berbahasa Inggris, dan kontak buyer sering dijual terpisah.' },
            { ic: '✈️', t: 'Pameran dagang', d: 'Bagus untuk bertemu langsung, tapi booth, tiket, dan hotel bisa menghabiskan puluhan juta rupiah untuk sekali acara.' },
          ].map((p) => `
            <div class="lp-pain"><div class="lp-pain-ic">${p.ic}</div><h3>${p.t}</h3><p>${p.d}</p></div>`).join('')}
        </div>
        <div class="lp-solution">
          <div class="lp-solution-tag">Dengan EksporIn</div>
          <p><b>Daftar buyer yang relevan beserta email dan teleponnya dalam satu kali pencarian</b>, dalam Bahasa Indonesia, mulai Rp14.000 untuk 30 hari, bayar pakai QRIS.</p>
          <a href="#/register" class="btn btn-primary">Coba gratis 3 hari</a>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="landing-section landing-section-alt" id="how">
      <div class="landing-section-inner">
        <div class="section-eyebrow">Cara kerja</div>
        <h2 class="section-title">Dari nama produk sampai email pertama, dalam 3 langkah</h2>
        <p class="section-lead">Tidak perlu paham HS code, bahasa asing, atau data bea cukai. Sistem yang menerjemahkannya untuk Anda.</p>
        <div class="lp-steps">
          ${[
            { n: '1', t: 'Ketik produk Anda', d: 'Tulis seperti biasa: "kopi robusta", "gula aren", "rotan". EksporIn otomatis mengenali kode HS yang dipakai bea cukai di seluruh dunia.', demo: '<div class="lp-demo-in">gula aren</div><div class="lp-demo-arrow">↓</div><div class="lp-demo-out"><b>HS 1702.90</b> Gula lainnya</div>' },
            { n: '2', t: 'Pilih buyer yang cocok', d: 'Lihat importir, distributor, dan pabrik pengolah yang membeli produk itu. Saring per negara, jenis usaha, atau hanya yang sudah ada kontaknya.', demo: '<div class="lp-demo-list"><span>🇩🇪 Importir · Hamburg</span><span>🇳🇱 Distributor · Rotterdam</span><span>🇯🇵 Pabrik · Osaka</span></div>' },
            { n: '3', t: 'Hubungi langsung', d: 'Buka email dan telepon buyer, lalu kirim penawaran dengan template siap pakai dalam 5 bahasa. Status terkirim dan dibalas tercatat di dashboard.', demo: '<div class="lp-demo-mail"><span class="lp-demo-to">✉ purchasing@…</span><span>Subject: Indonesian palm sugar supplier</span><span class="lp-demo-langs">EN · ES · AR · ZH · JA</span></div>' },
          ].map((s) => `
            <div class="lp-step">
              <div class="lp-step-n">${s.n}</div>
              <h3>${s.t}</h3>
              <p>${s.d}</p>
              <div class="lp-step-demo">${s.demo}</div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <!-- What you get per buyer -->
    <section class="landing-section" id="contoh">
      <div class="landing-section-inner lp-anatomy">
        <div class="lp-anatomy-copy">
          <div class="section-eyebrow" style="text-align:left">Yang Anda dapat</div>
          <h2 class="section-title" style="text-align:left">Setiap buyer punya profil yang bisa langsung ditindaklanjuti</h2>
          <ul class="lp-checks">
            <li><b>Nama perusahaan, kota, dan negara</b><span>Bukan sekadar nama negara. Anda tahu persis siapa dan di mana.</span></li>
            <li><b>Jenis usaha</b><span>Importir, distributor, roaster, pabrik pengolah, atau jaringan ritel, supaya penawaran Anda tepat sasaran.</span></li>
            <li><b>Produk yang mereka beli</b><span>Dicocokkan ke kode HS, jadi Anda tahu buyer ini memang relevan dengan produk Anda.</span></li>
            <li><b>Email dan telepon, beserta sumbernya</b><span>Setiap kontak menampilkan link halaman tempat kontak itu ditemukan, sehingga bisa Anda cek sendiri.</span></li>
            <li><b>Skor kelengkapan 0–100</b><span>Buyer dengan data paling lengkap muncul paling atas, jadi Anda mulai dari yang paling siap dihubungi.</span></li>
          </ul>
          <p class="lp-note">Kami tidak mengarang kontak. Kalau email belum ada, tombol <b>Cari kontak</b> memeriksa website resmi perusahaan saat itu juga, dan Anda hanya dikenai biaya kalau kontaknya ketemu.</p>
        </div>
        <div class="lp-profile">
          <div class="lp-profile-head">
            <div class="lp-profile-av">KH</div>
            <div><b>Contoh: Importir biji kakao</b><div class="lp-profile-sub">🇩🇪 Hamburg, Jerman · Importir</div></div>
            <div class="lp-profile-score">91<small>/100</small></div>
          </div>
          <div class="lp-profile-sec">
            <div class="lp-profile-lbl">Produk dibeli</div>
            <div class="lp-tags"><span>HS 1801 · Biji kakao</span><span>HS 1804 · Lemak kakao</span></div>
          </div>
          <div class="lp-profile-sec">
            <div class="lp-profile-lbl">Kontak</div>
            <div class="lp-contact"><span>🌐</span><div><b>contoh-importir.de</b><small>Website resmi</small></div></div>
            <div class="lp-contact"><span>✉</span><div><b>einkauf@contoh-importir.de</b><small>Email perusahaan · sumber: contoh-importir.de/kontakt</small></div></div>
            <div class="lp-contact"><span>☎</span><div><b>+49 40 •••• ••••</b><small>Sumber: halaman Impressum</small></div></div>
          </div>
          <div class="lp-profile-actions"><span class="lp-btn-o">Simpan ke daftar</span><span class="lp-btn-f">Kirim penawaran</span></div>
          <div class="lp-profile-cap">Ilustrasi profil buyer</div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="landing-section landing-section-alt" id="features">
      <div class="landing-section-inner">
        <div class="section-eyebrow">Fitur</div>
        <h2 class="section-title">Semua yang dibutuhkan untuk prospek ekspor</h2>
        <p class="section-lead">Dari riset pasar sampai menindaklanjuti balasan buyer, tanpa pindah-pindah aplikasi.</p>
        <div class="lp-feat-grid">
          ${[
            { ic: '✨', t: 'AI Find Buyer', d: 'Ceritakan produk dan target pasar Anda, AI menyusun daftar buyer yang paling cocok beserta alasannya.' },
            { ic: '📦', t: 'Direktori HS & data pasar', d: 'Lihat negara mana yang paling banyak mengimpor produk Anda, dari statistik resmi UN Comtrade.' },
            { ic: '🇺🇸', t: 'Tarif bea masuk Amerika', d: 'Cek tarif impor AS (USITC) sebelum mengirim penawaran harga, supaya harga FOB Anda tetap bersaing.' },
            { ic: '🔍', t: 'Cari kontak otomatis', d: 'Untuk buyer yang belum ada emailnya, sistem membaca website resminya dan menyimpan kontak yang ditemukan.' },
            { ic: '✉️', t: 'Template penawaran 5 bahasa', d: 'Inggris, Spanyol, Arab, Mandarin, dan Jepang, dengan nama buyer dan produk terisi otomatis.' },
            { ic: '📋', t: 'Daftar & notifikasi', d: 'Simpan buyer ke daftar, tandai status (dihubungi, negosiasi, deal), dan dapat notifikasi saat ada buyer baru.' },
          ].map((f) => `<div class="lp-feat"><div class="lp-feat-ic">${f.ic}</div><h3>${f.t}</h3><p>${f.d}</p></div>`).join('')}
        </div>
      </div>
    </section>

    <!-- Comparison -->
    <section class="landing-section" id="banding">
      <div class="landing-section-inner">
        <div class="section-eyebrow">Perbandingan</div>
        <h2 class="section-title">Dibuat untuk eksportir Indonesia, bukan untuk korporasi global</h2>
        <p class="section-lead">Kami fokus pada satu hal: membantu Anda menemukan dan menghubungi buyer, dengan harga yang masuk akal untuk UKM.</p>
        <div class="lp-cmp-wrap">
          <table class="lp-cmp">
            <thead><tr><th></th><th>Cari manual</th><th>Platform data impor global</th><th class="lp-cmp-us">EksporIn</th></tr></thead>
            <tbody>
              ${[
                ['Biaya', 'Gratis, tapi makan waktu', 'Mulai ±Rp3,5 juta/bulan', '<b>Mulai Rp14.000/30 hari</b>'],
                ['Bahasa', 'Tergantung sumber', 'Inggris', '<b>Indonesia</b>'],
                ['Kontak buyer', 'Dicari satu per satu', 'Sering dijual terpisah', '<b>Email & telepon, dengan sumbernya</b>'],
                ['Perlu paham HS code', 'Ya', 'Ya', '<b>Tidak, cukup nama produk</b>'],
                ['Bantuan menulis penawaran', '–', '–', '<b>Template 5 bahasa</b>'],
                ['Cara bayar', '–', 'Kartu kredit, dolar, sering kontrak tahunan', '<b>QRIS, tanpa kontrak</b>'],
                ['Riwayat shipment per buyer', '–', 'Sangat lengkap', 'Belum, kami fokus ke kontak'],
              ].map((r) => `<tr><th>${r[0]}</th><td data-l="Cari manual">${r[1]}</td><td data-l="Platform global">${r[2]}</td><td class="lp-cmp-us" data-l="EksporIn">${r[3]}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="lp-foot">Harga pembanding: paket termurah ImportGenius US$199/bulan (importgenius.com, Oktober 2026), kurs ±Rp18.000 per dolar. Jika Anda butuh analisis rantai pasok dan riwayat bill of lading yang sangat detail, platform global tersebut lebih tepat.</p>
      </div>
    </section>

    <!-- Who it's for + data sources -->
    <section class="landing-section landing-section-alt" id="untuk">
      <div class="landing-section-inner">
        <div class="section-eyebrow">Untuk siapa</div>
        <h2 class="section-title" style="margin-bottom:28px">Cocok untuk Anda yang…</h2>
        <div class="lp-who">
          ${[
            { t: 'Baru mau mulai ekspor', d: 'Sudah punya produk dan kapasitas, tapi belum punya satu pun buyer luar negeri.' },
            { t: 'Sudah ekspor, cari pasar baru', d: 'Ingin menambah buyer di negara lain supaya tidak bergantung pada satu-dua pembeli.' },
            { t: 'Trader, agen, dan koperasi', d: 'Mencarikan pembeli untuk produk petani atau pengrajin binaan Anda.' },
          ].map((w) => `<div class="lp-who-card"><h3>${w.t}</h3><p>${w.d}</p></div>`).join('')}
        </div>
        <div class="lp-sources">
          <div class="lp-sources-title">Data kami berasal dari sumber publik yang bisa dicek</div>
          <div class="lp-sources-list">
            ${['Registri perusahaan resmi Inggris, Prancis & Norwegia', 'Daftar importir organik bersertifikat (Agence BIO)', 'OpenStreetMap', 'Daftar importir lembaga promosi dagang', 'Direktori asosiasi industri', 'Website resmi perusahaan', 'GLEIF (registri badan hukum global)', 'UN Comtrade (statistik perdagangan)', 'USITC (tarif impor AS)', 'WCO (kode HS)'].map((x) => `<span>${x}</span>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="landing-section" id="pricing">
      <div class="landing-section-inner">
        <div class="section-eyebrow">Harga</div>
        <h2 class="section-title">Mulai dari Rp14.000, tanpa kontrak</h2>
        <p class="section-lead">Akun baru langsung dapat <b>trial 3 hari</b> setara paket Hemat. Paket berlaku 30 hari, dibayar sekali lewat QRIS (GoPay, OVO, DANA, ShopeePay, m-Banking), dan tidak diperpanjang otomatis.</p>
        <div class="price-grid price-grid-3">
          ${[
            { code: 'hemat', name: 'Hemat', price: 'Rp14.000', tag: '/30 hari', desc: 'Untuk mencari buyer pertama.', feats: ['100 pencarian buyer', '30 profil buyer lengkap', '15 buka kontak (email/telepon)', '10 cari kontak otomatis', '20 kirim penawaran', 'Simpan 50 buyer · 3 notifikasi'] },
            { code: 'growth', name: 'Growth', price: 'Rp99.000', tag: '/30 hari', desc: 'Untuk eksportir yang aktif prospek.', highlight: true, feats: ['1.000 pencarian buyer', '300 profil buyer lengkap', '150 buka kontak', '100 cari kontak otomatis', '300 kirim penawaran', 'Ekspor CSV 300 baris', 'Simpan & notifikasi tanpa batas'] },
            { code: 'business', name: 'Business', price: 'Rp299.000', tag: '/30 hari', desc: 'Untuk tim ekspor dengan banyak pasar.', feats: ['Pencarian & profil tanpa batas', '600 buka kontak', '400 cari kontak otomatis', '2.000 kirim penawaran', 'Ekspor CSV 3.000 baris', 'Intel kompetitor', 'Semua fitur Growth'] },
          ].map((p) => `
            <div class="price-card${p.highlight ? ' price-card-featured' : ''}">
              ${p.highlight ? '<div class="price-badge">Paling populer</div>' : ''}
              <div class="price-name">${p.name}</div>
              <div class="price-desc">${p.desc}</div>
              <div class="price-amt"><b>${p.price}</b><span>${p.tag}</span></div>
              <ul class="price-feats">${p.feats.map((f) => `<li>${f}</li>`).join('')}</ul>
              <a href="#/register" class="btn ${p.highlight ? 'btn-primary' : 'btn-neutral'}" style="width:100%;border-radius:10px;padding:12px">Coba gratis 3 hari</a>
            </div>`).join('')}
        </div>
        <p class="lp-saldo">Kuota habis sebelum 30 hari? Lanjutkan dengan <b>saldo</b>, isi mulai Rp10.000. Anda hanya membayar yang dipakai, misalnya Rp1.000 untuk membuka satu kontak buyer.</p>
      </div>
    </section>

    <!-- FAQ -->
    <section class="landing-section landing-section-alt" id="faq">
      <div class="landing-section-inner lp-faq-wrap">
        <div class="section-eyebrow">FAQ</div>
        <h2 class="section-title">Pertanyaan yang sering diajukan</h2>
        <div class="lp-faq">
          ${[
            ['Saya belum tahu HS code produk saya. Apakah bisa?', 'Bisa. Ketik nama produk dalam Bahasa Indonesia, misalnya "gula aren" atau "udang beku". EksporIn mengenali kode HS-nya otomatis dan menampilkan pilihan lain jika ada yang lebih tepat.'],
            ['Dari mana data buyer dan kontaknya?', 'Dari sumber publik: daftar importir yang diterbitkan lembaga promosi dagang, direktori asosiasi, daftar peserta pameran, registri badan hukum, dan website resmi perusahaan. Setiap email dan telepon disertai link halaman tempat kontak itu ditemukan.'],
            ['Apakah kontaknya dijamin dibalas?', 'Tidak ada yang bisa menjamin balasan. Yang kami jamin: kontak tidak dikarang. Kami menandai jenis email (email perusahaan atau email umum) dan memeriksa domainnya, supaya Anda tahu mana yang paling layak dihubungi lebih dulu.'],
            ['Negara mana saja yang tersedia?', '38 negara tujuan ekspor utama, termasuk Amerika Serikat, Jerman, Belanda, Jepang, Tiongkok, Korea Selatan, Uni Emirat Arab, Arab Saudi, Inggris, Prancis, Australia, dan India. Data bertambah setiap hari.'],
            ['Apa yang saya dapat selama trial 3 hari?', 'Kuota setara paket Hemat: 100 pencarian, 30 profil buyer, 5 buka kontak, 5 cari kontak otomatis, dan 10 kirim penawaran. Trial aktif otomatis saat Anda daftar, tanpa kartu kredit.'],
            ['Bagaimana cara bayarnya? Apakah diperpanjang otomatis?', 'Bayar dengan QRIS dari e-wallet atau m-Banking apa saja. Paket langsung aktif setelah pembayaran berhasil dan berlaku 30 hari. Tidak ada perpanjangan otomatis; Anda memperpanjang sendiri kalau mau.'],
            ['Apa itu saldo?', 'Saldo dipakai kalau kuota paket habis atau paket sudah berakhir, jadi Anda tidak harus langsung naik paket. Isi mulai Rp10.000, dan saldo tidak hangus.'],
            ['Apa bedanya dengan InaExport dari Kemendag?', 'InaExport adalah etalase supaya buyer bisa menemukan Anda. EksporIn bekerja dari arah sebaliknya: Anda yang aktif mencari dan menghubungi buyer. Keduanya bisa dipakai bersamaan.'],
          ].map(([q, a], i) => `<details class="lp-qa"${i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="landing-cta">
      <div class="landing-section-inner">
        <div class="landing-cta-inner">
          <div>
            <h2>Lihat siapa yang membeli produk Anda di luar negeri</h2>
            <p>Ketik nama produk dan lihat buyer-nya sekarang, tanpa daftar. Kalau cocok, lanjutkan dengan trial 3 hari gratis.</p>
          </div>
          <form class="lp-cta-form" id="cta-try-form" autocomplete="off">
            <input id="cta-try-input" type="text" placeholder="Nama produk, misal: vanili" aria-label="Nama produk">
            <button type="submit" class="btn btn-primary">Cari buyer →</button>
          </form>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-section-inner">
        <div class="footer-grid">
          <div class="footer-col footer-brand">
            <div class="footer-logo">${LOGO_SVG}<span>EksporIn</span></div>
            <p>Cari buyer luar negeri beserta kontaknya, untuk eksportir dan UKM Indonesia.</p>
          </div>
          <div class="footer-col">
            <h4>Produk</h4>
            <a href="javascript:void(0)" onclick="document.getElementById('how')?.scrollIntoView({behavior:'smooth'})">Cara kerja</a>
            <a href="javascript:void(0)" onclick="document.getElementById('features')?.scrollIntoView({behavior:'smooth'})">Fitur</a>
            <a href="javascript:void(0)" onclick="document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})">Harga</a>
            <a href="javascript:void(0)" onclick="document.getElementById('faq')?.scrollIntoView({behavior:'smooth'})">FAQ</a>
            <a href="#/register">Coba gratis 3 hari</a>
          </div>
          <div class="footer-col">
            <h4>Sumber Data</h4>
            <a href="https://comtradeplus.un.org" target="_blank" rel="noopener">UN Comtrade+</a>
            <a href="https://hts.usitc.gov" target="_blank" rel="noopener">USITC HTS</a>
            <a href="https://github.com/datasets/harmonized-system" target="_blank" rel="noopener">WCO HS Nomenclature</a>
          </div>
          <div class="footer-col">
            <h4>Kontak</h4>
            <a href="mailto:hello@eksporin.id">hello@eksporin.id</a>
            <a href="mailto:billing@eksporin.id">billing@eksporin.id</a>
          </div>
          <div class="footer-col">
            <h4>Legal</h4>
            <a href="#/privacy">Kebijakan Privasi</a>
            <a href="#/terms">Syarat Layanan</a>
            <a href="#/refund">Kebijakan Refund</a>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${new Date().getFullYear()} EksporIn. Statistik perdagangan dari UN Comtrade+, tarif dari USITC, kode HS dari WCO. Data buyer dari sumber publik yang dicantumkan di setiap profil.</p>
        </div>
      </div>
    </footer>
  </div>`;

  // Wire the hero commodity search — redirects to the Quick Search page.
  const heroForm = document.getElementById('hero-try-form');
  const heroInput = document.getElementById('hero-try-input');
  // Rotate 3 hints inside the search bar placeholder every 3 seconds.
  if (heroInput) {
    const HINTS = [
      'Produk Anda, misal: biji kakao, kopi robusta, vanili…',
      'Tidak perlu HS code, cukup nama produknya',
      'Contoh: udang beku, minyak nilam, gula aren…',
    ];
    let idx = 0;
    const applyHint = () => { if (!heroInput.value) heroInput.setAttribute('placeholder', HINTS[idx]); };
    applyHint();
    setInterval(() => { idx = (idx + 1) % HINTS.length; applyHint(); }, 3000);
  }
  const ctaForm = document.getElementById('cta-try-form');
  if (ctaForm) ctaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (document.getElementById('cta-try-input').value || '').trim();
    location.hash = v ? '#/quick-search?q=' + encodeURIComponent(v) : '#/register';
  });
  if (heroForm && heroInput) {
    heroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = heroInput.value.trim();
      if (!q) return;
      location.hash = '#/quick-search?q=' + encodeURIComponent(q);
    });
  }
});

// ================= public quick-search preview page =================
route(/^\/quick-search$/, async (app, m, params) => {
  const q = (params.get('q') || '').trim();
  app.innerHTML = `
  <div class="qs-page">
    <div class="qs-nav">
      <a href="#/" class="qs-brand">${LOGO_SVG} <span>EksporIn</span></a>
      <div class="qs-nav-right">
        <a href="#/login" class="btn btn-ghost" style="height:36px;padding:6px 14px;font-size:13px">Masuk</a>
        <a href="#/register" class="btn btn-primary" style="height:36px;padding:6px 16px;font-size:13px;border-radius:var(--radius-full)">Coba gratis 3 hari</a>
      </div>
    </div>

    <div class="qs-header">
      <a href="#/" class="qs-back">← Kembali ke beranda</a>
      <h1>Hasil pencarian buyer untuk "<span class="qs-query">${esc(q || '…')}</span>"</h1>
      <p class="qs-sub">Cuplikan importir dan distributor luar negeri untuk komoditas Anda. Nama lengkap, email, dan telepon terbuka setelah daftar (trial 3 hari gratis).</p>
      <form class="qs-search" id="qs-form" autocomplete="off">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="qs-input" type="text" value="${esc(q)}" placeholder="Ganti komoditas untuk cari buyer lain…">
        <button type="submit">Cari Buyer</button>
      </form>
    </div>

    <div id="qs-body" class="qs-body">
      <div class="qs-loading"><span class="spinner"></span> Mencari buyer untuk "${esc(q)}"…</div>
    </div>

    <div class="qs-cta">
      <div class="qs-cta-inner">
        <div>
          <h2>Butuh data buyer lebih banyak?</h2>
          <p>Coba gratis 3 hari untuk melihat semua ${'{count}'} buyer, membuka email dan telepon mereka, dan menulis email penawaran pertama Anda.</p>
        </div>
        <a href="#/register${q ? '?utm=quick-search&q=' + encodeURIComponent(q) : ''}" class="btn btn-primary btn-lg" style="border-radius:var(--radius-full);padding:14px 32px;font-size:16px;white-space:nowrap">Daftar sekarang →</a>
      </div>
    </div>
  </div>`;

  // Bind form to re-search on submit
  document.getElementById('qs-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('qs-input').value.trim();
    if (!v) return;
    location.hash = '#/quick-search?q=' + encodeURIComponent(v);
  });

  if (!q) {
    document.getElementById('qs-body').innerHTML = '<div class="empty" style="padding:60px 20px;text-align:center"><h3>Ketik komoditas Anda dulu</h3><p class="muted">Contoh: kopi arabika, vanili kering, rotan, batik.</p></div>';
    return;
  }

  // Fetch preview buyers
  try {
    const r = await fetch('/api/preview/buyers?q=' + encodeURIComponent(q));
    const body = await r.json();
    const body_el = document.getElementById('qs-body');
    if (!body_el) return;
    if (!body.ok || !body.buyers?.length) {
      body_el.innerHTML = `
        <div class="empty" style="padding:60px 20px;text-align:center">
          <h3>Belum ada buyer di database publik kami untuk "${esc(q)}"</h3>
          <p class="muted" style="margin-bottom:20px">${esc(body.message || 'Coba komoditas lain, atau daftar untuk pencarian AI penuh (LLM + real-time trade data).')}</p>
          <a href="#/register" class="btn btn-primary btn-lg">Daftar gratis untuk pencarian penuh</a>
        </div>`;
      return;
    }
    const total = body.total_buyers_available;
    const hs = body.hs;
    if (body.pool) {
      const st = body.stats || {};
      const typeId = { importer: 'Importir', distributor: 'Distributor', wholesaler: 'Grosir', manufacturer: 'Pabrik', processor: 'Pengolah', roaster: 'Roaster', trader: 'Trader', retail_chain: 'Jaringan ritel', brand: 'Brand', agent: 'Agen' };
      const chan = (on, label) => `<span class="qs-chan ${on ? 'on' : ''}">${on ? '✓' : '–'} ${label}</span>`;
      body_el.innerHTML = `
      <div class="qs-hs-summary">
        <div>
          <span class="caption muted-3">Komoditas dikenali sebagai</span>
          <h3><span class="hs-code-chip">HS ${hs.code.replace(/^(\d{4})/, '$1.')}</span> ${esc(hs.description)}</h3>
        </div>
        ${body.hs_alternatives?.length ? `
          <div class="qs-hs-alts">
            <span class="caption muted-3">Bukan ini? Coba:</span>
            ${body.hs_alternatives.map((a) => `<button class="qs-hs-alt-chip" data-q="${esc(a.description.split(';')[0])}">${a.code.replace(/^(\d{4})/, '$1.')} · ${esc(a.description.slice(0, 42))}${a.description.length > 42 ? '…' : ''}</button>`).join('')}
          </div>` : ''}
      </div>
      <div class="qs-stats">
        <div><b>${fmtN(st.total)}</b><span>buyer ditemukan</span></div>
        <div><b>${fmtN(st.with_contact)}</b><span>sudah ada email/telepon</span></div>
        <div><b>${fmtN(st.countries)}</b><span>negara</span></div>
        ${(st.top_countries || []).length ? `<div class="qs-stats-countries">${st.top_countries.map((c) => `<span>${flag(c.country)} ${esc(c.country_name)} <i>${c.count}</i></span>`).join('')}</div>` : ''}
      </div>
      <div class="qs-buyers">
        ${body.buyers.map((b) => `
          <article class="qs-buyer-card ${b.blurred ? 'is-blurred' : ''}">
            <div class="qs-buyer-head">
              <div class="qs-buyer-avatar">${b.name ? esc(b.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()) : '🔒'}</div>
              <div style="flex:1;min-width:0">
                <div class="qs-buyer-name">${b.name ? esc(b.name) : 'Nama terbuka setelah daftar'}</div>
                <div class="qs-buyer-meta">${flag(b.country)} ${esc(b.country_name)}${b.city ? ' · ' + esc(b.city) : ''}${b.buyer_type ? ' · ' + esc(typeId[b.buyer_type] || b.buyer_type) : ''}</div>
              </div>
            </div>
            <div class="qs-chans">${chan(b.has_email, 'Email')}${chan(b.has_phone, 'Telepon')}${chan(b.has_website, 'Website')}</div>
            <div class="qs-buyer-contact">
              <span class="caption muted-3">Kontak</span>
              <div class="qs-buyer-contact-masked">🔒 ${b.has_email ? '••••••@•••••' : ''}${b.has_email && b.has_phone ? ' · ' : ''}${b.has_phone ? '+•• ••• ••• ••' : ''}${!b.has_email && !b.has_phone ? 'bisa dicari otomatis dari website perusahaan' : ''}</div>
            </div>
          </article>`).join('')}
      </div>
      <div class="qs-unlock">🔒 <b>${fmtN(Math.max(0, total - 2))} buyer lain</b> dan semua kontaknya bisa Anda lihat dengan trial gratis 3 hari, tanpa kartu kredit.</div>`;
      const cta0 = document.querySelector('.qs-cta p');
      if (cta0) cta0.textContent = cta0.textContent.replace('{count}', fmtN(total));
      document.querySelectorAll('.qs-hs-alt-chip').forEach((el) => el.addEventListener('click', () => {
        location.hash = '#/quick-search?q=' + encodeURIComponent(el.dataset.q);
      }));
      return;
    }
    body_el.innerHTML = `
      <div class="qs-hs-summary">
        <div>
          <span class="caption muted-3">HS Code terdeteksi</span>
          <h3><span class="hs-code-chip">${hs.code.replace(/^(\d{4})/, '$1.')}</span> ${esc(hs.description)}</h3>
        </div>
        ${body.hs_alternatives?.length ? `
          <div class="qs-hs-alts">
            <span class="caption muted-3">Atau:</span>
            ${body.hs_alternatives.map((a) => `<button class="qs-hs-alt-chip" data-q="${esc(a.description.split(';')[0])}">${a.code.replace(/^(\d{4})/, '$1.')} · ${esc(a.description.slice(0, 42))}${a.description.length > 42 ? '…' : ''}</button>`).join('')}
          </div>` : ''}
      </div>
      <div class="qs-buyers">
        ${body.buyers.map((b) => `
          <article class="qs-buyer-card ${b.blurred ? 'is-blurred' : ''}">
            <div class="qs-buyer-head">
              <div class="qs-buyer-avatar">${esc((b.name || '?').split(' ').map((x) => x[0]).slice(0,2).join('').toUpperCase())}</div>
              <div style="flex:1;min-width:0">
                <div class="qs-buyer-name">${esc(b.name)}</div>
                <div class="qs-buyer-meta">${flag(b.country)} ${esc(b.country_name)} · ${esc(b.city || '')} · ${esc(b.industry || '')}</div>
              </div>
              ${b.score != null ? `<span class="pill ${b.score >= 80 ? 'pill-danger' : b.score >= 60 ? 'pill-warning' : 'pill-neutral'}" style="font-size:11px">Skor ${b.score}</span>` : ''}
            </div>
            <div class="qs-buyer-stats">
              <div><span class="caption muted-3">Shipment 12 bln</span><b>${fmtN(b.shipments_12mo)}</b></div>
              <div><span class="caption muted-3">Volume</span><b>${fmtKg(b.volume_12mo_kg)}</b></div>
              <div><span class="caption muted-3">Nilai</span><b>${fmtUSD(b.value_12mo_usd)}</b></div>
              <div><span class="caption muted-3">Ukuran</span><b>${esc(b.size || '-')}</b></div>
            </div>
            <div class="qs-buyer-contact">
              <span class="caption muted-3">Kontak</span>
              <div class="qs-buyer-contact-masked">🔒 ••••••@•••••.com · +•• ••• ••• ••</div>
            </div>
          </article>`).join('')}
      </div>
      <div class="qs-unlock">
        🔒 <b>${Math.max(0, total - 2)}+ buyer lain</b> beserta kontaknya bisa Anda lihat dengan trial gratis 3 hari, tanpa kartu kredit.
      </div>`;

    // Update the CTA count text
    const cta = document.querySelector('.qs-cta p');
    if (cta) cta.textContent = cta.textContent.replace('{count}', String(total));

    // Bind alt HS chips → re-search
    document.querySelectorAll('.qs-hs-alt-chip').forEach((el) => el.addEventListener('click', () => {
      location.hash = '#/quick-search?q=' + encodeURIComponent(el.dataset.q);
    }));
  } catch (e) {
    document.getElementById('qs-body').innerHTML = '<div class="empty" style="padding:60px 20px;text-align:center"><h3>Gagal memuat data</h3><p class="muted">Coba lagi atau daftar untuk pengalaman penuh.</p></div>';
  }
});

// ================= auth =================
function authHero() {
  return `<div class="auth-hero">
    <img class="auth-bg" src="/img/auth-bg.jpg" alt="" aria-hidden="true" decoding="async">
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
    <form id="f"><div class="field"><label>Email</label><input class="input" name="email" type="email" required placeholder="namaanda@email.com" autocomplete="username"></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" required placeholder="Passwordanda" autocomplete="current-password"></div>
    <button class="btn btn-primary" style="width:100%">Masuk</button></form></div></div></div>`;
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const isDemo = email === 'demo@eksporin.id';
    // Local-backend-only test accounts (not registered in Supabase).
    // admin@super-vanilla.com is now registered in Supabase, so it goes
    // through the normal Supabase auth path plus the sync handler
    // (which preserves the seeded plan=business on the local row).
    const LOCAL_ONLY_ACCOUNTS = new Set([
      'demo@eksporin.id',
      'test@zieads.com',
    ]);
    try {
      // Local-only accounts skip the Supabase round-trip.
      if (isDemo || LOCAL_ONLY_ACCOUNTS.has(email)) {
        const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        ME = null;
        // Fetch /api/me to check is_admin, then route accordingly.
        let isAdmin = false;
        try { const meCheck = await api('/api/me'); isAdmin = !!meCheck.is_admin; } catch {}
        location.hash = isAdmin ? '#/admin' : (r.onboarded ? '#/dashboard' : '#/onboarding');
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
          toast('Login gagal. Cek email konfirmasi Anda.', true);
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

// ================= legal pages (Terms, Privacy, Refund) =================
function legalShell(title, updated, bodyHtml) {
  return `<div class="legal-page">
    <div class="legal-topbar">
      <a class="legal-back" href="#/">← Kembali ke beranda</a>
    </div>
    <article class="legal-article">
      <div class="legal-header">
        <h1>${title}</h1>
        <p class="legal-updated">Terakhir diperbarui: ${updated}</p>
      </div>
      <div class="legal-body">${bodyHtml}</div>
      <div class="legal-foot">
        <p>Ada pertanyaan? Kirim email ke <a href="mailto:hello@eksporin.id">hello@eksporin.id</a>.</p>
      </div>
    </article>
  </div>`;
}

route(/^\/terms$/, (app) => {
  app.innerHTML = legalShell('Syarat Layanan', '2 September 2026', `
    <h2>1. Tentang EksporIn</h2>
    <p>EksporIn adalah platform intelijen buyer luar negeri untuk eksportir Indonesia. Kami mengumpulkan, menormalisasi, dan menyajikan data yang berasal dari sumber publik seperti UN Comtrade+, USITC HTS, WCO Nomenclature, catatan bill of lading US Customs (CBP AMS), direktori bisnis publik, laporan Kemendag ITPC, dan crawl web publik lainnya. Dengan mendaftar dan menggunakan layanan kami, Anda menyetujui syarat di bawah ini.</p>

    <h2>2. Sifat data yang kami sajikan</h2>
    <p>Data buyer yang Anda lihat di platform berasal dari sumber terbuka. Kami melakukan agregasi, verifikasi berjenjang, dan pengayaan (enrichment) menggunakan AI. Meskipun kami berusaha akurat, data disajikan apa adanya (as-is). Kami tidak menjamin bahwa setiap kontak masih aktif, setiap perusahaan masih beroperasi, atau setiap volume ekspor merefleksikan realitas terkini secara real-time. Anda wajib memverifikasi ulang sebelum melakukan transaksi bisnis.</p>

    <h2>3. Kewajiban pengguna</h2>
    <p>Sebagai pengguna, Anda bertanggung jawab untuk:</p>
    <ul>
      <li>Mematuhi hukum negara buyer saat melakukan outreach, termasuk namun tidak terbatas pada GDPR (Uni Eropa), CAN-SPAM Act (Amerika Serikat), PDPA (Singapura dan Malaysia), dan CASL (Kanada).</li>
      <li>Tidak menggunakan data dari EksporIn untuk keperluan spam massal, penipuan, kegiatan ilegal, atau pelanggaran hak kekayaan intelektual.</li>
      <li>Menjaga kerahasiaan akun. Semua aktivitas dari akun Anda menjadi tanggung jawab Anda.</li>
      <li>Tidak menjual kembali, mendistribusikan, atau me-lisensikan ulang data dari platform ini kepada pihak ketiga tanpa izin tertulis dari kami.</li>
    </ul>

    <h2>4. Paket berbayar dan penagihan</h2>
    <p>Kami menawarkan paket Hemat, Growth, dan Business yang masing-masing berlaku 30 hari sejak pembayaran, serta trial 3 hari untuk akun baru. Detail harga, kuota, dan tarif saldo tercantum di halaman Harga dan menu Paket & Saldo. Pembayaran diproses melalui QRIS oleh gateway pembayaran pihak ketiga (Sumopod). Paket tidak diperpanjang otomatis; Anda membeli ulang atau memperpanjang secara manual. Saldo yang diisi tidak hangus dan dipakai otomatis untuk tindakan berbayar ketika kuota paket habis atau paket berakhir.</p>

    <h2>5. Batasan tanggung jawab</h2>
    <p>EksporIn tidak bertanggung jawab atas kerugian yang timbul dari keputusan bisnis Anda berdasarkan data platform, termasuk gagal transaksi, buyer yang tidak merespons, perbedaan kurs, atau perubahan tarif bea masuk. Tanggung jawab maksimum kami dalam kondisi apa pun terbatas pada nilai langganan tiga bulan terakhir yang telah Anda bayarkan.</p>

    <h2>6. Penghentian akun</h2>
    <p>Kami berhak menangguhkan atau menghapus akun yang terbukti melanggar syarat ini, termasuk aktivitas scraping otomatis terhadap platform kami, pembagian akun ke pengguna lain, atau penggunaan yang secara jelas melanggar hukum. Anda juga bebas menutup akun sendiri kapan saja lewat menu Pengaturan.</p>

    <h2>7. Perubahan syarat</h2>
    <p>Kami dapat memperbarui syarat ini sewaktu-waktu. Perubahan material akan kami informasikan melalui email dan banner di dashboard minimal 14 hari sebelum berlaku. Melanjutkan penggunaan setelah tanggal efektif berarti Anda menyetujui versi baru.</p>

    <h2>8. Hukum yang berlaku</h2>
    <p>Syarat ini tunduk pada hukum Republik Indonesia. Sengketa yang tidak dapat diselesaikan secara musyawarah akan diselesaikan melalui Badan Arbitrase Nasional Indonesia (BANI).</p>
  `);
});

route(/^\/privacy$/, (app) => {
  app.innerHTML = legalShell('Kebijakan Privasi', '2 September 2026', `
    <h2>1. Data yang kami kumpulkan</h2>
    <p>Saat Anda mendaftar dan menggunakan EksporIn, kami menyimpan:</p>
    <ul>
      <li>Data akun: nama, email, nama usaha, password (dienkripsi hash bcrypt).</li>
      <li>Data preferensi: HS code fokus, negara target, status ekspor, tujuan penggunaan.</li>
      <li>Data aktivitas: pencarian buyer, buyer yang disimpan, pesan yang dikirim, halaman yang dikunjungi.</li>
      <li>Data teknis: alamat IP, tipe browser, waktu akses, untuk keperluan keamanan dan analitik agregat.</li>
      <li>Data pembayaran: hanya token transaksi dari gateway. Kami tidak menyimpan nomor kartu Anda.</li>
    </ul>

    <h2>2. Data yang kami tampilkan</h2>
    <p>Data buyer luar negeri yang Anda lihat di dashboard bukan data personal warga negara Anda. Data tersebut berasal dari sumber publik: catatan bea cukai, direktori bisnis, laporan pemerintah, dan crawl web publik. Semua data yang kami tampilkan adalah data bisnis (nama perusahaan, alamat kantor, email umum seperti info@ atau sales@, telepon perusahaan, website).</p>

    <h2>3. Cara kami menggunakan data Anda</h2>
    <ul>
      <li>Menyajikan layanan dan mempersonalisasi rekomendasi buyer.</li>
      <li>Memproses pembayaran dan memberikan support.</li>
      <li>Mengirim email operasional (invoice, konfirmasi, pemberitahuan sistem). Anda bisa berhenti langganan email pemasaran kapan saja.</li>
      <li>Memantau kesehatan sistem, mencegah penyalahgunaan, memenuhi kewajiban hukum.</li>
    </ul>

    <h2>4. Kami tidak menjual data Anda</h2>
    <p>EksporIn tidak menjual, menyewakan, atau menukar data personal pengguna kepada pihak ketiga untuk tujuan pemasaran. Data agregat dan anonim (misal jumlah pengguna per provinsi) dapat kami gunakan untuk publikasi ringkasan pasar, tanpa mengungkap identitas individu.</p>

    <h2>5. Pihak ketiga yang kami gunakan</h2>
    <p>Kami menggunakan penyedia infrastruktur untuk hosting (Vercel), autentikasi dan basis data (Supabase), gateway pembayaran, serta model AI untuk pengayaan data. Masing-masing hanya menerima data seperlunya, dan tidak diperbolehkan menggunakan data Anda untuk keperluan mereka sendiri.</p>

    <h2>6. Hak Anda</h2>
    <ul>
      <li>Meminta salinan seluruh data pribadi Anda yang kami simpan.</li>
      <li>Mengoreksi data yang salah.</li>
      <li>Menghapus akun Anda sekaligus seluruh data terkait.</li>
      <li>Berhenti berlangganan komunikasi non-transaksional.</li>
    </ul>
    <p>Untuk melakukan salah satu di atas, kirim permintaan ke <a href="mailto:privacy@eksporin.id">privacy@eksporin.id</a>. Kami merespons dalam 14 hari kerja.</p>

    <h2>7. Cookies</h2>
    <p>Kami menggunakan cookie teknis untuk menjaga sesi login Anda dan cookie analitik agregat. Kami tidak menggunakan cookie iklan pihak ketiga.</p>

    <h2>8. Perlindungan data</h2>
    <p>Data pengguna disimpan di server dengan enkripsi at-rest dan in-transit. Password di-hash. Akses internal ke database dibatasi hanya untuk personel yang membutuhkan.</p>

    <h2>9. Kontak DPO</h2>
    <p>Data Protection Officer EksporIn dapat dihubungi di <a href="mailto:privacy@eksporin.id">privacy@eksporin.id</a>.</p>
  `);
});

route(/^\/refund$/, (app) => {
  app.innerHTML = legalShell('Kebijakan Refund', '25 Oktober 2026', `
    <h2>1. Trial 3 hari</h2>
    <p>Setiap akun baru mendapat trial 3 hari setara paket Hemat tanpa pembayaran. Gunakan masa ini untuk menilai apakah data buyer untuk komoditas dan negara tujuan Anda sudah sesuai sebelum membeli paket.</p>

    <h2>2. Paket 30 hari</h2>
    <p>Paket dibayar sekali dan berlaku 30 hari, tanpa perpanjangan otomatis. Refund paket diberikan jika:</p>
    <ul>
      <li>Terjadi pembayaran ganda untuk pesanan yang sama.</li>
      <li>Pembayaran berhasil tetapi paket tidak aktif dan tidak dapat kami perbaiki dalam 2 x 24 jam.</li>
      <li>Layanan mengalami gangguan di sisi kami lebih dari 24 jam berturut-turut selama masa paket.</li>
    </ul>

    <h2>3. Saldo</h2>
    <p>Saldo tidak hangus. Saldo yang belum terpakai dapat dikembalikan atas permintaan, dikurangi biaya transaksi QRIS yang sudah dibebankan gateway. Saldo yang sudah dipakai untuk membuka profil, kontak, pencarian, outreach, atau ekspor tidak dapat dikembalikan.</p>

    <h2>4. Yang tidak di-refund</h2>
    <ul>
      <li>Kuota yang sudah terpakai, termasuk kontak yang sudah dibuka.</li>
      <li>Ketidakpuasan terhadap jumlah data buyer untuk komoditas atau negara tertentu yang bisa Anda nilai selama trial.</li>
      <li>Perubahan kebijakan ekspor, tarif bea masuk, atau kondisi pasar, serta transaksi dengan buyer yang tidak berhasil.</li>
    </ul>

    <h2>5. Cara mengajukan refund</h2>
    <p>Kirim permintaan ke <a href="mailto:billing@eksporin.id">billing@eksporin.id</a> dengan subjek "Refund Request" dan sertakan nomor pesanan (EKS-…) dari menu Paket & Saldo. Kami memproses dalam 7 hari kerja.</p>
  `);
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
      () => `<h2>Produk yang Anda ekspor</h2>
        <p class="muted" style="margin-bottom:12px">Cari HS code sesuai komoditas Anda, atau pilih dari daftar populer. Maks 5 kode.</p>
        <div style="position:relative;margin-bottom:12px">
          <input class="input" id="hs-search" placeholder="Cari komoditas… (mis. vanili, coffee, rotan, batik)" autocomplete="off" style="padding-left:38px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9a9a9a" stroke-width="1.5" style="position:absolute;left:12px;top:11px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div id="hs-selected" style="display:${state.hs.length ? 'flex' : 'none'};flex-wrap:wrap;gap:6px;margin-bottom:12px">
          ${state.hs.map((code) => `<span class="pill pill-orange" style="cursor:pointer" data-remove-hs="${code}" title="Klik untuk hapus">${code.replace(/^(\d{4})/, '$1.')} ×</span>`).join('')}
        </div>
        <div id="hs-results" style="max-height:320px;overflow-y:auto">
          ${leaves.map((l) => `
            <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}">
              <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span>
              <div><b>${esc(l.description_id)}</b><div class="caption muted">${esc(l.description_en)}</div></div>
            </div>`).join('')}
        </div>
        <p class="caption muted-3" style="margin-top:8px">💡 Daftar populer: 21 komoditas ekspor utama Indonesia. Ketik untuk cari dari 6.941 kode WCO lengkap.</p>`,
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
    // Chip remove
    $$('[data-remove-hs]').forEach((el) => el.onclick = () => {
      state.hs = state.hs.filter((x) => x !== el.dataset.removeHs);
      draw();
    });
    // Live HS search against WCO nomenclature
    const searchInput = $('#hs-search');
    const resultsBox = $('#hs-results');
    if (searchInput && resultsBox) {
      let searchTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        const q = e.target.value.trim();
        if (!q) {
          // Reset to popular list
          resultsBox.innerHTML = leaves.map((l) => `
            <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}">
              <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span>
              <div><b>${esc(l.description_id)}</b><div class="caption muted">${esc(l.description_en)}</div></div>
            </div>`).join('');
          resultsBox.querySelectorAll('.option-card[data-hs]').forEach((el) => el.onclick = () => {
            const c = el.dataset.hs;
            state.hs = state.hs.includes(c) ? state.hs.filter((x) => x !== c) : (state.hs.length < 5 ? [...state.hs, c] : (toast('Maksimal 5 kode HS', true), state.hs));
            draw();
          });
          return;
        }
        searchTimer = setTimeout(async () => {
          resultsBox.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px"><span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span>Mencari…</div>';
          try {
            const r = await api('/api/hs/search?q=' + encodeURIComponent(q), { timeout: 5000 });
            const rows = Array.isArray(r.results) ? r.results : [];
            if (!rows.length) {
              resultsBox.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px">Tidak ada HS code cocok. Coba kata kunci lain (bahasa Inggris juga OK).</div>';
              return;
            }
            resultsBox.innerHTML = rows.map((l) => `
              <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}">
                <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span>
                <div><b>${esc(l.description)}</b></div>
              </div>`).join('');
            resultsBox.querySelectorAll('.option-card[data-hs]').forEach((el) => el.onclick = () => {
              const c = el.dataset.hs;
              state.hs = state.hs.includes(c) ? state.hs.filter((x) => x !== c) : (state.hs.length < 5 ? [...state.hs, c] : (toast('Maksimal 5 kode HS', true), state.hs));
              draw();
            });
          } catch (err) {
            resultsBox.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px">Gagal cari HS. Coba lagi.</div>';
          }
        }, 250);
      });
    }
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
    if (!ME) ME = { email: 'guest@eksporin.id', name: 'Guest', onboarded: true, hs_focus: [], target_countries: [], plan: 'trial', plan_name: 'Trial', quotas: {}, unread_alerts: 0 };
  }
  ME = ME || {};
  // Ensure ME has all required fields with safe defaults — a partial ME (from
  // cold-start Supabase sync race) must never crash the dashboard render.
  ME.name = ME.name || (ME.email ? String(ME.email).split('@')[0] : 'User');
  ME.hs_focus = Array.isArray(ME.hs_focus) ? ME.hs_focus : [];
  ME.target_countries = Array.isArray(ME.target_countries) ? ME.target_countries : [];
  ME.plan = ME.plan || 'trial';
  ME.plan_name = ME.plan_name || 'Trial';
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
    { icon: '🧠', name: 'Kenali produk Anda', desc: 'Deskripsi produk dipetakan ke kode HS dan jenis buyer yang biasa membelinya.' },
    { icon: '🏢', name: 'Cari buyer di database', desc: 'Importir, distributor, dan pabrik pengolah dari daftar resmi dan website perusahaan.' },
    { icon: '✉️', name: 'Kontak terverifikasi', desc: 'Email dan telepon yang tercantum di website resmi perusahaan (halaman kontak / Impressum).' },
    { icon: '🎯', name: 'Prioritas & saran pendekatan', desc: 'Buyer diurutkan dari yang paling siap dihubungi, lengkap dengan saran cara menghubungi.' },
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
            <p class="muted body-sm">Tulis produk ekspor Anda. Kami carikan buyer luar negeri yang membeli produk itu, lengkap dengan kontak dari website resmi mereka.</p>
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
        ${interp.trade_manifest_keywords?.length ? `<div><div class="caption muted-3" style="margin-bottom:4px">Kata kunci produk</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${interp.trade_manifest_keywords.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div></div>` : ''}
      </div>
      <div class="card">
        <h3 style="margin-bottom:14px">Ringkasan Pencarian</h3>
        <div class="grid grid-2" style="gap:12px">
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg" style="color:var(--orange)">${r.total_leads}</div><div class="caption muted">Total Leads</div></div>
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg" style="color:var(--danger-text)">${r.leads.filter((l) => l.scoring.match_score >= 70).length}</div><div class="caption muted">Siap dihubungi</div></div>
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg" style="color:var(--success-text)">${r.leads.filter((l) => l.contacts && (l.contacts.email || l.contacts.phone)).length}</div><div class="caption muted">Punya kontak</div></div>
          <div style="background:var(--bg-surface-alt);border-radius:var(--radius-lg);padding:14px;text-align:center">
            <div class="numeric-lg">${new Set(r.leads.map((l) => l.company.country)).size}</div><div class="caption muted">Negara</div></div>
        </div>
      </div>
    </div>

    <!-- Leads -->
    <div class="card">
      <div class="card-header"><h3>Buyer untuk produk Anda</h3>
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
              </div>
              <p class="muted body-sm">${flag(lead.company.country)} ${esc(lead.company.country_name)}${lead.company.city ? ' · ' + esc(lead.company.city) : ''}${lead.company.industry ? ' · ' + esc(lead.company.industry) : ''}</p>
              ${lead.company.description ? `<p class="body-sm" style="margin-top:8px">${esc(lead.company.description)}</p>` : ''}
              <div class="caption muted-3" style="margin-top:8px">${esc(lead.scoring.reasoning)}</div>
            </div>
            <div style="min-width:280px">
              <div class="caption muted-3" style="margin-bottom:6px">Kontak</div>
              ${lead.contacts.email ? `<div class="body-sm" style="padding:4px 0">✉️ ${lead.contacts.masked ? `<span class="masked-chip">${esc(lead.contacts.email)} 🔒</span>` : `<a href="mailto:${esc(lead.contacts.email)}">${esc(lead.contacts.email)}</a>`}</div>` : ''}
              ${lead.contacts.phone ? `<div class="body-sm" style="padding:4px 0">📞 ${lead.contacts.masked ? `<span class="masked-chip">${esc(lead.contacts.phone)} 🔒</span>` : esc(lead.contacts.phone)}</div>` : ''}
              ${lead.contacts.website ? `<div class="body-sm" style="padding:4px 0">🌐 <a href="${esc(lead.contacts.website)}" target="_blank" rel="noopener">${esc(lead.company.domain || lead.contacts.website)}</a></div>` : ''}
              ${!lead.contacts.email && !lead.contacts.phone ? '<div class="caption muted" style="padding:4px 0">Email/telepon belum tersedia. Buka profil untuk mencari kontak.</div>' : ''}
              <a class="caption" href="${esc(lead.contacts.linkedin_search)}" target="_blank" rel="noopener" style="color:var(--orange)">Cari PIC pembelian di LinkedIn →</a>
              ${lead.contacts.masked && (lead.contacts.email || lead.contacts.phone) ? '<div class="caption muted-3" style="margin-top:6px">🔒 Buka kontak di profil buyer</div>' : ''}
            </div>
          </div>
          <div class="lead-pitch">
            <div class="caption muted-3" style="margin-bottom:4px">Saran pendekatan</div>
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
    sizes: [], activity: '', has: params.get('all') ? [] : ['any'], min_score: 0, sort: 'score', page: 1,
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
            ${[['score', 'Urut: Paling lengkap'], ['recent', 'Urut: Terbaru'], ['name', 'Urut: Nama A-Z']].map(([v, l]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <label class="chk" style="margin-bottom:12px"><input type="checkbox" id="f-contact" ${state.has.includes('any') ? 'checked' : ''}> Hanya buyer yang punya email / telepon</label>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>#</th><th>Buyer</th><th>Negara</th><th>Kontak</th><th>Produk</th><th>Skor</th><th></th></tr></thead><tbody>
          ${d.results.length ? d.results.map((b) => `<tr class="clickable ${b.blurred ? 'row-blurred' : ''}" ${b.blurred ? '' : `onclick="location.hash='#/buyer/${b.id}'"`}>
            <td class="muted num">${b.rank}</td>
            <td><b>${esc(b.name)}</b><div class="caption muted-3">${[b.city, b.buyer_type || b.industry].filter(Boolean).map(esc).join(' · ')}</div></td>
            <td>${flag(b.country)} ${esc(b.country_name || '')}</td>
            <td style="white-space:nowrap">
              <span title="Email" style="opacity:${b.has_email ? 1 : 0.2}">✉️</span>
              <span title="Telepon" style="opacity:${b.has_phone ? 1 : 0.2}">📞</span>
              <span title="Website" style="opacity:${b.has_website ? 1 : 0.2}">🌐</span></td>
            <td>${(b.hs_codes || []).slice(0, 3).map((h) => `<span class="tag" style="font-size:11px">${esc(String(h))}</span>`).join(' ')}</td>
            <td>${scorePill(b.score, b.score_label)}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();saveToList(${b.id})">+ Simpan</button></td></tr>`).join('')
          : `<tr><td colspan="7"><div class="empty"><div class="ic">🕵️</div><h3>Tidak ada hasil</h3>
              <p class="muted">${state.has.includes('any') ? 'Belum ada buyer dengan email/telepon untuk filter ini. Data kontak terus bertambah setiap hari.' : 'Coba perluas filter atau gunakan kode HS 4 digit (mis. 0901).'}</p>
              ${state.has.includes('any') ? '<button class="btn btn-sm btn-secondary" id="show-all">Tampilkan semua buyer</button>' : ''}</div></td></tr>`}
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
        ${chkGroup('Punya kontak', 'has', [['email', '✉️ Email'], ['phone', '📞 Telepon'], ['website', '🌐 Website']])}
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
    $('#f-contact').onchange = (e) => { state.has = e.target.checked ? [...new Set([...state.has, 'any'])] : state.has.filter((x) => x !== 'any'); requery(); };
    if ($('#show-all')) $('#show-all').onclick = () => { state.has = state.has.filter((x) => x !== 'any'); requery(); };
    $('#f-score').onchange = (e) => { state.min_score = +e.target.value; requery(); };
    $('#f-score').oninput = (e) => { $('#ms-val').textContent = e.target.value; };
    $('#f-reset').onclick = () => { Object.assign(state, { countries: [], sizes: [], activity: '', has: ['any'], min_score: 0, q: '', page: 1 }); draw(); };
    $('#pg-prev').onclick = () => { state.page--; draw(); };
    $('#pg-next').onclick = () => { state.page++; draw(); };
    $('#btn-export').onclick = async () => {
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
  const tabs = [['overview', 'Ringkasan'], ['products', 'Produk (HS)'], ['insights', 'Insight'], ['sources', 'Sumber Data'], ['notes', 'Catatan & Aktivitas']];
  const sources = Array.isArray(b.sources_seen) ? b.sources_seen : (b.source ? [b.source] : []);
  const sourceLabels = { usda_oid: 'USDA Organic', trade_directory: 'Direktori Importir', ai_agent: 'Riset Website', gleif: 'GLEIF LEI', companies_house_uk: 'Companies House UK', sirene_fr: 'SIRENE France', brreg_no: 'Brønnøysund (Norwegia)', agencebio_fr: 'Agence BIO (importir organik)', osm: 'OpenStreetMap (© kontributor OSM)', sec_edgar_us: 'SEC EDGAR', google_business: 'Google Business', kompass: 'Kompass', europages: 'Europages', wikidata: 'Wikidata' };
  const sourceChips = sources.map((s) => `<span class="pill pill-neutral" style="font-size:11px;margin-right:4px">${esc(sourceLabels[s] || s)}</span>`).join('');
  const verifPill = sources.length >= 2
    ? `<span class="pill pill-success">✓ Terverifikasi ${sources.length} sumber</span>`
    : `<span class="pill pill-neutral">1 sumber</span>`;
  const contactCount = (b.contacts || []).filter((c) => c.value && !c.masked).length;
  const header = `
    <div class="breadcrumb"><a href="#/cari">Cari Buyer</a><span class="sep">/</span><span>${esc(b.name)}</span></div>
    <div class="card" style="margin-bottom:24px"><div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
      <span class="avatar avatar-lg">${esc(b.name.slice(0, 2).toUpperCase())}</span>
      <div style="flex:1;min-width:240px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h1>${esc(b.name)}</h1>
          ${verifPill}</div>
        <p class="muted" style="margin:4px 0 10px">${flag(b.country)} ${esc(b.address || b.city || '')} · ${esc(b.country_name || b.country || '')}${b.industry ? ' · ' + esc(b.industry) : ''}${b.size_bucket ? ' · Ukuran ' + esc(b.size_bucket) : ''}</p>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div><div class="caption muted-3">Skor kelengkapan</div><b class="num">${b.quality_score || 0}/100</b></div>
          <div><div class="caption muted-3">Sumber data</div><b class="num">${sources.length}</b></div>
          <div><div class="caption muted-3">HS terkait</div><b class="num">${(b.hs_codes || []).length}</b></div>
          <div><div class="caption muted-3">Kontak</div><b class="num">${contactCount}</b></div>
          <div><div class="caption muted-3">Ditemukan</div><b class="num">${b.first_seen ? fmtDate(b.first_seen) : '-'}</b></div>
          <div><div class="caption muted-3">Terakhir update</div><b class="num">${b.last_updated ? fmtDate(b.last_updated) : '-'}</b></div>
        </div>
        <div style="margin-top:10px">${sourceChips}</div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="composeTo(${b.id})">${I.send} Kirim outreach</button>
          <button class="btn btn-secondary btn-sm" onclick="saveToList(${b.id})">+ Simpan ke daftar</button>
          ${b.website ? `<a class="btn btn-neutral btn-sm" href="${esc(b.website)}" target="_blank" rel="noopener">${I.globe} Website</a>` : ''}</div>
        ${b.in_lists.length ? `<p class="caption muted" style="margin-top:10px">Tersimpan di: ${b.in_lists.map((l) => `<a href="#/list/${l.id}">${esc(l.name)}</a> ${statusPill(l.status)}`).join(' · ')}</p>` : ''}
      </div>
      <div class="gauge-wrap" style="flex-direction:column;align-items:center">${gauge(b.quality_score || 0)}
        <span class="caption muted-3">Kelengkapan data</span></div>
    </div></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="tab-body"><div class="skeleton" style="height:220px"></div></div>`;
  app.innerHTML = shell(header);
  bindShell();
  $$('.tab').forEach((el) => el.onclick = () => { location.hash = `#/buyer/${id}?tab=${el.dataset.tab}`; });
  const body = $('#tab-body');

  if (tab === 'overview') {
    const desc = b.description ? `<div class="card" style="grid-column:1/-1"><h3 style="margin-bottom:8px">Tentang perusahaan</h3><p class="body-sm">${esc(b.description)}</p></div>` : '';
    const q = b.quality_score || 0;
    const hasEmail = b.contacts.some((c) => c.contact_type === 'email');
    const hasPhone = b.contacts.some((c) => c.contact_type === 'phone');
    const checks = [
      [!!b.website, 'Website resmi perusahaan'],
      [hasEmail, 'Email bisnis'],
      [hasPhone, 'Nomor telepon'],
      [!!(b.buyer_type || b.industry), 'Jenis usaha diketahui' + (b.buyer_type ? ` (${esc(b.buyer_type)})` : b.industry ? ` (${esc(b.industry)})` : '')],
      [sources.length >= 2, sources.length >= 2 ? `Ditemukan di ${sources.length} sumber berbeda` : 'Dikonfirmasi lebih dari 1 sumber'],
    ];
    const scorePanel = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <b class="num" style="font-size:32px">${q}</b>
        <div><div class="body-sm" style="font-weight:600">${q >= 70 ? 'Siap dihubungi' : q >= 45 ? 'Cukup lengkap' : 'Perlu dilengkapi'}</div>
        <div class="caption muted-3">Skor kelengkapan data (0–100)</div></div></div>
      <div class="admin-bar" style="margin-bottom:14px"><div style="width:${q}%;background:var(--orange)"></div></div>
      ${checks.map(([ok, label]) => `<div class="body-sm" style="padding:5px 0;display:flex;gap:8px;align-items:center"><span style="color:${ok ? 'var(--secondary-600)' : 'var(--text-tertiary)'}">${ok ? '✓' : '○'}</span>${label}</div>`).join('')}
      ${b.fit_score ? `<div class="caption muted-3" style="margin-top:10px">Kecocokan dengan produk Anda: <b>${b.fit_score}</b>/100</div>` : ''}`;
    const typeLabel = { email: 'Email', phone: 'Telepon', website: 'Website', linkedin: 'LinkedIn' };
    const statusLabel = { role: 'Email perusahaan', domain: 'Email domain perusahaan', personal: 'Email personal', freemail: 'Email publik' };
    const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const googleQ = encodeURIComponent(`"${b.name}" ${b.country_name || ''} contact email`);
    const liQ = encodeURIComponent(`${b.name} ${b.country_name || ''}`);
    const contactRows = b.contacts.map((c) => `
          <div style="padding:10px 0;border-bottom:1px dotted var(--border-subtle)">
            <div class="caption muted-3">${typeLabel[c.contact_type] || c.contact_type}${c.status ? ' · ' + (statusLabel[c.status] || '') : ''}</div>
            ${c.masked ? `<span class="masked-chip">${esc(c.value)} 🔒</span>`
              : c.contact_type === 'website' ? `<a href="${esc(c.value)}" target="_blank" rel="noopener">${esc(hostOf(c.value) || c.value)}</a>`
              : c.contact_type === 'email' ? `<a href="mailto:${esc(c.value)}"><b>${esc(c.value)}</b></a>`
              : c.contact_type === 'phone' ? `<a href="tel:${esc(String(c.value).replace(/[^\d+]/g, ''))}"><b>${esc(c.value)}</b></a>` : `<b>${esc(c.value)}</b>`}
            ${c.source_url ? `<div class="caption muted-3" style="margin-top:2px">Sumber: <a href="${esc(c.source_url)}" target="_blank" rel="noopener">${esc(c.source_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a></div>` : ''}
          </div>`).join('');
    const needContact = !hasEmail && !hasPhone;
    body.innerHTML = `<div class="grid grid-2">
      ${desc}
      <div class="card"><h3 style="margin-bottom:14px">Kontak</h3>
        ${contactRows}
        ${needContact ? `<div style="padding:${b.contacts.length ? '14px 0 0' : '0'}">
            <p class="body-sm" style="margin-bottom:10px">${b.contact_checked_at ? 'Email dan telepon belum ditemukan di website perusahaan.' : 'Email dan telepon belum tersedia untuk buyer ini.'}</p>
            <button class="btn btn-primary btn-sm" id="btn-find-contact">🔎 Cari kontak sekarang</button>
            <div class="caption muted-3" style="margin-top:10px">Atau cari manual:
              <a href="https://www.google.com/search?q=${googleQ}" target="_blank" rel="noopener">Google</a> ·
              <a href="https://www.linkedin.com/search/results/companies/?keywords=${liQ}" target="_blank" rel="noopener">LinkedIn</a></div>
          </div>` : ''}
        ${!b.contacts_visible && (hasEmail || hasPhone) ? (() => {
          const cp = b.contact_price || {};
          const how = cp.quota_left === null ? 'termasuk paket Anda'
            : cp.quota_left > 0 ? `pakai 1 kuota kontak (sisa ${cp.quota_left})`
            : `Rp${Number(cp.rate || 1000).toLocaleString('id-ID')} dari saldo (saldo Rp${Number(cp.balance || 0).toLocaleString('id-ID')})`;
          return `<div style="margin-top:14px"><button class="btn btn-primary btn-sm" id="btn-reveal">🔓 Buka kontak</button>
            <div class="caption muted-3" style="margin-top:6px">${how} · sekali bayar, kontak terbuka selamanya</div></div>`;
        })() : ''}
        ${hasEmail && b.contacts_visible ? `<div class="caption muted-3" style="margin-top:12px">Tips: kirim penawaran yang personal dan relevan untuk perusahaan ini, bukan email massal.</div>` : ''}</div>
      <div class="card"><h3 style="margin-bottom:14px">Kelengkapan data</h3>${scorePanel}</div>
      <div class="card" style="grid-column:1/-1"><h3 style="margin-bottom:14px">Produk yang dibeli</h3>
        ${(b.hs_codes || []).length ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${b.hs_codes.map((h) => `<span class="tag"><b>${(h.hs_code || h).replace(/^(\d{4})/, '$1.')}</b>${h.description_id ? ' · ' + esc(h.description_id) : ''}</span>`).join('')}</div>` : '<p class="muted body-sm">Belum ada data produk untuk buyer ini.</p>'}
        <p class="caption muted-3" style="margin-top:12px">Sumber data: ${sources.map((s) => sourceLabels[s] || s).join(', ') || '-'} · Diperbarui ${b.last_updated ? fmtDate(b.last_updated) : '-'}</p></div></div>`;
    const rv = $('#btn-reveal');
    if (rv) rv.onclick = async () => {
      rv.disabled = true; rv.textContent = 'Membuka…';
      try {
        const r = await api(`/api/buyers/${id}/reveal-contact`, { method: 'POST' });
        toast(r.already ? 'Kontak sudah terbuka' : r.charged ? `Kontak dibuka · Rp${Number(r.charged).toLocaleString('id-ID')} dari saldo` : 'Kontak dibuka ✓');
        syncBilling && syncBilling().catch(() => {});
        render();
      } catch (e) { rv.disabled = false; rv.textContent = '🔓 Buka kontak'; if (!e.handled) toast(e.message || e.data?.error || 'Gagal membuka kontak', true); }
    };
    const fc = $('#btn-find-contact');
    if (fc) fc.onclick = async () => {
      fc.disabled = true; fc.textContent = 'Mencari di website perusahaan… (±30 detik)';
      try {
        const r = await api(`/api/buyers/${id}/find-contact`, { method: 'POST' });
        if (r.found) { toast('Kontak ditemukan ✓'); render(); }
        else { toast(r.message || 'Kontak belum ditemukan di website perusahaan.', true); fc.textContent = 'Belum ditemukan'; }
      } catch (e) { toast(e.data?.error || 'Pencarian gagal, coba lagi nanti.', true); fc.disabled = false; fc.textContent = '🔎 Cari kontak sekarang'; }
    };
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
  } else if (tab === 'sources') {
    const srcLinks = {
      gleif: (id, name) => `https://search.gleif.org/#/record/${id}`,
      companies_house_uk: (id) => `https://find-and-update.company-information.service.gov.uk/company/${id}`,
      sirene_fr: (id) => `https://annuaire-entreprises.data.gouv.fr/entreprise/${id}`,
      sec_edgar_us: (id) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${id}`,
      wikidata: (id) => `https://www.wikidata.org/wiki/${id}`,
      ai_agent: () => (/^https?:\/\//i.test(b.evidence_url || '') ? b.evidence_url : null),
      usda_oid: () => (/^https?:\/\//i.test(b.evidence_url || '') ? b.evidence_url : 'https://organic.ams.usda.gov/integrity/'),
      trade_directory: () => (/^https?:\/\//i.test(b.evidence_url || '') ? b.evidence_url : null),
    };
    body.innerHTML = `<div class="card"><h3 style="margin-bottom:12px">Sumber data</h3>
      <p class="body-sm muted" style="margin-bottom:14px">Data buyer ini dikumpulkan dari sumber publik berikut. Jika perusahaan yang sama muncul di beberapa sumber, datanya digabung menjadi satu profil.</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${sources.length ? sources.map((s) => {
          const link = srcLinks[s]?.(b.source_id || b.id, b.name);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border-default);border-radius:10px">
            <div><b class="body-sm">${esc(sourceLabels[s] || s)}</b>
              <div class="caption muted-3">${s === 'gleif' ? 'LEI verified legal entity' :
                s === 'companies_house_uk' ? 'UK Companies House official registry' :
                s === 'sirene_fr' ? 'INSEE SIRENE (French national registry)' :
                s === 'sec_edgar_us' ? 'US SEC EDGAR filings' :
                s === 'wikidata' ? 'Wikidata linked open data' :
                s === 'ai_agent' ? `Diverifikasi dari website perusahaan${b.buyer_type ? ' · ' + esc(b.buyer_type) : ''}` :
                s === 'usda_oid' ? 'Daftar resmi pelaku usaha organik bersertifikat USDA' :
                s === 'trade_directory' ? 'Direktori importir dari lembaga promosi dagang' :
                s === 'google_business' ? 'Peta bisnis publik (OpenStreetMap)' : 'Data publik'}</div>
            </div>
            ${link ? `<a class="btn btn-sm btn-neutral" href="${esc(link)}" target="_blank" rel="noopener">Buka sumber →</a>` : ''}
          </div>`;
        }).join('') : '<p class="muted body-sm">Sumber tidak diketahui.</p>'}
      </div>
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border-default)">
        <div class="caption muted-3">Skor kelengkapan: <b>${b.quality_score || 0}/100</b> · Diperbarui ${b.last_updated ? fmtDate(b.last_updated) : '-'}</div>
      </div></div>`;
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
        ${!prev.contacts_visible && prev.to_email ? ' <span class="masked-chip">🔒 buka kontak di profil buyer dulu</span>' : ''}</p>`;
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
    ${d.locked ? `<div class="card empty"><div class="ic">🔔</div><h3>Alert tidak tersedia di status akun Anda</h3>
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
          <p class="muted body-sm" style="margin-bottom:12px">Cari HS code sesuai komoditas Anda dari 6.941 kode WCO lengkap, atau pilih dari daftar populer.</p>
          <div style="position:relative;margin-bottom:12px">
            <input class="input" id="s-hs-search" placeholder="Cari komoditas… (mis. vanili, coffee, rotan, batik)" autocomplete="off" style="padding-left:38px">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9a9a9a" stroke-width="1.5" style="position:absolute;left:12px;top:11px;pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <div id="s-hs-selected" style="display:${state.hs.length ? 'flex' : 'none'};flex-wrap:wrap;gap:6px;margin-bottom:12px">
            ${state.hs.map((code) => `<span class="pill pill-orange" style="cursor:pointer" data-remove-shs="${code}" title="Klik untuk hapus">${code.replace(/^(\d{4})/, '$1.')} ×</span>`).join('')}
          </div>
          <div id="s-hs-results" style="max-height:340px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
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
    // Chip remove for settings
    $$('[data-remove-shs]').forEach((el) => el.onclick = () => {
      state.hs = state.hs.filter((x) => x !== el.dataset.removeShs);
      draw();
    });
    // Live HS search on settings — same WCO nomenclature endpoint as onboarding
    const sSearch = $('#s-hs-search');
    const sResults = $('#s-hs-results');
    if (sSearch && sResults) {
      let sTimer = null;
      const rebindCards = () => {
        sResults.querySelectorAll('.option-card[data-hs]').forEach((el) => el.onclick = () => {
          const c = el.dataset.hs;
          if (state.hs.includes(c)) state.hs = state.hs.filter((x) => x !== c);
          else if (state.hs.length < 5) state.hs = [...state.hs, c];
          else return toast('Maksimal 5 kode HS. Hapus salah satu dulu.', true);
          draw();
        });
      };
      sSearch.addEventListener('input', (e) => {
        clearTimeout(sTimer);
        const q = e.target.value.trim();
        if (!q) {
          sResults.innerHTML = leaves.map((l) => `
            <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}" style="margin-bottom:0">
              <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span>
              <div><b>${esc(l.description_id)}</b><div class="caption muted">${esc(l.description_en)}</div></div>
            </div>`).join('');
          rebindCards();
          return;
        }
        sTimer = setTimeout(async () => {
          sResults.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px;grid-column:1/-1"><span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span>Mencari…</div>';
          try {
            const r = await api('/api/hs/search?q=' + encodeURIComponent(q), { timeout: 5000 });
            const rows = Array.isArray(r.results) ? r.results : [];
            if (!rows.length) {
              sResults.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px;grid-column:1/-1">Tidak ada HS code cocok. Coba kata kunci lain (Inggris juga OK).</div>';
              return;
            }
            sResults.innerHTML = rows.map((l) => `
              <div class="option-card ${state.hs.includes(l.code) ? 'selected' : ''}" data-hs="${l.code}" style="margin-bottom:0">
                <span class="hs-code-chip">${l.code.replace(/^(\d{4})/, '$1.')}</span>
                <div><b>${esc(l.description)}</b></div>
              </div>`).join('');
            rebindCards();
          } catch (err) {
            sResults.innerHTML = '<div class="empty muted body-sm" style="padding:20px 12px;grid-column:1/-1">Gagal cari HS. Coba lagi.</div>';
          }
        }, 250);
      });
    }
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
const METER_UI = {
  search: ['Pencarian buyer', 'pencarian'], profile: ['Buka profil buyer', 'profil'], contact: ['Buka kontak (email + telepon)', 'kontak'],
  find_contact: ['Cari kontak di website', 'pencarian kontak'], send: ['Kirim outreach', 'pesan'], export: ['Ekspor CSV', 'baris'],
};
const qty = (v, unit) => (v === null || v === undefined ? `${unit[0].toUpperCase()}${unit.slice(1)} tanpa batas` : v === 0 ? `${unit[0].toUpperCase()}${unit.slice(1)} pakai saldo` : `${nf.format(v)} ${unit}`);
function planFeatures(p) {
  const q = p.quotas;
  const out = [
    `${qty(q.search, 'pencarian')}`, `${qty(q.profile, 'profil buyer')}`, `${qty(q.contact, 'buka kontak')}`,
    `${qty(q.find_contact, 'cari kontak di website')}`, `${qty(q.send, 'kirim outreach')}`,
    q.export ? `Ekspor CSV ${nf.format(q.export)} baris` : 'Ekspor CSV pakai saldo',
    p.saved === null ? 'Simpan buyer tanpa batas' : `Simpan ${p.saved} buyer`,
    p.alerts === null ? 'Notifikasi tanpa batas' : `${p.alerts} notifikasi aktif`,
  ];
  if (p.competitor) out.push('Intel kompetitor Indonesia');
  return out;
}
async function startCheckout(body, btn) {
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Menyiapkan QRIS…'; }
  try {
    const r = await api('/api/billing/checkout', { method: 'POST', body });
    if (!r.payment_url) throw new Error('Link pembayaran tidak tersedia.');
    try { localStorage.setItem('eksporin_pending_payment', JSON.stringify({ order_id: r.order_id, at: Date.now() })); } catch {}
    toast('Mengarahkan ke halaman pembayaran QRIS…');
    window.location.href = r.payment_url;
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    if (!e.handled) toast(e.data?.error || e.message || 'Gagal membuat pembayaran.', true);
  }
}
window.openTopup = (preset) => {
  location.hash = '#/billing?topup=1' + (preset ? '&amount=' + preset : '');
};

route(/^\/billing$/, async (app, m, params) => {
  await requireMe();
  let d;
  try { d = await api('/api/billing/summary'); } catch (e) {
    app.innerHTML = shell(`<div class="empty"><h3>Gagal memuat tagihan</h3><p class="muted">${esc(e.data?.error || 'Coba lagi beberapa saat lagi.')}</p></div>`); bindShell(); return;
  }
  const a = d.account;
  ME.billing = a; ME.plan = a.plan; ME.plan_name = a.plan_name;
  const step = d.topup.step; const min = d.topup.min;
  const presetAmt = Math.max(min, Math.round((Number(params.get('amount')) || min) / step) * step);
  const statusPill = { paid: 'pill-success', pending: 'pill-warning', expired: 'pill-neutral', failed: 'pill-danger' };
  const statusText = { paid: 'Lunas', pending: 'Menunggu bayar', expired: 'Kedaluwarsa', failed: 'Gagal' };
  const reasonText = (r) => r === 'topup' ? 'Top-up saldo' : r.startsWith('usage:') ? 'Pemakaian: ' + (METER_UI[r.slice(6)]?.[0] || r.slice(6)) : r;
  const planCard = (p) => {
    const isCur = a.active && a.plan === p.code;
    return `<div class="plan-card ${isCur ? 'current' : ''} ${p.code === 'growth' ? 'featured' : ''}">
      <div class="overline">${esc(p.name)}${p.code === 'growth' ? ' · paling populer' : ''}</div>
      <div class="pr num">${fmtIDR(p.price)}</div>
      <div class="caption muted-3">per ${p.days} hari · bayar sekali via QRIS, tanpa perpanjang otomatis</div>
      <ul>${planFeatures(p).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <button class="btn ${isCur ? 'btn-neutral' : 'btn-upgrade'}" data-plan="${p.code}">${isCur ? 'Perpanjang 30 hari' : 'Beli paket'}</button></div>`;
  };
  app.innerHTML = shell(`
    <h1 style="margin-bottom:4px">Paket & Saldo</h1>
    <p class="muted" style="margin-bottom:20px">Bayar dengan QRIS (GoPay, OVO, DANA, ShopeePay, LinkAja, m-Banking). Paket berlaku ${d.plans[0]?.days || 30} hari dan tidak diperpanjang otomatis.</p>
    ${!d.gateway_ready ? '<div class="banner banner-warning" style="margin-bottom:16px">Pembayaran sedang dalam pemeliharaan. Coba beberapa saat lagi.</div>' : ''}
    <div class="grid grid-2" style="margin-bottom:24px">
      <div class="card">
        <div class="caption muted-3">Paket aktif</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:4px 0 6px"><h2 style="margin:0">${esc(a.plan_name)}</h2>
          ${a.active ? `<span class="pill pill-success">${a.days_left} hari lagi</span>` : '<span class="pill pill-danger">Tidak aktif</span>'}</div>
        <div class="caption muted">${a.active ? 'Berlaku sampai ' + fmtDate(a.expires_at) : 'Beli paket atau gunakan saldo untuk melanjutkan.'}</div>
      </div>
      <div class="card">
        <div class="caption muted-3">Saldo</div>
        <div class="numeric-lg num" style="margin:4px 0 6px">${fmtIDR(a.balance)}</div>
        <div class="caption muted">Dipakai otomatis saat kuota paket habis atau paket tidak aktif.</div>
        <button class="btn btn-primary btn-sm" style="margin-top:12px" id="btn-topup-open">+ Isi saldo</button>
      </div>
    </div>
    <div class="card" id="topup-card" style="margin-bottom:24px;${params.get('topup') ? '' : 'display:none'}">
      <h3 style="margin-bottom:6px">Isi saldo</h3>
      <p class="caption muted" style="margin-bottom:14px">Minimal ${fmtIDR(min)}, kelipatan ${fmtIDR(step)}, maksimal ${fmtIDR(d.topup.max)} per transaksi.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${[10000, 20000, 50000, 100000, 200000].map((v) => `<button class="btn btn-sm btn-neutral" data-amt="${v}">${fmtIDR(v)}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-neutral btn-sm" id="amt-minus" aria-label="Kurangi">−</button>
        <input class="input num" id="topup-amt" type="number" min="${min}" step="${step}" value="${presetAmt}" style="max-width:180px;text-align:center">
        <button class="btn btn-neutral btn-sm" id="amt-plus" aria-label="Tambah">+</button>
        <button class="btn btn-primary" id="btn-topup-pay">Bayar via QRIS</button>
      </div>
      <div class="caption" id="topup-err" style="color:var(--danger-text);margin-top:8px"></div>
    </div>
    <h3 style="margin-bottom:12px">Pilih paket</h3>
    <div class="plan-grid">${d.plans.map(planCard).join('')}</div>
    <div class="grid grid-2" style="margin-top:24px">
      <div class="card"><h3 style="margin-bottom:12px">Kuota ${a.active ? 'paket ' + esc(a.plan_name) : ''}</h3>
        ${Object.entries(METER_UI).map(([k, [lbl]]) => { const q = a.quotas[k];
          const lim = q.limit === null ? '∞' : nf.format(q.limit);
          const pct = q.limit ? Math.min(100, Math.round(q.used / q.limit * 100)) : 0;
          return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between" class="body-sm"><span>${lbl}</span><b class="num">${nf.format(q.used)} / ${lim}</b></div>
            ${q.limit ? `<div class="admin-bar"><div style="width:${pct}%;background:var(--orange)"></div></div>` : ''}</div>`; }).join('')}
      </div>
      <div class="card"><h3 style="margin-bottom:4px">Tarif pakai saldo</h3>
        <p class="caption muted" style="margin-bottom:12px">Berlaku setelah kuota paket habis atau paket tidak aktif.</p>
        <table class="tbl"><tbody>${Object.entries(METER_UI).map(([k, [lbl, unit]]) => `<tr><td class="body-sm">${lbl}</td><td class="r num">${fmtIDR(d.rates[k])} / ${unit}</td></tr>`).join('')}</tbody></table>
        <p class="caption muted-3" style="margin-top:10px">Kontak yang sudah dibuka tidak ditagih lagi. "Cari kontak" hanya ditagih jika email/telepon baru ditemukan.</p>
      </div>
    </div>
    <div class="card" style="margin-top:24px"><h3 style="margin-bottom:12px">Riwayat pembayaran</h3>
      ${d.orders.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Keterangan</th><th class="r">Jumlah</th><th>Status</th><th></th></tr></thead><tbody>
        ${d.orders.map((o) => `<tr><td class="body-sm">${fmtDate(o.created_at)}</td><td class="body-sm">${o.kind === 'plan' ? 'Paket ' + esc((d.plans.find((p) => p.code === o.plan) || {}).name || o.plan) : 'Top-up saldo'}<div class="caption muted-3">${esc(o.order_id)}</div></td>
          <td class="r num">${fmtIDR(o.amount_idr)}</td><td><span class="pill ${statusPill[o.status] || 'pill-neutral'}">${statusText[o.status] || o.status}</span></td>
          <td>${o.status === 'pending' && o.payment_url ? `<a class="btn btn-sm btn-neutral" href="${esc(o.payment_url)}">Bayar</a> <button class="btn btn-sm btn-ghost" data-verify="${esc(o.order_id)}">Cek status</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted body-sm">Belum ada pembayaran.</p>'}
    </div>
    <div class="card" style="margin-top:24px"><h3 style="margin-bottom:12px">Mutasi saldo</h3>
      ${d.ledger.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Keterangan</th><th class="r">Perubahan</th><th class="r">Saldo</th></tr></thead><tbody>
        ${d.ledger.map((l) => `<tr><td class="body-sm">${fmtDate(l.created_at)}</td><td class="body-sm">${esc(reasonText(l.reason))}</td>
          <td class="r num" style="color:${Number(l.delta_idr) >= 0 ? 'var(--secondary-600)' : 'var(--text-primary)'}">${Number(l.delta_idr) >= 0 ? '+' : '−'}${fmtIDR(Math.abs(Number(l.delta_idr)))}</td><td class="r num">${fmtIDR(Number(l.balance_after))}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted body-sm">Belum ada mutasi saldo.</p>'}
    </div>`);
  bindShell();
  const amtEl = $('#topup-amt');
  const norm = (v) => Math.min(d.topup.max, Math.max(min, Math.round(v / step) * step));
  const validate = () => {
    const v = Number(amtEl.value);
    const msg = !Number.isInteger(v) ? 'Nominal harus angka bulat.' : v < min ? `Minimal ${fmtIDR(min)}.` : v % step ? `Harus kelipatan ${fmtIDR(step)}.` : v > d.topup.max ? `Maksimal ${fmtIDR(d.topup.max)}.` : '';
    $('#topup-err').textContent = msg; return !msg;
  };
  $('#btn-topup-open').onclick = () => { $('#topup-card').style.display = ''; $('#topup-card').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  $$('[data-amt]').forEach((el) => el.onclick = () => { amtEl.value = el.dataset.amt; validate(); });
  $('#amt-minus').onclick = () => { amtEl.value = norm(Number(amtEl.value || min) - step); validate(); };
  $('#amt-plus').onclick = () => { amtEl.value = norm(Number(amtEl.value || min) + step); validate(); };
  amtEl.oninput = validate;
  amtEl.onblur = () => { if (amtEl.value) { amtEl.value = norm(Number(amtEl.value)); validate(); } };
  $('#btn-topup-pay').onclick = (e) => { if (validate()) startCheckout({ kind: 'topup', amount: Number(amtEl.value) }, e.target); };
  $$('[data-plan]').forEach((el) => el.onclick = () => {
    const p = d.plans.find((x) => x.code === el.dataset.plan);
    const extend = a.active && a.plan === p.code;
    modal(`<h2 style="margin-bottom:10px">${extend ? 'Perpanjang' : 'Beli'} paket ${esc(p.name)}</h2>
      <div class="card card-compact" style="margin-bottom:16px;background:var(--bg-surface-alt)">
        <div style="display:flex;justify-content:space-between"><span>Paket ${esc(p.name)} · ${p.days} hari</span><b class="num">${fmtIDR(p.price)}</b></div>
        <div class="caption muted-3" style="margin-top:6px">${extend ? `Masa aktif ditambah ${p.days} hari dari tanggal berakhir sekarang; kuota diisi ulang.` : a.active && a.plan !== p.code ? `Paket ${esc(a.plan_name)} Anda diganti mulai hari ini; sisa hari paket lama tidak dibawa.` : `Aktif langsung setelah pembayaran berhasil.`} Saldo Anda tidak berubah.</div></div>
      <button class="btn btn-primary" id="pay-now" style="width:100%">Bayar ${fmtIDR(p.price)} via QRIS</button>`);
    $('#pay-now').onclick = (e) => startCheckout({ kind: 'plan', plan: p.code }, e.target);
  });
  const verify = async (orderId, quiet) => {
    for (let i = 0; i < (quiet ? 1 : 8); i++) {
      try {
        const v = await api('/api/billing/verify', { method: 'POST', body: { order_id: orderId } });
        if (v.paid) {
          try { localStorage.removeItem('eksporin_pending_payment'); } catch {}
          toast(v.kind === 'topup' ? `Saldo bertambah ${fmtIDR(v.amount)} ✓` : `Paket ${v.account.plan_name} aktif sampai ${fmtDate(v.account.expires_at)} ✓`);
          ME = null; location.hash = '#/billing'; render(); return true;
        }
        if (v.status === 'expired' || v.status === 'failed') { toast('Tagihan ' + (v.status === 'expired' ? 'kedaluwarsa' : 'gagal') + '.', true); return false; }
      } catch (e) { if (e.status === 404) return false; }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!quiet) toast('Pembayaran belum terkonfirmasi. Jika QRIS sudah dibayar, tekan "Cek status" sebentar lagi.', true);
    return false;
  };
  $$('[data-verify]').forEach((el) => el.onclick = async () => { el.disabled = true; await verify(el.dataset.verify, false); el.disabled = false; });
  // Returned from the QRIS page: confirm the payment.
  const back = params.get('order');
  let pending = null; try { pending = JSON.parse(localStorage.getItem('eksporin_pending_payment') || 'null'); } catch {}
  if (params.get('cancelled') === '1') toast('Pembayaran dibatalkan.', true);
  else if (back || (params.get('paid') === '1' && pending)) { toast('Memeriksa pembayaran…'); verify(back || pending.order_id, false); }
});

// boot: if a Supabase session exists in localStorage (returning user),
// sync it to the local backend BEFORE the router runs so protected APIs work.
// ================= admin shell (separate from user shell) =================
const ADMIN_TABS = [
  { id: 'overview',  label: 'Overview',        icon: I.chart },
  { id: 'users',     label: 'Users',           icon: I.users },
  { id: 'buyers',    label: 'Buyer Inventory', icon: I.building },
  { id: 'scrape',    label: 'Scrape Pipeline', icon: I.spider },
  { id: 'shipments', label: 'Shipments',       icon: I.ship },
  { id: 'messages',  label: 'Outreach',        icon: I.send },
  { id: 'revenue',   label: 'Revenue',         icon: I.money },
  { id: 'hs-usage',  label: 'HS & Countries',  icon: I.globe },
  { id: 'system',    label: 'System',          icon: I.settings },
  { id: 'audit',     label: 'Audit Log',       icon: I.clipboard },
];

function adminShell(activeTab, content) {
  const u = ME;
  return `<div class="admin-shell">
    <div class="sidebar-backdrop" id="admin-backdrop"></div>
    <aside class="admin-side" id="admin-side">
      <button class="sidebar-close" id="admin-side-close" aria-label="Tutup menu">${I.x}</button>
      <div class="admin-side-brand">
        <div class="admin-side-logo">🛡</div>
        <div>
          <b>EksporIn</b>
          <div class="admin-side-role">Super Admin</div>
        </div>
      </div>
      <div class="admin-side-user">
        <div class="admin-side-avatar">${esc((u.name || '?').split(' ').map((x) => x[0]).slice(0,2).join('').toUpperCase())}</div>
        <div style="min-width:0">
          <div class="admin-side-name">${esc(u.name || '')}</div>
          <div class="admin-side-email">${esc(u.email || '')}</div>
        </div>
      </div>
      <nav class="admin-nav">
        ${ADMIN_TABS.map((t) => `<a class="admin-nav-item ${activeTab === t.id ? 'active' : ''}" href="#/admin?tab=${t.id}">
          <span class="admin-nav-ic">${t.icon}</span><span>${t.label}</span>
        </a>`).join('')}
      </nav>
      <div class="admin-side-foot">
        <a href="#/dashboard" class="admin-side-back">← Kembali ke user app</a>
        <a href="#" id="admin-logout" class="admin-side-logout">Keluar</a>
      </div>
    </aside>
    <main class="admin-main">
      <header class="admin-topbar">
        <button class="topbar-menu" id="admin-menu" aria-label="Menu">${I.menu}</button>
        <div class="admin-topbar-left">
          <div class="admin-crumb">Admin Console</div>
          <h1 class="admin-h1">${esc(ADMIN_TABS.find((t) => t.id === activeTab)?.label || 'Admin')}</h1>
        </div>
        <div class="admin-topbar-right">
          <span class="admin-pill">${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</span>
        </div>
      </header>
      <div class="admin-content">${content}</div>
    </main>
  </div>`;
}

function bindAdminShell() {
  document.getElementById('admin-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    // Explicit logout only: clear the stateless admin token, the local
    // session cookie, and any Supabase session. Anywhere else in the app
    // that catches a 401 leaves the token alone.
    try { localStorage.removeItem('eksporin_admin_token'); } catch {}
    if (window.sb) { try { await window.sb.auth.signOut(); } catch {} }
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    ME = null; location.hash = '#/';
  });
  const side = document.getElementById('admin-side');
  const backdrop = document.getElementById('admin-backdrop');
  const open = () => { side?.classList.add('open'); backdrop?.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { side?.classList.remove('open'); backdrop?.classList.remove('open'); document.body.style.overflow = ''; };
  document.getElementById('admin-menu')?.addEventListener('click', open);
  document.getElementById('admin-side-close')?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  document.querySelectorAll('.admin-side .admin-nav-item').forEach((el) => el.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 900px)').matches) close();
  }));
}

route(/^\/admin\/login$/, (app) => {
  app.innerHTML = `<div class="admin-login-page">
    <div class="admin-login-card">
      <div class="admin-login-brand">
        <div class="admin-login-logo">${I.chart}</div>
        <div>
          <div class="admin-login-title">EksporIn</div>
          <div class="admin-login-eyebrow">SUPER ADMIN CONSOLE</div>
        </div>
      </div>
      <h2 class="admin-login-h">Masuk sebagai admin</h2>
      <p class="admin-login-sub">Akses terbatas untuk tim internal.</p>
      <form id="admin-lf">
        <div class="field"><label>Email admin</label><input class="input" name="email" type="email" required placeholder="admin@…" autocomplete="username"></div>
        <div class="field"><label>Password</label><input class="input" name="password" type="password" required placeholder="••••••••" autocomplete="current-password"></div>
        <button class="btn btn-primary" style="width:100%">Masuk ke Admin Console</button>
      </form>
      <div class="admin-login-foot"><a href="#/">← Kembali ke situs</a></div>
    </div>
  </div>`;
  document.getElementById('admin-lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const btn = e.target.querySelector('button');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Memverifikasi…';
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      if (!r.is_admin || !r.admin_token) {
        toast('Akun ini bukan admin.', true);
        btn.disabled = false; btn.textContent = orig;
        return;
      }
      try { localStorage.setItem('eksporin_admin_token', r.admin_token); } catch {}
      ME = null;
      location.hash = '#/admin';
    } catch (err) {
      toast(err.data?.error || 'Email atau password salah.', true);
      btn.disabled = false; btn.textContent = orig;
    }
  });
});

route(/^\/admin$/, async (app, m, params) => {
  // Custom auth guard: unauthenticated → dedicated admin login (not user login).
  // If we have a stored admin token, keep the admin logged in even when
  // /api/me temporarily fails (Vercel cold start, dropped connection, ...).
  const hasAdminToken = (() => { try { return !!localStorage.getItem('eksporin_admin_token'); } catch { return false; } })();
  if (!ME) {
    try { ME = await api('/api/me'); }
    catch {
      if (!hasAdminToken) { location.hash = '#/admin/login'; return; }
      // Fallback: synthesize a minimal admin ME so the page still mounts.
      ME = { id: 0, email: '(admin)', name: 'Super Admin', is_admin: true, plan: 'business', onboarded: true, hs_focus: [], target_countries: [] };
    }
  }
  if (!ME.is_admin) {
    app.innerHTML = `<div class="admin-login-page"><div class="admin-login-card" style="text-align:center">
      <div class="admin-login-logo" style="margin:0 auto 16px">${I.lock || '🔒'}</div>
      <h2 class="admin-login-h">Akses ditolak</h2>
      <p class="admin-login-sub">Akun kamu bukan super admin.</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
        <a class="btn btn-outline" href="#/admin/login">Masuk sebagai admin lain</a>
        <a class="btn btn-primary" href="#/dashboard">Ke dashboard user</a>
      </div>
    </div></div>`;
    return;
  }
  const tab = params.get('tab') || 'overview';
  const draw = (content) => { app.innerHTML = adminShell(tab, content); bindAdminShell(); };
  draw('<div class="admin-loading"><div class="spinner"></div> Memuat data admin…</div>');

  try {
    if (tab === 'overview') {
      // Fetch stats + optional Postgres scrape summary in parallel.
      const [s, scrapeStatus] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/scrape/status').catch(() => null),
      ]);
      const plansBar = s.users.by_plan.map((p) => {
        const pct = s.users.total ? (p.c / s.users.total) * 100 : 0;
        const color = { trial: '#9ca3af', expired: '#d1d5db', hemat: '#3b82f6', growth: '#ef4d23', business: '#7c3aed' }[p.plan] || '#9ca3af';
        return `<div class="admin-bar-row">
          <span class="body-sm" style="text-transform:capitalize;font-weight:500">${esc(p.plan)}</span>
          <div class="admin-bar"><div style="width:${pct}%;background:${color}"></div></div>
          <b class="num body-sm" style="text-align:right">${p.c} <span class="muted-3">(${pct.toFixed(0)}%)</span></b>
        </div>`;
      }).join('');
      const scrapePending = scrapeStatus?.jobs_by_status?.find((r) => r.status === 'pending')?.c || 0;
      const scrapeDone = scrapeStatus?.jobs_by_status?.find((r) => r.status === 'done')?.c || 0;
      draw(`
        <div class="admin-kpi-grid">
          <div class="admin-kpi"><div class="admin-kpi-lbl">Total Users</div><div class="admin-kpi-num">${fmtN(s.users.total)}</div><div class="admin-kpi-hint">${s.users.onboarded} onboarded · ${s.users.admins} admin</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Signup (7 hari)</div><div class="admin-kpi-num">${fmtN(s.users.recent_7d)}</div><div class="admin-kpi-hint">${s.users.recent_30d} dalam 30 hari</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Outreach Sent</div><div class="admin-kpi-num">${fmtN(s.engagement.messages_sent)}</div><div class="admin-kpi-hint">${s.engagement.messages_replied} dibalas (${s.engagement.messages_sent ? Math.round((s.engagement.messages_replied / s.engagement.messages_sent) * 100) : 0}%)</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Buyer Tersimpan</div><div class="admin-kpi-num">${fmtN(s.engagement.saved_buyers)}</div><div class="admin-kpi-hint">di ${s.engagement.lists} daftar</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Buyer Terscrape</div><div class="admin-kpi-num">${fmtN(scrapeStatus?.total_buyers || 0)}</div><div class="admin-kpi-hint">${scrapeDone} job selesai</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Scrape Queue</div><div class="admin-kpi-num">${fmtN(scrapePending)}</div><div class="admin-kpi-hint">job pending</div></div>
        </div>
        <div class="admin-grid-2">
          <div class="admin-panel">
            <h3>Distribusi Paket</h3>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">${plansBar}</div>
          </div>
          <div class="admin-panel">
            <h3>Usage Bulan Ini</h3>
            <div style="margin-top:14px">
              ${s.usage_this_month.length ? s.usage_this_month.map((u) => `<div class="admin-list-row"><span style="text-transform:capitalize">${esc(u.meter)}</span><b>${fmtN(u.total)}</b></div>`).join('') : '<p class="muted body-sm">Belum ada aktivitas.</p>'}
            </div>
          </div>
        </div>
        <div class="admin-panel" style="margin-top:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0">Aktivitas Terbaru <span class="pill pill-neutral" style="font-size:10px;margin-left:6px">LIVE</span></h3>
            <span class="caption muted-3" id="feed-updated">Memuat…</span>
          </div>
          <div id="feed-list" style="max-height:520px;overflow:auto">
            <p class="muted body-sm" style="padding:12px">Memuat aktivitas…</p>
          </div>
        </div>
      `);
      // Render + auto-refresh the live activity feed every 10s.
      const KIND_STYLE = {
        'user.signup':        { pill: 'pill-info',    icon: '👤' },
        'outreach.sent':      { pill: 'pill-warning', icon: '✉️' },
        'buyer.discovered':   { pill: 'pill-success', icon: '🔍' },
        'buyer.enriched':     { pill: 'pill-success', icon: '✨' },
        'buyer.updated':      { pill: 'pill-neutral', icon: '♻️' },
        'scrape.job.done':    { pill: 'pill-success', icon: '✓' },
        'scrape.job.failed':  { pill: 'pill-danger',  icon: '⚠️' },
        'scrape.job.running': { pill: 'pill-warning', icon: '⚙️' },
      };
      const renderFeed = async () => {
        try {
          const { events } = await api('/api/admin/activity');
          const now = Date.now();
          const fmtRel = (ts) => {
            const t = new Date(ts).getTime();
            const s = Math.max(1, Math.round((now - t) / 1000));
            if (s < 60) return s + ' dtk';
            if (s < 3600) return Math.round(s / 60) + ' mnt';
            if (s < 86400) return Math.round(s / 3600) + ' jam';
            return Math.round(s / 86400) + ' hari';
          };
          const el = document.getElementById('feed-list');
          const upd = document.getElementById('feed-updated');
          if (!el) return;
          el.innerHTML = events.length ? events.map((e) => {
            const style = KIND_STYLE[e.kind] || { pill: 'pill-neutral', icon: '•' };
            return `<div class="admin-feed-row">
              <div class="admin-feed-icon">${style.icon}</div>
              <div class="admin-feed-body">
                <div class="body-sm">${esc(e.title)}</div>
                <div class="caption muted-3"><span class="pill ${style.pill}" style="font-size:9px">${esc(e.kind)}</span> · ${fmtRel(e.ts)} lalu</div>
              </div>
            </div>`;
          }).join('') : '<p class="muted body-sm" style="padding:12px">Belum ada aktivitas tercatat.</p>';
          if (upd) upd.textContent = 'Update ' + new Date().toLocaleTimeString('id-ID');
        } catch (_e) { /* keep last state */ }
      };
      clearInterval(window.__adminFeedTimer);
      renderFeed();
      window.__adminFeedTimer = setInterval(() => { if (parseHash().path === '/admin' && (params.get('tab') || 'overview') === 'overview') renderFeed(); else clearInterval(window.__adminFeedTimer); }, 10000);
    } else if (tab === 'users') {
      const q = params.get('q') || '';
      const d = await api('/api/admin/users?q=' + encodeURIComponent(q));
      draw(`
        <div class="admin-toolbar">
          <input class="input" id="admin-uq" placeholder="Cari email / nama / usaha…" value="${esc(q)}" style="max-width:360px">
          <span class="admin-count">${d.users.length} user ditampilkan</span>
        </div>
        <div class="admin-panel" style="padding:0;overflow:hidden">
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>User</th><th>Plan</th><th>Status</th><th class="r">Lists</th><th class="r">Outreach</th><th>Signup</th><th>Aksi</th></tr></thead>
            <tbody>
            ${d.users.map((u) => `<tr>
              <td>
                <b>${esc(u.name)}</b>${u.is_admin ? ' <span class="pill pill-orange" style="font-size:10px">ADMIN</span>' : ''}
                <div class="caption muted-3">${esc(u.email)}${u.org_name ? ' · ' + esc(u.org_name) : ''}</div>
              </td>
              <td>
                <select class="input" data-plan-user="${u.id}" style="height:30px;padding:2px 8px;font-size:12px;min-width:100px">
                  ${u.plan === 'expired' ? '<option value="" selected disabled>expired</option>' : ''}
                  ${['trial', 'hemat', 'growth', 'business'].map((p) => `<option value="${p}" ${u.plan === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
                ${u.balance_idr ? `<div class="caption muted-3">Saldo Rp${Number(u.balance_idr).toLocaleString('id-ID')}</div>` : ''}
              </td>
              <td>
                <select class="input" data-status-user="${u.id}" style="height:30px;padding:2px 8px;font-size:12px;min-width:110px">
                  ${['active', 'suspended', 'banned'].map((s) => `<option value="${s}" ${(u.status || 'active') === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
              <td class="r num">${fmtN(u.list_count)}</td>
              <td class="r num">${fmtN(u.message_count)}</td>
              <td class="caption num body-sm">${fmtDate(u.created_at)}</td>
              <td>${u.is_admin ? '<span class="muted-3 caption">-</span>' : `<button class="btn btn-sm btn-danger" data-del-user="${u.id}" data-email="${esc(u.email)}">Hapus</button>`}</td>
            </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `);
      $('#admin-uq')?.addEventListener('input', (e) => { clearTimeout(window.__auq); window.__auq = setTimeout(() => { location.hash = '#/admin?tab=users&q=' + encodeURIComponent(e.target.value); }, 400); });
      $$('[data-plan-user]').forEach((el) => el.onchange = async () => { try { await api('/api/admin/user/plan', { method: 'POST', body: { user_id: +el.dataset.planUser, plan: el.value } }); toast('Plan updated ✓'); } catch (e) { toast(e.data?.error || 'Fail', true); } });
      $$('[data-status-user]').forEach((el) => el.onchange = async () => { try { await api('/api/admin/user/status', { method: 'POST', body: { user_id: +el.dataset.statusUser, status: el.value } }); toast('Status updated ✓'); } catch (e) { toast(e.data?.error || 'Fail', true); } });
      $$('[data-del-user]').forEach((el) => el.onclick = () => {
        modal(`<h2 style="margin-bottom:10px">Hapus user?</h2><p class="muted" style="margin-bottom:20px">"${el.dataset.email}" akan dihapus permanen bersama semua data-nya.</p>
          <div style="display:flex;gap:8px"><button class="btn btn-danger" id="cd-yes">Ya, hapus</button><button class="btn btn-neutral" onclick="closeModal()">Batal</button></div>`);
        $('#cd-yes').onclick = async () => { try { await api('/api/admin/user?id=' + el.dataset.delUser, { method: 'DELETE' }); closeModal(); toast('User dihapus'); location.hash = '#/admin?tab=users&t=' + Date.now(); } catch (e) { toast(e.data?.error || 'Fail', true); } };
      });
    } else if (tab === 'buyers') {
      const country = params.get('c') || '';
      const search = params.get('q') || '';
      const d = await api('/api/admin/buyers?q=' + encodeURIComponent(search) + '&country=' + encodeURIComponent(country));
      draw(`
        <div class="admin-toolbar">
          <input class="input" id="admin-bq" placeholder="Cari nama / kota buyer…" value="${esc(search)}" style="max-width:280px">
          <select class="input" id="admin-bc" style="max-width:220px">
            <option value="">Semua negara</option>
            ${d.countries.map((c) => `<option value="${c.country}" ${country === c.country ? 'selected' : ''}>${flag(c.country)} ${esc(c.name)} (${c.c})</option>`).join('')}
          </select>
          <span class="admin-count">${d.buyers.length} buyer</span>
        </div>
        <div class="admin-panel" style="padding:0;overflow:hidden">
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Buyer</th><th>Negara</th><th>Industri</th><th class="r">Ship 12bln</th><th class="r">Value USD</th><th class="r">Skor</th><th class="r">Disimpan</th><th>HS Codes</th></tr></thead>
            <tbody>
            ${d.buyers.map((b) => `<tr>
              <td><b class="body-sm">${esc(b.name)}</b>${b.has_indonesian_supplier ? ' <span class="pill pill-info" style="font-size:10px">🇮🇩</span>' : ''}<div class="caption muted-3">${esc(b.city || '')} · ${b.size_bucket}</div></td>
              <td>${flag(b.country)} ${esc(COUNTRY_NAMES[b.country] || b.country)}</td>
              <td class="body-sm muted">${esc(b.industry || '-')}</td>
              <td class="r num">${fmtN(b.shipments_12mo)}</td>
              <td class="r num">${fmtUSD(b.value_12mo_usd)}</td>
              <td class="r"><span class="pill ${b.base_score >= 80 ? 'pill-danger' : b.base_score >= 60 ? 'pill-warning' : 'pill-neutral'}" style="font-size:11px">${b.base_score}</span></td>
              <td class="r num">${b.times_saved}</td>
              <td class="caption body-sm">${(b.hs_codes || '').split(',').slice(0,3).map((h) => `<span class="tag">${h}</span>`).join(' ')}</td>
            </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `);
      $('#admin-bq')?.addEventListener('input', (e) => { clearTimeout(window.__abq); window.__abq = setTimeout(() => { location.hash = '#/admin?tab=buyers&q=' + encodeURIComponent(e.target.value) + '&c=' + encodeURIComponent(country); }, 400); });
      $('#admin-bc')?.addEventListener('change', (e) => { location.hash = '#/admin?tab=buyers&q=' + encodeURIComponent(search) + '&c=' + encodeURIComponent(e.target.value); });
    } else if (tab === 'scrape') {
      // Data source discovery pipeline: reads from Postgres (Supabase).
      let status = null, buyers = [];
      try {
        [status, buyers] = await Promise.all([
          api('/api/admin/scrape/status'),
          api('/api/admin/scrape/buyers?limit=50').then((r) => r.buyers || []),
        ]);
      } catch (e) {
        draw(`<div class="admin-panel"><h3 style="margin-bottom:8px">Pipeline belum siap</h3>
          <p class="muted body-sm">${esc(e.data?.detail || e.message || 'Postgres tidak dapat diakses.')}</p>
          <p class="caption muted-3" style="margin-top:8px">Pastikan env <code>DATABASE_URL_POSTGRESS</code> tersedia dan migration sudah dijalankan.</p></div>`);
        return;
      }
      const statusBy = (s) => (status.jobs_by_status.find((r) => r.status === s)?.c || 0);
      const bySrcMap = Object.fromEntries(status.by_source.map((r) => [r.source, r.c]));
      const live = status.live || {};
      draw(`
        <div class="admin-kpi-grid">
          <div class="admin-kpi"><div class="admin-kpi-lbl">Total Buyer</div><div class="admin-kpi-num">${fmtN(status.total_buyers)}</div><div class="admin-kpi-hint">${fmtN(live.enriched || 0)} enriched · ${fmtN(live.unenriched || 0)} raw</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Baru 1 Jam</div><div class="admin-kpi-num">${fmtN(live.new_1h || 0)}</div><div class="admin-kpi-hint">${fmtN(live.updated_1h || 0)} merge / update</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Baru 24 Jam</div><div class="admin-kpi-num">${fmtN(live.new_24h || 0)}</div><div class="admin-kpi-hint">${fmtN(live.jobs_done_1h || 0)} job selesai 1 jam</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Queue</div><div class="admin-kpi-num">${fmtN(statusBy('pending'))}</div><div class="admin-kpi-hint">${fmtN(live.running_now || 0)} running · ${fmtN(statusBy('failed'))} gagal</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Multi-source</div><div class="admin-kpi-num">${fmtN(live.multi_source_hits || 0)}</div><div class="admin-kpi-hint">buyer terverif ≥2 sumber</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Refresh</div><div class="admin-kpi-num" style="font-size:16px;padding-top:8px">tiap 8 dtk</div><div class="admin-kpi-hint" id="scrape-updated">baru saja</div></div>
        </div>

        <div class="admin-toolbar" style="margin-top:16px">
          <button class="btn btn-outline btn-sm" id="scrape-seed">+ Seed antrian (all sources × HS × country)</button>
          <button class="btn btn-primary btn-sm" id="scrape-run">▶ Proses 5 job sekarang</button>
          <button class="btn btn-outline btn-sm" id="scrape-enrich">✨ Enrich 5 buyer sekarang</button>
          <span class="admin-count">${status.recent_jobs.length} job terbaru</span>
        </div>

        <div class="admin-grid" style="grid-template-columns: 1fr 1fr; gap:16px; margin-top:16px">
          <div class="admin-panel">
            <h3 style="margin-bottom:12px">Buyer per sumber</h3>
            <table class="tbl">
              <thead><tr><th>Source</th><th class="r">Buyer</th></tr></thead>
              <tbody>
                ${[
                  ['ai_agent', 'AI Research Agent (web + LLM, verified)'],
                  ['gleif', 'GLEIF LEI Registry Crawler'],
                  ['companies_house_uk', 'UK Companies House Crawler'],
                  ['sirene_fr', 'France SIRENE NAF Crawler'],
                  ['sec_edgar_us', 'US SEC EDGAR Filings Crawler'],
                  ['google_business', 'Google Business Crawler (OSM)'],
                  ['kompass', 'Kompass B2B Directory Crawler'],
                  ['europages', 'Europages Directory Crawler'],
                  ['wikidata', 'Wikidata Entity Crawler'],
                  ['importyeti', 'ImportYeti US Bill-of-Lading Crawler'],
                  ['itpc', 'Kemendag ITPC Inquiry Crawler'],
                ].map(([s, label]) => `<tr>
                  <td class="body-sm">${esc(label)}<div class="caption muted-3">${esc(s)}</div></td>
                  <td class="r num">${fmtN(bySrcMap[s] || 0)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="admin-panel">
            <h3 style="margin-bottom:12px">Job terbaru</h3>
            <div style="max-height:280px;overflow:auto">
              <table class="tbl">
                <thead><tr><th>Source</th><th>HS</th><th>Country</th><th>Status</th><th class="r">N</th></tr></thead>
                <tbody>
                  ${status.recent_jobs.map((j) => `<tr>
                    <td class="body-sm">${esc(j.source)}</td>
                    <td class="caption">${esc(j.hs_code || '-')}</td>
                    <td>${j.country ? flag(j.country) + ' ' + esc(j.country) : '-'}</td>
                    <td><span class="pill ${j.status === 'done' ? 'pill-success' : j.status === 'failed' ? 'pill-danger' : j.status === 'running' ? 'pill-warning' : 'pill-neutral'}" style="font-size:10px">${esc(j.status)}</span>${j.error ? `<div class="caption muted-3" title="${esc(j.error)}">${esc(j.error.slice(0,32))}</div>` : ''}</td>
                    <td class="r num">${fmtN(j.result_count || 0)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="admin-panel" style="margin-top:16px;padding:0;overflow:hidden">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border-default)">
            <h3 style="margin:0">50 buyer terbaru</h3>
          </div>
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Nama</th><th>Negara</th><th>Industri</th><th>Source</th><th>Enriched</th><th>HS</th><th class="r">Skor</th><th class="r">Aksi</th></tr></thead>
            <tbody>
              ${buyers.length ? buyers.map((b) => `<tr>
                <td><b class="body-sm">${esc(b.name)}</b>${b.website ? `<div class="caption"><a href="${esc(b.website)}" target="_blank" rel="noopener" class="muted">${esc(b.website.replace(/^https?:\/\//, '').slice(0,40))}</a></div>` : ''}${b.email ? `<div class="caption muted">${esc(b.email)}</div>` : ''}</td>
                <td>${b.country ? flag(b.country) + ' ' + esc(b.country) : '-'}${b.city ? `<div class="caption muted-3">${esc(b.city)}</div>` : ''}</td>
                <td class="body-sm muted">${esc(b.industry || '-')}${b.size_bucket ? `<div class="caption muted-3">${esc(b.size_bucket)}</div>` : ''}</td>
                <td><span class="pill pill-neutral" style="font-size:10px">${esc(b.source)}</span></td>
                <td>${b.enriched_at ? `<span class="pill pill-success" style="font-size:10px">✓</span>` : `<span class="pill pill-neutral" style="font-size:10px">-</span>`}</td>
                <td class="caption">${(b.hs_codes || []).slice(0,3).map((h) => `<span class="tag">${esc(h)}</span>`).join(' ') || '-'}</td>
                <td class="r"><span class="pill ${b.data_confidence >= 80 ? 'pill-success' : b.data_confidence >= 60 ? 'pill-warning' : 'pill-neutral'}" style="font-size:10px">${b.data_confidence}</span></td>
                <td class="r"><button class="btn btn-sm btn-outline" data-enrich-buyer="${b.id}">Enrich</button></td>
              </tr>`).join('') : `<tr><td colspan="8" class="muted" style="padding:24px;text-align:center">Belum ada buyer terscrape. Klik "Seed antrian" lalu "Proses 5 job".</td></tr>`}
            </tbody>
          </table></div>
        </div>
      `);
      $('#scrape-seed')?.addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Enqueuing…';
        try { const r = await api('/api/admin/scrape/seed', { method: 'POST' }); toast(`+${r.enqueued} job masuk antrian`); location.hash = '#/admin?tab=scrape&t=' + Date.now(); }
        catch (err) { toast(err.data?.error || 'Gagal seed', true); e.target.disabled = false; e.target.textContent = '+ Seed antrian (all sources × HS × country)'; }
      });
      $('#scrape-run')?.addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Memproses…';
        try {
          const r = await api('/api/admin/scrape/run', { method: 'POST', body: { max: 5 } });
          toast(`Selesai. ${r.buyers_persisted} buyer baru, ${r.ok} ok, ${r.skipped} skip, ${r.failed} gagal`);
          location.hash = '#/admin?tab=scrape&t=' + Date.now();
        } catch (err) { toast(err.data?.detail || err.data?.error || 'Gagal run', true); e.target.disabled = false; e.target.textContent = '▶ Proses 5 job sekarang'; }
      });
      $('#scrape-enrich')?.addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Enriching…';
        try {
          const r = await api('/api/admin/scrape/enrich', { method: 'POST', body: { max: 5 } });
          toast(`Selesai. ${r.ok}/${r.processed} buyer enriched`);
          location.hash = '#/admin?tab=scrape&t=' + Date.now();
        } catch (err) { toast(err.data?.detail || err.data?.error || 'Gagal enrich', true); e.target.disabled = false; e.target.textContent = '✨ Enrich 5 buyer sekarang'; }
      });
      $$('[data-enrich-buyer]').forEach((el) => el.addEventListener('click', async () => {
        const id = el.dataset.enrichBuyer;
        el.disabled = true; el.textContent = '…';
        try {
          await api('/api/admin/scrape/enrich?id=' + id, { method: 'POST' });
          toast('Buyer enriched');
          location.hash = '#/admin?tab=scrape&t=' + Date.now();
        } catch (err) { toast(err.data?.detail || err.data?.error || 'Gagal', true); el.disabled = false; el.textContent = 'Enrich'; }
      }));
      // Faster auto-refresh (8s) so a running cron shows progress live.
      clearInterval(window.__adminScrapeTimer);
      window.__adminScrapeTimer = setInterval(() => {
        if (parseHash().path === '/admin' && (params.get('tab') || 'overview') === 'scrape') {
          location.hash = '#/admin?tab=scrape&t=' + Date.now();
        } else {
          clearInterval(window.__adminScrapeTimer);
        }
      }, 8000);
    } else if (tab === 'shipments') {
      const d = await api('/api/admin/shipments');
      draw(`
        <div class="admin-kpi-grid">
          <div class="admin-kpi"><div class="admin-kpi-lbl">Total Shipment</div><div class="admin-kpi-num">${fmtN(d.stats.total)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Total Volume</div><div class="admin-kpi-num">${fmtKg(d.stats.total_kg)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Total Nilai</div><div class="admin-kpi-num">${fmtUSD(d.stats.total_usd)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">HS Unik</div><div class="admin-kpi-num">${fmtN(d.stats.unique_hs)}</div><div class="admin-kpi-hint">${fmtN(d.stats.unique_buyers)} buyer unik</div></div>
        </div>
        <div class="admin-panel" style="padding:0;overflow:hidden">
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Tanggal</th><th>HS</th><th>Buyer</th><th>Eksportir</th><th>Rute</th><th class="r">Berat</th><th class="r">Nilai</th></tr></thead>
            <tbody>
            ${d.shipments.map((s) => `<tr>
              <td class="caption num body-sm">${fmtDate(s.shipment_date)}</td>
              <td><span class="hs-code-chip">${s.hs_code.replace(/^(\d{4})/, '$1.')}</span></td>
              <td><b class="body-sm">${esc(s.buyer_name)}</b> <span class="caption">${flag(s.buyer_country)}</span></td>
              <td class="body-sm">${flag(s.exporter_country)} ${esc(s.exporter_name)} ${s.is_indonesian ? '<span class="pill pill-info" style="font-size:10px">🇮🇩</span>' : ''}</td>
              <td class="caption muted">${esc(s.origin_port || '')} → ${esc(s.dest_port || '')}</td>
              <td class="r num">${fmtKg(s.weight_kg)}</td>
              <td class="r num">${fmtUSD(s.value_usd)}</td>
            </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `);
    } else if (tab === 'messages') {
      const d = await api('/api/admin/messages');
      const rateOpened = d.funnel.total ? Math.round((d.funnel.opened / d.funnel.total) * 100) : 0;
      const rateReplied = d.funnel.total ? Math.round((d.funnel.replied / d.funnel.total) * 100) : 0;
      draw(`
        <div class="admin-kpi-grid">
          <div class="admin-kpi"><div class="admin-kpi-lbl">Total Terkirim</div><div class="admin-kpi-num">${fmtN(d.funnel.total)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Open Rate</div><div class="admin-kpi-num">${rateOpened}%</div><div class="admin-kpi-hint">${d.funnel.opened} dibuka</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Reply Rate</div><div class="admin-kpi-num">${rateReplied}%</div><div class="admin-kpi-hint">${d.funnel.replied} dibalas</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">Channel</div><div class="admin-kpi-num" style="font-size:16px;padding-top:4px">${d.by_channel.map((c) => `${c.channel === 'email' ? '✉️' : '💬'} ${c.c}`).join(' · ')}</div></div>
        </div>
        <div class="admin-panel" style="padding:0;overflow:hidden">
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Dari User</th><th>Ke Buyer</th><th>Subjek</th><th>Channel</th><th>Status</th><th>Dikirim</th></tr></thead>
            <tbody>
            ${d.messages.map((mg) => `<tr>
              <td><b class="body-sm">${esc(mg.user_name)}</b><div class="caption muted-3">${esc(mg.user_email)}</div></td>
              <td>${flag(mg.buyer_country)} ${esc(mg.buyer_name)}</td>
              <td class="body-sm muted">${esc(mg.subject || '(WhatsApp)')}</td>
              <td>${mg.channel === 'email' ? '✉️' : '💬'} ${mg.channel}</td>
              <td>${statusPill(mg.status)}</td>
              <td class="caption num body-sm">${fmtDate(mg.sent_at)}</td>
            </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      `);
    } else if (tab === 'revenue') {
      const d = await api('/api/admin/revenue');
      draw(`
        <div class="admin-kpi-grid">
          <div class="admin-kpi admin-kpi-hero"><div class="admin-kpi-lbl">MRR (Monthly)</div><div class="admin-kpi-num">${fmtIDR(d.mrr)}</div><div class="admin-kpi-hint">${d.paid_users} paying users</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">ARR (Annual)</div><div class="admin-kpi-num">${fmtIDR(d.arr)}</div></div>
          <div class="admin-kpi"><div class="admin-kpi-lbl">ARPU</div><div class="admin-kpi-num">${fmtIDR(d.arpu)}</div><div class="admin-kpi-hint">per paying user / bulan</div></div>
        </div>
        <div class="admin-grid-2">
          <div class="admin-panel">
            <h3>Revenue per Paket</h3>
            <div style="margin-top:14px">
              ${d.by_plan.map((p) => `<div class="admin-list-row">
                <div><b style="text-transform:capitalize">${esc(p.plan)}</b> <span class="caption muted">× ${p.c} user @ ${fmtIDR(p.price)}</span></div>
                <b>${fmtIDR(p.revenue)}</b>
              </div>`).join('')}
            </div>
          </div>
          <div class="admin-panel">
            <h3>Riwayat Perubahan Plan (50 terakhir)</h3>
            <div style="margin-top:14px;max-height:400px;overflow-y:auto">
              ${d.plan_change_history.length ? d.plan_change_history.map((e) => `<div class="admin-list-row">
                <div><span class="caption muted-3">User ${esc(e.target)}</span><div class="body-sm">→ ${esc((e.meta && JSON.parse(e.meta).plan) || '?')}</div></div>
                <span class="caption muted-3">${fmtDate(e.created_at)}</span>
              </div>`).join('') : '<p class="muted body-sm">Belum ada riwayat.</p>'}
            </div>
          </div>
        </div>
      `);
    } else if (tab === 'hs-usage') {
      const d = await api('/api/admin/hs-usage');
      const maxHs = d.top_hs_focus[0]?.count || 1;
      const maxC = d.top_target_countries[0]?.count || 1;
      draw(`
        <div class="admin-grid-2">
          <div class="admin-panel">
            <h3>Top HS Focus User</h3>
            <p class="caption muted-3" style="margin-bottom:14px">HS code paling sering dipilih user waktu onboarding.</p>
            ${d.top_hs_focus.length ? d.top_hs_focus.map((h) => `<div class="admin-bar-row">
              <span class="hs-code-chip">${h.code.replace(/^(\d{4})/, '$1.')}</span>
              <div class="admin-bar"><div style="width:${(h.count / maxHs) * 100}%"></div></div>
              <b class="num body-sm" style="text-align:right">${h.count}</b>
            </div>`).join('') : '<p class="muted body-sm">Belum ada data.</p>'}
          </div>
          <div class="admin-panel">
            <h3>Top Target Countries</h3>
            <p class="caption muted-3" style="margin-bottom:14px">Negara yang paling sering dipilih user sebagai target ekspor.</p>
            ${d.top_target_countries.length ? d.top_target_countries.map((c) => `<div class="admin-bar-row">
              <span class="body-sm">${flag(c.code)} ${esc(c.name)}</span>
              <div class="admin-bar"><div style="width:${(c.count / maxC) * 100}%"></div></div>
              <b class="num body-sm" style="text-align:right">${c.count}</b>
            </div>`).join('') : '<p class="muted body-sm">Belum ada data.</p>'}
          </div>
        </div>
      `);
    } else if (tab === 'system') {
      const d = await api('/api/admin/system');
      draw(`
        <div class="admin-grid-2">
          <div class="admin-panel">
            <h3>Runtime</h3>
            <div style="margin-top:14px">
              <div class="admin-list-row"><span>Node</span><b>${esc(d.node_version)}</b></div>
              <div class="admin-list-row"><span>Uptime</span><b>${Math.floor(d.uptime_sec / 60)}m ${d.uptime_sec % 60}s</b></div>
              <div class="admin-list-row"><span>Memory RSS</span><b>${d.memory_mb} MB</b></div>
              <div class="admin-list-row"><span>DB Engine</span><b>${esc(d.db_engine)}</b></div>
              <div class="admin-list-row"><span>HS Nomenclature Loaded</span><b>${fmtN(d.hs_nomenclature_loaded)} kode</b></div>
            </div>
          </div>
          <div class="admin-panel">
            <h3>Cache Stats</h3>
            <div style="margin-top:14px">
              <div class="admin-list-row"><span>Supabase token cache</span><b>${d.caches.supabase_token} entri</b></div>
              <div class="admin-list-row"><span>UN Comtrade cache</span><b>${d.caches.comtrade} entri</b></div>
              <div class="admin-list-row"><span>USITC HTS cache</span><b>${d.caches.usitc} entri</b></div>
            </div>
            <h3 style="margin-top:20px">Integrasi</h3>
            <div style="margin-top:14px">
              ${Object.entries(d.integrations).map(([k, v]) => `<div class="admin-list-row"><span style="text-transform:capitalize">${k.replace(/_/g, ' ')}</span><span class="pill ${v ? 'pill-success' : 'pill-danger'}" style="font-size:11px">${v ? '● live' : '× off'}</span></div>`).join('')}
            </div>
          </div>
        </div>
      `);
    } else if (tab === 'audit') {
      const d = await api('/api/admin/audit');
      draw(`
        <div class="admin-panel" style="padding:0;overflow:hidden">
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Waktu</th><th>Admin</th><th>Aksi</th><th>Target</th><th>Meta</th></tr></thead>
            <tbody>
            ${d.events.length ? d.events.map((e) => `<tr>
              <td class="caption num body-sm">${fmtDate(e.created_at)}</td>
              <td><b class="body-sm">${esc(e.actor_name || '?')}</b><div class="caption muted-3">${esc(e.actor_email || '-')}</div></td>
              <td><span class="pill pill-info" style="font-size:11px">${esc(e.action)}</span></td>
              <td class="caption">${esc(e.target || '-')}</td>
              <td class="caption muted-3" style="font-family:monospace;font-size:11px">${esc(e.meta || '-')}</td>
            </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:40px" class="muted">Belum ada tindakan admin tercatat.</td></tr>'}
            </tbody></table></div>
        </div>
      `);
    }
  } catch (err) {
    draw(`<div class="empty" style="padding:40px"><h3>Gagal memuat data</h3><p class="muted">${esc(err.data?.error || err.message || 'Coba refresh')}</p></div>`);
  }
});

async function boot() {
  // Payment callback: return URL comes back as `/?paid=1&order=X&plan=Y`.
  // Forward those query params into the SPA hash router at #/billing.
  if (window.location.search) {
    const q = new URLSearchParams(window.location.search);
    if (q.get('paid') === '1' || q.get('cancelled') === '1') {
      const hashParams = new URLSearchParams();
      for (const k of ['paid', 'cancelled', 'order']) if (q.get(k)) hashParams.set(k, q.get(k));
      window.history.replaceState(null, '', window.location.pathname + '#/billing?' + hashParams.toString());
    }
  }
  // Deep-link support: /admin (typed directly) → hash route #/admin.
  // Any non-root path served by the SPA fallback is rewritten to its hash
  // equivalent so users can bookmark .com/admin.
  const path = window.location.pathname.replace(/\/$/, '');
  if (path && path !== '/' && !path.startsWith('/api/')) {
    const target = path;
    window.history.replaceState(null, '', '/' + (window.location.search || '') + '#' + target);
  }
  await syncSupabaseSession();
  render();
}
boot();
