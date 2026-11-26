export const CHAPTER_ORDER = ['maya', 'mittens', 'galaxy', 'glitch', 'chess'];

export const MAYA_CAMPAIGN = {
  id: 'maya',
  chapterNumber: 1,
  title: 'Capítulo 01 — Dios Maya',
  shortTitle: 'Cap. 1 · Dios Maya',
  subtitle: '5 Niveles · Muy Fácil → Medio · Guardián de la Vía Láctea',
  loreAct: 'ACTO I · EL MEJOR JUGADOR DEL MUNDO',
  loreSummary: 'Eres considerado el mejor jugador de ajedrez del mundo. Al no quedar ningún mortal capaz de desafiarte, decides enfrentar al Dios del Chess Maya: el guardián ancestral del chess de la Vía Láctea.',
  description: 'Eres el mejor jugador de ajedrez del mundo y decides desafiar al Dios del Chess Maya, guardián del chess de la Vía Láctea. Comienza con tus Casas Inmortales y escala hasta la Pirámide 2×2.',
  epilogueTitle: 'La Energía Prohibida se Libera',
  epilogueText: 'Al vencer al Dios del Chess Maya, guardián de la Vía Láctea, una energía ancestral colosal se libera por el tablero cósmico. Ese estallido rompe las reglas convencionales del chess... y libera a Mittens.',
  levels: [
    {
      id: 1,
      key: 'maya_1',
      bossId: 'maya_sentinel',
      name: 'Centinelas de Obsidiana',
      difficultyLabel: 'Muy Fácil',
      aiDifficulty: 1,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 110,
      unitIntroduced: '2 Arqueras (A) · Defensa: 1 Casa Inmortal (d3)',
      briefing: 'Nivel introductorio sin Dama enemiga. Sus 2 Arqueras disparan en diagonal hasta 3 casillas, pero tu Casa Inmortal en d3 escuda a las piezas adyacentes contra flechas.',
      openingLine: 'Las flechas de obsidiana vigilan el umbral. Usa tu Casa sagrada para cubrir tu avance.'
    },
    {
      id: 2,
      key: 'maya_2',
      bossId: 'maya_jade_guard',
      name: 'Guardia de Jade',
      difficultyLabel: 'Fácil',
      aiDifficulty: 1,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 150,
      unitIntroduced: '2 Escuderos de Jade (G) · Defensa: 1 Casa Inmortal',
      briefing: 'Introduce 2 Escuderos de Jade (sin Dama enemiga): su escudo absorbe el primer golpe frontal. Flanquéalos o golpea dos veces mientras tu Casa asegura el centro.',
      openingLine: 'El jade resiste un embate de frente. Busca los flancos o golpea dos veces.'
    },
    {
      id: 3,
      key: 'maya_3',
      bossId: 'maya_jaguar',
      name: 'Acechadores del Jaguar',
      difficultyLabel: 'Fácil-Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 200,
      unitIntroduced: '3 Jaguares (J) · Defensa: 2 Casas Inmortales',
      briefing: 'Introduce 3 Jaguares de Piedra que saltan 2 casillas en línea recta. Ahora despliegas 2 Casas Inmortales (c3, f3) que impiden a los Jaguares caer sobre piezas protegidas.',
      openingLine: 'El jaguar salta sobre tus líneas, mas tus Casas detendrán su emboscada.'
    },
    {
      id: 4,
      key: 'maya_4',
      bossId: 'maya_eclipse',
      name: 'Sacerdotes del Eclipse',
      difficultyLabel: 'Medio',
      aiDifficulty: 3,
      isFinalBoss: false,
      hasPyramid: false,
      xpReward: 270,
      unitIntroduced: 'Chamán Solar (C) + Arqueras + Escuderos · 2 Casas',
      briefing: 'Antesala del jefe: el Chamán Solar empuja rivales cada 4 turnos junto a Arqueras y Escuderos. Tus 2 Casas Inmortales (c3, f3) bloquean flechas y empujes solares.',
      openingLine: 'El eclipse pondrá a prueba tus defensas antes de ver la Pirámide.'
    },
    {
      id: 5,
      key: 'maya_5',
      bossId: 'rey_maya',
      name: 'Dios Maya',
      difficultyLabel: 'Jefe Cap. 1 · Medio',
      aiDifficulty: 3,
      isFinalBoss: true,
      hasPyramid: true,
      xpReward: 450,
      unitIntroduced: 'Pirámide 2×2 · 4 Bases · 2 Casas Inmortales',
      briefing: 'JEFE DEL CAPÍTULO 01. Pirámide 2×2 con empujes y aplastamiento, 4 Bases Sagradas (cada Base rota inactiva la Pirámide 3 turnos) y 2 Casas blancas inmortales.',
      openingLine: 'Has profanado el santuario. Destruye mis cuatro pilares si osas desafiar el equilibrio.'
    }
  ]
};

export const MITTENS_CAMPAIGN = {
  id: 'mittens',
  chapterNumber: 2,
  title: 'Capítulo 02 — Free Mittens',
  shortTitle: 'Cap. 2 · Free Mittens',
  subtitle: '5 Niveles · Fácil → Medio-Difícil · Libre de las Reglas',
  loreAct: 'ACTO II · MITTENS SE LIBERA DE LAS REGLAS',
  loreSummary: 'La energía liberada tras derrotar al Dios del Chess Maya rompió el sello de Mittens. Ahora libre de las reglas convencionales del chess, necesita enfrentarse a ti para comprobar tu verdadero poder.',
  description: 'Mittens se liberó de las reglas convencionales del chess tras caer el Dios Maya y busca medir tu poder. Defiéndete con Soldados Blancos de pistolas de agua y el Aspersor táctico.',
  epilogueTitle: 'Capturado por la Entidad Galaxiana',
  epilogueText: 'Tras perder contra ti, Mittens queda debilitado y es capturado por la Entidad Galaxiana, que desciende para contener la anomalía cósmica... y ahora vuelve su mirada hacia ti.',
  levels: [
    {
      id: 1,
      key: 'mittens_1',
      bossId: 'hombre_peon',
      name: 'Hombre Peón',
      difficultyLabel: 'Fácil',
      aiDifficulty: 1,
      isFinalBoss: false,
      xpReward: 130,
      hasSprinkler: false,
      hasWhiteSoldiers: true,
      transformScope: 'P',
      unitIntroduced: 'Peones Transformables · Defensa: 2 Soldados Agua',
      briefing: 'Sin Dama enemiga. SOLO sus Peones se transforman en la pieza capturada. Cuentas con 2 Soldados Blancos (b2, g2) con pistolas de agua para repelerlos sin moverte.',
      openingLine: 'Cada paso de mi infantería reclama la forma de aquello que derriba.'
    },
    {
      id: 2,
      key: 'mittens_2',
      bossId: 'hombre_caballo',
      name: 'Hombre Caballo',
      difficultyLabel: 'Fácil-Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      xpReward: 170,
      hasSprinkler: false,
      hasWhiteSoldiers: true,
      transformScope: 'N',
      unitIntroduced: '3 Caballos Transformables · Defensa: 2 Soldados Agua',
      briefing: 'Sin Dama enemiga. SOLO sus Caballos se transforman al capturar. Usa tus 2 Soldados Blancos (b2, g2) para empujar a la caballería lejos de tus piezas valiosas.',
      openingLine: 'Mis corceles no solo saltan líneas: adoptan el poder de cada víctima.'
    },
    {
      id: 3,
      key: 'mittens_3',
      bossId: 'hombre_alfil',
      name: 'Hombre Alfil',
      difficultyLabel: 'Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      xpReward: 210,
      hasSprinkler: true,
      hasWhiteSoldiers: true,
      transformScope: 'B',
      unitIntroduced: '3 Alfiles Transformables · 2 Soldados + Aspersor d4',
      briefing: 'SOLO sus Alfiles se transforman al capturar. Ahora cuentas con 2 Soldados de agua y el Aspersor inmóvil en d4 para cortar sus diagonales centrales.',
      openingLine: 'Las diagonales dictan sentencia. Cada pieza tuya que caiga servirá a mi geometría.'
    },
    {
      id: 4,
      key: 'mittens_4',
      bossId: 'mujer_reina',
      name: 'Mujer Reina',
      difficultyLabel: 'Medio-Difícil',
      aiDifficulty: 3,
      isFinalBoss: false,
      xpReward: 280,
      hasSprinkler: true,
      hasWhiteSoldiers: true,
      transformScope: 'Q',
      unitIntroduced: 'Reina Asimiladora · Defensa: 3 Soldados + Aspersor',
      briefing: 'SOLO su Reina recluta la pieza exacta que captura sin perder su corona. Despliegas 3 Soldados Blancos (b2, d2, g2) y el Aspersor en d4 para frenarla.',
      openingLine: 'Mi corona no desciende ante nadie. Todo lo que tomo renace bajo mi mando.'
    },
    {
      id: 5,
      key: 'mittens_5',
      bossId: 'free_mittens',
      name: 'Free Mittens',
      difficultyLabel: 'Jefe Cap. 2 · Medio-Difícil',
      aiDifficulty: 3,
      isFinalBoss: true,
      xpReward: 460,
      hasSprinkler: true,
      hasWhiteSoldiers: true,
      transformScope: 'ALL',
      unitIntroduced: 'Asimilación 1:1 Total · 3 Soldados + Aspersor d4',
      briefing: 'JEFE DEL CAPÍTULO 02. Todas sus piezas :3 asimilan exactamente el tipo capturado. Defiéndete con 3 Soldados Blancos con pistolas de agua y el Aspersor en d4.',
      openingLine: 'Eras tras eras de encierro por trascender las leyes del Chess... Ahora enfrentarás el juicio de la sabiduría prohibida.'
    }
  ]
};

export const GALAXY_CAMPAIGN = {
  id: 'galaxy',
  chapterNumber: 3,
  title: 'Capítulo 03 — Entidad Galáctica',
  shortTitle: 'Cap. 3 · Galaxia',
  subtitle: '5 Niveles · Fácil-Medio → Difícil · La Entidad Galaxiana',
  loreAct: 'ACTO III · LA ENTIDAD GALAXIANA',
  loreSummary: 'La Entidad Galaxiana capturó a Free Mittens tras su derrota y ahora intenta juzgarte y contenerte a ti también. Enfrentarla con toda tu fuerza amenaza con quebrar el universo mismo.',
  description: 'La Entidad Galaxiana capturó a Mittens tras su derrota y desciende con teletransportes estelares y su Galaxia Espiral 2×2. Vencerla desatará una fractura capaz de romper el universo.',
  epilogueTitle: 'La Realidad se Rompe',
  epilogueText: 'Al ganarle a la Entidad Galaxiana, el choque de fuerzas rompe el universo entero y rasga la realidad. El tejido cósmico colapsa y caes directamente hacia el Plano Glitch.',
  levels: [
    {
      id: 1,
      key: 'galaxy_1',
      bossId: 'galaxy_herald',
      name: 'Explorador Cometa',
      difficultyLabel: 'Fácil-Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 6,
      xpReward: 180,
      unitIntroduced: '☄️ Estela Cometa (Teletransporte 6t) · 2 Barreras',
      briefing: 'El Explorador Cometa surca el tablero con saltos de cometa cada 6 turnos. Tus 2 Barreras Universales inmortales (c3, f3) bloquean el paso e impiden saltos adyacentes.',
      openingLine: '¡Mi estela de hielo cósmico te alcanzará antes de que termines tu apertura!'
    },
    {
      id: 2,
      key: 'galaxy_2',
      bossId: 'galaxy_weaver',
      name: 'Centinela Púlsar',
      difficultyLabel: 'Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 5,
      xpReward: 220,
      unitIntroduced: '💫 Pulso Gravitatorio (4t) + Salto (5t) · 2 Barreras',
      briefing: 'El Centinela Púlsar emite ondas gravitatorias cada 4 turnos que empujan 1 pieza blanca sin escudo hacia atrás. Protege tus filas junto a tus Barreras Universales.',
      openingLine: 'Cada pulso de mi estrella altera la gravedad de tu formación.'
    },
    {
      id: 3,
      key: 'galaxy_3',
      bossId: 'galaxy_warden',
      name: 'Tejedora de Nebulosa',
      difficultyLabel: 'Medio',
      aiDifficulty: 3,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 4,
      xpReward: 270,
      unitIntroduced: '🌫️ Velo de Nebulosa (Salto 4t) · 2 Barreras',
      briefing: 'La Tejedora de Nebulosa despliega su ejército estelar completo con teletransportes cada 4 turnos para flanquear tus líneas. Sella columnas con tus Barreras.',
      openingLine: 'Tus barreras brillan, mas la nebulosa rodea todo cuanto existe.'
    },
    {
      id: 4,
      key: 'galaxy_4',
      bossId: 'galaxy_archon',
      name: 'Guardián Quásar',
      difficultyLabel: 'Medio-Difícil',
      aiDifficulty: 3,
      isFinalBoss: false,
      hasGalaxyMan: false,
      teleportCooldown: 4,
      xpReward: 330,
      unitIntroduced: '☀️ Llamarada Quásar (Pulso + Salto 4t) · 2 Barreras',
      briefing: 'El Guardián Quásar combina pulsos gravitatorios y teletransportes rápidos antes del trono estelar. Mantén tus 2 Barreras activas.',
      openingLine: 'Supera la radiación del quásar o arde antes de ver a la Galaxia viviente.'
    },
    {
      id: 5,
      key: 'galaxy_5',
      bossId: 'galaxy_entity',
      name: 'Entidad Galáctica',
      difficultyLabel: 'Jefe Cap. 3 · Difícil',
      aiDifficulty: 4,
      isFinalBoss: true,
      hasGalaxyMan: true,
      teleportCooldown: 4,
      xpReward: 520,
      unitIntroduced: '🌌 Galaxia Espiral 2×2 (Torre) · 2 Barreras Universales',
      briefing: 'JEFE DEL CAPÍTULO 03. La Galaxia Espiral 2×2 se mueve como Torre y es invulnerable. Cubre tus piezas con las 2 Barreras Universales y elimina TODOS los Alfiles y Caballos enemigos para ganar.',
      openingLine: 'Por tu insolencia liberaste a Free Mittens. ¡Afronta el peso entero de las estrellas!'
    }
  ]
};

export const GLITCH_CAMPAIGN = {
  id: 'glitch',
  chapterNumber: 4,
  title: 'Capítulo 04 — Boss Glitch',
  shortTitle: 'Cap. 4 · Boss Glitch',
  subtitle: '5 Niveles · Medio → Difícil · El Plano Glitch',
  loreAct: 'ACTO IV · EL PLANO GLITCH',
  loreSummary: 'Al romper el universo tras vencer a la Entidad Galaxiana, caíste al Plano Glitch. Aquí la realidad está corrompida y sus 5 niveles deforman las reglas del ajedrez hasta el propio Boss Glitch.',
  description: 'Rompimos el universo y caímos al Plano Glitch. El tablero se rasga en grietas de vacío, pero despliegas 2 Barreras Cortafuegos capaces de sellar grietas y bloquear anomalías.',
  epilogueTitle: 'Ascenso al Plano Astral de CHESS',
  epilogueText: 'Al vencer a Boss Glitch, el código roto se disuelve y eres arrastrado fuera de la corrupción hacia un Plano Astral silencioso y eterno: el Plano de CHESS.',
  levels: [
    {
      id: 1,
      key: 'glitch_1',
      bossId: 'glitch_shard',
      name: 'Bit Corrupto',
      difficultyLabel: 'Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      riftInterval: 5,
      allowAnomalies: false,
      xpReward: 240,
      unitIntroduced: '🟩 Desfase de Bits (Grietas 5t) · 2 Cortafuegos',
      briefing: 'El Bit Corrupto abre Grietas de Vacío cada 5 turnos y altera la textura del tablero. Tus 2 Cortafuegos inmortales (c3, f3) sellan Grietas al pisarlas.',
      openingLine: '0x01_BIT_ERR:: La geometría del tablero empieza a fragmentarse en píxeles.'
    },
    {
      id: 2,
      key: 'glitch_2',
      bossId: 'glitch_pawn_err',
      name: 'Gusano de Memoria',
      difficultyLabel: 'Medio',
      aiDifficulty: 2,
      isFinalBoss: false,
      riftInterval: 5,
      allowAnomalies: true,
      anomalyLevel: 1,
      xpReward: 290,
      unitIntroduced: '🪱 Gusano de Memoria (Peones Anómalos) · 2 Cortafuegos',
      briefing: 'El Gusano de Memoria corrompe a sus peones para atacar de frente o retroceder. Tus 2 Cortafuegos protegen a piezas adyacentes y sellan Grietas.',
      openingLine: 'MEM_WORM:: ¿Quién programó que un peón solo camina hacia adelante?'
    },
    {
      id: 3,
      key: 'glitch_3',
      bossId: 'glitch_knight_err',
      name: 'Caballero Troyano',
      difficultyLabel: 'Medio-Difícil',
      aiDifficulty: 3,
      isFinalBoss: false,
      riftInterval: 4,
      allowAnomalies: true,
      anomalyLevel: 2,
      xpReward: 340,
      unitIntroduced: '🐴 Caballería Troyana (Salto 3×1 + Grietas 4t)',
      briefing: 'El Caballero Troyano inyecta caballos con salto largo anómalo (3,1) y abre grietas cada 4 turnos. Mantén tus piezas clave escoltadas por los Cortafuegos.',
      openingLine: '0xDEAD_TROJAN:: He infectado tu flanco con saltos imposibles.'
    },
    {
      id: 4,
      key: 'glitch_4',
      bossId: 'glitch_core',
      name: 'Demonio Kernel',
      difficultyLabel: 'Difícil',
      aiDifficulty: 3,
      isFinalBoss: false,
      riftInterval: 4,
      allowAnomalies: true,
      anomalyLevel: 3,
      xpReward: 400,
      unitIntroduced: '💀 Sobrecarga Kernel (Fury Swap + 3 Grietas)',
      briefing: 'El Demonio Kernel provoca intercambios de furia entre sus piezas cada 5 turnos y rasga 3 grietas simultáneas antes del Boss Glitch.',
      openingLine: 'KERNEL_PANIC:: El núcleo de CHESS.MOD ya no responde a tus leyes.'
    },
    {
      id: 5,
      key: 'glitch_5',
      bossId: 'boss_glitch',
      name: 'Boss Glitch',
      difficultyLabel: 'Jefe Cap. 4 · Difícil',
      aiDifficulty: 4,
      isFinalBoss: true,
      riftInterval: 3,
      allowAnomalies: true,
      anomalyLevel: 4,
      xpReward: 600,
      unitIntroduced: '💥 Rasgado Total (3t) + Anomalías · 2 Cortafuegos',
      briefing: 'JEFE DEL CAPÍTULO 04. Rasga el tablero cada 3 turnos, muta la textura del tablero y usa todas las anomalías. Sella grietas con tus 2 Cortafuegos.',
      openingLine: 'FATAL_REALITY_TEAR:: Soy la fractura de todo lo que jugaste. ¡Cae conmigo!'
    }
  ]
};

export const CHESS_CAMPAIGN = {
  id: 'chess',
  chapterNumber: 5,
  title: 'Capítulo 05 — CHESS',
  shortTitle: 'Cap. 5 · CHESS',
  subtitle: '5 Niveles · Plano Astral de CHESS · Ajedrez 100% Limpio',
  loreAct: 'ACTO V · EL PLANO ASTRAL DE CHESS',
  loreSummary: 'Has llegado al Plano Astral de CHESS. Pelea primero contra los guardianes del plano y al final enfrenta a CHESS: si le ganas, restaurará todo hasta antes del Dios Maya conservando tus recuerdos; si pierdes, te entregará a la entidad que conserva a todos.',
  description: 'En el Plano Astral de CHESS enfrentas a todos sus guardianes y finalmente al propio CHESS. Si le ganas restaurará todo hasta antes de enfrentar al Dios Maya conservando tus recuerdos; si pierdes, te entrega a la entidad que conserva a todos.',
  defeatLore: 'CHESS dicta sentencia en el Plano Astral y te entrega a la entidad que conserva a todos los vencidos en la eternidad... (Solo lore: puedes reintentar el combate cuantas veces quieras).',
  epilogueTitle: 'VENCEDOR DE CHESS · UNIVERSO RESTAURADO',
  epilogueText: 'CHESS cumple su palabra y restaura la realidad hasta antes de enfrentar al Dios Maya, permitiéndote conservar todos tus recuerdos y otorgándote el logro exclusivo «Vencedor de Chess»... pero en su descuido, algo despertó.',
  levels: [
    {
      id: 1,
      key: 'chess_1',
      bossId: 'chess_legion',
      name: 'Aprendiz de Marfil',
      difficultyLabel: 'Medio-Fácil',
      aiDifficulty: 2,
      isFinalBoss: false,
      thinkTimeMs: 220,
      maxDepth: 1,
      qDepth: 1,
      aiNoise: 130,
      blunderChance: 0.28,
      useBook: false,
      xpReward: 320,
      unitIntroduced: '♟️ Apertura Académica · Ajedrez 100% Limpio',
      briefing: 'El Aprendiz de Marfil custodia la entrada al Plano Puro con juego limpio y clásico. Desarrolla tus piezas y castiga sus errores posicionales.',
      openingLine: 'Bienvenido al Plano Puro. Aquí solo cuenta la elegancia de tus jugadas.'
    },
    {
      id: 2,
      key: 'chess_2',
      bossId: 'chess_towers',
      name: 'Táctico de Caoba',
      difficultyLabel: 'Medio',
      aiDifficulty: 3,
      isFinalBoss: false,
      thinkTimeMs: 300,
      maxDepth: 2,
      qDepth: 1,
      aiNoise: 95,
      blunderChance: 0.20,
      useBook: false,
      xpReward: 380,
      unitIntroduced: '⏳ Reloj Táctico · Columnas y Diagonales Limpias',
      briefing: 'El Táctico de Caoba domina clavadas y columnas abiertas sin poderes sobrenaturales. Controla el centro y protege tu enroque.',
      openingLine: 'Mi monóculo lee cada clavada y cada diagonal que descuidas.'
    },
    {
      id: 3,
      key: 'chess_3',
      bossId: 'chess_queen',
      name: 'Gran Maestro de Platino',
      difficultyLabel: 'Medio-Difícil',
      aiDifficulty: 3,
      isFinalBoss: false,
      thinkTimeMs: 420,
      maxDepth: 2,
      qDepth: 2,
      aiNoise: 65,
      blunderChance: 0.14,
      useBook: true,
      xpReward: 450,
      unitIntroduced: '🏛️ Teoría de Maestros · Libro de Aperturas',
      briefing: 'El Gran Maestro de Platino responde con teoría clásica de aperturas y combinaciones tácticas puras.',
      openingLine: 'Cada tiempo perdido en la apertura se paga en el final.'
    },
    {
      id: 4,
      key: 'chess_4',
      bossId: 'chess_court',
      name: 'Arquitecto del Tablero',
      difficultyLabel: 'Difícil',
      aiDifficulty: 4,
      isFinalBoss: false,
      thinkTimeMs: 550,
      maxDepth: 3,
      qDepth: 2,
      aiNoise: 45,
      blunderChance: 0.08,
      useBook: true,
      xpReward: 520,
      unitIntroduced: '📐 Simetría Absoluta · Última Prueba Antes de CHESS',
      briefing: 'El Arquitecto del Tablero construye estructuras casi impecables. Supéralo en ajedrez puro para ganar audiencia ante el propio CHESS.',
      openingLine: 'Yo tracé las 64 casillas. Demuestra que mereces enfrentar al Soberano CHESS.'
    },
    {
      id: 5,
      key: 'chess_5',
      bossId: 'chess_god',
      name: 'CHESS',
      difficultyLabel: 'JEFE FINAL',
      aiDifficulty: 4,
      isFinalBoss: true,
      requiresPowerChoice: true,
      thinkTimeMs: 750,
      maxDepth: 3,
      qDepth: 3,
      aiNoise: 28,
      blunderChance: 0.04,
      useBook: true,
      xpReward: 800,
      unitIntroduced: '👑 CHESS 100% Limpio · Elige 1 de 3 Poderes',
      briefing: 'JEFE FINAL ABSOLUTO. CHESS juega ajedrez 100% limpio sin poderes enemigos. Antes de iniciar elige 1 poder (Mittens, Torre Maya o Galaxia) para enfrentarlo.',
      openingLine: 'No necesito pirámides, cadenas, estrellas ni grietas. Soy CHESS. Elige tu poder y enfréntame en un tablero limpio.'
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
