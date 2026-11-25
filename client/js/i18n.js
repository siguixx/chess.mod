/**
 * Sistema completo de internacionalización (i18n) para CHESS.MOD
 * Idiomas soportados: Español (es), English (en), Português (pt), Français (fr)
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', native: 'Español', flag: '🇪🇸', subtitle: 'Idioma original de CHESS.MOD' },
  { code: 'en', name: 'English', native: 'English', flag: '🇺🇸', subtitle: 'Play CHESS.MOD in English' },
  { code: 'pt', name: 'Português', native: 'Português', flag: '🇧🇷', subtitle: 'Jogue CHESS.MOD em Português' },
  { code: 'fr', name: 'Français', native: 'Français', flag: '🇫🇷', subtitle: 'Jouez à CHESS.MOD en Français' }
];

const LANG_KEY = 'chess_mod_language_v1';

export const TRANSLATIONS = {
  es: {
    langGateKicker: 'BIENVENIDO A CHESS.MOD',
    langGateTitle: 'ELIGE TU IDIOMA',
    langGateDesc: 'Antes de crear tu cuenta, selecciona el idioma de tu interfaz. Podrás cambiarlo en cualquier momento desde Configuración.',
    langGateContinue: 'Continuar →',
    nav_play: 'Jugar',
    nav_multiplayer: 'Multijugador',
    nav_story: 'Modo Historia',
    nav_shop: 'Tienda',
    nav_battlepass: 'Pase T1',
    nav_mods: 'Taller de Mods',
    nav_social: 'Social',
    nav_profile: 'Perfil',
    nav_customize: 'Inventario',
    nav_ranking: 'Ranking Global',
    nav_stats: 'Estadísticas',
    nav_settings: 'Configuración',
    nav_moderation: 'Moderación',
    sidebar_guest: 'Invitado',
    sidebar_login_btn: 'Iniciar sesión / Registro',
    sidebar_profile_btn: 'Ver Perfil',
    play_title: 'JUGAR',
    play_subtitle: 'Elige uno de los tres modos clásicos. Todos los Jefes y combates especiales pertenecen al Modo Historia.',
    play_quick: '⚡ Partida Rápida',
    play_quick_btn: '⚡ Jugar Partida Rápida',
    play_ai: '🤖 Vs IA',
    play_ai_btn: '🤖 Iniciar Vs IA',
    play_timed: '⏱️ Contra el Tiempo',
    play_timed_btn: '⏱️ Jugar Contra el Tiempo',
    trainers_heading: '🎓 Tu Entrenador Mentor',
    special_modes_heading: '🎲 Modos de Juego Locos (6×6, Poderes Random y Más)',
    mp_title: 'MULTIJUGADOR ONLINE',
    story_title: 'MODO HISTORIA',
    shop_title: 'TIENDA DE MODS',
    mods_title: 'TALLER DE MODS',
    social_title: 'SOCIAL Y CLANES',
    profile_title: 'PERFIL DE JUGADOR',
    customize_title: 'PERSONALIZACIÓN',
    ranking_title: 'RANKING GLOBAL',
    stats_title: 'ESTADÍSTICAS',
    settings_title: 'CONFIGURACIÓN',
    settings_kicker: 'PREFERENCIAS COMPLETAS DE SISTEMA',
    settings_subtitle: 'Personaliza el idioma, audio, tablero, animaciones, VFX, accesibilidad y controles al máximo.',
    settings_lang_title: '🌐 Idioma / Language',
    settings_lang_desc: 'Cambia el idioma del juego en tiempo real. Se guarda automáticamente en tu cuenta.',
    settings_audio_title: '🔊 Audio y Diálogos',
    settings_board_title: '♟️ Tablero y Jugabilidad',
    settings_vfx_title: '✨ Gráficos, VFX y Accesibilidad',
    settings_system_title: '⏱️ Relojes, Pantalla y Sistema',
    settings_reset_btn: '↺ Restablecer Ajustes por Defecto',
    auth_title: 'CUENTA CHESS.MOD',
    auth_tab_login: 'Iniciar sesión',
    auth_tab_register: 'Crear cuenta',
    auth_btn_enter: 'Entrar',
    auth_btn_create: 'Crear cuenta segura (0 Elo · 50 XP · 100 Mods)',
    trainer_modal_badge: '🔒 ELECCIÓN ÚNICA Y OBLIGATORIA',
    trainer_modal_title: 'ELIGE TU ENTRENADOR PERMANENTE',
    trainer_modal_desc: 'Debes elegir 1 entrenador mentor después de crear tu cuenta. Esta elección es obligatoria, permanente y no se puede saltar ni cambiar después.',
    trainer_confirm_btn: '🔒 Confirmar Entrenador Permanente',
    trainer_locked_note: 'Entrenador permanente elegido al crear tu cuenta.',
    battle_back: '← Menú',
    battle_hint: '💡 Pista (25 XP)',
    battle_undo: '↶ Deshacer',
    battle_restart: '↻ Reiniciar',
    battle_your_turn: 'TU TURNO'
  },
  en: {
    langGateKicker: 'WELCOME TO CHESS.MOD',
    langGateTitle: 'CHOOSE YOUR LANGUAGE',
    langGateDesc: 'Before creating your account, choose your interface language. You can change it anytime in Settings.',
    langGateContinue: 'Continue →',
    nav_play: 'Play',
    nav_multiplayer: 'Multiplayer',
    nav_story: 'Story Mode',
    nav_shop: 'Shop',
    nav_battlepass: 'Pass S1',
    nav_mods: 'Mod Workshop',
    nav_social: 'Social',
    nav_profile: 'Profile',
    nav_customize: 'Inventory',
    nav_ranking: 'Global Ranking',
    nav_stats: 'Statistics',
    nav_settings: 'Settings',
    nav_moderation: 'Moderation',
    sidebar_guest: 'Guest',
    sidebar_login_btn: 'Sign In / Register',
    sidebar_profile_btn: 'View Profile',
    play_title: 'PLAY',
    play_subtitle: 'Pick one of the three classic modes. All Boss Fights belong exclusively to Story Mode.',
    play_quick: '⚡ Quick Match',
    play_quick_btn: '⚡ Play Quick Match',
    play_ai: '🤖 Vs AI',
    play_ai_btn: '🤖 Start Vs AI',
    play_timed: '⏱️ Against the Clock',
    play_timed_btn: '⏱️ Play Timed Match',
    trainers_heading: '🎓 Your Mentor Trainer',
    special_modes_heading: '🎲 Crazy Special Modes (6×6, Random Powers & More)',
    mp_title: 'ONLINE MULTIPLAYER',
    story_title: 'STORY MODE',
    shop_title: 'MODS SHOP',
    mods_title: 'MOD WORKSHOP',
    social_title: 'SOCIAL & CLANS',
    profile_title: 'PLAYER PROFILE',
    customize_title: 'CUSTOMIZATION',
    ranking_title: 'GLOBAL RANKING',
    stats_title: 'STATISTICS',
    settings_title: 'SETTINGS',
    settings_kicker: 'FULL SYSTEM PREFERENCES',
    settings_subtitle: 'Fine-tune language, audio, board visuals, animation speed, VFX, accessibility, and clocks.',
    settings_lang_title: '🌐 Language / Idioma',
    settings_lang_desc: 'Switch game language instantly. Saved automatically to your account.',
    settings_audio_title: '🔊 Audio & Dialogues',
    settings_board_title: '♟️ Board & Gameplay',
    settings_vfx_title: '✨ Graphics, VFX & Accessibility',
    settings_system_title: '⏱️ Clocks, Display & System',
    settings_reset_btn: '↺ Reset Default Settings',
    auth_title: 'CHESS.MOD ACCOUNT',
    auth_tab_login: 'Sign In',
    auth_tab_register: 'Create Account',
    auth_btn_enter: 'Sign In',
    auth_btn_create: 'Create Secure Account (0 Elo · 50 XP · 100 Mods)',
    trainer_modal_badge: '🔒 ONE-TIME MANDATORY CHOICE',
    trainer_modal_title: 'CHOOSE YOUR PERMANENT TRAINER',
    trainer_modal_desc: 'You must pick 1 mentor trainer right after creating your account. This choice is mandatory, permanent, and cannot be skipped.',
    trainer_confirm_btn: '🔒 Confirm Permanent Trainer',
    trainer_locked_note: 'Permanent mentor chosen when you created your account.',
    battle_back: '← Menu',
    battle_hint: '💡 Hint (25 XP)',
    battle_undo: '↶ Undo',
    battle_restart: '↻ Restart',
    battle_your_turn: 'YOUR TURN'
  },
  pt: {
    langGateKicker: 'BEM-VINDO AO CHESS.MOD',
    langGateTitle: 'ESCOLHA SEU IDIOMA',
    langGateDesc: 'Antes de criar sua conta, selecione o idioma da interface. Você poderá alterá-lo quando quiser nas Configurações.',
    langGateContinue: 'Continuar →',
    nav_play: 'Jogar',
    nav_multiplayer: 'Multijogador',
    nav_story: 'Modo História',
    nav_shop: 'Loja',
    nav_battlepass: 'Passe T1',
    nav_mods: 'Oficina de Mods',
    nav_social: 'Social',
    nav_profile: 'Perfil',
    nav_customize: 'Inventário',
    nav_ranking: 'Ranking Global',
    nav_stats: 'Estatísticas',
    nav_settings: 'Configurações',
    nav_moderation: 'Moderação',
    sidebar_guest: 'Convidado',
    sidebar_login_btn: 'Entrar / Criar Conta',
    sidebar_profile_btn: 'Ver Perfil',
    play_title: 'JOGAR',
    play_subtitle: 'Escolha um dos três modos clássicos. Todos os Chefes pertencem ao Modo História.',
    play_quick: '⚡ Partida Rápida',
    play_quick_btn: '⚡ Jogar Partida Rápida',
    play_ai: '🤖 Contra IA',
    play_ai_btn: '🤖 Iniciar Contra IA',
    play_timed: '⏱️ Contra o Relógio',
    play_timed_btn: '⏱️ Jogar com Relógio',
    trainers_heading: '🎓 Seu Treinador Mentor',
    special_modes_heading: '🎲 Modos Especiais Malucos (6×6, Poderes Aleatórios e Mais)',
    mp_title: 'MULTIJOGADOR ONLINE',
    story_title: 'MODO HISTÓRIA',
    shop_title: 'LOJA DE MODS',
    mods_title: 'OFICINA DE MODS',
    social_title: 'SOCIAL E CLÃS',
    profile_title: 'PERFIL DO JOGADOR',
    customize_title: 'PERSONALIZAÇÃO',
    ranking_title: 'RANKING GLOBAL',
    stats_title: 'ESTATÍSTICAS',
    settings_title: 'CONFIGURAÇÕES',
    settings_kicker: 'PREFERÊNCIAS COMPLETAS DO SISTEMA',
    settings_subtitle: 'Personalize idioma, áudio, tabuleiro, animações, VFX, acessibilidade e relógios ao máximo.',
    settings_lang_title: '🌐 Idioma / Language',
    settings_lang_desc: 'Altere o idioma do jogo em tempo real. Salvo automaticamente na sua conta.',
    settings_audio_title: '🔊 Áudio e Diálogos',
    settings_board_title: '♟️ Tabuleiro e Jogabilidade',
    settings_vfx_title: '✨ Gráficos, VFX e Acessibilidade',
    settings_system_title: '⏱️ Relógios, Tela e Sistema',
    settings_reset_btn: '↺ Restaurar Padrões',
    auth_title: 'CONTA CHESS.MOD',
    auth_tab_login: 'Entrar',
    auth_tab_register: 'Criar Conta',
    auth_btn_enter: 'Entrar',
    auth_btn_create: 'Criar conta segura (0 Elo · 50 XP · 100 Mods)',
    trainer_modal_badge: '🔒 ESCOLHA ÚNICA E OBRIGATÓRIA',
    trainer_modal_title: 'ESCOLHA SEU TREINADOR PERMANENTE',
    trainer_modal_desc: 'Você deve escolher 1 treinador mentor logo após criar sua conta. Esta escolha é obrigatória, permanente e não pode ser pulada.',
    trainer_confirm_btn: '🔒 Confirmar Treinador Permanente',
    trainer_locked_note: 'Treinador permanente escolhido ao criar sua conta.',
    battle_back: '← Menu',
    battle_hint: '💡 Dica (25 XP)',
    battle_undo: '↶ Desfazer',
    battle_restart: '↻ Reiniciar',
    battle_your_turn: 'SUA VEZ'
  },
  fr: {
    langGateKicker: 'BIENVENUE SUR CHESS.MOD',
    langGateTitle: 'CHOISISSEZ VOTRE LANGUE',
    langGateDesc: 'Avant de créer votre compte, choisissez la langue de votre interface. Vous pourrez la modifier à tout moment dans les Paramètres.',
    langGateContinue: 'Continuer →',
    nav_play: 'Jouer',
    nav_multiplayer: 'Multijoueur',
    nav_story: 'Mode Histoire',
    nav_shop: 'Boutique',
    nav_battlepass: 'Passe S1',
    nav_mods: 'Atelier Mods',
    nav_social: 'Social',
    nav_profile: 'Profil',
    nav_customize: 'Inventaire',
    nav_ranking: 'Classement',
    nav_stats: 'Statistiques',
    nav_settings: 'Paramètres',
    nav_moderation: 'Modération',
    sidebar_guest: 'Invité',
    sidebar_login_btn: 'Connexion / Inscription',
    sidebar_profile_btn: 'Voir le Profil',
    play_title: 'JOUER',
    play_subtitle: 'Choisissez l’un des trois modes classiques. Tous les Boss appartiennent au Mode Histoire.',
    play_quick: '⚡ Partie Rapide',
    play_quick_btn: '⚡ Lancer Partie Rapide',
    play_ai: '🤖 Contre l’IA',
    play_ai_btn: '🤖 Lancer Contre l’IA',
    play_timed: '⏱️ Contre la Montre',
    play_timed_btn: '⏱️ Jouer au Chrono',
    trainers_heading: '🎓 Votre Entraîneur Mentor',
    special_modes_heading: '🎲 Modes Spéciaux Fous (6×6, Pouvoirs Aléatoires et Plus)',
    mp_title: 'MULTIJOUEUR EN LIGNE',
    story_title: 'MODE HISTOIRE',
    shop_title: 'BOUTIQUE MODS',
    mods_title: 'ATELIER MODS',
    social_title: 'SOCIAL & CLANS',
    profile_title: 'PROFIL JOUEUR',
    customize_title: 'PERSONNALISATION',
    ranking_title: 'CLASSEMENT MONDIAL',
    stats_title: 'STATISTIQUES',
    settings_title: 'PARAMÈTRES',
    settings_kicker: 'PRÉFÉRENCES COMPLÈTES DU SYSTÈME',
    settings_subtitle: 'Personnalisez langue, audio, échiquier, animations, VFX, accessibilité et horloges au maximum.',
    settings_lang_title: '🌐 Langue / Language',
    settings_lang_desc: 'Changez la langue du jeu en temps réel. Enregistré automatiquement sur votre compte.',
    settings_audio_title: '🔊 Audio et Dialogues',
    settings_board_title: '♟️ Échiquier et Gameplay',
    settings_vfx_title: '✨ Graphismes, VFX et Accessibilité',
    settings_system_title: '⏱️ Horloges, Écran et Système',
    settings_reset_btn: '↺ Réinitialiser les Paramètres',
    auth_title: 'COMPTE CHESS.MOD',
    auth_tab_login: 'Connexion',
    auth_tab_register: 'Créer un compte',
    auth_btn_enter: 'Entrer',
    auth_btn_create: 'Créer un compte sécurisé (0 Elo · 50 XP · 100 Mods)',
    trainer_modal_badge: '🔒 CHOIX UNIQUE ET OBLIGATOIRE',
    trainer_modal_title: 'CHOISISSEZ VOTRE ENTRAÎNEUR PERMANENT',
    trainer_modal_desc: 'Vous devez choisir 1 entraîneur mentor après la création du compte. Ce choix est obligatoire, permanent et impossible à ignorer.',
    trainer_confirm_btn: '🔒 Confirmer l’Entraîneur Permanent',
    trainer_locked_note: 'Entraîneur permanent choisi lors de la création du compte.',
    battle_back: '← Menu',
    battle_hint: '💡 Indice (25 XP)',
    battle_undo: '↶ Annuler',
    battle_restart: '↻ Rejouer',
    battle_your_turn: 'VOTRE TOUR'
  }
};

export function hasSavedLanguage() {
  try {
    const code = localStorage.getItem(LANG_KEY);
    return Boolean(code && TRANSLATIONS[code]);
  } catch {
    return false;
  }
}

export function getSavedLanguage() {
  try {
    const code = localStorage.getItem(LANG_KEY);
    if (code && TRANSLATIONS[code]) return code;
  } catch {}
  return 'es';
}

export function saveLanguage(code) {
  const safe = TRANSLATIONS[code] ? code : 'es';
  try { localStorage.setItem(LANG_KEY, safe); } catch {}
  document.documentElement.lang = safe;
  return safe;
}

export function t(key, lang = getSavedLanguage()) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.es;
  return dict[key] || TRANSLATIONS.es[key] || key;
}

export function applyLanguageToDOM(lang = getSavedLanguage()) {
  const safe = TRANSLATIONS[lang] ? lang : 'es';
  document.documentElement.lang = safe;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const translated = t(key, safe);
    if (translated) el.textContent = translated;
  });

  // Traducir los botones de navegación principal
  document.querySelectorAll('#main-nav-bar .nav-btn').forEach((btn) => {
    const scr = btn.dataset.screen;
    const labelSpan = btn.querySelector('span:last-child');
    if (scr && labelSpan && TRANSLATIONS[safe][`nav_${scr}`]) {
      labelSpan.textContent = TRANSLATIONS[safe][`nav_${scr}`];
    }
  });

  // Actualizar pills de idioma activos en Configuración
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.setLang === safe);
  });
}
