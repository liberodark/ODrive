const os = require('os');
const Account = require('../core/account');
const router = require("express").Router();
const gbs = require('../../config/globals');
const core = require('../core');
const ipc = require('electron').ipcMain;

const baseSize = os.platform() === "win32" ? 330 : 270;

router.get('/settings', async (req, res) => {
  let accounts = await core.accounts();

  res.render('settings', {accounts});

  /* Hack to set frontend to proper height */
  gbs.win.setSize(650, baseSize+80*Math.max(accounts.length,0.5));
});

router.get('/connect', (req, res) => {
  let account = new Account();
  res.redirect(account.authUrl);
});

router.get('/add', (req, res) => {
  res.send("Multiple accounts not yet supported");
});

router.get('/delete/:id', async (req, res) => {
  let account = await core.getAccountById(req.params.id);
  await core.removeAccount(account);

  res.redirect('/settings');
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

ipc.on('permanently-delete-setting', async (event, { accountId, permanentlyDeleteSetting}) => {
  /* Shortcut to web IPC. Does not use 'event.sender' as it can be closed and reopened */
  let web = () => {
    if (gbs.win) {
      return gbs.win.webContents;
    } else {
      return { send: () => { } };
    }
  };

  try {
    let account = await core.getAccountById(accountId);
    account.permanentlyDeleteSetting = permanentlyDeleteSetting;
    await account.save();
  } catch (err) {
    console.error(err);
    web().send('error', err.message);
  }
});

ipc.on('start-sync', async (event, {accountId, folder}) => {
  /* Shortcut to web IPC. Does not use 'event.sender' as it can be closed and reopened */
  let web = () => {
    if (gbs.win) {
      return gbs.win.webContents;
    } else {
      return { send: () => { } };
    }
  };
  
  try {
    let account = await core.getAccountById(accountId);
    account.folder = folder;
    await account.save();
    await account.sync.start(update => web().send("sync-update", {accountId, update}));
    web().send('sync-end');
  } catch (err) {
    console.error(err);

    web().send('error', err.message);
    /* If synchronization didn't go through to the end, we enable the user to do it again */
    web().send('sync-enable', err.message);
  }
});

module.exports = router;
