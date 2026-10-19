// Real boss fights: the actual game in headless Chrome against the sim.
// The balance tests trust tests/sim.mjs, a copy of the battle rules; this
// checks that copy against src/battle.js (a playtest once lost fights the sim
// said were easy, because the sim only played like auto battle).
// Each fight is seeded, so a run repeats exactly.
// Run: node tests/real.mjs [chapter=2] [level] [auto|mash] [fights=8]
import { openGame } from './browser.mjs';
import { loadHB, winRateAs, mashPick } from './sim.mjs';
import { SPEC, TIERS } from './chapterspec.mjs';

const HBs = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
const CH = Object.assign({ 2: { boss: 'mistking', lvl: 6, gear: TIERS[2], allies: ['mio'], items: { soup: 3, herb2: 3 } } }, SPEC(HBs));
const [n = '2', lvlArg, style = 'mash', fightsArg = '8'] = process.argv.slice(2);
const c = CH[n], lvl = +(lvlArg || c.lvl + (style === 'mash' ? 2 : 0)), fights = +fightsArg;
const items = style === 'mash' ? {} : c.items;
const mapId = Object.keys(HBs.MAPS).find((id) => (HBs.MAPS[id]().altar || {}).boss === c.boss);
const altar = HBs.MAPS[mapId]().altar;

const { W, URL_, send, ev, key, sleep, drain, errors, close } = await openGame('hourbell-real');
let wins = 0;
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL_ }); await sleep(2500);
  await ev('localStorage.clear()');
  await key('KeyZ'); await sleep(600); await key('KeyZ'); await sleep(2300); await drain();
  // 8x battle speed: the fight is the same, only the waits are shorter
  await ev('(() => { const o = HB.Battle.update; HB.Battle.update = function (w, dt) { return o.call(this, w, dt * 8); }; })()');
  for (let k = 0; k < fights; k++) {
    await ev(`(() => {
      const P = Object.assign(HB.party, HB.newParty()); while (P.lvl < ${lvl}) HB.levelUp(P); P.hp = P.maxHp; P.mp = P.maxMp;
      ${JSON.stringify(c.gear)}.forEach((id) => { P.items[id] = 1; HB.equip(P, id); });
      Object.assign(P.items, ${JSON.stringify(items)});
      P.allies = ${JSON.stringify(c.allies)}.map((id) => ({ id, hp: HB.allyStats(id, P.lvl).maxHp }));
      ${W}.flags = {}; ${W}.load('${mapId}', { x: ${altar.tx} + 0.5, y: ${altar.ty} + 1.9, dir: 'up' }); })()`);
    await sleep(800);
    await ev('HB.Field.enemies.forEach((e) => { e.dead = true; }); HB.seedRandom(' + (1000 + k) + ')');
    await ev(`HB.Chapter.interact(${W}, ${altar.tx}, ${altar.ty})`); await drain(); await sleep(800);
    if (style === 'auto') await ev('HB.Battle.keepAuto = true; HB.Battle.auto = true');
    for (let i = 0; i < 1500 && await ev('HB.Battle.active'); i++) {
      if (await ev('!!HB.Battle.waitingOk')) await key('KeyZ', 20);
      else if (style === 'mash' && await ev("HB.Battle.phase === 'menu' || HB.Battle.phase === 'target'")) { await ev('HB.Battle.cursor = 0'); await key('KeyZ', 20); }
      await sleep(50);
    }
    const won = await ev(`!!${W}.flags.boss${n}`);
    wins += won;
    console.log('fight ' + (k + 1) + ': ' + (won ? 'won' : 'lost') + ' on turn ' + await ev('HB.Battle.turn'));
    await drain(); await sleep(400);
  }
  const real = wins / fights;
  const sim = style === 'auto'
    ? (await import('./sim.mjs')).winRate(HBs, lvl, 0, [c.boss], { gear: c.gear, allies: c.allies, items }, 600)
    : winRateAs(HBs, mashPick(), lvl, [c.boss], { gear: c.gear, allies: c.allies, items }, 600);
  console.log(`chapter ${n}, Lv${lvl}, ${style}: real ${wins}/${fights} (${real.toFixed(2)}), sim ${sim.toFixed(2)}`);
  // a handful of real fights is noisy; a big gap means sim.mjs and battle.js disagree
  if (Math.abs(real - sim) > 0.3) { console.error('sim and game disagree'); process.exitCode = 1; }
  if (errors.length) { console.error('JS errors:', errors); process.exitCode = 1; }
} catch (e) {
  console.error('FAILED:', e.message); process.exitCode = 1;
} finally { close(); }
