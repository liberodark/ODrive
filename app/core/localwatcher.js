const EventEmitter = require('events');
const chokidar = require("chokidar");
const fs = require("fs-extra");

class LocalWatcher extends EventEmitter {
  constructor(syncObject) {
    super();

    this.sync = syncObject;

    this.ready = false;
    this.cache = {};
    this.localQueue = [];
    this.startWatching();
  }

  get folder() {
    return this.sync.folder;
  }

  get lastOnline() {
    /* Get when the config was last saved, in order to analyze changes when the app was off */
    return this.sync.account.previousSaveTime;
  }

  startWatching() {
    /* Todo: first compare file structure to last snapshot */
    this.watcher = chokidar.watch(this.folder, {
      //ignored: /(^|[\/\\])\../,
      persistent: true
    });

    let log = console.log.bind(console);

    this.watcher.on('add', path => this.queue(path, 'add'))
      .on('change', (path, stats) => this.queue(path, 'change', stats))
      .on('unlink', path => this.queue(path, 'unlink'))
      .on('addDir', path => this.queue(path, 'addDir'))
      .on('unlinkDir', path => this.queue(path, 'unlinkDir'))
      .on('ready', () => this.queue('', 'ready'))
      .on('error', error => log(`Watcher error: ${error}`))
      .on('raw', (event, path, details) => { //eslint-disable-line no-unused-vars
        //log('Raw event info:', event, path, details);
      });
  }

  stopWatching() {
    this.closed = true;
    this.watcher.close();
  }

  async queue(path, event) {
    /* Local queue is needed to make sure events are dealt with in order, as the async call (fs.stat) may change that */
    this.localQueue.push([event, path]);

    /* Queue already running in other loop */
    if (this.localQueue.length > 1) {
      return;
    }

    while (this.localQueue.length > 0) {
      await this.dealWithQueuedEvent(this.localQueue[0]);

      //Only remove first element now, so that this.localQueue.length > 1 if a new event is added in the meantime (above test)
      this.localQueue.shift();
    }
  }

  async dealWithQueuedEvent([event, path]) {
    if (event == "ready") {
      this.ready = true;
      console.log('Initial scan complete. Ready for changes');
      return;
    }

    if (!this.ready) {
      /* Check if the file/folder was last changed since app went offline */
      let {mtime} = await fs.stat(path);
      //As of writing code, mtimeMs is not yet in electron's node implementation
      mtime = (new Date(mtime)).getTime();

      if (this.lastOnline - mtime > 0) {
        /* App was still online when file/folder was last changed, so it's already taken care of */
        return;
      }
    }

    this.addCache(path, event);
  }

  /* The whole caching system is to ensure a file has stopped being modified before processing the associated changes */
  createCache(path) {
    this.cache[path] = {
      timer: 0,
      events: []
    };
  }

  clearCache(path) {
    delete this.cache[path];
  }

  addCache(path, event) {
    if (! (path in this.cache)) {
      this.createCache(path);
    }

    let cache = this.cache[path];
    clearTimeout(cache.timer);
    cache.events.push(event);
    cache.timer = setTimeout(() => this.analyzeCache(path), 1000);
  }

  analyzeCache(path) {
    let cache = this.cache[path];

    /* Ignore is when the main process modifies the file and so doesn't want to be notified of recent changes to it */
    if (!cache || cache.events.includes("ignore")) {
      console.log("ignoring events for path", path);
      return this.clearCache(path);
    }

    let events = cache.events;

    /* Get last important event */
    console.log("Events", events);
    let lastIndex = Math.max(events.lastIndexOf('unlink'), events.lastIndexOf('unlinkDir'), events.lastIndexOf('add'), events.lastIndexOf('addDir'));
    if (lastIndex != -1) {
      console.log("Emitting last important event for", path, events[lastIndex]);
      this.emit(events[lastIndex], path);
    } else {
      console.log("Emitting last event for", path);
      this.emit(events.pop(), path);
    }

    this.clearCache(path);
  }

  ignore(path) {
    this.addCache(path, "ignore");
  }
}

module.exports = LocalWatcher;
