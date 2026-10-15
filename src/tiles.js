// Procedural pixel-art tiles. Everything is drawn in code so the
// look stays original and the repo needs no external art assets.
(function (HB) {
  'use strict';

  const T = 16;
  HB.TILE = T;

  HB.THEMES = {
    town: {
      grass: '#4f8f3c', grassLight: '#68a84a', grassDark: '#3a7030', tuft: '#80bc58',
      path: '#c4a46c', pathLight: '#d8bc84', pathDark: '#9c7c4c',
      stone: '#b0a898', stoneLight: '#cec6b4', stoneDark: '#7c7468',
      water: '#2e62a8', waterDark: '#1e4682', waterLight: '#7cb4e8', foam: '#d4ecff',
      roof: '#b4482e', roofDark: '#7a2a1c', roofLight: '#d8664a',
      wall: '#e2d0a8', wallDark: '#b8a47c', beam: '#6a4a30',
      leaf: '#3c7a34', leafDark: '#24502a', leafLight: '#62a248', trunk: '#6a4628',
      flowers: ['#fff2f8', '#ffd040', '#f080a8', '#a0c8ff']
    },
    field: {
      grass: '#5aa044', grassLight: '#78bc54', grassDark: '#448034', tuft: '#94d064',
      path: '#ccb078', pathLight: '#e0c890', pathDark: '#a48858',
      stone: '#a8a8a0', stoneLight: '#c8c8c0', stoneDark: '#787870',
      water: '#3270b8', waterDark: '#22528e', waterLight: '#88c4f0', foam: '#e0f4ff',
      roof: '#b4482e', roofDark: '#7a2a1c', roofLight: '#d8664a',
      wall: '#e2d0a8', wallDark: '#b8a47c', beam: '#6a4a30',
      leaf: '#3e8434', leafDark: '#265a28', leafLight: '#68b04a', trunk: '#6e4a2a',
      flowers: ['#ffffff', '#ffe060', '#f890b8', '#b0a0ff']
    }
  };

  HB.SOLID = new Set(['~', 'T', '^', '#', 'W', 'D', 'F', 'r', 's', 'B', 'X']);

  function px(c, x, y, col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
  const h2 = HB.hash2;

  // ---------- base tiles ----------
  function grass(c, ox, oy, tx, ty, P) {
    c.fillStyle = P.grass; c.fillRect(ox, oy, T, T);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const h = h2(ox + i, oy + j, 11);
      if (h < 0.05) px(c, ox + i, oy + j, P.grassDark);
      else if (h < 0.085) px(c, ox + i, oy + j, P.grassLight);
    }
    const n = Math.floor(h2(tx, ty, 3) * 3);
    for (let k = 0; k < n; k++) {
      const x = ox + 2 + Math.floor(h2(tx, ty, 20 + k) * 11);
      const y = oy + 3 + Math.floor(h2(tx, ty, 40 + k) * 10);
      px(c, x, y + 1, P.tuft); px(c, x + 1, y, P.tuft); px(c, x + 2, y + 1, P.tuft);
      px(c, x + 1, y + 1, P.grassDark);
    }
  }

  function flowers(c, ox, oy, tx, ty, P) {
    grass(c, ox, oy, tx, ty, P);
    const n = 2 + Math.floor(h2(tx, ty, 5) * 2);
    for (let k = 0; k < n; k++) {
      const x = ox + 2 + Math.floor(h2(tx, ty, 60 + k) * 11);
      const y = oy + 2 + Math.floor(h2(tx, ty, 80 + k) * 11);
      const col = P.flowers[Math.floor(h2(tx, ty, 90 + k) * P.flowers.length)];
      px(c, x, y - 1, col); px(c, x - 1, y, col); px(c, x + 1, y, col); px(c, x, y + 1, col);
      px(c, x, y, '#ffe680');
      px(c, x, y + 2, P.grassDark);
    }
  }

  function edgeBlend(c, ox, oy, map, tx, ty, P, same) {
    // let grass creep irregularly over the edges of paths and plazas
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    dirs.forEach(([dx, dy], di) => {
      const n = map.at(tx + dx, ty + dy);
      if (same.indexOf(n) >= 0 || n === null) return;
      if ('.,T'.indexOf(n) < 0) return;
      for (let i = 0; i < T; i++) {
        const h = h2(ox + i * (dx === 0 ? 1 : 0) + di * 7, oy + i * (dy === 0 ? 1 : 0), 31);
        const d = h < 0.45 ? 1 : h < 0.75 ? 2 : h < 0.9 ? 0 : 3;
        for (let k = 0; k < d; k++) {
          let x, y;
          if (dy === -1) { x = ox + i; y = oy + k; }
          else if (dy === 1) { x = ox + i; y = oy + T - 1 - k; }
          else if (dx === -1) { x = ox + k; y = oy + i; }
          else { x = ox + T - 1 - k; y = oy + i; }
          px(c, x, y, k === d - 1 ? P.grassDark : P.grass);
        }
      }
    });
  }

  function path(c, ox, oy, tx, ty, P, map) {
    c.fillStyle = P.path; c.fillRect(ox, oy, T, T);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const h = h2(ox + i, oy + j, 17);
      if (h < 0.07) px(c, ox + i, oy + j, P.pathDark);
      else if (h < 0.12) px(c, ox + i, oy + j, P.pathLight);
    }
    // pebbles
    if (h2(tx, ty, 8) < 0.6) {
      const x = ox + 3 + Math.floor(h2(tx, ty, 9) * 9), y = oy + 3 + Math.floor(h2(tx, ty, 10) * 9);
      px(c, x, y, P.stoneLight); px(c, x + 1, y, P.stone); px(c, x, y + 1, P.pathDark); px(c, x + 1, y + 1, P.pathDark);
    }
    edgeBlend(c, ox, oy, map, tx, ty, P, '=_b');
  }

  function plaza(c, ox, oy, tx, ty, P, map) {
    c.fillStyle = P.stone; c.fillRect(ox, oy, T, T);
    for (let row = 0; row < 2; row++) {
      const y = oy + row * 8;
      const off = ((ty * 2 + row) % 2) * 4;
      for (let col = -1; col < 3; col++) {
        const x = ox + col * 8 + off;
        const sh = h2(tx * 4 + col, ty * 2 + row, 12);
        c.fillStyle = sh < 0.3 ? HB.shade(P.stone, -0.06) : sh > 0.8 ? HB.shade(P.stone, 0.06) : P.stone;
        c.fillRect(Math.max(ox, x), y, Math.min(8, ox + T - x, x + 8 - ox), 8);
        c.fillStyle = P.stoneDark;
        if (x >= ox && x < ox + T) c.fillRect(x, y, 1, 8);
        c.fillStyle = P.stoneLight;
        if (x + 1 >= ox && x + 1 < ox + T) c.fillRect(x + 1, y + 1, 1, 6);
      }
      c.fillStyle = P.stoneDark; c.fillRect(ox, y + 7, T, 1);
      c.fillStyle = P.stoneLight; c.fillRect(ox, y, T, 1);
    }
    for (let k = 0; k < 6; k++) {
      const h = h2(tx, ty, 100 + k);
      px(c, ox + Math.floor(h * 16), oy + Math.floor(h2(tx, ty, 120 + k) * 16), P.stoneDark);
    }
    edgeBlend(c, ox, oy, map, tx, ty, P, '_=Bb');
  }

  function waterBase(c, ox, oy, tx, ty, P, map) {
    c.fillStyle = P.water; c.fillRect(ox, oy, T, T);
    const up = map.at(tx, ty - 1);
    if (up !== '~' && up !== 'b' && up !== null) {
      c.fillStyle = P.waterDark; c.fillRect(ox, oy, T, 3);
      c.fillStyle = HB.shade(P.waterDark, -0.2); c.fillRect(ox, oy, T, 1);
    }
  }

  function roof(c, ox, oy, tx, ty, P, map) {
    const up = map.at(tx, ty - 1), dn = map.at(tx, ty + 1);
    const lf = map.at(tx - 1, ty), rt = map.at(tx + 1, ty);
    c.fillStyle = P.roof; c.fillRect(ox, oy, T, T);
    for (let r = 0; r < 4; r++) {
      const y = oy + r * 4;
      c.fillStyle = P.roofDark; c.fillRect(ox, y + 3, T, 1);
      c.fillStyle = P.roofLight; c.fillRect(ox, y, T, 1);
      const off = ((ty * 4 + r) % 2) * 3;
      for (let x = ox + off; x < ox + T; x += 6) { c.fillStyle = P.roofDark; c.fillRect(x, y, 1, 3); }
    }
    if (up !== '^') { c.fillStyle = HB.shade(P.roofDark, -0.3); c.fillRect(ox, oy, T, 1); c.fillStyle = P.roofLight; c.fillRect(ox, oy + 1, T, 1); }
    if (dn !== '^') { c.fillStyle = HB.shade(P.roofDark, -0.25); c.fillRect(ox, oy + T - 2, T, 2); }
    if (lf !== '^') { c.fillStyle = HB.shade(P.roofDark, -0.3); c.fillRect(ox, oy, 1, T); }
    if (rt !== '^') { c.fillStyle = HB.shade(P.roofDark, -0.3); c.fillRect(ox + T - 1, oy, 1, T); }
  }

  function wall(c, ox, oy, tx, ty, P, map) {
    c.fillStyle = P.wall; c.fillRect(ox, oy, T, T);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      if (h2(ox + i, oy + j, 23) < 0.05) px(c, ox + i, oy + j, P.wallDark);
    }
    c.fillStyle = HB.shade(P.wallDark, -0.25); c.fillRect(ox, oy, T, 2); // eave shadow
    c.fillStyle = P.beam; c.fillRect(ox, oy + 2, T, 1);
    const lf = map.at(tx - 1, ty), rt = map.at(tx + 1, ty);
    if ('#WD'.indexOf(lf) < 0) { c.fillStyle = P.beam; c.fillRect(ox, oy, 2, T); }
    if ('#WD'.indexOf(rt) < 0) { c.fillStyle = P.beam; c.fillRect(ox + T - 2, oy, 2, T); }
    // stone footing
    c.fillStyle = P.stoneDark; c.fillRect(ox, oy + 13, T, 3);
    c.fillStyle = P.stone;
    for (let x = ox + ((tx % 2) * 3); x < ox + T; x += 6) c.fillRect(x, oy + 13, 4, 2);
  }

  function windowTile(c, ox, oy, tx, ty, P, map) {
    wall(c, ox, oy, tx, ty, P, map);
    c.fillStyle = P.beam; c.fillRect(ox + 3, oy + 4, 10, 8);
    c.fillStyle = '#ffd06a'; c.fillRect(ox + 4, oy + 5, 8, 6);
    c.fillStyle = '#fff0b0'; c.fillRect(ox + 4, oy + 5, 3, 2);
    c.fillStyle = P.beam; c.fillRect(ox + 7, oy + 5, 2, 6); c.fillRect(ox + 4, oy + 7, 8, 1);
    // flower box
    c.fillStyle = '#7a4a2a'; c.fillRect(ox + 3, oy + 12, 10, 2);
    const fl = P.flowers;
    for (let i = 0; i < 4; i++) px(c, ox + 4 + i * 2 + (ty % 2), oy + 11, fl[(tx + i) % fl.length]);
  }

  function door(c, ox, oy, tx, ty, P, map) {
    wall(c, ox, oy, tx, ty, P, map);
    c.fillStyle = HB.shade(P.beam, -0.3); c.fillRect(ox + 3, oy + 3, 10, 13);
    c.fillStyle = '#8a5a34'; c.fillRect(ox + 4, oy + 4, 8, 12);
    c.fillStyle = '#6a4024';
    c.fillRect(ox + 6, oy + 4, 1, 12); c.fillRect(ox + 9, oy + 4, 1, 12);
    c.fillStyle = '#a87448'; c.fillRect(ox + 4, oy + 4, 8, 1);
    px(c, ox + 10, oy + 10, '#f0c040');
  }

  function fence(c, ox, oy, tx, ty, P, map) {
    grass(c, ox, oy, tx, ty, P);
    const wood = '#9a6a3c', dark = '#5a3a20', light = '#c08a54';
    const lf = map.at(tx - 1, ty) === 'F', rt = map.at(tx + 1, ty) === 'F';
    const x0 = lf ? ox : ox + 2, x1 = rt ? ox + T : ox + 14;
    [6, 10].forEach((y) => {
      c.fillStyle = dark; c.fillRect(x0, oy + y + 1, x1 - x0, 1);
      c.fillStyle = wood; c.fillRect(x0, oy + y, x1 - x0, 1);
    });
    [2, 12].forEach((x) => {
      c.fillStyle = dark; c.fillRect(ox + x, oy + 3, 3, 11);
      c.fillStyle = wood; c.fillRect(ox + x, oy + 3, 2, 10);
      c.fillStyle = light; c.fillRect(ox + x, oy + 3, 2, 1);
    });
    c.fillStyle = 'rgba(16,8,32,0.25)'; c.fillRect(x0, oy + 14, x1 - x0, 1);
  }

  function rock(c, ox, oy, tx, ty, P, map) {
    grass(c, ox, oy, tx, ty, P);
    c.fillStyle = 'rgba(16,8,32,0.28)'; c.fillRect(ox + 2, oy + 12, 12, 2);
    c.fillStyle = P.stoneDark; c.fillRect(ox + 2, oy + 5, 12, 8); c.fillRect(ox + 4, oy + 3, 8, 2);
    c.fillStyle = P.stone; c.fillRect(ox + 3, oy + 5, 10, 6); c.fillRect(ox + 5, oy + 4, 6, 1);
    c.fillStyle = P.stoneLight; c.fillRect(ox + 4, oy + 5, 4, 2); px(c, ox + 9, oy + 6, P.stoneLight);
  }

  function sign(c, ox, oy, tx, ty, P, map) {
    const under = map.at(tx, ty + 1) === '=' ? path : grass;
    under(c, ox, oy, tx, ty, P, map);
    c.fillStyle = 'rgba(16,8,32,0.25)'; c.fillRect(ox + 4, oy + 14, 9, 1);
    c.fillStyle = '#5a3a20'; c.fillRect(ox + 7, oy + 8, 2, 7);
    c.fillStyle = '#5a3a20'; c.fillRect(ox + 2, oy + 2, 12, 8);
    c.fillStyle = '#b88a54'; c.fillRect(ox + 3, oy + 3, 10, 6);
    c.fillStyle = '#7a5434'; c.fillRect(ox + 4, oy + 5, 8, 1); c.fillRect(ox + 4, oy + 7, 6, 1);
  }

  function bridge(c, ox, oy, tx, ty, P, map) {
    c.fillStyle = P.water; c.fillRect(ox, oy, T, T);
    c.fillStyle = '#5a3a20'; c.fillRect(ox, oy + 1, T, 14);
    for (let x = 0; x < T; x += 4) {
      c.fillStyle = '#a8784a'; c.fillRect(ox + x, oy + 2, 3, 12);
      c.fillStyle = '#c8945c'; c.fillRect(ox + x, oy + 2, 3, 1);
    }
    c.fillStyle = '#6a4428'; c.fillRect(ox, oy + 1, T, 1); c.fillRect(ox, oy + 14, T, 1);
  }

  const BASE = {
    '.': grass, ',': flowers, '=': path, '_': plaza, '~': waterBase, '^': roof,
    '#': wall, 'W': windowTile, 'D': door, 'F': fence, 'r': rock, 's': sign,
    'b': bridge, 'T': grass, 'B': plaza, 'X': grass
  };

  // ---------- tree canopy (drawn above characters) ----------
  function makeCanopy(P, variant) {
    const [c, x] = HB.makeCanvas(22, 22);
    const cx = 11, cy = 10, r = 9 + (variant ? 1 : 0);
    for (let j = 0; j < 22; j++) for (let i = 0; i < 22; i++) {
      const dx = i - cx, dy = j - cy;
      // lumpy silhouette
      const ang = Math.atan2(dy, dx);
      const rr = r + Math.sin(ang * 5 + variant * 2) * 1.2;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > rr) continue;
      let col = P.leaf;
      const light = (-dx * 0.6 - dy * 0.8) / rr; // light from top-left
      if (d > rr - 1) col = P.leafDark;
      else if (light > 0.45) col = P.leafLight;
      else if (light < -0.35) col = P.leafDark;
      // leaf clumps dithering
      const n = h2(i, j, 50 + variant);
      if (n < 0.12 && col === P.leaf) col = P.leafLight;
      if (n > 0.9 && col === P.leaf) col = P.leafDark;
      x.fillStyle = col; x.fillRect(i, j, 1, 1);
    }
    // leaf highlights clusters
    for (let k = 0; k < 6; k++) {
      const a = h2(k, variant, 77) * Math.PI - Math.PI * 0.9;
      const rad = 3 + h2(k, variant, 78) * 4;
      const lx = Math.round(cx + Math.cos(a) * rad), ly = Math.round(cy + Math.sin(a) * rad);
      x.fillStyle = HB.shade(P.leafLight, 0.15);
      x.fillRect(lx, ly, 2, 1); x.fillRect(lx + 1, ly - 1, 1, 1);
    }
    return c;
  }
  function trunk(c, ox, oy, P) {
    c.fillStyle = 'rgba(16,8,32,0.3)'; c.fillRect(ox + 3, oy + 13, 11, 3);
    c.fillStyle = HB.shade(P.trunk, -0.35); c.fillRect(ox + 6, oy + 9, 5, 6);
    c.fillStyle = P.trunk; c.fillRect(ox + 7, oy + 9, 3, 5);
  }

  // ---------- water animation (tileable 64x64, 8 frames) ----------
  function makeWaterFrames(P) {
    const frames = [];
    for (let f = 0; f < 8; f++) {
      const [c, x] = HB.makeCanvas(64, 64);
      x.fillStyle = P.water; x.fillRect(0, 0, 64, 64);
      const ph = (f / 8) * Math.PI * 2;
      for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
        const v = Math.sin((i / 64) * Math.PI * 6 + ph + Math.sin((j / 64) * Math.PI * 4) * 1.6) +
          Math.sin((j / 64) * Math.PI * 8 - ph * 2) * 0.8;
        if (j % 4 === 0 && v > 1.45) { x.fillStyle = P.waterLight; x.fillRect(i, j, 1, 1); }
        else if (j % 4 === 2 && v < -1.3) { x.fillStyle = P.waterDark; x.fillRect(i, j, 1, 1); }
      }
      frames.push(c);
    }
    return frames;
  }

  // ---------- map object ----------
  HB.TileMap = function (def) {
    this.def = def;
    this.w = def.rows[0].length;
    this.h = def.rows.length;
    this.rows = def.rows;
    this.P = HB.THEMES[def.theme];
    this.at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.rows[y][x]);
    this.solidAt = (x, y) => { const t = this.at(x, y); return t === null || HB.SOLID.has(t); };
    this.build();
  };

  HB.TileMap.prototype.build = function () {
    const P = this.P;
    const [c, x] = HB.makeCanvas(this.w * T, this.h * T);
    this.trees = []; this.waters = []; this.windows = [];
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      const ch = this.rows[ty][tx];
      const fn = BASE[ch] || grass;
      fn(x, tx * T, ty * T, tx, ty, P, this);
      if (ch === 'T') { trunk(x, tx * T, ty * T, P); this.trees.push({ tx, ty, v: h2(tx, ty, 4) < 0.5 ? 0 : 1 }); }
      if (ch === '~') this.waters.push({ tx, ty });
      if (ch === 'W') this.windows.push({ x: tx * T + 8, y: ty * T + 8 });
    }
    this.base = c;
    this.canopies = [makeCanopy(P, 0), makeCanopy(P, 1)];
    this.water = makeWaterFrames(P);
  };

  // draw the ground layer (static base + animated water)
  HB.TileMap.prototype.drawGround = function (g, cam) {
    g.drawImage(this.base, -cam.x, -cam.y);
    const f = Math.floor(HB.time * 5) % 8;
    const wf = this.water[f];
    const P = this.P;
    for (const w of this.waters) {
      const sx = w.tx * T - cam.x, sy = w.ty * T - cam.y;
      if (sx < -T || sy < -T || sx > HB.W || sy > HB.H) continue;
      const up = this.at(w.tx, w.ty - 1);
      const top = up !== '~' && up !== 'b' && up !== null ? 3 : 0;
      g.drawImage(wf, (w.tx * T) % 64, (w.ty * T + top) % 64, T, T - top, sx, sy + top, T, T - top);
      // foam at the shore
      const edges = [[0, -1], [-1, 0], [1, 0], [0, 1]];
      for (const [dx, dy] of edges) {
        const n = this.at(w.tx + dx, w.ty + dy);
        if (n === '~' || n === 'b' || n === null) continue;
        for (let i = 0; i < T; i += 2) {
          const wave = Math.sin(HB.time * 2.2 + (w.tx * T + i) * 0.35 + (w.ty * T) * 0.2);
          if (wave < 0.1) continue;
          g.fillStyle = wave > 0.75 ? P.foam : P.waterLight;
          if (dy === -1) g.fillRect(sx + i, sy + 3, 2, 1);
          else if (dy === 1) g.fillRect(sx + i, sy + T - 1, 2, 1);
          else if (dx === -1) g.fillRect(sx, sy + i, 1, 2);
          else g.fillRect(sx + T - 1, sy + i, 1, 2);
        }
      }
    }
  };

  // canopies above characters, with a gentle wind sway
  HB.TileMap.prototype.drawTops = function (g, cam) {
    for (const t of this.trees) {
      const sx = t.tx * T - cam.x - 3, sy = t.ty * T - cam.y - 8;
      if (sx < -24 || sy < -24 || sx > HB.W || sy > HB.H) continue;
      const sway = Math.sin(HB.time * 1.3 + t.tx * 0.7 + t.ty * 0.4) > 0.6 ? 1 : 0;
      g.drawImage(this.canopies[t.v], sx + sway, sy);
    }
  };
})(window.HB);
