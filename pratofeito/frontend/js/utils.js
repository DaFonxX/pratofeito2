import { t, locale, getLang } from './i18n.js';
export const API = globalThis.location?.protocol === 'file:' ? 'http://localhost:3000/api' : '/api'; // mesmo servidor que serve o site
const SESSION_KEY = 'pf_token';
export const session = {
  get token() { return sessionStorage.getItem(SESSION_KEY); },
  set token(v) { v ? sessionStorage.setItem(SESSION_KEY, v) : sessionStorage.removeItem(SESSION_KEY); },
  get user() { try { return JSON.parse(atob(this.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; } },
};
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method, body: body && JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang(), ...(session.token && { Authorization: `Bearer ${session.token}` }), ...headers },
    });
  } catch { throw new Error(t('err.network')); }
  const json = await res.json().catch(() => ({ success: false, error: t('err.invalid') }));
  if (res.status === 401 && session.token) { session.token = null; location.hash = '#/login'; }
  if (!json.success) throw Object.assign(new Error(json.error || t('err.unknown')), { status: res.status });
  return json.data;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => Number(n).toLocaleString(locale(), { style: 'currency', currency: 'BRL' });
export const date = (d) => new Date(d).toLocaleDateString(locale(), { timeZone: 'UTC' });
export const isToday = (d) => String(d).slice(0, 10) === new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD no fuso local
let toastTimer; export function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000); }
export const form = (f) => Object.fromEntries(new FormData(f));
// Desativa o botão enquanto a ação roda (evita clique duplo e dá retorno visual).
export async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); } }
}
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
