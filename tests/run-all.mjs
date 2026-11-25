import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as ioClient } from 'socket.io-client';

import { ClassicChessEngine } from '../shared/rules/classicEngine.js';
import { MayaBossEngine } from '../shared/rules/mayaEngine.js';
import { MayaCampaignEngine } from '../shared/rules/mayaCampaignEngine.js';
import { FreeMittensEngine } from '../shared/rules/mittensEngine.js';
import { GalaxyEngine } from '../shared/rules/galaxyEngine.js';
import { GlitchEngine } from '../shared/rules/glitchEngine.js';
import { ChessFinalEngine } from '../shared/rules/chessFinalEngine.js';
import { BlackySecretEngine } from '../shared/rules/blackyEngine.js';
import { SuperChessAI } from '../shared/ai/superChessAI.js';
import {
  MAYA_CAMPAIGN,
  MITTENS_CAMPAIGN,
  GALAXY_CAMPAIGN,
  GLITCH_CAMPAIGN,
  CHESS_CAMPAIGN,
  CHAPTER_ORDER
} from '../shared/config/campaigns.js';
import { calculateEloUpdate } from '../shared/config/elo.js';
import { INITIAL_ELO } from '../shared/config/constants.js';
import { createChessServer } from '../server/index.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}\n     ${err.stack || err.message}`);
  }
}

console.log('\n=== CHESS.MOD — SUITE DE PRUEBAS AUTOMATIZADAS (5 CAPÍTULOS + ELO 0 + SÚPER IA + ONLINE) ===\n');

// 1. ELO DESDE 0 + FÓRMULA REAL DE AJEDREZ
await test('Elo desde 0: inicial 0, K dinámico (40/32/24), nunca baja de 0 y upset premia más', () => {
  assert.equal(INITIAL_ELO, 0);

  // Dos novatos en 0 Elo (gamesPlayed < 20 -> K = 40): victoria da +20, derrota se queda en 0
  const debut = calculateEloUpdate(0, 0, 'w', { whiteGames: 0, blackGames: 0 });
  assert.equal(debut.kWhite, 40);
  assert.equal(debut.whiteAfter, 20);
  assert.equal(debut.blackAfter, 0, 'El Elo nunca debe bajar de 0');

  // Empate 0 vs 0 -> 0 y 0
  const dr = calculateEloUpdate(0, 0, 'draw', { whiteGames: 0, blackGames: 0 });
  assert.equal(dr.whiteAfter, 0);
  assert.equal(dr.blackAfter, 0);

  // K normal (32) tras 20 partidas
  const mid = calculateEloUpdate(1000, 1000, 'w', { whiteGames: 25, blackGames: 25 });
  assert.equal(mid.kWhite, 32);
  assert.equal(mid.whiteDelta, 16);
  assert.equal(mid.blackDelta, -16);

  // K maestro (24) en Elo >= 1800
  const pro = calculateEloUpdate(1900, 1900, 'w', { whiteGames: 60, blackGames: 60 });
  assert.equal(pro.kWhite, 24);
  assert.equal(pro.whiteDelta, 12);

  // Upset (ganar a rival mucho más fuerte da mayor ganancia)
  const upset = calculateEloUpdate(200, 800, 'w', { whiteGames: 5, blackGames: 30 });
  assert.ok(upset.whiteDelta >= 35, `Ganar un upset con K=40 debe dar >=35 (dio ${upset.whiteDelta})`);
});

// 2. AJEDREZ CLÁSICO
await test('Ajedrez clásico: 16v16, validación legal/ilegal y jaque mate', () => {
  const e = new ClassicChessEngine(10);
  assert.equal(e.countPieces('w'), 16);
  assert.equal(e.countPieces('b'), 16);
  assert.equal(e.validateAndExecuteMove(6, 4, 4, 4).ok, true);
  assert.equal(e.validateAndExecuteMove(6, 0, 5, 0).ok, false);
  assert.equal(e.validateAndExecuteMove(1, 4, 3, 4).ok, true);

  const f = new ClassicChessEngine(10);
  assert.equal(f.validateAndExecuteMove(6, 5, 5, 5).ok, true);
  assert.equal(f.validateAndExecuteMove(1, 4, 3, 4).ok, true);
  assert.equal(f.validateAndExecuteMove(6, 6, 4, 6).ok, true);
  assert.equal(f.validateAndExecuteMove(0, 3, 4, 7).ok, true);
  assert.equal(f.winner, 'b');
});

// 3. ESTRUCTURA DE 5 CAPÍTULOS (25 NIVELES)
await test('Modo Historia: 5 capítulos en orden exacto (25 niveles totales)', () => {
  assert.deepEqual(CHAPTER_ORDER, ['maya', 'mittens', 'galaxy', 'glitch', 'chess']);
  assert.equal(MAYA_CAMPAIGN.levels.length, 5);
  assert.equal(MITTENS_CAMPAIGN.levels.length, 5);
  assert.equal(GALAXY_CAMPAIGN.levels.length, 5);
  assert.equal(GLITCH_CAMPAIGN.levels.length, 5);
  assert.equal(CHESS_CAMPAIGN.levels.length, 5);
  assert.deepEqual(
    MITTENS_CAMPAIGN.levels.map((l) => l.name),
    ['Hombre Peón', 'Hombre Caballo', 'Hombre Alfil', 'Mujer Reina', 'Free Mittens']
  );
  assert.equal(MITTENS_CAMPAIGN.levels[4].isFinalBoss, true);
  assert.equal(CHESS_CAMPAIGN.levels[4].isFinalBoss, true);
  assert.equal(CHESS_CAMPAIGN.levels[4].requiresPowerChoice, true);
});

// 4. CAPÍTULO 1 — DIOS MAYA (NIVELES 1-4 SIN PIRÁMIDE + NIVEL 5 EXCLUSIVO)
await test('Cap. 1 Maya: Pirámide 2×2 exclusiva Nivel 5 + Arqueras, Escuderos, Jaguares, Chamanes y Casas', () => {
  for (let lvl = 1; lvl <= 4; lvl++) {
    const eng = new MayaCampaignEngine(lvl);
    assert.equal(eng.hasPyramid, false);
  }

  // Nivel 1: Arquera ataca a distancia sin moverse
  const e1 = new MayaCampaignEngine(1);
  e1.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  e1.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  e1.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  e1.board[2][1] = { id: 'bA', color: 'b', type: 'A' };
  e1.board[5][4] = { id: 'wN', color: 'w', type: 'N' };
  e1.turn = 'b';
  const aMoves = e1.getLegalMovesForPiece(2, 1);
  assert.equal(aMoves.length, 1);
  assert.equal(aMoves[0].isRangedAttack, true);
  e1.executeMove(aMoves[0], 'Q', false);
  assert.equal(e1.board[2][1]?.type, 'A');
  assert.equal(e1.board[5][4], null);

  // Nivel 5: Rey Maya (18 blancas con 2 Casas, 16 negras con 4 Bases, Pirámide 2×2)
  const e5 = new MayaBossEngine(10);
  assert.equal(e5.countPieces('w'), 18);
  assert.equal(e5.countPieces('b'), 16);
  assert.equal(e5.countAliveBases(), 4);
  e5.board[4][2] = { id: 'wP_adj', color: 'w', type: 'P' };
  assert.equal(e5.isProtectedByCasa(4, 2), true);
  const pyrMoves = e5.getPyramidLegalMoves();
  assert.equal(pyrMoves.some((m) => e5.getPyramidCells(m.nr, m.nc).some(([r, c]) => r === 4 && c === 2)), false);
});

// 5. CAPÍTULO 2 — CONVERSIÓN EXACTA POR TIPO DE PIEZA (MINIJEFES 1-4 + FREE MITTENS)
await test('Cap. 2 Mittens: Hombre Peón/Caballo/Alfil solo transforman su tipo exacto; Mujer Reina asimila sin perder rango', () => {
  // Nivel 1: Hombre Peón -> SOLO Peón transforma
  const hp = new FreeMittensEngine('hombre_peon');
  hp.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  hp.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  hp.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  hp.board[3][2] = { id: 'bP1', color: 'b', type: 'P' };
  hp.board[4][3] = { id: 'wQ1', color: 'w', type: 'Q' };
  hp.board[2][6] = { id: 'bR1', color: 'b', type: 'R' };
  hp.board[5][6] = { id: 'wB1', color: 'w', type: 'B' };
  hp.turn = 'b';
  const evP = hp.executeMove({ fr: 3, fc: 2, tr: 4, tc: 3 }, 'Q', false);
  assert.ok(evP.converted, 'Peón en Hombre Peón DEBE transformarse al capturar');
  assert.equal(hp.board[4][3]?.type, 'Q', 'Peón que capturó Reina se convierte en Reina');

  hp.turn = 'b';
  const evR = hp.executeMove({ fr: 2, fc: 6, tr: 5, tc: 6 }, 'Q', false);
  assert.equal(evR.converted, null, 'Torre en Hombre Peón NO debe transformarse');
  assert.equal(hp.board[5][6]?.type, 'R');

  // Nivel 2: Hombre Caballo -> SOLO Caballo transforma
  const hc = new FreeMittensEngine('hombre_caballo');
  hc.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  hc.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  hc.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  hc.board[2][2] = { id: 'bN1', color: 'b', type: 'N' };
  hc.board[4][3] = { id: 'wR1', color: 'w', type: 'R' };
  hc.turn = 'b';
  const evN = hc.executeMove({ fr: 2, fc: 2, tr: 4, tc: 3 }, 'Q', false);
  assert.ok(evN.converted);
  assert.equal(hc.board[4][3]?.type, 'R', 'Caballo que capturó Torre se convierte en Torre');

  // Nivel 3: Hombre Alfil -> SOLO Alfil transforma
  const ha = new FreeMittensEngine('hombre_alfil');
  ha.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  ha.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  ha.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  ha.board[2][2] = { id: 'bB1', color: 'b', type: 'B' };
  ha.board[4][4] = { id: 'wN1', color: 'w', type: 'N' };
  ha.turn = 'b';
  const evB = ha.executeMove({ fr: 2, fc: 2, tr: 4, tc: 4 }, 'Q', false);
  assert.ok(evB.converted);
  assert.equal(ha.board[4][4]?.type, 'N', 'Alfil que capturó Caballo se convierte en Caballo');

  // Nivel 4: Mujer Reina -> conserva rango de Reina y asimila pieza exacta en origen
  const mr = new FreeMittensEngine('mujer_reina');
  mr.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  mr.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  mr.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  mr.board[2][3] = { id: 'bQ1', color: 'b', type: 'Q' };
  mr.board[4][3] = { id: 'wR1', color: 'w', type: 'R' };
  mr.turn = 'b';
  const evQ = mr.executeMove({ fr: 2, fc: 3, tr: 4, tc: 3 }, 'Q', false);
  assert.ok(evQ.converted);
  assert.equal(mr.board[4][3]?.type, 'Q', 'Mujer Reina conserva su rango de Reina');
  assert.equal(mr.board[2][3]?.type, 'R', 'Asimila la pieza exacta capturada (Torre) en su origen');
});

await test('Cap. 2 Nivel 5 Free Mittens: conversión 1:1 en todas las piezas + 3 Soldados agua + Aspersor', () => {
  for (const pieceType of ['P', 'N', 'B', 'R', 'Q']) {
    const e = new FreeMittensEngine('free_mittens');
    e.board[3][5] = { id: 'atkR', color: 'b', type: 'R' };
    e.board[4][5] = { id: `vic_${pieceType}`, color: 'w', type: pieceType };
    e.turn = 'b';
    const ev = e.executeMove({ fr: 3, fc: 5, tr: 4, tc: 5 }, 'Q', false);
    assert.ok(ev.converted);
    assert.equal(ev.converted.newType, pieceType);
    assert.equal(e.board[3][5]?.type, pieceType);
  }

  const fm = new FreeMittensEngine('free_mittens');
  assert.equal(fm.countAliveSoldiers(), 3);
  assert.equal(fm.isSprinkler(4, 3), true);
  fm.board[4][1] = { id: 'mN_test', color: 'b', type: 'N' };
  const shot = fm.getLegalWaterShotsForSoldier(6, 1).find((s) => s.tr === 4 && s.tc === 1);
  assert.ok(shot);
  const ev = fm.executeMove(shot, 'Q', false);
  assert.equal(ev.isWaterShot, true);
  assert.equal(ev.displaced, true);
  assert.equal(fm.board[6][1]?.isSoldier, true);
  assert.equal(fm.board[3][1]?.id, 'mN_test');
});

// 6. CAPÍTULO 3 — ENTIDAD GALÁCTICA
await test('Cap. 3 Entidad Galáctica: Hombre Galaxia 2×2 (como Torre), Barrera Universal inmune/escudo, Teletransporte y Clímax Mittens', () => {
  const g = new GalaxyEngine(5, 10);
  assert.equal(g.hasGalaxyMan, true);
  assert.equal(g.countAliveAnchors(), 4, 'Inicia con 2 Alfiles + 2 Caballos galácticos');
  assert.equal(g.board[5][2]?.type, 'U');
  assert.equal(g.board[5][5]?.type, 'U');

  // Hombre Galaxia 2×2 solo se mueve ortogonalmente como Torre (nunca diagonal)
  const gMoves = g.getGalaxyManLegalMoves();
  assert.ok(gMoves.length > 0, 'Hombre Galaxia debe tener movimientos ortogonales iniciales');
  assert.ok(gMoves.every((m) => (m.dr === 0 && m.dc !== 0) || (m.dc === 0 && m.dr !== 0)), 'Solo movimientos ortogonales tipo Torre');

  // Barrera Universal protege pieza adyacente del aplastamiento 2×2, pero NO de capturas normales
  g.board[4][2] = { id: 'wN_adj', color: 'w', type: 'N' };
  assert.equal(g.isProtectedByBarrier(4, 2), true);
  const gMovesWithShield = g.getGalaxyManLegalMoves();
  assert.equal(
    gMovesWithShield.some((m) => g.getGalaxyManCells(m.nr, m.nc).some(([r, c]) => r === 4 && c === 2)),
    false,
    'Hombre Galaxia no puede aplastar pieza protegida por Barrera Universal'
  );
  // Pieza negra normal SÍ puede capturar a la pieza adyacente a la Barrera
  g.board[4][0] = { id: 'bR_norm', color: 'b', type: 'R' };
  g.turn = 'b';
  const rMoves = g.getLegalMovesForPiece(4, 0);
  assert.equal(rMoves.some((m) => m.tr === 4 && m.tc === 2), true, 'Captura normal sí afecta a pieza adyacente a Barrera');
  // Pero la Barrera misma (5,2) NO puede ser capturada
  g.board[5][0] = { id: 'bR_bar', color: 'b', type: 'R' };
  assert.equal(g.getLegalMovesForPiece(5, 0).some((m) => m.tr === 5 && m.tc === 2), false, 'Barrera Universal es inmune');

  // Teletransporte Galáctico cuando cooldown === 0
  g.teleportCooldown = 0;
  const teleMoves = g.getTeleportMoves();
  assert.ok(teleMoves.length > 0, 'Debe ofrecer teletransportes legales cuando cooldown=0');
  const teleEv = g.executeMove(teleMoves[0], 'Q', false);
  assert.equal(teleEv.isTeleport, true);
  assert.equal(g.teleportCooldown, g.teleportMaxCooldown);

  // Condición de derrota del Hombre Galaxia: eliminar TODOS los Alfiles y Caballos dispara Clímax Free Mittens
  const gWin = new GalaxyEngine(5, 10);
  // Quitar 3 anclas y dejar 1 solo Caballo enemigo capturable
  gWin.board[0][1] = null;
  gWin.board[0][2] = null;
  gWin.board[0][5] = null;
  gWin.board[1][6] = null; // despejar columna g
  gWin.board[2][6] = { id: 'wR_fin', color: 'w', type: 'R' };
  gWin.turn = 'w';
  assert.equal(gWin.countAliveAnchors(), 1);
  const evClimax = gWin.executeMove({ fr: 2, fc: 6, tr: 0, tc: 6 }, 'Q', false);
  assert.equal(evClimax.mittensClimax, true);
  assert.equal(gWin.mittensClimaxTriggered, true);
  assert.equal(gWin.winner, 'w');
});

// 7. CAPÍTULO 4 — BOSS GLITCH (GRIETAS + ANOMALÍAS)
await test('Cap. 4 Boss Glitch: Grietas de Vacío bloquean paso + anomalías de peón/caballo + Fury Swap sin romper invariantes', () => {
  const gl = new GlitchEngine(5, 10);
  const created = gl.tearBoardRifts(3);
  assert.equal(created.length, 3);
  const rift = created[0];
  assert.equal(gl.isRift(rift.r, rift.c), true);

  // Ninguna pieza puede entrar a una grieta
  gl.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  gl.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  gl.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  gl.rifts = [{ r: 4, c: 3, turnsLeft: 3 }];
  gl.board[4][0] = { id: 'wR', color: 'w', type: 'R' };
  gl.turn = 'w';
  const rMoves = gl.getLegalMovesForPiece(4, 0);
  assert.equal(rMoves.some((m) => m.tr === 4 && m.tc >= 3), false, 'Torre no puede cruzar ni caer en una Grieta');

  // Peón corrupto ataca recto hacia adelante y retrocede 1 casilla vacía
  gl.board[2][5] = { id: 'xP', color: 'b', type: 'P' };
  gl.board[3][5] = { id: 'wP', color: 'w', type: 'P' };
  gl.turn = 'b';
  const pMoves = gl.getLegalMovesForPiece(2, 5);
  assert.equal(pMoves.some((m) => m.tr === 3 && m.tc === 5 && m.isAnomaly), true, 'Peón corrupto ataca recto');
  assert.equal(pMoves.some((m) => m.tr === 1 && m.tc === 5 && m.isAnomaly), true, 'Peón corrupto retrocede');

  // Fury Swap válido cuando cooldown === 0
  gl.board[0][0] = { id: 'xR', color: 'b', type: 'R' };
  gl.board[0][3] = { id: 'xQ', color: 'b', type: 'Q' };
  gl.swapCooldown = 0;
  const swaps = gl.getFurySwapMoves();
  assert.ok(swaps.length > 0, 'Boss Glitch debe generar Fury Swaps legales');
  gl.executeMove(swaps[0], 'Q', false);
  assert.ok(gl.findKing('b'), 'El Rey negro permanece intacto');
  assert.ok(gl.findKing('w'), 'El Rey blanco permanece intacto');
});

// 8. CAPÍTULO 5 — CHESS (3 PODERES DEL JUGADOR + SÚPER IA PURA)
await test('Cap. 5 CHESS: 3 poderes seleccionables (Mittens, Torre Maya, Galaxia) + Súper IA Alpha-Beta rápida y legal', () => {
  // Poder 1: Mittens
  const cM = new ChessFinalEngine(5, 'mittens', 10);
  assert.equal(cM.board[6][1]?.isSoldier, true);
  assert.equal(cM.board[6][3]?.isSoldier, true);
  assert.equal(cM.board[6][6]?.isSoldier, true);

  // Poder 2: Torre del Dios Maya
  const cMaya = new ChessFinalEngine(5, 'maya', 10);
  assert.equal(cMaya.board[5][2]?.type, 'H');
  assert.equal(cMaya.board[5][5]?.type, 'H');
  assert.equal(cMaya.board[5][3]?.isSacredMayaRook, true);

  // Poder 3: Galaxia (2 Barreras + Teletransporte activo del jugador)
  const cGal = new ChessFinalEngine(5, 'galaxy', 10);
  assert.equal(cGal.board[5][2]?.type, 'U');
  assert.equal(cGal.board[5][5]?.type, 'U');
  const teleTargets = cGal.getPlayerTeleportTargets(7, 1); // Caballo b1
  assert.ok(teleTargets.length > 10, 'Teletransporte del jugador debe ofrecer casillas vacías');
  const tEv = cGal.executeMove(teleTargets[0], 'Q', false);
  assert.equal(tEv.isPlayerTeleport, true);
  assert.equal(cGal.playerTeleportCooldown, 3);

  // Súper IA en posición táctica (encuentra captura ganadora de Dama limpia)
  const ai = new SuperChessAI();
  const cPure = new ChessFinalEngine(4, null, 10);
  // Libro de aperturas tras e2->e4
  cPure.executeMove({ fr: 6, fc: 4, tr: 4, tc: 4 }, 'Q', false);
  const bookRes = ai.chooseBestMove(cPure.cloneState(), { maxDepth: 4, thinkTimeMs: 400, color: 'b' });
  assert.ok(bookRes && bookRes.move, 'Súper IA debe responder legalmente en turno 1');
  assert.equal(bookRes.book, true, 'Debe utilizar libro de aperturas ante 1.e4');

  // Posición táctica donde Dama blanca está colgada en d4 y Alfil negro c5/Dama d8 puede comerla
  const tac = new ChessFinalEngine(5, 'mittens', 10);
  tac.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  tac.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  tac.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  tac.board[0][3] = { id: 'bR', color: 'b', type: 'R' };
  tac.board[4][3] = { id: 'wQ', color: 'w', type: 'Q' }; // Dama blanca gratis en d4
  tac.turn = 'b';
  tac.turnNumber = 10;
  const t0 = performance.now();
  const best = ai.chooseBestMove(tac.cloneState(), { maxDepth: 4, thinkTimeMs: 450, color: 'b' });
  const elapsed = performance.now() - t0;
  assert.ok(best && best.move);
  assert.equal(best.move.tr, 4);
  assert.equal(best.move.tc, 3, 'Súper IA debe capturar la Dama indefensa en d4');
  assert.ok(elapsed < 1500, `Súper IA debe responder rápido (${Math.round(elapsed)}ms)`);
});

// 8b. BALANCE DEL MODO HISTORIA (PROGRESIÓN FÁCIL→DIFÍCIL + DEFENSAS CAP 1-4 + CAP 5 LIMPIO)
await test('Modo Historia balanceado: defensas en Cap. 1-4, progresión gradual y Cap. 5 (CHESS) 100% limpio', () => {
  // Cap. 1 Maya: Lv1 sin Dama negra + 1 Casa en d3 que bloquea flechas de Arquera
  const m1 = new MayaCampaignEngine(1);
  assert.equal(m1.board[0][3], null, 'Maya Lv1 no debe tener Dama enemiga');
  assert.equal(m1.board[5][3]?.type, 'H', 'Maya Lv1 otorga 1 Casa Inmortal en d3');
  m1.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  m1.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
  m1.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
  m1.board[2][1] = { id: 'bA', color: 'b', type: 'A' };
  m1.board[5][4] = { id: 'wN', color: 'w', type: 'N' };
  m1.board[5][3] = { id: 'wH1', color: 'w', type: 'H' }; // Casa junto al Caballo en (5,4)
  assert.equal(m1.isProtectedByCasa(5, 4), true);
  assert.equal(m1.getLegalMovesForPiece(2, 1).length, 0, 'Arquera no puede disparar a pieza escudada por Casa');

  // Cap. 2 Mittens: Soldados de Agua en Lv1-4 y Mujer Reina con solo 1 Reina
  const mit1 = new FreeMittensEngine('hombre_peon');
  assert.equal(mit1.countAliveSoldiers(), 2, 'Hombre Peón da 2 Soldados Blancos de defensa');
  const mit4 = new FreeMittensEngine('mujer_reina');
  let blackQueens = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (mit4.board[r][c]?.color === 'b' && mit4.board[r][c]?.type === 'Q') blackQueens++;
  assert.equal(blackQueens, 1, 'Mujer Reina debe tener 1 Reina, no 2');
  assert.equal(mit4.countAliveSoldiers(), 3, 'Mujer Reina da 3 Soldados Blancos');

  // Cap. 3 Galaxy: Barrera bloquea teletransportes adyacentes
  const g1 = new GalaxyEngine(1);
  g1.teleportCooldown = 0;
  const g1Tp = g1.getTeleportMoves();
  assert.equal(g1Tp.some((m) => g1.isAdjacentToBarrier(m.tr, m.tc)), false, 'Teletransporte no puede caer adyacente a Barrera Universal');

  // Cap. 4 Glitch: 2 Cortafuegos (U) sellan Grietas al pisarlas y bloquean anomalías adyacentes
  const gl2 = new GlitchEngine(2);
  assert.equal(gl2.board[5][2]?.type, 'U', 'Glitch otorga Cortafuegos en c3');
  assert.equal(gl2.board[5][5]?.type, 'U', 'Glitch otorga Cortafuegos en f3');
  gl2.rifts = [{ r: 4, c: 2, turnsLeft: 3 }];
  const sealMove = gl2.getLegalMovesForPiece(5, 2).find((m) => m.tr === 4 && m.tc === 2);
  assert.ok(sealMove && sealMove.sealsRift, 'Cortafuegos puede pisar una Grieta adyacente para sellarla');
  const sealEv = gl2.executeMove(sealMove, 'Q', false);
  assert.equal(sealEv.riftSealed, true);
  assert.equal(gl2.isRift(4, 2), false, 'La Grieta queda sellada tras pisarla el Cortafuegos');

  // Cap. 5 CHESS niveles 1-4: 100% limpio (16v16 sin Casas, Barreras ni Soldados)
  for (let lv = 1; lv <= 4; lv++) {
    const ch = new ChessFinalEngine(lv, null, 10);
    assert.equal(ch.countPieces('w'), 16, `CHESS Lv${lv} debe ser 100% limpio (16 blancas)`);
    assert.equal(ch.countPieces('b'), 16, `CHESS Lv${lv} debe ser 100% limpio (16 negras)`);
    assert.equal(ch.playerPower, null, `CHESS Lv${lv} no debe equipar poderes extra`);
  }
});

// 9. SERVIDOR REAL + /health + ELO 0 + DESBLOQUEO ESTRICTO DE CAMPAÑA + MULTIJUGADOR ONLINE SOCKET.IO
const tmpDb = path.join(os.tmpdir(), `chess_mod_test_${Date.now()}.sqlite`);
const server = createChessServer({ port: 0, dbPath: tmpDb });
const { url } = await server.start();

try {
  let aliceToken = '';
  let bobToken = '';

  await test('GET /health responde 200 healthy + driver DB activo y assets (audios + logo + mittens_ref) sirven 200', async () => {
    const h = await fetch(`${url}/health`);
    assert.equal(h.status, 200);
    const hj = await h.json();
    assert.equal(hj.ok, true);
    assert.equal(hj.status, 'healthy');
    assert.equal(hj.db, 'sqlite');

    const mp3 = await fetch(`${url}/assets/audio/Ultimate%20Battle.mp3`);
    assert.equal(mp3.status, 200);
    assert.ok((await mp3.arrayBuffer()).byteLength > 2_000_000);

    const mp3Mittens = await fetch(`${url}/assets/audio/FreeMittensBattle.mp3`);
    assert.equal(mp3Mittens.status, 200);
    assert.ok((await mp3Mittens.arrayBuffer()).byteLength > 2_000_000);

    const logo = await fetch(`${url}/assets/images/chess_mod_logo.jpg`);
    assert.equal(logo.status, 200);
    assert.ok((await logo.arrayBuffer()).byteLength > 50_000);

    const glitchTex = await fetch(`${url}/assets/images/glitch_texture.jpg`);
    assert.equal(glitchTex.status, 200);
    assert.ok((await glitchTex.arrayBuffer()).byteLength > 20_000);

    const blackyMp3 = await fetch(`${url}/assets/audio/BlackyBattle.mp3`);
    assert.equal(blackyMp3.status, 200);
    assert.ok((await blackyMp3.arrayBuffer()).byteLength > 2_000_000);

    for (const track of ['MayaCampaignBattle.mp3', 'GalaxyBattle.mp3', 'GlitchBattle.mp3', 'ChessBattle.mp3']) {
      const rTrack = await fetch(`${url}/assets/audio/${track}`);
      assert.equal(rTrack.status, 200, `${track} debe servir 200`);
      assert.ok((await rTrack.arrayBuffer()).byteLength > 1_500_000, `${track} debe contener audio MP3 real`);
    }

    const blackyImg = await fetch(`${url}/assets/images/blacky_ref.jpg`);
    assert.equal(blackyImg.status, 200);
    assert.ok((await blackyImg.arrayBuffer()).byteLength > 20_000);

    // Ruta secreta /blacky debe servir index.html HTTP 200 (nunca 404)
    const blackyRoute = await fetch(`${url}/blacky`);
    assert.equal(blackyRoute.status, 200);
    assert.ok((await blackyRoute.text()).includes('CHESS.MOD'));

    const img = await fetch(`${url}/assets/images/mittens_ref.png`);
    assert.equal(img.status, 200);
    assert.ok((await img.arrayBuffer()).byteLength > 50_000);
  });

  await test('Boss Secreto BLACKY (Imposible): 4 poderes caóticos (Sello, Invocación, Absorción respetando Rey, Traición) + recompensa secreta', async () => {
    const bk = new BlackySecretEngine(10);

    // 1. Sello de Zarpa Sombría deshabilita 3 casillas y bloquea piezas blancas
    const sealed = bk.sealBoardSquares(3);
    assert.equal(sealed.length, 3);
    assert.equal(bk.isSealed(sealed[0].r, sealed[0].c), true);
    bk.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    bk.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
    bk.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
    bk.board[4][0] = { id: 'wR', color: 'w', type: 'R' };
    bk.sealedSquares = [{ r: 4, c: 3, turnsLeft: 5 }];
    assert.equal(bk.getLegalMovesForPiece(4, 0).some((m) => m.tr === 4 && m.tc >= 3), false, 'Pieza blanca no puede cruzar casillero sellado');

    // 2. Invocación del Vacío crea pieza negra de la nada
    const beforeB = bk.countPieces('b');
    const sum = bk.summonPieceFromVoid();
    assert.ok(sum && bk.board[sum.r][sum.c]?.color === 'b');
    assert.equal(bk.countPieces('b'), beforeB + 1);

    // 3. Absorción Sombría elimina pieza blanca no-Rey (nunca absorbe al Rey)
    bk.board[5][2] = { id: 'wQ_abs', color: 'w', type: 'Q' };
    const abs = bk.absorbWhitePiece();
    assert.ok(abs && abs.piece.type === 'Q', 'Absorción prioriza Dama y jamás absorbe al Rey');
    assert.equal(bk.board[5][2], null);
    assert.ok(bk.findKing('w'), 'El Rey blanco permanece intacto');
    // Si solo queda el Rey blanco, absorbWhitePiece() devuelve null
    bk.board[4][0] = null;
    assert.equal(bk.absorbWhitePiece(), null, 'Nunca absorbe al Rey blanco');

    // 4. Traición convierte una pieza blanca en negra en su misma casilla (nunca al Rey)
    bk.board[5][6] = { id: 'wN_bet', color: 'w', type: 'N' };
    const bet = bk.corruptWhitePiece();
    assert.ok(bet && bk.board[5][6]?.color === 'b' && bk.board[5][6]?.betrayed === true);
    assert.ok(bk.findKing('w'), 'El Rey blanco nunca es corrompido');

    // 5. Recompensa secreta en servidor al vencer a BLACKY
    const regB = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'DomadorTest', email: 'domador@chessmod.test', password: 'Password123' })
    });
    const { token: dToken } = await regB.json();
    const repB = await fetch(`${url}/api/game/report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'blacky', opponentName: 'BLACKY (Imposible)', winner: 'w', turns: 22 })
    });
    assert.equal(repB.status, 200);
    const repData = await repB.json();
    assert.equal(repData.unlockedExclusive, 'Domador de Blacky (Imposible)');
    assert.equal(repData.xpGained, 1500);
  });

  await test('Regla estricta de JAQUE MATE: nunca se mata al Rey, jaque simple no gana, ahogado es tablas y jaque mate gana', () => {
    // 1. Jaque simple en Free Mittens NO gana, ni permite capturar el Rey
    const fm = new FreeMittensEngine('free_mittens');
    fm.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    fm.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
    fm.board[7][4] = { id: 'wK', color: 'w', type: 'K' };
    fm.board[2][4] = { id: 'wR', color: 'w', type: 'R' }; // Torre blanca dando jaque al Rey negro en e8
    fm.turn = 'w';
    assert.equal(fm.getLegalMovesForPiece(2, 4).some((m) => m.tr === 0 && m.tc === 4), false, 'Nunca debe ser legal capturar al Rey');

    // Mover torre a dar jaque simple (e8 tiene escape d8/f8) -> NO termina partida
    fm.board[2][4] = null;
    fm.board[2][3] = { id: 'wR', color: 'w', type: 'R' };
    fm.executeMove({ fr: 2, fc: 3, tr: 2, tc: 4 }, 'Q', false);
    assert.equal(fm.isKingInCheck('b'), true, 'Debe estar en jaque');
    assert.equal(fm.winner, null, 'Solo jaque NO gana la partida');

    // 2. Jaque Mate real (dos torres dando mate en pasillo a Rey negro en a8) -> SÍ gana
    const fmMate = new FreeMittensEngine('free_mittens');
    fmMate.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    fmMate.board[0][0] = { id: 'bK', color: 'b', type: 'K' };
    fmMate.board[7][7] = { id: 'wK', color: 'w', type: 'K' };
    fmMate.board[1][6] = { id: 'wR1', color: 'w', type: 'R' };
    fmMate.board[2][5] = { id: 'wR2', color: 'w', type: 'R' };
    fmMate.turn = 'w';
    fmMate.executeMove({ fr: 2, fc: 5, tr: 0, tc: 5 }, 'Q', false);
    assert.equal(fmMate.winner, 'w', 'Jaque mate real SÍ otorga la victoria');

    // 3. Ahogado (sin jaque y sin jugadas legales) -> TABLAS ('draw'), NO victoria
    const fmStale = new FreeMittensEngine('free_mittens');
    fmStale.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    fmStale.board[0][0] = { id: 'bK', color: 'b', type: 'K' };
    fmStale.board[7][7] = { id: 'wK', color: 'w', type: 'K' };
    fmStale.board[2][2] = { id: 'wQ', color: 'w', type: 'Q' };
    fmStale.turn = 'w';
    fmStale.executeMove({ fr: 2, fc: 2, tr: 2, tc: 1 }, 'Q', false); // Qb6 ahoga Rey en a8 sin jaque
    assert.equal(fmStale.isKingInCheck('b'), false);
    assert.equal(fmStale.winner, 'draw', 'Ahogado sin jaque debe ser tablas, no victoria');

    // 4. Pirámide 2×2 Maya NO puede aplastar al Rey blanco ni ignorar jaque al Rey negro
    const maya = new MayaBossEngine(10);
    maya.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    maya.board[0][4] = { id: 'bK', color: 'b', type: 'K' };
    maya.board[4][4] = { id: 'wK', color: 'w', type: 'K' };
    maya.pyramid = { r: 2, c: 2, disabledTurns: 0, destroyed: false };
    // Pirámide no puede ocupar (3,3) porque aplastaría al Rey blanco en (4,4)
    assert.equal(maya.canPyramidOccupy(3, 3), false, 'Pirámide jamás puede aplastar al Rey blanco');
    // Si el Rey negro está en jaque por Torre en (0,0), la Pirámide en (2,2) SOLO tiene 1 jugada legal: aplastar esa Torre en (0,0)
    maya.board[0][0] = { id: 'wR_chk', color: 'w', type: 'R' };
    assert.equal(maya.isKingInCheck('b'), true);
    const saveMoves = maya.getPyramidLegalMoves();
    assert.equal(saveMoves.length, 1, 'Pirámide solo puede moverse si resuelve el jaque (aplastando a la Torre en 0,0)');
    assert.equal(saveMoves[0].nr, 0);
    assert.equal(saveMoves[0].nc, 0);

    // Si el Rey negro está en jaque por un Caballo inalcanzable en (2,5), la Pirámide en (4,0) NO tiene jugadas legales
    maya.board[0][0] = null;
    maya.board[2][5] = { id: 'wN_chk', color: 'w', type: 'N' };
    maya.pyramid = { r: 4, c: 0, disabledTurns: 0, destroyed: false };
    assert.equal(maya.isKingInCheck('b'), true);
    assert.equal(maya.getPyramidLegalMoves().length, 0, 'Pirámide no puede moverse si deja al Rey negro en jaque');
  });

  await test('Registro inicia en 0 Elo (50 XP) y descuento REAL de 25 XP por Pista', async () => {
    const r1 = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'AliceMaya', email: 'alice@chessmod.test', password: 'Password123' })
    });
    assert.equal(r1.status, 201);
    const d1 = await r1.json();
    aliceToken = d1.token;
    assert.equal(d1.user.elo, 0, 'Todo jugador nuevo empieza con 0 Elo');
    assert.equal(d1.user.xp, 50);

    const r2 = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'BobMittens', email: 'bob@chessmod.test', password: 'Password123' })
    });
    assert.equal(r2.status, 201);
    bobToken = (await r2.json()).token;

    // 2 pistas de 25 XP agotan 50 XP y la 3ra se bloquea con 400 INSUFFICIENT_XP
    const h1 = await fetch(`${url}/api/game/hint`, { method: 'POST', headers: { Authorization: `Bearer ${aliceToken}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await h1.json()).xp, 25);
    const h2 = await fetch(`${url}/api/game/hint`, { method: 'POST', headers: { Authorization: `Bearer ${aliceToken}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await h2.json()).xp, 0);
    const h3 = await fetch(`${url}/api/game/hint`, { method: 'POST', headers: { Authorization: `Bearer ${aliceToken}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(h3.status, 400);
    assert.equal((await h3.json()).code, 'INSUFFICIENT_XP');
  });

  await test('Progresión ESTRICTA en Modo Historia (validada en servidor): no permite saltarse niveles ni capítulos', async () => {
    const headers = { Authorization: `Bearer ${aliceToken}`, 'Content-Type': 'application/json' };

    // Maya Nivel 1 permitido
    const ok1 = await fetch(`${url}/api/game/campaign/start`, { method: 'POST', headers, body: JSON.stringify({ campaignId: 'maya', levelId: 1 }) });
    assert.equal(ok1.status, 200);

    // Maya Nivel 2 y Nivel 5 BLOQUEADOS con 403 LEVEL_LOCKED
    const blk2 = await fetch(`${url}/api/game/campaign/start`, { method: 'POST', headers, body: JSON.stringify({ campaignId: 'maya', levelId: 2 }) });
    assert.equal(blk2.status, 403);
    assert.equal((await blk2.json()).code, 'LEVEL_LOCKED');

    const blk5 = await fetch(`${url}/api/game/campaign/start`, { method: 'POST', headers, body: JSON.stringify({ campaignId: 'maya', levelId: 5 }) });
    assert.equal(blk5.status, 403);

    // Mittens Nivel 1 BLOQUEADO hasta derrotar al Dios Maya (Cap. 1 Lv. 5)
    const blkMit = await fetch(`${url}/api/game/campaign/start`, { method: 'POST', headers, body: JSON.stringify({ campaignId: 'mittens', levelId: 1 }) });
    assert.equal(blkMit.status, 403);
    assert.equal((await blkMit.json()).code, 'LEVEL_LOCKED');

    // Reportar victoria falsa en Nivel 5 también debe ser rechazado con 403
    const cheatReport = await fetch(`${url}/api/game/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'maya_boss', opponentName: 'Dios Maya', winner: 'w', campaignId: 'maya', levelId: 5 })
    });
    assert.equal(cheatReport.status, 403);

    // Completar Maya 1 -> 2 -> 3 -> 4 -> 5 secuencialmente SÍ desbloquea Mittens Nivel 1
    for (let lvl = 1; lvl <= 5; lvl++) {
      const rep = await fetch(`${url}/api/game/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: lvl === 5 ? 'maya_boss' : 'maya_campaign', opponentName: `Maya ${lvl}`, winner: 'w', campaignId: 'maya', levelId: lvl })
      });
      assert.equal(rep.status, 200, `Maya nivel ${lvl} debe registrarse tras completar los anteriores`);
    }

    const okMit = await fetch(`${url}/api/game/campaign/start`, { method: 'POST', headers, body: JSON.stringify({ campaignId: 'mittens', levelId: 1 }) });
    assert.equal(okMit.status, 200, 'Tras vencer al Dios Maya, Capítulo 2 (Free Mittens) Nivel 1 queda desbloqueado');

    // Pero Galaxia Nivel 1 sigue bloqueado
    const blkGal = await fetch(`${url}/api/game/campaign/start`, { method: 'POST', headers, body: JSON.stringify({ campaignId: 'galaxy', levelId: 1 }) });
    assert.equal(blkGal.status, 403);
  });

  await test('Multijugador Online Real (Socket.io): Elo 0 -> 20 / 0 -> 0 (K=40), movimientos sincronizados y Ranking Global', async () => {
    const sAlice = ioClient(url, { auth: { token: aliceToken }, transports: ['websocket'] });
    const sBob = ioClient(url, { auth: { token: bobToken }, transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => sAlice.on('connect', res)),
      new Promise((res) => sBob.on('connect', res))
    ]);

    const pFoundAlice = new Promise((res) => sAlice.once('match:found', res));
    const pFoundBob = new Promise((res) => sBob.once('match:found', res));

    sAlice.emit('queue:join', { timeMinutes: 10 });
    sBob.emit('queue:join', { timeMinutes: 10 });

    const [mAlice, mBob] = await Promise.all([pFoundAlice, pFoundBob]);
    assert.equal(mAlice.matchId, mBob.matchId);
    assert.notEqual(mAlice.yourColor, mBob.yourColor);
    assert.equal(mAlice.opponent.elo, 0);

    const whiteSock = mAlice.yourColor === 'w' ? sAlice : sBob;
    const blackSock = mAlice.yourColor === 'b' ? sAlice : sBob;

    const pMove1 = new Promise((res) => blackSock.once('match:state', res));
    whiteSock.emit('match:move', { matchId: mAlice.matchId, fr: 6, fc: 4, tr: 4, tc: 4 });
    const st1 = await pMove1;
    assert.equal(st1.state.board[4][4]?.type, 'P');

    const pMove2 = new Promise((res) => whiteSock.once('match:state', res));
    blackSock.emit('match:move', { matchId: mAlice.matchId, fr: 1, fc: 4, tr: 3, tc: 4 });
    const st2 = await pMove2;
    assert.equal(st2.state.board[3][4]?.type, 'P');

    // Negras se rinden -> Blancas suben de 0 a 20 (K=40), Negras se mantienen en 0 (nunca negativo)
    const pEnded = new Promise((res) => whiteSock.once('match:ended', res));
    blackSock.emit('match:resign', { matchId: mAlice.matchId });
    const ended = await pEnded;
    assert.equal(ended.winner, 'w');
    assert.equal(ended.eloUpdate.whiteAfter, 20);
    assert.equal(ended.eloUpdate.blackAfter, 0);

    const lbRes = await fetch(`${url}/api/leaderboard`);
    const { players } = await lbRes.json();
    assert.ok(players.length >= 2);
    assert.equal(players[0].elo, 20);
    assert.equal(players[1].elo, 0);

    sAlice.disconnect();
    sBob.disconnect();
  });
} finally {
  await server.stop();
  try { fs.unlinkSync(tmpDb); } catch {}
  try { fs.unlinkSync(`${tmpDb}-wal`); } catch {}
  try { fs.unlinkSync(`${tmpDb}-shm`); } catch {}
}

console.log(`\n=== RESULTADO FINAL: ${passed} OK, ${failed} FALLOS ===\n`);
if (failed > 0) process.exit(1);
