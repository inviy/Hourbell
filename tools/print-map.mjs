// Prints a map as text, with its exits, NPCs, chests and foes marked, to read
// a layout without the game. Run: node tools/print-map.mjs <map id>   (no id: list them)
import { loadHB } from '../tests/sim.mjs';

const HB = loadHB(['rules.js', 'sprites.js', 'tiles.js', 'maps.js', 'ch2.js', 'ch3.js', 'ch4.js', 'ch5.js', 'ch6.js', 'ch7.js']);
const id = process.argv[2];
if (!id || !HB.MAPS[id]) { console.log('maps:', Object.keys(HB.MAPS).join(' ')); process.exit(id ? 1 : 0); }
const m = HB.MAPS[id](), rows = m.rows.map((r) => r.split(''));
const mark = (x, y, c) => { if (rows[Math.floor(y)]) rows[Math.floor(y)][Math.floor(x)] = c; };
for (const n of m.npcs || []) mark(n.x, n.y, '@');
for (const e of m.enemies || []) mark(e.x, e.y, 'e');
for (const e of m.exits || []) for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) mark(x, y, '>');
mark(m.spawn.x, m.spawn.y, 'S');
console.log(id + ' ' + m.rows[0].length + 'x' + m.rows.length + '  (S spawn, @ npc, e foe, > exit, C chest, q chime; other letters are tiles, see src/tiles.js)');
rows.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r.join('')));
