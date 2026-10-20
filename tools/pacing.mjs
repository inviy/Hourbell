// How long each chapter's road takes: field laps (clears of every foe on its
// road maps) from the arrival level to the boss level, and the gold they earn
// against the chapter's gear. Run: node tools/pacing.mjs
import { loadHB } from '../tests/sim.mjs';
import { SPEC } from '../tests/chapterspec.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
const avg = (k) => (HB.FOES[k].gold[0] + HB.FOES[k].gold[1]) / 2;
const price = (ids) => ids.reduce((s, id) => s + HB.ITEMS[id].price, 0);
console.log('chapter,arrive,boss level,laps,gold earned,gear set price');
for (const [ch, c] of Object.entries(SPEC())) {
  const foes = c.maps.flatMap((id) => HB.MAPS[id]().enemies.map((e) => e.kind || 'wisp'));
  let need = 0; for (let l = c.arrive; l < c.lvl; l++) need += HB.expToNext(l);
  const laps = need / foes.reduce((s, k) => s + HB.FOES[k].exp, 0);
  console.log([ch, c.arrive, c.lvl, laps.toFixed(1), Math.round(laps * foes.reduce((s, k) => s + avg(k), 0)), price(c.gear)].join(','));
}
