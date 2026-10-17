// Rules and balance checks. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = { HB: {} };
vm.runInNewContext(readFileSync(new URL('../src/rules.js', import.meta.url), 'utf8'), { window, Math, JSON, Object });
const HB = window.HB;

function partyAt(lvl, herbs, bare) {
  const P = HB.newParty();
  while (P.lvl < lvl) HB.levelUp(P);
  P.hp = P.maxHp; P.mp = P.maxMp; P.items = { herb: herbs };
  if (bare) P.mp = P.maxMp = 0; // attack only: no skills, no items
  return P;
}

// a sensible player: heal when low, cure silence, buff for the boss,
// use the element a foe is weak to, otherwise attack. Mirrors battle.js:
// turn order by speed, 침묵 and 맑은울림 count down on the hero's own turns.
function fight(P, kinds) {
  const foes = kinds.map((k) => Object.assign(HB.makeFoe(k), { hp: HB.FOES[k].hp }));
  let silenced = 0, buff = 0;
  const can = (id) => HB.skillsFor(P.lvl).includes(id) && !silenced && P.mp >= HB.SKILLS[id].cost;
  const cast = (id) => { P.mp -= HB.SKILLS[id].cost; };
  function heroAct() {
    const alive = foes.filter((f) => f.hp > 0);
    const low = P.hp < P.maxHp * 0.45;
    let cast_ring = false;
    if (low && can('heal')) { cast('heal'); P.hp = Math.min(P.maxHp, P.hp + HB.healAmt(P)); }
    else if (low && P.items.herb) HB.useItem(P, 'herb');
    else if (silenced && P.items.water) { HB.useItem(P, 'water'); silenced = 0; return; }
    else if (can('ring') && !buff && alive.some((f) => f.boss)) { cast('ring'); buff = HB.SKILLS.ring.buff; cast_ring = true; }
    else if (alive.length > 1 && can('chime') && alive.filter((f) => f.resist !== 'sound').length > 1) {
      cast('chime'); alive.forEach((f) => { f.hp -= HB.chimeDmg(P, f); });
    } else {
      const t = alive.find((f) => f.weak === 'wind') || alive[0];
      if (can('gust') && t.resist !== 'wind') { cast('gust'); t.hp -= HB.gustDmg(P, t, buff > 0); }
      else {
        let d = HB.hitDmg(HB.effAtk(P, buff > 0), t.def);
        if (Math.random() < HB.critChance) d = Math.round(d * 1.8);
        t.hp -= d;
      }
    }
    if (silenced) silenced--;
    if (buff && !cast_ring) buff--;
  }
  for (let turn = 1; turn < 80; turn++) {
    for (const who of HB.turnOrder(P, foes.filter((f) => f.hp > 0))) {
      if (who === 'hero') heroAct();
      else if (who.hp > 0) {
        const intent = HB.foeIntent(who, turn, P, silenced > 0);
        if (intent === 'silence') silenced = 2;
        else if (intent === 'swallow') P.mp = Math.max(0, P.mp - 2);
        else P.hp -= HB.foeDmg(who, P, intent, false);
        if (P.hp <= 0) return false;
      }
      if (foes.every((f) => f.hp <= 0)) return true;
    }
  }
  return false;
}
const winRate = (lvl, herbs, kinds, n = 2000, bare = false) => {
  let w = 0;
  for (let i = 0; i < n; i++) if (fight(partyAt(lvl, herbs, bare), kinds)) w++;
  return w / n;
};

test('exp curve and growth rise every level', () => {
  for (let l = 1; l < 20; l++) assert.ok(HB.expToNext(l + 1) > HB.expToNext(l));
  const P = HB.newParty(), atk = P.atk, hp = P.maxHp;
  const gain = HB.levelUp(P);
  assert.equal(P.lvl, 2);
  assert.equal(P.atk, atk + gain.atk);
  assert.ok(gain.spd > 0);
  assert.equal(P.maxHp, hp + gain.maxHp);
});

test('skills unlock by level', () => {
  assert.deepEqual([...HB.skillsFor(1)], ['chime', 'heal']);
  assert.ok(HB.skillsFor(3).includes('gust') && !HB.skillsFor(3).includes('ring'));
  assert.deepEqual([...HB.learnedAt(5)], ['ring']);
});

test('elements: weak x1.5, resist x0.5', () => {
  const boss = HB.makeFoe('boss');
  assert.equal(HB.elemMul(boss, 'wind'), 1.5);
  assert.equal(HB.elemMul(boss, 'sound'), 0.5);
  assert.equal(HB.elemMul(HB.makeFoe('guard'), 'sound'), 1);
  assert.equal(HB.effAtk({ atk: 10 }, true), 15);
});

test('turn order: faster acts first more often', () => {
  let first = 0;
  for (let i = 0; i < 2000; i++) if (HB.turnOrder({ spd: 6 }, [HB.makeFoe('flicker')])[0] !== 'hero') first++;
  assert.ok(first / 2000 > 0.7, 'flicker (spd 9) usually beats a level 1 hero');
  for (let i = 0; i < 200; i++) assert.equal(HB.turnOrder({ spd: 6 }, [HB.makeFoe('wisp'), HB.makeFoe('guard')]).length, 3);
});

test('damage is never below 1', () => {
  for (let i = 0; i < 500; i++) assert.ok(HB.hitDmg(1, 99) >= 1);
  const boss = HB.makeFoe('boss');
  for (let i = 0; i < 500; i++) assert.ok(HB.foeDmg(boss, { def: 99 }, 'attack', true) >= 1);
  for (let i = 0; i < 500; i++) assert.ok(HB.chimeDmg({ atk: 1 }, boss) >= 1 && HB.gustDmg({ atk: 1 }, { def: 99 }) >= 1);
});

test('items: use, buy and run out', () => {
  const P = partyAt(1, 1);
  P.hp = 5;
  assert.deepEqual({ ...HB.useItem(P, 'herb') }, { hp: 30, mp: 0 });
  assert.equal(P.items.herb, undefined);
  assert.equal(HB.useItem(P, 'herb'), null);
  P.gold = 10;
  assert.ok(HB.buyItem(P, 'herb'));
  assert.equal(P.gold, 2);
  assert.ok(!HB.buyItem(P, 'herb'));
});

test('save round trip, bad data and old saves', () => {
  const mem = {}, store = { setItem: (k, v) => { mem[k] = v; }, getItem: (k) => mem[k] ?? null };
  assert.equal(HB.loadGame(store), null);
  const P = partyAt(3, 2);
  assert.ok(HB.saveGame(store, { party: P, flags: { fragment1: true }, map: 'field', x: 10, y: 20, dir: 'up' }));
  const d = HB.loadGame(store);
  assert.equal(d.party.lvl, 3);
  assert.equal(d.flags.fragment1, true);
  mem['hourbell.save1'] = '{broken';
  assert.equal(HB.loadGame(store), null);
  mem['hourbell.save1'] = JSON.stringify({ v: 2, party: { lvl: 2 } });
  assert.equal(HB.eff(HB.loadGame(store).party).atk, 8, 'missing fields fall back to defaults');
  mem['hourbell.save1'] = JSON.stringify({ v: 99, party: { lvl: 2 } });
  assert.equal(HB.loadGame(store), null, 'saves from a newer version are refused');
  const full = { setItem() { throw new Error('quota'); } };
  assert.equal(HB.saveGame(full, { party: P }), false);
});

test('save migration v1 -> v2 keeps effective stats', () => {
  const mem = {}, store = { setItem: (k, v) => { mem[k] = v; }, getItem: (k) => mem[k] ?? null };
  mem['hourbell.save1'] = JSON.stringify({ v: 1, party: { lvl: 4, atk: 15, def: 6, spd: 9, items: { herb: 1 } }, flags: {} });
  const d = HB.loadGame(store);
  assert.equal(d.v, HB.SAVE_VERSION);
  assert.deepEqual({ ...HB.eff(d.party) }, { atk: 15, def: 6, spd: 9 });
  assert.equal(d.party.equip.weapon, 'staff');
});

test('equipment: equip, swap back to the bag, unequip', () => {
  const P = HB.newParty();
  assert.equal(HB.eff(P).atk, 8);
  assert.ok(!HB.equip(P, 'mallet'), 'cannot equip what you do not own');
  P.items.mallet = 1;
  assert.ok(HB.equip(P, 'mallet'));
  assert.equal(HB.eff(P).atk, P.atk + 5);
  assert.equal(P.items.staff, 1, 'old weapon returns to the bag');
  assert.equal(P.items.mallet, undefined);
  P.items.quill = 1; HB.equip(P, 'quill');
  assert.equal(HB.eff(P).spd, P.spd + 3);
  HB.unequip(P, 'charm');
  assert.equal(HB.eff(P).spd, P.spd);
  assert.equal(P.items.quill, 1);
});

test('economy: selling never makes money, and gear is a goal', () => {
  for (const id in HB.ITEMS) assert.ok(HB.sellPrice(id) < HB.ITEMS[id].price, id);
  const P = HB.newParty(); P.items.vest = 1;
  assert.ok(HB.sellItem(P, 'vest'));
  assert.equal(P.gold, 25);
  assert.ok(!HB.sellItem(P, 'vest'));
  // average gold from one field clear (4 wisps, 2 flickers, 1 guard)
  const avg = (k) => (HB.FOES[k].gold[0] + HB.FOES[k].gold[1]) / 2;
  const perClear = 4 * avg('wisp') + 2 * avg('flicker') + avg('guard');
  const expClear = 4 * HB.FOES.wisp.exp + 2 * HB.FOES.flicker.exp + HB.FOES.guard.exp;
  let need = 0;
  for (let l = 1; l < 4; l++) need += HB.expToNext(l);
  const goldAtLv4 = perClear * need / expClear;
  const smith = ['mallet', 'vest', 'cloak', 'quill', 'amulet'].reduce((s, id) => s + HB.ITEMS[id].price, 0);
  assert.ok(goldAtLv4 >= HB.ITEMS.mallet.price + 2 * HB.ITEMS.herb.price, 'one upgrade by the boss: ' + goldAtLv4.toFixed(0));
  assert.ok(goldAtLv4 < smith / 2, 'but not the whole shop');
});

test('balance: gear helps but does not replace levels', () => {
  const geared = (P) => { P.items.mallet = 1; P.items.vest = 1; HB.equip(P, 'mallet'); HB.equip(P, 'vest'); return P; };
  let plain = 0, gear = 0, gear2 = 0;
  for (let i = 0; i < 1500; i++) {
    if (fight(partyAt(3, 3), ['boss'])) plain++;
    if (fight(geared(partyAt(3, 3)), ['boss'])) gear++;
    if (fight(geared(partyAt(2, 3)), ['boss'])) gear2++;
  }
  console.log('boss at Lv3 plain / geared, Lv2 geared:', plain / 1500, gear / 1500, gear2 / 1500);
  assert.ok(gear > plain + 150, 'gear should help');
  assert.ok(gear2 / 1500 < 0.3, 'level 2 is still too early even with gear');
});

test('balance: field foes are fair, and levels matter', () => {
  assert.ok(winRate(1, 2, ['wisp', 'wisp', 'flicker']) > 0.95, 'a careful level 1 survives a pack');
  const pack = ['guard', 'wisp', 'flicker'];
  assert.ok(winRate(1, 0, pack, 1000, true) < 0.2, 'level 1 cannot just mash attack on a guard pack');
  assert.ok(winRate(3, 0, pack, 1000, true) > 0.9, 'level 3 can');
});

test('balance: the boss asks for a few levels', () => {
  const r = [1, 2, 3, 4, 5, 6].map((l) => winRate(l, 3, ['boss']));
  console.log('boss win rate by level 1-6:', r.map((x) => x.toFixed(2)).join(' '));
  assert.ok(r[1] < 0.1, 'level 2 should almost never win');
  assert.ok(r[2] > 0.05 && r[2] < 0.6, 'level 3 is a gamble');
  assert.ok(r[3] > 0.85, 'level 4 should usually win');
});

test('balance: hitting the boss weakness matters', () => {
  const withWeak = winRate(3, 3, ['boss']);
  const weak = HB.FOES.boss.weak;
  delete HB.FOES.boss.weak;
  const without = winRate(3, 3, ['boss']);
  HB.FOES.boss.weak = weak;
  assert.ok(withWeak > without + 0.1, 'weak ' + withWeak + ' vs none ' + without);
});

test('pacing: reaching level 4 takes about two field clears', () => {
  const clear = 4 * HB.FOES.wisp.exp + 2 * HB.FOES.flicker.exp + HB.FOES.guard.exp;
  let need = 0;
  for (let l = 1; l < 4; l++) need += HB.expToNext(l);
  const clears = need / clear;
  assert.ok(clears >= 1.5 && clears <= 3.5, 'clears to Lv4 = ' + clears.toFixed(2));
});
