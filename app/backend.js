const path = require("path");
/* Express stuff */
const express = require('express');
const bodyParser = require('body-parser');

/* Local stuff */
const router = require('./routes/index');

var app = express();

const port = process.env.port || 16409;

app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

for (let middleware of require("./modules/middlewares")) {
  app.use(middleware);
}

app.use("/", express.static(path.join(__dirname, "..", 'public')));
app.use("/", router);

console.log(path.join(__dirname, "..", 'public'));

async function listen() {
  try {
    let promise = new Promise(resolve => {
      app.listen(port, 'localhost', () => {resolve();});
    });

    await promise;

    console.log("app started on port", port);
  } catch(err) {
    console.log(err);
  }
}

listen();

/* Handle error */
process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.error(error);
});

module.exports = {
  port
};
