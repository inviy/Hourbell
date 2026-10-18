// Chapter 3: 메아리 협곡. A red canyon north of town, a mining camp, and a
// mine where every sound comes back twice. 단비 joins here.
(function (HB) {
  'use strict';

  const { sprinkle, forestBorder } = HB.mapTools;
  const Grid = HB.Grid;
  // cave walls: a forest border made of rocks
  const rockBorder = (m, seed, gaps) => { forestBorder(m, seed, gaps); for (const row of m.c) row.forEach((t, i) => { if (t === 'T') row[i] = 'r'; }); };
  HB.mapTools.rockBorder = rockBorder;

  Object.assign(HB.THEMES, {
    canyon: {
      grass: '#b8784a', grassLight: '#cc9060', grassDark: '#98603a', tuft: '#a89a58',
      path: '#d8b888', pathLight: '#e8cca0', pathDark: '#b09068',
      stone: '#9a6a50', stoneLight: '#b88a6a', stoneDark: '#6a4434',
      water: '#3a6a98', waterDark: '#2a4a70', waterLight: '#80b0d8', foam: '#d8ecf8',
      roof: '#8a5a3a', roofDark: '#5a3a24', roofLight: '#aa7a50',
      wall: '#d8c4a0', wallDark: '#a8946c', beam: '#5a3a24',
      leaf: '#6a7a3a', leafDark: '#4a5a28', leafLight: '#8a9a50', trunk: '#5a3a24',
      flowers: ['#f8e0a0', '#e8a060', '#f0f0d0', '#c8d870']
    },
    mine: {
      grass: '#4a4048', grassLight: '#5a5058', grassDark: '#3a3038', tuft: '#5a6a7a',
      path: '#7a6a5a', pathLight: '#8a7a68', pathDark: '#5a4a3e',
      stone: '#6a6470', stoneLight: '#8a8490', stoneDark: '#44404a',
      water: '#2a4a6a', waterDark: '#1a3048', waterLight: '#60a8d0', foam: '#a8e0f8',
      roof: '#5a4a3a', roofDark: '#3a2a20', roofLight: '#7a6a50',
      wall: '#8a7a68', wallDark: '#5a4a3e', beam: '#3a2a20',
      leaf: '#3a4a5a', leafDark: '#2a3440', leafLight: '#5a7088', trunk: '#3a2a20',
      flowers: ['#70e0f0', '#a0f0ff', '#c8a8f0', '#70e0f0']
    }
  });

  Object.assign(HB.PALETTES, {
    foreman: { h: '#3a3a3a', s: '#d09068', c: '#c8a040', C: '#8a6a24', g: '#e8e0d0', b: '#3a2418' },
    peddler: { h: '#5a3a6a', s: '#f0c8a0', c: '#7a5aa8', C: '#4a3a70', g: '#e8c040', b: '#3a2a20' },
    miner: { h: '#5a4a3a', s: '#d8a078', c: '#6a7a5a', C: '#4a5a3a', g: '#f0d060', b: '#2a2018' }
  });

  // ---------- foes ----------
  Object.assign(HB.FOES, {
    echobat: { name: '메아리박쥐', hp: 64, atk: 30, def: 8, spd: 14, exp: 24, gold: [34, 48], drop: ['bigdrop', 0.2], swallow: 0.3, weak: 'wind' },
    rockgolem: { name: '바위골렘', hp: 92, atk: 33, def: 17, spd: 4, exp: 31, gold: [48, 61], drop: ['ore', 0.5], weak: 'sound', resist: 'wind' },
    dustwisp: { name: '먼지먹이', hp: 58, atk: 29, def: 9, spd: 9, exp: 22, gold: [37, 51], drop: ['soup', 0.2], swallow: 0.3, weak: 'sound' },
    echoking: {
      name: '메아리왕', hp: 620, atk: 43, def: 12, spd: 12, exp: 700, gold: [600, 600], drop: ['soup', 2], boss: true, resist: 'sound',
      flag: 'boss3', waveEvery: 4, silenceEvery: 5, intro: '광산 가득 메아리가 겹겹이 울린다...', won: '메아리가 잦아들고, 광산에 고요한 물방울 소리만 남았다.'
    }
  });
  HB.FOE_ART = Object.assign(HB.FOE_ART || {}, {
    echobat: { shape: 'bat', pal: null, sight: 96, chase: 52, roam: 60, scale: 1 },
    rockgolem: { shape: 'golem', pal: null, sight: 52, chase: 26, roam: 20, scale: 1 },
    dustwisp: { shape: 'wisp', pal: { out: '#3a2418', dark: '#7a5030', mid: '#b8865a', light: '#e8c8a0', eye: '#fff0d0' }, sight: 76, chase: 40, roam: 44, scale: 1 },
    echoking: { shape: 'bat', pal: { out: '#100818', dark: '#2a1a3a', mid: '#4a3060', light: '#8a6ab0', eye: '#f4c450', wing: '#3a2050' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  });

  // ---------- items: third-tier gear and the ore 단비 is after ----------
  Object.assign(HB.ITEMS, {
    ore: { name: '울림 광석', key: true, price: 0, desc: '두드리면 오래도록 울리는 푸른 광석.' },
    echomallet: { name: '메아리 종채', slot: 'weapon', atk: 15, price: 300, desc: '공격 +15' },
    minerhelm: { name: '광부 헬멧', slot: 'head', def: 5, price: 230, desc: '방어 +5' },
    stonemail: { name: '돌비늘 갑옷', slot: 'armor', def: 9, price: 400, desc: '방어 +9' },
    pickgloves: { name: '곡괭이 장갑', slot: 'hands', atk: 6, price: 250, desc: '공격 +6' },
    cliffboots: { name: '벼랑 장화', slot: 'feet', spd: 5, def: 2, price: 260, desc: '속도 +5, 방어 +2' },
    echostone: { name: '메아리 돌', slot: 'charm', def: 3, spd: 3, price: 320, desc: '방어 +3, 속도 +3' },
    echoscore: { name: '메아리 악보', slot: 'score', pow: 50, price: 420, desc: '기술 위력 +50%' }
  });
  HB.SHOPS.canyon = { title: '떠돌이 행상의 짐수레', stock: ['soup', 'herb2', 'bigdrop', 'water', 'echomallet', 'minerhelm', 'stonemail', 'pickgloves', 'cliffboots', 'echostone', 'echoscore'] };

  // ---------- maps ----------
  function buildCanyon() {
    const W = 40, H = 30;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.05, 71);
    forestBorder(m, 72, [{ x0: 19, x1: 21, y0: 27, y1: 29 }, { x0: 37, x1: 39, y0: 8, y1: 10 }, { x0: 19, x1: 21, y0: 0, y1: 2 }]);
    sprinkle(m, 'r', 0.06, 73);
    // the gorge: a dry stream bed with a crossing
    m.rect(4, 14, 30, 2, '~');
    // the road north past the camp, a branch east to the mine
    m.vline(20, 0, 29, '='); m.vline(21, 0, 29, '=');
    m.hline(21, 39, 9, '=');
    m.rect(19, 14, 3, 2, 'b');
    // mining camp: bunkhouse and the peddler's cart
    m.rect(7, 19, 10, 7, '.');
    m.house(8, 20, 6, 11);
    m.hline(11, 19, 24, '=');
    m.set(23, 25, 's'); m.set(23, 5, 's'); m.set(24, 18, '.');
    return {
      id: 'canyon', name: '메아리 협곡', sub: '소리가 두 번 돌아오는 붉은 골짜기',
      theme: 'canyon', mood: 'day', music: 'canyon', onEnter: 'canyonArrived',
      rows: m.rows(),
      spawn: { x: 20.5, y: 28.4, dir: 'up' },
      exits: [
        { x0: 19, x1: 21, y0: 29, y1: 29, to: 'town', spawn: { x: 16.5, y: 1.5, dir: 'down' } },
        { x0: 39, x1: 39, y0: 8, y1: 10, to: 'mine', spawn: { x: 1.5, y: 16.4, dir: 'right' } },
        { x0: 19, x1: 21, y0: 0, y1: 0, to: 'snowroad', spawn: { x: 20.5, y: 26.4, dir: 'up' }, need: 'chapter4',
          blocked: '북쪽 고갯길은 눈사태로 막혀 있다. 시간이 흘러야 열릴 것 같다.' }
      ],
      signs: [
        { tx: 23, ty: 25, text: '메아리 협곡 광부 숙소\n동쪽 갈림길 - 울림 광산 / 북쪽 - 눈꽃 산마루 (통행 금지)' },
        { tx: 23, ty: 5, text: '북쪽 - 눈꽃 산마루\n※ 눈사태 위험' }
      ],
      doors: [{ tx: 11, ty: 22, text: '광부 숙소. 곡괭이와 등불이 벽에 걸려 있다.' }],
      boards: [{ tx: 11, ty: 22, icon: 'bell', name: '숙소' }],
      enemies: [
        { x: 26, y: 20, kind: 'dustwisp' }, { x: 30, y: 24, kind: 'echobat' }, { x: 14, y: 10, kind: 'dustwisp' },
        { x: 8, y: 6, kind: 'echobat' }, { x: 30, y: 4, kind: 'rockgolem' }, { x: 33, y: 13, kind: 'echobat' },
        { x: 27, y: 6, kind: 'dustwisp' }, { x: 12, y: 3, kind: 'rockgolem' }
      ],
      npcs: [
        {
          id: 'foreman', name: '광부 반장 돌쇠', pal: 'foreman', x: 14.5, y: 24.6, dir: 'down', wander: 0, inn: true, setFlag: 'metForeman',
          lines: ['울림골에서 왔다고? 광산 깊은 곳에 뭔가 큰 놈이 자리 잡은 뒤로 메아리가 그치질 않아.', '숙소에서 쉬어 가게. 광산은 동쪽 갈림길 끝이야.'],
          linesBy: [{ flag: 'fragment3', lines: ['메아리가 멎었어! 이제 곡괭이 소리가 제대로 들리는군. 푹 쉬고 가게.'] }]
        },
        {
          id: 'peddler', name: '떠돌이 행상 바람', pal: 'peddler', x: 18.5, y: 22.6, dir: 'left', wander: 0, shop: 'canyon',
          lines: ['협곡에선 튼튼한 게 최고지. 돌비늘 갑옷 하나 어때?']
        },
        {
          id: 'echokid', name: '꼬마 광부 콩', pal: 'child', x: 24.5, y: 18.5, dir: 'left', wander: 3,
          lines: ['"야호!" 하면 "야호, 야호!" 두 번 돌아와. 원래는 한 번만 돌아왔대.'],
          linesBy: [{ flag: 'fragment3', lines: ['"야호!" ...이제 한 번만 돌아와! 메아리가 원래대로 됐어!'] }]
        }
      ]
    };
  }

  function buildMine() {
    const W = 30, H = 22;
    const m = new Grid(W, H, '_');
    rockBorder(m, 81, [{ x0: 0, x1: 2, y0: 15, y1: 17 }]);
    sprinkle(m, 'r', 0.07, 82, '_');
    m.rect(5, 4, 4, 3, '~'); m.rect(22, 12, 4, 4, '~');
    // tunnels: in from the west, up to the crystal hall
    m.hline(0, 16, 16, '='); m.vline(16, 6, 16, '='); m.hline(10, 16, 9, '='); m.vline(15, 4, 6, '=');
    m.rect(12, 2, 6, 2, '_'); m.set(14, 3, 'X'); m.set(15, 3, 'X');
    m.set(4, 14, 's');
    return {
      id: 'mine', name: '울림 광산', sub: '모든 소리가 두 번 울리는 곳',
      theme: 'mine', mood: 'cave', music: 'mine',
      moodAfter: { flag: 'fragment3', mood: 'inside' },
      rows: m.rows(),
      spawn: { x: 1.5, y: 16.4, dir: 'right' },
      exits: [{ x0: 0, x1: 0, y0: 15, y1: 17, to: 'canyon', spawn: { x: 38.5, y: 9.4, dir: 'left' } }],
      signs: [{ tx: 4, ty: 14, text: '울림 광산 - 북쪽 수정 동굴은 출입 금지\n(메아리가 멎을 때까지)' }],
      altar: {
        tx: 14, ty: 3, w: 2, h: 1, n: 3, boss: 'echoking', art: 'crystal',
        intro: ['수정 덩어리 한가운데 금빛 조각이 박혀 있다.', '손을 뻗자, 천장에 매달린 거대한 그림자가 날개를 펼쳤다!'],
        take: ['메아리가 잦아든 수정 동굴에서 조각이 맑게 빛난다.', '조각을 집어 들자, 수정들이 한 번씩 낮게 울렸다.'],
        got: ['광산 가득하던 겹메아리가 사라졌다.', '종지기 노인에게 세 번째 소절을 들려주자.'],
        taken: '수정들이 은은하게 빛나고 있다.'
      },
      npcs: [
        {
          id: 'dan', name: '대장장이 딸 단비', pal: 'smithgirl', x: 9.5, y: 16.6, dir: 'down', wander: 0, hideIf: 'danJoined',
          lines: ['...'],
          fetch: {
            item: 'ore', count: 3, start: 'danAsked', flag: 'danJoined', join: 'dan',
            ask: ['어, 울림골 사람이네? 난 단비. 대장장이 브론이 우리 아빠야.', '아워벨의 종추를 새로 벼리려면 울림 광석이 필요해. 그런데 바위골렘들이 다 삼켜 버렸지 뭐야.', '광석 세 개만 같이 찾아 줄래? 그럼 나도 너랑 같이 갈게. 망치질은 자신 있거든!'],
            wait: '울림 광석이 아직 {n}개 모자라. 바위골렘을 두드려 보자!',
            thanks: ['이 푸른빛! 두드리면 오래 울리는 진짜 울림 광석이야.', '약속대로 같이 갈게. 앞은 내가 막을 테니까, 넌 종소리를 울려!']
          }
        },
        {
          id: 'lostminer', name: '길 잃은 광부', pal: 'miner', x: 20.5, y: 9.6, dir: 'left', wander: 0,
          lines: ['내 목소리가 두 번씩 돌아와서 어느 쪽이 길인지 모르겠어...', '수정 동굴 쪽에서 날개 퍼덕이는 소리가 났어. 조심하게.'],
          linesBy: [{ flag: 'fragment3', lines: ['이제 소리가 한 번만 돌아오는군. 길이 보여! 고맙네.'] }]
        }
      ]
    };
  }

  Object.assign(HB.MAPS, { canyon: buildCanyon, mine: buildMine });

  // ---------- story ----------
  HB.QUESTS = HB.QUESTS || [];
  HB.QUESTS.push(
    {
      id: 'ch3', name: '메아리 협곡', start: (f) => f.chapter2,
      steps: [
        ['마을 북쪽 길로 협곡에 간다', (f) => f.canyonArrived],
        ['광부 반장과 이야기한다', (f) => f.metForeman],
        ['광산 깊은 곳의 메아리왕을 물리친다', (f) => f.boss3],
        ['수정 동굴에서 세 번째 조각을 얻는다', (f) => f.fragment3],
        ['종지기에게 돌아간다', (f) => f.chapter3]
      ]
    },
    {
      id: 'ore', name: '단비의 울림 광석', start: (f) => f.danAsked,
      steps: [
        [(f, P) => '울림 광석을 모은다 (' + Math.min(3, P.items.ore || 0) + ' / 3)', (f, P) => (P.items.ore || 0) >= 3 || f.danJoined],
        ['광산의 단비에게 가져간다', (f) => f.danJoined]
      ]
    }
  );
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[3] = {
    title: '메아리 협곡의 두 번째 대답',
    lines: ['겹겹이 울리던 메아리가 하나로 모였다.', '종소리 세 소절이 시계탑의 바늘을 흔든다.'],
    keeper: ['세 번째 소절이군... 협곡의 메아리까지 데려왔어.', '...그런데 이상하군. 시계탑 바늘이 거꾸로 떨리고 있네.', '혹시 다음 소절은 지금이 아니라, 예전에 잃어버린 건지도 모르겠어.'],
    keeperAfter: ['시계탑을 살펴보게. 바늘이 과거를 가리키고 있네.'],
    next: ['세 소절이 모이자 시계탑의 바늘이 거꾸로 돌기 시작했다.', '광장의 시계탑을 조사해 보자.']
  };

  // ---------- art and music ----------
  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.ALTAR_ART.crystal = function () {
    const [c, x] = HB.makeCanvas(48, 40);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // a cluster of blue crystals on a rock shelf
    [[6, 14, 6, 22], [14, 4, 8, 32], [24, 8, 7, 28], [33, 16, 6, 20], [40, 22, 4, 14]].forEach(([cx, top, w, h]) => {
      for (let j = 0; j < h; j++) {
        const ww = Math.min(w, Math.round(1 + j * 0.8));
        const lx = cx + Math.round((w - ww) / 2);
        r(lx, top + j, ww, 1, '#4ab0d8'); r(lx, top + j, 1, 1, '#c8f4ff'); r(lx + ww - 1, top + j, 1, 1, '#2a6a98');
      }
    });
    r(2, 34, 44, 6, '#5a5060'); r(2, 34, 44, 1, '#8a8090');
    return c;
  };

  HB.SONG_DEFS = HB.SONG_DEFS || {};
  // the theme answered by its own echo a beat later, over a slow walking bass
  HB.SONG_DEFS.canyon = (k) => {
    const s = new k.Song({ bpm: 88, loop: true, steps: 16 * 16 });
    const a = k.seq(k.THEME_A).notes, b = k.seq(k.THEME_B).notes;
    s.add('lead', a, 0, 0.8); s.add('harp', a, 1, 0.5);
    s.add('lead', b, 64, 0.8); s.add('harp', b, 65, 0.5);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => {
      [0, 2, 4, 6].forEach((o, i) => s.events.push({ inst: 'bass', step: (at + o) * 2, len: 1.5, midi: c[i % 3] - 12, vel: 0.6 }));
    });
    s.hits('kick', 'x.......x.......', 16, 0.5);
    return s.finalize();
  };
  // in the mine: drips of the theme on the music box, a low drone
  HB.SONG_DEFS.mine = (k) => {
    const s = new k.Song({ bpm: 64, loop: true, steps: 16 * 16 });
    s.add('box', k.seq(k.toMinor(k.THEME_B), -1).notes.filter((n, i) => i % 3 !== 2), 0, 0.8);
    k.chordsTo(s, k.CH_B.concat(k.CH_B), 0, (c, at) => s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: c[0] - 12, vel: 1 }));
    return s.finalize();
  };
})(window.HB);
