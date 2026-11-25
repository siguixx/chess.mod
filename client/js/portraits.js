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

let _portraitUidSeq = 0;

/**
 * Aisla TODOS los IDs internos de <defs> (gradientes, patrones, clipPaths, filtros)
 * en cada instancia SVG para que jamás colisionen con miniaturas ocultas (#app-shell.hidden).
 */
function scopeSvgIds(svgMarkup) {
  const suffix = `_u${++_portraitUidSeq}`;
  const ids = new Set();
  const idRegex = /\bid="([^"]+)"/g;
  let m;
  while ((m = idRegex.exec(svgMarkup)) !== null) {
    ids.add(m[1]);
  }
  let out = svgMarkup;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`id="${escaped}"`, 'g'), `id="${id}${suffix}"`);
    out = out.replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${id}${suffix})`);
    out = out.replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${id}${suffix}"`);
  }
  return out;
}

export function getBossPortraitSVG(bossId) {
  return scopeSvgIds(buildBossPortraitSVG(bossId));
}

function buildBossPortraitSVG(bossId) {
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

  // === CAP. 2 NIVEL 1: HOMBRE PEÓN (GUERRERO PEÓN EN BRONCE, MARFIL Y OBSIDIANA — ALTA VISIBILIDAD, CERO GATO) ===
  if (bossId === 'hombre_peon') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Peón">
        <defs>
          <radialGradient id="hpBg" cx="50%" cy="32%" r="72%">
            <stop offset="0%" stop-color="#6b5438"/>
            <stop offset="55%" stop-color="#2e2318"/>
            <stop offset="100%" stop-color="#120d09"/>
          </radialGradient>
          <radialGradient id="hpSphere" cx="34%" cy="26%" r="70%">
            <stop offset="0%" stop-color="#f3e6cc"/>
            <stop offset="32%" stop-color="#a8906e"/>
            <stop offset="70%" stop-color="#4e4031"/>
            <stop offset="100%" stop-color="#1f1812"/>
          </radialGradient>
          <linearGradient id="hpArmor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#c6ae88"/>
            <stop offset="48%" stop-color="#65533f"/>
            <stop offset="100%" stop-color="#241c15"/>
          </linearGradient>
          <linearGradient id="hpGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff7cb"/>
            <stop offset="48%" stop-color="#dfb24f"/>
            <stop offset="100%" stop-color="#7c5613"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#hpBg)"/>
        <polygon points="120,16 140,224 100,224" fill="#efd083" opacity="0.06"/>
        <circle class="portrait-aura-ring" cx="120" cy="118" r="98" fill="none" stroke="url(#hpGold)" stroke-width="2.2" stroke-dasharray="12 6" opacity="0.58"/>
        <!-- Silueta heroica de armadura de Peón con hombreras esféricas luminosas y capa -->
        <path d="M10 240 L40 162 H200 L230 240 Z" fill="#2c1d15" opacity="0.9"/>
        <g stroke="url(#hpGold)" stroke-width="2.4">
          <circle cx="42" cy="154" r="23" fill="url(#hpSphere)"/>
          <ellipse cx="34" cy="144" rx="8" ry="4.5" fill="#ffffff" opacity="0.45" stroke="none"/>
          <path d="M18 240 C22 192 32 174 42 174 C52 174 62 192 66 240 Z" fill="url(#hpArmor)"/>
          <circle cx="198" cy="154" r="23" fill="url(#hpSphere)"/>
          <ellipse cx="190" cy="144" rx="8" ry="4.5" fill="#ffffff" opacity="0.45" stroke="none"/>
          <path d="M174 240 C178 192 188 174 198 174 C208 174 218 192 222 240 Z" fill="url(#hpArmor)"/>
          <!-- Peto cincelado de infantería -->
          <path d="M60 240 C66 178 86 156 120 156 C154 156 174 178 180 240 Z" fill="url(#hpArmor)"/>
          <path d="M74 152 H166 L158 172 H82 Z" fill="url(#hpGold)" stroke="#2b1e0a" stroke-width="2"/>
          <path d="M90 180 L120 220 L150 180" fill="#2b2117" stroke="url(#hpGold)" stroke-width="2.8"/>
          <circle cx="120" cy="196" r="9" fill="url(#hpGold)" stroke="#241807" stroke-width="1.8"/>
          <text x="120" y="201" text-anchor="middle" font-size="11" fill="#1c1205" stroke="none">♟</text>
        </g>
        <!-- Yelmo esférico icónico del Peón con cimera dorada y placas faciales brillantes -->
        <g class="portrait-float-part">
          <path d="M112 36 L120 22 L128 36 L124 62 H116 Z" fill="url(#hpGold)" stroke="#2a1c08" stroke-width="1.6"/>
          <circle cx="120" cy="108" r="52" fill="url(#hpSphere)" stroke="url(#hpGold)" stroke-width="3.2"/>
          <ellipse cx="100" cy="78" rx="22" ry="11" fill="#ffffff" opacity="0.38" transform="rotate(-18 100 78)"/>
          <!-- Banda frontal dorada y mentonera táctica -->
          <path d="M72 95 Q120 68 168 95" fill="none" stroke="url(#hpGold)" stroke-width="3.4"/>
          <rect x="76" y="102" width="88" height="30" rx="8" fill="#17120d" stroke="url(#hpGold)" stroke-width="2"/>
          <path d="M84 142 H156 L146 154 H94 Z" fill="url(#hpGold)" stroke="#2a1d0a" stroke-width="1.6"/>
          <path d="M98 148 H142" stroke="#1b140b" stroke-width="2.4" stroke-dasharray="6 4"/>
        </g>
        ${chessVisorEyes('#fff0a8', '#ff5b49', 'hpeon')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 2: HOMBRE CABALLO (PALADÍN ECUESTRE DE BRONCE Y ORO — SILUETA DE CABALLO CLARA, CERO GATO) ===
  if (bossId === 'hombre_caballo') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Caballo">
        <defs>
          <radialGradient id="hcBg" cx="50%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#6e4a22"/>
            <stop offset="56%" stop-color="#2c1d10"/>
            <stop offset="100%" stop-color="#110b06"/>
          </radialGradient>
          <linearGradient id="hcArmor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#d6ba91"/>
            <stop offset="45%" stop-color="#755a3e"/>
            <stop offset="100%" stop-color="#271d14"/>
          </linearGradient>
          <linearGradient id="hcGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6be"/>
            <stop offset="50%" stop-color="#e59e38"/>
            <stop offset="100%" stop-color="#76470c"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#hcBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="118" r="98" fill="none" stroke="url(#hcGold)" stroke-width="2.4" stroke-dasharray="14 6" opacity="0.62"/>
        <g stroke="url(#hcGold)" stroke-width="2.4">
          <!-- Hombreras con perfil de cabezas de caballo blindadas -->
          <path d="M12 240 L26 150 C44 128 74 138 80 172 L72 240 Z" fill="url(#hcArmor)"/>
          <path d="M228 240 L214 150 C196 128 166 138 160 172 L168 240 Z" fill="url(#hcArmor)"/>
          <path d="M64 240 L76 164 H164 L176 240 Z" fill="url(#hcArmor)"/>
          <path d="M88 168 L120 218 L152 168" fill="#2c1d10" stroke="url(#hcGold)" stroke-width="3"/>
          <polygon points="120,178 130,196 120,210 110,196" fill="url(#hcGold)" stroke="#241608" stroke-width="1.4"/>
        </g>
        <g class="portrait-float-part">
          <!-- Crin blindada de Caballo de Ajedrez + yelmo angular con luz especular -->
          <path d="M80 74 L92 18 L114 42 L120 12 L126 42 L148 18 L160 74 Z" fill="url(#hcGold)" stroke="#261707" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M120 16 V68" stroke="#fff9d6" stroke-width="2.2" opacity="0.8"/>
          <path d="M66 114 C66 62 92 50 120 50 C148 50 174 62 174 114 L162 168 L120 184 L78 168 Z" fill="url(#hcArmor)" stroke="url(#hcGold)" stroke-width="3"/>
          <path d="M74 102 H166 L160 132 H80 Z" fill="#17110c" stroke="url(#hcGold)" stroke-width="2"/>
          <path d="M120 52 V102 M120 132 V182" stroke="url(#hcGold)" stroke-width="2.2" opacity="0.75"/>
          <path d="M90 150 L120 162 L150 150" fill="none" stroke="#fff2b5" stroke-width="2.8" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#ffd478', '#ff5b49', 'hcab')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 3: HOMBRE ALFIL (ARCONTE ALFIL EN ESMERALDA, MARFIL Y ORO — CERO GATO) ===
  if (bossId === 'hombre_alfil') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Hombre Alfil">
        <defs>
          <radialGradient id="haBg" cx="50%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#2c634a"/>
            <stop offset="56%" stop-color="#142b21"/>
            <stop offset="100%" stop-color="#09120e"/>
          </radialGradient>
          <linearGradient id="haMitra" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#c9d9cc"/>
            <stop offset="44%" stop-color="#587061"/>
            <stop offset="100%" stop-color="#19241e"/>
          </linearGradient>
          <linearGradient id="haGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6c2"/>
            <stop offset="50%" stop-color="#d8ae4e"/>
            <stop offset="100%" stop-color="#6b4d12"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#haBg)"/>
        <!-- Rayos diagonales emblemáticos del Alfil -->
        <path d="M0 0 L240 240 M240 0 L0 240" stroke="#7ae0ad" stroke-width="2" opacity="0.16"/>
        <circle class="portrait-aura-ring" cx="120" cy="118" r="98" fill="none" stroke="#7ae0ad" stroke-width="2.2" stroke-dasharray="12 6" opacity="0.5"/>
        <path d="M18 240 L64 158 H176 L222 240 Z" fill="url(#haMitra)" stroke="url(#haGold)" stroke-width="2.4"/>
        <path d="M58 240 L120 160 L182 240" fill="#184a34" stroke="url(#haGold)" stroke-width="3"/>
        <polygon points="120,176 132,196 120,214 108,196" fill="#7ae0ad" stroke="url(#haGold)" stroke-width="2"/>
        <g class="portrait-float-part">
          <circle cx="120" cy="24" r="12.5" fill="url(#haGold)" stroke="#1a1409" stroke-width="2.2"/>
          <circle cx="116" cy="20" r="4" fill="#ffffff" opacity="0.85"/>
          <path d="M70 126 C68 68 94 38 120 34 C146 38 172 68 170 126 C168 160 150 178 120 178 C90 178 72 160 70 126 Z" fill="url(#haMitra)" stroke="url(#haGold)" stroke-width="3"/>
          <rect x="76" y="102" width="88" height="30" rx="8" fill="#0d1712" stroke="url(#haGold)" stroke-width="2"/>
          <!-- Hendidura diagonal luminosa icónica del Alfil -->
          <path d="M122 44 L154 80" stroke="#08110c" stroke-width="8" stroke-linecap="round"/>
          <path d="M122 44 L154 80" stroke="#8ff5c3" stroke-width="4" stroke-linecap="round"/>
          <path d="M94 150 H146" stroke="url(#haGold)" stroke-width="3" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#8ff5c3', '#ff5b49', 'half')}
      </svg>`;
  }

  // === CAP. 2 NIVEL 4: MUJER REINA (EMPERATRIZ REINA EN CARMESÍ, MARFIL Y ORO — CERO GATO) ===
  if (bossId === 'mujer_reina') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Mujer Reina">
        <defs>
          <radialGradient id="mrBg" cx="50%" cy="28%" r="72%">
            <stop offset="0%" stop-color="#7d2e4c"/>
            <stop offset="56%" stop-color="#311220"/>
            <stop offset="100%" stop-color="#12070c"/>
          </radialGradient>
          <linearGradient id="mrBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#dfb8c6"/>
            <stop offset="46%" stop-color="#6e3e52"/>
            <stop offset="100%" stop-color="#220f17"/>
          </linearGradient>
          <linearGradient id="mrGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff8cc"/>
            <stop offset="48%" stop-color="#e3b652"/>
            <stop offset="100%" stop-color="#7a5412"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#mrBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="118" r="98" fill="none" stroke="url(#mrGold)" stroke-width="2.4" stroke-dasharray="10 5" opacity="0.62"/>
        <!-- Cuello alto regio + coraza imperial -->
        <path d="M46 154 L76 124 H164 L194 154 L182 186 H58 Z" fill="#4f1b31" stroke="url(#mrGold)" stroke-width="2.2"/>
        <path d="M24 240 L60 168 L120 190 L180 168 L216 240 Z" fill="url(#mrBody)" stroke="url(#mrGold)" stroke-width="2.6"/>
        <path d="M74 174 Q120 218 166 174" fill="none" stroke="url(#mrGold)" stroke-width="3.4"/>
        <polygon points="120,186 130,200 120,214 110,200" fill="#ff4d6d" stroke="url(#mrGold)" stroke-width="2"/>
        <g class="portrait-float-part">
          <!-- Corona de Reina de 5 puntas con joyas resplandecientes -->
          <path d="M64 88 L50 36 L88 64 L120 18 L152 64 L190 36 L176 88 Z" fill="url(#mrGold)" stroke="#241707" stroke-width="2.4" stroke-linejoin="round"/>
          <circle cx="50" cy="31" r="6" fill="#fff7cc" stroke="#362409" stroke-width="1.4"/>
          <circle cx="88" cy="60" r="4.5" fill="#ff4d6d"/>
          <circle cx="120" cy="15" r="7.5" fill="#ffffff" stroke="#e3b652" stroke-width="2"/>
          <circle cx="152" cy="60" r="4.5" fill="#ff4d6d"/>
          <circle cx="190" cy="31" r="6" fill="#fff7cc" stroke="#362409" stroke-width="1.4"/>
          <path d="M74 86 H166 L156 160 L120 180 L84 160 Z" fill="url(#mrBody)" stroke="url(#mrGold)" stroke-width="3"/>
          <rect x="78" y="102" width="84" height="30" rx="8" fill="#180a11" stroke="url(#mrGold)" stroke-width="2"/>
          <path d="M100 150 Q120 160 140 150" fill="none" stroke="#fff4c4" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#fff3be', '#ff4d6d', 'mreina')}
      </svg>`;
  }

  // === CAP. 3 NIVELES 1-4: PERSONAJES ÚNICOS DE GALAXIA (COMETA, PÚLSAR, NEBULOSA, QUÁSAR — DISTINTOS AL BOSS) ===
  if (bossId === 'galaxy_herald') {
    // Nv.1: Explorador Cometa — Yelmo cristalino de hielo cósmico con estela azul-cian
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Explorador Cometa">
        <defs>
          <radialGradient id="gComBg" cx="35%" cy="30%" r="76%"><stop offset="0%" stop-color="#1e6b8a"/><stop offset="56%" stop-color="#0d2840"/><stop offset="100%" stop-color="#040b14"/></radialGradient>
          <linearGradient id="gComIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e0f7ff"/><stop offset="48%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gComBg)"/>
        <path d="M12 36 Q92 48 164 114 L138 144 Q72 86 6 66 Z" fill="#38bdf8" opacity="0.28"/>
        <path d="M22 18 Q106 38 178 96" fill="none" stroke="#bae6fd" stroke-width="3" stroke-dasharray="10 6" opacity="0.7"/>
        <path d="M24 240 L62 170 H178 L216 240 Z" fill="#133452" stroke="#7dd3fc" stroke-width="2.4"/>
        <polygon points="120,176 138,202 120,224 102,202" fill="url(#gComIce)" stroke="#ffffff" stroke-width="1.6"/>
        <g class="portrait-float-part">
          <polygon points="120,20 156,64 172,118 148,174 120,188 92,174 68,118 84,64" fill="url(#gComIce)" stroke="#e0f2fe" stroke-width="2.8"/>
          <polygon points="120,20 136,68 120,104 104,68" fill="#ffffff" opacity="0.45"/>
          <polygon points="78,104 162,104 152,134 88,134" fill="#071829" stroke="#7dd3fc" stroke-width="2"/>
        </g>
        ${chessVisorEyes('#7dd3fc', '#fde047', 'gcomet')}
      </svg>`;
  }

  if (bossId === 'galaxy_weaver') {
    // Nv.2: Centinela Púlsar — Estrella de neutrones turquesa con chorros polares y anillos magnéticos
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Centinela Púlsar">
        <defs>
          <radialGradient id="gPulBg" cx="50%" cy="46%" r="72%"><stop offset="0%" stop-color="#135d66"/><stop offset="56%" stop-color="#082830"/><stop offset="100%" stop-color="#030d10"/></radialGradient>
          <radialGradient id="gPulCore" cx="50%" cy="44%" r="54%"><stop offset="0%" stop-color="#ffffff"/><stop offset="35%" stop-color="#5eead4"/><stop offset="75%" stop-color="#0f766e"/><stop offset="100%" stop-color="#042f2e"/></radialGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gPulBg)"/>
        <polygon points="120,116 98,0 142,0" fill="#5eead4" opacity="0.28"/>
        <polygon points="120,116 98,240 142,240" fill="#5eead4" opacity="0.22"/>
        <ellipse class="portrait-aura-ring" cx="120" cy="114" rx="98" ry="38" fill="none" stroke="#2dd4bf" stroke-width="2.6" transform="rotate(-24 120 114)"/>
        <ellipse class="portrait-aura-ring" cx="120" cy="114" rx="98" ry="38" fill="none" stroke="#99f6e4" stroke-width="1.6" stroke-dasharray="8 6" transform="rotate(24 120 114)"/>
        <path d="M36 240 L72 174 H168 L204 240 Z" fill="#0d3d42" stroke="#5eead4" stroke-width="2.4"/>
        <g class="portrait-float-part">
          <circle cx="120" cy="114" r="52" fill="url(#gPulCore)" stroke="#ccfbf1" stroke-width="3"/>
          <rect x="76" y="102" width="88" height="28" rx="12" fill="#041c1e" stroke="#5eead4" stroke-width="2"/>
        </g>
        ${chessVisorEyes('#5eead4', '#fb7185', 'gpulsar')}
      </svg>`;
  }

  if (bossId === 'galaxy_warden') {
    // Nv.3: Tejedora de Nebulosa — Velo cósmico rosa-magenta y astrolabio dorado
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Tejedora de Nebulosa">
        <defs>
          <radialGradient id="gNebBg" cx="50%" cy="35%" r="74%"><stop offset="0%" stop-color="#9d174d"/><stop offset="52%" stop-color="#3b0764"/><stop offset="100%" stop-color="#090314"/></radialGradient>
          <linearGradient id="gNebVeil" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fbcfe8"/><stop offset="45%" stop-color="#c026d3"/><stop offset="100%" stop-color="#31105c"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gNebBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="116" r="96" fill="none" stroke="#f472b6" stroke-width="2.2" stroke-dasharray="14 6"/>
        <path d="M14 240 C30 156 58 112 120 112 C182 112 210 156 226 240 Z" fill="url(#gNebVeil)" stroke="#fde68a" stroke-width="2.2"/>
        <g class="portrait-float-part">
          <path d="M64 114 C64 56 88 32 120 32 C152 32 176 56 176 114 L158 176 L120 190 L82 176 Z" fill="#2e1065" stroke="#f9a8d4" stroke-width="2.8"/>
          <path d="M74 68 Q120 26 166 68" fill="none" stroke="#fde68a" stroke-width="3"/>
          <circle cx="120" cy="44" r="8" fill="#fde68a" stroke="#3b0764" stroke-width="2"/>
          <rect x="78" y="102" width="84" height="28" rx="9" fill="#130529" stroke="#f472b6" stroke-width="2"/>
        </g>
        ${chessVisorEyes('#f9a8d4', '#fde047', 'gneb')}
      </svg>`;
  }

  if (bossId === 'galaxy_archon') {
    // Nv.4: Guardián Quásar — Titán solar dorado-ámbar con disco de acreción ardiente
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Guardián Quásar">
        <defs>
          <radialGradient id="gQuaBg" cx="50%" cy="38%" r="74%"><stop offset="0%" stop-color="#d97706"/><stop offset="48%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#0b0517"/></radialGradient>
          <linearGradient id="gQuaArmor" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="48%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#581c87"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gQuaBg)"/>
        <ellipse cx="120" cy="116" rx="112" ry="26" fill="none" stroke="#fef08a" stroke-width="4" opacity="0.65" transform="rotate(-10 120 116)"/>
        <path d="M18 240 L54 166 H186 L222 240 Z" fill="url(#gQuaArmor)" stroke="#fef08a" stroke-width="2.6"/>
        <circle cx="120" cy="202" r="16" fill="#0f0720" stroke="#fde047" stroke-width="3"/>
        <circle cx="120" cy="202" r="7" fill="#ffffff"/>
        <g class="portrait-float-part">
          <path d="M62 96 L82 28 L108 62 L120 14 L132 62 L158 28 L178 96 Z" fill="#fde047" stroke="#3b0764" stroke-width="2.4"/>
          <polygon points="70,92 170,92 162,168 120,188 78,168" fill="url(#gQuaArmor)" stroke="#fef9c3" stroke-width="2.8"/>
          <polygon points="78,104 162,104 154,134 86,134" fill="#130826" stroke="#fde047" stroke-width="2"/>
        </g>
        ${chessVisorEyes('#fef08a', '#fb7185', 'gquasar')}
      </svg>`;
  }

  // === CAP. 3 NIVEL 5: ENTIDAD GALÁCTICA (BOSS CON COLOSO ESTELAR Y ANILLOS ORBITALES) ===
  if (bossId && bossId.startsWith('galaxy_')) {
    const isBoss = bossId === 'galaxy_entity';
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Entidad Galáctica">
        <defs>
          <radialGradient id="gxPortBg" cx="50%" cy="36%" r="72%">
            <stop offset="0%" stop-color="#7c5cf2"/>
            <stop offset="46%" stop-color="#271b66"/>
            <stop offset="100%" stop-color="#060414"/>
          </radialGradient>
          <radialGradient id="gxHead" cx="40%" cy="28%" r="68%">
            <stop offset="0%" stop-color="#b5a6ff"/>
            <stop offset="44%" stop-color="#4c35ab"/>
            <stop offset="100%" stop-color="#110a30"/>
          </radialGradient>
          <linearGradient id="gxGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff8d6"/>
            <stop offset="50%" stop-color="#f0cd74"/>
            <stop offset="100%" stop-color="#7c5616"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#gxPortBg)"/>
        <g class="portrait-star-pulse" fill="#ffffff">
          <circle cx="24" cy="34" r="2.6"/><circle cx="212" cy="44" r="2.8"/><circle cx="38" cy="196" r="2.2"/>
          <circle cx="204" cy="186" r="2.4"/><circle cx="174" cy="26" r="2"/><circle cx="66" cy="38" r="2"/>
          <path d="M196 28 L199 38 L209 41 L199 44 L196 54 L193 44 L183 41 L193 38 Z" fill="#fff4c4"/>
        </g>
        <ellipse class="portrait-aura-ring" cx="120" cy="118" rx="102" ry="32" fill="none" stroke="url(#gxGold)" stroke-width="2.6" stroke-dasharray="12 5" transform="rotate(-16 120 118)"/>
        <ellipse class="portrait-aura-ring" cx="120" cy="118" rx="88" ry="24" fill="none" stroke="#c4b5fd" stroke-width="1.6" transform="rotate(14 120 118)" opacity="0.78"/>
        <!-- Armadura astral con núcleo de estrella brillante -->
        <path d="M22 240 C38 176 74 160 120 160 C166 160 202 176 218 240 Z" fill="url(#gxHead)" stroke="url(#gxGold)" stroke-width="2.6"/>
        <path d="M60 176 Q120 218 180 176" fill="none" stroke="url(#gxGold)" stroke-width="3.2"/>
        <circle cx="120" cy="198" r="16" fill="url(#gxGold)"/>
        <circle cx="120" cy="198" r="8" fill="#ffffff"/>
        <g class="portrait-float-part">
          ${isBoss ? `<path d="M64 88 L88 22 L112 54 L120 14 L128 54 L152 22 L176 88 Z" fill="#4c35ab" stroke="url(#gxGold)" stroke-width="2.8"/>` : `<path d="M84 74 L120 28 L156 74 Z" fill="#3a258a" stroke="url(#gxGold)" stroke-width="2.2"/>`}
          <ellipse cx="120" cy="114" rx="50" ry="56" fill="url(#gxHead)" stroke="#e9d5ff" stroke-width="3"/>
          <rect x="76" y="102" width="88" height="30" rx="10" fill="#0c0724" stroke="url(#gxGold)" stroke-width="2"/>
          <ellipse cx="104" cy="82" rx="22" ry="10" fill="#ffffff" opacity="0.24" transform="rotate(-14 104 82)"/>
        </g>
        ${chessVisorEyes('#fff5c4', '#ff6e9c', 'gal')}
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

  // === CAP. 4 NIVELES 1-4: PERSONAJES ÚNICOS DE GLITCH (BIT, GUSANO, TROYANO, DEMONIO KERNEL — DISTINTOS AL BOSS) ===
  if (bossId === 'glitch_shard') {
    // Nv.1: Bit Corrupto — Entidad vóxel verde neón & matriz binaria
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Bit Corrupto">
        <defs>
          <radialGradient id="glBitBg" cx="50%" cy="40%" r="72%"><stop offset="0%" stop-color="#065f46"/><stop offset="60%" stop-color="#04221b"/><stop offset="100%" stop-color="#020b09"/></radialGradient>
        </defs>
        <rect width="240" height="240" fill="url(#glBitBg)"/>
        <g fill="#34d399" opacity="0.24" font-family="monospace" font-size="14" font-weight="700">
          <text x="16" y="34">01001101</text><text x="148" y="42">10110010</text><text x="18" y="218">ERR_BIT</text><text x="150" y="220">0x00FF</text>
        </g>
        <g class="portrait-glitch-jitter">
          <rect x="44" y="168" width="152" height="72" rx="8" fill="#064e3b" stroke="#34d399" stroke-width="2.6"/>
          <rect x="66" y="52" width="108" height="114" rx="10" fill="#0f766e" stroke="#6ee7b7" stroke-width="3"/>
          <rect x="76" y="62" width="32" height="24" fill="#34d399" opacity="0.45"/>
          <rect x="132" y="62" width="32" height="24" fill="#22d3ee" opacity="0.45"/>
          <rect x="74" y="98" width="92" height="34" rx="4" fill="#021410" stroke="#34d399" stroke-width="2.2"/>
          <rect x="34" y="80" width="18" height="18" fill="#34d399" opacity="0.85"/>
          <rect x="188" y="102" width="16" height="16" fill="#22d3ee" opacity="0.85"/>
        </g>
        ${chessVisorEyes('#4ade80', '#22d3ee', 'glbit')}
      </svg>`;
  }

  if (bossId === 'glitch_pawn_err') {
    // Nv.2: Gusano de Memoria — Serpiente cibernética segmentada ámbar-naranja
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Gusano de Memoria">
        <defs>
          <radialGradient id="glWormBg" cx="50%" cy="38%" r="72%"><stop offset="0%" stop-color="#7c2d12"/><stop offset="56%" stop-color="#291007"/><stop offset="100%" stop-color="#0d0502"/></radialGradient>
          <linearGradient id="glWormSeg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fdba74"/><stop offset="52%" stop-color="#ea580c"/><stop offset="100%" stop-color="#431407"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#glWormBg)"/>
        <g class="portrait-glitch-jitter">
          <ellipse cx="70" cy="212" rx="44" ry="26" fill="url(#glWormSeg)" stroke="#fed7aa" stroke-width="2.4"/>
          <ellipse cx="166" cy="202" rx="46" ry="28" fill="url(#glWormSeg)" stroke="#fed7aa" stroke-width="2.4"/>
          <ellipse cx="120" cy="176" rx="54" ry="30" fill="url(#glWormSeg)" stroke="#fde047" stroke-width="2.6"/>
          <!-- Cabeza mecánica de Gusano de Memoria con antenas de datos -->
          <path d="M84 62 L62 24 M156 62 L178 24" stroke="#fde047" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="62" cy="24" r="6" fill="#fde047"/><circle cx="178" cy="24" r="6" fill="#fde047"/>
          <path d="M68 114 C68 62 92 50 120 50 C148 50 172 62 172 114 L156 164 L120 176 L84 164 Z" fill="url(#glWormSeg)" stroke="#fef08a" stroke-width="3"/>
          <rect x="76" y="100" width="88" height="32" rx="8" fill="#180803" stroke="#fb923c" stroke-width="2"/>
          <path d="M92 148 L104 158 L120 148 L136 158 L148 148" fill="none" stroke="#fef08a" stroke-width="2.6"/>
        </g>
        ${chessVisorEyes('#fde047', '#ff3d5a', 'glworm')}
      </svg>`;
  }

  if (bossId === 'glitch_knight_err') {
    // Nv.3: Caballero Troyano — Corcel cibernético violeta-magenta con visor 0xDEAD
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Caballero Troyano">
        <defs>
          <radialGradient id="glTroBg" cx="50%" cy="35%" r="72%"><stop offset="0%" stop-color="#6b21a8"/><stop offset="56%" stop-color="#240b3b"/><stop offset="100%" stop-color="#090312"/></radialGradient>
          <linearGradient id="glTroSteel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e9d5ff"/><stop offset="48%" stop-color="#9333ea"/><stop offset="100%" stop-color="#2e1065"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#glTroBg)"/>
        <path d="M0 70 H240 M0 170 H240" stroke="#e879f9" stroke-width="1.4" opacity="0.28"/>
        <g class="portrait-glitch-jitter">
          <path d="M26 240 L62 164 H178 L214 240 Z" fill="url(#glTroSteel)" stroke="#f0abfc" stroke-width="2.4"/>
          <!-- Cresta dentada cibernética de Caballo Troyano -->
          <path d="M84 68 L98 20 L118 46 L138 18 L156 68 Z" fill="#f472b6" stroke="#ffffff" stroke-width="2"/>
          <polygon points="70,74 170,74 162,164 120,184 78,164" fill="url(#glTroSteel)" stroke="#f5d0fe" stroke-width="2.8"/>
          <rect x="74" y="100" width="92" height="34" rx="6" fill="#120422" stroke="#22d3ee" stroke-width="2.2"/>
          <text x="120" y="156" text-anchor="middle" font-family="monospace" font-size="11" font-weight="800" fill="#f0abfc">0xDEAD</text>
        </g>
        ${chessVisorEyes('#f0abfc', '#22d3ee', 'gltroj')}
      </svg>`;
  }

  if (bossId === 'glitch_core') {
    // Nv.4: Demonio Kernel — Cráneo-procesador carmesí con pines de cobre y alertas críticas
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Demonio Kernel">
        <defs>
          <radialGradient id="glKerBg" cx="50%" cy="38%" r="72%"><stop offset="0%" stop-color="#991b1b"/><stop offset="54%" stop-color="#330808"/><stop offset="100%" stop-color="#0c0202"/></radialGradient>
          <linearGradient id="glKerCpu" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fca5a5"/><stop offset="48%" stop-color="#dc2626"/><stop offset="100%" stop-color="#450a0a"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#glKerBg)"/>
        <g class="portrait-glitch-jitter">
          <!-- Pines de procesador alrededor -->
          <path d="M40 82 H64 M40 108 H64 M40 134 H64 M176 82 H200 M176 108 H200 M176 134 H200" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>
          <path d="M24 240 L60 168 H180 L216 240 Z" fill="#450a0a" stroke="#f87171" stroke-width="2.6"/>
          <path d="M68 78 L96 34 L120 56 L144 34 L172 78 L164 166 L120 186 L76 166 Z" fill="url(#glKerCpu)" stroke="#fef2f2" stroke-width="2.8"/>
          <rect x="76" y="100" width="88" height="32" rx="6" fill="#170303" stroke="#fbbf24" stroke-width="2"/>
          <path d="M96 154 V168 M112 154 V170 M128 154 V170 M144 154 V168" stroke="#fef2f2" stroke-width="3" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#ff4d4f', '#fbbf24', 'glkern')}
      </svg>`;
  }

  // === CAP. 4 NIVEL 5: BOSS GLITCH (TEXTURA REAL SUBIDA + SHARDS RGB + NÚCLEO FRACTURADO) ===
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

  // === CAP. 5 NIVELES 1-4: PERSONAJES ÚNICOS DEL PLANO PURO (MARFIL, CAOBA, PLATINO, ARQUITECTO — DISTINTOS A CHESS) ===
  if (bossId === 'chess_legion') {
    // Nv.1: Aprendiz de Marfil — Escudero de marfil y plata con corona de laurel
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Aprendiz de Marfil">
        <defs>
          <radialGradient id="cIvBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#64748b"/><stop offset="56%" stop-color="#1e293b"/><stop offset="100%" stop-color="#090d14"/></radialGradient>
          <linearGradient id="cIvBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="54%" stop-color="#e2d9c8"/><stop offset="100%" stop-color="#948874"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#cIvBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="116" r="94" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="10 6" opacity="0.55"/>
        <path d="M26 240 L64 166 H176 L214 240 Z" fill="url(#cIvBody)" stroke="#475569" stroke-width="2.4"/>
        <path d="M90 168 L120 218 L150 168" fill="#1e293b" stroke="#cbd5e1" stroke-width="2.8"/>
        <g class="portrait-float-part">
          <path d="M74 86 Q120 34 166 86" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
          <ellipse cx="120" cy="116" rx="46" ry="54" fill="url(#cIvBody)" stroke="#334155" stroke-width="2.8"/>
          <rect x="78" y="102" width="84" height="28" rx="8" fill="#1e293b" stroke="#cbd5e1" stroke-width="2"/>
          <path d="M100 150 Q120 158 140 150" fill="none" stroke="#334155" stroke-width="2.8" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#e2e8f0', '#38bdf8', 'civory')}
      </svg>`;
  }

  if (bossId === 'chess_towers') {
    // Nv.2: Táctico de Caoba — Estratega de madera noble y latón con monóculo dorado y reloj de arena
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Táctico de Caoba">
        <defs>
          <radialGradient id="cMahBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#78350f"/><stop offset="56%" stop-color="#321608"/><stop offset="100%" stop-color="#120703"/></radialGradient>
          <linearGradient id="cMahWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d99a6c"/><stop offset="50%" stop-color="#7c3a1d"/><stop offset="100%" stop-color="#2e1207"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#cMahBg)"/>
        <path d="M22 240 L58 168 H182 L218 240 Z" fill="url(#cMahWood)" stroke="#f59e0b" stroke-width="2.4"/>
        <!-- Reloj de arena en el pecho -->
        <polygon points="108,180 132,180 120,198 132,216 108,216 120,198" fill="#fde68a" stroke="#451a03" stroke-width="1.8"/>
        <g class="portrait-float-part">
          <!-- Sombrero-torre clásico de madera caoba -->
          <path d="M72 86 V48 H92 V60 H108 V48 H132 V60 H148 V48 H168 V86 Z" fill="url(#cMahWood)" stroke="#fbbf24" stroke-width="2.4"/>
          <path d="M74 86 H166 L158 168 L120 184 L82 168 Z" fill="url(#cMahWood)" stroke="#fbbf24" stroke-width="2.8"/>
          <rect x="78" y="102" width="84" height="28" rx="6" fill="#1c0b04" stroke="#f59e0b" stroke-width="2"/>
          <!-- Monóculo dorado sobre ojo derecho -->
          <circle cx="143" cy="116" r="16" fill="none" stroke="#fde047" stroke-width="2.8"/>
          <path d="M156 126 Q164 150 156 172" fill="none" stroke="#fde047" stroke-width="1.8"/>
        </g>
        ${chessVisorEyes('#fde047', '#fb923c', 'cmahog')}
      </svg>`;
  }

  if (bossId === 'chess_queen') {
    // Nv.3: Gran Maestro de Platino — Sabio de platino, manto carmesí y corona armilar
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Gran Maestro de Platino">
        <defs>
          <radialGradient id="cPlatBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#6d2846"/><stop offset="56%" stop-color="#281020"/><stop offset="100%" stop-color="#0c050a"/></radialGradient>
          <linearGradient id="cPlatMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="52%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#cPlatBg)"/>
        <ellipse class="portrait-aura-ring" cx="120" cy="108" rx="96" ry="30" fill="none" stroke="#e2e8f0" stroke-width="2" transform="rotate(-18 120 108)"/>
        <path d="M18 240 L56 164 H184 L222 240 Z" fill="#7f1d3a" stroke="#e2e8f0" stroke-width="2.6"/>
        <path d="M68 166 Q120 208 172 166" fill="none" stroke="#f8fafc" stroke-width="6" stroke-linecap="round"/>
        <g class="portrait-float-part">
          <path d="M66 86 L86 30 L120 56 L154 30 L174 86 Z" fill="url(#cPlatMetal)" stroke="#f8fafc" stroke-width="2.2"/>
          <polygon points="72,86 168,86 158,166 120,186 82,166" fill="url(#cPlatMetal)" stroke="#ffffff" stroke-width="2.6"/>
          <rect x="78" y="102" width="84" height="28" rx="8" fill="#180a14" stroke="#f8fafc" stroke-width="2"/>
        </g>
        ${chessVisorEyes('#f8fafc', '#fb7185', 'cplat')}
      </svg>`;
  }

  if (bossId === 'chess_court') {
    // Nv.4: Arquitecto del Tablero — Escultor geométrico de mármol blanco y obsidiana con escuadra dorada
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Arquitecto del Tablero">
        <defs>
          <radialGradient id="cArcBg" cx="50%" cy="32%" r="74%"><stop offset="0%" stop-color="#334155"/><stop offset="56%" stop-color="#141820"/><stop offset="100%" stop-color="#06080c"/></radialGradient>
          <linearGradient id="cArcMarble" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#cArcBg)"/>
        <!-- Rejilla arquitectónica dorada -->
        <path d="M20 40 H220 M20 200 H220 M40 20 V220 M200 20 V220" stroke="#efd083" stroke-width="1" opacity="0.22"/>
        <path d="M22 240 L60 166 H180 L218 240 Z" fill="#0f172a" stroke="#efd083" stroke-width="2.4"/>
        <!-- Compás y escuadra dorados -->
        <path d="M120 170 L94 228 M120 170 L146 228 M96 206 H144" stroke="#efd083" stroke-width="3.2" stroke-linecap="round"/>
        <g class="portrait-float-part">
          <polygon points="120,18 176,78 164,168 120,190 76,168 64,78" fill="url(#cArcMarble)" stroke="#efd083" stroke-width="3"/>
          <polygon points="120,18 176,78 164,168 120,190" fill="#0f172a" opacity="0.52"/>
          <rect x="76" y="102" width="88" height="30" rx="4" fill="#090c12" stroke="#efd083" stroke-width="2.2"/>
        </g>
        ${chessVisorEyes('#efd083', '#38bdf8', 'carch')}
      </svg>`;
  }

  // === CAP. 5 NIVEL 5: CHESS — MONARCA IMPONENTE DEL ORIGEN DEL AJEDREZ ===
  if (bossId && bossId.startsWith('chess_')) {
    const isFinal = bossId === 'chess_god';
    return `
      <svg class="boss-portrait-svg chess-sovereign-svg" viewBox="0 0 240 240" aria-label="CHESS — Soberano Imponente">
        <defs>
          <pattern id="chessBoardTexPort" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#14110c"/>
            <rect x="0" y="0" width="10" height="10" fill="#faf1dd"/>
            <rect x="10" y="10" width="10" height="10" fill="#faf1dd"/>
          </pattern>
          <radialGradient id="chDivineBg" cx="50%" cy="34%" r="72%">
            <stop offset="0%" stop-color="#ffe799" stop-opacity="${isFinal ? '0.46' : '0.26'}"/>
            <stop offset="46%" stop-color="#3a2d18"/>
            <stop offset="100%" stop-color="#090806"/>
          </radialGradient>
          <linearGradient id="chVolume" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
            <stop offset="48%" stop-color="#000000" stop-opacity="0.06"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.62"/>
          </linearGradient>
          <linearGradient id="chGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fffbe0"/>
            <stop offset="42%" stop-color="#f2c962"/>
            <stop offset="100%" stop-color="#7c540e"/>
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#chDivineBg)"/>
        <rect width="240" height="240" fill="url(#chessBoardTexPort)" opacity="0.14"/>
        <!-- Rayos solares imperiales detrás de CHESS -->
        <g opacity="${isFinal ? '0.42' : '0.22'}" fill="url(#chGold)">
          <polygon points="120,108 106,0 134,0"/>
          <polygon points="120,108 0,32 16,6"/>
          <polygon points="120,108 240,32 224,6"/>
          <polygon points="120,108 0,118 0,92"/>
          <polygon points="120,108 240,118 240,92"/>
        </g>
        <!-- Doble anillo geométrico sagrado -->
        <circle class="portrait-aura-ring" cx="120" cy="116" r="104" fill="none" stroke="url(#chGold)" stroke-width="${isFinal ? '3.2' : '2'}" stroke-dasharray="16 6" opacity="0.82"/>
        <circle class="portrait-aura-ring" cx="120" cy="116" r="88" fill="none" stroke="#fff7d4" stroke-width="1.2" opacity="0.5"/>
        <!-- Hombreras monumentales en forma de Torres de Ajedrez + manto imperial ajedrezado -->
        <g stroke="url(#chGold)" stroke-width="2.6">
          <path d="M12 240 L20 134 H32 V146 H42 V134 H54 V146 H64 V134 H74 L78 240 Z" fill="url(#chessBoardTexPort)"/>
          <path d="M12 240 L20 134 H32 V146 H42 V134 H54 V146 H64 V134 H74 L78 240 Z" fill="url(#chVolume)" stroke="none"/>
          <path d="M228 240 L220 134 H208 V146 H198 V134 H186 V146 H176 V134 H166 L162 240 Z" fill="url(#chessBoardTexPort)"/>
          <path d="M228 240 L220 134 H208 V146 H198 V134 H186 V146 H176 V134 H166 L162 240 Z" fill="url(#chVolume)" stroke="none"/>
          <path d="M56 240 L74 166 H166 L184 240 Z" fill="url(#chessBoardTexPort)"/>
          <path d="M56 240 L74 166 H166 L184 240 Z" fill="url(#chVolume)" stroke="none"/>
          <path d="M78 168 L120 226 L162 168" fill="#17130d" stroke="url(#chGold)" stroke-width="3.6"/>
          <polygon points="120,178 134,200 120,222 106,200" fill="url(#chGold)" stroke="#1b1206" stroke-width="2"/>
          <circle cx="120" cy="200" r="5" fill="#ffffff" stroke="none"/>
        </g>
        <!-- Rostro esculpido en tablero de ajedrez + Corona Imperial de 7 puntas + Cruz Suprema -->
        <g class="portrait-float-part">
          <path d="M120 4 V42 M100 20 H140" stroke="url(#chGold)" stroke-width="6" stroke-linecap="round"/>
          <circle cx="120" cy="20" r="5.5" fill="#ffffff"/>
          <!-- Corona monumental de 7 agujas -->
          <path d="M56 88 L44 34 L76 62 L92 22 L110 56 L120 28 L130 56 L148 22 L164 62 L196 34 L184 88 Z" fill="url(#chGold)" stroke="#1f1506" stroke-width="2.4" stroke-linejoin="round"/>
          <!-- Cabeza colosal de CHESS -->
          <path d="M64 88 H176 L164 170 L120 192 L76 170 Z" fill="url(#chessBoardTexPort)" stroke="url(#chGold)" stroke-width="3.4"/>
          <path d="M64 88 H176 L164 170 L120 192 L76 170 Z" fill="url(#chVolume)"/>
          <!-- Visor imperial negro-oro que resalta su mirada absoluta -->
          <polygon points="70,100 170,100 162,136 120,144 78,136" fill="#0d0b08" opacity="0.94" stroke="url(#chGold)" stroke-width="2.2"/>
          <path d="M90 158 L120 168 L150 158" fill="none" stroke="url(#chGold)" stroke-width="3.2" stroke-linecap="round"/>
        </g>
        ${chessVisorEyes('#fffbe0', '#ffd24d', 'chess')}
      </svg>`;
  }

  // === CAP. 1 NIVELES 1-4: GUARDIANES MAYA (PIEDRA TALLADA DE ALTA VISIBILIDAD, JADE Y ORO) ===
  if (bossId === 'maya_sentinel' || bossId === 'maya_jade_guard' || bossId === 'maya_jaguar' || bossId === 'maya_eclipse') {
    const palette = {
      maya_sentinel: { bg1: '#59452c', bg2: '#14100b', p1: '#9c8668', p2: '#352b20', accent: '#e5b855', eye: '#ffe078', crown: 'M74 88 Q120 20 166 88 Z' },
      maya_jade_guard: { bg1: '#2d6649', bg2: '#0b1812', p1: '#69c796', p2: '#1b4731', accent: '#f2d079', eye: '#99ffd0', crown: 'M68 90 H172 L158 42 H82 Z' },
      maya_jaguar: { bg1: '#634121', bg2: '#140d07', p1: '#a67b4d', p2: '#382515', accent: '#f0a83e', eye: '#ffe169', crown: 'M66 96 L82 32 L106 68 L120 34 L134 68 L158 32 L174 96 Z' },
      maya_eclipse: { bg1: '#612d28', bg2: '#140a09', p1: '#995b50', p2: '#361a16', accent: '#ff9666', eye: '#ffd085', crown: 'M68 88 L96 38 L120 18 L144 38 L172 88 Z' }
    }[bossId];
    const uid = bossId;

    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Guardián Maya">
        <defs>
          <radialGradient id="mgBg_${uid}" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="${palette.bg1}"/><stop offset="100%" stop-color="${palette.bg2}"/></radialGradient>
          <linearGradient id="mgSt_${uid}" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="${palette.p1}"/><stop offset="100%" stop-color="${palette.p2}"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#mgBg_${uid})"/>
        <circle class="portrait-aura-ring" cx="120" cy="112" r="94" fill="none" stroke="${palette.accent}" stroke-width="2.2" stroke-dasharray="10 6" opacity="0.55"/>
        <path class="portrait-float-part" d="${palette.crown}" fill="${palette.accent}" stroke="#191510" stroke-width="2.6"/>
        <path d="M22 240 L54 174 H186 L218 240 Z" fill="url(#mgSt_${uid})" stroke="${palette.accent}" stroke-width="2.6"/>
        <path d="M80 176 Q120 218 160 176" fill="none" stroke="${palette.accent}" stroke-width="3.2"/>
        <circle cx="120" cy="196" r="8" fill="${palette.accent}" stroke="#1b1409" stroke-width="1.8"/>
        <path d="M68 88 H172 L160 176 L120 196 L80 176 Z" fill="url(#mgSt_${uid})" stroke="${palette.accent}" stroke-width="3"/>
        <rect x="76" y="102" width="88" height="30" rx="7" fill="#120e0b" opacity="0.86" stroke="${palette.accent}" stroke-width="1.8"/>
        ${chessVisorEyes(palette.eye, '#ff5b49', uid)}
        <path d="M94 162 H146" stroke="${palette.accent}" stroke-width="3.2" stroke-linecap="round"/>
      </svg>`;
  }

  // === CAP. 1 NIVEL 5: DIOS MAYA (ELEVADO CON ORO BRUÑIDO, PLUMAS DE JADE Y AURA SOLAR) ===
  if (bossId === 'rey_maya') {
    return `
      <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Retrato del Dios Maya">
        <defs>
          <radialGradient id="pmBg" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="#70582c"/><stop offset="56%" stop-color="#282014"/><stop offset="100%" stop-color="#0f0c08"/></radialGradient>
          <linearGradient id="pmGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff6be"/><stop offset="48%" stop-color="#dfb24f"/><stop offset="100%" stop-color="#745112"/></linearGradient>
          <linearGradient id="pmStone" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="#9e8c72"/><stop offset="52%" stop-color="#4e4336"/><stop offset="100%" stop-color="#1d1813"/></linearGradient>
          <linearGradient id="pmJade" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6fd9a3"/><stop offset="100%" stop-color="#1b4d34"/></linearGradient>
        </defs>
        <rect width="240" height="240" fill="url(#pmBg)"/>
        <circle class="portrait-aura-ring" cx="120" cy="116" r="102" fill="none" stroke="url(#pmGold)" stroke-width="2.4" stroke-dasharray="12 6" opacity="0.65"/>
        <polygon points="10,240 230,240 192,162 48,162" fill="#211c15" opacity="0.88"/>
        <polygon points="48,162 192,162 162,110 78,110" fill="#2c251c" opacity="0.88"/>
        <g class="portrait-float-part">
          <path d="M120 92 C66 16, 18 30, 2 76 C44 76, 80 90, 104 114 Z" fill="url(#pmJade)" stroke="#122b1e" stroke-width="1.8"/>
          <path d="M120 92 C174 16, 222 30, 238 76 C196 76, 160 90, 136 114 Z" fill="url(#pmJade)" stroke="#122b1e" stroke-width="1.8"/>
          <path d="M62 96 L84 48 L106 72 L120 28 L134 72 L156 48 L178 96 Z" fill="url(#pmGold)" stroke="#261d0f" stroke-width="2.4"/>
          <circle cx="120" cy="74" r="12" fill="url(#pmJade)" stroke="#fff2b5" stroke-width="2.4"/>
          <circle cx="120" cy="74" r="4.5" fill="#fff7cc"/>
        </g>
        <path d="M18 240 L46 180 L194 180 L222 240 Z" fill="url(#pmStone)" stroke="url(#pmGold)" stroke-width="2.4"/>
        <path d="M68 182 Q120 226 172 182 L184 218 Q120 248 56 218 Z" fill="url(#pmGold)" stroke="#231b0e" stroke-width="2.2"/>
        <path d="M68 92 H172 L160 178 L120 198 L80 178 Z" fill="url(#pmStone)" stroke="url(#pmGold)" stroke-width="3.2"/>
        <rect x="76" y="102" width="88" height="30" rx="7" fill="#120f0b" opacity="0.88" stroke="url(#pmGold)" stroke-width="1.8"/>
        <circle cx="62" cy="136" r="13" fill="url(#pmJade)" stroke="url(#pmGold)" stroke-width="2.8"/>
        <circle cx="178" cy="136" r="13" fill="url(#pmJade)" stroke="url(#pmGold)" stroke-width="2.8"/>
        ${chessVisorEyes('#ffe070', '#ff5b49', 'maya')}
        <path class="expr-layer on-idle" d="M100 164 H140" stroke="url(#pmGold)" stroke-width="3.2" stroke-linecap="round"/>
        <path class="expr-layer on-thinking" d="M104 166 Q120 158 136 166" fill="none" stroke="#ffe085" stroke-width="3" stroke-linecap="round"/>
        <path class="expr-layer on-happy" d="M96 158 Q120 178 144 158" fill="none" stroke="#fff4c4" stroke-width="3.4" stroke-linecap="round"/>
        <path class="expr-layer on-surprised" d="M102 172 Q120 154 138 172" fill="none" stroke="#ff7c6b" stroke-width="3.4" stroke-linecap="round"/>
        <path class="expr-layer on-disabled" d="M102 164 H138" stroke="#6c665a" stroke-width="2.6" stroke-linecap="round"/>
      </svg>`;
  }

  // Autómata Clásico (Vs Bot / Partida Rápida / Modos Especiales — bronce luminoso y visor táctico)
  return `
    <svg class="boss-portrait-svg" viewBox="0 0 240 240" aria-label="Autómata CHESS.MOD">
      <defs>
        <radialGradient id="autBg" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="#4e4030"/><stop offset="100%" stop-color="#110e0b"/></radialGradient>
        <radialGradient id="autMetal" cx="38%" cy="28%" r="70%"><stop offset="0%" stop-color="#c4b299"/><stop offset="48%" stop-color="#615241"/><stop offset="100%" stop-color="#1d1813"/></radialGradient>
        <linearGradient id="autGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff5c0"/><stop offset="50%" stop-color="#dfb24f"/><stop offset="100%" stop-color="#6c4e15"/></linearGradient>
      </defs>
      <rect width="240" height="240" fill="url(#autBg)"/>
      <circle class="portrait-aura-ring" cx="120" cy="118" r="92" fill="none" stroke="url(#autGold)" stroke-width="2.2" stroke-dasharray="10 6" opacity="0.6"/>
      <path d="M36 240 L70 170 H170 L204 240 Z" fill="url(#autMetal)" stroke="url(#autGold)" stroke-width="2.6"/>
      <path d="M90 174 L120 214 L150 174" fill="none" stroke="url(#autGold)" stroke-width="3"/>
      <g class="portrait-float-part">
        <circle cx="120" cy="114" r="62" fill="url(#autMetal)" stroke="url(#autGold)" stroke-width="3.2"/>
        <ellipse cx="100" cy="80" rx="24" ry="11" fill="#ffffff" opacity="0.26" transform="rotate(-18 100 80)"/>
        <rect x="74" y="102" width="92" height="30" rx="9" fill="#13100d" stroke="url(#autGold)" stroke-width="2"/>
        <path d="M120 28 V54 M106 40 H134" stroke="url(#autGold)" stroke-width="4.6" stroke-linecap="round"/>
        <path d="M94 150 H146" stroke="#6ce0a6" stroke-width="3.6" stroke-linecap="round"/>
      </g>
      ${chessVisorEyes('#fff0a8', '#ff5b49', 'auto')}
    </svg>`;
}
