import { HttpError } from './errors.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function readJson(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '').toLowerCase();
    const length = Number(req.headers['content-length'] || 0);
    if (length === 0 && !req.headers['transfer-encoding']) return resolve({});
    if (!type.startsWith('application/json')) {
      req.resume();
      return reject(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE'));
    }
    if (length > limitBytes) {
      req.resume();
      return reject(new HttpError(413, 'PAYLOAD_TOO_LARGE'));
    }
    let size = 0;
    const chunks = [];
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limitBytes) {
        failed = true;
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE'));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) return resolve({});
      try {
        resolve(JSON.parse(text, (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value)));
      } catch {
        reject(new HttpError(400, 'INVALID_JSON'));
      }
    });
    req.on('error', () => { if (!failed) { failed = true; reject(new HttpError(400, 'BAD_REQUEST')); } });
  });
}
