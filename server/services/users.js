import { HttpError, conflict, forbidden, notFound, unprocessable } from '../http/errors.js';
import { limiters } from '../http/ratelimit.js';
import { newId } from '../lib/ids.js';
import { dummyVerify, hashPassword, needsRehash, passwordProblem, verifyPassword } from '../lib/password.js';
import { nowIso } from '../lib/time.js';

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    city: row.city ?? '',
    neighborhood: row.neighborhood ?? '',
    address: row.address ?? '',
    locale: row.locale ?? null,
    createdAt: row.created_at,
    isDemo: !!row.is_demo,
    store: row.store_id ? { id: row.store_id, name: row.store_name } : null,
  };
}

export function createUsers({ db, sessions, audit }) {
  const findByEmail = (email) => db.get(`SELECT * FROM users WHERE email = $email`, { email });

  function userWithStore(id) {
    return db.get(
      `SELECT u.*, s.id AS store_id, s.name AS store_name
         FROM users u LEFT JOIN stores s ON s.owner_id = u.id WHERE u.id = $id`,
      { id },
    );
  }

  async function register(input, { ip, userAgent }) {
    const problem = passwordProblem(input.password, input);
    if (problem) throw unprocessable('VALIDATION_ERROR', { fields: { password: problem } });
    if (findByEmail(input.email)) throw conflict('EMAIL_IN_USE', { fields: { email: 'email_in_use' } });
    if (input.role === 'supplier' && db.get(`SELECT 1 FROM stores WHERE cnpj = $cnpj`, { cnpj: input.cnpj })) {
      throw conflict('CNPJ_IN_USE', { fields: { cnpj: 'cnpj_in_use' } });
    }
    const passwordHash = await hashPassword(input.password);
    const now = nowIso();
    const userId = newId();

    db.transaction(() => {
      db.run(
        `INSERT INTO users (id, role, name, email, password_hash, phone, city, neighborhood, address, locale,
                            created_at, updated_at, password_changed_at)
         VALUES ($id, $role, $name, $email, $hash, $phone, $city, $neighborhood, $address, $locale, $now, $now, $now)`,
        {
          id: userId, role: input.role, name: input.name, email: input.email, hash: passwordHash,
          phone: input.phone ?? null, city: input.city ?? null, neighborhood: input.neighborhood ?? null,
          address: input.address ?? null, locale: input.locale ?? null, now,
        },
      );
      if (input.role === 'supplier') {
        db.run(
          `INSERT INTO stores (id, owner_id, name, type, cnpj, description, phone, address, neighborhood, city,
                               emoji, created_at, updated_at)
           VALUES ($id, $owner, $name, $type, $cnpj, '', $phone, $address, $neighborhood, $city, $emoji, $now, $now)`,
          {
            id: newId(), owner: userId, name: input.storeName, type: input.storeType, cnpj: input.cnpj,
            phone: input.phone ?? null, address: input.address, neighborhood: input.neighborhood,
            city: input.city, emoji: storeEmoji(input.storeType), now,
          },
        );
      }
    });
    audit.record('auth.register', { userId, ip, details: { role: input.role } });
    const session = sessions.create(userId, { userAgent, ip });
    return { user: toPublicUser(userWithStore(userId)), session };
  }

  async function login({ email, password }, { ip, userAgent }) {
    const lockKey = `login:${email}`;
    const lock = limiters.loginFailures.peek(lockKey);
    if (lock.blocked) {
      audit.record('auth.locked', { ip, details: { email } });
      throw new HttpError(429, 'ACCOUNT_LOCKED', { retryAfter: lock.retryAfter });
    }
    const user = findByEmail(email);
    const ok = user ? await verifyPassword(password, user.password_hash) : await dummyVerify(password);
    if (!ok) {
      limiters.loginFailures.hit(lockKey);
      audit.record('auth.login_failed', { userId: user?.id ?? null, ip, details: { email } });
      throw new HttpError(401, 'INVALID_CREDENTIALS');
    }
    if (user.status !== 'active') {
      audit.record('auth.login_blocked', { userId: user.id, ip });
      throw forbidden('ACCOUNT_SUSPENDED');
    }
    limiters.loginFailures.reset(lockKey);
    const now = nowIso();
    if (needsRehash(user.password_hash)) {
      db.run(`UPDATE users SET password_hash = $hash WHERE id = $id`, { id: user.id, hash: await hashPassword(password) });
    }
    db.run(`UPDATE users SET last_login_at = $now WHERE id = $id`, { id: user.id, now });
    const session = sessions.create(user.id, { userAgent, ip });
    audit.record('auth.login', { userId: user.id, ip });
    return { user: toPublicUser(userWithStore(user.id)), session };
  }

  function updateProfile(userId, changes) {
    const allowed = ['name', 'phone', 'city', 'neighborhood', 'address', 'locale'];
    const keys = allowed.filter((k) => k in changes);
    if (keys.length) {
      const sets = keys.map((k) => `${k} = $${k}`).join(', ');
      const params = { id: userId, now: nowIso() };
      for (const k of keys) params[k] = changes[k] === '' ? null : changes[k];
      db.run(`UPDATE users SET ${sets}, updated_at = $now WHERE id = $id`, params);
    }
    return toPublicUser(userWithStore(userId));
  }

  async function changePassword(userId, { currentPassword, newPassword }, { ip, sessionId }) {
    const user = db.get(`SELECT * FROM users WHERE id = $id`, { id: userId });
    if (!user) throw notFound();
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      audit.record('account.password_change_failed', { userId, ip });
      throw unprocessable('VALIDATION_ERROR', { fields: { currentPassword: 'wrong_password' } });
    }
    const problem = passwordProblem(newPassword, user);
    if (problem) throw unprocessable('VALIDATION_ERROR', { fields: { newPassword: problem } });
    if (await verifyPassword(newPassword, user.password_hash)) {
      throw unprocessable('VALIDATION_ERROR', { fields: { newPassword: 'same_password' } });
    }
    const now = nowIso();
    db.run(
      `UPDATE users SET password_hash = $hash, password_changed_at = $now, updated_at = $now WHERE id = $id`,
      { id: userId, hash: await hashPassword(newPassword), now },
    );
    const closed = sessions.destroyAll(userId, sessionId);
    audit.record('account.password_changed', { userId, ip, details: { otherSessionsClosed: closed } });
    return { otherSessionsClosed: closed };
  }

  function exportData(userId) {
    const user = userWithStore(userId);
    if (!user) throw notFound();
    const store = db.get(`SELECT * FROM stores WHERE owner_id = $id`, { id: userId });
    const orders = db.all(
      `SELECT o.code, o.status, o.fulfillment, o.delivery_address, o.payment_method, o.subtotal_cents,
              o.delivery_fee_cents, o.total_cents, o.original_total_cents, o.items_count, o.weight_grams,
              o.notes, o.rating, o.review, o.created_at, o.completed_at, o.cancelled_at, s.name AS store_name, o.id
         FROM orders o JOIN stores s ON s.id = o.store_id
        WHERE o.buyer_id = $id ORDER BY o.created_at`,
      { id: userId },
    );
    const items = db.all(
      `SELECT i.order_id, i.title, i.category, i.unit, i.quantity, i.unit_price_cents, i.unit_original_price_cents
         FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.buyer_id = $id`,
      { id: userId },
    );
    const offers = store ? db.all(
      `SELECT id, title, description, category, emoji, unit, weight_grams, original_price_cents, price_cents,
              quantity, max_per_order, expires_on, pickup_start, pickup_end, tags, status, created_at
         FROM offers WHERE store_id = $id ORDER BY created_at`,
      { id: store.id },
    ) : [];
    const activity = db.all(
      `SELECT at, event FROM audit_log WHERE user_id = $id ORDER BY id DESC LIMIT 200`, { id: userId },
    );
    audit.record('account.exported', { userId });
    return {
      format: 'pratofeito-export',
      version: 1,
      exportedAt: nowIso(),
      account: toPublicUser(user),
      store: store ? {
        name: store.name, type: store.type, cnpj: store.cnpj, description: store.description,
        address: store.address, neighborhood: store.neighborhood, city: store.city,
        opensAt: store.opens_at, closesAt: store.closes_at, delivery: !!store.delivery,
        deliveryFeeCents: store.delivery_fee_cents, createdAt: store.created_at,
      } : null,
      offers,
      orders: orders.map(({ id, ...o }) => ({ ...o, items: items.filter((i) => i.order_id === id).map(({ order_id: _, ...i }) => i) })),
      sessions: sessions.listForUser(userId).map(({ id: _, ...s }) => s),
      activity,
    };
  }

  async function deleteAccount(userId, password, { ip }) {
    const user = db.get(`SELECT * FROM users WHERE id = $id`, { id: userId });
    if (!user) throw notFound();
    if (user.role === 'admin') throw forbidden('ADMIN_CANNOT_SELF_DELETE');
    if (!(await verifyPassword(password, user.password_hash))) {
      throw unprocessable('VALIDATION_ERROR', { fields: { password: 'wrong_password' } });
    }
    const now = nowIso();
    db.transaction(() => {
      if (user.role === 'supplier') {
        db.run(`UPDATE stores SET status = 'paused', updated_at = $now WHERE owner_id = $id`, { id: userId, now });
        db.run(`UPDATE offers SET status = 'archived', updated_at = $now
                 WHERE store_id = (SELECT id FROM stores WHERE owner_id = $id)`, { id: userId, now });
        db.run(
          `UPDATE users SET name = 'Conta excluída', email = $email, phone = NULL, city = NULL, neighborhood = NULL,
                  address = NULL, password_hash = 'disabled', status = 'suspended', updated_at = $now WHERE id = $id`,
          { id: userId, email: `excluida-${userId}@invalid.local`, now },
        );
        db.run(`DELETE FROM sessions WHERE user_id = $id`, { id: userId });
      } else {
        db.run(`UPDATE orders SET delivery_address = NULL, notes = NULL WHERE buyer_id = $id`, { id: userId });
        db.run(`DELETE FROM users WHERE id = $id`, { id: userId });
      }
    });
    audit.record('account.deleted', { ip, details: { role: user.role } });
  }

  function listUsers({ q = '', role = null, status = null, page = 1, pageSize = 25 }) {
    const where = [];
    const params = {};
    if (q) {
      where.push(`(lower(u.name) LIKE $q ESCAPE '\\' OR lower(u.email) LIKE $q ESCAPE '\\' OR lower(ifnull(s.name, '')) LIKE $q ESCAPE '\\')`);
      params.q = `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    }
    if (role) { where.push('u.role = $role'); params.role = role; }
    if (status) { where.push('u.status = $status'); params.status = status; }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.value(`SELECT COUNT(*) FROM users u LEFT JOIN stores s ON s.owner_id = u.id ${clause}`, params);
    const items = db.all(
      `SELECT u.id, u.role, u.name, u.email, u.city, u.status, u.created_at, u.last_login_at,
              s.name AS store_name,
              (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS orders_count
         FROM users u LEFT JOIN stores s ON s.owner_id = u.id
         ${clause}
        ORDER BY u.created_at DESC LIMIT $limit OFFSET $offset`,
      { ...params, limit: pageSize, offset: (page - 1) * pageSize },
    );
    return { total, page, pageSize, items };
  }

  function setUserStatus(adminId, targetId, status, { ip }) {
    if (adminId === targetId) throw forbidden('CANNOT_CHANGE_SELF');
    const target = db.get(`SELECT id, role FROM users WHERE id = $id`, { id: targetId });
    if (!target) throw notFound();
    if (target.role === 'admin') throw forbidden('CANNOT_CHANGE_ADMIN');
    db.run(`UPDATE users SET status = $status, updated_at = $now WHERE id = $id`, { id: targetId, status, now: nowIso() });
    if (status === 'suspended') sessions.destroyAll(targetId);
    audit.record('admin.user_status', { userId: adminId, ip, details: { target: targetId, status } });
    return { id: targetId, status };
  }

  async function ensureAdmin(email, password) {
    if (!email || !password) return false;
    if (findByEmail(email.toLowerCase())) return false;
    const problem = passwordProblem(password, { email });
    if (problem) throw new Error(`ADMIN_PASSWORD fraca (${problem}). Use 12+ caracteres variados.`);
    const now = nowIso();
    db.run(
      `INSERT INTO users (id, role, name, email, password_hash, created_at, updated_at, password_changed_at)
       VALUES ($id, 'admin', 'Administrador', $email, $hash, $now, $now, $now)`,
      { id: newId(), email: email.toLowerCase(), hash: await hashPassword(password), now },
    );
    return true;
  }

  return {
    register, login, updateProfile, changePassword, exportData, deleteAccount,
    listUsers, setUserStatus, ensureAdmin, userWithStore,
  };
}

function storeEmoji(type) {
  return { restaurant: '🍲', bakery: '🥖', market: '🛒', produce: '🥬', cafe: '☕', farm: '🚜', other: '🏪' }[type] ?? '🍽️';
}
