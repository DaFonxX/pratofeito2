CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  role                TEXT NOT NULL CHECK (role IN ('buyer', 'supplier', 'admin')),
  name                TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash       TEXT NOT NULL,
  phone               TEXT,
  city                TEXT,
  neighborhood        TEXT,
  address             TEXT,
  locale              TEXT CHECK (locale IN ('pt-BR', 'en', 'es')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  is_demo             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  last_login_at       TEXT,
  password_changed_at TEXT
);

CREATE TABLE IF NOT EXISTS stores (
  id                 TEXT PRIMARY KEY,
  owner_id           TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  type               TEXT NOT NULL CHECK (type IN ('restaurant', 'bakery', 'market', 'produce', 'cafe', 'farm', 'other')),
  cnpj               TEXT NOT NULL UNIQUE,
  description        TEXT NOT NULL DEFAULT '',
  phone              TEXT,
  address            TEXT NOT NULL,
  neighborhood       TEXT NOT NULL,
  city               TEXT NOT NULL,
  emoji              TEXT NOT NULL DEFAULT '🍽️',
  opens_at           TEXT NOT NULL DEFAULT '08:00',
  closes_at          TEXT NOT NULL DEFAULT '20:00',
  delivery           INTEGER NOT NULL DEFAULT 0 CHECK (delivery IN (0, 1)),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents BETWEEN 0 AND 5000),
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  is_demo            INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id                   TEXT PRIMARY KEY,
  store_id             TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title                TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 80),
  description          TEXT NOT NULL DEFAULT '',
  category             TEXT NOT NULL CHECK (category IN ('meals', 'bakery', 'fruits', 'vegetables', 'dairy', 'groceries', 'drinks', 'sweets')),
  emoji                TEXT NOT NULL,
  unit                 TEXT NOT NULL CHECK (unit IN ('unit', 'portion', 'kg', 'kit', 'box', 'liter', 'dozen', 'bag')),
  weight_grams         INTEGER NOT NULL CHECK (weight_grams BETWEEN 10 AND 50000),
  original_price_cents INTEGER NOT NULL CHECK (original_price_cents BETWEEN 100 AND 500000),
  price_cents          INTEGER NOT NULL CHECK (price_cents >= 0 AND price_cents <= original_price_cents),
  quantity             INTEGER NOT NULL CHECK (quantity BETWEEN 0 AND 9999),
  max_per_order        INTEGER NOT NULL DEFAULT 5 CHECK (max_per_order BETWEEN 1 AND 50),
  expires_on           TEXT NOT NULL,
  pickup_start         TEXT NOT NULL,
  pickup_end           TEXT NOT NULL,
  tags                 TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  search               TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers (status, expires_on);
CREATE INDEX IF NOT EXISTS idx_offers_store ON offers (store_id, status);

CREATE TABLE IF NOT EXISTS orders (
  id                   TEXT PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  buyer_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  store_id             TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  fulfillment          TEXT NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
  delivery_address     TEXT,
  payment_method       TEXT NOT NULL CHECK (payment_method IN ('pix', 'card', 'cash', 'free')),
  subtotal_cents       INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents   INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  total_cents          INTEGER NOT NULL CHECK (total_cents >= 0),
  original_total_cents INTEGER NOT NULL CHECK (original_total_cents >= 0),
  items_count          INTEGER NOT NULL CHECK (items_count > 0),
  free_items           INTEGER NOT NULL DEFAULT 0,
  weight_grams         INTEGER NOT NULL DEFAULT 0,
  pickup_code          TEXT NOT NULL,
  notes                TEXT,
  rating               INTEGER CHECK (rating BETWEEN 1 AND 5),
  review               TEXT,
  cancel_reason        TEXT,
  cancelled_by         TEXT CHECK (cancelled_by IN ('buyer', 'store', 'admin', 'system')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  confirmed_at         TEXT,
  ready_at             TEXT,
  completed_at         TEXT,
  cancelled_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders (store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id                        INTEGER PRIMARY KEY,
  order_id                  TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offer_id                  TEXT REFERENCES offers(id) ON DELETE SET NULL,
  title                     TEXT NOT NULL,
  emoji                     TEXT NOT NULL,
  category                  TEXT NOT NULL,
  unit                      TEXT NOT NULL,
  quantity                  INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents          INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  unit_original_price_cents INTEGER NOT NULL CHECK (unit_original_price_cents >= 0),
  unit_weight_grams         INTEGER NOT NULL CHECK (unit_weight_grams >= 0)
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_items_offer ON order_items (offer_id);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  user_agent   TEXT,
  ip           TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id      INTEGER PRIMARY KEY,
  at      TEXT NOT NULL,
  user_id TEXT,
  event   TEXT NOT NULL,
  ip      TEXT,
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log (event, at);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id   TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, store_id)
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
