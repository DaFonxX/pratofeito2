import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const PERMISSIONS = [
  'accelerometer=()', 'camera=()', 'geolocation=()', 'gyroscope=()', 'magnetometer=()',
  'microphone=()', 'payment=()', 'usb=()', 'interest-cohort=()', 'browsing-topics=()',
].join(', ');

export function isHttps(req) {
  if (req.socket.encrypted) return true;
  return config.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function setSecurityHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP + (isHttps(req) ? '; upgrade-insecure-requests' : ''));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

export function clientIp(req) {
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '') || 'unknown';
}

export function anonymizeIp(ip) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.0');
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::';
  return 'unknown';
}

export function sameOrigin(req) {
  const source = req.headers.origin || req.headers.referer;
  if (!source) return true;
  let origin;
  try { origin = new URL(source).origin; } catch { return false; }
  if (config.publicOrigin) return origin === config.publicOrigin;
  const host = req.headers.host;
  if (!host) return false;
  const proto = isHttps(req) ? 'https' : 'http';
  return origin === `${proto}://${host}`;
}

export function csrfTokenFor(csrfCookie, sessionId = '') {
  return createHmac('sha256', config.secret).update(`csrf:${csrfCookie}:${sessionId}`).digest('base64url');
}

export function verifyCsrf(token, csrfCookie, sessionId = '') {
  if (typeof token !== 'string' || !csrfCookie) return false;
  const expected = Buffer.from(csrfTokenFor(csrfCookie, sessionId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const cookieNames = {
  session: config.cookieSecure ? '__Host-pf_session' : 'pf_session',
  csrf: config.cookieSecure ? '__Host-pf_csrf' : 'pf_csrf',
};
