// Per-chapter balance. For each chapter: its boss asks for the chapter's
// level, a tier of gear stands in for a level or two (never a wall), a
// companion helps but is not required, the road there is fair for whoever
// just arrived, and the money from that road buys some of the gear.
// Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHB, winRate } from './sim.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js']);
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
  assert.ok(r.t2_7 < 0.5, 'level 7 is early even fully geared');
  assert.ok(r.t2_8 > 0.85, 'level 8 with harbour gear');
  assert.ok(r.part9 > 0.85, 'or level 9 with a weapon and a coat');
  assert.ok(r.t1_10 > 0.85, 'or level 10 in chapter one gear: levels can stand in for gear');
  assert.ok(r.solo9 > 0.85, '미오 is optional');
});

test('chapter 2: the fog matters', () => {
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  const o = { gear: T2, allies: ['mio'], items: { soup: 3, herb2: 2, water: 1 } };
  const withFog = rate(8, ['mistking'], o, 1000);
  const every = HB.FOES.mistking.fogEvery;
  delete HB.FOES.mistking.fogEvery;
  const without = rate(8, ['mistking'], o, 1000);
  HB.FOES.mistking.fogEvery = every;
  assert.ok(without > withFog + 0.02, 'fog ' + withFog + ' vs none ' + without);
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
