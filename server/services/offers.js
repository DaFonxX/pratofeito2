import { notFound, unprocessable } from '../http/errors.js';
import { newId } from '../lib/ids.js';
import { CATEGORIES, CATEGORY_EMOJI, DEFAULT_WEIGHT, OFFER_EMOJIS, TAGS, UNITS } from '../lib/catalog.js';
import { CATEGORY_KEYWORDS, escapeLike, foldText } from '../lib/text.js';
import { addDays, localDate, nowIso } from '../lib/time.js';
import { parseCsv, toCsv } from '../lib/csv.js';
import { validate, v } from '../lib/validate.js';

const RATINGS_CTE = `WITH r AS (
  SELECT store_id, ROUND(AVG(rating), 1) AS rating, COUNT(rating) AS rating_count
    FROM orders WHERE rating IS NOT NULL GROUP BY store_id
)`;

const AVAILABLE = `o.status = 'active' AND o.quantity > 0 AND o.expires_on >= $today
  AND s.status = 'active' AND u.status = 'active'`;

const SORTS = {
  relevance: `o.expires_on ASC, (o.original_price_cents - o.price_cents) * 1.0 / o.original_price_cents DESC, o.id`,
  price: 'o.price_cents ASC, o.expires_on ASC, o.id',
  discount: '(o.original_price_cents - o.price_cents) * 1.0 / o.original_price_cents DESC, o.price_cents ASC, o.id',
  expiring: 'o.expires_on ASC, o.pickup_end ASC, o.id',
  newest: 'o.created_at DESC, o.id',
  rating: 'r.rating DESC NULLS LAST, o.expires_on ASC, o.id',
};

const PRICE_LIMITS = { upto5: 500, upto10: 1000, upto20: 2000 };

export function toPublicOffer(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    emoji: row.emoji,
    unit: row.unit,
    weightGrams: row.weight_grams,
    originalPriceCents: row.original_price_cents,
    priceCents: row.price_cents,
    discountPct: Math.round(100 - (row.price_cents * 100) / row.original_price_cents),
    quantity: row.quantity,
    maxPerOrder: row.max_per_order,
    expiresOn: row.expires_on,
    pickupStart: row.pickup_start,
    pickupEnd: row.pickup_end,
    tags: row.tags ? row.tags.split(',') : [],
    status: row.status,
    createdAt: row.created_at,
    store: row.store_name === undefined ? undefined : {
      id: row.store_id,
      name: row.store_name,
      type: row.store_type,
      neighborhood: row.neighborhood,
      city: row.city,
      emoji: row.store_emoji,
      delivery: !!row.delivery,
      deliveryFeeCents: row.delivery_fee_cents,
      rating: row.rating ?? null,
      ratingCount: row.rating_count ?? 0,
    },
  };
}

export function toPublicStore(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    phone: row.phone ?? '',
    emoji: row.emoji,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    delivery: !!row.delivery,
    deliveryFeeCents: row.delivery_fee_cents,
    status: row.status,
    rating: row.rating ?? null,
    ratingCount: row.rating_count ?? 0,
  };
}

export const offerSchema = {
  title: v.string({ min: 3, max: 80 }),
  description: v.string({ min: 0, max: 400, multiline: true, optional: true, fallback: '' }),
  category: v.enum(CATEGORIES),
  emoji: v.enum(OFFER_EMOJIS, { optional: true }),
  unit: v.enum(UNITS),
  weightGrams: v.int({ min: 10, max: 50000, optional: true }),
  originalPriceCents: v.int({ min: 100, max: 500000 }),
  priceCents: v.int({ min: 0, max: 500000 }),
  quantity: v.int({ min: 0, max: 9999 }),
  maxPerOrder: v.int({ min: 1, max: 50, optional: true, fallback: 5 }),
  expiresOn: v.date(),
  pickupStart: v.time(),
  pickupEnd: v.time(),
  tags: v.tags(TAGS, { optional: true }),
};

export function createOffers({ db, audit }) {
  function searchTextFor(offer, store) {
    return foldText([offer.title, offer.description, store.name, store.neighborhood, CATEGORY_KEYWORDS[offer.category]].join(' '));
  }

  function checkBusinessRules(data) {
    const fields = {};
    if (data.priceCents > data.originalPriceCents) fields.priceCents = 'price_above_original';
    if (data.pickupEnd <= data.pickupStart) fields.pickupEnd = 'pickup_end_before_start';
    const today = localDate();
    if (data.expiresOn < today) fields.expiresOn = 'date_in_past';
    if (data.expiresOn > addDays(today, 30)) fields.expiresOn = 'date_too_far';
    if (Object.keys(fields).length) throw unprocessable('VALIDATION_ERROR', { fields });
  }

  function listPublic(f) {
    const today = localDate();
    const where = [AVAILABLE];
    const params = { today };
    if (f.q) {
      where.push(`o.search LIKE $q ESCAPE '\\'`);
      params.q = `%${escapeLike(foldText(f.q))}%`;
    }
    if (f.price === 'free') where.push('o.price_cents = 0');
    else if (f.price === 'paid') where.push('o.price_cents > 0');
    else if (PRICE_LIMITS[f.price]) { where.push('o.price_cents <= $maxPrice'); params.maxPrice = PRICE_LIMITS[f.price]; }
    if (f.expiring === 'today') where.push('o.expires_on = $today');
    if (f.expiring === 'tomorrow') { where.push('o.expires_on <= $tomorrow'); params.tomorrow = addDays(today, 1); }
    if (f.delivery) where.push('s.delivery = 1');
    if (f.tag) { where.push(`(',' || o.tags || ',') LIKE $tag`); params.tag = `%,${f.tag},%`; }
    if (f.store) { where.push('s.id = $store'); params.store = f.store; }

    const counts = Object.fromEntries(db.all(
      `SELECT o.category, COUNT(*) AS n FROM offers o JOIN stores s ON s.id = o.store_id JOIN users u ON u.id = s.owner_id
        WHERE ${where.join(' AND ')} GROUP BY o.category`, params,
    ).map((r) => [r.category, r.n]));

    if (f.category) { where.push('o.category = $category'); params.category = f.category; }
    const clause = where.join(' AND ');
    const total = db.value(
      `SELECT COUNT(*) FROM offers o JOIN stores s ON s.id = o.store_id JOIN users u ON u.id = s.owner_id WHERE ${clause}`,
      params,
    );
    const rows = db.all(
      `${RATINGS_CTE}
       SELECT o.*, s.name AS store_name, s.type AS store_type, s.neighborhood, s.city, s.emoji AS store_emoji,
              s.delivery, s.delivery_fee_cents, r.rating, r.rating_count
         FROM offers o
         JOIN stores s ON s.id = o.store_id
         JOIN users u ON u.id = s.owner_id
         LEFT JOIN r ON r.store_id = s.id
        WHERE ${clause}
        ORDER BY ${SORTS[f.sort] ?? SORTS.relevance}
        LIMIT $limit OFFSET $offset`,
      { ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize },
    );
    return { items: rows.map(toPublicOffer), total, page: f.page, pageSize: f.pageSize, counts };
  }

  function getPublic(id) {
    const today = localDate();
    const row = db.get(
      `${RATINGS_CTE}
       SELECT o.*, s.name AS store_name, s.type AS store_type, s.neighborhood, s.city, s.emoji AS store_emoji,
              s.delivery, s.delivery_fee_cents, s.address AS store_address, s.opens_at, s.closes_at,
              r.rating, r.rating_count,
              CASE WHEN ${AVAILABLE} THEN 1 ELSE 0 END AS available
         FROM offers o
         JOIN stores s ON s.id = o.store_id
         JOIN users u ON u.id = s.owner_id
         LEFT JOIN r ON r.store_id = s.id
        WHERE o.id = $id AND o.status <> 'archived' AND s.status = 'active' AND u.status = 'active'`,
      { id, today },
    );
    if (!row) throw notFound('OFFER_NOT_FOUND');
    const offer = toPublicOffer(row);
    offer.available = !!row.available;
    offer.store.address = row.store_address;
    offer.store.opensAt = row.opens_at;
    offer.store.closesAt = row.closes_at;
    const more = listPublic({ store: row.store_id, page: 1, pageSize: 7, sort: 'relevance' }).items
      .filter((o) => o.id !== id).slice(0, 6);
    return { offer, more };
  }

  function getPublicStore(id) {
    const row = db.get(
      `${RATINGS_CTE}
       SELECT s.*, r.rating, r.rating_count FROM stores s JOIN users u ON u.id = s.owner_id
         LEFT JOIN r ON r.store_id = s.id
        WHERE s.id = $id AND s.status = 'active' AND u.status = 'active'`,
      { id },
    );
    if (!row) throw notFound('STORE_NOT_FOUND');
    const offers = listPublic({ store: id, page: 1, pageSize: 60, sort: 'relevance' }).items;
    const reviews = db.all(
      `SELECT o.rating, o.review, o.completed_at, substr(u.name, 1, instr(u.name || ' ', ' ') - 1) AS first_name
         FROM orders o LEFT JOIN users u ON u.id = o.buyer_id
        WHERE o.store_id = $id AND o.rating IS NOT NULL AND o.review IS NOT NULL AND o.review <> ''
        ORDER BY o.completed_at DESC LIMIT 6`,
      { id },
    );
    return { store: toPublicStore(row), offers, reviews };
  }

  function listStores() {
    const today = localDate();
    return db.all(
      `${RATINGS_CTE}
       SELECT s.*, r.rating, r.rating_count,
              (SELECT COUNT(*) FROM offers o WHERE o.store_id = s.id AND o.status = 'active'
                  AND o.quantity > 0 AND o.expires_on >= $today) AS active_offers
         FROM stores s JOIN users u ON u.id = s.owner_id
         LEFT JOIN r ON r.store_id = s.id
        WHERE s.status = 'active' AND u.status = 'active'
        ORDER BY active_offers DESC, s.name`,
      { today },
    ).map((row) => ({ ...toPublicStore(row), activeOffers: row.active_offers }));
  }

  const storeOf = (ownerId) => {
    const store = db.get(`SELECT * FROM stores WHERE owner_id = $ownerId`, { ownerId });
    if (!store) throw notFound('STORE_NOT_FOUND');
    return store;
  };

  function listForStore(storeId, { status = null } = {}) {
    const rows = db.all(
      `SELECT o.*,
              (SELECT IFNULL(SUM(i.quantity), 0) FROM order_items i JOIN orders od ON od.id = i.order_id
                WHERE i.offer_id = o.id AND od.status <> 'cancelled') AS sold
         FROM offers o
        WHERE o.store_id = $storeId AND o.status <> 'archived' ${status ? 'AND o.status = $status' : ''}
        ORDER BY CASE o.status WHEN 'active' THEN 0 ELSE 1 END, o.expires_on ASC, o.created_at DESC`,
      status ? { storeId, status } : { storeId },
    );
    const today = localDate();
    return rows.map((row) => ({ ...toPublicOffer(row), sold: row.sold, expired: row.expires_on < today }));
  }

  function getForStore(storeId, offerId) {
    const row = db.get(`SELECT * FROM offers WHERE id = $id AND store_id = $storeId AND status <> 'archived'`, { id: offerId, storeId });
    if (!row) throw notFound('OFFER_NOT_FOUND');
    return toPublicOffer(row);
  }

  function create(store, data, { userId, ip }) {
    checkBusinessRules(data);
    const now = nowIso();
    const id = newId();
    const offer = { ...data, emoji: data.emoji ?? CATEGORY_EMOJI[data.category], weightGrams: data.weightGrams ?? DEFAULT_WEIGHT[data.category] };
    db.run(
      `INSERT INTO offers (id, store_id, title, description, category, emoji, unit, weight_grams, original_price_cents,
                           price_cents, quantity, max_per_order, expires_on, pickup_start, pickup_end, tags, status,
                           search, created_at, updated_at)
       VALUES ($id, $storeId, $title, $description, $category, $emoji, $unit, $weight, $original, $price, $quantity,
               $maxPerOrder, $expiresOn, $pickupStart, $pickupEnd, $tags, 'active', $search, $now, $now)`,
      {
        id, storeId: store.id, title: offer.title, description: offer.description ?? '', category: offer.category,
        emoji: offer.emoji, unit: offer.unit, weight: offer.weightGrams, original: offer.originalPriceCents,
        price: offer.priceCents, quantity: offer.quantity, maxPerOrder: offer.maxPerOrder ?? 5,
        expiresOn: offer.expiresOn, pickupStart: offer.pickupStart, pickupEnd: offer.pickupEnd,
        tags: (offer.tags ?? []).join(','), search: searchTextFor(offer, store), now,
      },
    );
    audit.record('offer.created', { userId, ip, details: { offer: id } });
    return getForStore(store.id, id);
  }

  function update(store, offerId, changes, { userId, ip }) {
    const current = getForStore(store.id, offerId);
    const merged = { ...current, ...changes };
    if (changes.status !== undefined && !['active', 'paused'].includes(changes.status)) {
      throw unprocessable('VALIDATION_ERROR', { fields: { status: 'invalid' } });
    }
    const touchesRules = ['priceCents', 'originalPriceCents', 'pickupStart', 'pickupEnd', 'expiresOn'].some((k) => k in changes);
    if (touchesRules) checkBusinessRules(merged);
    if (changes.status === 'active' && merged.expiresOn < localDate()) {
      throw unprocessable('VALIDATION_ERROR', { fields: { expiresOn: 'date_in_past' } });
    }
    db.run(
      `UPDATE offers SET title = $title, description = $description, category = $category, emoji = $emoji, unit = $unit,
              weight_grams = $weight, original_price_cents = $original, price_cents = $price, quantity = $quantity,
              max_per_order = $maxPerOrder, expires_on = $expiresOn, pickup_start = $pickupStart,
              pickup_end = $pickupEnd, tags = $tags, status = $status, search = $search, updated_at = $now
        WHERE id = $id AND store_id = $storeId`,
      {
        id: offerId, storeId: store.id, title: merged.title, description: merged.description ?? '',
        category: merged.category, emoji: merged.emoji, unit: merged.unit, weight: merged.weightGrams,
        original: merged.originalPriceCents, price: merged.priceCents, quantity: merged.quantity,
        maxPerOrder: merged.maxPerOrder, expiresOn: merged.expiresOn, pickupStart: merged.pickupStart,
        pickupEnd: merged.pickupEnd, tags: (merged.tags ?? []).join(','), status: merged.status,
        search: searchTextFor(merged, store), now: nowIso(),
      },
    );
    audit.record('offer.updated', { userId, ip, details: { offer: offerId, fields: Object.keys(changes) } });
    return getForStore(store.id, offerId);
  }

  function remove(store, offerId, { userId, ip }) {
    getForStore(store.id, offerId);
    const used = db.value(`SELECT COUNT(*) FROM order_items WHERE offer_id = $id`, { id: offerId });
    if (used > 0) {
      db.run(`UPDATE offers SET status = 'archived', updated_at = $now WHERE id = $id`, { id: offerId, now: nowIso() });
    } else {
      db.run(`DELETE FROM offers WHERE id = $id AND store_id = $storeId`, { id: offerId, storeId: store.id });
    }
    audit.record('offer.deleted', { userId, ip, details: { offer: offerId, archived: used > 0 } });
    return { archived: used > 0 };
  }

  const CSV_HEADERS = ['title', 'description', 'category', 'emoji', 'unit', 'weight_grams', 'original_price',
    'price', 'quantity', 'max_per_order', 'expires_on', 'pickup_start', 'pickup_end', 'tags', 'status'];

  function exportCsv(storeId, { delimiter = ';' } = {}) {
    const price = (cents) => (delimiter === ';' ? (cents / 100).toFixed(2).replace('.', ',') : (cents / 100).toFixed(2));
    const rows = listForStore(storeId).map((o) => [
      o.title, o.description, o.category, o.emoji, o.unit, o.weightGrams,
      price(o.originalPriceCents), price(o.priceCents), o.quantity, o.maxPerOrder,
      o.expiresOn, o.pickupStart, o.pickupEnd, o.tags.join('|'), o.status,
    ]);
    return toCsv(CSV_HEADERS, rows, { delimiter });
  }

  function importCsv(store, text, { userId, ip }) {
    const rows = parseCsv(text, { maxRows: 200 });
    if (rows.length < 2) throw unprocessable('CSV_EMPTY');
    if (rows.length > 201) throw unprocessable('CSV_TOO_MANY_ROWS', { max: 200 });
    const header = rows[0].map((h) => foldText(h).replace(/\s+/g, '_'));
    const missing = ['title', 'category', 'unit', 'original_price', 'price', 'quantity', 'expires_on', 'pickup_start', 'pickup_end']
      .filter((h) => !header.includes(h));
    if (missing.length) throw unprocessable('CSV_MISSING_COLUMNS', { columns: missing });

    const col = (row, name) => row[header.indexOf(name)] ?? '';
    const money = (s) => Math.round(Number(String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) * 100);
    const errors = [];
    const valid = [];
    rows.slice(1).forEach((row, i) => {
      try {
        const data = validate({
          title: col(row, 'title'),
          description: col(row, 'description'),
          category: col(row, 'category').trim(),
          emoji: col(row, 'emoji').trim() || undefined,
          unit: col(row, 'unit').trim(),
          weightGrams: col(row, 'weight_grams').trim() || undefined,
          originalPriceCents: money(col(row, 'original_price')),
          priceCents: money(col(row, 'price')),
          quantity: col(row, 'quantity').trim(),
          maxPerOrder: col(row, 'max_per_order').trim() || undefined,
          expiresOn: col(row, 'expires_on').trim(),
          pickupStart: col(row, 'pickup_start').trim(),
          pickupEnd: col(row, 'pickup_end').trim(),
          tags: col(row, 'tags').split('|').map((t) => t.trim()).filter(Boolean),
        }, offerSchema);
        checkBusinessRules(data);
        valid.push(data);
      } catch (e) {
        const [field, code] = Object.entries(e.extra?.fields ?? { _: 'invalid' })[0];
        errors.push({ row: i + 2, field, code });
      }
    });
    if (errors.length) return { created: 0, errors };
    db.transaction(() => {
      for (const data of valid) create(store, data, { userId, ip });
    });
    audit.record('offer.imported', { userId, ip, details: { count: valid.length } });
    return { created: valid.length, errors: [] };
  }

  function updateStore(ownerId, changes, { userId, ip }) {
    const store = storeOf(ownerId);
    const map = {
      name: 'name', description: 'description', phone: 'phone', address: 'address', neighborhood: 'neighborhood',
      city: 'city', emoji: 'emoji', opensAt: 'opens_at', closesAt: 'closes_at', delivery: 'delivery',
      deliveryFeeCents: 'delivery_fee_cents', status: 'status',
    };
    const keys = Object.keys(map).filter((k) => k in changes);
    if (keys.length) {
      const params = { id: store.id, now: nowIso() };
      for (const k of keys) params[k] = k === 'delivery' ? (changes[k] ? 1 : 0) : changes[k];
      db.run(`UPDATE stores SET ${keys.map((k) => `${map[k]} = $${k}`).join(', ')}, updated_at = $now WHERE id = $id`, params);
      if ('name' in changes || 'neighborhood' in changes) {
        const fresh = storeOf(ownerId);
        for (const o of db.all(`SELECT id, title, description, category FROM offers WHERE store_id = $id`, { id: store.id })) {
          db.run(`UPDATE offers SET search = $search WHERE id = $id`, { id: o.id, search: searchTextFor(o, fresh) });
        }
      }
      audit.record('store.updated', { userId, ip, details: { fields: keys } });
    }
    return toPublicStore(storeOf(ownerId));
  }

  function refreshDemoOffers() {
    const today = localDate();
    const stale = db.all(
      `SELECT o.id, o.max_per_order FROM offers o JOIN stores s ON s.id = o.store_id
        WHERE s.is_demo = 1 AND o.status = 'active' AND (o.expires_on < $today OR o.quantity = 0)`,
      { today },
    );
    stale.forEach((o, i) => {
      db.run(
        `UPDATE offers SET expires_on = $expires, quantity = $quantity, updated_at = $now WHERE id = $id`,
        { id: o.id, expires: addDays(today, i % 4), quantity: 4 + ((i * 7) % 15), now: nowIso() },
      );
    });
    return stale.length;
  }

  return {
    listPublic, getPublic, getPublicStore, listStores, storeOf, listForStore, getForStore, create, update, remove,
    exportCsv, importCsv, updateStore, refreshDemoOffers, searchTextFor,
  };
}
