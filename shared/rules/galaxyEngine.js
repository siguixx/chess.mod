import { PIECE_NAMES, toAlg, inBounds, dirText } from '../config/constants.js';

/**
 * Motor del Capítulo 03 — ENTIDAD GALÁCTICA (5 Niveles)
 *
 * Reglas y Mecánicas:
 * - Todas las piezas negras son piezas cósmicas (juegan limpio respetando turnos).
 * - Teletransporte Galáctico: con enfriamiento de turnos (teleportCooldown), la Entidad puede
 *   teletransportar una pieza propia (no Rey) a cualquier casilla vacía legal.
 * - BARRERA UNIVERSAL ('U', 2 estructuras del jugador en c3 y f3):
 *   - Se mueve 1 casilla ortogonal a casillas vacías (nunca captura).
 *   - Inmune: NO puede ser comida, capturada ni destruida.
 *   - Bloqueo: Ninguna pieza enemiga (ni el Hombre Galaxia 2×2) puede pasar por encima ni ocuparla.
 *   - Protección alrededor: Protege a piezas aliadas adyacentes (4 direcciones ortogonales) contra
 *     el aplastamiento y poderes especiales de la Entidad Galáctica, PERO sí pueden ser capturadas
 *     por capturas normales de piezas enemigas.
 * - HOMBRE GALAXIA 2×2 (Exclusivo del Nivel 5):
 *   - Ocupa 2×2 casillas (inicia en d6-e5 -> r=2, c=3).
 *   - Se mueve como una TORRE en bloque 2×2 (horizontal o vertical, cualquier distancia libre).
 *   - Invulnerable a ataques directos; se derrota eliminando TODOS los Alfiles y Caballos enemigos
 *     (disparando la intervención decisiva de Free Mittens).
 */
export class GalaxyEngine {
  constructor(levelId = 5, minutes = 10) {
    this.mode = 'galaxy';
    this.levelId = Math.max(1, Math.min(5, Number(levelId) || 5));
    this.timePresetMinutes = minutes;
    this.reset(this.levelId, minutes);
  }

  reset(levelId = this.levelId, minutes = this.timePresetMinutes) {
    this.levelId = Math.max(1, Math.min(5, Number(levelId) || 5));
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `gB_${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `gP_${c}`, color: 'b', type: 'P', hasMoved: false };
      this.board[7][c] = { id: `wB_${c}`, color: 'w', type: back[c], hasMoved: false };
      this.board[6][c] = { id: `wP_${c}`, color: 'w', type: 'P', hasMoved: false };
    }

    // Progresión gradual en Niveles 1-2
    if (this.levelId === 1) {
      this.board[0][6] = null; // Menos 1 Caballo en Nivel 1
      this.board[1][6] = null;
    } else if (this.levelId === 2) {
      this.board[1][7] = null;
    }

    // 2 Barreras Universales inmortales del jugador en c3 y f3
    this.board[5][2] = { id: 'wU1', color: 'w', type: 'U' };
    this.board[5][5] = { id: 'wU2', color: 'w', type: 'U' };

    this.hasGalaxyMan = this.levelId === 5;
    this.galaxyMan = this.hasGalaxyMan ? { r: 2, c: 3, destroyed: false } : null;

    const cdMap = { 1: 6, 2: 5, 3: 4, 4: 4, 5: 4 };
    this.teleportMaxCooldown = cdMap[this.levelId] || 4;
    this.teleportCooldown = this.levelId <= 2 || this.levelId === 5 ? 3 : 2; // Telegrafiado limpio tras el inicio

    this.enPassantTarget = null;
    this.turn = 'w';
    this.turnNumber = 1;
    this.winner = null;
    this.winReason = '';
    this.mittensClimaxTriggered = false;
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };
    this.logs = [{
      turn: 0,
      type: 'special',
      text: this.hasGalaxyMan
        ? 'Nivel 5 — Entidad Galáctica: El Hombre Galaxia 2×2 se mueve como Torre y es invulnerable. ¡Elimina TODOS los Alfiles y Caballos galácticos para quebrar su núcleo!'
        : `Nivel ${this.levelId} Galáctico: Teletransporte enemigo cada ${this.teleportMaxCooldown} turnos. Usa tus 2 Barreras Universales inmortales para controlar el campo.`
    }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      levelId: this.levelId,
      hasGalaxyMan: this.hasGalaxyMan,
      galaxyMan: this.galaxyMan,
      teleportMaxCooldown: this.teleportMaxCooldown,
      teleportCooldown: this.teleportCooldown,
      board: this.board,
      enPassantTarget: this.enPassantTarget,
      turn: this.turn,
      turnNumber: this.turnNumber,
      winner: this.winner,
      winReason: this.winReason,
      mittensClimaxTriggered: this.mittensClimaxTriggered,
      lastMoveSquares: this.lastMoveSquares,
      capturedByWhite: this.capturedByWhite,
      capturedByBlack: this.capturedByBlack,
      clocks: this.clocks,
      timePresetMinutes: this.timePresetMinutes,
      logs: this.logs
    }));
  }

  loadState(s) {
    this.levelId = s.levelId || 5;
    this.hasGalaxyMan = Boolean(s.hasGalaxyMan);
    this.galaxyMan = s.galaxyMan || null;
    this.teleportMaxCooldown = s.teleportMaxCooldown || 3;
    this.teleportCooldown = s.teleportCooldown ?? 0;
    this.board = s.board;
    this.enPassantTarget = s.enPassantTarget || null;
    this.turn = s.turn;
    this.turnNumber = s.turnNumber;
    this.winner = s.winner || null;
    this.winReason = s.winReason || '';
    this.mittensClimaxTriggered = Boolean(s.mittensClimaxTriggered);
    this.lastMoveSquares = s.lastMoveSquares || [];
    this.capturedByWhite = s.capturedByWhite || [];
    this.capturedByBlack = s.capturedByBlack || [];
    this.clocks = s.clocks || { w: null, b: null };
    this.timePresetMinutes = s.timePresetMinutes ?? 10;
    this.logs = s.logs || [];
  }

  pushHistory() {
    this.history.push(this.cloneState());
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;
    this.loadState(this.history.pop());
    return true;
  }

  getGalaxyManCells(r = this.galaxyMan?.r, c = this.galaxyMan?.c) {
    if (!this.hasGalaxyMan || !this.galaxyMan || this.galaxyMan.destroyed) return [];
    return [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
  }

  isSquareInGalaxyMan(r, c) {
    if (!this.hasGalaxyMan || !this.galaxyMan || this.galaxyMan.destroyed) return false;
    return r >= this.galaxyMan.r && r <= this.galaxyMan.r + 1 && c >= this.galaxyMan.c && c <= this.galaxyMan.c + 1;
  }

  /**
   * Barrera Universal ('U'): protege piezas blancas adyacentes contra el Hombre Galaxia 2×2
   * y poderes especiales, pero NO contra capturas normales de piezas enemigas.
   */
  isProtectedByBarrier(r, c) {
    const p = this.board[r]?.[c];
    if (!p || p.color !== 'w' || p.type === 'U') return false;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type === 'U') {
        return true;
      }
    }
    return false;
  }

  getProtectedWhiteSquares() {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.isProtectedByBarrier(r, c)) set.add(`${r},${c}`);
      }
    }
    return set;
  }

  /**
   * Anclas cósmicas (Alfiles y Caballos enemigos) que sostienen al Hombre Galaxia 2×2.
   */
  getGalaxyAnchorsStatus() {
    const anchors = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'b' && (p.type === 'B' || p.type === 'N')) {
          anchors.push({ id: p.id, type: p.type, label: `${PIECE_NAMES[p.type]} ${toAlg(r, c)}`, r, c });
        }
      }
    }
    return anchors;
  }

  countAliveAnchors() {
    return this.getGalaxyAnchorsStatus().length;
  }

  countPieces(color) {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (this.board[r][c]?.color === color) n++;
    return n;
  }

  findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color && p.type === 'K') return { r, c };
      }
    }
    return null;
  }

  canGalaxyManOccupy(nr, nc) {
    if (nr < 0 || nr > 6 || nc < 0 || nc > 6) return false;
    for (const [r, c] of [[nr, nc], [nr, nc + 1], [nr + 1, nc], [nr + 1, nc + 1]]) {
      const p = this.board[r][c];
      if (!p) continue;
      // Bloqueado por piezas aliadas negras, Rey blanco, Barrera Universal o blancas protegidas por Barrera
      if (p.color === 'b') return false;
      if (p.color === 'w' && (p.type === 'U' || p.type === 'K' || this.isProtectedByBarrier(r, c))) return false;
    }
    return true;
  }

  isGalaxyManMoveSafeForBlackKing(move) {
    const savedBoard = this.board.map((row) => row.slice());
    const savedGM = this.galaxyMan ? { ...this.galaxyMan } : null;
    for (const [r, c] of [[move.nr, move.nc], [move.nr, move.nc + 1], [move.nr + 1, move.nc], [move.nr + 1, move.nc + 1]]) {
      const p = this.board[r][c];
      if (p && p.color === 'w' && p.type !== 'U' && p.type !== 'K' && !this.isProtectedByBarrier(r, c)) {
        this.board[r][c] = null;
      }
    }
    this.galaxyMan = { r: move.nr, c: move.nc, destroyed: false };
    const safe = !this.isKingInCheck('b');
    this.board = savedBoard;
    this.galaxyMan = savedGM;
    return safe;
  }

  /**
   * El Hombre Galaxia 2×2 se mueve COMO UNA TORRE (ortogonal: norte, sur, este, oeste)
   * avanzando en bloque 2×2 mientras las casillas estén libres o con piezas blancas sin escudo.
   */
  getGalaxyManLegalMoves() {
    if (!this.hasGalaxyMan || !this.galaxyMan || this.galaxyMan.destroyed) return [];
    const moves = [];
    const { r: startR, c: startC } = this.galaxyMan;

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      for (let step = 1; step <= 6; step++) {
        const nr = startR + dr * step;
        const nc = startC + dc * step;
        if (!this.canGalaxyManOccupy(nr, nc)) break;
        const m = { isGalaxyMan: true, nr, nc, dr, dc, steps: step };
        if (this.isGalaxyManMoveSafeForBlackKing(m)) moves.push(m);
        // Si aplasta al menos una pieza blanca en este destino, se detiene ahí como una torre al capturar
        let hitWhite = false;
        for (const [cr, cc] of [[nr, nc], [nr, nc + 1], [nr + 1, nc], [nr + 1, nc + 1]]) {
          if (this.board[cr][cc]?.color === 'w') hitWhite = true;
        }
        if (hitWhite) break;
      }
    }
    return moves;
  }

  getGalaxyManThreatSquares() {
    const set = new Set();
    for (const m of this.getGalaxyManLegalMoves()) {
      for (const [r, c] of [[m.nr, m.nc], [m.nr, m.nc + 1], [m.nr + 1, m.nc], [m.nr + 1, m.nc + 1]]) {
        if (!this.isSquareInGalaxyMan(r, c)) set.add(`${r},${c}`);
      }
    }
    return set;
  }

  isAdjacentToBarrier(r, c) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type === 'U') {
        return true;
      }
    }
    return false;
  }

  /**
   * Teletransporte Galáctico (juego limpio): mueve 1 pieza negra no-Rey a una casilla vacía legal
   * sin caer sobre Barrera Universal, junto a una Barrera Universal, ni sobre el Hombre Galaxia 2×2.
   */
  getTeleportMoves() {
    if (this.teleportCooldown > 0) return [];
    const moves = [];
    const candidates = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'b' && p.type !== 'K' && p.type !== 'P') candidates.push({ r, c, p });
      }
    }
    // Generar destinos tácticos limpios (casillas vacías centrales o de ataque sin violar Barreras ni Rey)
    for (const src of candidates) {
      for (let tr = 2; tr <= 5; tr++) {
        for (let tc = 1; tc <= 6; tc++) {
          if (this.board[tr][tc] || this.isSquareInGalaxyMan(tr, tc) || this.isAdjacentToBarrier(tr, tc)) continue;
          if (Math.abs(tr - src.r) + Math.abs(tc - src.c) < 2) continue;
          const m = { fr: src.r, fc: src.c, tr, tc, isTeleport: true };
          if (this.isMoveSafeForKing('b', m)) moves.push(m);
        }
      }
    }
    return moves;
  }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];
    const blockedByGiant = (tr, tc) => this.isSquareInGalaxyMan(tr, tc);

    if (p.type === 'U') {
      // Barrera Universal: 1 casilla ortogonal vacía, inmortal, nunca captura
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !this.board[nr][nc] && !blockedByGiant(nr, nc)) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      return moves;
    }

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.board[nr][c] && !blockedByGiant(nr, c)) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c] && !blockedByGiant(nr2, c)) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc) && !blockedByGiant(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color && target.type !== 'U') {
            moves.push({ fr: r, fc: c, tr: nr, tc });
          } else if (this.enPassantTarget && this.enPassantTarget.r === nr && this.enPassantTarget.c === tc) {
            const epPawn = this.board[r][tc];
            if (epPawn && epPawn.color !== p.color && epPawn.type === 'P') {
              moves.push({ fr: r, fc: c, tr: nr, tc, isEnPassant: true });
            }
          }
        }
      }
    } else if (p.type === 'N') {
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc) || blockedByGiant(nr, nc)) continue;
        // Ninguna pieza enemiga puede pasar sobre ni aterrizar en una Barrera Universal
        const target = this.board[nr][nc];
        if (target?.type === 'U') continue;
        if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || blockedByGiant(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (target?.type === 'U') continue;
          if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      if (includeCastling && !p.hasMoved && c === 4 && (r === 7 || r === 0)) {
        const oppAttacks = this.getSquaresAttackedBy(p.color === 'w' ? 'b' : 'w');
        if (!oppAttacks.has(`${r},4`)) {
          const rK = this.board[r][7];
          if (rK && rK.color === p.color && rK.type === 'R' && !rK.hasMoved
              && !this.board[r][5] && !this.board[r][6]
              && !blockedByGiant(r, 5) && !blockedByGiant(r, 6)
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
              && !blockedByGiant(r, 1) && !blockedByGiant(r, 2) && !blockedByGiant(r, 3)
              && !oppAttacks.has(`${r},3`) && !oppAttacks.has(`${r},2`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 2, isCastle: 'Q' });
          }
        }
      }
    } else {
      const dirs = p.type === 'R' ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : p.type === 'B' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          if (blockedByGiant(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.type !== 'U' && target.color !== p.color) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            }
            break; // Barrera Universal bloquea totalmente el paso
          }
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  getSquaresAttackedBy(color) {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color || p.type === 'U') continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (inBounds(nr, c + dc) && !this.isSquareInGalaxyMan(nr, c + dc)) set.add(`${nr},${c + dc}`);
          }
        } else {
          for (const m of this.getPseudoMoves(r, c, false)) set.add(`${m.tr},${m.tc}`);
        }
      }
    }
    return set;
  }

  isKingInCheck(color) {
    const k = this.findKing(color);
    if (!k) return true;
    return this.getSquaresAttackedBy(color === 'w' ? 'b' : 'w').has(`${k.r},${k.c}`);
  }

  isMoveSafeForKing(color, move) {
    if (move.isGalaxyMan) return !this.isKingInCheck(color);
    const savedBoard = this.board.map((row) => row.slice());
    const savedEP = this.enPassantTarget;
    const piece = this.board[move.fr][move.fc];
    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;
    if (move.isEnPassant) this.board[move.fr][move.tc] = null;
    if (move.isCastle === 'K') {
      this.board[move.fr][5] = this.board[move.fr][7];
      this.board[move.fr][7] = null;
    } else if (move.isCastle === 'Q') {
      this.board[move.fr][3] = this.board[move.fr][0];
      this.board[move.fr][0] = null;
    }
    const safe = !this.isKingInCheck(color);
    this.board = savedBoard;
    this.enPassantTarget = savedEP;
    return safe;
  }

  getLegalMovesForPiece(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    return this.getPseudoMoves(r, c, true).filter((m) => {
      const tgt = m.isEnPassant ? this.board[m.fr][m.tc] : this.board[m.tr][m.tc];
      if (tgt && tgt.type === 'K') return false;
      return this.isMoveSafeForKing(p.color, m);
    });
  }

  getAllLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === color) moves.push(...this.getLegalMovesForPiece(r, c));
      }
    }
    if (color === 'b') {
      moves.push(...this.getGalaxyManLegalMoves());
      moves.push(...this.getTeleportMoves());
    }
    return moves;
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const actingColor = this.turn;
    const events = {
      color: actingColor,
      captured: null,
      isGalaxyMan: false,
      isTeleport: false,
      crushed: [],
      anchorDestroyed: false,
      mittensClimax: false,
      to: move.isGalaxyMan ? [move.nr, move.nc] : [move.tr, move.tc]
    };

    if (move.isGalaxyMan && this.hasGalaxyMan && this.galaxyMan) {
      const startCells = this.getGalaxyManCells();
      const targetCells = [[move.nr, move.nc], [move.nr, move.nc + 1], [move.nr + 1, move.nc], [move.nr + 1, move.nc + 1]];
      for (const [r, c] of targetCells) {
        const p = this.board[r][c];
        if (p && p.color === 'w' && p.type !== 'U' && !this.isProtectedByBarrier(r, c)) {
          this.capturedByBlack.push({ color: 'w', type: p.type });
          events.crushed.push({ piece: p, r, c });
          this.board[r][c] = null;
        }
      }
      this.galaxyMan.r = move.nr;
      this.galaxyMan.c = move.nc;
      this.enPassantTarget = null;
      this.lastMoveSquares = [...startCells, ...targetCells];
      events.isGalaxyMan = true;

      let text = `El Hombre Galaxia 2×2 avanza en torre hacia ${dirText(move.dr, move.dc)} (${toAlg(move.nr, move.nc)}-${toAlg(move.nr + 1, move.nc + 1)}).`;
      if (events.crushed.length > 0) text += ` ¡Impacto cósmico: ${events.crushed.map((c) => PIECE_NAMES[c.piece.type]).join(', ')}!`;
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: 'special', text });
    } else if (move.isTeleport) {
      const piece = this.board[move.fr][move.fc];
      this.board[move.tr][move.tc] = piece;
      this.board[move.fr][move.fc] = null;
      piece.hasMoved = true;
      this.teleportCooldown = this.teleportMaxCooldown;
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      events.isTeleport = true;
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: `Teletransporte Galáctico: ${PIECE_NAMES[piece.type]} se pliega de ${toAlg(move.fr, move.fc)} a ${toAlg(move.tr, move.tc)} ✦`
        });
      }
    } else {
      const piece = this.board[move.fr][move.fc];
      const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];
      this.board[move.tr][move.tc] = piece;
      this.board[move.fr][move.fc] = null;
      piece.hasMoved = true;

      if (move.isEnPassant) this.board[move.fr][move.tc] = null;
      if (move.isCastle === 'K') {
        this.board[move.fr][5] = this.board[move.fr][7];
        this.board[move.fr][7] = null;
        if (this.board[move.fr][5]) this.board[move.fr][5].hasMoved = true;
      } else if (move.isCastle === 'Q') {
        this.board[move.fr][3] = this.board[move.fr][0];
        this.board[move.fr][0] = null;
        if (this.board[move.fr][3]) this.board[move.fr][3].hasMoved = true;
      }

      this.enPassantTarget = move.doublePawn ? { r: (move.fr + move.tr) / 2, c: move.fc } : null;
      if (piece.type === 'P' && ((actingColor === 'w' && move.tr === 0) || (actingColor === 'b' && move.tr === 7))) {
        piece.type = actingColor === 'w' ? promoType : 'Q';
      }

      if (target) {
        events.captured = target;
        if (actingColor === 'w') {
          this.capturedByWhite.push({ color: target.color, type: target.type });
          if (this.hasGalaxyMan && (target.type === 'B' || target.type === 'N')) {
            events.anchorDestroyed = true;
          }
        } else {
          this.capturedByBlack.push({ color: target.color, type: target.type });
        }
      }

      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      const side = actingColor === 'w' ? 'Blancas' : 'Entidad Galáctica';
      const text = `${side}: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}`;
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: events.anchorDestroyed ? 'special' : (actingColor === 'w' ? 'white' : 'black'), text });
    }

    // Descontar enfriamiento de Teletransporte tras turno negro normal/gigante
    if (actingColor === 'b' && !move.isTeleport && this.teleportCooldown > 0) {
      this.teleportCooldown--;
    }

    // Mecánica exclusiva Nv.2 (Centinela Púlsar) y Nv.4 (Guardián Quásar): Pulso Gravitatorio cada 4 turnos
    if (actingColor === 'b' && recordHistory && (this.levelId === 2 || this.levelId === 4) && this.turnNumber % 4 === 0) {
      for (let r = 2; r <= 6; r++) {
        let pulsed = false;
        for (let c = 0; c < 8; c++) {
          const wp = this.board[r][c];
          if (wp && wp.color === 'w' && wp.type !== 'K' && wp.type !== 'U' && !this.isProtectedByBarrier(r, c)) {
            const nr = r + 1;
            if (inBounds(nr, c) && !this.board[nr][c]) {
              this.board[nr][c] = wp;
              this.board[r][c] = null;
              if (!this.isKingInCheck('b')) {
                this.logs.unshift({
                  turn: this.turnNumber,
                  type: 'special',
                  text: `💫 PULSO GRAVITATORIO: ${PIECE_NAMES[wp.type]} desplazado de ${toAlg(r, c)} a ${toAlg(nr, c)}.`
                });
                pulsed = true;
                break;
              }
              this.board[r][c] = wp;
              this.board[nr][c] = null;
            }
          }
        }
        if (pulsed) break;
      }
    }

    // Condición especial Nivel 5: Al eliminar TODOS los Alfiles y Caballos enemigos -> Intervención de Free Mittens!
    if (this.hasGalaxyMan && this.galaxyMan && !this.galaxyMan.destroyed && this.countAliveAnchors() === 0) {
      this.galaxyMan.destroyed = true;
      this.mittensClimaxTriggered = true;
      events.mittensClimax = true;
      this.winner = 'w';
      this.winReason = '¡Todos los Alfiles y Caballos cayeron! En un descuido de la Entidad Galáctica, Free Mittens ejecuta una jugada imposible que fractura su núcleo cósmico.';
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: '⚡ CLÍMAX: ¡Free Mittens irrumpe en el descuido de la Entidad Galáctica y quiebra su núcleo!'
        });
      }
      return events;
    }

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;
    if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = actingColor === 'w'
          ? '¡Jaque mate cósmico! Superaste la prueba galáctica.'
          : '¡Jaque mate! La Entidad Galáctica prevalece.';
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado: no hay jaque ni movimientos legales.';
      }
    }

    return events;
  }
}
