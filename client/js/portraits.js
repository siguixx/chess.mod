/**
 * Retratos cuadrados VIVOS, expresivos y DETALLADOS (multi-capa con sombreado volumétrico,
 * iluminación de borde, brillos especulares, grabados y profundidad) para todos los personajes:
 * - Entrenadores Mentores (Yam Gato Siamés, Kael Maya, Pixel Glitch, Sabio Mittens, Astra Galáctica, BLACKY 3200)
 * - Cap. 1: Guardianes Mayas + Dios Maya
 * - Cap. 2: Hombre Peón, Hombre Caballo, Hombre Alfil, Mujer Reina (100% PIEZAS DE AJEDREZ, CERO rasgos de gato!)
 *           + FREE MITTENS (Sabio ancestral con cadenas rotas metálicas, corona ajedrezada y VFX blancos)
 * - Cap. 3: Entidad Galáctica y heraldos cósmicos
 * - Cap. 4: Boss Glitch y fragmentos corruptos (textura real subida + prisma RGB + grietas luminosas)
 * - Cap. 5: CHESS y sus encarnaciones (textura tablero de ajedrez tallada con volumen 3D y oro)
 * - Boss Secreto: BLACKY (Schnauzer extremo con corona plateada y rayos)
 */

function chessVisorEyes(eyeColor = '#efd083', angryColor = '#ff5b49', uid = 'v') {
  return `
    <defs>
      <radialGradient id="eyeG_${uid}" cx="45%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="35%" stop-color="${eyeColor}"/>
        <stop offset="100%" stop-color="${eyeColor}" stop-opacity="0.55"/>
      </radialGradient>
      <radialGradient id="eyeA_${uid}" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#fff4cc"/>
        <stop offset="40%" stop-color="${angryColor}"/>
        <stop offset="100%" stop-color="#6b0d0d"/>
      </radialGradient>
    </defs>
    <g class="boss-pupil-group js-tracked-eyes">
      <g class="expr-layer on-idle">
        <polygon points="83,108 114,112 109,123 86,120" fill="#0d0b09" opacity="0.88"/>
        <polygon points="157,108 126,112 131,123 154,120" fill="#0d0b09" opacity="0.88"/>
        <polygon points="86,110 112,113 108,121 88,119" fill="url(#eyeG_${uid})"/>
        <polygon points="154,110 128,113 132,121 152,119" fill="url(#eyeG_${uid})"/>
        <circle cx="96" cy="114" r="2.2" fill="#ffffff" opacity="0.92"/>
        <circle cx="144" cy="114" r="2.2" fill="#ffffff" opacity="0.92"/>
      </g>
      <g class="expr-layer on-thinking">
        <rect x="85" y="111" width="27" height="7" rx="2.5" fill="#0d0b09" opacity="0.85"/>
        <rect x="128" y="111" width="27" height="7" rx="2.5" fill="#0d0b09" opacity="0.85"/>
        <rect x="86" y="112.5" width="25" height="4.5" rx="2" fill="#fff2be"/>
        <rect x="129" y="112.5" width="25" height="4.5" rx="2" fill="#fff2be"/>
        <path d="M82 103 L113 108 M158 103 L127 108" stroke="${eyeColor}" stroke-width="2.8" stroke-linecap="round"/>
      </g>
      <g class="expr-layer on-happy">
        <polygon points="85,107 114,113 108,124 87,120" fill="url(#eyeG_${uid})"/>
        <polygon points="155,107 126,113 132,124 153,120" fill="url(#eyeG_${uid})"/>
        <circle cx="96" cy="113" r="2.8" fill="#ffffff"/>
        <circle cx="144" cy="113" r="2.8" fill="#ffffff"/>
      </g>
      <g class="expr-layer on-surprised">
        <polygon points="82,104 114,115 107,126 85,121" fill="url(#eyeA_${uid})"/>
        <polygon points="158,104 126,115 133,126 155,121" fill="url(#eyeA_${uid})"/>
        <path d="M80 99 L114 111 M160 99 L126 111" stroke="#ffd8d0" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="96" cy="115" r="2.2" fill="#ffffff"/>
        <circle cx="144" cy="115" r="2.2" fill="#ffffff"/>
      </g>
      <g class="expr-layer on-disabled">
        <path d="M88 115 H112 M128 115 H152" stroke="#7d7668" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>
  `;
}

export function getBossPortraitSVG(bossId) {
  // === ENTRENADOR 1: YAM — GATO SIAMÉS (PELUJE CON VOLUMEN, OJOS ZAFIRO MULTICAPA, COLLAR DORADO) ===
  if (bossId === 'trainer_yam') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato de Yam, Entrenador Gato Siamés">
        <defs>
          <radialGradient id="yamBg" cx="50%" cy="32%" r="72%">
            <stop offset="0%" stop-color="#4e3b2b"/>
            <stop offset="55%" stop-color="#271d16"/>
            <stop offset="100%" stop-color="#110d0a"/>
          </radialGradient>
          <linearGradient id="yamCream" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stop-color="#fbf2e2"/>
            <stop offset="52%" stop-color="#ead7ba"/>
            <stop offset="100%" stop-color="#bfa27c"/>
          </linearGradient>
          <radialGradient id="yamMask" cx="50%" cy="54%" r="48%">
            <stop offset="0%" stop-color="#2a1b13"/>
            <stop offset="54%" stop-color="#4d3525" stop-opacity="0.92"/>
            <stop offset="82%" stop-color="#7a5841" stop-opacity="0.48"/>
            <stop offset="100%" stop-color="#ead7ba" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="yamEar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#24160e"/>
            <stop offset="100%" stop-color="#5c3e2b"/>
          </linearGradient>
          <linearGradient id="yamGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff0a8"/>
            <stop offset="48%" stop-color="#cfa64c"/>
            <stop offset="100%" stop-color="#704f13"/>
          </linearGradient>
          <radialGradient id="yamIris" cx="42%" cy="38%" r="60%">
            <stop offset="0%" stop-color="#a5f3fc"/>
            <stop offset="45%" stop-color="#38bdf8"/>
            <stop offset="85%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </radialGradient>
        </defs>
        <rect width="240" height="240" fill="url(#yamBg)"/>
        <circle cx="120" cy="116" r="106" fill="rgba(239,208,131,0.06)"/>
        <circle class="portrait-aura-ring" cx="120" cy="118" r="95" fill="none" stroke="rgba(239,208,131,0.42)" stroke-width="2" stroke-dasharray="10 6"/>
        <!-- Cuerpo y hombros con sombra de oclusión bajo la barbilla -->
        <path d="M40 240 C48 182 78 164 120 164 C162 164 192 182 200 240 Z" fill="url(#yamCream)" stroke="#4c3424" stroke-width="2.2"/>
        <path d="M56 240 C64 202 84 186 120 186 C156 186 176 202 184 240 Z" fill="#8b6b4d" opacity="0.22"/>
        <ellipse cx="120" cy="172" rx="46" ry="14" fill="#2c1d14" opacity="0.45"/>
        <!-- Collar real de mentor con medallón de peón dorado -->
        <path d="M80 170 Q120 194 160 170 L154 185 Q120 207 86 185 Z" fill="#234c38" stroke="url(#yamGold)" stroke-width="2"/>
        <path d="M88 175 Q120 194 152 175" fill="none" stroke="#fff0b5" stroke-width="1.2" opacity="0.65"/>
        <circle cx="120" cy="198" r="12" fill="url(#yamGold)" stroke="#38250a" stroke-width="2"/>
        <circle cx="120" cy="198" r="8.5" fill="#1f160d" opacity="0.25"/>
        <text x="120" y="203" text-anchor="middle" font-size="14" fill="#1e1305">♟</text>
        <!-- Cabeza y orejas esculpidas de Gato Siamés -->
        <g class="portrait-float-part">
          <polygon points="60,104 44,30 104,67" fill="url(#yamEar)" stroke="#1a0f09" stroke-width="2.2" stroke-linejoin="round"/>
          <polygon points="64,94 53,45 93,71" fill="#b48367" opacity="0.52"/>
          <path d="M54 60 Q64 70 72 78" stroke="#f7e8d0" stroke-width="1.5" fill="none" opacity="0.55"/>
          <polygon points="180,104 196,30 136,67" fill="url(#yamEar)" stroke="#1a0f09" stroke-width="2.2" stroke-linejoin="round"/>
          <polygon points="176,94 187,45 147,71" fill="#b48367" opacity="0.52"/>
          <path d="M186 60 Q176 70 168 78" stroke="#f7e8d0" stroke-width="1.5" fill="none" opacity="0.55"/>
          <!-- Silueta facial con pelaje lateral suave -->
          <path d="M62 116 C62 80 86 62 120 62 C154 62 178 80 178 116 C178 148 152 168 120 168 C88 168 62 148 62 116 Z" fill="url(#yamCream)" stroke="#4c3323" stroke-width="2.4"/>
          <!-- Brillo superior de luz en frente -->
          <ellipse cx="120" cy="78" rx="34" ry="12" fill="#ffffff" opacity="0.28"/>
          <!-- Máscara chocolate siamesa -->
          <ellipse cx="120" cy="126" rx="46" ry="36" fill="url(#yamMask)"/>
          <!-- Naricita esculpida + boquita :3 -->
          <path d="M112 128 Q120 124 128 128 L120 137 Z" fill="#1e120b" stroke="#6c4d3a" stroke-width="0.9"/>
          <ellipse cx="118" cy="128.5" rx="3" ry="1.2" fill="#9a755f" opacity="0.7"/>
          <path d="M120 137 Q114 147 104 142 M120 137 Q126 147 136 142" fill="none" stroke="#1e120b" stroke-width="2.3" stroke-linecap="round"/>
          <!-- Bigotes con brillo -->
          <path d="M77 127 L48 122 M76 134 L46 138 M79 140 L54 149 M163 127 L192 122 M164 134 L194 138 M161 140 L186 149" stroke="#fff6e6" stroke-width="1.6" stroke-linecap="round" opacity="0.86"/>
        </g>
        <!-- Ojos zafiro profundos con reflejo doble -->
        <g class="boss-pupil-group js-tracked-eyes">
          <ellipse cx="95" cy="110" rx="14.5" ry="12" fill="url(#yamIris)" stroke="#161b2e" stroke-width="2.2"/>
          <ellipse cx="145" cy="110" rx="14.5" ry="12" fill="url(#yamIris)" stroke="#161b2e" stroke-width="2.2"/>
          <ellipse cx="95" cy="110" rx="5.8" ry="8.6" fill="#070d1a"/>
          <ellipse cx="145" cy="110" rx="5.8" ry="8.6" fill="#070d1a"/>
          <circle cx="90.5" cy="105.5" r="3.4" fill="#ffffff"/>
          <circle cx="140.5" cy="105.5" r="3.4" fill="#ffffff"/>
          <circle cx="99" cy="114" r="1.4" fill="#bae6fd" opacity="0.9"/>
          <circle cx="149" cy="114" r="1.4" fill="#bae6fd" opacity="0.9"/>
        </g>
      </svg>`;
  }

  // === ENTRENADOR 2: KAEL — GUARDIÁN TÁCTICO MAYA (JADE, ORO Y PIEDRA TALLADA CON RELIEVE) ===
  if (bossId === 'trainer_kael') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato de Kael, Entrenador Maya">
        <defs>
          <radialGradient id="kaelBg" cx="50%" cy="32%" r="70%">
            <stop offset="0%" stop-color="#28523d"/>
            <stop offset="60%" stop-color="#13251c"/>
            <stop offset="100%" stop-color="#09120d"/>
          </radialGradient>
          <linearGradient id="kaelJade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#58b387"/>
            <stop offset="48%" stop-color="#26543d"/>
            <stop offset="100%" stop-color="#122b1e"/>
          </linearGradient>
          <linearGradient id="kaelGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff0ab"/>
            <stop offset="50%" stop-color="#cfa64c"/>
            <stop offset="100%" stop-color="#6c4d14"/>
          </linearGradient>
          <linearGradient id="kaelStone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4e5d52"/>
            <stop offset="55%" stop-color="#27342c"/>
            <stop offset="100%" stop-color="#151d18"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#kaelBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="95" fill="none" stroke="url(#kaelGold)" stroke-width="1.8" stroke-dasharray="10 6" opacity="0.52"/>
        <!-- Armadura ceremonial de Jade con placas grabadas -->
        <path d="M28 240 L56 172 H184 L212 240 Z" fill="url(#kaelJade)" stroke="url(#kaelGold)" stroke-width="2.4"/>
        <path d="M56 172 L84 240 M184 172 L156 240" stroke="#0d1f16" stroke-width="2.2" opacity="0.65"/>
        <path d="M84 174 L120 218 L156 174" fill="#173425" stroke="url(#kaelGold)" stroke-width="3"/>
        <polygon points="120,188 130,202 120,214 110,202" fill="url(#kaelGold)" stroke="#1b1408" stroke-width="1.4"/>
        <g class="portrait-float-part">
          <!-- Penacho escalonado con plumas detalladas -->
          <path d="M52 92 C60 54 84 40 120 34 C156 40 180 54 188 92 Z" fill="url(#kaelJade)" stroke="#102218" stroke-width="2"/>
          <path d="M66 90 L84 40 L108 62 L120 22 L132 62 L156 40 L174 90 Z" fill="url(#kaelGold)" stroke="#241909" stroke-width="2"/>
          <circle cx="120" cy="64" r="10.5" fill="url(#kaelJade)" stroke="#fff0b3" stroke-width="2.2"/>
          <circle cx="120" cy="64" r="4" fill="#fff4c4"/>
          <!-- Máscara tallada con biseles laterales -->
          <path d="M72 88 H168 L160 168 L120 186 L80 168 Z" fill="url(#kaelStone)" stroke="url(#kaelGold)" stroke-width="2.6"/>
          <path d="M78 94 H162 L156 112 H84 Z" fill="#111814" opacity="0.55"/>
          <path d="M84 140 L100 154 H140 L156 140" fill="none" stroke="url(#kaelGold)" stroke-width="2" opacity="0.8"/>
          <path d="M98 160 Q120 168 142 160" fill="none" stroke="#7ae0ad" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#7ae0ad', '#ffd859', 'kael')}
      </svg>`;
  }

  // === ENTRENADOR 3: PIXEL — INGENIERA GLITCH (VISOR HOLOGRÁFICO + CIRCUITOS + ILUMINACIÓN DUAL) ===
  if (bossId === 'trainer_pixel') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato de Pixel, Entrenadora Glitch">
        <defs>
          <radialGradient id="pxBg" cx="50%" cy="35%" r="72%">
            <stop offset="0%" stop-color="#301c69"/>
            <stop offset="60%" stop-color="#141132"/>
            <stop offset="100%" stop-color="#070614"/>
          </radialGradient>
          <linearGradient id="pxHood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#4c238f"/>
            <stop offset="52%" stop-color="#24114e"/>
            <stop offset="100%" stop-color="#0f0826"/>
          </linearGradient>
          <linearGradient id="pxCyan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#22d3ee"/>
            <stop offset="50%" stop-color="#a855f7"/>
            <stop offset="100%" stop-color="#f472b6"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#pxBg)"/>
        <!-- Rejilla de circuito sutil -->
        <path d="M0 44 H240 M0 196 H240 M36 0 V240 M204 0 V240" stroke="#38bdf8" stroke-width="1" opacity="0.16"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="94" fill="none" stroke="url(#pxCyan)" stroke-width="2.2" stroke-dasharray="14 6"/>
        <!-- Chaqueta técnica con trazas luminosas -->
        <path d="M32 240 L62 170 H178 L208 240 Z" fill="url(#pxHood)" stroke="#38bdf8" stroke-width="2.2"/>
        <path d="M74 172 L96 240 M166 172 L144 240" stroke="#c084fc" stroke-width="1.8" opacity="0.7"/>
        <path d="M104 190 H136 M112 204 H128" stroke="#22d3ee" stroke-width="2.4" stroke-linecap="round"/>
        <g class="portrait-float-part">
          <!-- Capucha esculpida con reflejos laterales cian y magenta -->
          <path d="M64 102 C64 46 90 34 120 34 C150 34 176 46 176 102 L184 152 L162 136 L158 172 L120 184 L82 172 L78 136 L56 152 Z" fill="url(#pxHood)" stroke="url(#pxCyan)" stroke-width="2.5"/>
          <path d="M76 86 C80 56 96 46 120 46 C144 46 160 56 164 86" fill="none" stroke="#e9d5ff" stroke-width="1.4" opacity="0.55"/>
          <!-- Visor panorámico con reflejo diagonal -->
          <rect x="72" y="94" width="96" height="38" rx="12" fill="#070a18" stroke="#22d3ee" stroke-width="2.6"/>
          <path d="M84 96 L104 96 L90 130 L74 130 Z" fill="#ffffff" opacity="0.1"/>
          <path d="M102 154 Q120 163 138 154" fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round"/>
          <!-- Micro-píxeles flotantes -->
          <rect x="42" y="64" width="7" height="7" fill="#22d3ee" opacity="0.75"/>
          <rect x="190" y="76" width="8" height="8" fill="#f472b6" opacity="0.75"/>
          <rect x="48" y="168" width="6" height="6" fill="#c084fc" opacity="0.65"/>
        </g>
        ${chessVisorEyes('#38f8ff', '#f472b6', 'pixel')}
      </svg>`;
  }

  // === ENTRENADOR 5: ASTRA — NAVEGANTE GALÁCTICA (ASTROLABIO DORADO + NEBULOSA PROFUNDA) ===
  if (bossId === 'trainer_astra') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato de Astra, Entrenadora Galáctica">
        <defs>
          <radialGradient id="astraBg" cx="50%" cy="38%" r="70%">
            <stop offset="0%" stop-color="#4e32a8"/>
            <stop offset="52%" stop-color="#1b1245"/>
            <stop offset="100%" stop-color="#070514"/>
          </radialGradient>
          <radialGradient id="astraSkin" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#5c44b8"/>
            <stop offset="60%" stop-color="#2a1c66"/>
            <stop offset="100%" stop-color="#140c36"/>
          </radialGradient>
          <linearGradient id="astraGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff4bf"/>
            <stop offset="50%" stop-color="#efd083"/>
            <stop offset="100%" stop-color="#8b651e"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#astraBg)"/>
        <g class="portrait-star-pulse">
          <circle cx="34" cy="42" r="2.4" fill="#fff7cc"/><circle cx="206" cy="52" r="2.2" fill="#c4b5fd"/>
          <circle cx="196" cy="184" r="2.4" fill="#ffffff"/><circle cx="42" cy="176" r="1.8" fill="#efd083"/>
          <path d="M188 34 L190 42 L198 44 L190 46 L188 54 L186 46 L178 44 L186 42 Z" fill="#fff4c4" opacity="0.85"/>
        </g>
        <ellipse class="portrait-aura-ring" cx="120" cy="116" rx="96" ry="28" fill="none" stroke="url(#astraGold)" stroke-width="2.2" transform="rotate(-18 120 116)"/>
        <ellipse class="portrait-aura-ring" cx="120" cy="116" rx="88" ry="22" fill="none" stroke="#c4b5fd" stroke-width="1.2" stroke-dasharray="6 6" transform="rotate(14 120 116)"/>
        <!-- Manto estelar con hombreras doradas -->
        <path d="M30 240 C44 178 76 162 120 162 C164 162 196 178 210 240 Z" fill="#1b1242" stroke="#a78bfa" stroke-width="2.4"/>
        <path d="M62 178 Q120 212 178 178" fill="none" stroke="url(#astraGold)" stroke-width="3"/>
        <circle cx="120" cy="196" r="10" fill="url(#astraGold)" stroke="#1b1242" stroke-width="2"/>
        <g class="portrait-float-part">
          <path d="M68 92 L96 30 L120 56 L144 30 L172 92 Z" fill="#3e1b85" stroke="url(#astraGold)" stroke-width="2.2"/>
          <ellipse cx="120" cy="116" rx="48" ry="52" fill="url(#astraSkin)" stroke="#ddd6fe" stroke-width="2.6"/>
          <ellipse cx="108" cy="90" rx="22" ry="10" fill="#ffffff" opacity="0.14"/>
          <circle cx="120" cy="60" r="7" fill="url(#astraGold)" stroke="#1c1138" stroke-width="1.6"/>
          <path d="M100 148 Q120 156 140 148" fill="none" stroke="#fde68a" stroke-width="2.2" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#fde68a', '#f472b6', 'astra')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 5: FREE MITTENS — SABIO ANCESTRAL CON CADENAS METÁLICAS 3D Y AURA BLANCA ===
  if (bossId === 'free_mittens') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato de Free Mittens, Sabio Ancestral">
        <defs>
          <pattern id="pCrownCheck" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#fbfaf7"/>
            <rect width="5" height="5" fill="#181715"/>
            <rect x="5" y="5" width="5" height="5" fill="#181715"/>
          </pattern>
          <radialGradient id="fmHalo" cx="50%" cy="46%" r="55%">
            <stop offset="0%" stop-color="rgba(255,248,225,0.34)"/>
            <stop offset="60%" stop-color="rgba(207,166,76,0.09)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
          </radialGradient>
          <linearGradient id="fmMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c9bfb0"/>
            <stop offset="48%" stop-color="#5d554b"/>
            <stop offset="100%" stop-color="#221e1a"/>
          </linearGradient>
          <linearGradient id="fmGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff3b8"/>
            <stop offset="50%" stop-color="#cfa64c"/>
            <stop offset="100%" stop-color="#6b4b12"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="#161419"/>
        <circle cx="120" cy="120" r="115" fill="url(#fmHalo)"/>
        <circle class="portrait-aura-ring" cx="120" cy="122" r="98" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="2" stroke-dasharray="12 6"/>
        <circle class="portrait-aura-ring" cx="120" cy="122" r="84" fill="none" stroke="rgba(239,208,131,0.22)" stroke-width="1.2" stroke-dasharray="4 8"/>
        <!-- Imagen de referencia fiel de Free Mittens -->
        <image href="/assets/images/mittens_ref.png" x="0" y="18" width="240" height="224" preserveAspectRatio="xMidYMid slice"/>
        <!-- VFX blancos luminosos alrededor de sus brazos -->
        <g class="mittens-arm-aura">
          <path class="mittens-arm-wisp" d="M32 236 C30 184, 66 168, 88 202" stroke="#ffffff" stroke-width="3.4"/>
          <path class="mittens-arm-wisp" d="M208 236 C210 184, 174 168, 152 202" stroke="#ffffff" stroke-width="3.4"/>
          <circle class="mittens-arm-spark" cx="42" cy="192" r="3.4"/>
          <circle class="mittens-arm-spark" cx="198" cy="192" r="3.4"/>
          <circle class="mittens-arm-spark" cx="62" cy="166" r="2.2"/>
          <circle class="mittens-arm-spark" cx="178" cy="166" r="2.2"/>
        </g>
        <!-- GRILLETE METÁLICO 3D Y CADENAS ROTAS ALREDEDOR DEL CUELLO -->
        <g class="portrait-chain-sway">
          <path d="M82 168 Q120 184 158 168 L153 181 Q120 196 87 181 Z" fill="url(#fmMetal)" stroke="url(#fmGold)" stroke-width="2"/>
          <circle cx="120" cy="182" r="7.5" fill="#231f1b" stroke="url(#fmGold)" stroke-width="2.2"/>
          <circle cx="120" cy="182" r="3" fill="#fff2be"/>
          <!-- Eslabones rotos sombreados -->
          <ellipse cx="76" cy="186" rx="7.5" ry="4.8" fill="none" stroke="#c9bfb0" stroke-width="3.2" transform="rotate(-35 76 186)"/>
          <ellipse cx="64" cy="198" rx="7.5" ry="4.8" fill="none" stroke="#8b8173" stroke-width="3" transform="rotate(28 64 198)"/>
          <path d="M52 206 L60 200" stroke="#fff0b3" stroke-width="2.6" stroke-linecap="round"/>
          <ellipse cx="164" cy="186" rx="7.5" ry="4.8" fill="none" stroke="#c9bfb0" stroke-width="3.2" transform="rotate(35 164 186)"/>
          <ellipse cx="176" cy="198" rx="7.5" ry="4.8" fill="none" stroke="#8b8173" stroke-width="3" transform="rotate(-28 176 198)"/>
          <path d="M188 206 L180 200" stroke="#fff0b3" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        <!-- Corona real ajedrezada con bisel dorado -->
        <g class="portrait-float-part" transform="translate(120, 44)">
          <path d="M-33 7 L-38 -23 L-17 -9 L0 -34 L17 -9 L38 -23 L33 7 Z" fill="url(#pCrownCheck)" stroke="url(#fmGold)" stroke-width="2.6" stroke-linejoin="round"/>
          <rect x="-34" y="2" width="68" height="7" rx="3" fill="url(#fmGold)" stroke="#3b2809" stroke-width="1.5"/>
          <circle cx="0" cy="-35" r="4.6" fill="#fff2be" stroke="#3b2809" stroke-width="1.4"/>
        </g>
        <g class="boss-pupil-group js-tracked-eyes">
          <g class="expr-layer on-thinking"><path d="M72 100 L105 106 M168 100 L135 106" stroke="#181512" stroke-width="3.6" stroke-linecap="round"/></g>
          <g class="expr-layer on-happy"><circle cx="92" cy="115" r="5" fill="#fff6cf" opacity="0.88"/><circle cx="148" cy="115" r="5" fill="#fff6cf" opacity="0.88"/></g>
          <g class="expr-layer on-surprised">
            <path d="M70 98 L108 109 M170 98 L132 109" stroke="#ff5b49" stroke-width="4" stroke-linecap="round"/>
            <circle cx="90" cy="116" r="5.5" fill="#ff5b49" opacity="0.78"/><circle cx="150" cy="116" r="5.5" fill="#ff5b49" opacity="0.78"/>
          </g>
        </g>
      </svg>`;
  }

  // === CAP. 2 NIVEL 1: HOMBRE PEÓN (100% PIEZAS DE PEÓN ESCULPIDAS EN OBSIDIANA Y ORO — CERO GATO) ===
  if (bossId === 'hombre_peon') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Peón">
        <defs>
          <radialGradient id="hpBg" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="#352e25"/><stop offset="100%" stop-color="#12100d"/></radialGradient>
          <radialGradient id="hpSphere" cx="38%" cy="30%" r="68%"><stop offset="0%" stop-color="#6d6253"/><stop offset="45%" stop-color="#332d26"/><stop offset="100%" stop-color="#14110e"/></radialGradient>
          <linearGradient id="hpGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff0ae"/><stop offset="50%" stop-color="#cfa64c"/><stop offset="100%" stop-color="#6b4e16"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#hpBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="94" fill="none" stroke="rgba(239,208,131,0.28)" stroke-width="2" stroke-dasharray="10 6"/>
        <!-- Hombreras de peones esculpidos con luz especular -->
        <g stroke="url(#hpGold)" stroke-width="2">
          <circle cx="46" cy="150" r="19" fill="url(#hpSphere)"/>
          <path d="M22 240 C26 196 36 172 46 172 C56 172 66 196 70 240 Z" fill="url(#hpSphere)"/>
          <circle cx="194" cy="150" r="19" fill="url(#hpSphere)"/>
          <path d="M170 240 C174 196 184 172 194 172 C204 172 214 196 218 240 Z" fill="url(#hpSphere)"/>
          <path d="M64 240 C70 182 90 160 120 160 C150 160 170 182 176 240 Z" fill="url(#hpSphere)"/>
          <rect x="78" y="154" width="84" height="14" rx="5" fill="url(#hpGold)" stroke="#2b1e0a" stroke-width="1.6"/>
          <path d="M96 184 L120 206 L144 184" fill="none" stroke="url(#hpGold)" stroke-width="2.2"/>
        </g>
        <!-- Yelmo esférico de Peón puro con reflejo metálico y ranura visor -->
        <g class="portrait-float-part">
          <circle cx="120" cy="110" r="48" fill="url(#hpSphere)" stroke="url(#hpGold)" stroke-width="2.8"/>
          <ellipse cx="104" cy="84" rx="22" ry="10" fill="#ffffff" opacity="0.16" transform="rotate(-18 104 84)"/>
          <path d="M80 96 Q120 74 160 96" fill="none" stroke="url(#hpGold)" stroke-width="2.4"/>
          <rect x="86" y="136" width="68" height="8" rx="4" fill="#171410" stroke="#cfa64c" stroke-width="1.4"/>
          <path d="M98 140 H142" stroke="#efd083" stroke-width="1.8" stroke-dasharray="6 4"/>
        </g>
        ${chessVisorEyes('#efd083', '#ff5b49', 'hpeon')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 2: HOMBRE CABALLO (100% PIEZAS DE CABALLO TALLADAS — CERO GATO) ===
  if (bossId === 'hombre_caballo') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Caballo">
        <defs>
          <radialGradient id="hcBg" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="#392b1e"/><stop offset="100%" stop-color="#120f0c"/></radialGradient>
          <linearGradient id="hcArmor" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5d5041"/><stop offset="50%" stop-color="#2c241d"/><stop offset="100%" stop-color="#120f0c"/></linearGradient>
          <linearGradient id="hcGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff0a8"/><stop offset="50%" stop-color="#d99436"/><stop offset="100%" stop-color="#6b4410"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#hcBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="95" fill="none" stroke="rgba(217,148,54,0.34)" stroke-width="2" stroke-dasharray="12 6"/>
        <g stroke="url(#hcGold)" stroke-width="2.2">
          <path d="M18 240 L32 156 C46 138 70 146 76 172 L70 240 Z" fill="url(#hcArmor)"/>
          <path d="M222 240 L208 156 C194 138 170 146 164 172 L170 240 Z" fill="url(#hcArmor)"/>
          <path d="M66 240 L78 166 H162 L174 240 Z" fill="#1e1915"/>
          <path d="M90 170 L120 212 L150 170" fill="none" stroke="url(#hcGold)" stroke-width="2.8"/>
        </g>
        <g class="portrait-float-part">
          <!-- Cresta ecuestre de bronce dorado esculpida -->
          <path d="M84 66 L100 24 L120 44 L140 24 L156 66 Z" fill="url(#hcGold)" stroke="#231708" stroke-width="2"/>
          <path d="M120 26 V64" stroke="#fff6d0" stroke-width="1.8" opacity="0.7"/>
          <path d="M70 114 C70 64 94 54 120 54 C146 54 170 64 170 114 L158 166 L120 180 L82 166 Z" fill="url(#hcArmor)" stroke="url(#hcGold)" stroke-width="2.8"/>
          <path d="M120 56 V178" stroke="#0d0b09" stroke-width="2" opacity="0.45"/>
          <path d="M94 146 L120 156 L146 146" fill="none" stroke="url(#hcGold)" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#f2be6b', '#ff5b49', 'hcab')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 3: HOMBRE ALFIL (100% MITRA DE ALFIL TALLADA — CERO GATO) ===
  if (bossId === 'hombre_alfil') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Alfil">
        <defs>
          <radialGradient id="haBg" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="#1e352b"/><stop offset="100%" stop-color="#0e1311"/></radialGradient>
          <linearGradient id="haMitra" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#565249"/><stop offset="50%" stop-color="#29251f"/><stop offset="100%" stop-color="#11100d"/></linearGradient>
          <linearGradient id="haGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff0ae"/><stop offset="50%" stop-color="#cfa64c"/><stop offset="100%" stop-color="#694d14"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#haBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="95" fill="none" stroke="rgba(122,224,173,0.28)" stroke-width="2" stroke-dasharray="10 6"/>
        <path d="M22 240 L68 160 H172 L218 240 Z" fill="url(#haMitra)" stroke="url(#haGold)" stroke-width="2.2"/>
        <path d="M62 240 L120 162 L178 240" fill="#183828" opacity="0.6" stroke="#3c825f" stroke-width="3.2"/>
        <g class="portrait-float-part">
          <circle cx="120" cy="26" r="11" fill="url(#haGold)" stroke="#1e170a" stroke-width="2"/>
          <circle cx="117" cy="23" r="3.5" fill="#ffffff" opacity="0.7"/>
          <path d="M72 126 C70 72 95 40 120 36 C145 40 170 72 168 126 C166 158 148 176 120 176 C92 176 74 158 72 126 Z" fill="url(#haMitra)" stroke="url(#haGold)" stroke-width="2.6"/>
          <!-- Hendidura diagonal icónica del Alfil con brillo esmeralda -->
          <path d="M122 48 L148 78" stroke="#0b0d0c" stroke-width="6.5" stroke-linecap="round"/>
          <path d="M122 48 L148 78" stroke="#7ae0ad" stroke-width="3.2" stroke-linecap="round"/>
          <path d="M98 148 H142" stroke="url(#haGold)" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#7ae0ad', '#ff5b49', 'half')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 4: MUJER REINA (100% REINA DE AJEDREZ ESCULPIDA — CERO GATO) ===
  if (bossId === 'mujer_reina') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Mujer Reina">
        <defs>
          <radialGradient id="mrBg" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="#452432"/><stop offset="100%" stop-color="#140d10"/></radialGradient>
          <linearGradient id="mrBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#59414a"/><stop offset="52%" stop-color="#2d2025"/><stop offset="100%" stop-color="#140d10"/></linearGradient>
          <linearGradient id="mrGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff5c4"/><stop offset="50%" stop-color="#cfa64c"/><stop offset="100%" stop-color="#704f14"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#mrBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="95" fill="none" stroke="rgba(239,208,131,0.34)" stroke-width="2" stroke-dasharray="10 5"/>
        <path d="M30 240 L64 170 L120 188 L176 170 L210 240 Z" fill="url(#mrBody)" stroke="url(#mrGold)" stroke-width="2.4"/>
        <path d="M78 176 Q120 212 162 176" fill="none" stroke="url(#mrGold)" stroke-width="3"/>
        <circle cx="120" cy="198" r="7" fill="#c94b3c" stroke="url(#mrGold)" stroke-width="2"/>
        <g class="portrait-float-part">
          <!-- Corona real de 5 puntas con joyas especulares -->
          <path d="M68 86 L56 38 L92 64 L120 22 L148 64 L184 38 L172 86 Z" fill="url(#mrGold)" stroke="#241908" stroke-width="2.2" stroke-linejoin="round"/>
          <circle cx="56" cy="34" r="5.5" fill="#fff4c4" stroke="#362409" stroke-width="1.3"/>
          <circle cx="120" cy="18" r="6.8" fill="#ffffff" stroke="#cfa64c" stroke-width="1.6"/>
          <circle cx="184" cy="34" r="5.5" fill="#fff4c4" stroke="#362409" stroke-width="1.3"/>
          <path d="M76 86 H164 L154 160 L120 178 L86 160 Z" fill="url(#mrBody)" stroke="url(#mrGold)" stroke-width="2.6"/>
          <path d="M84 92 H156" stroke="#fff2be" stroke-width="1.5" opacity="0.55"/>
          <path d="M102 148 Q120 156 138 148" fill="none" stroke="url(#mrGold)" stroke-width="2.4" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#fff0b5', '#ff5b7a', 'mreina')}
      </svg>`;
  }

  // === CAP. 3: ENTIDAD GALÁCTICA Y HERALDOS CÓSMICOS (NEBULOSA CON PROFUNDIDAD Y ARMADURA ESTELAR) ===
  if (bossId && bossId.startsWith('galaxy_')) {
    const isBoss = bossId === 'galaxy_entity';
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Entidad Galáctica">
        <defs>
          <radialGradient id="gxPortBg" cx="50%" cy="38%" r="68%">
            <stop offset="0%" stop-color="#6046cc"/>
            <stop offset="48%" stop-color="#1e164d"/>
            <stop offset="100%" stop-color="#070514"/>
          </radialGradient>
          <radialGradient id="gxHead" cx="42%" cy="32%" r="65%">
            <stop offset="0%" stop-color="#6f5be0"/>
            <stop offset="52%" stop-color="#2c1f6e"/>
            <stop offset="100%" stop-color="#0e0926"/>
          </radialGradient>
          <linearGradient id="gxGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff4c4"/><stop offset="50%" stop-color="#efd083"/><stop offset="100%" stop-color="#7c5a18"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gxPortBg)"/>
        <g class="portrait-star-pulse" fill="#ffffff">
          <circle cx="26" cy="34" r="2.2"/><circle cx="208" cy="46" r="2.4"/><circle cx="42" cy="194" r="1.9"/>
          <circle cx="200" cy="184" r="2.2"/><circle cx="166" cy="28" r="1.7"/><circle cx="70" cy="42" r="1.8"/>
        </g>
        <ellipse class="portrait-aura-ring" cx="120" cy="118" rx="98" ry="30" fill="none" stroke="url(#gxGold)" stroke-width="2.2" stroke-dasharray="10 5" transform="rotate(-16 120 118)"/>
        <ellipse class="portrait-aura-ring" cx="120" cy="118" rx="84" ry="22" fill="none" stroke="#c4b5fd" stroke-width="1.3" transform="rotate(12 120 118)" opacity="0.65"/>
        <path d="M30 240 C44 180 76 162 120 162 C164 162 196 180 210 240 Z" fill="url(#gxHead)" stroke="#9d8df2" stroke-width="2.4"/>
        <circle cx="120" cy="198" r="14" fill="url(#gxGold)" opacity="0.92"/>
        <circle cx="120" cy="198" r="6" fill="#ffffff"/>
        <g class="portrait-float-part">
          ${isBoss ? `<path d="M72 86 L92 32 L120 54 L148 32 L168 86 Z" fill="#4c35ab" stroke="url(#gxGold)" stroke-width="2.4"/>` : ''}
          <ellipse cx="120" cy="114" rx="48" ry="54" fill="url(#gxHead)" stroke="#c4b5fd" stroke-width="2.8"/>
          <ellipse cx="106" cy="86" rx="22" ry="10" fill="#ffffff" opacity="0.16" transform="rotate(-14 106 86)"/>
          <circle cx="102" cy="82" r="2.2" fill="#fff4c4"/><circle cx="144" cy="140" r="2" fill="#ffffff"/>
        </g>
        ${chessVisorEyes('#fff3c4', '#ff6e9c', 'gal')}
      </svg>`;
  }

  // === BOSS SECRETO OCULTO POR URL: BLACKY (SCHNAUZER EXTREMO CON CORONA PLATINO Y RAYOS) ===
  if (bossId === 'blacky_secret') {
    return `
      <svg class="boss-portrait-svg blacky-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato del Boss Secreto BLACKY">
        <defs>
          <pattern id="bkCrownCheck" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#f5f7fb"/>
            <rect width="5" height="5" fill="#131418"/>
            <rect x="5" y="5" width="5" height="5" fill="#131418"/>
          </pattern>
          <radialGradient id="bkExtremeGlow" cx="50%" cy="46%" r="56%">
            <stop offset="0%" stop-color="rgba(230,240,255,0.28)"/>
            <stop offset="65%" stop-color="rgba(160,175,205,0.08)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
          </radialGradient>
        </defs>
        <rect width="240" height="240" fill="#16171b"/>
        <circle class="portrait-aura-ring" cx="120" cy="122" r="102" fill="none" stroke="rgba(230,238,255,0.42)" stroke-width="2.4" stroke-dasharray="12 5"/>
        <circle class="portrait-aura-ring" cx="120" cy="122" r="88" fill="url(#bkExtremeGlow)" stroke="rgba(195,212,245,0.28)" stroke-width="1.5" stroke-dasharray="6 8"/>
        <image href="/assets/images/blacky_ref.jpg" x="0" y="12" width="240" height="228" preserveAspectRatio="xMidYMid slice"/>
        <g class="mittens-arm-aura">
          <path class="mittens-arm-wisp" d="M24 236 C22 182, 58 162, 78 198" stroke="#eaf2ff" stroke-width="3.4"/>
          <path class="mittens-arm-wisp" d="M216 236 C218 182, 182 162, 162 198" stroke="#eaf2ff" stroke-width="3.4"/>
          <path class="mittens-arm-wisp" d="M34 122 L48 104 L40 92 L58 72" fill="none" stroke="#ffffff" stroke-width="2.4" opacity="0.88"/>
          <path class="mittens-arm-wisp" d="M206 122 L192 104 L200 92 L182 72" fill="none" stroke="#ffffff" stroke-width="2.4" opacity="0.88"/>
          <circle class="mittens-arm-spark" cx="38" cy="184" r="3.4"/><circle class="mittens-arm-spark" cx="202" cy="184" r="3.4"/>
        </g>
        <g class="portrait-float-part" transform="translate(120, 34)">
          <path d="M-32 6 L-38 -20 L-16 -7 L0 -30 L16 -7 L38 -20 L32 6 Z" fill="url(#bkCrownCheck)" stroke="#e5ecf7" stroke-width="2.4" stroke-linejoin="round"/>
          <rect x="-32" y="2" width="64" height="6" rx="2.6" fill="#d9e2f0" stroke="#181a20" stroke-width="1.4"/>
          <circle cx="0" cy="-31" r="4.2" fill="#ffffff" stroke="#181a20" stroke-width="1.3"/>
        </g>
        <g class="boss-pupil-group js-tracked-eyes">
          <g class="expr-layer on-thinking"><path d="M74 96 L108 104 M166 96 L132 104" stroke="#e8effa" stroke-width="3.2" stroke-linecap="round"/></g>
          <g class="expr-layer on-happy"><circle cx="94" cy="112" r="5" fill="#ffffff" opacity="0.9"/><circle cx="146" cy="112" r="5" fill="#ffffff" opacity="0.9"/></g>
          <g class="expr-layer on-surprised">
            <path d="M70 92 L110 106 M170 92 L130 106" stroke="#ffffff" stroke-width="3.8" stroke-linecap="round"/>
            <circle cx="94" cy="112" r="6" fill="#d8ebff" opacity="0.78"/><circle cx="146" cy="112" r="6" fill="#d8ebff" opacity="0.78"/>
          </g>
        </g>
      </svg>`;
  }

  // === CAP. 4: BOSS GLITCH (TEXTURA REAL SUBIDA + SHARDS RGB + NÚCLEO FRACTURADO) ===
  if (bossId && (bossId.startsWith('glitch_') || bossId === 'boss_glitch')) {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Boss Glitch">
        <defs>
          <pattern id="glitchTexPort" patternUnits="userSpaceOnUse" width="240" height="240">
            <image href="/assets/images/glitch_texture.jpg" x="0" y="0" width="240" height="240" preserveAspectRatio="xMidYMid slice"/>
          </pattern>
          <linearGradient id="glShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#12040a" stop-opacity="0.58"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="#0d070a"/>
        <rect width="240" height="240" fill="url(#glitchTexPort)" opacity="0.35"/>
        <g class="portrait-glitch-jitter">
          <rect x="6" y="30" width="228" height="12" fill="url(#glitchTexPort)" opacity="0.82"/>
          <rect x="14" y="162" width="212" height="10" fill="url(#glitchTexPort)" opacity="0.72"/>
          <!-- Doble desplazamiento cromático RGB -->
          <polygon points="75,74 125,44 173,76 161,164 121,182 81,158" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.65"/>
          <polygon points="69,78 119,48 167,80 155,168 115,186 75,162" fill="none" stroke="#ff3d5a" stroke-width="2" opacity="0.65"/>
          <path d="M24 240 L60 168 H180 L216 240 Z" fill="url(#glitchTexPort)" stroke="#ff5e57" stroke-width="2.4"/>
          <path d="M24 240 L60 168 H180 L216 240 Z" fill="url(#glShade)"/>
          <polygon points="72,76 122,46 170,78 158,166 118,184 78,160" fill="url(#glitchTexPort)" stroke="#ffffff" stroke-width="2.8"/>
          <polygon points="72,76 122,46 170,78 158,166 118,184 78,160" fill="url(#glShade)"/>
          <path d="M56 118 L188 104" stroke="#ff5e57" stroke-width="2.6" stroke-dasharray="10 5"/>
          <polygon points="118,186 128,204 118,218 108,204" fill="#ff3d5a" stroke="#ffffff" stroke-width="1.5"/>
        </g>
        ${chessVisorEyes('#ffffff', '#ff3d5a', 'glitch')}
      </svg>`;
  }

  // === CAP. 5: CHESS (TEXTURA DE TABLERO DE AJEDREZ CON VOLUMEN 3D, BISEL DORADO Y CORONA) ===
  if (bossId && bossId.startsWith('chess_')) {
    const isFinal = bossId === 'chess_god';
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="CHESS">
        <defs>
          <pattern id="chessBoardTexPort" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#171511"/>
            <rect x="0" y="0" width="12" height="12" fill="#f4ecdb"/>
            <rect x="12" y="12" width="12" height="12" fill="#f4ecdb"/>
          </pattern>
          <linearGradient id="chVolume" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
            <stop offset="50%" stop-color="#000000" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.48"/>
          </linearGradient>
          <linearGradient id="chGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff8d6"/><stop offset="50%" stop-color="#efd083"/><stop offset="100%" stop-color="#7c5b18"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="#100f0c"/>
        <rect width="240" height="240" fill="url(#chessBoardTexPort)" opacity="0.18"/>
        <circle class="portrait-aura-ring" cx="120" cy="120" r="99" fill="none" stroke="url(#chGold)" stroke-width="${isFinal ? '2.8' : '1.6'}" opacity="0.65"/>
        <!-- Manto real con textura de tablero de ajedrez + sombra 3D -->
        <path d="M26 240 L68 168 H172 L214 240 Z" fill="url(#chessBoardTexPort)" stroke="url(#chGold)" stroke-width="2.6"/>
        <path d="M26 240 L68 168 H172 L214 240 Z" fill="url(#chVolume)"/>
        <path d="M84 170 L120 216 L156 170" fill="none" stroke="url(#chGold)" stroke-width="3"/>
        <g class="portrait-float-part">
          <path d="M120 12 V46 M103 27 H137" stroke="url(#chGold)" stroke-width="5.2" stroke-linecap="round"/>
          <path d="M70 94 L94 58 L120 76 L146 58 L170 94 L160 172 L120 188 L80 172 Z" fill="url(#chessBoardTexPort)" stroke="url(#chGold)" stroke-width="3"/>
          <path d="M70 94 L94 58 L120 76 L146 58 L170 94 L160 172 L120 188 L80 172 Z" fill="url(#chVolume)"/>
          <rect x="76" y="105" width="88" height="34" rx="7" fill="#100e0b" opacity="0.88" stroke="url(#chGold)" stroke-width="1.8"/>
          <path d="M96 158 H144" stroke="url(#chGold)" stroke-width="2.8" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#fff6d6', '#cfa64c', 'chess')}
      </svg>`;
  }

  // === CAP. 1 NIVELES 1-4: GUARDIANES MAYA (PIEDRA TALLADA CON RELIEVE, ORO Y ANTORCHA) ===
  if (bossId === 'maya_sentinel' || bossId === 'maya_jade_guard' || bossId === 'maya_jaguar' || bossId === 'maya_eclipse') {
    const palette = {
      maya_sentinel: { bg1: '#3a3025', bg2: '#14110d', p1: '#5d5244', p2: '#241f19', accent: '#cfa64c', eye: '#f0c259', crown: 'M78 88 Q120 28 162 88 Z' },
      maya_jade_guard: { bg1: '#234232', bg2: '#0d1712', p1: '#428562', p2: '#183828', accent: '#efd083', eye: '#7ae0ad', crown: 'M72 90 H168 L156 50 H84 Z' },
      maya_jaguar: { bg1: '#3f2e1f', bg2: '#140f0a', p1: '#594836', p2: '#241d15', accent: '#d99436', eye: '#ffd466', crown: 'M70 96 L84 40 L108 72 L120 44 L132 72 L156 40 L170 96 Z' },
      maya_eclipse: { bg1: '#3b2421', bg2: '#130c0b', p1: '#523833', p2: '#221614', accent: '#e07a52', eye: '#ffae66', crown: 'M74 88 L98 44 L120 26 L142 44 L166 88 Z' }
    }[bossId];
    const uid = bossId;

    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Guardián Maya">
        <defs>
          <radialGradient id="mgBg_${uid}" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="${palette.bg1}"/><stop offset="100%" stop-color="${palette.bg2}"/></radialGradient>
          <linearGradient id="mgSt_${uid}" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="${palette.p1}"/><stop offset="100%" stop-color="${palette.p2}"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#mgBg_${uid})"/>
        <circle class="portrait-aura-ring" cx="120" cy="100" r="82" fill="none" stroke="${palette.accent}" stroke-width="1.8" stroke-dasharray="9 6" opacity="0.4"/>
        <path class="portrait-float-part" d="${palette.crown}" fill="${palette.accent}" stroke="#191510" stroke-width="2.4"/>
        <path d="M30 240 L58 178 H182 L210 240 Z" fill="url(#mgSt_${uid})" stroke="${palette.accent}" stroke-width="2.2"/>
        <path d="M84 180 Q120 212 156 180" fill="none" stroke="${palette.accent}" stroke-width="2.6"/>
        <path d="M72 90 H168 L158 176 L120 194 L82 176 Z" fill="url(#mgSt_${uid})" stroke="${palette.accent}" stroke-width="2.6"/>
        <path d="M80 96 H160 L154 114 H86 Z" fill="#0d0b09" opacity="0.45"/>
        ${chessVisorEyes(palette.eye, '#ff5b49', uid)}
        <path d="M98 162 H142" stroke="${palette.accent}" stroke-width="2.8" stroke-linecap="round"/>
      </svg>`;
  }

  // === CAP. 1 NIVEL 5: DIOS MAYA (ORIGINAL ELEVADO CON ORO BRUÑIDO, JADE Y RELIEVES) ===
  if (bossId === 'rey_maya') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato del Dios Maya">
        <defs>
          <radialGradient id="pmBg" cx="50%" cy="32%" r="68%"><stop offset="0%" stop-color="#4c3f28"/><stop offset="60%" stop-color="#211b13"/><stop offset="100%" stop-color="#100e0b"/></radialGradient>
          <linearGradient id="pmGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff0a8"/><stop offset="48%" stop-color="#cfa64c"/><stop offset="100%" stop-color="#6c4d14"/></linearGradient>
          <linearGradient id="pmStone" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="#6a5e4f"/><stop offset="52%" stop-color="#342e26"/><stop offset="100%" stop-color="#191612"/></linearGradient>
          <linearGradient id="pmJade" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4ba176"/><stop offset="100%" stop-color="#1a3e2c"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#pmBg)"/>
        <polygon points="10,240 230,240 192,162 48,162" fill="#1d1914" opacity="0.82"/>
        <polygon points="48,162 192,162 162,110 78,110" fill="#25201a" opacity="0.82"/>
        <g class="portrait-float-part">
          <path d="M120 92 C66 20, 20 34, 4 76 C44 76, 80 90, 104 114 Z" fill="url(#pmJade)" stroke="#122b1e" stroke-width="1.6"/>
          <path d="M120 92 C174 20, 220 34, 236 76 C196 76, 160 90, 136 114 Z" fill="url(#pmJade)" stroke="#122b1e" stroke-width="1.6"/>
          <path d="M66 96 L86 56 L106 74 L120 36 L134 74 L154 56 L174 96 Z" fill="url(#pmGold)" stroke="#261d0f" stroke-width="2.2"/>
          <circle cx="120" cy="76" r="11" fill="url(#pmJade)" stroke="#fff0b3" stroke-width="2.2"/>
          <circle cx="120" cy="76" r="4" fill="#fff4c4"/>
        </g>
        <path d="M22 240 L48 182 L192 182 L218 240 Z" fill="url(#pmStone)" stroke="url(#pmGold)" stroke-width="2.2"/>
        <path d="M72 184 Q120 222 168 184 L180 216 Q120 246 60 216 Z" fill="url(#pmGold)" stroke="#231b0e" stroke-width="2"/>
        <path d="M70 94 H170 L160 176 L120 196 L80 176 Z" fill="url(#pmStone)" stroke="url(#pmGold)" stroke-width="2.8"/>
        <path d="M78 100 H162 L156 116 H84 Z" fill="#12100d" opacity="0.48"/>
        <circle cx="64" cy="136" r="12" fill="url(#pmJade)" stroke="url(#pmGold)" stroke-width="2.6"/>
        <circle cx="176" cy="136" r="12" fill="url(#pmJade)" stroke="url(#pmGold)" stroke-width="2.6"/>
        ${chessVisorEyes('#f0c259', '#ff5b49', 'maya')}
        <path class="expr-layer on-idle" d="M102 164 H138" stroke="url(#pmGold)" stroke-width="2.8" stroke-linecap="round"/>
        <path class="expr-layer on-thinking" d="M106 166 Q120 158 134 166" fill="none" stroke="#efd083" stroke-width="2.8" stroke-linecap="round"/>
        <path class="expr-layer on-happy" d="M98 158 Q120 176 142 158" fill="none" stroke="#fff0b5" stroke-width="3.2" stroke-linecap="round"/>
        <path class="expr-layer on-surprised" d="M104 170 Q120 154 136 170" fill="none" stroke="#ff7c6b" stroke-width="3.2" stroke-linecap="round"/>
        <path class="expr-layer on-disabled" d="M104 164 H136" stroke="#6c665a" stroke-width="2.4" stroke-linecap="round"/>
      </svg>`;
  }

  // Autómata Clásico (Vs IA / Partida Rápida / Contra el Tiempo — bronce y obsidiana bruñidos)
  return `
    <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Autómata CHESS.MOD">
      <defs>
        <radialGradient id="autBg" cx="50%" cy="32%" r="70%"><stop offset="0%" stop-color="#2c261f"/><stop offset="100%" stop-color="#110f0c"/></radialGradient>
        <radialGradient id="autMetal" cx="40%" cy="30%" r="68%"><stop offset="0%" stop-color="#584f42"/><stop offset="55%" stop-color="#28231d"/><stop offset="100%" stop-color="#13110e"/></radialGradient>
        <linearGradient id="autGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff0ae"/><stop offset="50%" stop-color="#cfa64c"/><stop offset="100%" stop-color="#6c4e15"/></linearGradient>
      </defs>
      <rect width="240" height="240" fill="url(#autBg)"/>
      <circle class="portrait-aura-ring" cx="120" cy="118" r="82" fill="none" stroke="url(#autGold)" stroke-width="1.8" stroke-dasharray="10 6" opacity="0.45"/>
      <path d="M44 240 L74 174 H166 L196 240 Z" fill="url(#autMetal)" stroke="url(#autGold)" stroke-width="2.2"/>
      <g class="portrait-float-part">
        <circle cx="120" cy="116" r="62" fill="url(#autMetal)" stroke="url(#autGold)" stroke-width="2.8"/>
        <ellipse cx="102" cy="84" rx="24" ry="10" fill="#ffffff" opacity="0.14" transform="rotate(-18 102 84)"/>
        <path d="M120 34 V58 M108 45 H132" stroke="url(#autGold)" stroke-width="4" stroke-linecap="round"/>
        <path d="M94 148 H146" stroke="#459c72" stroke-width="3.6" stroke-linecap="round"/>
      </g>
      ${chessVisorEyes('#efd083', '#ff5b49', 'auto')}
    </svg>`;
}
