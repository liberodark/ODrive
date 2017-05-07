const router = require("express").Router();

router.get('/', (req, res) => {
  res.render('initial');
});

module.exports = router;