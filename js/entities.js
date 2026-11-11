'use strict';
// ============================================================
// entities.js — Player, Zombie, Boss, Bullet, Pickup, particles
// Balance tables (G.WEAPONS / G.ZTYPES) live in game.js.
// ============================================================

// ---------- particle ----------
class Particle {
  constructor(x, y, vx, vy, life, size, color, o) {
    o = o || {};
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size; this.color = color;
    this.grav = o.grav || 0;
    this.drag = o.drag !== undefined ? o.drag : 0.9;
    this.shrink = o.shrink !== false;
    this.glow = o.glow || null; // glow sprite
    this.dead = false;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += this.grav * dt;
    const d = Math.pow(this.drag, dt * 60);
    this.vx *= d; this.vy *= d;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    const s = this.shrink ? Math.max(1, this.size * t) : this.size;
    ctx.globalAlpha = Math.min(1, t * 2);
    if (this.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.glow, this.x - s * 3, this.y - s * 3, s * 6, s * 6);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------- particle / gore helpers ----------
G.fx = {
  blood(x, y, ang, n) {
    const P = G.game.particles;
    for (let i = 0; i < n; i++) {
      const a = ang + U.rand(-0.9, 0.9), sp = U.rand(40, 220);
      P.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        U.rand(0.2, 0.5), U.rand(2, 5), U.pick(['#a02020', '#c03838', '#701818']), { grav: 300 }));
    }
    G.game.addDecal(x, y, U.rand(4, 9), 'rgba(120,20,20,0.5)');
  },
  gibs(x, y, n) {
    const P = G.game.particles;
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2), sp = U.rand(60, 260);
      P.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        U.rand(0.3, 0.7), U.rand(3, 6), U.pick(['#a02020', '#6aa84f', '#477a33', '#c03838']), { grav: 420 }));
    }
    for (let i = 0; i < 4; i++) G.game.addDecal(x + U.rand(-14, 14), y + U.rand(-14, 14), U.rand(3, 8), 'rgba(110,18,18,0.55)');
  },
  sparks(x, y, ang, n) {
    const P = G.game.particles;
    for (let i = 0; i < n; i++) {
      const a = ang + U.rand(-0.6, 0.6), sp = U.rand(80, 300);
      P.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        U.rand(0.08, 0.22), U.rand(1.5, 3), U.pick(['#ffd880', '#fff0c0', '#ff9a3c']), { drag: 0.85 }));
    }
  },
  casing(x, y, ang) {
    const a = ang + Math.PI / 2 + U.rand(-0.4, 0.4);
    G.game.particles.push(new Particle(x, y, Math.cos(a) * U.rand(60, 120), Math.sin(a) * U.rand(60, 120) - 60,
      U.rand(0.3, 0.5), 2, '#d8b858', { grav: 500 }));
  },
  dirt(x, y, n) {
    const P = G.game.particles;
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2), sp = U.rand(30, 160);
      P.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 60,
        U.rand(0.3, 0.7), U.rand(2, 5), U.pick(['#3a2c22', '#4a3a2c', '#2a2018']), { grav: 380 }));
    }
  },
  souls(x, y, n) {
    const P = G.game.particles;
    for (let i = 0; i < n; i++) {
      P.push(new Particle(x + U.rand(-20, 20), y + U.rand(-10, 10), U.rand(-20, 20), U.rand(-90, -40),
        U.rand(0.6, 1.2), U.rand(3, 6), null, { glow: G.SPR.glow_cyan, drag: 0.98 }));
    }
  },
  explosion(x, y, r) {
    const P = G.game.particles;
    for (let i = 0; i < 26; i++) {
      const a = U.rand(0, Math.PI * 2), sp = U.rand(60, r * 4);
      P.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        U.rand(0.2, 0.55), U.rand(3, 7), U.pick(['#ff9a3c', '#ffd880', '#e85f2a', '#8a8a8a']), { drag: 0.88 }));
    }
    P.push(new Particle(x, y, 0, 0, 0.25, r * 0.8, null, { glow: G.SPR.glow_white, shrink: false }));
    G.game.addDecal(x, y, r * 0.5, 'rgba(20,16,16,0.6)');
  },
};

// ---------- bullet (player & enemy) ----------
class Bullet {
  constructor(x, y, ang, spd, dmg, o) {
    o = o || {};
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
    this.dmg = dmg;
    this.pierce = o.pierce || 0;
    this.knock = o.knock || 100;
    this.hostile = !!o.hostile;
    this.r = o.r || 3;
    this.life = o.life || 1.2;
    this.sprite = o.sprite || null;
    this.spin = o.spin || 0;
    this.rot = ang;
    this.color = o.color || '#ffe8a0';
    this.trail = o.trail !== false;
    this.dead = false;
    this.hitSet = null; // lazily created for piercing bullets
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.px = this.x; this.py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.spin) this.rot += this.spin * dt;
    const W = G.game.world;
    // generous margin: bullets spawned at the world edge must still get
    // one collision pass (point-blank shots at the arena border)
    if (this.x < -40 || this.y < -40 || this.x > W.w + 40 || this.y > W.h + 40) { this.dead = true; return; }
    // obstacles block bullets
    const props = G.game.props;
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (!p.solid) continue;
      if (U.pointInRect(this.x, this.y, p)) {
        G.fx.sparks(this.x, this.y, Math.atan2(-this.vy, -this.vx), 4);
        this.dead = true;
        return;
      }
    }
  }
  draw(ctx) {
    if (this.sprite) {
      G.drawSpr(ctx, this.sprite, this.x, this.y, { rot: this.rot });
      return;
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.hostile ? 3 : 2;
    ctx.beginPath();
    if (this.trail) { ctx.moveTo(this.px, this.py); ctx.lineTo(this.x, this.y); }
    else { ctx.moveTo(this.x - this.vx * 0.01, this.y - this.vy * 0.01); ctx.lineTo(this.x, this.y); }
    ctx.stroke();
  }
}

// ---------- floating damage / score text ----------
class DamageNumber {
  constructor(x, y, text, color, size) {
    this.x = x + U.rand(-6, 6); this.y = y - 8;
    this.vy = -55; this.life = 0.7; this.maxLife = 0.7;
    this.text = text; this.color = color || '#fff';
    this.size = size || 11;
    this.dead = false;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.y += this.vy * dt;
    this.vy *= Math.pow(0.9, dt * 60);
  }
  draw(ctx) {
    ctx.globalAlpha = Math.min(1, (this.life / this.maxLife) * 2.5);
    ctx.font = 'bold ' + this.size + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(this.text, this.x + 1, this.y + 1);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

// ---------- pickup ----------
class Pickup {
  constructor(x, y, kind) {
    this.x = x; this.y = y; this.kind = kind;
    this.r = 12;
    this.life = 14;
    this.bob = U.rand(0, 6);
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.sprite = { ammo: 'pk_ammo', hp: 'pk_hp', gem: 'pk_gem', crate: 'pk_crate' }[kind];
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.bob += dt * 4;
    const pl = G.game.player;
    const d = U.dist(this.x, this.y, pl.x, pl.y);
    if (d < pl.magnetR()) {
      const a = U.angle(this.x, this.y, pl.x, pl.y);
      const pull = U.lerp(700, 120, d / pl.magnetR());
      this.vx = U.lerp(this.vx, Math.cos(a) * pull, dt * 8);
      this.vy = U.lerp(this.vy, Math.sin(a) * pull, dt * 8);
    } else {
      this.vx *= 0.9; this.vy *= 0.9;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (d < pl.r + this.r) {
      this.dead = true;
      G.game.applyPickup(this.kind, this.x, this.y);
    }
  }
  draw(ctx) {
    if (this.life < 3 && (this.life * 6 | 0) % 2 === 0) return; // blink when expiring
    const spr = G.SPR[this.sprite];
    const yo = Math.sin(this.bob) * 3;
    // glow halo
    ctx.globalCompositeOperation = 'lighter';
    const glow = this.kind === 'crate' ? G.SPR.glow_purple : this.kind === 'hp' ? G.SPR.glow_red : this.kind === 'gem' ? G.SPR.glow_cyan : G.SPR.glow_white;
    ctx.globalAlpha = 0.35 + Math.sin(this.bob) * 0.1;
    ctx.drawImage(glow, this.x - 24, this.y - 24 + yo, 48, 48);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    G.drawSpr(ctx, spr, this.x, this.y + yo);
  }
}

// ---------- shockwave ring (boss slam) ----------
class Shockwave {
  constructor(x, y, maxR, speed, dmg, o) {
    o = o || {};
    this.x = x; this.y = y;
    this.r = 12; this.maxR = maxR;
    this.speed = speed;
    this.thick = o.thick || 26;
    this.dmg = dmg;
    this.hitDone = false;
    this.color = o.color || '#c8a0ff';
    this.dead = false;
  }
  update(dt) {
    this.r += this.speed * dt;
    if (this.r > this.maxR) { this.dead = true; return; }
    const pl = G.game.player;
    if (!this.hitDone && !pl.dead) {
      const d = U.dist(this.x, this.y, pl.x, pl.y);
      if (Math.abs(d - this.r) < this.thick / 2 + pl.r) {
        this.hitDone = true;
        G.game.playerHurt(this.dmg, this.x, this.y);
      }
    }
  }
  draw(ctx) {
    const t = 1 - this.r / this.maxR;
    ctx.globalAlpha = 0.25 + t * 0.6;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.thick * 0.7;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + this.thick * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ---------- ground telegraph (grasping hands etc.) ----------
class Telegraph {
  constructor(x, y, r, dur, cb) {
    this.x = x; this.y = y; this.r = r;
    this.t = 0; this.dur = dur;
    this.cb = cb;
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) {
      this.dead = true;
      if (this.cb) this.cb();
    }
  }
  draw(ctx) {
    const p = this.t / this.dur;
    ctx.globalAlpha = 0.25 + 0.35 * p + 0.1 * Math.sin(this.t * 20);
    ctx.fillStyle = '#c03030';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ff5040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * (1 - p * 0.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ---------- grasping hand (boss phase 3) ----------
class Hand {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.t = 0;
    this.active = 0.35;   // damage window
    this.life = 0.8;
    this.hitDone = false;
    this.dead = false;
    G.audio.play('hands');
    G.fx.dirt(x, y, 10);
  }
  update(dt) {
    this.t += dt;
    if (this.t > this.life) { this.dead = true; return; }
    const pl = G.game.player;
    if (!this.hitDone && this.t < this.active && !pl.dead) {
      if (U.dist(this.x, this.y, pl.x, pl.y) < 30 + pl.r) {
        this.hitDone = true;
        G.game.playerHurt(26, this.x, this.y);
      }
    }
  }
  draw(ctx) {
    const rise = Math.min(1, this.t / 0.12);
    const sink = this.t > this.life - 0.2 ? (this.life - this.t) / 0.2 : 1;
    const h = 24 * Math.min(rise, sink);
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x - 20, this.y - h - 14, 40, h + 14);
    ctx.clip();
    G.drawSpr(ctx, G.SPR.hand, this.x, this.y - h + 8, { scale: 1.6 });
    ctx.restore();
  }
}

// ---------- player ----------
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 10;
    this.hp = 100;
    this.dead = false;
    this.aim = 0;
    this.fireCd = 0;
    this.weapons = ['pistol'];
    this.cur = 'pistol';
    this.ammo = { shotgun: 0, smg: 0, rifle: 0 };
    this.up = { dmg: 0, fr: 0, spd: 0, maxhp: 0, dash: 0, pierce: 0, multi: 0, magnet: 0, ammo: 0, lifesteal: 0, explode: 0, knock: 0 };
    this.killCount = 0;
    // dash
    this.dashT = 0; this.dashCd = 0; this.dashAng = 0;
    this.iframes = 0;
    this.hurtFlash = 0;
    this.muzzleT = 0;
    this.bobT = 0;
    this.moving = false;
    this.trail = []; // dash afterimages
    this.recoil = 0;
  }
  // --- derived stats (upgrade scaling) ---
  dmgMult() { return (1 + 0.15 * this.up.dmg) * (1 - 0.08 * this.up.multi); }
  frMult() { return 1 + 0.12 * this.up.fr; }
  spdMult() { return 1 + 0.10 * this.up.spd; }
  maxHp() { return 100 + 25 * this.up.maxhp; }
  dashCdMax() { return 1.1 * Math.pow(0.82, this.up.dash); }
  pierceBonus() { return this.up.pierce; }
  extraShots() { return this.up.multi; }
  magnetR() { return 60 * (1 + 0.6 * this.up.magnet); }
  ammoBonus() { return 1 + 0.6 * this.up.ammo; }
  knockMult() { return 1 + 0.4 * this.up.knock; }

  giveWeapon(name) {
    if (this.weapons.indexOf(name) >= 0) return false;
    this.weapons.push(name);
    const def = G.WEAPONS[name];
    if (def.ammoMax) this.ammo[name] = def.ammoMax;
    this.cur = name;
    return true;
  }
  cycleWeapon(dir) {
    const i = this.weapons.indexOf(this.cur);
    const n = this.weapons.length;
    this.cur = this.weapons[(i + dir + n) % n];
    G.audio.play('ui');
  }
  selectWeapon(name) {
    if (this.weapons.indexOf(name) < 0 || this.cur === name) return;
    this.cur = name;
    G.audio.play('ui');
  }

  update(dt) {
    if (this.dead) return;
    const I = G.input;
    // aim (screen mouse → world coords)
    const cam = G.game.cam;
    const wx = cam.x + I.mx, wy = cam.y + I.my;
    this.aim = Math.atan2(wy - this.y, wx - this.x);
    // move
    let mx = 0, my = 0;
    if (I.keys.KeyW || I.keys.ArrowUp) my -= 1;
    if (I.keys.KeyS || I.keys.ArrowDown) my += 1;
    if (I.keys.KeyA || I.keys.ArrowLeft) mx -= 1;
    if (I.keys.KeyD || I.keys.ArrowRight) mx += 1;
    const ml = Math.hypot(mx, my);
    this.moving = ml > 0;
    if (ml > 0) { mx /= ml; my /= ml; }
    // dash
    this.dashCd -= dt;
    if ((I.pressed.Space || I.pressed.ShiftLeft || I.pressed.ShiftRight) && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = 0.16;
      this.dashCd = this.dashCdMax();
      this.dashAng = ml > 0 ? Math.atan2(my, mx) : this.aim;
      this.iframes = Math.max(this.iframes, 0.24);
      G.audio.play('dash');
      G.game.shake(2);
    }
    let spd = 175 * this.spdMult();
    if (this.dashT > 0) {
      this.dashT -= dt;
      mx = Math.cos(this.dashAng); my = Math.sin(this.dashAng);
      spd = 560;
      this.trail.push({ x: this.x, y: this.y, t: 0.25 });
    }
    this.x += mx * spd * dt;
    this.y += my * spd * dt;
    this.bobT += dt * (this.moving ? 10 : 4);
    // world bounds + obstacles
    const W = G.game.world;
    this.x = U.clamp(this.x, 16, W.w - 16);
    this.y = U.clamp(this.y, 16, W.h - 16);
    for (const p of G.game.props) if (p.solid) U.circleRect(this, p);
    // fire
    this.fireCd -= dt;
    if (I.mdown && this.fireCd <= 0) this.fire();
    // timers
    this.iframes -= dt;
    this.hurtFlash -= dt;
    this.muzzleT -= dt;
    this.recoil *= Math.pow(0.001, dt);
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].t -= dt;
      if (this.trail[i].t <= 0) this.trail.splice(i, 1);
    }
    // low hp heartbeat
    if (this.hp < this.maxHp() * 0.3) {
      this._hb = (this._hb || 0) - dt;
      if (this._hb <= 0) { this._hb = 0.9; G.audio.play('lowhp'); }
    }
  }

  fire() {
    const def = G.WEAPONS[this.cur];
    if (def.ammoMax !== undefined) {
      if (this.ammo[this.cur] <= 0) {
        G.audio.play('deny');
        this.cur = 'pistol';
        G.game.toast('OUT OF AMMO — PISTOL', '#ff8060');
        this.fireCd = 0.25;
        return;
      }
      this.ammo[this.cur]--;
    }
    this.fireCd = 1 / (def.rate * this.frMult());
    const pellets = def.pellets + this.extraShots();
    const gx = this.x + Math.cos(this.aim) * 16;
    const gy = this.y + Math.sin(this.aim) * 16;
    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * 2 * def.spread + (pellets > 1 ? (i / (pellets - 1) - 0.5) * def.spread * 0.9 : 0);
      const a = this.aim + spread;
      G.game.bullets.push(new Bullet(gx, gy, a, def.spd * U.rand(0.95, 1.05), def.dmg * this.dmgMult(), {
        pierce: def.pierce + this.pierceBonus(),
        knock: def.knock * this.knockMult(),
        r: def.bulletR || 3,
        life: def.life || 1.0,
        color: def.color,
      }));
    }
    this.muzzleT = 0.05;
    this.recoil = Math.min(6, this.recoil + def.kick);
    G.game.shake(def.kick * 0.5);
    G.audio.play(def.sfx);
    G.fx.casing(this.x, this.y, this.aim);
    G.game.muzzleFlash = { x: gx, y: gy, t: 0.05 };
  }

  takeDamage(dmg, sx, sy) {
    if (this.dead || this.iframes > 0 || this.dashT > 0) return;
    this.hp -= dmg;
    this.iframes = 0.7;
    this.hurtFlash = 0.3;
    const a = U.angle(sx, sy, this.x, this.y);
    this.x += Math.cos(a) * 14;
    this.y += Math.sin(a) * 14;
    G.audio.play('hurt');
    G.game.shake(7);
    G.game.hitstop(0.06);
    G.game.hurtPulse = 0.5;
    G.fx.blood(this.x, this.y, a, 8);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      G.game.onPlayerDeath();
    }
  }

  heal(n) {
    this.hp = Math.min(this.maxHp(), this.hp + n);
  }

  draw(ctx) {
    // dash afterimages
    for (const t of this.trail) {
      ctx.globalAlpha = t.t * 2;
      G.drawSpr(ctx, G.SPR.player, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    // invuln blink
    if (this.iframes > 0 && (this.iframes * 20 | 0) % 2 === 0) ctx.globalAlpha = 0.45;
    const bob = this.moving ? Math.sin(this.bobT) * 1.5 : Math.sin(this.bobT) * 0.5;
    G.drawSpr(ctx, G.SPR.player, this.x, this.y + bob);
    ctx.globalAlpha = 1;
    // gun
    const gun = G.SPR['gun_' + this.cur];
    const rec = this.recoil;
    const gx = this.x + Math.cos(this.aim) * (14 - rec);
    const gy = this.y + Math.sin(this.aim) * (14 - rec) + bob - 2;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(this.aim);
    if (Math.cos(this.aim) < 0) ctx.scale(1, -1);
    ctx.drawImage(gun, -gun.width * 0.25, -gun.height / 2);
    ctx.restore();
    // muzzle flash
    if (this.muzzleT > 0) {
      const mx = this.x + Math.cos(this.aim) * 30;
      const my = this.y + Math.sin(this.aim) * 30 + bob - 2;
      G.drawSpr(ctx, G.SPR.muzzle, mx, my, { rot: this.aim, alpha: this.muzzleT / 0.05 });
    }
  }
}

// ---------- zombie ----------
class Zombie {
  constructor(type, x, y, wave) {
    const def = G.ZTYPES[type];
    this.type = type;
    this.def = def;
    this.x = x; this.y = y; this.r = def.r;
    const hpScale = 1 + 0.07 * (wave - 1);
    this.hp = this.maxHp = Math.round(def.hp * hpScale);
    this.dmg = Math.round(def.dmg * (1 + 0.03 * wave));
    this.spd = def.spd * (1 + Math.min(0.5, 0.02 * wave)) * U.rand(0.9, 1.1);
    this.score = Math.round(def.score * (1 + 0.05 * wave));
    this.state = 'emerge';
    this.t = 0;
    this.animT = U.rand(0, 1);
    this.attackCd = 0;
    this.flash = 0;
    this.kbx = 0; this.kby = 0;
    this.carrier = false;   // drops a supply crate
    this.fuse = -1;         // exploder
    this.spitCd = U.rand(0.5, 1.5);
    this.strafeDir = U.chance(0.5) ? 1 : -1;
    this.dead = false;
    G.fx.dirt(x, y, 8);
  }
  takeDamage(dmg, ang, knock) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.08;
    const kr = this.def.knockResist || 0;
    this.kbx += Math.cos(ang) * knock * (1 - kr);
    this.kby += Math.sin(ang) * knock * (1 - kr);
    G.game.dmgnums.push(new DamageNumber(this.x, this.y - this.r, Math.round(dmg), '#ffe8a0', 10));
    G.fx.blood(this.x, this.y, ang, 4);
    G.audio.play('hit');
    if (this.hp <= 0) this.die();
  }
  die() {
    if (this.dead) return;
    this.dead = true;
    G.audio.play('kill');
    G.fx.gibs(this.x, this.y, this.type === 'brute' ? 16 : 8);
    G.game.onKill(this);
    if (this.type === 'exploder') this.explode(false);
  }
  explode(hurtPlayer) {
    const R = 78;
    G.audio.play('explode');
    G.fx.explosion(this.x, this.y, R);
    G.game.shake(6);
    G.game.hitstop(0.05);
    // hurts other zombies too — chain reactions
    for (const z of G.game.zombies) {
      if (z === this || z.dead) continue;
      if (U.dist(this.x, this.y, z.x, z.y) < R + z.r) {
        z.takeDamage(60, U.angle(this.x, this.y, z.x, z.y), 300);
      }
    }
    const pl = G.game.player;
    if (hurtPlayer && !pl.dead && U.dist(this.x, this.y, pl.x, pl.y) < R + pl.r) {
      pl.takeDamage(24, this.x, this.y);
    }
  }
  update(dt) {
    if (this.dead) return;
    this.t += dt;
    this.animT += dt;
    this.flash -= dt;
    this.attackCd -= dt;
    const pl = G.game.player;
    if (this.state === 'emerge') {
      if (this.t > 0.45) this.state = 'walk';
      return;
    }
    // exploder fuse
    if (this.type === 'exploder') {
      const d = U.dist(this.x, this.y, pl.x, pl.y);
      if (this.fuse < 0 && d < 52) { this.fuse = 0.45; }
      if (this.fuse >= 0) {
        this.fuse -= dt;
        if (this.fuse <= 0) { this.dead = true; this.explode(true); G.game.onKill(this, true); return; }
      }
    }
    // steering
    const a = U.angle(this.x, this.y, pl.x, pl.y);
    let vx = Math.cos(a), vy = Math.sin(a);
    if (this.type === 'spitter') {
      const d = U.dist(this.x, this.y, pl.x, pl.y);
      if (d < 150) { vx = -Math.cos(a); vy = -Math.sin(a); }
      else if (d < 230) { vx = Math.cos(a + Math.PI / 2) * this.strafeDir; vy = Math.sin(a + Math.PI / 2) * this.strafeDir; }
      this.spitCd -= dt;
      if (this.spitCd <= 0 && d < 340) {
        this.spitCd = 1.7;
        G.audio.play('spit');
        G.game.ebullets.push(new Bullet(this.x, this.y - 6, a, 230, this.dmg, {
          hostile: true, sprite: G.SPR.glob, r: 6, life: 2.2,
        }));
      }
    }
    let spd = this.spd;
    if (this.type === 'exploder' && this.fuse >= 0) spd *= 0.4;
    this.x += (vx * spd + this.kbx) * dt;
    this.y += (vy * spd + this.kby) * dt;
    this.kbx *= Math.pow(0.001, dt);
    this.kby *= Math.pow(0.001, dt);
    // separation
    const zs = G.game.zombies;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (z === this || z.dead) continue;
      const dx = this.x - z.x, dy = this.y - z.y;
      const rr = this.r + z.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (rr - d) * 0.5;
        this.x += (dx / d) * push;
        this.y += (dy / d) * push;
      }
    }
    // bounds + obstacles
    const W = G.game.world;
    this.x = U.clamp(this.x, 12, W.w - 12);
    this.y = U.clamp(this.y, 12, W.h - 12);
    for (const p of G.game.props) if (p.solid) U.circleRect(this, p);
    // contact attack (exploders deal their damage via explosion instead)
    if (this.dmg > 0 && this.attackCd <= 0 && !pl.dead && U.circleHit(this.x, this.y, this.r, pl.x, pl.y, pl.r + 2)) {
      this.attackCd = 0.7;
      pl.takeDamage(this.dmg, this.x, this.y);
    }
  }
  draw(ctx) {
    const frames = G.SPR['z_' + this.type + '_a'] ? ['z_' + this.type + '_a', 'z_' + this.type + '_b'] : null;
    const key = frames ? frames[(this.animT * 5 | 0) % 2] : 'z_shambler_a';
    let spr = G.SPR[key];
    if (this.flash > 0) spr = G.SPRW[key];
    const emergeScale = this.state === 'emerge' ? U.easeOut(this.t / 0.45) : 1;
    const pl = G.game.player;
    const flip = pl.x < this.x;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(1, emergeScale);
    // carrier glow
    if (this.carrier) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(this.animT * 6);
      ctx.drawImage(G.SPR.glow_cyan, -26, -26, 52, 52);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // exploder fuse blink
    if (this.fuse >= 0 && (this.fuse * 14 | 0) % 2 === 0) spr = G.SPRW[key];
    G.drawSpr(ctx, spr, 0, 0, { flip });
    ctx.restore();
    // hp bar for tanky types
    if (this.maxHp >= 100 && this.hp < this.maxHp) {
      const w = 30;
      ctx.fillStyle = '#000';
      ctx.fillRect(this.x - w / 2 - 1, this.y - this.r - 12, w + 2, 5);
      ctx.fillStyle = '#c03838';
      ctx.fillRect(this.x - w / 2, this.y - this.r - 11, w * (this.hp / this.maxHp), 3);
    }
  }
}

// ---------- THE WARDEN: tombstone boss, 3 distinct phases ----------
class Boss {
  constructor(x, y, loop) {
    this.x = x; this.y = y; this.r = 38;
    this.loop = loop;
    this.maxHp = 1500 + (loop - 1) * 600;
    this.hp = this.maxHp;
    this.phase = 1;
    this.state = 'intro';
    this.t = 2.2;
    this.invuln = true;
    this.flash = 0;
    this.animT = 0;
    this.vx = 0; this.vy = 0;
    this.attackIdx = 0;
    this.stunned = false;
    this.chargeTx = 0; this.chargeTy = 0;
    this.spiralA = 0;
    this.burstN = 0;
    this.name = loop === 1 ? 'THE WARDEN' : loop === 2 ? 'THE WARDEN REBORN' : 'THE ETERNAL WARDEN';
    this.dead = false;
    this.contactCd = 0;
    G.audio.play('boss_roar');
    G.audio.setIntensity(1);
  }

  attacks() {
    if (this.phase === 1) return ['summon', 'slam', 'burrow', 'slam'];
    if (this.phase === 2) return ['charge', 'spiral', 'summon', 'slam', 'charge', 'spiral', 'slam'];
    return ['storm', 'hands', 'cross', 'summon', 'slam', 'hands'];
  }

  takeDamage(dmg, ang) {
    if (this.dead) return;
    if (this.invuln) {
      G.fx.sparks(this.x, this.y - 20, ang, 3);
      return;
    }
    if (this.stunned) dmg *= 1.5;
    this.hp -= dmg;
    this.flash = 0.06;
    G.game.dmgnums.push(new DamageNumber(this.x + U.rand(-16, 16), this.y - 40, Math.round(dmg), '#ffd880', 11));
    G.audio.play('hit');
    const frac = this.hp / this.maxHp;
    if (this.phase === 1 && frac <= 0.66) this.startTransform(2);
    else if (this.phase === 2 && frac <= 0.33) this.startTransform(3);
    else if (this.hp <= 0) this.die();
  }

  startTransform(next) {
    this.phase = next;
    this.state = 'transform';
    this.t = 1.6;
    this.invuln = true;
    this.attackIdx = 0;
    G.game.ebullets.length = 0;
    G.game.shake(10);
    G.game.hitstop(0.25);
    G.game.flashT = 0.8;
    G.audio.play('boss_roar');
    G.fx.souls(this.x, this.y - 20, 20);
    G.game.bossBanner(next === 2 ? 'THE WARDEN CRACKS OPEN' : 'SOUL STORM UNLEASHED');
  }

  die() {
    this.dead = true;
    G.game.onBossDeath(this);
  }

  // ---- attack helpers ----
  doSummon(count, types) {
    if (G.game.zombies.length > 10) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + U.rand(0, 0.5);
      const d = U.rand(70, 120);
      const x = U.clamp(this.x + Math.cos(a) * d, 30, G.game.world.w - 30);
      const y = U.clamp(this.y + Math.sin(a) * d, 30, G.game.world.h - 30);
      G.game.spawnZombie(U.pick(types), x, y);
    }
    G.audio.play('hands');
  }
  doSlam(rings) {
    G.audio.play('slam');
    G.game.shake(9);
    G.fx.dirt(this.x, this.y + 20, 16);
    const speed = this.phase === 3 ? 380 : 320;
    G.game.shockwaves.push(new Shockwave(this.x, this.y, 300, speed, 22));
    if (rings > 1) {
      const self = this;
      G.game.delayed(0.35, () => {
        if (!self.dead) {
          G.game.shockwaves.push(new Shockwave(self.x, self.y, 300, speed, 22));
          G.audio.play('slam');
        }
      });
    }
  }
  fireBone(ang, spd) {
    G.game.ebullets.push(new Bullet(this.x, this.y - 10, ang, spd || 185, 12, {
      hostile: true, sprite: G.SPR.bone, r: 6, life: 4, spin: 8,
    }));
    G.audio.play('bone');
  }

  update(dt) {
    if (this.dead) return;
    this.t -= dt;
    this.animT += dt;
    this.flash -= dt;
    this.contactCd -= dt;
    const pl = G.game.player;
    const S = this.state;

    if (S === 'intro') {
      if (this.t <= 0) { this.state = 'idle'; this.t = 0.8; this.invuln = false; }
      return;
    }
    if (S === 'transform') {
      if (U.chance(dt * 20)) G.fx.souls(this.x, this.y - 20, 2);
      if (this.t <= 0) { this.state = 'idle'; this.t = 0.5; this.invuln = false; }
      return;
    }
    if (S === 'idle') {
      // drift toward player (phases 2-3)
      if (this.phase >= 2) {
        const a = U.angle(this.x, this.y, pl.x, pl.y);
        const spd = this.phase === 3 ? 55 : 38;
        this.x += Math.cos(a) * spd * dt;
        this.y += Math.sin(a) * spd * dt;
      }
      if (this.t <= 0) {
        const list = this.attacks();
        const atk = list[this.attackIdx % list.length];
        this.attackIdx++;
        this.startAttack(atk);
      }
      return;
    }
    // ---- attack states ----
    if (S === 'summon') {
      if (this.t <= 0) this.toIdle();
    } else if (S === 'slam_tele') {
      if (this.t <= 0) {
        this.doSlam(this.phase >= 2 ? 2 : 1);
        this.state = 'recover'; this.t = 0.7;
      }
    } else if (S === 'burrow_sink') {
      if (this.t <= 0) { this.state = 'burrow_move'; this.t = 0.8; this.invuln = true; }
    } else if (S === 'burrow_move') {
      const a = U.angle(this.x, this.y, pl.x, pl.y);
      this.x += Math.cos(a) * 260 * dt;
      this.y += Math.sin(a) * 260 * dt;
      if (U.chance(dt * 30)) G.fx.dirt(this.x, this.y, 2);
      if (this.t <= 0) {
        this.state = 'burrow_emerge'; this.t = 0.4;
        this.invuln = false;
        this.doSlam(1);
      }
    } else if (S === 'burrow_emerge') {
      if (this.t <= 0) this.toIdle();
    } else if (S === 'charge_tele') {
      // track player until fire
      this.chargeTx = pl.x; this.chargeTy = pl.y;
      if (this.t <= 0) {
        this.state = 'charge'; this.t = 1.2;
        const a = U.angle(this.x, this.y, this.chargeTx, this.chargeTy);
        this.vx = Math.cos(a) * 640; this.vy = Math.sin(a) * 640;
        G.audio.play('dash');
      }
    } else if (S === 'charge') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      G.fx.dirt(this.x, this.y + 20, 1);
      const W = G.game.world;
      let hitWall = this.x < 40 || this.x > W.w - 40 || this.y < 40 || this.y > W.h - 40;
      this.x = U.clamp(this.x, 40, W.w - 40);
      this.y = U.clamp(this.y, 40, W.h - 40);
      for (const p of G.game.props) {
        if (p.solid && U.pointInRect(this.x, this.y, p)) { hitWall = true; break; }
      }
      if (hitWall || this.t <= 0) {
        this.state = 'stun'; this.t = 1.2;
        this.stunned = true;
        G.game.shake(8);
        G.audio.play('slam');
        G.fx.dirt(this.x, this.y, 14);
      }
    } else if (S === 'stun') {
      if (this.t <= 0) { this.stunned = false; this.toIdle(); }
    } else if (S === 'spiral') {
      this.burstT -= dt;
      if (this.burstT <= 0 && this.burstN > 0) {
        this.burstN--;
        this.burstT = 0.4;
        for (let i = 0; i < 10; i++) this.fireBone((i / 10) * Math.PI * 2 + this.burstN * 0.35);
      }
      if (this.burstN <= 0 && this.t <= 0) this.toIdle();
    } else if (S === 'storm') {
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = 0.1;
        this.spiralA += 0.42;
        this.fireBone(this.spiralA, 200);
        this.fireBone(this.spiralA + Math.PI, 200);
      }
      if (this.t <= 0) this.toIdle();
    } else if (S === 'hands') {
      if (this.t <= 0) this.toIdle();
    } else if (S === 'cross') {
      this.burstT -= dt;
      if (this.burstT <= 0 && this.burstN > 0) {
        this.burstN--;
        this.burstT = 0.35;
        const base = this.burstN * 0.26;
        for (let i = 0; i < 4; i++) this.fireBone(base + (i / 4) * Math.PI * 2, 210);
      }
      if (this.burstN <= 0 && this.t <= 0) this.toIdle();
    } else if (S === 'recover') {
      if (this.t <= 0) this.toIdle();
    }

    // contact damage (not while rising / burrowed / mid-transformation)
    if (this.state !== 'intro' && this.state !== 'burrow_move' && this.state !== 'transform' &&
        !pl.dead && this.contactCd <= 0 && U.circleHit(this.x, this.y, this.r, pl.x, pl.y, pl.r)) {
      this.contactCd = 0.8;
      pl.takeDamage(24, this.x, this.y);
    }
  }

  startAttack(atk) {
    const pl = G.game.player;
    if (atk === 'summon') {
      const types = this.phase === 1 ? ['shambler', 'shambler', 'shambler', 'runner']
        : this.phase === 2 ? ['runner', 'runner', 'shambler']
          : ['exploder', 'runner', 'runner'];
      this.doSummon(this.phase === 1 ? 5 : 4, types);
      this.state = 'summon'; this.t = 0.8;
    } else if (atk === 'slam') {
      this.state = 'slam_tele'; this.t = 0.7;
      G.audio.play('bone');
    } else if (atk === 'burrow') {
      this.state = 'burrow_sink'; this.t = 0.5;
      G.fx.dirt(this.x, this.y + 20, 14);
    } else if (atk === 'charge') {
      this.state = 'charge_tele'; this.t = 0.65;
    } else if (atk === 'spiral') {
      this.state = 'spiral'; this.t = 1.4;
      this.burstN = 3; this.burstT = 0;
    } else if (atk === 'storm') {
      this.state = 'storm'; this.t = 3.0;
      this.spiralT = 0; this.spiralA = U.rand(0, 6);
    } else if (atk === 'hands') {
      this.state = 'hands'; this.t = 1.0;
      for (let i = 0; i < 4; i++) {
        const hx = U.clamp(pl.x + (i === 0 ? 0 : U.rand(-130, 130)), 30, G.game.world.w - 30);
        const hy = U.clamp(pl.y + (i === 0 ? 0 : U.rand(-130, 130)), 30, G.game.world.h - 30);
        G.game.telegraphs.push(new Telegraph(hx, hy, 34, 0.85, () => G.game.hands.push(new Hand(hx, hy))));
      }
    } else if (atk === 'cross') {
      this.state = 'cross'; this.t = 1.3;
      this.burstN = 3; this.burstT = 0;
    }
  }

  toIdle() {
    this.state = 'idle';
    this.t = this.phase === 1 ? 1.0 : this.phase === 2 ? 0.8 : 0.55;
  }

  draw(ctx) {
    const buried = this.state === 'burrow_move';
    if (buried) {
      // moving dirt mound
      ctx.fillStyle = '#2a2018';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    let key = 'p' + this.phase;
    let spr = G.SPR.boss[key];
    if (this.flash > 0) spr = G.SPRW.boss[key];
    const sink = this.state === 'intro' ? (1 - U.easeOut(1 - Math.max(0, this.t) / 2.2)) * 60
      : this.state === 'burrow_sink' ? (1 - this.t / 0.5) * 60
        : this.state === 'burrow_emerge' ? (this.t / 0.4) * 60 : 0;
    const float = this.phase >= 2 ? Math.sin(this.animT * 2.2) * 5 : 0;
    const shakeX = this.state === 'transform' ? U.rand(-3, 3) : 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 34, 44 - float, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // aura
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.phase === 3 ? 0.5 + 0.2 * Math.sin(this.animT * 6) : this.phase === 2 ? 0.3 : 0.15;
    const glow = this.phase === 3 ? G.SPR.glow_purple : G.SPR.glow_cyan;
    ctx.drawImage(glow, this.x - 70, this.y - 90 + float, 140, 140);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // body
    ctx.save();
    ctx.translate(this.x + shakeX, this.y + float);
    if (sink > 0) {
      ctx.beginPath();
      ctx.rect(-60, -120, 120, 120 - sink + 34);
      ctx.clip();
    }
    ctx.drawImage(spr, -spr.width / 2, -spr.height + 34);
    ctx.restore();
    // phase 3: hovering soul core
    if (this.phase === 3) {
      const cy = this.y - 108 + float + Math.sin(this.animT * 3) * 6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      ctx.drawImage(G.SPR.glow_cyan, this.x - 30, cy - 30, 60, 60);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      G.drawSpr(ctx, G.SPR.skull, this.x, cy, { scale: 1.4 });
    }
    // stun stars
    if (this.stunned) {
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffe86a';
      ctx.fillText('STUNNED!', this.x, this.y - 96 + float);
    }
    // charge telegraph line
    if (this.state === 'charge_tele') {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.animT * 20);
      ctx.strokeStyle = '#ff5040';
      ctx.lineWidth = 6;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.chargeTx, this.chargeTy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // slam telegraph ring
    if (this.state === 'slam_tele') {
      const p = 1 - this.t / 0.7;
      ctx.globalAlpha = 0.3 + 0.4 * p;
      ctx.strokeStyle = '#c03030';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 300 * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
