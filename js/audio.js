'use strict';
// ============================================================
// audio.js — procedural WebAudio SFX + ambient drone (no assets)
// ============================================================
(function () {
  const A = {
    ctx: null,
    master: null,
    sfxBus: null,
    muted: false,
    _last: Object.create(null),
    _drone: null,

    unlock() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.5;
          this.master.connect(this.ctx.destination);
          this.sfxBus = this.ctx.createGain();
          this.sfxBus.gain.value = 1;
          this.sfxBus.connect(this.master);
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },

    tone(o) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.f || 440, t0);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + (o.dur || 0.1));
      const v = o.vol || 0.2;
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (o.dur || 0.1));
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t0); osc.stop(t0 + (o.dur || 0.1) + 0.03);
    },

    noise(o) {
      if (!this.ctx || this.muted) return;
      o = o || {};
      const dur = o.dur || 0.15;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = o.vol || 0.2;
      let node = src;
      if (o.fc) {
        const f = this.ctx.createBiquadFilter();
        f.type = o.ft || 'lowpass';
        f.frequency.value = o.fc;
        if (o.q) f.Q.value = o.q;
        src.connect(f); node = f;
      }
      node.connect(g); g.connect(this.sfxBus);
      src.start(t0);
    },

    // throttled entry point used by gameplay
    play(name, opt) {
      if (!this.ctx || this.muted) return;
      const throttle = { shoot_smg: 45, hit: 30, shoot_pistol: 40, bone: 60 }[name] || 0;
      if (throttle) {
        const now = performance.now();
        if (this._last[name] && now - this._last[name] < throttle) return;
        this._last[name] = now;
      }
      const fn = SFX[name];
      if (fn) fn(this, opt);
    },

    // ---- ambient drone: moody graveyard bed, intensifies on boss ----
    startAmbience() {
      if (!this.ctx || this._drone) return;
      const c = this.ctx;
      const g = c.createGain();
      g.gain.value = 0.05;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 220;
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
      const o3 = c.createOscillator(); o3.type = 'sine'; o3.frequency.value = 27.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lfoG = c.createGain(); lfoG.gain.value = 0.02;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      o1.connect(lp); o2.connect(lp); o3.connect(lp);
      lp.connect(g); g.connect(this.master);
      o1.start(); o2.start(); o3.start(); lfo.start();
      this._drone = { gain: g, lp };
    },
    setIntensity(x) { // 0 = calm, 1 = boss
      if (!this._drone || !this.ctx) return;
      const t = this.ctx.currentTime;
      this._drone.gain.gain.linearRampToValueAtTime(0.05 + x * 0.06, t + 0.8);
      this._drone.lp.frequency.linearRampToValueAtTime(220 + x * 500, t + 0.8);
    },
  };

  // ---- SFX recipes ----
  const SFX = {
    shoot_pistol(a) {
      a.tone({ f: 720, f2: 160, dur: 0.08, type: 'square', vol: 0.16 });
      a.noise({ dur: 0.05, vol: 0.1, fc: 3200, ft: 'highpass' });
    },
    shoot_shotgun(a) {
      a.noise({ dur: 0.22, vol: 0.4, fc: 900 });
      a.tone({ f: 170, f2: 55, dur: 0.18, type: 'sawtooth', vol: 0.3 });
    },
    shoot_smg(a) {
      a.tone({ f: 940, f2: 320, dur: 0.05, type: 'square', vol: 0.11 });
      a.noise({ dur: 0.03, vol: 0.07, fc: 4200, ft: 'highpass' });
    },
    shoot_rifle(a) {
      a.tone({ f: 1300, f2: 110, dur: 0.15, type: 'sawtooth', vol: 0.22 });
      a.noise({ dur: 0.1, vol: 0.18, fc: 2400, ft: 'highpass' });
    },
    hit(a) { a.noise({ dur: 0.05, vol: 0.12, fc: 1800 }); },
    kill(a) {
      a.tone({ f: 220, f2: 38, dur: 0.2, type: 'sawtooth', vol: 0.2 });
      a.noise({ dur: 0.12, vol: 0.14, fc: 700 });
    },
    explode(a) {
      a.noise({ dur: 0.5, vol: 0.5, fc: 420 });
      a.tone({ f: 95, f2: 28, dur: 0.42, type: 'sine', vol: 0.45 });
    },
    hurt(a) {
      a.tone({ f: 300, f2: 70, dur: 0.25, type: 'sawtooth', vol: 0.3 });
      a.noise({ dur: 0.15, vol: 0.2, fc: 500 });
    },
    dash(a) { a.noise({ dur: 0.14, vol: 0.16, fc: 1400, ft: 'bandpass', q: 1.5 }); },
    pickup(a) {
      a.tone({ f: 620, f2: 930, dur: 0.08, type: 'sine', vol: 0.2 });
      a.tone({ f: 930, f2: 1400, dur: 0.1, type: 'sine', vol: 0.18, delay: 0.07 });
    },
    gem(a) {
      a.tone({ f: 1050, f2: 1600, dur: 0.07, type: 'triangle', vol: 0.18 });
      a.tone({ f: 1600, f2: 2100, dur: 0.09, type: 'triangle', vol: 0.14, delay: 0.06 });
    },
    upgrade(a) {
      a.tone({ f: 440, dur: 0.09, type: 'square', vol: 0.16 });
      a.tone({ f: 660, dur: 0.09, type: 'square', vol: 0.16, delay: 0.08 });
      a.tone({ f: 880, dur: 0.16, type: 'square', vol: 0.18, delay: 0.16 });
    },
    wave(a) {
      a.tone({ f: 330, dur: 0.1, type: 'square', vol: 0.16 });
      a.tone({ f: 440, dur: 0.14, type: 'square', vol: 0.16, delay: 0.1 });
    },
    newweapon(a) {
      a.tone({ f: 523, dur: 0.09, type: 'square', vol: 0.18 });
      a.tone({ f: 784, dur: 0.09, type: 'square', vol: 0.18, delay: 0.09 });
      a.tone({ f: 1046, dur: 0.2, type: 'square', vol: 0.2, delay: 0.18 });
    },
    boss_roar(a) {
      a.tone({ f: 82, f2: 36, dur: 0.9, type: 'sawtooth', vol: 0.42 });
      a.tone({ f: 110, f2: 45, dur: 0.9, type: 'square', vol: 0.2, delay: 0.05 });
      a.noise({ dur: 0.7, vol: 0.25, fc: 300 });
    },
    slam(a) {
      a.tone({ f: 72, f2: 26, dur: 0.3, type: 'sine', vol: 0.5 });
      a.noise({ dur: 0.22, vol: 0.3, fc: 260 });
    },
    spit(a) { a.tone({ f: 520, f2: 190, dur: 0.13, type: 'triangle', vol: 0.16 }); },
    bone(a) { a.tone({ f: 800, f2: 500, dur: 0.05, type: 'square', vol: 0.07 }); },
    hands(a) {
      a.noise({ dur: 0.25, vol: 0.25, fc: 350 });
      a.tone({ f: 140, f2: 60, dur: 0.22, type: 'sawtooth', vol: 0.2 });
    },
    ui(a) { a.tone({ f: 880, dur: 0.05, type: 'square', vol: 0.12 }); },
    deny(a) { a.tone({ f: 220, f2: 160, dur: 0.12, type: 'square', vol: 0.14 }); },
    gameover(a) {
      a.tone({ f: 392, dur: 0.25, type: 'sawtooth', vol: 0.22 });
      a.tone({ f: 311, dur: 0.25, type: 'sawtooth', vol: 0.22, delay: 0.24 });
      a.tone({ f: 233, dur: 0.5, type: 'sawtooth', vol: 0.24, delay: 0.48 });
    },
    lowhp(a) { a.tone({ f: 190, f2: 150, dur: 0.1, type: 'sine', vol: 0.16 }); },
  };

  G.audio = A;
})();
