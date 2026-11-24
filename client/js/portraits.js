/**
 * Retratos cuadrados VIVOS y expresivos para los 25 niveles de los 5 Capítulos:
 * - Cap. 1: Guardianes Mayas + Rey Maya
 * - Cap. 2: Hombre Peón, Hombre Caballo, Hombre Alfil, Mujer Reina (100% PIEZAS DE AJEDREZ, CERO rasgos de gato!)
 *           + FREE MITTENS (Sabio ancestral con cadenas rotas alrededor del cuello, corona ajedrez y VFX blancos)
 * - Cap. 3: Entidad Galáctica y heraldos cósmicos (nebulosas y estrellas)
 * - Cap. 4: Boss Glitch y fragmentos corruptos (distorsión geométrica sobria)
 * - Cap. 5: CHESS y sus encarnaciones puras
 */

function chessVisorEyes(eyeColor = '#efd083', angryColor = '#ff5b49') {
  return `
    <g class="boss-pupil-group js-tracked-eyes">
      <g class="expr-layer on-idle">
        <polygon points="86,110 112,113 108,121 88,119" fill="${eyeColor}"/>
        <polygon points="154,110 128,113 132,121 152,119" fill="${eyeColor}"/>
      </g>
      <g class="expr-layer on-thinking">
        <rect x="86" y="112" width="26" height="6" rx="2" fill="#fff2be"/>
        <rect x="128" y="112" width="26" height="6" rx="2" fill="#fff2be"/>
        <path d="M84 104 L112 108 M156 104 L128 108" stroke="${eyeColor}" stroke-width="2.6" stroke-linecap="round"/>
      </g>
      <g class="expr-layer on-happy">
        <polygon points="86,108 113,113 108,123 88,120" fill="#fff6cf"/>
        <polygon points="154,108 127,113 132,123 152,120" fill="#fff6cf"/>
      </g>
      <g class="expr-layer on-surprised">
        <polygon points="84,106 113,115 107,124 86,120" fill="${angryColor}"/>
        <polygon points="156,106 127,115 133,124 154,120" fill="${angryColor}"/>
        <path d="M82 101 L113 111 M158 101 L127 111" stroke="#ffd2cb" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g class="expr-layer on-disabled">
        <path d="M88 115 H112 M128 115 H152" stroke="#7d7668" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>
  `;
}

export function getBossPortraitSVG(bossId) {
  // === CAP. 2 NIVEL 5: FREE MITTENS — SABIO ANCESTRAL DE LA GALAXIA CON CADENAS ROTAS ===
  if (bossId === 'free_mittens') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato de Free Mittens, Sabio Ancestral">
        <defs>
          <pattern id="pCrownCheck" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#fbfaf7"/>
            <rect width="5" height="5" fill="#181715"/>
            <rect x="5" y="5" width="5" height="5" fill="#181715"/>
          </pattern>
        </defs>
        <rect width="240" height="240" fill="#1e1c21"/>
        <!-- Aura cósmica solemne detrás del Sabio -->
        <circle class="portrait-aura-ring" cx="120" cy="122" r="96" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2" stroke-dasharray="10 6"/>
        <!-- Imagen de referencia fiel de Free Mittens -->
        <image href="/assets/images/mittens_ref.png" x="0" y="18" width="240" height="224" preserveAspectRatio="xMidYMid slice"/>
        <!-- VFX blancos alrededor de sus brazos -->
        <g class="mittens-arm-aura">
          <path class="mittens-arm-wisp" d="M36 234 C34 188, 66 172, 86 202" stroke-width="3"/>
          <path class="mittens-arm-wisp" d="M204 234 C206 188, 174 172, 154 202" stroke-width="3"/>
          <circle class="mittens-arm-spark" cx="44" cy="194" r="3"/>
          <circle class="mittens-arm-spark" cx="196" cy="194" r="3"/>
        </g>
        <!-- GRILLETE Y CADENAS ROTAS ALREDEDOR DEL CUELLO (Símbolo de su encarcelamiento ancestral) -->
        <g class="portrait-chain-sway" stroke="#221e1b" stroke-width="1.5">
          <path d="M84 168 Q120 182 156 168 L152 178 Q120 191 88 178 Z" fill="#5e574e" stroke="#cfa64c" stroke-width="1.8"/>
          <circle cx="120" cy="180" r="6" fill="#2e2a25" stroke="#efd083" stroke-width="1.8"/>
          <!-- Eslabones rotos colgando a izquierda y derecha -->
          <ellipse cx="78" cy="184" rx="7" ry="4.5" fill="none" stroke="#9d9486" stroke-width="3" transform="rotate(-35 78 184)"/>
          <ellipse cx="66" cy="196" rx="7" ry="4.5" fill="none" stroke="#b8ae9e" stroke-width="2.8" transform="rotate(28 66 196)"/>
          <path d="M55 204 L62 200" stroke="#efd083" stroke-width="2.5"/>
          <ellipse cx="162" cy="184" rx="7" ry="4.5" fill="none" stroke="#9d9486" stroke-width="3" transform="rotate(35 162 184)"/>
          <ellipse cx="174" cy="196" rx="7" ry="4.5" fill="none" stroke="#b8ae9e" stroke-width="2.8" transform="rotate(-28 174 196)"/>
          <path d="M185 204 L178 200" stroke="#efd083" stroke-width="2.5"/>
        </g>
        <!-- Corona con textura de tablero de ajedrez -->
        <g class="portrait-float-part" transform="translate(120, 44)">
          <path d="M-32 6 L-37 -22 L-17 -9 L0 -32 L17 -9 L37 -22 L32 6 Z" fill="url(#pCrownCheck)" stroke="#cfa64c" stroke-width="2.4" stroke-linejoin="round"/>
          <rect x="-32" y="2" width="64" height="6.5" rx="2.8" fill="#cfa64c" stroke="#47330e" stroke-width="1.4"/>
          <circle cx="0" cy="-33" r="4.2" fill="#efd083" stroke="#181715" stroke-width="1.3"/>
        </g>
        <!-- Reacciones solemnes / furiosas del Sabio -->
        <g class="boss-pupil-group js-tracked-eyes">
          <g class="expr-layer on-thinking">
            <path d="M72 100 L105 106 M168 100 L135 106" stroke="#181512" stroke-width="3.6" stroke-linecap="round"/>
          </g>
          <g class="expr-layer on-happy">
            <circle cx="92" cy="115" r="5" fill="#fff6cf" opacity="0.85"/>
            <circle cx="148" cy="115" r="5" fill="#fff6cf" opacity="0.85"/>
          </g>
          <g class="expr-layer on-surprised">
            <path d="M70 98 L108 109 M170 98 L132 109" stroke="#ff5b49" stroke-width="4" stroke-linecap="round"/>
            <circle cx="90" cy="116" r="5.5" fill="#ff5b49" opacity="0.75"/>
            <circle cx="150" cy="116" r="5.5" fill="#ff5b49" opacity="0.75"/>
          </g>
        </g>
      </svg>`;
  }

  // === CAP. 2 NIVEL 1: HOMBRE PEÓN (100% PIEZAS DE PEÓN — SIN CARA NI OREJAS DE GATO) ===
  if (bossId === 'hombre_peon') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Peón">
        <rect width="240" height="240" fill="#1b1916"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="90" fill="none" stroke="rgba(207,166,76,0.22)" stroke-width="2"/>
        <!-- Brazos y hombreras formados por peones de obsidiana -->
        <g fill="#2b2620" stroke="#cfa64c" stroke-width="2">
          <circle cx="48" cy="152" r="18"/><path d="M26 240 C28 198 38 174 48 174 C58 174 68 198 70 240 Z"/>
          <circle cx="192" cy="152" r="18"/><path d="M170 240 C172 198 182 174 192 174 C202 174 212 198 214 240 Z"/>
          <!-- Torso formado por gran peón acorazado -->
          <path d="M68 240 C72 184 92 162 120 162 C148 162 168 184 172 240 Z" fill="#231f1b"/>
          <rect x="82" y="156" width="76" height="12" rx="4" fill="#cfa64c"/>
        </g>
        <!-- Cabeza: yelmo esférico de Peón de ajedrez puro (sin orejas ni rasgos animales) -->
        <g class="portrait-float-part">
          <circle cx="120" cy="112" r="46" fill="#2e2923" stroke="#efd083" stroke-width="2.6"/>
          <path d="M84 94 Q120 74 156 94" fill="none" stroke="#cfa64c" stroke-width="2.2"/>
          <rect x="92" y="136" width="56" height="6" rx="3" fill="#5e523f"/>
        </g>
        ${chessVisorEyes('#efd083')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 2: HOMBRE CABALLO (100% PIEZAS DE CABALLO — SIN RASGOS DE GATO) ===
  if (bossId === 'hombre_caballo') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Caballo">
        <rect width="240" height="240" fill="#1a1815"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="92" fill="none" stroke="rgba(217,148,54,0.24)" stroke-width="2"/>
        <!-- Hombreras y torso esculpidos en caballos de ajedrez -->
        <g fill="#2a241e" stroke="#cfa64c" stroke-width="2">
          <path d="M22 240 L34 158 C46 142 68 148 74 172 L68 240 Z"/>
          <path d="M218 240 L206 158 C194 142 172 148 166 172 L172 240 Z"/>
          <path d="M68 240 L78 168 H162 L172 240 Z" fill="#211d19"/>
        </g>
        <!-- Yelmo de Caballo de Ajedrez (cresta equina tallada en piedra/oro) -->
        <g class="portrait-float-part">
          <path d="M86 64 L102 30 L120 46 L138 30 L154 64 Z" fill="#cfa64c" stroke="#181512" stroke-width="2"/>
          <path d="M72 114 C72 68 94 56 120 56 C146 56 168 68 168 114 L156 162 L120 174 L84 162 Z" fill="#2c2620" stroke="#efd083" stroke-width="2.6"/>
          <path d="M98 144 L120 152 L142 144" fill="none" stroke="#cfa64c" stroke-width="2.4"/>
        </g>
        ${chessVisorEyes('#f2be6b')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 3: HOMBRE ALFIL (100% PIEZAS DE ALFIL — SIN RASGOS DE GATO) ===
  if (bossId === 'hombre_alfil') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Alfil">
        <rect width="240" height="240" fill="#161918"/>
        <!-- Manto diagonal formado por alfiles -->
        <path d="M24 240 L70 162 H170 L216 240 Z" fill="#23201c" stroke="#cfa64c" stroke-width="2"/>
        <path d="M66 240 L120 164 L174 240" fill="none" stroke="#3c825f" stroke-width="3.2"/>
        <!-- Mitra de Alfil clásica con hendidura diagonal -->
        <g class="portrait-float-part">
          <circle cx="120" cy="28" r="10" fill="#efd083" stroke="#181612" stroke-width="2"/>
          <path d="M74 126 C72 76 96 42 120 38 C144 42 168 76 166 126 C164 156 146 172 120 172 C94 172 76 156 74 126 Z" fill="#29241f" stroke="#cfa64c" stroke-width="2.5"/>
          <path d="M122 50 L144 76" stroke="#efd083" stroke-width="3.6" stroke-linecap="round"/>
          <path d="M100 144 H140" stroke="#cfa64c" stroke-width="2.4"/>
        </g>
        ${chessVisorEyes('#7ae0ad')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 4: MUJER REINA (100% PIEZAS DE REINA — SIN RASGOS DE GATO) ===
  if (bossId === 'mujer_reina') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Mujer Reina">
        <rect width="240" height="240" fill="#1e1719"/>
        <!-- Silueta femenina soberana esculpida en piezas de Dama -->
        <path d="M36 240 L68 172 L120 186 L172 172 L204 240 Z" fill="#2a2023" stroke="#efd083" stroke-width="2"/>
        <path d="M84 178 Q120 206 156 178" fill="none" stroke="#cfa64c" stroke-width="2.6"/>
        <g class="portrait-float-part">
          <path d="M70 84 L60 40 L92 64 L120 26 L148 64 L180 40 L170 84 Z" fill="#cfa64c" stroke="#181410" stroke-width="2"/>
          <circle cx="60" cy="36" r="5" fill="#efd083"/><circle cx="120" cy="22" r="6" fill="#fff2c2"/><circle cx="180" cy="36" r="5" fill="#efd083"/>
          <path d="M78 86 H162 L152 158 L120 174 L88 158 Z" fill="#32282b" stroke="#efd083" stroke-width="2.4"/>
          <path d="M104 146 Q120 152 136 146" fill="none" stroke="#efd083" stroke-width="2.2"/>
        </g>
        ${chessVisorEyes('#fff0b5')}
      </svg>`;
  }

  // === CAP. 3: ENTIDAD GALÁCTICA Y HERALDOS CÓSMICOS (GALAXIA HUMANOIDE) ===
  if (bossId && bossId.startsWith('galaxy_')) {
    const isBoss = bossId === 'galaxy_entity';
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Entidad Galáctica">
        <defs>
          <radialGradient id="gxPortBg" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stop-color="#4e3aa8"/>
            <stop offset="55%" stop-color="#19143d"/>
            <stop offset="100%" stop-color="#090717"/>
          </radialGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gxPortBg)"/>
        <g class="portrait-star-pulse" fill="#ffffff">
          <circle cx="28" cy="36" r="2"/><circle cx="206" cy="48" r="2.2"/><circle cx="44" cy="192" r="1.8"/>
          <circle cx="198" cy="184" r="2"/><circle cx="164" cy="30" r="1.5"/><circle cx="72" cy="44" r="1.6"/>
        </g>
        <!-- Anillo orbital de galaxia -->
        <ellipse class="portrait-aura-ring" cx="120" cy="118" rx="92" ry="30" fill="none" stroke="#efd083" stroke-width="2" stroke-dasharray="8 5" transform="rotate(-16 120 118)"/>
        <!-- Cuerpo de nebulosa humanoide -->
        <path d="M36 240 C48 182 78 164 120 164 C162 164 192 182 204 240 Z" fill="#221954" stroke="#9d8df2" stroke-width="2.2"/>
        <circle cx="120" cy="196" r="12" fill="#efd083" opacity="0.85"/>
        <!-- Cabeza estelar -->
        <g class="portrait-float-part">
          ${isBoss ? `<path d="M74 86 L92 38 L120 56 L148 38 L166 86 Z" fill="#5e49bd" stroke="#efd083" stroke-width="2.2"/>` : ''}
          <ellipse cx="120" cy="114" rx="46" ry="52" fill="#2c2169" stroke="#b3a3ff" stroke-width="2.6"/>
          <circle cx="104" cy="84" r="2" fill="#fff4c4"/><circle cx="142" cy="138" r="1.8" fill="#ffffff"/>
        </g>
        ${chessVisorEyes('#fff3c4', '#ff6e9c')}
      </svg>`;
  }

  // === BOSS SECRETO OCULTO POR URL: BLACKY (EL SCHNAUZER · IMPOSIBLE) ===
  if (bossId === 'blacky_secret') {
    return `
      <svg class="boss-portrait-svg blacky-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato del Boss Secreto BLACKY">
        <defs>
          <radialGradient id="bkBg" cx="50%" cy="38%" r="68%">
            <stop offset="0%" stop-color="#2c2432"/>
            <stop offset="55%" stop-color="#110e15"/>
            <stop offset="100%" stop-color="#050407"/>
          </radialGradient>
          <linearGradient id="bkFur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#232227"/>
            <stop offset="100%" stop-color="#0b0a0e"/>
          </linearGradient>
          <linearGradient id="bkSilver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e5e8f0"/>
            <stop offset="55%" stop-color="#9aa2b0"/>
            <stop offset="100%" stop-color="#5d6370"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#bkBg)"/>
        <!-- Partículas oscuras flotantes -->
        <g class="portrait-star-pulse">
          <circle cx="28" cy="40" r="2.6" fill="#c94b3c" opacity="0.8"/>
          <circle cx="212" cy="54" r="2.2" fill="#e5e8f0" opacity="0.7"/>
          <circle cx="38" cy="178" r="2.4" fill="#9d8df2" opacity="0.65"/>
          <circle cx="204" cy="170" r="2.8" fill="#c94b3c" opacity="0.8"/>
          <circle cx="120" cy="22" r="2" fill="#ffffff" opacity="0.6"/>
        </g>
        <circle class="portrait-aura-ring" cx="120" cy="118" r="98" fill="none" stroke="#c94b3c" stroke-width="2" stroke-dasharray="10 6" opacity="0.5"/>

        <!-- Hombros oscuros y collar con emblema de tablero roto -->
        <path d="M22 240 L52 178 H188 L218 240 Z" fill="url(#bkFur)" stroke="#3e3c46" stroke-width="2"/>
        <path d="M62 184 Q120 206 178 184 L184 202 Q120 226 56 202 Z" fill="#17141d" stroke="#c94b3c" stroke-width="2"/>
        <!-- Emblema de tablero roto en el collar -->
        <g transform="translate(106,192)">
          <rect width="28" height="24" rx="4" fill="#100e14" stroke="#efd083" stroke-width="1.6"/>
          <rect x="3" y="3" width="10" height="8" fill="#ece6d8"/>
          <rect x="15" y="12" width="10" height="9" fill="#ece6d8"/>
          <path d="M5 21 L14 11 L23 4" stroke="#c94b3c" stroke-width="2.2"/>
        </g>

        <!-- Cabeza de Schnauzer con orejas puntiagudas alerta -->
        <g class="portrait-float-part">
          <!-- Orejas puntiagudas de Schnauzer -->
          <polygon points="68,94 46,24 98,66" fill="#17161b" stroke="#626675" stroke-width="2.2"/>
          <polygon points="72,82 58,39 91,68" fill="#2b2633"/>
          <polygon points="172,94 194,24 142,66" fill="#17161b" stroke="#626675" stroke-width="2.2"/>
          <polygon points="168,82 182,39 149,68" fill="#2b2633"/>

          <!-- Cráneo oscuro de Schnauzer -->
          <path d="M66 84 Q120 48 174 84 L168 158 Q120 184 72 158 Z" fill="url(#bkFur)" stroke="#484b57" stroke-width="2.4"/>

          <!-- Cejas espesas plateadas características del Schnauzer -->
          <path d="M62 96 Q88 78 114 96 L108 110 Q84 98 64 108 Z" fill="url(#bkSilver)" stroke="#1b1a20" stroke-width="1.6"/>
          <path d="M178 96 Q152 78 126 96 L132 110 Q156 98 176 108 Z" fill="url(#bkSilver)" stroke="#1b1a20" stroke-width="1.6"/>

          <!-- Ojos penetrantes con seguimiento ocular -->
          <g class="js-tracked-eyes">
            <polygon points="78,108 106,113 102,124 82,122" fill="#09070a"/>
            <polygon points="162,108 134,113 138,124 158,122" fill="#09070a"/>
            <circle cx="94" cy="116" r="5" fill="#ff4949"/>
            <circle cx="146" cy="116" r="5" fill="#ff4949"/>
            <circle cx="95.5" cy="114.5" r="2" fill="#ffffff"/>
            <circle cx="147.5" cy="114.5" r="2" fill="#ffffff"/>
          </g>

          <!-- Barba y bigote plateado espeso de Schnauzer -->
          <path d="M74 128 Q96 118 120 124 Q144 118 166 128 L172 154 L154 176 L138 166 L120 188 L102 166 L86 176 L68 154 Z" fill="url(#bkSilver)" stroke="#1a1920" stroke-width="2"/>
          <path d="M90 144 Q120 156 150 144" fill="none" stroke="#454a57" stroke-width="1.8" opacity="0.7"/>
          <!-- Hocico negro brillante -->
          <path d="M107 132 Q120 126 133 132 Q130 145 120 146 Q110 145 107 132 Z" fill="#0d0c10" stroke="#4a4e5c" stroke-width="1.4"/>
          <ellipse cx="116" cy="134" rx="3.2" ry="1.6" fill="#5e6575" opacity="0.65"/>

          <!-- Expresiones de fauces/ladrido -->
          <path class="expr-layer on-surprised" d="M104 154 Q120 172 136 154 Z" fill="#2c090e" stroke="#ff5e57" stroke-width="2"/>
          <path class="expr-layer on-happy" d="M102 154 Q120 166 138 154" fill="none" stroke="#ff7a70" stroke-width="2.6" stroke-linecap="round"/>
        </g>
      </svg>`;
  }

  // === CAP. 4: BOSS GLITCH Y FRAGMENTOS CORRUPTOS (CON TEXTURA REAL DE LA IMAGEN SUBIDA) ===
  if (bossId && (bossId.startsWith('glitch_') || bossId === 'boss_glitch')) {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Boss Glitch">
        <defs>
          <pattern id="glitchTexPort" patternUnits="userSpaceOnUse" width="240" height="240">
            <image href="/assets/images/glitch_texture.jpg" x="0" y="0" width="240" height="240" preserveAspectRatio="xMidYMid slice"/>
          </pattern>
        </defs>
        <rect width="240" height="240" fill="#0f090c"/>
        <rect width="240" height="240" fill="url(#glitchTexPort)" opacity="0.32"/>
        <g class="portrait-glitch-jitter">
          <rect x="8" y="34" width="224" height="12" fill="url(#glitchTexPort)" opacity="0.75"/>
          <rect x="18" y="162" width="204" height="10" fill="url(#glitchTexPort)" opacity="0.68"/>
          <path d="M28 240 L62 170 H178 L212 240 Z" fill="url(#glitchTexPort)" stroke="#ff5e57" stroke-width="2.2"/>
          <path d="M28 240 L62 170 H178 L212 240 Z" fill="#12090d" opacity="0.34"/>
          <!-- Cabeza poligonal fragmentada con textura Glitch -->
          <polygon points="72,76 122,46 170,78 158,166 118,184 78,160" fill="url(#glitchTexPort)" stroke="#ffffff" stroke-width="2.6"/>
          <polygon points="72,76 122,46 170,78 158,166 118,184 78,160" fill="#1a0b12" opacity="0.22"/>
          <path d="M58 118 L186 106" stroke="#ff5e57" stroke-width="2.4" stroke-dasharray="10 5"/>
        </g>
        ${chessVisorEyes('#ffffff', '#ff3d5a')}
      </svg>`;
  }

  // === CAP. 5: CHESS (JEFE FINAL ABSOLUTO — TEXTURA DE TABLERO DE AJEDREZ) ===
  if (bossId && bossId.startsWith('chess_')) {
    const isFinal = bossId === 'chess_god';
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="CHESS">
        <defs>
          <pattern id="chessBoardTexPort" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#181612"/>
            <rect x="0" y="0" width="12" height="12" fill="#f3ebd8"/>
            <rect x="12" y="12" width="12" height="12" fill="#f3ebd8"/>
          </pattern>
        </defs>
        <rect width="240" height="240" fill="#11100d"/>
        <rect width="240" height="240" fill="url(#chessBoardTexPort)" opacity="0.16"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="98" fill="none" stroke="#efd083" stroke-width="${isFinal ? '2.6' : '1.5'}" opacity="0.58"/>
        <!-- Manto con textura de tablero de ajedrez -->
        <path d="M30 240 L70 170 H170 L210 240 Z" fill="url(#chessBoardTexPort)" stroke="#efd083" stroke-width="2.4"/>
        <g class="portrait-float-part">
          <path d="M120 14 V46 M104 28 H136" stroke="#fff4cc" stroke-width="4.6" stroke-linecap="round"/>
          <!-- Corona y rostro tallados en textura de tablero de ajedrez -->
          <path d="M72 94 L95 60 L120 76 L145 60 L168 94 L158 170 L120 186 L82 170 Z" fill="url(#chessBoardTexPort)" stroke="#fff2c4" stroke-width="2.8"/>
          <rect x="78" y="106" width="84" height="32" rx="6" fill="#12100d" opacity="0.84" stroke="#efd083" stroke-width="1.4"/>
          <path d="M98 156 H142" stroke="#efd083" stroke-width="2.6"/>
        </g>
        ${chessVisorEyes('#fff6d6', '#cfa64c')}
      </svg>`;
  }

  // === CAP. 1 NIVELES 1-4: GUARDIANES MAYA ===
  if (bossId === 'maya_sentinel' || bossId === 'maya_jade_guard' || bossId === 'maya_jaguar' || bossId === 'maya_eclipse') {
    const palette = {
      maya_sentinel: { bg: '#211c17', primary: '#3d352c', accent: '#cfa64c', eye: '#f0c259', crown: 'M82 86 Q120 34 158 86' },
      maya_jade_guard: { bg: '#16241d', primary: '#26543d', accent: '#efd083', eye: '#7ae0ad', crown: 'M74 90 H166 L154 54 H86 Z' },
      maya_jaguar: { bg: '#231b14', primary: '#3a3026', accent: '#d99436', eye: '#ffd466', crown: 'M72 96 L84 44 L108 74 L120 48 L132 74 L156 44 L168 96 Z' },
      maya_eclipse: { bg: '#1e1615', primary: '#332522', accent: '#e07a52', eye: '#ffae66', crown: 'M76 88 L98 46 L120 30 L142 46 L164 88 Z' }
    }[bossId];

    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Guardián Maya">
        <rect width="240" height="240" fill="${palette.bg}"/>
        <circle class="portrait-aura-ring" cx="120" cy="84" r="64" fill="${palette.accent}" opacity="0.14"/>
        <path class="portrait-float-part" d="${palette.crown}" fill="${palette.accent}" stroke="#191510" stroke-width="2.2"/>
        <path d="M36 240 L60 182 H180 L204 240 Z" fill="${palette.primary}" stroke="${palette.accent}" stroke-width="2"/>
        <path d="M74 92 H166 L156 174 L120 192 L84 174 Z" fill="${palette.primary}" stroke="${palette.accent}" stroke-width="2.5"/>
        ${chessVisorEyes(palette.eye)}
        <path d="M100 162 H140" stroke="${palette.accent}" stroke-width="2.6" stroke-linecap="round"/>
      </svg>`;
  }

  // === CAP. 1 NIVEL 5: DIOS MAYA (ORIGINAL PRESERVADO CON ANIMACIÓN VIVA) ===
  if (bossId === 'rey_maya') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato del Dios Maya">
        <defs>
          <radialGradient id="pmBg" cx="50%" cy="35%" r="65%"><stop offset="0%" stop-color="#3a3222"/><stop offset="100%" stop-color="#14120f"/></radialGradient>
          <linearGradient id="pmGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f3d88c"/><stop offset="100%" stop-color="#8b651e"/></linearGradient>
          <linearGradient id="pmStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#574e42"/><stop offset="100%" stop-color="#211d18"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#pmBg)"/>
        <polygon points="10,240 230,240 192,162 48,162" fill="#1d1914" opacity="0.8"/>
        <polygon points="48,162 192,162 162,110 78,110" fill="#231e18" opacity="0.8"/>
        <g class="portrait-float-part">
          <path d="M120 92 C66 22, 22 34, 6 76 C44 76, 80 90, 104 114 Z" fill="#295c42"/>
          <path d="M120 92 C174 22, 218 34, 234 76 C196 76, 160 90, 136 114 Z" fill="#295c42"/>
          <path d="M68 96 L86 58 L106 74 L120 40 L134 74 L154 58 L172 96 Z" fill="url(#pmGold)" stroke="#261d0f" stroke-width="2"/>
          <circle cx="120" cy="76" r="10" fill="#26543d" stroke="#f3d88c" stroke-width="2"/>
        </g>
        <path d="M24 240 L48 184 L192 184 L216 240 Z" fill="url(#pmStone)" stroke="#68563a" stroke-width="2"/>
        <path d="M74 186 Q120 220 166 186 L178 214 Q120 242 62 214 Z" fill="url(#pmGold)" stroke="#231b0e" stroke-width="1.8"/>
        <path d="M72 94 H168 L158 176 L120 194 L82 176 Z" fill="url(#pmStone)" stroke="url(#pmGold)" stroke-width="2.5"/>
        <circle cx="66" cy="136" r="11" fill="#26543d" stroke="url(#pmGold)" stroke-width="2.5"/>
        <circle cx="174" cy="136" r="11" fill="#26543d" stroke="url(#pmGold)" stroke-width="2.5"/>
        ${chessVisorEyes('#f0c259', '#ff5b49')}
        <path class="expr-layer on-idle" d="M102 162 H138" stroke="#cfa64c" stroke-width="2.5" stroke-linecap="round"/>
        <path class="expr-layer on-thinking" d="M106 164 Q120 158 134 164" fill="none" stroke="#efd083" stroke-width="2.6" stroke-linecap="round"/>
        <path class="expr-layer on-happy" d="M98 158 Q120 174 142 158" fill="none" stroke="#fff0b5" stroke-width="3" stroke-linecap="round"/>
        <path class="expr-layer on-surprised" d="M104 168 Q120 154 136 168" fill="none" stroke="#ff7c6b" stroke-width="3" stroke-linecap="round"/>
        <path class="expr-layer on-disabled" d="M104 164 H136" stroke="#6c665a" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
  }

  // Autómata Clásico (Vs IA / Partida Rápida / Contra el Tiempo)
  return `
    <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Autómata CHESS.MOD">
      <rect width="240" height="240" fill="#181612"/>
      <circle class="portrait-aura-ring" cx="120" cy="116" r="72" fill="none" stroke="rgba(207,166,76,0.28)" stroke-width="2"/>
      <circle cx="120" cy="116" r="62" fill="#23201b" stroke="#cfa64c" stroke-width="2.5"/>
      <path d="M120 40 V60 M110 48 H130" stroke="#efd083" stroke-width="3.5" stroke-linecap="round"/>
      ${chessVisorEyes('#cfa64c')}
      <path d="M96 146 H144" stroke="#3c825f" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`;
}
