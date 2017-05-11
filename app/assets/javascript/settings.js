const ipc = require('electron').ipcRenderer

function beginSynchronization(account) {
  console.log(account);

  $("#synchronize-icon").removeClass();
  $("#synchronize-icon").addClass("fa fa-refresh fa-spin");
  $("#synchronize-text").text('Synchronizing...');

  ipc.send(account.document._id, 'start-sync');
}
