// Per-chapter balance. For each chapter: its boss asks for the chapter's
// level, a tier of gear stands in for a level or two (never a wall), a
// companion helps but is not required, the road there is fair for whoever
// just arrived, and the money from that road buys some of the gear.
// Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHB, winRate } from './sim.mjs';
import { SPEC } from './chapterspec.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
const rate = (lvl, kinds, opts, n = 600) => winRate(HB, lvl, 0, kinds, opts, n);
const avg = (k, key) => (HB.FOES[k][key][0] + HB.FOES[k][key][1]) / 2;
const expTo = (from, to) => { let s = 0; for (let l = from; l < to; l++) s += HB.expToNext(l); return s; };
const priceOf = (ids) => ids.reduce((s, id) => s + HB.ITEMS[id].price, 0);
const mapFoes = (id) => HB.MAPS[id]().enemies.map((e) => e.kind || 'wisp');

const T1 = ['mallet', 'vest', 'cap', 'gloves', 'sandals', 'amulet', 'oldscore'];

test('chapter 2: the fog-eater asks for level 8 with harbour gear', () => {
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  const PART = ['coral', 'coat', 'cap', 'gloves', 'sandals', 'amulet', 'oldscore'];
  const it = { soup: 3, herb2: 2, water: 1 };
  const boss = (lvl, gear, allies) => rate(lvl, ['mistking'], { gear, allies, items: it });
  const r = { t2_7: boss(7, T2, ['mio']), t2_8: boss(8, T2, ['mio']), part9: boss(9, PART, ['mio']), t1_10: boss(10, T1, ['mio']), solo9: boss(9, T2, []) };
  console.log('chapter 2 boss:', JSON.stringify(r));
  assert.ok(r.t2_7 < 0.75, 'level 7 is a gamble even fully geared');
  assert.ok(r.t2_8 > 0.85, 'level 8 with harbour gear');
  assert.ok(r.part9 > 0.85, 'or level 9 with a weapon and a coat');
  assert.ok(r.t1_10 > 0.85, 'or level 10 in chapter one gear: levels can stand in for gear');
  assert.ok(r.solo9 > 0.85, '미오 is optional');
});

test('chapter 2: the boss fight with 미오 is not a slog', () => {
  // a turn is one auto pick; chapter one's boss takes about 6
  let turns = 0;
  const pick = HB.autoPick;
  HB.autoPick = (...a) => { turns++; return pick(...a); };
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  rate(8, ['mistking'], { gear: T2, allies: ['mio'], items: { soup: 3, herb2: 2, water: 1 } }, 300);
  HB.autoPick = pick;
  assert.ok(turns / 300 <= 22, 'average ' + (turns / 300).toFixed(1) + ' turns');
});

test('chapter 2: the fog matters', () => {
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  const o = { gear: T2, allies: ['mio'], items: { soup: 3, herb2: 2, water: 1 } };
  // at level 7, where the fight is in doubt (at 8 the win rate is near its ceiling)
  const withFog = rate(7, ['mistking'], o, 1000);
  const every = HB.FOES.mistking.fogEvery;
  delete HB.FOES.mistking.fogEvery;
  const without = rate(7, ['mistking'], o, 1000);
  HB.FOES.mistking.fogEvery = every;
  assert.ok(without > withFog + 0.05, 'fog ' + withFog + ' vs none ' + without);
});

test('chapter 2: the misty road is fair for someone who just finished chapter one', () => {
  assert.ok(rate(5, ['mistwisp', 'jelly', 'crab'], { gear: T1, items: { herb: 2 } }) > 0.85);
  assert.ok(rate(5, ['crab', 'crab', 'jelly'], { gear: T1, allies: ['mio'], items: { herb: 2 } }) > 0.85);
});

test('chapter 2: the road pays for part of the harbour gear', () => {
  const foes = mapFoes('mistroad');
  const exp = foes.reduce((s, k) => s + HB.FOES[k].exp, 0), gold = foes.reduce((s, k) => s + avg(k, 'gold'), 0);
  const clears = expTo(5, 9) / exp;
  const earned = clears * gold;
  console.log('chapter 2: clears from Lv5 to Lv9', clears.toFixed(1), 'gold', earned.toFixed(0));
  assert.ok(clears <= 6, 'auto hunt makes this a few laps, not a grind');
  assert.ok(earned >= priceOf(['coral', 'coat']), 'a weapon and a coat by then');
  assert.ok(earned < priceOf(HB.SHOPS.port.stock.filter((id) => HB.ITEMS[id].slot)), 'but not the whole shop');
});

// chapters 3-7 share one set of rules (tests/chapterspec.mjs). The bands are a
// little wider than the tuning targets so random runs do not flake.
for (const [n, c] of Object.entries(SPEC(HB))) {
  const fightAt = (lvl, gear, allies, kinds) => rate(lvl, kinds || [c.boss], { gear, allies, items: c.items });
  test('chapter ' + n + ': the boss asks for level ' + c.lvl + ' with its own gear', () => {
    let turns = 0;
    const pick = HB.autoPick;
    HB.autoPick = (...a) => { turns++; return pick(...a); };
    const at = fightAt(c.lvl, c.gear, c.allies);
    HB.autoPick = pick;
    const r = { at, early: fightAt(c.lvl - 1, c.gear, c.allies), part: fightAt(c.lvl + 1, c.part, c.allies), old: fightAt(c.lvl + 2, c.prev, c.allies),
      fewer: fightAt(c.lvl + 1, c.gear, c.allies.slice(0, -1)), turns: turns / 600 };
    console.log('chapter ' + n + ' boss:', JSON.stringify(r));
    assert.ok(r.at > 0.82, 'at level');
    assert.ok(r.early < (c.early || 0.8), 'a level early is a gamble');
    assert.ok(r.part > 0.8, 'a weapon and armour of this tier and a level more');
    assert.ok(r.old > 0.8, 'or two levels more in the last tier of gear');
    assert.ok(r.fewer > 0.82, 'the newest companion helps but is not required');
    assert.ok(r.turns <= 22, 'not a slog');
  });

  test('chapter ' + n + ': the road is fair on arrival and pays for gear', () => {
    for (const g of c.groups) assert.ok(rate(c.arrive, g, { gear: c.prev, allies: c.arriveAllies, items: c.items }) > 0.85, g.join(' '));
    const foes = c.maps.flatMap(mapFoes);
    const exp = foes.reduce((s, k) => s + HB.FOES[k].exp, 0), gold = foes.reduce((s, k) => s + avg(k, 'gold'), 0);
    const clears = expTo(c.arrive, c.lvl) / exp, earned = clears * gold;
    assert.ok(clears <= 6, clears.toFixed(1) + ' laps from level ' + c.arrive);
    assert.ok(earned >= priceOf([c.gear[0], c.gear[2]]), 'a weapon and armour by then');
    assert.ok(earned < priceOf(c.gear), 'but not the whole set');
  });
}
