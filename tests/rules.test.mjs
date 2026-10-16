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

// a sensible player: heal when low, chime groups, otherwise attack
function fight(P, kinds) {
  const foes = kinds.map((k) => Object.assign(HB.makeFoe(k), { hp: HB.FOES[k].hp }));
  let silenced = 0;
  for (let turn = 1; turn < 80; turn++) {
    const alive = foes.filter((f) => f.hp > 0);
    let guarding = false;
    if (P.hp < P.maxHp * 0.45 && P.mp >= HB.SKILLS.heal) { P.mp -= HB.SKILLS.heal; P.hp = Math.min(P.maxHp, P.hp + HB.healAmt(P)); }
    else if (P.hp < P.maxHp * 0.45 && P.items.herb) HB.useItem(P, 'herb');
    else if (alive.length > 1 && !silenced && P.mp >= HB.SKILLS.chime) { P.mp -= HB.SKILLS.chime; alive.forEach((f) => { f.hp -= HB.chimeDmg(P); }); }
    else {
      let d = HB.hitDmg(P.atk, alive[0].def);
      if (Math.random() < HB.critChance) d = Math.round(d * 1.8);
      alive[0].hp -= d;
    }
    silenced = Math.max(0, silenced - 1);
    for (const f of foes.filter((x) => x.hp > 0)) {
      const intent = HB.foeIntent(f, turn, P, silenced > 0);
      if (intent === 'silence') silenced = 2;
      else if (intent === 'swallow') P.mp = Math.max(0, P.mp - 2);
      else P.hp -= HB.foeDmg(f, P, intent, guarding);
      if (P.hp <= 0) return false;
    }
    if (foes.every((f) => f.hp <= 0)) return true;
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
  assert.equal(P.maxHp, hp + gain.maxHp);
});

test('damage is never below 1', () => {
  for (let i = 0; i < 500; i++) assert.ok(HB.hitDmg(1, 99) >= 1);
  const boss = HB.makeFoe('boss');
  for (let i = 0; i < 500; i++) assert.ok(HB.foeDmg(boss, { def: 99 }, 'attack', true) >= 1);
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
  mem['hourbell.save1'] = JSON.stringify({ v: 1, party: { lvl: 2 } });
  assert.equal(HB.loadGame(store).party.atk, 8, 'missing fields fall back to defaults');
  const full = { setItem() { throw new Error('quota'); } };
  assert.equal(HB.saveGame(full, { party: P }), false);
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

test('pacing: reaching level 4 takes about two field clears', () => {
  const clear = 4 * HB.FOES.wisp.exp + 2 * HB.FOES.flicker.exp + HB.FOES.guard.exp;
  let need = 0;
  for (let l = 1; l < 4; l++) need += HB.expToNext(l);
  const clears = need / clear;
  assert.ok(clears >= 1.5 && clears <= 3.5, 'clears to Lv4 = ' + clears.toFixed(2));
});
