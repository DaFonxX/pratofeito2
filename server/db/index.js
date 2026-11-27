import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(path.join(here, 'schema.sql'), 'utf8');
const SCHEMA_VERSION = '2';

export function openDatabase(file, { reset = false } = {}) {
  if (reset && file !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(file + suffix)) rmSync(file + suffix);
    }
  }
  const raw = new DatabaseSync(file);
  if (typeof raw.enableDefensive === 'function') raw.enableDefensive(true);
  raw.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA trusted_schema = OFF;
    PRAGMA secure_delete = ON;
  `);
  raw.exec(SCHEMA);
  raw.prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', $v)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run({ v: SCHEMA_VERSION });

  const statements = new Map();

  function prepare(sql) {
    let entry = statements.get(sql);
    if (!entry) {
      const names = [...new Set([...sql.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))];
      entry = { stmt: raw.prepare(sql), names };
      statements.set(sql, entry);
    }
    return entry;
  }

  function bind(entry, params = {}) {
    const out = {};
    for (const name of entry.names) {
      let value = params[name];
      if (value === undefined) throw new Error(`Parâmetro SQL ausente: $${name}`);
      if (typeof value === 'boolean') value = value ? 1 : 0;
      out[name] = value;
    }
    return out;
  }

  const db = {
    raw,
    get(sql, params) {
      const e = prepare(sql);
      return e.stmt.get(bind(e, params));
    },
    all(sql, params) {
      const e = prepare(sql);
      return e.stmt.all(bind(e, params));
    },
    run(sql, params) {
      const e = prepare(sql);
      return e.stmt.run(bind(e, params));
    },
    value(sql, params) {
      const row = db.get(sql, params);
      return row ? Object.values(row)[0] : undefined;
    },
    transaction(fn) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
    close() { raw.close(); },
  };
  return db;
}
