// Map and data integrity: every exit, door, chest, chime and NPC is
// reachable on foot from the map's spawn, and every id points at real data.
// Runs the real map builders from src/maps.js. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const window = { HB: {} };
const ctx = { window, Math, JSON, Object };
// core.js needs a DOM, so take only its seeded RNG (the maps depend on it)
const rng = /HB\.rng = function[\s\S]*?\n  \};/.exec(src('core.js'))[0];
vm.runInNewContext('(function (HB) {' + rng + '})(window.HB);', ctx);
['rules.js', 'sprites.js', 'tiles.js', 'maps.js'].forEach((f) => vm.runInNewContext(src(f), ctx));
const HB = window.HB;
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
    for (const n of m.npcs || []) assert.ok(seen.has(Math.floor(n.x) + ',' + Math.floor(n.y)), 'npc ' + n.id);
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
    if (m.puzzle) assert.deepEqual([...m.puzzle.order].sort(), [...(m.chimes || []).map((c) => c.note)].sort(), 'puzzle uses each chime once');
    for (const e of m.enemies || []) assert.ok(HB.FOES[e.kind || 'wisp'], 'foe ' + e.kind);
    for (const n of m.npcs || []) assert.ok(HB.PALETTES[n.pal], 'palette ' + n.pal);
  });
}

test('chest ids are unique across maps', () => {
  const ids = Object.values(maps).flatMap((m) => (m.chests || []).map((c) => c.id));
  assert.equal(new Set(ids).size, ids.length);
});
