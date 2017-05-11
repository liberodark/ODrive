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
    console.error(err);
    process.exit(1);
  }
}

listen();

/* Handle error */
process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.error('Unhandled rejection', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception', error);
  if(error.errno === 'EADDRINUSE') {
    console.error('Make sure that another instance of OpenDrive is not running.');
    process.exit(1);
  }
});

module.exports = {
  port
};
