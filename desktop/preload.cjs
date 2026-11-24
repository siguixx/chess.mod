const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chessDesktop', {
  isDesktop: true,
  toggleFullscreen: () => ipcRenderer.invoke('desktop:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('desktop:is-fullscreen'),
  quit: () => ipcRenderer.invoke('desktop:quit'),
  onFullscreenChange: (callback) => {
    ipcRenderer.on('fullscreen-changed', (_event, isFull) => callback(isFull));
  }
});
