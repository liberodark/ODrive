const assert = require('assert');
const path = require("path");
const fs = require("fs-extra");
const mkdirp = require("mkdirp-promise");
const delay = require("delay");

let fileInfoFields = "id, name, mimeType, md5Checksum, size, modifiedTime, parents";
let listFilesFields = `nextPageToken, files(${fileInfoFields})`;

class Sync {
  constructor(account) {
    this.account = account;
    this.fileInfo = {"root": {}};
  }

  get drive() {
    return this.account.drive;
  }

  get folder() {
    return this.account.folder;
  }

  async start(notifyCallback) {
    assert(!this.syncing, "Sync already in progress");
    this.syncing = true;

    try {
      let notify = notifyCallback || (() => {});

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
    } catch (err) {
      this.syncing = false;
      throw err;
    }
  }

  async downloadFolderStructure(folder) {
    /* Try avoiding triggering antispam filters on Google's side, given the quantity of data */
    await delay(500);

    console.log("Downloading folder structure for ", folder);
    let files = await this.folderContents(folder);

    for (let file of files) {
      if (file.mimeType.includes("folder")) {
        await this.downloadFolderStructure(file.id);
      }
    }
  }

  async folderContents(folder) {
    folder = folder || "root";

    let {nextPageToken, files} = await this.folderChunk({folder});

    console.log(files, nextPageToken);
    console.log("(Chunk 1)");

    let counter = 1;
    while(nextPageToken) {
      /* Try avoiding triggering antispam filters on Google's side, given the quantity of data */
      await delay(2000);

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
    let {pageToken, folder} = arg;

    if (!folder) {
      folder = "root";
    }

    let result = await new Promise((resolve, reject) => {
      let args = {
        fields: listFilesFields,
        corpora: "user",
        space: "drive",
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
    console.log('Get path',fileInfo);
    if (!fileInfo.computedParents) {
      console.log(this.folder);
      return [this.folder];
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

    return this.fileInfo[fileInfo.id] = fileInfo;
  }

  async downloadFile(fileInfo) {
    let savePaths = await this.getPaths(fileInfo);
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
}

module.exports = Sync;
