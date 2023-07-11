const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  onRollGenerated: (callback) => {
    return ipcRenderer.on('update-current-roll', callback);
  },
  onRangeGenerated: (callback) => {
    return ipcRenderer.on('update-roll-range', callback);
  },
  onFetchRollRange: (callback) => {
    return ipcRenderer.on('fetching-roll-range', callback);
  },
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

function refreshClickableElements() {
  const clickableElements = document.getElementsByClassName('clickable');
  const listeningAttr = 'listeningForMouse';
  for (const ele of clickableElements) {
    // If the listeners are already set up for this element, skip it.
    if (ele.getAttribute(listeningAttr)) {
      continue;
    }
    ele.addEventListener('mouseenter', () => {
      ipcRenderer.invoke('set-ignore-mouse-events', false);
    });
    ele.addEventListener('mouseleave', () => {
      ipcRenderer.invoke('set-ignore-mouse-events', true, { forward: true });
    });
    ele.setAttribute(listeningAttr, true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  refreshClickableElements();
});

window.addEventListener('DOMNodeInserted', () => {
  refreshClickableElements();
});

console.log('STSARTED THE OVERLAY');
