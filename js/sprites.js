'use strict';
// ============================================================
// sprites.js — all pixel art is generated at runtime from
// character maps. No external assets. Palette-based, scaled x3.
// ============================================================
(function () {
  const SCALE = 3;

  const PAL = {
    K: '#14101c', // outline / near-black
    W: '#e8e8f0', // white
    S: '#e0a878', // skin
    D: '#4a3468', // hunter coat (purple)
    d: '#33244a', // coat shade
    R: '#d04040', // red
    r: '#8a2828', // dark red
    G: '#6aa84f', // zombie skin
    g: '#477a33', // zombie skin shade
    L: '#9ac86a', // light zombie skin
    B: '#4a5a8a', // shirt blue-gray
    b: '#35406a', // shirt shade
    P: '#3a3a4a', // pants
    T: '#9a9aae', // stone light
    t: '#62627a', // stone shade
    q: '#3e3e52', // stone deep
    M: '#4a6a3a', // moss
    O: '#c07838', // orange / wood
    o: '#7a4a22', // dark wood
    E: '#101018', // eye black
    C: '#8fe8ff', // cyan glow
    c: '#3fa8c8', // cyan dark
    H: '#f0e8c8', // bone white
    h: '#b8ac84', // bone shade
    Y: '#e8d858', // yellow
    F: '#ff9a3c', // fire orange
    N: '#2a2a3a', // dark gray
    X: '#e85fd0', // magenta glow
  };

  // pad rows to equal length, build canvas
  function makeSprite(rows, scale) {
    scale = scale || SCALE;
    const w = Math.max.apply(null, rows.map(r => r.length));
    const h = rows.length;
    const c = document.createElement('canvas');
    c.width = w * scale;
    c.height = h * scale;
    const x = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let i = 0; i < w; i++) {
        const ch = row[i] || '.';
        if (ch === '.' || ch === ' ') continue;
        const col = PAL[ch];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i * scale, y * scale, scale, scale);
      }
    }
    c.pixelW = w; c.pixelH = h;
    return c;
  }

  // ---------- character maps ----------
  const MAPS = {};

  MAPS.player = [
    '....KKKK....',
    '..KKDDDDKK..',
    '.KDDDDDDDDK.',
    '.KDDSSSSDDK.',
    '.KDSESSESDK.',
    '.KDSSSSSSDK.',
    '..KRRRRRRK..',
    '.KdDDDDDDdK.',
    '.KdDKDDKDdK.',
    '.KdDDDDDDdK.',
    '.KdDDDDDDdK.',
    '..KDKKKKDK..',
    '..KDK..KDK..',
    '..KKK..KKK..',
  ];

  // guns point right, grip at left
  MAPS.gun_pistol = [
    '..........',
    '.KKKKKK...',
    '.KTTTTTKK.',
    '.KKKKKK...',
    '..KOK.....',
    '..KOK.....',
  ];
  MAPS.gun_shotgun = [
    '..............',
    '.KKKKKKKKKK...',
    '.KOOTTTTTTTKK.',
    '.KKKKKKKKKK...',
    '..KOO.KK......',
    '..KKK.........',
  ];
  MAPS.gun_smg = [
    '............',
    '.KKKKKKKK...',
    '.KTTTTTTTKK.',
    '.KKKKKKKK...',
    '..KOK.KK....',
    '..KOK.KK....',
    '..KKK.......',
  ];
  MAPS.gun_rifle = [
    '................',
    '.KKKKKKKKKKKK...',
    '.KOOTTTTTTTTTKK.',
    '.KKKKKKKKKKKK...',
    '..KOK...........',
    '..KOK..KK.......',
    '..KKK...........',
  ];

  // zombies — 2 walk frames each
  MAPS.z_shambler_a = [
    '....KKKK....',
    '..KKGGGGKK..',
    '..GKEGGKEG..',
    '..GGGGGGG...',
    '..GGKKKGG...',
    '..KGGGGGK...',
    '.KKBBBBBBKK.',
    '.KGBBBBBGK..',
    'KGKBBBBBBKGK',
    'K.KBBBBBBK.K',
    '..KBBBBBBK..',
    '..KPPPPPK...',
    '..KPK..KPK..',
    '..KKK..KKK..',
  ];
  MAPS.z_shambler_b = [
    '....KKKK....',
    '..KKGGGGKK..',
    '..GKEGGKEG..',
    '..GGGGGGG...',
    '..GGKKKGG...',
    '..KGGGGGK...',
    '.KKBBBBBBKK.',
    '.KBBBBBBBBK.',
    '.KBBBBBBBBK.',
    'KGKBBBBBBKGK',
    'K.KBBBBBBK.K',
    '..KPPPPPK...',
    '..KPK..KPK..',
    '..KKK..KKK..',
  ];
  MAPS.z_runner_a = [
    '...KKKK.....',
    '..KLLLLK....',
    '..KLRRLK....',
    '..KLLLLK....',
    '..KLLLK.....',
    '.KKbbKK.....',
    '.KLbbbK.....',
    'K.KbbbK.K...',
    '..KbbbK.....',
    '..KPPK......',
    '..KPK.KK....',
    '..KKK.......',
  ];
  MAPS.z_runner_b = [
    '...KKKK.....',
    '..KLLLLK....',
    '..KLRRLK....',
    '..KLLLLK....',
    '..KLLLK.....',
    '.KKbbKK.....',
    '.KLbbbK.....',
    '..KbbbK.K...',
    '..KbbbK.....',
    '..KPPK......',
    '..KK.KPK....',
    '......KKK...',
  ];
  MAPS.z_brute_a = [
    '.....KKKKK......',
    '....KGgGgGK.....',
    '....GKEGKEG.....',
    '....GGGGGGG.....',
    '....GgKKKgG.....',
    '..KKGGGGGGGKK...',
    '.KGgGGGGGGGgGK..',
    '.KGGGGGGGGGGGK..',
    'KGKGGGGgGGGGK.GK',
    'K.KGGGGGGGGGK..K',
    '..KGGgGGGGgGK...',
    '..KGGGGGGGGGK...',
    '..KGGGGGGGGGK...',
    '..KPPPPPPPPPK...',
    '..KPPK...KPPK...',
    '..KPK.....KPK...',
    '..KKK.....KKK...',
  ];
  MAPS.z_brute_b = [
    '.....KKKKK......',
    '....KGgGgGK.....',
    '....GKEGKEG.....',
    '....GGGGGGG.....',
    '....GgKKKgG.....',
    '..KKGGGGGGGKK...',
    '.KGgGGGGGGGgGK..',
    '.KGGGGGGGGGGGK..',
    '..KGGGGgGGGGK...',
    'KGKGGGGGGGGGK.GK',
    'K.KGGgGGGGgGK..K',
    '..KGGGGGGGGGK...',
    '..KGGGGGGGGGK...',
    '..KPPPPPPPPPK...',
    '..KPPK...KPPK...',
    '..KPK.....KPK...',
    '..KKK.....KKK...',
  ];
  MAPS.z_spitter_a = [
    '....KKKK....',
    '..KKGGGGKK..',
    '..GKEGGKEG..',
    '..GGGKKGG...',
    '..GGKYYKG...',
    '..KGGGGGK...',
    '.KKggggggKK.',
    '.KGgYYYYgGK.',
    'KGKgYYYYgKGK',
    'K.KgYYYYgK.K',
    '..KggggggK..',
    '..KPPPPPK...',
    '..KPK..KPK..',
    '..KKK..KKK..',
  ];
  MAPS.z_spitter_b = [
    '....KKKK....',
    '..KKGGGGKK..',
    '..GKEGGKEG..',
    '..GGKKKKG...',
    '..GKYYYYK...',
    '..KGGGGGK...',
    '.KKggggggKK.',
    '.KGgYYYYgGK.',
    'KGKgYYYYgKGK',
    'K.KgYYYYgK.K',
    '..KggggggK..',
    '..KPPPPPK...',
    '..KPK..KPK..',
    '..KKK..KKK..',
  ];
  MAPS.z_exploder_a = [
    '...KKKK...',
    '..KOOROK..',
    '..ORRRRO..',
    '..ORRRRO..',
    '.KORRRROK.',
    '.ORRRRRRO.',
    '.ORRRRRRO.',
    'KORRRRRROK',
    '.KORRRROK.',
    '..KPPPPK..',
    '..KPKPK...',
    '..KK.KK...',
  ];
  MAPS.z_exploder_b = [
    '...KKKK...',
    '..KOOROK..',
    '..ORRRRO..',
    '.KORRRROK.',
    '.ORRRRRRO.',
    'KORRRRRROK',
    '.ORRRRRRO.',
    '.KORRRROK.',
    '..KPPPPK..',
    '..KPKPK...',
    '..KK.KK...',
  ];

  // pickups (10x10-ish)
  MAPS.pk_ammo = [
    '.KKKKKKKK.',
    'KOOOOOOOOK',
    'KOKKKKKOOK',
    'KOKYYYKO.K',
    'KOKYYYKO.K',
    'KOKKKKKOOK',
    'KOOOOOOOOK',
    'KKKKKKKKKK',
  ];
  MAPS.pk_hp = [
    '.KKKKKKKK.',
    'KWWWWWWWWK',
    'KWWRRRWWK.',
    'KWWRRRWWK.',
    'KWRRRRRWK.',
    'KWWRRRWWK.',
    'KWWRRRWWK.',
    'KKKKKKKKKK',
  ];
  MAPS.pk_gem = [
    '....KK....',
    '..KKCCKK..',
    '.KCCCCCCK.',
    'KCCCCCCCCK',
    '.KCCCCccK.',
    '..KCcccK..',
    '...KccK...',
    '....KK....',
  ];
  MAPS.pk_crate = [
    'KKKKKKKKKK',
    'KOoOOOOoOK',
    'KOOKKKKOOK',
    'KOoKXXKoOK',
    'KOoKXXKoOK',
    'KOoKKKKoOK',
    'KOoOXXOoOK',
    'KOoOXXOoOK',
    'KOoOOOOoOK',
    'KKKKKKKKKK',
  ];

  // props
  MAPS.prop_grave_a = [
    '..KKKK..',
    '.KTTTTK.',
    'KTTTTTTK',
    'KTKKTKTK',
    'KTTTTTTK',
    'KTTTTTTK',
    'KTtTTtTK',
    'KTTTTTTK',
    'KttTTttK',
    'KKKKKKKK',
  ];
  MAPS.prop_grave_b = [
    '...KK...',
    '..KTTK..',
    '..KTTK..',
    'KKTTTTKK',
    'KTTTTTTK',
    'KKTTTTKK',
    '..KTTK..',
    '..KTTK..',
    '..KTtK..',
    '.KKKKKK.',
  ];
  MAPS.prop_grave_c = [
    '...KK...',
    '..KTTK..',
    '.KTTTTK.',
    '.KTTTTK.',
    '.KTTtTK.',
    '.KTTTTK.',
    '.KTTTTK.',
    'KKTTTTKK',
    'KKKKKKKK',
  ];
  MAPS.prop_tree = [
    '......KK........',
    '......KOK...K...',
    '.....KOK....KOK.',
    '....KOK..KK..KOK',
    '...KOK...KOK..K.',
    '...KO...KOK.KO..',
    '....KOK.KOKKOK..',
    '.....KOKO.KO....',
    '......KOOOK.....',
    '.......KOK......',
    '......KOOK......',
    '......KOOK......',
    '.....KOOOKK.....',
    '....KOOOK......',
    '...KOOOK.......',
    '..KKKKKK.......',
  ];
  MAPS.prop_rock = [
    '..KKKK...',
    '.KttttK..',
    'KttTTttK.',
    'KttTTttK',
    'KttttttK',
    '.KKKKKKK.',
  ];
  MAPS.prop_bones = [
    '..........',
    '.KK....KK.',
    '..KHHHHK..',
    '.KHHHHHHK.',
    '..KHHHHK..',
    '.KK....KK.',
  ];
  MAPS.hand = [
    '.K.K.K..',
    'KGKGKGK.',
    'KGGGGGK.',
    'KGGGGGK.',
    '.KGGGK..',
    '.KGGGK..',
    '.KGGGK..',
    '..KKK...',
  ];
  MAPS.bone = [
    '.KK...KK.',
    'KHHK.KHHK',
    '.KHHHHHK.',
    'KHHK.KHHK',
    '.KK...KK.',
  ];
  MAPS.glob = [
    '.KKKK.',
    'KYYYYK',
    'KYFYYK',
    'KYYYYK',
    '.KKKK.',
  ];
  MAPS.muzzle = [
    '...Y...',
    '..YYY..',
    'YYFFFYY',
    '.YFFFY.',
    'YYFFFYY',
    '..YYY..',
    '...Y...',
  ];
  MAPS.skull = [
    '..KKKKK.',
    '.KWWWWWK',
    'KWEWEWEK',
    'KWWWWWWK',
    'KWKWWKWK',
    '.KKKKKK.',
  ];

  // ---------- boss tombstone: built procedurally (3 phases) ----------
  function buildBoss() {
    const S = 4; // boss pixels are bigger
    const W = 26, H = 34;
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = W * S; c.height = H * S;
      return [c, c.getContext('2d')];
    };
    const px = (x, X, Y, col) => { X.fillStyle = col; X.fillRect(x[0] * S, x[1] * S, S, S); };
    const rect = (X, x0, y0, w, h, col) => { X.fillStyle = col; X.fillRect(x0 * S, y0 * S, w * S, h * S); };

    function drawBase(X, opts) {
      opts = opts || {};
      // silhouette: rounded-top tombstone
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let inside = false;
          if (y >= 6 && y <= H - 3 && x >= 3 && x <= W - 4) inside = true;           // body
          const cx = (W - 1) / 2, cy = 7, r = 9.6;                                     // dome
          if (y < 7 && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && x >= 3 && x <= W - 4) inside = true;
          if (y >= H - 3 && x >= 1 && x <= W - 2) inside = true;                       // plinth
          if (!inside) continue;
          // shading
          let col = PAL.T;
          if (x >= W - 6 || y >= H - 4) col = PAL.t;
          if (x <= 4) col = '#b8b8cc';
          // jagged broken top for phase 3
          if (opts.broken && y < 8) {
            const jag = Math.sin(x * 2.7) * 2 + Math.cos(x * 1.3) * 1.5;
            if (y < 4 + jag) continue;
          }
          X.fillStyle = col;
          X.fillRect(x * S, y * S, S, S);
        }
      }
      // outline pass (cheap: dark border where neighbor empty)
      const img = X.getImageData(0, 0, W * S, H * S);
      const solid = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        return img.data[(y * S * W * S + x * S) * 4 + 3] > 0;
      };
      X.fillStyle = PAL.K;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!solid(x, y)) continue;
        if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
          X.fillRect(x * S, y * S, S, S);
        }
      }
      // skull relief
      const sk = [
        '.KKKKK.',
        'KWWWWWK',
        'KWEWEWK',
        'KWWWWWK',
        '.KWKWK.',
        '..KKK..',
      ];
      const sx = Math.floor(W / 2 - 3), sy = 9;
      for (let y = 0; y < sk.length; y++) for (let x = 0; x < sk[y].length; x++) {
        const ch = sk[y][x];
        if (ch === '.') continue;
        X.fillStyle = ch === 'K' ? PAL.q : ch === 'E' ? PAL.q : PAL.t;
        X.fillRect((sx + x) * S, (sy + y) * S, S, S);
      }
      // moss
      X.fillStyle = PAL.M;
      [[4, H - 6], [5, H - 5], [W - 6, H - 7], [W - 5, H - 6], [6, 12], [W - 7, 16]]
        .forEach(p => X.fillRect(p[0] * S, p[1] * S, S, S));
      // cracks
      if (opts.cracks) {
        X.fillStyle = PAL.q;
        const crack = (x0, y0, pts) => {
          let x = x0, y = y0;
          pts.forEach(d => {
            x += d[0]; y += d[1];
            X.fillRect(x * S, y * S, S, S);
          });
        };
        crack(8, 4, [[0, 1], [1, 1], [0, 1], [-1, 1], [0, 1], [1, 1], [0, 1], [0, 1]]);
        crack(W - 9, 6, [[0, 1], [-1, 1], [0, 1], [0, 1], [1, 1], [0, 1]]);
        crack(12, 18, [[1, 0], [1, 1], [1, 0], [1, 1], [1, 0]]);
      }
    }

    const out = {};
    let c, X;
    [c, X] = mk(); drawBase(X, {}); c.pixelW = W; c.pixelH = H; out.p1 = c;
    [c, X] = mk(); drawBase(X, { cracks: true }); c.pixelW = W; c.pixelH = H; out.p2 = c;
    [c, X] = mk(); drawBase(X, { cracks: true, broken: true }); c.pixelW = W; c.pixelH = H; out.p3 = c;
    return out;
  }

  // soft radial glow (for lights, fog, boss aura)
  function makeGlow(size, r, g, b, a) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, size, size);
    return c;
  }

  G.buildSprites = function () {
    const S = {};
    for (const k in MAPS) S[k] = makeSprite(MAPS[k]);
    S.boss = buildBoss();
    S.glow_white = makeGlow(128, 255, 240, 200, 0.8);
    S.glow_cyan = makeGlow(128, 120, 220, 255, 0.7);
    S.glow_red = makeGlow(128, 255, 80, 60, 0.7);
    S.glow_purple = makeGlow(192, 180, 90, 255, 0.55);
    S.fog = makeGlow(256, 120, 110, 160, 0.16);
    G.SPR = S;
  };

  // white silhouette of a sprite (for hit-flash)
  G.whiteOf = function (spr) {
    const c = document.createElement('canvas');
    c.width = spr.width; c.height = spr.height;
    const x = c.getContext('2d');
    x.drawImage(spr, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  // draw helper: centered, optional flip/rotate/alpha
  G.drawSpr = function (ctx, spr, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
  };
})();
