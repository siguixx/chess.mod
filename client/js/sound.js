const STORAGE_PREFS_KEY = 'chess_mod_audio_prefs_v1';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicVol = 0.65;
    this.sfxVol = 0.72;
    this.reducedVfx = false;
    this.musicWanted = false;
    this.activeTrack = null;

    this.tracks = {
      maya: document.getElementById('boss-music-audio'),
      maya_campaign: document.getElementById('maya-campaign-music-audio'),
      mittens: document.getElementById('mittens-music-audio'),
      galaxy: document.getElementById('galaxy-music-audio'),
      glitch: document.getElementById('glitch-music-audio'),
      chess: document.getElementById('chess-music-audio'),
      blacky: document.getElementById('blacky-music-audio')
    };
    this.bossAudio = this.tracks.maya;
    this.loadPrefs();

    for (const el of Object.values(this.tracks)) {
      if (el) {
        el.loop = true;
        el.muted = this.muted;
        el.volume = this.musicVol;
      }
    }
  }

  loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.muted === 'boolean') this.muted = p.muted;
      if (typeof p.musicVol === 'number') this.musicVol = p.musicVol;
      if (typeof p.sfxVol === 'number') this.sfxVol = p.sfxVol;
      if (typeof p.reducedVfx === 'boolean') this.reducedVfx = p.reducedVfx;
    } catch {}
  }

  savePrefs() {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify({
        muted: this.muted,
        musicVol: this.musicVol,
        sfxVol: this.sfxVol,
        reducedVfx: this.reducedVfx
      }));
    } catch {}
  }

  unlockWebAudio() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this.syncVolumes();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {}
  }

  ensureMusicPlayingOnGesture() {
    if (!this.musicWanted || !this.activeTrack) return;
    this.unlockWebAudio();
    const audio = this.tracks[this.activeTrack];
    if (audio && audio.paused) {
      audio.play().catch(() => {});
    }
  }

  startBossMusic(trackOrRestart = 'maya', restartFromZero = false) {
    let track = 'maya';
    let restart = restartFromZero;
    if (typeof trackOrRestart === 'boolean') {
      restart = trackOrRestart;
    } else if (trackOrRestart && this.tracks[trackOrRestart]) {
      track = trackOrRestart;
    }

    // Pausar cualquier otra pista de jefe
    for (const [key, el] of Object.entries(this.tracks)) {
      if (key !== track && el) {
        el.pause();
        try { el.currentTime = 0; } catch {}
      }
    }

    this.activeTrack = track;
    this.bossAudio = this.tracks[track];
    this.musicWanted = true;
    this.unlockWebAudio();
    this.syncVolumes();

    if (this.bossAudio) {
      this.bossAudio.loop = true;
      if (restart) {
        try { this.bossAudio.currentTime = 0; } catch {}
      }
      this.bossAudio.play().catch(() => {});
    }
  }

  stopBossMusic() {
    this.musicWanted = false;
    this.activeTrack = null;
    for (const el of Object.values(this.tracks)) {
      if (el) {
        el.pause();
        try { el.currentTime = 0; } catch {}
      }
    }
  }

  syncVolumes() {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.03);
      this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.03);
    }
    for (const el of Object.values(this.tracks)) {
      if (el) {
        el.muted = this.muted;
        el.volume = this.musicVol;
      }
    }
  }

  setMasterMute(m) {
    this.muted = Boolean(m);
    this.syncVolumes();
    this.savePrefs();
  }

  setMusicVolume(v) {
    this.musicVol = Math.max(0, Math.min(1, Number(v)));
    this.syncVolumes();
    this.savePrefs();
  }

  setSfxVolume(v) {
    this.sfxVol = Math.max(0, Math.min(1, Number(v)));
    this.syncVolumes();
    this.savePrefs();
  }

  createNoiseBuffer(duration = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  play(type) {
    this.unlockWebAudio();
    if (!this.ctx || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;

    const tone = (f1, f2, dur, wave = 'sine', vol = 0.24, delay = 0) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(f1, now + delay);
      if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + delay + dur);
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(vol, now + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(now + delay); osc.stop(now + delay + dur + 0.03);
    };

    const noise = (dur, freq, vol = 0.22, delay = 0, filterType = 'lowpass') => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(dur);
      const flt = this.ctx.createBiquadFilter();
      flt.type = filterType;
      flt.frequency.setValueAtTime(freq, now + delay);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      src.connect(flt); flt.connect(g); g.connect(this.sfxGain);
      src.start(now + delay);
    };

    switch (type) {
      case 'select': tone(560, 680, 0.06, 'sine', 0.13); break;
      case 'move': tone(220, 118, 0.1, 'triangle', 0.25); noise(0.06, 950, 0.09); break;
      case 'capture': tone(300, 82, 0.18, 'triangle', 0.34); noise(0.14, 1700, 0.2, 0, 'bandpass'); break;
      case 'houseMove': tone(392, 523.25, 0.18, 'sine', 0.18); break;
      case 'houseShield': tone(523.25, 659.25, 0.22, 'sine', 0.18); tone(784, 1046, 0.28, 'triangle', 0.12, 0.06); break;
      case 'pyramidBlock': tone(440, 660, 0.16, 'triangle', 0.26); tone(130, 88, 0.24, 'sawtooth', 0.16); break;
      case 'pyramidMove': tone(76, 40, 0.54, 'sawtooth', 0.2); tone(54, 32, 0.62, 'sine', 0.38); noise(0.55, 310, 0.34); break;
      case 'push': noise(0.24, 650, 0.22); tone(165, 98, 0.22, 'triangle', 0.2); break;
      case 'chainPush': noise(0.32, 780, 0.24); tone(185, 110, 0.18, 'triangle', 0.2); tone(240, 135, 0.22, 'triangle', 0.2, 0.09); break;
      case 'crush': tone(96, 28, 0.6, 'sine', 0.48); noise(0.55, 580, 0.4); break;
      case 'baseDestroy': tone(520, 130, 0.65, 'sawtooth', 0.2); tone(392, 98, 0.72, 'triangle', 0.28, 0.06); break;
      case 'turnChange': tone(420, 460, 0.07, 'sine', 0.07); break;
      case 'bossSpeak': tone(128, 86, 0.22, 'triangle', 0.15); break;
      case 'hint': tone(523.25, 659.25, 0.16, 'sine', 0.15); tone(659.25, 783.99, 0.22, 'sine', 0.13, 0.08); break;
      case 'undo': tone(340, 210, 0.16, 'triangle', 0.17); break;
      case 'introBoom': tone(98, 30, 1.05, 'sine', 0.5); noise(0.7, 450, 0.34); break;
      case 'victory':
        tone(261.63, 261.63, 0.65, 'triangle', 0.24, 0);
        tone(329.63, 329.63, 0.65, 'triangle', 0.22, 0.12);
        tone(392.0, 392.0, 0.78, 'triangle', 0.24, 0.24);
        tone(523.25, 523.25, 1.2, 'sine', 0.28, 0.36);
        break;
      case 'defeat': tone(146.83, 68, 1.35, 'sawtooth', 0.18, 0); tone(110, 48, 1.5, 'triangle', 0.3, 0.08); break;
      case 'meow': {
        const pitch = 0.92 + Math.random() * 0.2;
        const osc = this.ctx.createOscillator();
        const flt = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520 * pitch, now);
        osc.frequency.exponentialRampToValueAtTime(890 * pitch, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.28);
        flt.type = 'bandpass';
        flt.Q.setValueAtTime(3.2, now);
        flt.frequency.setValueAtTime(1100 * pitch, now);
        flt.frequency.exponentialRampToValueAtTime(1950 * pitch, now + 0.1);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.32, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(flt); flt.connect(g); g.connect(this.sfxGain);
        osc.start(now); osc.stop(now + 0.32);
        break;
      }
      case 'waterShot': noise(0.24, 2400, 0.26, 0, 'bandpass'); tone(920, 340, 0.19, 'sine', 0.2); break;
      case 'waterPush': noise(0.2, 1300, 0.24, 0, 'lowpass'); tone(260, 110, 0.16, 'sine', 0.24); break;
      case 'convert':
        tone(523.25, 659.25, 0.14, 'triangle', 0.22, 0);
        tone(659.25, 783.99, 0.16, 'triangle', 0.22, 0.08);
        tone(783.99, 1046.5, 0.28, 'sine', 0.25, 0.16);
        break;
      case 'blackyBark':
        // Ladrido grave con eco sobrenatural de Schnauzer
        tone(175, 72, 0.22, 'sawtooth', 0.36, 0);
        noise(0.18, 520, 0.32, 0, 'bandpass');
        tone(150, 58, 0.28, 'sawtooth', 0.24, 0.22);
        noise(0.24, 410, 0.22, 0.22, 'lowpass');
        break;
      case 'blackySeal':
        tone(120, 42, 0.38, 'sawtooth', 0.3, 0);
        noise(0.32, 840, 0.28, 0.04, 'bandpass');
        break;
      case 'blackySummon':
        tone(95, 290, 0.36, 'triangle', 0.26, 0);
        tone(220, 440, 0.28, 'sine', 0.18, 0.12);
        break;
      case 'blackyAbsorb':
        tone(420, 68, 0.48, 'sawtooth', 0.28, 0);
        noise(0.4, 1100, 0.22, 0.04, 'bandpass');
        break;
      case 'blackyBetray':
        tone(280, 140, 0.22, 'sawtooth', 0.26, 0);
        tone(190, 310, 0.32, 'triangle', 0.24, 0.16);
        break;
        break;
      case 'arrowShot': noise(0.14, 3200, 0.22, 0, 'highpass'); tone(740, 260, 0.14, 'sawtooth', 0.14); break;
      case 'jadeShieldBlock': tone(620, 920, 0.16, 'triangle', 0.24); tone(310, 180, 0.22, 'sine', 0.22, 0.04); break;
      case 'jaguarLeap': tone(180, 380, 0.12, 'triangle', 0.22); noise(0.14, 900, 0.18, 0.05); break;
      case 'shamanPush': tone(330, 520, 0.26, 'sine', 0.22); tone(660, 440, 0.28, 'triangle', 0.14, 0.06); break;
      case 'galaxyTeleport': tone(280, 880, 0.28, 'sine', 0.22); tone(620, 1240, 0.24, 'triangle', 0.14, 0.06); break;
      case 'glitchTear': noise(0.26, 2600, 0.28, 0, 'bandpass'); tone(140, 52, 0.25, 'sawtooth', 0.22); break;
      case 'chainBreak': noise(0.28, 1900, 0.3, 0, 'highpass'); tone(480, 140, 0.32, 'sawtooth', 0.2); break;
      default: break;
    }
  }
}
