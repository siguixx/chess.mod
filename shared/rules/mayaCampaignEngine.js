import { PIECE_NAMES, toAlg, inBounds } from '../config/constants.js';

/**
 * Motor para los Niveles 1 a 4 de la Campaña del Rey Maya.
 * REGLA ESTRICTA: La Pirámide 2×2 NO aparece en los niveles 1 a 4 (es exclusiva del Nivel 5).
 *
 * Unidades Mayas originales:
 * - 'A' (Arquera de Obsidiana): Ataca en diagonal hasta 4 casillas SIN moverse (disparo a distancia).
 * - 'G' (Escudero de Jade): Se mueve/captura 1 casilla ortogonal; su escudo (shieldIntact) absorbe
 *       el primer ataque FRONTAL (desde filas inferiores fr > tr) y exige flanquearlo o atacar dos veces.
 * - 'J' (Jaguar de Piedra): Salta exactamente 2 casillas en línea recta ortogonal pasando por encima
 *       de piezas intermedias para emboscar.
 * - 'C' (Chamán Solar): Se mueve 1 casilla (ortogonal/diagonal) SIN capturar; cada 3 turnos
 *       (pushCooldown === 0) puede empujar 1 casilla a una pieza rival adyacente.
 */
export class MayaCampaignEngine {
  constructor(levelId = 1, minutes = 10) {
    this.mode = 'maya_campaign';
    this.levelId = Math.max(1, Math.min(4, Number(levelId) || 1));
    this.timePresetMinutes = minutes;
    this.hasPyramid = false;
    this.reset(this.levelId, minutes);
  }

  reset(levelId = this.levelId, minutes = this.timePresetMinutes) {
    this.levelId = Math.max(1, Math.min(4, Number(levelId) || 1));
    this.timePresetMinutes = minutes;
    this.hasPyramid = false;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    // Ejército blanco estándar (16 piezas clásicas) + Casas Inmortales defensivas
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[7][c] = { id: `w${back[c]}${c}`, color: 'w', type: back[c], hasMoved: false };
      this.board[6][c] = { id: `wP${c}`, color: 'w', type: 'P', hasMoved: false };
    }
    if (this.levelId <= 2) {
      // Niveles 1-2: 1 Casa Blanca Inmortal en d3 para cubrir el avance
      this.board[5][3] = { id: 'wH1', color: 'w', type: 'H' };
    } else {
      // Niveles 3-4: 2 Casas Blancas Inmortales (c3 y f3)
      this.board[5][2] = { id: 'wH1', color: 'w', type: 'H' };
      this.board[5][5] = { id: 'wH2', color: 'w', type: 'H' };
    }

    // Formación Maya progresiva (Muy Fácil -> Medio), SIEMPRE sin Pirámide 2×2
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `b${back[c]}${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `bP${c}`, color: 'b', type: 'P', hasMoved: false };
    }

    if (this.levelId === 1) {
      // Nivel 1 — Centinelas de Obsidiana (Muy Fácil): sin Dama enemiga y solo 2 Arqueras (A)
      this.board[0][2] = { id: 'bA1', color: 'b', type: 'A' }; // c8
      this.board[0][5] = { id: 'bA2', color: 'b', type: 'A' }; // f8
      this.board[0][3] = null; // Sin Dama en el primer nivel
      this.board[1][1] = null;
      this.board[1][6] = null;
    } else if (this.levelId === 2) {
      // Nivel 2 — Guardia de Jade (Fácil): sin Dama enemiga y 2 Escuderos de Jade (G)
      this.board[0][3] = null;
      this.board[2][3] = { id: 'bG1', color: 'b', type: 'G', shieldIntact: true }; // d6
      this.board[2][4] = { id: 'bG2', color: 'b', type: 'G', shieldIntact: true }; // e6
      this.board[1][2] = null;
      this.board[1][5] = null;
    } else if (this.levelId === 3) {
      // Nivel 3 — Acechadores del Jaguar (Fácil-Medio): 3 Jaguares de Piedra (J)
      this.board[0][1] = { id: 'bJ1', color: 'b', type: 'J' };
      this.board[0][6] = { id: 'bJ2', color: 'b', type: 'J' };
      this.board[2][3] = { id: 'bJ3', color: 'b', type: 'J' };
      this.board[1][3] = null;
      this.board[1][4] = null;
    } else if (this.levelId === 4) {
      // Nivel 4 — Sacerdotes del Eclipse (Medio): 1 Chamán Solar (C) + 2 Arqueras (A) + 2 Escuderos (G)
      this.board[0][2] = { id: 'bA1', color: 'b', type: 'A' };
      this.board[0][5] = { id: 'bA2', color: 'b', type: 'A' };
      this.board[2][2] = { id: 'bG1', color: 'b', type: 'G', shieldIntact: true };
      this.board[2][5] = { id: 'bG2', color: 'b', type: 'G', shieldIntact: true };
      this.board[2][3] = { id: 'bC1', color: 'b', type: 'C', pushCooldown: 1 };
      this.board[1][2] = null;
      this.board[1][3] = null;
      this.board[1][5] = null;
    }

    this.enPassantTarget = null;
    this.turn = 'w';
    this.turnNumber = 1;
    this.winner = null;
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };

    const introTexts = {
      1: 'Nivel 1 — Centinelas de Obsidiana: Las Arqueras (A) disparan hasta 3 casillas en diagonal. Tu Casa Inmortal (d3) escuda a tus piezas adyacentes contra flechas.',
      2: 'Nivel 2 — Guardia de Jade: Los Escuderos de Jade (G) absorben el primer ataque frontal. Flanquéalos o golpea dos veces; tu Casa Inmortal asegura el centro.',
      3: 'Nivel 3 — Acechadores del Jaguar: Los Jaguares (J) saltan 2 casillas en línea recta, pero tus 2 Casas Inmortales (c3, f3) impiden que ataquen piezas escudadas.',
      4: 'Nivel 4 — Sacerdotes del Eclipse: El Chamán Solar (C) empuja cada 4 turnos junto a Arqueras y Escuderos. Tus 2 Casas Inmortales bloquean flechas y empujes.'
    };
    this.logs = [{ turn: 0, type: 'special', text: introTexts[this.levelId] }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      levelId: this.levelId,
      hasPyramid: false,
      board: this.board,
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
    this.levelId = s.levelId || 1;
    this.hasPyramid = false;
    this.board = s.board;
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

  isProtectedByCasa(r, c) {
    const p = this.board[r]?.[c];
    if (!p || p.color !== 'w' || p.type === 'H') return false;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type === 'H') {
        return true;
      }
    }
    return false;
  }

  getProtectedWhiteSquares() {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.isProtectedByCasa(r, c)) set.add(`${r},${c}`);
      }
    }
    return set;
  }

  /**
   * Comprueba si un ataque desde (fr, fc) hacia el Escudero de Jade en (tr, tc) es frontal.
   * Los Escuderos negros miran hacia el sur (hacia las filas blancas), por lo que un ataque
   * proveniente de una fila mayor (fr > tr) impacta su escudo frontal.
   */
  isFrontalAttackOnEscudero(fr, fc, tr, tc) {
    const target = this.board[tr]?.[tc];
    if (!target || target.type !== 'G' || !target.shieldIntact) return false;
    return target.color === 'b' ? fr > tr : fr < tr;
  }

  getArcherZoneSquares() {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.type !== 'A') continue;
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          for (let step = 1; step <= 3; step++) {
            const nr = r + dr * step;
            const nc = c + dc * step;
            if (!inBounds(nr, nc)) break;
            const occ = this.board[nr][nc];
            if (occ && occ.color === p.color) break;
            if (occ?.type === 'H') break;
            set.add(`${nr},${nc}`);
            if (occ) break;
          }
        }
      }
    }
    return set;
  }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];

    // 0. CASA BLANCA INMORTAL ('H'): 1 casilla ortogonal a casilla vacía, inmortal, escuda piezas adyacentes
    if (p.type === 'H') {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !this.board[nr][nc]) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      return moves;
    }

    // 1. ARQUERA DE OBSIDIANA ('A'): NO puede moverse; ataca a distancia en diagonal (hasta 3 casillas)
    //    No puede herir a una Casa Inmortal ni a piezas blancas escudadas por una Casa.
    if (p.type === 'A') {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        for (let step = 1; step <= 3; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (!inBounds(nr, nc)) break;
          const occ = this.board[nr][nc];
          if (!occ) continue;
          if (occ.color !== p.color && occ.type !== 'H' && !this.isProtectedByCasa(nr, nc)) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc, isRangedAttack: true });
          }
          break;
        }
      }
      return moves;
    }

    // 2. ESCUDERO DE JADE ('G'): Se mueve/captura exactamente 1 casilla ortogonal
    if (p.type === 'G') {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const occ = this.board[nr][nc];
        if (!occ || (occ.color !== p.color && occ.type !== 'H')) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      return moves;
    }

    // 3. JAGUAR DE PIEDRA ('J'): Salta exactamente 2 casillas en línea recta ortogonal (salta piezas intermedias)
    //    No puede aterrizar sobre una Casa ni sobre una pieza blanca protegida por Casa.
    if (p.type === 'J') {
      for (const [dr, dc] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const occ = this.board[nr][nc];
        if (!occ || (occ.color !== p.color && occ.type !== 'H' && !this.isProtectedByCasa(nr, nc))) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc, isJaguarLeap: true });
        }
      }
      return moves;
    }

    // 4. CHAMÁN SOLAR ('C'): Se mueve 1 casilla SIN capturar; cada 4 turnos empuja 1 casilla a un rival adyacente no protegido por Casa
    if (p.type === 'C') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const occ = this.board[nr][nc];
          if (!occ) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else if (occ.color !== p.color && occ.type !== 'H' && !this.isProtectedByCasa(nr, nc) && (p.pushCooldown || 0) === 0) {
            const pr = nr + dr;
            const pc = nc + dc;
            if (inBounds(pr, pc) && !this.board[pr][pc]) {
              moves.push({
                fr: r, fc: c, tr: nr, tc: nc,
                isShamanPush: true,
                pushR: pr, pushC: pc, dr, dc
              });
            }
          }
        }
      }
      return moves;
    }

    // PIEZAS CLÁSICAS
    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.board[nr][c]) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c]) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color && target.type !== 'H') {
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
        if (!inBounds(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || (target.color !== p.color && target.type !== 'H')) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || (target.color !== p.color && target.type !== 'H')) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      if (includeCastling && !p.hasMoved && c === 4 && (r === 7 || r === 0)) {
        const oppAttacks = this.getSquaresAttackedBy(p.color === 'w' ? 'b' : 'w');
        if (!oppAttacks.has(`${r},4`)) {
          const rK = this.board[r][7];
          if (rK && rK.color === p.color && rK.type === 'R' && !rK.hasMoved
              && !this.board[r][5] && !this.board[r][6]
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
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
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.color !== p.color && target.type !== 'H') moves.push({ fr: r, fc: c, tr: nr, tc: nc });
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
        if (!p || p.color !== color || p.type === 'H' || p.type === 'C') continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (inBounds(nr, c + dc)) set.add(`${nr},${c + dc}`);
          }
        } else if (p.type === 'A') {
          for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
            for (let step = 1; step <= 3; step++) {
              const nr = r + dr * step, nc = c + dc * step;
              if (!inBounds(nr, nc)) break;
              const occ = this.board[nr][nc];
              if (occ?.type === 'H') break;
              if (!this.isProtectedByCasa(nr, nc)) set.add(`${nr},${nc}`);
              if (occ) break;
            }
          }
        } else {
          for (const m of this.getPseudoMoves(r, c, false)) {
            if (!m.isShamanPush) set.add(`${m.tr},${m.tc}`);
          }
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
    const savedBoard = this.board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    const savedEP = this.enPassantTarget;

    if (move.isRangedAttack) {
      this.board[move.tr][move.tc] = null;
    } else if (move.isShamanPush) {
      this.board[move.pushR][move.pushC] = this.board[move.tr][move.tc];
      this.board[move.tr][move.tc] = null;
    } else {
      const target = this.board[move.tr][move.tc];
      if (target && this.isFrontalAttackOnEscudero(move.fr, move.fc, move.tr, move.tc)) {
        // Escudo absorbe el primer ataque frontal: atacante queda en su origen
        this.board[move.tr][move.tc].shieldIntact = false;
      } else {
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
      }
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
    return moves;
  }

  tickShamanCooldowns(actingColor) {
    if (actingColor !== 'b') return;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'b' && p.type === 'C' && p.pushCooldown > 0) {
          p.pushCooldown--;
        }
      }
    }
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const actingColor = this.turn;
    const piece = this.board[move.fr][move.fc];
    let events = {
      color: actingColor,
      captured: null,
      shieldBlocked: false,
      isRangedAttack: false,
      isShamanPush: false,
      casaMoved: piece?.type === 'H',
      casaProtectedCount: 0,
      pushTo: null,
      to: [move.tr, move.tc]
    };

    // Descontar cooldown de Chamanes al inicio de cada turno negro (el Chamán que empuja en este turno se resetea a 3 después)
    this.tickShamanCooldowns(actingColor);

    if (move.isRangedAttack) {
      // Arquera de Obsidiana dispara en diagonal sin moverse
      const victim = this.board[move.tr][move.tc];
      this.board[move.tr][move.tc] = null;
      if (victim) {
        if (actingColor === 'w') this.capturedByWhite.push({ color: victim.color, type: victim.type });
        else this.capturedByBlack.push({ color: victim.color, type: victim.type });
      }
      events.isRangedAttack = true;
      events.captured = victim || null;
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: `Arquera de Obsidiana (${toAlg(move.fr, move.fc)}) abate a distancia a ${PIECE_NAMES[victim?.type || 'P']} en ${toAlg(move.tr, move.tc)} 🏹`
        });
      }
    } else if (move.isShamanPush) {
      // Chamán Solar empuja 1 casilla a una pieza rival adyacente y entra en enfriamiento de 4 turnos
      const victim = this.board[move.tr][move.tc];
      this.board[move.pushR][move.pushC] = victim;
      this.board[move.tr][move.tc] = null;
      piece.pushCooldown = 4;
      events.isShamanPush = true;
      events.pushTo = [move.pushR, move.pushC];
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc], [move.pushR, move.pushC]];
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: `Chamán Solar (${toAlg(move.fr, move.fc)}) empuja a ${PIECE_NAMES[victim?.type || 'P']} (${toAlg(move.tr, move.tc)} → ${toAlg(move.pushR, move.pushC)}) ☀️`
        });
      }
    } else {
      const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];

      // Regla del Escudero de Jade: el escudo absorbe el PRIMER ataque frontal
      if (target && !move.isEnPassant && this.isFrontalAttackOnEscudero(move.fr, move.fc, move.tr, move.tc)) {
        target.shieldIntact = false;
        events.shieldBlocked = true;
        this.enPassantTarget = null;
        this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
        if (recordHistory) {
          this.logs.unshift({
            turn: this.turnNumber,
            type: 'special',
            text: `¡Escudo de Jade roto! El Escudero en ${toAlg(move.tr, move.tc)} absorbe el ataque frontal de ${PIECE_NAMES[piece.type]} (${toAlg(move.fr, move.fc)}) 🛡️`
          });
        }
      } else {
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

        let promoNote = '';
        if (piece.type === 'P' && ((actingColor === 'w' && move.tr === 0) || (actingColor === 'b' && move.tr === 7))) {
          piece.type = promoType;
          promoNote = ` y corona en ${PIECE_NAMES[promoType]}`;
        }

        if (target) {
          events.captured = target;
          if (actingColor === 'w') this.capturedByWhite.push({ color: target.color, type: target.type });
          else this.capturedByBlack.push({ color: target.color, type: target.type });
        }

        if (events.casaMoved) {
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = move.tr + dr, nc = move.tc + dc;
            if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type !== 'H') {
              events.casaProtectedCount++;
            }
          }
        }

        this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
        const sideLabel = actingColor === 'w' ? 'Blancas' : 'Templo Maya';
        const leapNote = move.isJaguarLeap ? ' (Salto de Jaguar)' : '';
        const text = `${sideLabel}: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}${leapNote}${promoNote}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}`;
        if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: actingColor === 'w' ? 'white' : 'black', text });
      }
    }

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;
    if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = actingColor === 'w'
          ? '¡Jaque mate! Superaste esta prueba Maya.'
          : '¡Jaque mate! Los guardianes del santuario prevalecen.';
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado: no hay jaque ni movimientos legales.';
      }
    }

    return events;
  }
}
