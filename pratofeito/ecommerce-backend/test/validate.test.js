// Qualidade dos dados: regras de validação das entradas da API.
const test = require('node:test'), assert = require('node:assert/strict');
const { schemas } = require('../middlewares/validate');
const ok = (schema, v) => assert.equal(schema.validate(v).error, undefined);
const bad = (schema, v) => assert.ok(schema.validate(v).error);
const buyer = { type: 'buyer', name: 'Ana', email: 'ana@exemplo.com', password: '12345678' };

test('cadastro: comprador válido; senha curta e e-mail ruim são recusados', () => {
  ok(schemas.register, buyer);
  bad(schemas.register, { ...buyer, password: '123' });
  bad(schemas.register, { ...buyer, email: 'nao-e-email' });
});
test('cadastro: estabelecimento exige CNPJ no formato certo', () => {
  bad(schemas.register, { ...buyer, type: 'supplier' });
  bad(schemas.register, { ...buyer, type: 'supplier', cnpj: '123' });
  ok(schemas.register, { ...buyer, type: 'supplier', cnpj: '12.345.678/0001-90' });
});
test('produto: preço com desconto não pode passar do original', () => {
  const p = { name: 'Pão', category: 'Padaria', quantity: 5, expiry_date: '2030-01-01', original_price: 10, price: 5 };
  ok(schemas.product, p);
  bad(schemas.product, { ...p, price: 11 });
  bad(schemas.product, { ...p, quantity: -1 });
});
test('pedido: itens com UUID e endereço obrigatório na entrega', () => {
  const id = '3f2b8c1e-8a7d-4c1e-9b5a-1a2b3c4d5e6f', it = [{ product_id: id, quantity: 1 }];
  ok(schemas.order, { items: it, receipt_type: 'pickup' });
  bad(schemas.order, { items: it, receipt_type: 'delivery' });
  ok(schemas.order, { items: it, receipt_type: 'delivery', delivery_address: 'Rua A, 1' });
  bad(schemas.order, { items: [{ product_id: 'x', quantity: 1 }], receipt_type: 'pickup' });
  bad(schemas.order, { items: [], receipt_type: 'pickup' });
});
