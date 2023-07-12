/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Tray, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

const gotTheLock = app.requestSingleInstanceLock();

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayHidden = false;
let appIcon: Tray | null = null;

function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'BNC Attendance',
      click: function () {
        mainWindow?.show();
      },
    },
    {
      label: overlayHidden ? 'Show loot tool' : 'Hide loot tool',
      click: function () {
        toggleOverlay();
      },
    },
    {
      label: 'Check for updates',
      click: function () {
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    {
      label: 'Quit',
      click: function () {
        // @ts-ignore
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);
}

function toggleOverlay() {
  if (overlayHidden) {
    overlayWindow?.show();
    overlayHidden = false;
  } else {
    overlayWindow?.hide();
    overlayHidden = true;
  }

  appIcon?.setContextMenu(buildContextMenu());
}

// TODO: Make this fetch all boxes for people in zone
async function getBoxMap() {
  return { mave: 'karadin' };
}

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', app.getVersion());
});

// @ts-ignore
ipcMain.on('fetching-roll-range', async (event, range) => {
  if (!overlayWindow) {
    return;
  }
  overlayWindow.webContents.send('fetching-roll-range', true);
});

// @ts-ignore
ipcMain.on('roll-range', async (event, range) => {
  if (!overlayWindow) {
    return;
  }
  console.log('got range relaying', range);
  overlayWindow.webContents.send('update-roll-range', range);
});

ipcMain.on('fetch-box-map', async () => {
  if (!overlayWindow) {
    return;
  }
  const boxMap = await getBoxMap();
  overlayWindow.webContents.send('box-map-changed', JSON.stringify(boxMap));
});

// @ts-ignore
ipcMain.on('item-looted', async (event, item) => {
  if (!overlayWindow) {
    return;
  }
  console.log('got item relaying', item);
  overlayWindow.webContents.send('item-looted', item);
});

// @ts-ignore
ipcMain.on('dice-roll', async (event, roll) => {
  if (!overlayWindow) {
    return;
  }
  console.log('got roll relaying', roll);
  overlayWindow.webContents.send('update-current-roll', roll);
});

// This handler updates our mouse event settings depending
// on whether the user is hovering over a clickable element
// in the call window.
ipcMain.handle('set-ignore-mouse-events', (e, ...args) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  // @ts-ignore
  win?.setIgnoreMouseEvents(...args);
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDevelopment =
  true ||
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true';

if (isDevelopment) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createOverlayWindow = async () => {
  if (overlayWindow) {
    overlayWindow.show();
    overlayHidden = false;
    return;
  }
  overlayWindow = new BrowserWindow({
    title: 'Loot winner',
    webPreferences: {
      // The path to our aforementioned preload script!`
      preload: path.join(__dirname, 'preload.js'),
    },
    // Remove the default frame around the window
    frame: false,
    // Hide Electron’s default menu
    autoHideMenuBar: true,
    transparent: true,
    fullscreen: true,
    // Do not display our app in the task bar
    // (It will live in the system tray!)
    skipTaskbar: true,
    hasShadow: false,
    // Don't show the window until the user is in a call.
    show: false,
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  let level: 'normal' | 'floating' = 'normal';
  if (process.platform === 'darwin') {
    level = 'floating';
  }

  overlayWindow.setAlwaysOnTop(true, level);
  overlayWindow.loadURL(resolveHtmlPath('overlay.html'));

  overlayWindow.on('ready-to-show', async () => {
    if (!overlayWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    overlayWindow.show();
    overlayHidden = false;
    // TODO: Call this dynamically
    const boxMap = await getBoxMap();
    overlayWindow.webContents.send('box-map-changed', JSON.stringify(boxMap));
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    overlayWindow?.close();
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  appIcon = new Tray(getAssetPath('icon.png'));
  appIcon.setToolTip('BNC Attendance');
  appIcon.setContextMenu(buildContextMenu());
  appIcon.addListener('click', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.session.setCertificateVerifyProc(
    (request, callback) => {
      console.log(`Setting certificate proc for ${request.hostname}`);
      // Always accept downloads.
      callback(0);
      // if (
      //   ['github.com', 'objects.githubusercontent.com'].includes(
      //     request.hostname
      //   )
      // ) {
      // } else {
      //   callback(-2);
      // }
    }
  );

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

if (!gotTheLock) {
  app.quit();
} else {
  app.on(
    // @ts-ignore
    'second-instance',
    // @ts-ignore
    (event, commandLine, workingDirectory, additionalData) => {
      // Someone tried to run a second instance, we should focus our window.
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  );

  app
    .whenReady()
    .then(() => {
      createWindow();
      createOverlayWindow();
      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) createWindow();
        if (overlayWindow === null) createOverlayWindow();
      });
    })
    .catch(console.log);
}
