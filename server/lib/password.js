import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';

const LOG_N = 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 96 * 1024 * 1024;

function scrypt(password, salt, logN, r, p) {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEY_LENGTH, { N: 2 ** logN, r, p, maxmem: MAX_MEMORY }, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, LOG_N, R, P);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, logN, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64url');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64url'), +logN, +r, +p);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const needsRehash = (stored) => !String(stored).startsWith(`scrypt$${LOG_N}$${R}$${P}$`);

let dummyHash = null;
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, dummyHash);
  return false;
}

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
  'password', 'password1', 'password123', 'senha123', 'senha1234', 'senhasenha', 'mudar123',
  'qwerty123', 'qwertyui', 'asdfghjk', 'abc12345', 'abcd1234', 'a1b2c3d4', 'iloveyou',
  'brasil123', 'brasil2026', 'flamengo', 'corinthians', 'palmeiras', 'santos123', 'gremio123',
  'princesa', 'admin123', 'administrador', 'welcome1', 'letmein1', 'pratofeito', 'pratofeito123',
  'comida123', 'teste123', 'teste1234', 'demo1234', 'contrasena', 'contraseña', '1q2w3e4r', '1qaz2wsx',
]);

export function passwordProblem(password, { email = '', name = '' } = {}) {
  if (typeof password !== 'string' || password.length < 8) return 'too_short';
  if (password.length > 128) return 'too_long';
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'common_password';
  if (/^(.)\1+$/.test(password)) return 'common_password';
  if ('0123456789abcdefghijklmnopqrstuvwxyz'.includes(lower) || '9876543210'.includes(lower)) return 'common_password';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'contains_personal_info';
  const first = name.split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) return 'contains_personal_info';
  if (new Set(password).size < 4) return 'too_simple';
  return null;
}
