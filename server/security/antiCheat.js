/**
 * Sistema Anti-Cheat autoritativo de CHESS.MOD:
 * Detecta y bloquea:
 * 1. Aumentadores de dinero/Mods, XP, Elo, VIP o desbloqueos falsificados (payload tampering & forged snapshots).
 * 2. Bots / motores automáticos en Online PvP (velocidad inhumana < 160ms repetida, cadencia robótica constante).
 * 3. Trampas / exploits de reglas (spam de reportes falsos, partidas imposibles, flood de jugadas ilegales).
 */
const FORBIDDEN_ECONOMY_KEYS = [
  'mods', 'xp', 'elo', 'isVip', 'is_vip', 'vipActive', 'vip_active',
  'isModerator', 'is_moderator', 'battlePassS1', 'battle_pass_s1',
  'unlockedCosmetics', 'unlocked_cosmetics', 'modsGained', 'xpGained'
];

export class AntiCheatEngine {
  constructor(db) {
    this.db = db;
    // Seguimiento en memoria por usuario para detección en tiempo real
    this.reportHistory = new Map();     // userId -> [timestamps]
    this.pvpMoveMetrics = new Map();    // `${matchId}:${userId}` -> { lastTs, intervals[], fastStreak, illegalSpam[] }
    this.userScores = new Map();        // userId -> accumulated suspicion score
  }

  /**
   * Escanea cualquier cuerpo de petición en busca de intentos de inyectar dinero/Mods/XP/Elo/VIP.
   */
  detectEconomyTampering(body) {
    if (!body || typeof body !== 'object') return null;
    const tamperedKeys = [];
    for (const key of FORBIDDEN_ECONOMY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        tamperedKeys.push(key);
      }
    }
    if (tamperedKeys.length > 0) {
      return {
        category: 'money_hack',
        severity: 'high',
        score: 45,
        details: `Intento de alterar campos protegidos de economía/cuenta: [${tamperedKeys.join(', ')}]`
      };
    }
    return null;
  }

  /**
   * Valida reportes de partida contra IA / Historia para frenar granjas de Mods/XP con bots o scripts.
   */
  checkSinglePlayerReport(userId, payload = {}) {
    const now = Date.now();
    const tamper = this.detectEconomyTampering(payload);
    if (tamper) return tamper;

    const turns = Number(payload.turns);
    const bases = Number(payload.basesDestroyed) || 0;
    if (bases < 0 || bases > 4) {
      return {
        category: 'cheat_exploit',
        severity: 'high',
        score: 40,
        details: `Valor imposible de basesDestroyed (${bases}) enviado en reporte de partida.`
      };
    }
    if (Number.isFinite(turns) && (turns < 0 || turns > 500)) {
      return {
        category: 'cheat_exploit',
        severity: 'medium',
        score: 30,
        details: `Número de turnos manipulado (${turns}) en reporte de partida.`
      };
    }

    // Permitir secuencias rápidas de campañas de prueba o partidas normales, pero frenar spam masivo de bots (>12 victorias en 10s en modo classic)
    if (payload.mode === 'classic' && payload.winner === 'w') {
      const list = (this.reportHistory.get(userId) || []).filter((ts) => now - ts < 10000);
      list.push(now);
      this.reportHistory.set(userId, list);
      if (list.length > 10) {
        return {
          category: 'money_hack',
          severity: 'critical',
          score: 60,
          details: `Bot granjeador de Mods/XP detectado: ${list.length} victorias clásicas reportadas en menos de 10 segundos.`
        };
      }
    }
    return null;
  }

  /**
   * Analiza cadencia y velocidad de jugadas en Multijugador Online para detectar bots/auto-clickers/motores.
   */
  recordOnlineMoveTiming(matchId, userId, now = Date.now()) {
    const key = `${matchId}:${userId}`;
    const entry = this.pvpMoveMetrics.get(key) || { lastTs: 0, intervals: [], fastStreak: 0, illegalSpam: [] };
    if (entry.lastTs > 0) {
      const dt = now - entry.lastTs;
      entry.intervals.push(dt);
      if (entry.intervals.length > 20) entry.intervals.shift();
      if (dt < 160) entry.fastStreak++;
      else entry.fastStreak = Math.max(0, entry.fastStreak - 1);
    }
    entry.lastTs = now;
    this.pvpMoveMetrics.set(key, entry);

    // 1. Velocidad inhumana sostenida (6+ jugadas seguidas en < 160ms)
    if (entry.fastStreak >= 6) {
      entry.fastStreak = 0;
      return {
        category: 'bot_speed',
        severity: 'high',
        score: 50,
        details: `Bot/Auto-clicker detectado en PvP (${matchId}): 6+ jugadas consecutivas en menos de 160 ms.`
      };
    }

    // 2. Cadencia robótica casi idéntica en 10+ jugadas (varianza mínima)
    if (entry.intervals.length >= 10) {
      const slice = entry.intervals.slice(-10);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / slice.length;
      const stdDev = Math.sqrt(variance);
      if (mean < 1200 && stdDev < 22) {
        entry.intervals = [];
        return {
          category: 'bot_cadence',
          severity: 'high',
          score: 55,
          details: `Cadencia robótica de bot/motor en PvP (${matchId}): media ${Math.round(mean)}ms, desviación ${stdDev.toFixed(1)}ms.`
        };
      }
    }
    return null;
  }

  /**
   * Detecta spam de jugadas ilegales o exploits en PvP.
   */
  recordIllegalAction(matchId, userId, reason = '') {
    const now = Date.now();
    const key = `${matchId}:${userId}`;
    const entry = this.pvpMoveMetrics.get(key) || { lastTs: 0, intervals: [], fastStreak: 0, illegalSpam: [] };
    entry.illegalSpam = entry.illegalSpam.filter((ts) => now - ts < 10000);
    entry.illegalSpam.push(now);
    this.pvpMoveMetrics.set(key, entry);
    if (entry.illegalSpam.length >= 8) {
      entry.illegalSpam = [];
      return {
        category: 'cheat_exploit',
        severity: 'high',
        score: 45,
        details: `Spam de exploits/movimientos ilegales en PvP (${matchId}): ${reason}`
      };
    }
    return null;
  }

  clearMatch(matchId) {
    for (const k of this.pvpMoveMetrics.keys()) {
      if (k.startsWith(`${matchId}:`)) this.pvpMoveMetrics.delete(k);
    }
  }

  /**
   * Registra una alerta en BD y, si el puntaje acumulado alcanza 100+ en una cuenta no-moderador,
   * aplica suspensión automática temporal (1 día) y crea alerta visible en el Panel de Moderación.
   */
  async flagUser(userId, username, finding) {
    if (!finding || !userId) return { flagged: false, autoSuspended: false };
    const prev = this.userScores.get(userId) || 0;
    const totalScore = prev + (Number(finding.score) || 25);
    this.userScores.set(userId, totalScore);

    let autoSuspended = false;
    try {
      await this.db.recordAntiCheatFlag(userId, {
        username: username || 'Jugador',
        category: finding.category || 'cheat_exploit',
        severity: finding.severity || 'medium',
        score: finding.score || 25,
        details: finding.details || 'Comportamiento anómalo detectado por Anti-Cheat'
      });

      const userRow = await this.db.findUserById(userId);
      if (userRow && !Number(userRow.is_moderator) && totalScore >= 100) {
        await this.db.banUser('anticheat_system', userId, `[ANTI-CHEAT] ${finding.details}`, 1);
        autoSuspended = true;
      }
    } catch {}

    return { flagged: true, totalScore, autoSuspended, finding };
  }
}
