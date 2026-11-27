import { HttpError } from '../http/errors.js';
import { cleanText } from './text.js';
import { isValidYmd } from './time.js';

class FieldError extends Error {
  constructor(code, meta) { super(code); this.code = code; this.meta = meta; }
}
const fail = (code, meta) => { throw new FieldError(code, meta); };
const isMissing = (v) => v === undefined || v === null || v === '';

function make(check, { optional = false, fallback = undefined } = {}) {
  const fn = (value) => {
    if (isMissing(value)) {
      if (optional) return fallback;
      fail('required');
    }
    return check(value);
  };
  fn.optional = optional;
  return fn;
}

export const v = {
  string: ({ min = 1, max = 200, multiline = false, pattern = null, ...o } = {}) => make((value) => {
    if (typeof value !== 'string' && typeof value !== 'number') fail('invalid');
    const s = cleanText(value, { multiline });
    if (s.length === 0 && !o.optional) fail('required');
    if (s.length < min) fail('too_short', { min });
    if (s.length > max) fail('too_long', { max });
    if (pattern && !pattern.test(s)) fail('invalid');
    return s;
  }, o),

  email: (o = {}) => make((value) => {
    if (typeof value !== 'string') fail('invalid');
    const s = cleanText(value).toLowerCase();
    if (s.length > 254 || !/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(s)) fail('invalid_email');
    return s;
  }, o),

  password: (o = {}) => make((value) => {
    if (typeof value !== 'string') fail('invalid');
    if (value.length > 128) fail('too_long', { max: 128 });
    return value;
  }, o),

  int: ({ min = 0, max = Number.MAX_SAFE_INTEGER, ...o } = {}) => make((value) => {
    const n = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
    if (!Number.isInteger(n)) fail('invalid');
    if (n < min || n > max) fail('out_of_range', { min, max });
    return n;
  }, o),

  enum: (values, o = {}) => make((value) => {
    if (!values.includes(value)) fail('invalid');
    return value;
  }, o),

  bool: (o = {}) => make((value) => {
    if (typeof value !== 'boolean') fail('invalid');
    return value;
  }, o),

  date: (o = {}) => make((value) => {
    if (!isValidYmd(value)) fail('invalid_date');
    return value;
  }, o),

  time: (o = {}) => make((value) => {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('invalid_time');
    return value;
  }, o),

  phone: (o = {}) => make((value) => {
    if (typeof value !== 'string') fail('invalid');
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) fail('invalid_phone');
    return digits;
  }, o),

  cnpj: (o = {}) => make((value) => {
    if (typeof value !== 'string') fail('invalid');
    const c = normalizeCnpj(value);
    if (!isValidCnpj(c)) fail('invalid_cnpj');
    return c;
  }, o),

  tags: (allowed, { max = 6, ...o } = {}) => make((value) => {
    if (!Array.isArray(value) || value.length > max) fail('invalid');
    const out = [...new Set(value)];
    if (!out.every((t) => allowed.includes(t))) fail('invalid');
    return out;
  }, { fallback: [], ...o }),

  array: (item, { min = 0, max = 50, ...o } = {}) => make((value) => {
    if (!Array.isArray(value)) fail('invalid');
    if (value.length < min) fail('too_few', { min });
    if (value.length > max) fail('too_many', { max });
    return value.map((entry, i) => {
      try { return item(entry); } catch (e) {
        if (e instanceof HttpError) {
          const inner = e.extra?.fields ?? {};
          const [key, code] = Object.entries(inner)[0] ?? ['', 'invalid'];
          fail(code, { index: i, key });
        }
        throw e;
      }
    });
  }, o),

  object: (schema, o = {}) => make((value) => validate(value, schema), o),
};

export function validate(input, schema) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(422, 'VALIDATION_ERROR', { fields: { _: 'invalid' } });
  }
  const out = {};
  const fields = {};
  for (const [key, check] of Object.entries(schema)) {
    try {
      const value = check(Object.hasOwn(input, key) ? input[key] : undefined);
      if (value !== undefined) out[key] = value;
    } catch (e) {
      if (e instanceof FieldError) fields[key] = e.code;
      else throw e;
    }
  }
  if (Object.keys(fields).length) throw new HttpError(422, 'VALIDATION_ERROR', { fields });
  return out;
}

export function validatePartial(input, schema) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(422, 'VALIDATION_ERROR', { fields: { _: 'invalid' } });
  }
  const present = Object.fromEntries(Object.entries(schema).filter(([key]) => Object.hasOwn(input, key)));
  if (Object.keys(present).length === 0) throw new HttpError(422, 'VALIDATION_ERROR', { fields: { _: 'empty' } });
  const out = validate(input, present);
  for (const key of Object.keys(present)) {
    if (out[key] === undefined && schema[key].optional) out[key] = '';
  }
  return out;
}

export const normalizeCnpj = (value) => String(value).toUpperCase().replace(/[.\-/\s]/g, '');

export function isValidCnpj(cnpj) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const digit = (base) => {
    let sum = 0;
    let weight = base.length - 7;
    for (const ch of base) {
      sum += (ch.charCodeAt(0) - 48) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(cnpj.slice(0, 12));
  const d2 = digit(cnpj.slice(0, 12) + d1);
  return cnpj.slice(12) === `${d1}${d2}`;
}

export function cnpjFromBase(base12) {
  const digit = (base) => {
    let sum = 0;
    let weight = base.length - 7;
    for (const ch of base) {
      sum += (ch.charCodeAt(0) - 48) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(base12);
  return base12 + d1 + digit(base12 + d1);
}
