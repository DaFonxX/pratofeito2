// Qualidade da tradução: todos os idiomas precisam ter as mesmas chaves e os mesmos {marcadores}.
const test = require('node:test'), assert = require('node:assert/strict');
const load = () => import('../../frontend/js/i18n.js');
const marks = (s) => (s.match(/\{\w+\}/g) || []).sort().join();

test('todos os idiomas têm exatamente as chaves do português', async () => {
  const { DICT } = await load(), base = Object.keys(DICT['pt-BR']).sort();
  for (const [lang, d] of Object.entries(DICT)) assert.deepEqual(Object.keys(d).sort(), base, `chaves diferentes em ${lang}`);
});
test('nenhuma tradução vazia e marcadores iguais ao original', async () => {
  const { DICT } = await load();
  for (const [lang, d] of Object.entries(DICT)) for (const [k, v] of Object.entries(d)) {
    assert.ok(typeof v === 'string' && v.trim(), `${lang}/${k} vazio`);
    assert.equal(marks(v), marks(DICT['pt-BR'][k]), `marcadores diferentes em ${lang}/${k}`);
  }
});
test('translate troca marcadores e cai no português quando falta a chave', async () => {
  const { translate } = await load();
  assert.equal(translate('en', 'nav.cart', { n: 3 }), 'Cart (3)');
  assert.equal(translate('xx', 'nav.orders'), 'Pedidos');
  assert.equal(translate('en', 'chave.inexistente'), 'chave.inexistente');
});
test('esc e money (frontend) funcionam fora do navegador', async () => {
  const { setLang } = await load(), { esc, money } = await import('../../frontend/js/utils.js');
  setLang('pt-BR');
  assert.equal(esc('<b onclick="x">&</b>'), '&lt;b onclick=&quot;x&quot;&gt;&amp;&lt;/b&gt;');
  assert.match(money(1.5), /1,50/);
});
