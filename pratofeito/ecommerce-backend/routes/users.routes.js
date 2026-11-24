const r = require('express').Router(), { authenticate } = require('../middlewares/auth.middleware'), c = require('../controllers/user.controller');
r.get('/me', authenticate, c.me);
r.get('/me/export', authenticate, c.export);
module.exports = r;
