const assert = require('assert');
const path = require("path");
const fs = require("fs-extra");
const mkdirp = require("mkdirp-promise");
const delay = require("delay");
const globals = require('../../config/globals');

let fileInfoFields = "id, name, mimeType, md5Checksum, size, modifiedTime, parents";
let listFilesFields = `nextPageToken, files(${fileInfoFields})`;
let changeInfoFields = `time, removed, fileId, file(${fileInfoFields})`;
let changesListFields = `nextPageToken, newStartPageToken, changes(${changeInfoFields})`;

class Sync {
  constructor(account) {
    this.account = account;
    this.fileInfo = {"root": {id: "root", name: "root"}};
    this.changeToken = null;
    this.loaded = false;
    this.watchingChanges = false;

    /* Check if already in memory */
    this.load();
  }

  get running() {
    return "id" in this;
  }

  get drive() {
    return this.account.drive;
  }

  get folder() {
    return this.account.folder;
  }

  async start(notifyCallback) {
    await this.finishLoading();

    assert(!this.syncing, "Sync already in progress");
    this.syncing = true;

    try {
      let notify = notifyCallback || (() => {});

      notify("Watching changes in the remote folder...");
      await this.startWatchingChanges();

      notify("Getting files info...");

      await this.downloadFolderStructure();

      let counter = 0;
      let ignored = 0;

      for (let file of Object.values(this.fileInfo)) {
        if (!("size" in file)) {
          /* Not a stored file, no need...
            Will handle google docs later.
          */
          ignored += 1;

          notify(`${counter} files downloaded, ${ignored} files ignored...`);
          continue;
        }

        console.log("Downloading ", file);
        counter +=1;
        await this.downloadFile(file);
        notify(`${counter} files downloaded, ${ignored} files ignored...`);
      }

      notify(`All done! ${counter} files downloaded and ${ignored} ignored.`);
      this.syncing = false;

      await this.save();
    } catch (err) {
      this.syncing = false;
      throw err;
    }
  }

  async startWatchingChanges() {
    await this.finishLoading();

    if (this.changeToken) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.drive.changes.getStartPageToken({}, (err, res) => {
        if (err) {
          return reject(err);
        }
        console.log("Start token for watching changes: ", res.startPageToken);

        /* Make sure a parallel execution didn't get another token first. Once we've got a token, we stick with it */
        if (!this.changeToken) {
          this.changeToken = res.startPageToken;
        }

        resolve(res);
      });
    });
  }

  /* Continuously watch for new changes and apply them */
  async watchChanges() {
    await this.finishLoading();

    /* Make sure only one instance of this function is running. Love that nodejs is asynchronous but runs on one thread, atomicity is guaranteed */
    if (this.watchingChanges) {
      return;
    }
    this.watchingChanges = true;

    try {
      if (!this.changeToken) {
        console.error("Error in application flow, no valid change token");
        await this.startWatchingChanges();
      }

      while (1) {
        await this.handleNewChanges();
        await delay(10000);
      }
    } catch (err) {
      this.watchingChanges = false;
      throw err;
    }
  }

  async handleNewChanges() {
    let changes = await this.getNewChanges();

    for (let change of changes) {
      await this.handleChange(change);
    }

    if (changes.length > 0) {
      await this.save();
    }
  }

  async handleChange(change) {
    /* Todo */
    console.log("Change", change);
  }

  async getNewChanges() {
    let changes = [];
    let pageToken = this.changeToken;

    while (pageToken) {
      let result = await new Promise((resolve, reject) => {
        this.drive.changes.list({
          corpora: "user",
          spaces: "drive",
          pageSize: 1000,
          pageToken,
          restrictToMyDrive: true,
          fields: changesListFields
        }, (err, res) => {
          if (err) {
            return reject(err);
          }
          resolve(res);
        });
      });

      pageToken = result.nextPageToken;
      changes = changes.concat(result.changes);

      if (result.newStartPageToken) {
        this.changeToken = result.newStartPageToken;
      }
    }

    return changes;
  }

  async downloadFolderStructure(folder) {
    await this.finishLoading();

    /* Try avoiding triggering antispam filters on Google's side, given the quantity of data */
    await delay(100);

    console.log("Downloading folder structure for ", folder);
    let files = await this.folderContents(folder);

    for (let file of files) {
      if (file.mimeType.includes("folder")) {
        await this.downloadFolderStructure(file.id);
      }
    }
  }

  async folderContents(folder) {
    await this.finishLoading();

    folder = folder || "root";

    let {nextPageToken, files} = await this.folderChunk({folder});

    console.log(files, nextPageToken);
    console.log("(Chunk 1)");

    let counter = 1;
    while(nextPageToken) {
      /* Try avoiding triggering antispam filters on Google's side, given the quantity of data */
      await delay(500);

      let data = await this.folderChunk({pageToken: nextPageToken, folder});
      nextPageToken = data.nextPageToken;
      files = files.concat(data.files);

      counter += 1;
      console.log(data);
      console.log(`(Chunk ${counter})`, nextPageToken);
    }

    console.log("Files list done!");
    this.fileInfo[folder].children = files;

    return files;
  }

  async folderChunk(arg) {
    await this.finishLoading();

    let {pageToken, folder} = arg;

    if (!folder) {
      folder = "root";
    }

    let result = await new Promise((resolve, reject) => {
      let args = {
        fields: listFilesFields,
        corpora: "user",
        spaces: "drive",
        pageSize: 1000,
        q: `trashed = false and "${folder}" in parents` //Receiving unwanted files, so this!
      };

      if (pageToken) {
        args.pageToken = pageToken;
      }
      console.log("Getting files chunk", args);
      this.drive.files.list(args, (err, result) => {
        if (err) {
          return reject(err);
        }

        resolve(result);
      });
    });

    /* Own folder structure to overwrite googledrive's shaky structure... */
    for (let file of result.files) {
      if (file.id in this.fileInfo) {
        this.fileInfo[file.id].computedParents.push(folder);
      } else {
        this.fileInfo[file.id] = file;
        file.computedParents = [folder];
      }
    }

    return result;
  }

  async getPaths(fileInfo) {
    console.log('Get path', fileInfo.name);
    if (fileInfo.id == "root") {
      return [this.folder];
    }
    if (!fileInfo.computedParents) {
      console.log("File out of the main folder structure", fileInfo);
      return [];
    }

    let ret = [];

    for (let parent of fileInfo.computedParents) {
      let parentInfo = await this.getFileInfo(parent);
      for (let parentPath of await this.getPaths(parentInfo)) {
        ret.push(path.join(parentPath, fileInfo.name));
      }
    }

    return ret;
  }

  /* Gets file info from fileId.

    If the file info is not present in cache or if forceUpdate is true,
    it seeks the information remotely and updates the cache as well. */
  async getFileInfo(fileId, forceUpdate) {
    await this.finishLoading();

    console.log("Getting individual filed info: ", fileId);
    if (!forceUpdate && (fileId in this.fileInfo)) {
      return this.fileInfo[fileId];
    }

    let fileInfo = await new Promise((resolve, reject) => {
      this.drive.files.get({fileId, fields: fileInfoFields}, (err, result) => {
        if (err) {
          return reject(err);
        }
        resolve(result);
      });
    });

    return this.replaceFileInfo(fileInfo);
  }

  /* Keep in mind the folder structure when updating file info */
  replaceFileInfo(info) {
    let oldInfo = this.fileInfo[info.id];
    if (oldInfo) {
      if (oldInfo.computedParents) {
        info.computedParents = oldInfo.computedParents;
      }
      if (oldInfo.children) {
        info.children = oldInfo.children;
      }
    }

    return this.fileInfo[info.id] = info;
  }

  async downloadFile(fileInfo) {
    await this.finishLoading();

    let savePaths = await this.getPaths(fileInfo);

    if (savePaths.length == 0) {
      return;
    }
    let savePath = savePaths.splice(0, 1)[0];

    /* Create the folder for the file first */
    await mkdirp(path.dirname(savePath));

    var dest = fs.createWriteStream(savePath);

    await new Promise((resolve, reject) => {
      this.drive.files.get({fileId: fileInfo.id, alt: "media"})
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .pipe(dest);
    });

    for (let otherPath of savePaths) {
      await fs.copy(savePath, otherPath);
    }
  }

  async finishLoading() {
    while (!this.loaded) {
      await delay(20);
    }
  }

  /* Load in NeDB */
  async load() {
    let obj = await globals.db.findOne({type: "sync", accountId: this.account.id});

    if (obj) {
      this.changeToken = obj.changeToken;
      this.fileId = obj.fileInfo;
      this.id = obj._id;
    }

    this.loaded = true;

    this.watchChanges();
  }

  /* Save in NeDB, overwriting previous entry */
  async save() {
    await this.finishLoading();

    if (!this.id) {
      //Create new object
      let obj = await globals.db.insert({type: "sync", accountId: this.account.id});
      this.id = obj._id;
    }

    /* Save object */
    let saveObject = {
      type: "sync",
      accountId: this.account.id,
      changeToken: this.changeToken,
      fileInfo: this.fileInfo,
      _id: this.id
    };

    await globals.db.update({_id: this.id}, saveObject, {});

    this.watchChanges();
  }
}

module.exports = Sync;
