module.exports = {
  debug: function() {
  },
  verbose: function() {
  },
  log: function() {console.log.apply(console, arguments);},
  error: function() {console.error.apply(console, arguments);}
};
