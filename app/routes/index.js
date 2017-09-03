const router = require("express").Router();
const core = require('../core');

router.get('/', async (req, res) => {
  console.log("Get home page");
  /* Redirect to options if there's at least one account */
  let accounts = await core.accounts();

  console.log("Number of accounts", accounts.length);

  if (accounts.length > 0) {
    return res.redirect("/settings");
  }

  /* Display starting page */
  res.render('initial');
});

router.use('/', require('./settings'));

module.exports = router;
