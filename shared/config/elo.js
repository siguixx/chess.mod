export const MIN_ELO = 0;

/**
 * Calibración FIDE de los 5 niveles de Bot para partidas competitivas Vs IA / Modos Especiales:
 */
export const BOT_ELO_BY_DIFFICULTY = {
  1: 400,
  2: 800,
  3: 1200,
  4: 1650,
  5: 2150
};

/**
 * Categoría oficial estilo FIDE según el puntaje Elo del jugador.
 */
export function getFideCategory(elo = 0) {
  const r = Math.max(0, Math.round(Number(elo) || 0));
  if (r >= 2500) return { code: 'GM', title: 'Gran Maestro (GM)', color: '#ffe27a' };
  if (r >= 2400) return { code: 'IM', title: 'Maestro Internacional (IM)', color: '#ffd166' };
  if (r >= 2300) return { code: 'FM', title: 'Maestro FIDE (FM)', color: '#f4a261' };
  if (r >= 2200) return { code: 'CM', title: 'Candidato a Maestro (CM)', color: '#9ce0be' };
  if (r >= 2000) return { code: 'EXP', title: 'Experto FIDE', color: '#7dd3fc' };
  if (r >= 1600) return { code: 'CLS-A', title: 'Jugador Clase A', color: '#a5b4fc' };
  if (r >= 1200) return { code: 'CLUB', title: 'Jugador de Club', color: '#d8b4fe' };
  if (r >= 800) return { code: 'AFIC', title: 'Aficionado FIDE', color: '#e5e7eb' };
  if (r >= 400) return { code: 'APR', title: 'Aprendiz Táctico', color: '#d6c8b2' };
  return { code: 'NOV', title: 'Novato FIDE', color: '#a89f91' };
}

/**
 * Probabilidad esperada estándar FIDE de ajedrez:
 * E = 1 / (1 + 10 ^ ((eloRival - eloJugador) / 400))
 */
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Factor K dinámico FIDE de ajedrez:
 * - K = 40 en las primeras 20 partidas (progreso inicial acelerado desde 0 Elo)
 * - K = 24 en Elo alto (>= 1800)
 * - K = 32 estándar
 */
export function getDynamicKFactor(elo = 0, gamesPlayed = 0) {
  if (gamesPlayed < 20) return 40;
  if (elo >= 1800) return 24;
  return 32;
}

/**
 * Calcula nuevos ratings Elo FIDE desde 0 (nunca baja de 0).
 * @param {number} whiteElo
 * @param {number} blackElo
 * @param {'w'|'b'|'draw'} result
 * @param {{ whiteGames?: number, blackGames?: number, kFactor?: number }} [opts]
 */
export function calculateEloUpdate(whiteElo, blackElo, result, opts = {}) {
  const wElo = Math.max(MIN_ELO, Math.round(Number(whiteElo) || 0));
  const bElo = Math.max(MIN_ELO, Math.round(Number(blackElo) || 0));

  const expW = expectedScore(wElo, bElo);
  const expB = 1 - expW;

  const scoreW = result === 'w' ? 1 : (result === 'draw' ? 0.5 : 0);
  const scoreB = 1 - scoreW;

  const kW = typeof opts === 'number'
    ? opts
    : (opts.kFactor || getDynamicKFactor(wElo, Number(opts.whiteGames) || 0));
  const kB = typeof opts === 'number'
    ? opts
    : (opts.kFactor || getDynamicKFactor(bElo, Number(opts.blackGames) || 0));

  const whiteAfter = Math.max(MIN_ELO, Math.round(wElo + kW * (scoreW - expW)));
  const blackAfter = Math.max(MIN_ELO, Math.round(bElo + kB * (scoreB - expB)));

  return {
    whiteBefore: wElo,
    blackBefore: bElo,
    whiteAfter,
    blackAfter,
    whiteDelta: whiteAfter - wElo,
    blackDelta: blackAfter - bElo,
    expectedWhite: expW,
    expectedBlack: expB,
    kWhite: kW,
    kBlack: kB
  };
}
