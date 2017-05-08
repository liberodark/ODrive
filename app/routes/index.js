const router = require("express").Router();

router.get('/', (req, res) => {
  res.render('initial');
});

router.use('/', require('./settings'));

module.exports = router;