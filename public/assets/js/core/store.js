import { get, post, setCsrfToken, setUnauthenticatedHandler } from './api.js';

function createEmitter() {
  const listeners = new Set();
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(...args) { for (const fn of listeners) fn(...args); },
  };
}

const sessionEvents = createEmitter();
export const session = {
  user: null,
  meta: null,
  version: null,
  subscribe: sessionEvents.subscribe,

  async load() {
    const [s, meta] = await Promise.all([get('/session'), get('/meta')]);
    setCsrfToken(s.csrfToken);
    this.user = s.user;
    this.version = s.version;
    this.meta = meta;
    sessionEvents.emit(this.user);
    return this.user;
  },

  setUser(user) {
    this.user = user;
    sessionEvents.emit(user);
  },

  async logout() {
    try { await post('/auth/logout'); } finally {
      this.setUser(null);
    }
  },

  is(role) { return this.user?.role === role; },
};

setUnauthenticatedHandler(() => {
  if (session.user) session.setUser(null);
});

const CART_KEY = 'pf.bag';
const cartEvents = createEmitter();

function readCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY) || 'null');
    if (!data || typeof data.storeId !== 'string' || !Array.isArray(data.items)) return null;
    const items = data.items.filter((i) => typeof i.offerId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0)
      .map((i) => ({
        offerId: i.offerId, title: String(i.title ?? ''), emoji: String(i.emoji ?? '🍽️'), unit: String(i.unit ?? 'unit'),
        priceCents: Number(i.priceCents) || 0, originalPriceCents: Number(i.originalPriceCents) || 0,
        quantity: Math.min(i.quantity, 50), maxPerOrder: Number(i.maxPerOrder) || 5, stock: Number(i.stock) || 0,
      }));
    return items.length ? { ...data, items } : null;
  } catch { return null; }
}

let cartState = readCart();

function save() {
  try {
    if (cartState?.items.length) localStorage.setItem(CART_KEY, JSON.stringify(cartState));
    else localStorage.removeItem(CART_KEY);
  } catch {}
  if (cartState && !cartState.items.length) cartState = null;
  cartEvents.emit(cartState);
}

window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) { cartState = readCart(); cartEvents.emit(cartState); }
});

const itemFromOffer = (offer, quantity) => ({
  offerId: offer.id, title: offer.title, emoji: offer.emoji, unit: offer.unit, priceCents: offer.priceCents,
  originalPriceCents: offer.originalPriceCents, quantity, maxPerOrder: offer.maxPerOrder, stock: offer.quantity,
});

export const cart = {
  subscribe: cartEvents.subscribe,
  get: () => cartState,
  count: () => cartState?.items.reduce((s, i) => s + i.quantity, 0) ?? 0,
  subtotal: () => cartState?.items.reduce((s, i) => s + i.priceCents * i.quantity, 0) ?? 0,
  originalTotal: () => cartState?.items.reduce((s, i) => s + i.originalPriceCents * i.quantity, 0) ?? 0,
  quantityOf: (offerId) => cartState?.items.find((i) => i.offerId === offerId)?.quantity ?? 0,
  limitFor: (item) => Math.max(0, Math.min(item.maxPerOrder, item.stock || item.maxPerOrder)),

  add(offer, quantity = 1) {
    if (cartState && cartState.storeId !== offer.store.id) return { conflict: cartState.storeName };
    if (!cartState) {
      cartState = {
        storeId: offer.store.id, storeName: offer.store.name, storeEmoji: offer.store.emoji,
        delivery: !!offer.store.delivery, deliveryFeeCents: offer.store.deliveryFeeCents ?? 0, items: [],
      };
    }
    const existing = cartState.items.find((i) => i.offerId === offer.id);
    const limit = Math.min(offer.maxPerOrder, offer.quantity);
    if (existing) {
      existing.quantity = Math.min(limit, existing.quantity + quantity);
      Object.assign(existing, { priceCents: offer.priceCents, originalPriceCents: offer.originalPriceCents, stock: offer.quantity, maxPerOrder: offer.maxPerOrder });
    } else {
      cartState.items.push(itemFromOffer(offer, Math.min(limit, quantity)));
    }
    save();
    return { ok: true };
  },

  replaceWith(offer, quantity = 1) {
    cartState = null;
    return this.add(offer, quantity);
  },

  setQuantity(offerId, quantity) {
    if (!cartState) return;
    const item = cartState.items.find((i) => i.offerId === offerId);
    if (!item) return;
    if (quantity <= 0) cartState.items = cartState.items.filter((i) => i.offerId !== offerId);
    else item.quantity = Math.min(quantity, this.limitFor(item) || quantity);
    save();
  },

  remove(offerId) { this.setQuantity(offerId, 0); },
  clear() { cartState = null; save(); },
};
