const fs = require('fs');
const Tail = require('@logdna/tail-file');
const split2 = require('split2');

const { contextBridge, ipcRenderer } = require('electron');
const produce = require('./producer');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    myPing() {
      ipcRenderer.send('ipc-example', 'ping');
    },
    on(channel, func) {
      const validChannels = ['ipc-example'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    once(channel, func) {
      const validChannels = ['ipc-example'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      }
    },
  },
  send: (channel, data) => {
    console.log('sending', channel, data);
    ipcRenderer.send(channel, data);
  },
});

let currTail = null;

contextBridge.exposeInMainWorld('ipc', {
  readdir: fs.promises.readdir,
  stopTail: async () => {
    if (currTail) {
      await currTail.quit();
      console.log('stopped tailing');
    }
  },
  tail: async (filePath, callback) => {
    currTail = new Tail(filePath, { encoding: 'utf8' });
    currTail
      .on('tail_error', (err) => {
        console.error('TailFile had an error!', err);
      })
      .start()
      .catch((err) => {
        console.error('Cannot start.  Does the file exist?', err);
      });

    // Data won't start flowing until piping
    currTail.pipe(split2()).on('data', (line) => {
      callback(line);
    });
  },
  baseUrl: 'https://bnc-attendance.fly.dev',
  recordLoot: async (messages) => {
    await produce('loot', messages);
    return messages.length;
  },
});
