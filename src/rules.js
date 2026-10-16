// Game rules: party growth, foes, items, damage and save data.
// Pure data and math (no canvas, no audio) so tests/rules.test.mjs can
// balance-check it in node.
(function (HB) {
  'use strict';

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  HB.rnd = rnd;

  HB.newParty = () => ({
    name: '리안', lvl: 1, exp: 0, hp: 40, maxHp: 40, mp: 12, maxMp: 12,
    atk: 8, def: 3, spd: 6, gold: 0, items: { herb: 2 }, time: 0, battles: 0
  });
  HB.party = HB.newParty();

  HB.expToNext = (lvl) => Math.round(10 * Math.pow(lvl, 1.5));
  // every level: +8 HP, +2 울림, +2 공격, +1 방어, +1 속도; every third level a little extra
  HB.levelUp = function (P) {
    const bonus = (P.lvl + 1) % 3 === 0 ? 1 : 0;
    const gain = { maxHp: 8 + bonus * 4, maxMp: 2 + bonus, atk: 2 + bonus, def: 1, spd: 1 };
    P.lvl++;
    for (const k in gain) P[k] += gain[k];
    P.hp = Math.min(P.maxHp, P.hp + gain.maxHp + 4);
    P.mp = Math.min(P.maxMp, P.mp + gain.maxMp + 1);
    return gain;
  };

  // kind -> base stats. swallow: chance to eat 울림 instead of attacking
  // weak / resist: element taken at x1.5 / x0.5
  HB.FOES = {
    wisp: { name: '소리먹이', hp: 18, atk: 6, def: 1, spd: 5, exp: 4, gold: [2, 5], drop: ['herb', 0.12], swallow: 0.22, weak: 'sound' },
    flicker: { name: '떨림이', hp: 12, atk: 5, def: 0, spd: 9, exp: 4, gold: [3, 7], drop: ['drop', 0.2], swallow: 0.45, weak: 'wind', resist: 'sound' },
    guard: { name: '울림삼킴이', hp: 34, atk: 9, def: 3, spd: 3, exp: 12, gold: [8, 12], drop: ['water', 0.5], swallow: 0.15, resist: 'wind' },
    boss: { name: '침묵의 파수꾼', hp: 200, atk: 14, def: 4, spd: 6, exp: 50, gold: [40, 40], drop: ['drop', 1], swallow: 0, boss: true, weak: 'wind', resist: 'sound' }
  };

  HB.ITEMS = {
    herb: { name: '약초', hp: 30, price: 8, desc: 'HP를 30 회복한다.' },
    drop: { name: '울림방울', mp: 10, price: 15, desc: '울림을 10 회복한다.' },
    water: { name: '맑은물', cure: true, price: 10, desc: '침묵을 풀어 준다. (전투 중)' }
  };

  // lvl: level it is learned at. el: element. buff: turns of x1.5 공격
  HB.SKILLS = {
    chime: { name: '종소리', cost: 4, lvl: 1, target: 'all', el: 'sound', desc: '적 전체에 소리 피해' },
    heal: { name: '회복', cost: 3, lvl: 1, target: 'self', desc: 'HP를 회복' },
    gust: { name: '바람결', cost: 3, lvl: 3, target: 'one', el: 'wind', desc: '적 하나에 강한 바람 피해' },
    ring: { name: '맑은울림', cost: 5, lvl: 5, target: 'self', buff: 3, desc: '3턴 동안 공격 1.5배' }
  };
  HB.skillsFor = (lvl) => Object.keys(HB.SKILLS).filter((id) => HB.SKILLS[id].lvl <= lvl);
  HB.learnedAt = (lvl) => Object.keys(HB.SKILLS).filter((id) => HB.SKILLS[id].lvl === lvl);

  // ---------- formulas ----------
  HB.hitDmg = (atk, def) => Math.max(1, atk + rnd(0, Math.floor(atk / 2)) - def);
  HB.effAtk = (P, buffed) => (buffed ? Math.round(P.atk * 1.5) : P.atk);
  HB.elemMul = (f, el) => (el && f.weak === el ? 1.5 : el && f.resist === el ? 0.5 : 1);
  HB.chimeDmg = (P, f) => Math.max(1, Math.round((4 + Math.round(P.atk * 0.6) + rnd(0, 3)) * HB.elemMul(f, 'sound'))); // ignores defence
  HB.gustDmg = (P, f, buffed) => Math.max(1, Math.round(HB.hitDmg(Math.round(HB.effAtk(P, buffed) * 1.4), f.def) * HB.elemMul(f, 'wind')));
  // who acts first this round: speed plus a little luck; 'hero' marks the party's turn
  HB.turnOrder = function (P, foes) {
    return [{ who: 'hero', ini: P.spd + rnd(0, 3) }]
      .concat(foes.map((f) => ({ who: f, ini: f.spd + rnd(0, 3) })))
      .sort((a, b) => b.ini - a.ini).map((e) => e.who);
  };
  HB.healAmt = (P) => 15 + P.lvl * 3 + rnd(0, 3);
  HB.critChance = 0.1;

  // what a foe does this turn: 'attack' | 'swallow' | 'wave' | 'silence'
  HB.foeIntent = function (f, turn, P, silenced) {
    if (f.boss) {
      if (f.hp < f.maxHp / 2 && !silenced && turn % 4 === 1) return 'silence';
      if (turn % 3 === 2) return 'wave';
      return 'attack';
    }
    if (Math.random() < f.swallow && P.mp > 0) return 'swallow';
    return 'attack';
  };
  // damage a foe deals with an attack ('wave' hits harder and ignores guarding)
  HB.foeDmg = function (f, P, intent, guarding) {
    if (intent === 'wave') return Math.round(f.atk * 1.4) + rnd(0, 3);
    const d = HB.hitDmg(f.atk, P.def);
    return guarding ? Math.max(1, Math.floor(d / 2)) : d;
  };

  HB.makeFoe = function (kind) {
    const b = HB.FOES[kind] || HB.FOES.wisp;
    return Object.assign({ kind: kind in HB.FOES ? kind : 'wisp', maxHp: b.hp }, b, { gold: b.gold.slice() });
  };

  HB.useItem = function (P, id) {
    const it = HB.ITEMS[id];
    if (!it || !P.items[id]) return null;
    const before = { hp: P.hp, mp: P.mp }; // cure is applied by the battle, which owns 침묵
    if (it.hp) P.hp = Math.min(P.maxHp, P.hp + it.hp);
    if (it.mp) P.mp = Math.min(P.maxMp, P.mp + it.mp);
    if (--P.items[id] <= 0) delete P.items[id];
    return { hp: P.hp - before.hp, mp: P.mp - before.mp };
  };
  HB.buyItem = function (P, id) {
    const it = HB.ITEMS[id];
    if (!it || P.gold < it.price) return false;
    P.gold -= it.price;
    P.items[id] = (P.items[id] || 0) + 1;
    return true;
  };

  // ---------- save data ----------
  const SAVE_KEY = 'hourbell.save1';
  HB.SAVE_VERSION = 1;
  HB.saveGame = function (store, data) {
    try { store.setItem(SAVE_KEY, JSON.stringify(Object.assign({ v: HB.SAVE_VERSION }, data))); return true; } catch (e) { return false; }
  };
  HB.loadGame = function (store) {
    try {
      const d = JSON.parse(store.getItem(SAVE_KEY));
      if (!d || d.v !== HB.SAVE_VERSION || !d.party) return null;
      d.party = Object.assign(HB.newParty(), d.party); // fields added later get defaults
      return d;
    } catch (e) { return null; }
  };
})(window.HB);
