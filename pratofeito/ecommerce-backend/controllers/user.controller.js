const User = require('../models/User'), Order = require('../models/Order'), Product = require('../models/Product');
exports.me = async (req, res, next) => {
  try { const u = await User.findById(req.user.sub); if (!u) return res.status(404).json({ success: false, error: 'Usuário não encontrado.' }); res.json({ success: true, data: u }); }
  catch (e) { next(e); }
};
// Portabilidade de dados: cópia de tudo que o sistema guarda sobre a pessoa, em JSON aberto.
exports.export = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    const supplier = user.type === 'supplier';
    const [orders, products] = await Promise.all([supplier ? Order.bySupplier(user.id) : Order.byBuyer(user.id), supplier ? Product.bySupplier(user.id) : []]);
    res.json({ success: true, data: { exported_at: new Date().toISOString(), user, products, orders } });
  } catch (e) { next(e); }
};
