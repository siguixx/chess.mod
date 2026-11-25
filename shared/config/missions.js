/**
 * Sistema de Misiones de CHESS.MOD
 * Regla estricta: incluso la misión más difícil otorga un MÁXIMO de 30 Mods.
 */
export const MAX_MISSION_REWARD_MODS = 30;

export const MISSIONS = [
  {
    id: 'mission_first_match',
    title: 'Primer Movimiento',
    difficulty: 'Fácil',
    badgeClass: 'jade',
    description: 'Juega 1 partida en cualquier modo de CHESS.MOD.',
    target: 1,
    rewardMods: 10,
    metric: 'gamesPlayed'
  },
  {
    id: 'mission_first_win',
    title: 'Primera Victoria',
    difficulty: 'Fácil',
    badgeClass: 'jade',
    description: 'Consigue tu primera victoria (vs Bot, Modo Historia, Equipos u Online).',
    target: 1,
    rewardMods: 15,
    metric: 'wins'
  },
  {
    id: 'mission_tactician_games',
    title: 'Estratega Activo',
    difficulty: 'Media',
    badgeClass: 'muted',
    description: 'Completa 5 partidas totales en cualquier modo.',
    target: 5,
    rewardMods: 18,
    metric: 'gamesPlayed'
  },
  {
    id: 'mission_three_wins',
    title: 'Racha de Conquista',
    difficulty: 'Media',
    badgeClass: 'muted',
    description: 'Acumula 3 victorias en tu historial de cuenta.',
    target: 3,
    rewardMods: 20,
    metric: 'wins'
  },
  {
    id: 'mission_story_explorer',
    title: 'Caminante de la Historia',
    difficulty: 'Difícil',
    badgeClass: '',
    description: 'Completa al menos 3 niveles del Modo Historia.',
    target: 3,
    rewardMods: 22,
    metric: 'storyLevels'
  },
  {
    id: 'mission_elo_climber',
    title: 'Ascenso FIDE',
    difficulty: 'Difícil',
    badgeClass: '',
    description: 'Alcanza al menos 100 puntos de Elo FIDE en partidas competitivas.',
    target: 100,
    rewardMods: 25,
    metric: 'elo'
  },
  {
    id: 'mission_veteran_wins',
    title: 'Maestro del Tablero',
    difficulty: 'Muy Difícil',
    badgeClass: 'crimson',
    description: 'Consigue 8 victorias totales demostrando tu dominio.',
    target: 8,
    rewardMods: 28,
    metric: 'wins'
  },
  {
    id: 'mission_supreme_legend',
    title: 'Desafío Supremo de CHESS.MOD',
    difficulty: 'Extrema (Más Difícil)',
    badgeClass: 'crimson',
    description: 'Completa 15 partidas y supera el mayor reto de constancia. Recompensa tope: 30 Mods.',
    target: 15,
    rewardMods: 30,
    metric: 'gamesPlayed'
  }
];

export function computeUserMissions(userRow, completedStoryLevels = 0, claimedIds = []) {
  const claimedSet = new Set(claimedIds || []);
  const metrics = {
    gamesPlayed: Number(userRow?.games_played) || 0,
    wins: Number(userRow?.wins) || 0,
    elo: Number(userRow?.elo) || 0,
    storyLevels: Number(completedStoryLevels) || 0
  };

  return MISSIONS.map((m) => {
    const rawVal = metrics[m.metric] || 0;
    const progress = Math.min(m.target, rawVal);
    const completed = progress >= m.target;
    const claimed = claimedSet.has(m.id);
    const rewardMods = Math.min(MAX_MISSION_REWARD_MODS, m.rewardMods);
    return {
      ...m,
      rewardMods,
      progress,
      pct: Math.min(100, Math.round((progress / Math.max(1, m.target)) * 100)),
      completed,
      claimed,
      canClaim: completed && !claimed
    };
  });
}
