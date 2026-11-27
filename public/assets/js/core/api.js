export class ApiError extends Error {
  constructor(status, code, details = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get fields() { return this.details.fields ?? {}; }
}

let csrfToken = null;
let onUnauthenticated = () => {};

export const setCsrfToken = (token) => { if (token) csrfToken = token; };
export const setUnauthenticatedHandler = (fn) => { onUnauthenticated = fn; };

async function refreshCsrf() {
  const res = await fetch('/api/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const payload = await res.json();
  csrfToken = payload.data.csrfToken;
  return payload.data;
}

export async function api(path, { method = 'GET', body, signal, retry = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    if (!csrfToken) await refreshCsrf();
    headers['X-CSRF-Token'] = csrfToken;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, navigator.onLine === false ? 'OFFLINE' : 'NETWORK');
  }
  let payload = null;
  try { payload = await res.json(); } catch {}

  if (res.ok) {
    if (payload?.data?.csrfToken) csrfToken = payload.data.csrfToken;
    return payload?.data;
  }
  const error = payload?.error ?? {};
  const code = error.code ?? (res.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
  if (code === 'CSRF_FAILED' && retry) {
    await refreshCsrf();
    return api(path, { method, body, signal, retry: false });
  }
  if (res.status === 401) onUnauthenticated();
  const { code: _code, ...details } = error;
  throw new ApiError(res.status, code, details);
}

export const get = (path, opts) => api(path, { ...opts, method: 'GET' });
export const post = (path, body, opts) => api(path, { ...opts, method: 'POST', body: body ?? {} });
export const patch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body });
export const del = (path, opts) => api(path, { ...opts, method: 'DELETE' });
export { refreshCsrf };
