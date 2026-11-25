const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const tmpDb = path.join(os.tmpdir(), `chess_mod_ui_verif_${Date.now()}.sqlite`);
const outPath = path.join(os.tmpdir(), 'chess_mod_ui_report.json');

app.whenReady().then(async () => {
  const { createChessServer } = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href);
  const server = createChessServer({ port: 0, dbPath: tmpDb });
  const { url } = await server.start();

  const consoleErrors = [];
  const failedLoads = [];

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    fullscreen: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'desktop', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) consoleErrors.push(message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
    failedLoads.push({ code, desc, failedUrl });
  });

  try {
    await win.loadURL(url);
    await new Promise((r) => setTimeout(r, 900));

    const report = await win.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const results = {};

      // 0. Bridge de escritorio Electron + Logo oficial CHESS.MOD cargado
      results.desktopBridgeReady = Boolean(window.chessDesktop && window.chessDesktop.isDesktop);
      const brandImg = document.querySelector('.brand-logo-img');
      results.logoLoaded = Boolean(brandImg && brandImg.complete && brandImg.naturalWidth > 0);

      // 0B. Selector de Idioma OBLIGATORIO antes de crear cuenta + cambio en Ajustes
      results.langGateOpenedInitially = document.getElementById('modal-language-picker')?.classList.contains('open') || false;
      results.langGateHasNoCloseBtn = !document.querySelector('#modal-language-picker .btn-icon');
      // Elegir Inglés primero -> debe traducir la interfaz y abrir el modal de crear cuenta
      document.querySelector('#language-gate-grid [data-pick-lang="en"]')?.click();
      await wait(250);
      results.langSwitchedToEn = document.querySelector('#screen-play .screen-title')?.textContent.trim() === 'PLAY';
      results.authOpenedAfterLang = document.getElementById('modal-auth')?.classList.contains('open') || false;

      // 1. Menú «JUGAR»: SOLO 3 modos (Partida Rápida, Vs IA, Contra el Tiempo), CERO Boss Fights
      const playCards = [...document.querySelectorAll('#play-modes-grid .mode-card h3')].map(el => el.textContent.trim());
      results.playModeCount = playCards.length;
      results.playModes = playCards;
      results.hasDirectBossInPlay = Boolean(document.getElementById('btn-play-boss-maya') || document.getElementById('btn-play-boss-mittens'));

      // 2. Registrar usuario real desde la UI -> debe empezar con 0 Elo, 50 XP y abrir OBLIGATORIAMENTE el selector de Entrenador 1 sola vez
      document.querySelector('.auth-tab[data-tab="register"]').click();
      document.getElementById('reg-username').value = 'VerifWin11';
      document.getElementById('reg-email').value = 'verif@chessmod.local';
      document.getElementById('reg-password').value = 'Password123';
      document.getElementById('form-register').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await wait(650);
      results.registeredSidebarName = document.getElementById('sidebar-username').textContent;
      results.registeredSidebarElo = document.getElementById('sidebar-elo').textContent;
      results.registeredSidebarXp = document.getElementById('sidebar-xp').textContent;

      // 2B. Verificar selector de Entrenador obligatorio y sin poder saltar después de crear cuenta
      results.trainerModalOpenedAfterReg = document.getElementById('modal-trainer-picker')?.classList.contains('open') || false;
      results.trainerModalUnskippable = !document.getElementById('btn-close-trainer-modal') && document.getElementById('btn-confirm-permanent-trainer')?.disabled === true;
      // Verificar que SVGs de personajes tienen sombreado/gradientes reales (no planos)
      const trainerSvgHtml = document.getElementById('modal-trainers-grid')?.innerHTML || '';
      results.svgsHaveGradients = trainerSvgHtml.includes('linearGradient') && trainerSvgHtml.includes('radialGradient');

      // Elegir a Yam y confirmar permanentemente
      document.querySelector('#modal-trainers-grid [data-pick-trainer-card="trainer_yam"]')?.click();
      await wait(150);
      document.getElementById('btn-confirm-permanent-trainer')?.click();
      await wait(500);
      results.trainerModalClosedAfterConfirm = !document.getElementById('modal-trainer-picker')?.classList.contains('open');
      results.trainerLockedInPlayGrid = document.querySelectorAll('#play-trainers-grid .trainer-card.locked-other').length === 5;

      // 2C. Configuración completa: cambiar idioma a Español, desactivar guía previa para agilizar pruebas, probar alto contraste y coordenadas
      document.querySelector('[data-screen="settings"]').click();
      await wait(150);
      document.querySelector('#settings-lang-pills [data-set-lang="es"]')?.click();
      await wait(200);
      results.langSwitchedBackToEs = document.querySelector('#screen-play .screen-title')?.textContent.trim() === 'JUGAR';
      const hcChk = document.getElementById('set-high-contrast');
      if (hcChk) { hcChk.checked = true; hcChk.dispatchEvent(new Event('change')); }
      results.highContrastApplied = document.body.classList.contains('high-contrast-mode');
      if (hcChk) { hcChk.checked = false; hcChk.dispatchEvent(new Event('change')); }
      const coordsChk = document.getElementById('set-show-coords');
      if (coordsChk) { coordsChk.checked = false; coordsChk.dispatchEvent(new Event('change')); }
      results.hideCoordsApplied = document.body.classList.contains('hide-coords');
      if (coordsChk) { coordsChk.checked = true; coordsChk.dispatchEvent(new Event('change')); }
      const preChk = document.getElementById('set-prematch-guide');
      if (preChk) { preChk.checked = false; preChk.dispatchEvent(new Event('change')); }
      results.settingsControlsCount = document.querySelectorAll('#screen-settings input, #screen-settings button').length;

      // 3. Modo Historia: 5 capítulos, Cap. 2-5 bloqueados inicialmente
      document.querySelector('[data-screen="story"]').click();
      await wait(200);
      const chapterTabs = [...document.querySelectorAll('#campaign-tabs-bar [data-campaign]')];
      results.chapterCount = chapterTabs.length;
      results.chapterIds = chapterTabs.map(t => t.dataset.campaign);
      results.mittensInitiallyLocked = document.querySelector('#campaign-tabs-bar [data-campaign="mittens"]')?.textContent.includes('🔒') || false;
      results.mayaLevels = [...document.querySelectorAll('#campaign-levels-container .campaign-level-card strong')].map(el => el.textContent.trim());
      results.mayaLv5InitiallyLocked = document.querySelectorAll('#campaign-levels-container .campaign-level-card')[4]?.classList.contains('locked') || false;

      // 4. Desbloquear secuencialmente los 5 capítulos vía API real para probar cada Jefe y Minijefe en vivo
      const token = localStorage.getItem('chess_mod_auth_token');
      const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
      const chapters = ['maya', 'mittens', 'galaxy', 'glitch', 'chess'];
      for (const ch of chapters) {
        for (let lv = 1; lv <= 5; lv++) {
          if (ch === 'chess' && lv === 5) continue;
          await fetch('/api/game/report', {
            method: 'POST',
            headers,
            body: JSON.stringify({ mode: ch + '_campaign', opponentName: ch + '_' + lv, winner: 'w', campaignId: ch, levelId: lv })
          });
        }
      }
      await window.chessModApp.refreshCurrentUser();
      window.chessModApp.renderCampaignScreen();
      await wait(200);
      results.allChaptersUnlockedAfterClear = !document.querySelector('#campaign-tabs-bar [data-campaign="chess"]')?.textContent.includes('🔒');

      // 5. Probar Dios Maya (Cap. 1 Lv. 5): SIN botón replay intro, con Ultimate Battle.mp3, Pirámide 2×2 y animación viva
      document.querySelector('#campaign-tabs-bar [data-campaign="maya"]').click();
      await wait(120);
      document.querySelectorAll('#campaign-levels-container .campaign-level-card button')[4].click();
      await wait(450);
      results.mayaIntroActive = document.getElementById('boss-intro-overlay').classList.contains('active');
      document.getElementById('btn-skip-intro').click();
      await wait(400);

      results.noReplayIntroButton = !document.getElementById('btn-replay-intro');
      const audio = document.getElementById('boss-music-audio');
      results.audioSrc = audio?.src || '';
      results.audioLoop = Boolean(audio?.loop);
      results.audioError = audio?.error ? audio.error.code : null;
      results.audioReadyState = audio?.readyState ?? -1;
      results.pyramidVisibleInLevel5 = !document.getElementById('pyramid-layer').classList.contains('hidden');

      const portraitEl = document.querySelector('#boss-portrait-slot .boss-portrait-svg, #boss-portrait-slot svg');
      const portraitAnim = portraitEl ? getComputedStyle(portraitEl).animationName : 'none';
      const portraitBoxAnim = document.getElementById('boss-portrait-slot') ? getComputedStyle(document.getElementById('boss-portrait-slot')).animationName : 'none';
      results.mayaPortraitAnimated = portraitAnim !== 'none' || portraitBoxAnim !== 'none';
      results.mayaPortraitAnimNames = { portraitAnim, portraitBoxAnim };

      // Verificar que al REINICIAR (btn-restart) NO se vuelve a reproducir la intro
      document.getElementById('btn-restart').click();
      await wait(300);
      results.mayaNoIntroOnRestart = !document.getElementById('boss-intro-overlay').classList.contains('active');

      // Verificar descuento real de 25 XP en Pista
      const xpBeforeHint = window.chessModApp.user.xp;
      document.getElementById('btn-hint').click();
      await wait(700);
      results.hintBannerVisible = document.getElementById('hint-banner').classList.contains('visible');
      results.xpSpentOnHint = xpBeforeHint - window.chessModApp.user.xp;

      // 6. Verificar Minijefes Capítulo 2 (con intro al entrar, SIN orejas ni cara de gato) + Free Mittens (con audio nuevo en loop + cadenas rotas + intro)
      document.getElementById('btn-battle-back').click();
      await wait(150);
      document.querySelector('[data-screen="story"]').click();
      await wait(120);
      document.querySelector('#campaign-tabs-bar [data-campaign="mittens"]').click();
      await wait(150);
      results.mittensLevels = [...document.querySelectorAll('#campaign-levels-container .campaign-level-card strong')].map(el => el.textContent.trim());

      // Verificar Hombre Peón (Lv. 1): tiene intro, retrato con IDs únicos (sin colisión con #app-shell.hidden!), SIN gato y SIN música de jefe
      document.querySelectorAll('#campaign-levels-container .campaign-level-card button')[0].click();
      await wait(350);
      results.hombrePeonIntroShown = document.getElementById('boss-intro-overlay').classList.contains('active');
      document.getElementById('btn-skip-intro').click();
      await wait(250);
      const pawnPortraitHtml = document.getElementById('boss-portrait-slot').innerHTML;
      results.hombrePeonHasNoCat = !pawnPortraitHtml.includes('mittens_ref.png') && !pawnPortraitHtml.includes('cat-ear') && !pawnPortraitHtml.includes(':3');
      // Verificar que los gradientes del retrato tienen IDs únicos que NO colisionan con el menú oculto
      const gradIdsInBattle = [...document.querySelectorAll('#boss-portrait-slot [id]')].map(el => el.id);
      const anyDuplicateGradId = gradIdsInBattle.some(id => document.querySelectorAll('#' + CSS.escape(id)).length > 1);
      results.portraitIdsUniqueNoHiddenCollision = gradIdsInBattle.length > 0 && !anyDuplicateGradId;
      results.minibossNoMusicPlaying = [...document.querySelectorAll('audio')].every(a => a.paused);
      document.getElementById('btn-battle-back').click();
      await wait(150);

      // Iniciar Free Mittens (Lv. 5): intro temática + audio FreeMittensBattle.mp3 en loop + cadenas rotas + mittens_ref.png + aspersor
      document.querySelector('[data-screen="story"]').click();
      await wait(100);
      document.querySelector('#campaign-tabs-bar [data-campaign="mittens"]').click();
      await wait(120);
      document.querySelectorAll('#campaign-levels-container .campaign-level-card button')[4].click();
      await wait(450);
      results.mittensIntroShown = document.getElementById('boss-intro-overlay').classList.contains('active')
        && document.getElementById('boss-intro-overlay').classList.contains('theme-mittens');
      document.getElementById('btn-skip-intro').click();
      await wait(350);
      const mittensAudio = document.getElementById('mittens-music-audio');
      results.mittensAudioSrc = mittensAudio?.src || '';
      results.mittensAudioLoop = Boolean(mittensAudio?.loop);
      results.mittensAudioError = mittensAudio?.error ? mittensAudio.error.code : null;
      results.mittensAudioReadyState = mittensAudio?.readyState ?? -1;

      // Reiniciar Free Mittens -> NO debe volver a poner intro
      document.getElementById('btn-restart').click();
      await wait(300);
      results.mittensNoIntroOnRestart = !document.getElementById('boss-intro-overlay').classList.contains('active');

      const fmHtml = document.getElementById('boss-portrait-slot').innerHTML;
      results.mittensRefImgLoaded = fmHtml.includes('/assets/images/mittens_ref.png');
      results.mittensHasChains = fmHtml.includes('chain') || fmHtml.includes('shackle') || fmHtml.includes('mittens-chain');
      results.mittensSprinklerRendered = Boolean(document.querySelector('.sprinkler-sq'));
      results.mittensPyramidHidden = document.getElementById('pyramid-layer').classList.contains('hidden');
      results.mittensBossDialogue = document.getElementById('boss-speech-text')?.textContent.trim() || '';

      // 7. Verificar Cap. 3 Lv. 5 (Entidad Galáctica): intro + Hombre Galaxia 2×2 + 2 Barreras Universales
      document.getElementById('btn-battle-back').click();
      await wait(150);
      document.querySelector('[data-screen="story"]').click();
      await wait(100);
      document.querySelector('#campaign-tabs-bar [data-campaign="galaxy"]').click();
      await wait(120);
      document.querySelectorAll('#campaign-levels-container .campaign-level-card button')[4].click();
      await wait(400);
      results.galaxyIntroShown = document.getElementById('boss-intro-overlay').classList.contains('theme-galaxy');
      document.getElementById('btn-skip-intro').click();
      await wait(300);
      results.galaxyManVisible = !document.getElementById('pyramid-layer').classList.contains('hidden')
        && document.getElementById('pyramid-layer').classList.contains('galaxy-man-mode')
        && document.getElementById('pyramid-layer').innerHTML.includes('Anclas');

      // 8. Verificar Cap. 4 Lv. 5 (Boss Glitch): intro temática + textura real glitch_texture.jpg
      document.getElementById('btn-battle-back').click();
      await wait(150);
      document.querySelector('[data-screen="story"]').click();
      await wait(100);
      document.querySelector('#campaign-tabs-bar [data-campaign="glitch"]').click();
      await wait(120);
      document.querySelectorAll('#campaign-levels-container .campaign-level-card button')[4].click();
      await wait(400);
      results.glitchIntroShown = document.getElementById('boss-intro-overlay').classList.contains('theme-glitch');
      document.getElementById('btn-skip-intro').click();
      await wait(250);
      results.glitchHasUploadedTexture = document.getElementById('boss-portrait-slot').innerHTML.includes('glitch_texture.jpg')
        && document.getElementById('board-grid').innerHTML.includes('glitch_texture.jpg');

      // 9. Verificar Cap. 5 Lv. 5 (CHESS): Modal obligatorio de 3 poderes + textura tablero de ajedrez + Súper IA Web Worker
      document.getElementById('btn-battle-back').click();
      await wait(150);
      document.querySelector('[data-screen="story"]').click();
      await wait(100);
      document.querySelector('#campaign-tabs-bar [data-campaign="chess"]').click();
      await wait(120);
      document.querySelectorAll('#campaign-levels-container .campaign-level-card button')[4].click();
      await wait(300);
      results.chessPowerModalOpen = document.getElementById('modal-chess-power').classList.contains('open');
      results.chessPowerChoicesCount = document.querySelectorAll('#modal-chess-power .power-choice-card').length;

      // Elegir Poder 3 (Galaxia) -> intro CHESS -> jugar e2->e4 -> esperar respuesta Web Worker Súper IA
      document.querySelector('[data-chess-power="galaxy"]').click();
      await wait(450);
      results.chessIntroShown = document.getElementById('boss-intro-overlay').classList.contains('theme-chess');
      document.getElementById('btn-skip-intro').click();
      await wait(350);
      results.chessHasBoardTexture = document.getElementById('boss-portrait-slot').innerHTML.includes('chessBoardTexPort')
        && document.getElementById('board-grid').innerHTML.includes('cbPieceTex');
      results.chessTeleportButtonVisible = !document.getElementById('chess-power-controls-card').classList.contains('hidden');

      // Hacer clic en e2 (fila 6, col 4 -> índice 52) y luego e4 (fila 4, col 4 -> índice 36)
      document.querySelectorAll('#board-grid .square')[6 * 8 + 4].click();
      await wait(120);
      document.querySelectorAll('#board-grid .square')[4 * 8 + 4].click();
      await wait(1600);
      const logs = [...document.querySelectorAll('#log-list .log-item')].map(el => el.textContent.trim());
      results.chessSuperAiResponded = logs.some(t => t.includes('CHESS:'));
      results.chessRecentLogs = logs.slice(0, 3);

      // 10. Verificar que BLACKY NO aparece en menús normales, pero SÍ se abre por URL /blacky (o #blacky)
      document.getElementById('btn-battle-back').click();
      await wait(150);
      const allMenuText = document.getElementById('app-shell').textContent.toLowerCase();
      results.blackyHiddenFromMenus = !allMenuText.includes('blacky');

      // Abrir por hash #blacky (igual que /blacky y /?boss=blacky)
      window.location.hash = '#blacky';
      await wait(450);
      results.blackyIntroShown = document.getElementById('boss-intro-overlay').classList.contains('active')
        && document.getElementById('boss-intro-overlay').classList.contains('theme-blacky');
      results.blackyIntroTitle = document.getElementById('intro-main-title-text')?.textContent.trim();
      document.getElementById('btn-skip-intro').click();
      await wait(350);
      const bkAudio = document.getElementById('blacky-music-audio');
      results.blackyAudioLoop = Boolean(bkAudio?.loop);
      results.blackyAudioReadyState = bkAudio?.readyState ?? -1;
      results.blackyHudVisible = !document.getElementById('blacky-hud-card').classList.contains('hidden');
      results.blackyMonumentVisible = !document.getElementById('blacky-boss-svg').classList.contains('hidden');
      results.blackyPortraitIsSchnauzer = document.getElementById('boss-portrait-slot').innerHTML.includes('blacky-portrait-svg');

      // Reiniciar Blacky -> NO debe repetir intro
      document.getElementById('btn-restart').click();
      await wait(300);
      results.blackyNoIntroOnRestart = !document.getElementById('boss-intro-overlay').classList.contains('active');

      // 11. Ranking Global muestra 0 Elo inicial + Pase de Batalla T1 + Tablero Colosal 12×12 + Vista Móvil
      window.location.hash = '';
      document.getElementById('btn-battle-back').click();
      await wait(150);
      document.querySelector('[data-screen="ranking"]').click();
      await wait(400);
      results.rankingRows = document.querySelectorAll('#ranking-tbody tr').length;
      results.rankingFirstText = document.querySelector('#ranking-tbody tr')?.textContent.replace(/\\s+/g, ' ').trim() || '';

      // 12. Verificar Pase de Batalla (50 niveles Gratis + Paga $10) DENTRO de la Tienda + Inventario separado
      document.querySelector('[data-screen="shop"]').click();
      await wait(200);
      document.querySelector('#bp-range-pills [data-bp-range="all"]')?.click();
      await wait(150);
      results.battlePassTiersRendered = document.querySelectorAll('#bp-tiers-grid .bp-tier-row').length;
      results.battlePassInsideShop = !document.getElementById('shop-battlepass-panel')?.classList.contains('hidden');
      results.battlePassPaidOnlyUsdBtn = Boolean(document.getElementById('btn-bp-buy-usd')) && !document.getElementById('btn-bp-buy-mods');

      document.querySelector('[data-screen="customize"]').click();
      await wait(150);
      results.inventoryScreenHasTabs = document.querySelectorAll('#inventory-tabs-bar [data-inv-tab]').length === 5;

      // 13. Verificar Tablero Colosal 12×12 (144 casillas jugables!)
      document.querySelector('[data-screen="play"]').click();
      await wait(150);
      document.querySelector('[data-start-special="special_colossal_12x12"]')?.click();
      await wait(400);
      results.colossal12x12Squares = document.querySelectorAll('#board-grid .square').length;
      document.getElementById('btn-battle-back').click();
      await wait(150);

      return results;
    })()`);

    fs.writeFileSync(outPath, JSON.stringify({ ok: true, consoleErrors, failedLoads, report }, null, 2));
  } catch (err) {
    fs.writeFileSync(outPath, JSON.stringify({ ok: false, error: err.stack || err.message, consoleErrors, failedLoads }, null, 2));
  } finally {
    win.destroy();
    await server.stop();
    try { fs.unlinkSync(tmpDb); } catch {}
    try { fs.unlinkSync(`${tmpDb}-wal`); } catch {}
    try { fs.unlinkSync(`${tmpDb}-shm`); } catch {}
    app.quit();
  }
});
