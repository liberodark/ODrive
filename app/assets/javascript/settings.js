/* global $ */
const ipc = require('electron').ipcRenderer;

// eslint-disable-next-line no-unused-vars
function beginSynchronization(account) {
  console.log(account);

  UIBeginSyncing();

  ipc.send('start-sync', {accountId:account.id, folder: account.folder});
}

function UIBeginSyncing() {
  $("#synchronize-icon").removeClass();
  $("#synchronize-icon").addClass("fa fa-refresh fa-spin");
  $("#synchronize-text").text('Synchronizing...');
}

/* React to folder change. Only change folder in current window, will send to backend when beginning synchronization */
// eslint-disable-next-line no-unused-vars
function handleUIChangeFolder(account) {
  let files = $("#file").prop("files");
  if (!files || files.length == 0) {
    return;
  }

  let path = files[0].path;
  $("#filePath").text(path);
  account.folder = path;
}

// eslint-disable-next-line no-unused-vars
ipc.on('sync-update', ({sender}, arg) => {
  console.log(arg);
  let { update } = arg;
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

// eslint-disable-next-line no-unused-vars
ipc.on('error', ({sender}, message) => {
  console.log(message);
  $("#synchronize-status").text('Error: ' + message);
});
