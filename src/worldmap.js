// The map screen (menu > 지도): the regions you have been to, how they
// connect, where you are and the story's next step.
(function (HB) {
  'use strict';

  // map id -> label, screen position (center), chapter, linked regions.
  // tests/data.test.mjs checks every exit and portal between maps is a link here.
  // tower: links through the clock tower. secret: never shown before found
  HB.REGIONS = {
    town: { name: '울림골', x: 200, y: 156, ch: 1, links: ['field', 'mistroad', 'canyon'], tower: ['pasttown', 'bellcore'] },
    field: { name: '바람결 들판', x: 200, y: 196, ch: 1, links: ['grove'] },
    grove: { name: '풍경 숲', x: 312, y: 196, ch: 1, secret: 'grovePuzzle' },
    mistroad: { name: '물안개 길', x: 312, y: 156, ch: 2, links: ['port'] },
    port: { name: '물안개 항구', x: 416, y: 156, ch: 2 },
    canyon: { name: '메아리 협곡', x: 200, y: 116, ch: 3, links: ['mine', 'snowroad'] },
    mine: { name: '울림 광산', x: 312, y: 116, ch: 3 },
    pasttown: { name: '50년 전 울림골', x: 76, y: 156, ch: 4, links: ['pastwood'] },
    pastwood: { name: '째깍 숲', x: 76, y: 196, ch: 4 },
    snowroad: { name: '눈꽃 고갯길', x: 200, y: 76, ch: 5, links: ['snowpeak'] },
    snowpeak: { name: '눈꽃 산마루', x: 200, y: 36, ch: 5, links: ['starpath'] },
    starpath: { name: '구름다리', x: 312, y: 36, ch: 6, links: ['observatory'] },
    observatory: { name: '별빛 천문대', x: 416, y: 36, ch: 6 },
    bellcore: { name: '아워벨 내부', x: 76, y: 116, ch: 7 }
  };
  const R = HB.REGIONS;
  const region = (id) => (id === 'inn' ? 'town' : id);
  HB.regionOf = region;

  // been there (old saves without visit flags: any region of a finished chapter)
  const seen = (f, id) => id === 'town' || f['map:' + id] || (R[id].secret ? f[R[id].secret] : f['chapter' + R[id].ch]);
  const edges = () => Object.keys(R).flatMap((a) => (R[a].links || []).map((b) => [a, b, false]).concat((R[a].tower || []).map((b) => [a, b, true])));
  // the regions on the map: been there, or next to somewhere you have been (shown as ???)
  HB.mapNodes = function (f) {
    const out = {};
    for (const id in R) if (seen(f, id)) out[id] = 'seen';
    for (const [a, b] of edges()) {
      if (out[a] === 'seen' && !out[b] && !R[b].secret) out[b] = 'unknown';
      if (out[b] === 'seen' && !out[a] && !R[a].secret) out[a] = 'unknown';
    }
    return out;
  };

  if (!HB.Menu) return; // node tests load the data only

  HB.Menu.hooks.push({ label: '지도', mode: 'map' });
  HB.menuScreens.map = (menu, w) => [{ label: '지도', desc: '다음 목표: ' + HB.currentGoal(w.flags, HB.party), act: () => {} }];
  HB.menuDraw.map = (g, w) => {
    const f = w.flags, nodes = HB.mapNodes(f), here = region(w.def.id);
    HB.drawWindow(g, 8, 8, HB.W - 16, 222, 1); // opaque: the menu list sits behind it
    HB.text(g, '지도', 20, 13, '#ffe08a');
    HB.text(g, '현재 위치: ' + (R[here] ? R[here].name : w.def.name), HB.W - 20, 14, '#c8c0e0', { font: 'g9', align: 'right' });
    // roads, then the clock tower's links in dashes
    for (const [a, b, tower] of edges()) {
      if (!nodes[a] || !nodes[b]) continue;
      const ax = R[a].x, ay = R[a].y, bx = R[b].x, by = R[b].y, n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      g.fillStyle = nodes[a] === 'seen' && nodes[b] === 'seen' ? '#c8b07a' : '#6a6488';
      for (let i = 0; i <= n; i++) if (!tower || i % 6 < 3) g.fillRect(Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n), 2, 2);
    }
    for (const id in nodes) {
      const r = R[id], known = nodes[id] === 'seen', label = known ? r.name : '???';
      const bw = HB.textWidth(label, 'g9') + 12, x = Math.round(r.x - bw / 2), y = r.y - 7;
      g.fillStyle = id === here ? '#5a3a10' : known ? '#1a1c48' : '#141428';
      g.fillRect(x, y, bw, 14);
      g.fillStyle = id === here ? '#ffe08a' : known ? '#9aa4d8' : '#4a4868';
      g.fillRect(x, y, bw, 1); g.fillRect(x, y + 13, bw, 1); g.fillRect(x, y, 1, 14); g.fillRect(x + bw - 1, y, 1, 14);
      HB.text(g, label, r.x, y + 2, id === here ? '#fff4d8' : known ? '#e8e4f8' : '#7a7898', { font: 'g9', align: 'center' });
      if (id === here && Math.floor(HB.time * 2) % 2 === 0) { g.fillStyle = '#ffe08a'; g.fillRect(x - 6, r.y - 2, 4, 4); }
    }
    HB.text(g, '- - 시계탑으로 이어진 곳', HB.W - 20, 216, '#8a84a8', { font: 'g9', align: 'right' });
  };
})(window.HB);
