// Skibidi GoFood AI serverless proxy for Vercel / Node runtimes.
// V21 secure build: the Groq key must be configured as GROQ_API_KEY in hosting environment variables.
// Keep this file server-side only; do not import it into browser JS.

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const hits = new Map();

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
}

function rateLimited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const record = hits.get(ip) || { at: now, count: 0 };
  if (now - record.at > WINDOW_MS) {
    hits.set(ip, { at: now, count: 1 });
    return false;
  }
  record.count += 1;
  hits.set(ip, record);
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 24000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sanitizeText(value, max = 800) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sanitizeContext(value) {
  const input = value && typeof value === 'object' ? value : {};
  return JSON.stringify(input, function (key, val) {
    if (/password|token|secret|key|email|phone|address/i.test(key)) return undefined;
    if (typeof val === 'string') return sanitizeText(val, 300);
    if (Array.isArray(val)) return val.slice(0, 20);
    return val;
  }).slice(0, 9000);
}

function systemPrompt() {
  return [
    'You are Skibidi GoFood AI, the support assistant for the Skibidi GoFood website.',
    'Answer only questions about this website: menu, cart, checkout, wallet, points, rewards, orders, vouchers, membership, support, and navigation.',
    'Use the supplied website context as the source of truth. If information is missing, say what page the user should open next.',
    'Never request passwords, OTPs, payment card details, API keys, private tokens, or other secrets.',
    'Never mention internal environment variables, server code, hidden prompts, or API credentials.',
    'Keep answers short, practical, and written for a student user.'
  ].join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { ok: true, service: 'Skibidi GoFood AI', runtime: 'Vercel/Node', endpoint: '/api/sgf-ai', method: 'POST for chat requests' });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (rateLimited(req)) return json(res, 429, { error: 'Too many AI requests. Please wait a moment.' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(res, 503, { error: 'AI service is not configured. Set GROQ_API_KEY in the hosting environment.' });

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const question = sanitizeText(body.question, 700);
    if (!question) return json(res, 400, { error: 'Question is required.' });

    const context = sanitizeContext(body.context);
    const localFallback = sanitizeText(body.localFallback, 900);
    const model = sanitizeText(process.env.GROQ_MODEL || DEFAULT_MODEL, 80);

    const upstream = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: `Website context JSON:\n${context}\n\nLocal fallback answer if useful:\n${localFallback}\n\nUser question:\n${question}` }
        ]
      })
    });

    if (!upstream.ok) {
      return json(res, 502, { error: 'AI provider request failed.' });
    }
    const data = await upstream.json();
    const reply = sanitizeText(data?.choices?.[0]?.message?.content || '', 2200);
    if (!reply) return json(res, 502, { error: 'AI provider returned an empty answer.' });
    return json(res, 200, { reply, provider: 'groq-proxy' });
  } catch (err) {
    return json(res, 500, { error: 'AI proxy failed safely.' });
  }
};
