// Browser smoke run: plays through the game in headless Chrome over the
// DevTools protocol, fails on any JS error or broken expectation, and saves
// screenshots. Needs Chrome (set CHROME=/path/to/chrome if it is not found).
// Run: node tests/smoke.mjs   (not part of `node --test`, it is slow)
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const { OUT, URL_, W, send, ev, key, sleep, shot, drain, talkTo, winBattle, errors, close } = await openGame('hourbell-smoke');
const step = (name) => console.log('- ' + name);

try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(2500);
  await ev('localStorage.clear()');

  step('title -> new game -> town');
  await key('KeyZ'); await sleep(600); await shot('01-title');
  await key('KeyZ'); await sleep(2300); await drain();
  assert.equal(await ev(`${W}.def.id`), 'town');

  step('keeper, pause menu, status, options');
  await talkTo('keeper'); await drain();
  assert.ok(await ev(`${W}.flags.metKeeper`));
  await key('KeyX'); await sleep(200); await shot('02-menu');
  await ev("HB.Menu.mode.cur = HB.Menu.rows(HB.World).findIndex((r) => r.label === '옵션')");
  await key('KeyZ'); await key('ArrowLeft'); await key('ArrowLeft'); await sleep(200); await shot('03-options');
  assert.equal(await ev('HB.options.music'), 5);
  assert.equal(JSON.parse(await ev("localStorage.getItem('hourbell.options')")).music, 5);
  await key('KeyX'); await key('KeyX');
  assert.ok(!(await ev('HB.Menu.open')));

  step('focus loss pauses, a key resumes');
  await ev("window.dispatchEvent(new Event('blur'))");
  await sleep(200); await shot('04-paused');
  assert.ok(await ev('HB.paused'));
  assert.equal(await ev('HB.audio.ctx && HB.audio.ctx.state'), 'suspended', 'audio stops while paused');
  await key('KeyZ'); await sleep(300);
  assert.ok(!(await ev('HB.paused')));
  assert.equal(await ev('HB.audio.ctx && HB.audio.ctx.state'), 'running', 'audio comes back');

  step('walking into a wall corner slides past it');
  await ev(`${W}.player.x = 10 * 16 + 3; ${W}.player.y = 7.9 * 16; ${W}.player.dir = 'up'`); // 3px into the house's right wall
  await key('ArrowUp', 700);
  assert.ok(await ev(`${W}.player.y`) < 7.9 * 16 - 24, 'eased round the corner instead of stopping');

  step('smith: buy and equip');
  await ev('HB.party.gold = 200');
  await talkTo('smith'); await drain();
  await key('KeyZ'); await sleep(200);
  assert.match(await ev('HB.Menu.note'), /샀다/);
  await key('ArrowDown'); await sleep(200);
  assert.equal(await ev('HB.Menu.note'), '', 'moving on shows the next item, not the old message');
  await key('KeyX');
  assert.equal(await ev('HB.party.items.mallet'), 1);
  assert.ok(await ev("HB.equip(HB.party, 'mallet')"));

  step('field battle: win, gold, kills');
  await ev(`${W}.load('field', { x: 26, y: 6, dir: 'up' }); HB.Field.grace = 0;`); await sleep(400);
  const gold0 = await ev('HB.party.gold'), battles0 = await ev('HB.party.battles');
  await ev('HB.Battle.start(HB.World, HB.Field.enemies.slice(0, 3))'); await sleep(2700); await shot('05-battle');
  await winBattle();
  assert.ok(!(await ev('HB.Battle.active')));
  assert.ok(await ev('HB.party.gold') > gold0);
  assert.ok(await ev('HB.party.battles') > battles0);

  step('secret path to the grove, chime puzzle, chest');
  await ev(`${W}.load('field', { x: 41.5, y: 19.9, dir: 'right' }); HB.Field.enemies.forEach((e) => { e.dead = true; });`); await sleep(1300);
  await key('ArrowRight', 2600); await sleep(1500);
  assert.equal(await ev(`${W}.def.id`), 'grove');
  await ev('HB.Field.enemies.forEach((e) => { e.dead = true; })');
  for (const [x, y] of [[11, 4], [15, 7], [6, 5]]) {
    await ev(`${W}.player.x = ${x + 0.5} * 16; ${W}.player.y = ${y + 1.9} * 16; ${W}.player.dir = 'up'`);
    await key('KeyZ'); await sleep(500);
  }
  await drain();
  assert.ok(await ev(`${W}.flags.grovePuzzle`));
  await ev(`${W}.player.x = 12.5 * 16; ${W}.player.y = 13.9 * 16; ${W}.player.dir = 'up'`);
  await key('KeyZ'); await sleep(600); await drain();
  assert.equal(await ev('HB.party.items.plume'), 1);

  step('boss, fragment, ending');
  await ev(`(() => { ${W}.load('field', { x: 24, y: 27.6, dir: 'up' }); HB.Field.enemies.forEach((e) => { e.dead = true; });
    const P = HB.party; while (P.lvl < 4) HB.levelUp(P); P.hp = P.maxHp; P.mp = P.maxMp; })()`);
  await sleep(500);
  await ev(`HB.Field.interact(${W}, 23, 25)`); await drain(); await sleep(3500);
  assert.ok(await ev('HB.Battle.isBoss')); await shot('06-boss');
  await winBattle();
  assert.ok(await ev(`${W}.flags.boss1`));
  await sleep(800);
  await ev(`HB.Field.interact(${W}, 23, 25)`); await drain(); await sleep(3500);
  assert.ok(await ev(`${W}.flags.fragment1`));
  assert.equal(await ev('HB.party.pet'), 'pip', 'the fragment frees the pet');
  assert.equal(await ev(`${W}.def.id`), 'town', 'the bell carries you home to the keeper');

  step('party of four, auto battle, auto hunt');
  await ev(`(() => { const P = HB.party; P.allies = ['mio', 'dan', 'haru'].map((id) => ({ id, hp: HB.allyStats(id, P.lvl).maxHp }));
    ${W}.load('field', { x: 21, y: 4, dir: 'down' }); })()`);
  await sleep(800);
  const b0 = await ev('HB.party.battles');
  await key('KeyQ'); await sleep(1500); await shot('07-autohunt');
  for (let i = 0; i < 120 && (await ev('HB.AutoHunt.on') || await ev('HB.Battle.active')); i++) {
    if (await ev('!!HB.Battle.waitingOk')) await key('KeyZ');
    if (i === 6) await shot('08-party-auto');
    await sleep(800);
  }
  assert.ok(await ev('HB.party.battles') > b0, 'auto hunt found fights');
  assert.ok(!(await ev('HB.AutoHunt.on')), 'and stopped on its own');
  await drain();
  assert.equal(await ev('HB.party.allies.length'), 3);

  step('chapter one ends and the game goes on');
  await ev(`${W}.load('town')`); await sleep(400);
  await talkTo('keeper'); await drain(); await sleep(2500);
  assert.equal(await ev('HB.getScene() === HB.Ending'), true);
  await sleep(9000); await shot('09-ending');
  await key('KeyZ'); await sleep(2000);
  assert.equal(await ev('HB.getScene() === HB.World'), true, 'back on the map, not the title');
  await drain();

  step('chapter two: mist road, port, pearls');
  await ev(`${W}.player.x = 32.5 * 16; ${W}.player.y = 13.9 * 16; ${W}.player.dir = 'right'`);
  await key('ArrowRight', 1200); await sleep(1500);
  assert.equal(await ev(`${W}.def.id`), 'mistroad', 'the east gate opens after chapter one');
  await ev('HB.Field.enemies.forEach((e) => { e.dead = true; })'); await shot('11-mistroad');
  await ev(`${W}.player.x = 38.5 * 16; ${W}.player.y = 9.4 * 16; ${W}.player.dir = 'right'`);
  await key('ArrowRight', 1200); await sleep(1500);
  assert.equal(await ev(`${W}.def.id`), 'port');
  assert.ok(await ev(`${W}.flags.portArrived`));
  await shot('12-port');
  await talkTo('harbor'); await drain();
  assert.ok(await ev(`${W}.flags.metHarbor`));
  await talkTo('oldnet'); await drain();
  assert.ok(await ev(`${W}.flags.pearlAsked`));
  await ev('HB.party.items.pearl = 3');
  await talkTo('oldnet'); await drain();
  assert.ok(await ev(`${W}.flags.pearlDone`));
  assert.equal(await ev('HB.party.items.pearl'), undefined);
  assert.equal(await ev('HB.party.items.pearlear'), 1);

  step('chapter two boss on auto battle, fragment, card');
  await ev(`(() => { const P = HB.party; while (P.lvl < 9) HB.levelUp(P); P.hp = P.maxHp; P.mp = P.maxMp;
    ['coral', 'coat', 'hood'].forEach((id) => { P.items[id] = 1; HB.equip(P, id); });
    P.items.soup = 5; P.items.bigdrop = 5;
    P.allies.forEach((a) => { a.hp = HB.allyStats(a.id, P.lvl).maxHp; });
    HB.Field.enemies.forEach((e) => { e.dead = true; }); })()`);
  await ev(`HB.Chapter.interact(${W}, 29, 6)`); await drain(); await sleep(3500);
  assert.ok(await ev('HB.Battle.isBoss')); await shot('13-boss2');
  await ev('HB.Battle.keepAuto = true; HB.Battle.auto = true');
  const savedFlag = (flag) => ev(`!!((JSON.parse(localStorage.getItem('hourbell.save1')) || { flags: {} }).flags.${flag})`);
  let savedMidBattle = null;
  for (let i = 0; i < 600 && await ev('HB.Battle.active'); i++) {
    if (savedMidBattle === null && await ev(`${W}.flags.boss2`)) savedMidBattle = await savedFlag('boss2');
    if (await ev('!!HB.Battle.waitingOk')) await key('KeyZ');
    await sleep(250);
  }
  assert.ok(!(await ev('HB.Battle.active')), 'auto battle finishes the boss fight');
  assert.ok(await ev(`${W}.flags.boss2`), 'and wins it');
  assert.equal(savedMidBattle, false, 'no autosave while the battle is still on screen');
  await drain(); await sleep(800);
  assert.ok(await savedFlag('boss2'), 'autosaved once control came back');
  // reload right after the boss: the win is still there
  // continue shows the place and, under it, what to do next
  const reloadAndContinue = async () => {
    await send('Page.navigate', { url: URL_ }); await sleep(2500);
    await ev('window.banners = []; const show = HB.showBanner; HB.showBanner = (a, b, c) => { window.banners.push(b); show(a, b, c); }');
    await key('KeyZ'); await sleep(700); await key('KeyZ'); await sleep(2300); await drain();
    return ev('window.banners.find((b) => /^지금 할 일: /.test(b)) || null');
  };
  assert.equal(await reloadAndContinue(), '지금 할 일: 등대에서 두 번째 조각을 얻는다');
  assert.ok(await ev(`${W}.flags.boss2`), 'the boss win survives a reload');
  assert.equal(await ev(`${W}.def.id`), 'port');
  await ev('HB.Field.enemies.forEach((e) => { e.dead = true; })');
  await ev(`HB.Chapter.interact(${W}, 29, 6)`); await drain(); await sleep(3500);
  assert.ok(await ev(`${W}.flags.fragment2`));
  assert.equal(await ev(`${W}.def.id`), 'town', 'the bell carries you home to the keeper');
  assert.ok(await savedFlag('fragment2'), 'the fragment is autosaved too');
  assert.equal(await reloadAndContinue(), '지금 할 일: 종지기에게 돌아간다');
  assert.ok(await ev(`${W}.flags.fragment2`), 'and survives a reload');
  assert.equal(await ev('HB.fragments(' + W + '.flags)'), 2);
  await ev(`${W}.load('town')`); await sleep(400);
  await talkTo('keeper'); await drain(); await sleep(2500);
  assert.equal(await ev('HB.getScene() === HB.Ending && HB.Ending.n'), 2);
  await sleep(9000); await shot('14-ending2');
  await key('KeyZ'); await sleep(2000);
  assert.equal(await ev('HB.getScene() === HB.World'), true);
  assert.ok(await ev(`${W}.flags.chapter2`));
  await drain();

  // chapters 3-7: arrive the way a player would, then shortcut the fights
  const walk = async (x, y, dir, code, to) => {
    await ev(`${W}.player.x = ${x} * 16; ${W}.player.y = ${y} * 16; ${W}.player.dir = '${dir}'`);
    await key(code, 1200); await sleep(1500);
    assert.equal(await ev(`${W}.def.id`), to, 'walked into ' + to);
    await ev('HB.Field.enemies.forEach((e) => { e.dead = true; })');
  };
  const tower = async (to) => {
    await ev(`HB.Chapter.interact(${W}, 16, 11)`); await drain(); await sleep(2500); await drain();
    assert.equal(await ev(`${W}.def.id`), to, 'the tower leads to ' + to);
    await ev('HB.Field.enemies.forEach((e) => { e.dead = true; })');
  };
  const joinBy = async (npc, item, ally) => {
    await talkTo(npc); await drain();
    await ev(`HB.party.items.${item} = 3`);
    await talkTo(npc); await drain();
    assert.ok(await ev(`HB.party.allies.some((a) => a.id === '${ally}')`), ally + ' joined');
    assert.ok(!(await ev(`${W}.npcs.some((n) => n.def.id === '${npc}')`)), 'and left the map');
  };
  const bossAt = async (n, tx, ty, name) => {
    await ev(`(() => { const P = HB.party; P.hp = P.maxHp; P.mp = P.maxMp; })()`);
    await ev(`HB.Chapter.interact(${W}, ${tx}, ${ty})`); await drain(); await sleep(3500);
    assert.ok(await ev('HB.Battle.isBoss')); await shot(name);
    await winBattle(); await drain(); await sleep(800);
    assert.ok(await ev(`${W}.flags.boss${n}`));
    await ev(`HB.Chapter.interact(${W}, ${tx}, ${ty})`); await drain(); await sleep(3500);
    assert.ok(await ev(`${W}.flags.fragment${n}`));
    assert.equal(await ev(`${W}.def.id`), 'town', 'chapter ' + n + ': the bell carries you home');
    assert.deepEqual(await ev(`[${W}.player.x / 16, ${W}.player.y / 16]`), [16.5, 15.4], 'in front of the keeper');
  };
  const card = async (n, wait) => {
    await ev(`${W}.load('town')`); await sleep(400);
    await talkTo('keeper'); await drain(); await sleep(2500);
    assert.equal(await ev('HB.getScene() === HB.Ending && HB.Ending.n'), n);
    await sleep(wait || 9000); await shot('card' + n);
    await key('KeyZ'); await sleep(2000);
    assert.ok(await ev(`${W}.flags.chapter${n}`));
    await drain();
  };

  step('chapter three: north road, mine, 단비 joins, 메아리왕');
  await ev(`HB.party.allies = [{ id: 'mio', hp: HB.allyStats('mio', HB.party.lvl).maxHp }]`);
  await walk(16.5, 0.9, 'up', 'ArrowUp', 'canyon'); await shot('15-canyon');
  await talkTo('foreman'); await drain();
  await ev(`${W}.load('mine', { x: 1.5, y: 16.4, dir: 'right' })`); await sleep(600);
  await ev('HB.Field.enemies.forEach((e) => { e.dead = true; })'); await shot('16-mine');
  await joinBy('dan', 'ore', 'dan');
  // the return offer can be turned down (B / cancel picks "조금 더 둘러본다")
  await ev(`HB.offerReturn(${W})`); await sleep(300);
  for (let i = 0; i < 10 && await ev('HB.dialog.active'); i++) { await key('KeyX'); await sleep(250); }
  await sleep(2500);
  assert.equal(await ev(`${W}.def.id`), 'mine', 'staying keeps you where you are');
  await bossAt(3, 14, 3, '17-boss3');
  await card(3);

  step('map: where you are, where you have been, what is next');
  await key('KeyX'); await sleep(200);
  await ev("HB.Menu.mode.cur = HB.Menu.rows(HB.World).findIndex((r) => r.label === '지도')");
  await key('KeyZ'); await sleep(400); await shot('17b-map');
  assert.equal(await ev("HB.Menu.mode.id"), 'map');
  const nodes = await ev(`HB.mapNodes(${W}.flags)`);
  for (const id of ['town', 'field', 'grove', 'mistroad', 'port', 'canyon', 'mine']) assert.equal(nodes[id], 'seen', 'map shows ' + id);
  assert.equal(nodes.pasttown, 'unknown', 'the next place shows as ???');
  assert.equal(await ev('HB.Menu.rows(HB.World)[0].desc'), '다음 목표: 시계탑을 통해 과거로 간다');
  await key('KeyX'); await key('KeyX');

  step('chapter four: the tower into the past, 하루 joins, 시간갉기');
  await tower('pasttown'); await shot('18-pasttown');
  await talkTo('youngkeeper'); await drain();
  await joinBy('haru', 'cog', 'haru');
  assert.equal(await ev('HB.party.allies.length'), 3);
  await walk(16.5, 23.9, 'down', 'ArrowDown', 'pastwood'); await shot('19-pastwood');

  step('battle: warned fog, remembered picks, a loss wakes you at the inn');
  const woodAt = await ev(`[${W}.player.x / 16, ${W}.player.y / 16]`);
  const fight = (atk) => ev(`(() => { const p = ${W}.player;
    HB.Battle.start(${W}, [{ kind: 'tickwisp', x: p.x + 48, y: p.y }]); HB.Battle.foes[0].atk = ${atk}; HB.Battle.foes[0].swallow = 0; })()`);
  const toMenu = async () => { for (let i = 0; i < 40 && await ev("HB.Battle.phase !== 'menu' || !!HB.Battle.co"); i++) { if (await ev('!!HB.Battle.waitingOk')) await key('KeyZ'); await sleep(250); } };
  await fight(1); await sleep(2700);
  await ev(`(() => { const B = HB.Battle, f = B.foes[0]; f.fogEvery = 4; f.fogName = '시간 먼지'; f.hp = f.maxHp = 9999; B.turn = 0; B.toMenu(); })()`);
  assert.match(await ev('HB.Battle.msg'), /시간 먼지를 머금는다/, 'the fog is warned before you pick');
  await shot('19b-fog-warning');
  await ev('HB.Battle.cursor = 3'); await key('KeyZ'); await sleep(400); await toMenu(); // 방어
  assert.ok(await ev('HB.Battle.fog > 0'), 'and the warned fog comes');
  await ev(`HB.party.items.herb = 2; HB.Battle.listMem.item = 'herb'`);
  await ev('HB.Battle.cursor = 2'); await key('KeyZ'); await sleep(300); // 도구
  assert.equal(await ev('HB.Battle.list[HB.Battle.listCursor].id'), 'herb', 'the item list opens on the last pick');
  await key('KeyX'); await sleep(200);
  await ev('HB.Battle.cursor = 3; HB.Battle.end(true)'); await drain();
  await fight(1); await sleep(300);
  assert.equal(await ev('HB.Battle.cursor'), 3, 'the next battle opens on the last command');
  await ev('HB.Battle.end(true)'); await drain();
  // rest at the inn of 50 years ago, then lose in the wood
  await ev(`${W}.load('pasttown', { x: 27.5, y: 19.9, dir: 'up' })`); await sleep(500);
  await ev(`HB.restAtInn(${W}, '여관 주인 할멈', ['푹 쉬렴.'])`); await drain();
  assert.equal(await ev(`${W}.flags.restAt.map`), 'pasttown');
  await ev(`${W}.load('pastwood', { x: ${woodAt[0]}, y: ${woodAt[1]}, dir: 'down' }); HB.Field.enemies.forEach((e) => { e.dead = true; })`); await sleep(500);
  const goldBefore = await ev('HB.party.gold');
  await fight(9999); await sleep(2700);
  await ev('HB.party.hp = 1; HB.Battle.allies.forEach((m) => { m.hp = 0; })');
  await ev(`(() => { const open = HB.dialog.open; HB.seenLines = [];
    HB.dialog.open = function (t, o) { HB.seenLines.push([].concat(t).join(' ')); return open.call(this, t, o); }; })()`);
  await ev('HB.Battle.cursor = 3'); await key('KeyZ');
  for (let i = 0; i < 40 && await ev('HB.Battle.active'); i++) { if (await ev('!!HB.Battle.waitingOk')) await key('KeyZ'); await sleep(250); }
  await sleep(1500);
  assert.equal(await ev(`${W}.def.id`), 'pasttown', 'a loss in chapter four wakes you at its inn, not in present-day 울림골');
  assert.deepEqual(await ev(`[${W}.player.x / 16, ${W}.player.y / 16]`), [27.5, 19.9]);
  assert.match(await ev("HB.seenLines.join(' ')"), /50년 전 울림골이었다/);
  await drain();
  await ev(`HB.party.gold = ${goldBefore}`);
  await ev(`${W}.load('pastwood', { x: ${woodAt[0]}, y: ${woodAt[1]}, dir: 'down' }); HB.Field.enemies.forEach((e) => { e.dead = true; })`); await sleep(500);
  await bossAt(4, 28, 21, '20-boss4');
  await ev(`${W}.load('pasttown', { x: 16.5, y: 12.8, dir: 'up' })`); await sleep(600);
  await tower('town');
  await card(4);

  step('chapter five: over the canyon into the snow, 서리날개');
  await ev(`${W}.load('canyon', { x: 20.5, y: 2, dir: 'up' })`); await sleep(600);
  await walk(20.5, 0.9, 'up', 'ArrowUp', 'snowroad'); await shot('21-snowroad');
  await talkTo('hunter'); await drain();
  await talkTo('snowkid'); await drain(); await ev('HB.party.items.icebloom = 3'); await talkTo('snowkid'); await drain();
  assert.ok(await ev(`${W}.flags.bloomDone`));
  await walk(20.5, 0.9, 'up', 'ArrowUp', 'snowpeak'); await shot('22-snowpeak');
  await bossAt(5, 14, 6, '23-boss5');
  await card(5);

  step('chapter six: the cloud bridge, the observatory, 일식');
  await ev(`${W}.load('snowpeak', { x: 15.5, y: 2, dir: 'up' })`); await sleep(600);
  await walk(15.5, 0.9, 'up', 'ArrowUp', 'starpath'); await shot('24-starpath');
  await walk(31.5, 0.9, 'up', 'ArrowUp', 'observatory'); await shot('25-observatory');
  await talkTo('astronomer'); await drain();
  await bossAt(6, 14, 4, '26-boss6');
  await card(6);

  step('chapter seven: into the bell, 정적, credits, back to the title');
  await tower('bellcore'); await shot('27-bellcore');
  await talkTo('bellspirit'); await drain();
  await bossAt(7, 12, 3, '28-boss7');
  assert.equal(await ev('HB.fragments(' + W + '.flags)'), 7);
  await ev(`${W}.load('town')`); await sleep(400);
  await talkTo('keeper'); await drain(); await sleep(2500);
  assert.equal(await ev('HB.getScene() === HB.Ending && HB.Ending.n'), 7);
  await sleep(9000); await shot('29-final-card');
  await sleep(14000); await shot('30-credits');
  await sleep(12000);
  await key('KeyZ'); await sleep(2500);
  assert.equal(await ev('HB.getScene() === HB.Title'), true, 'the last card returns to the title');

  step('title: continue from the save');
  await send('Page.navigate', { url: URL_ }); await sleep(2500);
  await key('KeyZ'); await sleep(700); await shot('10-continue');
  await key('KeyZ'); await sleep(2300);
  assert.ok(await ev(`${W}.flags.chapter7`));
  assert.equal(await ev('HB.party.allies.length'), 3);
  assert.ok(await ev(`${W}.flags.chapter1`));
  assert.equal(await ev('HB.party.items.plume'), 1);

  step('save code: copy on one device, load it on a fresh one');
  await ev("navigator.clipboard.writeText = (t) => { window.copied = t; return Promise.resolve(); }");
  await ev(`HB.Menu.open = true; HB.Menu.stack = []; HB.Menu.push({ id: 'main' });
    HB.Menu.mode.cur = HB.Menu.rows(${W}).findIndex((r) => r.label === '세이브 코드')`);
  await key('KeyZ'); await sleep(400);
  const code = await ev('window.copied');
  assert.match(code, /^HB1-/);
  assert.match(await ev('HB.Menu.note'), /복사/);
  await key('KeyX'); await key('KeyX');
  await ev('localStorage.clear()');
  await send('Page.navigate', { url: URL_ }); await sleep(2500);
  await ev(`window.prompt = () => 'HB1-garbage'; window.confirm = () => true`);
  await key('KeyZ'); await sleep(600);
  assert.deepEqual(await ev('HB.Title.opts'), ['new', 'code'], 'no save here yet');
  await key('ArrowDown'); await key('KeyZ'); await sleep(400);
  assert.match(await ev('HB.Title.msg'), /읽을 수 없다/, 'a bad code only says so');
  assert.equal(await ev("localStorage.getItem('hourbell.save1')"), null);
  await ev(`window.prompt = () => ${JSON.stringify(code)}`);
  await key('KeyZ'); await sleep(400); await shot('31-code-loaded');
  assert.deepEqual(await ev('HB.Title.opts'), ['continue', 'new', 'code']);
  await key('KeyZ'); await sleep(2300);
  assert.ok(await ev(`${W}.flags.chapter7`), 'the whole adventure came across');
  assert.equal(await ev('HB.party.pet'), 'pip');

  step('a damaged save falls back to the one before it');
  await ev(`HB.save(${W})`); // the imported save becomes the backup
  await ev(`localStorage.setItem('hourbell.save1', '{"v":3,"party":')`);
  await send('Page.navigate', { url: URL_ }); await sleep(2500);
  await key('KeyZ'); await sleep(700);
  assert.deepEqual(await ev('HB.Title.opts'), ['continue', 'new', 'code'], 'continue is still offered');
  await key('KeyZ'); await sleep(2300); await drain();
  assert.ok(await ev(`${W}.flags.chapter7`), 'from the backup');

  step('an error thrown every frame does not stop the game');
  const time0 = await ev('HB.time');
  // the draw error leaves a save() without its restore(), with odd alpha and blending
  await ev(`HB.worldPlugins.push(window.boom = {
    update() { throw new Error('smoke: boom in update'); },
    drawables(w, list) { list.push({ y: 0, draw(g) { g.globalAlpha = 0.2; g.globalCompositeOperation = 'lighter'; g.save(); throw new Error('smoke: boom in draw'); } }); }
  })`);
  await sleep(1500); await shot('32-error-note');
  assert.ok(await ev('HB.time') > time0 + 1, 'the loop keeps running');
  assert.ok(await ev('HB.loopError.count') >= 30, 'and the repeating error is noted on screen');
  await key('KeyZ', 30); await sleep(200);
  assert.equal(await ev('Object.keys(HB.input.pressed).length'), 0, 'a key pressed while update throws is still cleared');
  await ev('HB.worldPlugins.splice(HB.worldPlugins.indexOf(window.boom), 1)');
  await sleep(1500); await shot('33-after-error');
  assert.equal(await ev('HB.loopError.count'), 0, 'the note goes away once the error stops');
  // nothing left on the save stack: one extra restore() must not bring the odd state back
  assert.deepEqual(await ev(`(() => { const g = HB.g; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.restore();
    return [g.globalAlpha, g.globalCompositeOperation, g.imageSmoothingEnabled]; })()`), [1, 'source-over', false], 'canvas state is clean after the errors');
  await key('ArrowLeft', 400);
  assert.equal(await ev(`${W}.player.dir`), 'left', 'and the game still plays');
  // a scene change whose callback throws: it runs once, the fade still ends
  await ev("window.fadeCalls = 0; HB.fadeTo(() => { window.fadeCalls++; throw new Error('smoke: boom in fade'); })");
  await sleep(2000);
  assert.equal(await ev('window.fadeCalls'), 1, 'a throwing fade callback runs once, not every frame');
  assert.ok(!(await ev('HB.isFading()')), 'and the fade still finishes');
  assert.equal(errors.filter((e) => /boom in fade/.test(e)).length, 1, 'logged once');
  const thrown = errors.filter((e) => /smoke: boom/.test(e));
  assert.ok(thrown.length >= 3 && thrown.length <= 5, 'each error logged once, not every frame (' + thrown.length + ')');
  errors.splice(0, errors.length, ...errors.filter((e) => !/smoke: boom/.test(e)));

  assert.deepEqual(errors, [], 'no JS errors');
  console.log('ok, screenshots in ' + OUT);
} catch (e) {
  console.error('FAILED:', e.message);
  if (errors.length) console.error('JS errors:', errors);
  await shot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  close();
}
