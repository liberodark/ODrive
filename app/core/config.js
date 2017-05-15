const os = require('os');
const path = require('path');

const Account = require('./account');
const DataStore = require('nedb-promise');
const globals = require('../../config/globals');

let accounts = null;
let db = new DataStore({
  filename: path.join(os.homedir(), ".config/odrive/db", "global.db"),
  autoload: true
});

globals.db = db;

//Autocompaction, since nedb-promise doesn't let us access it immediately
setInterval(() => db.loadDatabase(), 30000);

async function getAccounts() {
  if (accounts !== null) {
    return accounts;
  }

  let documents = await db.find({type: "account"});
  accounts = [];

  for (let doc of documents) {
    accounts.push(new Account(doc));
  }

  for (let account of accounts) {
    await account.finishLoading();
  }

  return accounts;
}

async function getAccountById(id) {
  let accounts = await getAccounts();

  for (let account of accounts) {
    if (account.id == id) {
      return account;
    }
  }

  return null;
}

function addAccount(account) {
  accounts.push(account);
}

module.exports = {
  accounts: getAccounts,
  addAccount,
  accountById: getAccountById
};
