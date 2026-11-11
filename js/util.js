'use strict';
// ============================================================
// util.js — math helpers, input, persistence
// ============================================================
window.G = window.G || {};

const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[(Math.random() * arr.length) | 0]; },
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
  angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },
  angleLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  circleHit(ax, ay, ar, bx, by, br) {
    const dx = bx - ax, dy = by - ay, r = ar + br;
    return dx * dx + dy * dy < r * r;
  },
  // does segment (x1,y1)-(x2,y2) pass within r of (cx,cy)? (swept bullet hit)
  segCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x1 + t * dx, py = y1 + t * dy;
    const ddx = cx - px, ddy = cy - py;
    return ddx * ddx + ddy * ddy <= r * r;
  },
  // push circle {x,y,r} out of rect {x,y,w,h}; returns true if it collided
  circleRect(c, rc) {
    const nx = U.clamp(c.x, rc.x, rc.x + rc.w);
    const ny = U.clamp(c.y, rc.y, rc.y + rc.h);
    const dx = c.x - nx, dy = c.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= c.r * c.r) return false;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      c.x = nx + (dx / d) * c.r;
      c.y = ny + (dy / d) * c.r;
    } else {
      const l = c.x - rc.x, r2 = rc.x + rc.w - c.x;
      const t = c.y - rc.y, b = rc.y + rc.h - c.y;
      const m = Math.min(l, r2, t, b);
      if (m === l) c.x = rc.x - c.r;
      else if (m === r2) c.x = rc.x + rc.w + c.r;
      else if (m === t) c.y = rc.y - c.r;
      else c.y = rc.y + rc.h + c.r;
    }
    return true;
  },
  pointInRect(px, py, rc) { return px >= rc.x && px <= rc.x + rc.w && py >= rc.y && py <= rc.y + rc.h; },
  fmt(n) { return Math.round(n).toLocaleString('en-US'); },
  easeOut(t) { return 1 - (1 - t) * (1 - t); },
  easeIn(t) { return t * t; },
};
G.U = U;

// ---------- input ----------
G.input = {
  keys: Object.create(null),     // currently held (by e.code)
  pressed: Object.create(null),  // pressed this frame only
  mx: 480, my: 270,              // mouse in canvas pixels
  mdown: false, mpressed: false,
  wheel: 0,
  anyKey: false,
};
G.initInput = function (canvas) {
  const I = G.input;
  const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  window.addEventListener('keydown', (e) => {
    if (prevent.has(e.code)) e.preventDefault();
    if (!e.repeat) { I.keys[e.code] = true; I.pressed[e.code] = true; I.anyKey = true; }
    if (G.audio) G.audio.unlock();
  });
  window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  window.addEventListener('blur', () => { I.keys = Object.create(null); I.mdown = false; });
  const updMouse = (e) => {
    const r = canvas.getBoundingClientRect();
    I.mx = (e.clientX - r.left) * (canvas.width / r.width);
    I.my = (e.clientY - r.top) * (canvas.height / r.height);
  };
  canvas.addEventListener('mousemove', updMouse);
  canvas.addEventListener('mousedown', (e) => {
    updMouse(e);
    if (e.button === 0) { I.mdown = true; I.mpressed = true; }
    if (G.audio) G.audio.unlock();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) I.mdown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); I.wheel += Math.sign(e.deltaY); }, { passive: false });
};
G.endFrameInput = function () {
  const I = G.input;
  I.pressed = Object.create(null);
  I.mpressed = false;
  I.wheel = 0;
  I.anyKey = false;
};

// ---------- persistence ----------
G.save = {
  key: 'grave-danger-save-v1',
  data: { high: 0 },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* private mode etc. */ }
    return this.data;
  },
  write() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
  },
};
