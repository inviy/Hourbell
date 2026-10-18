// Battle simulator shared by the balance tests. It plays the same rules as
// src/battle.js: speed order, the hero's choice from HB.autoPick (what auto
// battle does), companions by HB.allyIntent. The pet does not fight.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');

// load src files (DOM-free ones) into a fresh HB; returns window.HB.
// core.js needs a DOM, so only its seeded RNG comes along (the maps use it).
export function loadHB(files = ['rules.js']) {
  const window = { HB: {} }, ctx = { window, Math, JSON, Object, Number };
  const rng = /HB\.rng = function[\s\S]*?\n  \};/.exec(src('core.js'))[0];
  vm.runInNewContext('(function (HB) {' + rng + '})(window.HB);', ctx);
  for (const f of files) vm.runInNewContext(src(f), ctx);
  return window.HB;
}

// a party at a level: full HP / 울림, some herbs, optional gear ids to wear
export function partyAt(HB, lvl, herbs, opts = {}) {
  const P = HB.newParty();
  while (P.lvl < lvl) HB.levelUp(P);
  P.hp = P.maxHp; P.mp = P.maxMp; P.items = Object.assign({ herb: herbs }, opts.items);
  for (const id of opts.gear || []) { P.items[id] = (P.items[id] || 0) + 1; HB.equip(P, id); }
  if (opts.bare) P.mp = P.maxMp = 0; // attack only: no skills
  return P;
}

// one battle; allies: companion ids. true if won
export function fight(HB, P, kinds, allies = []) {
  const foes = kinds.map((k) => HB.makeFoe(k));
  const team = allies.map((id) => Object.assign(HB.allyStats(id, P.lvl), { hp: HB.allyStats(id, P.lvl).maxHp }));
  let silenced = 0, buff = 0, fog = 0;
  const alive = () => foes.filter((f) => f.hp > 0);
  const cast = (id) => { P.mp -= HB.SKILLS[id].cost; };

  function hero(pick) {
    const a = alive();
    const t = pick.target && pick.target.hp > 0 ? pick.target : a[0];
    let ring = false;
    if (pick.act === 'guard') P.mp = Math.min(P.maxMp, P.mp + 2);
    else if (pick.act === 'item') { HB.useItem(P, pick.id); if (HB.ITEMS[pick.id].cure) silenced = 0; }
    else if (pick.act === 'skill') {
      cast(pick.id);
      if (pick.id === 'heal') P.hp = Math.min(P.maxHp, P.hp + HB.healAmt(P));
      else if (pick.id === 'ring') { buff = HB.SKILLS.ring.buff; ring = true; }
      else if (pick.id === 'chime') { a.forEach((f) => { f.hp -= HB.chimeDmg(P, f); }); fog = 0; }
      else if (pick.id === 'gust') { t.hp -= HB.gustDmg(P, t, buff > 0); fog = 0; }
    } else {
      let d = HB.hitDmg(HB.effAtk(P, buff > 0), t.def);
      if (Math.random() < HB.critChance) d = Math.round(d * 1.8);
      t.hp -= HB.fogged(d, fog > 0);
    }
    if (silenced) silenced--;
    if (buff && !ring) buff--;
  }

  function ally(m) {
    m.covering = false;
    const i = HB.allyIntent(m, [P].concat(team), alive(), silenced > 0);
    m.sang = i.act === 'song';
    if (i.act === 'song') i.target.hp = Math.min(i.target.maxHp, i.target.hp + HB.songAmt(P.lvl));
    else if (i.act === 'cover') { m.covering = true; m.covered = true; }
    else if (i.act === 'spell') { i.target.hp -= HB.spellDmg(m, i.target, i.el); if (i.el) fog = 0; }
    else i.target.hp -= HB.fogged(HB.hitDmg(m.atk, i.target.def), fog > 0);
  }

  function foe(f, turn, guarding) {
    let intent = HB.foeIntent(f, turn, P, { silenced: silenced > 0, fog: fog > 0 });
    if (intent === 'silence') { silenced = 2; return; }
    if (intent === 'fog') { fog = HB.FOG_TURNS; intent = 'attack'; } // fog is a free action
    if (intent === 'swallow') { P.mp = Math.max(0, P.mp - 2); return; }
    if (intent === 'wave') {
      P.hp -= HB.foeDmg(f, P, intent, guarding);
      team.forEach((m) => { if (m.hp > 0) m.hp = Math.max(0, m.hp - HB.foeDmg(f, m, intent, false)); });
      return;
    }
    const t = HB.foeTarget(team);
    if (t === 'hero') P.hp -= HB.foeDmg(f, P, intent, guarding);
    else t.hp = Math.max(0, t.hp - HB.foeDmg(f, t, intent, false));
  }

  for (let turn = 1; turn < 120; turn++) {
    if (fog > 0) fog--;
    const pick = HB.autoPick(P, alive(), { silenced: silenced > 0, buff, fog: fog > 0, waveNext: alive().some((f) => HB.waveNext(f, turn)) });
    const guarding = pick.act === 'guard';
    for (const who of HB.turnOrder(P, alive(), team)) {
      if (who === 'hero') hero(pick);
      else if (who.isAlly) { if (who.hp > 0) ally(who); }
      else if (who.hp > 0) { foe(who, turn, guarding); if (P.hp <= 0) return false; }
      if (!alive().length) return true;
    }
  }
  return false;
}

// share of n fights won
export function winRate(HB, lvl, herbs, kinds, opts = {}, n = 1500) {
  let w = 0;
  for (let i = 0; i < n; i++) if (fight(HB, partyAt(HB, lvl, herbs, opts), kinds, opts.allies)) w++;
  return w / n;
}

// players who do not play like the auto battle (a playtest lost at Lv8 in full
// gear by pressing 공격 with no money left for items).
// mash: attack, nothing else. plain: attack, an HP item when low.
export const mashPick = () => (P, foes) => ({ act: 'attack', target: foes[0] });
export const plainPick = (HB) => (P, foes) => {
  if (P.hp < P.maxHp * 0.35) {
    const it = Object.keys(P.items).filter((k) => P.items[k] > 0 && HB.ITEMS[k].hp).sort((a, b) => HB.ITEMS[b].hp - HB.ITEMS[a].hp)[0];
    if (it) return { act: 'item', id: it };
  }
  return { act: 'attack', target: foes[0] };
};
// win rate with HB.autoPick swapped for another player
export function winRateAs(HB, pick, lvl, kinds, opts, n) {
  const auto = HB.autoPick;
  HB.autoPick = pick;
  try { return winRate(HB, lvl, 0, kinds, opts, n); } finally { HB.autoPick = auto; }
}
