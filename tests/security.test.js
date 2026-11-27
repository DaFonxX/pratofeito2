import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.stop(); });

test('cabeçalhos de segurança em páginas e na API', async () => {
  for (const url of ['/', '/api/health']) {
    const res = await fetch(srv.base + url, { headers: { accept: 'text/html' } });
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('referrer-policy'));
    assert.ok(res.headers.get('permissions-policy'));
  }
  const api = await fetch(srv.base + '/api/health');
  assert.equal(api.headers.get('cache-control'), 'no-store');
});

test('requisição que altera dados sem token CSRF é bloqueada', async () => {
  const c = srv.client();
  await c.init();
  const r = await c.post('/api/auth/login', { email: 'cliente@demo.com', password: 'Prato#2026' }, { csrf: false });
  assert.equal(r.status, 403);
  assert.equal(r.error.code, 'CSRF_FAILED');
});

test('requisição vinda de outro site (Origin diferente) é bloqueada', async () => {
  const c = srv.client();
  await c.init();
  const r = await c.post('/api/auth/login', { email: 'cliente@demo.com', password: 'Prato#2026' },
    { headers: { origin: 'https://site-malicioso.example' } });
  assert.equal(r.status, 403);
});

test('cookie de sessão é HttpOnly e SameSite; token antigo deixa de valer após logout', async () => {
  const c = srv.client();
  await c.init();
  const res = await c.raw('POST', '/api/auth/login', { body: { email: 'cliente@demo.com', password: 'Prato#2026' } });
  const sessionCookie = res.headers.getSetCookie().find((h) => h.startsWith('pf_session='));
  assert.ok(sessionCookie, 'deve criar cookie de sessão');
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Lax/);
  c.csrf = (await res.json()).data.csrfToken;
  const stolen = c.cookies.get('pf_session');

  assert.equal((await c.get('/api/account')).status, 200);
  await c.post('/api/auth/logout', {});
  const attacker = srv.client();
  attacker.cookies.set('pf_session', stolen);
  assert.equal((await attacker.get('/api/account')).status, 401);
});

test('login errado não revela se o e-mail existe e bloqueia após 5 tentativas', async () => {
  const c = srv.client();
  await c.init();
  const unknown = await c.post('/api/auth/login', { email: 'ninguem@demo.com', password: 'qualquer-coisa' });
  const wrong = await c.post('/api/auth/login', { email: 'restaurante@demo.com', password: 'senha-errada' });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.error.code, wrong.error.code);

  for (let i = 0; i < 4; i++) await c.post('/api/auth/login', { email: 'restaurante@demo.com', password: 'senha-errada' });
  const locked = await c.post('/api/auth/login', { email: 'restaurante@demo.com', password: 'Prato#2026' });
  assert.equal(locked.status, 429);
  assert.equal(locked.error.code, 'ACCOUNT_LOCKED');
  assert.ok(locked.headers.get('retry-after'));
});

test('cadastro recusa senha fraca e e-mail repetido', async () => {
  const c = srv.client();
  await c.init();
  const base = { role: 'buyer', name: 'Teste Silva', email: 'teste.silva@example.com', acceptTerms: true };
  const weak = await c.post('/api/auth/register', { ...base, password: '12345678' });
  assert.equal(weak.status, 422);
  assert.equal(weak.error.fields.password, 'common_password');
  const short = await c.post('/api/auth/register', { ...base, password: 'abc' });
  assert.equal(short.error.fields.password, 'too_short');
  const ok = await c.post('/api/auth/register', { ...base, password: 'feijao-com-arroz-42' });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.role, 'buyer');
  const again = srv.client();
  await again.init();
  const dup = await again.post('/api/auth/register', { ...base, password: 'outra-senha-boa-9' });
  assert.equal(dup.status, 409);
});

test('ninguém se cadastra como administrador pela API', async () => {
  const c = srv.client();
  await c.init();
  const r = await c.post('/api/auth/register', {
    role: 'admin', name: 'Hacker', email: 'hacker@example.com', password: 'senha-forte-123', acceptTerms: true,
  });
  assert.equal(r.status, 422);
  assert.equal(r.error.fields.role, 'invalid');
});

test('fornecedor precisa de CNPJ válido (inclusive o novo formato alfanumérico)', async () => {
  const c = srv.client();
  await c.init();
  const base = {
    role: 'supplier', name: 'Dona Maria', email: 'maria@example.com', password: 'bolo-de-fuba-77', acceptTerms: true,
    storeName: 'Bolos da Maria', storeType: 'bakery', phone: '66999998888', city: 'Barra do Garças',
    neighborhood: 'Centro', address: 'Rua A, 10',
  };
  const bad = await c.post('/api/auth/register', { ...base, cnpj: '11.111.111/1111-11' });
  assert.equal(bad.error.fields.cnpj, 'invalid_cnpj');
  const ok = await c.post('/api/auth/register', { ...base, cnpj: '12.ABC.345/01DE-35' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.ok(ok.data.user.store);
});

test('controle de acesso: papéis e pedidos de outras pessoas', async () => {
  const buyer = srv.client();
  await buyer.login('cliente@demo.com');
  assert.equal((await buyer.get('/api/supplier/offers')).status, 403);
  assert.equal((await buyer.get('/api/admin/users')).status, 403);
  const anon = srv.client();
  assert.equal((await anon.get('/api/orders')).status, 401);

  const orders = await buyer.get('/api/orders');
  const mine = orders.data[0];
  const other = srv.client();
  await other.init();
  await other.post('/api/auth/register', {
    role: 'buyer', name: 'Outra Pessoa', email: 'outra@example.com', password: 'mandioca-frita-88', acceptTerms: true,
  });
  const peek = await other.get(`/api/orders/${mine.id}`);
  assert.equal(peek.status, 404, 'pedido alheio deve parecer inexistente');
});

test('entradas malformadas: JSON inválido, tipo errado, corpo grande e __proto__', async () => {
  const c = srv.client();
  await c.init();
  const invalid = await c.raw('POST', '/api/auth/login', { body: '{"email":', json: false, headers: { 'content-type': 'application/json' } });
  assert.equal(invalid.status, 400);
  const form = await c.raw('POST', '/api/auth/login', { body: 'email=a', json: false, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 415);
  const huge = await c.raw('POST', '/api/auth/login', { body: { email: 'a@b.co', password: 'x'.repeat(100_000) } });
  assert.equal(huge.status, 413);
  const polluted = await c.raw('POST', '/api/auth/login', {
    body: '{"email":"x@y.com","password":"abcdefgh","__proto__":{"isAdmin":true}}', json: false,
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(polluted.status, 401);
  assert.equal({}.isAdmin, undefined);
});

test('busca com caracteres especiais não quebra a consulta (SQL injection)', async () => {
  const c = srv.client();
  for (const q of ["' OR 1=1 --", '%', '_', '"; DROP TABLE offers; --', '\\']) {
    const r = await c.get(`/api/offers?q=${encodeURIComponent(q)}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.total, 0, `"${q}" não deveria encontrar nada`);
  }
  const all = await c.get('/api/offers');
  assert.ok(all.data.total > 10, 'a tabela de ofertas continua intacta');
});

test('arquivos estáticos: path traversal e arquivos ocultos não são servidos', async () => {
  for (const url of ['/../package.json', '/%2e%2e/package.json', '/assets/../../server/config.js', '/.env', '/%2e%2e%2fdata/secret.key']) {
    const res = await fetch(srv.base + url);
    assert.equal(res.status, 404, url);
  }
  const page = await fetch(srv.base + '/explorar', { headers: { accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
});

test('administrador suspende conta e a sessão da pessoa cai na hora', async () => {
  const victim = srv.client();
  await victim.init();
  const reg = await victim.post('/api/auth/register', {
    role: 'buyer', name: 'Conta Suspensa', email: 'suspensa@example.com', password: 'pamonha-de-milho-5', acceptTerms: true,
  });
  assert.equal(reg.status, 201);
  const admin = srv.client();
  await admin.login('admin@demo.com');
  const r = await admin.patch(`/api/admin/users/${reg.data.user.id}`, { status: 'suspended' });
  assert.equal(r.status, 200);
  assert.equal((await victim.get('/api/account')).status, 401);
});
