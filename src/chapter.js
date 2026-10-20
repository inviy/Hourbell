// Chapter framework: what every region needs, driven by map data so chapter
// files stay plain data.
//   map.onEnter   flag set when the map is entered
//   map.altar     { tx, ty, w, h, n, boss, art, intro[], take[], got[], taken }
//                 talk to it: boss fight, then the n-th bell fragment
//   npc.inn       rest and save          npc.shop    open HB.SHOPS[id]
//   npc.fetch     { item, count, start, flag, ask[], wait, thanks[], reward }
//   npc.linesBy   [{ flag, lines }] the last one whose flag is set speaks
//   npc.setFlag   flag set after talking to them
//   npc.fetch.join  companion id who joins the party when the fetch is done
//   map.portals   [{ tx, ty, w, h, need, until, to, spawn, lines }] talk to
//                 travel (the town tower into the past, into the bell)
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
        const p = w.player; // a lost battle in this chapter wakes you here (battle.js lose)
        w.flags.restAt = { map: w.def.id, x: p.x / T, y: p.y / T, dir: p.dir };
        const saved = HB.save(w);
        HB.dialog.open((rest || '푹 쉬었다. HP와 울림이 모두 회복되었다.') + (saved ? '\n(모험을 기록했다)' : ''), { onClose: () => HB.innTalk(w) });
      }
    });
  };

  // [[name, text], ...] one dialog after another, then done(). No name: narration
  HB.sayChain = function (list, done) {
    if (!list.length) { if (done) done(); return; }
    const [name, text] = list[0];
    HB.dialog.open(text, { name, voice: name ? undefined : 'narrate', onClose: () => HB.sayChain(list.slice(1), done) });
  };
  // what the companions in the party say: { mio: text, ... } -> [[name, text]]
  HB.partyLines = (by) => HB.party.allies.filter((a) => by && by[a.id]).map((a) => [HB.ALLIES[a.id].name, by[a.id]]);

  // a rest at an inn with two companions along: they talk, each pair once
  HB.INN_TALKS = [
    { flag: 'talkMioDan', who: ['mio', 'dan'], lines: [
      ['mio', '단비 씨, 아까 그 망치질... 박자가 딱딱 맞던데요?'],
      ['dan', '광산에선 박자를 놓치면 손가락이 남아나질 않거든.'],
      ['mio', '그럼 다음 노래 반주 부탁해도 돼요?'],
      ['dan', '...박자만 맞춰 준다면. 노래는 안 해.']] },
    { flag: 'talkDanHaru', who: ['dan', 'haru'], lines: [
      ['haru', '단비 누나, 50년 뒤에도 시계탑은 그대로 있어?'],
      ['dan', '있지. 그 앞에 종지기 할아버지가 늘 앉아 계셔.'],
      ['haru', '그 할아버지가 노을이라니... 아직도 상상이 안 돼.'],
      ['dan', '나도 할아버지가 젊었던 적이 있다는 게 상상이 안 돼.']] },
    { flag: 'talkMioHaru', who: ['mio', 'haru'], lines: [
      ['mio', '하루는 시계 소리만 들어도 몇 시인지 안다면서요?'],
      ['haru', '응. 근데 여기 시계들은 다 같은 시각에 멈춰 있어서 좀 쓸쓸해.'],
      ['mio', '그럼 종이 다시 울리면, 제일 먼저 하루한테 몇 시냐고 물어볼게요.']] },
    { flag: 'talkPip', who: ['mio'], pet: true, lines: [
      [null, '방울이 미오의 악보를 물고 침대 밑으로 쏙 들어갔다.'],
      ['mio', '방울아! 그거 오늘 밤에 부를 노래란 말이야!'],
      [null, '...침대 밑에서 악보 대신 작은 코골이 소리가 들려왔다.'],
      ['mio', '...졸리면 졸리다고 말을 하지.']] },
    { flag: 'talkAll', who: ['mio', 'dan', 'haru'], need: 'chapter5', lines: [
      ['dan', '별이 이렇게 가까운 건 처음이야.'],
      ['haru', '시계탑 꼭대기에서 보던 별보다 훨씬 커.'],
      ['mio', '다 끝나면 넷이서 여기 다시 와요. 그땐 노래도 끝까지 부를게요.']] }
  ];
  HB.innTalk = function (w) {
    const has = (id) => HB.party.allies.some((a) => a.id === id);
    const t = HB.INN_TALKS.find((k) => !w.flags[k.flag] && k.who.every(has) && (!k.need || w.flags[k.need]) && (!k.pet || HB.party.pet));
    if (!t) return false;
    w.flags[t.flag] = true;
    HB.sayChain(t.lines.map(([id, text]) => [id && HB.ALLIES[id].name, text])); // no id: narration
    return true;
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
  HB.linesFor = linesFor;
  const inArea = (a, tx, ty) => tx >= a.tx && tx < a.tx + (a.w || 1) && ty >= a.ty && ty < a.ty + (a.h || 1);

  function fetchQuest(w, d) {
    const q = d.fetch, f = w.flags, P = HB.party, name = d.name;
    if (f[q.flag]) { HB.dialog.open(linesFor(d, f), { name }); return; }
    if (!f[q.start]) { f[q.start] = true; HB.dialog.open(q.ask, { name }); return; }
    const have = P.items[q.item] || 0;
    if (have < q.count) { HB.dialog.open(q.wait.replace('{n}', q.count - have), { name }); return; }
    if ((P.items[q.item] -= q.count) <= 0) delete P.items[q.item];
    f[q.flag] = true;
    const join = () => {
      if (!q.join || P.allies.length >= HB.MAX_ALLIES) return;
      P.allies.push({ id: q.join, hp: HB.allyStats(q.join, P.lvl).maxHp });
      w.npcs = w.npcs.filter((n) => n.def !== d);
      HB.dialog.open(HB.josa(HB.ALLIES[q.join].name, '이가') + ' 동료가 되었다!', { voice: 'narrate' });
    };
    HB.dialog.open(q.thanks, {
      name,
      onClose: () => {
        HB.sfx('fragment');
        if (q.reward) HB.dialog.open(HB.josa(HB.grant(P, q.reward), '을를') + ' 받았다.', { voice: 'narrate', onClose: join });
        else join();
      }
    });
  }

  // after a fragment the bell can carry you home to the keeper, or you stay
  // (from the past too: the bell's song crosses the years)
  HB.offerReturn = function (w) {
    HB.dialog.open('조각에서 울린 종소리가 울림골 쪽으로 길게 이어진다.', {
      voice: 'narrate',
      choices: ['종소리를 따라 울림골로 돌아간다', '조금 더 둘러본다'],
      onChoose: (i) => {
        if (i) return;
        HB.farewell(w, () => {
          HB.sfx('bell');
          HB.fadeTo(() => w.load('town', { x: 16.5, y: 15.4, dir: 'up' }), { dur: 1.6, color: '#fff4e0' });
        });
      }
    });
  };

  // leaving the past for good (after its fragment), the young 노을 sees you off, once
  HB.farewell = function (w, go) {
    const f = w.flags, region = HB.REGIONS[HB.regionOf(w.def.id)];
    if (!f.fragment4 || f.saidBye || !region || region.ch !== 4) { go(); return; }
    f.saidBye = true;
    const haru = HB.party.allies.some((a) => a.id === 'haru');
    HB.sayChain([
      [null, '시계탑 아래에서 젊은 노을이 기다리고 있었다.'],
      ['노을', '가는 거지? ...그 시계탑 너머, 네가 온 시간으로.'],
      ['노을', '이상해. 처음 본 사람인데, 아주 오래 알던 사람 같아.'],
      ['노을', '약속할게. 이 종은 내가 끝까지 지킬게. 네가 다시 들으러 올 때까지.']
    ].concat(haru ? [['하루', '노을아, 해시계 잘 부탁해. ...나중에, 아주 나중에 또 보자.'], ['노을', '응. 하루도 꼭.']] : [])
      .concat([[null, '젊은 종지기는 시곗바늘이 감길 때까지 손을 흔들었다.']]), go);
  };

  let fragArt = null;
  const artCache = {};

  const Chapter = {
    onLoad(w, def) {
      if (def.onEnter) w.flags[def.onEnter] = true;
      w.flags['map:' + (def.id === 'inn' ? 'town' : def.id)] = true; // for the map screen
    },

    talk(w, npc) {
      const d = npc.def, f = w.flags;
      if (!(d.fetch || d.inn || d.shop || d.linesBy || d.setFlag || d.fight)) return false;
      // npc.fight: a foe kind to face after the lines (once its flag is set it is gone)
      if (d.fight && !f[HB.FOES[d.fight].flag]) {
        HB.dialog.open(d.lines, { name: d.name, onClose: () => {
          const foe = { x: npc.x, y: npc.y, home: { x: npc.x, y: npc.y }, kind: d.fight, ph: 0, cool: 0, dead: false, inBattle: false, flash: 0, hitShake: 0, dying: 0 };
          w.npcs = w.npcs.filter((n) => n !== npc);
          HB.Field.enemies.push(foe);
          HB.Battle.start(w, [foe]);
        } });
        return true;
      }
      const lines = linesFor(d, f);
      if (d.setFlag) f[d.setFlag] = true;
      if (d.fetch) fetchQuest(w, d);
      else if (d.inn) HB.restAtInn(w, d.name, lines);
      else if (d.shop) HB.dialog.open(lines, { name: d.name, onClose: () => HB.Menu.openShop(HB.SHOPS[d.shop].title, HB.SHOPS[d.shop].stock) });
      else HB.dialog.open(lines, { name: d.name });
      return true;
    },

    interact(w, tx, ty) {
      const f0 = w.flags;
      const gate = (w.def.portals || []).filter((p) => inArea(p, tx, ty) && (!p.need || f0[p.need]) && !(p.until && f0[p.until])).pop();
      if (gate) {
        HB.farewell(w, () => HB.dialog.open(gate.lines, { voice: 'narrate', onClose: () => { HB.sfx('bell'); HB.fadeTo(() => w.load(gate.to, gate.spawn), { dur: 1.6, color: '#fff4e0' }); } }));
        return true;
      }
      const a = w.def.altar;
      if (!a || !inArea(a, tx, ty)) return false;
      const f = w.flags, frag = 'fragment' + a.n;
      if (!f[HB.FOES[a.boss].flag]) {
        const again = f['tried_' + a.boss]; // a retry gets one line, not the whole scene
        f['tried_' + a.boss] = true;
        HB.dialog.open(again ? ['다시 맞선다. ' + HB.josa(HB.FOES[a.boss].name, '이가') + ' 깨어난다!'] : a.intro, {
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
            HB.saveSoon();
            HB.sfx('fragment');
            HB.music.play(HB.Field.musicFor(w), { fadeOut: 1.2, fadeIn: 2.0 });
            HB.dialog.open(['종소리 조각을 손에 넣었다!  (' + HB.fragments(f) + ' / 7)'].concat(a.got || []), { voice: 'narrate', onClose: () => HB.offerReturn(w) });
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
