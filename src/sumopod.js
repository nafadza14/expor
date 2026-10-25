'use strict';
// Sumopod Pay (QRIS) client.
//   POST {base}/payments           create a hosted QRIS payment link
//   GET  {base}/payments/{id}      read a payment (by Sumopod payment_id)
// Auth: X-Api-Key header. Webhooks: svix-style HMAC-SHA256 signature
// (svix-id / svix-timestamp / svix-signature headers, secret "whsec_...")
// or, if configured instead, a shared X-Webhook-Token.
//
// Env: SUMOPOD_PAY_KEY (required), SUMOPOD_PAY_BASE (default production),
//      SUMOPOD_WEBHOOK_SECRET or SUMOPOD_WEBHOOK_TOKEN, SUMOPOD_PAY_METHOD.

const crypto = require('node:crypto');

function base() {
  // Older deployments set SUMOPOD_PAY_URL to the full /payments endpoint.
  const legacy = process.env.SUMOPOD_PAY_URL;
  if (process.env.SUMOPOD_PAY_BASE) return process.env.SUMOPOD_PAY_BASE.replace(/\/+$/, '');
  if (legacy) return legacy.replace(/\/payments\/?$/, '').replace(/\/+$/, '');
  return 'https://api-pay.sumopod.com/api/v1';
}
function key() { return (process.env.SUMOPOD_PAY_KEY || '').trim(); }
function configured() { return !!key(); }

async function call(method, path, body, timeoutMs = 15000) {
  const res = await fetch(base() + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': key(), Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
  return { ok: res.ok, status: res.status, data: (data && data.data && !data.payment_id) ? data.data : data };
}

async function createPayment({ orderId, amount, successUrl, cancelUrl }) {
  if (!configured()) throw Object.assign(new Error('SUMOPOD_PAY_KEY belum diset di server.'), { code: 'not_configured' });
  const r = await call('POST', '/payments', {
    order_id: orderId,
    amount,
    currency: 'IDR',
    expires_in_hours: 24,
    success_return_url: successUrl,
    cancel_return_url: cancelUrl,
    payment_method_type_code: process.env.SUMOPOD_PAY_METHOD || 'QRIS',
  });
  if (!r.ok) {
    const msg = r.data?.message || r.data?.error || r.data?.raw || `HTTP ${r.status}`;
    throw Object.assign(new Error('Sumopod: ' + String(msg).slice(0, 200)), { code: 'gateway_error', status: r.status });
  }
  const d = r.data || {};
  return {
    payment_id: d.payment_id || d.id || null,
    payment_url: d.payment_link_url || d.payment_url || d.checkout_url || d.url || null,
    expires_at: d.expires_at || null,
    fee: d.fee ?? null,
    net: d.net_amount ?? null,
    raw: d,
  };
}

const PAID = new Set(['completed', 'paid', 'success', 'succeeded', 'settled', 'settlement']);
const DEAD = { expired: 'expired', failed: 'failed', cancelled: 'failed', canceled: 'failed' };

function normalizeStatus(s) {
  const v = String(s || '').toLowerCase();
  if (PAID.has(v)) return 'paid';
  return DEAD[v] || 'pending';
}

async function getPayment(paymentId) {
  const r = await call('GET', '/payments/' + encodeURIComponent(paymentId));
  if (!r.ok) return { ok: false, status: r.status, data: r.data };
  const d = r.data || {};
  return { ok: true, state: normalizeStatus(d.status), amount: d.amount ?? null, order_id: d.order_id || null, raw: d };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Returns true only for a correctly signed (or token-authenticated) delivery.
function verifyWebhook(headers, rawBody) {
  const h = (n) => headers[n] || headers[n.toLowerCase()] || '';
  const secret = (process.env.SUMOPOD_WEBHOOK_SECRET || '').trim();
  const token = (process.env.SUMOPOD_WEBHOOK_TOKEN || '').trim();
  if (secret) {
    const id = h('svix-id'); const ts = h('svix-timestamp'); const sig = h('svix-signature');
    if (!id || !ts || !sig) return false;
    // Reject replays older than 10 minutes.
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > 600) return false;
    const expected = crypto.createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64'))
      .update(`${id}.${ts}.${rawBody}`).digest('base64');
    return String(sig).split(' ').map((s) => s.split(',')[1]).filter(Boolean).some((c) => safeEqual(c, expected));
  }
  if (token) return safeEqual(h('x-webhook-token'), token);
  return false; // no verification configured: never trust webhooks
}

module.exports = { createPayment, getPayment, verifyWebhook, normalizeStatus, configured, base };
