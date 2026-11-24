const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let mainWindow = null;
let serverInstance = null;

async function startEmbeddedServer() {
  const serverModuleUrl = pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href;
  const { createChessServer } = await import(serverModuleUrl);

  const dbPath = app.isPackaged
    ? path.join(app.getPath('userData'), 'chess_mod.sqlite')
    : path.join(__dirname, '..', 'server', 'data', 'chess_mod.sqlite');

  const preferredPort = Number(process.env.PORT) || 3000;
  try {
    serverInstance = createChessServer({ port: preferredPort, dbPath });
    return await serverInstance.start();
  } catch {
    serverInstance = createChessServer({ port: 0, dbPath });
    return await serverInstance.start();
  }
}

async function createWindow() {
  Menu.setApplicationMenu(null);
  const { url } = await startEmbeddedServer();

  mainWindow = new BrowserWindow({
    title: 'CHESS.MOD',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#100f0d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    mainWindow.setFullScreen(true);
    mainWindow.show();
  });

  // F11 alterna pantalla completa real en Windows 11
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      mainWindow.webContents.send('fullscreen-changed', mainWindow.isFullScreen());
    }
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', false);
  });

  await mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('desktop:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('desktop:is-fullscreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('desktop:quit', () => {
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  globalShortcut.unregisterAll();
  if (serverInstance) {
    await serverInstance.stop().catch(() => {});
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
