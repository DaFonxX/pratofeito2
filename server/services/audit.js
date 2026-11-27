import { nowIso } from '../lib/time.js';

export function createAudit(db, config) {
  function record(event, { userId = null, ip = null, details = null } = {}) {
    try {
      db.run(
        `INSERT INTO audit_log (at, user_id, event, ip, details) VALUES ($at, $userId, $event, $ip, $details)`,
        { at: nowIso(), userId, event, ip, details: details ? JSON.stringify(details).slice(0, 1000) : null },
      );
    } catch {
    }
  }

  function purgeOld() {
    const cutoff = new Date(Date.now() - config.auditRetentionDays * 86400000).toISOString();
    return db.run(`DELETE FROM audit_log WHERE at < $cutoff`, { cutoff }).changes;
  }

  function list({ event = null, page = 1, pageSize = 50 } = {}) {
    const where = event ? 'WHERE a.event = $event' : '';
    const params = event ? { event } : {};
    const total = db.value(`SELECT COUNT(*) FROM audit_log a ${where}`, params);
    const rows = db.all(
      `SELECT a.id, a.at, a.event, a.ip, a.details, u.name AS user_name, u.email AS user_email, u.role AS user_role
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         ${where}
        ORDER BY a.id DESC LIMIT $limit OFFSET $offset`,
      { ...params, limit: pageSize, offset: (page - 1) * pageSize },
    );
    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({ ...r, details: r.details ? safeParse(r.details) : null })),
    };
  }

  return { record, purgeOld, list };
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}
