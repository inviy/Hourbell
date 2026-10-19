// Chapter 4: 50년 전 울림골. The tower turns back fifty years: the same
// town in sepia, a young keeper, the bell not yet hung, and the wood south
// of town where something gnaws on time. 하루 joins here.
(function (HB) {
  'use strict';

  const { sprinkle, forestBorder } = HB.mapTools;
  const Grid = HB.Grid;

  Object.assign(HB.THEMES, {
    past: {
      grass: '#8a9a5a', grassLight: '#a0b070', grassDark: '#6a7a44', tuft: '#b8c080',
      path: '#c8b088', pathLight: '#dcc8a0', pathDark: '#a08c68',
      stone: '#b0a490', stoneLight: '#ccc0a8', stoneDark: '#847864',
      water: '#5a7a8a', waterDark: '#44606e', waterLight: '#a0c0c8', foam: '#e8f0e8',
      roof: '#a0603a', roofDark: '#704028', roofLight: '#c07a50',
      wall: '#e8d8b8', wallDark: '#bca888', beam: '#6a4a30',
      leaf: '#6a8040', leafDark: '#4a5a2c', leafLight: '#8aa058', trunk: '#6a4a2a',
      flowers: ['#f8f0d8', '#f0d070', '#e8a888', '#c8c0e8']
    }
  });

  Object.assign(HB.PALETTES, {
    youngkeeper: { h: '#5a3a28', s: '#f0c8a0', c: '#6a4a8c', C: '#46305e', g: '#c8a040', b: '#3a2a20' },
    youngsmith: { h: '#3a2418', s: '#d8a078', c: '#7a7a84', C: '#54545e', g: '#c87a3a', b: '#2a1a14' },
    pastinn: { h: '#8a5a3a', s: '#f0c8a0', c: '#c8784a', C: '#904a2a', g: '#f0e0c0', b: '#3a2418' }
  });

  // ---------- foes ----------
  Object.assign(HB.FOES, {
    tickwisp: { name: '째깍먹이', hp: 96, atk: 44, def: 14, spd: 12, exp: 40, gold: [40, 54], drop: ['honeycake', 0.15], swallow: 0.3, weak: 'sound' },
    cogolem: { name: '태엽골렘', hp: 130, atk: 48, def: 24, spd: 5, exp: 52, gold: [51, 65], drop: ['cog', 0.5], weak: 'wind', resist: 'sound', trait: 'curl' },
    duskbat: { name: '노을박쥐', hp: 88, atk: 45, def: 12, spd: 16, exp: 38, gold: [38, 51], drop: ['bigdrop', 0.25], weak: 'wind', trait: 'double' },
    timeeater: {
      name: '시간갉기', hp: 560, atk: 56, def: 18, spd: 10, exp: 1100, gold: [900, 900], drop: ['honeycake', 2], boss: true,
      flag: 'boss4', waveEvery: 4, fogEvery: 5, fogName: '시간 먼지',
      intro: '째깍, 째깍... 시간을 갉아 먹는 소리가 숲을 채운다.', won: '멈칫하던 해시계 그림자가 다시 움직이기 시작했다!'
    }
  });
  HB.FOE_ART = Object.assign(HB.FOE_ART || {}, {
    tickwisp: { shape: 'wisp', pal: { out: '#3a2a10', dark: '#8a6a2a', mid: '#c8a050', light: '#f8e0a0', eye: '#fff8e0' }, sight: 80, chase: 44, roam: 44, scale: 1 },
    cogolem: { shape: 'golem', pal: { out: '#2a1a08', dark: '#7a5a28', mid: '#b88a40', light: '#e8c070', eye: '#f04a3a', glow: '#f8e070' }, sight: 56, chase: 28, roam: 20, scale: 1 },
    duskbat: { shape: 'bat', pal: { out: '#2a1010', dark: '#7a3a2a', mid: '#c06a4a', light: '#f0a880', eye: '#fff0a0', wing: '#8a4a3a' }, sight: 96, chase: 54, roam: 60, scale: 1 },
    timeeater: { shape: 'golem', pal: { out: '#100a04', dark: '#3a2a14', mid: '#6a5028', light: '#a88a50', eye: '#f4c450', glow: '#f4c450' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  });

  // ---------- items: fourth-tier gear ----------
  Object.assign(HB.ITEMS, {
    cog: { name: '태엽 톱니', key: true, price: 0, desc: '아직도 째깍거리는 작은 톱니바퀴.' },
    honeycake: { name: '꿀떡', hp: 260, price: 110, desc: 'HP를 260 회복한다.' },
    brassmallet: { name: '놋쇠 종채', slot: 'weapon', atk: 20, price: 460, desc: '공격 +20' },
    tophat: { name: '시계공 모자', slot: 'head', def: 7, price: 340, desc: '방어 +7' },
    oldcoat: { name: '반세기 외투', slot: 'armor', def: 12, price: 580, desc: '방어 +12' },
    tickgloves: { name: '태엽 장갑', slot: 'hands', atk: 8, price: 370, desc: '공격 +8' },
    oldboots: { name: '옛길 장화', slot: 'feet', spd: 6, def: 3, price: 390, desc: '속도 +6, 방어 +3' },
    pocketwatch: { name: '회중시계', slot: 'charm', def: 4, spd: 4, price: 490, desc: '방어 +4, 속도 +4' },
    oldsong: { name: '오래된 노래', slot: 'score', pow: 65, price: 620, desc: '기술 위력 +65%' }
  });
  HB.SHOPS.past = { title: '젊은 브론의 대장간', stock: ['honeycake', 'soup', 'bigdrop', 'water', 'brassmallet', 'tophat', 'oldcoat', 'tickgloves', 'oldboots', 'pocketwatch', 'oldsong'] };

  // ---------- maps ----------
  // the same town, fifty years younger
  function buildPastTown() {
    const d = HB.MAPS.town();
    return Object.assign(d, {
      id: 'pasttown', name: '50년 전 울림골', sub: '종이 아직 걸리지 않은 마을',
      theme: 'past', mood: 'past', music: 'past', onEnter: 'pastArrived',
      spawn: { x: 16.5, y: 12.8, dir: 'down' },
      exits: [{ x0: 16, x1: 17, y0: 23, y1: 23, to: 'pastwood', spawn: { x: 11.5, y: 1.5, dir: 'down' } }],
      portals: [{ tx: 15, ty: 10, w: 3, h: 2, to: 'town', spawn: { x: 14.5, y: 12.8, dir: 'down' }, lines: ['시계탑의 바늘이 앞으로 감긴다...', '노을빛이 한 장씩 다시 덮인다.'] }],
      signs: [
        { tx: 18, ty: 21, text: '남쪽 - 째깍 숲\n해시계에 손대지 마시오.' },
        { tx: 13, ty: 8, text: '울림골 - 새 종을 기다리는 마을\n종 거는 날: 미정 (해시계가 멈췄음)' }
      ],
      doors: [
        { tx: 6, ty: 5, text: '빈집이다. 나중에 누군가 살게 될 것 같다.' },
        { tx: 27, ty: 5, text: '대장간. 젊은 대장장이가 종틀을 두드리고 있다.' },
        { tx: 5, ty: 17, text: '아직 꽃집이 아니다. 씨앗 봉투만 잔뜩 쌓여 있다.' },
        { tx: 28, ty: 17, text: '여관 "쉬어가는 종" - 간판의 페인트가 아직 새것이다.' }
      ],
      boards: [{ tx: 27, ty: 5, icon: 'anvil', name: '대장간' }, { tx: 28, ty: 17, icon: 'bell', name: '여관' }],
      npcs: [
        {
          id: 'youngkeeper', name: '젊은 종지기 노을', pal: 'youngkeeper', x: 19.5, y: 13.4, dir: 'down', wander: 0, setFlag: 'metYoungKeeper',
          lines: ['처음 보는 얼굴인데... 그 손에 든 건 종소리 조각? 어떻게 그걸!', '새 종을 걸려면 남쪽 숲의 해시계가 첫 울림을 내야 해. 그런데 뭔가가 시간을 갉아 먹고 있어.', '부탁이야. 해시계를 지켜 줘. 그 첫 울림이 아워벨의 네 번째 소절이 될 거야.'],
          linesBy: [{ flag: 'fragment4', lines: ['해시계가 울렸어! 이제 종을 걸 수 있어.', '...이상하지. 너를 아주 오래 기억하게 될 것 같아.'] }]
        },
        {
          id: 'youngsmith', name: '젊은 대장장이 브론', pal: 'youngsmith', x: 25.5, y: 6.8, dir: 'down', wander: 0, shop: 'past',
          lines: ['종틀은 내가 맡았지! 장비도 필요하면 말만 해.']
        },
        {
          id: 'pastinn', name: '여관 주인 할멈', pal: 'pastinn', x: 27.5, y: 18.8, dir: 'down', wander: 0, inn: true,
          lines: ['여관이 문을 연 지 얼마 안 됐어. 푹 쉬다 가렴.']
        },
        {
          id: 'haru', name: '시계공 견습생 하루', pal: 'apprentice', x: 9.5, y: 12.5, dir: 'right', wander: 0, hideIf: 'haruJoined',
          lines: ['...'],
          fetch: {
            item: 'cog', count: 3, start: 'haruAsked', flag: 'haruJoined', join: 'haru',
            ask: ['넌... 시간 밖에서 왔구나? 바늘 소리가 너한테서만 다르게 나.', '난 하루. 시계공 견습생이야. 숲의 태엽골렘들이 해시계 톱니를 다 뜯어 갔어.', '태엽 톱니 세 개만 찾아 줘. 그럼 나도 따라갈게. 시간 마법이라면 좀 알거든.'],
            wait: '태엽 톱니가 아직 {n}개 모자라. 숲의 태엽골렘을 찾아봐.',
            thanks: ['딱 맞아! 이걸로 해시계를 다시 맞출 수 있어.', '약속이야, 같이 갈게. 네가 온 시간으로도.']
          }
        },
        {
          id: 'pastchild', name: '꼬마 노을빛', pal: 'child', x: 20.5, y: 17.5, dir: 'left', wander: 4,
          lines: ['새 종이 걸리면 매일 저녁 노래가 울린대! 빨리 듣고 싶다.'],
          linesBy: [{ flag: 'fragment4', lines: ['해시계 소리 들었어? 이제 곧 종을 건대!'] }]
        }
      ]
    });
  }

  function buildPastWood() {
    const W = 36, H = 26;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.1, 91);
    forestBorder(m, 92, [{ x0: 10, x1: 12, y0: 0, y1: 2 }]);
    sprinkle(m, 'T', 0.05, 93);
    m.rect(24, 15, 5, 4, '~');
    // the road down from town, winding to the sundial glade in the south-east
    m.rect(26, 18, 6, 6, '.');
    m.vline(11, 0, 8, '='); m.hline(11, 22, 8, '='); m.vline(22, 8, 22, '='); m.hline(22, 28, 22, '=');
    m.set(28, 21, 'X'); m.set(29, 21, 'X');
    m.set(13, 4, 's');
    return {
      id: 'pastwood', name: '째깍 숲', sub: '해시계가 첫 울림을 기다리는 숲',
      theme: 'past', mood: 'past', music: 'pastwood',
      rows: m.rows(),
      spawn: { x: 11.5, y: 1.5, dir: 'down' },
      exits: [{ x0: 10, x1: 12, y0: 0, y1: 0, to: 'pasttown', spawn: { x: 16.5, y: 22.4, dir: 'up' } }],
      signs: [{ tx: 13, ty: 4, text: '째깍 숲 - 남동쪽 해시계 터\n"해시계가 울리는 날, 종을 건다."' }],
      altar: {
        tx: 28, ty: 21, w: 2, h: 1, n: 4, boss: 'timeeater', art: 'sundial',
        intro: ['해시계 바늘 끝에 금빛 조각이 걸려 있다.', '그림자가 거꾸로 돌더니, 톱니로 된 거대한 몸이 땅에서 일어섰다!'],
        take: ['멈췄던 해시계 그림자가 한 칸 움직이며 맑게 울렸다.', '조각을 집어 들자, 저 멀리 마을에서 환호성이 들렸다.'],
        got: ['네 번째 소절, 아워벨의 첫 울림이다.', '시계탑을 통해 원래 시간으로 돌아가 종지기에게 알리자.'],
        taken: '해시계 그림자가 천천히, 제 속도로 움직이고 있다.'
      },
      enemies: [
        { x: 8, y: 12, kind: 'tickwisp' }, { x: 16, y: 5, kind: 'duskbat' }, { x: 26, y: 6, kind: 'cogolem' },
        { x: 17, y: 14, kind: 'tickwisp' }, { x: 6, y: 20, kind: 'cogolem' }, { x: 30, y: 11, kind: 'duskbat' },
        { x: 14, y: 21, kind: 'tickwisp' }, { x: 31, y: 4, kind: 'cogolem' }
      ],
      npcs: []
    };
  }

  Object.assign(HB.MAPS, { pasttown: buildPastTown, pastwood: buildPastWood });

  // ---------- story ----------
  HB.QUESTS = HB.QUESTS || [];
  HB.QUESTS.push(
    {
      id: 'ch4', name: '50년 전 울림골', start: (f) => f.chapter3,
      steps: [
        ['시계탑을 통해 과거로 간다', (f) => f.pastArrived],
        ['젊은 종지기와 이야기한다', (f) => f.metYoungKeeper],
        ['째깍 숲의 시간갉기를 물리친다', (f) => f.boss4],
        ['해시계에서 네 번째 조각을 얻는다', (f) => f.fragment4],
        ['원래 시간의 종지기에게 돌아간다', (f) => f.chapter4]
      ]
    },
    {
      id: 'cogs', name: '하루의 태엽 톱니', start: (f) => f.haruAsked,
      steps: [
        [(f, P) => '태엽 톱니를 모은다 (' + Math.min(3, P.items.cog || 0) + ' / 3)', (f, P) => (P.items.cog || 0) >= 3 || f.haruJoined],
        ['광장의 하루에게 가져간다', (f) => f.haruJoined]
      ]
    }
  );
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[4] = {
    title: '50년 전의 첫 울림',
    lines: ['오십 년 전의 해시계가, 오늘의 종을 울렸다.', '늙은 종지기는 그날의 손님을 기억하고 있었다.'],
    keeper: ['...자네였군. 오십 년 전, 해시계를 지켜 준 그 손님이.', '그날부터 줄곧 기다렸다네. 이 종이 멈출 날, 자네가 다시 올 거라고.', '네 소절일세. 북쪽 산마루의 눈이 녹는 소리가 들리는군.'],
    keeperAfter: ['북쪽 협곡 너머 산마루의 눈길이 열렸네. 조심해서 다녀오게.'],
    next: ['네 번째 소절이 울리자, 협곡 북쪽 고갯길의 눈사태가 녹아내렸다.', '협곡을 지나 북쪽 눈꽃 산마루로 가 보자.']
  };

  // ---------- art and music ----------
  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.ALTAR_ART.sundial = function () {
    const [c, x] = HB.makeCanvas(40, 36);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // a stone pedestal with a brass dial and its gnomon
    r(14, 18, 12, 14, '#8a7e6a'); r(15, 18, 10, 14, '#b0a490'); r(15, 18, 1, 14, '#ccc0a8');
    r(8, 28, 24, 8, '#847864'); r(8, 28, 24, 1, '#ccc0a8');
    for (let j = 0; j < 6; j++) r(6 + j, 12 + j, 28 - j * 2, 1, j ? '#c8a040' : '#f0d070');
    for (let i = 0; i < 12; i++) r(8 + i * 2, 13, 1, 1, '#6a4a20');
    r(19, 4, 2, 9, '#6a4a20'); r(20, 4, 1, 9, '#a07a40'); r(17, 11, 6, 1, '#6a4a20');
    return c;
  };

  HB.SONG_DEFS = HB.SONG_DEFS || {};
  // fifty years ago: the town theme as an old music box, a little out of tune
  HB.SONG_DEFS.past = (k) => {
    const s = new k.Song({ bpm: 80, loop: true, steps: 16 * 16 });
    s.add('box', k.seq(k.THEME_A).notes, 0, 0.9);
    s.add('box', k.seq(k.THEME_B).notes, 64, 0.9);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => {
      [0, 2, 4, 6].forEach((o, i) => s.events.push({ inst: 'harp', step: (at + o) * 2, len: 1, midi: c[i % 3] + 12, vel: 0.6 }));
    });
    s.events.forEach((e) => { if (e.inst === 'box') e.midi -= 0.15; });
    return s.finalize();
  };
  // the ticking wood: a clock-tick hat under the minor theme
  HB.SONG_DEFS.pastwood = (k) => {
    const s = new k.Song({ bpm: 96, loop: true, steps: 16 * 16 });
    s.add('soft', k.seq(k.toMinor(k.THEME_A)).notes, 0, 0.8);
    s.add('soft', k.seq(k.toMinor(k.THEME_B)).notes, 64, 0.8);
    k.chordsTo(s, ['Dm', 'Am', 'Gm', 'Dm', 'Bb', 'C', 'Am', 'Dm'].concat(['Dm', 'Bb', 'C', 'Dm', 'Gm', 'Dm', 'Am', 'Dm']), 0, (c, at) => {
      s.events.push({ inst: 'bass', step: at * 2, len: 3, midi: c[0] - 12, vel: 0.7 });
      s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: c[1], vel: 0.6 });
    });
    s.hits('hat', 'x...x...x...x...', 16, 0.8);
    return s.finalize();
  };
})(window.HB);
