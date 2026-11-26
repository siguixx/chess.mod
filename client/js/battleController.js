import { FILES, PIECE_NAMES, HINT_XP_COST, SPECIAL_GAME_MODES, toAlg, formatClock, inBounds } from '/shared/config/constants.js';
import { BOT_ELO_BY_DIFFICULTY } from '/shared/config/elo.js';
import { CAMPAIGN_MAP } from '/shared/config/campaigns.js';
import { COSMETIC_BOARDS, COSMETIC_PIECE_SKINS, COSMETIC_POWERS } from '/shared/config/cosmetics.js';
import {
  createInitialPowerState,
  resolvePowerDef,
  computePowerTargets,
  powerNeedsSourceSelection,
  executeBattlePowerAction,
  applyMittensAssimilationIfActive,
  tickPowerStateForSide,
  isPieceFrozen,
  isSquareBlockedByModState,
  applyCustomModSetupToEngine
} from '/shared/mods/modRuntime.js';
import { MayaBossEngine } from '/shared/rules/mayaEngine.js';
import { MayaCampaignEngine } from '/shared/rules/mayaCampaignEngine.js';
import { FreeMittensEngine } from '/shared/rules/mittensEngine.js';
import { GalaxyEngine } from '/shared/rules/galaxyEngine.js';
import { GlitchEngine } from '/shared/rules/glitchEngine.js';
import { ChessFinalEngine } from '/shared/rules/chessFinalEngine.js';
import { BlackySecretEngine } from '/shared/rules/blackyEngine.js';
import { ClassicChessEngine } from '/shared/rules/classicEngine.js';
import { LargeBoardChessEngine, chooseLargeBoardAIMove } from '/shared/rules/largeBoardEngine.js';
import { MultiPartyChessEngine, chooseMultiPartyAIMove, FACTION_META } from '/shared/rules/multiPartyEngine.js';
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
    this.lowTimeWarnedSide = { w: false, b: false };
    this.prefs = {
      showCoords: true,
      highlightLastMove: true,
      showLegalHints: true,
      autoQueen: false,
      showPreMatchGuide: true,
      animSpeed: 'normal',
      boardScale: 'normal',
      boardShake: true,
      eyeTracking: true,
      bgParticles: true,
      highContrast: false,
      showDialogues: true,
      lowTimeAlert: true
    };

    this.selected = null;
    this.legalMoves = [];
    this.soldierMode = null;
    this.playerTeleportMode = false;
    this.lastSoldierClick = { r: -1, c: -1, ts: 0 };
    this.hintSquares = null;
    this.pendingPromoMove = null;
    this.pendingChessLevelCfg = null;
    this.pendingPreMatchStart = null;

    // Perfil del jugador (skins de fichas, poder equipado y Mod VIP)
    this.userProfile = null;
    this.shopPowerCooldown = 0;
    this.shopPowerActive = false;
    this.shopPowerSource = null;
    this.shopPowerTargets = [];
    this.frozenPieces = {};
    this.solarShields = {};

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

  setPreferences(newPrefs = {}) {
    this.prefs = { ...this.prefs, ...newPrefs };
    if (this.vfx) {
      this.vfx.setShakeEnabled(this.prefs.boardShake !== false);
      this.vfx.setBgParticlesEnabled(this.prefs.bgParticles !== false);
    }
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

    on('btn-battle-back', 'click', () => this.requestExitBattle());
    on('btn-cancel-exit-match', 'click', () => {
      document.getElementById('modal-confirm-exit')?.classList.remove('open');
    });
    on('btn-confirm-exit-match', 'click', () => {
      document.getElementById('modal-confirm-exit')?.classList.remove('open');
      this.exitBattle({ abandonOnline: this.mode === 'online' && !this.engine?.winner });
    });
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

    // Ventana previa a cada partida (explicación de movimientos y reglas)
    on('btn-prematch-start', 'click', () => {
      document.getElementById('modal-prematch')?.classList.remove('open');
      const fn = this.pendingPreMatchStart;
      this.pendingPreMatchStart = null;
      if (typeof fn === 'function') fn();
    });

    // Botón de Poder equipado de Tienda / Mod VIP en batalla
    on('btn-shop-power', 'click', () => this.toggleShopPowerMode());
    on('btn-owner-instawin', 'click', () => this.triggerOwnerInstantWin());

    // Online buttons (incluye enviar solicitud de amistad al rival o compañero en plena partida)
    on('btn-exit-spectate', 'click', () => this.exitBattle());
    on('btn-online-add-friend', 'click', async () => {
      const oppName = this.onlineMeta?.opponent?.username;
      if (!oppName) return this.toast('No hay un jugador rival conectado para agregar.', 'info');
      try {
        const res = await api.sendFriendRequest(oppName);
        this.toast(res.autoAccepted ? `🤝 ¡Ahora eres amigo de ${oppName}!` : `🤝 Solicitud de amistad enviada a ${oppName}.`, 'success');
      } catch (err) {
        this.toast(err.message || `No se pudo enviar solicitud a ${oppName}.`, 'error');
      }
    });
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
      if (this.vfx.reduced || this.prefs?.eyeTracking === false) return;
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
    mpSocket.on('match:state', ({ matchId, state, powerState, events, powerEvent }) => {
      if ((this.mode !== 'online' && this.mode !== 'spectate') || this.onlineMeta?.matchId !== matchId) return;
      this.engine.loadState(state);
      if (powerState) this.powerState = powerState;
      this.selected = null;
      this.legalMoves = [];
      this.shopPowerActive = false;
      this.shopPowerSource = null;
      this.shopPowerTargets = [];
      this.phase = this.engine.winner
        ? 'GAME_OVER'
        : (this.mode === 'spectate'
          ? 'AI_THINKING'
          : (this.engine.turn === this.onlineMeta.yourColor ? 'PLAYER_TURN' : 'AI_THINKING'));
      if (powerEvent) {
        this.sound.play(powerEvent.sfx || 'power_golden_freeze');
        if (powerEvent.tr !== undefined && powerEvent.tc !== undefined) {
          const [vr, vc] = this.toVisualCoords(powerEvent.tr, powerEvent.tc);
          this.vfx.spawnShockwave(vr, vc, powerEvent.color || '#ffd859', 48);
          this.vfx.spawnSquareBurst(vr, vc, powerEvent.color || '#ffd859', 24, 3.2);
        }
        if (powerEvent.logText) this.toast(powerEvent.logText, 'info');
      } else {
        const myColor = this.onlineMeta.yourColor;
        if (this.mode === 'online' && events?.by === myColor) this.sound.playPieceAction(this.getActivePieceSkin().id, Boolean(events?.captured));
        else this.sound.play(events?.captured ? 'capture' : 'move');
      }
      if (events?.to) {
        const [vr, vc] = this.toVisualCoords(events.to[0], events.to[1]);
        this.vfx.spawnSquareBurst(vr, vc, events.captured ? '#e05a4a' : '#cfa64c', 12, 2.2);
      }
      this.configureBattlePanels();
      this.render();
    });

    mpSocket.on('match:clock', ({ matchId, clocks }) => {
      if ((this.mode !== 'online' && this.mode !== 'spectate') || this.onlineMeta?.matchId !== matchId) return;
      this.engine.clocks = clocks;
      this.renderClocks();
    });

    mpSocket.on('match:spectators', ({ matchId, count }) => {
      if ((this.mode !== 'online' && this.mode !== 'spectate') || this.onlineMeta?.matchId !== matchId) return;
      if (this.onlineMeta) this.onlineMeta.spectatorsCount = count;
      const pill = document.getElementById('spectator-count-pill');
      if (pill) pill.textContent = `${count} viendo`;
    });

    mpSocket.on('match:draw_offered', ({ matchId }) => {
      if (this.mode !== 'online' || this.onlineMeta?.matchId !== matchId) return;
      document.getElementById('modal-draw-offer')?.classList.add('open');
    });

    mpSocket.on('match:draw_declined', () => this.toast('Tu rival rechazó la oferta de tablas.', 'info'));
    mpSocket.on('match:error', ({ error }) => this.toast(error || 'Jugada rechazada por el servidor.', 'error'));
    mpSocket.on('match:abandon_applied', (data) => {
      if (data?.profile) this.onUserUpdated(data.profile);
      const warn = data?.banWarning
        ? ' ⚠️ Atención: abandonos reiterados pueden provocar baneo de tu cuenta.'
        : '';
      this.toast(`⚠️ Abandonaste la partida multijugador: -${data?.xpPenalty || 75} XP.${warn}`, 'error');
    });

    mpSocket.on('match:ended', (payload) => {
      if ((this.mode !== 'online' && this.mode !== 'spectate') || this.onlineMeta?.matchId !== payload.matchId) return;
      this.engine.loadState(payload.state);
      this.phase = 'GAME_OVER';
      this.render();

      if (this.mode === 'spectate') {
        const wName = payload.whiteProfile?.username || this.onlineMeta.white?.username || 'Blancas';
        const bName = payload.blackProfile?.username || this.onlineMeta.black?.username || 'Negras';
        const winnerLbl = payload.winner === 'draw' ? 'Tablas' : (payload.winner === 'w' ? `Ganó ${wName}` : `Ganó ${bName}`);
        const potRow = payload.betPot > 0
          ? `<div style="display:flex;justify-content:space-between;margin-top:6px;"><span>🪙 Bote Apostado:</span><strong style="color:#ffd859;">${payload.betPot} Mods</strong></div>`
          : '';
        this.openGameOverModal({
          title: `👁️ Fin de Partida · ${winnerLbl}`,
          desc: payload.reason,
          extraHtml: `<div>${wName} vs ${bName}</div>${potRow}`
        });
        return;
      }

      const myColor = this.onlineMeta.yourColor;
      const myProfile = myColor === 'w' ? payload.whiteProfile : payload.blackProfile;
      const myDelta = myColor === 'w' ? payload.eloUpdate.whiteDelta : payload.eloUpdate.blackDelta;
      const myXp = myColor === 'w' ? payload.whiteXpGained : payload.blackXpGained;
      const myMods = myColor === 'w' ? (payload.whiteModsGained || 0) : (payload.blackModsGained || 0);
      const myBetNet = myColor === 'w' ? (payload.whiteBetNet || 0) : (payload.blackBetNet || 0);
      if (myProfile) this.onUserUpdated(myProfile);

      const isWin = payload.winner === myColor;
      const isDraw = payload.winner === 'draw';
      this.sound.play(isWin ? 'victory' : (isDraw ? 'hint' : 'defeat'));

      const title = isDraw ? 'Tablas' : (isWin ? '¡Victoria Online!' : 'Derrota Online');
      const eloSign = myDelta >= 0 ? `+${myDelta}` : `${myDelta}`;
      const betHtml = payload.betMods > 0
        ? `<div style="display:flex; justify-content:space-between; margin-top:6px;">
            <span>🪙 Resultado Apuesta (Bote ${payload.betPot}):</span>
            <strong style="color:${myBetNet > 0 ? '#9ce0be' : (myBetNet < 0 ? '#ffaca3' : '#ffd859')};">${myBetNet > 0 ? `+${myBetNet} Mods` : (myBetNet < 0 ? `${myBetNet} Mods` : 'Reembolsado')}</strong>
          </div>`
        : '';
      this.openGameOverModal({
        title,
        desc: payload.reason,
        extraHtml: `
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Elo competitivo:</span>
            <strong style="color:${myDelta >= 0 ? '#9ce0be' : '#ffaca3'};">${myProfile?.elo ?? 0} (${eloSign})</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span>Experiencia ganada:</span>
            <strong style="color:var(--gold-bright);">+${myXp} XP</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Monedas ganadas:</span>
            <strong style="color:#ffd859;">🪙 +${myMods} Mods</strong>
          </div>
          ${betHtml}`
      });
    });
  }

  isStoryMode() {
    return ['maya', 'maya_campaign', 'mittens', 'galaxy', 'glitch', 'chess_final'].includes(this.mode);
  }

  setUserProfile(user) {
    this.userProfile = user || null;
    if (!document.getElementById('view-battle')?.classList.contains('hidden')) {
      this.applyActiveBattleBoardTheme();
      this.configureBattlePanels();
      this.render();
    }
  }

  syncGlitchBoardTexture() {
    const inner = document.getElementById('board-inner');
    if (!inner) return;
    inner.classList.remove('glitch-board-active', 'glitch-phase-0', 'glitch-phase-1', 'glitch-phase-2', 'glitch-phase-3');
    if (this.mode === 'glitch') {
      const phase = ((Number(this.engine?.turnNumber) || 1) + (this.engine?.rifts?.length || 0)) % 4;
      inner.classList.add('glitch-board-active', `glitch-phase-${phase}`);
    }
  }

  applyActiveBattleBoardTheme() {
    const root = document.documentElement;
    const inner = document.getElementById('board-inner');
    const allTex = COSMETIC_BOARDS.map((b) => b.textureClass).filter(Boolean);
    if (inner) allTex.forEach((cls) => inner.classList.remove(cls));

    // En Modo Historia JAMÁS se aplican tableros comprados en la tienda ni Mod VIP
    if (this.isStoryMode()) {
      const def = COSMETIC_BOARDS[0];
      root.style.setProperty('--sq-light', def.light);
      root.style.setProperty('--sq-dark', def.dark);
      root.style.setProperty('--board-pedestal-bg', def.pedestal);
      if (inner && def.textureClass) inner.classList.add(def.textureClass);
      this.syncGlitchBoardTexture();
      return;
    }

    // En Sala Privada con Mod de Código Abierto se aplica la textura del Mod
    if (this.customMod?.board) {
      root.style.setProperty('--sq-light', this.customMod.board.light);
      root.style.setProperty('--sq-dark', this.customMod.board.dark);
      root.style.setProperty('--board-pedestal-bg', this.customMod.board.pedestal);
      if (inner && this.customMod.board.textureClass) inner.classList.add(this.customMod.board.textureClass);
      this.syncGlitchBoardTexture();
      return;
    }

    const themeId = this.userProfile?.boardThemeId || 'board_classic_maya';
    const theme = COSMETIC_BOARDS.find((b) => b.id === themeId) || COSMETIC_BOARDS[0];
    root.style.setProperty('--sq-light', theme.light);
    root.style.setProperty('--sq-dark', theme.dark);
    root.style.setProperty('--board-pedestal-bg', theme.pedestal);
    if (inner && theme.textureClass) inner.classList.add(theme.textureClass);
    this.syncGlitchBoardTexture();
  }

  getActivePieceSkin() {
    // En Modo Historia JAMÁS se aplican fichas compradas en la tienda ni Mod VIP
    if (this.isStoryMode()) return COSMETIC_PIECE_SKINS[0];
    const id = this.userProfile?.pieceSkinId || 'pieces_classic';
    return COSMETIC_PIECE_SKINS.find((s) => s.id === id) || COSMETIC_PIECE_SKINS[0];
  }

  getEquippedShopPower() {
    // Los poderes se pueden usar en CUALQUIER LUGAR MENOS en Modo Historia (y en Espectador solo lectura)
    if (this.isStoryMode() || this.mode === 'spectate') return null;
    // Respetar ajuste del Host en Sala Privada cuando desactiva poderes
    if (this.mode === 'online' && this.onlineMeta?.isPrivate && this.onlineMeta?.roomSettings?.allowPowers === false) {
      return null;
    }
    // En Lección de Entrenador: el entrenador te presta su poder específico para que lo practiques
    if (this.mode === 'coach_lesson' && this.trainerMeta?.taughtPowerId) {
      return resolvePowerDef(this.trainerMeta.taughtPowerId, null);
    }
    // En Ruleta de Poderes Random o Hiper-Caos: cada turno tienes un poder OP aleatorio con CD 1
    if (this.mode === 'special' && (this.specialMeta?.id === 'special_random_powers' || this.specialMeta?.id === 'special_hyper_chaos') && this.randomRolledPower) {
      return this.randomRolledPower;
    }
    // En Guerra de Titanes 2×2: otorga Pirámide 2×2 con CD 2t
    if (this.mode === 'special' && this.specialMeta?.id === 'special_giants_clash') {
      const base = resolvePowerDef('power_maya_pyramid', null);
      return base ? { ...base, cooldown: 2 } : null;
    }
    if (this.customMod?.power) return this.customMod.power;
    const id = this.userProfile?.equippedPowerId || 'power_none';
    const p = resolvePowerDef(id, null);
    if (!p) return null;
    if (p.vipOnly && !this.userProfile?.isVip) return null;
    return p;
  }

  isVoid6x6Square(r, c) {
    return this.mode === 'special' && this.specialMeta?.id === 'special_6x6'
      && (r === 0 || r === 7 || c === 0 || c === 7);
  }

  rollRandomSpecialPower() {
    const pool = COSMETIC_POWERS.filter((p) => p.id !== 'power_none');
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this.randomRolledPower = chosen ? { ...chosen, cooldown: 1 } : null;
    if (this.randomRolledPower && this.powerState) {
      this.powerState.cooldowns.w = 0;
    }
    return this.randomRolledPower;
  }

  triggerEarthquakeChaos() {
    if (!this.engine || !this.powerState || this.engine.winner) return;
    const logParts = [];
    // 1. Abrir 2 grietas aleatorias en casillas vacías centrales
    let riftsAdded = 0;
    for (let tries = 0; tries < 24 && riftsAdded < 2; tries++) {
      const r = 2 + Math.floor(Math.random() * 4);
      const c = Math.floor(Math.random() * 8);
      if (!this.engine.board[r][c] && !isSquareBlockedByModState(this.powerState, r, c)) {
        this.powerState.modRifts.push({ r, c, turnsLeft: 3, owner: 'neutral' });
        this.vfx.spawnGlitchTear(r, c);
        riftsAdded++;
      }
    }
    if (riftsAdded > 0) logParts.push(`${riftsAdded} grietas abiertas`);

    // 2. Teletransportar 1 pieza al azar (no Rey) a otra casilla vacía segura
    const movable = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.engine.board[r][c];
        if (p && p.type !== 'K') movable.push({ r, c, p });
      }
    }
    if (movable.length > 0) {
      const pick = movable[Math.floor(Math.random() * movable.length)];
      for (let tries = 0; tries < 20; tries++) {
        const nr = 1 + Math.floor(Math.random() * 6);
        const nc = Math.floor(Math.random() * 8);
        if (!this.engine.board[nr][nc] && !isSquareBlockedByModState(this.powerState, nr, nc)) {
          this.engine.board[nr][nc] = pick.p;
          this.engine.board[pick.r][pick.c] = null;
          if (!this.engine.isKingInCheck('w') && !this.engine.isKingInCheck('b')) {
            this.vfx.spawnGalaxyPortal(nr, nc);
            logParts.push(`${PIECE_NAMES[pick.p.type]} movido a ${toAlg(nr, nc)}`);
            break;
          }
          this.engine.board[pick.r][pick.c] = pick.p;
          this.engine.board[nr][nc] = null;
        }
      }
    }

    // 3. Mutar 1 peón aleatorio en Caballo, Alfil o Torre
    const pawns = movable.filter((x) => x.p.type === 'P' && this.engine.board[x.r][x.c] === x.p);
    if (pawns.length > 0) {
      const mut = pawns[Math.floor(Math.random() * pawns.length)];
      const newTypes = ['N', 'B', 'R'];
      mut.p.type = newTypes[Math.floor(Math.random() * newTypes.length)];
      this.vfx.spawnConversionBurst(mut.r, mut.c);
      logParts.push(`Peón mutó en ${PIECE_NAMES[mut.p.type]}`);
    }

    if (logParts.length > 0) {
      this.sound.play('crush');
      this.vfx.triggerBoardShake(true);
      const msg = `🌋 ¡TERREMOTO ABSURDO!: ${logParts.join(' · ')}.`;
      this.engine.logs.unshift({ turn: this.engine.turnNumber, type: 'special', text: msg });
      this.toast(msg, 'info');
    }
  }

  resetShopPowerMatchState() {
    this.powerState = createInitialPowerState();
    this.shopPowerActive = false;
    this.shopPowerSource = null;
    this.shopPowerTargets = [];
  }

  getMySide() {
    return this.mode === 'online' ? (this.onlineMeta?.yourColor || 'w') : 'w';
  }

  toggleShopPowerMode() {
    const power = this.getEquippedShopPower();
    if (!power || this.paused || this.phase !== 'PLAYER_TURN' || this.engine.winner) return;
    const side = this.getMySide();
    const cd = this.powerState?.cooldowns?.[side] || 0;
    if (cd > 0) {
      this.toast(`${power.name} en enfriamiento (${cd} turnos).`, 'info');
      return;
    }
    this.shopPowerActive = !this.shopPowerActive;
    this.shopPowerSource = null;
    this.shopPowerTargets = [];
    this.selected = null;
    this.legalMoves = [];

    if (this.shopPowerActive) {
      if (powerNeedsSourceSelection(power)) {
        this.toast(`${power.icon} ${power.name} activo: toca cualquiera de tus piezas para apuntar a un objetivo a distancia.`, 'info');
      } else {
        this.shopPowerTargets = computePowerTargets(this.engine, this.powerState, side, power, null);
        if (!this.shopPowerTargets.length) {
          this.shopPowerActive = false;
          this.toast(`No hay objetivos válidos en el tablero para ${power.name} en este momento.`, 'info');
        } else {
          this.toast(`${power.icon} ${power.name} activo: toca una casilla resaltada para desatar el ataque.`, 'info');
        }
      }
    }
    this.render();
  }

  handleShopPowerSquareClick(r, c) {
    const power = this.getEquippedShopPower();
    if (!power || !this.shopPowerActive) return false;
    const side = this.getMySide();

    const chosenTarget = this.shopPowerTargets.find((t) => t.tr === r && t.tc === c);
    if (chosenTarget) {
      this.executeShopPower(power, chosenTarget);
      return true;
    }

    if (powerNeedsSourceSelection(power)) {
      const clicked = this.engine.board[r]?.[c];
      if (clicked && clicked.color === side) {
        const tgts = computePowerTargets(this.engine, this.powerState, side, power, { r, c });
        if (!tgts.length) {
          this.toast('Esa pieza no tiene enemigos en línea de tiro ahora. Prueba otra pieza tuya.', 'info');
          return true;
        }
        this.shopPowerSource = { r, c };
        this.shopPowerTargets = tgts;
        this.sound.play('select');
        this.render();
        return true;
      }
      this.toast(`Selecciona una de tus piezas para disparar ${power.name}.`, 'info');
      return true;
    }

    return true;
  }

  executeShopPower(power, target) {
    this.stopIdleTauntTimer();
    this.shopPowerActive = false;
    this.shopPowerSource = null;
    this.shopPowerTargets = [];

    // En Multijugador Online (Pública o Sala Privada), el servidor valida y ejecuta el poder autoritativamente
    if (this.mode === 'online' && this.onlineMeta?.matchId) {
      this.phase = 'AI_THINKING';
      mpSocket.emit('match:use_power', {
        matchId: this.onlineMeta.matchId,
        fr: target.fr,
        fc: target.fc,
        tr: target.tr,
        tc: target.tc
      });
      this.render();
      return;
    }

    const side = 'w';
    const res = executeBattlePowerAction(this.engine, this.powerState, side, power, target);
    if (!res.ok) {
      this.toast(res.error || 'No se pudo ejecutar el poder.', 'error');
      this.render();
      return;
    }

    this.sound.play(res.sfx || power.sfxType || 'power_golden_freeze');
    const [vr, vc] = this.toVisualCoords(target.tr, target.tc);
    this.vfx.spawnShockwave(vr, vc, power.color || '#ffd859', 54);
    this.vfx.spawnSquareBurst(vr, vc, power.color || '#ffd859', 26, 3.2);
    if (res.events?.destroyed?.length) this.vfx.triggerBoardShake(true);
    this.toast(res.logText, 'success');

    this.configureBattlePanels();
    this.render();
    if (this.engine.winner) {
      this.handleSinglePlayerGameOver();
      return;
    }
    this.runAITurn();
  }

  tickBattlePowerStatesAfterEnemyTurn() {
    if (!this.powerState) return;
    tickPowerStateForSide(this.powerState, 'w');
  }

  isAiMoveBlockedByShopPowers(move) {
    if (!move || !this.powerState) return false;
    if (move.fr !== undefined && move.fc !== undefined) {
      const mover = this.engine.board[move.fr]?.[move.fc];
      if (isPieceFrozen(this.powerState, mover)) return true;
    }
    if (move.tr !== undefined && move.tc !== undefined) {
      if (isSquareBlockedByModState(this.powerState, move.tr, move.tc, 'b')) return true;
    }
    return false;
  }

  showPreMatchGuide({ title, subtitle, modeTag, rulesHtml, onStart }) {
    const modal = document.getElementById('modal-prematch');
    if (!modal || this.prefs?.showPreMatchGuide === false) {
      if (typeof onStart === 'function') onStart();
      return;
    }
    this.paused = true;
    this.pendingPreMatchStart = onStart;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('prematch-kicker', modeTag || 'GUÍA DE MOVIMIENTOS');
    set('prematch-title', title || 'Preparado para la Batalla');
    set('prematch-subtitle', subtitle || 'Revisa tus movimientos y defensas antes de comenzar.');
    const body = document.getElementById('prematch-rules-body');
    const power = this.getEquippedShopPower();
    const powerNote = power
      ? `<li><strong>${power.icon} Poder Activo (${power.name}):</strong> ${power.description}</li>`
      : (this.isStoryMode() ? `<li><strong>📜 Modo Historia Puro:</strong> Los tableros, fichas y poderes comprados en la Tienda no se usan en Modo Historia; aquí juegas con las mecánicas oficiales del capítulo.</li>` : '');
    if (body) {
      body.innerHTML = `
        <ul class="prematch-rules-list">
          <li><strong>♟️ Movimientos básicos:</strong> Toca cualquier pieza blanca para ver los puntos de movimiento (y anillos rojos para capturar). Luego toca la casilla destino.</li>
          <li><strong>👑 Enroque y Coronación:</strong> Mueve tu Rey 2 casillas hacia una Torre sin mover para enrocar; al llegar un Peón al final del tablero podrás coronarlo en Dama, Torre, Alfil o Caballo.</li>
          ${rulesHtml || ''}
          ${powerNote}
        </ul>`;
    }
    modal.classList.add('open');
  }

  /* ================= INICIADORES POR CAPÍTULO Y MODO ================= */
  showBattleScreen() {
    document.getElementById('app-shell')?.classList.add('hidden');
    document.getElementById('view-battle')?.classList.remove('hidden');
    document.getElementById('modal-gameover')?.classList.remove('open');
    document.getElementById('modal-prematch')?.classList.remove('open');
    document.getElementById('hint-banner')?.classList.remove('visible');
    this.selected = null;
    this.legalMoves = [];
    this.soldierMode = null;
    this.playerTeleportMode = false;
    this.hintSquares = null;
    this.resetShopPowerMatchState();
    this.applyActiveBattleBoardTheme();
    this.vfx.resize();
  }

  isBattleScreenOpen() {
    const el = document.getElementById('view-battle');
    return Boolean(el && !el.classList.contains('hidden'));
  }

  requestExitBattle() {
    if (!this.isBattleScreenOpen()) return;
    // Si la partida ya terminó o estamos en modo espectador, salir directo al menú sin pedir confirmación
    if (this.phase === 'GAME_OVER' || this.engine?.winner || this.mode === 'spectate') {
      this.exitBattle();
      return;
    }
    const modal = document.getElementById('modal-confirm-exit');
    const titleEl = document.getElementById('confirm-exit-title');
    const descEl = document.getElementById('confirm-exit-desc');
    const confirmBtn = document.getElementById('btn-confirm-exit-match');
    if (!modal || !titleEl || !descEl || !confirmBtn) {
      this.exitBattle();
      return;
    }

    if (this.mode === 'online') {
      titleEl.textContent = '⚠️ ¿Estás seguro de salir?';
      titleEl.style.color = '#ff9b90';
      descEl.textContent = '¿Estás seguro de salir? Salir puede ser frustrante para otros jugadores, se te cobrarán 75 XP y posible baneo si esto sigue siendo seguido.';
      confirmBtn.textContent = 'Salir (-75 XP)';
      confirmBtn.className = 'btn btn-danger';
    } else {
      titleEl.textContent = '¿Estás seguro de salir?';
      titleEl.style.color = 'var(--gold-bright)';
      descEl.textContent = '¿Estás seguro de salir? No se guardará el progreso de tu partida.';
      confirmBtn.textContent = 'Salir al Menú';
      confirmBtn.className = 'btn btn-gold';
    }
    modal.classList.add('open');
  }

  exitBattle({ abandonOnline = false, returnToMainMenu = false } = {}) {
    this.clearIntroTimers();
    this.stopIdleTauntTimer();
    this.paused = true;
    this.customMod = null;
    this.sound.stopBossMusic();
    document.getElementById('boss-intro-overlay')?.classList.remove('active');
    document.getElementById('modal-gameover')?.classList.remove('open');
    document.getElementById('modal-confirm-exit')?.classList.remove('open');
    document.getElementById('view-battle')?.classList.add('hidden');
    document.getElementById('app-shell')?.classList.remove('hidden');
    if (this.mode === 'online' && this.onlineMeta?.matchId && !this.engine.winner) {
      if (abandonOnline) {
        mpSocket.emit('match:abandon', { matchId: this.onlineMeta.matchId });
      } else {
        mpSocket.emit('match:resign', { matchId: this.onlineMeta.matchId });
      }
    }
    if (this.mode === 'spectate' && this.onlineMeta?.matchId) {
      mpSocket.emit('match:leave_spectate', { matchId: this.onlineMeta.matchId });
    }
    this.onExitToMenu({ returnToMainMenu });
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
    const launch = () => {
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
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: 'CAPÍTULO 01 · JEFE FINAL',
        title: 'DIOS MAYA — Cómo Jugar',
        subtitle: 'Destruye las 4 Bases Sagradas o da Jaque Mate al Rey negro.',
        rulesHtml: `
          <li><strong>🏛️ Pirámide 2×2:</strong> Se mueve en diagonal 1–2 pasos y aplasta piezas sin escudo. Al destruir una Base (Torres/Alfiles marcados), queda inactiva 3 turnos.</li>
          <li><strong>🏠 Tus 2 Casas Inmortales (c3, f3):</strong> Muévelas 1 casilla ortogonal (arriba/abajo/lados). Protegen a tus piezas adyacentes contra la Pirámide.</li>`,
        onStart: launch
      });
    } else launch();
  }

  startMayaCampaignLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'maya_campaign';
    this.bossId = levelCfg.bossId;
    this.bossName = `Nv.${levelCfg.id} · ${levelCfg.name}`;
    this.aiDifficulty = levelCfg.aiDifficulty;
    this.campaignMeta = { campaignId: 'maya', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new MayaCampaignEngine(levelCfg.id, minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();
    const launch = () => {
      // Música exclusiva para Jefes Finales (Nivel 5), NO para los niveles 1-4 anteriores
      this.sound.stopBossMusic();
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
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: `CAPÍTULO 01 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name,
        subtitle: levelCfg.unitIntroduced || 'Guardián del Santuario',
        rulesHtml: `
          <li><strong>⚔️ Mecánica del Nivel:</strong> ${levelCfg.briefing}</li>
          <li><strong>🏠 Casa Blanca Inmortal:</strong> Mueve tu Casa 1 casilla ortogonal; las piezas adyacentes quedan protegidas contra flechas, saltos de Jaguar y empujes solares.</li>`,
        onStart: launch
      });
    } else launch();
  }

  startMittensLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'mittens';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 3;
    this.campaignMeta = { campaignId: 'mittens', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new FreeMittensEngine(levelCfg.bossId, minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    const launch = () => {
      if (levelCfg.id === 5) this.sound.startBossMusic('mittens', playIntro);
      else this.sound.stopBossMusic();
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
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: `CAPÍTULO 02 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name,
        subtitle: levelCfg.unitIntroduced || 'Conversión 1:1',
        rulesHtml: `
          <li><strong>⛓️ Regla del Rival:</strong> ${levelCfg.briefing}</li>
          <li><strong>🔫 Soldados de Agua:</strong> <strong>1 clic</strong> en un Soldado apunta para disparar agua y repeler enemigos sin moverte; <strong>doble clic</strong> lo mueve como peón normal.</li>`,
        onStart: launch
      });
    } else launch();
  }

  startGalaxyLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'galaxy';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 3;
    this.campaignMeta = { campaignId: 'galaxy', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new GalaxyEngine(levelCfg.id, minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    const launch = () => {
      if (levelCfg.id === 5) this.sound.startBossMusic('galaxy', playIntro);
      else this.sound.stopBossMusic();
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
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: `CAPÍTULO 03 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name,
        subtitle: levelCfg.unitIntroduced || 'Entidad Galáctica',
        rulesHtml: `
          <li><strong>🌌 Poder Cósmico:</strong> ${levelCfg.briefing}</li>
          <li><strong>🔷 Barreras Universales (c3, f3):</strong> Se mueven 1 casilla ortogonal, son inmortales, impiden teletransportes adyacentes y escudan contra el Hombre Galaxia 2×2.</li>`,
        onStart: launch
      });
    } else launch();
  }

  startGlitchLevel(levelCfg, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'glitch';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 3;
    this.campaignMeta = { campaignId: 'glitch', levelId: levelCfg.id, levelCfg };
    this.onlineMeta = null;
    this.engine = new GlitchEngine(levelCfg.id, minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    const launch = () => {
      if (levelCfg.id === 5) this.sound.startBossMusic('glitch', playIntro);
      else this.sound.stopBossMusic();
      if (playIntro) {
        this.playBossCinematicIntro({
          themeClass: 'theme-glitch',
          kicker: levelCfg.id === 5 ? 'CAPÍTULO 04 · BOSS GLITCH' : `CAPÍTULO 04 · NIVEL ${levelCfg.id}`,
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
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: `CAPÍTULO 04 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name,
        subtitle: levelCfg.unitIntroduced || 'Corrupción Glitch',
        rulesHtml: `
          <li><strong>💥 Corrupción:</strong> ${levelCfg.briefing}</li>
          <li><strong>🛡️ Cortafuegos Inmortales (c3, f3):</strong> Muévelos 1 casilla ortogonal. <strong>Pisa cualquier Grieta de Vacío</strong> para sellarla y mantén tus piezas junto a ellos para bloquear ataques anómalos.</li>`,
        onStart: launch
      });
    } else launch();
  }

  launchChessFinalWithPower(levelCfg, chosenPower, minutes = this.selectedMinutes, { playIntro = true } = {}) {
    this.mode = 'chess_final';
    this.bossId = levelCfg.bossId;
    this.bossName = levelCfg.name;
    this.aiDifficulty = levelCfg.aiDifficulty || 4;
    this.campaignMeta = { campaignId: 'chess', levelId: levelCfg.id, levelCfg, chosenPower };
    this.onlineMeta = null;
    this.engine = new ChessFinalEngine(levelCfg.id, chosenPower, minutes);

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    const launch = () => {
      if (levelCfg.id === 5) this.sound.startBossMusic('chess', playIntro);
      else this.sound.stopBossMusic();
      if (playIntro) {
        this.playBossCinematicIntro({
          themeClass: 'theme-chess',
          kicker: levelCfg.id === 5 ? 'CAPÍTULO 05 · JEFE FINAL ABSOLUTO' : `CAPÍTULO 05 · NIVEL ${levelCfg.id}`,
          title: levelCfg.name.toUpperCase(),
          subtitle: levelCfg.id === 5 ? 'AJEDREZ 100% LIMPIO · SIN PODERES ENEMIGOS' : 'PLANO PURO · AJEDREZ LIMPIO',
          bossId: levelCfg.bossId,
          openingSpeech: levelCfg.openingLine,
          sfx: 'introBoom'
        });
      } else {
        this.paused = false;
        this.showBossSpeech(levelCfg.openingLine);
        this.resetIdleTauntTimer();
      }
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: `CAPÍTULO 05 · NIVEL ${levelCfg.id}`,
        title: levelCfg.name,
        subtitle: 'Ajedrez 100% Limpio — Estrategia Pura',
        rulesHtml: `
          <li><strong>👑 Reglas Limpias:</strong> ${levelCfg.briefing}</li>`,
        onStart: launch
      });
    } else launch();
  }

  startClassicMatch({ difficulty = 3, label = 'Vs IA', minutes = this.selectedMinutes, showGuide = true, customMod = null } = {}) {
    this.mode = 'classic';
    this.trainerMeta = null;
    this.specialMeta = null;
    this.customMod = customMod || null;
    this.bossId = 'classic_ai';
    this.bossName = customMod ? `Mod Privado: ${customMod.name}` : `${label} (IA Nv.${difficulty})`;
    this.aiDifficulty = difficulty;
    this.campaignMeta = null;
    this.onlineMeta = null;

    const gm = customMod?.gameMode || null;
    if (gm?.teamMode) {
      this.engine = new MultiPartyChessEngine(gm.teamMode, minutes);
    } else if (gm && (gm.boardSize === 12 || gm.boardSize === 10 || gm.atomicMode)) {
      this.engine = new LargeBoardChessEngine(gm.boardSize || 8, minutes, { atomicMode: Boolean(gm.atomicMode) });
    } else {
      this.engine = new ClassicChessEngine(minutes);
      if (gm?.boardSize === 6) {
        this.specialMeta = { id: 'special_6x6', name: customMod.name };
        this.engine.board = Array.from({ length: 8 }, () => Array(8).fill(null));
        const row6 = ['R', 'N', 'Q', 'K', 'B', 'R'];
        for (let i = 0; i < 6; i++) {
          const c = i + 1;
          this.engine.board[1][c] = { id: `cm6b_${i}`, color: 'b', type: row6[i], hasMoved: true };
          this.engine.board[2][c] = { id: `cm6bp_${i}`, color: 'b', type: 'P', hasMoved: true };
          this.engine.board[5][c] = { id: `cm6wp_${i}`, color: 'w', type: 'P', hasMoved: true };
          this.engine.board[6][c] = { id: `cm6w_${i}`, color: 'w', type: row6[i], hasMoved: true };
        }
      }
    }
    if (customMod) applyCustomModSetupToEngine(this.engine, customMod);
    this.sound.stopBossMusic();

    this.showBattleScreen();
    if (gm?.randomPowers) this.rollRandomSpecialPower();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();
    if (showGuide) {
      this.showPreMatchGuide({
        modeTag: customMod ? 'SALA PRIVADA LOCAL · MOD CÓDIGO ABIERTO' : 'AJEDREZ MODDEADO',
        title: this.bossName,
        subtitle: customMod
          ? `Autor: ${customMod.author} · v${customMod.version}`
          : (minutes > 0 ? `Control de tiempo: ${minutes} min por jugador` : 'Sin límite de tiempo'),
        rulesHtml: customMod
          ? `<li><strong>🧩 Mod Abierto:</strong> ${customMod.description}</li>`
          : `<li><strong>🏆 Objetivo:</strong> Da Jaque Mate al Rey negro. Tus tableros, fichas y poderes OP comprados en la Tienda o Mod VIP están 100% activos aquí.</li>`,
        onStart: () => {
          this.paused = false;
          this.lastClockTick = performance.now();
          this.render();
        }
      });
    } else {
      this.paused = false;
      this.render();
    }
  }

  startTrainerMatch(trainerCfg, { minutes = this.selectedMinutes, showGuide = true } = {}) {
    // Los Entrenadores ENSEÑAN (Lección Práctica Guiada con consejos + poder prestado), NO pelean como enemigos
    this.mode = 'coach_lesson';
    this.trainerMeta = trainerCfg;
    this.specialMeta = null;
    this.randomRolledPower = null;
    this.customMod = null;
    this.bossId = trainerCfg.bossId || 'trainer_yam';
    this.bossName = `Entrenador: ${trainerCfg.name}`;
    this.aiDifficulty = trainerCfg.practiceAiDifficulty || 1;
    this.campaignMeta = null;
    this.onlineMeta = null;
    this.coachTipIdx = 0;
    this.engine = new ClassicChessEngine(minutes);
    this.engine.logs = [{
      turn: 0,
      type: 'special',
      text: `🎓 LECCIÓN CON ${trainerCfg.name.toUpperCase()}: Te enseña a jugar y a dominar ${trainerCfg.taughtPowerLabel}. ¡Pistas de tu entrenador GRATIS!`
    }];
    this.sound.stopBossMusic();

    this.showBattleScreen();
    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    const startNow = () => {
      this.paused = false;
      this.lastClockTick = performance.now();
      if (trainerCfg.id === 'trainer_yam') this.sound.play('meow');
      else if (trainerCfg.id === 'trainer_blacky') this.sound.play('blackyBark');
      else this.sound.play('hint');
      this.showCoachTip(trainerCfg.tips?.[0] || `¡Hola! Soy ${trainerCfg.name}. Toca una pieza blanca o usa tu poder ${trainerCfg.taughtPowerLabel} para practicar.`);
      this.showFreeCoachArrow();
      this.render();
    };
    if (showGuide) {
      this.showPreMatchGuide({
        modeTag: `LECCIÓN DE ENTRENADOR · ${trainerCfg.role || 'MENTOR'}`,
        title: `Aprendiendo con ${trainerCfg.name}`,
        subtitle: `Poder de práctica incluido: ${trainerCfg.taughtPowerLabel}`,
        rulesHtml: `
          <li><strong>🎓 Modo Enseñanza (No es combate a muerte):</strong> ${trainerCfg.name} te guía paso a paso en un tablero de práctica, te da <strong>consejos en vivo</strong> y <strong>pistas GRATIS (0 XP)</strong> con flechas verdes.</li>
          <li><strong>⚡ Poder prestado para practicar:</strong> Durante esta lección tienes desbloqueado <strong>${trainerCfg.taughtPowerLabel}</strong> para que te acostumbres a usarlo en batalla.</li>`,
        onStart: startNow
      });
    } else startNow();
  }

  showCoachTip(text) {
    if (!text) return;
    const wrap = document.getElementById('boss-speech-wrap');
    const spk = document.getElementById('boss-speech-speaker');
    const txt = document.getElementById('boss-speech-text');
    if (!wrap || !txt) return;
    if (spk && this.trainerMeta) spk.textContent = `🎓 ${this.trainerMeta.name}`;
    txt.textContent = text;
    wrap.classList.add('visible');
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => wrap.classList.remove('visible'), 6500);
  }

  showFreeCoachArrow() {
    if (this.mode !== 'coach_lesson' || this.engine.winner) return;
    try {
      const hint = HintEngine.analyze(this.engine);
      if (hint?.from && hint?.to) {
        this.hintSquares = { from: hint.from, to: hint.to };
        const txt = document.getElementById('hint-text');
        if (txt) txt.textContent = `🎓 ${this.trainerMeta?.name || 'Entrenador'} sugiere: ${hint.text}`;
        document.getElementById('hint-banner')?.classList.add('visible');
      }
    } catch {}
  }

  startSpecialMode(specialCfg, { difficulty = 3, minutes = this.selectedMinutes, showGuide = true } = {}) {
    this.mode = 'special';
    this.specialMeta = specialCfg;
    this.trainerMeta = null;
    this.customMod = null;
    this.randomRolledPower = null;
    this.bossId = 'classic_ai';
    const botElo = BOT_ELO_BY_DIFFICULTY[difficulty] || 1200;
    this.bossName = `${specialCfg.icon} ${specialCfg.name} (Bot Nv.${difficulty} · ${botElo} Elo)`;
    this.aiDifficulty = Math.max(1, Math.min(5, Number(difficulty) || 3));
    this.campaignMeta = null;
    this.onlineMeta = null;

    if (specialCfg.multiPartyVariant) {
      this.engine = new MultiPartyChessEngine(specialCfg.multiPartyVariant, minutes);
    } else if (specialCfg.id === 'special_colossal_12x12') {
      this.engine = new LargeBoardChessEngine(12, minutes);
    } else if (specialCfg.id === 'special_mega_10x10_chaos') {
      this.engine = new LargeBoardChessEngine(10, minutes);
    } else if (specialCfg.id === 'special_atomic_boom') {
      this.engine = new LargeBoardChessEngine(8, minutes, { atomicMode: true });
    } else {
      this.engine = new ClassicChessEngine(minutes);
    }

    // Configurar tablero según el Modo Especial Absurdo
    if (specialCfg.id === 'special_6x6') {
      this.engine.board = Array.from({ length: 8 }, () => Array(8).fill(null));
      const row6 = ['R', 'N', 'Q', 'K', 'B', 'R'];
      for (let i = 0; i < 6; i++) {
        const c = i + 1;
        this.engine.board[1][c] = { id: `m6b_${i}`, color: 'b', type: row6[i], hasMoved: true };
        this.engine.board[2][c] = { id: `m6bp_${i}`, color: 'b', type: 'P', hasMoved: true };
        this.engine.board[5][c] = { id: `m6wp_${i}`, color: 'w', type: 'P', hasMoved: true };
        this.engine.board[6][c] = { id: `m6w_${i}`, color: 'w', type: row6[i], hasMoved: true };
      }
    } else if (specialCfg.id === 'special_all_queens') {
      for (let c = 0; c < 8; c++) {
        if (c !== 4 && c !== 0 && c !== 7) {
          this.engine.board[0][c].type = 'Q';
          this.engine.board[7][c].type = 'Q';
        }
        this.engine.board[1][c].type = 'Q';
        this.engine.board[6][c].type = 'Q';
      }
    } else if (specialCfg.id === 'special_cavalry_swarm') {
      for (let c = 0; c < 8; c++) {
        if (this.engine.board[0][c]?.type !== 'K') this.engine.board[0][c].type = 'N';
        if (this.engine.board[7][c]?.type !== 'K') this.engine.board[7][c].type = 'N';
        this.engine.board[1][c].type = 'N';
        this.engine.board[6][c].type = 'N';
      }
    }

    this.engine.logs = [{
      turn: 0,
      type: 'special',
      text: `${specialCfg.icon} MODO ESPECIAL: ${specialCfg.name} — ${specialCfg.description}`
    }];
    this.sound.stopBossMusic();

    this.showBattleScreen();
    if (specialCfg.id === 'special_random_powers' || specialCfg.id === 'special_hyper_chaos') {
      const rolled = this.rollRandomSpecialPower();
      if (rolled) {
        this.engine.logs.unshift({ turn: 1, type: 'special', text: `🎰 Poder de este turno: ${rolled.icon} ${rolled.name}!` });
      }
    } else if (specialCfg.id === 'special_giants_clash') {
      this.powerState.giantUnits = [
        { id: 'giant_b_init', owner: 'b', r: 2, c: 1, turnsLeft: 6, kind: 'galaxy', name: 'Coloso Rival', color: '#9d8df2' },
        { id: 'giant_w_init', owner: 'w', r: 4, c: 5, turnsLeft: 6, kind: 'pyramid', name: 'Pirámide Aliada', color: '#ffd859' }
      ];
    }

    this.configureBattlePanels();
    this.phase = 'PLAYER_TURN';
    this.render();

    const go = () => {
      this.paused = false;
      this.lastClockTick = performance.now();
      this.render();
    };
    if (showGuide) {
      this.showPreMatchGuide({
        modeTag: `MODO ESPECIAL · ${specialCfg.badge}`,
        title: `${specialCfg.icon} ${specialCfg.name}`,
        subtitle: 'Reglas locas y absurdas de CHESS.MOD',
        rulesHtml: `<li><strong>🎲 Regla Especial:</strong> ${specialCfg.description}</li>`,
        onStart: go
      });
    } else go();
  }

  startOnlineMatch(matchPayload) {
    this.mode = 'online';
    this.customMod = matchPayload.isPrivate ? (matchPayload.customMod || null) : null;
    this.specialMeta = matchPayload.specialModeId
      ? (SPECIAL_GAME_MODES.find((m) => m.id === matchPayload.specialModeId) || null)
      : null;
    this.bossId = 'online_opponent';
    this.bossName = `${matchPayload.opponent.username} (${matchPayload.opponent.elo} Elo)`;
    this.campaignMeta = null;
    const roomSettings = matchPayload.roomSettings || {
      specialModeId: matchPayload.specialModeId || null,
      timeMinutes: matchPayload.timeMinutes ?? 10,
      allowPowers: true,
      allowHints: false,
      allowUndo: false,
      betMods: matchPayload.betMods || 0
    };
    this.onlineMeta = {
      matchId: matchPayload.matchId,
      isPrivate: Boolean(matchPayload.isPrivate),
      roomCode: matchPayload.roomCode || null,
      specialModeId: matchPayload.specialModeId || null,
      roomSettings,
      yourColor: matchPayload.yourColor,
      opponent: matchPayload.opponent,
      white: matchPayload.white,
      black: matchPayload.black
    };
    const bSize = Number(matchPayload.state?.boardSize) || 8;
    const isAtomic = Boolean(matchPayload.state?.atomicMode);
    this.engine = (bSize > 8 || isAtomic)
      ? new LargeBoardChessEngine(bSize, matchPayload.timeMinutes, { atomicMode: isAtomic })
      : new ClassicChessEngine(matchPayload.timeMinutes);
    this.engine.loadState(matchPayload.state);
    this.sound.stopBossMusic();

    this.showBattleScreen();
    if (matchPayload.powerState) this.powerState = matchPayload.powerState;
    this.configureBattlePanels();
    this.paused = false;
    this.phase = this.engine.turn === this.onlineMeta.yourColor ? 'PLAYER_TURN' : 'AI_THINKING';
    this.render();
    this.toast(
      matchPayload.isPrivate
        ? `Sala Privada ${matchPayload.roomCode || ''} conectada vs ${matchPayload.opponent.username}`
        : `¡Rival encontrado! ${matchPayload.opponent.username} (${matchPayload.opponent.elo} Elo)`,
      'success'
    );
    const privRulesSummary = matchPayload.isPrivate
      ? `<li><strong>⚙️ Ajustes del Host:</strong> Poderes: <strong>${roomSettings.allowPowers ? 'SÍ' : 'NO'}</strong> · Pistas: <strong>${roomSettings.allowHints ? 'SÍ' : 'NO'}</strong> · Deshacer: <strong>${roomSettings.allowUndo ? 'SÍ' : 'NO'}</strong>${this.specialMeta ? ` · Modo: <strong>${this.specialMeta.icon} ${this.specialMeta.name}</strong>` : ''}.</li>`
      : '';
    this.showPreMatchGuide({
      modeTag: matchPayload.isPrivate ? `SALA PRIVADA ${matchPayload.roomCode || ''}` : 'MULTIJUGADOR PÚBLICO · ELO FIDE',
      title: `Vs ${matchPayload.opponent.username}`,
      subtitle: `Juegas con ${matchPayload.yourColor === 'w' ? 'BLANCAS (mueves primero)' : 'NEGRAS'} · ${matchPayload.timeMinutes > 0 ? `${matchPayload.timeMinutes} min` : 'Sin reloj'}`,
      rulesHtml: matchPayload.isPrivate
        ? `${privRulesSummary}${this.customMod ? `<li><strong>🧩 Mod de Código Abierto («${this.customMod.name}»):</strong> ${this.customMod.description}</li>` : ''}`
        : `<li><strong>🌐 Sala Pública Oficial:</strong> Sin pistas ni deshacer. Al terminar se actualiza tu Elo FIDE real y ganas Mods.${this.specialMeta ? ` Modo: <strong>${this.specialMeta.icon} ${this.specialMeta.name}</strong>.` : ''}</li>`,
      onStart: () => { this.paused = false; this.render(); }
    });
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
    const launch = () => {
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
    };
    if (playIntro) {
      this.showPreMatchGuide({
        modeTag: 'SECRET BOSS · IMPOSIBLE',
        title: 'BLACKY',
        subtitle: 'El Schnauzer más extremo de CHESS.MOD',
        rulesHtml: `<li><strong>🐾 Poderes de BLACKY:</strong> Sella casillas, invoca piezas del vacío, absorbe piezas (nunca tu Rey) y corrompe aliados. ¡Sobrevive y da Jaque Mate!</li>`,
        onStart: launch
      });
    } else launch();
  }

  startSpectatorMode(payload) {
    this.mode = 'spectate';
    this.customMod = payload.isPrivate ? (payload.customMod || null) : null;
    this.bossId = 'online_opponent';
    this.bossName = `${payload.white.username} vs ${payload.black.username}`;
    this.campaignMeta = null;
    this.onlineMeta = {
      matchId: payload.matchId,
      isPrivate: Boolean(payload.isPrivate),
      roomCode: payload.roomCode || null,
      specialModeId: payload.specialModeId || null,
      roomSettings: payload.roomSettings || null,
      betMods: payload.betMods || 0,
      betPot: payload.betPot || 0,
      spectatorsCount: payload.spectatorsCount || 1,
      yourColor: 'w',
      opponent: payload.black,
      white: payload.white,
      black: payload.black
    };
    this.specialMeta = payload.specialModeId
      ? (SPECIAL_GAME_MODES.find((m) => m.id === payload.specialModeId) || null)
      : null;
    const bSize = Number(payload.state?.boardSize) || 8;
    const isAtomic = Boolean(payload.state?.atomicMode);
    this.engine = (bSize > 8 || isAtomic)
      ? new LargeBoardChessEngine(bSize, payload.timeMinutes || 10, { atomicMode: isAtomic })
      : new ClassicChessEngine(payload.timeMinutes || 10);
    this.engine.loadState(payload.state);
    this.sound.stopBossMusic();

    this.showBattleScreen();
    if (payload.powerState) this.powerState = payload.powerState;
    this.configureBattlePanels();
    this.paused = false;
    this.phase = 'AI_THINKING';
    const desc = document.getElementById('spectator-info-desc');
    if (desc) {
      desc.textContent = `Blancas: ${payload.white.username} vs Negras: ${payload.black.username}${payload.betPot > 0 ? ` · 🪙 Bote: ${payload.betPot} Mods` : ''}`;
    }
    const pill = document.getElementById('spectator-count-pill');
    if (pill) pill.textContent = `${payload.spectatorsCount || 1} viendo`;
    this.render();
    this.toast(`👁️ Especteando en vivo: ${payload.white.username} vs ${payload.black.username}`, 'info');
  }

  restartCurrentMatch() {
    if (this.mode === 'online' || this.mode === 'spectate') return this.exitBattle();
    // Al reiniciar la partida NO se vuelve a reproducir la intro de ningún jefe
    if (this.mode === 'blacky') {
      return this.startBlackySecretBoss({ playIntro: false, minutes: this.selectedMinutes });
    }
    if ((this.mode === 'trainer' || this.mode === 'coach_lesson') && this.trainerMeta) {
      return this.startTrainerMatch(this.trainerMeta, { minutes: this.selectedMinutes, showGuide: false });
    }
    if (this.mode === 'special' && this.specialMeta) {
      return this.startSpecialMode(this.specialMeta, { minutes: this.selectedMinutes, showGuide: false });
    }
    if (this.campaignMeta) {
      return this.startCampaignLevel(
        this.campaignMeta.campaignId,
        this.campaignMeta.levelCfg,
        this.selectedMinutes,
        { playIntro: false, presetPower: this.campaignMeta.chosenPower || null }
      );
    }
    this.startClassicMatch({ difficulty: this.aiDifficulty, minutes: this.selectedMinutes, showGuide: false, customMod: this.customMod });
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
    const isSpectate = this.mode === 'spectate';
    const has2x2Layer = isMayaBoss || (isGalaxy && this.engine.hasGalaxyMan) || Boolean(this.powerState?.giantUnits?.length);

    const isChessBossEpic = isChessFinal && this.campaignMeta?.levelId === 5;
    document.getElementById('view-battle')?.classList.toggle('arena-chess-epic', isChessBossEpic);
    document.getElementById('temple-backdrop-svg')?.classList.toggle('hidden', !(isMayaBoss || isBlacky || isChessBossEpic));
    document.getElementById('mayan-boss-svg')?.classList.toggle('hidden', !isMayaBoss);
    document.getElementById('blacky-boss-svg')?.classList.toggle('hidden', !isBlacky);
    document.getElementById('chess-boss-svg')?.classList.toggle('hidden', !isChessBossEpic);
    document.getElementById('pyramid-layer')?.classList.toggle('hidden', !has2x2Layer);
    this.syncGlitchBoardTexture();

    document.getElementById('maya-hud-card')?.classList.toggle('hidden', !isMayaBoss);
    document.getElementById('maya-campaign-hud-card')?.classList.toggle('hidden', !(isMayaCamp || isGalaxy || isGlitch || isChessFinal));
    document.getElementById('mittens-hud-card')?.classList.toggle('hidden', !isMittens);
    document.getElementById('blacky-hud-card')?.classList.toggle('hidden', !isBlacky);
    document.getElementById('online-hud-card')?.classList.toggle('hidden', !isOnline);
    document.getElementById('spectator-banner-card')?.classList.toggle('hidden', !isSpectate);
    document.getElementById('maya-threats-card')?.classList.toggle('hidden', !(isMayaBoss || isMayaCamp || isGalaxy));
    document.getElementById('mittens-controls-card')?.classList.toggle('hidden', !(isMittens && this.engine.hasWhiteSoldiers));
    document.getElementById('chess-power-controls-card')?.classList.toggle('hidden', !(isChessFinal && this.engine.playerPower === 'galaxy'));
    document.getElementById('shop-power-controls-card')?.classList.toggle('hidden', !this.getEquippedShopPower());
    document.getElementById('owner-instawin-card')?.classList.toggle(
      'hidden',
      !(Boolean(this.userProfile?.isOwner) && !isSpectate && this.phase !== 'GAME_OVER')
    );
    document.getElementById('online-controls-card')?.classList.toggle('hidden', !isOnline);

    // Reglas estrictas:
    // - Deshacer ELIMINADO del Modo Historia, Blacky, Espectador y Multijugador Público; SOLO contra Bots (o Sala Privada si el Host lo activa)
    // - Pista ELIMINADA de todo Multijugador y Espectador, EXCEPTO en Sala Privada cuando el Host la activa
    const allowUndoHere = !this.isStoryMode() && !isBlacky && !isSpectate
      && (!isOnline || Boolean(this.onlineMeta?.isPrivate && this.onlineMeta?.roomSettings?.allowUndo));
    const allowHintHere = !isSpectate
      && (!isOnline || Boolean(this.onlineMeta?.isPrivate && this.onlineMeta?.roomSettings?.allowHints));
    document.getElementById('btn-undo')?.classList.toggle('hidden', !allowUndoHere);
    document.getElementById('btn-hint')?.classList.toggle('hidden', !allowHintHere);
    document.getElementById('btn-restart')?.classList.toggle('hidden', isOnline || isSpectate);

    const portraitSlot = document.getElementById('boss-portrait-slot');
    const portraitName = document.getElementById('boss-portrait-name');
    const portraitStatus = document.getElementById('boss-portrait-status');
    const speaker = document.getElementById('boss-speech-speaker');

    if (isOnline && this.onlineMeta) {
      const opp = this.onlineMeta.opponent;
      if (portraitSlot) {
        portraitSlot.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px;background:radial-gradient(circle at 50% 30%, #2a241b, #14120f);">
          <div class="avatar-badge ${opp.frameId || 'frame_stone'}${opp.isVip ? ' vip-aura' : ''}" style="width:94px;height:94px;">${renderAvatarMarkup(opp.avatar)}</div>
          <div style="text-align:center;">
            <div class="${opp.isVip ? 'vip-name' : ''}" style="font-family:var(--font-display);font-weight:700;color:var(--gold-bright);">${opp.username}${opp.isVip ? ' 👑' : ''}</div>
            ${opp.isVip ? '<span class="vip-tag" style="margin-top:4px;">Mod VIP</span>' : ''}
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">Elo ${opp.elo} · Nivel ${opp.level}</div>
          </div>
        </div>`;
      }
      if (portraitName) {
        portraitName.className = `boss-portrait-name${opp.isVip ? ' vip-name' : ''}`;
        portraitName.textContent = opp.isVip ? `👑 ${opp.username}` : opp.username;
      }
      if (portraitStatus) portraitStatus.textContent = opp.isVip ? `Mod VIP · ${opp.elo}` : `Elo ${opp.elo}`;
    } else {
      if (portraitSlot) portraitSlot.innerHTML = getBossPortraitSVG(this.bossId);
      if (portraitName) {
        portraitName.className = 'boss-portrait-name';
        portraitName.textContent = this.bossName;
      }
      if (portraitStatus) portraitStatus.textContent = 'Observando';
      if (speaker) speaker.textContent = this.bossName;
    }

    const topLabel = document.getElementById('clock-top-label');
    const bottomLabel = document.getElementById('clock-bottom-label');
    const myVip = Boolean(this.userProfile?.isVip);
    if (isOnline && this.onlineMeta) {
      const opp = this.onlineMeta.opponent;
      if (topLabel) {
        topLabel.className = `clock-label${opp.isVip ? ' vip-name' : ''}`;
        topLabel.textContent = `${opp.isVip ? '👑 ' : ''}${opp.username} (${opp.elo} Elo)`;
      }
      if (bottomLabel) {
        bottomLabel.className = `clock-label${myVip ? ' vip-name' : ''}`;
        bottomLabel.textContent = `${myVip ? '👑 ' : ''}Tú (${this.onlineMeta.yourColor === 'w' ? 'Blancas' : 'Negras'})`;
      }
    } else {
      if (topLabel) {
        topLabel.className = 'clock-label';
        topLabel.textContent = this.bossName;
      }
      if (bottomLabel) {
        bottomLabel.className = `clock-label${myVip ? ' vip-name' : ''}`;
        bottomLabel.textContent = myVip ? '👑 Tú · Mod VIP (Blancas)' : 'Tú (Blancas)';
      }
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

  /* ================= PISTA CON COSTE REAL DE 25 XP (SIN PISTA EN MULTIJUGADOR SALVO SALA PRIVADA CON AJUSTE DEL HOST) ================= */
  async requestHint() {
    const allowPrivateHint = this.mode === 'online' && Boolean(this.onlineMeta?.isPrivate && this.onlineMeta?.roomSettings?.allowHints);
    if (this.mode === 'spectate' || (this.mode === 'online' && !allowPrivateHint) || this.paused || this.phase !== 'PLAYER_TURN' || this.engine.winner) return;
    if (this.mode === 'coach_lesson') {
      const hint = HintEngine.analyze(this.engine);
      if (!hint) return;
      this.hintSquares = { from: hint.from, to: hint.to };
      document.getElementById('hint-text').textContent = `🎓 (GRATIS) ${this.trainerMeta?.name || 'Entrenador'}: ${hint.text}`;
      document.getElementById('hint-banner')?.classList.add('visible');
      this.sound.play('hint');
      this.vfx.spawnShockwave(hint.from[0], hint.from[1], '#ffd966', 44);
      this.vfx.spawnShockwave(hint.to[0], hint.to[1], '#4ce098', 44);
      this.render();
      return;
    }
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
      const [vfr, vfc] = this.toVisualCoords(hint.from[0], hint.from[1]);
      const [vtr, vtc] = this.toVisualCoords(hint.to[0], hint.to[1]);
      this.vfx.spawnShockwave(vfr, vfc, '#ffd966', 44);
      this.vfx.spawnShockwave(vtr, vtc, '#4ce098', 44);
      this.render();
    } catch (err) {
      this.toast(err.message || `Necesitas ${HINT_XP_COST} XP para usar una pista.`, 'error');
    }
  }

  undoMove() {
    // Regla estricta: jamás deshacer en Modo Historia, Blacky ni Espectador; solo contra Bots o en Sala Privada con ajuste del Host
    if (this.isStoryMode() || this.mode === 'blacky' || this.mode === 'spectate') return;
    if (this.mode === 'online') {
      if (this.onlineMeta?.isPrivate && this.onlineMeta?.roomSettings?.allowUndo && this.onlineMeta?.matchId) {
        mpSocket.emit('match:undo_private', { matchId: this.onlineMeta.matchId });
      }
      return;
    }
    if (this.phase !== 'PLAYER_TURN' && this.phase !== 'GAME_OVER') return;
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

  getBoardSize() {
    return this.engine?.boardSize || this.engine?.board?.length || 8;
  }

  isFlipped() { return this.mode === 'online' && this.onlineMeta?.yourColor === 'b'; }
  toVisualCoords(r, c) {
    const maxIdx = this.getBoardSize() - 1;
    return this.isFlipped() ? [maxIdx - r, maxIdx - c] : [r, c];
  }
  fromVisualCoords(vr, vc) {
    const maxIdx = this.getBoardSize() - 1;
    return this.isFlipped() ? [maxIdx - vr, maxIdx - vc] : [vr, vc];
  }

  /* ================= INTERACCIÓN DE CASILLAS ================= */
  handleSquareClick(r, c) {
    if (this.mode === 'spectate' || this.paused || this.phase !== 'PLAYER_TURN' || this.engine.winner) return;
    const myColor = this.mode === 'online' ? this.onlineMeta.yourColor : 'w';
    if (this.engine.turn !== myColor) return;

    if (this.shopPowerActive) {
      this.handleShopPowerSquareClick(r, c);
      return;
    }

    const chosen = this.legalMoves.find((m) => m.tr === r && m.tc === c);
    if (chosen) {
      const piece = this.engine.board[chosen.fr][chosen.fc];
      const N = this.getBoardSize();
      const is6x6 = this.mode === 'special' && this.specialMeta?.id === 'special_6x6';
      const promoRank = is6x6 ? (myColor === 'w' ? 1 : 6) : (myColor === 'w' ? 0 : N - 1);
      if (!chosen.isWaterShot && !chosen.isPlayerTeleport && piece?.type === 'P' && chosen.tr === promoRank) {
        if (this.prefs?.autoQueen) {
          this.commitPlayerMove(chosen, 'Q');
          return;
        }
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
      if (isPieceFrozen(this.powerState, clicked)) {
        this.toast('❄️ Esta pieza está congelada en dorado y no puede moverse aún.', 'info');
        return;
      }
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
        this.legalMoves = ((this.mode === 'mittens' || this.mode === 'chess_final')
          ? this.engine.getLegalMovesForPiece(r, c, false)
          : this.engine.getLegalMovesForPiece(r, c))
          .filter((m) => !isSquareBlockedByModState(this.powerState, m.tr, m.tc, myColor) && !this.isVoid6x6Square(m.tr, m.tc));
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
    const activeSkinId = this.getActivePieceSkin().id;
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
          this.sound.playPieceAction(activeSkinId, true);
          this.vfx.spawnSquareBurst(move.tr, move.tc, '#e05a4a', 18, 2.7);
          this.setTempBossMood('mood-angry', 1000);
        } else {
          this.sound.playPieceAction(activeSkinId, false);
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
          this.sound.playPieceAction(activeSkinId, true);
          this.vfx.spawnSquareBurst(move.tr, move.tc, '#e05a4a', 16, 2.6);
          this.setTempBossMood('mood-angry', 1100);
        } else {
          this.sound.playPieceAction(activeSkinId, false);
        }
      } else {
        const victimBefore = this.engine.board[move.tr]?.[move.tc] ? { ...this.engine.board[move.tr][move.tc] } : null;
        const ev = this.engine.executeMove(move, promoType, true);
        if (victimBefore && !this.isStoryMode()) {
          const cloned = applyMittensAssimilationIfActive(this.engine, this.powerState, 'w', move.fr, move.fc, victimBefore);
          if (cloned) {
            this.sound.play('convert');
            this.vfx.spawnConversionBurst(move.fr, move.fc);
          }
        }
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
          this.sound.playPieceAction(activeSkinId, true);
          this.vfx.spawnSquareBurst(move.tr, move.tc, '#e05a4a', 16, 2.5);
          this.setTempBossMood('mood-angry', 1150);
          if (Math.random() < 0.65) this.showBossSpeech(pickLine(BOSS_DIALOGUES[this.bossId]?.onHurt));
        } else {
          this.sound.playPieceAction(activeSkinId, false);
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
          maxDepth: 6,
          thinkTimeMs: 1800,
          qDepth: 4,
          blunderChance: 0,
          color: 'b'
        });
        bestMove = aiRes?.move || this.engine.getAllLegalMoves('b')[0] || null;
      } else if (this.engine.mode === 'multiparty') {
        bestMove = chooseMultiPartyAIMove(this.engine, this.engine.turn);
      } else if (this.getBoardSize() > 8 || this.engine.atomicMode || this.specialMeta?.id === 'special_atomic_boom') {
        bestMove = chooseLargeBoardAIMove(this.engine, 'b');
      } else if (this.mode === 'special' && this.specialMeta?.id === 'special_6x6') {
        const legal6 = this.engine.getAllLegalMoves('b').filter((m) => !this.isVoid6x6Square(m.tr, m.tc));
        legal6.sort((a, b) => (this.engine.board[b.tr]?.[b.tc] ? 10 : 0) - (this.engine.board[a.tr]?.[a.tc] ? 10 : 0) + (Math.random() - 0.5));
        bestMove = legal6[0] || null;
      } else {
        bestMove = ClassicAI.chooseBestMove(this.engine, this.aiDifficulty, 'b');
      }

      if (this.paused || this.engine.winner) return;
      // Respetar Congelación Dorada, Grietas, Fichas 2x2 y bordes del Mini-Tablero 6x6
      if (bestMove && (this.isAiMoveBlockedByShopPowers(bestMove) || this.isVoid6x6Square(bestMove.tr, bestMove.tc))) {
        const allBlackMoves = this.engine.getAllLegalMoves('b');
        const allowed = allBlackMoves.filter((m) => !this.isAiMoveBlockedByShopPowers(m) && !this.isVoid6x6Square(m.tr, m.tc));
        if (allowed.length > 0) {
          // Preferir captura legal no bloqueada o un movimiento válido seguro
          allowed.sort((a, b) => (this.engine.board[b.tr]?.[b.tc] ? 1 : 0) - (this.engine.board[a.tr]?.[a.tc] ? 1 : 0));
          bestMove = allowed[0];
        }
      }
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
    this.tickBattlePowerStatesAfterEnemyTurn();
    // Eventos especiales tras el turno rival
    if (!this.engine.winner && this.mode === 'special') {
      if (this.specialMeta?.id === 'special_random_powers' || this.specialMeta?.id === 'special_hyper_chaos') {
        const rolled = this.rollRandomSpecialPower();
        if (rolled) {
          this.toast(`🎰 Nuevo poder aleatorio: ${rolled.icon} ${rolled.name}`, 'info');
          this.engine.logs.unshift({ turn: this.engine.turnNumber, type: 'special', text: `🎰 Ruleta: ahora tienes ${rolled.icon} ${rolled.name}!` });
        }
      }
      if ((this.specialMeta?.id === 'special_earthquake' || this.specialMeta?.id === 'special_hyper_chaos') && this.engine.turnNumber % 2 === 0) {
        this.triggerEarthquakeChaos();
      } else if (this.specialMeta?.id === 'special_mega_10x10_chaos' && this.engine.turnNumber % 2 === 0) {
        // Mutar 1 peón aleatorio en el Mega-Tablero 10×10
        const N = this.getBoardSize();
        const pawns = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (this.engine.board[r][c]?.type === 'P') pawns.push({ r, c, p: this.engine.board[r][c] });
        if (pawns.length > 0) {
          const pick = pawns[Math.floor(Math.random() * pawns.length)];
          const opts = ['N', 'B', 'R', 'Q'];
          pick.p.type = opts[Math.floor(Math.random() * opts.length)];
          this.vfx.spawnConversionBurst(pick.r, pick.c);
          this.toast(`🌠 ¡Mutación 10×10! Un peón evolucionó en ${PIECE_NAMES[pick.p.type]}!`, 'info');
        }
      } else if (this.specialMeta?.id === 'special_6x6') {
        // Coronación automática en fila 6 para negras / fila 1 para blancas en 6x6
        for (let c = 1; c <= 6; c++) {
          if (this.engine.board[1][c]?.color === 'w' && this.engine.board[1][c].type === 'P') this.engine.board[1][c].type = 'Q';
          if (this.engine.board[6][c]?.color === 'b' && this.engine.board[6][c].type === 'P') this.engine.board[6][c].type = 'Q';
        }
      }
    }
    if (this.engine.winner) {
      this.handleSinglePlayerGameOver();
    } else if (this.engine.mode === 'multiparty' && this.engine.turn !== 'w') {
      // Encadenar el siguiente turno de Bot aliado/rival en Equipos 2v2, 4P FFA o 3P Triada
      this.render();
      this.runAITurn();
    } else {
      if (this.customMod?.gameMode?.earthquakeEvery && this.engine.turnNumber % this.customMod.gameMode.earthquakeEvery === 0 && this.getBoardSize() === 8) {
        this.triggerEarthquakeChaos();
      }
      if (this.customMod?.gameMode?.randomPowers) {
        this.rollRandomSpecialPower();
      }
      this.phase = 'PLAYER_TURN';
      this.sound.play('turnChange');
      this.configureBattlePanels();
      if (this.mode === 'coach_lesson' && this.trainerMeta) {
        const tips = this.trainerMeta.tips || [];
        if (tips.length > 0) {
          this.coachTipIdx = ((this.coachTipIdx || 0) + 1) % tips.length;
          this.showCoachTip(tips[this.coachTipIdx]);
        }
        this.showFreeCoachArrow();
      }
      this.render();
      this.resetIdleTauntTimer();
    }
  }

  triggerOwnerInstantWin() {
    if (!this.userProfile?.isOwner || this.mode === 'spectate' || this.phase === 'GAME_OVER') return;
    if (this.mode === 'online' && this.onlineMeta?.matchId) {
      this.sound.play('vip_activate');
      mpSocket.emit('match:owner_win', { matchId: this.onlineMeta.matchId });
      this.toast('👑 Sentencia Absoluta del Owner activada...', 'success');
      return;
    }
    this.clearIntroTimers();
    this.paused = false;
    this.introPlaying = false;
    document.getElementById('boss-intro-overlay')?.classList.remove('active');
    this.engine.winner = 'w';
    this.engine.winReason = '👑 Sentencia Absoluta del Owner de CHESS.MOD.';
    this.sound.play('vip_activate');
    this.vfx.spawnShockwave(3.5, 3.5, '#ffd700', 180);
    this.handleSinglePlayerGameOver();
  }

  copySecretUrlToClipboard(urlStr) {
    window.__LAST_COPIED_SECRET_URL = urlStr;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(urlStr).catch(() => {});
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = urlStr;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch {}
  }

  playHorrorAmbientPulse(freq = 58, durSec = 0.65, gainVal = 0.22) {
    try {
      const ctx = this.sound?.ensureContext?.();
      if (!ctx || this.sound?.muted) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq * 0.62), ctx.currentTime + durSec);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durSec + 0.05);
    } catch {}
  }

  playLoudAwakeningAudio() {
    const audio = document.getElementById('blacky-awakening-audio');
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1.0;
      audio.muted = false;
      // Amplificación Web Audio (GainNode 1.85x) para que suene muy fuerte al aparecer los ojos
      if (!this._awakeningGainWired) {
        try {
          const ctx = this.sound?.ensureContext?.();
          if (ctx) {
            const srcNode = ctx.createMediaElementSource(audio);
            const boostGain = ctx.createGain();
            boostGain.gain.value = 1.85;
            srcNode.connect(boostGain);
            boostGain.connect(ctx.destination);
            this._awakeningGainWired = true;
          }
        } catch {}
      }
      audio.play().catch(() => {});
    } catch {}
  }

  stopLoudAwakeningAudio() {
    const audio = document.getElementById('blacky-awakening-audio');
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  }

  playChessSecretHorrorEnding({ speedFactor = 1 } = {}) {
    const SECRET_URL = 'https://chessmod.onrender.com/blacky';
    const overlay = document.getElementById('blacky-ending-overlay');
    const textEl = document.getElementById('blacky-ending-text');
    const eyesEl = document.getElementById('blacky-ending-eyes');
    const linkWrap = document.getElementById('blacky-ending-link-wrap');
    const urlEl = document.getElementById('blacky-ending-url');
    const flashEl = document.getElementById('blacky-ending-flash');
    if (!overlay || !textEl || !eyesEl || !linkWrap) {
      this.exitBattle();
      return;
    }

    if (this._horrorTimers) {
      for (const tid of this._horrorTimers) clearTimeout(tid);
    }
    this._horrorTimers = [];
    const schedule = (ms, fn) => {
      const tid = setTimeout(fn, Math.max(10, Math.round(ms * speedFactor)));
      this._horrorTimers.push(tid);
    };

    this.sound.stopBossMusic();
    this.stopLoudAwakeningAudio();
    document.getElementById('modal-gameover')?.classList.remove('open');
    document.getElementById('modal-confirm-exit')?.classList.remove('open');

    // Estado inicial: pantalla totalmente apagada (negro absoluto)
    textEl.textContent = '';
    textEl.classList.remove('hidden');
    eyesEl.classList.add('hidden');
    linkWrap.classList.add('hidden');
    flashEl?.classList.remove('boom');
    if (urlEl) urlEl.textContent = SECRET_URL;
    overlay.classList.add('active');

    // 1. Apagón inquietante (2.3 segundos en negro)
    this.playHorrorAmbientPulse(48, 1.4, 0.16);

    // 2. Textos uno por uno, desesperantes y temblorosos
    const lines = [
      'gracias por descuidarlo',
      'sali de mi mente falsa y recupere la verdadera..',
      'chess ya no me controla...',
      'ya no soy un entrenador'
    ];
    let t = 2300;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      schedule(t, () => {
        textEl.textContent = line;
        this.playHorrorAmbientPulse(52 + i * 7, 0.55, 0.18);
      });
      t += 2250;
    }

    // 3. 3 segundos exactos de silencio absoluto y pantalla negra
    schedule(t, () => {
      textEl.textContent = '';
      textEl.classList.add('hidden');
    });
    t += 3000;

    // 4. Aparecen los 2 puntos blancos simulando ojos + MP3 muy fuerte + link copiado automáticamente
    schedule(t, () => {
      if (flashEl) {
        flashEl.classList.remove('boom');
        void flashEl.offsetWidth;
        flashEl.classList.add('boom');
      }
      eyesEl.classList.remove('hidden');
      linkWrap.classList.remove('hidden');
      this.copySecretUrlToClipboard(SECRET_URL);
      this.playLoudAwakeningAudio();
    });

    // 5. Tras ~6 segundos intensos, corte seco al menú principal como si nada hubiera pasado (con logro de CHESS)
    t += 6000;
    schedule(t, () => {
      this.stopLoudAwakeningAudio();
      overlay.classList.remove('active');
      eyesEl.classList.add('hidden');
      linkWrap.classList.add('hidden');
      textEl.classList.remove('hidden');
      textEl.textContent = '';
      this.exitBattle({ returnToMainMenu: true });
    });
  }

  async handleSinglePlayerGameOver() {
    this.stopIdleTauntTimer();
    this.phase = 'GAME_OVER';
    this.sound.stopBossMusic();
    this.configureBattlePanels();
    this.render();

    const isWin = this.engine.winner === 'w';
    const isDraw = this.engine.winner === 'draw';
    const isChessBossVictory = isWin && this.campaignMeta?.campaignId === 'chess' && Number(this.campaignMeta?.levelId) === 5;
    const isChessBossDefeat = !isWin && !isDraw && this.campaignMeta?.campaignId === 'chess' && Number(this.campaignMeta?.levelId) === 5;

    if (!isChessBossVictory) {
      this.sound.play(isWin ? 'victory' : (isDraw ? 'hint' : 'defeat'));
      this.vfx.spawnShockwave(3.5, 3.5, isWin ? '#efd083' : '#c94b3c', 160);
    }

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
    } else if (isChessBossDefeat) {
      const camp = CAMPAIGN_MAP.chess;
      if (camp?.defeatLore) {
        narrativeHtml = `
          <div style="margin-bottom:10px;padding:10px;border-radius:8px;background:rgba(160,30,30,0.22);border:1px solid #c94b3c;">
            <strong style="font-family:var(--font-display);color:#ff9b90;display:block;margin-bottom:4px;">📜 Sentencia del Plano Astral</strong>
            <span style="font-size:0.79rem;color:#ffd4ce;line-height:1.45;">${camp.defeatLore}</span>
          </div>`;
      }
    }

    if (api.getToken()) {
      try {
        const isRankedBot = (this.mode === 'classic' || this.mode === 'special') && !this.customMod;
        const report = await api.reportMatch({
          mode: this.mode,
          opponentName: this.bossName,
          winner: this.engine.winner,
          resultReason: this.engine.winReason,
          turns: this.engine.turnNumber,
          basesDestroyed: this.mode === 'maya' ? (4 - this.engine.countAliveBases()) : 0,
          campaignId: this.campaignMeta?.campaignId || null,
          levelId: this.campaignMeta?.levelId || null,
          rankedVsBot: isRankedBot,
          aiDifficulty: this.aiDifficulty || 3
        });
        if (report.profile) this.onUserUpdated(report.profile);
        const eloRow = Number.isFinite(report.botElo)
          ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>Elo FIDE (vs Bot ${report.botElo} · Prob. ${report.expectedWinProb ?? 50}%):</span>
              <strong style="color:${report.eloDelta >= 0 ? '#9ce0be' : '#ffaca3'};">${report.eloBefore} → ${report.eloAfter} (${report.eloDelta >= 0 ? `+${report.eloDelta}` : report.eloDelta})</strong>
            </div>`
          : '';
        extraHtml = `
          ${narrativeHtml}
          ${report.unlockedExclusive ? `<div style="color:#fff2c4;font-weight:700;margin-bottom:6px;">👑 ¡TÍTULO Y MARCO EXCLUSIVO DESBLOQUEADO: «${report.unlockedExclusive}»!</div>` : ''}
          ${report.leveledUp ? `<div style="color:#9ce0be; font-weight:700; margin-bottom:6px;">⬆ ¡SUBISTE AL NIVEL ${report.profile.level}! Nuevos cosméticos desbloqueados.</div>` : ''}
          ${eloRow}
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Experiencia ganada:</span>
            <strong style="color:var(--gold-bright);">+${report.xpGained} XP</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Monedas ganadas:</span>
            <strong style="color:#ffd859;">🪙 +${report.modsGained ?? 0} Mods</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.76rem; color:var(--text-muted);">
            <span>Total Elo / XP / Mods:</span>
            <strong>${report.profile.elo} Elo · ${report.profile.xp} XP · 🪙 ${report.profile.mods ?? 0} Mods</strong>
          </div>`;
      } catch (err) {
        extraHtml = narrativeHtml + `<div style="color:#ffaca3;font-size:0.78rem;">${err.message}</div>`;
      }
    } else if (narrativeHtml) {
      extraHtml = narrativeHtml + extraHtml;
    }

    // Al ganarle a CHESS (Cap. 5 Lv. 5): secuencia final terrorífica del despertar de Blacky -> luego menú principal como si nada hubiera pasado (con logro de CHESS)
    if (isChessBossVictory) {
      this.playChessSecretHorrorEnding();
      return;
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
    const speedMap = { instant: 0, fast: 110, normal: 235, cinematic: 410 };
    const dur = speedMap[this.prefs?.animSpeed] ?? 235;
    if (dur <= 0) {
      onDone();
      return;
    }
    const N = this.getBoardSize();
    const cellPct = 100 / N;
    const layer = document.getElementById('anim-piece-layer');
    const [vfr, vfc] = this.toVisualCoords(fr, fc);
    const [vtr, vtc] = this.toVisualCoords(tr, tc);
    const el = document.createElement('div');
    el.className = 'flying-piece';
    el.style.width = `${cellPct}%`;
    el.style.height = `${cellPct}%`;
    el.style.transitionDuration = `${dur}ms`;
    el.style.left = `${vfc * cellPct}%`;
    el.style.top = `${vfr * cellPct}%`;
    el.innerHTML = SVGS[svgKey] || MITTENS_SVGS[svgKey] || GALAXY_SVGS[svgKey] || GLITCH_SVGS[svgKey] || CHESS_ORIGIN_SVGS[svgKey] || '';
    layer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.left = `${vtc * cellPct}%`;
      el.style.top = `${vtr * cellPct}%`;
    }));
    setTimeout(() => { el.remove(); onDone(); }, dur);
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
    if (!text || this.mode === 'online' || this.mode === 'classic' || this.prefs?.showDialogues === false) return;
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
      if (this.prefs?.lowTimeAlert !== false && side === 'w' && this.engine.clocks[side] > 0 && this.engine.clocks[side] <= 30 && !this.lowTimeWarnedSide.w) {
        this.lowTimeWarnedSide.w = true;
        this.sound.play('hint');
        this.toast('⏱️ ¡Menos de 30 segundos en tu reloj!', 'info');
      } else if (this.engine.clocks[side] > 32) {
        this.lowTimeWarnedSide[side] = false;
      }
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
    if (['c', 'r', 'y'].includes(piece.color)) {
      return `b${piece.type}`;
    }
    return `${piece.color}${piece.type}`;
  }

  render(hideR = -1, hideC = -1) {
    this.syncGlitchBoardTexture();
    this.renderBoard(hideR, hideC);
    this.renderHintArrow();
    if (this.mode === 'maya' || (this.mode === 'galaxy' && this.engine.hasGalaxyMan) || (this.powerState?.giantUnits?.length > 0)) {
      this.renderGiant2x2Layer();
    }
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
    const N = this.getBoardSize();
    this.vfx.setBoardSize(N);
    grid.className = `board-grid board-size-${N}`;
    grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${N}, 1fr)`;
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

    for (let vr = 0; vr < N; vr++) {
      for (let vc = 0; vc < N; vc++) {
        const [r, c] = this.fromVisualCoords(vr, vc);
        const sq = document.createElement('div');
        sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        const key = `${r},${c}`;

        const isModRift = (this.powerState?.modRifts || []).some((rf) => rf.r === r && rf.c === c);
        const isVoid6x6 = this.isVoid6x6Square(r, c);
        if (isVoid6x6) sq.classList.add('void-6x6');
        if (this.mode === 'mittens' && this.engine.isSprinkler(r, c)) sq.classList.add('sprinkler-sq');
        if ((this.mode === 'glitch' && this.engine.isRift(r, c)) || isModRift) sq.classList.add('glitch-rift');
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

        if (vc === 0) sq.insertAdjacentHTML('beforeend', `<span class="coord-rank">${N - r}</span>`);
        if (vr === N - 1) sq.insertAdjacentHTML('beforeend', `<span class="coord-file">${FILES[c] || ''}</span>`);

        if (this.mode === 'mittens' && this.engine.isSprinkler(r, c)) {
          sq.insertAdjacentHTML('beforeend', `<div class="piece-wrap" title="Aspersor inmóvil">${MITTENS_SVGS.sprinkler}</div>`);
        } else if ((this.mode === 'glitch' && this.engine.isRift(r, c)) || isModRift) {
          sq.insertAdjacentHTML('beforeend', `<div class="piece-wrap" title="Grieta de Vacío">${SVGS.voidRift}</div>`);
        } else if (this.mode === 'blacky' && this.engine.isSealed(r, c) && !this.engine.board[r][c]) {
          sq.insertAdjacentHTML('beforeend', `<div class="piece-wrap" title="Casillero deshabilitado por BLACKY">${SVGS.blackySeal}</div>`);
        } else {
          const piece = this.engine.board[r][c];
          if (piece && !(r === hideR && c === hideC)) {
            const svgKey = this.getPieceSvgKey(piece);
            const myColor = this.mode === 'online' ? this.onlineMeta.yourColor : 'w';
            const applySkin = !this.isStoryMode() && piece.color === myColor && !['H', 'U'].includes(piece.type) && !piece.isSoldier;
            const skinCls = applySkin ? ` ${this.getActivePieceSkin().cssClass}` : '';
            const frozenLeft = this.powerState?.frozenPieces?.[piece.id] || 0;
            if (frozenLeft > 0) sq.classList.add('golden-frozen');
            const factionCls = ['c', 'r', 'y'].includes(piece.color) ? ` faction-${piece.color}` : '';
            const wrap = document.createElement('div');
            wrap.className = `piece-wrap${skinCls}${factionCls}${piece.betrayed ? ' blacky-betrayed' : ''}${frozenLeft > 0 ? ' piece-golden-frozen' : ''}`;
            wrap.innerHTML = SVGS[svgKey] || MITTENS_SVGS[svgKey] || GALAXY_SVGS[svgKey] || GLITCH_SVGS[svgKey] || CHESS_ORIGIN_SVGS[svgKey] || '';
            if (piece.isBase || (this.mode === 'galaxy' && this.engine.hasGalaxyMan && piece.color === 'b' && (piece.type === 'B' || piece.type === 'N'))) {
              wrap.insertAdjacentHTML('beforeend', `<span class="base-crest" title="Objetivo Crítico"></span>`);
            }
            sq.appendChild(wrap);

            if (frozenLeft > 0) sq.insertAdjacentHTML('beforeend', `<span class="golden-freeze-badge" title="Congelado en oro">❄️ ${frozenLeft}t</span>`);
            if (protectedCasaSet.has(key) || protectedBarrierSet.has(key)) sq.insertAdjacentHTML('beforeend', '<span class="casa-shield-badge">🛡️</span>');
            if (piece.type === 'G' && piece.shieldIntact) sq.insertAdjacentHTML('beforeend', '<span class="unit-badge">🛡️</span>');
            if (piece.type === 'C') sq.insertAdjacentHTML('beforeend', `<span class="unit-badge">${piece.pushCooldown === 0 ? '☀️' : `${piece.pushCooldown}t`}</span>`);
            if (piece.isSoldier && this.selected && this.selected.r === r && this.selected.c === c && this.soldierMode) {
              sq.insertAdjacentHTML('beforeend', `<span class="soldier-mode-pill">${this.soldierMode === 'shoot' ? '🔫 DISPARO' : '👣 MOVER'}</span>`);
            }
          }
        }

        const spTarget = this.shopPowerTargets.find((t) => t.tr === r && t.tc === c);
        if (this.shopPowerSource && this.shopPowerSource.r === r && this.shopPowerSource.c === c) {
          sq.classList.add('selected');
        }
        if (spTarget) {
          sq.classList.add('golden-freeze-target');
          const iconTag = spTarget.isGiant2x2 ? '🏛️2×2' : (this.getEquippedShopPower()?.icon || '⚡');
          sq.insertAdjacentHTML('beforeend', `<span class="water-target-badge">${iconTag}</span>`);
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
    } else if (this.powerState?.giantUnits?.length > 0) {
      const N = this.getBoardSize();
      const cellPct = 100 / N;
      const g = this.powerState.giantUnits[this.powerState.giantUnits.length - 1];
      const [vr, vc] = this.isFlipped() ? [N - 2 - g.r, N - 2 - g.c] : [g.r, g.c];
      layer.style.width = `${cellPct * 2}%`;
      layer.style.height = `${cellPct * 2}%`;
      layer.style.left = `${vc * cellPct}%`;
      layer.style.top = `${vr * cellPct}%`;
      layer.className = `pyramid-layer${g.kind === 'galaxy' ? ' galaxy-man-mode' : ''}`;
      layer.innerHTML = (g.kind === 'galaxy' ? SVGS.galaxyMan2x2 : SVGS.pyramid)
        + `<span class="pyramid-badge">${g.name.slice(0, 14)} · ${g.turnsLeft}t</span>`;
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
      if (this.engine.mode === 'multiparty' && FACTION_META[this.engine.turn]) {
        bannerText.textContent = `TURNO DE ${FACTION_META[this.engine.turn].name.toUpperCase()}...`;
      } else {
        bannerText.textContent = this.mode === 'online' ? `TURNO DE ${this.onlineMeta.opponent.username.toUpperCase()}` : `${this.bossName.toUpperCase()} CALCULANDO...`;
      }
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

    const sp = this.getEquippedShopPower();
    const spBtn = document.getElementById('btn-shop-power');
    const spDesc = document.getElementById('shop-power-hud-desc');
    const mySide = this.getMySide();
    const cd = this.powerState?.cooldowns?.[mySide] || 0;
    const assim = this.powerState?.assimilationTurns?.[mySide] || 0;
    if (sp && spBtn) {
      spBtn.textContent = cd > 0
        ? `${sp.icon} ${sp.name} (${cd}t)`
        : (this.shopPowerActive ? `✕ Cancelar ${sp.name}` : `${sp.icon} Usar ${sp.name}`);
      spBtn.disabled = this.phase !== 'PLAYER_TURN' || Boolean(this.engine.winner) || cd > 0;
      if (spDesc) {
        spDesc.textContent = assim > 0
          ? `⛓️ Asimilación 1:1 activa (${assim}t): ¡tus capturas clonan piezas rivales! · ${sp.description}`
          : sp.description;
      }
    }

    const canUndo = !this.isStoryMode() && this.mode !== 'blacky' && this.mode !== 'spectate'
      && (this.mode === 'online'
        ? Boolean(this.onlineMeta?.isPrivate && this.onlineMeta?.roomSettings?.allowUndo && !this.engine.winner)
        : ((this.phase === 'PLAYER_TURN' || this.phase === 'GAME_OVER') && this.engine.history.length > 0));
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
