const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const htmlPath = path.join(__dirname, '..', 'CHESS_MOD_COMPLETO.html');
const outPath = path.join(os.tmpdir(), 'chess_mod_standalone_check.json');

app.whenReady().then(async () => {
  const consoleErrors = [];
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 3) consoleErrors.push(msg);
  });
  try {
    await win.loadURL(pathToFileURL(htmlPath).href);
    await new Promise((r) => setTimeout(r, 800));
    const report = await win.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const out = {};
      out.protocol = location.protocol;
      out.playModeCount = document.querySelectorAll('#play-modes-grid .mode-card').length;
      out.sidebarName = document.getElementById('sidebar-username')?.textContent;
      out.sidebarElo = document.getElementById('sidebar-elo')?.textContent;
      out.sidebarXp = document.getElementById('sidebar-xp')?.textContent;
      out.audioEmbedded = document.getElementById('boss-music-audio')?.src?.startsWith('data:audio/mpeg;base64,') || false;

      // Iniciar Vs IA y hacer jugada e2->e4
      document.getElementById('btn-play-vs-ai').click();
      await wait(250);
      out.boardSquares = document.querySelectorAll('#board-grid .square').length;
      document.querySelectorAll('#board-grid .square')[6 * 8 + 4].click();
      await wait(100);
      document.querySelectorAll('#board-grid .square')[4 * 8 + 4].click();
      await wait(900);
      out.logsCount = document.querySelectorAll('#log-list .log-item').length;

      // Volver e ir a Modo Historia -> confirmar 5 capítulos
      document.getElementById('btn-battle-back').click();
      await wait(150);
      document.querySelector('[data-screen="story"]').click();
      await wait(150);
      out.chapters = document.querySelectorAll('#campaign-tabs-bar [data-campaign]').length;
      return out;
    })()`);
    fs.writeFileSync(outPath, JSON.stringify({ ok: true, consoleErrors, report }, null, 2));
  } catch (err) {
    fs.writeFileSync(outPath, JSON.stringify({ ok: false, error: err.message, consoleErrors }, null, 2));
  } finally {
    win.destroy();
    app.quit();
  }
});
