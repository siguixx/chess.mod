import { FILES, PIECE_NAMES, toAlg } from '../config/constants.js';

/**
 * Motor de Ajedrez Multi-Facción (3 o 4 Jugadores / Bots y Equipos 2 vs 2) en tablero Arena 10×10.
 *
 * Facciones:
 * - 'w' (Blanco · Sur — Jugador principal)
 * - 'c' (Cian · Oeste — Aliado en 2v2 / Rival independiente en 4P FFA)
 * - 'r' (Carmesí · Norte — Rival 1)
 * - 'y' (Ámbar · Este — Rival 2)
 */
export const FACTION_META = {
  w: { id: 'w', name: 'Tú (Blancas)', short: 'Blanco', color: '#fbf7ee', accent: '#efd083', team2v2: 'A', isHuman: true },
  c: { id: 'c', name: 'Aliado Cian', short: 'Cian', color: '#38bdf8', accent: '#7dd3fc', team2v2: 'A', isHuman: false },
  r: { id: 'r', name: 'Legión Carmesí', short: 'Carmesí', color: '#f43f5e', accent: '#fda4af', team2v2: 'B', isHuman: false },
  y: { id: 'y', name: 'Orden Ámbar', short: 'Ámbar', color: '#f59e0b', accent: '#fde68a', team2v2: 'B', isHuman: false }
};

export class MultiPartyChessEngine {
  constructor(variant = '2v2', minutes = 10) {
    this.mode = 'multiparty';
    this.variant = ['2v2', 'ffa4', 'ffa3'].includes(variant) ? variant : '2v2';
    this.boardSize = 10;
    this.timePresetMinutes = minutes;
    this.reset(this.variant, minutes);
  }

  inBounds(r, c) {
    return r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize;
  }

  alg(r, c) {
    return `${FILES[c] || '?'}${this.boardSize - r}`;
  }

  reset(variant = this.variant, minutes = this.timePresetMinutes) {
    this.variant = ['2v2', 'ffa4', 'ffa3'].includes(variant) ? variant : '2v2';
    this.timePresetMinutes = minutes;
    const N = this.boardSize;
    this.board = Array.from({ length: N }, () => Array(N).fill(null));

    this.factions = this.variant === 'ffa3' ? ['w', 'r', 'y'] : ['w', 'c', 'r', 'y'];
    this.eliminated = [];
    this.teams = this.variant === '2v2'
      ? { w: 'A', c: 'A', r: 'B', y: 'B' }
      : { w: 'w', c: 'c', r: 'r', y: 'y' };

    const back6 = ['R', 'N', 'Q', 'K', 'B', 'R'];

    // Sur: Blanco ('w') filas 9 y 8, cols 2..7
    for (let i = 0; i < 6; i++) {
      const c = 2 + i;
      this.board[9][c] = { id: `mp_w_${i}`, color: 'w', type: back6[i], hasMoved: false };
      this.board[8][c] = { id: `mp_wP_${i}`, color: 'w', type: 'P', hasMoved: false };
    }

    // Norte: Carmesí ('r') filas 0 y 1, cols 2..7
    for (let i = 0; i < 6; i++) {
      const c = 2 + i;
      this.board[0][c] = { id: `mp_r_${i}`, color: 'r', type: back6[i], hasMoved: false };
      this.board[1][c] = { id: `mp_rP_${i}`, color: 'r', type: 'P', hasMoved: false };
    }

    // Este: Ámbar ('y') cols 9 y 8, filas 2..7
    for (let i = 0; i < 6; i++) {
      const r = 2 + i;
      this.board[r][9] = { id: `mp_y_${i}`, color: 'y', type: back6[i], hasMoved: false };
      this.board[r][8] = { id: `mp_yP_${i}`, color: 'y', type: 'P', hasMoved: false };
    }

    // Oeste: Cian ('c') cols 0 y 1, filas 2..7 (en 2v2 y 4P FFA)
    if (this.factions.includes('c')) {
      for (let i = 0; i < 6; i++) {
        const r = 2 + i;
        this.board[r][0] = { id: `mp_c_${i}`, color: 'c', type: back6[i], hasMoved: false };
        this.board[r][1] = { id: `mp_cP_${i}`, color: 'c', type: 'P', hasMoved: false };
      }
    }

    this.turn = 'w';
    this.turnNumber = 1;
    this.winner = null;
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0
      ? { w: minutes * 60, b: minutes * 60, c: minutes * 60, r: minutes * 60, y: minutes * 60 }
      : { w: null, b: null, c: null, r: null, y: null };

    const introText = this.variant === '2v2'
      ? '🤝 EQUIPOS 2 vs 2 (10×10): Tú (Blanco) + Aliado Cian contra Equipo Carmesí + Ámbar. ¡No puedes dañar a tu compañero! Derriba ambos Reyes enemigos.'
      : (this.variant === 'ffa4'
        ? '👑 BATALLA REAL 4 FACCIONES (10×10): Blanco vs Cian vs Carmesí vs Ámbar. ¡Todos contra todos, el último Rey en pie gana!'
        : '⚔️ TRIADA 3 FACCIONES (10×10): Blanco vs Carmesí vs Ámbar. ¡Sobrevive y derrota a las otras dos facciones!');
    this.logs = [{ turn: 0, type: 'special', text: introText }];
    this.history = [];
  }

  areAllies(colA, colB) {
    if (!colA || !colB) return false;
    return this.teams[colA] === this.teams[colB];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      variant: this.variant,
      boardSize: this.boardSize,
      factions: this.factions,
      eliminated: this.eliminated,
      teams: this.teams,
      board: this.board,
      turn: this.turn,
      turnNumber: this.turnNumber,
      winner: this.winner,
      winReason: this.winReason,
      lastMoveSquares: this.lastMoveSquares,
      capturedByWhite: this.capturedByWhite,
      capturedByBlack: this.capturedByBlack,
      clocks: this.clocks,
      timePresetMinutes: this.timePresetMinutes,
      logs: this.logs
    }));
  }

  loadState(s) {
    this.variant = s.variant || '2v2';
    this.boardSize = s.boardSize || 10;
    this.factions = s.factions || ['w', 'c', 'r', 'y'];
    this.eliminated = s.eliminated || [];
    this.teams = s.teams || { w: 'A', c: 'A', r: 'B', y: 'B' };
    this.board = s.board;
    this.turn = s.turn;
    this.turnNumber = s.turnNumber;
    this.winner = s.winner || null;
    this.winReason = s.winReason || '';
    this.lastMoveSquares = s.lastMoveSquares || [];
    this.capturedByWhite = s.capturedByWhite || [];
    this.capturedByBlack = s.capturedByBlack || [];
    this.clocks = s.clocks || { w: null, b: null };
    this.timePresetMinutes = s.timePresetMinutes ?? 10;
    this.logs = s.logs || [];
  }

  pushHistory() {
    this.history.push(this.cloneState());
    if (this.history.length > 40) this.history.shift();
  }

  undo() {
    if (!this.history.length) return false;
    // Retroceder hasta que vuelva a ser turno del jugador blanco ('w')
    while (this.history.length > 0) {
      const prev = this.history.pop();
      this.loadState(prev);
      if (this.turn === 'w') return true;
    }
    return true;
  }

  findKing(color) {
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        const p = this.board[r][c];
        if (p && p.color === color && p.type === 'K') return { r, c };
      }
    }
    return null;
  }

  isKingInCheck(color) {
    const k = this.findKing(color);
    if (!k) return false;
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        const p = this.board[r][c];
        if (!p || this.areAllies(p.color, color)) continue;
        const pm = this.getPseudoMoves(r, c);
        if (pm.some((m) => m.tr === k.r && m.tc === k.c)) return true;
      }
    }
    return false;
  }

  getPawnVector(color) {
    if (color === 'w') return { dr: -1, dc: 0, startRow: 8, startCol: null, promoCheck: (r) => r === 0 };
    if (color === 'r') return { dr: 1, dc: 0, startRow: 1, startCol: null, promoCheck: (r) => r === 9 };
    if (color === 'c') return { dr: 0, dc: 1, startRow: null, startCol: 1, promoCheck: (_r, c) => c === 9 };
    return { dr: 0, dc: -1, startRow: null, startCol: 8, promoCheck: (_r, c) => c === 0 }; // 'y'
  }

  getPseudoMoves(r, c) {
    const p = this.board[r]?.[c];
    if (!p) return [];
    const moves = [];

    if (p.type === 'P') {
      const vec = this.getPawnVector(p.color);
      const nr1 = r + vec.dr;
      const nc1 = c + vec.dc;
      if (this.inBounds(nr1, nc1) && !this.board[nr1][nc1]) {
        moves.push({ fr: r, fc: c, tr: nr1, tc: nc1 });
        const onStart = (vec.startRow !== null && r === vec.startRow) || (vec.startCol !== null && c === vec.startCol);
        const nr2 = r + vec.dr * 2;
        const nc2 = c + vec.dc * 2;
        if (onStart && this.inBounds(nr2, nc2) && !this.board[nr2][nc2]) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: nc2 });
        }
      }
      // Capturas diagonales respecto a la dirección de avance
      const capDirs = vec.dr !== 0
        ? [[vec.dr, -1], [vec.dr, 1]]
        : [[-1, vec.dc], [1, vec.dc]];
      for (const [dr, dc] of capDirs) {
        const cr = r + dr, cc = c + dc;
        if (!this.inBounds(cr, cc)) continue;
        const tgt = this.board[cr][cc];
        if (tgt && !this.areAllies(p.color, tgt.color)) {
          moves.push({ fr: r, fc: c, tr: cr, tc: cc });
        }
      }
    } else if (p.type === 'N') {
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        const tgt = this.board[nr][nc];
        if (!tgt || !this.areAllies(p.color, tgt.color)) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (!this.inBounds(nr, nc)) continue;
          const tgt = this.board[nr][nc];
          if (!tgt || !this.areAllies(p.color, tgt.color)) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
    } else {
      const dirs = p.type === 'R' ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : p.type === 'B' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (this.inBounds(nr, nc)) {
          const tgt = this.board[nr][nc];
          if (!tgt) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (!this.areAllies(p.color, tgt.color)) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            break;
          }
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  getLegalMovesForPiece(r, c) {
    const p = this.board[r]?.[c];
    if (!p || this.eliminated.includes(p.color)) return [];
    // En modo multi-facción (3-4 jugadores), capturar el Rey enemigo elimina directamente a esa facción!
    return this.getPseudoMoves(r, c);
  }

  getAllLegalMoves(color) {
    if (this.eliminated.includes(color)) return [];
    const out = [];
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        if (this.board[r][c]?.color === color) out.push(...this.getLegalMovesForPiece(r, c));
      }
    }
    return out;
  }

  eliminateFaction(color) {
    if (!this.eliminated.includes(color)) this.eliminated.push(color);
    for (let r = 0; r < this.boardSize; r++) {
      for (let c = 0; c < this.boardSize; c++) {
        if (this.board[r][c]?.color === color) this.board[r][c] = null;
      }
    }
  }

  advanceTurn() {
    const active = this.factions.filter((f) => !this.eliminated.includes(f) && this.findKing(f));
    const idx = this.factions.indexOf(this.turn);
    for (let step = 1; step <= this.factions.length; step++) {
      const cand = this.factions[(idx + step) % this.factions.length];
      if (active.includes(cand)) {
        if (cand === 'w') this.turnNumber++;
        this.turn = cand;
        return;
      }
    }
  }

  checkOutcome() {
    const alive = this.factions.filter((f) => !this.eliminated.includes(f) && this.findKing(f));
    if (this.variant === '2v2') {
      const teamAAlive = alive.some((f) => this.teams[f] === 'A');
      const teamBAlive = alive.some((f) => this.teams[f] === 'B');
      if (!teamBAlive) {
        this.winner = 'w';
        this.winReason = '🏆 ¡VICTORIA DEL EQUIPO ALIADO (Blanco + Cian)! Cayeron ambos Reyes enemigos.';
      } else if (!teamAAlive) {
        this.winner = 'b';
        this.winReason = 'Derrota: El Equipo Rival (Carmesí + Ámbar) eliminó a ambos Reyes aliados.';
      }
    } else {
      if (!alive.includes('w')) {
        this.winner = 'b';
        this.winReason = 'Tu Rey ha caído en la arena multi-facción.';
      } else if (alive.length === 1 && alive[0] === 'w') {
        this.winner = 'w';
        this.winReason = `👑 ¡CAMPEÓN DE LA ARENA (${this.factions.length} Facciones)! Eres el último Rey en pie.`;
      }
    }
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const acting = this.turn;
    const piece = this.board[move.fr][move.fc];
    const target = this.board[move.tr][move.tc];
    if (!piece) return null;

    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;
    piece.hasMoved = true;

    const vec = this.getPawnVector(acting);
    if (piece.type === 'P' && vec.promoCheck(move.tr, move.tc)) {
      piece.type = acting === 'w' ? promoType : 'Q';
    }

    let eliminatedFaction = null;
    if (target) {
      if (this.areAllies(acting, 'w')) this.capturedByWhite.push({ color: target.color, type: target.type });
      else this.capturedByBlack.push({ color: target.color, type: target.type });

      if (target.type === 'K') {
        eliminatedFaction = target.color;
        this.eliminateFaction(target.color);
      }
    }

    this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
    const meta = FACTION_META[acting] || { short: acting };
    const elimNote = eliminatedFaction ? ` 💥 ¡${FACTION_META[eliminatedFaction]?.short || eliminatedFaction} ELIMINADO!` : '';
    const text = `${meta.short}: ${PIECE_NAMES[piece.type]} ${this.alg(move.fr, move.fc)} → ${this.alg(move.tr, move.tc)}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}${elimNote}`;
    if (recordHistory) {
      this.logs.unshift({
        turn: this.turnNumber,
        type: eliminatedFaction ? 'special' : (this.areAllies(acting, 'w') ? 'white' : 'black'),
        text
      });
    }

    this.checkOutcome();
    if (!this.winner) this.advanceTurn();
    return { color: acting, captured: target || null, eliminatedFaction, to: [move.tr, move.tc] };
  }

  validateAndExecuteMove(fr, fc, tr, tc, promoType = 'Q', recordHistory = true) {
    if (this.winner) return { ok: false, error: 'La partida ya finalizó.' };
    if (!this.inBounds(fr, fc) || !this.inBounds(tr, tc)) return { ok: false, error: 'Fuera del tablero.' };
    const p = this.board[fr][fc];
    if (!p || p.color !== this.turn) return { ok: false, error: 'No es una pieza de la facción en turno.' };
    const legal = this.getLegalMovesForPiece(fr, fc);
    const m = legal.find((x) => x.tr === tr && x.tc === tc);
    if (!m) return { ok: false, error: 'Movimiento ilegal.' };
    const events = this.executeMove(m, promoType, recordHistory);
    return { ok: true, move: m, events };
  }
}

const MP_VALS = { P: 100, N: 320, B: 330, R: 510, Q: 920, K: 50000 };

export function chooseMultiPartyAIMove(engine, color) {
  const moves = engine.getAllLegalMoves(color);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  const center = (engine.boardSize - 1) / 2;

  for (const m of moves) {
    let score = (Math.random() - 0.5) * 28;
    const mover = engine.board[m.fr][m.fc];
    const tgt = engine.board[m.tr][m.tc];
    if (tgt) {
      score += (MP_VALS[tgt.type] || 100) * 1.45 - (MP_VALS[mover?.type] || 100) * 0.18;
    }
    const distCenter = Math.abs(m.tr - center) + Math.abs(m.tc - center);
    score += (10 - distCenter) * 9;
    if (mover?.type === 'K') score -= 35;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
