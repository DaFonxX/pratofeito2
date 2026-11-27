import { CO2_PER_KG, GRAMS_PER_MEAL } from '../lib/catalog.js';
import { toCsv } from '../lib/csv.js';
import { addDays, diffDays, localDate, sqliteTzModifier, startOfLocalDayIso } from '../lib/time.js';

const round1 = (n) => Math.round(n * 10) / 10;

export function createReports({ db }) {
  function period(from, to) {
    const days = diffDays(from, to) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(days - 1));
    return {
      from, to, days,
      startIso: startOfLocalDayIso(from),
      endIso: startOfLocalDayIso(addDays(to, 1)),
      prevStartIso: startOfLocalDayIso(prevFrom),
      prevEndIso: startOfLocalDayIso(from),
      prevFrom, prevTo,
    };
  }

  function kpisFor(scopeSql, scopeParams, startIso, endIso) {
    const row = db.get(
      `SELECT COUNT(*) AS orders,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN 1 END), 0) AS completed,
              IFNULL(SUM(CASE WHEN status = 'cancelled' THEN 1 END), 0) AS cancelled,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN total_cents END), 0) AS revenue,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN items_count END), 0) AS items,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN free_items END), 0) AS donations,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN weight_grams END), 0) AS weight,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN original_total_cents - subtotal_cents END), 0) AS savings,
              IFNULL(SUM(CASE WHEN status = 'completed' AND total_cents > 0 THEN 1 END), 0) AS paid_orders,
              ROUND(AVG(rating), 2) AS rating,
              COUNT(DISTINCT buyer_id) AS customers
         FROM orders o
        WHERE ${scopeSql} AND o.created_at >= $start AND o.created_at < $end`,
      { ...scopeParams, start: startIso, end: endIso },
    );
    const kg = row.weight / 1000;
    return {
      orders: row.orders,
      completedOrders: row.completed,
      revenueCents: row.revenue,
      itemsRescued: row.items,
      donations: row.donations,
      foodKg: round1(kg),
      meals: Math.round(row.weight / GRAMS_PER_MEAL),
      co2Kg: round1(kg * CO2_PER_KG),
      savingsCents: row.savings,
      avgTicketCents: row.paid_orders ? Math.round(row.revenue / row.paid_orders) : 0,
      cancelRate: row.orders ? round1((row.cancelled * 100) / row.orders) : 0,
      rating: row.rating ?? null,
      customers: row.customers,
    };
  }

  function seriesFor(scopeSql, scopeParams, p) {
    const tz = sqliteTzModifier();
    const rows = db.all(
      `SELECT date(o.created_at, $tz) AS day,
              COUNT(*) AS orders,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN total_cents END), 0) AS revenue,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN weight_grams END), 0) AS weight,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN free_items END), 0) AS donations,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN original_total_cents - subtotal_cents END), 0) AS savings
         FROM orders o
        WHERE ${scopeSql} AND o.created_at >= $start AND o.created_at < $end
        GROUP BY day ORDER BY day`,
      { ...scopeParams, tz, start: p.startIso, end: p.endIso },
    );
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const out = [];
    for (let i = 0; i < p.days; i++) {
      const day = addDays(p.from, i);
      const r = byDay.get(day);
      out.push({
        date: day,
        orders: r?.orders ?? 0,
        revenueCents: r?.revenue ?? 0,
        foodKg: round1((r?.weight ?? 0) / 1000),
        donations: r?.donations ?? 0,
        savingsCents: r?.savings ?? 0,
      });
    }
    return out;
  }

  function breakdowns(scopeSql, scopeParams, p) {
    const params = { ...scopeParams, start: p.startIso, end: p.endIso };
    const byCategory = db.all(
      `SELECT i.category, SUM(i.quantity) AS items, SUM(i.quantity * i.unit_price_cents) AS revenue,
              SUM(i.quantity * i.unit_weight_grams) AS weight
         FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE ${scopeSql} AND o.status = 'completed' AND o.created_at >= $start AND o.created_at < $end
        GROUP BY i.category ORDER BY items DESC`,
      params,
    ).map((r) => ({ category: r.category, items: r.items, revenueCents: r.revenue, foodKg: round1(r.weight / 1000) }));
    const byStatus = db.all(
      `SELECT status, COUNT(*) AS count FROM orders o
        WHERE ${scopeSql} AND o.created_at >= $start AND o.created_at < $end GROUP BY status`,
      params,
    );
    const byFulfillment = db.all(
      `SELECT fulfillment, COUNT(*) AS count FROM orders o
        WHERE ${scopeSql} AND o.status <> 'cancelled' AND o.created_at >= $start AND o.created_at < $end
        GROUP BY fulfillment`,
      params,
    );
    const byPayment = db.all(
      `SELECT payment_method AS method, COUNT(*) AS count, SUM(total_cents) AS revenue FROM orders o
        WHERE ${scopeSql} AND o.status = 'completed' AND o.created_at >= $start AND o.created_at < $end
        GROUP BY payment_method ORDER BY count DESC`,
      params,
    ).map((r) => ({ method: r.method, count: r.count, revenueCents: r.revenue }));
    const tz = sqliteTzModifier();
    const byWeekdayHour = db.all(
      `SELECT CAST(strftime('%w', o.created_at, $tz) AS INTEGER) AS weekday,
              CAST(strftime('%H', o.created_at, $tz) AS INTEGER) AS hour, COUNT(*) AS count
         FROM orders o
        WHERE ${scopeSql} AND o.status <> 'cancelled' AND o.created_at >= $start AND o.created_at < $end
        GROUP BY weekday, hour`,
      { ...params, tz },
    );
    const topOffers = db.all(
      `SELECT i.title, i.emoji, i.category, SUM(i.quantity) AS items, SUM(i.quantity * i.unit_price_cents) AS revenue,
              SUM(i.quantity * i.unit_weight_grams) AS weight
         FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE ${scopeSql} AND o.status = 'completed' AND o.created_at >= $start AND o.created_at < $end
        GROUP BY i.title, i.emoji, i.category ORDER BY items DESC, revenue DESC LIMIT 8`,
      params,
    ).map((r) => ({ ...r, revenueCents: r.revenue, foodKg: round1(r.weight / 1000), revenue: undefined, weight: undefined }));
    return { byCategory, byStatus, byFulfillment, byPayment, byWeekdayHour, topOffers };
  }

  function storeReport(storeId, from, to) {
    const p = period(from, to);
    const scope = 'o.store_id = $storeId';
    const params = { storeId };
    return {
      range: { from: p.from, to: p.to, days: p.days, prevFrom: p.prevFrom, prevTo: p.prevTo },
      kpis: kpisFor(scope, params, p.startIso, p.endIso),
      previous: kpisFor(scope, params, p.prevStartIso, p.prevEndIso),
      series: seriesFor(scope, params, p),
      ...breakdowns(scope, params, p),
    };
  }

  function adminReport(from, to) {
    const p = period(from, to);
    const scope = '1 = 1';
    const base = breakdowns(scope, {}, p);
    const tz = sqliteTzModifier();
    const signups = db.all(
      `SELECT date(created_at, $tz) AS day, role, COUNT(*) AS n FROM users
        WHERE created_at >= $start AND created_at < $end GROUP BY day, role`,
      { tz, start: p.startIso, end: p.endIso },
    );
    const signupSeries = [];
    for (let i = 0; i < p.days; i++) {
      const day = addDays(p.from, i);
      const rows = signups.filter((s) => s.day === day);
      signupSeries.push({
        date: day,
        buyers: rows.find((r) => r.role === 'buyer')?.n ?? 0,
        suppliers: rows.find((r) => r.role === 'supplier')?.n ?? 0,
      });
    }
    const topStores = db.all(
      `SELECT s.id, s.name, s.emoji, s.neighborhood, COUNT(*) AS orders,
              SUM(CASE WHEN o.status = 'completed' THEN o.total_cents ELSE 0 END) AS revenue,
              SUM(CASE WHEN o.status = 'completed' THEN o.weight_grams ELSE 0 END) AS weight,
              ROUND(AVG(o.rating), 1) AS rating
         FROM orders o JOIN stores s ON s.id = o.store_id
        WHERE o.created_at >= $start AND o.created_at < $end
        GROUP BY s.id ORDER BY revenue DESC LIMIT 10`,
      { start: p.startIso, end: p.endIso },
    ).map((r) => ({ ...r, revenueCents: r.revenue, foodKg: round1(r.weight / 1000), revenue: undefined, weight: undefined }));
    const users = db.get(
      `SELECT SUM(role = 'buyer') AS buyers, SUM(role = 'supplier') AS suppliers, SUM(role = 'admin') AS admins,
              SUM(status = 'suspended') AS suspended FROM users`,
    );
    const security = db.get(
      `SELECT SUM(event = 'auth.login') AS logins, SUM(event = 'auth.login_failed') AS failed,
              SUM(event = 'auth.locked') AS locked, SUM(event LIKE 'security.%') AS blocked
         FROM audit_log WHERE at >= $start AND at < $end`,
      { start: p.startIso, end: p.endIso },
    );
    return {
      range: { from: p.from, to: p.to, days: p.days, prevFrom: p.prevFrom, prevTo: p.prevTo },
      kpis: kpisFor(scope, {}, p.startIso, p.endIso),
      previous: kpisFor(scope, {}, p.prevStartIso, p.prevEndIso),
      series: seriesFor(scope, {}, p),
      signups: signupSeries,
      topStores,
      users: { buyers: users.buyers ?? 0, suppliers: users.suppliers ?? 0, admins: users.admins ?? 0, suspended: users.suspended ?? 0 },
      security: { logins: security.logins ?? 0, failed: security.failed ?? 0, locked: security.locked ?? 0, blocked: security.blocked ?? 0 },
      ...base,
    };
  }

  function buyerReport(buyerId) {
    const scope = 'o.buyer_id = $buyerId';
    const params = { buyerId };
    const all = kpisFor(scope, params, '0000', '9999');
    const tz = sqliteTzModifier();
    const today = localDate();
    const firstMonth = `${addDays(today, -160).slice(0, 7)}-01`;
    const monthly = db.all(
      `SELECT strftime('%Y-%m', o.created_at, $tz) AS month,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN original_total_cents - subtotal_cents END), 0) AS savings,
              IFNULL(SUM(CASE WHEN status = 'completed' THEN weight_grams END), 0) AS weight,
              COUNT(*) AS orders
         FROM orders o WHERE ${scope} AND o.created_at >= $start GROUP BY month ORDER BY month`,
      { ...params, tz, start: startOfLocalDayIso(firstMonth) },
    );
    const months = [];
    let cursor = firstMonth;
    while (cursor.slice(0, 7) <= today.slice(0, 7)) {
      const key = cursor.slice(0, 7);
      const r = monthly.find((m) => m.month === key);
      months.push({ month: key, savingsCents: r?.savings ?? 0, foodKg: round1((r?.weight ?? 0) / 1000), orders: r?.orders ?? 0 });
      const [y, m] = key.split('-').map(Number);
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    }
    const byCategory = db.all(
      `SELECT i.category, SUM(i.quantity) AS items FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE ${scope} AND o.status = 'completed' GROUP BY i.category ORDER BY items DESC`,
      params,
    );
    const stores = db.value(
      `SELECT COUNT(DISTINCT store_id) FROM orders o WHERE ${scope} AND status = 'completed'`, params,
    );
    return { kpis: all, months, byCategory, stores };
  }

  function publicImpact() {
    const k = kpisFor('1 = 1', {}, '0000', '9999');
    const today = localDate();
    const live = db.get(
      `SELECT COUNT(*) AS offers, IFNULL(SUM(CASE WHEN o.price_cents = 0 THEN 1 END), 0) AS free,
              COUNT(DISTINCT o.store_id) AS stores
         FROM offers o JOIN stores s ON s.id = o.store_id JOIN users u ON u.id = s.owner_id
        WHERE o.status = 'active' AND o.quantity > 0 AND o.expires_on >= $today AND s.status = 'active' AND u.status = 'active'`,
      { today },
    );
    return {
      meals: k.meals, foodKg: k.foodKg, co2Kg: k.co2Kg, savingsCents: k.savingsCents,
      donations: k.donations, completedOrders: k.completedOrders,
      liveOffers: live.offers, liveFreeOffers: live.free, liveStores: live.stores,
    };
  }

  const CSV_LABELS = {
    'pt-BR': ['Pedido', 'Data', 'Status', 'Loja', 'Cliente', 'Retirada/Entrega', 'Pagamento', 'Itens', 'Itens grátis',
      'Peso (kg)', 'Subtotal (R$)', 'Entrega (R$)', 'Total (R$)', 'Economia do cliente (R$)', 'Avaliação'],
    en: ['Order', 'Date', 'Status', 'Store', 'Customer', 'Pickup/Delivery', 'Payment', 'Items', 'Free items',
      'Weight (kg)', 'Subtotal (R$)', 'Delivery (R$)', 'Total (R$)', 'Customer savings (R$)', 'Rating'],
    es: ['Pedido', 'Fecha', 'Estado', 'Tienda', 'Cliente', 'Retiro/Entrega', 'Pago', 'Artículos', 'Artículos gratis',
      'Peso (kg)', 'Subtotal (R$)', 'Envío (R$)', 'Total (R$)', 'Ahorro del cliente (R$)', 'Calificación'],
  };

  function ordersCsv({ storeId = null, from, to, locale = 'pt-BR' }) {
    const p = period(from, to);
    const delimiter = locale === 'en' ? ',' : ';';
    const num = (n) => (delimiter === ';' ? String(n).replace('.', ',') : String(n));
    const money = (c) => num((c / 100).toFixed(2));
    const rows = db.all(
      `SELECT o.code, o.created_at, o.status, s.name AS store, u.name AS buyer, o.fulfillment, o.payment_method,
              o.items_count, o.free_items, o.weight_grams, o.subtotal_cents, o.delivery_fee_cents, o.total_cents,
              o.original_total_cents, o.rating
         FROM orders o JOIN stores s ON s.id = o.store_id LEFT JOIN users u ON u.id = o.buyer_id
        WHERE ${storeId ? 'o.store_id = $storeId AND' : ''} o.created_at >= $start AND o.created_at < $end
        ORDER BY o.created_at`,
      storeId ? { storeId, start: p.startIso, end: p.endIso } : { start: p.startIso, end: p.endIso },
    );
    return toCsv(CSV_LABELS[locale] ?? CSV_LABELS['pt-BR'], rows.map((r) => [
      r.code, r.created_at, r.status, r.store, storeId ? (r.buyer ?? '').split(' ')[0] : (r.buyer ?? ''),
      r.fulfillment, r.payment_method, r.items_count, r.free_items, num((r.weight_grams / 1000).toFixed(2)),
      money(r.subtotal_cents), money(r.delivery_fee_cents), money(r.total_cents),
      money(r.original_total_cents - r.subtotal_cents), r.rating ?? '',
    ]), { delimiter });
  }

  return { storeReport, adminReport, buyerReport, publicImpact, ordersCsv, period };
}
