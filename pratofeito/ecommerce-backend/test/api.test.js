// Teste de ponta a ponta: sobe o servidor de verdade (banco temporário) e usa a API como um cliente faria.
const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const PORT = 38000 + Math.floor(Math.random() * 900), BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-test-'));
let server;
const call = async (url, { method = 'GET', body, token } = {}) => {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
};
const login = async (email) => (await call('/api/auth/login', { method: 'POST', body: { email, password: 'demo12345' } })).json.data.token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test.before(async () => {
  server = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), stdio: 'ignore', env: { ...process.env, PORT, DATA_DIR: dataDir, NODE_ENV: 'test', OPEN_BROWSER: '0' } });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE + '/api/health')).ok) return; } catch { /* ainda subindo */ } await sleep(500); }
  throw new Error('servidor não subiu em 60 s');
});
test.after(async () => { server?.kill(); await sleep(500); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* arquivo ainda em uso: tudo bem */ } });

test('health informa app, versão e banco', async () => {
  const { status, json } = await call('/api/health');
  assert.equal(status, 200); assert.equal(json.data.app, 'pratofeito'); assert.equal(json.data.db_ok, true);
});
test('vitrine lista produtos válidos (dados de demonstração)', async () => {
  const { json } = await call('/api/products');
  assert.ok(json.data.length > 0); assert.ok(json.data.every((p) => p.quantity > 0));
});
test('cadastro, e-mail duplicado e login com senha errada', async () => {
  const body = { type: 'buyer', name: 'Teste', email: `t${Date.now()}@exemplo.com`, password: 'senhaforte1' };
  const a = await call('/api/auth/register', { method: 'POST', body }); assert.equal(a.status, 201); assert.ok(a.json.data.token);
  assert.equal((await call('/api/auth/register', { method: 'POST', body })).status, 409);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: body.email, password: 'errada123' } })).status, 401);
});
test('rotas protegidas exigem login e respeitam o tipo da conta', async () => {
  assert.equal((await call('/api/orders')).status, 401);
  const supplier = await login('fornecedor@demo.com');
  assert.equal((await call('/api/orders', { method: 'POST', token: supplier, body: { items: [], receipt_type: 'pickup' } })).status, 403);
});
test('pedido baixa o estoque', async () => {
  const token = await login('comprador@demo.com');
  const p = (await call('/api/products')).json.data.find((x) => x.quantity >= 2);
  const r = await call('/api/orders', { method: 'POST', token, body: { items: [{ product_id: p.id, quantity: 1 }], receipt_type: 'pickup' } });
  assert.equal(r.status, 201);
  assert.equal((await call(`/api/products/${p.id}`)).json.data.quantity, p.quantity - 1);
});
test('exportação de dados devolve usuário e pedidos', async () => {
  const { status, json } = await call('/api/users/me/export', { token: await login('comprador@demo.com') });
  assert.equal(status, 200); assert.equal(json.data.user.email, 'comprador@demo.com'); assert.ok(json.data.orders.length >= 1);
  assert.equal(json.data.user.password_hash, undefined);
});
test('registro de acesso: grava no banco e no arquivo, com IP anonimizado e sem senhas', async () => {
  let logs; for (let i = 0; i < 10; i++) { logs = (await call('/api/logs')).json?.data; if (logs?.recent.some((r) => r.path === '/api/products')) break; await sleep(300); }
  assert.ok(logs.summary.total > 0); assert.ok(logs.recent.some((r) => r.path === '/api/products'));
  assert.ok(logs.recent.every((r) => !/[0-9a-f]{8}-[0-9a-f]{4}/.test(r.path)), 'UUID deve virar :id');
  const lines = fs.readFileSync(path.join(dataDir, 'access.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.length > 0); assert.ok(lines.every((l) => /\.0$/.test(l.ip) || l.ip.endsWith('::')));
  assert.ok(!JSON.stringify(lines).includes('demo12345'));
});
test('registros ficam restritos a quem acessa de fora sem token', async () => {
  const res = await fetch(BASE + '/api/logs', { headers: { 'X-Forwarded-For': '203.0.113.7' } });
  assert.equal(res.status, 403);
});
