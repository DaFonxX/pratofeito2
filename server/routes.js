import { config } from './config.js';
import { Router } from './http/router.js';
import { unprocessable } from './http/errors.js';
import {
  CATEGORIES, FULFILLMENT, LOCALES, OFFER_EMOJIS, ORDER_STATUSES, PAYMENT_METHODS, STORE_EMOJIS, STORE_TYPES, TAGS, UNITS,
} from './lib/catalog.js';
import { addDays, diffDays, isValidYmd, localDate } from './lib/time.js';
import { v, validate, validatePartial } from './lib/validate.js';
import { offerSchema } from './services/offers.js';
import { toPublicUser } from './services/users.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './db/demo-data.js';

const pick = (value, list, fallback = null) => (list.includes(value) ? value : fallback);
const pageOf = (query, max = 200) => {
  const n = Number.parseInt(query.get('page') ?? '1', 10);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : 1;
};

function rangeOf(query) {
  const today = localDate();
  let to = query.get('to');
  let from = query.get('from');
  if (!isValidYmd(to) || to > today) to = today;
  if (!isValidYmd(from)) from = addDays(to, -29);
  if (from > to) throw unprocessable('VALIDATION_ERROR', { fields: { from: 'range_invalid' } });
  if (diffDays(from, to) > 365) throw unprocessable('VALIDATION_ERROR', { fields: { from: 'range_too_long' } });
  return { from, to };
}

export function buildRouter(services, { version }) {
  const { users, offers, orders, reports, sessions, audit, db } = services;
  const r = new Router();
  const started = Date.now();

  r.get('/api/health', () => {
    let database = 'ok';
    try { db.value('SELECT 1'); } catch { database = 'error'; }
    return { status: database === 'ok' ? 'ok' : 'degraded', version, uptimeSeconds: Math.round((Date.now() - started) / 1000), database };
  });

  r.get('/api/session', (ctx) => ({
    user: toPublicUser(ctx.user),
    csrfToken: ctx.csrfToken(),
    version,
  }));

  r.get('/api/meta', () => ({
    categories: CATEGORIES,
    units: UNITS,
    storeTypes: STORE_TYPES,
    tags: TAGS,
    offerEmojis: OFFER_EMOJIS,
    storeEmojis: STORE_EMOJIS,
    paymentMethods: PAYMENT_METHODS,
    freeItemsPerDay: config.freeItemsPerDay,
    timezone: config.timezone,
    today: localDate(),
    demo: config.demo
      ? { accounts: DEMO_ACCOUNTS.map(({ role, email }) => ({ role, email })), password: DEMO_PASSWORD }
      : null,
  }));

  r.get('/api/offers', (ctx) => {
    const q = ctx.query;
    const size = Number.parseInt(q.get('pageSize') ?? '24', 10);
    return offers.listPublic({
      q: (q.get('q') ?? '').slice(0, 60).trim(),
      category: pick(q.get('category'), CATEGORIES),
      price: pick(q.get('price'), ['free', 'paid', 'upto5', 'upto10', 'upto20']),
      expiring: pick(q.get('expiring'), ['today', 'tomorrow']),
      delivery: q.get('delivery') === '1',
      tag: pick(q.get('tag'), TAGS),
      store: /^[A-Za-z0-9_-]{1,64}$/.test(q.get('store') ?? '') ? q.get('store') : null,
      sort: pick(q.get('sort'), ['relevance', 'price', 'discount', 'expiring', 'newest', 'rating'], 'relevance'),
      page: pageOf(q),
      pageSize: Number.isInteger(size) && size >= 1 && size <= 48 ? size : 24,
    });
  });

  r.get('/api/offers/:id', (ctx) => offers.getPublic(ctx.params.id));
  r.get('/api/stores', () => offers.listStores());
  r.get('/api/stores/:id', (ctx) => offers.getPublicStore(ctx.params.id));
  r.get('/api/impact', () => reports.publicImpact());

  const registerSchema = {
    role: v.enum(['buyer', 'supplier']),
    name: v.string({ min: 2, max: 80 }),
    email: v.email(),
    password: v.password(),
    phone: v.phone({ optional: true }),
    city: v.string({ min: 2, max: 60, optional: true }),
    neighborhood: v.string({ min: 2, max: 60, optional: true }),
    address: v.string({ min: 5, max: 160, optional: true }),
    locale: v.enum(LOCALES, { optional: true }),
    acceptTerms: v.bool(),
  };
  const supplierExtra = {
    storeName: v.string({ min: 2, max: 80 }),
    storeType: v.enum(STORE_TYPES),
    cnpj: v.cnpj(),
    phone: v.phone(),
    city: v.string({ min: 2, max: 60 }),
    neighborhood: v.string({ min: 2, max: 60 }),
    address: v.string({ min: 5, max: 160 }),
  };

  r.post('/api/auth/register', async (ctx) => {
    const base = validate(ctx.body, registerSchema);
    if (base.acceptTerms !== true) throw unprocessable('VALIDATION_ERROR', { fields: { acceptTerms: 'required' } });
    const input = base.role === 'supplier' ? { ...base, ...validate(ctx.body, supplierExtra) } : base;
    const { user, session } = await users.register(input, { ip: ctx.ipAnon, userAgent: ctx.req.headers['user-agent'] });
    ctx.startSession(session);
    ctx.status = 201;
    return { user, csrfToken: ctx.csrfToken() };
  }, { rate: 'auth' });

  r.post('/api/auth/login', async (ctx) => {
    const input = validate(ctx.body, { email: v.email(), password: v.password() });
    if (ctx.sessionId) sessions.destroy(ctx.sessionId);
    const { user, session } = await users.login(input, { ip: ctx.ipAnon, userAgent: ctx.req.headers['user-agent'] });
    ctx.startSession(session);
    return { user, csrfToken: ctx.csrfToken() };
  }, { rate: 'auth' });

  r.post('/api/auth/logout', (ctx) => {
    if (ctx.sessionId) {
      sessions.destroy(ctx.sessionId);
      audit.record('auth.logout', { userId: ctx.user?.id, ip: ctx.ipAnon });
    }
    ctx.endSession();
    return { csrfToken: ctx.csrfToken() };
  });

  const profileSchema = {
    name: v.string({ min: 2, max: 80 }),
    phone: v.phone({ optional: true }),
    city: v.string({ min: 2, max: 60, optional: true }),
    neighborhood: v.string({ min: 2, max: 60, optional: true }),
    address: v.string({ min: 5, max: 160, optional: true }),
    locale: v.enum(LOCALES),
  };

  r.get('/api/account', (ctx) => ({
    user: toPublicUser(ctx.user),
    sessions: sessions.listForUser(ctx.user.id).map((s) => ({
      current: s.id === ctx.sessionId, createdAt: s.created_at, lastSeenAt: s.last_seen_at, userAgent: s.user_agent,
    })),
    freeAllowance: ctx.user.role === 'buyer' ? orders.freeAllowance(ctx.user.id) : null,
  }), { auth: true });

  r.patch('/api/account', (ctx) => users.updateProfile(ctx.user.id, validatePartial(ctx.body, profileSchema)), { auth: true });

  r.post('/api/account/password', async (ctx) => {
    const input = validate(ctx.body, { currentPassword: v.password(), newPassword: v.password() });
    return users.changePassword(ctx.user.id, input, { ip: ctx.ipAnon, sessionId: ctx.sessionId });
  }, { auth: true, rate: 'auth' });

  r.post('/api/account/sessions/revoke-others', (ctx) => {
    const closed = sessions.destroyAll(ctx.user.id, ctx.sessionId);
    audit.record('account.sessions_revoked', { userId: ctx.user.id, ip: ctx.ipAnon, details: { closed } });
    return { closed };
  }, { auth: true });

  r.get('/api/account/export', (ctx) => {
    const data = users.exportData(ctx.user.id);
    ctx.download(JSON.stringify(data, null, 2), `pratofeito-meus-dados-${localDate()}.json`, 'application/json; charset=utf-8');
  }, { auth: true });

  r.post('/api/account/delete', async (ctx) => {
    const { password } = validate(ctx.body, { password: v.password() });
    await users.deleteAccount(ctx.user.id, password, { ip: ctx.ipAnon });
    ctx.endSession();
    return { deleted: true, csrfToken: ctx.csrfToken() };
  }, { auth: true, rate: 'auth' });

  const orderSchema = {
    storeId: v.string({ min: 1, max: 64, pattern: /^[A-Za-z0-9_-]+$/ }),
    items: v.array(v.object({
      offerId: v.string({ min: 1, max: 64, pattern: /^[A-Za-z0-9_-]+$/ }),
      quantity: v.int({ min: 1, max: 50 }),
    }), { min: 1, max: 20 }),
    fulfillment: v.enum(FULFILLMENT),
    deliveryAddress: v.string({ min: 5, max: 160, optional: true }),
    paymentMethod: v.enum(PAYMENT_METHODS, { optional: true }),
    notes: v.string({ min: 0, max: 200, optional: true, multiline: true }),
  };

  r.post('/api/orders', (ctx) => {
    const input = validate(ctx.body, orderSchema);
    ctx.status = 201;
    return orders.create(ctx.user, input, { ip: ctx.ipAnon });
  }, { auth: 'buyer', rate: 'orders' });

  r.get('/api/orders', (ctx) => orders.listForBuyer(ctx.user.id), { auth: 'buyer' });
  r.get('/api/orders/:id', (ctx) => orders.getForBuyer(ctx.user.id, ctx.params.id), { auth: 'buyer' });

  r.post('/api/orders/:id/cancel', (ctx) => {
    const { reason } = validate(ctx.body, { reason: v.string({ min: 0, max: 200, optional: true }) });
    return orders.cancelByBuyer(ctx.user.id, ctx.params.id, reason, { ip: ctx.ipAnon });
  }, { auth: 'buyer' });

  r.post('/api/orders/:id/review', (ctx) => {
    const input = validate(ctx.body, {
      rating: v.int({ min: 1, max: 5 }),
      review: v.string({ min: 0, max: 280, optional: true, multiline: true }),
    });
    return orders.review(ctx.user.id, ctx.params.id, input, { ip: ctx.ipAnon });
  }, { auth: 'buyer' });

  r.get('/api/me/impact', (ctx) => reports.buyerReport(ctx.user.id), { auth: 'buyer' });

  const supplier = { auth: 'supplier' };
  const storeSchema = {
    name: v.string({ min: 2, max: 80 }),
    description: v.string({ min: 0, max: 300, optional: true, multiline: true }),
    phone: v.phone({ optional: true }),
    address: v.string({ min: 5, max: 160 }),
    neighborhood: v.string({ min: 2, max: 60 }),
    city: v.string({ min: 2, max: 60 }),
    emoji: v.enum(STORE_EMOJIS),
    opensAt: v.time(),
    closesAt: v.time(),
    delivery: v.bool(),
    deliveryFeeCents: v.int({ min: 0, max: 5000 }),
    status: v.enum(['active', 'paused']),
  };

  r.get('/api/supplier/summary', (ctx) => {
    const store = offers.storeOf(ctx.user.id);
    return { store: { id: store.id, name: store.name, status: store.status, emoji: store.emoji }, ...orders.storeSummary(store.id) };
  }, supplier);

  r.get('/api/supplier/store', (ctx) => mapOwnStore(offers.storeOf(ctx.user.id)), supplier);

  r.patch('/api/supplier/store', (ctx) => offers.updateStore(ctx.user.id, validatePartial(ctx.body, storeSchema),
    { userId: ctx.user.id, ip: ctx.ipAnon }), supplier);

  r.get('/api/supplier/offers', (ctx) => offers.listForStore(offers.storeOf(ctx.user.id).id), supplier);

  r.post('/api/supplier/offers', (ctx) => {
    const store = offers.storeOf(ctx.user.id);
    ctx.status = 201;
    return offers.create(store, validate(ctx.body, offerSchema), { userId: ctx.user.id, ip: ctx.ipAnon });
  }, supplier);

  r.get('/api/supplier/offers.csv', (ctx) => {
    const store = offers.storeOf(ctx.user.id);
    const delimiter = ctx.query.get('lang') === 'en' ? ',' : ';';
    ctx.download(offers.exportCsv(store.id, { delimiter }), `pratofeito-ofertas-${localDate()}.csv`, 'text/csv; charset=utf-8');
  }, supplier);

  r.post('/api/supplier/offers/import', (ctx) => {
    const { csv } = validate(ctx.body, { csv: v.string({ min: 10, max: 200_000, multiline: true }) });
    return offers.importCsv(offers.storeOf(ctx.user.id), csv, { userId: ctx.user.id, ip: ctx.ipAnon });
  }, { ...supplier, bodyLimit: 256 * 1024 });

  r.get('/api/supplier/offers/:id', (ctx) => offers.getForStore(offers.storeOf(ctx.user.id).id, ctx.params.id), supplier);

  r.patch('/api/supplier/offers/:id', (ctx) => {
    const changes = validatePartial(ctx.body, { ...offerSchema, status: v.enum(['active', 'paused']) });
    return offers.update(offers.storeOf(ctx.user.id), ctx.params.id, changes, { userId: ctx.user.id, ip: ctx.ipAnon });
  }, supplier);

  r.delete('/api/supplier/offers/:id', (ctx) => offers.remove(offers.storeOf(ctx.user.id), ctx.params.id,
    { userId: ctx.user.id, ip: ctx.ipAnon }), supplier);

  r.get('/api/supplier/orders', (ctx) => orders.listForStore(offers.storeOf(ctx.user.id).id, {
    scope: ctx.query.get('scope') === 'history' ? 'history' : 'active',
    page: pageOf(ctx.query),
  }), supplier);

  r.post('/api/supplier/orders/:id/status', (ctx) => {
    const input = validate(ctx.body, {
      status: v.enum(ORDER_STATUSES.filter((s) => s !== 'pending')),
      pickupCode: v.string({ min: 4, max: 4, pattern: /^\d{4}$/, optional: true }),
      reason: v.string({ min: 0, max: 200, optional: true }),
    });
    return orders.updateStatusByStore(offers.storeOf(ctx.user.id).id, ctx.params.id, input, { userId: ctx.user.id, ip: ctx.ipAnon });
  }, supplier);

  r.get('/api/supplier/reports', (ctx) => {
    const { from, to } = rangeOf(ctx.query);
    return reports.storeReport(offers.storeOf(ctx.user.id).id, from, to);
  }, supplier);

  r.get('/api/supplier/reports/orders.csv', (ctx) => {
    const { from, to } = rangeOf(ctx.query);
    const locale = pick(ctx.query.get('lang'), LOCALES, 'pt-BR');
    const csv = reports.ordersCsv({ storeId: offers.storeOf(ctx.user.id).id, from, to, locale });
    ctx.download(csv, `pratofeito-pedidos-${from}_${to}.csv`, 'text/csv; charset=utf-8');
  }, supplier);

  const admin = { auth: 'admin' };

  r.get('/api/admin/reports', (ctx) => {
    const { from, to } = rangeOf(ctx.query);
    return reports.adminReport(from, to);
  }, admin);

  r.get('/api/admin/reports/orders.csv', (ctx) => {
    const { from, to } = rangeOf(ctx.query);
    const locale = pick(ctx.query.get('lang'), LOCALES, 'pt-BR');
    ctx.download(reports.ordersCsv({ from, to, locale }), `pratofeito-plataforma-${from}_${to}.csv`, 'text/csv; charset=utf-8');
  }, admin);

  r.get('/api/admin/users', (ctx) => users.listUsers({
    q: (ctx.query.get('q') ?? '').slice(0, 60).trim(),
    role: pick(ctx.query.get('role'), ['buyer', 'supplier', 'admin']),
    status: pick(ctx.query.get('status'), ['active', 'suspended']),
    page: pageOf(ctx.query, 1000),
  }), admin);

  r.patch('/api/admin/users/:id', (ctx) => {
    const { status } = validate(ctx.body, { status: v.enum(['active', 'suspended']) });
    return users.setUserStatus(ctx.user.id, ctx.params.id, status, { ip: ctx.ipAnon });
  }, admin);

  r.get('/api/admin/audit', (ctx) => audit.list({
    event: /^[a-z_.]{3,40}$/.test(ctx.query.get('event') ?? '') ? ctx.query.get('event') : null,
    page: pageOf(ctx.query, 1000),
  }), admin);

  return r;
}

function mapOwnStore(s) {
  return {
    id: s.id, name: s.name, type: s.type, cnpj: s.cnpj, description: s.description, phone: s.phone ?? '',
    address: s.address, neighborhood: s.neighborhood, city: s.city, emoji: s.emoji, opensAt: s.opens_at,
    closesAt: s.closes_at, delivery: !!s.delivery, deliveryFeeCents: s.delivery_fee_cents, status: s.status,
  };
}
