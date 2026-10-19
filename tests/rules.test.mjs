// Rules and balance checks. Run: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHB, partyAt as party, fight as play, winRate as rate, winRateAs, mashPick, plainPick } from './sim.mjs';

const HB = loadHB();
const partyAt = (lvl, herbs, opts) => party(HB, lvl, herbs, opts);
const winRate = (lvl, herbs, kinds, opts, n) => rate(HB, lvl, herbs, kinds, opts, n);
const memStore = () => { const mem = {}; return { mem, setItem: (k, v) => { mem[k] = v; }, getItem: (k) => mem[k] ?? null }; };

test('exp curve and growth rise every level', () => {
  for (let l = 1; l < 30; l++) assert.ok(HB.expToNext(l + 1) > HB.expToNext(l));
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

test('turn order: faster acts first more often, everyone acts once', () => {
  let first = 0;
  for (let i = 0; i < 2000; i++) if (HB.turnOrder({ spd: 6 }, [HB.makeFoe('flicker')])[0] !== 'hero') first++;
  assert.ok(first / 2000 > 0.7, 'flicker (spd 9) usually beats a level 1 hero');
  const team = ['mio', 'dan', 'haru'].map((id) => Object.assign(HB.allyStats(id, 5), { hp: 10 }));
  team[1].hp = 0;
  for (let i = 0; i < 200; i++) assert.equal(HB.turnOrder({ spd: 6 }, [HB.makeFoe('wisp'), HB.makeFoe('guard')], team).length, 5, 'fallen companions skip');
});

test('damage is never below 1', () => {
  for (let i = 0; i < 500; i++) assert.ok(HB.hitDmg(1, 99) >= 1);
  const boss = HB.makeFoe('boss');
  for (let i = 0; i < 500; i++) assert.ok(HB.foeDmg(boss, { def: 99 }, 'attack', true) >= 1);
  for (let i = 0; i < 500; i++) assert.ok(HB.chimeDmg({ atk: 1 }, boss) >= 1 && HB.gustDmg({ atk: 1 }, { def: 99 }) >= 1 && HB.spellDmg({ atk: 1 }, boss, 'sound') >= 1);
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

test('save codes carry a save to another device, and bad codes change nothing', () => {
  const pc = memStore(), phone = memStore();
  assert.equal(HB.saveCode(pc), null, 'no save, no code');
  const P = partyAt(7, 2);
  P.gold = 12345;
  assert.ok(HB.saveGame(pc, { party: P, flags: { fragment1: true, chapter1: true }, map: 'port', x: 5, y: 6, dir: 'up' }));
  const code = HB.saveCode(pc);
  assert.match(code, /^HB1-[A-Za-z0-9+/=]+$/);
  // pasted with a line break and a stray label, as chat apps do
  assert.ok(HB.useSaveCode(phone, '세이브: ' + code.slice(0, 20) + '\n' + code.slice(20)));
  const d = HB.loadGame(phone);
  assert.equal(d.party.lvl, 7);
  assert.equal(d.party.gold, 12345);
  assert.equal(d.party.name, '리안', 'Korean text survives');
  assert.equal(d.map, 'port');
  const before = phone.mem['hourbell.save1'];
  for (const bad of ['', 'hello', 'HB1-', 'HB1-%%%', 'HB1-' + code.slice(4, 30), 'HB1-' + btoa('{"v":99,"party":{}}')]) {
    assert.equal(HB.useSaveCode(phone, bad), false, 'refused: ' + bad.slice(0, 12));
  }
  assert.equal(phone.mem['hourbell.save1'], before, 'the old save is untouched');
});

test('save round trip, bad data and newer versions', () => {
  const store = memStore();
  assert.equal(HB.loadGame(store), null);
  const P = partyAt(3, 2);
  assert.ok(HB.saveGame(store, { party: P, flags: { fragment1: true }, map: 'field', x: 10, y: 20, dir: 'up' }));
  const d = HB.loadGame(store);
  assert.equal(d.party.lvl, 3);
  assert.equal(d.flags.fragment1, true);
  store.mem['hourbell.save1'] = '{broken';
  assert.equal(HB.loadGame(store), null);
  store.mem['hourbell.save1'] = JSON.stringify({ v: HB.SAVE_VERSION, party: { lvl: 2 } });
  assert.equal(HB.eff(HB.loadGame(store).party).atk, 8, 'missing fields fall back to defaults');
  store.mem['hourbell.save1'] = JSON.stringify({ v: 99, party: { lvl: 2 } });
  assert.equal(HB.loadGame(store), null, 'saves from a newer version are refused');
  const full = { setItem() { throw new Error('quota'); } };
  assert.equal(HB.saveGame(full, { party: P }), false);
});

test('save migration v1 -> current keeps effective stats', () => {
  const store = memStore();
  store.mem['hourbell.save1'] = JSON.stringify({ v: 1, party: { lvl: 4, atk: 15, def: 6, spd: 9, items: { herb: 1 } }, flags: {} });
  const d = HB.loadGame(store);
  assert.equal(d.v, HB.SAVE_VERSION);
  assert.deepEqual({ ...HB.eff(d.party) }, { atk: 15, def: 6, spd: 9, pow: 0 });
  assert.equal(d.party.equip.weapon, 'staff');
});

test('save migration v2 -> v3: one companion becomes a party list, pet for fragment holders', () => {
  const store = memStore();
  store.mem['hourbell.save1'] = JSON.stringify({
    v: 2, flags: { fragment1: true, mioJoined: true },
    party: { lvl: 5, atk: 14, def: 6, spd: 10, ally: { id: 'mio', hp: 17 }, equip: { weapon: 'mallet', armor: 'vest', charm: 'quill' } }
  });
  const d = HB.loadGame(store);
  assert.equal(d.party.ally, undefined);
  assert.deepEqual([...d.party.allies].map((a) => ({ ...a })), [{ id: 'mio', hp: 17 }]);
  assert.equal(d.party.pet, 'pip');
  assert.equal(d.party.equip.weapon, 'mallet');
  assert.ok('score' in d.party.equip && d.party.equip.head === null);
  store.mem['hourbell.save1'] = JSON.stringify({ v: 2, flags: {}, party: { lvl: 1 } });
  assert.equal(HB.loadGame(store).party.pet, null, 'no fragment, no pet yet');
});

test('equipment: seven slots, swap back to the bag, unequip', () => {
  assert.equal(Object.keys(HB.SLOTS).length, 7);
  for (const id in HB.ITEMS) if (HB.ITEMS[id].slot) assert.ok(HB.SLOTS[HB.ITEMS[id].slot], id + ' has a real slot');
  for (const slot in HB.SLOTS) assert.ok(Object.values(HB.ITEMS).some((it) => it.slot === slot), 'something to wear in ' + slot);
  const P = HB.newParty();
  assert.equal(HB.eff(P).atk, 8);
  assert.ok(!HB.equip(P, 'mallet'), 'cannot equip what you do not own');
  P.items.mallet = 1;
  assert.ok(HB.equip(P, 'mallet'));
  assert.equal(HB.eff(P).atk, P.atk + 5);
  assert.equal(P.items.staff, 1, 'old weapon returns to the bag');
  P.items.quill = 1; HB.equip(P, 'quill');
  assert.equal(HB.eff(P).spd, P.spd + 3);
  HB.unequip(P, 'charm');
  assert.equal(HB.eff(P).spd, P.spd);
  assert.equal(P.items.quill, 1);
});

test('a score raises skill power', () => {
  const P = partyAt(5, 0), boss = HB.makeFoe('boss');
  const avg = (fn) => { let s = 0; for (let i = 0; i < 3000; i++) s += fn(); return s / 3000; };
  const before = avg(() => HB.healAmt(P)), chime0 = avg(() => HB.chimeDmg(P, boss));
  P.items.fieldsong = 1; HB.equip(P, 'fieldsong');
  assert.ok(avg(() => HB.healAmt(P)) > before * 1.15);
  assert.ok(avg(() => HB.chimeDmg(P, boss)) > chime0 * 1.1);
});

test('economy: selling never makes money, and gear is a goal', () => {
  for (const id in HB.ITEMS) if (!HB.isKey(id)) assert.ok(HB.sellPrice(id) < HB.ITEMS[id].price, id);
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
  const smith = HB.SHOPS.smith.stock.reduce((s, id) => s + HB.ITEMS[id].price, 0);
  assert.ok(goldAtLv4 >= HB.ITEMS.mallet.price + 2 * HB.ITEMS.herb.price, 'one upgrade by the boss: ' + goldAtLv4.toFixed(0));
  assert.ok(goldAtLv4 < smith / 3, 'but not the whole shop');
});

test('balance: gear helps but does not replace levels', () => {
  const gear = ['mallet', 'vest'];
  const plain = winRate(3, 3, ['boss']), geared = winRate(3, 3, ['boss'], { gear }), early = winRate(2, 3, ['boss'], { gear });
  console.log('boss at Lv3 plain / geared, Lv2 geared:', plain, geared, early);
  assert.ok(geared > plain + 0.1, 'gear should help');
  assert.ok(early < 0.3, 'level 2 is still too early even with gear');
});

test('balance: field foes are fair, and levels matter', () => {
  assert.ok(winRate(1, 2, ['wisp', 'wisp', 'flicker']) > 0.95, 'a careful level 1 survives a pack');
  const pack = ['guard', 'wisp', 'flicker'];
  assert.ok(winRate(1, 0, pack, { bare: true }, 1000) < 0.2, 'level 1 cannot just mash attack on a guard pack');
  assert.ok(winRate(3, 0, pack, { bare: true }, 1000) > 0.9, 'level 3 can');
});

test('balance: the boss asks for a few levels', () => {
  const r = [1, 2, 3, 4, 5, 6].map((l) => winRate(l, 3, ['boss']));
  console.log('boss win rate by level 1-6:', r.map((x) => x.toFixed(2)).join(' '));
  assert.ok(r[1] < 0.1, 'level 2 should almost never win');
  // playtest: the boss felt too hard, so level 3 should have a fair chance
  assert.ok(r[2] > 0.3 && r[2] < 0.8, 'level 3 has a fair chance: ' + r[2]);
  assert.ok(r[3] > 0.85, 'level 4 should usually win');
});

test('balance: the chapter one boss without the wind trick', () => {
  // the boss teaches its wind weakness: herbs carry you at level 6, bare attacks need level 7
  const plain6 = winRateAs(HB, plainPick(HB), 6, ['boss'], { items: { herb: 3 } }, 1000), mash7 = winRateAs(HB, mashPick(), 7, ['boss'], {}, 1000);
  console.log('chapter 1 boss, attack + herbs Lv6:', plain6.toFixed(2), ' attack only Lv7:', mash7.toFixed(2));
  assert.ok(plain6 > 0.85, 'attacking and healing when low is enough at level 6');
  assert.ok(mash7 > 0.55, 'pressing 공격 with no items is enough at level 7');
});

test('balance: hitting the boss weakness matters', () => {
  const withWeak = winRate(3, 3, ['boss']);
  const weak = HB.FOES.boss.weak;
  delete HB.FOES.boss.weak;
  const without = winRate(3, 3, ['boss']);
  HB.FOES.boss.weak = weak;
  assert.ok(withWeak > without + 0.1, 'weak ' + withWeak + ' vs none ' + without);
});

test('companions: roles do what they say', () => {
  const P = partyAt(5, 0), wisp = HB.makeFoe('wisp'), flicker = HB.makeFoe('flicker');
  const make = (id) => Object.assign(HB.allyStats(id, 5), { hp: HB.allyStats(id, 5).maxHp });
  const mio = make('mio'), dan = make('dan'), haru = make('haru');
  P.hp = 5;
  assert.equal(HB.allyIntent(mio, [P, mio], [wisp], false).act, 'song');
  mio.sang = true;
  assert.equal(HB.allyIntent(mio, [P, mio], [wisp], false).act, 'attack', 'not twice in a row');
  mio.sang = false;
  assert.equal(HB.allyIntent(mio, [P, mio], [wisp], true).act, 'attack', 'silence stops her song');
  assert.equal(HB.allyIntent(dan, [P, dan], [wisp], false).act, 'cover', 'the fighter covers a hero in trouble');
  dan.covering = true;
  for (let i = 0; i < 50; i++) assert.equal(HB.foeTarget([mio, dan]), dan, 'a covering fighter draws every hit');
  const spell = HB.allyIntent(haru, [P, haru], [wisp, flicker], false);
  assert.equal(spell.act, 'spell');
  assert.equal(spell.target, flicker, 'the caster goes for a weakness');
  assert.equal(spell.el, 'wind');
  assert.equal(HB.allyIntent(haru, [P, haru], [wisp], true).act, 'attack', 'silence stops his spells');
});

test('companions: each one helps, a full party more, and levels still matter', () => {
  const solo = winRate(3, 3, ['boss']);
  const r = {};
  for (const id of ['mio', 'dan', 'haru']) r[id] = winRate(3, 3, ['boss'], { allies: [id] });
  const full = winRate(3, 3, ['boss'], { allies: ['mio', 'dan', 'haru'] });
  // only 미오 can join before the first boss (단비 and 하루 come in chapters 3 and 4)
  const early = winRate(2, 3, ['boss'], { allies: ['mio'] });
  console.log('boss Lv3 solo', solo, 'with', JSON.stringify(r), 'full party', full, 'Lv2 with 미오', early);
  for (const id in r) assert.ok(r[id] > solo + 0.05, id + ' should help');
  assert.ok(full >= Math.max(...Object.values(r)) - 0.02, 'three are at least as good as one');
  assert.ok(early < 0.35, 'Lv2 is still too early for the first boss');
});

test('pet: finds things about a third of the time, never gear', () => {
  let found = 0, gold = 0;
  for (let i = 0; i < 6000; i++) {
    const f = HB.petFind(5);
    if (!f) continue;
    found++;
    if (f.gold) gold++;
    else assert.ok(HB.ITEMS[f.item] && !HB.isGear(f.item), f.item);
  }
  assert.ok(Math.abs(found / 6000 - HB.PET_FIND) < 0.03);
  assert.ok(gold > 0 && gold < found / 4);
});

test('auto battle: sensible picks', () => {
  const P = partyAt(5, 2), boss = HB.makeFoe('boss'), wisp = HB.makeFoe('wisp'), flicker = HB.makeFoe('flicker');
  P.hp = Math.round(P.maxHp * 0.6);
  assert.equal(HB.autoPick(P, [boss], { waveNext: true }).act, 'guard', 'brace for a warned wave');
  P.hp = 5;
  assert.equal(HB.autoPick(P, [boss], {}).id, 'heal', 'heal when low');
  P.mp = 0;
  assert.equal(HB.autoPick(P, [boss], {}).id, 'herb', 'out of 울림: use a herb');
  P.hp = P.maxHp; P.mp = P.maxMp; P.items.water = 1;
  assert.equal(HB.autoPick(P, [boss], { silenced: true }).id, 'water', 'cure silence');
  assert.equal(HB.autoPick(P, [wisp, flicker, wisp], {}).id, 'chime', 'chime a group');
  // auto battle wins the fights a player would expect to win
  assert.ok(winRate(4, 3, ['boss']) > 0.9);
});

test('key items cannot be sold', () => {
  const P = HB.newParty(); P.items.windflower = 1;
  assert.ok(!HB.sellItem(P, 'windflower'));
  assert.equal(P.items.windflower, 1);
});

test('options: defaults, clamping and junk', () => {
  assert.deepEqual({ ...HB.sanitizeOptions(null) }, { ...HB.OPTION_DEFAULTS });
  assert.deepEqual({ ...HB.sanitizeOptions('x') }, { ...HB.OPTION_DEFAULTS });
  const o = HB.sanitizeOptions({ music: 15, sfx: -3, text: 5, shake: 'no', flash: false, evil: 1 });
  assert.equal(o.music, 10);
  assert.equal(o.sfx, 0);
  assert.equal(o.text, 1);
  assert.equal(o.shake, true);
  assert.equal(o.flash, false);
  assert.equal(o.evil, undefined);
  assert.equal(HB.sanitizeOptions({ music: 4.6 }).music, 5);
  assert.equal(HB.sanitizeOptions({}).easy, false, 'normal difficulty unless chosen');
  assert.equal(HB.sanitizeOptions({ easy: true }).easy, true);
});

test('쉬움 takes a quarter off foe damage and makes the bosses gentler', () => {
  const boss = HB.makeFoe('boss'), P = partyAt(3, 0);
  HB.seedRandom(7); const normal = Array.from({ length: 200 }, () => HB.foeDmg(boss, P, 'attack', false));
  const lvl3 = winRate(3, 3, ['boss'], {}, 1000);
  HB.options.easy = true;
  try {
    HB.seedRandom(7); const easy = Array.from({ length: 200 }, () => HB.foeDmg(boss, P, 'attack', false));
    easy.forEach((d, i) => assert.equal(d, Math.max(1, Math.round(normal[i] * HB.EASY))));
    assert.ok(HB.foeDmg(boss, { def: 99 }, 'attack', true) >= 1, 'still at least 1');
    const easy3 = winRate(3, 3, ['boss'], {}, 1000), mash = winRateAs(HB, mashPick(), 6, ['boss'], {}, 1000);
    console.log('chapter 1 boss on 쉬움: Lv3', easy3.toFixed(2), '(normal ' + lvl3.toFixed(2) + '), attack only Lv6', mash.toFixed(2));
    assert.ok(easy3 > lvl3 + 0.15, 'level 3 wins clearly more often');
  } finally { HB.options.easy = false; }
});

test('pacing: reaching level 4 takes about two field clears', () => {
  const clear = 4 * HB.FOES.wisp.exp + 2 * HB.FOES.flicker.exp + HB.FOES.guard.exp;
  let need = 0;
  for (let l = 1; l < 4; l++) need += HB.expToNext(l);
  const clears = need / clear;
  assert.ok(clears >= 1.5 && clears <= 3.5, 'clears to Lv4 = ' + clears.toFixed(2));
});

test('a seed replays the same fights exactly', () => {
  const run = () => {
    HB.seedRandom(1234);
    return Array.from({ length: 20 }, () => { const P = partyAt(3, 2); const won = play(HB, P, ['wisp', 'flicker', 'guard'], []); return won + ':' + P.hp; }).join(' ');
  };
  const a = run(), b = run();
  HB.rand = Math.random;
  assert.equal(a, b);
  assert.ok(new Set(a.split(' ')).size > 1, 'and the fights still differ from each other');
});

test('the save before the last one is kept, and a damaged save falls back to it', () => {
  const store = memStore();
  const at = (lvl, map) => ({ party: partyAt(lvl, 0), flags: {}, map, x: 1, y: 1, dir: 'up' });
  // an existing save from before backups still loads on its own
  store.mem['hourbell.save1'] = JSON.stringify(Object.assign({ v: HB.SAVE_VERSION }, at(2, 'town')));
  assert.equal(HB.loadGame(store).party.lvl, 2);
  assert.ok(HB.saveGame(store, at(5, 'field')));
  assert.equal(JSON.parse(store.mem['hourbell.save1.bak']).party.lvl, 2, 'the previous save is the backup');
  store.mem['hourbell.save1'] = '{"v":3,"party":';
  const d = HB.loadGame(store);
  assert.equal(d.party.lvl, 2, 'a damaged save loads the backup');
  assert.ok(HB.saveGame(store, at(6, 'port')));
  assert.equal(JSON.parse(store.mem['hourbell.save1.bak']).party.lvl, 2, 'a damaged save never replaces a good backup');
  assert.equal(HB.loadGame(store).party.lvl, 6);
  const broken = { mem: {}, getItem: () => null, setItem(k, v) { if (k.endsWith('.bak')) throw new Error('quota'); this.mem[k] = v; } };
  broken.getItem = (k) => broken.mem[k] ?? null;
  assert.ok(HB.saveGame(broken, at(3, 'town')) && HB.saveGame(broken, at(4, 'town')), 'a failed backup does not stop the save');
  assert.equal(HB.loadGame(broken).party.lvl, 4);
});

test('a warned big move is what the foe does', () => {
  const f = HB.makeFoe('boss');
  f.fogEvery = 4;
  assert.equal(HB.foeWarn(f, 1, {}), 'fog');
  assert.equal(HB.foeWarn(f, 1, { fog: true }), null, 'no new fog while one hangs');
  assert.equal(HB.foeIntent(f, HB.newParty(), 'fog'), 'fog');
  f.hp = 1;
  assert.equal(HB.foeWarn(f, 6, {}), 'silence', 'below half HP on its turn');
  assert.equal(HB.foeIntent(f, HB.newParty(), null), 'attack', 'unwarned: a plain attack');
});
