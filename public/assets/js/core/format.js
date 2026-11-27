import { getLocale, t } from './i18n.js';

const cache = new Map();
function nf(options) {
  const key = getLocale() + JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(getLocale(), options));
  return cache.get(key);
}
function df(options) {
  const key = 'd' + getLocale() + JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(getLocale(), options));
  return cache.get(key);
}

export const money = (cents) => nf({ style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
export const moneyPlain = (cents) => nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((cents ?? 0) / 100);
export const moneyShort = (cents) => nf({ style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format((cents ?? 0) / 100);
export const number = (n, digits = 0) => nf({ maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n ?? 0);
export const compact = (n) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);
export const percent = (n, digits = 0) => nf({ style: 'percent', maximumFractionDigits: digits }).format((n ?? 0) / 100);
export const kg = (value) => `${number(value, value < 10 ? 1 : 0)} kg`;

const ymdToDate = (ymd) => new Date(`${ymd}T12:00:00`);
export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDaysYmd = (ymd, days) => {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const daysUntil = (ymd) => Math.round((ymdToDate(ymd) - ymdToDate(todayYmd())) / 86400000);

export const date = (value, opts = { day: '2-digit', month: 'short' }) =>
  df(opts).format(typeof value === 'string' && value.length === 10 ? ymdToDate(value) : new Date(value));
export const dateLong = (value) => date(value, { day: 'numeric', month: 'long', year: 'numeric' });
export const dateTime = (value) => df({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const time = (value) => df({ hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const monthLabel = (ym) => df({ month: 'short' }).format(new Date(`${ym}-15T12:00:00`));
export const weekdayShort = (index) => df({ weekday: 'short' }).format(new Date(2026, 10, 1 + index));

export function relativeDay(ymd) {
  const diff = daysUntil(ymd);
  if (diff < 0) return t('time.expired');
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });
  return rtf.format(diff, 'day');
}

export const timeRange = (start, end) => `${start}–${end}`;

export function ago(iso) {
  const seconds = Math.round((new Date(iso) - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'short' });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(Math.round(seconds), 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}

export function parseMoney(text) {
  const s = String(text ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  let normalized = s;
  if (s.includes(',') && s.includes('.')) {
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

export const centsToInput = (cents) => (getLocale() === 'en'
  ? (cents / 100).toFixed(2)
  : (cents / 100).toFixed(2).replace('.', ','));
