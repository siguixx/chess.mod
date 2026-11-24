export class VFXEngine {
  constructor(sound) {
    this.sound = sound;
    this.reduced = Boolean(sound?.reducedVfx);
    this.introMode = false;

    this.bgCanvas = document.getElementById('bg-vfx-canvas');
    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;
    this.introCanvas = document.getElementById('intro-vfx-canvas');
    this.introCtx = this.introCanvas ? this.introCanvas.getContext('2d') : null;
    this.boardCanvas = document.getElementById('board-vfx-canvas');
    this.boardCtx = this.boardCanvas ? this.boardCanvas.getContext('2d') : null;

    this.ambientParticles = [];
    this.boardParticles = [];
    this.shockwaves = [];
    this.beams = [];
    this.time = 0;

    this.initAmbientParticles();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((ts) => this.loop(ts));
  }

  setReduced(val) {
    this.reduced = Boolean(val);
    this.initAmbientParticles();
  }

  setIntroMode(active) {
    this.introMode = Boolean(active);
    this.resize();
  }

  initAmbientParticles() {
    const count = this.reduced ? 18 : 54;
    this.ambientParticles = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.9 + Math.random() * 2.3,
      vx: (Math.random() - 0.5) * 0.00018,
      vy: -(0.00014 + Math.random() * 0.00042),
      alpha: 0.18 + Math.random() * 0.5,
      gold: Math.random() > 0.35,
      phase: Math.random() * Math.PI * 2
    }));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.bgCanvas) {
      this.bgCanvas.width = Math.floor(window.innerWidth * dpr);
      this.bgCanvas.height = Math.floor(window.innerHeight * dpr);
      if (this.bgCtx) this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.introCanvas) {
      this.introCanvas.width = Math.floor(window.innerWidth * dpr);
      this.introCanvas.height = Math.floor(window.innerHeight * dpr);
      if (this.introCtx) this.introCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (this.boardCanvas && this.boardCanvas.parentElement) {
      const rect = this.boardCanvas.parentElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.boardCanvas.width = Math.floor(rect.width * dpr);
        this.boardCanvas.height = Math.floor(rect.height * dpr);
        if (this.boardCtx) this.boardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  }

  squareCenter(r, c) {
    if (!this.boardCanvas || !this.boardCanvas.parentElement) return { x: 0, y: 0 };
    const rect = this.boardCanvas.parentElement.getBoundingClientRect();
    const cell = rect.width / 8;
    return { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
  }

  triggerBoardShake(heavy = false) {
    if (this.reduced) return;
    const ped = document.getElementById('board-pedestal');
    if (!ped) return;
    ped.classList.remove('board-shake', 'board-shake-heavy');
    void ped.offsetWidth;
    ped.classList.add(heavy ? 'board-shake-heavy' : 'board-shake');
  }

  spawnShockwave(r, c, color = '#efd083', maxRadius = 42) {
    if (this.reduced) return;
    const { x, y } = this.squareCenter(r, c);
    this.shockwaves.push({ x, y, r: 4, maxR: maxRadius, color, alpha: 0.9, lineWidth: 3 });
  }

  spawnSquareBurst(r, c, color = '#efd083', count = 14, speed = 2.2) {
    if (this.reduced) count = Math.max(4, Math.floor(count / 3));
    const { x, y } = this.squareCenter(r, c);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 0.9) * speed;
      this.boardParticles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        size: 1.8 + Math.random() * 3,
        color,
        life: 1,
        decay: 0.024 + Math.random() * 0.02
      });
    }
  }

  spawnBeam(fr, fc, tr, tc, outerColor = 'rgba(92, 211, 255, 0.72)', innerColor = '#ffffff') {
    const a = this.squareCenter(fr, fc);
    const b = this.squareCenter(tr, tc);
    this.beams.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, outerColor, innerColor, life: 1 });
  }

  spawnWaterBeam(fr, fc, tr, tc) {
    this.spawnBeam(fr, fc, tr, tc, 'rgba(92, 211, 255, 0.75)', '#ffffff');
    this.spawnShockwave(tr, tc, '#5cd3ff', 52);
    this.spawnSquareBurst(tr, tc, '#7ee0ff', 16, 2.7);
  }

  spawnArrowBeam(fr, fc, tr, tc) {
    this.spawnBeam(fr, fc, tr, tc, 'rgba(207, 166, 76, 0.82)', '#3c825f');
    this.spawnShockwave(tr, tc, '#cfa64c', 48);
    this.spawnSquareBurst(tr, tc, '#efd083', 14, 2.4);
  }

  spawnShamanWave(r, c) {
    this.spawnShockwave(r, c, '#efd083', 62);
    this.spawnSquareBurst(r, c, '#f5de96', 18, 2.5);
  }

  spawnShieldPulse(r, c) {
    this.spawnShockwave(r, c, '#efd083', 56);
    this.spawnSquareBurst(r, c, '#f5de96', 14, 1.9);
  }

  spawnPyramidDust(nr, nc) {
    for (const [r, c] of [[nr, nc], [nr, nc + 1], [nr + 1, nc], [nr + 1, nc + 1]]) {
      this.spawnSquareBurst(r, c, '#b8a88a', 8, 1.8);
    }
    this.spawnShockwave(nr + 0.5, nc + 0.5, '#cfa64c', 88);
  }

  spawnCrushImpact(r, c) {
    this.spawnShockwave(r, c, '#c94b3c', 64);
    this.spawnSquareBurst(r, c, '#e05a4a', 20, 3.1);
  }

  spawnBaseShatter(r, c) {
    this.spawnShockwave(r, c, '#efd083', 78);
    this.spawnShockwave(r, c, '#c94b3c', 52);
    this.spawnSquareBurst(r, c, '#efd083', 24, 3.2);
  }

  spawnConversionBurst(r, c) {
    this.spawnShockwave(r, c, '#ffffff', 60);
    this.spawnShockwave(r, c, '#efd083', 42);
    this.spawnSquareBurst(r, c, '#ffffff', 18, 2.7);
  }

  spawnGalaxyPortal(r, c) {
    this.spawnShockwave(r, c, '#9d8df2', 58);
    this.spawnShockwave(r, c, '#efd083', 38);
    this.spawnSquareBurst(r, c, '#b3a3ff', 18, 2.5);
  }

  spawnGlitchTear(r, c) {
    this.spawnShockwave(r, c, '#c94b3c', 56);
    this.spawnSquareBurst(r, c, '#c94b3c', 16, 3.0);
    this.spawnSquareBurst(r, c, '#f3ede2', 8, 2.2);
  }

  spawnBlackySeal(r, c) {
    this.spawnShockwave(r, c, '#c94b3c', 64);
    this.spawnSquareBurst(r, c, '#1d1624', 18, 2.6);
    this.spawnSquareBurst(r, c, '#e5e8f0', 10, 2.2);
  }

  spawnBlackySummon(r, c) {
    this.spawnShockwave(r, c, '#9d8df2', 66);
    this.spawnShockwave(r, c, '#c94b3c', 42);
    this.spawnSquareBurst(r, c, '#e5e8f0', 16, 2.5);
  }

  spawnBlackyAbsorb(r, c) {
    // Rayo de energía oscura desde la pieza absorbida hacia el retrato superior izquierdo de Blacky
    this.spawnBeam(r, c, 0, 0, 'rgba(201, 75, 60, 0.92)', '#0d0912');
    this.spawnShockwave(r, c, '#c94b3c', 70);
    this.spawnSquareBurst(r, c, '#ff5e57', 22, 3.2);
  }

  spawnBlackyBetray(r, c) {
    this.spawnShockwave(r, c, '#ff4757', 74);
    this.spawnShockwave(r, c, '#9d8df2', 48);
    this.spawnSquareBurst(r, c, '#ff4757', 20, 2.9);
  }

  drawAtmospheric(ctx, w, h, intense = false) {
    ctx.clearRect(0, 0, w, h);
    if (!this.reduced) {
      ctx.save();
      const cx = w * 0.5;
      const cy = intense ? h * 0.36 : h * 0.16;
      const rayCount = intense ? 7 : 5;
      for (let i = 0; i < rayCount; i++) {
        const spread = ((i / (rayCount - 1)) - 0.5) * 1.4;
        const sway = Math.sin(this.time * 0.45 + i * 1.3) * 0.08;
        const angle = Math.PI * 0.5 + spread + sway;
        const len = Math.max(w, h) * 1.1;
        const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        grad.addColorStop(0, intense ? 'rgba(239, 208, 131, 0.15)' : 'rgba(207, 166, 76, 0.07)');
        grad.addColorStop(1, 'rgba(207, 166, 76, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - 0.07) * len, cy + Math.sin(angle - 0.07) * len);
        ctx.lineTo(cx + Math.cos(angle + 0.07) * len, cy + Math.sin(angle + 0.07) * len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    for (const p of this.ambientParticles) {
      p.x += p.vx;
      p.y += p.vy * (intense ? 2 : 1);
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      if (p.x < -0.02) p.x = 1.02;
      if (p.x > 1.02) p.x = -0.02;

      const twinkle = 0.55 + 0.45 * Math.sin(this.time * 2.2 + p.phase);
      const alpha = p.alpha * twinkle * (intense ? 1.3 : 0.85);
      ctx.fillStyle = p.gold
        ? `rgba(239, 208, 131, ${Math.min(1, alpha)})`
        : `rgba(116, 184, 148, ${Math.min(1, alpha * 0.85)})`;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBoardEffects() {
    if (!this.boardCtx || !this.boardCanvas || !this.boardCanvas.parentElement) return;
    const rect = this.boardCanvas.parentElement.getBoundingClientRect();
    this.boardCtx.clearRect(0, 0, rect.width, rect.height);

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += (s.maxR - s.r) * 0.14 + 1.2;
      s.alpha -= 0.035;
      if (s.alpha <= 0 || s.r >= s.maxR) { this.shockwaves.splice(i, 1); continue; }
      this.boardCtx.save();
      this.boardCtx.globalAlpha = Math.max(0, s.alpha);
      this.boardCtx.strokeStyle = s.color;
      this.boardCtx.lineWidth = s.lineWidth;
      this.boardCtx.beginPath();
      this.boardCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.boardCtx.stroke();
      this.boardCtx.restore();
    }

    for (let i = this.boardParticles.length - 1; i >= 0; i--) {
      const p = this.boardParticles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.95; p.vy *= 0.95;
      p.life -= p.decay;
      if (p.life <= 0) { this.boardParticles.splice(i, 1); continue; }
      this.boardCtx.save();
      this.boardCtx.globalAlpha = Math.max(0, p.life);
      this.boardCtx.fillStyle = p.color;
      this.boardCtx.beginPath();
      this.boardCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.boardCtx.fill();
      this.boardCtx.restore();
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= 0.055;
      if (b.life <= 0) { this.beams.splice(i, 1); continue; }
      this.boardCtx.save();
      this.boardCtx.globalAlpha = Math.max(0, b.life);
      this.boardCtx.lineCap = 'round';
      this.boardCtx.strokeStyle = b.outerColor;
      this.boardCtx.lineWidth = 10 * b.life;
      this.boardCtx.beginPath();
      this.boardCtx.moveTo(b.x1, b.y1);
      this.boardCtx.lineTo(b.x2, b.y2);
      this.boardCtx.stroke();
      this.boardCtx.strokeStyle = b.innerColor;
      this.boardCtx.lineWidth = 4 * b.life;
      this.boardCtx.beginPath();
      this.boardCtx.moveTo(b.x1, b.y1);
      this.boardCtx.lineTo(b.x2, b.y2);
      this.boardCtx.stroke();
      this.boardCtx.restore();
    }
  }

  loop(ts) {
    this.time = ts * 0.001;
    if (this.bgCtx && this.bgCanvas) this.drawAtmospheric(this.bgCtx, window.innerWidth, window.innerHeight, false);
    if (this.introMode && this.introCtx && this.introCanvas) this.drawAtmospheric(this.introCtx, window.innerWidth, window.innerHeight, true);
    this.drawBoardEffects();
    requestAnimationFrame((t) => this.loop(t));
  }
}
