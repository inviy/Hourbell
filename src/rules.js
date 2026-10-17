// Game rules: party growth, foes, items, damage and save data.
// Pure data and math (no canvas, no audio) so tests/rules.test.mjs can
// balance-check it in node.
(function (HB) {
  'use strict';

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  HB.rnd = rnd;

  HB.newParty = () => ({
    name: '리안', lvl: 1, exp: 0, hp: 40, maxHp: 40, mp: 12, maxMp: 12,
    atk: 6, def: 2, spd: 6, gold: 0, items: { herb: 2 }, time: 0, battles: 0,
    equip: { weapon: 'staff', armor: 'cloth', charm: null },
    kills: {}, ally: null // ally: { id, hp } once a companion joins
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
    windflower: { name: '바람꽃', key: true, price: 0, desc: '풍경 숲에서 꺾은 꽃. 바람이 불지 않아도 흔들린다.' },
    water: { name: '맑은물', cure: true, price: 10, desc: '침묵을 풀어 준다. (전투 중)' },
    // equipment: slot + stat bonuses
    staff: { name: '연습용 종채', slot: 'weapon', atk: 2, price: 10, desc: '공격 +2' },
    mallet: { name: '청동 종채', slot: 'weapon', atk: 5, price: 60, desc: '공격 +5' },
    plume: { name: '바람깃 종채', slot: 'weapon', atk: 9, spd: 1, price: 200, desc: '공격 +9, 속도 +1' },
    cloth: { name: '여행복', slot: 'armor', def: 1, price: 10, desc: '방어 +1' },
    vest: { name: '가죽 조끼', slot: 'armor', def: 3, price: 50, desc: '방어 +3' },
    cloak: { name: '은실 망토', slot: 'armor', def: 6, price: 140, desc: '방어 +6' },
    quill: { name: '깃털 장식', slot: 'charm', spd: 3, price: 40, desc: '속도 +3' },
    amulet: { name: '수호 부적', slot: 'charm', def: 2, price: 45, desc: '방어 +2' }
  };
  HB.SLOTS = { weapon: '무기', armor: '방어구', charm: '장신구' };
  HB.SHOPS = {
    florist: { title: '꽃집 아이라의 가게', stock: ['herb', 'drop', 'water'] },
    smith: { title: '대장장이 브론의 대장간', stock: ['mallet', 'vest', 'cloak', 'quill', 'amulet'] }
  };

  // stats with equipment applied
  HB.eff = function (P) {
    const e = { atk: P.atk, def: P.def, spd: P.spd };
    const eq = P.equip || {};
    for (const slot in eq) {
      const it = HB.ITEMS[eq[slot]];
      if (it) for (const k in e) e[k] += it[k] || 0;
    }
    return e;
  };
  // equip an owned item from the bag; whatever was worn goes back in the bag
  HB.equip = function (P, id) {
    const it = HB.ITEMS[id];
    if (!it || !it.slot || !P.items[id]) return false;
    HB.unequip(P, it.slot);
    if (--P.items[id] <= 0) delete P.items[id];
    P.equip[it.slot] = id;
    return true;
  };
  HB.unequip = function (P, slot) {
    const old = P.equip[slot];
    if (old) P.items[old] = (P.items[old] || 0) + 1;
    P.equip[slot] = null;
  };
  HB.sellPrice = (id) => Math.floor(HB.ITEMS[id].price / 2);
  HB.sellItem = function (P, id) {
    if (!HB.ITEMS[id] || !P.items[id] || HB.ITEMS[id].key) return false;
    if (--P.items[id] <= 0) delete P.items[id];
    P.gold += HB.sellPrice(id);
    return true;
  };
  HB.isGear = (id) => !!HB.ITEMS[id].slot;
  HB.isKey = (id) => !!HB.ITEMS[id].key;

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
  HB.effAtk = (P, buffed) => { const a = HB.eff(P).atk; return buffed ? Math.round(a * 1.5) : a; };
  HB.elemMul = (f, el) => (el && f.weak === el ? 1.5 : el && f.resist === el ? 0.5 : 1);
  HB.chimeDmg = (P, f) => Math.max(1, Math.round((4 + Math.round(HB.eff(P).atk * 0.6) + rnd(0, 3)) * HB.elemMul(f, 'sound'))); // ignores defence
  HB.gustDmg = (P, f, buffed) => Math.max(1, Math.round(HB.hitDmg(Math.round(HB.effAtk(P, buffed) * 1.4), f.def) * HB.elemMul(f, 'wind')));
  // who acts first this round: speed plus a little luck; 'hero' marks the party's turn
  HB.turnOrder = function (P, foes, ally) {
    const order = [{ who: 'hero', ini: HB.eff(P).spd + rnd(0, 3) }]
      .concat(foes.map((f) => ({ who: f, ini: f.spd + rnd(0, 3) })));
    if (ally && ally.hp > 0) order.push({ who: 'ally', ini: ally.spd + rnd(0, 3) });
    return order.sort((a, b) => b.ini - a.ini).map((e) => e.who);
  };

  // ---------- companions ----------
  // [base, per level]; companions grow with the hero's level
  HB.ALLIES = {
    mio: { name: '미오', pal: 'bard', hp: [22, 5], atk: [3, 1], def: [2, 1], spd: [7, 0.5] }
  };
  HB.allyStats = function (id, lvl) {
    const a = HB.ALLIES[id], s = (k) => Math.round(a[k][0] + a[k][1] * (lvl - 1));
    return { id, name: a.name, pal: a.pal, maxHp: s('hp'), atk: s('atk'), def: s('def'), spd: s('spd') };
  };
  HB.songAmt = (lvl) => 6 + lvl + rnd(0, 3);
  // the companion sings to whoever is hurt (not while silenced, and not two
  // turns running), otherwise hits the weakest foe
  HB.allyIntent = function (a, P, foes, silenced) {
    const hurt = [P, a].filter((x) => x.hp > 0 && x.hp < x.maxHp * 0.45).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
    if (hurt.length && !silenced && !a.sang) return { act: 'song', target: hurt[0] };
    const t = foes.slice().sort((x, y) => x.hp - y.hp)[0];
    return { act: 'attack', target: t };
  };
  // foes pick the hero or the companion; boss waves hit everyone
  HB.foeTarget = (ally) => (ally && ally.hp > 0 && Math.random() < 0.4 ? 'ally' : 'hero');
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
    const d = HB.hitDmg(f.atk, HB.eff(P).def);
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

  // ---------- options ----------
  // text: 0 slow, 1 normal, 2 fast. shake / flash: comfort switches
  HB.OPTION_DEFAULTS = { music: 7, sfx: 8, text: 1, shake: true, flash: true };
  // stored options may be old or hand-edited: keep known keys with sane values
  HB.sanitizeOptions = function (o) {
    const out = Object.assign({}, HB.OPTION_DEFAULTS);
    if (!o || typeof o !== 'object') return out;
    for (const k of ['music', 'sfx']) if (Number.isFinite(o[k])) out[k] = Math.max(0, Math.min(10, Math.round(o[k])));
    if ([0, 1, 2].includes(o.text)) out.text = o.text;
    for (const k of ['shake', 'flash']) if (typeof o[k] === 'boolean') out[k] = o[k];
    return out;
  };
  HB.options = HB.sanitizeOptions();

  // ---------- save data ----------
  const SAVE_KEY = 'hourbell.save1';
  HB.SAVE_VERSION = 2;
  // v1 (v0.2/v0.3) had no equipment: base 공격 / 방어 included what the
  // starting staff and clothes now give
  const MIGRATE = {
    1(d) {
      if ('atk' in d.party) d.party.atk -= 2;
      if ('def' in d.party) d.party.def -= 1;
      d.party.equip = { weapon: 'staff', armor: 'cloth', charm: null };
    }
  };
  HB.saveGame = function (store, data) {
    try { store.setItem(SAVE_KEY, JSON.stringify(Object.assign({ v: HB.SAVE_VERSION }, data))); return true; } catch (e) { return false; }
  };
  HB.loadGame = function (store) {
    try {
      const d = JSON.parse(store.getItem(SAVE_KEY));
      if (!d || !d.party) return null;
      while (d.v < HB.SAVE_VERSION && MIGRATE[d.v]) MIGRATE[d.v++](d);
      if (d.v !== HB.SAVE_VERSION) return null;
      d.party = Object.assign(HB.newParty(), d.party); // fields added later get defaults
      return d;
    } catch (e) { return null; }
  };
})(window.HB);
