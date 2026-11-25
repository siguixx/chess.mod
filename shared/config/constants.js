export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

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
    id: 'trainer_yam',
    name: 'Yam (Gato Siamés)',
    role: 'Entrenador Inicial · Fundamentos',
    elo: 400,
    isStarter: true,
    practiceAiDifficulty: 1,
    bossId: 'trainer_yam',
    taughtPowerId: 'power_maya_arrows',
    taughtPowerLabel: '🏹 Lluvia de Flechas Maya',
    badge: 'STARTER · GATO SIAMÉS',
    description: '¡Miau! Tu entrenador inicial. Te enseña los movimientos básicos del tablero y cómo disparar ataques a distancia con Lluvia de Flechas.',
    tips: [
      '¡Miau! Empieza dominando el centro (e4 o d4) y desarrolla tus Caballos y Alfiles.',
      'Prueba tu botón «🏹 Lluvia de Flechas Maya»: toca una pieza tuya y dispara a un enemigo sin moverte.',
      'Recuerda enrocar pronto para mantener a tu Rey seguro mientras atacas con tus poderes.'
    ]
  },
  {
    id: 'trainer_kael',
    name: 'Kael (Guardián Maya)',
    role: 'Mentor de Fichas Grandes 2×2',
    elo: 900,
    practiceAiDifficulty: 2,
    bossId: 'trainer_kael',
    taughtPowerId: 'power_maya_pyramid',
    taughtPowerLabel: '🏛️ Pirámide Aplastadora 2×2',
    badge: 'FICHAS GRANDES 2×2',
    description: 'Te enseña a controlar bloques enteros del tablero y a aplastar grupos enemigos con la Pirámide 2×2.',
    tips: [
      'Busca concentraciones de 2 o más piezas enemigas para aplastarlas de golpe con la Pirámide 2×2.',
      'La Pirámide bloquea esas 4 casillas por 2 turnos: úsala para cortar ataques rivales.',
      'Protege siempre tus piezas pesadas y aprovecha el bloqueo para coronar peones.'
    ]
  },
  {
    id: 'trainer_pixel',
    name: 'Pixel (Ingeniera Glitch)',
    role: 'Mentora de Grietas y Control',
    elo: 1400,
    practiceAiDifficulty: 2,
    bossId: 'trainer_pixel',
    taughtPowerId: 'power_glitch_rift',
    taughtPowerLabel: '⚡ Grieta Destructora Glitch',
    badge: 'CONTROL DE CASILLAS',
    description: 'Te enseña táctica intermedia, horquillas y cómo destruir y sellar casillas críticas con Grietas Glitch.',
    tips: [
      'Usa la Grieta Glitch sobre una pieza enemiga clave (Torre o Alfil activo) para borrarla y cerrar su columna.',
      'Aprovecha las casillas selladas como muros para encerrar al Rey enemigo.',
      'Antes de mover, revisa si el rival dejó alguna pieza sin defensa.'
    ]
  },
  {
    id: 'trainer_mittens',
    name: 'Sabio Mittens',
    role: 'Mentor de Asimilación 1:1',
    elo: 2000,
    practiceAiDifficulty: 3,
    bossId: 'free_mittens',
    taughtPowerId: 'power_free_mittens',
    taughtPowerLabel: '⛓️ Poder de Free Mittens',
    badge: 'MAESTRO · ASIMILACIÓN',
    description: 'El Sabio te entrena en intercambios tácticos y en el arte de la Asimilación 1:1 y el Chorro de Agua.',
    tips: [
      'Activa el Poder de Free Mittens antes de capturar una pieza fuerte: ¡renacerá como tuya en tu origen!',
      'Si empujas una pieza enemiga con el Chorro de Agua contra el borde o contra otra pieza, queda destruida.',
      'Calcula 2 jugadas por adelantado antes de iniciar un intercambio.'
    ]
  },
  {
    id: 'trainer_astra',
    name: 'Astra (Navegante Galáctica)',
    role: 'Mentora de Combos Orbitales',
    elo: 2600,
    practiceAiDifficulty: 3,
    bossId: 'trainer_astra',
    taughtPowerId: 'power_galaxy_titan',
    taughtPowerLabel: '🌌 Coloso Galáctico 2×2',
    badge: 'GRAN MAESTRO',
    description: 'Te enseña combinaciones de Gran Maestro y cómo maximizar el impacto del Coloso Galáctico 2×2 + Onda Orbital.',
    tips: [
      'Despliega el Coloso Galáctico 2×2 junto a peones rivales: su onda orbital destruye una pieza menor extra.',
      'Coordina tus Torres en columnas abiertas junto con la presión del Coloso.',
      'Cada jaque fuerza la respuesta del rival; úsalos para ganar tiempos decisivos.'
    ]
  },
  {
    id: 'trainer_blacky',
    name: 'BLACKY (Maestro 3200)',
    role: 'Mentor Supremo de Estrategia Extrema',
    elo: 3200,
    isHardest: true,
    practiceAiDifficulty: 4,
    bossId: 'blacky_secret',
    taughtPowerId: 'power_blacky_claw',
    taughtPowerLabel: '🐾 Dominio Abismal de Blacky (OP)',
    badge: '3200 ELO · MAESTRO SUPREMO',
    description: 'El entrenador más exigente (3200 Elo) con el diseño oficial de Blacky. Te enseña cálculo extremo y el poder más OP: robar incluso la Dama rival.',
    tips: [
      'Grr... no desperdicies Dominio Abismal en un peón: roba la Dama o una Torre activa enemiga.',
      'Al robar una pieza, el Caballo invocado y las 2 casillas selladas crean redes de mate imparables.',
      'En el enlace secreto /blacky no tendré piedad contigo: practica aquí tus mejores combos.'
    ]
  }
];

export const SPECIAL_GAME_MODES = [
  {
    id: 'special_6x6',
    name: 'Mini-Tablero 6×6',
    icon: '📐',
    badge: 'TABLERO 6×6',
    description: '¡Tablero compacto 6×6! El borde exterior desaparece en el vacío: Rey, Dama, 2 Torres, Alfil, Caballo y 6 Peones en combates relámpago.'
  },
  {
    id: 'special_random_powers',
    name: 'Ruleta de Poderes Random',
    icon: '🎰',
    badge: 'CAOS TOTAL · CD 1t',
    description: '¡Cada turno recibes un poder OP ALEATORIO distinto (Pirámide 2×2, Tormenta Dorada, Blacky, Mittens, Coloso, Grietas)! ¡Locura absoluta!'
  },
  {
    id: 'special_all_queens',
    name: 'Invasión de Damas',
    icon: '👑',
    badge: 'ABSURDO',
    description: 'Todos tus peones y piezas menores son DAMAS (8 Damas + 2 Torres + Rey vs ejército igual). ¡Lluvia absurda de jaques desde el turno 1!'
  },
  {
    id: 'special_earthquake',
    name: 'Tablero Terremoto',
    icon: '🌋',
    badge: 'EVENTOS LOCOS',
    description: 'Cada 2 turnos un terremoto abre grietas, teletransporta piezas al azar a otras casillas y muta peones en Torres, Caballos o Alfiles.'
  },
  {
    id: 'special_giants_clash',
    name: 'Guerra de Titanes 2×2',
    icon: '🏛️',
    badge: 'FICHAS GRANDES',
    description: 'Ambos ejércitos comienzan con una Ficha Grande 2×2 en el centro del tablero y poder de aplastamiento 2×2 cada 2 turnos.'
  },
  {
    id: 'special_colossal_12x12',
    name: 'Tablero Colosal 12×12',
    icon: '🗺️',
    badge: '144 CASILLAS · GIGANTE',
    boardSize: 12,
    description: '¡Tablero ABSURDAMENTE GRANDE de 12×12 (144 casillas)! 24 piezas por bando: 3 Torres, 3 Caballos, 3 Alfiles, 2 Damas, 1 Rey y 12 Peones con avance triple.'
  },
  {
    id: 'special_mega_10x10_chaos',
    name: 'Mega-Tablero 10×10 Caos',
    icon: '🌠',
    badge: '100 CASILLAS · MUTANTE',
    boardSize: 10,
    description: 'Tablero enorme 10×10 con doble Dama y mutaciones aleatorias cada 2 turnos que convierten peones en Torres, Caballos o Damas.'
  },
  {
    id: 'special_atomic_boom',
    name: 'Ajedrez Explosivo (Atómico)',
    icon: '💣',
    badge: 'EXPLOSIONES 3×3',
    description: '¡Cada captura detona una explosión 3×3 que volatiliza a TODAS las piezas adyacentes (excepto Reyes)! Un error y vuela medio tablero.'
  },
  {
    id: 'special_cavalry_swarm',
    name: 'Caballería Infinita',
    icon: '🐎',
    badge: 'SOLO CABALLOS',
    description: '¡15 Caballos + 1 Rey contra 15 Caballos + 1 Rey! Saltos en L imposibles de predecir por todo el tablero desde el turno 1.'
  },
  {
    id: 'special_hyper_chaos',
    name: 'Hiper-Caos Mutante',
    icon: '🌀',
    badge: 'CAOS EXTREMO',
    description: 'Ruleta de poderes OP cada turno + terremotos cada 2 turnos + mutaciones sorpresivas en medio de la batalla. ¡Locura total!'
  },
  {
    id: 'special_teams_2v2',
    name: 'Equipos 2 vs 2 (4 Facciones)',
    icon: '🤝',
    badge: 'EQUIPOS · 4 JUGADORES/BOTS',
    boardSize: 10,
    multiPartyVariant: '2v2',
    description: '¡Batalla en Equipos 2 vs 2 en Arena 10×10! Tú (Blanco) + Aliado Cian contra Equipo Carmesí + Ámbar. Protege a tu compañero y derriba ambos Reyes enemigos.'
  },
  {
    id: 'special_ffa_4p',
    name: 'Batalla Real (4 Jugadores)',
    icon: '👑',
    badge: '4 FACCIONES · FFA',
    boardSize: 10,
    multiPartyVariant: 'ffa4',
    description: '¡4 ejércitos (Blanco, Cian, Carmesí y Ámbar) en una arena 10×10 todos contra todos! Turnos rotativos: el último Rey en pie se corona campeón.'
  },
  {
    id: 'special_trio_3p',
    name: 'Triada 3 Facciones (1v1v1)',
    icon: '⚔️',
    badge: '3 JUGADORES / BOTS',
    boardSize: 10,
    multiPartyVariant: 'ffa3',
    description: '¡3 ejércitos en guerra simultánea en arena 10×10 (Blanco vs Carmesí vs Ámbar)! Calcula alianzas temporales y sobrevive hasta el final.'
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

export function toAlg(r, c, boardSize = 8) {
  return `${FILES[c] || '?'}${boardSize - r}`;
}

export function inBounds(r, c, boardSize = 8) {
  return r >= 0 && r < boardSize && c >= 0 && c < boardSize;
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
