import { config } from '../config.js';

export class RateLimiter {
  constructor({ windowMs, max, maxKeys = 50_000 }) {
    this.windowMs = windowMs;
    this.max = max;
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  hit(key, cost = 1) {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || entry.reset <= now) {
      if (!entry && this.hits.size >= this.maxKeys) this.sweep(true);
      entry = { count: 0, reset: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += cost;
    return {
      allowed: entry.count <= this.max,
      limit: this.max,
      remaining: Math.max(0, this.max - entry.count),
      retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1000)),
    };
  }

  peek(key) {
    const entry = this.hits.get(key);
    if (!entry || entry.reset <= Date.now()) return { count: 0, blocked: false };
    return { count: entry.count, blocked: entry.count >= this.max, retryAfter: Math.ceil((entry.reset - Date.now()) / 1000) };
  }

  reset(key) { this.hits.delete(key); }

  sweep(force = false) {
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      if (entry.reset <= now) this.hits.delete(key);
    }
    if (force && this.hits.size >= this.maxKeys) {
      let toDrop = Math.ceil(this.maxKeys * 0.1);
      for (const key of this.hits.keys()) {
        this.hits.delete(key);
        if (--toDrop <= 0) break;
      }
    }
  }
}

export const limiters = {
  api: new RateLimiter({ windowMs: 60_000, max: 300 }),
  auth: new RateLimiter({ windowMs: 10 * 60_000, max: config.authRateLimit }),
  loginFailures: new RateLimiter({ windowMs: 15 * 60_000, max: 5 }),
  writes: new RateLimiter({ windowMs: 60_000, max: 60 }),
  orders: new RateLimiter({ windowMs: 10 * 60_000, max: 10 }),
};

setInterval(() => { for (const l of Object.values(limiters)) l.sweep(); }, 60_000).unref();
