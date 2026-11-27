export const DEMO_PASSWORD = 'Prato#2026';
export const DEMO_ACCOUNTS = [
  { role: 'buyer', email: 'cliente@demo.com', name: 'Ana Souza' },
  { role: 'supplier', email: 'restaurante@demo.com', name: 'Carlos Menezes' },
  { role: 'admin', email: 'admin@demo.com', name: 'Equipe PratoFeito' },
];

export const DEMO_CITY = 'Barra do Garças';

export const DEMO_STORES = [
  {
    key: 'bomprato', owner: 'restaurante@demo.com', name: 'Restaurante Bom Prato', type: 'restaurant', emoji: '🍲',
    address: 'Av. Brasil, 1450', neighborhood: 'Centro', opens: '10:30', closes: '21:00', delivery: 1, fee: 500, weight: 3,
    description: 'Comida caseira e marmitas do dia. O que sobra do almoço vira oferta no meio da tarde.',
    offers: [
      ['Marmita do dia: arroz, feijão, bife e salada', 'O PF clássico da casa, montado no capricho. Vem em embalagem térmica.', 'meals', '🍱', 'portion', 450, 2500, 1000, 12, 3, '14:30', '16:00', '', 0],
      ['Feijoada completa individual', 'Feijoada com couve, farofa, arroz e laranja. Sobrou do almoço de hoje.', 'meals', '🥘', 'portion', 600, 3200, 1400, 8, 2, '15:00', '17:00', '', 0],
      ['Frango assado com legumes', 'Coxa e sobrecoxa assadas com batata, cenoura e abobrinha.', 'meals', '🍗', 'portion', 500, 2800, 1100, 6, 3, '15:00', '17:00', 'gluten_free', 0],
      ['Marmita vegetariana', 'Arroz integral, lentilha, legumes grelhados e salada.', 'meals', '🥗', 'portion', 400, 2400, 900, 6, 3, '14:30', '16:00', 'vegetarian', 0],
      ['Sopa de legumes (500 ml)', 'Sopa do jantar, feita hoje. Doação para quem precisar.', 'meals', '🍲', 'portion', 500, 1500, 0, 10, 2, '19:30', '21:00', 'vegan,gluten_free', 0],
      ['Arroz carreteiro', 'Arroz com carne seca, linguiça e cheiro-verde.', 'meals', '🍛', 'portion', 450, 2600, 1200, 5, 3, '15:00', '17:00', '', 1],
    ],
  },
  {
    key: 'saborcasa', owner: 'padaria@demo.com', ownerName: 'Lúcia Ferraz', name: 'Padaria Sabor da Casa', type: 'bakery', emoji: '🥖',
    address: 'Rua das Flores, 220', neighborhood: 'Jardim Central', opens: '06:00', closes: '20:00', delivery: 1, fee: 400, weight: 1.6,
    description: 'Pães de fermentação natural, bolos e salgados assados no dia.',
    offers: [
      ['Sacola surpresa de pães', 'Uma seleção do que sobrou na vitrine: pães doces, salgados e de forma.', 'bakery', '🥖', 'bag', 1200, 2800, 900, 10, 2, '18:00', '20:00', 'vegetarian', 0],
      ['Pão de fermentação natural', 'Fermentação de 24 horas, casca crocante.', 'bakery', '🍞', 'unit', 600, 2200, 1000, 6, 2, '18:00', '20:00', 'vegan', 1],
      ['Croissants (caixa com 4)', 'Manteiga francesa, assados hoje de manhã.', 'bakery', '🥐', 'box', 300, 2400, 1000, 5, 2, '18:00', '20:00', 'vegetarian', 0],
      ['Bolo de cenoura com chocolate', 'Bolo inteiro com cobertura de brigadeiro.', 'sweets', '🍰', 'unit', 900, 3500, 1500, 3, 1, '18:00', '20:00', 'vegetarian', 1],
      ['Salgados assados (6 unidades)', 'Esfirra, enroladinho e empada, sortidos.', 'bakery', '🥨', 'box', 450, 1800, 700, 8, 3, '18:00', '20:00', '', 0],
      ['Pão francês do dia (1 kg)', 'Doação: pão francês da última fornada.', 'bakery', '🥖', 'kg', 1000, 1600, 0, 6, 1, '19:00', '20:00', 'vegan', 0],
    ],
  },
  {
    key: 'verdevida', owner: 'hortifruti@demo.com', ownerName: 'Marcos Tavares', name: 'Hortifruti Verde Vida', type: 'produce', emoji: '🥬',
    address: 'Rua Goiás, 88', neighborhood: 'Centro', opens: '07:00', closes: '19:00', delivery: 0, fee: 0, weight: 1.3,
    description: 'Frutas, verduras e legumes frescos. Os mais maduros saem com desconto.',
    offers: [
      ['Banana prata madura (1 kg)', 'Ótima para vitamina, bolo e doce.', 'fruits', '🍌', 'kg', 1000, 800, 300, 25, 3, '16:00', '19:00', 'vegan,gluten_free', 1],
      ['Kit salada: alface, tomate e pepino', 'Tudo higienizado e separado em sacola.', 'vegetables', '🥬', 'kit', 900, 1600, 700, 10, 2, '16:00', '19:00', 'vegan,gluten_free', 0],
      ['Tomates para molho (1 kg)', 'Bem maduros, perfeitos para molho caseiro.', 'vegetables', '🍅', 'kg', 1000, 900, 350, 20, 3, '16:00', '19:00', 'vegan,gluten_free', 2],
      ['Melancia em pedaços (bandeja)', 'Bandeja com 1 kg de melancia cortada hoje.', 'fruits', '🍉', 'box', 1000, 1200, 500, 6, 2, '16:00', '19:00', 'vegan,gluten_free', 0],
      ['Cesta de frutas da estação', 'Manga, laranja, maçã e mamão, com pequenas marcas na casca.', 'fruits', '🧺', 'kit', 2500, 3000, 1200, 5, 1, '16:00', '19:00', 'vegan,gluten_free', 2],
      ['Folhas e temperos (doação)', 'Couve, cheiro-verde e rúcula do dia.', 'vegetables', '🥬', 'bag', 400, 600, 0, 12, 2, '17:00', '19:00', 'vegan,gluten_free', 0],
    ],
  },
  {
    key: 'esperanca', owner: 'mercado@demo.com', ownerName: 'Rita Campos', name: 'Mercado Esperança', type: 'market', emoji: '🛒',
    address: 'Av. Independência, 900', neighborhood: 'Vila Nova', opens: '07:00', closes: '21:00', delivery: 0, fee: 0, weight: 1,
    description: 'Mercado de bairro. Separamos produtos perto da validade ou com embalagem amassada.',
    offers: [
      ['Cesta básica com itens perto da validade', 'Arroz, feijão, macarrão, óleo, molho e biscoitos.', 'groceries', '🧺', 'kit', 6000, 9000, 3900, 4, 1, '08:00', '20:00', '', 4],
      ['Iogurte natural (6 unidades)', 'Vence em dois dias. Mantenha refrigerado.', 'dairy', '🥛', 'box', 900, 1500, 600, 8, 2, '08:00', '20:00', 'vegetarian,gluten_free', 2],
      ['Queijo minas frescal (500 g)', 'Produção regional.', 'dairy', '🧀', 'unit', 500, 2200, 1100, 5, 2, '08:00', '20:00', 'vegetarian,gluten_free', 3],
      ['Feijão carioca 1 kg (embalagem amassada)', 'Produto perfeito, só a embalagem que não.', 'groceries', '🫘', 'unit', 1000, 900, 400, 15, 4, '08:00', '20:00', 'vegan,gluten_free', 6],
      ['Kit doação: arroz, feijão e macarrão', 'Para famílias que precisam. Um kit por pessoa.', 'groceries', '🍚', 'kit', 3000, 2500, 0, 6, 1, '08:00', '20:00', 'vegan', 5],
    ],
  },
  {
    key: 'economia', owner: 'supermercado@demo.com', ownerName: 'Paulo Henrique Dias', name: 'Supermercado Economia', type: 'market', emoji: '🧺',
    address: 'Rua Sete de Setembro, 1200', neighborhood: 'Setor Oeste', opens: '08:00', closes: '22:00', delivery: 1, fee: 600, weight: 1.2,
    description: 'Ofertas de última hora com entrega no bairro.',
    offers: [
      ['Leite integral (caixa com 6)', 'Seis caixinhas de 1 litro.', 'dairy', '🥛', 'box', 6000, 3600, 1800, 6, 2, '09:00', '21:00', 'vegetarian,gluten_free', 3],
      ['Pão de forma integral', 'Vence amanhã.', 'bakery', '🍞', 'unit', 500, 1000, 450, 10, 3, '09:00', '21:00', 'vegan', 1],
      ['Frango congelado (1 kg)', 'Coxa e sobrecoxa.', 'groceries', '🍗', 'kg', 1000, 1900, 1000, 8, 2, '09:00', '21:00', 'gluten_free', 2],
      ['Suco de laranja integral (1 L)', 'Sem açúcar e sem conservantes.', 'drinks', '🧃', 'liter', 1000, 1200, 500, 12, 4, '09:00', '21:00', 'vegan,gluten_free', 2],
      ['Ovos caipira (dúzia)', 'Ovos de galinhas criadas soltas.', 'dairy', '🥚', 'dozen', 700, 1400, 700, 8, 2, '09:00', '21:00', 'vegetarian,gluten_free', 4],
    ],
  },
  {
    key: 'graodeouro', owner: 'cafe@demo.com', ownerName: 'Beatriz Lemos', name: 'Café Grão de Ouro', type: 'cafe', emoji: '☕',
    address: 'Praça Central, 15', neighborhood: 'Centro', opens: '07:00', closes: '19:00', delivery: 0, fee: 0, weight: 1,
    description: 'Cafés especiais, croissants e tortas da casa.',
    offers: [
      ['Torta de limão (fatia dupla)', 'Massa amanteigada e merengue maçaricado.', 'sweets', '🥧', 'portion', 250, 1800, 700, 6, 2, '17:00', '19:00', 'vegetarian', 0],
      ['Croissant de presunto e queijo', 'Assado hoje.', 'bakery', '🥐', 'unit', 150, 1200, 500, 8, 3, '17:00', '19:00', '', 0],
      ['Café coado (garrafa de 1 L)', 'Doação: o café que sobrou no fim do dia. Traga sua garrafa.', 'drinks', '☕', 'liter', 1000, 1600, 0, 4, 1, '18:00', '19:00', 'vegan,gluten_free', 0],
      ['Cookies (pacote com 5)', 'Chocolate meio amargo e castanhas.', 'sweets', '🍪', 'bag', 250, 1500, 600, 10, 3, '17:00', '19:00', 'vegetarian', 2],
    ],
  },
  {
    key: 'volurdes', owner: 'cantina@demo.com', ownerName: 'Lurdes Andrade', name: 'Cantina da Vó Lurdes', type: 'restaurant', emoji: '🍝',
    address: 'Rua do Comércio, 300', neighborhood: 'Jardim Primavera', opens: '11:00', closes: '22:00', delivery: 1, fee: 500, weight: 1.4,
    description: 'Massas frescas e molhos da casa, receita de família.',
    offers: [
      ['Lasanha à bolonhesa', 'Porção individual, gratinada.', 'meals', '🍝', 'portion', 500, 3400, 1500, 6, 2, '20:30', '22:00', '', 0],
      ['Nhoque ao sugo', 'Nhoque de batata com molho de tomate fresco.', 'meals', '🍝', 'portion', 450, 2900, 1200, 5, 2, '20:30', '22:00', 'vegetarian', 0],
      ['Pizza de muçarela (8 fatias)', 'Massa de longa fermentação.', 'meals', '🍕', 'unit', 900, 4500, 2000, 3, 1, '21:00', '22:00', 'vegetarian', 0],
      ['Pudim de leite (fatia)', 'Receita da vó.', 'sweets', '🍮', 'portion', 150, 1200, 500, 8, 3, '20:30', '22:00', 'vegetarian,gluten_free', 1],
    ],
  },
  {
    key: 'boacolheita', owner: 'sitio@demo.com', ownerName: 'José Ribamar', name: 'Sítio Boa Colheita', type: 'farm', emoji: '🚜',
    address: 'Feira do Produtor, banca 12', neighborhood: 'Vila Nova', opens: '06:00', closes: '12:00', delivery: 0, fee: 0, weight: 0.9,
    description: 'Produtores rurais da região, direto da roça para a feira.',
    offers: [
      ['Mandioca descascada (1 kg)', 'Colhida ontem, pronta para cozinhar.', 'vegetables', '🥔', 'kg', 1000, 800, 400, 15, 3, '07:00', '11:00', 'vegan,gluten_free,organic', 2],
      ['Milho verde (5 espigas)', 'Para pamonha, curau ou cozido.', 'vegetables', '🌽', 'kit', 1500, 1500, 600, 10, 2, '07:00', '11:00', 'vegan,gluten_free,organic', 1],
      ['Ovos caipiras (meia dúzia)', 'Do galinheiro do sítio.', 'dairy', '🥚', 'unit', 350, 900, 450, 10, 2, '07:00', '11:00', 'vegetarian,gluten_free,organic', 3],
      ['Kit cenoura e beterraba (doação)', 'Legumes fora do padrão de tamanho, mas ótimos.', 'vegetables', '🥕', 'kit', 1000, 900, 0, 8, 1, '07:00', '11:00', 'vegan,gluten_free,organic', 1],
      ['Mel silvestre (pote de 300 g)', 'Mel puro de florada silvestre.', 'groceries', '🍯', 'unit', 300, 2800, 1800, 5, 2, '07:00', '11:00', 'gluten_free,organic', 10],
    ],
  },
  {
    key: 'melcanela', owner: 'doceria@demo.com', ownerName: 'Camila Rocha', name: 'Doceria Mel & Canela', type: 'other', emoji: '🧁',
    address: 'Rua XV de Novembro, 45', neighborhood: 'Jardim Central', opens: '09:00', closes: '20:00', delivery: 1, fee: 400, weight: 0.8,
    description: 'Doces artesanais feitos todos os dias.',
    offers: [
      ['Brigadeiros (caixa com 6)', 'Brigadeiro tradicional de chocolate belga.', 'sweets', '🍫', 'box', 120, 1800, 700, 6, 2, '18:30', '20:00', 'vegetarian,gluten_free', 0],
      ['Cupcakes sortidos (2 unidades)', 'Baunilha e chocolate.', 'sweets', '🧁', 'box', 200, 1600, 600, 6, 2, '18:30', '20:00', 'vegetarian', 0],
      ['Bolo de pote (doação)', 'Sabor ninho com morango.', 'sweets', '🍰', 'unit', 200, 1000, 0, 5, 1, '18:30', '20:00', 'vegetarian', 0],
    ],
  },
];

export const BUYER_FIRST = ['Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina',
  'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Pedro', 'Rafaela', 'Sofia', 'Thiago', 'Vitória', 'Wesley', 'Yasmin', 'Caio',
  'Letícia', 'Matheus', 'Larissa', 'Gustavo', 'Bianca', 'Renan', 'Juliana', 'Davi', 'Helena', 'Igor', 'Natália', 'Otávio'];
export const BUYER_LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho',
  'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Araújo', 'Moura', 'Teixeira', 'Freitas'];
export const NEIGHBORHOODS = ['Centro', 'Jardim Central', 'Vila Nova', 'Setor Oeste', 'Jardim Primavera', 'São José', 'Parque das Águas'];

export const REVIEWS = [
  'Comida ótima e bem servida, nem parecia sobra.',
  'Retirada rápida, o pessoal foi muito atencioso.',
  'Preço excelente. Vou voltar mais vezes.',
  'Chegou quentinha e bem embalada.',
  'A sacola surpresa veio caprichada!',
  'Muito bom poder economizar e ainda evitar desperdício.',
  'Atendimento simpático, recomendo.',
  'Tudo fresquinho, superou a expectativa.',
  'Um pouco de fila na retirada, mas valeu a pena.',
  'Faltou um item, mas resolveram na hora.',
];
