const Account = require('../core/account');
const router = require("express").Router();
const gbs = require('../../config/globals');
const config = require('../core/config');

router.get('/settings', async (req, res) => {
  let accounts = await config.accounts();

  res.render('settings', {accounts});
  gbs.win.setSize(600,Math.min(360+80*accounts.length, 500));
});

router.get('/connect', (req, res) => {
  let account = new Account();
  res.redirect(account.authUrl);
});

router.get('/add', (req, res) => {
  res.send("Multiple accounts not yet supported");
});

router.get('/authCallback', async (req, res, next) => {
  try {
    let code = req.query.code;

    let account = new Account();

    await account.handleCode(code);
    config.addAccount(account);

    res.redirect("/settings");
  } catch(err) {
    next(err);
  }
});

module.exports = router;
