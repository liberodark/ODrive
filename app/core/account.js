const globals = require('../../config/globals');
const google = require('googleapis');
const OAuth2 = google.auth.OAuth2;

class Account {
  constructor(doc) {
    if (doc) {
      this.email = doc.email;
      this.tokens = doc.tokens;
    }
    this.oauth = new OAuth2(globals.api, globals.secret, "http://odrive.io/authCallback");
  }

  get authUrl() {
    return this.oauth.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',

      // If you only need one scope you can pass it as a string
      scope: 'https://www.googleapis.com/auth/drive',

      // Optional property that passes state parameters to redirect URI
      // state: { foo: 'bar' }
    });
  }
}

module.exports = Account;
