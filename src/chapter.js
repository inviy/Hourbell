// Chapter framework: what every region needs, driven by map data so chapter
// files stay plain data.
//   map.onEnter   flag set when the map is entered
//   map.altar     { tx, ty, w, h, n, boss, art, intro[], take[], got[], taken }
//                 talk to it: boss fight, then the n-th bell fragment
//   npc.inn       rest and save          npc.shop    open HB.SHOPS[id]
//   npc.fetch     { item, count, start, flag, ask[], wait, thanks[], reward }
//   npc.linesBy   [{ flag, lines }] the last one whose flag is set speaks
//   npc.setFlag   flag set after talking to them
(function (HB) {
  'use strict';

  const T = HB.TILE;

  HB.restAtInn = function (w, name, lines, rest) {
    HB.dialog.open(lines, {
      name,
      onClose: () => {
        const P = HB.party;
        P.hp = P.maxHp; P.mp = P.maxMp;
        P.allies.forEach((a) => { a.hp = HB.allyStats(a.id, P.lvl).maxHp; });
        HB.sfx('heal');
        const saved = HB.save(w);
        HB.dialog.open((rest || '푹 쉬었다. HP와 울림이 모두 회복되었다.') + (saved ? '\n(모험을 기록했다)' : ''));
      }
    });
  };

  // { items: { id: n }, gold } -> added to the party; returns a readable list
  HB.grant = function (P, r) {
    const got = [];
    for (const id in r.items || {}) { P.items[id] = (P.items[id] || 0) + r.items[id]; got.push(HB.ITEMS[id].name + (r.items[id] > 1 ? ' ' + r.items[id] + '개' : '')); }
    if (r.gold) { P.gold += r.gold; got.push(r.gold + '골드'); }
    return got.join(', ');
  };

  const linesFor = (d, f) => {
    const hit = (d.linesBy || []).filter((l) => f[l.flag]).pop();
    return hit ? hit.lines : d.lines;
  };
  const inArea = (a, tx, ty) => tx >= a.tx && tx < a.tx + (a.w || 1) && ty >= a.ty && ty < a.ty + (a.h || 1);

  function fetchQuest(w, d) {
    const q = d.fetch, f = w.flags, P = HB.party, name = d.name;
    if (f[q.flag]) { HB.dialog.open(linesFor(d, f), { name }); return; }
    if (!f[q.start]) { f[q.start] = true; HB.dialog.open(q.ask, { name }); return; }
    const have = P.items[q.item] || 0;
    if (have < q.count) { HB.dialog.open(q.wait.replace('{n}', q.count - have), { name }); return; }
    if ((P.items[q.item] -= q.count) <= 0) delete P.items[q.item];
    f[q.flag] = true;
    HB.dialog.open(q.thanks, { name, onClose: () => { HB.sfx('fragment'); HB.dialog.open(HB.josa(HB.grant(P, q.reward), '을를') + ' 받았다.', { voice: 'narrate' }); } });
  }

  let fragArt = null;
  const artCache = {};

  const Chapter = {
    onLoad(w, def) { if (def.onEnter) w.flags[def.onEnter] = true; },

    talk(w, npc) {
      const d = npc.def, f = w.flags;
      if (!(d.fetch || d.inn || d.shop || d.linesBy || d.setFlag)) return false;
      const lines = linesFor(d, f);
      if (d.setFlag) f[d.setFlag] = true;
      if (d.fetch) fetchQuest(w, d);
      else if (d.inn) HB.restAtInn(w, d.name, lines);
      else if (d.shop) HB.dialog.open(lines, { name: d.name, onClose: () => HB.Menu.openShop(HB.SHOPS[d.shop].title, HB.SHOPS[d.shop].stock) });
      else HB.dialog.open(lines, { name: d.name });
      return true;
    },

    interact(w, tx, ty) {
      const a = w.def.altar;
      if (!a || !inArea(a, tx, ty)) return false;
      const f = w.flags, frag = 'fragment' + a.n;
      if (!f[HB.FOES[a.boss].flag]) {
        HB.dialog.open(a.intro, {
          voice: 'narrate',
          onClose: () => {
            const x = (a.tx + (a.w || 1) / 2) * T, y = (a.ty + (a.h || 1)) * T + 10;
            const boss = { x, y, home: { x, y }, kind: a.boss, ph: 0, cool: 0, dead: false, inBattle: false, flash: 0, hitShake: 0, dying: 0 };
            HB.Field.enemies.push(boss);
            HB.Battle.start(w, [boss]);
          }
        });
      } else if (!f[frag]) {
        HB.dialog.open(a.take, {
          voice: 'narrate',
          onClose: () => {
            f[frag] = true;
            HB.sfx('fragment');
            HB.music.play(HB.Field.musicFor(w), { fadeOut: 1.2, fadeIn: 2.0 });
            HB.dialog.open(['종소리 조각을 손에 넣었다!  (' + HB.fragments(f) + ' / 7)'].concat(a.got || []), { voice: 'narrate' });
          }
        });
      } else HB.dialog.open(a.taken);
      return true;
    },

    drawables(w, list) {
      const a = w.def.altar;
      if (!a) return;
      const cx = (a.tx + (a.w || 1) / 2) * T, base = (a.ty + (a.h || 1)) * T;
      if (a.art) {
        const img = artCache[a.art] || (artCache[a.art] = HB.ALTAR_ART[a.art]());
        list.push({ y: base - 1, draw: (g, cam) => g.drawImage(img, Math.round(cx - img.width / 2 - cam.x), Math.round(base - img.height - cam.y)) });
      }
      if (w.flags['fragment' + a.n]) return;
      if (!fragArt) fragArt = { frag: HB.makeFragment(), glow: HB.makeGlow(16, 'rgba(255,220,120,0.7)') };
      list.push({
        y: base + 1,
        draw: (g, cam) => {
          const sx = Math.round(cx - cam.x), fy = Math.round(base - 6 - cam.y + Math.sin(HB.time * 2) * 2);
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.7 + Math.sin(HB.time * 3) * 0.2;
          g.drawImage(fragArt.glow, sx - 16, fy - 12);
          g.restore();
          g.drawImage(fragArt.frag, sx - 5, fy - 5);
        }
      });
    }
  };

  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.Chapter = Chapter;
  HB.worldPlugins.push(Chapter);
})(window.HB);
