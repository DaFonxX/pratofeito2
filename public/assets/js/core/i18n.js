export const LOCALES = [
  { code: 'pt-BR', label: 'Português', short: 'PT' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'es', label: 'Español', short: 'ES' },
];

const loaders = {
  'pt-BR': () => import('../i18n/pt-BR.js'),
  en: () => import('../i18n/en.js'),
  es: () => import('../i18n/es.js'),
};

let locale = 'pt-BR';
let dict = {};
let fallback = {};
let plural = new Intl.PluralRules('pt-BR');
const listeners = new Set();

function lookup(source, key) {
  let node = source;
  const parts = key.split('.');
  for (let i = 0; i < parts.length; i++) {
    if (!node || typeof node !== 'object') return undefined;
    if (parts[i] in node) { node = node[parts[i]]; continue; }
    const rest = parts.slice(i).join('.');
    return rest in node ? node[rest] : undefined;
  }
  return node;
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? String(params[name]) : match));
}

export function t(key, params) {
  let value = lookup(dict, key);
  if (value === undefined) value = lookup(fallback, key);
  if (value === undefined) return key;
  if (typeof value === 'object') {
    const count = params?.count ?? 0;
    value = (count === 0 && value.zero) || value[plural.select(count)] || value.other || '';
  }
  return interpolate(String(value), params);
}

export function tMaybe(key, params) {
  return lookup(dict, key) === undefined && lookup(fallback, key) === undefined ? null : t(key, params);
}

export const getLocale = () => locale;

export function detectLocale() {
  const saved = localStorage.getItem('pf.lang');
  if (loaders[saved]) return saved;
  const nav = String(navigator.languages?.[0] || navigator.language || 'pt-BR').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('en')) return 'en';
  return 'pt-BR';
}

export async function setLocale(next, { persist = true } = {}) {
  if (!loaders[next]) next = 'pt-BR';
  const [mod, base] = await Promise.all([loaders[next](), loaders['pt-BR']()]);
  dict = mod.default;
  fallback = base.default;
  locale = next;
  plural = new Intl.PluralRules(next);
  document.documentElement.lang = next;
  if (persist) {
    try { localStorage.setItem('pf.lang', next); } catch {}
  }
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const fn of listeners) fn(next);
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const initI18n = () => setLocale(detectLocale(), { persist: false });
