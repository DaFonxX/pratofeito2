import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function startTestServer({ demo = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pratofeito-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATA_DIR = dir;
  process.env.DEMO_MODE = demo ? '1' : '0';
  process.env.APP_SECRET = 'test-secret-with-at-least-32-characters!!';
  process.env.AUTH_RATE_LIMIT = '200';
  const { createServer } = await import('../server/main.js');
  const app = await createServer({ reset: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    app,
    base,
    client: () => new Client(base),
    async stop() {
      await app.close();
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

export class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
    this.csrf = null;
  }

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  store(res) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (/Max-Age=0/i.test(line) || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async raw(method, url, { body, headers = {}, csrf = true, json = true } = {}) {
    const h = { ...headers };
    if (this.cookies.size) h.cookie = this.cookieHeader();
    if (csrf && this.csrf && method !== 'GET') h['x-csrf-token'] = this.csrf;
    if (body !== undefined && json) h['content-type'] = 'application/json';
    const res = await fetch(this.base + url, {
      method, headers: h, body: body === undefined ? undefined : (json ? JSON.stringify(body) : body), redirect: 'manual',
    });
    this.store(res);
    return res;
  }

  async request(method, url, options = {}) {
    const res = await this.raw(method, url, options);
    const type = res.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await res.json() : await res.text();
    if (payload?.data?.csrfToken) this.csrf = payload.data.csrfToken;
    return { status: res.status, headers: res.headers, body: payload, data: payload?.data, error: payload?.error };
  }

  async init() {
    const r = await this.request('GET', '/api/session');
    this.csrf = r.data.csrfToken;
    return r;
  }

  get(url, o) { return this.request('GET', url, o); }
  post(url, body, o = {}) { return this.request('POST', url, { ...o, body }); }
  patch(url, body, o = {}) { return this.request('PATCH', url, { ...o, body }); }
  del(url, o = {}) { return this.request('DELETE', url, o); }

  async login(email, password = 'Prato#2026') {
    await this.init();
    const r = await this.post('/api/auth/login', { email, password });
    if (r.status !== 200) throw new Error(`login falhou: ${JSON.stringify(r.body)}`);
    return r.data.user;
  }
}
