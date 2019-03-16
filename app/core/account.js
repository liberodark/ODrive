const path = require('path');
const os = require('os');
const google = require('googleapis');
const EventEmitter = require('events');

const Sync = require('./sync');
const globals = require('../../config/globals');
const OAuth2 = google.auth.OAuth2;

const toSave = ["email", "about", "tokens", "folder", "saveTime"];

class Account extends EventEmitter {
  constructor(doc) {
    super();
    if (doc) {
      this.load(doc);
      this.previousSaveTime = doc.saveTime || Date.now();
    }
    this.folder = this.folder || path.join(os.homedir(), "Google Drive");
    this.oauth = new OAuth2(
      globals.api,
      globals.secret,
      `http://127.0.0.1:${globals.port}/authCallback`
    );
    if (this.tokens) {
      this.onTokensReceived(this.tokens);
    }
  }

  /* Get url to redirect to in order to authenticate */
  get authUrl() {
    console.log("Generating oauth url");
    return this.oauth.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/drive',
    });
  }

  get running() {
    return !!(this.sync && this.sync.running);
  }

  /* Handle response code from authentification for google oauth */
  handleCode(code) {
    console.log("Handling authentification code");
    return new Promise((resolve, reject) => {
      this.oauth.getToken(code, (err, tokens) => {
        if (err) {
          return reject(err);
        }

        this.onTokensReceived(tokens).then(resolve, reject);
      });
    });
  }

  /* Update user info (email, storage etc.) using oauth tokens */
  updateUserInfo() {
    console.log("Updating account info");
    return new Promise((resolve, reject) => {
      this.drive.about.get({q: "user.me == true", fields: "user"}, (err, about) => {
        //console.log("User info", about);

        if (err) {
          return reject(err);
        }

        this.about = about;
        this.email = about.user.emailAddress;

        this.save().then(resolve, reject);
      });
    });
  }

  /* Save the data to database */
  async save() {
    console.log("Saving account to db");
    this.saveTime = Date.now();
    let doc = this.document || {};

    for (let element of toSave) {
      if (element in this) {
        doc[element] = this[element];
      }
    }

    if (this.document) {
      await globals.db.update({_id: doc._id}, doc, {});
    } else {
      doc.type = "account";
      this.document = await globals.db.insert(doc);
      this.id = this.document._id;
    }

    console.log("Saved account!");
  }

  async erase() {
    console.log("Removing account from db");
    if (this.sync) {
      await this.sync.erase();
      this.sync = null;
      globals.updateSyncing(false);
    }
    if (this.id) {
      await globals.db.remove({_id: this.id});
    }
  }

  load(doc) {
    this.document = doc;

    for (let element of toSave) {
      if (element in doc) {
        this[element] = doc[element];
      }
    }

    this.id = doc._id;
  }

  async finishLoading() {
    if (this.sync) {
      await this.sync.finishLoading();
    }
  }

  onTokensReceived(tokens) {
    this.tokens = tokens;

    this.oauth.setCredentials(tokens);
    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth
    });
    this.sync = new Sync(this);
    this.watchChanges(this.sync);

    return this.updateUserInfo();
  }

  watchChanges(syncObject) {
    syncObject.on('syncing', syncing => globals.updateSyncing(syncing));
    syncObject.on('filesChanged', (changes) => this.emit("filesChanged", changes));
  }
}

module.exports = Account;
