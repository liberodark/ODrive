const router = require("express").Router();
const gbs = require('../../config/globals');

router.get('/settings', (req, res) => {
  res.render('settings');
  gbs.win.setSize(600,360);
});

module.exports = router;