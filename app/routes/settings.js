const Account = require('../core/account');
const router = require("express").Router();
const gbs = require('../../config/globals');
const core = require('../core');
const ipc = require('electron').ipcMain;

router.get('/settings', async (req, res) => {
  let accounts = await core.accounts();

  res.render('settings', {accounts});

  /* Hack to set frontend to proper height */
  gbs.win.setSize(600, 270+80*Math.max(accounts.length,0.5));
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
    core.addAccount(account);

    res.redirect("/settings");
  } catch(err) {
    next(err);
  }
});

ipc.on('start-sync', async ({sender}, {accountId}) => {
  try {
    let account = await core.getAccountById(accountId);
    await account.sync.start(update => sender.send("sync-update", {accountId, update}));
    sender.send('sync-end');
  } catch (err) {
    console.error(err);
    sender.send('error', err.message);
    /* If synchronization didn't go through to the end, we enable the user to do it again */
    sender.send('sync-enable');
  }
});

module.exports = router;
