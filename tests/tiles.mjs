// Tile seams: every theme's ground tiles laid 8x8 side by side. A seam shows
// as a jump in colour on the tile edges much bigger than inside a tile; this
// measures it and saves a sheet per theme. Run: node tests/tiles.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { openGame } from './browser.mjs';

const GROUND = ['.', ',', '=', 'f']; // grass, flowers, path, floor
const { OUT, URL_, send, ev, sleep, errors, close } = await openGame('hourbell-tiles');
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL_ }); await sleep(2500);
  const res = await ev(`(() => {
    const T = HB.TILE, out = {};
    for (const theme of Object.keys(HB.THEMES)) {
      const rows = Array.from({ length: 8 }, () => ${JSON.stringify(GROUND)}.map((c) => c.repeat(8)).join(''));
      const map = new HB.TileMap({ rows, theme }), c = map.base, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const px = (x, y) => { const i = (y * c.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      const ratios = {};
      ${JSON.stringify(GROUND)}.forEach((ch, b) => {
        // inside one block of the same tile: columns x|x+1 across a tile edge vs. inside a tile
        let edge = 0, inner = 0, ne = 0, ni = 0;
        for (let y = 0; y < 8 * T; y++) for (let x = b * 8 * T + 1; x < (b + 1) * 8 * T - 1; x++) {
          const v = diff(px(x, y), px(x + 1, y));
          if ((x + 1) % T === 0) { edge += v; ne++; } else { inner += v; ni++; }
        }
        ratios[ch] = +((edge / ne + 1) / (inner / ni + 1)).toFixed(2);
      });
      out[theme] = { ratios, png: c.toDataURL('image/png') };
    }
    return out;
  })()`);
  for (const [theme, r] of Object.entries(res)) {
    writeFileSync(OUT + '/tiles-' + theme + '.png', Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(theme.padEnd(8), JSON.stringify(r.ratios));
    for (const [ch, ratio] of Object.entries(r.ratios)) assert.ok(ratio < 2, theme + " '" + ch + "' tiles show their edges (" + ratio + ')');
  }
  assert.deepEqual(errors, [], 'no JS errors');
  console.log('ok, sheets in ' + OUT);
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally { close(); }
