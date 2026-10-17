// Quests and the quest log. Progress is read from world flags and the
// party, so there is no separate quest state to save.
(function (HB) {
  'use strict';

  const mioCount = (f, P) => Math.min(3, (P.kills.flicker || 0) - (f.mioStart || 0));

  // steps: [label (or fn returning one), done(flags, party)]
  HB.QUESTS = [
    {
      id: 'main', name: '흩어진 종소리', start: () => true,
      steps: [
        ['종지기 노인과 이야기한다', (f) => f.metKeeper],
        ['들판 남쪽 제단의 파수꾼을 물리친다', (f) => f.boss1],
        ['제단에서 종소리 조각을 손에 넣는다', (f) => f.fragment1],
        ['조각 소식을 종지기에게 전한다', (f) => f.chapter1]
      ]
    },
    {
      id: 'mio', name: '잃어버린 목소리', start: (f) => f.mioAsked,
      steps: [
        [(f, P) => '떨림이를 물리친다 (' + mioCount(f, P) + ' / 3)', (f, P) => mioCount(f, P) >= 3],
        ['여관의 미오에게 돌아간다', (f) => f.mioJoined]
      ]
    },
    {
      id: 'toby', name: '토비의 생일 선물', start: (f) => f.tobyAsked,
      steps: [
        ['바람꽃을 찾는다 (바람이 머무는 숲)', (f, P) => P.items.windflower || f.tobyDone],
        ['토비에게 바람꽃을 준다', (f) => f.tobyDone]
      ]
    }
  ];

  // { started, step: index of the first unfinished step, done, label(i) }
  HB.questState = function (q, f, P) {
    let step = q.steps.findIndex(([, done]) => !done(f, P));
    if (step < 0) step = q.steps.length;
    const label = (i) => (typeof q.steps[i][0] === 'function' ? q.steps[i][0](f, P) : q.steps[i][0]);
    return { started: !!q.start(f, P), step, done: step === q.steps.length, label };
  };

  function joinMio(w) {
    const P = HB.party, me = w.npcs.find((n) => n.def.id === 'mio');
    const px = w.player.x / HB.TILE, py = w.player.y / HB.TILE;
    HB.cutscene([
      ['say', ['(미오가 천천히 숨을 들이쉰다.)'], { voice: 'narrate' }],
      ['sfx', 'chime'], ['wait', 0.8],
      ['say', ['아... 아, 아! 목소리가 돌아왔어!', '고마워요. 이번엔 내 노래로 당신을 지킬게요. 같이 가요!'], { name: '노래꾼 미오' }],
      ['move', 'mio', px + (me && me.x < w.player.x ? -1 : 1), py],
      ['face', 'mio', me && me.x < w.player.x ? 'right' : 'left'],
      ['call', (wd) => {
        P.allies.push({ id: 'mio', hp: HB.allyStats('mio', P.lvl).maxHp });
        wd.flags.mioJoined = true;
        wd.npcs = wd.npcs.filter((n) => n.def.id !== 'mio');
      }],
      ['sfx', 'fragment'],
      ['say', '미오가 동료가 되었다! 전투에서 노래로 돕는다.', { voice: 'narrate' }]
    ]);
  }

  const Quests = {
    talk(w, npc) {
      const id = npc.def.id, f = w.flags, P = HB.party, name = npc.def.name;
      if (id === 'keeper') { f.metKeeper = true; return false; } // keeper's own lines still play
      if (id === 'mio') {
        if (!f.mioAsked) {
          f.mioAsked = true; f.mioStart = P.kills.flicker || 0;
          HB.dialog.open(['(노래꾼은 입을 열지만 소리가 나오지 않는다. 대신 쪽지를 내민다.)',
            '"들판의 떨림이들이 제 목소리를 삼켰어요. 셋만 물리쳐 주면 돌아올 것 같아요."'], { voice: 'narrate' });
        } else if (mioCount(f, P) < 3) {
          HB.dialog.open('(미오가 손가락을 펴 보인다. 떨림이가 아직 ' + (3 - mioCount(f, P)) + '마리 남았다.)', { voice: 'narrate' });
        } else joinMio(w);
        return true;
      }
      if (id === 'child') {
        const lead = f.fragment1 ? ['방금 종이 흔들렸어! 봤어? 봤지?'] : [];
        if (f.tobyDone) HB.dialog.open(lead.concat(['바람꽃 고마워! 이번 생일엔 꼭 내일이 올 거야!']), { name });
        else if (P.items.windflower) {
          delete P.items.windflower;
          P.items.amulet = (P.items.amulet || 0) + 1; P.gold += 30;
          f.tobyDone = true;
          HB.dialog.open(['우와, 바람꽃이다! 진짜로 혼자 흔들려!', '이거 받아. 할머니가 준 부적이랑 내 용돈이야.'], {
            name, onClose: () => { HB.sfx('fragment'); HB.dialog.open('수호 부적과 30골드를 받았다.', { voice: 'narrate' }); }
          });
        } else if (!f.tobyAsked) {
          f.tobyAsked = true;
          HB.dialog.open(lead.concat(npc.def.lines, ['있잖아, 생일 선물로 바람꽃을 갖고 싶어. 바람이 머무는 숲에 핀대!']), { name });
        } else HB.dialog.open(lead.concat(['바람꽃은 바람이 머무는 숲에 핀대. 들판 어딘가에 있을 거야!']), { name });
        return true;
      }
      return false;
    }
  };
  HB.worldPlugins.push(Quests);

  // ---------- quest log (menu) ----------
  HB.Menu.hooks.push({ label: '일지', mode: 'quests' });
  HB.menuScreens.quests = (menu, w) => {
    const P = HB.party;
    const list = HB.QUESTS.map((q) => [q, HB.questState(q, w.flags, P)]).filter(([, s]) => s.started);
    return list.map(([q, s]) => ({
      label: q.name, right: s.done ? '완료' : '', dim: s.done, quest: q,
      desc: s.done ? '완료한 일' : s.label(s.step), act: () => {}
    }));
  };
  HB.menuDraw.quests = (g, w) => {
    const m = HB.Menu, rows = m.rows(w), sel = rows[m.mode.cur];
    if (!sel) return;
    const s = HB.questState(sel.quest, w.flags, HB.party);
    const x = 176, y = 8, wdt = 296;
    HB.drawWindow(g, x, y, wdt, 22 + sel.quest.steps.length * 16);
    HB.text(g, sel.quest.name, x + 12, y + 5, '#ffe08a');
    sel.quest.steps.forEach((st, i) => {
      const col = i < s.step ? '#8a9a8a' : i === s.step ? '#fff4d8' : '#6a6a88';
      HB.text(g, (i < s.step ? '✓ ' : i === s.step ? '▶ ' : '· ') + (i <= s.step ? s.label(i) : '???'), x + 14, y + 22 + i * 16, col, { font: 'g9' });
    });
  };
})(window.HB);
