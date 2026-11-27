const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function cleanText(value, { multiline = false } = {}) {
  let s = String(value).normalize('NFC').replace(CONTROL_CHARS, '');
  if (multiline) {
    s = s.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ');
  }
  return s.trim();
}

export const foldText = (value) => String(value ?? '')
  .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export const CATEGORY_KEYWORDS = {
  meals: 'refeicao refeicoes marmita prato feito almoco jantar meal lunch dinner comida plato almuerzo cena',
  bakery: 'padaria pao paes bolo salgado bakery bread cake panaderia pan torta',
  fruits: 'fruta frutas fruit fruits frutas',
  vegetables: 'verdura verduras legume legumes hortalica salada vegetables veggies greens verduras hortalizas',
  dairy: 'laticinio laticinios leite queijo iogurte dairy milk cheese yogurt lacteos leche queso',
  groceries: 'mercearia mercado cesta basica groceries pantry abarrotes despensa',
  drinks: 'bebida bebidas suco cafe drinks juice coffee bebidas jugo',
  sweets: 'doce doces sobremesa sweets dessert dulces postre',
};
