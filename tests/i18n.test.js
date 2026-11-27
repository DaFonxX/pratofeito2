import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'js');
const load = async (code) => (await import(pathToFileURL(path.join(root, 'i18n', `${code}.js`)).href)).default;

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !('other' in v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'i18n' ? [] : sourceFiles(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

const placeholders = (text) => [...String(typeof text === 'object' ? JSON.stringify(text) : text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('os três idiomas têm exatamente as mesmas chaves', async () => {
  const pt = flatten(await load('pt-BR'));
  for (const code of ['en', 'es']) {
    const other = flatten(await load(code));
    const missing = Object.keys(pt).filter((k) => !(k in other));
    const extra = Object.keys(other).filter((k) => !(k in pt));
    assert.deepEqual(missing, [], `${code}: faltando ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `${code}: sobrando ${extra.join(', ')}`);
  }
});

test('as variáveis {assim} são as mesmas em todas as traduções', async () => {
  const pt = flatten(await load('pt-BR'));
  for (const code of ['en', 'es']) {
    const other = flatten(await load(code));
    for (const [key, value] of Object.entries(pt)) {
      assert.deepEqual([...new Set(placeholders(other[key]))], [...new Set(placeholders(value))], `${code}: ${key}`);
    }
  }
});

test('toda chave fixa usada no código existe no dicionário', async () => {
  const pt = flatten(await load('pt-BR'));
  const known = new Set(Object.keys(pt));
  const prefixes = new Set(Object.keys(pt).map((k) => k.split('.').slice(0, -1).join('.')));
  const missing = [];
  for (const file of sourceFiles(root)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt(?:Maybe)?\(\s*'([^'$]+)'/g)) {
      const key = m[1];
      if (!known.has(key) && !prefixes.has(key)) missing.push(`${path.basename(file)}: ${key}`);
    }
  }
  const html = readFileSync(path.join(root, '..', '..', 'index.html'), 'utf8');
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) if (!known.has(m[1])) missing.push(`index.html: ${m[1]}`);
  assert.deepEqual(missing, []);
});

test('todo código de erro da API tem mensagem traduzida', async () => {
  const pt = await load('pt-BR');
  const serverDir = path.resolve(root, '..', '..', '..', 'server');
  const codes = new Set();
  for (const file of sourceFiles(serverDir)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:HttpError\(\d+,\s*|forbidden\(|notFound\(|conflict\(|unprocessable\(|badRequest\()'([A-Z_]+)'/g)) codes.add(m[1]);
  }
  const missing = [...codes].filter((c) => !pt.errors[c]);
  assert.deepEqual(missing, []);
});
