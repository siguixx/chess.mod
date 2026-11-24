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
export const HINT_XP_COST = 25;

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
