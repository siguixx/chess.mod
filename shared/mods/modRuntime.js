import { inBounds, toAlg, PIECE_NAMES } from '../config/constants.js';
import { COSMETIC_POWERS } from '../config/cosmetics.js';

export const ALLOWED_MOD_EFFECTS = [
  'ranged_destroy',
  'golden_freeze_area',
  'area_crush_2x2',
  'corrupt_steal',
  'rift_destroy',
  'water_cannon',
  'summon_piece'
];

export const ALLOWED_MOD_TEXTURES = [
  'texture-stone',
  'texture-temple-gold',
  'texture-velvet',
  'texture-slate',
  'texture-magma',
  'texture-jade',
  'texture-ice',
  'texture-glitch',
  'texture-nebula',
  'texture-marble-gold',
  'texture-void',
  'texture-vip-gold'
];

export const MOD_TEMPLATES = [
  {
    format: 'chessmod-v1',
    id: 'mod_titan_aplastador',
    name: 'Titán 2×2 Aplastador',
    author: 'Comunidad CHESS.MOD',
    version: '1.0',
    description: 'Invoca un Coloso 2×2 que aplasta cualquier enemigo dentro del bloque y deja el tablero en llamas.',
    board: {
      light: '#f3d4b8',
      dark: '#5e2318',
      pedestal: 'linear-gradient(145deg, #a63217 0%, #1c0b08 55%, #691f10 100%)',
      textureClass: 'texture-magma'
    },
    extraPieces: [
      { type: 'N', r: 5, c: 2 },
      { type: 'N', r: 5, c: 5 }
    ],
    power: {
      name: 'Aplastamiento Titán 2×2',
      icon: '🌋',
      effect: 'area_crush_2x2',
      cooldown: 3,
      range: 7,
      duration: 2,
      color: '#ff6b35',
      description: 'Invoca un Titán 2×2 que destruye a todos los enemigos (no Rey) dentro de 4 casillas y bloquea la zona 2 turnos.'
    }
  },
  {
    format: 'chessmod-v1',
    id: 'mod_francotirador_cuantico',
    name: 'Francotirador Cuántico',
    author: 'Comunidad CHESS.MOD',
    version: '1.0',
    description: 'Tablero Glitch Neón donde cualquier pieza puede disparar rayos láser a 5 casillas destruyendo objetivos.',
    board: {
      light: '#d8f0f6',
      dark: '#1f2338',
      pedestal: 'linear-gradient(145deg, #22d3ee 0%, #0d0e1a 55%, #a855f7 100%)',
      textureClass: 'texture-glitch'
    },
    extraPieces: [],
    power: {
      name: 'Rayo Cuántico',
      icon: '🔫',
      effect: 'ranged_destroy',
      cooldown: 2,
      range: 5,
      duration: 0,
      color: '#38bdf8',
      description: 'Dispara a distancia (hasta 5 casillas en 8 direcciones) destruyendo instantáneamente a una ficha rival (no Rey).'
    }
  },
  {
    format: 'chessmod-v1',
    id: 'mod_caos_doble_dama',
    name: 'Caos de Invocación & Traición',
    author: 'Comunidad CHESS.MOD',
    version: '1.0',
    description: 'Empieza con Caballos avanzados y un poder que corrompe y roba fichas enemigas para tu ejército.',
    board: {
      light: '#e4dcf2',
      dark: '#2b1b42',
      pedestal: 'linear-gradient(145deg, #8b5cf6 0%, #120c1d 55%, #4c1d95 100%)',
      textureClass: 'texture-nebula'
    },
    extraPieces: [
      { type: 'B', r: 5, c: 3 }
    ],
    power: {
      name: 'Control Mental',
      icon: '🧠',
      effect: 'corrupt_steal',
      cooldown: 3,
      range: 6,
      duration: 2,
      color: '#c084fc',
      description: 'Corrompe a cualquier pieza rival (no Rey) convirtiéndola en tu aliada en su misma casilla.'
    }
  }
];

function sanitizeHex(val, fallback) {
  const s = String(val || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

function sanitizeText(val, maxLen = 120, fallback = '') {
  const s = String(val ?? fallback).replace(/[<>]/g, '').trim();
  return s.slice(0, maxLen) || fallback;
}

export function validateAndNormalizeMod(input) {
  let obj = input;
  if (typeof input === 'string') {
    if (input.length > 16384) return { ok: false, error: 'El código del Mod supera el máximo permitido (16 KB).' };
    try {
      obj = JSON.parse(input);
    } catch (err) {
      return { ok: false, error: `JSON inválido en el código del Mod: ${err.message}` };
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'El Mod debe ser un objeto JSON válido con formato "chessmod-v1".' };
  }

  const name = sanitizeText(obj.name, 42, '');
  if (name.length < 2) return { ok: false, error: 'El Mod debe tener un campo "name" (mín. 2 caracteres).' };

  const powerRaw = obj.power || {};
  const effect = ALLOWED_MOD_EFFECTS.includes(powerRaw.effect) ? powerRaw.effect : 'ranged_destroy';
  const cooldown = Math.max(1, Math.min(8, Math.round(Number(powerRaw.cooldown) || 3)));
  const range = Math.max(2, Math.min(7, Math.round(Number(powerRaw.range) || 4)));
  const duration = Math.max(1, Math.min(4, Math.round(Number(powerRaw.duration) || 2)));
  const summonType = ['P', 'N', 'B', 'R', 'Q'].includes(powerRaw.summonType) ? powerRaw.summonType : 'N';

  const boardRaw = obj.board || {};
  const light = sanitizeHex(boardRaw.light, '#e5d8bf');
  const dark = sanitizeHex(boardRaw.dark, '#3d4c5c');
  const textureClass = ALLOWED_MOD_TEXTURES.includes(boardRaw.textureClass) ? boardRaw.textureClass : 'texture-stone';
  const pedestal = typeof boardRaw.pedestal === 'string' && /^linear-gradient\([a-zA-Z0-9#%,.\s()-]+\)$/.test(boardRaw.pedestal)
    ? boardRaw.pedestal
    : `linear-gradient(145deg, ${dark} 0%, #14120f 55%, ${light} 100%)`;

  const extraPieces = [];
  if (Array.isArray(obj.extraPieces)) {
    for (const ep of obj.extraPieces.slice(0, 4)) {
      if (!ep || !['P', 'N', 'B', 'R', 'Q'].includes(ep.type)) continue;
      const r = Math.round(Number(ep.r));
      const c = Math.round(Number(ep.c));
      if (r >= 4 && r <= 6 && c >= 0 && c <= 7) {
        extraPieces.push({ type: ep.type, r, c });
      }
    }
  }

  const idSlug = sanitizeText(obj.id, 40, `mod_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`).replace(/[^a-zA-Z0-9_-]/g, '');

  const normalized = {
    format: 'chessmod-v1',
    id: idSlug || `mod_${Date.now()}`,
    name,
    author: sanitizeText(obj.author, 32, 'Jugador'),
    version: sanitizeText(obj.version, 12, '1.0'),
    description: sanitizeText(obj.description, 220, 'Mod personalizado de código abierto para Salas Privadas.'),
    board: { light, dark, pedestal, textureClass },
    extraPieces,
    power: {
      id: `custom_${idSlug || 'power'}`,
      name: sanitizeText(powerRaw.name, 42, 'Poder Personalizado'),
      icon: sanitizeText(powerRaw.icon, 4, '⚡'),
      effect,
      cooldown,
      range,
      duration,
      color: sanitizeHex(powerRaw.color, '#ffd859'),
      summonType,
      description: sanitizeText(powerRaw.description, 220, 'Poder ofensivo creado con código abierto.'),
      isCustomMod: true
    }
  };

  return { ok: true, mod: normalized };
}

export function applyCustomModSetupToEngine(engine, mod) {
  if (!engine || !mod || !Array.isArray(mod.extraPieces)) return;
  let idx = 1;
  for (const ep of mod.extraPieces) {
    // Blancas en (r, c) y Negras en espejo (7 - r, c) para que la sala privada sea justa
    if (inBounds(ep.r, ep.c) && !engine.board[ep.r][ep.c]) {
      engine.board[ep.r][ep.c] = { id: `modW_${idx}`, color: 'w', type: ep.type, hasMoved: false };
    }
    const mr = 7 - ep.r;
    if (inBounds(mr, ep.c) && !engine.board[mr][ep.c]) {
      engine.board[mr][ep.c] = { id: `modB_${idx}`, color: 'b', type: ep.type, hasMoved: false };
    }
    idx++;
  }
}

export function createInitialPowerState() {
  return {
    cooldowns: { w: 0, b: 0 },
    frozenPieces: {},        // pieceId -> turnsLeft
    assimilationTurns: { w: 0, b: 0 }, // Free Mittens 1:1 assimilation buff turns
    modRifts: [],            // [{ r, c, turnsLeft, owner }]
    giantUnits: []           // [{ id, owner, r, c, turnsLeft, kind, name, color }]
  };
}

export function resolvePowerDef(powerId, customMod = null) {
  if (customMod && customMod.power) {
    return customMod.power;
  }
  if (!powerId || powerId === 'power_none') return null;
  return COSMETIC_POWERS.find((p) => p.id === powerId) || null;
}

export function getGiantUnitCells(r, c) {
  return [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
}

export function isSquareBlockedByModState(powerState, r, c, moverColor = null) {
  if (!powerState) return false;
  if ((powerState.modRifts || []).some((rf) => rf.r === r && rf.c === c)) return true;
  for (const g of (powerState.giantUnits || [])) {
    if (moverColor && g.owner === moverColor) continue;
    if (r >= g.r && r <= g.r + 1 && c >= g.c && c <= g.c + 1) return true;
  }
  return false;
}

export function isPieceFrozen(powerState, piece) {
  if (!powerState || !piece) return false;
  return (powerState.frozenPieces?.[piece.id] || 0) > 0;
}

/**
 * Calcula los objetivos legales para cualquier poder oficial OP o poder custom de código abierto.
 */
export function computePowerTargets(engine, powerState, side, powerDef, sourcePos = null) {
  if (!engine || !powerDef) return [];
  const enemy = side === 'w' ? 'b' : 'w';
  const eff = powerDef.effect || powerDef.id;
  const maxRange = powerDef.range || (eff === 'power_vip_golden_freeze' || eff === 'golden_freeze_area' ? 5 : 4);
  const targets = [];

  // 1. Poderes de disparo a distancia desde una pieza origen (Flechas Maya, Tormenta Dorada VIP, Rayo Cuántico, Chorro Free Mittens)
  if (
    eff === 'power_vip_golden_freeze' || eff === 'golden_freeze_area'
    || eff === 'power_maya_arrows' || eff === 'ranged_destroy'
    || eff === 'power_free_mittens' || eff === 'water_cannon'
  ) {
    if (!sourcePos) return [];
    const { r: pr, c: pc } = sourcePos;
    const srcPiece = engine.board[pr]?.[pc];
    if (!srcPiece || srcPiece.color !== side) return [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      for (let step = 1; step <= maxRange; step++) {
        const nr = pr + dr * step;
        const nc = pc + dc * step;
        if (!inBounds(nr, nc)) break;
        const occ = engine.board[nr]?.[nc];
        if (!occ) continue;
        if (occ.color === enemy && occ.type !== 'K') {
          targets.push({ fr: pr, fc: pc, tr: nr, tc: nc, dr, dc, effect: eff });
        }
        break;
      }
    }
    return targets;
  }

  // 2. Fichas Grandes 2×2 (Pirámide Maya 2×2, Coloso Galáctico 2×2, Custom area_crush_2x2)
  if (eff === 'power_maya_pyramid' || eff === 'power_galaxy_titan' || eff === 'area_crush_2x2') {
    for (let r = 0; r <= 6; r++) {
      for (let c = 0; c <= 6; c++) {
        const cells = getGiantUnitCells(r, c);
        let touchesKing = false;
        let hasEnemy = false;
        let touchesOwnNonKing = false;
        for (const [cr, cc] of cells) {
          const p = engine.board[cr]?.[cc];
          if (!p) continue;
          if (p.type === 'K') { touchesKing = true; break; }
          if (p.color === enemy) hasEnemy = true;
          if (p.color === side) touchesOwnNonKing = true;
        }
        if (touchesKing || touchesOwnNonKing) continue;
        // Permitir caer donde haya enemigos o en las filas centrales (2..5)
        if (hasEnemy || (r >= 2 && r <= 4)) {
          targets.push({ tr: r, tc: c, isGiant2x2: true, effect: eff });
        }
      }
    }
    return targets;
  }

  // 3. Grieta Glitch Destructora (power_glitch_rift / rift_destroy): apunta directo a cualquier enemigo no Rey
  if (eff === 'power_glitch_rift' || eff === 'rift_destroy') {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r]?.[c];
        if (p && p.color === enemy && p.type !== 'K') {
          targets.push({ tr: r, tc: c, effect: eff });
        }
      }
    }
    return targets;
  }

  // 4. Zarpa Traidora de Blacky / Control Mental (power_blacky_claw / corrupt_steal): roba pieza rival (no Rey; en oficial no Dama)
  if (eff === 'power_blacky_claw' || eff === 'corrupt_steal') {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r]?.[c];
        if (!p || p.color !== enemy || p.type === 'K') continue;
        if (eff === 'power_blacky_claw' && p.type === 'Q') continue;
        targets.push({ tr: r, tc: c, effect: eff });
      }
    }
    return targets;
  }

  // 5. Invocación de pieza personalizada (summon_piece): cualquier casilla vacía en la mitad aliada o centro
  if (eff === 'summon_piece') {
    const minR = side === 'w' ? 3 : 0;
    const maxR = side === 'w' ? 7 : 4;
    for (let r = minR; r <= maxR; r++) {
      for (let c = 0; c < 8; c++) {
        if (!engine.board[r]?.[c] && !isSquareBlockedByModState(powerState, r, c)) {
          targets.push({ tr: r, tc: c, effect: eff });
        }
      }
    }
    return targets;
  }

  return targets;
}

export function powerNeedsSourceSelection(powerDef) {
  if (!powerDef) return false;
  const eff = powerDef.effect || powerDef.id;
  return [
    'power_vip_golden_freeze',
    'golden_freeze_area',
    'power_maya_arrows',
    'ranged_destroy',
    'power_free_mittens',
    'water_cannon'
  ].includes(eff);
}

/**
 * Ejecuta un poder oficial OP o personalizado sobre el engine + powerState.
 * Devuelve { ok, events, logText, sfx } y pasa el turno al rival.
 */
export function executeBattlePowerAction(engine, powerState, side, powerDef, action) {
  if (!engine || !powerState || !powerDef) return { ok: false, error: 'Poder no disponible.' };
  if (engine.winner) return { ok: false, error: 'La partida ya finalizó.' };
  if (engine.turn !== side) return { ok: false, error: 'No es tu turno.' };
  if ((powerState.cooldowns[side] || 0) > 0) {
    return { ok: false, error: `Poder en enfriamiento (${powerState.cooldowns[side]} turnos).` };
  }

  const enemy = side === 'w' ? 'b' : 'w';
  const eff = powerDef.effect || powerDef.id;
  const sourcePos = (action.fr !== undefined && action.fc !== undefined) ? { r: Number(action.fr), c: Number(action.fc) } : null;
  const legalTargets = computePowerTargets(engine, powerState, side, powerDef, sourcePos);
  const chosen = legalTargets.find((t) => t.tr === Number(action.tr) && t.tc === Number(action.tc));
  if (!chosen) return { ok: false, error: 'Objetivo ilegal para este poder.' };

  if (engine.pushHistory) engine.pushHistory();

  const capturedBag = side === 'w' ? engine.capturedByWhite : engine.capturedByBlack;
  let logText = '';
  let sfx = powerDef.sfxType || 'power_golden_freeze';
  const events = { effect: eff, tr: chosen.tr, tc: chosen.tc, fr: chosen.fr, fc: chosen.fc, color: powerDef.color || '#ffd859', destroyed: [] };

  // === 1. TORMENTA DORADA MOD VIP (OP) / GOLDEN FREEZE AREA ===
  if (eff === 'power_vip_golden_freeze' || eff === 'golden_freeze_area') {
    const victim = engine.board[chosen.tr][chosen.tc];
    const alreadyFrozen = (powerState.frozenPieces[victim.id] || 0) > 0;
    if (alreadyFrozen) {
      // ¡EJECUCIÓN ÁUREA INSTANTÁNEA!
      engine.board[chosen.tr][chosen.tc] = null;
      delete powerState.frozenPieces[victim.id];
      capturedBag.push(victim);
      events.destroyed.push([chosen.tr, chosen.tc]);
      sfx = 'crush';
      logText = `👑⚡ EJECUCIÓN DORADA (${powerDef.name}): ${PIECE_NAMES[victim.type]} congelado en ${toAlg(chosen.tr, chosen.tc)} fue DESTRUIDO en oro puro!`;
    } else {
      const dur = powerDef.duration || 3;
      powerState.frozenPieces[victim.id] = dur;
      let bonusCount = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const ar = chosen.tr + dr;
        const ac = chosen.tc + dc;
        if (!inBounds(ar, ac)) continue;
        const adj = engine.board[ar][ac];
        if (adj && adj.color === enemy && adj.type !== 'K') {
          powerState.frozenPieces[adj.id] = dur;
          bonusCount++;
        }
      }
      sfx = 'power_golden_freeze';
      logText = `👑❄️ ${powerDef.name.toUpperCase()}: ${PIECE_NAMES[victim.type]} (${toAlg(chosen.tr, chosen.tc)})${bonusCount > 0 ? ` y ${bonusCount} enemigo(s) adyacente(s)` : ''} congelados en dorado por ${dur} turnos! (Vuelve a dispararle para destruirlo).`;
    }
    engine.lastMoveSquares = [[chosen.fr, chosen.fc], [chosen.tr, chosen.tc]];
  }

  // === 2. LLUVIA DE FLECHAS MAYA / RAYO CUÁNTICO (ATAQUE DIRECTO A DISTANCIA) ===
  else if (eff === 'power_maya_arrows' || eff === 'ranged_destroy') {
    const victim = engine.board[chosen.tr][chosen.tc];
    engine.board[chosen.tr][chosen.tc] = null;
    capturedBag.push(victim);
    events.destroyed.push([chosen.tr, chosen.tc]);

    // En Flechas Maya, también empuja enemigos adyacentes 1 casilla hacia atrás
    if (eff === 'power_maya_arrows') {
      const pushDir = side === 'w' ? -1 : 1;
      for (const [dr, dc] of [[0, -1], [0, 1]]) {
        const ar = chosen.tr + dr;
        const ac = chosen.tc + dc;
        const pr = ar + pushDir;
        if (inBounds(ar, ac) && inBounds(pr, ac)) {
          const adj = engine.board[ar][ac];
          if (adj && adj.color === enemy && adj.type !== 'K' && !engine.board[pr][ac]) {
            engine.board[pr][ac] = adj;
            engine.board[ar][ac] = null;
          }
        }
      }
    }
    sfx = 'arrowShot';
    engine.lastMoveSquares = [[chosen.fr, chosen.fc], [chosen.tr, chosen.tc]];
    logText = `${powerDef.icon || '🏹'} ${powerDef.name.toUpperCase()}: Ataque a distancia desde ${toAlg(chosen.fr, chosen.fc)} destruye a ${PIECE_NAMES[victim.type]} en ${toAlg(chosen.tr, chosen.tc)}!`;
  }

  // === 3. FICHAS GRANDES 2×2 (PIRÁMIDE MAYA / COLOSO GALÁCTICO / CUSTOM TITÁN 2×2) ===
  else if (eff === 'power_maya_pyramid' || eff === 'power_galaxy_titan' || eff === 'area_crush_2x2') {
    const cells = getGiantUnitCells(chosen.tr, chosen.tc);
    const crushedNames = [];
    for (const [cr, cc] of cells) {
      const p = engine.board[cr][cc];
      if (p && p.color === enemy && p.type !== 'K') {
        engine.board[cr][cc] = null;
        capturedBag.push(p);
        crushedNames.push(PIECE_NAMES[p.type]);
        events.destroyed.push([cr, cc]);
      }
    }

    // Coloso Galáctico además dispara onda orbital a 1 pieza menor adyacente
    if (eff === 'power_galaxy_titan') {
      outer: for (let r = chosen.tr - 1; r <= chosen.tr + 2; r++) {
        for (let c = chosen.tc - 1; c <= chosen.tc + 2; c++) {
          if (!inBounds(r, c)) continue;
          if (r >= chosen.tr && r <= chosen.tr + 1 && c >= chosen.tc && c <= chosen.tc + 1) continue;
          const p = engine.board[r][c];
          if (p && p.color === enemy && ['P', 'N', 'B'].includes(p.type)) {
            engine.board[r][c] = null;
            capturedBag.push(p);
            crushedNames.push(`${PIECE_NAMES[p.type]} (Onda Orbital)`);
            events.destroyed.push([r, c]);
            break outer;
          }
        }
      }
    }

    // Reemplaza cualquier Ficha Grande previa de este jugador
    powerState.giantUnits = (powerState.giantUnits || []).filter((g) => g.owner !== side);
    powerState.giantUnits.push({
      id: `giant_${side}_${Date.now()}`,
      owner: side,
      r: chosen.tr,
      c: chosen.tc,
      turnsLeft: powerDef.duration || 2,
      kind: eff === 'power_galaxy_titan' ? 'galaxy' : 'pyramid',
      name: powerDef.name,
      color: powerDef.color || '#ffd859'
    });

    sfx = eff === 'power_galaxy_titan' ? 'galaxyTeleport' : 'crush';
    engine.lastMoveSquares = cells;
    logText = `${powerDef.icon || '🏛️'} ${powerDef.name.toUpperCase()} (2×2) invocado en ${toAlg(chosen.tr, chosen.tc)}-${toAlg(chosen.tr + 1, chosen.tc + 1)}${crushedNames.length ? ` — ¡APLASTÓ: ${crushedNames.join(', ')}!` : ' bloqueando el sector por 2 turnos!'}`;
  }

  // === 4. PODER DE FREE MITTENS (ASIMILACIÓN 1:1 + CAÑÓN DE AGUA DESTRUCTOR) ===
  else if (eff === 'power_free_mittens' || eff === 'water_cannon') {
    const victim = engine.board[chosen.tr][chosen.tc];
    if (eff === 'power_free_mittens') {
      powerState.assimilationTurns[side] = 3;
    }
    // Empuja 2 casillas en la dirección del disparo; si choca contra borde o pieza, ¡DESTRUIDO!
    let currR = chosen.tr;
    let currC = chosen.tc;
    let crashed = false;
    for (let step = 0; step < 2; step++) {
      const nr = currR + chosen.dr;
      const nc = currC + chosen.dc;
      if (!inBounds(nr, nc) || engine.board[nr][nc]) {
        crashed = true;
        break;
      }
      currR = nr;
      currC = nc;
    }
    if (crashed) {
      engine.board[chosen.tr][chosen.tc] = null;
      capturedBag.push(victim);
      events.destroyed.push([chosen.tr, chosen.tc]);
      sfx = 'convert';
      logText = `⛓️💦 ${powerDef.name.toUpperCase()}: ¡Impacto contra obstáculo DESTRUYE a ${PIECE_NAMES[victim.type]} (${toAlg(chosen.tr, chosen.tc)})!${eff === 'power_free_mittens' ? ' (+3t Asimilación 1:1 activa)' : ''}`;
    } else {
      engine.board[currR][currC] = victim;
      engine.board[chosen.tr][chosen.tc] = null;
      sfx = 'waterShot';
      logText = `⛓️💦 ${powerDef.name.toUpperCase()}: Chorro repele a ${PIECE_NAMES[victim.type]} hasta ${toAlg(currR, currC)}!${eff === 'power_free_mittens' ? ' (+3t Asimilación 1:1 activa: tus capturas clonan piezas rivales)' : ''}`;
    }
    engine.lastMoveSquares = [[chosen.fr, chosen.fc], [chosen.tr, chosen.tc]];
  }

  // === 5. GRIETA GLITCH DESTRUCTORA ===
  else if (eff === 'power_glitch_rift' || eff === 'rift_destroy') {
    const victim = engine.board[chosen.tr][chosen.tc];
    engine.board[chosen.tr][chosen.tc] = null;
    capturedBag.push(victim);
    events.destroyed.push([chosen.tr, chosen.tc]);
    powerState.modRifts.push({ r: chosen.tr, c: chosen.tc, turnsLeft: powerDef.duration || 3, owner: side });
    sfx = 'glitchTear';
    engine.lastMoveSquares = [[chosen.tr, chosen.tc]];
    logText = `⚡ ${powerDef.name.toUpperCase()}: Una Grieta Glitch engulle a ${PIECE_NAMES[victim.type]} en ${toAlg(chosen.tr, chosen.tc)} y sella la casilla por ${powerDef.duration || 3} turnos!`;
  }

  // === 6. ZARPA TRAIDORA DE BLACKY / CONTROL MENTAL (ROBO DE FICHA) ===
  else if (eff === 'power_blacky_claw' || eff === 'corrupt_steal') {
    const victim = engine.board[chosen.tr][chosen.tc];
    victim.color = side;
    victim.betrayed = true;
    victim.hasMoved = true;
    delete powerState.frozenPieces[victim.id];
    sfx = 'blackyBetray';
    engine.lastMoveSquares = [[chosen.tr, chosen.tc]];
    logText = `${powerDef.icon || '🐾'} ${powerDef.name.toUpperCase()}: ¡${PIECE_NAMES[victim.type]} en ${toAlg(chosen.tr, chosen.tc)} traiciona al rival y ahora pelea por ti!`;
  }

  // === 7. INVOCACIÓN DE PIEZA CUSTOM ===
  else if (eff === 'summon_piece') {
    const stype = powerDef.summonType || 'N';
    engine.board[chosen.tr][chosen.tc] = {
      id: `sum_${side}_${Date.now()}`,
      color: side,
      type: stype,
      hasMoved: true
    };
    sfx = 'blackySummon';
    engine.lastMoveSquares = [[chosen.tr, chosen.tc]];
    logText = `${powerDef.icon || '🌀'} ${powerDef.name.toUpperCase()}: ¡Invocas un ${PIECE_NAMES[stype]} aliado en ${toAlg(chosen.tr, chosen.tc)}!`;
  }

  powerState.cooldowns[side] = powerDef.cooldown || 3;
  engine.logs.unshift({ turn: engine.turnNumber, type: 'special', text: logText });
  engine.turn = enemy;
  if (side === 'b') engine.turnNumber++;

  // Verificar si el enemigo quedó en jaque mate / ahogado tras el poder
  if (engine.checkMatchOutcome) engine.checkMatchOutcome();

  return { ok: true, events, logText, sfx };
}

/**
 * Si un jugador tiene activa la Asimilación 1:1 de Free Mittens y captura una pieza rival,
 * clona la pieza capturada exactamente en su casilla de origen (fr, fc)!
 */
export function applyMittensAssimilationIfActive(engine, powerState, side, fr, fc, capturedPiece) {
  if (!engine || !powerState || !capturedPiece || capturedPiece.type === 'K') return null;
  if ((powerState.assimilationTurns?.[side] || 0) <= 0) return null;
  if (engine.board[fr]?.[fc]) return null;
  const clone = {
    id: `mit_clone_${side}_${Date.now()}_${Math.floor(Math.random() * 999)}`,
    color: side,
    type: capturedPiece.type,
    hasMoved: true
  };
  engine.board[fr][fc] = clone;
  engine.logs.unshift({
    turn: engine.turnNumber,
    type: 'special',
    text: `⛓️ ASIMILACIÓN DE FREE MITTENS (1:1): El ${PIECE_NAMES[capturedPiece.type]} capturado renace como aliado en ${toAlg(fr, fc)}!`
  });
  return clone;
}

/**
 * Decrementa cooldowns, congelaciones, grietas, unidades 2×2 y buffs al terminar un turno.
 */
export function tickPowerStateForSide(powerState, finishedSide) {
  if (!powerState) return;
  if (powerState.cooldowns[finishedSide] > 0) powerState.cooldowns[finishedSide]--;
  if (powerState.assimilationTurns[finishedSide] > 0) powerState.assimilationTurns[finishedSide]--;

  // Decrementar congelaciones de las piezas del bando que acaba de pasar turno
  // (en 1 jugador llamamos tras turno enemigo; en online llamamos tras cada turno)
  for (const id of Object.keys(powerState.frozenPieces)) {
    powerState.frozenPieces[id]--;
    if (powerState.frozenPieces[id] <= 0) delete powerState.frozenPieces[id];
  }

  powerState.modRifts = (powerState.modRifts || [])
    .map((rf) => ({ ...rf, turnsLeft: rf.turnsLeft - 1 }))
    .filter((rf) => rf.turnsLeft > 0);

  powerState.giantUnits = (powerState.giantUnits || [])
    .map((g) => (g.owner === finishedSide ? { ...g, turnsLeft: g.turnsLeft - 1 } : g))
    .filter((g) => g.turnsLeft > 0);
}
