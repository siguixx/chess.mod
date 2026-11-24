export const COSMETIC_AVATARS = [
  { id: 'preset:obsidian_king', name: 'Rey de Obsidiana', minLevel: 1, category: 'avatar' },
  { id: 'preset:jade_guardian', name: 'Guardián de Jade', minLevel: 1, category: 'avatar' },
  { id: 'preset:gold_pyramid', name: 'Pirámide Dorada', minLevel: 2, category: 'avatar' },
  { id: 'preset:casa_sentinel', name: 'Centinela de la Casa', minLevel: 3, category: 'avatar' },
  { id: 'preset:sun_bishop', name: 'Alfil Solar', minLevel: 4, category: 'avatar' },
  { id: 'preset:obsidian_rook', name: 'Torre de Obsidiana', minLevel: 5, category: 'avatar' },
  { id: 'preset:mittens_crown', name: 'Corona del Sabio', minLevel: 6, category: 'avatar' },
  { id: 'preset:maya_mask', name: 'Máscara del Dios Maya', minLevel: 7, category: 'avatar' },
  { id: 'preset:galaxy_entity', name: 'Núcleo Galáctico', minLevel: 8, category: 'avatar' },
  { id: 'preset:chess_origin', name: 'Corona de CHESS', minLevel: 99, exclusiveReason: 'Derrota a CHESS (Cap. 5)', category: 'avatar' },
  { id: 'preset:blacky_tamer', name: 'Domador de Blacky', minLevel: 99, hiddenUntilUnlocked: true, exclusiveReason: 'Secreto', category: 'avatar' }
];

export const COSMETIC_FRAMES = [
  { id: 'frame_stone', name: 'Piedra Tallada', minLevel: 1, border: '#8a7e6a', glow: 'rgba(207,166,76,0.2)', category: 'frame' },
  { id: 'frame_gold', name: 'Oro Antiguo', minLevel: 2, border: '#cfa64c', glow: 'rgba(239,208,131,0.4)', category: 'frame' },
  { id: 'frame_jade', name: 'Jade Imperial', minLevel: 3, border: '#3c825f', glow: 'rgba(60,130,95,0.48)', category: 'frame' },
  { id: 'frame_obsidian', name: 'Obsidiana Real', minLevel: 5, border: '#efd083', glow: 'rgba(207,166,76,0.58)', category: 'frame' },
  { id: 'frame_mittens', name: 'Tablero del Sabio', minLevel: 6, border: '#f3ede2', glow: 'rgba(255,255,255,0.42)', category: 'frame' },
  { id: 'frame_galaxy', name: 'Halo de Nebulosa', minLevel: 7, border: '#8b7ae6', glow: 'rgba(139,122,230,0.52)', category: 'frame' },
  { id: 'frame_eclipse', name: 'Corona del Eclipse', minLevel: 8, border: '#c94b3c', glow: 'rgba(201,75,60,0.52)', category: 'frame' },
  { id: 'frame_chess_victor', name: 'Vencedor de Chess', minLevel: 99, exclusiveReason: 'Derrota a CHESS (Cap. 5)', border: '#fff2c4', glow: 'rgba(239,208,131,0.85)', category: 'frame' },
  { id: 'frame_blacky_imposible', name: 'Domador de Blacky (Imposible)', minLevel: 99, hiddenUntilUnlocked: true, exclusiveReason: 'Secreto', border: '#ff4949', glow: 'rgba(255,73,73,0.85)', category: 'frame' }
];

export const COSMETIC_BOARDS = [
  {
    id: 'board_classic_maya',
    name: 'Piedra y Jade (Original)',
    minLevel: 1,
    light: '#e5d8bf',
    dark: '#6b7d69',
    pedestal: 'linear-gradient(145deg, #524839 0%, #221e18 55%, #3a3327 100%)',
    category: 'board'
  },
  {
    id: 'board_golden_temple',
    name: 'Templo de Oro Antiguo',
    minLevel: 2,
    light: '#ecdcc0',
    dark: '#8b6f47',
    pedestal: 'linear-gradient(145deg, #745c2c 0%, #2b2113 55%, #554220 100%)',
    category: 'board'
  },
  {
    id: 'board_obsidian_slate',
    name: 'Obsidiana y Pizarra',
    minLevel: 4,
    light: '#d8d3c8',
    dark: '#4a4d50',
    pedestal: 'linear-gradient(145deg, #3c3d40 0%, #171718 55%, #2f3033 100%)',
    category: 'board'
  },
  {
    id: 'board_deep_jade',
    name: 'Santuario de Jade Profundo',
    minLevel: 5,
    light: '#dce4d7',
    dark: '#39634e',
    pedestal: 'linear-gradient(145deg, #2b5440 0%, #13241c 55%, #214030 100%)',
    category: 'board'
  },
  {
    id: 'board_cosmic_indigo',
    name: 'Nebulosa Estelar',
    minLevel: 7,
    light: '#dcd8ea',
    dark: '#3c3a63',
    pedestal: 'linear-gradient(145deg, #2d2952 0%, #111022 55%, #231f42 100%)',
    category: 'board'
  }
];

export function getAllCosmetics() {
  return {
    avatars: COSMETIC_AVATARS,
    frames: COSMETIC_FRAMES,
    boards: COSMETIC_BOARDS
  };
}

export function isCosmeticUnlocked(cosmeticId, userLevel = 1, explicitUnlocks = []) {
  if (explicitUnlocks.includes(cosmeticId)) return true;
  const all = [...COSMETIC_AVATARS, ...COSMETIC_FRAMES, ...COSMETIC_BOARDS];
  const item = all.find((x) => x.id === cosmeticId);
  if (!item) return false;
  return userLevel >= item.minLevel;
}
