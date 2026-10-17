// Chapter 6: 별빛 천문대. Over the peak a bridge of cloud leads to an
// observatory where the stars have stopped turning, and an eclipse sits on
// the great telescope.
(function (HB) {
  'use strict';

  const { sprinkle, forestBorder } = HB.mapTools;
  const Grid = HB.Grid;

  Object.assign(HB.THEMES, {
    star: {
      grass: '#c8d0f0', grassLight: '#e0e6ff', grassDark: '#a8b0d8', tuft: '#f0f0ff',
      path: '#e8d8a8', pathLight: '#f8ecc0', pathDark: '#c0b088',
      stone: '#8a88b0', stoneLight: '#aaa8d0', stoneDark: '#5a5880',
      water: '#1a1a48', waterDark: '#10103a', waterLight: '#6a6ab8', foam: '#f8f0c0',
      roof: '#3a3a78', roofDark: '#24245a', roofLight: '#5a5aa0',
      wall: '#e0dcf0', wallDark: '#b0acc8', beam: '#4a4070',
      leaf: '#5a6aa8', leafDark: '#3a4880', leafLight: '#8a98d8', trunk: '#4a4070',
      flowers: ['#fff8c0', '#f0e080', '#c8d8ff', '#ffffff']
    }
  });

  Object.assign(HB.PALETTES, {
    astronomer: { h: '#d8d4e8', s: '#f0c8a8', c: '#2a3a7a', C: '#1a2458', g: '#f0d060', b: '#3a2a40' },
    stargirl: { h: '#2a2a5a', s: '#f8d4b0', c: '#e8c040', C: '#a88a24', g: '#ffffff', b: '#3a3a5a' }
  });

  // ---------- foes ----------
  Object.assign(HB.FOES, {
    starbit: { name: '별조각', hp: 168, atk: 80, def: 24, spd: 16, exp: 52, gold: [52, 66], drop: ['starhoney', 0.15], weak: 'sound', resist: 'wind' },
    nightbat: { name: '밤박쥐', hp: 152, atk: 78, def: 20, spd: 22, exp: 50, gold: [48, 62], drop: ['gingertea', 0.25], swallow: 0.3, weak: 'wind' },
    moonwisp: { name: '달먹이', hp: 160, atk: 76, def: 22, spd: 14, exp: 50, gold: [50, 64], drop: ['starshard', 0.45], swallow: 0.35, weak: 'sound' },
    eclipse: {
      name: '일식', hp: 1600, atk: 100, def: 30, spd: 16, exp: 2400, gold: [1800, 1800], drop: ['starhoney', 2], boss: true,
      flag: 'boss6', waveEvery: 4, waveMul: 0.75, fogEvery: 5, fogName: '별먼지',
      intro: '망원경 너머의 별들이 하나씩 꺼져 간다...', won: '그림자가 걷히고, 멈춰 있던 별들이 다시 돌기 시작했다!'
    }
  });
  HB.FOE_ART = Object.assign(HB.FOE_ART || {}, {
    starbit: { shape: 'star', pal: null, sight: 84, chase: 46, roam: 50, scale: 1 },
    nightbat: { shape: 'bat', pal: { out: '#08081a', dark: '#1a1a40', mid: '#3a3a70', light: '#6a6aa8', eye: '#f4e070', wing: '#24245a' }, sight: 100, chase: 58, roam: 64, scale: 1 },
    moonwisp: { shape: 'wisp', pal: { out: '#3a3420', dark: '#a89a5a', mid: '#e8dca0', light: '#fffbe0', eye: '#3a3a70' }, sight: 80, chase: 44, roam: 44, scale: 1 },
    eclipse: { shape: 'star', pal: { out: '#000000', dark: '#1a1030', mid: '#2a1a48', light: '#f4c450', eye: '#f4c450' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  });

  // ---------- items: sixth-tier gear ----------
  Object.assign(HB.ITEMS, {
    starshard: { name: '별가루 조각', key: true, price: 0, desc: '달먹이가 삼켰던 별빛 부스러기.' },
    starhoney: { name: '별꿀', hp: 400, price: 170, desc: 'HP를 400 회복한다.' },
    starmallet: { name: '별빛 종채', slot: 'weapon', atk: 32, price: 980, desc: '공격 +32' },
    starcap: { name: '별자리 모자', slot: 'head', def: 11, price: 720, desc: '방어 +11' },
    nightrobe: { name: '밤하늘 로브', slot: 'armor', def: 19, price: 1220, desc: '방어 +19' },
    lensgloves: { name: '렌즈 장갑', slot: 'hands', atk: 12, price: 780, desc: '공격 +12' },
    cometboots: { name: '혜성 장화', slot: 'feet', spd: 8, def: 5, price: 820, desc: '속도 +8, 방어 +5' },
    moonlocket: { name: '달 목걸이', slot: 'charm', def: 6, spd: 6, price: 1020, desc: '방어 +6, 속도 +6' },
    starscore: { name: '별의 악보', slot: 'score', pow: 100, price: 1280, desc: '기술 위력 +100%' }
  });
  HB.SHOPS.observatory = { title: '천문대 매점', stock: ['starhoney', 'honeycake', 'gingertea', 'water', 'starmallet', 'starcap', 'nightrobe', 'lensgloves', 'cometboots', 'moonlocket', 'starscore'] };

  // ---------- maps ----------
  // clouds over the night sky ('~' is the sky below the bridge)
  function buildStarPath() {
    const W = 36, H = 22;
    const m = new Grid(W, H, '~');
    m.rect(1, 14, 10, 8, '.'); m.rect(25, 0, 10, 9, '.'); m.rect(12, 6, 12, 9, '.');
    sprinkle(m, ',', 0.12, 121);
    // the bridge of starlight between the cloud islands
    m.vline(4, 9, 21, '='); m.hline(4, 13, 9, '='); m.hline(13, 22, 11, '='); m.vline(13, 9, 11, '=');
    m.vline(22, 4, 11, '='); m.hline(22, 31, 4, '='); m.vline(31, 0, 4, '=');
    m.set(6, 18, 's');
    return {
      id: 'starpath', name: '구름다리', sub: '별빛으로 이은 하늘길',
      theme: 'star', mood: 'night', music: 'stars', onEnter: 'starArrived',
      rows: m.rows(),
      spawn: { x: 4.5, y: 20.4, dir: 'up' },
      exits: [
        { x0: 3, x1: 5, y0: 21, y1: 21, to: 'snowpeak', spawn: { x: 15.5, y: 1.5, dir: 'down' } },
        { x0: 30, x1: 32, y0: 0, y1: 0, to: 'observatory', spawn: { x: 14.5, y: 20.4, dir: 'up' } }
      ],
      signs: [{ tx: 6, ty: 18, text: '구름다리 - 별빛 천문대 방면\n※ 다리 밖으로 발을 내딛지 마시오.' }],
      enemies: [
        { x: 7, y: 16, kind: 'moonwisp' }, { x: 16, y: 8, kind: 'starbit' }, { x: 20, y: 13, kind: 'nightbat' },
        { x: 14, y: 13, kind: 'moonwisp' }, { x: 27, y: 6, kind: 'starbit' }, { x: 33, y: 2, kind: 'nightbat' },
        { x: 28, y: 2, kind: 'moonwisp' }, { x: 9, y: 19, kind: 'nightbat' }
      ],
      npcs: []
    };
  }

  function buildObservatory() {
    const W = 30, H = 22;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.08, 131);
    forestBorder(m, 132, [{ x0: 13, x1: 15, y0: 19, y1: 21 }]);
    m.rect(0, 0, W, 2, '~');
    m.house(3, 9, 8, 6); m.house(19, 9, 8, 23);
    m.vline(14, 6, 21, '='); m.hline(6, 23, 13, '=');
    m.rect(11, 3, 8, 3, '.'); m.set(14, 4, 'X'); m.set(15, 4, 'X'); m.set(14, 5, '='); m.set(15, 5, '=');
    m.set(16, 17, 's');
    return {
      id: 'observatory', name: '별빛 천문대', sub: '별이 멈춘 밤하늘 아래',
      theme: 'star', mood: 'night', music: 'stars',
      musicAfter: { flag: 'fragment6', music: 'starsBell' },
      rows: m.rows(),
      spawn: { x: 14.5, y: 20.4, dir: 'up' },
      exits: [{ x0: 13, x1: 15, y0: 21, y1: 21, to: 'starpath', spawn: { x: 31.5, y: 1.5, dir: 'down' } }],
      signs: [{ tx: 16, ty: 17, text: '별빛 천문대\n왼쪽 - 별지기의 집 / 오른쪽 - 매점 / 위 - 큰 망원경' }],
      doors: [
        { tx: 6, ty: 11, text: '별지기의 집. 천장에 별자리 지도가 그려져 있다.' },
        { tx: 23, ty: 11, text: '매점. 별꿀 냄새가 달콤하다.' }
      ],
      boards: [{ tx: 6, ty: 11, icon: 'bell', name: '쉼터' }, { tx: 23, ty: 11, icon: 'flower', name: '매점' }],
      altar: {
        tx: 14, ty: 4, w: 2, h: 1, n: 6, boss: 'eclipse', art: 'telescope',
        intro: ['큰 망원경의 렌즈에 금빛 조각이 박혀 있다.', '망원경을 들여다보자, 검은 원반이 하늘에서 떨어져 내렸다!'],
        take: ['다시 돌기 시작한 별빛 아래, 조각이 렌즈에서 굴러 나왔다.', '조각을 집어 들자, 별들이 한꺼번에 반짝이며 소리를 냈다.'],
        got: ['여섯 번째 소절이다. 남은 건 단 하나, 아워벨 안의 마지막 소절.', '종지기 노인에게 돌아가자.'],
        taken: '망원경 너머로 별들이 천천히 돌고 있다.'
      },
      npcs: [
        {
          id: 'astronomer', name: '별지기 은하', pal: 'astronomer', x: 8.5, y: 13.6, dir: 'down', wander: 0, inn: true, setFlag: 'metAstronomer',
          lines: ['구름다리를 건너왔다고? 별이 멈춘 뒤로 손님은 처음이야.', '망원경에 일식이 들러붙어 별을 삼키고 있어. 쉬어 가며 준비해.'],
          linesBy: [{ flag: 'fragment6', lines: ['별이 다시 돈다! 오늘 밤은 마음껏 쉬어 가.'] }]
        },
        {
          id: 'starseller', name: '매점 주인 미리내', pal: 'stargirl', x: 21.5, y: 13.6, dir: 'down', wander: 0, shop: 'observatory',
          lines: ['별꿀 있어요, 별꿀! 하늘 위라 값이 좀 나가요.']
        },
        {
          id: 'starapprentice', name: '꼬마 별지기 반짝', pal: 'child', x: 12.5, y: 16.5, dir: 'right', wander: 0,
          lines: ['별가루로 새 별자리를 그렸어!'],
          fetch: {
            item: 'starshard', count: 3, start: 'shardAsked', flag: 'shardDone',
            ask: ['달먹이들이 별을 갉아 먹어서 별자리가 구멍투성이야.', '별가루 조각 세 개만 찾아 줄래? 구멍을 메우고 싶어.'],
            wait: '별가루 조각이 아직 {n}개 모자라. 구름다리의 달먹이를 찾아봐.',
            thanks: ['반짝반짝! 이제 별자리가 다 이어졌어.', '선생님이 주라고 하신 거야. 달빛으로 만든 목걸이래!'],
            reward: { items: { moonlocket: 1 }, gold: 400 }
          }
        }
      ]
    };
  }

  Object.assign(HB.MAPS, { starpath: buildStarPath, observatory: buildObservatory });

  // ---------- story ----------
  HB.QUESTS = HB.QUESTS || [];
  HB.QUESTS.push(
    {
      id: 'ch6', name: '별빛 천문대', start: (f) => f.chapter5,
      steps: [
        ['산마루 북쪽 구름다리를 건넌다', (f) => f.starArrived],
        ['천문대의 별지기와 이야기한다', (f) => f.metAstronomer],
        ['망원경의 일식을 물리친다', (f) => f.boss6],
        ['망원경에서 여섯 번째 조각을 얻는다', (f) => f.fragment6],
        ['종지기에게 돌아간다', (f) => f.chapter6]
      ]
    },
    {
      id: 'shards', name: '반짝이의 별자리', start: (f) => f.shardAsked,
      steps: [
        [(f, P) => '별가루 조각을 모은다 (' + Math.min(3, P.items.starshard || 0) + ' / 3)', (f, P) => (P.items.starshard || 0) >= 3 || f.shardDone],
        ['천문대의 반짝이에게 가져간다', (f) => f.shardDone]
      ]
    }
  );
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[6] = {
    title: '별빛 천문대의 밤',
    lines: ['멈춰 있던 별들이 다시 돌기 시작했다.', '마지막 한 소절은, 아워벨 안에서 기다린다.'],
    keeper: ['여섯 번째... 별이 도는 소리로군. 이제 하나 남았어.', '마지막 소절은 아워벨 안에 있네. 종을 멈춘 정적이 그곳에 똬리를 틀었지.', '시계탑으로 가게. 이번엔 종이 직접 문을 열어 줄 걸세.'],
    keeperAfter: ['시계탑으로 가게. 아워벨이 자네를 기다리고 있네.'],
    next: ['여섯 소절이 모이자, 아워벨이 스스로 낮게 울렸다.', '광장의 시계탑을 조사하면 종 안으로 들어갈 수 있을 것 같다.']
  };

  // ---------- art and music ----------
  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.ALTAR_ART.telescope = function () {
    const [c, x] = HB.makeCanvas(48, 48);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // a brass telescope on a stone drum, tilted to the sky
    r(8, 34, 32, 14, '#5a5880'); r(8, 34, 32, 1, '#aaa8d0'); r(10, 36, 28, 10, '#8a88b0');
    for (let i = 0; i < 26; i++) { r(10 + i, 30 - i, 6, 5, '#c89a3c'); r(10 + i, 30 - i, 6, 1, '#f4d070'); }
    r(34, 2, 8, 8, '#8a6a24'); r(35, 3, 6, 6, '#a8d8f8'); r(36, 4, 2, 2, '#ffffff');
    r(22, 26, 4, 9, '#4a4070');
    return c;
  };

  HB.SONG_DEFS = HB.SONG_DEFS || {};
  // stars: a slow arpeggio on the harp, the theme high on the music box
  HB.SONG_DEFS.stars = (k) => {
    const s = new k.Song({ bpm: 70, loop: true, steps: 16 * 16 });
    s.add('box', k.seq(k.THEME_A, 1).notes, 0, 0.5);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => {
      [0, 1, 2, 3, 4, 5, 6, 7].forEach((o) => s.events.push({ inst: 'harp', step: (at + o) * 2, len: 1, midi: c[o % 3] + 12 + (o > 3 ? 12 : 0), vel: 0.5 }));
      s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: c[0], vel: 0.6 });
    });
    return s.finalize();
  };
  HB.SONG_DEFS.starsBell = (k) => {
    const s = HB.SONG_DEFS.stars(k);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => s.events.push({ inst: 'bell', step: at * 2, len: 4, midi: c[0] + 24, vel: 0.45 }));
    return s.finalize();
  };
})(window.HB);
