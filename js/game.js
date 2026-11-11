'use strict';
// ============================================================
// game.js — balance tables, world, waves, upgrades, HUD, loop
// ============================================================

// ---------- weapon balance: each has a clear niche ----------
// PISTOL:   infinite ammo, dependable — the fallback that still kills
// SCATTER:  burst + huge knockback, deletes crowds up close
// SMG:      sustained DPS hose, melts brutes & boss, eats ammo
// RIFLE:    pierces whole lanes, best vs lines & sniping spitters
G.WEAPONS = {
  pistol:  { name: 'PISTOL',    dmg: 24, rate: 3.5,  spd: 640, spread: 0.03, pellets: 1, pierce: 0, knock: 130, kick: 1.5, sfx: 'shoot_pistol',  bulletR: 3, color: '#ffe8a0', life: 0.9 },
  shotgun: { name: 'SCATTERGUN', dmg: 10, rate: 1.15, spd: 560, spread: 0.30, pellets: 7, pierce: 0, knock: 65,  kick: 5,   sfx: 'shoot_shotgun', bulletR: 3, color: '#ffc060', life: 0.34, ammoMax: 24 },
  smg:     { name: 'SMG',       dmg: 11, rate: 9,    spd: 680, spread: 0.09, pellets: 1, pierce: 0, knock: 60,  kick: 0.8, sfx: 'shoot_smg',     bulletR: 2, color: '#a0e8ff', life: 0.8,  ammoMax: 120 },
  rifle:   { name: 'RIFLE',     dmg: 65, rate: 1.2,  spd: 900, spread: 0.01, pellets: 1, pierce: 3, knock: 230, kick: 4,   sfx: 'shoot_rifle',   bulletR: 4, color: '#ffd0ff', life: 1.4,  ammoMax: 14 },
};
const WEAPON_ORDER = ['pistol', 'shotgun', 'smg', 'rifle'];

// ---------- zombie roster ----------
G.ZTYPES = {
  shambler: { hp: 30,  spd: 55,  dmg: 12, r: 11, score: 50 },
  runner:   { hp: 16,  spd: 125, dmg: 8,  r: 9,  score: 80 },
  brute:    { hp: 240, spd: 34,  dmg: 25, r: 18, score: 300, knockResist: 0.8 },
  spitter:  { hp: 40,  spd: 48,  dmg: 12, r: 11, score: 150 },
  exploder: { hp: 22,  spd: 110, dmg: 0,  r: 10, score: 120 },
};

// ---------- run-scoped upgrades (supply crates) ----------
G.UPGRADES = [
  { id: 'dmg',       name: 'SILVER ROUNDS',  desc: '+15% damage',                max: 5, color: '#ffd880' },
  { id: 'fr',        name: 'TRIGGER FINGER', desc: '+12% fire rate',             max: 5, color: '#ffd880' },
  { id: 'spd',       name: 'SWIFT BOOTS',    desc: '+10% move speed',            max: 4, color: '#a0e8ff' },
  { id: 'maxhp',     name: 'THICK HIDE',     desc: '+25 max HP, heal 25',        max: 5, color: '#ff9a9a' },
  { id: 'dash',      name: 'PHASE SOLES',    desc: '-18% dash cooldown',         max: 3, color: '#a0e8ff' },
  { id: 'pierce',    name: 'PIERCING CORE',  desc: 'bullets pierce +1 zombie',   max: 2, color: '#e8a0ff' },
  { id: 'multi',     name: 'SPLIT CHAMBER',  desc: '+1 projectile, -8% dmg',     max: 2, color: '#e8a0ff' },
  { id: 'magnet',    name: 'SOUL MAGNET',    desc: '+60% pickup radius',         max: 3, color: '#a0ffe8' },
  { id: 'ammo',      name: 'SCAVENGER',      desc: '+60% ammo from drops',       max: 3, color: '#ffe8a0' },
  { id: 'lifesteal', name: 'BLOOD PACT',     desc: 'every 8th kill heals 2 HP',  max: 3, color: '#ff9a9a' },
  { id: 'explode',   name: 'CORPSE BOMBS',   desc: '10% chance kills explode',   max: 3, color: '#ffb060' },
  { id: 'knock',     name: 'HEAVY CALIBER',  desc: '+40% knockback',             max: 2, color: '#c0c0ff' },
];

// ============================================================
const game = {
  state: 'title', // title | play | upgrade | over
  paused: false,
  world: { w: 1600, h: 1200 },
  player: null,
  zombies: [], bullets: [], ebullets: [], particles: [], pickups: [],
  dmgnums: [], shockwaves: [], telegraphs: [], hands: [], timers: [],
  props: [], fogs: [],
  boss: null,
  cam: { x: 0, y: 0, trauma: 0 },
  wave: 0, waveState: 'fighting', spawnQueue: [], spawnT: 0, breatherT: 0,
  score: 0, combo: 0, comboT: 0, kills: 0, time: 0,
  toasts: [], bannerObj: null,
  choices: [], cardRects: [],
  muzzleFlash: null, hurtPulse: 0, flashT: 0,
  slowmoT: 0, deathT: 0, overT: 0, newBest: false,
  time0: 0, _hitstop: 0,
};
G.game = game;

// ---------- small helpers ----------
game.shake = function (n) { this.cam.trauma = Math.min(1, this.cam.trauma + n / 12); };
game.hitstop = function (t) { this._hitstop = Math.max(this._hitstop, t); };
game.delayed = function (t, fn) { this.timers.push({ t, fn }); };
game.mult = function () { return 1 + Math.min(this.combo, 50) * 0.06; };
game.toast = function (text, color) {
  this.toasts.push({ text, color: color || '#fff', t: 2.6 });
  if (this.toasts.length > 5) this.toasts.shift();
};
game.banner = function (text, sub, color) {
  this.bannerObj = { text, sub: sub || '', color: color || '#fff', t: 0, dur: 2.4 };
};
game.bossBanner = function (text) { this.banner(text, '', '#e8a0ff'); };
game.addScore = function (n, x, y, color) {
  const total = Math.round(n * this.mult());
  this.score += total;
  if (x !== undefined) this.dmgnums.push(new DamageNumber(x, y, '+' + U.fmt(total), color || '#a0ffe8', 10));
};
game.addDecal = function (x, y, r, color) {
  const c = this.decalCtx;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
game.playerHurt = function (dmg, sx, sy) { this.player.takeDamage(dmg, sx, sy); };
game.spawnZombie = function (type, x, y) {
  this.zombies.push(new Zombie(type, x, y, Math.max(1, this.wave)));
};

// ---------- world generation ----------
game.setupWorld = function () {
  const W = this.world;
  // ground
  const g = document.createElement('canvas');
  g.width = W.w; g.height = W.h;
  const gc = g.getContext('2d');
  gc.fillStyle = '#1b1626';
  gc.fillRect(0, 0, W.w, W.h);
  for (let i = 0; i < 60; i++) { // dark patches
    gc.fillStyle = 'rgba(10,8,18,' + U.rand(0.1, 0.3) + ')';
    gc.beginPath();
    gc.ellipse(U.rand(0, W.w), U.rand(0, W.h), U.rand(40, 160), U.rand(30, 100), U.rand(0, 3), 0, Math.PI * 2);
    gc.fill();
  }
  for (let i = 0; i < 4200; i++) { // speckles
    gc.fillStyle = U.chance(0.5) ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
    gc.fillRect(U.rand(0, W.w), U.rand(0, W.h), 2, 2);
  }
  for (let i = 0; i < 260; i++) { // dead grass tufts
    gc.fillStyle = U.pick(['#25301f', '#2c3823', '#1f2819']);
    const x = U.rand(0, W.w), y = U.rand(0, W.h);
    gc.fillRect(x, y, 2, 5); gc.fillRect(x + 3, y + 1, 2, 4); gc.fillRect(x - 3, y + 1, 2, 4);
  }
  this.ground = g;
  // decals (blood) canvas
  const d = document.createElement('canvas');
  d.width = W.w; d.height = W.h;
  this.decalCtx = d.getContext('2d');
  this.decalCanvas = d;
  // props: x/y = base-center (draw anchor); solid props also get a
  // collision rect in the same object (U.circleRect reads x/y/w/h,
  // so solids keep draw coords in dx/dy and rect coords in x/y/w/h)
  this.props = [];
  const cx = W.w / 2, cy = W.h / 2;
  const tooClose = (x, y, r) => {
    if (U.dist(x, y, cx, cy) < 180) return true;
    for (const p of this.props) if (U.dist(x, y, p.dx, p.dy) < r) return true;
    return false;
  };
  const place = (spr, solidW, solidH, tall) => {
    for (let tries = 0; tries < 30; tries++) {
      const bx = U.rand(60, W.w - 60), by = U.rand(80, W.h - 60);
      if (tooClose(bx, by, 90)) continue;
      const p = { spr, tall: !!tall, solid: solidW > 0, dx: bx, dy: by };
      if (p.solid) {
        p.x = bx - solidW / 2; p.y = by - solidH; p.w = solidW; p.h = solidH;
      }
      this.props.push(p);
      return true;
    }
    return false;
  };
  for (let i = 0; i < 13; i++) place(U.pick(['prop_grave_a', 'prop_grave_b', 'prop_grave_c']), 22, 14);
  for (let i = 0; i < 5; i++) place('prop_tree', 14, 12, true);
  for (let i = 0; i < 6; i++) place('prop_rock', 20, 12);
  for (let i = 0; i < 8; i++) place('prop_bones', 0, 0);
  // fog blobs
  this.fogs = [];
  for (let i = 0; i < 6; i++) {
    this.fogs.push({ x: U.rand(0, W.w), y: U.rand(0, W.h), vx: U.rand(-8, 8), vy: U.rand(-5, 5), s: U.rand(180, 340), a: U.rand(0.1, 0.22) });
  }
};

// ---------- run reset (quick restart) ----------
game.reset = function () {
  this.setupWorld();
  this.player = new Player(this.world.w / 2, this.world.h / 2);
  this.zombies.length = 0; this.bullets.length = 0; this.ebullets.length = 0;
  this.particles.length = 0; this.pickups.length = 0; this.dmgnums.length = 0;
  this.shockwaves.length = 0; this.telegraphs.length = 0; this.hands.length = 0;
  this.timers.length = 0; this.toasts.length = 0;
  this.boss = null;
  this.score = 0; this.combo = 0; this.comboT = 0;
  this.kills = 0; this.time = 0;
  this.wave = 0;
  this.slowmoT = 0; this.deathT = 0; this.overT = 0;
  this.hurtPulse = 0; this.newBest = false;
  this.flashT = 0; this.bannerObj = null;
  this.cam.trauma = 0;
  this.cam.x = this.player.x - 480; this.cam.y = this.player.y - 270;
  G.audio.setIntensity(0);
  this.startWave(1);
  this.state = 'play';
  this.paused = false;
};

// ---------- waves ----------
game.buildQueue = function (n) {
  let pts = 8 + n * 4 + Math.max(0, n - 8) * 3;
  const pool = [['shambler', 1, 10]];
  if (n >= 2) pool.push(['runner', 2, 6 + n]);
  if (n >= 3) pool.push(['spitter', 3, 3 + n]);
  if (n >= 4) pool.push(['brute', 4, 2 + (n >> 1)]);
  if (n >= 6) pool.push(['exploder', 2, 4 + n]);
  const q = [];
  let guard = 200;
  while (pts > 0 && guard-- > 0) {
    let totalW = 0;
    for (const p of pool) totalW += p[2];
    let r = Math.random() * totalW;
    let sel = pool[0];
    for (const p of pool) { r -= p[2]; if (r <= 0) { sel = p; break; } }
    if (sel[1] > pts && q.length > 0) { pts--; continue; }
    pts -= sel[1];
    q.push({ t: sel[0], c: false });
  }
  // one carrier per wave drops a supply crate
  if (q.length > 0) q[U.randi(0, q.length - 1)].c = true;
  return q;
};

game.spawnPos = function () {
  const pl = this.player, W = this.world;
  const graves = this.props.filter(p => p.spr.indexOf('grave') >= 0);
  for (let tries = 0; tries < 12; tries++) {
    let x, y;
    if (graves.length && U.chance(0.5)) {
      const g = U.pick(graves);
      x = g.dx + U.rand(-10, 10);
      y = g.dy + 20;
    } else {
      const side = U.randi(0, 3);
      if (side === 0) { x = U.rand(40, W.w - 40); y = 40; }
      else if (side === 1) { x = U.rand(40, W.w - 40); y = W.h - 40; }
      else if (side === 2) { x = 40; y = U.rand(40, W.h - 40); }
      else { x = W.w - 40; y = U.rand(40, W.h - 40); }
    }
    if (U.dist(x, y, pl.x, pl.y) > 240) return { x, y };
  }
  return { x: 60, y: 60 };
};

game.unlockWeapon = function (name) {
  if (this.player.giveWeapon(name)) {
    const slot = WEAPON_ORDER.indexOf(name) + 1;
    this.banner('NEW WEAPON', G.WEAPONS[name].name + '  —  PRESS ' + slot, '#ffd880');
    G.audio.play('newweapon');
  }
};

game.startWave = function (n) {
  this.wave = n;
  if (n === 2) this.unlockWeapon('shotgun');
  if (n === 3) this.unlockWeapon('smg');
  if (n === 4) this.unlockWeapon('rifle');
  if (n % 5 === 0) {
    // ---- boss wave ----
    this.waveState = 'boss';
    this.spawnQueue = [];
    const loop = Math.floor(n / 5);
    const W = this.world, pl = this.player;
    // spawn in the arena quadrant farthest from the player, but never so far
    // that the fight can't start quickly (480-560px away)
    let bx = pl.x < W.w / 2 ? W.w - 260 : 260;
    let by = pl.y < W.h / 2 ? W.h - 240 : 240;
    if (U.dist(bx, by, pl.x, pl.y) > 560) {
      const a = U.angle(pl.x, pl.y, bx, by);
      bx = U.clamp(pl.x + Math.cos(a) * 480, 200, W.w - 200);
      by = U.clamp(pl.y + Math.sin(a) * 480, 200, W.h - 200);
    }
    this.boss = new Boss(bx, by, loop);
    this.banner(this.boss.name, 'DESTROY THE TOMBSTONE', '#e8a0ff');
    this.shake(6);
  } else {
    this.waveState = 'fighting';
    this.spawnQueue = this.buildQueue(n);
    this.spawnT = 0.6;
    this.banner('WAVE ' + n, n === 1 ? 'SURVIVE THE NIGHT' : '', '#ffffff');
    G.audio.play('wave');
  }
};

game.waveClear = function () {
  const bonus = 150 * this.wave;
  this.addScore(bonus, this.player.x, this.player.y - 24, '#ffd880');
  this.toast('WAVE ' + this.wave + ' CLEAR', '#ffd880');
  G.audio.play('wave');
  this.waveState = 'breather';
  this.breatherT = 2.5;
};

// ---------- kills / pickups / upgrades ----------
game.onKill = function (z) {
  this.kills++;
  this.player.killCount++;
  this.combo++;
  this.comboT = 2.6;
  if (this.combo % 10 === 0) this.toast('COMBO x' + this.combo + '!', '#a0ffe8');
  this.addScore(z.score, z.x, z.y, '#a0ffe8');
  this.hitstop(z.type === 'brute' ? 0.07 : 0.025);
  const up = this.player.up;
  if (up.lifesteal > 0 && this.player.killCount % 8 === 0) this.player.heal(2 * up.lifesteal);
  if (up.explode > 0 && z.type !== 'exploder' && U.chance(0.1 * up.explode)) z.explode(false);
  // drops
  if (z.carrier) this.pickups.push(new Pickup(z.x, z.y, 'crate'));
  else {
    const r = Math.random();
    if (r < 0.11) this.pickups.push(new Pickup(z.x, z.y, 'ammo'));
    else if (r < 0.18) this.pickups.push(new Pickup(z.x, z.y, 'hp'));
    else if (r < 0.24) this.pickups.push(new Pickup(z.x, z.y, 'gem'));
    if (z.type === 'brute' && U.chance(0.25)) this.pickups.push(new Pickup(z.x, z.y, 'crate'));
  }
};

game.applyPickup = function (kind, x, y) {
  const pl = this.player;
  if (kind === 'ammo') {
    let any = false, parts = [];
    for (const w of WEAPON_ORDER) {
      const def = G.WEAPONS[w];
      if (!def.ammoMax || pl.weapons.indexOf(w) < 0) continue;
      const gain = Math.ceil(def.ammoMax * 0.4 * pl.ammoBonus());
      pl.ammo[w] = Math.min(def.ammoMax, pl.ammo[w] + gain);
      parts.push(def.name + ' +' + gain);
      any = true;
    }
    if (any) { this.toast(parts.join('  '), '#ffe8a0'); G.audio.play('pickup'); }
    else { this.addScore(100, x, y, '#ffe8a0'); G.audio.play('gem'); }
  } else if (kind === 'hp') {
    if (pl.hp >= pl.maxHp()) this.addScore(100, x, y, '#ff9a9a');
    else { pl.heal(30); this.toast('+30 HP', '#ff9a9a'); }
    G.audio.play('pickup');
  } else if (kind === 'gem') {
    this.addScore(250, x, y, '#8fe8ff');
    G.audio.play('gem');
  } else if (kind === 'crate') {
    this.openUpgrades();
  }
};

game.openUpgrades = function () {
  const pl = this.player;
  const avail = G.UPGRADES.filter(u => pl.up[u.id] < u.max);
  this.choices = [];
  const pool = avail.slice();
  while (this.choices.length < 3 && pool.length > 0) {
    const i = U.randi(0, pool.length - 1);
    this.choices.push(pool.splice(i, 1)[0]);
  }
  if (this.choices.length === 0) {
    this.addScore(500, pl.x, pl.y, '#e8a0ff');
    this.toast('MAXED OUT — +500', '#e8a0ff');
    return;
  }
  this.state = 'upgrade';
  G.audio.play('upgrade');
};

game.applyUpgrade = function (u) {
  const pl = this.player;
  pl.up[u.id]++;
  if (u.id === 'maxhp') pl.heal(25);
  this.toast(u.name + '  LV' + pl.up[u.id], u.color);
  G.audio.play('upgrade');
  this.state = 'play';
};

// ---------- boss death / player death ----------
game.onBossDeath = function (boss) {
  this.addScore(4000 * boss.loop, boss.x, boss.y - 40, '#e8a0ff');
  this.slowmoT = 1.0;
  this.shake(14);
  this.hitstop(0.2);
  this.flashT = 0.7;
  G.audio.play('explode');
  G.audio.play('boss_roar');
  G.audio.setIntensity(0);
  G.fx.explosion(boss.x, boss.y, 120);
  G.fx.souls(boss.x, boss.y - 30, 30);
  // loot shower
  this.pickups.push(new Pickup(boss.x - 40, boss.y, 'crate'));
  this.pickups.push(new Pickup(boss.x + 40, boss.y, 'crate'));
  this.pickups.push(new Pickup(boss.x, boss.y - 40, 'hp'));
  this.pickups.push(new Pickup(boss.x, boss.y + 40, 'ammo'));
  this.banner('WARDEN DESTROYED', '+' + U.fmt(4000 * boss.loop * this.mult()), '#e8a0ff');
  this.boss = null;
};

game.onPlayerDeath = function () {
  this.slowmoT = 0.9;
  this.deathT = 1.2;
  this.shake(12);
  G.fx.gibs(this.player.x, this.player.y, 20);
  G.audio.play('explode');
  G.audio.setIntensity(0);
};

game.gameOver = function () {
  this.state = 'over';
  this.overT = 0;
  if (this.score > G.save.data.high) {
    G.save.data.high = this.score;
    G.save.write();
    this.newBest = true;
  }
  G.audio.play('gameover');
};

// ============================================================
// UPDATE
// ============================================================
game.update = function (dt) {
  const I = G.input;
  // global keys
  if (I.pressed.KeyM) {
    const m = G.audio.toggleMute();
    this.toast(m ? 'SOUND OFF' : 'SOUND ON', '#c0c0c0');
  }
  if (I.pressed.KeyR && (this.state === 'play' || this.state === 'over' || this.state === 'upgrade')) {
    this.reset();
    return;
  }
  if ((I.pressed.KeyP || I.pressed.Escape) && this.state === 'play') {
    this.paused = !this.paused;
    G.audio.play('ui');
  }

  if (this.state === 'title') {
    if (I.anyKey || I.mpressed) { this.reset(); }
    return;
  }
  if (this.state === 'over') {
    this.overT += dt;
    if (this.overT > 0.6 && (I.pressed.KeyR || I.mpressed || I.pressed.Space || I.pressed.Enter)) this.reset();
    return;
  }
  if (this.state === 'upgrade') {
    for (let i = 0; i < this.choices.length; i++) {
      if (I.pressed['Digit' + (i + 1)] || I.pressed['Numpad' + (i + 1)]) { this.applyUpgrade(this.choices[i]); return; }
    }
    if (I.mpressed) {
      for (let i = 0; i < this.cardRects.length; i++) {
        if (U.pointInRect(I.mx, I.my, this.cardRects[i])) { this.applyUpgrade(this.choices[i]); return; }
      }
    }
    return;
  }
  if (this.paused) return;

  // ---- play ----
  this.time += dt;
  // weapon switching
  if (I.pressed.Digit1) this.player.selectWeapon('pistol');
  if (I.pressed.Digit2) this.player.selectWeapon('shotgun');
  if (I.pressed.Digit3) this.player.selectWeapon('smg');
  if (I.pressed.Digit4) this.player.selectWeapon('rifle');
  if (I.pressed.KeyQ) this.player.cycleWeapon(1);
  if (I.wheel !== 0) this.player.cycleWeapon(I.wheel > 0 ? 1 : -1);

  this.player.update(dt);

  // death sequence
  if (this.player.dead) {
    this.deathT -= dt;
    if (this.deathT <= 0) { this.gameOver(); return; }
  }

  // zombies
  for (let i = this.zombies.length - 1; i >= 0; i--) {
    const z = this.zombies[i];
    z.update(dt);
    if (z.dead) this.zombies.splice(i, 1);
  }
  // boss
  if (this.boss) {
    this.boss.update(dt);
    if (this.boss.dead) this.boss = null;
  }
  // player bullets
  for (let i = this.bullets.length - 1; i >= 0; i--) {
    const b = this.bullets[i];
    b.update(dt);
    if (!b.dead) {
      for (const z of this.zombies) {
        if (z.dead) continue;
        if (b.hitSet && b.hitSet.has(z)) continue;
        if (U.segCircle(b.px, b.py, b.x, b.y, z.x, z.y, z.r + b.r + 2)) {
          z.takeDamage(b.dmg, Math.atan2(b.vy, b.vx), b.knock);
          if (b.pierce > 0) {
            b.pierce--;
            if (!b.hitSet) b.hitSet = new Set();
            b.hitSet.add(z);
          } else b.dead = true;
          break;
        }
      }
      if (!b.dead && this.boss && !this.boss.dead) {
        if (U.segCircle(b.px, b.py, b.x, b.y, this.boss.x, this.boss.y - 8, this.boss.r + b.r + 2)) {
          this.boss.takeDamage(b.dmg, Math.atan2(b.vy, b.vx));
          b.dead = true;
        }
      }
    }
    if (b.dead) this.bullets.splice(i, 1);
  }
  // enemy bullets
  for (let i = this.ebullets.length - 1; i >= 0; i--) {
    const b = this.ebullets[i];
    b.update(dt);
    if (!b.dead && !this.player.dead && U.segCircle(b.px, b.py, b.x, b.y, this.player.x, this.player.y, this.player.r + b.r)) {
      this.player.takeDamage(b.dmg, b.x, b.y);
      b.dead = true;
    }
    if (b.dead) this.ebullets.splice(i, 1);
  }
  // hazards & misc entities
  this.updateList(this.shockwaves, dt);
  this.updateList(this.telegraphs, dt);
  this.updateList(this.hands, dt);
  this.updateList(this.particles, dt);
  this.updateList(this.dmgnums, dt);
  this.updateList(this.pickups, dt);
  if (this.particles.length > 450) this.particles.splice(0, this.particles.length - 450);
  // timers
  for (let i = this.timers.length - 1; i >= 0; i--) {
    const t = this.timers[i];
    t.t -= dt;
    if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
  }
  // combo decay
  if (this.comboT > 0) {
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
  }
  // wave logic
  if (this.waveState === 'fighting') {
    if (this.spawnQueue.length > 0 && this.zombies.length < 30) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = U.rand(0.4, 0.9);
        const batch = Math.min(this.spawnQueue.length, U.randi(2, 4));
        for (let k = 0; k < batch; k++) {
          const e = this.spawnQueue.shift();
          const pos = this.spawnPos();
          const z = new Zombie(e.t, pos.x, pos.y, this.wave);
          if (e.c) z.carrier = true;
          this.zombies.push(z);
        }
      }
    }
    if (this.spawnQueue.length === 0 && this.zombies.length === 0) this.waveClear();
  } else if (this.waveState === 'boss') {
    if (!this.boss && this.zombies.length === 0) this.waveClear();
  } else if (this.waveState === 'breather') {
    this.breatherT -= dt;
    if (this.breatherT <= 0) this.startWave(this.wave + 1);
  }
  // camera
  const pl = this.player;
  const tx = U.clamp(pl.x + Math.cos(pl.aim) * 36 - 480, 0, this.world.w - 960);
  const ty = U.clamp(pl.y + Math.sin(pl.aim) * 36 - 270, 0, this.world.h - 540);
  this.cam.x = U.lerp(this.cam.x, tx, 1 - Math.pow(0.001, dt));
  this.cam.y = U.lerp(this.cam.y, ty, 1 - Math.pow(0.001, dt));
  this.cam.trauma = Math.max(0, this.cam.trauma - dt * 1.8);
  // fx timers
  this.hurtPulse = Math.max(0, this.hurtPulse - dt);
  this.flashT = Math.max(0, this.flashT - dt * 2.6);
  if (this.muzzleFlash) {
    this.muzzleFlash.t -= dt;
    if (this.muzzleFlash.t <= 0) this.muzzleFlash = null;
  }
  if (this.bannerObj) {
    this.bannerObj.t += dt;
    if (this.bannerObj.t > this.bannerObj.dur) this.bannerObj = null;
  }
  for (let i = this.toasts.length - 1; i >= 0; i--) {
    this.toasts[i].t -= dt;
    if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
  }
  // fog drift
  for (const f of this.fogs) {
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < -f.s) f.x = this.world.w + f.s;
    if (f.x > this.world.w + f.s) f.x = -f.s;
    if (f.y < -f.s) f.y = this.world.h + f.s;
    if (f.y > this.world.h + f.s) f.y = -f.s;
  }
};

game.updateList = function (list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].update(dt);
    if (list[i].dead) list.splice(i, 1);
  }
};

// ============================================================
// RENDER
// ============================================================
let canvas, ctx, vignette;

function text(str, x, y, size, color, align, glow) {
  ctx.font = 'bold ' + size + 'px "Courier New", monospace';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = '#000';
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

game.render = function () {
  ctx.fillStyle = '#0a0810';
  ctx.fillRect(0, 0, 960, 540);
  const cam = this.cam;
  const shx = cam.trauma * cam.trauma * 20 * (Math.random() * 2 - 1);
  const shy = cam.trauma * cam.trauma * 20 * (Math.random() * 2 - 1);
  const camX = Math.round(cam.x + shx), camY = Math.round(cam.y + shy);

  ctx.save();
  ctx.translate(-camX, -camY);
  // ground + decals
  ctx.drawImage(this.ground, 0, 0);
  ctx.drawImage(this.decalCanvas, 0, 0);
  // fog (under entities)
  for (const f of this.fogs) {
    ctx.globalAlpha = f.a;
    ctx.drawImage(G.SPR.fog, f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
  }
  ctx.globalAlpha = 1;
  // low props
  for (const p of this.props) {
    if (p.tall) continue;
    const s = G.SPR[p.spr];
    ctx.drawImage(s, p.dx - s.width / 2, p.dy - s.height);
  }
  // telegraphs under everything mobile
  for (const t of this.telegraphs) t.draw(ctx);
  for (const p of this.pickups) p.draw(ctx);
  for (const z of this.zombies) z.draw(ctx);
  if (this.boss) this.boss.draw(ctx);
  if (!this.player || !this.player.dead) { if (this.player) this.player.draw(ctx); }
  for (const h of this.hands) h.draw(ctx);
  for (const b of this.bullets) b.draw(ctx);
  for (const b of this.ebullets) b.draw(ctx);
  for (const s of this.shockwaves) s.draw(ctx);
  for (const p of this.particles) p.draw(ctx);
  // tall props (canopy over entities)
  for (const p of this.props) {
    if (!p.tall) continue;
    const s = G.SPR[p.spr];
    ctx.drawImage(s, p.dx - s.width / 2, p.dy - s.height);
  }
  // muzzle light
  if (this.muzzleFlash) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.muzzleFlash.t / 0.05;
    ctx.drawImage(G.SPR.glow_white, this.muzzleFlash.x - 40, this.muzzleFlash.y - 40, 80, 80);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const d of this.dmgnums) d.draw(ctx);
  ctx.restore();

  // vignette + hurt
  ctx.drawImage(vignette, 0, 0);
  if (this.flashT > 0) {
    ctx.fillStyle = 'rgba(225,225,255,' + (this.flashT * 0.55) + ')';
    ctx.fillRect(0, 0, 960, 540);
  }
  if (this.hurtPulse > 0) {
    ctx.fillStyle = 'rgba(200,30,30,' + (this.hurtPulse * 0.35) + ')';
    ctx.fillRect(0, 0, 960, 540);
  }
  if (this.player && this.player.hp < this.player.maxHp() * 0.3 && !this.player.dead && this.state === 'play') {
    ctx.fillStyle = 'rgba(180,20,20,' + (0.08 + 0.06 * Math.sin(this.time0 * 6)) + ')';
    ctx.fillRect(0, 0, 960, 540);
  }

  // state-specific screens
  if (this.state === 'title') this.renderTitle();
  else if (this.state === 'over') this.renderOver();
  else {
    this.renderHUD();
    if (this.state === 'upgrade') this.renderUpgrade();
    if (this.paused) this.renderPaused();
  }
  // crosshair / pointer (visible in every screen so menus are clickable)
  {
    const I = G.input;
    ctx.strokeStyle = '#ff6050';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(I.mx, I.my, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff6050';
    ctx.fillRect(I.mx - 1, I.my - 1, 2, 2);
  }
};

// ---------- HUD ----------
game.renderHUD = function () {
  const pl = this.player;
  // HP bar
  const hpFrac = pl.hp / pl.maxHp();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 14, 224, 20);
  ctx.fillStyle = hpFrac > 0.3 ? '#c03838' : '#ff5040';
  ctx.fillRect(16, 16, 220 * Math.max(0, hpFrac), 16);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(14, 14, 224, 20);
  text(Math.ceil(pl.hp) + ' / ' + pl.maxHp(), 126, 30, 12, '#fff', 'center');
  // dash cooldown
  const dc = U.clamp(1 - pl.dashCd / pl.dashCdMax(), 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 38, 100, 8);
  ctx.fillStyle = dc >= 1 ? '#8fe8ff' : '#3fa8c8';
  ctx.fillRect(15, 39, 98 * dc, 6);
  text('DASH', 120, 46, 10, dc >= 1 ? '#8fe8ff' : '#6a8a9a');
  // weapon slots
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    const w = WEAPON_ORDER[i];
    const owned = pl.weapons.indexOf(w) >= 0;
    const x = 14 + i * 58, y = 52;
    ctx.fillStyle = pl.cur === w ? 'rgba(255,216,128,0.25)' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, 52, 40);
    ctx.strokeStyle = pl.cur === w ? '#ffd880' : '#444';
    ctx.strokeRect(x + 0.5, y + 0.5, 51, 39);
    text(String(i + 1), x + 4, y + 12, 10, owned ? '#fff' : '#555');
    if (owned) {
      const g = G.SPR['gun_' + w];
      ctx.drawImage(g, x + 26 - g.width / 2, y + 18 - g.height / 2);
      const ammoTxt = G.WEAPONS[w].ammoMax ? String(pl.ammo[w]) : '∞';
      text(ammoTxt, x + 26, y + 36, 10, pl.cur === w ? '#ffd880' : '#aaa', 'center');
    } else {
      text('?', x + 26, y + 24, 14, '#555', 'center');
      text('--', x + 26, y + 36, 10, '#555', 'center');
    }
  }
  // score
  text(U.fmt(this.score), 946, 32, 22, '#fff', 'right');
  text('BEST ' + U.fmt(Math.max(G.save.data.high, this.score)), 946, 50, 11, '#8a8a9a', 'right');
  if (this.mult() > 1) text('x' + this.mult().toFixed(1), 946, 68, 14, '#a0ffe8', 'right', '#a0ffe8');
  text('M: SOUND', 946, 528, 9, '#555', 'right');
  // wave / boss
  if (this.boss) {
    const b = this.boss;
    text(b.name, 480, 26, 14, '#e8a0ff', 'center', '#8030c0');
    const bw = 420, bx = 480 - bw / 2, by = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    const frac = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = b.phase === 3 ? '#e84a5a' : b.phase === 2 ? '#e89a4a' : '#a06ae8';
    ctx.fillRect(bx, by, bw * frac, 10);
    // phase ticks
    ctx.fillStyle = '#000';
    ctx.fillRect(bx + bw * 0.33 - 1, by, 2, 10);
    ctx.fillRect(bx + bw * 0.66 - 1, by, 2, 10);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(bx - 2, by - 2, bw + 4, 14);
    // off-screen boss arrow
    const bsx = b.x - this.cam.x, bsy = b.y - 8 - this.cam.y;
    if (bsx < 30 || bsx > 930 || bsy < 70 || bsy > 500) {
      const ang = Math.atan2(bsy - 270, bsx - 480);
      const ax = U.clamp(bsx, 60, 900), ay = U.clamp(bsy, 100, 470);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#e8a0ff';
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else {
    text('WAVE ' + this.wave, 480, 30, 16, '#fff', 'center');
    if (this.waveState === 'breather') text('NEXT WAVE IN ' + Math.ceil(this.breatherT), 480, 48, 11, '#8fe8ff', 'center');
    else if (this.waveState === 'fighting') {
      const left = this.zombies.length + this.spawnQueue.length;
      text(left + ' LEFT', 480, 48, 10, '#8a8a9a', 'center');
    }
  }
  // combo meter
  if (this.combo >= 3) {
    const a = U.clamp(this.comboT / 2.6, 0, 1);
    text('COMBO ' + this.combo, 480, 500, 16, '#a0ffe8', 'center', '#30c0a0');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(400, 508, 160, 6);
    ctx.fillStyle = '#a0ffe8';
    ctx.fillRect(401, 509, 158 * a, 4);
  }
  // toasts
  for (let i = 0; i < this.toasts.length; i++) {
    const t = this.toasts[i];
    ctx.globalAlpha = Math.min(1, t.t);
    text(t.text, 16, 500 - (this.toasts.length - 1 - i) * 16, 11, t.color);
    ctx.globalAlpha = 1;
  }
  // banner
  if (this.bannerObj) {
    const b = this.bannerObj;
    const p = b.t / b.dur;
    const a = p < 0.15 ? p / 0.15 : p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
    ctx.globalAlpha = a;
    text(b.text, 480, 200, 34, b.color, 'center', b.color);
    if (b.sub) text(b.sub, 480, 226, 14, '#fff', 'center');
    ctx.globalAlpha = 1;
  }
};

game.renderTitle = function () {
  ctx.fillStyle = 'rgba(6,4,12,0.55)';
  ctx.fillRect(0, 0, 960, 540);
  text('GRAVE DANGER', 480, 150, 52, '#e84a5a', 'center', '#c02040');
  text('PIXEL ZOMBIE ARCADE', 480, 182, 14, '#a08ac0', 'center');
  const blink = (this.time0 * 2 | 0) % 2 === 0;
  if (blink) text('PRESS ANY KEY / CLICK TO START', 480, 250, 16, '#fff', 'center', '#fff');
  text('WASD MOVE   MOUSE AIM   CLICK SHOOT   SPACE DASH', 480, 330, 12, '#8a8a9a', 'center');
  text('1-4 / Q / WHEEL: WEAPONS   R: QUICK RESTART   P: PAUSE', 480, 350, 12, '#8a8a9a', 'center');
  text('SURVIVE THE WAVES. EVERY 5TH WAVE, THE WARDEN RISES.', 480, 390, 12, '#c0a060', 'center');
  if (G.save.data.high > 0) text('HIGH SCORE  ' + U.fmt(G.save.data.high), 480, 440, 16, '#ffd880', 'center', '#c09020');
};

game.renderOver = function () {
  ctx.fillStyle = 'rgba(10,4,8,0.72)';
  ctx.fillRect(0, 0, 960, 540);
  text('YOU DIED', 480, 180, 48, '#e84a5a', 'center', '#a01030');
  if (this.newBest) text('★ NEW BEST! ★', 480, 226, 18, '#ffd880', 'center', '#c09020');
  text('SCORE  ' + U.fmt(this.score), 480, 270, 22, '#fff', 'center');
  text('BEST   ' + U.fmt(G.save.data.high), 480, 298, 14, '#8a8a9a', 'center');
  text('WAVE ' + this.wave + '   KILLS ' + this.kills + '   TIME ' + Math.floor(this.time / 60) + ':' + String(Math.floor(this.time % 60)).padStart(2, '0'), 480, 330, 13, '#a08ac0', 'center');
  if (this.overT > 0.6) {
    const blink = (this.time0 * 2 | 0) % 2 === 0;
    if (blink) text('PRESS R TO RISE AGAIN', 480, 400, 16, '#fff', 'center', '#fff');
  }
};

game.renderUpgrade = function () {
  ctx.fillStyle = 'rgba(6,4,14,0.7)';
  ctx.fillRect(0, 0, 960, 540);
  text('SUPPLY CRATE', 480, 120, 28, '#e8a0ff', 'center', '#8030c0');
  text('CHOOSE AN UPGRADE  [1/2/3] OR CLICK', 480, 148, 12, '#a08ac0', 'center');
  const n = this.choices.length;
  const cw = 210, ch = 150, gap = 30;
  const totalW = n * cw + (n - 1) * gap;
  const x0 = 480 - totalW / 2, y0 = 200;
  this.cardRects = [];
  const I = G.input;
  for (let i = 0; i < n; i++) {
    const u = this.choices[i];
    const x = x0 + i * (cw + gap), y = y0;
    const hover = U.pointInRect(I.mx, I.my, { x, y, w: cw, h: ch });
    this.cardRects.push({ x, y, w: cw, h: ch });
    ctx.fillStyle = hover ? 'rgba(60,40,90,0.9)' : 'rgba(20,14,34,0.9)';
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = u.color;
    ctx.lineWidth = hover ? 3 : 1.5;
    ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
    ctx.lineWidth = 1;
    text('[' + (i + 1) + ']', x + 12, y + 26, 14, u.color);
    text(u.name, x + cw / 2, y + 56, 14, u.color, 'center', u.color);
    text(u.desc, x + cw / 2, y + 84, 11, '#fff', 'center');
    const lv = this.player.up[u.id];
    let pips = '';
    for (let k = 0; k < u.max; k++) pips += k < lv ? '■' : '□';
    text(pips, x + cw / 2, y + 116, 12, u.color, 'center');
    text('LV ' + lv + ' → ' + (lv + 1), x + cw / 2, y + 136, 10, '#8a8a9a', 'center');
  }
};

game.renderPaused = function () {
  ctx.fillStyle = 'rgba(6,4,12,0.6)';
  ctx.fillRect(0, 0, 960, 540);
  text('PAUSED', 480, 240, 36, '#fff', 'center');
  text('P: RESUME   R: RESTART   M: SOUND', 480, 280, 13, '#8a8a9a', 'center');
};

// ============================================================
// MAIN LOOP
// ============================================================
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  let dt = Math.min((t - lastT) / 1000 || 0.016, 1 / 20);
  lastT = t;
  game.time0 += dt;
  // hitstop freezes the world for a few frames (game feel).
  // NOTE: edge-triggered input is NOT cleared here, so key taps
  // (dash / pause / weapon swap) made during hitstop still register.
  if (game._hitstop > 0) {
    game._hitstop -= dt;
    game.render();
    return;
  }
  // slow motion
  if (game.slowmoT > 0) {
    game.slowmoT -= dt;
    dt *= 0.3;
  }
  game.update(dt);
  game.render();
  G.endFrameInput();
}

G.boot = function () {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  G.buildSprites();
  // white flash variants
  G.SPRW = {};
  for (const k in G.SPR) {
    if (k === 'boss') {
      G.SPRW.boss = { p1: G.whiteOf(G.SPR.boss.p1), p2: G.whiteOf(G.SPR.boss.p2), p3: G.whiteOf(G.SPR.boss.p3) };
    } else if (k.indexOf('z_') === 0 || k === 'player') {
      G.SPRW[k] = G.whiteOf(G.SPR[k]);
    }
  }
  G.save.load();
  G.initInput(canvas);
  // vignette
  vignette = document.createElement('canvas');
  vignette.width = 960; vignette.height = 540;
  const vx = vignette.getContext('2d');
  const grad = vx.createRadialGradient(480, 270, 180, 480, 270, 560);
  grad.addColorStop(0, 'rgba(8,6,14,0)');
  grad.addColorStop(1, 'rgba(8,6,14,0.6)');
  vx.fillStyle = grad;
  vx.fillRect(0, 0, 960, 540);
  // canvas scaling
  const resize = () => {
    const s = Math.min(window.innerWidth / 960, window.innerHeight / 540);
    canvas.style.width = Math.floor(960 * s) + 'px';
    canvas.style.height = Math.floor(540 * s) + 'px';
  };
  window.addEventListener('resize', resize);
  resize();
  // ambient audio starts on first unlock
  const amb = () => { G.audio.startAmbience(); };
  window.addEventListener('keydown', amb, { once: true });
  canvas.addEventListener('mousedown', amb, { once: true });
  // idle world behind the title screen
  game.setupWorld();
  game.player = new Player(game.world.w / 2, game.world.h / 2);
  game.cam.x = game.world.w / 2 - 480;
  game.cam.y = game.world.h / 2 - 270;
  requestAnimationFrame(frame);
};
G.boot();
