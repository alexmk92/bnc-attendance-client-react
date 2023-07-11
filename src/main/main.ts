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
import { app, BrowserWindow, shell, ipcMain } from 'electron';
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

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
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
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

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
  overlayWindow = new BrowserWindow({
    title: 'Loot winner',
    webPreferences: {
      // The path to our aforementioned preload script!
      preload: path.join(__dirname, 'preloadOverlay.js'),
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
};

const createWindow = async () => {
  if (isDevelopment) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

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
      overlayWindow?.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  // new AppUpdater();
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
