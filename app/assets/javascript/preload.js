/* Fool common modules (such as jquery) to think this is not a node environment.
  Avoids trouble with webpack and makes possible for the app to easily be ported on browser */
if (typeof module === 'object') {
  module = undefined; // eslint-disable-line no-global-assign
}
