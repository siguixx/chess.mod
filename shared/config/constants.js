export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const PIECE_NAMES = {
  K: 'Rey',
  Q: 'Dama',
  R: 'Torre',
  B: 'Alfil',
  N: 'Caballo',
  P: 'Peón',
  H: 'Casa',
  U: 'Barrera Universal',
  A: 'Arquera de Obsidiana',
  G: 'Escudero de Jade',
  J: 'Jaguar de Piedra',
  C: 'Chamán Solar'
};

export const INITIAL_ELO = 0;
export const INITIAL_MODS = 100;
export const HINT_XP_COST = 25;
export const CLAN_CREATE_COST_MODS = 150;

export const TRAINERS = [
  {
    id: 'trainer_maya_novice',
    name: 'Aprendiz Maya',
    elo: 400,
    difficulty: 1,
    useSuperAi: false,
    bossId: 'maya_lvl1',
    badge: 'PRINCIPIANTE',
    description: 'Ideal para aprender movimientos, aperturas y ganar tus primeros Mods.'
  },
  {
    id: 'trainer_sentinel',
    name: 'Centinela del Templo',
    elo: 900,
    difficulty: 2,
    useSuperAi: false,
    bossId: 'maya_lvl2',
    badge: 'BÁSICO',
    description: 'Defiende el centro con orden y castiga piezas desprotegidas.'
  },
  {
    id: 'trainer_jade',
    name: 'Estratega de Jade',
    elo: 1400,
    difficulty: 3,
    useSuperAi: false,
    bossId: 'maya_lvl3',
    badge: 'INTERMEDIO',
    description: 'Combina táctica ágil con ataques directos al enroque.'
  },
  {
    id: 'trainer_mittens',
    name: 'Sabio Mittens',
    elo: 2000,
    difficulty: 4,
    useSuperAi: true,
    maxDepth: 3,
    thinkTimeMs: 420,
    bossId: 'free_mittens',
    badge: 'MAESTRO',
    description: 'Cálculo sereno y finales milimétricos. Te obliga a pensar 3 jugadas adelante.'
  },
  {
    id: 'trainer_galaxy',
    name: 'Maestro Galáctico',
    elo: 2600,
    difficulty: 5,
    useSuperAi: true,
    maxDepth: 4,
    thinkTimeMs: 700,
    bossId: 'galaxy_entity',
    badge: 'GRAN MAESTRO',
    description: 'Súper IA táctica con libro de aperturas profesional y presión constante.'
  },
  {
    id: 'trainer_blacky',
    name: 'BLACKY (Supremo)',
    elo: 3200,
    difficulty: 5,
    useSuperAi: true,
    maxDepth: 5,
    thinkTimeMs: 1150,
    bossId: 'blacky_secret',
    badge: '3200 ELO · EL MÁS DIFÍCIL',
    isHardest: true,
    description: 'El entrenador más fuerte de CHESS.MOD (3200 Elo). Súper IA al límite con el diseño oficial de Blacky.'
  }
];

export const XP_LEVELS = [
  { level: 1, title: 'Iniciado de Obsidiana', minXp: 0 },
  { level: 2, title: 'Estratega de Piedra', minXp: 120 },
  { level: 3, title: 'Táctico del Santuario', minXp: 300 },
  { level: 4, title: 'Guardián de las Casas', minXp: 550 },
  { level: 5, title: 'Cazador del Jaguar', minXp: 900 },
  { level: 6, title: 'Carcelero de Mittens', minXp: 1350 },
  { level: 7, title: 'Navegante Estelar', minXp: 1900 },
  { level: 8, title: 'Purificador del Glitch', minXp: 2600 },
  { level: 9, title: 'Maestro del Plano Puro', minXp: 3500 },
  { level: 10, title: 'Gran Maestro CHESS.MOD', minXp: 4600 }
];

export function computeLevelFromXp(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  let current = XP_LEVELS[0];
  let next = XP_LEVELS[1] || null;
  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (safeXp >= XP_LEVELS[i].minXp) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] || null;
    }
  }
  const progressPct = next
    ? Math.min(100, Math.max(0, ((safeXp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100;
  return {
    level: current.level,
    title: current.title,
    xp: safeXp,
    minXp: current.minXp,
    next,
    progressPct
  };
}

export function toAlg(r, c) {
  return `${FILES[c]}${8 - r}`;
}

export function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function formatClock(sec) {
  if (sec === null || sec === undefined) return '∞';
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function dirText(dr, dc) {
  if (dr === -1 && dc === -1) return 'el noroeste';
  if (dr === -1 && dc === 1) return 'el noreste';
  if (dr === 1 && dc === -1) return 'el suroeste';
  if (dr === 1 && dc === 1) return 'el sureste';
  if (dr === -1) return 'el norte';
  if (dr === 1) return 'el sur';
  if (dc === -1) return 'el oeste';
  return 'el este';
}
