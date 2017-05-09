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

async function getAccounts() {
  if (accounts !== null) {
    return accounts;
  }

  let documents = await db.find({type: "account"});
  accounts = [];

  for (let doc of documents) {
    accounts.push(new Account(doc));
  }

  return accounts;
}

function addAccount(account) {
  accounts.push(account);
}

module.exports = {
  accounts: getAccounts,
  addAccount
};
