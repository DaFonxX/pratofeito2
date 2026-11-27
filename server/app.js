import { randomBytes } from 'node:crypto';
import { config } from './config.js';
import { readJson } from './http/body.js';
import { parseCookies, serializeCookie } from './http/cookies.js';
import { HttpError, forbidden, notFound, tooMany, unauthenticated } from './http/errors.js';
import { limiters } from './http/ratelimit.js';
import {
  anonymizeIp, clientIp, cookieNames, csrfTokenFor, sameOrigin, setSecurityHeaders, verifyCsrf,
} from './http/security.js';
import { log } from './lib/log.js';

const SAFE_METHODS = new Set(['GET', 'HEAD']);
const CSRF_COOKIE_RE = /^[A-Za-z0-9_-]{43}$/;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function createApp({ router, services, staticFiles }) {
  async function handleApi(req, res, url, requestId) {
    res.setHeader('Cache-Control', 'no-store');
    const ip = clientIp(req);
    const cookiesOut = [];
    const ctx = {
      req, res, url, requestId, ip,
      ipAnon: anonymizeIp(ip),
      query: url.searchParams,
      params: {},
      body: {},
      user: null,
      sessionId: '',
      csrfCookie: '',
      status: 200,
      handled: false,
      setCookie(name, value, opts) { cookiesOut.push(serializeCookie(name, value, { secure: config.cookieSecure, ...opts })); },
      csrfToken() { return csrfTokenFor(ctx.csrfCookie, ctx.sessionId); },
      startSession(session) {
        ctx.sessionId = session.id;
        ctx.setCookie(cookieNames.session, session.token, { maxAge: config.sessionDays * 86400, httpOnly: true, sameSite: 'Lax' });
      },
      endSession() {
        ctx.sessionId = '';
        ctx.setCookie(cookieNames.session, '', { maxAge: 0 });
      },
      download(content, filename, type) {
        ctx.handled = true;
        const body = Buffer.from(content, 'utf8');
        if (cookiesOut.length) res.setHeader('Set-Cookie', cookiesOut);
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': body.length,
          'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
        });
        res.end(body);
      },
    };

    let status = 500;
    try {
      const limit = limiters.api.hit(`ip:${ip}`);
      res.setHeader('RateLimit-Limit', limit.limit);
      res.setHeader('RateLimit-Remaining', limit.remaining);
      if (!limit.allowed) throw tooMany(limit.retryAfter);

      const match = router.match(req.method, url.pathname);
      if (!match) throw notFound('ROUTE_NOT_FOUND');
      if (match.notAllowed) {
        res.setHeader('Allow', match.notAllowed.join(', '));
        throw new HttpError(405, 'METHOD_NOT_ALLOWED');
      }
      const { route, params } = match;
      ctx.params = params;

      const cookies = parseCookies(req.headers.cookie);
      ctx.csrfCookie = cookies[cookieNames.csrf];
      if (!ctx.csrfCookie || !CSRF_COOKIE_RE.test(ctx.csrfCookie)) {
        ctx.csrfCookie = randomBytes(32).toString('base64url');
        ctx.setCookie(cookieNames.csrf, ctx.csrfCookie, { maxAge: 400 * 86400, httpOnly: true, sameSite: 'Lax' });
      }

      const sessionToken = cookies[cookieNames.session];
      if (sessionToken) {
        const resolved = services.sessions.resolve(sessionToken);
        if (resolved) {
          ctx.user = resolved.user;
          ctx.sessionId = resolved.sessionId;
        } else {
          ctx.setCookie(cookieNames.session, '', { maxAge: 0 });
        }
      }

      const unsafe = !SAFE_METHODS.has(req.method);
      if (unsafe) {
        if (!sameOrigin(req)) {
          services.audit.record('security.origin_blocked', { userId: ctx.user?.id, ip: ctx.ipAnon, details: { path: url.pathname } });
          throw forbidden('CSRF_FAILED');
        }
        if (!verifyCsrf(req.headers['x-csrf-token'], ctx.csrfCookie, ctx.sessionId)) {
          services.audit.record('security.csrf_failed', { userId: ctx.user?.id, ip: ctx.ipAnon, details: { path: url.pathname } });
          throw forbidden('CSRF_FAILED');
        }
      }

      const auth = route.options.auth;
      if (auth) {
        if (!ctx.user) throw unauthenticated();
        const roles = auth === true ? null : [].concat(auth);
        if (roles && !roles.includes(ctx.user.role)) {
          services.audit.record('security.forbidden', { userId: ctx.user.id, ip: ctx.ipAnon, details: { path: url.pathname } });
          throw forbidden();
        }
      }

      if (route.options.rate) {
        const key = ctx.user ? `u:${ctx.user.id}` : `ip:${ip}`;
        const r = limiters[route.options.rate].hit(key);
        if (!r.allowed) {
          services.audit.record('security.rate_limited', { userId: ctx.user?.id, ip: ctx.ipAnon, details: { path: url.pathname } });
          throw tooMany(r.retryAfter);
        }
      }
      if (unsafe && ctx.user) {
        const r = limiters.writes.hit(`u:${ctx.user.id}`);
        if (!r.allowed) throw tooMany(r.retryAfter);
      }

      if (unsafe) ctx.body = await readJson(req, route.options.bodyLimit ?? 32 * 1024);

      const result = await route.handler(ctx);
      if (ctx.handled) { status = 200; return; }
      status = ctx.status;
      if (cookiesOut.length) res.setHeader('Set-Cookie', cookiesOut);
      sendJson(res, status, { data: result ?? null });
    } catch (err) {
      if (err instanceof HttpError) {
        status = err.status;
        if (status === 429 && err.extra?.retryAfter) res.setHeader('Retry-After', String(err.extra.retryAfter));
        if (cookiesOut.length) res.setHeader('Set-Cookie', cookiesOut);
        sendJson(res, status, { error: { code: err.code, ...(err.extra ?? {}) } });
      } else {
        status = 500;
        log.error('Erro inesperado', { requestId, path: url.pathname, error: err?.stack ?? String(err) });
        if (!res.headersSent) sendJson(res, 500, { error: { code: 'INTERNAL', requestId } });
        else res.end();
      }
    } finally {
      ctx.finalStatus = status;
    }
    return ctx;
  }

  return async function handler(req, res) {
    const started = performance.now();
    const requestId = randomBytes(6).toString('hex');
    res.setHeader('X-Request-Id', requestId);
    setSecurityHeaders(req, res);

    let url;
    try {
      if (!req.url || req.url.length > 4096) throw new Error('url');
      url = new URL(req.url, 'http://localhost');
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url, requestId);
      log.debug(`${req.method} ${url.pathname} ${res.statusCode} ${Math.round(performance.now() - started)}ms`);
      return;
    }
    try {
      await staticFiles.serve(req, res, url.pathname);
    } catch (err) {
      log.error('Erro ao servir arquivo', { requestId, error: err?.message });
      if (!res.headersSent) { res.writeHead(500); res.end(); }
    }
  };
}
