import { PIECE_NAMES, toAlg, inBounds } from '../config/constants.js';

/**
 * Motor del Capítulo 05 — CHESS (Jefe Final Absoluto)
 *
 * - CHESS (negras) NO tiene poderes sobrenaturales: estrategia pura + Súper IA.
 * - En el Nivel 5 el jugador elige obligatoriamente 1 de 3 poderes:
 *   1. 'mittens': Tus capturas asimilan/convierten la pieza capturada al tipo exacto + 3 Soldados Blancos con pistolas de agua (b2, d2, g2).
 *   2. 'maya': 2 Casas Blancas inmortales (c3, f3) + Torre Sagrada Maya reforzada (d3) con empuje divino ortogonal (enfriamiento 2 turnos).
 *   3. 'galaxy': 2 Barreras Universales inmortales (c3, f3) + Teletransporte Galáctico activo del jugador (enfriamiento 3 turnos).
 */
export class ChessFinalEngine {
  constructor(levelId = 5, playerPower = null, minutes = 10) {
    this.mode = 'chess_final';
    this.levelId = Math.max(1, Math.min(5, Number(levelId) || 5));
    this.playerPower = this.levelId === 5 ? (playerPower || 'mittens') : null;
    this.timePresetMinutes = minutes;
    this.reset(this.levelId, this.playerPower, minutes);
  }

  reset(levelId = this.levelId, playerPower = this.playerPower, minutes = this.timePresetMinutes) {
    this.levelId = Math.max(1, Math.min(5, Number(levelId) || 5));
    this.playerPower = this.levelId === 5 ? (playerPower || 'mittens') : null;
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `cB_${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `cP_${c}`, color: 'b', type: 'P', hasMoved: false };
      this.board[7][c] = { id: `wB_${c}`, color: 'w', type: back[c], hasMoved: false };
      const isSoldier = this.playerPower === 'mittens' && (c === 1 || c === 3 || c === 6);
      this.board[6][c] = { id: `wP_${c}`, color: 'w', type: 'P', hasMoved: false, isSoldier };
    }

    this.playerTeleportCooldown = 0;
    this.mayaPushCooldown = 0;
    this.uidCounter = 1;

    if (this.playerPower === 'maya') {
      this.board[5][2] = { id: 'wH1', color: 'w', type: 'H' }; // Casa inmortal c3
      this.board[5][5] = { id: 'wH2', color: 'w', type: 'H' }; // Casa inmortal f3
      this.board[5][3] = { id: 'wMayaRook', color: 'w', type: 'R', isSacredMayaRook: true, hasMoved: true }; // Torre Sagrada Maya d3
    } else if (this.playerPower === 'galaxy') {
      this.board[5][2] = { id: 'wU1', color: 'w', type: 'U' }; // Barrera Universal c3
      this.board[5][5] = { id: 'wU2', color: 'w', type: 'U' }; // Barrera Universal f3
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

    const powerText = {
      mittens: 'Poder equipado: MITTENS (conversión 1:1 en tus capturas + 3 Soldados con pistolas de agua).',
      maya: 'Poder equipado: LA TORRE DEL DIOS MAYA (2 Casas inmortales + Torre Sagrada en d3 con empuje divino).',
      galaxy: 'Poder equipado: PODERES DE LA GALAXIA (2 Barreras Universales inmortales + Teletransporte cada 3 turnos).'
    }[this.playerPower] || 'Ajedrez puro sin poderes sobrenaturales.';

    this.logs = [{
      turn: 0,
      type: 'special',
      text: `Capítulo 05 — ${this.levelId === 5 ? 'CHESS (Jefe Final Absoluto)' : `Prueba ${this.levelId}`}. ${powerText}`
    }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      levelId: this.levelId,
      playerPower: this.playerPower,
      playerTeleportCooldown: this.playerTeleportCooldown,
      mayaPushCooldown: this.mayaPushCooldown,
      uidCounter: this.uidCounter,
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
    this.levelId = s.levelId || 5;
    this.playerPower = s.playerPower || null;
    this.playerTeleportCooldown = s.playerTeleportCooldown || 0;
    this.mayaPushCooldown = s.mayaPushCooldown || 0;
    this.uidCounter = s.uidCounter || 1;
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

  isImmortalStructure(piece) {
    return Boolean(piece && (piece.type === 'H' || piece.type === 'U'));
  }

  getSoldierWaterShots(r, c) {
    const p = this.board[r][c];
    if (!p || p.color !== 'w' || p.type !== 'P' || !p.isSoldier) return [];
    const shots = [];
    for (const [dr, dc] of [[-1, 0], [-1, -1], [-1, 1]]) {
      for (let step = 1; step <= 4; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (!inBounds(nr, nc)) break;
        const occ = this.board[nr][nc];
        if (!occ) continue;
        if (occ.color === 'w') break;
        const pushR = nr + dr, pushC = nc + dc;
        const canDisplace = inBounds(pushR, pushC) && !this.board[pushR][pushC];
        shots.push({
          isWaterShot: true,
          fr: r, fc: c, tr: nr, tc: nc, dr, dc,
          pushR: canDisplace ? pushR : nr,
          pushC: canDisplace ? pushC : nc,
          canDisplace
        });
        break;
      }
    }
    return shots;
  }

  getSoldierWaterRangeSquares(r, c) {
    const set = new Set();
    const p = this.board[r][c];
    if (!p || p.color !== 'w' || p.type !== 'P' || !p.isSoldier) return set;
    for (const [dr, dc] of [[-1, 0], [-1, -1], [-1, 1]]) {
      for (let step = 1; step <= 4; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (!inBounds(nr, nc)) break;
        const occ = this.board[nr][nc];
        if (occ && occ.color === 'w') break;
        set.add(`${nr},${nc}`);
        if (occ) break;
      }
    }
    return set;
  }

  getPlayerTeleportTargets(fr, fc) {
    if (this.playerPower !== 'galaxy' || this.playerTeleportCooldown > 0) return [];
    const p = this.board[fr]?.[fc];
    if (!p || p.color !== 'w' || p.type === 'K' || p.type === 'U') return [];
    const list = [];
    for (let tr = 0; tr < 8; tr++) {
      for (let tc = 0; tc < 8; tc++) {
        if (this.board[tr][tc]) continue;
        const m = { fr, fc, tr, tc, isPlayerTeleport: true };
        if (this.isMoveSafeForKing('w', m)) list.push(m);
      }
    }
    return list;
  }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];

    if (p.type === 'H' || p.type === 'U') {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !this.board[nr][nc]) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
      return moves;
    }

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
          if (target && target.color !== p.color && !this.isImmortalStructure(target)) {
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
        if (!target || (target.color !== p.color && !this.isImmortalStructure(target))) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || (target.color !== p.color && !this.isImmortalStructure(target))) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          }
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
            if (target.color !== p.color && !this.isImmortalStructure(target)) {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            }
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
        if (!p || p.color !== color || this.isImmortalStructure(p)) continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) if (inBounds(nr, c + dc)) set.add(`${nr},${c + dc}`);
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
    if (move.isWaterShot) {
      if (move.canDisplace) {
        this.board[move.pushR][move.pushC] = this.board[move.tr][move.tc];
        this.board[move.tr][move.tc] = null;
      }
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
    const safe = !this.isKingInCheck(color);
    this.board = savedBoard;
    this.enPassantTarget = savedEP;
    return safe;
  }

  getLegalWaterShotsForSoldier(r, c) {
    return this.getSoldierWaterShots(r, c).filter((s) => this.isMoveSafeForKing('w', s));
  }

  getLegalMovesForPiece(r, c, includeWaterShots = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const list = this.getPseudoMoves(r, c, true).filter((m) => {
      const tgt = m.isEnPassant ? this.board[m.fr][m.tc] : this.board[m.tr][m.tc];
      if (tgt && tgt.type === 'K') return false;
      return this.isMoveSafeForKing(p.color, m);
    });
    if (includeWaterShots && p.color === 'w' && p.isSoldier) {
      list.push(...this.getLegalWaterShotsForSoldier(r, c));
    }
    return list;
  }

  getAllLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === color) moves.push(...this.getLegalMovesForPiece(r, c, true));
      }
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
      isWaterShot: Boolean(move.isWaterShot),
      isPlayerTeleport: Boolean(move.isPlayerTeleport),
      displaced: false,
      pushTo: null,
      converted: null,
      to: [move.tr, move.tc]
    };

    if (move.isWaterShot) {
      const victim = this.board[move.tr][move.tc];
      if (move.canDisplace && victim && !this.board[move.pushR][move.pushC]) {
        this.board[move.pushR][move.pushC] = victim;
        this.board[move.tr][move.tc] = null;
        events.displaced = true;
        events.pushTo = [move.pushR, move.pushC];
      }
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: `Poder de Mittens: Soldado (${toAlg(move.fr, move.fc)}) repele ${PIECE_NAMES[victim?.type || 'P']} con agua 💦`
        });
      }
    } else if (move.isPlayerTeleport) {
      const piece = this.board[move.fr][move.fc];
      this.board[move.tr][move.tc] = piece;
      this.board[move.fr][move.fc] = null;
      piece.hasMoved = true;
      this.playerTeleportCooldown = 3;
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: `Poder de la Galaxia: Teletransportas ${PIECE_NAMES[piece.type]} de ${toAlg(move.fr, move.fc)} a ${toAlg(move.tr, move.tc)} ✦`
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
        piece.isSoldier = false;
      }

      if (target) {
        events.captured = target;
        if (actingColor === 'w') {
          this.capturedByWhite.push({ color: target.color, type: target.type });
          // Poder de Mittens del jugador: asimila el tipo exacto capturado en el origen
          if (this.playerPower === 'mittens' && ['P', 'N', 'B', 'R', 'Q'].includes(target.type)) {
            this.board[move.fr][move.fc] = {
              id: `wConv_${this.uidCounter++}`,
              color: 'w',
              type: target.type,
              hasMoved: true
            };
            events.converted = { r: move.fr, c: move.fc, type: target.type };
          }
        } else {
          this.capturedByBlack.push({ color: target.color, type: target.type });
        }
      }

      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      const side = actingColor === 'w' ? 'Blancas' : 'CHESS';
      const convNote = events.converted ? ` ¡Poder de Mittens recluta ${PIECE_NAMES[events.converted.type]}!` : '';
      const text = `${side}: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}${convNote}`;
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: events.converted ? 'special' : (actingColor === 'w' ? 'white' : 'black'), text });
    }

    if (actingColor === 'w' && !move.isPlayerTeleport && this.playerTeleportCooldown > 0) {
      this.playerTeleportCooldown--;
    }

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;
    if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = actingColor === 'w'
          ? '¡JAQUE MATE A CHESS! Eres el Vencedor de Chess.'
          : '¡Jaque mate! La estrategia pura de CHESS prevalece.';
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado: no hay jaque ni movimientos legales.';
      }
    }

    return events;
  }
}
