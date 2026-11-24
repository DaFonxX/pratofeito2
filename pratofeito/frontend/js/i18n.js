// Tradução: português (padrão), inglês e espanhol. Sem bibliotecas: dicionário + função t().
export const LANGS = { 'pt-BR': 'Português', en: 'English', es: 'Español' };

export const DICT = {
  'pt-BR': {
    'app.title': 'PratoFeito – comida boa que merece ser comida',
    'a11y.skip': 'Pular para o conteúdo', 'a11y.main': 'Principal', 'a11y.lang': 'Idioma',
    'nav.foods': 'Alimentos', 'nav.cart': 'Carrinho ({n})', 'nav.orders': 'Pedidos', 'nav.panel': 'Painel', 'nav.impact': 'Impacto',
    'nav.logout': 'Sair', 'nav.login': 'Entrar', 'nav.register': 'Criar conta',
    'foot.text': 'PratoFeito · menos desperdício, mais comida na mesa', 'foot.logs': 'Registro de acesso',
    'home.title': 'Comida boa a um passo do vencimento.', 'home.sub': 'Compre com desconto ou retire doações perto de você.',
    'f.search': 'Buscar alimento', 'f.category': 'Categoria', 'f.type': 'Tipo', 'f.all': 'Todas as ofertas',
    'f.discount': 'Com desconto', 'f.donation': 'Doações', 'f.apply': 'Filtrar',
    'p.donation': 'Doação', 'p.free': 'Grátis', 'p.expires': 'vence em {d}', 'p.today': 'Vence hoje', 'p.pickup': 'retirada {p}',
    'p.tbd': 'a combinar', 'p.add': 'Adicionar ao carrinho', 'p.added': 'Adicionado ao carrinho',
    'p.none': 'Nenhum alimento encontrado. Tente outro filtro.', 'p.loading': 'Carregando…',
    'a.login': 'Entre na sua conta', 'a.register': 'Crie sua conta', 'a.type': 'Tipo de conta', 'a.buyer': 'Quero comprar',
    'a.supplier': 'Tenho um estabelecimento', 'a.name': 'Nome', 'a.email': 'E-mail', 'a.password': 'Senha', 'a.pwHint': 'Mínimo de 8 caracteres',
    'a.city': 'Cidade', 'a.address': 'Endereço', 'a.cnpj': 'CNPJ', 'a.estab': 'Tipo de estabelecimento',
    'a.have': 'Já tenho conta', 'a.welcome': 'Bem-vindo(a)!',
    'c.empty': 'Carrinho vazio', 'c.see': 'Veja os alimentos disponíveis', 'c.title': 'Seu carrinho', 'c.remove': 'Remover',
    'c.total': 'Total: {v}', 'c.receipt': 'Recebimento', 'c.pickup': 'Retirar no local', 'c.delivery': 'Entrega',
    'c.addr': 'Endereço de entrega', 'c.checkout': 'Finalizar pedido', 'c.done': 'Pedido realizado!', 'c.dec': 'Diminuir', 'c.inc': 'Aumentar',
    'o.sup': 'Pedidos recebidos', 'o.buyer': 'Meus pedidos', 'o.order': 'Pedido', 'o.items': 'Itens', 'o.total': 'Total', 'o.status': 'Status',
    'o.none': 'Nenhum pedido ainda.', 'o.updated': 'Status atualizado', 'o.aria': 'Status do pedido {n}',
    's.pending': 'Pendente', 's.confirmed': 'Confirmado', 's.ready': 'Pronto', 's.completed': 'Concluído', 's.cancelled': 'Cancelado',
    'd.sup': 'Painel do estabelecimento', 'd.buyer': 'Seu impacto', 'd.saved': 'itens salvos do lixo', 'd.done': 'pedidos concluídos',
    'd.revenue': 'faturado', 'd.spent': 'gasto', 'd.publish': 'Publicar alimento', 'd.category': 'Categoria', 'd.qty': 'Quantidade',
    'd.unit': 'Unidade', 'd.expiry': 'Validade', 'd.orig': 'Preço original (R$)', 'd.price': 'Preço com desconto (R$)', 'd.offer': 'Tipo',
    'd.discount': 'Desconto', 'd.donation': 'Doação', 'd.pickup': 'Horário de retirada', 'd.submit': 'Publicar', 'd.published': 'Produto publicado',
    'd.mine': 'Seus produtos', 'd.inactive': 'Inativo', 'd.off': 'Desativar', 'd.confirm': 'Desativar este produto?',
    'd.export': 'Baixar meus dados (JSON)', 'd.exportHint': 'Cópia de todos os seus dados em formato aberto, para levar para onde quiser.',
    'l.title': 'Registro de acesso', 'l.intro': 'Dados de uso do site. Os endereços IP são anonimizados.', 'l.total': 'acessos registrados',
    'l.today': 'hoje', 'l.errors': 'com erro', 'l.avg': 'ms em média', 'l.users': 'usuários', 'l.products': 'ofertas ativas', 'l.orders': 'pedidos',
    'l.langs': 'Idiomas mais usados', 'l.recent': 'Últimos acessos', 'l.time': 'Quando', 'l.method': 'Método', 'l.path': 'Rota', 'l.ms': 'ms',
    'l.lang': 'Idioma', 'l.csv': 'Baixar CSV', 'l.denied': 'Acesso restrito: abra o site no computador que o hospeda ou informe o token de administrador.',
    'l.token': 'Token de administrador', 'l.enter': 'Ver registros',
    'err.network': 'Não foi possível falar com o servidor.', 'err.invalid': 'Resposta inválida do servidor.', 'err.unknown': 'Erro inesperado.',
  },
  en: {
    'app.title': 'PratoFeito – good food that deserves to be eaten',
    'a11y.skip': 'Skip to content', 'a11y.main': 'Main', 'a11y.lang': 'Language',
    'nav.foods': 'Food', 'nav.cart': 'Cart ({n})', 'nav.orders': 'Orders', 'nav.panel': 'Dashboard', 'nav.impact': 'Impact',
    'nav.logout': 'Log out', 'nav.login': 'Log in', 'nav.register': 'Sign up',
    'foot.text': 'PratoFeito · less waste, more food on the table', 'foot.logs': 'Access log',
    'home.title': 'Good food one step from its expiry date.', 'home.sub': 'Buy at a discount or pick up donations near you.',
    'f.search': 'Search food', 'f.category': 'Category', 'f.type': 'Type', 'f.all': 'All offers',
    'f.discount': 'Discounted', 'f.donation': 'Donations', 'f.apply': 'Filter',
    'p.donation': 'Donation', 'p.free': 'Free', 'p.expires': 'expires {d}', 'p.today': 'Expires today', 'p.pickup': 'pickup {p}',
    'p.tbd': 'to be arranged', 'p.add': 'Add to cart', 'p.added': 'Added to cart',
    'p.none': 'No food found. Try another filter.', 'p.loading': 'Loading…',
    'a.login': 'Log in to your account', 'a.register': 'Create your account', 'a.type': 'Account type', 'a.buyer': 'I want to buy',
    'a.supplier': 'I run an establishment', 'a.name': 'Name', 'a.email': 'Email', 'a.password': 'Password', 'a.pwHint': 'At least 8 characters',
    'a.city': 'City', 'a.address': 'Address', 'a.cnpj': 'CNPJ (Brazilian business ID)', 'a.estab': 'Type of establishment',
    'a.have': 'I already have an account', 'a.welcome': 'Welcome!',
    'c.empty': 'Your cart is empty', 'c.see': 'See available food', 'c.title': 'Your cart', 'c.remove': 'Remove',
    'c.total': 'Total: {v}', 'c.receipt': 'Receiving', 'c.pickup': 'Pick up in store', 'c.delivery': 'Delivery',
    'c.addr': 'Delivery address', 'c.checkout': 'Place order', 'c.done': 'Order placed!', 'c.dec': 'Decrease', 'c.inc': 'Increase',
    'o.sup': 'Orders received', 'o.buyer': 'My orders', 'o.order': 'Order', 'o.items': 'Items', 'o.total': 'Total', 'o.status': 'Status',
    'o.none': 'No orders yet.', 'o.updated': 'Status updated', 'o.aria': 'Status of order {n}',
    's.pending': 'Pending', 's.confirmed': 'Confirmed', 's.ready': 'Ready', 's.completed': 'Completed', 's.cancelled': 'Cancelled',
    'd.sup': 'Establishment dashboard', 'd.buyer': 'Your impact', 'd.saved': 'items saved from the trash', 'd.done': 'completed orders',
    'd.revenue': 'earned', 'd.spent': 'spent', 'd.publish': 'Post food', 'd.category': 'Category', 'd.qty': 'Quantity',
    'd.unit': 'Unit', 'd.expiry': 'Expiry date', 'd.orig': 'Original price (R$)', 'd.price': 'Discounted price (R$)', 'd.offer': 'Type',
    'd.discount': 'Discount', 'd.donation': 'Donation', 'd.pickup': 'Pickup hours', 'd.submit': 'Post', 'd.published': 'Product posted',
    'd.mine': 'Your products', 'd.inactive': 'Inactive', 'd.off': 'Deactivate', 'd.confirm': 'Deactivate this product?',
    'd.export': 'Download my data (JSON)', 'd.exportHint': 'A copy of all your data in an open format, to take wherever you like.',
    'l.title': 'Access log', 'l.intro': 'Site usage data. IP addresses are anonymized.', 'l.total': 'accesses logged',
    'l.today': 'today', 'l.errors': 'with errors', 'l.avg': 'ms on average', 'l.users': 'users', 'l.products': 'active offers', 'l.orders': 'orders',
    'l.langs': 'Most used languages', 'l.recent': 'Latest accesses', 'l.time': 'When', 'l.method': 'Method', 'l.path': 'Route', 'l.ms': 'ms',
    'l.lang': 'Language', 'l.csv': 'Download CSV', 'l.denied': 'Restricted: open the site on the computer that hosts it, or enter the admin token.',
    'l.token': 'Admin token', 'l.enter': 'Show logs',
    'err.network': 'Could not reach the server.', 'err.invalid': 'Invalid server response.', 'err.unknown': 'Unexpected error.',
  },
  es: {
    'app.title': 'PratoFeito – buena comida que merece ser comida',
    'a11y.skip': 'Saltar al contenido', 'a11y.main': 'Principal', 'a11y.lang': 'Idioma',
    'nav.foods': 'Alimentos', 'nav.cart': 'Carrito ({n})', 'nav.orders': 'Pedidos', 'nav.panel': 'Panel', 'nav.impact': 'Impacto',
    'nav.logout': 'Salir', 'nav.login': 'Entrar', 'nav.register': 'Crear cuenta',
    'foot.text': 'PratoFeito · menos desperdicio, más comida en la mesa', 'foot.logs': 'Registro de acceso',
    'home.title': 'Buena comida a un paso del vencimiento.', 'home.sub': 'Compra con descuento o recoge donaciones cerca de ti.',
    'f.search': 'Buscar alimento', 'f.category': 'Categoría', 'f.type': 'Tipo', 'f.all': 'Todas las ofertas',
    'f.discount': 'Con descuento', 'f.donation': 'Donaciones', 'f.apply': 'Filtrar',
    'p.donation': 'Donación', 'p.free': 'Gratis', 'p.expires': 'vence el {d}', 'p.today': 'Vence hoy', 'p.pickup': 'recogida {p}',
    'p.tbd': 'a convenir', 'p.add': 'Añadir al carrito', 'p.added': 'Añadido al carrito',
    'p.none': 'No se encontraron alimentos. Prueba otro filtro.', 'p.loading': 'Cargando…',
    'a.login': 'Entra en tu cuenta', 'a.register': 'Crea tu cuenta', 'a.type': 'Tipo de cuenta', 'a.buyer': 'Quiero comprar',
    'a.supplier': 'Tengo un establecimiento', 'a.name': 'Nombre', 'a.email': 'Correo electrónico', 'a.password': 'Contraseña', 'a.pwHint': 'Mínimo 8 caracteres',
    'a.city': 'Ciudad', 'a.address': 'Dirección', 'a.cnpj': 'CNPJ (identificación fiscal de Brasil)', 'a.estab': 'Tipo de establecimiento',
    'a.have': 'Ya tengo cuenta', 'a.welcome': '¡Bienvenido(a)!',
    'c.empty': 'Carrito vacío', 'c.see': 'Ver los alimentos disponibles', 'c.title': 'Tu carrito', 'c.remove': 'Quitar',
    'c.total': 'Total: {v}', 'c.receipt': 'Recepción', 'c.pickup': 'Recoger en el local', 'c.delivery': 'Entrega',
    'c.addr': 'Dirección de entrega', 'c.checkout': 'Finalizar pedido', 'c.done': '¡Pedido realizado!', 'c.dec': 'Disminuir', 'c.inc': 'Aumentar',
    'o.sup': 'Pedidos recibidos', 'o.buyer': 'Mis pedidos', 'o.order': 'Pedido', 'o.items': 'Artículos', 'o.total': 'Total', 'o.status': 'Estado',
    'o.none': 'Aún no hay pedidos.', 'o.updated': 'Estado actualizado', 'o.aria': 'Estado del pedido {n}',
    's.pending': 'Pendiente', 's.confirmed': 'Confirmado', 's.ready': 'Listo', 's.completed': 'Completado', 's.cancelled': 'Cancelado',
    'd.sup': 'Panel del establecimiento', 'd.buyer': 'Tu impacto', 'd.saved': 'artículos salvados de la basura', 'd.done': 'pedidos completados',
    'd.revenue': 'facturado', 'd.spent': 'gastado', 'd.publish': 'Publicar alimento', 'd.category': 'Categoría', 'd.qty': 'Cantidad',
    'd.unit': 'Unidad', 'd.expiry': 'Vencimiento', 'd.orig': 'Precio original (R$)', 'd.price': 'Precio con descuento (R$)', 'd.offer': 'Tipo',
    'd.discount': 'Descuento', 'd.donation': 'Donación', 'd.pickup': 'Horario de recogida', 'd.submit': 'Publicar', 'd.published': 'Producto publicado',
    'd.mine': 'Tus productos', 'd.inactive': 'Inactivo', 'd.off': 'Desactivar', 'd.confirm': '¿Desactivar este producto?',
    'd.export': 'Descargar mis datos (JSON)', 'd.exportHint': 'Una copia de todos tus datos en formato abierto, para llevarla donde quieras.',
    'l.title': 'Registro de acceso', 'l.intro': 'Datos de uso del sitio. Las direcciones IP se anonimizan.', 'l.total': 'accesos registrados',
    'l.today': 'hoy', 'l.errors': 'con error', 'l.avg': 'ms de media', 'l.users': 'usuarios', 'l.products': 'ofertas activas', 'l.orders': 'pedidos',
    'l.langs': 'Idiomas más usados', 'l.recent': 'Últimos accesos', 'l.time': 'Cuándo', 'l.method': 'Método', 'l.path': 'Ruta', 'l.ms': 'ms',
    'l.lang': 'Idioma', 'l.csv': 'Descargar CSV', 'l.denied': 'Acceso restringido: abre el sitio en el equipo que lo aloja o introduce el token de administrador.',
    'l.token': 'Token de administrador', 'l.enter': 'Ver registros',
    'err.network': 'No se pudo conectar con el servidor.', 'err.invalid': 'Respuesta no válida del servidor.', 'err.unknown': 'Error inesperado.',
  },
};

const KEY = 'pf_lang';
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
function detect() {
  const saved = store()?.getItem(KEY);
  if (saved && saved in DICT) return saved;
  const n = String(globalThis.navigator?.language || 'pt').toLowerCase();
  return n.startsWith('en') ? 'en' : n.startsWith('es') ? 'es' : 'pt-BR';
}
let lang = detect();

export const translate = (l, key, vars = {}) =>
  String(DICT[l]?.[key] ?? DICT['pt-BR'][key] ?? key).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
export const t = (key, vars) => translate(lang, key, vars);
export const getLang = () => lang;
export const locale = () => ({ 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES' })[lang];
export function setLang(l) {
  if (!(l in DICT)) return;
  lang = l;
  try { store()?.setItem(KEY, l); } catch { /* sem armazenamento: vale só nesta visita */ }
  globalThis.document?.dispatchEvent(new Event('lang:change'));
}
