import { randomBytes } from 'node:crypto';
import { sha256 } from '../lib/ids.js';
import { nowIso } from '../lib/time.js';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const ABSOLUTE_MAX_DAYS = 30;

export function createSessions(db, config) {
  const ttlMs = config.sessionDays * 86400000;

  function create(userId, { userAgent = '', ip = null } = {}) {
    const token = randomBytes(32).toString('base64url');
    const id = sha256(token);
    const now = new Date();
    db.run(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent, ip)
       VALUES ($id, $userId, $now, $now, $expires, $ua, $ip)`,
      {
        id, userId, now: now.toISOString(),
        expires: new Date(now.getTime() + ttlMs).toISOString(),
        ua: String(userAgent).slice(0, 200), ip,
      },
    );
    return { token, id };
  }

  function resolve(token) {
    if (typeof token !== 'string' || token.length < 40 || token.length > 60) return null;
    const id = sha256(token);
    const row = db.get(
      `SELECT s.id AS session_id, s.created_at AS session_created, s.last_seen_at, s.expires_at,
              u.id, u.role, u.name, u.email, u.phone, u.city, u.neighborhood, u.address, u.locale,
              u.status, u.created_at, u.is_demo,
              st.id AS store_id, st.name AS store_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN stores st ON st.owner_id = u.id
        WHERE s.id = $id`,
      { id },
    );
    if (!row) return null;
    const now = Date.now();
    if (Date.parse(row.expires_at) <= now || row.status !== 'active') {
      db.run(`DELETE FROM sessions WHERE id = $id`, { id });
      return null;
    }
    if (now - Date.parse(row.last_seen_at) > TOUCH_INTERVAL_MS) {
      const hardLimit = Date.parse(row.session_created) + ABSOLUTE_MAX_DAYS * 86400000;
      db.run(
        `UPDATE sessions SET last_seen_at = $now, expires_at = $expires WHERE id = $id`,
        { id, now: new Date(now).toISOString(), expires: new Date(Math.min(now + ttlMs, hardLimit)).toISOString() },
      );
    }
    const { session_id: sessionId, session_created: _c, last_seen_at: _l, expires_at: _e, ...user } = row;
    return { sessionId, user };
  }

  const destroy = (sessionId) => db.run(`DELETE FROM sessions WHERE id = $id`, { id: sessionId });

  const destroyAll = (userId, exceptId = '') => db.run(
    `DELETE FROM sessions WHERE user_id = $userId AND id <> $exceptId`, { userId, exceptId },
  ).changes;

  const listForUser = (userId) => db.all(
    `SELECT id, created_at, last_seen_at, user_agent FROM sessions
      WHERE user_id = $userId AND expires_at > $now ORDER BY last_seen_at DESC`,
    { userId, now: nowIso() },
  );

  const purgeExpired = () => db.run(`DELETE FROM sessions WHERE expires_at <= $now`, { now: nowIso() }).changes;

  return { create, resolve, destroy, destroyAll, listForUser, purgeExpired, ttlMs };
}
