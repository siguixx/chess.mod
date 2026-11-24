export const MIN_ELO = 0;

/**
 * Probabilidad esperada estándar de ajedrez:
 * E = 1 / (1 + 10 ^ ((eloRival - eloJugador) / 400))
 */
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Factor K dinámico de ajedrez:
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
 * Calcula nuevos ratings Elo desde 0 (nunca baja de 0).
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
    kWhite: kW,
    kBlack: kB
  };
}
