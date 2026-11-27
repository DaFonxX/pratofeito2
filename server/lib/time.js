import { config } from '../config.js';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: config.timezone, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export const nowIso = () => new Date().toISOString();

export const localDate = (date = new Date()) => dayFormatter.format(date);

export function localTime(date = new Date()) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.hour}:${p.minute}`;
}

export function tzOffsetMinutes(date = new Date()) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

export const sqliteTzModifier = () => `${tzOffsetMinutes()} minutes`;

export function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function startOfLocalDayIso(ymd) {
  const offset = tzOffsetMinutes(new Date(`${ymd}T12:00:00Z`));
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - offset * 60000).toISOString();
}

export const isValidYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
