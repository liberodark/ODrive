const globals = require('../../config/globals');
const google = require('googleapis');
const drive = google.drive('v3');
const OAuth2 = google.auth.OAuth2;

const toSave = ["email", "about", "tokens"];

class Account {
  constructor(doc) {
    if (doc) {
      this.load(doc);
    }
    this.oauth = new OAuth2(globals.api, globals.secret, "http://odrive.io/authCallback");
    if (this.tokens) {
      this.onTokensReceived(this.tokens);
    }
  }

  /* Get url to redirect to in order to authenticate */
  get authUrl() {
    console.log("Generating oauth url");
    return this.oauth.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',

      // If you only need one scope you can pass it as a string
      scope: 'https://www.googleapis.com/auth/drive',

      // Optional property that passes state parameters to redirect URI
      // state: { foo: 'bar' }
    });
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
      /*
        https://developers.google.com/drive/v3/reference/about/get
        https://developers.google.com/drive/v3/web/migration
      */
      this.drive.about.get({q: "user.me == true", fields: "user"}, (err, about) => {
        console.log("User info", about);

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
    let doc = this.document || {};

    for (let element of toSave) {
      if (element in this) {
        doc[element] = this[element];
      }
    }

    if (this.document) {
      return globals.db.update({_id: doc._id}, doc, {});
    } else {
      doc.type = "account";
      this.document = await globals.db.insert(doc);
    }
  }

  load(doc) {
    this.document = doc;

    for (let element of toSave) {
      if (element in doc) {
        this[element] = doc[element];
      }
    }
    this.email = doc.email;
    this.tokens = doc.tokens;
  }

  onTokensReceived(tokens) {
    console.log("Auth tokens", tokens);
    this.tokens = tokens;

    this.oauth.setCredentials(tokens);
    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth
    });

    return this.updateUserInfo();
  }
}

module.exports = Account;
