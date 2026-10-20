// Boss win rates by chapter, level and gear (auto battle), the table behind
// tests/chapterspec.mjs. Run: node tools/winrates.mjs [runs per cell, default 300]
import { loadHB, winRate } from '../tests/sim.mjs';
import { SPEC, TIERS } from '../tests/chapterspec.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
const n = +process.argv[2] || 300, S = SPEC();
console.log('chapter,boss,level,gear,winRate');
for (const ch of [3, 4, 5, 6, 7]) {
  const c = S[ch];
  for (const [name, gear] of [['own tier', c.gear], ['last tier', c.prev]]) {
    for (let l = c.lvl - 2; l <= c.lvl + 2; l++) console.log([ch, c.boss, l, name, winRate(HB, l, 0, [c.boss], { gear, allies: c.allies, items: c.items }, n).toFixed(2)].join(','));
  }
}
for (let l = 2; l <= 6; l++) console.log(['1', 'boss', l, 'tier 1', winRate(HB, l, 3, ['boss'], { gear: TIERS[1] }, n).toFixed(2)].join(','));
