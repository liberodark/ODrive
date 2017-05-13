const router = require("express").Router();
const config = require('../core/config');

router.get('/', async (req, res) => {
  /* Redirect to options if there's at least one account */
  let accounts = await config.accounts();

  console.log("Number of accounts", accounts.length);

  if (accounts.length > 0) {
    return res.redirect("/settings");
  }

  /* Display starting page */
  res.render('initial');
});

router.use('/', require('./settings'));

module.exports = router;
