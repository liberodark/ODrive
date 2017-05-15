/* global $ */
const ipc = require('electron').ipcRenderer;

// eslint-disable-next-line no-unused-vars
function beginSynchronization(account) {
  console.log(account);

  $("#synchronize-icon").removeClass();
  $("#synchronize-icon").addClass("fa fa-refresh fa-spin");
  $("#synchronize-text").text('Synchronizing...');

  ipc.send('start-sync', {accountId:account.id});
}

ipc.on('sync-update', ({sender}, arg) => {
  console.log(arg);
  let {/* accountId, */ update} = arg;
  $("#synchronize-status").text(update);
});

ipc.on('sync-end', () => {
  $("#synchronize-icon").removeClass();
  $("#synchronize-icon").addClass("fa fa-download");
  $("#synchronize-text").text('Synchronize');
  $("#synchronize-button").prop("disabled", true);
});

ipc.on('sync-enable', () => {
  $("#synchronize-icon").removeClass();
  $("#synchronize-icon").addClass("fa fa-download");
  $("#synchronize-text").text('Synchronize');
  $("#synchronize-button").prop("disabled", false);
});

ipc.on('error', ({sender}, message) => {
  console.log(message);
  $("#synchronize-status").text('Error: ' + message);
});
