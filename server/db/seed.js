import { newId, newOrderCode, newPickupCode } from '../lib/ids.js';
import { hashPassword } from '../lib/password.js';
import { addDays, localDate, localTime, tzOffsetMinutes } from '../lib/time.js';
import { cnpjFromBase } from '../lib/validate.js';
import {
  BUYER_FIRST, BUYER_LAST, DEMO_ACCOUNTS, DEMO_CITY, DEMO_PASSWORD, DEMO_STORES, NEIGHBORHOODS, REVIEWS,
} from './demo-data.js';

const HISTORY_DAYS = 120;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const daySeed = (day) => Number(day.replaceAll('-', '')) * 7919;

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function localToIso(day, minutes) {
  const offset = tzOffsetMinutes(new Date(`${day}T12:00:00Z`));
  return new Date(Date.parse(`${day}T00:00:00Z`) + (minutes - offset) * 60000).toISOString();
}

export async function seedDemo({ db, offersService }) {
  if (db.value(`SELECT value FROM meta WHERE key = 'demo_seeded'`)) return false;
  const today = localDate();
  const firstDay = addDays(today, -HISTORY_DAYS);
  const hashes = {};
  for (const account of DEMO_ACCOUNTS) hashes[account.email] = await hashPassword(DEMO_PASSWORD);

  db.transaction(() => {
    const created = (day, minutes = 600) => localToIso(day, minutes);
    const insertUser = (u) => db.run(
      `INSERT INTO users (id, role, name, email, password_hash, phone, city, neighborhood, address, locale, status,
                          is_demo, created_at, updated_at, last_login_at, password_changed_at)
       VALUES ($id, $role, $name, $email, $hash, $phone, $city, $neighborhood, $address, NULL, 'active', 1, $at, $at, NULL, $at)`,
      u,
    );

    const userIds = {};
    for (const account of DEMO_ACCOUNTS) {
      userIds[account.email] = newId();
      insertUser({
        id: userIds[account.email], role: account.role, name: account.name, email: account.email,
        hash: hashes[account.email], phone: '66999990000', city: DEMO_CITY,
        neighborhood: account.role === 'buyer' ? 'Centro' : null,
        address: account.role === 'buyer' ? 'Rua das Acácias, 120, apto 3' : null,
        at: created(firstDay, 540),
      });
    }

    const stores = [];
    DEMO_STORES.forEach((s, index) => {
      let ownerId = userIds[s.owner];
      if (!ownerId) {
        ownerId = newId();
        insertUser({
          id: ownerId, role: 'supplier', name: s.ownerName, email: s.owner, hash: 'disabled',
          phone: `6699${String(1000000 + index * 7331).slice(0, 7)}`, city: DEMO_CITY, neighborhood: null, address: null,
          at: created(addDays(firstDay, index), 600),
        });
      }
      const store = {
        id: newId(), ownerId, name: s.name, type: s.type, emoji: s.emoji, address: s.address,
        neighborhood: s.neighborhood, city: DEMO_CITY, opens: s.opens, closes: s.closes, delivery: s.delivery,
        fee: s.fee, description: s.description, weight: s.weight, key: s.key,
        cnpj: cnpjFromBase(`${String(12345678 + index * 1111).padStart(8, '0')}0001`),
        phone: `66 3401-${String(2000 + index * 37)}`,
      };
      db.run(
        `INSERT INTO stores (id, owner_id, name, type, cnpj, description, phone, address, neighborhood, city, emoji,
                             opens_at, closes_at, delivery, delivery_fee_cents, status, is_demo, created_at, updated_at)
         VALUES ($id, $ownerId, $name, $type, $cnpj, $description, $phone, $address, $neighborhood, $city, $emoji,
                 $opens, $closes, $delivery, $fee, 'active', 1, $at, $at)`,
        { ...store, at: created(addDays(firstDay, index), 610) },
      );
      store.offers = s.offers.map(([title, description, category, emoji, unit, weight, original, price, qty, max, start, end, tags, days]) => {
        const offer = {
          id: newId(), storeId: store.id, title, description, category, emoji, unit, weight, original, price,
          quantity: qty, max, start, end, tags, expires: addDays(today, days),
        };
        db.run(
          `INSERT INTO offers (id, store_id, title, description, category, emoji, unit, weight_grams,
                               original_price_cents, price_cents, quantity, max_per_order, expires_on, pickup_start,
                               pickup_end, tags, status, search, created_at, updated_at)
           VALUES ($id, $storeId, $title, $description, $category, $emoji, $unit, $weight, $original, $price, $quantity,
                   $max, $expires, $start, $end, $tags, 'active', $search, $at, $at)`,
          { ...offer, search: offersService.searchTextFor({ title, description, category }, store), at: created(addDays(today, -1), 480) },
        );
        return offer;
      });
      stores.push(store);
    });

    const buyers = [{ id: userIds['cliente@demo.com'], day: 0, address: 'Rua das Acácias, 120, apto 3' }];
    const total = BUYER_FIRST.length;
    BUYER_FIRST.forEach((first, i) => {
      const last = BUYER_LAST[(i * 5) % BUYER_LAST.length];
      const day = Math.floor((i / total) * HISTORY_DAYS * 0.85);
      const id = newId();
      const neighborhood = NEIGHBORHOODS[i % NEIGHBORHOODS.length];
      const address = `Rua ${BUYER_LAST[(i * 3 + 1) % BUYER_LAST.length]}, ${50 + i * 13}`;
      insertUser({
        id, role: 'buyer', name: `${first} ${last}`,
        email: `${first}.${last}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() + `${i}@example.com`,
        hash: 'disabled', phone: `669${String(91000000 + i * 104729).slice(0, 8)}`, city: DEMO_CITY, neighborhood,
        address, at: created(addDays(firstDay, day), 600 + i * 7),
      });
      buyers.push({ id, day, address: `${address}, ${neighborhood}` });
    });

    db.run(`INSERT INTO meta (key, value) VALUES ('demo_seeded', $v)`, { v: today });
    generateOrders(db, { stores, buyers, firstDay, from: firstDay, to: today });
  });
  return true;
}

function generateOrders(db, { stores, buyers, firstDay, from, to }) {
  const today = localDate();
  const nowMinutes = toMinutes(localTime());
  const totalWeight = stores.reduce((s, st) => s + st.weight, 0);
  let day = from;
  while (day <= to) {
    const random = rng(daySeed(day));
    const pick = (list) => list[Math.floor(random() * list.length)];
    const index = Math.max(0, (Date.parse(day) - Date.parse(firstDay)) / 86400000);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const growth = 2.5 + 7 * Math.min(1, index / HISTORY_DAYS);
    const weekend = weekday === 0 || weekday === 6 ? 1.35 : 1;
    const count = Math.round(growth * weekend * (0.65 + random() * 0.7));
    const eligibleBuyers = buyers.filter((b) => b.day <= index);

    for (let n = 0; n < count; n++) {
      let ticket = random() * totalWeight;
      const store = stores.find((s) => (ticket -= s.weight) <= 0) ?? stores[0];
      const lines = [];
      const first = pick(store.offers);
      lines.push(first);
      if (random() < 0.35) {
        const second = pick(store.offers);
        if (second !== first) lines.push(second);
      }
      const minutes = Math.max(420, Math.min(1320, toMinutes(first.start) - 20 - Math.floor(random() * 200)));
      if (day === today && minutes > nowMinutes - 5) continue;

      const buyer = random() < 0.1 ? buyers[0] : pick(eligibleBuyers.length ? eligibleBuyers : buyers);
      const items = lines.map((o) => ({ offer: o, qty: o.price === 0 ? 1 : 1 + (random() < 0.3 ? 1 : 0) }));
      const subtotal = items.reduce((s, i) => s + i.offer.price * i.qty, 0);
      const original = items.reduce((s, i) => s + i.offer.original * i.qty, 0);
      const count2 = items.reduce((s, i) => s + i.qty, 0);
      const free = items.reduce((s, i) => s + (i.offer.price === 0 ? i.qty : 0), 0);
      const weight = items.reduce((s, i) => s + i.offer.weight * i.qty, 0);
      const delivery = store.delivery && random() < 0.3;
      const fee = delivery ? store.fee : 0;
      const totalCents = subtotal + fee;
      const r = random();
      const payment = totalCents === 0 ? 'free' : r < 0.55 ? 'pix' : r < 0.85 ? 'card' : 'cash';

      let status;
      const s = random();
      if (day < today) status = s < 0.1 ? 'cancelled' : 'completed';
      else status = s < 0.3 ? 'pending' : s < 0.5 ? 'confirmed' : s < 0.7 ? 'ready' : s < 0.95 ? 'completed' : 'cancelled';

      const createdAt = localToIso(day, minutes);
      const step = (base, min, max) => new Date(Date.parse(base) + (min + Math.floor(random() * (max - min))) * 60000).toISOString();
      const cap = (iso) => (iso > new Date().toISOString() ? new Date(Date.now() - 60000).toISOString() : iso);
      const confirmedAt = ['confirmed', 'ready', 'completed'].includes(status) ? cap(step(createdAt, 3, 20)) : null;
      const readyAt = ['ready', 'completed'].includes(status) ? cap(step(confirmedAt, 15, 60)) : null;
      const completedAt = status === 'completed' ? cap(step(readyAt, 10, 90)) : null;
      const cancelledAt = status === 'cancelled' ? cap(step(createdAt, 5, 60)) : null;
      let rating = null;
      let review = null;
      if (status === 'completed' && random() < 0.55) {
        const x = random();
        rating = x < 0.55 ? 5 : x < 0.85 ? 4 : x < 0.95 ? 3 : x < 0.98 ? 2 : 1;
        if (random() < 0.5) review = pick(rating >= 4 ? REVIEWS.slice(0, 8) : REVIEWS.slice(7));
      }

      const id = newId();
      let code = newOrderCode();
      while (db.get(`SELECT 1 FROM orders WHERE code = $code`, { code })) code = newOrderCode();
      db.run(
        `INSERT INTO orders (id, code, buyer_id, store_id, status, fulfillment, delivery_address, payment_method,
                             subtotal_cents, delivery_fee_cents, total_cents, original_total_cents, items_count, free_items,
                             weight_grams, pickup_code, notes, rating, review, cancel_reason, cancelled_by, created_at,
                             updated_at, confirmed_at, ready_at, completed_at, cancelled_at)
         VALUES ($id, $code, $buyer, $store, $status, $fulfillment, $address, $payment, $subtotal, $fee, $total,
                 $original, $count, $free, $weight, $pickup, NULL, $rating, $review, NULL, $cancelledBy, $createdAt,
                 $updatedAt, $confirmedAt, $readyAt, $completedAt, $cancelledAt)`,
        {
          id, code, buyer: buyer.id, store: store.id, status, fulfillment: delivery ? 'delivery' : 'pickup',
          address: delivery ? buyer.address : null, payment, subtotal, fee, total: totalCents, original,
          count: count2, free, weight, pickup: newPickupCode(), rating, review,
          cancelledBy: status === 'cancelled' ? (random() < 0.6 ? 'buyer' : 'store') : null,
          createdAt, updatedAt: completedAt ?? cancelledAt ?? readyAt ?? confirmedAt ?? createdAt,
          confirmedAt, readyAt, completedAt, cancelledAt,
        },
      );
      for (const { offer, qty } of items) {
        db.run(
          `INSERT INTO order_items (order_id, offer_id, title, emoji, category, unit, quantity, unit_price_cents,
                                    unit_original_price_cents, unit_weight_grams)
           VALUES ($order, $offer, $title, $emoji, $category, $unit, $qty, $price, $original, $weight)`,
          {
            order: id, offer: offer.id, title: offer.title, emoji: offer.emoji, category: offer.category, unit: offer.unit,
            qty, price: offer.price, original: offer.original, weight: offer.weight,
          },
        );
      }
    }
    day = addDays(day, 1);
  }
  db.run(`INSERT INTO meta (key, value) VALUES ('demo_last_day', $v) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, { v: to });
}

export function catchUpDemo({ db }) {
  const last = db.value(`SELECT value FROM meta WHERE key = 'demo_last_day'`);
  const seeded = db.value(`SELECT value FROM meta WHERE key = 'demo_seeded'`);
  if (!last || !seeded) return 0;
  const today = localDate();
  if (last >= today) return 0;

  const stores = db.all(`SELECT * FROM stores WHERE is_demo = 1 AND status = 'active'`).map((s, i) => ({
    id: s.id, delivery: s.delivery, fee: s.delivery_fee_cents, weight: DEMO_STORES.find((d) => d.name === s.name)?.weight ?? 1,
    offers: db.all(`SELECT * FROM offers WHERE store_id = $id AND status = 'active'`, { id: s.id }).map((o) => ({
      id: o.id, title: o.title, emoji: o.emoji, category: o.category, unit: o.unit, weight: o.weight_grams,
      original: o.original_price_cents, price: o.price_cents, start: o.pickup_start,
    })),
    index: i,
  })).filter((s) => s.offers.length);
  const buyers = db.all(`SELECT id, address, neighborhood FROM users WHERE role = 'buyer' AND is_demo = 1 AND status = 'active'`)
    .map((b) => ({ id: b.id, day: 0, address: [b.address, b.neighborhood].filter(Boolean).join(', ') }));
  if (!stores.length || !buyers.length) return 0;

  const start = localToIso(today, 0);
  db.transaction(() => {
    db.run(
      `UPDATE orders SET status = 'completed', completed_at = updated_at
        WHERE status IN ('pending', 'confirmed', 'ready') AND created_at < $start
          AND store_id IN (SELECT id FROM stores WHERE is_demo = 1)`,
      { start },
    );
    generateOrders(db, { stores, buyers, firstDay: addDays(seeded, -HISTORY_DAYS), from: addDays(last, 1), to: today });
  });
  return 1;
}
