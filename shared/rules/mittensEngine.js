import { PIECE_NAMES, toAlg, inBounds } from '../config/constants.js';

/**
 * Motor del Capítulo 02 — Free Mittens y sus 4 Minijefes Humanoides.
 *
 * MECÁNICA EXACTA POR NIVEL:
 * - hombre_peon   (transformScope = 'P'): SOLO sus Peones se transforman al capturar en la pieza exacta capturada.
 * - hombre_caballo(transformScope = 'N'): SOLO sus Caballos se transforman al capturar en la pieza exacta capturada.
 * - hombre_alfil  (transformScope = 'B'): SOLO sus Alfiles se transforman al capturar en la pieza exacta capturada.
 * - mujer_reina   (transformScope = 'Q'): SOLO su Reina asimila/recluta la pieza exacta capturada en su casilla de origen (sin perder su rango de Reina).
 * - free_mittens  (transformScope = 'ALL'): Todas sus piezas :3 asimilan exactamente el tipo capturado (nunca gratis Reina/Rey).
 *   Además en Free Mittens el jugador tiene 3 Soldados Blancos con pistolas de agua (b2, d2, g2) y el Aspersor inmóvil (d4).
 */
export class FreeMittensEngine {
  constructor(bossId = 'free_mittens', minutes = 10) {
    this.mode = 'mittens';
    this.bossId = bossId;
    this.timePresetMinutes = minutes;
    this.reset(bossId, minutes);
  }

  reset(bossId = this.bossId, minutes = this.timePresetMinutes) {
    this.bossId = bossId || 'free_mittens';
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    const scopeMap = {
      hombre_peon: 'P',
      hombre_caballo: 'N',
      hombre_alfil: 'B',
      mujer_reina: 'Q',
      free_mittens: 'ALL'
    };
    this.transformScope = scopeMap[this.bossId] || 'ALL';
    this.isFreeMittensBoss = this.bossId === 'free_mittens';
    this.hasSprinkler = this.isFreeMittensBoss;
    this.hasWhiteSoldiers = this.isFreeMittensBoss;
    this.sprinkler = this.hasSprinkler ? { r: 4, c: 3 } : null; // d4 solo en Free Mittens

    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

    // Ejército blanco: 16 piezas (+ 3 peones soldados con pistolas de agua en Free Mittens)
    for (let c = 0; c < 8; c++) {
      this.board[7][c] = { id: `wB_${c}`, color: 'w', type: backRank[c], hasMoved: false };
      const isSoldier = this.hasWhiteSoldiers && (c === 1 || c === 3 || c === 6);
      this.board[6][c] = { id: `wP_${c}`, color: 'w', type: 'P', hasMoved: false, isSoldier };
    }

    // Formación del jefe del Capítulo 02
    let bossBack = [...backRank];
    if (this.bossId === 'hombre_peon') {
      bossBack = ['R', 'N', 'B', 'P', 'K', 'B', 'N', 'R'];
    } else if (this.bossId === 'hombre_caballo') {
      bossBack = ['R', 'N', 'N', 'Q', 'K', 'N', 'N', 'R'];
    } else if (this.bossId === 'hombre_alfil') {
      bossBack = ['R', 'B', 'B', 'Q', 'K', 'B', 'B', 'R'];
    } else if (this.bossId === 'mujer_reina') {
      bossBack = ['R', 'N', 'B', 'Q', 'K', 'Q', 'N', 'R'];
    }

    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `mB_${c}`, color: 'b', type: bossBack[c], hasMoved: false };
      this.board[1][c] = { id: `mP_${c}`, color: 'b', type: 'P', hasMoved: false };
    }
    if (this.bossId === 'hombre_peon') {
      this.board[2][2] = { id: 'mPx1', color: 'b', type: 'P', hasMoved: true };
      this.board[2][5] = { id: 'mPx2', color: 'b', type: 'P', hasMoved: true };
    }

    this.enPassantTarget = null;
    this.turn = 'w';
    this.turnNumber = 1;
    this.winner = null;
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.conversionsCount = 0;
    this.uidCounter = 1;
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };

    const bossTitles = {
      hombre_peon: 'Hombre Peón',
      hombre_caballo: 'Hombre Caballo',
      hombre_alfil: 'Hombre Alfil',
      mujer_reina: 'Mujer Reina',
      free_mittens: 'Free Mittens'
    };
    this.bossTitle = bossTitles[this.bossId] || 'Free Mittens';

    const ruleSummary = {
      P: 'SOLO los Peones enemigos se transforman en la pieza exacta que capturan.',
      N: 'SOLO los Caballos enemigos se transforman en la pieza exacta que capturan.',
      B: 'SOLO los Alfiles enemigos se transforman en la pieza exacta que capturan.',
      Q: 'SOLO la Reina enemiga asimila y recluta la pieza exacta que captura sin perder su rango.',
      ALL: 'Todas las piezas de Free Mittens asimilan exactamente el tipo capturado. Cuentas con 3 Soldados Blancos (pistolas de agua) y el Aspersor inmóvil en d4.'
    }[this.transformScope];

    this.logs = [{
      turn: 0,
      type: 'special',
      text: `Combate contra ${this.bossTitle}. ${ruleSummary}`
    }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      bossId: this.bossId,
      bossTitle: this.bossTitle,
      transformScope: this.transformScope,
      isFreeMittensBoss: this.isFreeMittensBoss,
      hasSprinkler: this.hasSprinkler,
      hasWhiteSoldiers: this.hasWhiteSoldiers,
      board: this.board,
      sprinkler: this.sprinkler,
      enPassantTarget: this.enPassantTarget,
      turn: this.turn,
      turnNumber: this.turnNumber,
      winner: this.winner,
      winReason: this.winReason,
      lastMoveSquares: this.lastMoveSquares,
      capturedByWhite: this.capturedByWhite,
      capturedByBlack: this.capturedByBlack,
      conversionsCount: this.conversionsCount,
      uidCounter: this.uidCounter,
      clocks: this.clocks,
      timePresetMinutes: this.timePresetMinutes,
      logs: this.logs
    }));
  }

  loadState(s) {
    this.bossId = s.bossId || 'free_mittens';
    this.bossTitle = s.bossTitle || 'Free Mittens';
    this.transformScope = s.transformScope || 'ALL';
    this.isFreeMittensBoss = Boolean(s.isFreeMittensBoss);
    this.hasSprinkler = Boolean(s.hasSprinkler);
    this.hasWhiteSoldiers = Boolean(s.hasWhiteSoldiers);
    this.board = s.board;
    this.sprinkler = s.sprinkler || null;
    this.enPassantTarget = s.enPassantTarget || null;
    this.turn = s.turn;
    this.turnNumber = s.turnNumber;
    this.winner = s.winner || null;
    this.winReason = s.winReason || '';
    this.lastMoveSquares = s.lastMoveSquares || [];
    this.capturedByWhite = s.capturedByWhite || [];
    this.capturedByBlack = s.capturedByBlack || [];
    this.conversionsCount = s.conversionsCount || 0;
    this.uidCounter = s.uidCounter || 1;
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

  isSprinkler(r, c) {
    return Boolean(this.sprinkler && r === this.sprinkler.r && c === this.sprinkler.c);
  }

  countPieces(color) {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (this.board[r][c]?.color === color) n++;
    return n;
  }

  countAliveSoldiers() {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (this.board[r][c]?.color === 'w' && this.board[r][c]?.isSoldier) n++;
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

  findPrimaryKing(color) { return this.findKing(color); }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.board[nr][c] && !this.isSprinkler(nr, c)) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c] && !this.isSprinkler(nr2, c)) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc) && !this.isSprinkler(nr, tc)) {
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
        if (!inBounds(nr, nc) || this.isSprinkler(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || this.isSprinkler(nr, nc)) continue;
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
              && !this.isSprinkler(r, 5) && !this.isSprinkler(r, 6)
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
              && !this.isSprinkler(r, 1) && !this.isSprinkler(r, 2) && !this.isSprinkler(r, 3)
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
          if (this.isSprinkler(nr, nc)) break;
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
            if (inBounds(nr, c + dc) && !this.isSprinkler(nr, c + dc)) set.add(`${nr},${c + dc}`);
          }
        } else {
          for (const m of this.getPseudoMoves(r, c, false)) set.add(`${m.tr},${m.tc}`);
        }
      }
    }
    return set;
  }

  getSoldierWaterShots(r, c) {
    const p = this.board[r][c];
    if (!p || p.color !== 'w' || p.type !== 'P' || !p.isSoldier) return [];
    const shots = [];
    for (const [dr, dc] of [[-1, 0], [-1, -1], [-1, 1]]) {
      for (let step = 1; step <= 4; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (!inBounds(nr, nc) || this.isSprinkler(nr, nc)) break;
        const occ = this.board[nr][nc];
        if (!occ) continue;
        if (occ.color === 'w') break;
        let pushR = nr + dr, pushC = nc + dc;
        let canDisplace = inBounds(pushR, pushC) && !this.isSprinkler(pushR, pushC) && !this.board[pushR][pushC];
        if (!canDisplace && dc !== 0) {
          const altR = nr - 1, altC = nc;
          if (inBounds(altR, altC) && !this.isSprinkler(altR, altC) && !this.board[altR][altC]) {
            pushR = altR; pushC = altC; canDisplace = true;
          }
        }
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
        if (!inBounds(nr, nc) || this.isSprinkler(nr, nc)) break;
        const occ = this.board[nr][nc];
        if (occ && occ.color === 'w') break;
        set.add(`${nr},${nc}`);
        if (occ) break;
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

  static getBalancedConversionType(capturedType) {
    const allowed = new Set(['P', 'N', 'B', 'R', 'Q']);
    return allowed.has(capturedType) ? capturedType : null;
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const actingColor = this.turn;
    let events;

    if (move.isWaterShot) {
      const victim = this.board[move.tr][move.tc];
      let displaced = false;
      if (move.canDisplace && victim && !this.board[move.pushR][move.pushC] && !this.isSprinkler(move.pushR, move.pushC)) {
        this.board[move.pushR][move.pushC] = victim;
        this.board[move.tr][move.tc] = null;
        displaced = true;
      }
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      if (displaced) this.lastMoveSquares.push([move.pushR, move.pushC]);

      const text = displaced
        ? `Soldado (${toAlg(move.fr, move.fc)}) dispara agua y repele ${PIECE_NAMES[victim.type]} (${toAlg(move.tr, move.tc)} → ${toAlg(move.pushR, move.pushC)}) 💦`
        : `Soldado (${toAlg(move.fr, move.fc)}) impacta con agua en ${toAlg(move.tr, move.tc)}.`;
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: 'special', text });

      events = {
        isWaterShot: true,
        color: 'w',
        to: [move.tr, move.tc],
        displaced,
        pushTo: displaced ? [move.pushR, move.pushC] : null,
        captured: null,
        converted: null
      };
    } else {
      const piece = this.board[move.fr][move.fc];
      const attackerOriginalType = piece.type;
      const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];
      this.board[move.fr][move.fc] = null;
      if (move.isEnPassant) this.board[move.fr][move.tc] = null;
      this.board[move.tr][move.tc] = piece;
      piece.hasMoved = true;

      if (move.isCastle === 'K') {
        this.board[move.fr][5] = this.board[move.fr][7];
        this.board[move.fr][7] = null;
        if (this.board[move.fr][5]) this.board[move.fr][5].hasMoved = true;
      } else if (move.isCastle === 'Q') {
        this.board[move.fr][3] = this.board[move.fr][0];
        this.board[move.fr][0] = null;
        if (this.board[move.fr][3]) this.board[move.fr][3].hasMoved = true;
      }

      if (piece.type === 'P' && ((actingColor === 'w' && move.tr === 0) || (actingColor === 'b' && move.tr === 7))) {
        piece.type = actingColor === 'w' ? promoType : 'Q';
        piece.isSoldier = false;
      }

      let converted = null;
      let logType = actingColor === 'w' ? 'white' : 'black';
      let text = `${actingColor === 'w' ? 'Blancas' : this.bossTitle}: ${PIECE_NAMES[attackerOriginalType]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}.`;

      if (target) {
        if (actingColor === 'w') {
          this.capturedByWhite.push({ color: target.color, type: target.type });
          text += ` Captura ${PIECE_NAMES[target.type]} rival.`;
        } else {
          this.capturedByBlack.push({ color: target.color, type: target.type });
          const newType = FreeMittensEngine.getBalancedConversionType(target.type);

          if (newType) {
            if (this.transformScope === 'P' || this.transformScope === 'N' || this.transformScope === 'B') {
              // Minijefes 1-3: SOLO el tipo de pieza del jefe se transforma IN-PLACE en la pieza capturada
              if (attackerOriginalType === this.transformScope) {
                piece.type = newType;
                this.conversionsCount++;
                converted = {
                  mode: 'morph',
                  r: move.tr,
                  c: move.tc,
                  capR: move.tr,
                  capC: move.tc,
                  originalType: target.type,
                  newType
                };
                logType = 'special';
                text += ` ¡Transformación! El ${PIECE_NAMES[attackerOriginalType]} adopta la forma de ${PIECE_NAMES[newType]} en ${toAlg(move.tr, move.tc)}.`;
              } else {
                text += ` Captura ${PIECE_NAMES[target.type]} blanco.`;
              }
            } else if (this.transformScope === 'Q') {
              // Minijefe 4 (Mujer Reina): SOLO su Reina asimila/recluta la pieza capturada en su origen sin perder su rango de Reina
              if (attackerOriginalType === 'Q') {
                this.board[move.fr][move.fc] = {
                  id: `mConv_${this.uidCounter++}`,
                  color: 'b',
                  type: newType,
                  hasMoved: true,
                  converted: true
                };
                this.conversionsCount++;
                converted = {
                  mode: 'recruit',
                  r: move.fr,
                  c: move.fc,
                  capR: move.tr,
                  capC: move.tc,
                  originalType: target.type,
                  newType
                };
                logType = 'special';
                text += ` ¡Asimilación Real! La Reina conserva su corona y recluta un ${PIECE_NAMES[newType]} en ${toAlg(move.fr, move.fc)}.`;
              } else {
                text += ` Captura ${PIECE_NAMES[target.type]} blanco.`;
              }
            } else {
              // Jefe Final Free Mittens (transformScope === 'ALL'): TODAS sus piezas asimilan exactamente el tipo capturado
              this.board[move.fr][move.fc] = {
                id: `mConv_${this.uidCounter++}`,
                color: 'b',
                type: newType,
                hasMoved: true,
                converted: true
              };
              this.conversionsCount++;
              converted = {
                mode: 'recruit',
                r: move.fr,
                c: move.fc,
                capR: move.tr,
                capC: move.tc,
                originalType: target.type,
                newType
              };
              logType = 'special';
              text += ` Free Mittens asimila tu ${PIECE_NAMES[target.type]} como ${PIECE_NAMES[newType]} en ${toAlg(move.fr, move.fc)}.`;
            }
          }
        }
      }

      this.enPassantTarget = move.doublePawn ? { r: (move.fr + move.tr) / 2, c: move.fc } : null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: logType, text });

      events = {
        isWaterShot: false,
        color: actingColor,
        to: [move.tr, move.tc],
        displaced: false,
        pushTo: null,
        captured: target || null,
        converted
      };
    }

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;
    if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = actingColor === 'w'
          ? `¡Jaque mate a ${this.bossTitle}!`
          : `¡Jaque mate! ${this.bossTitle} prevalece.`;
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado: no hay jaque ni movimientos legales.';
      }
    }

    return events;
  }
}
