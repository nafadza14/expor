'use strict';
// Sumopod AI enrichment. Takes a raw scraped buyer + optional website
// snippet and returns { industry, size_bucket, description } in JSON.
//
// Runs server-side only. SUMOPOD_AI_KEY must be set as an env var (never
// exposed to the client). Falls back to a heuristic guess if the model
// call errors so a bad AI day does not stop the pipeline.

// Fallback matches src/api.js so local dev works without .env setup. Real
// production key comes from env, injected by Vercel and GH Actions Secrets.
const SUMOPOD_AI_KEY = process.env.SUMOPOD_AI_KEY || 'sk-jzbEVp009nE3qAPxXvbJSg';
const SUMOPOD_AI_URL = 'https://ai.sumopod.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

function heuristicSize(name) {
  if (!name) return 'small';
  const n = String(name).toLowerCase();
  if (/\b(corporation|group|holdings|international|worldwide|global|s\.p\.a\.)\b/.test(n)) return 'large';
  if (/\b(gmbh|s\.?r\.?l\.?|s\.?a\.?|ltd|limited|bv|pt|llc)\b/.test(n)) return 'medium';
  return 'small';
}

// Circuit breaker: if the LLM upstream reports a hard failure (401,
// 403, blocked key, quota) we stop hitting it for the rest of the
// process. Otherwise every buyer in the batch pays the network cost.
let SUMOPOD_DEAD = null; // holds the failure reason string once tripped

async function aiEnrich({ name, country, website_snippet }) {
  if (!SUMOPOD_AI_KEY) return null;
  if (SUMOPOD_DEAD) return null;
  const sys = 'You classify foreign buyer companies for Indonesian exporters. Reply with a single JSON object, no prose. Keys: industry (short lowercase noun like "coffee roaster", "spice importer", "food wholesaler"), size_bucket ("small" | "medium" | "large"), description (one short English sentence, 15 words max, factual, no marketing fluff).';
  const usr = `Company: ${name}\nCountry: ${country || 'unknown'}${website_snippet ? '\nWebsite excerpt:\n' + website_snippet.slice(0, 1200) : ''}`;
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: usr },
    ],
    temperature: 0.2,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  };
  let res;
  try {
    res = await fetch(SUMOPOD_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUMOPOD_AI_KEY },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    console.warn('[enrich] Sumopod network error:', netErr.message);
    return null;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch {}
    if ([401, 402, 403, 429].includes(res.status)) {
      SUMOPOD_DEAD = `${res.status}: ${detail}`;
      console.error(`[enrich] Sumopod AI disabled for this run (${SUMOPOD_DEAD}). Falling back to heuristic industry/size only.`);
    } else {
      console.warn(`[enrich] Sumopod ${res.status}: ${detail}`);
    }
    return null;
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(raw);
    return {
      industry: typeof parsed.industry === 'string' ? parsed.industry.trim().slice(0, 80) : null,
      size_bucket: ['small', 'medium', 'large'].includes(parsed.size_bucket) ? parsed.size_bucket : null,
      description: typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 400) : null,
    };
  } catch (_e) { return null; }
}

async function enrichBuyer(buyer, { websiteSnippet = null } = {}) {
  const ai = await aiEnrich({
    name: buyer.name,
    country: buyer.country,
    website_snippet: websiteSnippet,
  }).catch(() => null);
  return {
    industry: ai?.industry || buyer.industry || null,
    size_bucket: ai?.size_bucket || buyer.size_bucket || heuristicSize(buyer.name),
    description: ai?.description || buyer.description || null,
    ai_used: !!ai,
  };
}

module.exports = { enrichBuyer, aiEnrich, heuristicSize };
