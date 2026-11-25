export const MOD_VIP_PLAN = {
  id: 'mod_vip_monthly',
  name: 'Mod VIP',
  priceSoles: 15,
  currency: 'PEN',
  priceLabel: 'S/ 15 / mes',
  durationDays: 30,
  benefits: [
    'Aurora dorada y nombre dorado «Mod VIP» visible para todos en Ranking y Online',
    'Poder VIP: Congelación Dorada (tus peones congelan a distancia por 3 turnos en color dorado)',
    'Fichas Doradas exclusivas con efecto de sonido metálico dorado',
    'Tablero exclusivo Dorado y Negro de lujo'
  ]
};

export const VIP_EXCLUSIVE_IDS = [
  'frame_vip_gold',
  'board_vip_gold_black',
  'pieces_vip_gold',
  'power_vip_golden_freeze'
];

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
  { id: 'frame_blacky_imposible', name: 'Domador de Blacky (Imposible)', minLevel: 99, hiddenUntilUnlocked: true, exclusiveReason: 'Secreto', border: '#e4ecfa', glow: 'rgba(228,236,250,0.85)', category: 'frame' },
  { id: 'frame_vip_gold', name: 'Aurora Dorada Mod VIP', minLevel: 99, vipOnly: true, exclusiveReason: 'Suscripción Mod VIP', border: '#ffe066', glow: 'rgba(255,215,64,0.95)', category: 'frame' }
];

export const COSMETIC_BOARDS = [
  {
    id: 'board_classic_maya',
    name: 'Piedra y Jade (Original)',
    minLevel: 1,
    priceMods: 0,
    light: '#e5d8bf',
    dark: '#6b7d69',
    pedestal: 'linear-gradient(145deg, #524839 0%, #221e18 55%, #3a3327 100%)',
    category: 'board'
  },
  {
    id: 'board_golden_temple',
    name: 'Templo de Oro Antiguo',
    minLevel: 2,
    priceMods: 80,
    light: '#ecdcc0',
    dark: '#8b6f47',
    pedestal: 'linear-gradient(145deg, #745c2c 0%, #2b2113 55%, #554220 100%)',
    category: 'board'
  },
  {
    id: 'board_royal_crimson',
    name: 'Carmesí Real',
    minLevel: 99,
    priceMods: 110,
    light: '#f0dfd2',
    dark: '#6e2828',
    pedestal: 'linear-gradient(145deg, #632121 0%, #1d0c0c 55%, #471717 100%)',
    category: 'board'
  },
  {
    id: 'board_obsidian_slate',
    name: 'Obsidiana y Pizarra',
    minLevel: 4,
    priceMods: 130,
    light: '#d8d3c8',
    dark: '#4a4d50',
    pedestal: 'linear-gradient(145deg, #3c3d40 0%, #171718 55%, #2f3033 100%)',
    category: 'board'
  },
  {
    id: 'board_deep_jade',
    name: 'Santuario de Jade Profundo',
    minLevel: 5,
    priceMods: 150,
    light: '#dce4d7',
    dark: '#39634e',
    pedestal: 'linear-gradient(145deg, #2b5440 0%, #13241c 55%, #214030 100%)',
    category: 'board'
  },
  {
    id: 'board_glacial_marble',
    name: 'Mármol Glacial',
    minLevel: 99,
    priceMods: 170,
    light: '#e8f1f8',
    dark: '#3b5a78',
    pedestal: 'linear-gradient(145deg, #2b4a66 0%, #101b26 55%, #203952 100%)',
    category: 'board'
  },
  {
    id: 'board_cosmic_indigo',
    name: 'Nebulosa Estelar',
    minLevel: 7,
    priceMods: 210,
    light: '#dcd8ea',
    dark: '#3c3a63',
    pedestal: 'linear-gradient(145deg, #2d2952 0%, #111022 55%, #231f42 100%)',
    category: 'board'
  },
  {
    id: 'board_vip_gold_black',
    name: 'Dorado y Negro (Mod VIP)',
    minLevel: 99,
    vipOnly: true,
    exclusiveReason: 'Suscripción Mod VIP',
    light: '#e6c15c',
    dark: '#14120e',
    pedestal: 'linear-gradient(145deg, #ffd75e 0%, #19150d 48%, #9e741f 100%)',
    category: 'board'
  }
];

export const COSMETIC_PIECE_SKINS = [
  {
    id: 'pieces_classic',
    name: 'Marfil Clásico',
    description: 'Fichas clásicas de madera y marfil con sonido tradicional.',
    minLevel: 1,
    priceMods: 0,
    sfxProfile: 'classic',
    cssClass: 'piece-skin-classic',
    accent: '#fbf7ee',
    category: 'piece_skin'
  },
  {
    id: 'pieces_jade',
    name: 'Jade del Santuario',
    description: 'Acabado esmeralda con sonido cristalino de jade al mover y capturar.',
    minLevel: 99,
    priceMods: 100,
    sfxProfile: 'jade',
    cssClass: 'piece-skin-jade',
    accent: '#6ee2a8',
    category: 'piece_skin'
  },
  {
    id: 'pieces_obsidian',
    name: 'Obsidiana Volcánica',
    description: 'Brillo ámbar volcánico con impacto grave pétreo.',
    minLevel: 99,
    priceMods: 150,
    sfxProfile: 'obsidian',
    cssClass: 'piece-skin-obsidian',
    accent: '#ff9f5a',
    category: 'piece_skin'
  },
  {
    id: 'pieces_cosmic',
    name: 'Cristal Cósmico',
    description: 'Reflejo estelar violeta con resonancia astral.',
    minLevel: 99,
    priceMods: 220,
    sfxProfile: 'cosmic',
    cssClass: 'piece-skin-cosmic',
    accent: '#b6a6ff',
    category: 'piece_skin'
  },
  {
    id: 'pieces_vip_gold',
    name: 'Fichas Doradas (Mod VIP)',
    description: 'Oro puro brillante con efecto de sonido metálico dorado exclusivo.',
    minLevel: 99,
    vipOnly: true,
    exclusiveReason: 'Suscripción Mod VIP',
    sfxProfile: 'vip_gold',
    cssClass: 'piece-skin-vip-gold',
    accent: '#ffd859',
    category: 'piece_skin'
  }
];

export const COSMETIC_POWERS = [
  {
    id: 'power_none',
    name: 'Sin Poder Equipado',
    description: 'Juega solo con las defensas propias de cada nivel.',
    minLevel: 1,
    priceMods: 0,
    cooldown: 0,
    sfxType: 'select',
    icon: '♟️',
    category: 'power'
  },
  {
    id: 'power_solar_shield',
    name: 'Escudo Solar',
    description: 'Balanceado (CD 5t): Protege a 1 pieza aliada (no Rey) durante 2 turnos contra la siguiente captura enemiga.',
    minLevel: 99,
    priceMods: 120,
    cooldown: 5,
    sfxType: 'power_solar_shield',
    icon: '🛡️',
    category: 'power'
  },
  {
    id: 'power_wind_pulse',
    name: 'Pulso de Viento',
    description: 'Balanceado (CD 4t): Empuja a distancia 1 casilla hacia atrás a una pieza rival (no Rey) si la casilla trasera está libre.',
    minLevel: 99,
    priceMods: 150,
    cooldown: 4,
    sfxType: 'power_wind_pulse',
    icon: '💨',
    category: 'power'
  },
  {
    id: 'power_shadow_step',
    name: 'Paso Fantasma',
    description: 'Balanceado (CD 5t): Teletransporta un Peón o Caballo aliado hasta 2 casillas de distancia a una casilla vacía.',
    minLevel: 99,
    priceMods: 200,
    cooldown: 5,
    sfxType: 'power_shadow_step',
    icon: '✨',
    category: 'power'
  },
  {
    id: 'power_vip_golden_freeze',
    name: 'Congelación Dorada (Mod VIP)',
    description: 'Poder Mod VIP (CD 4t): Tus Peones congelan a distancia (hasta 4 casillas) en color dorado por 3 turnos a cualquier ficha rival (no Rey).',
    minLevel: 99,
    vipOnly: true,
    exclusiveReason: 'Suscripción Mod VIP',
    cooldown: 4,
    sfxType: 'power_golden_freeze',
    icon: '❄️',
    category: 'power'
  }
];

export function getAllCosmetics() {
  return {
    avatars: COSMETIC_AVATARS,
    frames: COSMETIC_FRAMES,
    boards: COSMETIC_BOARDS,
    pieceSkins: COSMETIC_PIECE_SKINS,
    powers: COSMETIC_POWERS,
    vipPlan: MOD_VIP_PLAN
  };
}

export function findShopItem(itemId) {
  return [
    ...COSMETIC_AVATARS,
    ...COSMETIC_FRAMES,
    ...COSMETIC_BOARDS,
    ...COSMETIC_PIECE_SKINS,
    ...COSMETIC_POWERS
  ].find((x) => x.id === itemId) || null;
}

export function isCosmeticUnlocked(cosmeticId, userLevel = 1, explicitUnlocks = [], isVip = false) {
  const item = findShopItem(cosmeticId);
  if (!item) return false;
  if (item.vipOnly) return Boolean(isVip);
  if (explicitUnlocks.includes(cosmeticId)) return true;
  return userLevel >= (item.minLevel || 1);
}
