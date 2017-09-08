module.exports = {
  debug: function() {
    //console.log.apply(console, arguments);
  },
  verbose: function() {
    //console.log.apply(console, arguments);
  },
  log: function() {console.log.apply(console, arguments);},
  error: function() {console.error.apply(console, arguments);}
};
