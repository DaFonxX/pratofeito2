import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) {
  try { process.loadEnvFile(envFile); } catch {}
}

const env = process.env;
const flag = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
};
const int = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const isProd = env.NODE_ENV === 'production';
const dataDir = path.resolve(env.DATA_DIR || path.join(ROOT, 'data'));
mkdirSync(dataDir, { recursive: true });

function loadSecret() {
  if (env.APP_SECRET && env.APP_SECRET.length >= 32) return env.APP_SECRET;
  if (env.APP_SECRET) {
    console.warn('[config] APP_SECRET tem menos de 32 caracteres e foi ignorado.');
  }
  const file = path.join(dataDir, 'secret.key');
  if (existsSync(file)) {
    const saved = readFileSync(file, 'utf8').trim();
    if (saved.length >= 32) return saved;
  }
  const secret = randomBytes(32).toString('base64url');
  writeFileSync(file, secret, { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch {}
  return secret;
}

const args = new Set(process.argv.slice(2));

export const config = Object.freeze({
  env: isProd ? 'production' : (env.NODE_ENV || 'development'),
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: int(env.PORT, 3000, 0, 65535),
  host: env.HOST || (args.has('--lan') ? '0.0.0.0' : '127.0.0.1'),
  dataDir,
  dbFile: env.DB_FILE || path.join(dataDir, 'pratofeito.db'),
  publicDir: path.join(ROOT, 'public'),
  secret: loadSecret(),
  demo: flag(env.DEMO_MODE, !isProd),
  cookieSecure: flag(env.COOKIE_SECURE, isProd),
  trustProxy: flag(env.TRUST_PROXY, false),
  publicOrigin: env.PUBLIC_ORIGIN ? env.PUBLIC_ORIGIN.replace(/\/$/, '') : null,
  timezone: env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
  sessionDays: int(env.SESSION_DAYS, 7, 1, 30),
  freeItemsPerDay: int(env.FREE_ITEMS_PER_DAY, 3, 1, 20),
  authRateLimit: int(env.AUTH_RATE_LIMIT, 20, 5, 1000),
  auditRetentionDays: int(env.AUDIT_RETENTION_DAYS, 180, 7, 3650),
  adminEmail: env.ADMIN_EMAIL || null,
  adminPassword: env.ADMIN_PASSWORD || null,
  logLevel: env.LOG_LEVEL || (isProd ? 'info' : 'info'),
  args,
});
