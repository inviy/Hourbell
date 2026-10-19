// Game rules: party growth, foes, items, damage and save data.
// Pure data and math (no canvas, no audio) so tests/rules.test.mjs can
// balance-check it in node.
(function (HB) {
  'use strict';

  // every roll that decides a fight goes through HB.rand; HB.seedRandom(n)
  // makes a run repeat exactly (tests, replaying a reported fight)
  HB.rand = Math.random;
  HB.seedRandom = (seed) => { HB.rand = HB.rng(seed); };
  const rnd = (a, b) => a + Math.floor(HB.rand() * (b - a + 1));
  HB.rnd = rnd;

  HB.newParty = () => ({
    name: '리안', lvl: 1, exp: 0, hp: 40, maxHp: 40, mp: 12, maxMp: 12,
    atk: 6, def: 2, spd: 6, gold: 0, items: { herb: 3, water: 1 }, time: 0, battles: 0,
    equip: { weapon: 'staff', head: null, armor: 'cloth', hands: null, feet: null, charm: null, score: null },
    kills: {}, allies: [], pet: null // allies: [{ id, hp }] as companions join (up to 3)
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
  // trait: each family's own move (HB.foeIntent): curl (golems, crabs),
  // double (bats), flee (떨림이), mend (jellies), burst (stars)
  HB.FOES = {
    wisp: { name: '소리먹이', hp: 18, atk: 6, def: 1, spd: 5, exp: 4, gold: [4, 7], drop: ['herb', 0.25], swallow: 0.22, weak: 'sound' },
    flicker: { name: '떨림이', hp: 12, atk: 5, def: 0, spd: 9, exp: 4, gold: [5, 10], drop: ['drop', 0.35], swallow: 0.45, weak: 'wind', resist: 'sound', trait: 'flee' },
    guard: { name: '울림삼킴이', hp: 34, atk: 9, def: 3, spd: 3, exp: 12, gold: [14, 20], drop: ['herb2', 0.6], swallow: 0.15, resist: 'wind', trait: 'curl' },
    boss: { name: '침묵의 파수꾼', hp: 220, atk: 14, def: 4, spd: 6, exp: 50, gold: [80, 80], drop: ['herb2', 1], swallow: 0, boss: true, weak: 'wind', resist: 'sound',
      flag: 'boss1', waveEvery: 3, silenceEvery: 6, summonAt: 0.3, summon: ['flicker'] }
  };
  // bell fragments held (fragment1 .. fragment7 flags)
  HB.fragments = (flags) => [1, 2, 3, 4, 5, 6, 7].filter((n) => flags && flags['fragment' + n]).length;

  HB.ITEMS = {
    herb: { name: '약초', hp: 30, price: 8, desc: 'HP를 30 회복한다.' },
    herb2: { name: '고급 약초', hp: 70, price: 24, desc: 'HP를 70 회복한다.' },
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
    amulet: { name: '수호 부적', slot: 'charm', def: 2, price: 45, desc: '방어 +2' },
    cap: { name: '가죽 모자', slot: 'head', def: 1, price: 25, desc: '방어 +1' },
    helm: { name: '철 투구', slot: 'head', def: 3, price: 90, desc: '방어 +3' },
    gloves: { name: '작업 장갑', slot: 'hands', atk: 1, price: 20, desc: '공격 +1' },
    tempo: { name: '박자 장갑', slot: 'hands', atk: 2, spd: 1, price: 70, desc: '공격 +2, 속도 +1' },
    sandals: { name: '짚신', slot: 'feet', spd: 1, price: 15, desc: '속도 +1' },
    boots: { name: '바람 장화', slot: 'feet', spd: 3, price: 80, desc: '속도 +3' },
    oldscore: { name: '낡은 악보', slot: 'score', pow: 10, price: 40, desc: '기술 위력 +10%' },
    fieldsong: { name: '들판의 노래', slot: 'score', pow: 20, price: 120, desc: '기술 위력 +20%' }
  };
  // seven slots; pow is skill power in percent (종소리, 바람결, 회복)
  HB.SLOTS = { weapon: '무기', head: '머리', armor: '몸', hands: '손', feet: '발', charm: '장신구', score: '악보' };
  HB.STATS = { atk: '공격', def: '방어', spd: '속도', pow: '기술' };
  HB.SHOPS = {
    florist: { title: '꽃집 아이라의 가게', stock: ['herb', 'herb2', 'drop', 'water'] },
    smith: { title: '대장장이 브론의 대장간', stock: ['mallet', 'cap', 'helm', 'vest', 'cloak', 'gloves', 'tempo', 'sandals', 'boots', 'quill', 'amulet', 'oldscore', 'fieldsong'] }
  };

  // stats with equipment applied
  HB.eff = function (P) {
    const e = { atk: P.atk, def: P.def, spd: P.spd, pow: 0 };
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
  const powMul = (P) => 1 + HB.eff(P).pow / 100;
  HB.chimeDmg = (P, f) => Math.max(1, Math.round((4 + Math.round(HB.eff(P).atk * 0.6) + rnd(0, 3)) * HB.elemMul(f, 'sound') * powMul(P))); // ignores defence
  HB.gustDmg = (P, f, buffed) => Math.max(1, Math.round(HB.hitDmg(Math.round(HB.effAtk(P, buffed) * 1.4), f.def) * HB.elemMul(f, 'wind') * powMul(P)));
  // who acts first this round: speed plus a little luck; 'hero' marks the party's turn
  // allies are battle objects ({ isAlly: true, hp, spd, ... })
  HB.turnOrder = function (P, foes, allies) {
    return [{ who: 'hero', ini: HB.eff(P).spd + rnd(0, 3) }]
      .concat(foes.map((f) => ({ who: f, ini: f.spd + rnd(0, 3) })))
      .concat((allies || []).filter((a) => a.hp > 0).map((a) => ({ who: a, ini: a.spd + rnd(0, 3) })))
      .sort((a, b) => b.ini - a.ini).map((e) => e.who);
  };

  // ---------- companions ----------
  // [base, per level]; companions grow with the hero's level.
  // role: healer sings to the hurt, fighter hits hard and covers a hero in
  // trouble, caster aims at the element a foe is weak to
  HB.ALLIES = {
    mio: { name: '미오', pal: 'bard', role: 'healer', hp: [22, 5], atk: [3, 1], def: [2, 1], spd: [7, 0.5] },
    dan: { name: '단비', pal: 'smithgirl', role: 'fighter', hp: [30, 7], atk: [5, 1.6], def: [4, 1.2], spd: [4, 0.4] },
    haru: { name: '하루', pal: 'apprentice', role: 'caster', hp: [20, 4.5], atk: [4, 1.3], def: [1, 0.8], spd: [8, 0.6] }
  };
  HB.MAX_ALLIES = 3;
  HB.allyStats = function (id, lvl) {
    const a = HB.ALLIES[id], s = (k) => Math.round(a[k][0] + a[k][1] * (lvl - 1));
    return { id, isAlly: true, name: a.name, pal: a.pal, role: a.role, maxHp: s('hp'), atk: s('atk'), def: s('def'), spd: s('spd') };
  };
  HB.songAmt = (lvl) => 6 + lvl + rnd(0, 3);
  HB.spellDmg = (a, f, el) => Math.max(1, Math.round((4 + a.atk * 1.2 + rnd(0, 3)) * HB.elemMul(f, el))); // ignores defence
  // party: [hero, ...allies]. Returns { act: 'song' | 'cover' | 'spell' | 'attack', target, el }
  HB.allyIntent = function (a, party, foes, silenced) {
    const hurt = party.filter((x) => x.hp > 0 && x.hp < x.maxHp * 0.45).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
    const weakest = foes.slice().sort((x, y) => x.hp - y.hp)[0];
    if (a.role === 'healer' && hurt.length && !silenced && !a.sang) return { act: 'song', target: hurt[0] };
    if (a.role === 'fighter') {
      const hero = party[0];
      if (hero.hp > 0 && hero.hp < hero.maxHp * 0.35 && !a.covered) return { act: 'cover' };
      return { act: 'attack', target: foes.slice().sort((x, y) => y.atk - x.atk)[0] };
    }
    if (a.role === 'caster' && !silenced) {
      for (const el of ['wind', 'sound']) { const t = foes.find((f) => f.weak === el); if (t) return { act: 'spell', target: t, el }; }
      const t = foes.find((f) => f.resist !== 'sound') || weakest;
      return { act: 'spell', target: t, el: t.resist === 'sound' ? null : 'sound' };
    }
    return { act: 'attack', target: weakest };
  };
  // foes pick a target: a covering fighter draws every hit, otherwise the
  // hero takes 40% and the companions share the rest
  HB.foeTarget = function (allies) {
    const up = (allies || []).filter((a) => a.hp > 0);
    const cover = up.find((a) => a.covering);
    if (cover) return cover;
    if (!up.length || HB.rand() < 0.4) return 'hero';
    return up[Math.floor(HB.rand() * up.length)];
  };

  // ---------- pet ----------
  // the pet stays out of the fighting (boss fights are close races, even a
  // tiny helper tips them); it finds things after battles and mends you on walks
  HB.PETS = { pip: { name: '방울', desc: '정화된 아기 소리먹이. 전투 뒤에 물건을 물어 오고, 걷는 동안 HP를 조금씩 채워 준다.' } };
  HB.PET_FIND = 0.35;
  HB.petFind = function (lvl) {
    if (HB.rand() >= HB.PET_FIND) return null;
    const r = HB.rand();
    if (r < 0.55) return { item: 'herb' };
    if (r < 0.8) return { item: 'drop' };
    if (r < 0.9) return { item: 'water' };
    return { gold: 5 + lvl * 2 };
  };
  HB.PET_REGEN = 3; // seconds per HP while walking

  // ---------- auto battle ----------
  // what the hero does on auto; the balance tests play with the same picks.
  // c: { silenced, buff, waveNext, hold }. hold: a boss will undo or send back
  // this round's damage (echo, rewind), so wait it out
  HB.autoPick = function (P, foes, c) {
    const can = (id) => HB.skillsFor(P.lvl).includes(id) && !c.silenced && P.mp >= HB.SKILLS[id].cost;
    const low = P.hp < P.maxHp * 0.45;
    if (c.waveNext && P.hp < P.maxHp * 0.8) return { act: 'guard' };
    if (low && can('heal')) return { act: 'skill', id: 'heal' };
    if (c.hold) return { act: 'guard' };
    const best = (stat) => Object.keys(P.items).filter((k) => P.items[k] > 0 && HB.ITEMS[k][stat] && !HB.ITEMS[k].slot).sort((a, b) => HB.ITEMS[b][stat] - HB.ITEMS[a][stat])[0];
    if (low) { const it = best('hp'); if (it) return { act: 'item', id: it }; }
    if (P.mp < 4 && P.lvl >= 3) { const it = best('mp'); if (it) return { act: 'item', id: it }; }
    if (c.silenced && P.items.water) return { act: 'item', id: 'water' };
    if (c.fog && can('chime')) return { act: 'skill', id: 'chime' }; // sound clears the fog
    if (c.fog && can('gust')) return { act: 'skill', id: 'gust', target: foes.find((f) => f.weak === 'wind') || foes[0] };
    if (can('ring') && !c.buff && foes.some((f) => f.boss)) return { act: 'skill', id: 'ring' };
    if (foes.length > 1 && can('chime') && foes.filter((f) => f.resist !== 'sound').length > 1) return { act: 'skill', id: 'chime' };
    const open = foes.filter((f) => !f.curl); // leave a curled-up foe for later
    if (open.length) foes = open;
    const t = foes.find((f) => f.weak === 'wind') || foes[0];
    if (can('gust') && t.resist !== 'wind') return { act: 'skill', id: 'gust', target: t };
    return { act: 'attack', target: t };
  };
  HB.healAmt = (P) => Math.round((15 + P.lvl * 3 + rnd(0, 3)) * powMul(P));
  HB.critChance = 0.1;

  // what a foe does this turn: 'attack' | 'swallow' | 'wave' | 'silence' | 'fog'.
  // Patterns are data: waveEvery (the battle warns a turn ahead), silenceEvery
  // (below half HP), fogEvery; per boss: summonAt + summon (kinds it calls),
  // rewindAt, echoEvery, fogMend (HP share healed each turn in its fog).
  // ctx: { silenced, fog }
  // foeWarn decides the big moves at the start of a round, so the battle can
  // warn about them and the foe does exactly what was warned
  HB.waveNext = (f, turn) => !!f.waveEvery && turn % f.waveEvery === f.waveEvery - 1;
  HB.foeWarn = function (f, turn, ctx) {
    ctx = ctx || {};
    if (HB.waveNext(f, turn)) return 'wave';
    if (f.fogEvery && !ctx.fog && turn % f.fogEvery === 1) return 'fog';
    if (f.silenceEvery && f.hp < f.maxHp / 2 && !ctx.silenced && turn % f.silenceEvery === 0) return 'silence';
    // each boss's own move, once: calls helpers / winds back this round's wounds
    if (f.summon && !f.summoned && f.hp < f.maxHp * f.summonAt) return 'summon';
    if (f.rewindAt && !f.rewound && f.hp < f.maxHp * f.rewindAt) return 'rewind';
    return null;
  };
  // 메아리왕: some rounds it gathers echoes, and half of what the hero deals comes back
  HB.echoNow = (f, turn) => !!f.echoEvery && turn % f.echoEvery === 1;
  HB.ECHO = 0.15;
  // 시간갉기 winds back part of the wounds it took this round (roundHp: its HP when the round began)
  HB.REWIND = 0.5;
  HB.rewindAmt = (f) => Math.max(0, Math.round((f.roundHp - f.hp) * HB.REWIND));
  HB.echoBack = (d) => Math.max(1, Math.floor(d * HB.ECHO));
  // warned: foeWarn's pick for this round
  HB.TRAIT = { flee: 0.5, curl: 0.25, double: 0.3, mend: 0.35, burst: 0.6 }; // chances; mend heals and burst hits for these shares
  HB.foeIntent = function (f, P, warned) {
    if (warned) return warned;
    const t = f.trait;
    if (t === 'flee' && f.hp < f.maxHp * 0.35 && HB.rand() < HB.TRAIT.flee) return 'flee';
    if (t === 'mend' && !f.mended && f.hp < f.maxHp / 2) return 'mend';
    if (t === 'burst' && f.hp < f.maxHp * 0.3) return 'burst';
    if (t === 'curl' && HB.rand() < HB.TRAIT.curl) return 'curl';
    if (t === 'double' && HB.rand() < HB.TRAIT.double) return 'double';
    if (!f.boss && HB.rand() < (f.swallow || 0) && P.mp > 0) return 'swallow';
    return 'attack';
  };
  // fog: rounds it lasts; plain hits are halved until a sound or wind skill clears it
  HB.FOG_TURNS = 3;
  HB.fogged = (d, fog) => (fog ? Math.max(1, Math.floor(d / 2)) : d);
  // a curled-up foe takes half until its next turn
  HB.curled = (f, d) => (f.curl ? Math.max(1, Math.floor(d / 2)) : d);
  // damage a foe deals ('wave' and a star's 'burst' ignore defence, each of a
  // bat's 'double' hits is lighter; guarding halves all; 쉬움 takes a quarter off)
  HB.EASY = 0.75;
  HB.foeDmg = function (f, P, intent, guarding) {
    let d = intent === 'wave' ? Math.round(f.atk * (f.waveMul || 1.2)) + rnd(0, 3)
      : intent === 'burst' ? Math.round(f.atk * HB.TRAIT.burst) + rnd(0, 3) : HB.hitDmg(f.atk, HB.eff(P).def);
    if (intent === 'double') d = Math.max(1, Math.round(d * 0.6));
    if (HB.options.easy) d = Math.max(1, Math.round(d * HB.EASY));
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
  HB.OPTION_DEFAULTS = { music: 7, sfx: 8, text: 1, shake: true, flash: true, easy: false };
  // stored options may be old or hand-edited: keep known keys with sane values
  HB.sanitizeOptions = function (o) {
    const out = Object.assign({}, HB.OPTION_DEFAULTS);
    if (!o || typeof o !== 'object') return out;
    for (const k of ['music', 'sfx']) if (Number.isFinite(o[k])) out[k] = Math.max(0, Math.min(10, Math.round(o[k])));
    if ([0, 1, 2].includes(o.text)) out.text = o.text;
    for (const k of ['shake', 'flash', 'easy']) if (typeof o[k] === 'boolean') out[k] = o[k];
    return out;
  };
  HB.options = HB.sanitizeOptions();

  // ---------- save data ----------
  const SAVE_KEY = 'hourbell.save1';
  HB.SAVE_VERSION = 3;
  // v1 (v0.2/v0.3) had no equipment: base 공격 / 방어 included what the
  // starting staff and clothes now give
  const MIGRATE = {
    1(d) {
      if ('atk' in d.party) d.party.atk -= 2;
      if ('def' in d.party) d.party.def -= 1;
      d.party.equip = { weapon: 'staff', armor: 'cloth', charm: null };
    },
    // v2 had one companion and three equipment slots; v3 has a party list,
    // seven slots and a pet (given to anyone who already holds the first fragment)
    2(d) {
      const P = d.party;
      P.allies = P.ally ? [P.ally] : [];
      delete P.ally;
      P.equip = Object.assign({ weapon: null, head: null, armor: null, hands: null, feet: null, charm: null, score: null }, P.equip);
      if (d.flags && d.flags.fragment1) P.pet = 'pip';
    }
  };
  // the save before the current one is kept under BACKUP_KEY, and a damaged
  // save falls back to it. Only a save that still reads is kept as the backup.
  const BACKUP_KEY = SAVE_KEY + '.bak';
  function readSave(raw) {
    try {
      const d = JSON.parse(raw);
      if (!d || !d.party) return null;
      while (d.v < HB.SAVE_VERSION && MIGRATE[d.v]) MIGRATE[d.v++](d);
      if (d.v !== HB.SAVE_VERSION) return null;
      d.party = Object.assign(HB.newParty(), d.party); // fields added later get defaults
      return d;
    } catch (e) { return null; }
  }
  function writeSave(store, raw) {
    try {
      const prev = store.getItem(SAVE_KEY);
      if (prev && prev !== raw && readSave(prev)) store.setItem(BACKUP_KEY, prev);
    } catch (e) { /* no backup this time; the save itself still goes ahead */ }
    store.setItem(SAVE_KEY, raw);
  }
  HB.saveGame = function (store, data) {
    try { writeSave(store, JSON.stringify(Object.assign({ v: HB.SAVE_VERSION }, data))); return true; } catch (e) { return false; }
  };
  // a save as text, to carry to another device without a server: 'HB1-' + base64
  HB.saveCode = function (store) {
    try {
      const raw = store.getItem(SAVE_KEY);
      return raw ? 'HB1-' + btoa(unescape(encodeURIComponent(raw))) : null;
    } catch (e) { return null; }
  };
  // a pasted code replaces the save only if it reads back as a real save
  HB.useSaveCode = function (store, code) {
    try {
      const m = /HB1-([A-Za-z0-9+/=]+)/.exec(String(code).replace(/\s/g, ''));
      const raw = m && decodeURIComponent(escape(atob(m[1])));
      const d = raw && readSave(raw);
      if (!d || (HB.MAPS && !HB.MAPS[d.map])) return false;
      writeSave(store, raw);
      return true;
    } catch (e) { return false; }
  };
  HB.loadGame = function (store) {
    try { return readSave(store.getItem(SAVE_KEY)) || readSave(store.getItem(BACKUP_KEY)); } catch (e) { return null; }
  };
})(window.HB);
