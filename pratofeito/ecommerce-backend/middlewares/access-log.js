// Registro de acesso: cada abertura do site e cada chamada da API vira uma linha no banco (tabela access_logs)
// e no arquivo data/access.log. Nunca grava corpo da requisição (senhas, dados de pedido) nem a query string.
// LOG_ANON_IP=0 guarda o IP completo (se a hospedagem exigir); por padrão o último trecho do IP é zerado.
const fs = require('fs'), path = require('path');
const { DATA_DIR } = require('../config/env');
const db = require('../config/db');
const file = fs.createWriteStream(path.join(DATA_DIR, 'access.log'), { flags: 'a' });
file.on('error', () => {});
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SKIP = /^\/api\/(health|logs)/;

const anonymize = (raw) => {
  let ip = String(raw || '').replace(/^::ffff:/, '');
  if (ip === '::1') ip = '127.0.0.1';
  if (process.env.LOG_ANON_IP === '0') return ip.slice(0, 64);
  return ip.includes('.') ? ip.replace(/\.\d+$/, '.0') : ip.split(':').slice(0, 3).join(':') + '::';
};
const langOf = (req) => String(req.headers['x-lang'] || req.headers['accept-language'] || '').split(/[,;]/)[0].trim().slice(0, 10) || null;

module.exports = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const p = req.originalUrl.split('?')[0];
    if (SKIP.test(p) || !(p.startsWith('/api/') || p === '/' || p === '/index.html')) return;
    const rec = {
      method: req.method, path: p.replace(UUID, ':id').slice(0, 200), status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6), user: req.user?.sub || null, type: req.user?.type || null,
      ip: anonymize(req.ip || req.socket.remoteAddress), lang: langOf(req), ua: String(req.headers['user-agent'] || '').slice(0, 200),
    };
    file.write(JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n');
    db.query('INSERT INTO access_logs (method, path, status, duration_ms, user_id, user_type, ip, lang, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [rec.method, rec.path, rec.status, rec.ms, rec.user, rec.type, rec.ip, rec.lang, rec.ua]).catch(() => {});
  });
  next();
};
