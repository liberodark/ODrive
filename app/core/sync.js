const assert = require('assert');
const path = require("path");
const fs = require("fs-extra");
const mkdirp = require("mkdirp-promise");
const delay = require("delay");
const deepEqual = require("deep-equal");
//const md5file = require('md5-file/promise');

const LocalWatcher = require('./localwatcher');
const globals = require('../../config/globals');

const fileInfoFields = "id, name, mimeType, md5Checksum, size, modifiedTime, parents, trashed";
const listFilesFields = `nextPageToken, files(${fileInfoFields})`;
const changeInfoFields = `time, removed, fileId, file(${fileInfoFields})`;
const changesListFields = `nextPageToken, newStartPageToken, changes(${changeInfoFields})`;

const toSave = ["changeToken", "fileInfo", "synced", "rootId", "changesToExecute"];

class Sync {
  constructor(account) {
    this.account = account;
    this.fileInfo = {};
    this.paths = {};
    this.rootId = null;
    this.synced = false;
    this.changeToken = null;
    this.changesToExecute = null;
    this.loaded = false;
    this.watchingChanges = false;

    this.watcher = new LocalWatcher(this);
    this.initWatcher();

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

      let rootInfo = await this.getFileInfo("root");
      this.rootId = rootInfo.id;

      notify("Watching changes in the remote folder...");
      await this.startWatchingChanges();

      notify("Getting files info...");

      let files = await this.downloadFolderStructure("root");
      await this.computePaths();

      let counter = 0;
      let ignored = 0;

      for (let file of files) {
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
      this.synced = true;

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

      // eslint-disable-next-line no-constant-condition
      while (1) {
        /* Don't handle changes at the same time as syncing... */
        if (!this.syncing && this.synced) {
          await this.handleNewChanges();
        }
        await delay(8000);
      }
    } catch (err) {
      this.watchingChanges = false;

      /* For the unhandledRejection handler */
      err.syncObject = this;
      err.watcher = true;
      /* .... */

      throw err;
    }
  }

  async handleNewChanges() {
    this.changesToExecute = await this.getNewChanges();

    await this.handleChanges();
  }

  async handleChanges() {

    let initialCount = (this.changesToExecute||[]).length;
    while((this.changesToExecute||[]).length > 0) {
      let nextChange = this.changesToExecute.shift();
      if (await this.handleChange(nextChange)) {
        await this.save();
      }
    }

    /* Save regularly if there are changes, even if they're worthless. At least it updates the change token. */
    if ( (Date.now() - this.savedTime) > 30000 && initialCount > 0) {
      await this.save();
    }
  }

  async handleChange(change) {
    /* Todo */
    console.log("Change", change);

    /* Deleted file */
    if (change.removed || change.file.trashed) {
      console.log("deleted file");
      return await this.removeFileLocally(change.fileId);
    }

    console.log(change.fileId, this.fileInfo[change.fileId]);

    /* New file */
    if (!(change.fileId in this.fileInfo)) {
      console.log("new file");
      return await this.addFileLocally(change.file);
    }

    /* Changed file */
    let newInfo = change.file;
    let oldInfo = this.fileInfo[change.fileId];
    await this.storeFileInfo(newInfo);

    if (this.noChange(newInfo, oldInfo)) {
      console.log("Same main info, ignoring");
      /* Nothing happened */
      return false;
    }

    let oldPaths = await this.getPaths(oldInfo);
    let newPaths = await this.getPaths(newInfo);

    if (newPaths.length == 0 && oldPaths.length == 0) {
      console.log("Not in main folder, ignoring");
      return false;
    }

    if (newInfo.md5Checksum != oldInfo.md5Checksum) {
      console.log("Different checksum, redownloading");
      /* Content changed, may as well delete it and redownload it */
      await this.removeFileLocally(oldInfo.id);
      await this.addFileLocally(newInfo);

      return true;
    }

    /* Changed Paths */
    if (oldPaths.length == 0) {
      console.log("Wasn't in main folder, downloading");
      return await this.addFileLocally(newInfo);
    }

    if (this.shouldIgnoreFile(newInfo)) {
      console.log("Ignoring file, content worthless");
      return false;
    }

    oldPaths.sort();
    newPaths.sort();

    if (deepEqual(oldPaths, newPaths)) {
      console.log("Same file names, ignoring");
      return false;
    }

    console.log("Moving files");
    await this.changePaths(oldPaths, newPaths);
    return true;
  }

  noChange(oldInfo, newInfo) {
    if (oldInfo.modifiedTime >= newInfo.modifiedTime) {
      return false;
    }
    if (oldInfo.name != newInfo.name) {
      return false;
    }
    if (!deepEqual(oldInfo.parents, newInfo.parents)) {
      return false;
    }
    return true;
  }

  async addFileLocally(fileInfo) {
    await this.storeFileInfo(fileInfo);
    return await this.downloadFile(fileInfo);
  }

  async onLocalFileAdded(src) {
    console.log("On local file added", src);

    if (src in this.paths) {
      let id = this.paths[id];
      if (id in this.fileInfo) {
        console.log("File already in drive's memory, updating instead");
        return this.onLocalFileUpdated(src);
      }
    }

    /* In case parent is a folder and was just added as well, we need to wait for google's answer to have the parent's id */
    await this.finishAdding();

    /* Create local file info */
    let info = {
      //id: uuid(),
      name: path.basename(src),
      //md5Checksum: await md5file(src),
      parents: [await this.getParent(src)],
      //mimeType: "image/jpeg"
    };

    console.log("Local info", info);
    let addRemotely = () => new Promise((resolve, reject) => {
      console.log("creating...");
      this.drive.files.create({
        resource: info,
        media: {
          body: fs.createReadStream(src)
        },
        fields: fileInfoFields
      }, (err, result) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        console.log("Result", result);
        resolve(result);
      });
    });

    let result = await this.tryTwice(addRemotely);

    await this.storeFileInfo(result);
    await this.save();
  }

  async onLocalFileUpdated(src) {
    console.log("onLocalFileUpdated", src);
    console.log("not implemented");
  }

  async onLocalFileRemoved(src) {
    console.log("onLocalFileRemoved", src);

    if (!(src in this.paths)) {
      console.log(`Not existing in path architecture (${Object.keys(this.paths).length} paths)`);
      //console.log(this.paths);
      return;
    }

    let id = this.paths[src];

    console.log("Local info", this.fileInfo[id]);

    delete this.fileInfo[id];
    await this.save();

    let rmRemotely = () => new Promise((resolve, reject) => {
      console.log("deleting...");
      this.drive.files.delete({fileId: id}, (err, result) => {
        if (err) {
          console.error(err);
          return reject(err);
        }
        console.log("Result", result);
        resolve(result);
      });
    });

    await this.tryTwice(rmRemotely);
  }

  async finishAdding() {
    while (this.adding) {
      await delay(20);
    }
  }

  async onLocalDirAdded(src) {
    console.log("onLocalDirAdded", src);

    if (src in this.paths) {
      let id = this.paths[id];
      if (id in this.fileInfo && this.isFolder(this.fileInfo[id])) {
        console.log("Folder already in drive's memory");
        return;
      }
    }

    await this.finishAdding();
    this.adding = true;

    try {
      /* Create local file info */
      let info = {
        //id: uuid(),
        name: path.basename(src),
        //md5Checksum: await md5file(src),
        parents: [await this.getParent(src)],
        mimeType: "application/vnd.google-apps.folder"
      };

      console.log("Local info", info);
      let addRemotely = () => new Promise((resolve, reject) => {
        console.log("creating...");
        this.drive.files.create({
          resource: info,
          fields: fileInfoFields
        }, (err, result) => {
          if (err) {
            console.error(err);
            return reject(err);
          }
          console.log("Result", result);
          resolve(result);
        });
      });

      let result = await this.tryTwice(addRemotely);

      await this.storeFileInfo(result);
      await this.save();

      this.adding = false;
    } catch (err) {
      this.adding = false;
      throw err;
    }
  }

  async onLocalDirRemoved(src) {
    if (src == this.folder) {
      console.error("Google drive folder removed?!?!?!?");
      process.exit(1);
    }
    console.log("onLocalDirRemoved", src);

    this.onLocalFileRemoved(src);
  }

  async removeFileLocally(fileId) {
    if (!(fileId in this.fileInfo)) {
      console.error("Impossible to remove unknown file id ", fileId);
      return false;
    }

    let fileInfo = this.fileInfo[fileId];
    let paths = await this.getPaths(fileInfo);

    delete this.fileInfo[fileId];

    if (paths.length == 0) {
      return false;
    }

    let removed = false;
    for (let path of paths) {
      if (await fs.exists(path)) {
        this.watcher.ignore(path);
        await fs.remove(path);
        removed = true;
      }
    }

    return removed;
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
    await delay(110);

    console.log("Downloading folder structure for ", folder);
    let files = await this.folderContents(folder);

    let res = [].concat(files);//clone to a different array
    for (let file of files) {
      if (file.mimeType.includes("folder")) {
        res = res.concat(await this.downloadFolderStructure(file.id));
      }
      await this.storeFileInfo(file);
    }

    return res;
  }

  async folderContents(folder) {
    await this.finishLoading();

    let q = folder ? `trashed = false and "${folder}" in parents` : null;

    let {nextPageToken, files} = await this.filesListChunk({folder,q});

    console.log(files, nextPageToken);
    console.log("(Chunk 1)");

    let counter = 1;
    while(nextPageToken) {
      /* Try avoiding triggering antispam filters on Google's side, given the quantity of data */
      await delay(500);

      let data = await this.filesListChunk({pageToken: nextPageToken, q});
      nextPageToken = data.nextPageToken;
      files = files.concat(data.files);

      counter += 1;
      console.log(data);
      console.log(`(Chunk ${counter})`, nextPageToken);
    }

    console.log("Files list done!");

    return files;
  }

  async filesListChunk(arg) {
    await this.finishLoading();

    let {pageToken, q} = arg;

    let getChunk = () => new Promise((resolve, reject) => {
      q = q || 'trashed = false';
      let args = {
        fields: listFilesFields,
        corpora: "user",
        spaces: "drive",
        pageSize: 1000,
        q
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

    return await this.tryTwice(getChunk);
  }

  async getPaths(fileInfo) {
    //console.log('Get path', fileInfo.name);
    if (fileInfo.id == this.rootId) {
      return [this.folder];
    }
    if (!fileInfo.parents) {
      console.log("File out of the main folder structure", fileInfo);
      return [];
    }

    let ret = [];

    for (let parent of fileInfo.parents) {
      let parentInfo = await this.getFileInfo(parent);
      for (let parentPath of await this.getPaths(parentInfo)) {
        ret.push(path.join(parentPath, fileInfo.name));
      }
    }

    return ret;
  }

  async getParent(src) {
    let dir = path.dirname(src);

    if (!(dir in this.paths)) {
      throw new Error("Unkown folder: ", dir);
    }

    return this.paths[dir];
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
        this.watcher.ignore(removedPaths[i]);
        this.watcher.ignore(addedPaths[i]);
        await fs.rename(removedPaths[i], addedPaths[i]);
        continue;
      }

      this.watcher.ignore(removedPaths[i]);
      await fs.remove(removedPaths[i]);
    }

    for (let i = removedPaths.length; i < addedPaths.length; i += 1) {
      this.watcher.ignore(addedPaths[i]);
      await fs.copy(newPaths[0], addedPaths[i]);
    }
  }

  isFolder(fileInfo) {
    return fileInfo.mimeType.includes("folder");
  }

  shouldIgnoreFile(fileInfo) {
    if (fileInfo.id == this.rootId) {
      return true;
    }
    if (this.isFolder(fileInfo)) {
      return false;
    }
    return !("size" in fileInfo);
  }

  async tryTwice(fn) {
    try {
      return await fn();
    } catch(err) {
      if (err.code != 'ECONNRESET') {
        throw err;
      }
    }

    console.error("Connection error received, waiting 2 seconds and retrying");
    await delay(2000);

    return await fn();
  }

  /* Gets file info from fileId.

    If the file info is not present in cache or if forceUpdate is true,
    it seeks the information remotely and updates the cache as well. */
  async getFileInfo(fileId, forceUpdate) {
    await this.finishLoading();

    console.log("Getting individual file info: ", fileId);
    if (!forceUpdate && (fileId in this.fileInfo)) {
      return this.fileInfo[fileId];
    }

    let getFileInfo = () => new Promise((resolve, reject) => {
      this.drive.files.get({fileId, fields: fileInfoFields}, (err, result) => {
        if (err) {
          return reject(err);
        }
        resolve(result);
      });
    });

    let fileInfo = await this.tryTwice(getFileInfo);

    return this.storeFileInfo(fileInfo);
  }

  async storeFileInfo(info) {
    await this.computePaths(info);
    return this.fileInfo[info.id] = info;
  }

  async computePaths(info) {
    if (info) {
      console.log("Computing paths", info.id, info.name);
      for (let path of await this.getPaths(info)) {
        console.log(path);
        this.paths[path] = info.id;
      }
    } else {
      //console.log(this.fileInfo);
      for (let info of Object.values(this.fileInfo)) {
        this.computePaths(info);
      }
      console.log("Paths computed", Object.keys(this.paths).length);
    }
  }

  async downloadFile(fileInfo) {
    console.log("Downlading file", fileInfo.name);
    if (this.shouldIgnoreFile(fileInfo)) {
      console.log("Ignoring file");
      return false;
    }
    await this.finishLoading();

    let savePaths = await this.getPaths(fileInfo);

    if (savePaths.length == 0) {
      return false;
    }

    /* If folder, just create the folder locally */
    if (this.isFolder(fileInfo)) {
      for (let path of savePaths) {
        this.watcher.ignore(path);
        await mkdirp(path);
      }
      return true;
    }

    let savePath = savePaths.shift();

    /* Create the folder for the file first */
    await mkdirp(path.dirname(savePath));

    var dest = fs.createWriteStream(savePath);

    await delay(80);

    console.log("Starting the actual download...");

    await this.tryTwice(() => new Promise((resolve, reject) => {
      this.watcher.ignore(savePath);
      this.drive.files.get({fileId: fileInfo.id, alt: "media"})
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .pipe(dest);
    }).catch(async (err) => {
      /* Remove a partial download in case of err, don't want it to be synchronized later on */
      await fs.remove(dest);
      throw err;
    }));
    console.log("Download ended!");

    for (let otherPath of savePaths) {
      console.log("copying file to folder ", otherPath);
      this.watcher.ignore(otherPath);
      await fs.copy(savePath, otherPath);
    }

    return true;
  }

  async finishLoading() {
    while (!this.loaded) {
      await delay(20);
    }
  }

  async finishSaveOperation() {
    while (this.loading || this.saving) {
      await delay(20);
    }
  }

  async initWatcher() {
    this.watcher.on('add', path => this.onLocalFileAdded(path));
    this.watcher.on('unlink', path => this.onLocalFileRemoved(path));
    this.watcher.on('addDir', path => this.onLocalDirAdded(path));
    this.watcher.on('unlinkDir', path => this.onLocalDirRemoved(path));
  }

  /* Load in NeDB */
  async load() {
    console.log("Beginning of loading sync object...");
    /* No reason to load a saving file or reload the file */
    if (this.loading || this.saving) {
      return await this.finishSaveOperation();
    }
    this.loading = true;

    try {
      console.log("Loading sync object");
      let obj = await globals.db.findOne({type: "sync", accountId: this.account.id});

      if (obj) {
        for (let item of toSave) {
          this[item] = obj[item];
        }
        this.id = obj._id;
      } else {
        console.log("Nothing to load");
      }
      console.log("Loaded sync object! ");

      //Compute paths
      if (this.fileInfo) {
        await this.computePaths();
      }

      //Load changes that might have not gotten throughs
      this.loaded = true;
      await this.handleChanges();

      if (obj && obj.synced) {
        this.watchChanges();
      }
      this.loading = false;
    } catch (err) {
      this.loading = false;
      throw err;
    }
  }

  /* Save in NeDB, overwriting previous entry */
  async save() {
    console.log("Saving sync object");
    await this.finishLoading();

    if (this.loading || this.saving) {
      return await this.finishSaveOperation();
    }
    this.saving = true;

    try {
      if (!this.id) {
        //Create new object
        let obj = await globals.db.insert({type: "sync", accountId: this.account.id});
        this.id = obj._id;
      }

      /* Save object */
      let saveObject = {
        type: "sync",
        accountId: this.account.id,
        _id: this.id
      };

      for (let item of toSave) {
        saveObject[item] = this[item];
      }

      await globals.db.update({_id: this.id}, saveObject, {});
      this.savedTime = Date.now();
      console.log("Saved new synchronization changes!");

      this.watchChanges();
      this.saving = false;
    } catch(err) {
      this.saving = false;
      throw err;
    }
  }
}

module.exports = Sync;
