const Account = require('../core/account');
const router = require("express").Router();
const gbs = require('../../config/globals');
const config = require('../core/config');

router.get('/settings', async (req, res) => {
  let accounts = await config.accounts();

  res.render('settings', {accounts});
  gbs.win.setSize(600,360);
});

router.get('/connect', (req, res) => {
  let account = new Account();
  res.redirect(account.authUrl);
});

router.get('/authCallback', (req, res) => {
  /* ToDo: deal with it */
  res.send('Authentification response received: ' + JSON.stringify(req.query));
});

module.exports = router;
