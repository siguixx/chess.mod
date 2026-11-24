export const CHAPTER_ORDER = ['maya', 'mittens', 'galaxy', 'glitch', 'chess'];

export const MAYA_CAMPAIGN = {
  id: 'maya',
  chapterNumber: 1,
  title: 'Capítulo 01 — Dios Maya',
  shortTitle: 'Cap. 1 · Dios Maya',
  subtitle: '5 Niveles · Primer Gran Guardián',
  description: 'Primer guardián de la Tierra del Chess. Su caída fracturará el equilibrio antiguo y abrirá las cadenas del siguiente sello.',
  epilogueTitle: 'El Equilibrio se Fractura',
  epilogueText: 'Al derrumbarse las cuatro Bases del Dios Maya, un sello milenario se resquebraja más allá del horizonte. En la prisión astral, unas cadenas rotas resuenan: Free Mittens ha despertado.',
  levels: [
    {
      id: 1,
      key: 'maya_1',
      bossId: 'maya_sentinel',
      name: 'Centinelas de Obsidiana',
      difficultyLabel: 'Fácil',
      aiDifficulty: 1,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 110,
      unitIntroduced: 'Arqueras de Obsidiana (A)',
      briefing: 'Introduce Arqueras de Obsidiana: atacan en diagonal a larga distancia sin moverse, controlando zonas enteras del tablero.',
      openingLine: 'Las flechas de obsidiana vigilan cada diagonal del umbral.'
    },
    {
      id: 2,
      key: 'maya_2',
      bossId: 'maya_jade_guard',
      name: 'Guardia de Jade',
      difficultyLabel: 'Medio-Fácil',
      aiDifficulty: 2,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 150,
      unitIntroduced: 'Escuderos de Jade (G)',
      briefing: 'Introduce Escuderos de Jade: avanzan 1 casilla ortogonal y su escudo absorbe el primer ataque frontal. Flanquéalos o golpea dos veces.',
      openingLine: 'El jade resiste cualquier embate de frente. Busca los flancos o fracasa.'
    },
    {
      id: 3,
      key: 'maya_3',
      bossId: 'maya_jaguar',
      name: 'Acechadores del Jaguar',
      difficultyLabel: 'Medio',
      aiDifficulty: 3,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 200,
      unitIntroduced: 'Jaguares de Piedra (J)',
      briefing: 'Introduce Jaguares de Piedra: saltan exactamente 2 casillas en línea recta pasando por encima de piezas intermedias para emboscar.',
      openingLine: 'El jaguar salta sobre tus defensas cuando menos lo esperas.'
    },
    {
      id: 4,
      key: 'maya_4',
      bossId: 'maya_eclipse',
      name: 'Sacerdotes del Eclipse',
      difficultyLabel: 'Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 270,
      unitIntroduced: 'Chamanes Solares (C) + Arqueras + Escuderos',
      briefing: 'Introduce Chamanes Solares junto con Arqueras y Escuderos: el Chamán se mueve 1 casilla sin capturar y cada 3 turnos empuja a un rival adyacente.',
      openingLine: 'El eclipse desordena tus filas. Solo los dignos verán la Pirámide.'
    },
    {
      id: 5,
      key: 'maya_5',
      bossId: 'rey_maya',
      name: 'Dios Maya',
      difficultyLabel: 'Jefe de Capítulo',
      aiDifficulty: 5,
      isFinalBoss: true,
      hasPyramid: true,
      xpReward: 450,
      unitIntroduced: 'Pirámide 2×2 · 4 Bases · 2 Casas Inmortales',
      briefing: 'JEFE DEL CAPÍTULO 01. Pirámide 2×2 con empujes en cadena y aplastamiento, 4 Bases Sagradas, 2 Casas blancas inmortales y Ultimate Battle.',
      openingLine: 'Has profanado el santuario. Destruye mis cuatro pilares si osas desafiar el equilibrio.'
    }
  ]
};

export const MITTENS_CAMPAIGN = {
  id: 'mittens',
  chapterNumber: 2,
  title: 'Capítulo 02 — Free Mittens',
  shortTitle: 'Cap. 2 · Free Mittens',
  subtitle: '5 Niveles · El Sabio Encarcelado',
  description: 'Sabio ancestral de la galaxia encarcelado por ejecutar jugadas prohibidas de Chess. Liberado tras caer el Dios Maya, juzga a quien alteró las leyes del tablero.',
  epilogueTitle: 'Las Cadenas se Cierran de Nuevo',
  epilogueText: 'Free Mittens inclina la cabeza en silencio mientras las cadenas astrales vuelven a sellarlo. Sin embargo, el cosmos ya percibió su fuga: la Entidad Galáctica desciende con furia.',
  levels: [
    {
      id: 1,
      key: 'mittens_1',
      bossId: 'hombre_peon',
      name: 'Hombre Peón',
      difficultyLabel: 'Fácil',
      aiDifficulty: 2,
      isFinalBoss: false,
      xpReward: 130,
      hasSprinkler: false,
      hasWhiteSoldiers: false,
      transformScope: 'P',
      briefing: 'Constructo humanoide forjado únicamente por peones. SOLO sus Peones se transforman al capturar en la pieza exacta capturada (ej. si un Peón come tu Reina, se vuelve Reina).',
      openingLine: 'Cada paso de mi infantería reclama la forma de aquello que derriba.'
    },
    {
      id: 2,
      key: 'mittens_2',
      bossId: 'hombre_caballo',
      name: 'Hombre Caballo',
      difficultyLabel: 'Medio-Fácil',
      aiDifficulty: 3,
      isFinalBoss: false,
      xpReward: 170,
      hasSprinkler: false,
      hasWhiteSoldiers: false,
      transformScope: 'N',
      briefing: 'Figura humanoide compuesta por caballos de ajedrez. SOLO sus Caballos se transforman al capturar en la pieza exacta que derrotaron.',
      openingLine: 'Mis corceles no solo saltan líneas: adoptan el poder de cada víctima.'
    },
    {
      id: 3,
      key: 'mittens_3',
      bossId: 'hombre_alfil',
      name: 'Hombre Alfil',
      difficultyLabel: 'Medio',
      aiDifficulty: 3,
      isFinalBoss: false,
      xpReward: 210,
      hasSprinkler: false,
      hasWhiteSoldiers: false,
      transformScope: 'B',
      briefing: 'Guardián humanoide compuesto por alfiles. SOLO sus Alfiles se transforman en la pieza exacta que capturan a lo largo de sus diagonales.',
      openingLine: 'Las diagonales dictan sentencia. Cada pieza tuya que caiga servirá a mi geometría.'
    },
    {
      id: 4,
      key: 'mittens_4',
      bossId: 'mujer_reina',
      name: 'Mujer Reina',
      difficultyLabel: 'Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      xpReward: 280,
      hasSprinkler: false,
      hasWhiteSoldiers: false,
      transformScope: 'Q',
      briefing: 'Soberana humanoide esculpida en piezas de Reina. SOLO su Reina asimila cada captura reclutando esa pieza exacta para su corte sin perder su corona.',
      openingLine: 'Mi corona no desciende ante nadie. Todo lo que tomo renace bajo mi mando.'
    },
    {
      id: 5,
      key: 'mittens_5',
      bossId: 'free_mittens',
      name: 'Free Mittens',
      difficultyLabel: 'Jefe de Capítulo',
      aiDifficulty: 5,
      isFinalBoss: true,
      xpReward: 460,
      hasSprinkler: true,
      hasWhiteSoldiers: true,
      transformScope: 'ALL',
      briefing: 'JEFE DEL CAPÍTULO 02. Sabio ancestral de la galaxia. Todas sus piezas :3 asimilan exactamente el tipo de pieza capturada. Dispones de 3 Soldados Blancos con pistolas de agua y el Aspersor inmóvil.',
      openingLine: 'Eras tras eras de encierro por trascender las leyes del Chess... Tú rompiste el equilibrio. Ahora enfrentarás el juicio de la sabiduría prohibida.'
    }
  ]
};

export const GALAXY_CAMPAIGN = {
  id: 'galaxy',
  chapterNumber: 3,
  title: 'Capítulo 03 — Entidad Galáctica',
  shortTitle: 'Cap. 3 · Galaxia',
  subtitle: '5 Niveles · Poderes Hipersobrenaturales',
  description: 'Ser cósmico hecho de nebulosas y estrellas. Enfurecida por la liberación de Mittens, desciende con teletransportes estelares y el colosal Hombre Galaxia 2×2.',
  epilogueTitle: 'La Intervención del Sabio',
  epilogueText: 'En el instante en que caen todos sus Alfiles y Caballos, la Entidad Galáctica vacila... Un destello blanco cruza el cosmos: Free Mittens ejecuta una jugada imposible en su descuido, fracturando el núcleo estelar. Pero el choque sobrecarga el código de CHESS.MOD...',
  levels: [
    {
      id: 1,
      key: 'galaxy_1',
      bossId: 'galaxy_herald',
      name: 'Heraldos de Nebulosa',
      difficultyLabel: 'Medio',
      aiDifficulty: 3,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 4,
      xpReward: 180,
      unitIntroduced: 'Piezas Galácticas + Barrera Universal',
      briefing: 'Las piezas estelares juegan limpio pero pueden teletransportarse cada 4 turnos. Despliega tus 2 Barreras Universales inmortales para bloquear rutas.',
      openingLine: 'Liberaste al prisionero prohibido. El cosmos exigirá tu rendición.'
    },
    {
      id: 2,
      key: 'galaxy_2',
      bossId: 'galaxy_weaver',
      name: 'Tejedores de Constelación',
      difficultyLabel: 'Medio-Difícil',
      aiDifficulty: 3,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 3,
      xpReward: 220,
      unitIntroduced: 'Teletransporte Galáctico (3t)',
      briefing: 'Teletransporte cada 3 turnos con presión en columnas abiertas. Recuerda: tu Barrera Universal protege de poderes, pero no impide capturas normales alrededor.',
      openingLine: 'Las constelaciones no persiguen el tablero: se pliegan sobre él.'
    },
    {
      id: 3,
      key: 'galaxy_3',
      bossId: 'galaxy_warden',
      name: 'Centinelas del Horizonte',
      difficultyLabel: 'Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 3,
      xpReward: 270,
      unitIntroduced: 'Flanqueo Cósmico',
      briefing: 'Coordinación estricta de Alfiles y Caballos galácticos con teletransporte táctico.',
      openingLine: 'Tus barreras son sólidas, mas tus flancos permanecen expuestos al vacío.'
    },
    {
      id: 4,
      key: 'galaxy_4',
      bossId: 'galaxy_archon',
      name: 'Arconte Estelar',
      difficultyLabel: 'Muy Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 2,
      xpReward: 330,
      unitIntroduced: 'Pulso de Teletransporte (2t)',
      briefing: 'Antesala del núcleo galáctico. Teletransporte cada 2 turnos y cálculo táctico profundo.',
      openingLine: 'Un paso más y te enfrentarás al cuerpo viviente de la galaxia.'
    },
    {
      id: 5,
      key: 'galaxy_5',
      bossId: 'galaxy_entity',
      name: 'Entidad Galáctica',
      difficultyLabel: 'Jefe de Capítulo',
      aiDifficulty: 5,
      isFinalBoss: true,
      hasGalaxyMan: true,
      teleportCooldown: 3,
      xpReward: 520,
      unitIntroduced: 'Hombre Galaxia 2×2 (Torre) · 2 Barreras Universales',
      briefing: 'JEFE DEL CAPÍTULO 03. El Hombre Galaxia ocupa un bloque 2×2 y se mueve como Torre. Es invulnerable: elimina TODOS los Alfiles y Caballos enemigos para abrir el golpe decisivo.',
      openingLine: 'Por tu insolencia liberaste a Free Mittens. ¡Afronta el peso entero de las estrellas!'
    }
  ]
};

export const GLITCH_CAMPAIGN = {
  id: 'glitch',
  chapterNumber: 4,
  title: 'Capítulo 04 — Boss Glitch',
  shortTitle: 'Cap. 4 · Boss Glitch',
  subtitle: '5 Niveles · Súper Difícil · Corrupción de CHESS.MOD',
  description: 'La batalla cósmica corrompe la realidad de CHESS.MOD. El tablero se rasga en grietas de vacío y las leyes clásicas del ajedrez se fracturan.',
  epilogueTitle: 'Expulsión al Plano Puro',
  epilogueText: 'El núcleo del Boss Glitch colapsa sobre sí mismo, absorbiendo toda anomalía y expulsándote fuera del código corrupto hacia un plano silencioso y blanco: el origen mismo de CHESS.',
  levels: [
    {
      id: 1,
      key: 'glitch_1',
      bossId: 'glitch_shard',
      name: 'Fragmento de Memoria',
      difficultyLabel: 'Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      riftInterval: 4,
      allowAnomalies: false,
      xpReward: 240,
      unitIntroduced: 'Grietas de Vacío (Rasgado)',
      briefing: 'Cada 4 turnos el tablero se rasga creando Grietas de Vacío infranqueables.',
      openingLine: 'ERR_01:: La geometría del tablero empieza a sangrar píxeles.'
    },
    {
      id: 2,
      key: 'glitch_2',
      bossId: 'glitch_pawn_err',
      name: 'Peones Desincronizados',
      difficultyLabel: 'Muy Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      riftInterval: 4,
      allowAnomalies: true,
      anomalyLevel: 1,
      xpReward: 290,
      unitIntroduced: 'Peones Anómalos',
      briefing: 'Peones corruptos pueden atacar de frente o retroceder 1 casilla rompiendo las leyes clásicas.',
      openingLine: 'RULE_BREACH:: ¿Quién decidió que un peón solo camina hacia adelante?'
    },
    {
      id: 3,
      key: 'glitch_3',
      bossId: 'glitch_knight_err',
      name: 'Saltos Corruptos',
      difficultyLabel: 'Muy Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      riftInterval: 3,
      allowAnomalies: true,
      anomalyLevel: 2,
      xpReward: 340,
      unitIntroduced: 'Grietas + Caballos Anómalos',
      briefing: 'Grietas cada 3 turnos combinadas con saltos anómalos de Caballos corruptos.',
      openingLine: 'STACK_OVERFLOW:: Tus líneas seguras ya no existen en esta realidad.'
    },
    {
      id: 4,
      key: 'glitch_4',
      bossId: 'glitch_core',
      name: 'Núcleo Inestable',
      difficultyLabel: 'Súper Difícil',
      aiDifficulty: 5,
      isFinalBoss: false,
      riftInterval: 3,
      allowAnomalies: true,
      anomalyLevel: 3,
      xpReward: 400,
      unitIntroduced: 'Intercambio de Furia + Grietas',
      briefing: 'Máxima distorsión antes del jefe: grietas constantes, anomalías y permutaciones súbitas.',
      openingLine: 'CRITICAL_FAULT:: CHESS.MOD ya no responde a tus reglas.'
    },
    {
      id: 5,
      key: 'glitch_5',
      bossId: 'boss_glitch',
      name: 'Boss Glitch',
      difficultyLabel: 'Jefe Súper Difícil',
      aiDifficulty: 5,
      isFinalBoss: true,
      riftInterval: 2,
      allowAnomalies: true,
      anomalyLevel: 4,
      xpReward: 600,
      unitIntroduced: 'Rasgado Masivo + Ruptura de Leyes',
      briefing: 'JEFE DEL CAPÍTULO 04 (SÚPER DIFÍCIL). Rasga el tablero cada 2 turnos, ejecuta jugadas ilegales corruptas y activa permutaciones en fase de furia.',
      openingLine: 'FATAL_REALITY_TEAR:: Soy la fractura de todo lo que jugaste. ¡Cae conmigo!'
    }
  ]
};

export const CHESS_CAMPAIGN = {
  id: 'chess',
  chapterNumber: 5,
  title: 'Capítulo 05 — CHESS',
  shortTitle: 'Cap. 5 · CHESS',
  subtitle: '5 Niveles · Jefe Final Absoluto · Estrategia Pura',
  description: 'Expulsado a un plano silencioso y eterno, enfrentas el origen del juego: CHESS. Sin poderes sobrenaturales enemigos, solo cálculo implacable.',
  epilogueTitle: 'VENCEDOR DE CHESS',
  epilogueText: 'El tablero eterno guarda silencio. Has superado al Dios Maya, al Sabio Free Mittens, a la Entidad Galáctica, a la Corrupción del Glitch y al propio CHESS. Has desbloqueado el título y marco exclusivo «Vencedor de Chess».',
  levels: [
    {
      id: 1,
      key: 'chess_1',
      bossId: 'chess_legion',
      name: 'Legión de Peones y Caballos',
      difficultyLabel: 'Extremo I',
      aiDifficulty: 4,
      isFinalBoss: false,
      thinkTimeMs: 450,
      maxDepth: 4,
      xpReward: 320,
      unitIntroduced: 'Estrategia Pura · Sin Poderes Enemigos',
      briefing: 'Enfrentamiento clásico de altísima precisión contra la vanguardia encarnada del ajedrez.',
      openingLine: 'Sin trucos. Sin milagros. Solo el tablero y el cálculo.'
    },
    {
      id: 2,
      key: 'chess_2',
      bossId: 'chess_towers',
      name: 'Maestros de Alfiles y Torres',
      difficultyLabel: 'Extremo II',
      aiDifficulty: 5,
      isFinalBoss: false,
      thinkTimeMs: 650,
      maxDepth: 4,
      xpReward: 380,
      unitIntroduced: 'Dominio de Columnas y Diagonales',
      briefing: 'Precisión posicional implacable con Quiescence Search y tablas de evaluación.',
      openingLine: 'Cada debilidad estructural será castigada sin piedad.'
    },
    {
      id: 3,
      key: 'chess_3',
      bossId: 'chess_queen',
      name: 'La Dama Absoluta',
      difficultyLabel: 'Extremo III',
      aiDifficulty: 5,
      isFinalBoss: false,
      thinkTimeMs: 800,
      maxDepth: 5,
      xpReward: 450,
      unitIntroduced: 'Presión Táctica Profunda',
      briefing: 'Motor profundo con libro de aperturas y poda Alfa-Beta iterativa.',
      openingLine: 'Una sola imprecisión y el ataque será irreversible.'
    },
    {
      id: 4,
      key: 'chess_4',
      bossId: 'chess_court',
      name: 'La Corte Real Perfecta',
      difficultyLabel: 'Extremo IV',
      aiDifficulty: 5,
      isFinalBoss: false,
      thinkTimeMs: 950,
      maxDepth: 5,
      xpReward: 520,
      unitIntroduced: 'Antesala del Origen',
      briefing: 'La prueba táctica definitiva antes de elegir tu poder y desafiar a CHESS.',
      openingLine: 'Demuestra que mereces pararte frente al origen del juego.'
    },
    {
      id: 5,
      key: 'chess_5',
      bossId: 'chess_god',
      name: 'CHESS',
      difficultyLabel: 'JEFE FINAL ABSOLUTO',
      aiDifficulty: 5,
      isFinalBoss: true,
      requiresPowerChoice: true,
      thinkTimeMs: 1200,
      maxDepth: 5,
      xpReward: 800,
      unitIntroduced: 'Súper IA (Web Worker) · Elige 1 de 3 Poderes',
      briefing: 'JEFE FINAL ABSOLUTO. CHESS no usa poderes sobrenaturales: solo estrategia magistral pura. Antes de iniciar DEBES elegir 1 poder: Mittens, Torre del Dios Maya o Galaxia.',
      openingLine: 'No necesito pirámides, cadenas, estrellas ni grietas. Soy CHESS. Elige tu poder... y aun así intenta vencerme.'
    }
  ]
};

export const ALL_CAMPAIGNS = [
  MAYA_CAMPAIGN,
  MITTENS_CAMPAIGN,
  GALAXY_CAMPAIGN,
  GLITCH_CAMPAIGN,
  CHESS_CAMPAIGN
];

export const CAMPAIGN_MAP = {
  maya: MAYA_CAMPAIGN,
  mittens: MITTENS_CAMPAIGN,
  galaxy: GALAXY_CAMPAIGN,
  glitch: GLITCH_CAMPAIGN,
  chess: CHESS_CAMPAIGN
};

export function getCampaign(campaignId) {
  return CAMPAIGN_MAP[campaignId] || MAYA_CAMPAIGN;
}

export function getCampaignLevel(campaignId, levelId) {
  const c = CAMPAIGN_MAP[campaignId];
  if (!c) return null;
  return c.levels.find((l) => l.id === Number(levelId)) || null;
}

/**
 * Validación ESTRICTA de desbloqueo secuencial de capítulos y niveles:
 * - Capítulo 1 (maya) siempre desbloqueado.
 * - Capítulo N (2..5) requiere haber completado Nivel 5 del Capítulo N-1.
 * - Dentro de un capítulo, Nivel 1 siempre desbloqueado si el capítulo lo está;
 *   Nivel K (2..5) requiere haber completado TODOS los niveles 1..(K-1).
 */
export function isChapterUnlocked(campaignId, campaignsProgress = {}) {
  const idx = CHAPTER_ORDER.indexOf(campaignId);
  if (idx === -1) return false;
  if (idx === 0) return true;
  const prevId = CHAPTER_ORDER[idx - 1];
  const prevDone = campaignsProgress[prevId]?.completedLevels || [];
  return prevDone.includes(5);
}

export function isCampaignLevelUnlocked(campaignId, levelId, campaignsProgress = {}) {
  const lvl = Number(levelId);
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > 5) return false;
  if (!isChapterUnlocked(campaignId, campaignsProgress)) return false;
  if (lvl === 1) return true;
  const done = campaignsProgress[campaignId]?.completedLevels || [];
  for (let req = 1; req < lvl; req++) {
    if (!done.includes(req)) return false;
  }
  return true;
}

export function getCampaignUnlockReason(campaignId, levelId, campaignsProgress = {}) {
  const idx = CHAPTER_ORDER.indexOf(campaignId);
  if (idx > 0 && !isChapterUnlocked(campaignId, campaignsProgress)) {
    const prevCamp = CAMPAIGN_MAP[CHAPTER_ORDER[idx - 1]];
    return `Derrota primero a ${prevCamp.levels[4].name} (Nivel 5 del Capítulo 0${idx}) para desbloquear este capítulo.`;
  }
  const lvl = Number(levelId);
  if (lvl > 1 && !isCampaignLevelUnlocked(campaignId, lvl, campaignsProgress)) {
    return `Completa primero los niveles 1 a ${lvl - 1} de este capítulo sin saltarte ninguno.`;
  }
  return '';
}
