// 길 안내: a small marker over the way out of this map that leads toward the
// story's next stop, and an arrow at the screen edge when it is off screen.
// Off in options (HB.options.guide). Needs src/worldmap.js (HB.REGIONS).
(function (HB) {
  'use strict';

  const T = HB.TILE;
  // where each chapter's fragment waits (its altar), and home after it
  const ALTAR = { 1: 'field', 2: 'port', 3: 'mine', 4: 'pastwood', 5: 'snowpeak', 6: 'observatory', 7: 'bellcore' };

  // the region to head for: the next altar, or 울림골 once its fragment is in hand
  HB.guideTarget = function (f) {
    const n = [1, 2, 3, 4, 5, 6, 7].find((k) => !f['chapter' + k]);
    if (!n) return null;
    return f['fragment' + n] ? 'town' : ALTAR[n];
  };

  // the next region on the shortest way (roads and the clock tower both count)
  HB.guideNext = function (from, to) {
    const R = HB.REGIONS, near = {};
    for (const a in R) for (const b of (R[a].links || []).concat(R[a].tower || [])) {
      (near[a] = near[a] || []).push(b); (near[b] = near[b] || []).push(a);
    }
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const a = q.shift();
      if (a === to) break;
      for (const b of near[a] || []) if (!(b in prev)) { prev[b] = a; q.push(b); }
    }
    if (!(to in prev) || from === to) return null;
    let step = to;
    while (prev[step] !== from) step = prev[step];
    return step;
  };

  // the spot in this map that leads to region `next` (an exit or a portal), in pixels
  function wayOut(w, next) {
    const f = w.flags, region = HB.regionOf;
    const e = (w.def.exits || []).find((x) => region(x.to) === next && (!x.need || f[x.need]));
    if (e) return { x: (e.x0 + e.x1 + 1) / 2 * T, y: (e.y0 + e.y1 + 1) / 2 * T };
    const p = (w.def.portals || []).find((x) => region(x.to) === next && (!x.need || f[x.need]) && !(x.until && f[x.until]));
    if (p) return { x: (p.tx + (p.w || 1) / 2) * T, y: (p.ty + (p.h || 1)) * T };
    // indoors (the inn): out the door, back to town
    const d = (w.def.exits || [])[0];
    return d && next === 'town' ? { x: (d.x0 + d.x1 + 1) / 2 * T, y: (d.y0 + d.y1 + 1) / 2 * T } : null;
  }

  (HB.worldPlugins = HB.worldPlugins || []).push({ // (node tests load this file without the world)
    drawOverlay(w, g, cam) {
      if (!HB.options.guide || !HB.REGIONS || HB.dialog.active || (HB.Battle && HB.Battle.active) || (HB.Menu && HB.Menu.open)) return false;
      const target = HB.guideTarget(w.flags), here = HB.regionOf(w.def.id);
      if (!target || target === here && w.def.id !== 'inn') return false;
      const spot = wayOut(w, w.def.id === 'inn' ? 'town' : HB.guideNext(here, target)); // indoors: the door first
      if (!spot) return false;
      const sx = spot.x - cam.x, sy = spot.y - cam.y, pulse = 0.55 + 0.45 * Math.sin(HB.time * 4);
      g.save();
      g.globalAlpha = pulse;
      g.fillStyle = '#ffe08a';
      if (sx > 8 && sx < HB.W - 8 && sy > 8 && sy < HB.H - 8) {
        // on screen: a little diamond bobbing over the way out
        const y = Math.round(sy - 20 + Math.sin(HB.time * 3) * 2), x = Math.round(sx);
        g.fillRect(x - 1, y - 3, 3, 7); g.fillRect(x - 3, y - 1, 7, 3);
      } else {
        // off screen: an arrow on the edge, pointing at it
        const cx = HB.W / 2, cy = HB.H / 2, a = Math.atan2(sy - cy, sx - cx);
        const k = Math.min((HB.W / 2 - 14) / Math.abs(Math.cos(a) || 1e-6), (HB.H / 2 - 14) / Math.abs(Math.sin(a) || 1e-6));
        const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
        g.translate(Math.round(ax), Math.round(ay)); g.rotate(a);
        g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -5); g.lineTo(-2, 0); g.lineTo(-5, 5); g.closePath(); g.fill();
      }
      g.restore();
      return false;
    }
  });
})(window.HB);
