// Endpoint para Vercel: POST /api/simulate
const { simulate } = require('../lib/simulate');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, errors: ['Use POST'] });

  const key = process.env.API_KEY;
  if (key && req.headers['x-api-key'] !== key) {
    return res.status(401).json({ ok: false, errors: ['API key inválida'] });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, errors: ['JSON inválido'] }); }
  }
  const result = simulate(body || {});
  return res.status(result.ok ? 200 : 400).json(result);
};
