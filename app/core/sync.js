const assert = require('assert');
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp-promise");
const delay = require("delay");

let fileInfoFields = "id, name, mimeType, md5Checksum, size, modifiedTime, parents";
let listFilesFields = `nextPageToken, files(${fileInfoFields})`;

class Sync {
  constructor(account) {
    this.account = account;
    this.fileInfo = {};
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

      let files = await this.filesList();
      let counter = 0;
      let ignored = 0;

      for (let file of files) {
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
    } catch (err) {
      this.syncing = false;
      throw err;
    }
  }

  async filesList() {
    let {nextPageToken, files} = await this.filesChunk();

    console.log(files, nextPageToken);
    console.log("(Chunk 1)");

    let counter = 1;
    while(nextPageToken) {
      /* Try avoiding triggering antispam filters on Google's side, given the quantity of data */
      await delay(2000);

      let data = await this.filesChunk(nextPageToken);
      nextPageToken = data.nextPageToken;
      files = files.concat(data.files);

      counter += 1;
      console.log(data);

      if (data.files[0].parents) {
        console.log(data.files[0].parents[0]);
      }
      console.log(`(Chunk ${counter})`, nextPageToken);
    }

    console.log("Files list done!");

    return files;
  }

  async filesChunk(pageToken) {
    let result = await new Promise((resolve, reject) => {
      let args = {
        fields: listFilesFields,
        corpora: "user",
        space: "drive",
        pageSize: 1000,
        q: "\"me\" in owners and trashed = false" //Receiving unwanted files, so this!
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

    for (let file of result.files) {
      this.fileInfo[file.id] = file;
    }

    return result;
  }

  async getParent(fileInfo) {
    if (!fileInfo.parents || fileInfo.parents.length == 0) {
      return null;
    }

    return await this.getFileInfo(fileInfo.parents[0]);
  }

  async getPath(fileInfo) {
    let parent = await this.getParent(fileInfo);

    if (parent === null) {
      return path.join(this.folder, fileInfo.name);
    }

    return path.join(await this.getPath(parent), fileInfo.name);
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
    let savePath = await this.getPath(fileInfo);

    /* Create the folder for the file first */
    await mkdirp(path.dirname(savePath));

    var dest = fs.createWriteStream(savePath);

    return new Promise((resolve, reject) => {
      this.drive.files.get({fileId: fileInfo.id, alt: "media"})
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .pipe(dest);
    });
  }
}

module.exports = Sync;
