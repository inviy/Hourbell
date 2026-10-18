// Per-chapter balance. For each chapter: its boss asks for the chapter's
// level, a tier of gear stands in for a level or two (never a wall), a
// companion helps but is not required, the road there is fair for whoever
// just arrived, and the money from that road buys some of the gear.
// Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHB, winRate, winRateAs, mashPick, plainPick } from './sim.mjs';
import { SPEC } from './chapterspec.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
const rate = (lvl, kinds, opts, n = 600) => winRate(HB, lvl, 0, kinds, opts, n);
const avg = (k, key) => (HB.FOES[k][key][0] + HB.FOES[k][key][1]) / 2;
const expTo = (from, to) => { let s = 0; for (let l = from; l < to; l++) s += HB.expToNext(l); return s; };
const priceOf = (ids) => ids.reduce((s, id) => s + HB.ITEMS[id].price, 0);
const mapFoes = (id) => HB.MAPS[id]().enemies.map((e) => e.kind || 'wisp');

const T1 = ['mallet', 'vest', 'cap', 'gloves', 'sandals', 'amulet', 'oldscore'];

test('chapter 2: the fog-eater asks for level 6 with all the harbour gear', () => {
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  const PART = ['coral', 'coat', 'cap', 'gloves', 'sandals', 'amulet', 'oldscore'];
  const it = { soup: 3, herb2: 2, water: 1 };
  const boss = (lvl, gear, allies) => rate(lvl, ['mistking'], { gear, allies, items: it });
  const as = (pick, lvl, items) => winRateAs(HB, pick, lvl, ['mistking'], { gear: T2, allies: ['mio'], items }, 600);
  const r = { t2_6: boss(6, T2, ['mio']), part7: boss(7, PART, ['mio']), t1_8: boss(8, T1, ['mio']), solo7: boss(7, T2, []),
    plain6: as(plainPick(HB), 6, it), mash8: as(mashPick(), 8, {}) };
  console.log('chapter 2 boss:', JSON.stringify(r));
  assert.ok(r.t2_6 > 0.85, 'level 6 with harbour gear (a playtest: buying it all should pay off)');
  assert.ok(r.part7 > 0.85, 'or level 7 with a weapon and a coat');
  assert.ok(r.t1_8 > 0.85, 'or level 8 in chapter one gear: levels can stand in for gear');
  assert.ok(r.solo7 > 0.85, '미오 is optional');
  assert.ok(r.plain6 > 0.8, 'attacking and healing when low is enough at level 6');
  assert.ok(r.mash8 > 0.55, 'pressing 공격 with no items is enough at level 8 (the playtest)');
});

test('chapter 2: the boss fight with 미오 is not a slog', () => {
  // a turn is one auto pick; chapter one's boss takes about 6
  let turns = 0;
  const pick = HB.autoPick;
  HB.autoPick = (...a) => { turns++; return pick(...a); };
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  rate(6, ['mistking'], { gear: T2, allies: ['mio'], items: { soup: 3, herb2: 2, water: 1 } }, 300);
  HB.autoPick = pick;
  assert.ok(turns / 300 <= 22, 'average ' + (turns / 300).toFixed(1) + ' turns');
});

test('chapter 2: the fog matters', () => {
  // to a player who just attacks: fog halves plain hits until sound or wind clears it
  const T2 = ['coral', 'coat', 'hood', 'net', 'reefboots', 'pearlear', 'fieldsong'];
  const o = { gear: T2, allies: ['mio'], items: { soup: 3, herb2: 2 } };
  const withFog = winRateAs(HB, plainPick(HB), 5, ['mistking'], o, 1000);
  const every = HB.FOES.mistking.fogEvery;
  delete HB.FOES.mistking.fogEvery;
  const without = winRateAs(HB, plainPick(HB), 5, ['mistking'], o, 1000);
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
  const clears = expTo(5, 7) / exp;
  const earned = clears * gold;
  console.log('chapter 2: clears from Lv5 to Lv7', clears.toFixed(1), 'gold', earned.toFixed(0));
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
    const as = (p, lvl, items) => winRateAs(HB, p, lvl, [c.boss], { gear: c.gear, allies: c.allies, items }, 600);
    const r = { at, part: fightAt(c.lvl + 1, c.part, c.allies), old: fightAt(c.lvl + 2, c.prev, c.allies),
      fewer: fightAt(c.lvl + 1, c.gear, c.allies.slice(0, -1)), turns: turns / 600, plain: as(plainPick(HB), c.lvl, c.items), mash: as(mashPick(), c.lvl + 2, {}) };
    console.log('chapter ' + n + ' boss:', JSON.stringify(r));
    assert.ok(r.at > 0.85, 'at level');
    assert.ok(r.part > 0.8, 'a weapon and armour of this tier and a level more');
    assert.ok(r.old > 0.8, 'or two levels more in the last tier of gear');
    assert.ok(r.fewer > 0.82, 'the newest companion helps but is not required');
    assert.ok(r.turns <= 22, 'not a slog');
    assert.ok(r.plain > 0.8, 'attacking and healing when low is enough at level');
    assert.ok(r.mash > 0.55, 'pressing 공격 with no items is enough two levels up');
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
