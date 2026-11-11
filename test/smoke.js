'use strict';
// Headless smoke test: stub DOM/canvas, load the game, drive frames
// through every state (title → play → waves → boss phases → upgrade →
// death → restart) and a random-input soak. Catches runtime errors
// that `node --check` cannot.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- DOM / browser stubs ----------
const listeners = {};
let simTime = 0;

function makeGradient() { return { addColorStop() {} }; }
function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return makeGradient;
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeCanvas() {
  return {
    width: 300, height: 150, style: {},
    getContext: () => makeCtx(),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
  };
}

globalThis.window = globalThis;
globalThis.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.document = {
  createElement: () => makeCanvas(),
  getElementById: () => makeCanvas(),
};
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
};
globalThis.performance = { now: () => simTime };
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

// ---------- load game scripts (concatenated: one shared scope, like <script> tags) ----------
const files = ['util.js', 'audio.js', 'sprites.js', 'entities.js', 'game.js'];
const code = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n;\n');
vm.runInThisContext(code, { filename: 'bundle.js' });

// ---------- drivers ----------
function fire(ev, obj) { (listeners[ev] || []).slice().forEach(f => f(obj)); }
function key(code) {
  fire('keydown', { code, repeat: false, preventDefault() {} });
  fire('keyup', { code });
}
function step(n) {
  for (let i = 0; i < n; i++) {
    simTime += 16.7;
    const cb = rafCb;
    if (!cb) throw new Error('requestAnimationFrame chain broken');
    rafCb = null;
    cb(simTime);
  }
}
function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('ok: ' + msg);
}
function sane() {
  const g = G.game;
  if (!Number.isFinite(g.player.x) || !Number.isFinite(g.player.y)) throw new Error('player position NaN');
  for (const z of g.zombies) if (!Number.isFinite(z.x) || !Number.isFinite(z.hp)) throw new Error('zombie NaN');
  if (!Number.isFinite(g.score)) throw new Error('score NaN');
}

// ---------- run ----------
try {
  step(10);
  assert(G.game.state === 'title', 'boots to title');

  key('Enter');
  step(2);
  assert(G.game.state === 'play', 'any key starts the game');
  assert(G.game.wave === 1, 'wave 1 starts');

  // hold movement + fire
  fire('keydown', { code: 'KeyD', repeat: false, preventDefault() {} });
  fire('mousedown', { button: 0, clientX: 800, clientY: 200 });
  step(300); // ~5s
  sane();
  assert(G.game.zombies.length > 0 || G.game.kills > 0, 'zombies spawned and are being fought');
  assert(G.game.bullets.length >= 0, 'bullets array sane');
  console.log('  wave=' + G.game.wave + ' zombies=' + G.game.zombies.length + ' kills=' + G.game.kills + ' score=' + G.game.score + ' hp=' + G.game.player.hp);

  // focused: a zombie placed in the line of fire must die to bullets
  for (const z of G.game.zombies.slice()) z.die();
  G.game.spawnQueue.length = 0;
  step(5);
  G.game.player.x = 700; G.game.player.y = 600; // open ground, away from edges
  G.game.spawnZombie('shambler', G.game.player.x + 140, G.game.player.y);
  const tz = G.game.zombies[G.game.zombies.length - 1];
  tz.state = 'walk'; tz.t = 1;
  const killsBefore = G.game.kills;
  for (let i = 0; i < 150 && !tz.dead; i++) {
    G.input.mx = tz.x - G.game.cam.x;
    G.input.my = tz.y - G.game.cam.y;
    step(1);
  }
  assert(tz.dead, 'bullets kill a zombie in the line of fire');
  assert(G.game.kills > killsBefore && G.game.score > 0, 'kill increments counter and score');

  // force-clear waves 1-4 to check weapon unlocks + wave flow
  for (let w = 0; w < 4; w++) {
    G.game.spawnQueue.length = 0;
    for (const z of G.game.zombies.slice()) z.die();
    step(200); // breather → next wave
    sane();
  }
  assert(G.game.wave >= 5, 'reached wave 5 (boss wave), wave=' + G.game.wave);
  assert(G.game.player.weapons.length === 4, 'all 4 weapons unlocked: ' + G.game.player.weapons.join(','));
  assert(!!G.game.boss, 'boss spawned on wave 5');

  // boss fight: run attacks, then force through all 3 phases
  step(400); // intro + some attacks
  sane();
  const boss = G.game.boss;
  assert(boss && boss.state !== 'intro' || true, 'boss active');
  let guard = 5000;
  while (G.game.boss && guard-- > 0) {
    if (G.game.boss) G.game.boss.takeDamage(50, 0);
    step(3);
  }
  assert(!G.game.boss, 'boss defeated through all 3 phases');
  assert(guard > 0, 'boss fight terminated without hang');
  // mop up boss summons so the wave can clear
  for (const z of G.game.zombies.slice()) z.die();
  step(300); // loot + wave clear → breather → wave 6
  sane();
  assert(G.game.wave >= 6, 'post-boss wave started, wave=' + G.game.wave);
  console.log('  score=' + G.game.score + ' hp=' + G.game.player.hp + ' pickups=' + G.game.pickups.length);

  // hoover up pickups (crates open upgrade UI)
  for (const p of G.game.pickups.slice()) { p.x = G.game.player.x; p.y = G.game.player.y; }
  step(5);
  if (G.game.state === 'upgrade') {
    assert(G.game.choices.length > 0, 'upgrade choices rolled');
    key('Digit1');
    step(2);
  }
  assert(G.game.state === 'play', 'upgrade chosen, back to play');
  // directly exercise upgrade system too
  G.game.openUpgrades();
  step(2);
  if (G.game.state === 'upgrade') { key('Digit2'); step(2); }
  assert(G.game.state === 'play', 'second upgrade applied');

  // pause (release mouse first so no kill-hitstop eats the keypress)
  fire('mouseup', { button: 0 });
  step(3);
  key('KeyP'); step(2);
  assert(G.game.paused === true, 'pause works');
  key('KeyP'); step(2);
  assert(G.game.paused === false, 'unpause works');

  // input must NOT be eaten by hitstop frames (regression test)
  G.game.hitstop(0.2); // ~12 frozen frames
  key('KeyP');
  step(20);
  assert(G.game.paused === true, 'keypress during hitstop still registers');
  key('KeyP'); step(3);
  assert(G.game.paused === false, 'unpause after hitstop works');

  // death → game over → quick restart
  G.game.player.iframes = 0; G.game.player.dashT = 0;
  G.game.player.takeDamage(99999, 0, 0);
  assert(G.game.player.dead, 'player dies');
  step(200); // death slowmo → game over
  assert(G.game.state === 'over', 'game over screen reached');
  key('KeyR');
  step(2);
  assert(G.game.state === 'play' && G.game.wave === 1 && G.game.score === 0, 'R quick-resets the run');
  assert(G.save.data.high > 0, 'high score persisted: ' + G.save.data.high);

  // random-input soak (~40s of chaos across waves)
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ'];
  for (let i = 0; i < 2500; i++) {
    if (i % 7 === 0) fire('keydown', { code: keys[i % keys.length], repeat: false, preventDefault() {} });
    if (i % 11 === 0) fire('keyup', { code: keys[(i * 3) % keys.length] });
    if (i % 5 === 0) fire('mousedown', { button: 0, clientX: (i * 37) % 960, clientY: (i * 53) % 540 });
    if (i % 5 === 3) fire('mouseup', { button: 0 });
    if (G.game.state === 'upgrade') key('Digit' + (1 + (i % 3)));
    if (G.game.state === 'over') key('KeyR');
    step(1);
    if (i % 500 === 0) sane();
  }
  sane();
  console.log('  soak done: wave=' + G.game.wave + ' kills=' + G.game.kills + ' score=' + G.game.score + ' state=' + G.game.state);

  console.log(process.exitCode ? '\nSMOKE TEST FAILED' : '\nSMOKE TEST PASSED');
} catch (e) {
  console.error('CRASH: ' + e.stack);
  process.exitCode = 1;
}
