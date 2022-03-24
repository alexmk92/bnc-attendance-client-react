const fs = require('fs');
const Tail = require('tail-file');

const { contextBridge, ipcRenderer } = require('electron');

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
});

let currTail = null;

contextBridge.exposeInMainWorld('ipc', {
  readdir: fs.promises.readdir,
  stopTail: async () => {
    if (currTail) {
      await currTail.stop();
      console.log('stopped tailing');
    }
  },
  tail: async (filePath, callback) => {
    currTail = new Tail(filePath, callback);
    currTail.on('error', async (e) => {
      await currTail.stop();
      callback('STOP', 'STOP');
      console.log('stopped');
    });

    currTail.start();
    callback('START', 'START');
  },
  baseUrl: 'https://bnc-attendance.fly.dev',
});
