import { conflict, forbidden, notFound, unprocessable } from '../http/errors.js';
import { newId, newOrderCode, newPickupCode } from '../lib/ids.js';
import { localDate, nowIso, startOfLocalDayIso } from '../lib/time.js';

const STORE_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const BUYER_CANCELLABLE = ['pending', 'confirmed'];
const STATUS_TIME_COLUMN = { confirmed: 'confirmed_at', ready: 'ready_at', completed: 'completed_at', cancelled: 'cancelled_at' };

function mapOrder(row, items, { forStore = false } = {}) {
  const active = ['pending', 'confirmed', 'ready'].includes(row.status);
  const order = {
    id: row.id,
    code: row.code,
    status: row.status,
    fulfillment: row.fulfillment,
    deliveryAddress: row.delivery_address ?? '',
    paymentMethod: row.payment_method,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    originalTotalCents: row.original_total_cents,
    savingsCents: row.original_total_cents - row.subtotal_cents,
    itemsCount: row.items_count,
    freeItems: row.free_items,
    weightGrams: row.weight_grams,
    notes: row.notes ?? '',
    rating: row.rating ?? null,
    review: row.review ?? '',
    cancelReason: row.cancel_reason ?? '',
    cancelledBy: row.cancelled_by ?? null,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    readyAt: row.ready_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    store: {
      id: row.store_id, name: row.store_name, emoji: row.store_emoji, address: row.store_address,
      neighborhood: row.store_neighborhood, city: row.store_city, phone: row.store_phone ?? '',
      opensAt: row.store_opens_at, closesAt: row.store_closes_at,
    },
    items: items.map((i) => ({
      offerId: i.offer_id, title: i.title, emoji: i.emoji, category: i.category, unit: i.unit, quantity: i.quantity,
      unitPriceCents: i.unit_price_cents, unitOriginalPriceCents: i.unit_original_price_cents,
    })),
  };
  if (forStore) {
    order.buyer = {
      name: row.buyer_name ?? '—',
      phone: row.fulfillment === 'delivery' ? (row.buyer_phone ?? '') : '',
    };
  } else if (active) {
    order.pickupCode = row.pickup_code;
  }
  return order;
}

const ORDER_SELECT = `
  SELECT o.*, s.name AS store_name, s.emoji AS store_emoji, s.address AS store_address,
         s.neighborhood AS store_neighborhood, s.city AS store_city, s.phone AS store_phone,
         s.opens_at AS store_opens_at, s.closes_at AS store_closes_at,
         u.name AS buyer_name, u.phone AS buyer_phone
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    LEFT JOIN users u ON u.id = o.buyer_id`;

export function createOrders({ db, audit, config }) {
  const itemsOf = (orderIds) => {
    if (!orderIds.length) return new Map();
    const map = new Map(orderIds.map((id) => [id, []]));
    for (let i = 0; i < orderIds.length; i += 200) {
      const chunk = orderIds.slice(i, i + 200);
      const params = Object.fromEntries(chunk.map((id, j) => [`i${j}`, id]));
      const rows = db.all(
        `SELECT * FROM order_items WHERE order_id IN (${chunk.map((_, j) => `$i${j}`).join(', ')}) ORDER BY id`,
        params,
      );
      for (const r of rows) map.get(r.order_id)?.push(r);
    }
    return map;
  };

  function freeItemsUsedToday(buyerId) {
    return db.value(
      `SELECT IFNULL(SUM(free_items), 0) FROM orders
        WHERE buyer_id = $buyerId AND created_at >= $start AND status <> 'cancelled'`,
      { buyerId, start: startOfLocalDayIso(localDate()) },
    );
  }

  function create(buyer, input, { ip }) {
    const wanted = new Map();
    for (const item of input.items) wanted.set(item.offerId, (wanted.get(item.offerId) ?? 0) + item.quantity);

    const orderId = db.transaction(() => {
      const store = db.get(
        `SELECT s.*, u.status AS owner_status FROM stores s JOIN users u ON u.id = s.owner_id WHERE s.id = $id`,
        { id: input.storeId },
      );
      if (!store || store.status !== 'active' || store.owner_status !== 'active') throw conflict('STORE_UNAVAILABLE');
      if (store.owner_id === buyer.id) throw forbidden('CANNOT_BUY_FROM_OWN_STORE');
      if (input.fulfillment === 'delivery' && !store.delivery) throw unprocessable('DELIVERY_UNAVAILABLE');
      if (input.fulfillment === 'delivery' && !input.deliveryAddress) {
        throw unprocessable('VALIDATION_ERROR', { fields: { deliveryAddress: 'required' } });
      }

      const today = localDate();
      const lines = [];
      let subtotal = 0;
      let original = 0;
      let count = 0;
      let free = 0;
      let weight = 0;
      for (const [offerId, quantity] of wanted) {
        const offer = db.get(`SELECT * FROM offers WHERE id = $id`, { id: offerId });
        if (!offer || offer.store_id !== store.id) throw unprocessable('ITEM_STORE_MISMATCH', { offerId });
        if (offer.status !== 'active' || offer.expires_on < today) {
          throw conflict('OFFER_UNAVAILABLE', { offerId, title: offer.title });
        }
        if (quantity > offer.max_per_order) {
          throw unprocessable('MAX_PER_ORDER', { offerId, title: offer.title, max: offer.max_per_order });
        }
        if (offer.quantity < quantity) {
          throw conflict('OUT_OF_STOCK', { offerId, title: offer.title, available: offer.quantity });
        }
        lines.push({ offer, quantity });
        subtotal += offer.price_cents * quantity;
        original += offer.original_price_cents * quantity;
        count += quantity;
        weight += offer.weight_grams * quantity;
        if (offer.price_cents === 0) free += quantity;
      }

      if (free > 0) {
        const used = freeItemsUsedToday(buyer.id);
        if (used + free > config.freeItemsPerDay) {
          throw conflict('FREE_LIMIT_REACHED', { limit: config.freeItemsPerDay, remaining: Math.max(0, config.freeItemsPerDay - used) });
        }
      }

      const deliveryFee = input.fulfillment === 'delivery' ? store.delivery_fee_cents : 0;
      const total = subtotal + deliveryFee;
      let paymentMethod = 'free';
      if (total > 0) {
        if (!input.paymentMethod) throw unprocessable('VALIDATION_ERROR', { fields: { paymentMethod: 'required' } });
        paymentMethod = input.paymentMethod;
      }

      const now = nowIso();
      for (const { offer, quantity } of lines) {
        const res = db.run(
          `UPDATE offers SET quantity = quantity - $qty, updated_at = $now WHERE id = $id AND quantity >= $qty`,
          { id: offer.id, qty: quantity, now },
        );
        if (res.changes !== 1) throw conflict('OUT_OF_STOCK', { offerId: offer.id, title: offer.title });
      }

      let code = newOrderCode();
      while (db.get(`SELECT 1 FROM orders WHERE code = $code`, { code })) code = newOrderCode();
      const id = newId();
      db.run(
        `INSERT INTO orders (id, code, buyer_id, store_id, status, fulfillment, delivery_address, payment_method,
                             subtotal_cents, delivery_fee_cents, total_cents, original_total_cents, items_count,
                             free_items, weight_grams, pickup_code, notes, created_at, updated_at)
         VALUES ($id, $code, $buyer, $store, 'pending', $fulfillment, $address, $payment, $subtotal, $fee, $total,
                 $original, $count, $free, $weight, $pickup, $notes, $now, $now)`,
        {
          id, code, buyer: buyer.id, store: store.id, fulfillment: input.fulfillment,
          address: input.fulfillment === 'delivery' ? input.deliveryAddress : null, payment: paymentMethod,
          subtotal, fee: deliveryFee, total, original, count, free, weight, pickup: newPickupCode(),
          notes: input.notes || null, now,
        },
      );
      for (const { offer, quantity } of lines) {
        db.run(
          `INSERT INTO order_items (order_id, offer_id, title, emoji, category, unit, quantity, unit_price_cents,
                                    unit_original_price_cents, unit_weight_grams)
           VALUES ($order, $offer, $title, $emoji, $category, $unit, $qty, $price, $original, $weight)`,
          {
            order: id, offer: offer.id, title: offer.title, emoji: offer.emoji, category: offer.category,
            unit: offer.unit, qty: quantity, price: offer.price_cents, original: offer.original_price_cents,
            weight: offer.weight_grams,
          },
        );
      }
      return id;
    });
    audit.record('order.created', { userId: buyer.id, ip, details: { order: orderId } });
    return getForBuyer(buyer.id, orderId);
  }

  function restoreStock(orderId) {
    const items = db.all(`SELECT offer_id, quantity FROM order_items WHERE order_id = $id AND offer_id IS NOT NULL`, { id: orderId });
    for (const i of items) {
      db.run(`UPDATE offers SET quantity = MIN(quantity + $qty, 9999) WHERE id = $id`, { id: i.offer_id, qty: i.quantity });
    }
  }

  function listForBuyer(buyerId) {
    const rows = db.all(`${ORDER_SELECT} WHERE o.buyer_id = $buyerId ORDER BY o.created_at DESC LIMIT 200`, { buyerId });
    const items = itemsOf(rows.map((r) => r.id));
    return rows.map((r) => mapOrder(r, items.get(r.id) ?? []));
  }

  function getForBuyer(buyerId, orderId) {
    const row = db.get(`${ORDER_SELECT} WHERE o.id = $id AND o.buyer_id = $buyerId`, { id: orderId, buyerId });
    if (!row) throw notFound('ORDER_NOT_FOUND');
    return mapOrder(row, itemsOf([orderId]).get(orderId) ?? []);
  }

  function cancelByBuyer(buyerId, orderId, reason, { ip }) {
    const order = getForBuyer(buyerId, orderId);
    if (!BUYER_CANCELLABLE.includes(order.status)) throw conflict('ORDER_NOT_CANCELLABLE');
    db.transaction(() => {
      const res = db.run(
        `UPDATE orders SET status = 'cancelled', cancelled_at = $now, updated_at = $now, cancelled_by = 'buyer',
                cancel_reason = $reason
          WHERE id = $id AND status IN ('pending', 'confirmed')`,
        { id: orderId, now: nowIso(), reason: reason || null },
      );
      if (res.changes !== 1) throw conflict('ORDER_NOT_CANCELLABLE');
      restoreStock(orderId);
    });
    audit.record('order.cancelled', { userId: buyerId, ip, details: { order: orderId, by: 'buyer' } });
    return getForBuyer(buyerId, orderId);
  }

  function review(buyerId, orderId, { rating, review: text }, { ip }) {
    const order = getForBuyer(buyerId, orderId);
    if (order.status !== 'completed') throw conflict('ORDER_NOT_COMPLETED');
    if (order.rating) throw conflict('ORDER_ALREADY_REVIEWED');
    db.run(`UPDATE orders SET rating = $rating, review = $review, updated_at = $now WHERE id = $id`,
      { id: orderId, rating, review: text || null, now: nowIso() });
    audit.record('order.reviewed', { userId: buyerId, ip, details: { order: orderId, rating } });
    return getForBuyer(buyerId, orderId);
  }

  function freeAllowance(buyerId) {
    const used = freeItemsUsedToday(buyerId);
    return { limit: config.freeItemsPerDay, used, remaining: Math.max(0, config.freeItemsPerDay - used) };
  }

  function listForStore(storeId, { scope = 'active', page = 1, pageSize = 50 } = {}) {
    const where = scope === 'active'
      ? `o.status IN ('pending', 'confirmed', 'ready')`
      : `o.status IN ('completed', 'cancelled')`;
    const total = db.value(`SELECT COUNT(*) FROM orders o WHERE o.store_id = $storeId AND ${where}`, { storeId });
    const rows = db.all(
      `${ORDER_SELECT} WHERE o.store_id = $storeId AND ${where}
        ORDER BY ${scope === 'active' ? 'o.created_at ASC' : 'o.updated_at DESC'} LIMIT $limit OFFSET $offset`,
      { storeId, limit: pageSize, offset: (page - 1) * pageSize },
    );
    const items = itemsOf(rows.map((r) => r.id));
    return { total, page, pageSize, items: rows.map((r) => mapOrder(r, items.get(r.id) ?? [], { forStore: true })) };
  }

  function getForStore(storeId, orderId) {
    const row = db.get(`${ORDER_SELECT} WHERE o.id = $id AND o.store_id = $storeId`, { id: orderId, storeId });
    if (!row) throw notFound('ORDER_NOT_FOUND');
    return { row, order: mapOrder(row, itemsOf([orderId]).get(orderId) ?? [], { forStore: true }) };
  }

  function updateStatusByStore(storeId, orderId, { status, pickupCode, reason }, { userId, ip }) {
    const { row } = getForStore(storeId, orderId);
    if (!STORE_TRANSITIONS[row.status]?.includes(status)) throw conflict('INVALID_STATUS_TRANSITION');
    if (status === 'completed' && String(pickupCode ?? '') !== row.pickup_code) {
      audit.record('order.pickup_code_wrong', { userId, ip, details: { order: orderId } });
      throw unprocessable('INVALID_PICKUP_CODE', { fields: { pickupCode: 'invalid_pickup_code' } });
    }
    const now = nowIso();
    db.transaction(() => {
      const column = STATUS_TIME_COLUMN[status];
      const res = db.run(
        `UPDATE orders SET status = $status, ${column} = $now, updated_at = $now
                ${status === 'cancelled' ? `, cancelled_by = 'store', cancel_reason = $reason` : ''}
          WHERE id = $id AND status = $from`,
        status === 'cancelled'
          ? { id: orderId, status, now, from: row.status, reason: reason || null }
          : { id: orderId, status, now, from: row.status },
      );
      if (res.changes !== 1) throw conflict('INVALID_STATUS_TRANSITION');
      if (status === 'cancelled') restoreStock(orderId);
    });
    audit.record('order.status', { userId, ip, details: { order: orderId, from: row.status, to: status } });
    return getForStore(storeId, orderId).order;
  }

  function storeSummary(storeId) {
    const today = localDate();
    const start = startOfLocalDayIso(today);
    const counts = Object.fromEntries(db.all(
      `SELECT status, COUNT(*) AS n FROM orders WHERE store_id = $storeId AND status IN ('pending', 'confirmed', 'ready')
        GROUP BY status`, { storeId },
    ).map((r) => [r.status, r.n]));
    const todayRow = db.get(
      `SELECT COUNT(*) AS orders,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN total_cents END), 0) AS revenue,
              IFNULL(SUM(CASE WHEN status <> 'cancelled' THEN items_count END), 0) AS items
         FROM orders WHERE store_id = $storeId AND created_at >= $start`,
      { storeId, start },
    );
    const offers = db.get(
      `SELECT COUNT(*) AS active, IFNULL(SUM(quantity), 0) AS stock,
              IFNULL(SUM(CASE WHEN expires_on = $today THEN 1 ELSE 0 END), 0) AS expiring_today
         FROM offers WHERE store_id = $storeId AND status = 'active' AND quantity > 0 AND expires_on >= $today`,
      { storeId, today },
    );
    return {
      pending: counts.pending ?? 0,
      confirmed: counts.confirmed ?? 0,
      ready: counts.ready ?? 0,
      today: todayRow,
      offers: { active: offers.active, stock: offers.stock, expiringToday: offers.expiring_today },
    };
  }

  return {
    create, listForBuyer, getForBuyer, cancelByBuyer, review, freeAllowance,
    listForStore, getForStore: (s, o) => getForStore(s, o).order, updateStatusByStore, storeSummary,
  };
}
