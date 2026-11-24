// Só o dono do site vê os registros: quem acessa pelo próprio computador (localhost) ou envia o ADMIN_TOKEN.
const r = require('express').Router(), crypto = require('crypto'), db = require('../config/db');
const LOOP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const allowed = (req) => (process.env.ADMIN_TOKEN && same(req.headers['x-admin-token'] || '', process.env.ADMIN_TOKEN))
  || (LOOP.has(req.socket.remoteAddress) && !req.headers['x-forwarded-for']);
r.use((req, res, next) => (allowed(req) ? next() : res.status(403).json({ success: false, error: 'Acesso restrito.' })));

r.get('/', async (_req, res, next) => {
  try {
    const q = async (sql) => (await db.query(sql)).rows;
    const [[summary], [site], langs, recent] = await Promise.all([
      q(`SELECT COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE))::int AS today,
         (COUNT(*) FILTER (WHERE status >= 400))::int AS errors, COALESCE(ROUND(AVG(duration_ms)), 0)::int AS avg_ms FROM access_logs`),
      q(`SELECT (SELECT COUNT(*) FROM users)::int AS users, (SELECT COUNT(*) FROM orders)::int AS orders,
         (SELECT COUNT(*) FROM products WHERE is_active AND quantity > 0 AND expiry_date >= CURRENT_DATE)::int AS products`),
      q(`SELECT COALESCE(lang, '?') AS lang, COUNT(*)::int AS n FROM access_logs GROUP BY 1 ORDER BY n DESC LIMIT 5`),
      q(`SELECT created_at, method, path, status, duration_ms, user_type, lang FROM access_logs ORDER BY created_at DESC LIMIT 50`),
    ]);
    res.json({ success: true, data: { summary, site, langs, recent } });
  } catch (e) { next(e); }
});

r.get('/export.csv', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT created_at, method, path, status, duration_ms, user_type, lang FROM access_logs ORDER BY created_at DESC LIMIT 5000');
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = 'created_at,method,path,status,duration_ms,user_type,lang';
    res.type('text/csv').attachment('pratofeito-acessos.csv')
      .send([head, ...rows.map((x) => [x.created_at instanceof Date ? x.created_at.toISOString() : x.created_at, x.method, x.path, x.status, x.duration_ms, x.user_type, x.lang].map(cell).join(','))].join('\n'));
  } catch (e) { next(e); }
});
module.exports = r;
