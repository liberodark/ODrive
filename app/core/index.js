const os = require('os');
const path = require('path');
const EventEmitter = require('events');

const Account = require('./account');
const DataStore = require('nedb-promise');
const globals = require('../../config/globals');

let accounts = null;
let db = new DataStore({
  filename: path.join(os.homedir(), ".config/odrive/db", "global2.db"),
  autoload: true
});

globals.db = db;

//Autocompaction, since nedb-promise doesn't let us access it immediately
setInterval(() => db.loadDatabase(), 30000);

class Core extends EventEmitter {
  constructor() {
    super();
  }

  async accounts() {
    if (accounts !== null) {
      return accounts;
    }

    if (globals.args && globals.args['clear']) {
      await db.remove({ }, { multi: true });
      await db.loadDatabase();
    }

    let documents = await db.find({type: "account"});
    accounts = [];

    for (let doc of documents) {
      accounts.push(new Account(doc));
    }

    for (let account of accounts) {
      await account.finishLoading();
      account.on("filesChanged", (changes) => this.handleChanges(changes));
    }

    return accounts;
  }

  async getAccountById(id) {
    let accounts = await this.accounts();

    for (let account of accounts) {
      if (account.id == id) {
        return account;
      }
    }

    return null;
  }

  addAccount(account) {
    accounts.push(account);
    account.on("filesChanged", (changes) => this.handleChanges(changes));
  }

  /* Compile changes and send a notification to electron */
  handleChanges(changes) {
    let arr = [];

    for (let key of Object.keys(changes)) {
      let number = changes[key];
      if (number == 1) {
        arr.push(`${number} file ${key}`);
      } else {
        arr.push(`${number} files ${key}`);
      }
    }

    let fullText = arr.join(', ') + ".";

    console.log("notification", fullText);
    this.emit("notification", fullText);
  }

  launch() {

  }
}

let coreObject = new Core();

module.exports = coreObject;
