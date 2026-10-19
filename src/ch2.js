// Chapter 2: 물안개 항구. A road into the sea fog, a harbour that lost its
// lighthouse bell, and the fog-eater coiled around the lighthouse.
// Plain data (canvas work only happens when something is drawn), so the
// node tests can build these maps and balance this boss.
(function (HB) {
  'use strict';

  const { sprinkle, forestBorder } = HB.mapTools;
  const Grid = HB.Grid;

  Object.assign(HB.THEMES, {
    mist: {
      grass: '#5f8a70', grassLight: '#78a088', grassDark: '#4a7058', tuft: '#8ab49a',
      path: '#b8b0a0', pathLight: '#cec8b8', pathDark: '#908878',
      stone: '#a0a4a8', stoneLight: '#c0c4c8', stoneDark: '#70747c',
      water: '#3a6a8a', waterDark: '#2a4e6a', waterLight: '#88b8d0', foam: '#e0f0f8',
      roof: '#4a6a98', roofDark: '#2e4870', roofLight: '#6a8ab8',
      wall: '#e0dcd4', wallDark: '#b0aca0', beam: '#5a4a3a',
      leaf: '#3e6a50', leafDark: '#2a4a38', leafLight: '#5a8a68', trunk: '#5a4a38',
      flowers: ['#f0f4f8', '#c8d8e8', '#e8d8f0', '#fff0c0']
    },
    port: {
      grass: '#d8c48e', grassLight: '#e8d8a8', grassDark: '#b8a470', tuft: '#9ab070',
      path: '#a08868', pathLight: '#b8a080', pathDark: '#786448',
      stone: '#a8a49c', stoneLight: '#c8c4bc', stoneDark: '#7a766e',
      water: '#2a5c98', waterDark: '#1c4276', waterLight: '#7ab0e8', foam: '#e8f6ff',
      roof: '#3a6aa8', roofDark: '#24467a', roofLight: '#5a8ad0',
      wall: '#ece6da', wallDark: '#bcb4a4', beam: '#5a4634',
      leaf: '#4a8a4a', leafDark: '#2e5e30', leafLight: '#6aaa5a', trunk: '#7a5a38',
      flowers: ['#ffffff', '#f0e0a0', '#a8d8f0', '#f0a0b0']
    }
  });

  Object.assign(HB.PALETTES, {
    captain: { h: '#e8e4dc', s: '#d8a078', c: '#2a3a6a', C: '#1a2448', g: '#e8c040', b: '#2a2028' },
    merchant: { h: '#8a4a2a', s: '#f0c8a0', c: '#c8a040', C: '#8a6a24', g: '#3a8a6a', b: '#4a3020' },
    tavern: { h: '#3a2a20', s: '#e0a880', c: '#6a8a3a', C: '#4a6a24', g: '#f0e0c0', b: '#3a2418' },
    sailor: { h: '#f0d060', s: '#f8d4b0', c: '#e8e8f0', C: '#3a5aa8', g: '#c83a3a', b: '#3a3a5a' },
    lightgirl: { h: '#c8643a', s: '#f8d0b0', c: '#e8d0e8', C: '#a888b8', g: '#f0c040', b: '#5a3a4a' }
  });

  // ---------- foes ----------
  Object.assign(HB.FOES, {
    mistwisp: { name: '안개먹이', hp: 44, atk: 19, def: 6, spd: 8, exp: 18, gold: [24, 36], drop: ['herb2', 0.25], swallow: 0.25, weak: 'sound' },
    jelly: { name: '물방울해파리', hp: 36, atk: 17, def: 4, spd: 10, exp: 18, gold: [24, 40], drop: ['pearl', 0.45], weak: 'wind', resist: 'sound', trait: 'mend' },
    crab: { name: '갯바위게', hp: 52, atk: 21, def: 11, spd: 4, exp: 24, gold: [36, 52], drop: ['soup', 0.2], resist: 'wind', trait: 'curl' },
    mistking: {
      name: '안개삼킴이', hp: 270, atk: 24, def: 6, spd: 9, exp: 420, gold: [400, 400], drop: ['soup', 1], boss: true, weak: 'sound',
      flag: 'boss2', waveEvery: 4, fogEvery: 4, fogMend: 0.02, intro: '바다 안개가 모든 소리를 집어삼켰다...', won: '안개가 흩어지고, 파도 소리가 돌아왔다!'
    }
  });
  HB.FOE_ART = Object.assign(HB.FOE_ART || {}, {
    mistwisp: { shape: 'wisp', pal: { out: '#4a4a5a', dark: '#8a8a9a', mid: '#c0c4cc', light: '#f0f4f8', eye: '#6a8ab8' }, sight: 76, chase: 40, roam: 44, scale: 1 },
    jelly: { shape: 'jelly', pal: null, sight: 90, chase: 46, roam: 56, scale: 1 },
    crab: { shape: 'crab', pal: null, sight: 56, chase: 30, roam: 24, scale: 1 },
    mistking: { shape: 'jelly', pal: { out: '#2a2a3a', dark: '#6a6a80', mid: '#a8acc0', light: '#e8ecf4', glow: '#f4c450' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  });

  // ---------- items: second-tier gear, a big heal, the pearl quest item ----------
  Object.assign(HB.ITEMS, {
    pearl: { name: '안개 진주', key: true, price: 0, desc: '물방울해파리가 품고 있던 뿌연 진주.' },
    soup: { name: '해초 수프', hp: 140, price: 60, desc: 'HP를 140 회복한다.' },
    bigdrop: { name: '큰 울림방울', mp: 30, price: 45, desc: '울림을 30 회복한다.' },
    coral: { name: '산호 종채', slot: 'weapon', atk: 10, price: 170, desc: '공격 +10' },
    hood: { name: '소금 두건', slot: 'head', def: 3, price: 140, desc: '방어 +3' },
    coat: { name: '어부 외투', slot: 'armor', def: 6, price: 240, desc: '방어 +6' },
    net: { name: '그물 장갑', slot: 'hands', atk: 4, price: 150, desc: '공격 +4' },
    reefboots: { name: '갯바위 장화', slot: 'feet', spd: 4, def: 1, price: 160, desc: '속도 +4, 방어 +1' },
    pearlear: { name: '진주 귀걸이', slot: 'charm', def: 1, spd: 3, price: 210, desc: '방어 +1, 속도 +3' },
    wavescore: { name: '파도의 악보', slot: 'score', pow: 35, price: 280, desc: '기술 위력 +35%' }
  });
  HB.SHOPS.port = { title: '조개 상점', stock: ['soup', 'herb2', 'bigdrop', 'water', 'coral', 'hood', 'coat', 'net', 'reefboots', 'pearlear', 'wavescore'] };

  // ---------- maps ----------
  function buildMistroad() {
    const W = 40, H = 18;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.06, 51);
    forestBorder(m, 52, [{ x0: 0, x1: 2, y0: 8, y1: 10 }, { x0: 37, x1: 39, y0: 8, y1: 10 }]);
    m.rect(14, 10, 5, 3, '~'); m.rect(29, 3, 4, 2, '~');
    sprinkle(m, 'r', 0.025, 53);
    // the road: in from the town, a bend past the pond, out to the coast
    m.hline(0, 10, 9, '='); m.vline(10, 5, 9, '='); m.hline(10, 24, 5, '=');
    m.vline(24, 5, 12, '='); m.hline(24, 33, 12, '='); m.vline(33, 9, 12, '='); m.hline(33, 39, 9, '=');
    m.set(4, 7, 's');
    return {
      id: 'mistroad', name: '물안개 길', sub: '바다 냄새가 밴 안개',
      theme: 'mist', mood: 'fog', music: 'mist',
      rows: m.rows(),
      spawn: { x: 1.5, y: 9.4, dir: 'right' },
      exits: [
        { x0: 0, x1: 0, y0: 8, y1: 10, to: 'town', spawn: { x: 32.5, y: 13.9, dir: 'left' } },
        { x0: 39, x1: 39, y0: 8, y1: 10, to: 'port', spawn: { x: 1.5, y: 10.4, dir: 'right' } }
      ],
      signs: [{ tx: 4, ty: 7, text: '동쪽 - 물안개 항구\n※ 안개 속에서는 소리를 먹는 것들이 짙어진다.' }],
      enemies: [
        { x: 7, y: 6, kind: 'mistwisp' }, { x: 15, y: 4, kind: 'jelly' }, { x: 20, y: 8, kind: 'mistwisp' },
        { x: 27, y: 9, kind: 'crab' }, { x: 21, y: 14, kind: 'jelly' }, { x: 30, y: 15, kind: 'mistwisp' },
        { x: 35, y: 5, kind: 'jelly' }, { x: 12, y: 14, kind: 'crab' }
      ],
      npcs: []
    };
  }

  function buildPort() {
    const W = 36, H = 26;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.04, 61);
    forestBorder(m, 62, [{ x0: 0, x1: 2, y0: 9, y1: 11 }]);
    m.rect(0, 19, W, 7, '~');
    // piers out into the sea
    m.vline(9, 19, 24, 'b'); m.vline(10, 19, 24, 'b'); m.vline(25, 19, 23, 'b'); m.vline(26, 19, 23, 'b');
    // the lighthouse cliff: rocks under the tower, its door is the altar
    m.rect(26, 2, 8, 6, '.'); m.rect(28, 2, 4, 4, 'r'); m.set(29, 6, 'X'); m.set(30, 6, 'X');
    // houses: harbour office, tavern, shop, net loft
    m.house(4, 3, 7, 7); m.house(13, 3, 8, 16); m.house(3, 12, 6, 5); m.house(13, 12, 6, 16);
    // streets
    m.hline(0, 31, 10, '='); m.hline(1, 34, 17, '='); m.hline(1, 34, 18, '=');
    m.vline(7, 7, 10, '='); m.vline(16, 7, 10, '='); m.vline(5, 16, 17, '='); m.vline(16, 16, 17, '=');
    m.vline(21, 10, 17, '='); m.vline(30, 7, 17, '='); m.vline(29, 7, 7, '=');
    m.set(23, 9, 's');
    return {
      id: 'port', name: '물안개 항구', sub: '등대의 종이 잠든 바닷가',
      theme: 'port', mood: 'fog', music: 'port',
      moodAfter: { flag: 'fragment2', mood: 'day' },
      musicAfter: { flag: 'fragment2', music: 'portBell' },
      onEnter: 'portArrived',
      rows: m.rows(),
      spawn: { x: 1.5, y: 10.4, dir: 'right' },
      exits: [{ x0: 0, x1: 0, y0: 9, y1: 11, to: 'mistroad', spawn: { x: 38.5, y: 9.4, dir: 'left' } }],
      signs: [{ tx: 23, ty: 9, text: '물안개 항구\n북동쪽 - 등대 (출입 금지: 안개가 걷힐 때까지)' }],
      doors: [
        { tx: 7, ty: 5, text: '항구 사무소. 지도와 해도가 벽에 빼곡하다.' },
        { tx: 16, ty: 5, text: '선술집 "뱃노래". 안에서 노랫소리 대신 한숨 소리가 들린다.' },
        { tx: 5, ty: 14, text: '조개 상점. 주인은 밖에서 손님을 부르고 있다.' },
        { tx: 16, ty: 14, text: '그물 창고. 젖은 그물 냄새가 난다.' }
      ],
      boards: [{ tx: 5, ty: 14, icon: 'flower', name: '상점' }, { tx: 16, ty: 5, icon: 'bell', name: '선술집' }],
      altar: {
        tx: 29, ty: 6, w: 2, h: 1, n: 2, boss: 'mistking', art: 'lighthouse',
        intro: ['등대 문 앞에 금빛 조각이 박혀 있다.', '조각에 손을 대자, 바다에서 거대한 안개 덩어리가 솟아올라 등대를 휘감는다!'],
        take: ['안개가 걷힌 등대 문 앞에서 조각이 맑게 빛난다.', '조각을 집어 들자, 등대 꼭대기의 종이 오랜만에 울렸다.'],
        got: ['항구를 덮은 안개가 서서히 걷히기 시작한다.', '종지기 노인에게 이 소리를 전하러 가자.'],
        taken: '등대 위에서 다시 불빛이 바다를 비추고 있다.'
      },
      npcs: [
        {
          id: 'harbor', name: '항구장 해미', pal: 'captain', x: 8.5, y: 8.6, dir: 'down', wander: 0, setFlag: 'metHarbor',
          lines: [
            '울림골에서 왔다고? 그 종이 멈춘 날부터 이 항구엔 안개가 걷히질 않아.',
            '등대의 종이 울리지 않으니 배들이 돌아올 길을 못 찾지. 등대에 뭔가 커다란 게 들러붙어 있다네.',
            '자네가 종소리를 다룰 줄 안다면... 등대로 가 주게. 북동쪽 언덕 위야.'
          ],
          linesBy: [{ flag: 'fragment2', lines: ['등대 불빛이 돌아왔어! 배들이 하나둘 들어오고 있네. 자네 덕이야.'] }]
        },
        {
          id: 'tavern', name: '선술집 주인 파도', pal: 'tavern', x: 17.5, y: 8.4, dir: 'down', wander: 0, inn: true,
          lines: ['뱃노래가 끊긴 선술집이지만, 잠자리는 아직 따뜻하다네. 쉬어 가.'],
          linesBy: [{ flag: 'fragment2', lines: ['오늘 밤엔 다시 뱃노래를 부를 수 있겠어! 쉬어 가, 공짜야.'] }]
        },
        {
          id: 'clam', name: '상인 조개', pal: 'merchant', x: 7.5, y: 15.6, dir: 'down', wander: 0, shop: 'port',
          lines: ['어서 와! 바닷가 물건은 다 있어. 안개 속에선 해초 수프가 최고지.']
        },
        {
          id: 'oldnet', name: '그물 영감', pal: 'fisher', x: 12.5, y: 17.6, dir: 'down', wander: 0,
          lines: ['진주 고마웠네. 바다가 다시 반짝이는구먼.'],
          fetch: {
            item: 'pearl', count: 3, start: 'pearlAsked', flag: 'pearlDone',
            ask: ['안개 때문에 진주잡이를 못 한 지 오래야.', '물안개 길의 해파리들이 안개 진주를 품고 다닌다더군. 세 알만 모아다 주겠나?'],
            wait: '안개 진주가 아직 {n}알 모자라네. 물방울해파리를 찾아보게.',
            thanks: ['오오, 이 뿌연 빛! 틀림없는 안개 진주야.', '이건 내가 젊을 적 만든 귀걸이일세. 받아 두게.'],
            reward: { items: { pearlear: 1 }, gold: 120 }
          }
        },
        {
          id: 'sailorkid', name: '꼬마 선원 물결', pal: 'sailor', x: 22.5, y: 15.5, dir: 'left', wander: 3,
          lines: ['우리 아빠 배가 안개 속에 있어. 등대 종소리만 들리면 돌아올 수 있댔어.'],
          linesBy: [{ flag: 'fragment2', lines: ['아빠 배다! 저기 돛 보여? 종소리 고마워!'] }]
        },
        {
          id: 'lightgirl', name: '등대지기 손녀 빛나', pal: 'lightgirl', x: 27.5, y: 9.5, dir: 'up', wander: 0,
          lines: ['할아버지가 지키던 등대야. 안개 괴물이 휘감은 뒤로 종이 울리지 않아.', '그 괴물은 소리를 싫어해. 종소리를 크게 울리면 안개가 걷힐 거야.'],
          linesBy: [{ flag: 'fragment2', lines: ['등대 종이 다시 울려! 할아버지도 하늘에서 들으셨을 거야.'] }]
        }
      ]
    };
  }

  Object.assign(HB.MAPS, { mistroad: buildMistroad, port: buildPort });

  // ---------- story ----------
  HB.QUESTS = HB.QUESTS || [];
  HB.QUESTS.push(
    {
      id: 'ch2', name: '물안개 항구', start: (f) => f.chapter1,
      steps: [
        ['동쪽 물안개 길을 지나 항구에 닿는다', (f) => f.portArrived],
        ['항구장과 이야기한다', (f) => f.metHarbor],
        ['등대를 휘감은 안개삼킴이를 물리친다', (f) => f.boss2],
        ['등대에서 두 번째 조각을 얻는다', (f) => f.fragment2],
        ['종지기에게 돌아간다', (f) => f.chapter2]
      ]
    },
    {
      id: 'pearls', name: '그물 영감의 진주', start: (f) => f.pearlAsked,
      steps: [
        [(f, P) => '안개 진주를 모은다 (' + Math.min(3, P.items.pearl || 0) + ' / 3)', (f, P) => (P.items.pearl || 0) >= 3 || f.pearlDone],
        ['그물 영감에게 가져간다', (f) => f.pearlDone]
      ]
    }
  );
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[2] = {
    title: '물안개 항구의 뱃노래',
    lines: ['안개가 걷힌 바다 위로 뱃노래가 다시 번져 간다.', '남은 다섯 소절은 더 깊은 곳에서 기다린다.'],
    keeper: ['두 번째 소절... 바다 냄새가 나는군. 항구의 등대 종이로구먼.', '들리나? 아워벨이 조금 더 크게 흔들리고 있네.'],
    keeperAfter: ['두 소절이 모였네. 북쪽 협곡에서 메아리가 대답하는 소리가 들리지 않나?'],
    next: ['종소리가 두 소절이 되자, 북쪽 협곡에서 메아리가 대답했다.', '마을 북쪽 길을 막고 있던 바위가 굴러 내렸다.']
  };

  // ---------- art and music (built only when used) ----------
  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.ALTAR_ART.lighthouse = function () {
    const [c, x] = HB.makeCanvas(40, 92);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // tapering tower with red and white bands
    for (let y = 20; y < 84; y++) {
      const half = Math.round(8 + (y - 20) * 0.12);
      const band = Math.floor((y - 20) / 10) % 2;
      r(20 - half, y, half * 2, 1, band ? '#c84a3a' : '#f0ece4');
      r(20 - half, y, 2, 1, band ? '#8a2a20' : '#b8b0a4');
      r(20 + half - 3, y, 3, 1, band ? '#8a2a20' : '#c8c0b4');
    }
    // lantern room, rail, roof and bell
    r(10, 14, 20, 6, '#3a3a48'); r(12, 15, 16, 4, '#ffe8a0'); r(19, 15, 2, 4, '#c89a3c');
    r(8, 20, 24, 2, '#2a2a34'); r(11, 9, 18, 5, '#3a3a48'); r(14, 5, 12, 4, '#2a2a34'); r(19, 1, 2, 4, '#c89a3c');
    // door at the foot
    r(16, 72, 8, 12, '#3a2418'); r(17, 73, 6, 11, '#6a4428'); r(22, 78, 1, 1, '#f0c040');
    r(6, 84, 28, 8, '#7a766e'); r(6, 84, 28, 1, '#a8a49c');
    return c;
  };

  HB.SONG_DEFS = HB.SONG_DEFS || {};
  // the theme slowed down, a music box over soft chords, lost in the fog
  HB.SONG_DEFS.mist = (k) => {
    const s = new k.Song({ bpm: 72, loop: true, steps: 16 * 16 });
    s.add('box', k.seq(k.THEME_A).notes.filter((n, i) => i % 2 === 0), 0, 0.8);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => {
      c.forEach((m) => s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: m + 12, vel: 0.8 }));
      s.events.push({ inst: 'bass', step: at * 2, len: 7, midi: c[0] - 12, vel: 0.45 });
    });
    return s.finalize();
  };
  // a harbour sway: harp chords, the melody on the soft lead, a light hat
  HB.SONG_DEFS.port = (k) => {
    const s = new k.Song({ bpm: 100, loop: true, steps: 16 * 16 });
    s.add('soft', k.seq(k.THEME_A).notes, 0, 0.9);
    s.add('soft', k.seq(k.THEME_B).notes, 64, 0.9);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => {
      [0, 3, 6].forEach((o, i) => s.events.push({ inst: 'harp', step: (at + o) * 2, len: 1.5, midi: c[i % 3] + 24, vel: 0.9 }));
      s.events.push({ inst: 'bass', step: at * 2, len: 2.5, midi: c[0] - 12, vel: 0.8 });
      s.events.push({ inst: 'bass', step: (at + 3) * 2, len: 2.5, midi: c[2] - 12, vel: 0.6 });
    });
    s.hits('hat', '....x.......x...', 16, 0.6);
    return s.finalize();
  };
  // after the lighthouse sings again: the port song with bells answering
  HB.SONG_DEFS.portBell = (k) => {
    const s = HB.SONG_DEFS.port(k);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => s.events.push({ inst: 'bell', step: at * 2, len: 4, midi: c[0] + 24, vel: 0.5 }));
    return s.finalize();
  };
})(window.HB);
