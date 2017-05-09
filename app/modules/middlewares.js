const pjson = require('../../package.json');

function defaultLocals (req, res, next) {
  try {
    /* For css cache busting */
    res.locals.version = pjson.version;
    next();
  } catch(err) {
    next(err);
  }
}

module.exports = [defaultLocals];