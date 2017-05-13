const assert = require('assert');
const path = require("path");
const fs = require("fs-extra");
const mkdirp = require("mkdirp-promise");
const delay = require("delay");
const unique = require("array-unique");
const globals = require('../../config/globals');

let fileInfoFields = "id, name, mimeType, md5Checksum, size, modifiedTime, parents, trashed";
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
        if (this.shouldIgnoreFile(file)) {
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
        console.error(new Error("Error in application flow, no valid change token"));
        await this.startWatchingChanges();
      }

      while (1) {
        /* Don't handle changes at the same time as syncing... */
        if (!this.syncing) {
          await this.handleNewChanges();
        }
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

    /* Deleted file */
    if (change.removed || change.file.trashed) {
      await this.removeFileLocally(change.fileId);
      return;
    }

    /* New file */
    if (!(change.fileId in this.fileInfo)) {
      await this.addFileLocally(change.file);
      return;
    }

    /* Changed file */
    let newInfo = change.file;
    let oldInfo = this.fileInfo[change.fileId];

    if (newInfo.modifiedTime == oldInfo.modifiedTime) {
      /* Nothing happened */
      return;
    }

    if (this.shouldIgnoreFile(newInfo)) {
      return;
    }

    if (newInfo.md5Checksum != oldInfo.md5Checksum) {
      /* Content changed, may as well delete it and redownload it */
      await this.removeFileLocally(oldInfo.id);
      await this.addFileLocally(newInfo);

      return;
    }

    /* Changed Paths */
    let oldPaths = await this.getPaths(oldInfo);
    if (oldPaths.length == 0) {
      await this.addFileLocally(newInfo);
      return;
    }
    await this.storeFileInfo(newInfo);
    await this.computeParents(newInfo);
    let newPaths = await this.getPaths(newInfo);
    await this.changePaths(oldPaths, newPaths);
  }

  async addFileLocally(fileInfo) {
    await this.storeFileInfo(fileInfo);
    await this.computeParents(fileInfo);
    await this.downloadFile(fileInfo);
  }

  async removeFileLocally(fileId) {
    if (!(fileId in this.fileInfo)) {
      console.error("Impossible to remove unknown file id ", fileId);
      return;
    }

    let fileInfo = this.fileInfo[fileId];
    let paths = await this.getPaths(fileInfo);

    delete this.fileInfo[fileId];
    for (let path of paths) {
      await fs.remove(path);
    }
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

  /* Check which folders in "My Drive" are parents of the file, and also
    replace the id of the main folder by "root" in computedParents */
  async computeParents(fileInfo) {
    let fileId = fileInfo.id;
    /* Remove self from children of old parents */
    if (fileInfo.computedParents) {
      for (let parent of fileInfo.computedParents) {
        parent.children = parent.children.filter(id => id != fileId);
      }
    }
    let parents = fileInfo.parents;

    let computedParents = [];
    let rootCheckDone = false;
    for (let parent of parents) {
      /* If the parent is recognized in the file structure, all is well */
      if (parent in this.fileInfo && this.fileInfo[parent].computedParents) {
        computedParents.push(parent);
      } else {
        /* Either the given id is a folder not in the structure (at least not the MyDrive structure) and we don't care for that, or ... it's the root folder */
        if (rootCheckDone) {
          continue;
        }
        if (await this.checkIfInRoot(fileInfo)) {
          computedParents.push('root');
        }
        rootCheckDone = true;
      }
    }

    /* Shouldn't happen, but protect ourselves against duplicate paths */
    computedParents = unique(computedParents);
    console.log("New computed parents for file", computedParents);
    if (computedParents.length > 0) {
      this.fileInfo[fileId].computedParents = computedParents;
      for (let parent of computedParents) {
        this.fileInfo[parent].children = this.fileInfo[parent].children || [];
        this.fileInfo[parent].children.push(fileId);
      }
    }
  }

  /* Optimization to do: instead, redownload root folder contents once when receiving new changes */
  async checkIfInRoot(fileInfo) {
    let res = await new Promise((resolve, reject) => {
      let args = {
        fields: "files(id)",
        corpora: "user",
        spaces: "drive",
        pageSize: 1000,
        q: `trashed = false and "root" in parents and name = "${fileInfo.name.replace(/([\\"])/g, "\\$1")}"`
      };
      this.drive.files.list(args, (err, result) => {
        if (err) {
          return reject(err);
        }

        resolve(result);
      });
    });

    for (let file of res.files) {
      if (file.id == fileInfo.id) {
        return true;
      }
    }

    return false;
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

  /* Rename / move files appropriately to new destinations */
  async changePaths(oldPaths, newPaths) {
    if (oldPaths.length == 0) {
      console.log("Can't change path, past path is empty");
      return;
    }

    let removedPaths = [];
    let addedPaths = [];

    for (let path of oldPaths) {
      if (!newPaths.includes(path)) {
        removedPaths.push(path);
      }
    }

    for (let path of newPaths) {
      if (!oldPaths.includes(path)) {
        addedPaths.push(path);
      }
    }

    for (let _path of addedPaths) {
      await mkdirp(path.dirname(_path));
    }

    for (let i = 0; i < removedPaths.length; i += 1) {
      if (i < addedPaths.length) {
        await fs.rename(removedPaths[i], addedPaths[i]);
        continue;
      }

      await fs.remove(removedPaths[i]);
    }

    for (let i = removedPaths.length; i < addedPaths.length; i += 1) {
      await fs.copy(newPaths[0], addedPaths[i]);
    }
  }

  shouldIgnoreFile(fileInfo) {
    return !("size" in fileInfo);
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

  async storeFileInfo(info) {
    return this.fileInfo[info.id] = info;
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

    return this.storeFileInfo(info);
  }

  async downloadFile(fileInfo) {
    console.log("Downlading file", fileInfo.name);
    if (this.shouldIgnoreFile(fileInfo)) {
      console.log("Ignoring file");
      return;
    }
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
    console.log("Saved new synchronization changes!");

    this.watchChanges();
  }
}

module.exports = Sync;
