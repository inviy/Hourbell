// Map and data integrity: every exit, door, chest, chime and NPC is
// reachable on foot from the map's spawn, and every id points at real data.
// Runs the real map builders from src/maps.js. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHB } from './sim.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js', 'worldmap.js', 'guide.js']);
const maps = Object.fromEntries(Object.entries(HB.MAPS).map(([id, build]) => [id, build()]));

const solid = (m, x, y) => { const r = m.rows[y]; return !r || r[x] === undefined || HB.SOLID.has(r[x]); };
function reach(m) {
  const seen = new Set(), q = [[Math.floor(m.spawn.x), Math.floor(m.spawn.y)]];
  while (q.length) {
    const [x, y] = q.pop(), k = x + ',' + y;
    if (seen.has(k) || solid(m, x, y)) continue;
    seen.add(k);
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}
// a solid prop counts as reachable if you can stand next to it
const nextTo = (seen, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));

for (const [id, m] of Object.entries(maps)) {
  test('map ' + id + ': shape and spawn', () => {
    assert.ok(m.rows.every((r) => r.length === m.rows[0].length), 'rows are the same width');
    assert.ok(!solid(m, Math.floor(m.spawn.x), Math.floor(m.spawn.y)), 'spawn is walkable');
    assert.ok(HB.THEMES[m.theme], 'theme exists');
  });

  test('map ' + id + ': everything is reachable', () => {
    const seen = reach(m);
    for (const e of m.exits || []) {
      let ok = false;
      for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) if (seen.has(x + ',' + y)) ok = true;
      assert.ok(ok, 'exit to ' + e.to);
    }
    for (const d of (m.doors || []).filter((d) => d.to)) assert.ok(nextTo(seen, d.tx, d.ty), 'door to ' + d.to);
    for (const c of m.chests || []) assert.ok(nextTo(seen, c.tx, c.ty), 'chest ' + c.id);
    for (const c of m.chimes || []) assert.ok(nextTo(seen, c.tx, c.ty), 'chime at ' + c.tx + ',' + c.ty);
    for (const p of m.pickups || []) assert.ok(seen.has(p.tx + ',' + p.ty) || nextTo(seen, p.tx, p.ty), 'pickup ' + p.id);
    for (const n of m.npcs || []) assert.ok(seen.has(Math.floor(n.x) + ',' + Math.floor(n.y)), 'npc ' + n.id);
    if (m.altar) {
      const a = m.altar;
      let ok = false;
      for (let y = a.ty; y < a.ty + (a.h || 1); y++) for (let x = a.tx; x < a.tx + (a.w || 1); x++) if (nextTo(seen, x, y)) ok = true;
      assert.ok(ok, 'altar');
    }
    if (m.shrine) assert.ok(nextTo(seen, m.shrine.tx + 1, m.shrine.ty + 1) || nextTo(seen, m.shrine.tx + 2, m.shrine.ty + 1), 'shrine');
  });

  test('map ' + id + ': ids point at real data', () => {
    for (const e of m.exits || []) {
      const to = maps[e.to];
      assert.ok(to, 'exit target ' + e.to);
      assert.ok(!solid(to, Math.floor(e.spawn.x), Math.floor(e.spawn.y)), 'exit lands on walkable ground in ' + e.to);
    }
    for (const d of (m.doors || []).filter((d) => d.to)) {
      assert.equal(m.rows[d.ty][d.tx], 'D');
      assert.ok(!solid(maps[d.to], Math.floor(d.spawn.x), Math.floor(d.spawn.y)), 'door lands inside ' + d.to);
    }
    for (const c of m.chests || []) {
      assert.equal(m.rows[c.ty][c.tx], 'C', 'chest ' + c.id + ' sits on a chest tile');
      assert.ok(c.gold || HB.ITEMS[c.item], 'chest ' + c.id + ' holds something real');
    }
    for (const c of m.chimes || []) assert.equal(m.rows[c.ty][c.tx], 'q');
    for (const b of m.boards || []) assert.equal(m.rows[b.ty][b.tx], 'D', 'sign ' + b.name + ' hangs over a door');
    for (const d of (m.doors || []).filter((d) => d.shop)) {
      assert.ok(HB.SHOPS[d.shop], 'shop ' + d.shop);
      assert.ok(nextTo(reach(m), d.tx, d.ty), 'shop door ' + d.shop + ' is reachable');
    }
    for (const p of m.pickups || []) assert.ok(HB.ITEMS[p.item], 'pickup item ' + p.item);
    if (m.puzzle) assert.deepEqual([...m.puzzle.order].sort(), [...(m.chimes || []).map((c) => c.note)].sort(), 'puzzle uses each chime once');
    for (const e of m.enemies || []) assert.ok(HB.FOES[e.kind || 'wisp'], 'foe ' + e.kind);
    for (const n of m.npcs || []) {
      assert.ok(HB.PALETTES[n.pal], 'palette ' + n.pal);
      if (n.shop) assert.ok(HB.SHOPS[n.shop], 'shop ' + n.shop);
      if (n.fetch) assert.ok(HB.ITEMS[n.fetch.item] && Object.keys((n.fetch.reward && n.fetch.reward.items) || {}).every((id) => HB.ITEMS[id]), 'fetch ' + n.id);
      if (n.fetch && n.fetch.join) assert.ok(HB.ALLIES[n.fetch.join] && n.hideIf === n.fetch.flag, 'companion ' + n.fetch.join + ' leaves the map once joined');
    }
    if (m.altar) {
      const a = m.altar, boss = HB.FOES[a.boss];
      for (let y = a.ty; y < a.ty + (a.h || 1); y++) for (let x = a.tx; x < a.tx + (a.w || 1); x++) assert.equal(m.rows[y][x], 'X', 'altar tile');
      assert.ok(boss && boss.boss && boss.flag, 'altar boss ' + a.boss);
      assert.ok(HB.FOE_ART[a.boss], 'boss art');
      assert.ok(!a.art || HB.ALTAR_ART[a.art], 'altar art ' + a.art);
      assert.ok(a.n >= 2 && a.n <= 7 && a.intro && a.take && a.taken, 'altar text');
    }
    for (const e of m.enemies || []) assert.ok(HB.FOE_ART[e.kind || 'wisp'] || ['wisp', 'flicker', 'guard'].includes(e.kind || 'wisp'), 'art for ' + e.kind);
    for (const p of m.portals || []) {
      assert.ok(maps[p.to] && !solid(maps[p.to], Math.floor(p.spawn.x), Math.floor(p.spawn.y)), 'portal lands on walkable ground in ' + p.to);
      let ok = false;
      for (let y = p.ty; y < p.ty + (p.h || 1); y++) for (let x = p.tx; x < p.tx + (p.w || 1); x++) if (nextTo(reach(m), x, y)) ok = true;
      assert.ok(ok, 'portal to ' + p.to + ' is reachable');
    }
  });
}

test('the story: seven chapters, one altar per fragment, roads open in order', () => {
  const altars = Object.values(maps).filter((m) => m.altar).map((m) => m.altar.n).sort();
  assert.deepEqual(altars, [2, 3, 4, 5, 6, 7], 'fragments 2-7 each have one altar (1 is the shrine)');
  for (let n = 2; n <= 7; n++) assert.ok(HB.CHAPTERS[n] && HB.CHAPTERS[n].keeper && HB.CHAPTERS[n].lines, 'chapter card ' + n + ' (1 is in main.js)');
  assert.ok(HB.CHAPTERS[7].final && HB.CHAPTERS[7].credits, 'the last card ends the game with credits');
  const gates = Object.values(maps).flatMap((m) => (m.exits || []).concat(m.portals || [])).map((e) => e.need).filter(Boolean);
  for (const g of gates) assert.match(g, /^chapter[1-6]$/, 'gates open on a finished chapter');
  for (let n = 2; n <= 7; n++) assert.ok(HB.QUESTS.find((q) => q.id === 'ch' + n), 'journal entry for chapter ' + n);
  const joins = Object.values(maps).flatMap((m) => m.npcs || []).filter((n) => n.fetch && n.fetch.join).map((n) => n.fetch.join).sort();
  assert.deepEqual(joins, ['dan', 'haru'], '단비 and 하루 join through their quests');
});

test('shops sell real items', () => {
  for (const [id, s] of Object.entries(HB.SHOPS)) for (const it of s.stock) assert.ok(HB.ITEMS[it], id + ': ' + it);
});

test('chest ids are unique across maps', () => {
  const ids = Object.values(maps).flatMap((m) => (m.chests || []).map((c) => c.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('the map screen knows every region and every road between them', () => {
  const R = HB.REGIONS, region = HB.regionOf;
  const linked = (a, b) => [[a, b], [b, a]].some(([x, y]) => (R[x].links || []).concat(R[x].tower || []).includes(y));
  for (const id of Object.keys(maps)) assert.ok(R[region(id)], 'region for ' + id);
  for (const [id, m] of Object.entries(maps)) {
    for (const e of (m.exits || []).concat(m.portals || [])) {
      const a = region(id), b = region(e.to);
      if (a !== b) assert.ok(linked(a, b), 'map link ' + a + ' - ' + b);
    }
  }
  // a new game shows the town and the roads out of it as ???, never the secret grove
  const start = HB.mapNodes({});
  assert.equal(start.town, 'seen');
  assert.equal(start.field, 'unknown');
  assert.ok(!start.grove);
  // an old save without visit flags still shows the chapters it finished
  assert.equal(HB.mapNodes({ chapter1: true, chapter2: true }).port, 'seen');
});

test('the subset fonts have every character the game writes', async () => {
  // assets/fonts holds only these characters; after new text, run python tools/subset-fonts.py
  const { readFileSync, readdirSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const have = new Set(readFileSync(new URL('assets/fonts/chars.txt', root), 'utf8'));
  const files = readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f).concat('index.html');
  const missing = new Set();
  for (const f of files) for (const c of readFileSync(new URL(f, root), 'utf8')) if (c > '~' && !have.has(c)) missing.add(c);
  assert.deepEqual([...missing], [], 'run python tools/subset-fonts.py');
});

test('every chapter road hides a chime puzzle and a piece of gear', () => {
  for (const id of ['mistroad', 'canyon', 'pastwood', 'snowroad', 'starpath', 'bellcore']) {
    const m = maps[id], locked = (m.chests || []).find((c) => c.locked);
    assert.ok(m.puzzle && locked && locked.locked === m.puzzle.flag, id + ': a chest the chimes unlock');
    assert.ok(HB.ITEMS[locked.item].slot && locked.hint, id + ': with gear inside and a hint on the lid');
    assert.ok(m.chests.length >= 2, id + ': and one more chest');
  }
});

test('길 안내 heads for the next altar, then home, along real roads', () => {
  assert.equal(HB.guideTarget({}), 'field', 'chapter 1: the field shrine');
  assert.equal(HB.guideTarget({ fragment1: true }), 'town', 'fragment in hand: back to the keeper');
  assert.equal(HB.guideTarget({ chapter1: true, chapter2: true, chapter3: true }), 'pastwood');
  assert.equal(HB.guideTarget(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => ['chapter' + n, true]))), null, 'nothing after the ending');
  assert.equal(HB.guideNext('town', 'mine'), 'canyon');
  assert.equal(HB.guideNext('town', 'pastwood'), 'pasttown', 'through the clock tower');
  assert.equal(HB.guideNext('observatory', 'town'), 'starpath');
  // every chapter's way can be walked: each step is a real exit or portal of the map
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const f = Object.fromEntries([...Array(n - 1)].map((_, i) => ['chapter' + (i + 1), true]));
    let here = 'town';
    for (let i = 0; i < 10 && here !== HB.guideTarget(f); i++) {
      const next = HB.guideNext(here, HB.guideTarget(f)), m = maps[here];
      assert.ok((m.exits || []).concat(m.portals || []).some((e) => HB.regionOf(e.to) === next), 'chapter ' + n + ': ' + here + ' -> ' + next);
      here = next;
    }
    assert.equal(here, HB.guideTarget(f), 'chapter ' + n + ' reaches its altar');
  }
});
