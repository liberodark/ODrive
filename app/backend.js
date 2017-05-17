const path = require("path");
/* Express stuff */
const express = require('express');
const bodyParser = require('body-parser');
const isConnectionError = require('./modules/isconnectionerror');

/* Local stuff */
const router = require('./routes/index');

var app = express();

const port = require('../config/globals').port;

app.set('view engine', 'ejs');
/* Needed because of packager, wouldn't find the views directory otherwise */
app.set('views', path.join(__dirname, '../', 'views'));

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
process.on('unhandledRejection', async (error) => {
  // Will print "unhandledRejection err is not defined"
  console.error('Unhandled rejection')
  console.error(error);

  if (isConnectionError(error)) {
    if (error.syncObject && error.watcher) {
      console.log("Connection error when watching changes, restarting in 10 seconds");
      setTimeout(() => error.syncObject.load(), 10000);
    }
  }
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception', error);
  if(error.errno === 'EADDRINUSE') {
    console.error('Make sure that another instance of OpenDrive is not running.');
    return process.exit(1);
  }

  if (isConnectionError(error)) {
    if (error.syncObject && error.watcher) {
      console.log("Connection error when watching changes, restarting in 10 seconds");
      setTimeout(() => error.syncObject.load(), 10000);
    }
  }
});

module.exports = {
  port
};
