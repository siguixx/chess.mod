import { PIECE_NAMES, toAlg, inBounds } from '../config/constants.js';

/**
 * Motor del BOSS SECRETO OCULTO POR URL — BLACKY (El Schnauzer · Dificultad: IMPOSIBLE)
 *
 * Acceso EXCLUSIVO por URL: /blacky, /?boss=blacky, /?secret=blacky o #blacky.
 * Respeta estrictamente la regla de JAQUE MATE REAL (nunca mata/absorbe/corrompe al Rey).
 *
 * 4 Poderes Caóticos:
 * 1. Sello de Zarpa Sombría (Deshabilitar Casilleros): cada 2 turnos deshabilita 2–4 casillas clave.
 *    Ninguna pieza blanca puede moverse hacia ellas ni atravesarlas mientras duren.
 * 2. Invocación del Vacío (Sacar piezas de la nada): cada 3 turnos (o al perder material) invoca
 *    una pieza negra adicional en una casilla vacía estratégica (incluye Dama tras el turno 12).
 * 3. Devoración Sombría (Absorber tus piezas): cada 4 turnos absorbe 1 pieza blanca no-Rey
 *    (priorizando Dama > Torre > Alfil/Caballo > Peón) y reduce en 1 turno los demás enfriamientos.
 * 4. Traición / Control Mental (Poner tus piezas en tu contra): cada 4–5 turnos convierte
 *    1 pieza blanca no-Rey en una pieza negra en su misma casilla.
 */
const PIECE_PRIORITY = { Q: 9, R: 5, B: 3.3, N: 3.2, P: 1 };

export class BlackySecretEngine {
  constructor(minutes = 10) {
    this.mode = 'blacky';
    this.timePresetMinutes = minutes;
    this.reset(minutes);
  }

  reset(minutes = this.timePresetMinutes) {
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `bkB_${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `bkP_${c}`, color: 'b', type: 'P', hasMoved: false };
      this.board[7][c] = { id: `wB_${c}`, color: 'w', type: back[c], hasMoved: false };
      this.board[6][c] = { id: `wP_${c}`, color: 'w', type: 'P', hasMoved: false };
    }

    this.sealedSquares = []; // [{ r, c, turnsLeft }]
    this.cooldowns = {
      seal: 2,
      summon: 3,
      absorb: 4,
      betray: 5
    };
    this.stats = {
      sealedTotal: 0,
      summonedTotal: 0,
      absorbedTotal: 0,
      betrayedTotal: 0,
      lastPowerLabel: 'Acechando en las sombras...'
    };
    this.blackMaterialBaseline = 16;
    this.uidCounter = 1;

    this.enPassantTarget = null;
    this.turn = 'w';
    this.turnNumber = 1;
    this.winner = null;
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };
    this.logs = [{
      turn: 0,
      type: 'special',
      text: '🐾 SECRET BOSS — BLACKY (IMPOSIBLE): Sello de casilleros, Invocación del Vacío, Devoración Sombría y Traición activos. Solo el JAQUE MATE real decide el destino.'
    }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      board: this.board,
      sealedSquares: this.sealedSquares,
      cooldowns: this.cooldowns,
      stats: this.stats,
      blackMaterialBaseline: this.blackMaterialBaseline,
      uidCounter: this.uidCounter,
      enPassantTarget: this.enPassantTarget,
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
    this.board = s.board;
    this.sealedSquares = s.sealedSquares || [];
    this.cooldowns = s.cooldowns || { seal: 2, summon: 3, absorb: 4, betray: 5 };
    this.stats = s.stats || { sealedTotal: 0, summonedTotal: 0, absorbedTotal: 0, betrayedTotal: 0, lastPowerLabel: '' };
    this.blackMaterialBaseline = s.blackMaterialBaseline ?? 16;
    this.uidCounter = s.uidCounter || 1;
    this.enPassantTarget = s.enPassantTarget || null;
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
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;
    this.loadState(this.history.pop());
    return true;
  }

  isSealed(r, c) {
    return this.sealedSquares.some((s) => s.r === r && s.c === c);
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

  /* === PODER 1: DESHABILITAR CASILLEROS (SELLO DE ZARPA SOMBRÍA) === */
  sealBoardSquares(count = 3) {
    const wKing = this.findKing('w');
    const candidates = [];
    for (let r = 1; r <= 7; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] || this.isSealed(r, c)) continue;
        // Priorizar casillas cercanas al centro o rutas de escape del Rey blanco
        let score = 10 - (Math.abs(3.5 - r) + Math.abs(3.5 - c));
        if (wKing) {
          const distK = Math.max(Math.abs(wKing.r - r), Math.abs(wKing.c - c));
          if (distK === 1) score += 9;
          else if (distK === 2) score += 4;
        }
        score += Math.random() * 2.4;
        candidates.push({ r, c, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates.slice(0, Math.min(count, candidates.length));
    const created = [];
    for (const sq of chosen) {
      this.sealedSquares.push({ r: sq.r, c: sq.c, turnsLeft: 5 });
      created.push({ r: sq.r, c: sq.c });
      this.stats.sealedTotal++;
    }
    // Mantener máximo 8 sellos simultáneos para que el tablero siga siendo jugable y táctico
    while (this.sealedSquares.length > 8) this.sealedSquares.shift();
    if (created.length > 0) {
      this.stats.lastPowerLabel = `Sello de Zarpa (${created.map((x) => toAlg(x.r, x.c)).join(', ')})`;
    }
    return created;
  }

  /* === PODER 2: SACAR FICHAS Y PIEZAS DE LA NADA (INVOCACIÓN DEL VACÍO) === */
  summonPieceFromVoid() {
    const candidates = [];
    for (let r = 1; r <= 5; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] || this.isSealed(r, c)) continue;
        const centerBonus = 6 - (Math.abs(3.5 - c) + Math.abs(2.5 - r));
        candidates.push({ r, c, score: centerBonus + Math.random() * 3 });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);

    // Dama posible si el jugador resiste más de 12 turnos
    let pool = ['P', 'P', 'N', 'B', 'R'];
    if (this.turnNumber > 12) pool = ['N', 'B', 'R', 'Q'];
    else if (this.turnNumber > 7) pool = ['P', 'N', 'B', 'R'];
    const chosenType = pool[Math.floor(Math.random() * pool.length)];

    // Elegir casilla que no deje al Rey negro en jaque (ni cause error)
    for (const sq of candidates) {
      const summoned = {
        id: `bkVoid_${this.uidCounter++}`,
        color: 'b',
        type: chosenType,
        hasMoved: true,
        summoned: true
      };
      this.board[sq.r][sq.c] = summoned;
      if (!this.isKingInCheck('b')) {
        this.stats.summonedTotal++;
        this.stats.lastPowerLabel = `Invocación: ${PIECE_NAMES[chosenType]} en ${toAlg(sq.r, sq.c)}`;
        return { r: sq.r, c: sq.c, piece: summoned };
      }
      this.board[sq.r][sq.c] = null;
    }
    return null;
  }

  /* === PODER 3: ABSORBER TUS PIEZAS (DEVORACIÓN SOMBRÍA — NUNCA AL REY) === */
  absorbWhitePiece() {
    const victims = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'w' && p.type !== 'K') {
          victims.push({ r, c, piece: p, priority: (PIECE_PRIORITY[p.type] || 1) + Math.random() * 0.4 });
        }
      }
    }
    if (victims.length === 0) return null;
    victims.sort((a, b) => b.priority - a.priority);
    const chosen = victims[0];
    this.board[chosen.r][chosen.c] = null;
    this.capturedByBlack.push({ color: 'w', type: chosen.piece.type });
    this.stats.absorbedTotal++;
    this.stats.lastPowerLabel = `Devoración: ${PIECE_NAMES[chosen.piece.type]} (${toAlg(chosen.r, chosen.c)})`;

    // Reduce en 1 turno los otros enfriamientos de Blacky
    this.cooldowns.seal = Math.max(1, this.cooldowns.seal - 1);
    this.cooldowns.summon = Math.max(1, this.cooldowns.summon - 1);
    this.cooldowns.betray = Math.max(1, this.cooldowns.betray - 1);
    return chosen;
  }

  /* === PODER 4: PONER TUS PIEZAS EN TU CONTRA (TRAICIÓN / CONTROL MENTAL — NUNCA AL REY) === */
  corruptWhitePiece() {
    const targets = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'w' && p.type !== 'K') {
          targets.push({ r, c, piece: p, priority: (PIECE_PRIORITY[p.type] || 1) + Math.random() * 1.1 });
        }
      }
    }
    if (targets.length === 0) return null;
    targets.sort((a, b) => b.priority - a.priority);

    for (const t of targets) {
      t.piece.color = 'b';
      t.piece.betrayed = true;
      if (!this.isKingInCheck('b')) {
        this.stats.betrayedTotal++;
        this.stats.lastPowerLabel = `Traición: ${PIECE_NAMES[t.piece.type]} en ${toAlg(t.r, t.c)}`;
        return { r: t.r, c: t.c, piece: t.piece };
      }
      t.piece.color = 'w';
      t.piece.betrayed = false;
    }
    return null;
  }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];
    // Ninguna pieza blanca puede entrar ni atravesar casillas deshabilitadas por Blacky
    const blockedForPiece = (tr, tc) => p.color === 'w' && this.isSealed(tr, tc);

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.board[nr][c] && !blockedForPiece(nr, c)) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c] && !blockedForPiece(nr2, c)) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc) && !blockedForPiece(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color) {
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
        if (!inBounds(nr, nc) || blockedForPiece(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || blockedForPiece(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      if (includeCastling && !p.hasMoved && c === 4 && (r === 7 || r === 0)) {
        const oppAttacks = this.getSquaresAttackedBy(p.color === 'w' ? 'b' : 'w');
        if (!oppAttacks.has(`${r},4`)) {
          const rK = this.board[r][7];
          if (rK && rK.color === p.color && rK.type === 'R' && !rK.hasMoved
              && !this.board[r][5] && !this.board[r][6]
              && !blockedForPiece(r, 5) && !blockedForPiece(r, 6)
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
              && !blockedForPiece(r, 1) && !blockedForPiece(r, 2) && !blockedForPiece(r, 3)
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
          if (blockedForPiece(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            break;
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
        if (!p || p.color !== color) continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (inBounds(nr, c + dc) && !(color === 'w' && this.isSealed(nr, c + dc))) set.add(`${nr},${c + dc}`);
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
      if (tgt && tgt.type === 'K') return false; // Regla estricta: jamás capturar al Rey
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
    return moves;
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const actingColor = this.turn;
    const piece = this.board[move.fr][move.fc];
    const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];
    const events = {
      color: actingColor,
      captured: target || null,
      to: [move.tr, move.tc],
      blackyPowers: []
    };

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
      if (actingColor === 'w') this.capturedByWhite.push({ color: target.color, type: target.type });
      else this.capturedByBlack.push({ color: target.color, type: target.type });
    }

    this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
    const side = actingColor === 'w' ? 'Blancas' : 'BLACKY';
    const text = `${side}: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}`;
    if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: actingColor === 'w' ? 'white' : 'black', text });

    // Desatar poderes caóticos de BLACKY tras su movimiento (respetando jaque mate y sin corromper al Rey)
    if (actingColor === 'b' && recordHistory) {
      this.sealedSquares = this.sealedSquares
        .map((s) => ({ ...s, turnsLeft: s.turnsLeft - 1 }))
        .filter((s) => s.turnsLeft > 0);

      this.cooldowns.seal = Math.max(0, this.cooldowns.seal - 1);
      this.cooldowns.summon = Math.max(0, this.cooldowns.summon - 1);
      this.cooldowns.absorb = Math.max(0, this.cooldowns.absorb - 1);
      this.cooldowns.betray = Math.max(0, this.cooldowns.betray - 1);

      const blackLostMaterial = this.countPieces('b') < this.blackMaterialBaseline;
      this.blackMaterialBaseline = this.countPieces('b');

      // Ejecutar hasta 1 poder principal por turno (y sellado cada 2 turnos) para mantener caos legible e intenso
      if (this.cooldowns.betray === 0) {
        const res = this.corruptWhitePiece();
        if (res) {
          this.cooldowns.betray = 4 + (Math.random() < 0.5 ? 1 : 0);
          events.blackyPowers.push({ type: 'betray', ...res });
          this.logs.unshift({
            turn: this.turnNumber,
            type: 'special',
            text: `🐾 TRAICIÓN DE BLACKY: Tu ${PIECE_NAMES[res.piece.type]} en ${toAlg(res.r, res.c)} ahora lucha contra ti.`
          });
        }
      } else if (this.cooldowns.absorb === 0) {
        const res = this.absorbWhitePiece();
        if (res) {
          this.cooldowns.absorb = 4;
          events.blackyPowers.push({ type: 'absorb', ...res });
          this.logs.unshift({
            turn: this.turnNumber,
            type: 'special',
            text: `🌑 DEVORACIÓN SOMBRÍA: Blacky absorbe tu ${PIECE_NAMES[res.piece.type]} en ${toAlg(res.r, res.c)}.`
          });
        }
      } else if (this.cooldowns.summon === 0 || blackLostMaterial) {
        const res = this.summonPieceFromVoid();
        if (res) {
          this.cooldowns.summon = 3;
          this.blackMaterialBaseline = this.countPieces('b');
          events.blackyPowers.push({ type: 'summon', ...res });
          this.logs.unshift({
            turn: this.turnNumber,
            type: 'special',
            text: `🌀 INVOCACIÓN DEL VACÍO: Blacky conjura un ${PIECE_NAMES[res.piece.type]} negro en ${toAlg(res.r, res.c)}.`
          });
        }
      }

      if (this.cooldowns.seal === 0) {
        const count = 2 + Math.floor(Math.random() * 3); // 2 a 4 casillas
        const sealed = this.sealBoardSquares(count);
        if (sealed.length > 0) {
          this.cooldowns.seal = 2;
          events.blackyPowers.push({ type: 'seal', squares: sealed });
          this.logs.unshift({
            turn: this.turnNumber,
            type: 'special',
            text: `🐾 SELLO DE ZARPA: Casillas deshabilitadas en ${sealed.map((s) => toAlg(s.r, s.c)).join(', ')}.`
          });
        }
      }
    }

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;
    if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = actingColor === 'w'
          ? '¡IMPOSIBLE LOGRADO! Jaque mate a BLACKY. Has desbloqueado el título secreto «Domador de Blacky (Imposible)».'
          : '¡JAQUE MATE! BLACKY devoró el tablero por completo.';
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado frente a BLACKY.';
      }
    }

    return events;
  }
}
