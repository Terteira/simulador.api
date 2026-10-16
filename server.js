// Servidor Node puro (sem dependências) — para rodar localmente ou no Render/Railway.
// POST /api/simulate   |   GET /health
const http = require('http');
const { simulate } = require('./lib/simulate');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

const send = (res, status, obj) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(obj === null ? '' : JSON.stringify(obj));
};

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null);
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.url !== '/api/simulate') return send(res, 404, { ok: false, errors: ['Rota não encontrada'] });
  if (req.method !== 'POST') return send(res, 405, { ok: false, errors: ['Use POST'] });
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) return send(res, 401, { ok: false, errors: ['API key inválida'] });

  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
  req.on('end', () => {
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { ok: false, errors: ['JSON inválido'] }); }
    const result = simulate(body);
    send(res, result.ok ? 200 : 400, result);
  });
}).listen(PORT, () => console.log(`Simulador rodando em http://localhost:${PORT}`));
