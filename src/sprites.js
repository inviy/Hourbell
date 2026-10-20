// Character sprites drawn from text grids, recolored per character.
(function (HB) {
  'use strict';

  // k outline, h hair, s skin, e eye, c cloth, C cloth shade, g accent, b boots
  const DOWN = [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khsssssshk...',
    '...khsesseshk...',
    '....kssssssk....',
    '...kcccggccck...',
    '..kccccggcccck..',
    '..ksccccccccsk..',
    '...kCCCCCCCCk...',
    '...kCCCkkCCCk...',
    '....kbbk.kbbk...',
    '....kkkk.kkkk...',
    '................'
  ];
  const UP = DOWN.slice();
  UP[5] = '...khhhhhhhhk...';
  UP[6] = '...khhhhhhhhk...';
  UP[7] = '....khhhhhhk....';
  UP[8] = '...kcccccccck...';
  UP[9] = '..kcccccccccck..';

  const SIDE = [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhsssk....',
    '...khhhsesk.....',
    '....khssssk.....',
    '....kcccgck.....',
    '...kcccccgck....',
    '...kccccsck.....',
    '...kCCCCCCk.....',
    '....kCCCCk......',
    '....kbbbk.......',
    '....kkkkk.......',
    '................'
  ];

  // walking: lift one foot by a pixel on alternating frames
  function stepFrame(grid, side) {
    const out = grid.map((r) => r.split(''));
    const lo = side === 0 ? 0 : 8, hi = side === 0 ? 8 : 16;
    for (let x = lo; x < hi; x++) {
      // shift rows 12..14 of this half up by one
      out[12][x] = grid[13][x] === '.' ? grid[12][x] : grid[13][x];
      out[13][x] = grid[14][x];
      out[14][x] = '.';
    }
    return out.map((r) => r.join(''));
  }

  function sideStep(grid, which) {
    const out = grid.map((r) => r.split(''));
    if (which === 0) {
      // stride: back foot behind, front foot ahead
      out[12] = '...kCCCCCk......'.split('');
      out[13] = '..kbbk.kbbk.....'.split('');
      out[14] = '..kkk...kkk.....'.split('');
    } else {
      out[12] = '....kCCCCk......'.split('');
      out[13] = '....kbbbk.......'.split('');
      out[14] = '.....kkk........'.split('');
    }
    return out.map((r) => r.join(''));
  }

  function paint(grid, pal, flip) {
    const [c, x] = HB.makeCanvas(16, 16);
    for (let r = 0; r < 16; r++) {
      const row = grid[r];
      for (let i = 0; i < 16; i++) {
        const ch = row[i];
        if (!ch || ch === '.') continue;
        const col = pal[ch];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(flip ? 15 - i : i, r, 1, 1);
      }
    }
    return c;
  }

  // pal.wear: a different outline on top of the head, so people tell apart
  // by shape as well as colour (hat: wide brim, cap, bun: hair knot, hood)
  const WEAR = {
    hat: { 0: '....kkkkkkkk....', 1: '...kggggggggk...', 2: '.kkkkkkkkkkkkkk.' },
    cap: { 1: '.....kkkkkk.....', 2: '....kggggggk....', 3: '...kkkkkkkkkkk..' },
    bun: { 0: '......kkkk......', 1: '.....khhhhk.....' }
  };
  function wear(grid, kind) {
    if (!kind) return grid;
    const g = grid.slice();
    if (kind === 'hood') { // the cloth comes up over the head to a point
      g[0] = '.......kk.......';
      for (let r = 1; r < 5; r++) g[r] = g[r].replace(/h/g, 'C');
      return g;
    }
    for (const r in WEAR[kind]) g[r] = WEAR[kind][r];
    return g;
  }

  // returns { down:[3], up:[3], left:[3], right:[3] } canvases; [idle, stepA, stepB]
  HB.makeCharacter = function (pal) {
    const p = Object.assign({ k: '#1a1424', e: '#20162e' }, pal);
    const set = (grid) => [wear(grid, p.wear), stepFrame(wear(grid, p.wear), 0), stepFrame(wear(grid, p.wear), 1)];
    const side = wear(SIDE, p.wear);
    const sideFrames = [side, sideStep(side, 0), sideStep(side, 1)];
    return {
      down: set(DOWN).map((gr) => paint(gr, p)),
      up: set(UP).map((gr) => paint(gr, p)),
      right: sideFrames.map((gr) => paint(gr, p)),
      left: sideFrames.map((gr) => paint(gr, p, true))
    };
  };

  HB.PALETTES = {
    hero: { h: '#c8642c', s: '#f4c8a0', c: '#3a6ccc', C: '#24448c', g: '#f0c040', b: '#5a3a28' },
    keeper: { h: '#d8d4cc', s: '#e8b890', c: '#6a4a8c', C: '#46305e', g: '#c8a040', b: '#3a2a20' },
    florist: { h: '#e87898', s: '#f8d0b0', c: '#58a868', C: '#3a7848', g: '#fff0a0', b: '#6a4030', wear: 'bun' },
    innkeep: { h: '#4a3020', s: '#e0a880', c: '#b85838', C: '#803a24', g: '#f0e0c0', b: '#3a2418' },
    child: { h: '#f0c848', s: '#f8d4b0', c: '#e86848', C: '#a84430', g: '#ffffff', b: '#5a4a8a' },
    fisher: { h: '#3a3a48', s: '#d8a078', c: '#4a8888', C: '#2e5c5c', g: '#d8c890', b: '#3a2a20', wear: 'hat' },
    smithgirl: { h: '#c84a2a', s: '#e8b088', c: '#5a6a7a', C: '#3a4652', g: '#e0a040', b: '#3a2418' },
    apprentice: { h: '#2a2a3a', s: '#f0c8a0', c: '#e8d8b0', C: '#b8a478', g: '#c89a3c', b: '#4a3a2a' },
    bard: { h: '#5ac8b8', s: '#f4d0b0', c: '#7a4ab8', C: '#542e86', g: '#f0d060', b: '#3a2a40' },
    smith: { h: '#2a1a14', s: '#c88860', c: '#6a6a74', C: '#44444e', g: '#c87a3a', b: '#2a1a14', wear: 'cap' }
  };

  // soft oval shadow under characters
  HB.drawShadow = function (g, x, y, w) {
    g.fillStyle = 'rgba(16,8,32,0.28)';
    w = w || 10;
    g.fillRect(x - (w >> 1) + 1, y, w - 2, 1);
    g.fillRect(x - (w >> 1), y + 1, w, 2);
    g.fillRect(x - (w >> 1) + 1, y + 3, w - 2, 1);
  };
})(window.HB);
