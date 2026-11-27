import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let srv;
let buyer;
let supplier;
before(async () => {
  srv = await startTestServer();
  buyer = srv.client();
  await buyer.login('cliente@demo.com');
  supplier = srv.client();
  await supplier.login('restaurante@demo.com');
});
after(async () => { await srv.stop(); });

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date());

async function newOffer(fields = {}) {
  const r = await supplier.post('/api/supplier/offers', {
    title: 'Teste de marmita', description: 'Oferta criada no teste', category: 'meals', unit: 'portion',
    originalPriceCents: 2000, priceCents: 800, quantity: 3, maxPerOrder: 5, expiresOn: today(),
    pickupStart: '18:00', pickupEnd: '20:00', tags: ['vegetarian'], ...fields,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.data;
}

test('o preço do pedido vem do servidor, não do navegador', async () => {
  const offer = await newOffer();
  const store = (await supplier.get('/api/supplier/store')).data;
  const r = await buyer.post('/api/orders', {
    storeId: store.id, items: [{ offerId: offer.id, quantity: 2, priceCents: 1 }], fulfillment: 'pickup', paymentMethod: 'pix',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.data.subtotalCents, 1600);
  assert.equal(r.data.savingsCents, 2400);
  assert.match(r.data.pickupCode, /^\d{4}$/);
  const after = (await supplier.get(`/api/supplier/offers/${offer.id}`)).data;
  assert.equal(after.quantity, 1, 'estoque baixou 2 unidades');
});

test('não vende além do estoque nem acima do limite por pedido', async () => {
  const offer = await newOffer({ quantity: 2, maxPerOrder: 5 });
  const store = (await supplier.get('/api/supplier/store')).data;
  const tooMany = await buyer.post('/api/orders', {
    storeId: store.id, items: [{ offerId: offer.id, quantity: 3 }], fulfillment: 'pickup', paymentMethod: 'pix',
  });
  assert.equal(tooMany.status, 409);
  assert.equal(tooMany.error.code, 'OUT_OF_STOCK');
  const limited = await newOffer({ quantity: 10, maxPerOrder: 2 });
  const overLimit = await buyer.post('/api/orders', {
    storeId: store.id, items: [{ offerId: limited.id, quantity: 3 }], fulfillment: 'pickup', paymentMethod: 'pix',
  });
  assert.equal(overLimit.error.code, 'MAX_PER_ORDER');
});

test('pedidos simultâneos nunca deixam o estoque negativo', async () => {
  const offer = await newOffer({ quantity: 5, maxPerOrder: 1 });
  const store = (await supplier.get('/api/supplier/store')).data;
  const buyers = [];
  for (let i = 0; i < 8; i++) {
    const c = srv.client();
    await c.init();
    await c.post('/api/auth/register', {
      role: 'buyer', name: `Cliente ${i}`, email: `concorrente${i}@example.com`, password: `pao-de-queijo-${i}${i}x`, acceptTerms: true,
    });
    buyers.push(c);
  }
  const results = await Promise.all(buyers.map((c) => c.post('/api/orders', {
    storeId: store.id, items: [{ offerId: offer.id, quantity: 1 }], fulfillment: 'pickup', paymentMethod: 'cash',
  })));
  assert.equal(results.filter((r) => r.status === 201).length, 5);
  assert.equal(results.filter((r) => r.status === 409).length, 3);
  assert.equal((await supplier.get(`/api/supplier/offers/${offer.id}`)).data.quantity, 0);
});

test('itens grátis: limite diário por pessoa', async () => {
  const free = await newOffer({ priceCents: 0, quantity: 20, maxPerOrder: 2, title: 'Sopa grátis do teste' });
  const store = (await supplier.get('/api/supplier/store')).data;
  const c = srv.client();
  await c.init();
  await c.post('/api/auth/register', { role: 'buyer', name: 'Pessoa Doação', email: 'doacao@example.com', password: 'cuscuz-nordestino-1', acceptTerms: true });
  const order = (qty) => c.post('/api/orders', { storeId: store.id, items: [{ offerId: free.id, quantity: qty }], fulfillment: 'pickup' });
  const first = await order(2);
  assert.equal(first.status, 201);
  assert.equal(first.data.paymentMethod, 'free');
  assert.equal(first.data.totalCents, 0);
  const second = await order(2);
  assert.equal(second.status, 409);
  assert.equal(second.error.code, 'FREE_LIMIT_REACHED');
  assert.equal(second.error.remaining, 1);
  assert.equal((await order(1)).status, 201);
});

test('fluxo de status: só avança na ordem certa e concluir exige o código de retirada', async () => {
  const offer = await newOffer({ quantity: 4 });
  const store = (await supplier.get('/api/supplier/store')).data;
  const order = (await buyer.post('/api/orders', {
    storeId: store.id, items: [{ offerId: offer.id, quantity: 1 }], fulfillment: 'pickup', paymentMethod: 'card',
  })).data;
  const set = (status, extra = {}) => supplier.post(`/api/supplier/orders/${order.id}/status`, { status, ...extra });
  assert.equal((await set('ready')).error.code, 'INVALID_STATUS_TRANSITION');
  assert.equal((await set('confirmed')).status, 200);
  assert.equal((await set('ready')).status, 200);
  assert.equal((await set('completed', { pickupCode: '0000' === order.pickupCode ? '1111' : '0000' })).error.code, 'INVALID_PICKUP_CODE');
  const done = await set('completed', { pickupCode: order.pickupCode });
  assert.equal(done.status, 200);
  assert.equal(done.data.status, 'completed');
  assert.equal(done.data.pickupCode, undefined, 'a loja nunca recebe o código de retirada');

  const review = await buyer.post(`/api/orders/${order.id}/review`, { rating: 5, review: 'Muito bom!' });
  assert.equal(review.data.rating, 5);
  assert.equal((await buyer.post(`/api/orders/${order.id}/review`, { rating: 1 })).error.code, 'ORDER_ALREADY_REVIEWED');
});

test('cliente cancela pedido pendente e o estoque volta', async () => {
  const offer = await newOffer({ quantity: 3 });
  const store = (await supplier.get('/api/supplier/store')).data;
  const order = (await buyer.post('/api/orders', {
    storeId: store.id, items: [{ offerId: offer.id, quantity: 2 }], fulfillment: 'pickup', paymentMethod: 'pix',
  })).data;
  assert.equal((await supplier.get(`/api/supplier/offers/${offer.id}`)).data.quantity, 1);
  const cancelled = await buyer.post(`/api/orders/${order.id}/cancel`, { reason: 'Mudei de ideia' });
  assert.equal(cancelled.data.status, 'cancelled');
  assert.equal((await supplier.get(`/api/supplier/offers/${offer.id}`)).data.quantity, 3);
});

test('fornecedor não edita oferta de outra loja e regras de preço valem', async () => {
  const bad = await supplier.post('/api/supplier/offers', {
    title: 'Preço maior que o original', category: 'meals', unit: 'portion', originalPriceCents: 1000, priceCents: 1500,
    quantity: 1, expiresOn: today(), pickupStart: '20:00', pickupEnd: '19:00',
  });
  assert.equal(bad.status, 422);
  assert.equal(bad.error.fields.priceCents, 'price_above_original');
  assert.equal(bad.error.fields.pickupEnd, 'pickup_end_before_start');

  const anyOffer = (await srv.client().get('/api/offers?pageSize=48')).data.items.find((o) => o.store.name !== 'Restaurante Bom Prato');
  const steal = await supplier.patch(`/api/supplier/offers/${anyOffer.id}`, { priceCents: 1 });
  assert.equal(steal.status, 404);
});

test('relatório da loja: indicadores, série diária e exportação CSV protegida', async () => {
  const report = await supplier.get('/api/supplier/reports');
  assert.equal(report.status, 200);
  assert.equal(report.data.series.length, 30);
  assert.ok(report.data.kpis.orders > 0);
  assert.ok(Array.isArray(report.data.byCategory));
  assert.ok(report.data.previous, 'traz o período anterior para comparação');

  await newOffer({ title: '=HYPERLINK("http://mal.example","clique")' });
  const csvRes = await supplier.raw('GET', '/api/supplier/offers.csv');
  const bytes = Buffer.from(await csvRes.arrayBuffer());
  const csv = bytes.toString('utf8');
  assert.match(csvRes.headers.get('content-disposition'), /attachment/);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'BOM UTF-8 para o Excel reconhecer acentos');
  assert.ok(csv.includes(`'=HYPERLINK`), 'fórmula neutralizada com apóstrofo');

  const orders = await supplier.raw('GET', '/api/supplier/reports/orders.csv?lang=en');
  assert.equal(orders.status, 200);
  assert.match(await orders.text(), /Order,Date,Status/);
});

test('importação de ofertas por CSV valida linha a linha', async () => {
  const header = 'title;category;unit;original_price;price;quantity;expires_on;pickup_start;pickup_end';
  const bad = await supplier.post('/api/supplier/offers/import', { csv: `${header}\nOferta boa;meals;portion;20,00;8,00;5;${today()};18:00;20:00\nRuim;nao-existe;portion;10;5;1;${today()};18:00;20:00` });
  assert.equal(bad.data.created, 0);
  assert.equal(bad.data.errors[0].row, 3);
  const ok = await supplier.post('/api/supplier/offers/import', { csv: `${header}\nOferta importada A;meals;portion;20,00;8,00;5;${today()};18:00;20:00\nOferta importada B;bakery;unit;10.50;4.25;2;${today()};17:00;19:00` });
  assert.equal(ok.data.created, 2);
  const list = (await supplier.get('/api/supplier/offers')).data;
  const b = list.find((o) => o.title === 'Oferta importada B');
  assert.equal(b.originalPriceCents, 1050);
  assert.equal(b.priceCents, 425);
});

test('portabilidade de dados: exportação completa da conta em JSON', async () => {
  const res = await buyer.raw('GET', '/api/account/export');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /pratofeito-meus-dados/);
  const data = await res.json();
  assert.equal(data.format, 'pratofeito-export');
  assert.equal(data.account.email, 'cliente@demo.com');
  assert.ok(data.orders.length > 0);
  assert.equal(JSON.stringify(data).includes('password'), false, 'nunca exporta hash de senha');
});

test('páginas públicas: lojas, loja, oferta, impacto e metadados respondem', async () => {
  const anon = srv.client();
  const stores = await anon.get('/api/stores');
  assert.equal(stores.status, 200);
  assert.ok(stores.data.length >= 9);
  assert.ok(stores.data.some((s) => s.rating > 0));
  const store = await anon.get(`/api/stores/${stores.data[0].id}`);
  assert.equal(store.status, 200);
  assert.ok(Array.isArray(store.data.offers));
  const offer = store.data.offers[0];
  assert.equal((await anon.get(`/api/offers/${offer.id}`)).status, 200);
  assert.equal((await anon.get('/api/offers/naoexiste')).status, 404);
  assert.ok((await anon.get('/api/impact')).data.meals > 0);
  const meta = await anon.get('/api/meta');
  assert.ok(meta.data.categories.includes('meals'));
  for (const query of ['price=free', 'price=paid', 'expiring=today', 'delivery=1', 'tag=vegan', 'sort=rating', 'category=bakery&sort=price']) {
    assert.equal((await anon.get(`/api/offers?${query}`)).status, 200, query);
  }
});

test('relatórios do administrador e impacto do cliente', async () => {
  const admin = srv.client();
  await admin.login('admin@demo.com');
  const r = await admin.get('/api/admin/reports?from=2026-01-01&to=2026-12-31');
  assert.equal(r.status, 200);
  assert.ok(r.data.topStores.length > 0);
  assert.equal((await admin.get('/api/admin/reports?from=2026-05-01&to=2026-01-01')).status, 422);
  const impact = await buyer.get('/api/me/impact');
  assert.ok(impact.data.kpis.savingsCents > 0);
  assert.ok(impact.data.months.length >= 5);
});
