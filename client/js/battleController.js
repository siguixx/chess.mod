import { FILES, PIECE_NAMES, HINT_XP_COST, toAlg, formatClock } from '/shared/config/constants.js';
import { CAMPAIGN_MAP } from '/shared/config/campaigns.js';
import { MayaBossEngine } from '/shared/rules/mayaEngine.js';
import { MayaCampaignEngine } from '/shared/rules/mayaCampaignEngine.js';
import { FreeMittensEngine } from '/shared/rules/mittensEngine.js';
import { GalaxyEngine } from '/shared/rules/galaxyEngine.js';
import { GlitchEngine } from '/shared/rules/glitchEngine.js';
import { ChessFinalEngine } from '/shared/rules/chessFinalEngine.js';
import { BlackySecretEngine } from '/shared/rules/blackyEngine.js';
import { ClassicChessEngine } from '/shared/rules/classicEngine.js';
import { MayaBossAI } from '/shared/ai/mayaAI.js';
import { MayaCampaignAI } from '/shared/ai/mayaCampaignAI.js';
import { FreeMittensAI } from '/shared/ai/mittensAI.js';
import { GalaxyAI } from '/shared/ai/galaxyAI.js';
import { GlitchAI } from '/shared/ai/glitchAI.js';
import { ClassicAI } from '/shared/ai/classicAI.js';
import { SuperChessAI } from '/shared/ai/superChessAI.js';
import { HintEngine } from '/shared/ai/hintEngine.js';
import { SVGS, MITTENS_SVGS, GALAXY_SVGS, GLITCH_SVGS, CHESS_ORIGIN_SVGS, renderAvatarMarkup } from './svgs.js';
import { getBossPortraitSVG } from './portraits.js';
import { api } from './api.js';
import { mpSocket } from './socket.js';

const BOSS_DIALOGUES = {
  rey_maya: {
    introQuote: 'DESTRUYE MIS 4 BASES O DERROTA AL REY NEGRO',
    onCapture: ['Una pieza menos bajo el peso de la piedra sagrada.', 'Tus defensas se desmoronan ante el santuario.'],
    onHurt: ['¡Has fracturado uno de mis fundamentos! Pagarás esa osadía.', '¡Insolente! La piedra recuerda cada herida.'],
    onPower: ['¡Siente el temblor de la Pirámide 2×2!', 'Ninguna pieza sin refugio escapa del aplastamiento.'],
    onIdle: ['¿Dudas ante el altar del equilibrio? Mueve ya.', 'El tiempo del templo no perdona la indecisión.']
  },
  free_mittens: {
    introQuote: 'CADENAS CÓSMICAS ROTAS · SABIO ANCESTRAL DE LA GALAXIA',
    onCapture: ['Cada pieza que pierdes revela la fragilidad de tus leyes.', 'La sabiduría prohibida asimila lo que el orgullo descuida.'],
    onHurt: ['Un golpe certero... pero eras de encierro forjaron mi serenidad.', '¿Agua contra un sabio del cosmos? Curiosa insolencia.'],
    onPower: ['Observa cómo el tablero obedece una ley superior.', 'Asimilación exacta. Ni más ni menos de lo que sacrificaste.'],
    onIdle: ['Medita tu siguiente paso; el cosmos no tiene prisa, pero sí memoria.', 'Incluso en silencio, el desequilibrio habla por ti.']
  },
  hombre_peon: {
    onCapture: ['Mi infantería reclama tu forma exacta.', 'Un peón avanza y asciende en el acto.'],
    onHurt: ['Un peón cae, otros ocupan su lugar.'],
    onIdle: ['La primera línea espera tu decisión.']
  },
  hombre_caballo: {
    onCapture: ['El salto en L toma tu rango.', 'Ninguna muralla detiene la caballería.'],
    onHurt: ['Buen bloqueo... pero mis saltos persisten.'],
    onIdle: ['Calcula los saltos o perderás tu flanco.']
  },
  hombre_alfil: {
    onCapture: ['La diagonal dicta su sentencia y hereda tu pieza.', 'Precisión geométrica absoluta.'],
    onHurt: ['Cortaste una línea, mas quedan otras.'],
    onIdle: ['Vigila las diagonales largas.']
  },
  mujer_reina: {
    onCapture: ['Mi corona no desciende: tu pieza ahora sirve a mi corte.', 'Asimilación real completada.'],
    onHurt: ['Atrevido... sentirás el peso de la corona.'],
    onIdle: ['Una reina no espera eternamente.']
  },
  galaxy_entity: {
    introQuote: 'EL PESO DE LAS ESTRELLAS · HOMBRE GALAXIA 2×2',
    onCapture: ['El polvo estelar reclama tus piezas.', 'Liberaste a Free Mittens; ahora afronta la ira cósmica.'],
    onHurt: ['¡Has destruido uno de mis anclajes astrales! ¡Mortal imprudente!', '¡Mi constelación tiembla! No tocarás el núcleo.'],
    onPower: ['El espacio se pliega ante mi voluntad.', '¡El Hombre Galaxia 2×2 barre la columna entera!'],
    onIdle: ['Las estrellas observan tu vacilación.', 'Cada segundo te acerca al colapso gravitatorio.']
  },
  boss_glitch: {
    introQuote: 'FATAL_REALITY_TEAR :: CORRUPCIÓN DE CHESS.MOD',
    onCapture: ['MEM_LEAK:: Tu pieza ha sido sobreescrita.', 'EXCEPTION_CAPTURED:: Tus reglas ya no compilan.'],
    onHurt: ['ERR_DAMAGE:: ¡Inestabilidad crítica! Aumentando rasgado.', 'SEGMENTATION_FAULT:: ¡No puedes depurarme!'],
    onPower: ['BOARD_TEAR:: ¡El tablero se desgarra en grietas de vacío!', 'RULE_OVERRIDE:: Anomalía ejecutada.'],
    onIdle: ['TIMEOUT_WARNING:: ¿Se congeló tu mente o el universo?', 'WAIT_LOOP:: Decide antes de que el tablero se fracture.']
  },
  chess_god: {
    introQuote: 'ESTRATEGIA PURA · EL ORIGEN DEL JUEGO',
    onCapture: ['Una imprecisión táctica. Consecuencia inevitable.', 'Cálculo exacto. Sin poderes, solo verdad.'],
    onHurt: ['Jugada respetable. Profundizando variante.', 'Buen hallazgo táctico. Veamos si sostienes la posición.'],
    onPower: ['Tu poder elegido es interesante. Mi respuesta es superior.'],
    onIdle: ['El silencio del tablero espera tu mejor jugada.', 'En el ajedrez puro, cada tiempo cuenta.']
  },
  blacky_secret: {
    introQuote: 'DIFICULTAD: IMPOSIBLE',
    onCapture: ['Grr... tu ejército me alimenta.', '¡Guau! Demasiado lento para mis colmillos.'],
    onHurt: ['Grrr... ¿osaste morder a BLACKY? Ahora verás el vacío.', 'Un rasguño insignificante. ¡Pronto sellaré tu tablero entero!'],
    onSeal: ['Grr... ese casillero ya no te pertenece.', '¡Zarpa Sombría! Cada ruta de tu Rey se cierra.'],
    onSummon: ['¡El vacío obedece mi ladrido! Nuevas piezas emergen de la nada.', '¿Creías que te quedabas sin enemigos? Aquí tienes más.'],
    onAbsorb: ['Tu ejército me alimenta... ¡Devoración Sombría!', 'Grr... deliciosa pieza. Mis poderes se aceleran.'],
    onBetray: ['¿Creíste que esa pieza luchaba por ti? Ahora obedece a BLACKY.', '¡Traición! Tus propias piezas giran contra tu Rey.'],
    onIdle: ['Grr... ¿tiemblas frente al Schnauzer imposible?', 'Mueve de una vez antes de que selle el tablero entero.']
  }
};

function pickLine(pool) {
  if (!pool || !pool.length) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

export class BattleController {
  constructor({ sound, vfx, toast, onUserUpdated, onExitToMenu }) {
    this.sound = sound;
    this.vfx = vfx;
    this.toast = toast;
    this.onUserUpdated = onUserUpdated;
    this.onExitToMenu = onExitToMenu;

    this.mode = 'classic'; // 'maya' | 'maya_campaign' | 'mittens' | 'galaxy' | 'glitch' | 'chess_final' | 'classic' | 'online'
    this.engine = new ClassicChessEngine(10);
    this.bossId = 'classic_ai';
    this.bossName = 'IA Clásica';
    this.aiDifficulty = 3;
    this.campaignMeta = null;
    this.onlineMeta = null;

    this.selectedMinutes = 10;
    this.showThreats = true;
    this.paused = true;
    this.introPlaying = false;
    this.phase = 'PLAYER_TURN';

    this.selected = null;
    this.legalMoves = [];
    this.soldierMode = null;
    this.playerTeleportMode = false;
    this.lastSoldierClick = { r: -1, c: -1, ts: 0 };
    this.hintSquares = null;
    this.pendingPromoMove = null;
    this.pendingChessLevelCfg = null;

    this.speechTimer = null;
    this.moodTimer = null;
    this.idleTauntTimer = null;
    this.introTimers = [];
    this.lastClockTick = performance.now();

    // Web Worker dedicado para la Súper IA de CHESS (Cap. 5)
    this.superWorker = null;
    this.workerReqId = 0;
    this.workerCallbacks = new Map();
    this.initSuperAiWorker();

    this.bindUI();
    this.bindOnlineEvents();
    this.startClockLoop();
  }

  initSuperAiWorker() {
    try {
      this.superWorker = new Worker('/js/superAiWorker.js', { type: 'module' });
      this.superWorker.onmessage = (e) => {
        const { id, ok, result, error } = e.data || {};
        const cb = this.workerCallbacks.get(id);
        if (!cb) return;
        this.workerCallbacks.delete(id);
        if (ok) cb.resolve(result);
        else cb.reject(new Error(error || 'Error en Súper IA'));
      };
    } catch {
      this.superWorker = null;
    }
  }

  runSuperAiAsync(state, options) {
    if (!this.superWorker) {
      const localAi = new SuperChessAI();
      return Promise.resolve(localAi.chooseBestMove(state, options));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.workerReqId;
      this.workerCallbacks.set(id, { resolve, reject });
      this.superWorker.postMessage({ id, state, options });
    });
  }

  bindUI() {
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

    on('btn-battle-back', 'click', () => this.exitBattle());
    on('btn-hint', 'click', () => this.requestHint());
    on('btn-close-hint', 'click', () => {
      this.hintSquares = null;
      document.getElementById('hint-banner')?.classList.remove('visible');
      this.render();
    });
    on('btn-undo', 'click', () => this.undoMove());
    on('btn-restart', 'click', () => this.restartCurrentMatch());
    on('btn-threats', 'click', () => {
      this.showThreats = !this.showThreats;
      const b = document.getElementById('btn-threats');
      if (b) {
        b.classList.toggle('active', this.showThreats);
        b.textContent = this.showThreats ? 'Ocultar amenazas' : 'Mostrar amenazas';
      }
      this.render();
    });
    on('btn-skip-intro', 'click', () => this.skipBossIntro());

    // Teletransporte Galáctico activo del jugador (Cap. 5 con Poder de la Galaxia)
    on('btn-player-teleport', 'click', () => {
      if (this.mode !== 'chess_final' || this.engine.playerPower !== 'galaxy' || this.phase !== 'PLAYER_TURN') return;
      if (this.engine.playerTeleportCooldown > 0) {
        this.toast(`Teletransporte en enfriamiento (${this.engine.playerTeleportCooldown} turnos).`, 'info');
        return;
      }
      this.playerTeleportMode = !this.playerTeleportMode;
      this.selected = null;
      this.legalMoves = [];
      this.toast(this.playerTeleportMode ? 'Teletransporte activo: selecciona una pieza blanca (no Rey) y elige destino vacío.' : 'Teletransporte cancelado.', 'info');
      this.render();
    });

    // Selección obligatoria de poder antes de CHESS (Cap. 5 Nivel 5)
    document.querySelectorAll('[data-chess-power]').forEach((card) => {
      card.addEventListener('click', () => {
        const power = card.dataset.chessPower;
        const cfg = this.pendingChessLevelCfg;
        this.pendingChessLevelCfg = null;
        document.getElementById('modal-chess-power')?.classList.remove('open');
        if (cfg) this.launchChessFinalWithPower(cfg, power);
      });
    });
    on('btn-cancel-chess-power', 'click', () => {
      this.pendingChessLevelCfg = null;
      document.getElementById('modal-chess-power')?.classList.remove('open');
    });

    // Online buttons
    on('btn-online-resign', 'click', () => {
      if (this.mode === 'online' && this.onlineMeta?.matchId) mpSocket.emit('match:resign', { matchId: this.onlineMeta.matchId });
    });
    on('btn-online-draw', 'click', () => {
      if (this.mode === 'online' && this.onlineMeta?.matchId) {
        mpSocket.emit('match:offer_draw', { matchId: this.onlineMeta.matchId });
        this.toast('Oferta de tablas enviada al rival.', 'info');
      }
    });
    on('btn-accept-draw', 'click', () => {
      if (this.onlineMeta?.matchId) mpSocket.emit('match:respond_draw', { matchId: this.onlineMeta.matchId, accept: true });
      document.getElementById('modal-draw-offer')?.classList.remove('open');
    });
    on('btn-decline-draw', 'click', () => {
      if (this.onlineMeta?.matchId) mpSocket.emit('match:respond_draw', { matchId: this.onlineMeta.matchId, accept: false });
      document.getElementById('modal-draw-offer')?.classList.remove('open');
    });

    document.querySelectorAll('[data-promo]').forEach((btn) => {
      btn.addEventListener('click', () => this.resolvePromotion(btn.dataset.promo));
    });

    on('btn-gameover-rematch', 'click', () => this.restartCurrentMatch());
    on('btn-gameover-menu', 'click', () => this.exitBattle());

    // Seguimiento ocular del jefe
    document.addEventListener('mousemove', (e) => {
      if (this.vfx.reduced) return;
      const dx = Math.max(-5, Math.min(5, ((e.clientX / window.innerWidth) - 0.5) * 10));
      const dy = Math.max(-3, Math.min(4, ((e.clientY / window.innerHeight) - 0.35) * 7));
      document.querySelectorAll('.js-tracked-eyes').forEach((el) => {
        el.setAttribute('transform', `translate(${(dx * 0.55).toFixed(1)}, ${(dy * 0.55).toFixed(1)})`);
      });
      const mayaBgEyes = document.getElementById('boss-eyes-group');
      if (mayaBgEyes) mayaBgEyes.setAttribute('transform', `translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`);
    });

    document.addEventListener('pointerdown', () => {
      if (this.sound.musicWanted && !this.paused) {
        this.sound.ensureMusicPlayingOnGesture();
      }
    });
  }

  bindOnlineEvents() {
    mpSocket.on('match:state', ({ matchId, state, events }) => {
      if (this.mode !== 'online' || this.onlineMeta?.matchId !== matchId) return;
      this.engine.loadState(state);
      this.selected = null;
      this.legalMoves = [];
      this.phase = this.engine.winner
        ? 'GAME_OVER'
        : (this.engine.turn === this.onlineMeta.yourColor ? 'PLAYER_TURN' : 'AI_THINKING');
      this.sound.play(events?.captured ? 'capture' : 'move');
      if (events?.to) {
        const [vr, vc] = this.toVisualCoords(events.to[0], events.to[1]);
        this.vfx.spawnSquareBurst(vr, vc, events.captured ? '#e05a4a' : '#cfa64c', 12, 2.2);
      }
      this.render();
    });

    mpSocket.on('match:clock', ({ matchId, clocks }) => {
      if (this.mode !== 'online' || this.onlineMeta?.matchId !== matchId) return;
      this.engine.clocks = clocks;
      this.renderClocks();
    });

    mpSocket.on('match:draw_offered', ({ matchId }) => {
      if (this.mode !== 'online' || this.onlineMeta?.matchId !== matchId) return;
      document.getElementById('modal-draw-offer')?.classList.add('open');
    });

    mpSocket.on('match:draw_declined', () => this.toast('Tu rival rechazó la oferta de tablas.', 'info'));
    mpSocket.on('match:error', ({ error }) => this.toast(error || 'Jugada rechazada por el servidor.', 'error'));

    mpSocket.on('match:ended', (payload) => {
      if (this.mode !== 'online' || this.onlineMeta?.matchId !== payload.matchId) return;
      this.engine.loadState(payload.state);
      this.phase = 'GAME_OVER';
      this.render();

      const myColor = this.onlineMeta.yourColor;
      const myProfile = myColor === 'w' ? payload.whiteProfile : payload.blackProfile;
      const myDelta = myColor === 'w' ? payload.eloUpdate.whiteDelta : payload.eloUpdate.blackDelta;
      const myXp = myColor === 'w' ? payload.whiteXpGained : payload.blackXpGained;
      if (myProfile) this.onUserUpdated(myProfile);

      const isWin = payload.winner === myColor;
      const isDraw = payload.winner === 'draw';
      this.sound.play(isWin ? 'victory' : (isDraw ? 'hint' : 'defeat'));

      const title = isDraw ? 'Tablas' : (isWin ? '¡Victoria Online!' : 'Derrota Online');
      const eloSign = myDelta >= 0 ? `+${myDelta}` : `${myDelta}`;
      this.openGameOverModal({
        title,
        desc: payload.reason,
        extraHtml: `
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Elo competitivo:</span>
            <strong style="color:${myDelta >= 0 ? '#9ce0be' : '#ffaca3'};">${myProfile?.elo ?? 0} (${eloSign})</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Experiencia ganada:</span>
            <strong style="color:var(--gold-bright);">+${myXp} XP</strong>
          </div>`
      });
    });
  }

  /* ================= INICIADORES POR CAPÍTULO Y MODO ================= */
  showBattleScreen() {
    document.getElementById('app-shell')?.classList.add('hidden');
    document.getElementById('view-battle')?.classList.remove('hidden');
    document.getElementById('modal-gameover')?.classList.remove('open');
    document.getElementById('hint-banner')?.classList.remove('visible');
    this.selected = null;
    this.legalMoves = [];
    this.soldierMode = null;
    this.playerTeleportMode = false;
    this.hintSquares = null;
    this.vfx.resize();
  }

  exitBattle() {
    this.clearIntroTimers();
    this.stopIdleTauntTimer();
    this.paused = true;
    this.sound.stopBossMusic();
    document.getElementById('boss-intro-overlay')?.classList.remove('active');
    document.getElementById('modal-gameover')?.classList.remove('open');
    document.getElementById('view-battle')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');
    if (this.mode === 'online' && this.onlineMeta?.matchId && !this.engine.winner) {
      mpSocket.emit('match:resign', { matchId: this.onlineMeta.matchId });
    }
    this.onExitToMenu();
  }

  startCampaignLevel(campaignId, levelCfg, minutes = this.selectedMinutes, { playIntro = true, presetPower = null } = {}) {
    if (campaignId === 'maya') {
      if (levelCfg.id === 5) return this.startMayaBoss({ campaignMeta: { campaignId, levelId: 5, levelCfg }, minutes, playIntro });
      return this.startMayaCampaignLevel(levelCfg, minutes, { playIntro });
    }
    if (campaignId === 'mittens') {
      return this.startMittensLevel(levelCfg, minutes, { playIntro });
    }
    if (campaignId === 'galaxy') {
      return this.startGalaxyLevel(levelCfg, minutes, { playIntro });
    }
    if (campaignId === 'glitch') {
      return this.startGlitchLevel(levelCfg, minutes, { playIntro });
    }
    if (campaignId === 'chess') {
      if (levelCfg.id === 5 && levelCfg.requiresPowerChoice && !presetPower) {
        this.pendingChessLevelCfg = levelCfg;
        document.getElementById('modal-chess-power')?.classList.add('open');
        return;
      }
      return this.launchChessFinalWithPower(levelCfg, presetPower || null, minutes, { playIntro });
    }
  }

  startMayaBoss({ campaignMeta = null, minutes = this.selectedMinutes, playIntro = true } = {}) {
    this.mode = 'maya';
    this.bossId = 'rey_maya';
    this.bossName = 'Dios Maya';
    this.aiDifficulty = campaignMeta?.levelCfg?.aiDifficulty || 3;
    this.campaignMeta = campaignMeta;
    this.onlineMeta = null;
    this.engine = new MayaBossEngine(minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();
    // Música oficial Ultimate Battle.mp3 en loop automático
    this.sound.startBossMusic('maya', playIntro);
    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-maya',
        kicker: 'CAPÍTULO 01 · BOSS FIGHT',
        title: 'DIOS MAYA',
        subtitle: 'DESTRUYE LAS 4 BASES O DA JAQUE MATE AL REY NEGRO',
        bossId: 'rey_maya',
        openingSpeech: campaignMeta?.levelCfg?.openingLine || 'Has profanado el santuario. Destruye mis 4 Bases si te atreves.',
        sfx: 'introBoom'
      });
    } else {
      this.paused = false;
      this.showBossSpeech(campaignMeta?.levelCfg?.openingLine || '¿Otra vez intentas desafiar el santuario?');
      this.resetIdleTauntTimer();
    }
  }

  startMayaCampaignLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'maya_campaign';
    this.bossId = levelCfg.bossId;
    this.bossName = `Nv.${levelCfg.id} · ${levelCfg.name}`;
    this.aiDifficulty = levelCfg.aiDifficulty;
    this.campaignMeta = { campaignId: 'maya', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new MayaCampaignEngine(levelCfg.id, minutes);
    this.sound.startBossMusic('maya_campaign', playIntro);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();
    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-maya',
        kicker: `CAPÍTULO 01 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name.toUpperCase(),
        subtitle: (levelCfg.unitIntroduced || 'GUARDIÁN DEL SANTUARIO').toUpperCase(),
        bossId: levelCfg.bossId,
        openingSpeech: levelCfg.openingLine,
        sfx: 'introBoom'
      });
    } else {
      this.paused = false;
      this.showBossSpeech(levelCfg.openingLine);
      this.resetIdleTauntTimer();
    }
  }

  startMittensLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'mittens';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 4;
    this.campaignMeta = { campaignId: 'mittens', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new FreeMittensEngine(levelCfg.bossId, minutes);

    if (levelCfg.id === 5) {
      // Música oficial de Free Mittens en loop automático
      this.sound.startBossMusic('mittens', playIntro);
    } else {
      this.sound.stopBossMusic();
    }

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-mittens',
        kicker: levelCfg.id === 5 ? 'CAPÍTULO 02 · BOSS FIGHT' : `CAPÍTULO 02 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name.toUpperCase(),
        subtitle: levelCfg.id === 5 ? 'SABIO ANCESTRAL DE LA GALAXIA · CADENAS ROTAS' : (levelCfg.unitIntroduced || 'CONVERSIÓN EXACTA').toUpperCase(),
        bossId: levelCfg.bossId,
        openingSpeech: levelCfg.openingLine,
        sfx: levelCfg.id === 5 ? 'chainBreak' : 'introBoom'
      });
    } else {
      this.paused = false;
      this.showBossSpeech(levelCfg.openingLine);
      this.resetIdleTauntTimer();
    }
  }

  startGalaxyLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'galaxy';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 4;
    this.campaignMeta = { campaignId: 'galaxy', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new GalaxyEngine(levelCfg.id, minutes);
    this.sound.startBossMusic('galaxy', playIntro);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-galaxy',
        kicker: levelCfg.id === 5 ? 'CAPÍTULO 03 · BOSS FIGHT' : `CAPÍTULO 03 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name.toUpperCase(),
        subtitle: levelCfg.id === 5 ? 'ELIMINA TODOS LOS ALFILES Y CABALLOS PARA QUEBRAR EL NÚCLEO 2×2' : (levelCfg.unitIntroduced || 'ORDEN CÓSMICO').toUpperCase(),
        bossId: levelCfg.bossId,
        openingSpeech: levelCfg.openingLine,
        sfx: 'galaxyTeleport'
      });
    } else {
      this.paused = false;
      this.showBossSpeech(levelCfg.openingLine);
      this.resetIdleTauntTimer();
    }
  }

  startGlitchLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'glitch';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 5;
    this.campaignMeta = { campaignId: 'glitch', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new GlitchEngine(levelCfg.id, minutes);
    this.sound.startBossMusic('glitch', playIntro);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-glitch',
        kicker: levelCfg.id === 5 ? 'CAPÍTULO 04 · SÚPER DIFÍCIL' : `CAPÍTULO 04 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name.toUpperCase(),
        subtitle: levelCfg.id === 5 ? 'ERR_FATAL:: CHESS.MOD SE HA CORROMPIDO' : (levelCfg.unitIntroduced || 'ANOMALÍA DETECTADA').toUpperCase(),
        bossId: levelCfg.bossId,
        openingSpeech: levelCfg.openingLine,
        sfx: 'glitchTear'
      });
    } else {
      this.paused = false;
      this.showBossSpeech(levelCfg.openingLine);
      this.resetIdleTauntTimer();
    }
  }

  launchChessFinalWithPower(levelCfg, chosenPower, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'chess_final';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = 5;
    this.campaignMeta = { campaignId: 'chess', levelId: levelCfg.id, levelCfg, chosenPower };
    this.onlineMeta = null;
    this.engine = new ChessFinalEngine(levelCfg.id, chosenPower, minutes);
    this.sound.startBossMusic('chess', playIntro);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-chess',
        kicker: levelCfg.id === 5 ? 'CAPÍTULO 05 · JEFE FINAL ABSOLUTO' : `CAPÍTULO 05 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name.toUpperCase(),
        subtitle: levelCfg.id === 5 ? 'SIN PODERES SOBRENATURALES · ESTRATEGIA PURA' : 'PLANO PURO · SÚPER IA',
        bossId: levelCfg.bossId,
        openingSpeech: levelCfg.openingLine,
        sfx: 'introBoom'
      });
    } else {
      this.paused = false;
      this.showBossSpeech(levelCfg.openingLine);
      this.resetIdleTauntTimer();
    }
  }

  startClassicMatch({ difficulty = 3, label = 'Vs IA', minutes = this.selectedMinutes } = {}) {
    this.mode = 'classic';
    this.bossId = 'classic_ai';
    this.bossName = `${label} (IA Nv.${difficulty})`;
    this.aiDifficulty = difficulty;
    this.campaignMeta = null;
    this.onlineMeta = null;
    this.engine = new ClassicChessEngine(minutes);
    this.sound.stopBossMusic();

    this.showBattleScreen();
    this.configureBattlePanels();
    this.paused = false;
    this.phase = 'PLAYER_TURN';
    this.render();
  }

  startOnlineMatch(matchPayload) {
    this.mode = 'online';
    this.bossId = 'online_opponent';
    this.bossName = `${matchPayload.opponent.username} (${matchPayload.opponent.elo} Elo)`;
    this.campaignMeta = null;
    this.onlineMeta = {
      matchId: matchPayload.matchId,
      yourColor: matchPayload.yourColor,
      opponent: matchPayload.opponent,
      white: matchPayload.white,
      black: matchPayload.black
    };
    this.engine = new ClassicChessEngine(matchPayload.timeMinutes);
    this.engine.loadState(matchPayload.state);
    this.sound.stopBossMusic();

    this.showBattleScreen();
    this.configureBattlePanels();
    this.paused = false;
    this.phase = this.engine.turn === this.onlineMeta.yourColor ? 'PLAYER_TURN' : 'AI_THINKING';
    this.render();
    this.toast(`¡Rival encontrado! ${matchPayload.opponent.username} (${matchPayload.opponent.elo} Elo)`, 'success');
  }

  startBlackySecretBoss({ playIntro = true, minutes = this.selectedMinutes } = {}) {
    this.mode = 'blacky';
    this.bossId = 'blacky_secret';
    this.bossName = 'BLACKY (Imposible)';
    this.aiDifficulty = 5;
    this.campaignMeta = null;
    this.onlineMeta = null;
    this.engine = new BlackySecretEngine(minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();
    // Música oficial de BLACKY en loop automático
    this.sound.startBossMusic('blacky', playIntro);

    if (playIntro) {
      this.playBossCinematicIntro({
        themeClass: 'theme-blacky',
        kicker: 'SECRET BOSS',
        title: 'BLACKY',
        subtitle: 'DIFICULTAD: IMPOSIBLE',
        bossId: 'blacky_secret',
        openingSpeech: 'Grr... encontraste la puerta oculta. Nadie sale vivo del tablero de BLACKY.',
        sfx: 'blackyBark'
      });
    } else {
      this.paused = false;
      this.showBossSpeech('Grr... ¿quieres intentar lo imposible otra vez?');
      this.resetIdleTauntTimer();
    }
  }

  restartCurrentMatch() {
    if (this.mode === 'online') return this.exitBattle();
    // Al reiniciar la partida NO se vuelve a reproducir la intro de ningún jefe
    if (this.mode === 'blacky') {
      return this.startBlackySecretBoss({ playIntro: false, minutes: this.selectedMinutes });
    }
    if (this.campaignMeta) {
      return this.startCampaignLevel(
        this.campaignMeta.campaignId,
        this.campaignMeta.levelCfg,
        this.selectedMinutes,
        { playIntro: false, presetPower: this.campaignMeta.chosenPower || null }
      );
    }
    this.startClassicMatch({ difficulty: this.aiDifficulty, minutes: this.selectedMinutes });
  }

  configureBattlePanels() {
    const isMayaBoss = this.mode === 'maya';
    const isMayaCamp = this.mode === 'maya_campaign';
    const isMittens = this.mode === 'mittens';
    const isGalaxy = this.mode === 'galaxy';
    const isGlitch = this.mode === 'glitch';
    const isChessFinal = this.mode === 'chess_final';
    const isBlacky = this.mode === 'blacky';
    const isOnline = this.mode === 'online';
    const has2x2Layer = isMayaBoss || (isGalaxy && this.engine.hasGalaxyMan);

    document.getElementById('temple-backdrop-svg')?.classList.toggle('hidden', !(isMayaBoss || isBlacky));
    document.getElementById('mayan-boss-svg')?.classList.toggle('hidden', !isMayaBoss);
    document.getElementById('blacky-boss-svg')?.classList.toggle('hidden', !isBlacky);
    document.getElementById('pyramid-layer')?.classList.toggle('hidden', !has2x2Layer);

    document.getElementById('maya-hud-card')?.classList.toggle('hidden', !isMayaBoss);
    document.getElementById('maya-campaign-hud-card')?.classList.toggle('hidden', !(isMayaCamp || isGalaxy || isGlitch || isChessFinal));
    document.getElementById('mittens-hud-card')?.classList.toggle('hidden', !isMittens);
    document.getElementById('blacky-hud-card')?.classList.toggle('hidden', !isBlacky);
    document.getElementById('online-hud-card')?.classList.toggle('hidden', !isOnline);
    document.getElementById('maya-threats-card')?.classList.toggle('hidden', !(isMayaBoss || isMayaCamp || isGalaxy));
    document.getElementById('mittens-controls-card')?.classList.toggle('hidden', !(isMittens && this.engine.hasWhiteSoldiers));
    document.getElementById('chess-power-controls-card')?.classList.toggle('hidden', !(isChessFinal && this.engine.playerPower === 'galaxy'));
    document.getElementById('online-controls-card')?.classList.toggle('hidden', !isOnline);

    document.getElementById('btn-undo')?.classList.toggle('hidden', isOnline);
    document.getElementById('btn-hint')?.classList.toggle('hidden', isOnline);
    document.getElementById('btn-restart')?.classList.toggle('hidden', isOnline);

    const portraitSlot = document.getElementById('boss-portrait-slot');
    const portraitName = document.getElementById('boss-portrait-name');
    const portraitStatus = document.getElementById('boss-portrait-status');
    const speaker = document.getElementById('boss-speech-speaker');

    if (isOnline && this.onlineMeta) {
      const opp = this.onlineMeta.opponent;
      if (portraitSlot) {
        portraitSlot.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px;background:radial-gradient(circle at 50% 30%, #2a241b, #14120f);">
          <div class="avatar-badge ${opp.frameId || 'frame_stone'}" style="width:94px;height:94px;">${renderAvatarMarkup(opp.avatar)}</div>
          <div style="text-align:center;">
            <div style="font-family:var(--font-display);font-weight:700;color:var(--gold-bright);">${opp.username}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Elo ${opp.elo} · Nivel ${opp.level}</div>
          </div>
        </div>`;
      }
      if (portraitName) portraitName.textContent = opp.username;
      if (portraitStatus) portraitStatus.textContent = `Elo ${opp.elo}`;
    } else {
      if (portraitSlot) portraitSlot.innerHTML = getBossPortraitSVG(this.bossId);
      if (portraitName) portraitName.textContent = this.bossName;
      if (portraitStatus) portraitStatus.textContent = 'Observando';
      if (speaker) speaker.textContent = this.bossName;
    }

    const topLabel = document.getElementById('clock-top-label');
    const bottomLabel = document.getElementById('clock-bottom-label');
    if (isOnline && this.onlineMeta) {
      if (topLabel) topLabel.textContent = `${this.onlineMeta.opponent.username} (${this.onlineMeta.opponent.elo} Elo)`;
      if (bottomLabel) bottomLabel.textContent = `Tú (${this.onlineMeta.yourColor === 'w' ? 'Blancas' : 'Negras'})`;
    } else {
      if (topLabel) topLabel.textContent = this.bossName;
      if (bottomLabel) bottomLabel.textContent = 'Tú (Blancas)';
    }

    const legend = document.getElementById('battle-legend');
    if (legend) {
      if (isMayaBoss) {
        legend.innerHTML = `<span class="legend-item"><span class="swatch" style="background:rgba(201,75,60,0.58)"></span>Amenaza Pirámide 2×2</span><span class="legend-item"><span class="swatch" style="border:2px solid #efd083"></span>Escudo Casa</span>`;
      } else if (isMayaCamp) {
        legend.innerHTML = `<span class="legend-item"><span class="swatch" style="background:rgba(201,75,60,0.45)"></span>Rango Arquera</span><span class="legend-item"><span class="swatch" style="border:2px solid #efd083"></span>Casa Inmortal (escuda contra poderes Maya)</span>`;
      } else if (isGalaxy) {
        legend.innerHTML = this.engine.hasGalaxyMan
          ? `<span class="legend-item">🌌 Hombre Galaxia 2×2 (Torre) · Elimina TODOS los Alfiles y Caballos</span><span class="legend-item"><span class="swatch" style="border:2px solid #9d8df2"></span>Barrera Universal</span>`
          : `<span class="legend-item">🌌 Piezas Galácticas · Teletransporte cada ${this.engine.teleportMaxCooldown}t · 2 Barreras Universales</span>`;
      } else if (isGlitch) {
        legend.innerHTML = `<span class="legend-item"><span class="swatch" style="background:#3a1a1f;border:1px solid #c94b3c"></span>Grietas de Vacío</span><span class="legend-item"><span class="swatch" style="border:2px solid #9d8df2"></span>Cortafuegos (sellan Grietas y bloquean anomalías)</span>`;
      } else if (isMittens) {
        legend.innerHTML = this.engine.isFreeMittensBoss
          ? `<span class="legend-item">⛓️ Sabio Free Mittens · Conversión exacta 1:1</span><span class="legend-item">🔫 Soldados: 1 clic dispara · Doble clic mueve</span>`
          : `<span class="legend-item">♟️ ${this.bossName}</span><span class="legend-item">🔫 Soldados de Agua: 1 clic dispara · Doble clic mueve</span>`;
      } else if (isChessFinal) {
        legend.innerHTML = `<span class="legend-item">👑 CHESS · Ajedrez 100% Limpio</span>`;
      } else if (isBlacky) {
        legend.innerHTML = `<span class="legend-item">🐾 SECRET BOSS: BLACKY (IMPOSIBLE) · Sello · Invocación · Absorción · Traición</span>`;
      } else if (isOnline) {
        legend.innerHTML = `<span class="legend-item">🌐 Multijugador Online · Elo Competitivo desde 0</span>`;
      } else {
        legend.innerHTML = `<span class="legend-item">♟️ Ajedrez Clásico CHESS.MOD</span>`;
      }
    }
  }

  /* ================= INTRO CINEMATOGRÁFICA PARA TODOS LOS JEFES FINALES (CAP. 1-5) ================= */
  clearIntroTimers() {
    for (const t of this.introTimers) clearTimeout(t);
    this.introTimers = [];
  }

  playBossCinematicIntro({ themeClass, kicker, title, subtitle, bossId, openingSpeech, sfx = 'introBoom' }) {
    this.clearIntroTimers();
    this.introPlaying = true;
    this.paused = true;
    this.pendingIntroSpeech = openingSpeech;

    const overlay = document.getElementById('boss-intro-overlay');
    if (!overlay) { this.finishBossIntro(); return; }

    document.getElementById('intro-kicker-text').textContent = kicker;
    document.getElementById('intro-main-title-text').textContent = title;
    document.getElementById('intro-subtitle-text').textContent = subtitle;
    const pSlot = document.getElementById('intro-portrait-slot');
    if (pSlot) pSlot.innerHTML = getBossPortraitSVG(bossId);

    overlay.className = `active ${themeClass || ''}`;
    void overlay.offsetWidth;
    this.vfx.setIntroMode(true);
    this.sound.play(sfx);

    this.introTimers.push(setTimeout(() => overlay.classList.add('bars-in'), 40));
    this.introTimers.push(setTimeout(() => overlay.classList.add('phase-emerge'), 580));
    this.introTimers.push(setTimeout(() => { overlay.classList.add('phase-title'); this.sound.play('crush'); }, 1750));
    this.introTimers.push(setTimeout(() => overlay.classList.add('phase-fadeout'), 3800));
    this.introTimers.push(setTimeout(() => this.finishBossIntro(), 4500));
  }

  skipBossIntro() {
    this.clearIntroTimers();
    this.finishBossIntro();
  }

  finishBossIntro() {
    const overlay = document.getElementById('boss-intro-overlay');
    if (overlay) overlay.className = '';
    this.vfx.setIntroMode(false);
    this.vfx.resize();
    this.introPlaying = false;
    this.paused = false;
    this.lastClockTick = performance.now();
    if (this.pendingIntroSpeech) this.showBossSpeech(this.pendingIntroSpeech);
    this.resetIdleTauntTimer();
  }

  /* ================= DIÁLOGOS DINÁMICOS Y FRECUENTES ================= */
  stopIdleTauntTimer() {
    if (this.idleTauntTimer) { clearTimeout(this.idleTauntTimer); this.idleTauntTimer = null; }
  }

  resetIdleTauntTimer() {
    this.stopIdleTauntTimer();
    if (this.mode === 'online' || this.mode === 'classic' || this.paused || this.engine.winner) return;
    this.idleTauntTimer = setTimeout(() => {
      if (this.phase === 'PLAYER_TURN' && !this.paused && !this.engine.winner) {
        const pool = BOSS_DIALOGUES[this.bossId]?.onIdle || ['El tablero espera tu jugada.'];
        this.showBossSpeech(pickLine(pool));
      }
    }, 18000);
  }

  /* ================= PISTA CON COSTE REAL DE 25 XP ================= */
  async requestHint() {
    if (this.mode === 'online' || this.paused || this.phase !== 'PLAYER_TURN' || this.engine.winner) return;
    if (!api.getToken()) {
      this.toast(`Inicia sesión para usar pistas tácticas (cuestan ${HINT_XP_COST} XP).`, 'error');
      return;
    }
    try {
      const res = await api.spendHintXp();
      if (res.profile) this.onUserUpdated(res.profile);

      const hint = HintEngine.analyze(this.engine);
      if (!hint) return;
      this.hintSquares = { from: hint.from, to: hint.to };
      document.getElementById('hint-text').textContent = `💡 (-${HINT_XP_COST} XP) ${hint.text}`;
      document.getElementById('hint-banner')?.classList.add('visible');
      this.sound.play('hint');
      this.vfx.spawnShockwave(hint.from[0], hint.from[1], '#ffd966', 44);
      this.vfx.spawnShockwave(hint.to[0], hint.to[1], '#4ce098', 44);
      this.render();
    } catch (err) {
      this.toast(err.message || `Necesitas ${HINT_XP_COST} XP para usar una pista.`, 'error');
    }
  }

  undoMove() {
    if (this.mode === 'online' || (this.phase !== 'PLAYER_TURN' && this.phase !== 'GAME_OVER')) return;
    if (!this.engine.undo()) return;
    document.getElementById('modal-gameover')?.classList.remove('open');
    this.selected = null;
    this.legalMoves = [];
    this.soldierMode = null;
    this.playerTeleportMode = false;
    this.hintSquares = null;
    document.getElementById('hint-banner')?.classList.remove('visible');
    this.phase = 'PLAYER_TURN';
    this.sound.play('undo');
    this.render();
  }

  isFlipped() { return this.mode === 'online' && this.onlineMeta?.yourColor === 'b'; }
  toVisualCoords(r, c) { return this.isFlipped() ? [7 - r, 7 - c] : [r, c]; }
  fromVisualCoords(vr, vc) { return this.isFlipped() ? [7 - vr, 7 - vc] : [vr, vc]; }

  /* ================= INTERACCIÓN DE CASILLAS ================= */
  handleSquareClick(r, c) {
    if (this.paused || this.phase !== 'PLAYER_TURN' || this.engine.winner) return;
    const myColor = this.mode === 'online' ? this.onlineMeta.yourColor : 'w';
    if (this.engine.turn !== myColor) return;

    const chosen = this.legalMoves.find((m) => m.tr === r && m.tc === c);
    if (chosen) {
      const piece = this.engine.board[chosen.fr][chosen.fc];
      const promoRank = myColor === 'w' ? 0 : 7;
      if (!chosen.isWaterShot && !chosen.isPlayerTeleport && piece?.type === 'P' && chosen.tr === promoRank) {
        this.pendingPromoMove = chosen;
        document.getElementById('modal-promo')?.classList.add('open');
        return;
      }
      this.commitPlayerMove(chosen, 'Q');
      return;
    }

    if (this.mode === 'mittens' && this.engine.isSprinkler(r, c)) {
      this.sound.play('waterPush');
      this.vfx.spawnWaterBeam(r, c, r, c);
      return;
    }
    if (this.mode === 'glitch' && this.engine.isRift(r, c)) {
      this.sound.play('glitchTear');
      this.vfx.spawnGlitchTear(r, c);
      return;
    }
    if (this.mode === 'blacky' && this.engine.isSealed(r, c) && !this.engine.board[r][c]) {
      this.sound.play('blackySeal');
      this.vfx.spawnBlackySeal(r, c);
      return;
    }

    const clicked = this.engine.board[r][c];
    if (clicked && clicked.color === myColor) {
      // Modo Teletransporte activo del jugador (Cap. 5 Poder de la Galaxia)
      if (this.mode === 'chess_final' && this.playerTeleportMode) {
        const tpMoves = this.engine.getPlayerTeleportTargets(r, c);
        if (tpMoves.length > 0) {
          this.selected = { r, c };
          this.legalMoves = tpMoves;
          this.sound.play('galaxyTeleport');
          this.render();
          return;
        }
      }

      const supportsWaterSoldier = (this.mode === 'mittens' || this.mode === 'chess_final') && clicked.type === 'P' && clicked.isSoldier;
      if (supportsWaterSoldier) {
        const now = performance.now();
        const isDouble = this.lastSoldierClick.r === r && this.lastSoldierClick.c === c && (now - this.lastSoldierClick.ts) < 480;
        this.lastSoldierClick = { r, c, ts: now };
        this.selected = { r, c };
        if (isDouble && this.soldierMode === 'shoot') {
          this.soldierMode = 'move';
          this.legalMoves = this.engine.getLegalMovesForPiece(r, c, false);
          this.sound.play('select');
          this.vfx.spawnShockwave(r, c, '#efd083', 28);
        } else {
          this.soldierMode = 'shoot';
          this.legalMoves = this.engine.getLegalWaterShotsForSoldier(r, c);
          this.sound.play('waterShot');
          this.vfx.spawnShockwave(r, c, '#5cd3ff', 30);
        }
      } else {
        this.selected = { r, c };
        this.soldierMode = null;
        this.legalMoves = (this.mode === 'mittens' || this.mode === 'chess_final')
          ? this.engine.getLegalMovesForPiece(r, c, false)
          : this.engine.getLegalMovesForPiece(r, c);
        this.sound.play('select');
        const [vr, vc] = this.toVisualCoords(r, c);
        this.vfx.spawnShockwave(vr, vc, '#efd083', 26);
      }
    } else {
      this.selected = null;
      this.soldierMode = null;
      this.legalMoves = [];
    }
    this.render();
  }

  resolvePromotion(promoType) {
    const m = this.pendingPromoMove;
    this.pendingPromoMove = null;
    document.getElementById('modal-promo')?.classList.remove('open');
    if (m) this.commitPlayerMove(m, promoType);
  }

  commitPlayerMove(move, promoType = 'Q') {
    this.stopIdleTauntTimer();
    this.selected = null;
    this.legalMoves = [];
    this.soldierMode = null;
    this.playerTeleportMode = false;
    this.hintSquares = null;
    document.getElementById('hint-banner')?.classList.remove('visible');

    if (this.mode === 'online') {
      this.phase = 'AI_THINKING';
      mpSocket.emit('match:move', {
        matchId: this.onlineMeta.matchId,
        fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc, promoType
      });
      this.render();
      return;
    }

    this.phase = 'ANIMATING_PLAYER';

    if (move.isWaterShot) {
      this.sound.play('waterShot');
      this.vfx.spawnWaterBeam(move.fr, move.fc, move.tr, move.tc);
      const victim = this.engine.board[move.tr][move.tc];
      const events = this.engine.executeMove(move, promoType, true);
      const afterShot = () => {
        this.setTempBossMood('mood-angry', 1400);
        this.showBossSpeech(pickLine(BOSS_DIALOGUES[this.bossId]?.onHurt || ['Un golpe inesperado.']));
        if (this.engine.winner) return this.handleSinglePlayerGameOver();
        this.runAITurn();
      };
      if (events?.displaced && victim) {
        this.render(move.pushR, move.pushC);
        this.animatePieceSlide(this.getPieceSvgKey(victim), move.tr, move.tc, move.pushR, move.pushC, afterShot);
      } else {
        setTimeout(afterShot, 220);
      }
      return;
    }

    if (move.isPlayerTeleport) {
      this.sound.play('galaxyTeleport');
      this.vfx.spawnGalaxyPortal(move.fr, move.fc);
      this.vfx.spawnGalaxyPortal(move.tr, move.tc);
      this.engine.executeMove(move, promoType, true);
      this.setTempBossMood('mood-angry', 1200);
      this.showBossSpeech(pickLine(BOSS_DIALOGUES[this.bossId]?.onPower));
      if (this.engine.winner) return this.handleSinglePlayerGameOver();
      this.runAITurn();
      return;
    }

    const movingPiece = this.engine.board[move.fr][move.fc];
    const svgKey = this.getPieceSvgKey(movingPiece);
    this.render(move.fr, move.fc);
    this.animatePieceSlide(svgKey, move.fr, move.fc, move.tr, move.tc, () => {
      if (this.mode === 'maya') {
        const res = this.engine.executeWhiteMove(move, promoType, true);
        if (res?.baseDestroyed) {
          this.sound.play('baseDestroy');
          this.vfx.spawnBaseShatter(move.tr, move.tc);
          this.vfx.triggerBoardShake(true);
          this.setTempBossMood('mood-angry', 1600);
          this.showBossSpeech(pickLine(BOSS_DIALOGUES.rey_maya.onHurt));
        } else if (res?.newlyBlockedPyramid) {
          this.sound.play('pyramidBlock');
          this.vfx.spawnShieldPulse(move.tr, move.tc);
          this.setTempBossMood('mood-blocked', 1300);
          this.showBossSpeech('Has detenido la Pirámide con esa Casa... por ahora.');
        } else if (res?.casaMoved) {
          this.sound.play(res.casaProtectedCount > 0 ? 'houseShield' : 'houseMove');
          this.vfx.spawnShieldPulse(move.tr, move.tc);
        } else if (res?.captured) {
          this.sound.play('capture');
          this.vfx.spawnSquareBurst(move.tr, move.tc, '#e05a4a', 18, 2.7);
          this.setTempBossMood('mood-angry', 1000);
        } else {
          this.sound.play('move');
        }
      } else if (this.mode === 'maya_campaign') {
        const ev = this.engine.executeMove(move, promoType, true);
        if (ev?.shieldBlocked) {
          this.sound.play('jadeShieldBlock');
          this.vfx.spawnShieldPulse(move.tr, move.tc);
          this.setTempBossMood('mood-triumphant', 1200);
          this.showBossSpeech('¡El Escudo de Jade absorbió tu ataque frontal! Ataca de nuevo o flanquéalo.');
        } else if (ev?.casaMoved) {
          this.sound.play(ev.casaProtectedCount > 0 ? 'houseShield' : 'houseMove');
          this.vfx.spawnShieldPulse(move.tr, move.tc);
        } else if (ev?.captured) {
          this.sound.play('capture');
          this.vfx.spawnSquareBurst(move.tr, move.tc, '#e05a4a', 16, 2.6);
          this.setTempBossMood('mood-angry', 1100);
        } else {
          this.sound.play('move');
        }
      } else {
        const ev = this.engine.executeMove(move, promoType, true);
        if (ev?.riftSealed) {
          this.sound.play('houseShield');
          this.vfx.spawnShieldPulse(move.tr, move.tc);
          this.setTempBossMood('mood-angry', 1300);
          this.showBossSpeech('ERR_PATCH:: ¡Tu Cortafuegos acaba de sellar una Grieta!');
        } else if (ev?.anchorDestroyed) {
          this.sound.play('baseDestroy');
          this.vfx.spawnGalaxyPortal(move.tr, move.tc);
          this.vfx.triggerBoardShake(true);
          this.setTempBossMood('mood-angry', 1500);
          this.showBossSpeech(pickLine(BOSS_DIALOGUES.galaxy_entity.onHurt));
        } else if (ev?.captured) {
          this.sound.play('capture');
          this.vfx.spawnSquareBurst(move.tr, move.tc, '#e05a4a', 16, 2.5);
          this.setTempBossMood('mood-angry', 1150);
          if (Math.random() < 0.65) this.showBossSpeech(pickLine(BOSS_DIALOGUES[this.bossId]?.onHurt));
        } else {
          this.sound.play('move');
        }
      }

      if (this.engine.winner) {
        this.handleSinglePlayerGameOver();
        return;
      }
      this.runAITurn();
    });
  }

  runAITurn() {
    this.phase = 'AI_THINKING';
    this.render();

    setTimeout(async () => {
      if (this.paused || this.engine.winner) return;

      let bestMove = null;
      if (this.mode === 'maya') bestMove = MayaBossAI.chooseBestMove(this.engine, this.aiDifficulty);
      else if (this.mode === 'maya_campaign') bestMove = MayaCampaignAI.chooseBestMove(this.engine, this.aiDifficulty, 'b');
      else if (this.mode === 'mittens') bestMove = FreeMittensAI.chooseBestMove(this.engine, this.aiDifficulty, 'b');
      else if (this.mode === 'galaxy') bestMove = GalaxyAI.chooseBestMove(this.engine, this.aiDifficulty, 'b');
      else if (this.mode === 'glitch') bestMove = GlitchAI.chooseBestMove(this.engine, this.aiDifficulty, 'b');
      else if (this.mode === 'chess_final') {
        const cfg = this.campaignMeta?.levelCfg || {};
        const aiRes = await this.runSuperAiAsync(this.engine.cloneState(), {
          maxDepth: cfg.maxDepth || 3,
          thinkTimeMs: cfg.thinkTimeMs || 650,
          qDepth: cfg.qDepth ?? 2,
          noise: cfg.aiNoise ?? 0,
          blunderChance: cfg.blunderChance ?? 0,
          useBook: cfg.useBook ?? true,
          color: 'b'
        });
        bestMove = aiRes?.move || null;
      } else if (this.mode === 'blacky') {
        const aiRes = await this.runSuperAiAsync(this.engine.cloneState(), {
          maxDepth: 5,
          thinkTimeMs: 950,
          color: 'b'
        });
        bestMove = aiRes?.move || this.engine.getAllLegalMoves('b')[0] || null;
      } else {
        bestMove = ClassicAI.chooseBestMove(this.engine, this.aiDifficulty, 'b');
      }

      if (this.paused || this.engine.winner) return;
      if (!bestMove) {
        this.phase = this.engine.winner ? 'GAME_OVER' : 'PLAYER_TURN';
        this.render();
        return;
      }

      this.phase = 'AI_EXECUTING';
      this.renderStatus();

      // 1. Pirámide 2×2 (Rey Maya)
      if (this.mode === 'maya' && bestMove.isPyramid) {
        const events = this.engine.executeBlackMove(bestMove, true);
        this.sound.play('pyramidMove');
        this.vfx.triggerBoardShake(events.crushed.length > 0);
        this.vfx.spawnPyramidDust(bestMove.nr, bestMove.nc);
        if (events.pushed.length > 1) setTimeout(() => this.sound.play('chainPush'), 110);
        else if (events.pushed.length === 1) setTimeout(() => this.sound.play('push'), 110);
        if (events.crushed.length > 0) {
          this.setTempBossMood('mood-triumphant', 1500);
          setTimeout(() => {
            this.sound.play('crush');
            for (const c of events.crushed) this.vfx.spawnCrushImpact(c.r, c.c);
          }, 150);
          this.showBossSpeech(pickLine(BOSS_DIALOGUES.rey_maya.onPower));
        }
        setTimeout(() => this.finishAITurn(), 460);
        return;
      }

      // 2. Hombre Galaxia 2×2 (Entidad Galáctica Nivel 5)
      if (this.mode === 'galaxy' && bestMove.isGalaxyMan) {
        const ev = this.engine.executeMove(bestMove, 'Q', true);
        this.sound.play('pyramidMove');
        this.vfx.triggerBoardShake(ev.crushed.length > 0);
        this.vfx.spawnGalaxyPortal(bestMove.nr + 0.5, bestMove.nc + 0.5);
        this.setTempBossMood('mood-triumphant', 1400);
        this.showBossSpeech(pickLine(BOSS_DIALOGUES.galaxy_entity.onPower));
        setTimeout(() => this.finishAITurn(), 460);
        return;
      }

      // 3. Teletransporte Galáctico enemigo
      if (this.mode === 'galaxy' && bestMove.isTeleport) {
        this.sound.play('galaxyTeleport');
        this.vfx.spawnGalaxyPortal(bestMove.fr, bestMove.fc);
        this.vfx.spawnGalaxyPortal(bestMove.tr, bestMove.tc);
        this.engine.executeMove(bestMove, 'Q', true);
        this.setTempBossMood('mood-triumphant', 1200);
        this.showBossSpeech('El espacio se pliega ante mis piezas estelares.');
        setTimeout(() => this.finishAITurn(), 340);
        return;
      }

      // 4. Ataque a distancia Arquera (Cap. 1)
      if (this.mode === 'maya_campaign' && bestMove.isRangedAttack) {
        this.sound.play('arrowShot');
        this.vfx.spawnArrowBeam(bestMove.fr, bestMove.fc, bestMove.tr, bestMove.tc);
        this.engine.executeMove(bestMove, 'Q', true);
        this.setTempBossMood('mood-triumphant', 1200);
        this.showBossSpeech('¡Flecha de obsidiana certera desde la diagonal!');
        setTimeout(() => this.finishAITurn(), 340);
        return;
      }

      // 5. Empuje solar Chamán (Cap. 1)
      if (this.mode === 'maya_campaign' && bestMove.isShamanPush) {
        const victim = this.engine.board[bestMove.tr][bestMove.tc];
        this.sound.play('shamanPush');
        this.vfx.spawnShamanWave(bestMove.tr, bestMove.tc);
        this.engine.executeMove(bestMove, 'Q', true);
        this.setTempBossMood('mood-triumphant', 1200);
        this.showBossSpeech('¡El Chamán Solar desplaza tus filas!');
        if (victim) {
          this.render(bestMove.pushR, bestMove.pushC);
          this.animatePieceSlide(victim.color + victim.type, bestMove.tr, bestMove.tc, bestMove.pushR, bestMove.pushC, () => this.finishAITurn());
        } else {
          setTimeout(() => this.finishAITurn(), 280);
        }
        return;
      }

      // 6. Permutación de furia Glitch
      if (this.mode === 'glitch' && bestMove.isFurySwap) {
        this.sound.play('glitchTear');
        this.vfx.spawnGlitchTear(bestMove.fr, bestMove.fc);
        this.vfx.spawnGlitchTear(bestMove.tr, bestMove.tc);
        this.engine.executeMove(bestMove, 'Q', true);
        this.setTempBossMood('mood-triumphant', 1300);
        this.showBossSpeech(pickLine(BOSS_DIALOGUES.boss_glitch.onPower));
        setTimeout(() => this.finishAITurn(), 340);
        return;
      }

      // 7. Movimiento estándar
      const piece = this.engine.board[bestMove.fr][bestMove.fc];
      const svgKey = this.getPieceSvgKey(piece);
      this.render(bestMove.fr, bestMove.fc);
      this.animatePieceSlide(svgKey, bestMove.fr, bestMove.fc, bestMove.tr, bestMove.tc, () => {
        if (this.mode === 'maya') {
          const ev = this.engine.executeBlackMove(bestMove, true);
          this.sound.play(ev?.captured ? 'capture' : 'move');
          if (ev?.captured) {
            this.vfx.spawnSquareBurst(bestMove.tr, bestMove.tc, '#e05a4a', 16, 2.6);
            this.setTempBossMood('mood-triumphant', 1200);
            this.showBossSpeech(pickLine(BOSS_DIALOGUES.rey_maya.onCapture));
          }
          this.finishAITurn();
        } else if (this.mode === 'mittens') {
          const ev = this.engine.executeMove(bestMove, 'Q', true);
          if (this.engine.isFreeMittensBoss) this.sound.play('meow');
          else this.sound.play(ev?.captured ? 'capture' : 'move');
          if (ev?.converted) {
            this.setTempBossMood('mood-triumphant', 1500);
            this.showBossSpeech(pickLine(BOSS_DIALOGUES[this.bossId]?.onCapture || ['Asimilación exacta completada.']));
            this.render(ev.converted.r, ev.converted.c);
            this.animateMittensConversion(
              ev.converted.originalType, ev.converted.newType,
              ev.converted.capR, ev.converted.capC,
              ev.converted.r, ev.converted.c,
              () => this.finishAITurn()
            );
          } else {
            if (ev?.captured) this.vfx.spawnSquareBurst(bestMove.tr, bestMove.tc, '#e05a4a', 14, 2.4);
            this.finishAITurn();
          }
        } else {
          const ev = this.engine.executeMove(bestMove, 'Q', true);
          if (ev?.riftsCreated?.length) {
            this.sound.play('glitchTear');
            for (const rf of ev.riftsCreated) this.vfx.spawnGlitchTear(rf.r, rf.c);
            this.vfx.triggerBoardShake(false);
            this.showBossSpeech(pickLine(BOSS_DIALOGUES.boss_glitch.onPower));
          } else if (ev?.blackyPowers?.length) {
            this.setTempBossMood('mood-angry', 1600);
            this.vfx.triggerBoardShake(true);
            for (const bp of ev.blackyPowers) {
              if (bp.type === 'seal') {
                this.sound.play('blackySeal');
                for (const sq of bp.squares) this.vfx.spawnBlackySeal(sq.r, sq.c);
                this.showBossSpeech(pickLine(BOSS_DIALOGUES.blacky_secret.onSeal));
              } else if (bp.type === 'summon') {
                this.sound.play('blackySummon');
                this.vfx.spawnBlackySummon(bp.r, bp.c);
                this.showBossSpeech(pickLine(BOSS_DIALOGUES.blacky_secret.onSummon));
              } else if (bp.type === 'absorb') {
                this.sound.play('blackyAbsorb');
                this.vfx.spawnBlackyAbsorb(bp.r, bp.c);
                this.showBossSpeech(pickLine(BOSS_DIALOGUES.blacky_secret.onAbsorb));
              } else if (bp.type === 'betray') {
                this.sound.play('blackyBetray');
                this.vfx.spawnBlackyBetray(bp.r, bp.c);
                this.showBossSpeech(pickLine(BOSS_DIALOGUES.blacky_secret.onBetray));
              }
            }
          } else if (bestMove.isJaguarLeap) {
            this.sound.play('jaguarLeap');
            this.vfx.spawnShockwave(bestMove.tr, bestMove.tc, '#d99436', 44);
          } else {
            this.sound.play(ev?.captured ? 'capture' : 'move');
          }
          if (ev?.captured) {
            this.vfx.spawnSquareBurst(bestMove.tr, bestMove.tc, '#e05a4a', 16, 2.5);
            this.setTempBossMood('mood-triumphant', 1200);
            const pool = BOSS_DIALOGUES[this.bossId]?.onCapture;
            if (pool) this.showBossSpeech(pickLine(pool));
          }
          this.finishAITurn();
        }
      });
    }, 340);
  }

  finishAITurn() {
    if (this.engine.winner) {
      this.handleSinglePlayerGameOver();
    } else {
      this.phase = 'PLAYER_TURN';
      this.sound.play('turnChange');
      this.render();
      this.resetIdleTauntTimer();
    }
  }

  async handleSinglePlayerGameOver() {
    this.stopIdleTauntTimer();
    this.phase = 'GAME_OVER';
    this.sound.stopBossMusic();
    this.render();

    const isWin = this.engine.winner === 'w';
    const isDraw = this.engine.winner === 'draw';
    this.sound.play(isWin ? 'victory' : (isDraw ? 'hint' : 'defeat'));
    this.vfx.spawnShockwave(3.5, 3.5, isWin ? '#efd083' : '#c94b3c', 160);

    let extraHtml = '<div style="font-size:0.78rem; color:var(--text-muted);">Inicia sesión para guardar XP, desbloqueos y progreso de campaña.</div>';
    let narrativeHtml = '';

    if (isWin && this.campaignMeta && this.campaignMeta.levelId === 5) {
      const camp = CAMPAIGN_MAP[this.campaignMeta.campaignId];
      if (camp?.epilogueTitle) {
        narrativeHtml = `
          <div style="margin-bottom:10px;padding:10px;border-radius:8px;background:rgba(207,166,76,0.12);border:1px solid var(--gold);">
            <strong style="font-family:var(--font-display);color:var(--gold-bright);display:block;margin-bottom:4px;">📜 ${camp.epilogueTitle}</strong>
            <span style="font-size:0.79rem;color:#ebe3d5;line-height:1.45;">${camp.epilogueText}</span>
          </div>`;
      }
    }

    if (api.getToken()) {
      try {
        const report = await api.reportMatch({
          mode: this.mode,
          opponentName: this.bossName,
          winner: this.engine.winner,
          resultReason: this.engine.winReason,
          turns: this.engine.turnNumber,
          basesDestroyed: this.mode === 'maya' ? (4 - this.engine.countAliveBases()) : 0,
          campaignId: this.campaignMeta?.campaignId || null,
          levelId: this.campaignMeta?.levelId || null
        });
        if (report.profile) this.onUserUpdated(report.profile);
        extraHtml = `
          ${narrativeHtml}
          ${report.unlockedExclusive ? `<div style="color:#fff2c4;font-weight:700;margin-bottom:6px;">👑 ¡TÍTULO Y MARCO EXCLUSIVO DESBLOQUEADO: «${report.unlockedExclusive}»!</div>` : ''}
          ${report.leveledUp ? `<div style="color:#9ce0be; font-weight:700; margin-bottom:6px;">⬆ ¡SUBISTE AL NIVEL ${report.profile.level}! Nuevos cosméticos desbloqueados.</div>` : ''}
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Experiencia ganada:</span>
            <strong style="color:var(--gold-bright);">+${report.xpGained} XP</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.76rem; color:var(--text-muted);">
            <span>Total XP / Nivel:</span>
            <strong>${report.profile.xp} XP · Nv. ${report.profile.level}</strong>
          </div>`;
      } catch (err) {
        extraHtml = narrativeHtml + `<div style="color:#ffaca3;font-size:0.78rem;">${err.message}</div>`;
      }
    } else if (narrativeHtml) {
      extraHtml = narrativeHtml + extraHtml;
    }

    this.openGameOverModal({
      title: isDraw ? 'Tablas' : (isWin ? '¡Victoria!' : 'Derrota'),
      desc: this.engine.winReason,
      extraHtml
    });
  }

  openGameOverModal({ title, desc, extraHtml }) {
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-desc').textContent = desc;
    const box = document.getElementById('gameover-summary-box');
    if (box) {
      box.innerHTML = extraHtml || '';
      box.classList.toggle('hidden', !extraHtml);
    }
    const rematchBtn = document.getElementById('btn-gameover-rematch');
    if (rematchBtn) rematchBtn.style.display = this.mode === 'online' ? 'none' : 'inline-flex';
    document.getElementById('modal-gameover')?.classList.add('open');
  }

  animatePieceSlide(svgKey, fr, fc, tr, tc, onDone) {
    const layer = document.getElementById('anim-piece-layer');
    const [vfr, vfc] = this.toVisualCoords(fr, fc);
    const [vtr, vtc] = this.toVisualCoords(tr, tc);
    const el = document.createElement('div');
    el.className = 'flying-piece';
    el.style.left = `${vfc * 12.5}%`;
    el.style.top = `${vfr * 12.5}%`;
    el.innerHTML = SVGS[svgKey] || MITTENS_SVGS[svgKey] || GALAXY_SVGS[svgKey] || GLITCH_SVGS[svgKey] || CHESS_ORIGIN_SVGS[svgKey] || '';
    layer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.left = `${vtc * 12.5}%`;
      el.style.top = `${vtr * 12.5}%`;
    }));
    setTimeout(() => { el.remove(); onDone(); }, 235);
  }

  animateMittensConversion(originalType, newType, capR, capC, spawnR, spawnC, onDone) {
    const layer = document.getElementById('anim-piece-layer');
    const isCat = this.engine.isFreeMittensBoss;
    const newMarkup = isCat ? (MITTENS_SVGS[`m${newType}`] || MITTENS_SVGS.mP) : (SVGS[`b${newType}`] || SVGS.bP);
    const node = document.createElement('div');
    node.className = 'conversion-fx-node';
    node.style.left = `${capC * 12.5}%`;
    node.style.top = `${capR * 12.5}%`;
    node.innerHTML = `
      <div class="conversion-fx-aura"></div>
      <div class="conversion-fx-old">${SVGS[`w${originalType}`] || SVGS.wP}</div>
      <div class="conversion-fx-new">${newMarkup}</div>
      <span class="conversion-face-pop">${isCat ? ':3 ' : ''}→ ${PIECE_NAMES[newType]}</span>
    `;
    layer.appendChild(node);
    this.sound.play('convert');
    this.vfx.spawnConversionBurst(capR, capC);
    setTimeout(() => {
      node.style.left = `${spawnC * 12.5}%`;
      node.style.top = `${spawnR * 12.5}%`;
      this.vfx.spawnConversionBurst(spawnR, spawnC);
    }, 480);
    setTimeout(() => { node.remove(); onDone(); }, 920);
  }

  showBossSpeech(text) {
    if (!text || this.mode === 'online' || this.mode === 'classic') return;
    const wrap = document.getElementById('boss-speech-wrap');
    const txt = document.getElementById('boss-speech-text');
    if (!wrap || !txt) return;
    txt.textContent = text;
    wrap.classList.add('visible');
    this.sound.play(this.mode === 'mittens' && this.engine.isFreeMittensBoss ? 'bossSpeak' : 'bossSpeak');
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => wrap.classList.remove('visible'), 5000);
  }

  setTempBossMood(moodClass, duration = 1200) {
    if (this.moodTimer) clearTimeout(this.moodTimer);
    this.applyPortraitExpression(moodClass);
    this.moodTimer = setTimeout(() => this.renderBossMood(), duration);
  }

  applyPortraitExpression(moodClass) {
    const frame = document.getElementById('boss-portrait-frame');
    const statusEl = document.getElementById('boss-portrait-status');
    if (!frame || this.mode === 'online') return;
    frame.className = `boss-portrait-frame ${moodClass.replace('mood-', 'expr-')}`;
    if (this.mode === 'maya') {
      const bgSvg = document.getElementById('mayan-boss-svg');
      if (bgSvg) bgSvg.setAttribute('class', `mayan-boss-figure ${moodClass}`);
    }
    if (!statusEl) return;
    const map = {
      'mood-idle': this.bossId === 'free_mittens' ? 'Sereno · Sabio' : 'Observando',
      'mood-thinking': 'Calculando...',
      'mood-triumphant': 'Implacable',
      'mood-angry': '¡Enfurecido!',
      'mood-damaged': '¡Golpeado!',
      'mood-surprised': '¡Alterado!',
      'mood-blocked': 'Bloqueado',
      'mood-disabled': 'Deshabilitado',
      'mood-victory': 'Victorioso',
      'mood-defeat': 'Derrotado'
    };
    statusEl.textContent = map[moodClass] || 'Observando';
  }

  startClockLoop() {
    this.lastClockTick = performance.now();
    setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - this.lastClockTick) / 1000);
      this.lastClockTick = now;

      if (this.paused || this.introPlaying || this.mode === 'online' || this.engine.winner) return;
      const side = this.engine.turn;
      if (this.engine.clocks[side] === null || this.engine.clocks[side] === undefined) return;
      this.engine.clocks[side] = Math.max(0, this.engine.clocks[side] - dt);
      this.renderClocks();

      if (this.engine.clocks[side] <= 0) {
        this.engine.winner = side === 'w' ? 'b' : 'w';
        this.engine.winReason = side === 'w' ? 'Se agotó tu tiempo. Derrota por reloj.' : `Se agotó el tiempo de ${this.bossName}. ¡Victoria por reloj!`;
        this.handleSinglePlayerGameOver();
      }
    }, 250);
  }

  getPieceSvgKey(piece) {
    if (!piece) return '';
    if (this.mode === 'mittens') {
      if (piece.color === 'b') return this.engine.isFreeMittensBoss ? `m${piece.type}` : `b${piece.type}`;
      return piece.isSoldier ? 'wS' : `${piece.color}${piece.type}`;
    }
    if (this.mode === 'galaxy' && piece.color === 'b') {
      return `g${piece.type}`;
    }
    if (this.mode === 'glitch' && piece.color === 'b') {
      return `x${piece.type}`;
    }
    if (this.mode === 'chess_final') {
      if (piece.color === 'b') return `c${piece.type}`;
      if (piece.color === 'w' && piece.isSoldier) return 'wS';
      if (piece.color === 'w' && piece.isSacredMayaRook) return 'wR_maya';
    }
    if (this.mode === 'maya_campaign' && piece.type === 'G' && !piece.shieldIntact) {
      return 'bG_broken';
    }
    return `${piece.color}${piece.type}`;
  }

  render(hideR = -1, hideC = -1) {
    this.renderBoard(hideR, hideC);
    this.renderHintArrow();
    if (this.mode === 'maya' || (this.mode === 'galaxy' && this.engine.hasGalaxyMan)) this.renderGiant2x2Layer();
    this.renderClocks();
    this.renderStatus();
    this.renderCaptured();
    this.renderLog();
    this.renderBossMood();
  }

  renderBoard(hideR = -1, hideC = -1) {
    const grid = document.getElementById('board-grid');
    const inner = document.getElementById('board-inner');
    if (!grid || !inner) return;
    inner.classList.toggle('locked', this.phase !== 'PLAYER_TURN' || this.paused);
    grid.innerHTML = '';

    const lastSet = new Set((this.engine.lastMoveSquares || []).map(([r, c]) => `${r},${c}`));
    const threatSet = (this.mode === 'maya' && this.showThreats)
      ? this.engine.getPyramidThreatSquares()
      : ((this.mode === 'galaxy' && this.engine.hasGalaxyMan && this.showThreats) ? this.engine.getGalaxyManThreatSquares() : new Set());
    const pushableSet = (this.mode === 'maya' && this.showThreats) ? this.engine.getPushableBlackSquares() : new Set();
    const protectedCasaSet = (this.mode === 'maya' || this.mode === 'maya_campaign') ? this.engine.getProtectedWhiteSquares() : new Set();
    const protectedBarrierSet = (this.mode === 'galaxy' || this.mode === 'glitch') ? this.engine.getProtectedWhiteSquares() : new Set();
    const archerZoneSet = (this.mode === 'maya_campaign' && this.showThreats) ? this.engine.getArcherZoneSquares() : new Set();
    const threatenedBases = this.mode === 'maya'
      ? new Set(this.engine.getBasesStatus().filter((b) => b.alive && b.threatened).map((b) => `${b.pos.r},${b.pos.c}`))
      : new Set();

    const waterRangeSet = ((this.mode === 'mittens' || this.mode === 'chess_final') && this.selected && this.soldierMode === 'shoot')
      ? this.engine.getSoldierWaterRangeSquares(this.selected.r, this.selected.c)
      : new Set();

    const wKing = this.engine.findKing ? this.engine.findKing('w') : null;
    const bKing = this.engine.findKing ? this.engine.findKing('b') : null;
    const wInCheck = wKing && this.engine.isKingInCheck('w');
    const bInCheck = bKing && this.engine.isKingInCheck('b');

    for (let vr = 0; vr < 8; vr++) {
      for (let vc = 0; vc < 8; vc++) {
        const [r, c] = this.fromVisualCoords(vr, vc);
        const sq = document.createElement('div');
        sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        const key = `${r},${c}`;

        if (this.mode === 'mittens' && this.engine.isSprinkler(r, c)) sq.classList.add('sprinkler-sq');
        if (this.mode === 'glitch' && this.engine.isRift(r, c)) sq.classList.add('glitch-rift');
        if (this.mode === 'blacky' && this.engine.isSealed(r, c)) sq.classList.add('blacky-sealed');
        if (this.selected && this.selected.r === r && this.selected.c === c) sq.classList.add('selected');
        if (lastSet.has(key)) sq.classList.add('last-move');
        if (threatSet.has(key)) sq.classList.add('pyramid-threat');
        if (archerZoneSet.has(key)) sq.classList.add('archer-zone');
        if (threatenedBases.has(key)) sq.classList.add('base-threatened');
        if (pushableSet.has(key)) sq.classList.add('pushable');
        if (protectedCasaSet.has(key)) sq.classList.add('casa-protected');
        if (protectedBarrierSet.has(key)) sq.classList.add('barrier-protected');
        if (waterRangeSet.has(key)) sq.classList.add('water-preview');
        if (wInCheck && wKing.r === r && wKing.c === c) sq.classList.add('king-check');
        if (bInCheck && bKing.r === r && bKing.c === c) sq.classList.add('king-check');

        if (this.hintSquares) {
          if (this.hintSquares.from[0] === r && this.hintSquares.from[1] === c) {
            sq.classList.add('hint-from');
            sq.insertAdjacentHTML('beforeend', '<span class="hint-tag from">MOVER</span>');
          }
          if (this.hintSquares.to[0] === r && this.hintSquares.to[1] === c) {
            sq.classList.add('hint-to');
            sq.insertAdjacentHTML('beforeend', '<span class="hint-tag to">AQUÍ</span>');
          }
        }

        if (vc === 0) sq.insertAdjacentHTML('beforeend', `<span class="coord-rank">${8 - r}</span>`);
        if (vr === 7) sq.insertAdjacentHTML('beforeend', `<span class="coord-file">${FILES[c]}</span>`);

        if (this.mode === 'mittens' && this.engine.isSprinkler(r, c)) {
          sq.insertAdjacentHTML('beforeend', `<div class="piece-wrap" title="Aspersor inmóvil">${MITTENS_SVGS.sprinkler}</div>`);
        } else if (this.mode === 'glitch' && this.engine.isRift(r, c)) {
          sq.insertAdjacentHTML('beforeend', `<div class="piece-wrap" title="Grieta de Vacío">${SVGS.voidRift}</div>`);
        } else if (this.mode === 'blacky' && this.engine.isSealed(r, c) && !this.engine.board[r][c]) {
          sq.insertAdjacentHTML('beforeend', `<div class="piece-wrap" title="Casillero deshabilitado por BLACKY">${SVGS.blackySeal}</div>`);
        } else {
          const piece = this.engine.board[r][c];
          if (piece && !(r === hideR && c === hideC)) {
            const svgKey = this.getPieceSvgKey(piece);
            const wrap = document.createElement('div');
            wrap.className = `piece-wrap${piece.betrayed ? ' blacky-betrayed' : ''}`;
            wrap.innerHTML = SVGS[svgKey] || MITTENS_SVGS[svgKey] || GALAXY_SVGS[svgKey] || GLITCH_SVGS[svgKey] || CHESS_ORIGIN_SVGS[svgKey] || '';
            if (piece.isBase || (this.mode === 'galaxy' && this.engine.hasGalaxyMan && piece.color === 'b' && (piece.type === 'B' || piece.type === 'N'))) {
              wrap.insertAdjacentHTML('beforeend', `<span class="base-crest" title="Objetivo Crítico"></span>`);
            }
            sq.appendChild(wrap);

            if (protectedCasaSet.has(key) || protectedBarrierSet.has(key)) sq.insertAdjacentHTML('beforeend', '<span class="casa-shield-badge">🛡️</span>');
            if (piece.type === 'G' && piece.shieldIntact) sq.insertAdjacentHTML('beforeend', '<span class="unit-badge">🛡️</span>');
            if (piece.type === 'C') sq.insertAdjacentHTML('beforeend', `<span class="unit-badge">${piece.pushCooldown === 0 ? '☀️' : `${piece.pushCooldown}t`}</span>`);
            if (piece.isSoldier && this.selected && this.selected.r === r && this.selected.c === c && this.soldierMode) {
              sq.insertAdjacentHTML('beforeend', `<span class="soldier-mode-pill">${this.soldierMode === 'shoot' ? '🔫 DISPARO' : '👣 MOVER'}</span>`);
            }
          }
        }

        const legal = this.legalMoves.find((m) => m.tr === r && m.tc === c);
        if (legal) {
          if (legal.isWaterShot) {
            sq.classList.add('water-target');
            sq.insertAdjacentHTML('beforeend', '<span class="water-target-badge">💦</span>');
          } else if (legal.isPlayerTeleport) {
            sq.classList.add('teleport-target');
          } else {
            const isCap = Boolean(this.engine.board[r][c] || legal.isEnPassant || legal.sealsRift);
            sq.insertAdjacentHTML('beforeend', `<div class="${isCap ? 'capture-ring' : 'move-dot'}"></div>`);
          }
        }

        sq.addEventListener('click', () => this.handleSquareClick(r, c));
        grid.appendChild(sq);
      }
    }
  }

  renderHintArrow() {
    const svg = document.getElementById('hint-arrow-svg');
    if (!svg) return;
    if (!this.hintSquares) { svg.innerHTML = ''; return; }
    const [vfr, vfc] = this.toVisualCoords(this.hintSquares.from[0], this.hintSquares.from[1]);
    const [vtr, vtc] = this.toVisualCoords(this.hintSquares.to[0], this.hintSquares.to[1]);
    const x1 = vfc * 100 + 50, y1 = vfr * 100 + 50;
    const x2 = vtc * 100 + 50, y2 = vtr * 100 + 50;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ex = x2 - ((x2 - x1) / len) * 20;
    const ey = y2 - ((y2 - y1) / len) * 20;

    svg.innerHTML = `
      <defs><marker id="hintHead" markerWidth="6" markerHeight="6" refX="4.2" refY="3" orient="auto"><path d="M0,0.4 L5.4,3 L0,5.6 Z" fill="#4ce098"/></marker></defs>
      <circle cx="${x1}" cy="${y1}" r="18" fill="none" stroke="#ffd966" stroke-width="6"/>
      <line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="#4ce098" stroke-width="11" stroke-linecap="round" marker-end="url(#hintHead)"/>
    `;
  }

  renderGiant2x2Layer() {
    const layer = document.getElementById('pyramid-layer');
    if (!layer) return;

    if (this.mode === 'maya') {
      const { r, c, disabledTurns, destroyed } = this.engine.pyramid;
      layer.style.left = `${c * 12.5}%`;
      layer.style.top = `${r * 12.5}%`;
      layer.className = 'pyramid-layer';
      if (destroyed) layer.classList.add('destroyed');
      else if (disabledTurns > 0) layer.classList.add('disabled');
      const badge = destroyed ? '<span class="pyramid-badge">Destruida</span>'
        : (disabledTurns > 0 ? `<span class="pyramid-badge">Inactiva · ${disabledTurns}t</span>` : '');
      layer.innerHTML = SVGS.pyramid + badge;
    } else if (this.mode === 'galaxy' && this.engine.hasGalaxyMan && this.engine.galaxyMan) {
      const { r, c, destroyed } = this.engine.galaxyMan;
      layer.style.left = `${c * 12.5}%`;
      layer.style.top = `${r * 12.5}%`;
      layer.className = 'pyramid-layer galaxy-man-mode';
      if (destroyed) layer.classList.add('destroyed');
      const rem = this.engine.countAliveAnchors();
      layer.innerHTML = SVGS.galaxyMan2x2 + `<span class="pyramid-badge">${destroyed ? 'Quebrado' : `2×2 · ${rem} Anclas`}</span>`;
    }
  }

  renderClocks() {
    const topSide = this.isFlipped() ? 'w' : 'b';
    const bottomSide = this.isFlipped() ? 'b' : 'w';
    const topEl = document.getElementById('clock-top');
    const botEl = document.getElementById('clock-bottom');
    document.getElementById('clock-top-time').textContent = formatClock(this.engine.clocks[topSide]);
    document.getElementById('clock-bottom-time').textContent = formatClock(this.engine.clocks[bottomSide]);

    topEl?.classList.toggle('active-clock', !this.engine.winner && this.engine.turn === topSide);
    botEl?.classList.toggle('active-clock', !this.engine.winner && this.engine.turn === bottomSide);
    topEl?.classList.toggle('low-time', this.engine.clocks[topSide] !== null && this.engine.clocks[topSide] <= 30);
    botEl?.classList.toggle('low-time', this.engine.clocks[bottomSide] !== null && this.engine.clocks[bottomSide] <= 30);
  }

  renderStatus() {
    const banner = document.getElementById('turn-banner');
    const bannerText = document.getElementById('turn-banner-text');
    if (!banner || !bannerText) return;
    banner.className = 'turn-banner';

    if (this.phase === 'GAME_OVER') {
      const myColor = this.mode === 'online' ? this.onlineMeta.yourColor : 'w';
      const won = this.engine.winner === myColor;
      banner.classList.add(won ? 'player-turn' : 'ai-executing');
      bannerText.textContent = this.engine.winner === 'draw' ? 'TABLAS' : (won ? 'VICTORIA' : 'DERROTA');
    } else if (this.phase === 'AI_THINKING') {
      banner.classList.add('ai-thinking');
      bannerText.textContent = this.mode === 'online' ? `TURNO DE ${this.onlineMeta.opponent.username.toUpperCase()}` : `${this.bossName.toUpperCase()} CALCULANDO...`;
    } else if (this.phase === 'AI_EXECUTING') {
      banner.classList.add('ai-executing');
      bannerText.textContent = `TURNO DE ${this.bossName.toUpperCase()}`;
    } else {
      banner.classList.add('player-turn');
      bannerText.textContent = 'TU TURNO';
    }

    const turnLbl = document.getElementById('turn-counter-label');
    if (turnLbl) turnLbl.textContent = `Turno ${this.engine.turnNumber}`;

    if (this.mode === 'maya') {
      const { r, c, disabledTurns, destroyed } = this.engine.pyramid;
      document.getElementById('pyramid-coords').textContent = `${toAlg(r, c)}-${toAlg(r + 1, c + 1)}`;
      const chip = document.getElementById('pyramid-status-chip');
      if (destroyed) { chip.className = 'pill jade'; chip.textContent = 'Destruida'; }
      else if (disabledTurns > 0) { chip.className = 'pill'; chip.textContent = `Inactiva (${disabledTurns}t)`; }
      else { chip.className = 'pill crimson'; chip.textContent = 'Activa'; }

      const basesGrid = document.getElementById('bases-grid');
      if (basesGrid) {
        basesGrid.innerHTML = this.engine.getBasesStatus().map((b) => `
          <div class="base-pill ${!b.alive ? 'dead' : (b.threatened ? 'threatened' : '')}">
            <span>${b.label}</span>
            <span style="font-family:monospace; opacity:0.75;">${b.alive ? toAlg(b.pos.r, b.pos.c) : '✕'}</span>
          </div>`).join('');
      }
    } else if (this.mode === 'maya_campaign' || this.mode === 'galaxy' || this.mode === 'glitch' || this.mode === 'chess_final') {
      const titleEl = document.getElementById('maya-camp-unit-title');
      const descEl = document.getElementById('maya-camp-unit-desc');
      if (this.mode === 'galaxy' && this.engine.hasGalaxyMan) {
        const rem = this.engine.countAliveAnchors();
        if (titleEl) titleEl.textContent = `Alfiles y Caballos restantes: ${rem} / 4`;
        if (descEl) descEl.textContent = `Teletransporte en ${this.engine.teleportCooldown}t. Elimina los ${rem} Alfiles y Caballos galácticos para derrotar al Hombre Galaxia 2×2.`;
      } else if (this.mode === 'glitch') {
        if (titleEl) titleEl.textContent = `Grietas activas: ${this.engine.rifts.length}`;
        if (descEl) descEl.textContent = this.campaignMeta?.levelCfg?.briefing || '';
      } else if (this.mode === 'chess_final') {
        if (titleEl) titleEl.textContent = this.engine.playerPower ? `Poder: ${this.engine.playerPower.toUpperCase()}` : 'Ajedrez Puro (Súper IA)';
        if (descEl) descEl.textContent = this.campaignMeta?.levelCfg?.briefing || '';
        const tpBtn = document.getElementById('btn-player-teleport');
        if (tpBtn && this.engine.playerPower === 'galaxy') {
          tpBtn.textContent = this.engine.playerTeleportCooldown > 0
            ? `✦ Teletransporte (${this.engine.playerTeleportCooldown}t)`
            : (this.playerTeleportMode ? '✦ Cancelar Teletransporte' : '✦ Activar Teletransporte');
        }
      } else {
        if (titleEl) titleEl.textContent = this.campaignMeta?.levelCfg?.unitIntroduced || 'Unidades de Prueba';
        if (descEl) descEl.textContent = this.campaignMeta?.levelCfg?.briefing || '';
      }
    } else if (this.mode === 'mittens') {
      document.getElementById('mittens-soldiers-count').textContent = this.engine.hasWhiteSoldiers ? `${this.engine.countAliveSoldiers()} / ${this.engine.initialSoldiersCount || 3}` : 'No activos';
      document.getElementById('mittens-sprinkler-pos').textContent = this.engine.sprinkler ? toAlg(this.engine.sprinkler.r, this.engine.sprinkler.c) : 'No activo';
      document.getElementById('mittens-conversions-count').textContent = String(this.engine.conversionsCount);
    } else if (this.mode === 'blacky') {
      const lp = document.getElementById('blacky-last-power');
      if (lp) lp.textContent = this.engine.stats?.lastPowerLabel || 'Acechando...';
      const s1 = document.getElementById('bk-stat-sealed');
      const s2 = document.getElementById('bk-stat-summoned');
      const s3 = document.getElementById('bk-stat-absorbed');
      const s4 = document.getElementById('bk-stat-betrayed');
      if (s1) s1.textContent = String(this.engine.sealedSquares?.length || 0);
      if (s2) s2.textContent = String(this.engine.stats?.summonedTotal || 0);
      if (s3) s3.textContent = String(this.engine.stats?.absorbedTotal || 0);
      if (s4) s4.textContent = String(this.engine.stats?.betrayedTotal || 0);
    }

    const canUndo = this.mode !== 'online' && (this.phase === 'PLAYER_TURN' || this.phase === 'GAME_OVER') && this.engine.history.length > 0;
    const undoBtn = document.getElementById('btn-undo');
    const hintBtn = document.getElementById('btn-hint');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (hintBtn) hintBtn.disabled = this.phase !== 'PLAYER_TURN' || Boolean(this.engine.winner);
  }

  renderCaptured() {
    const capB = document.getElementById('cap-black-list');
    const capW = document.getElementById('cap-white-list');
    if (capB) {
      capB.innerHTML = this.engine.capturedByWhite.length
        ? this.engine.capturedByWhite.map((p) => {
          const icon = this.mode === 'mittens' && this.engine.isFreeMittensBoss
            ? (MITTENS_SVGS[`m${p.type}`] || SVGS[`b${p.type}`])
            : (this.mode === 'galaxy' ? (GALAXY_SVGS[`g${p.type}`] || SVGS[`b${p.type}`])
              : (this.mode === 'glitch' ? (GLITCH_SVGS[`x${p.type}`] || SVGS[`b${p.type}`])
                : (this.mode === 'chess_final' ? (CHESS_ORIGIN_SVGS[`c${p.type}`] || SVGS[`b${p.type}`])
                  : (SVGS[`b${p.type}`] || ''))));
          return `<span class="cap-mini">${icon}</span>`;
        }).join('')
        : '<span style="opacity:0.55;">Sin bajas negras</span>';
    }
    if (capW) {
      capW.innerHTML = this.engine.capturedByBlack.length
        ? this.engine.capturedByBlack.map((p) => `<span class="cap-mini">${SVGS[`w${p.type}`] || ''}</span>`).join('')
        : '<span style="opacity:0.55;">Sin bajas blancas</span>';
    }
  }

  renderLog() {
    const list = document.getElementById('log-list');
    if (!list) return;
    list.innerHTML = (this.engine.logs || []).map((entry) => `
      <div class="log-item ${entry.type}">
        <span class="log-turn">${entry.turn > 0 ? `#${entry.turn}` : 'Inicio'}</span>${entry.text}
      </div>`).join('');
  }

  renderBossMood() {
    if (this.mode === 'online') return;
    let mood = 'mood-idle';
    if (this.engine.winner === 'w') mood = 'mood-defeat';
    else if (this.engine.winner === 'b') mood = 'mood-victory';
    else if (this.mode === 'maya' && this.engine.pyramid.disabledTurns > 0) mood = 'mood-disabled';
    else if (this.phase === 'AI_THINKING' || this.phase === 'AI_EXECUTING') mood = 'mood-thinking';
    this.applyPortraitExpression(mood);
  }
}
