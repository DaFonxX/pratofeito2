import { readdirSync, statSync, readFileSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

export function createStatic(publicDir) {
  const root = path.resolve(publicDir);
  const files = listFiles(root).sort();

  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(readFileSync(path.join(root, f)));
  const version = hash.digest('hex').slice(0, 12);
  const precache = ['/', ...files
    .filter((f) => f !== 'sw.js' && f !== 'index.html' && !f.endsWith('.txt') && !/maskable|screenshot/.test(f))
    .map((f) => `/${f}`)];

  const cache = new Map();

  async function load(abs) {
    let info;
    try { info = await stat(abs); } catch { return null; }
    if (!info.isFile()) return null;
    const cached = cache.get(abs);
    if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached;
    let body = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    if (path.basename(abs) === 'sw.js') {
      body = Buffer.from(body.toString('utf8')
        .replace('__BUILD_VERSION__', version)
        .replace('"__PRECACHE__"', JSON.stringify(precache)));
    }
    const entry = {
      mtimeMs: info.mtimeMs,
      size: info.size,
      ext,
      type: MIME[ext] || 'application/octet-stream',
      body,
      etag: `"${createHash('sha1').update(body).digest('base64url').slice(0, 22)}"`,
      br: null,
      gzip: null,
    };
    if (COMPRESSIBLE.has(ext) && body.length > 1024) {
      entry.br = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
      entry.gzip = zlib.gzipSync(body, { level: 9 });
    }
    cache.set(abs, entry);
    return entry;
  }

  function cacheControl(rel) {
    if (/^assets\/img\//.test(rel)) return 'public, max-age=86400';
    return 'no-cache';
  }

  function send(req, res, file, rel, status = 200) {
    res.setHeader('Content-Type', file.type);
    res.setHeader('Cache-Control', cacheControl(rel));
    res.setHeader('ETag', file.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    if (rel === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
    if (status === 200 && req.headers['if-none-match'] === file.etag) {
      res.writeHead(304);
      res.end();
      return;
    }
    const accept = String(req.headers['accept-encoding'] || '');
    let body = file.body;
    if (file.br && /\bbr\b/.test(accept)) {
      body = file.br;
      res.setHeader('Content-Encoding', 'br');
    } else if (file.gzip && /\bgzip\b/.test(accept)) {
      body = file.gzip;
      res.setHeader('Content-Encoding', 'gzip');
    }
    res.setHeader('Content-Length', body.length);
    res.writeHead(status);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end('404 - Not found');
  }

  async function serve(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return notFound(res); }
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.includes('..')) return notFound(res);

    const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
    const hidden = rel.split('/').some((seg) => seg.startsWith('.'));
    const abs = path.resolve(root, rel);
    const inside = abs === root || abs.startsWith(root + path.sep);

    if (!hidden && inside && rel !== '') {
      const file = await load(abs);
      if (file) return send(req, res, file, rel);
    }

    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    if (!path.extname(rel) && wantsHtml && !rel.startsWith('assets/')) {
      const index = await load(path.join(root, 'index.html'));
      if (index) return send(req, res, index, 'index.html');
    }
    return notFound(res);
  }

  return { serve, version, files };
}
