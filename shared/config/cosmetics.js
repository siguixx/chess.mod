export const MOD_VIP_PLAN = {
  id: 'mod_vip_monthly',
  name: 'Mod VIP',
  priceUsd: 5,
  currency: 'USD',
  priceLabel: '$5 USD / mes',
  durationDays: 30,
  requiresRealPayment: true,
  benefits: [
    'Aurora dorada y nombre dorado «Mod VIP» visible para otros en Ranking Global y Online',
    'Poder VIP SÚPER OP (CD 2t): Tormenta Dorada — congela en oro 3 turnos en área (cruz) y DESTRUYE al instante a cualquier enemigo ya congelado',
    'Fichas Doradas exclusivas con textura metálica y sonido áureo',
    'Tablero Dorado y Negro de lujo con textura de obsidiana y oro (usable en todos los modos menos Modo Historia)'
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
  { id: 'frame_vip_gold', name: 'Aurora Dorada Mod VIP', minLevel: 99, vipOnly: true, exclusiveReason: 'Suscripción Mod VIP ($5/mes)', border: '#ffe066', glow: 'rgba(255,215,64,0.95)', category: 'frame' }
];

export const COSMETIC_BOARDS = [
  {
    id: 'board_classic_maya',
    name: 'Piedra y Jade (Original)',
    description: 'Textura clásica de piedra tallada y jade del santuario.',
    minLevel: 1,
    priceMods: 0,
    light: '#e5d8bf',
    dark: '#6b7d69',
    pedestal: 'linear-gradient(145deg, #524839 0%, #221e18 55%, #3a3327 100%)',
    textureClass: 'texture-stone',
    category: 'board'
  },
  {
    id: 'board_golden_temple',
    name: 'Templo de Oro Antiguo',
    description: 'Relieves mayas grabados en piedra cálida y bronce dorado.',
    minLevel: 2,
    priceMods: 80,
    light: '#ecdcc0',
    dark: '#8b6f47',
    pedestal: 'linear-gradient(145deg, #745c2c 0%, #2b2113 55%, #554220 100%)',
    textureClass: 'texture-temple-gold',
    category: 'board'
  },
  {
    id: 'board_royal_crimson',
    name: 'Carmesí Real',
    description: 'Textura aterciopelada real con contraste profundo carmesí.',
    minLevel: 99,
    priceMods: 110,
    light: '#f0dfd2',
    dark: '#6e2828',
    pedestal: 'linear-gradient(145deg, #632121 0%, #1d0c0c 55%, #471717 100%)',
    textureClass: 'texture-velvet',
    category: 'board'
  },
  {
    id: 'board_obsidian_slate',
    name: 'Obsidiana y Pizarra',
    description: 'Pizarra volcánica pulida con acabado mineral mate.',
    minLevel: 4,
    priceMods: 130,
    light: '#d8d3c8',
    dark: '#4a4d50',
    pedestal: 'linear-gradient(145deg, #3c3d40 0%, #171718 55%, #2f3033 100%)',
    textureClass: 'texture-slate',
    category: 'board'
  },
  {
    id: 'board_volcanic_magma',
    name: 'Magma Volcánico',
    description: 'Textura de basalto oscuro surcado por grietas incandescentes de lava.',
    minLevel: 99,
    priceMods: 140,
    light: '#f2cfa8',
    dark: '#5e2115',
    pedestal: 'linear-gradient(145deg, #b83d19 0%, #1c0b07 52%, #752410 100%)',
    textureClass: 'texture-magma',
    category: 'board'
  },
  {
    id: 'board_deep_jade',
    name: 'Santuario de Jade Profundo',
    description: 'Mosaico esmeralda veteado con reflejos de jade imperial.',
    minLevel: 5,
    priceMods: 150,
    light: '#dce4d7',
    dark: '#39634e',
    pedestal: 'linear-gradient(145deg, #2b5440 0%, #13241c 55%, #214030 100%)',
    textureClass: 'texture-jade',
    category: 'board'
  },
  {
    id: 'board_glacial_marble',
    name: 'Mármol Glacial',
    description: 'Hielo cristalino ártico con destellos helados en cada casilla.',
    minLevel: 99,
    priceMods: 170,
    light: '#e8f4fc',
    dark: '#33587a',
    pedestal: 'linear-gradient(145deg, #3a7ca5 0%, #0d1b2a 55%, #204969 100%)',
    textureClass: 'texture-ice',
    category: 'board'
  },
  {
    id: 'board_cyber_glitch',
    name: 'Matriz Glitch Neón',
    description: 'Textura digital con scanlines cuánticas y retícula corrupta.',
    minLevel: 99,
    priceMods: 190,
    light: '#d8ecf2',
    dark: '#1d2236',
    pedestal: 'linear-gradient(145deg, #22d3ee 0%, #0b0d17 50%, #c026d3 100%)',
    textureClass: 'texture-glitch',
    category: 'board'
  },
  {
    id: 'board_cosmic_indigo',
    name: 'Nebulosa Estelar',
    description: 'Polvo de estrellas y textura galáctica inspirada en la Entidad Universal.',
    minLevel: 7,
    priceMods: 210,
    light: '#dcd8ea',
    dark: '#35315c',
    pedestal: 'linear-gradient(145deg, #4b3d8f 0%, #0f0d21 55%, #2b2259 100%)',
    textureClass: 'texture-nebula',
    category: 'board'
  },
  {
    id: 'board_royal_marble',
    name: 'Mármol Imperial Dorado',
    description: 'Vetas de mármol blanco y negro bañadas en filigrana dorada.',
    minLevel: 99,
    priceMods: 230,
    light: '#f7f1e1',
    dark: '#2c2720',
    pedestal: 'linear-gradient(145deg, #d8b257 0%, #191612 52%, #8e6c24 100%)',
    textureClass: 'texture-marble-gold',
    category: 'board'
  },
  {
    id: 'board_void_obsidian',
    name: 'Vacío de Blacky',
    description: 'Textura sombría abismal con resplandor carmesí del Boss Secreto.',
    minLevel: 99,
    priceMods: 260,
    light: '#d2ccd4',
    dark: '#1b141a',
    pedestal: 'linear-gradient(145deg, #a62639 0%, #0b080c 52%, #591420 100%)',
    textureClass: 'texture-void',
    category: 'board'
  },
  {
    id: 'board_vip_gold_black',
    name: 'Dorado y Negro (Mod VIP)',
    description: 'Textura exclusiva de oro cepillado y obsidiana pulida con brillo metálico.',
    minLevel: 99,
    vipOnly: true,
    exclusiveReason: 'Suscripción Mod VIP ($5/mes)',
    light: '#e6c15c',
    dark: '#14120e',
    pedestal: 'linear-gradient(145deg, #ffd75e 0%, #19150d 48%, #9e741f 100%)',
    textureClass: 'texture-vip-gold',
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
    id: 'pieces_magma',
    name: 'Forja de Magma',
    description: 'Textura incandescente de fuego y lava con sonido de yunque ardiente.',
    minLevel: 99,
    priceMods: 170,
    sfxProfile: 'magma',
    cssClass: 'piece-skin-magma',
    accent: '#ff6433',
    category: 'piece_skin'
  },
  {
    id: 'pieces_crystal_ice',
    name: 'Cristal Ártico',
    description: 'Acabado de hielo brillante con resonancia helada al capturar.',
    minLevel: 99,
    priceMods: 190,
    sfxProfile: 'ice',
    cssClass: 'piece-skin-ice',
    accent: '#7de2ff',
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
    id: 'pieces_glitch',
    name: 'Glitch Cuántico',
    description: 'Textura holográfica RGB con chispazos digitales corruptos.',
    minLevel: 99,
    priceMods: 240,
    sfxProfile: 'glitch',
    cssClass: 'piece-skin-glitch',
    accent: '#38f8ff',
    category: 'piece_skin'
  },
  {
    id: 'pieces_vip_gold',
    name: 'Fichas Doradas (Mod VIP)',
    description: 'Oro puro brillante con textura metálica y sonido áureo exclusivo.',
    minLevel: 99,
    vipOnly: true,
    exclusiveReason: 'Suscripción Mod VIP ($5/mes)',
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
    description: 'Juega ajedrez sin poderes activos adicionales.',
    minLevel: 1,
    priceMods: 0,
    cooldown: 0,
    sfxType: 'select',
    icon: '♟️',
    category: 'power'
  },
  {
    id: 'power_maya_arrows',
    name: 'Lluvia de Flechas Maya',
    description: 'Ataque OP (CD 3t): Dispara a distancia (4 casillas) desde cualquier pieza destruyendo al instante a 1 enemigo (no Rey) y repeliendo adyacentes.',
    minLevel: 99,
    priceMods: 140,
    cooldown: 3,
    range: 4,
    effect: 'power_maya_arrows',
    sfxType: 'arrowShot',
    color: '#efd083',
    icon: '🏹',
    category: 'power'
  },
  {
    id: 'power_maya_pyramid',
    name: 'Pirámide Aplastadora 2×2',
    description: 'Ficha Grande 2×2 (CD 4t): Inspirada en el Dios Maya. Invoca una Pirámide 2×2 que APLASTA a todos los enemigos en esas 4 casillas y bloquea la zona 2 turnos.',
    minLevel: 99,
    priceMods: 180,
    cooldown: 4,
    duration: 2,
    effect: 'power_maya_pyramid',
    sfxType: 'crush',
    color: '#cfa64c',
    icon: '🏛️',
    category: 'power'
  },
  {
    id: 'power_glitch_rift',
    name: 'Grieta Destructora Glitch',
    description: 'Ataque OP (CD 3t): Inspirado en Boss Glitch. Abre una Grieta de Vacío bajo una pieza enemiga (no Rey) destruyéndola y sellando la casilla por 3 turnos.',
    minLevel: 99,
    priceMods: 220,
    cooldown: 3,
    duration: 3,
    effect: 'power_glitch_rift',
    sfxType: 'glitchTear',
    color: '#ff4d6d',
    icon: '⚡',
    category: 'power'
  },
  {
    id: 'power_galaxy_titan',
    name: 'Coloso Galáctico 2×2',
    description: 'Ficha Grande 2×2 OP (CD 4t): Inspirado en el Hombre Galaxia. Despliega un Coloso 2×2 que aniquila enemigos dentro del bloque y lanza onda orbital a 1 pieza menor adyacente.',
    minLevel: 99,
    priceMods: 260,
    cooldown: 4,
    duration: 2,
    effect: 'power_galaxy_titan',
    sfxType: 'galaxyTeleport',
    color: '#9d8df2',
    icon: '🌌',
    category: 'power'
  },
  {
    id: 'power_blacky_claw',
    name: 'Zarpa Traidora de Blacky',
    description: 'Desbloqueo Secreto (CD 4t): Corrompe y ROBA una pieza rival (Peón, Caballo, Alfil o Torre) convirtiéndola en tu aliada en su misma casilla.',
    minLevel: 99,
    priceMods: 0,
    bossUnlock: 'blacky',
    hiddenUntilUnlocked: true,
    exclusiveReason: 'Derrota a BLACKY en su enlace secreto (/blacky)',
    cooldown: 4,
    effect: 'power_blacky_claw',
    sfxType: 'blackyBetray',
    color: '#ff5e57',
    icon: '🐾',
    category: 'power'
  },
  {
    id: 'power_free_mittens',
    name: 'Poder de Free Mittens',
    description: 'Desbloqueo de Jefe (CD 3t): Activa Asimilación 1:1 durante 3 turnos (tus capturas clonan la pieza rival en tu origen) + dispara Chorro de Agua (4 casillas) que destruye al rival si choca.',
    minLevel: 99,
    priceMods: 0,
    bossUnlock: 'mittens:5',
    exclusiveReason: 'Derrota a Free Mittens (Cap. 2 Nv. 5)',
    cooldown: 3,
    range: 4,
    effect: 'power_free_mittens',
    sfxType: 'convert',
    color: '#67e8f9',
    icon: '⛓️',
    category: 'power'
  },
  {
    id: 'power_vip_golden_freeze',
    name: 'Tormenta Dorada (Mod VIP)',
    description: 'Poder Mod VIP SÚPER OP (CD 2t): Dispara hasta 5 casillas congelando en color dorado por 3 turnos al objetivo Y a rivales adyacentes. ¡Si disparas a un enemigo ya congelado en oro, lo DESTRUYES al instante!',
    minLevel: 99,
    vipOnly: true,
    exclusiveReason: 'Suscripción Mod VIP ($5/mes)',
    cooldown: 2,
    range: 5,
    duration: 3,
    effect: 'power_vip_golden_freeze',
    sfxType: 'power_golden_freeze',
    color: '#ffd859',
    icon: '👑',
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
  if (item.bossUnlock) return false;
  return userLevel >= (item.minLevel || 1);
}
