// Monster and shrine art.
(function (HB) {
  'use strict';

  // "소리먹이" (Hush Wisp): a ghost that swallows sound, with a stopped-clock eye
  HB.makeWispFrames = function (pal) {
    pal = Object.assign({ out: '#241238', dark: '#4e2a7e', mid: '#8456c4', light: '#c4a2f2', eye: '#f2e8cc', hand: '#3a1c3a' }, pal);
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const [c, x] = HB.makeCanvas(24, 24);
      const cx = 12, cy = 10, R = 8;
      const put = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
      // tail flames
      for (let k = 0; k < 3; k++) {
        const tx = cx - 5 + k * 5 + Math.round(Math.sin(f * 1.57 + k * 2) * 1);
        const len = 4 + ((f + k) % 3);
        for (let j = 0; j < len; j++) {
          const w = Math.max(0, 2 - Math.floor(j / 2));
          for (let i = -w; i <= w; i++) put(tx + i, cy + R - 2 + j, j === len - 1 ? pal.out : j > len - 3 ? pal.dark : pal.mid);
          put(tx - w - 1, cy + R - 2 + j, pal.out); put(tx + w + 1, cy + R - 2 + j, pal.out);
        }
      }
      // body
      for (let j = -R - 1; j <= R + 1; j++) for (let i = -R - 1; i <= R + 1; i++) {
        const d = Math.sqrt(i * i + j * j * 1.1);
        if (d > R + 0.5) continue;
        let col = pal.mid;
        const lit = (-i * 0.6 - j * 0.8) / R;
        if (d > R - 0.5) col = pal.out;
        else if (lit > 0.45) col = pal.light;
        else if (lit < -0.3) col = pal.dark;
        if (col === pal.mid && ((i + j + f) & 3) === 0 && lit > 0.15) col = pal.light; // dither
        put(cx + i, cy + j, col);
      }
      // clock eye
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const d = Math.sqrt(i * i + j * j);
        if (d <= 2.6) put(cx + i, cy + j, pal.eye);
        else if (d <= 3.4) put(cx + i, cy + j, pal.out);
      }
      put(cx, cy - 1, pal.hand); put(cx, cy - 2, pal.hand); put(cx, cy, pal.hand); put(cx + 1, cy, pal.hand);
      // little arms
      const arm = f % 2;
      put(cx - R - 1, cy + 1 - arm, pal.mid); put(cx - R - 2, cy + 2 - arm, pal.out);
      put(cx + R + 1, cy + 1 + arm - 1, pal.mid); put(cx + R + 2, cy + 2 + arm - 1, pal.out);
      frames.push(c);
    }
    return frames;
  };

  // solid-color silhouette of a sprite (for hit flashes)
  HB.flashOf = function (img, color) {
    const [c, x] = HB.makeCanvas(img.width, img.height);
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = color || '#ffffff';
    x.fillRect(0, 0, img.width, img.height);
    return c;
  };

  // wind-chime shrine where the first bell fragment rests, 64x40
  HB.makeShrine = function () {
    const [c, x] = HB.makeCanvas(64, 44);
    const st = '#b4b0a4', stL = '#d4d0c4', stD = '#7a766c', stDD = '#4c4a44';
    const rect = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // base steps
    rect(4, 32, 56, 12, stD); rect(4, 32, 56, 1, stL);
    rect(8, 26, 48, 7, st); rect(8, 26, 48, 1, stL); rect(8, 32, 48, 1, stDD);
    for (let i = 8; i < 56; i += 8) rect(i, 27, 1, 5, stD);
    // pillars
    [[10, 6], [48, 6]].forEach(([px, py]) => {
      rect(px, py, 6, 20, stD); rect(px + 1, py, 4, 20, st); rect(px + 1, py, 1, 20, stL);
      rect(px - 1, py - 2, 8, 3, stDD); rect(px - 1, py - 2, 8, 1, stL);
      // chimes
      for (let k = 0; k < 3; k++) {
        rect(px + 1 + k * 2, py + 1, 1, 4 + k * 2, '#c89a3c');
        rect(px + 1 + k * 2, py + 5 + k * 2, 1, 1, '#f4cc64');
      }
    });
    // lintel
    rect(8, 3, 48, 3, stDD); rect(8, 3, 48, 1, stL);
    rect(6, 1, 52, 2, '#6a4a30'); rect(6, 1, 52, 1, '#a8784a');
    // altar
    rect(26, 18, 12, 9, stD); rect(27, 18, 10, 8, st); rect(27, 18, 10, 1, stL);
    rect(25, 16, 14, 3, stDD); rect(25, 16, 14, 1, stL);
    // moss
    for (let k = 0; k < 30; k++) {
      const hx = Math.floor(HB.hash2(k, 1, 9) * 56) + 4, hy = Math.floor(HB.hash2(k, 2, 9) * 16) + 26;
      x.fillStyle = HB.hash2(k, 3, 9) < 0.5 ? '#5a8a44' : '#78a858';
      x.fillRect(hx, hy, 1, 1);
    }
    return c;
  };

  // the floating bell fragment (a curved golden shard), 10x10
  HB.makeFragment = function () {
    const [c, x] = HB.makeCanvas(10, 10);
    const rows = [
      '...gg.....',
      '..gLLg....',
      '.gLLYg....',
      '.gLYYgg...',
      'gLYYYYg...',
      'gYYYYYgg..',
      'gYYYYYYYg.',
      '.gYYYYYYYg',
      '..ggDDDDg.',
      '....gggg..'
    ];
    const pal = { g: '#7a5418', L: '#fff4c0', Y: '#f4c450', D: '#c8962c' };
    rows.forEach((r, j) => r.split('').forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } }));
    return c;
  };
})(window.HB);
