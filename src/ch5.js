// Chapter 5: 눈꽃 산마루. Past the canyon the road climbs into snow so deep
// it swallows every footstep; at the top hangs a bell made of ice.
(function (HB) {
  'use strict';

  const { sprinkle, forestBorder } = HB.mapTools;
  const Grid = HB.Grid;

  Object.assign(HB.THEMES, {
    snow: {
      grass: '#e8eef4', grassLight: '#f8fbff', grassDark: '#c8d4e0', tuft: '#b8c8d8',
      path: '#c0c8d4', pathLight: '#d8e0e8', pathDark: '#98a4b4',
      stone: '#9aa4b0', stoneLight: '#c4ccd8', stoneDark: '#6a7480',
      water: '#7aa8d0', waterDark: '#5a88b0', waterLight: '#c8e4f8', foam: '#ffffff',
      roof: '#5a6a8a', roofDark: '#3a4a68', roofLight: '#e8f0f8',
      wall: '#8a6a4a', wallDark: '#6a4a30', beam: '#4a3220',
      leaf: '#3a6a5a', leafDark: '#2a4a40', leafLight: '#e8f4f8', trunk: '#4a3a2a',
      flowers: ['#ffffff', '#c8e0f8', '#f0f8ff', '#a8c8f0']
    }
  });

  Object.assign(HB.PALETTES, {
    hutgran: { h: '#e8e8f0', s: '#f0c8a8', c: '#c84a4a', C: '#8a2a2a', g: '#f0e0c0', b: '#3a2a20' },
    hunter: { h: '#4a3020', s: '#e0a880', c: '#7a5a3a', C: '#5a3e24', g: '#e8e0d0', b: '#2a1a10' }
  });

  // ---------- foes ----------
  Object.assign(HB.FOES, {
    snowjelly: { name: '눈송이해파리', hp: 126, atk: 58, def: 18, spd: 13, exp: 46, gold: [48, 62], drop: ['icebloom', 0.45], weak: 'wind', trait: 'mend' },
    icegolem: { name: '얼음골렘', hp: 172, atk: 62, def: 30, spd: 6, exp: 60, gold: [60, 74], drop: ['honeycake', 0.25], weak: 'sound', resist: 'wind', trait: 'curl' },
    frostbat: { name: '서리박쥐', hp: 116, atk: 59, def: 16, spd: 18, exp: 44, gold: [46, 60], drop: ['gingertea', 0.2], weak: 'sound', trait: 'double' },
    frostwing: {
      name: '서리날개', hp: 840, atk: 81, def: 24, spd: 14, exp: 1600, gold: [1300, 1300], drop: ['honeycake', 2], boss: true,
      flag: 'boss5', fogEvery: 4, silenceEvery: 5, freezeEvery: 4, fogName: '눈보라',
      intro: '얼음 종이 갈라지며, 하얀 날개가 산마루를 뒤덮었다!', won: '눈보라가 그치고, 얼음 종이 맑게 한 번 울렸다.'
    }
  });
  HB.FOE_ART = Object.assign(HB.FOE_ART || {}, {
    snowjelly: { shape: 'jelly', pal: { out: '#5a6a8a', dark: '#a8b8d8', mid: '#e0e8f8', light: '#ffffff', glow: '#c8f0ff' }, sight: 90, chase: 46, roam: 56, scale: 1 },
    icegolem: { shape: 'golem', pal: { out: '#2a3a5a', dark: '#5a7aa8', mid: '#98b8e0', light: '#e0f0ff', eye: '#3ac8f0', glow: '#c8f8ff' }, sight: 56, chase: 26, roam: 20, scale: 1 },
    frostbat: { shape: 'bat', pal: { out: '#2a3a5a', dark: '#6a8ab8', mid: '#a8c8f0', light: '#e8f4ff', eye: '#3a4a8a', wing: '#7a98c8' }, sight: 96, chase: 56, roam: 60, scale: 1 },
    frostwing: { shape: 'bat', pal: { out: '#1a2a4a', dark: '#4a6a9a', mid: '#a0c0e8', light: '#ffffff', eye: '#f4c450', wing: '#6a8ac0' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  });

  // ---------- items: fifth-tier gear ----------
  Object.assign(HB.ITEMS, {
    icebloom: { name: '얼음꽃', key: true, price: 0, desc: '눈송이해파리가 품고 있던 녹지 않는 꽃.' },
    gingertea: { name: '생강차', mp: 50, price: 80, desc: '울림을 50 회복한다.' },
    icemallet: { name: '서리 종채', slot: 'weapon', atk: 26, price: 680, desc: '공격 +26' },
    furhat: { name: '털모자', slot: 'head', def: 9, price: 500, desc: '방어 +9' },
    furcoat: { name: '털외투', slot: 'armor', def: 15, price: 860, desc: '방어 +15' },
    mittens: { name: '벙어리장갑', slot: 'hands', atk: 10, price: 540, desc: '공격 +10' },
    snowshoes: { name: '설피', slot: 'feet', spd: 7, def: 4, price: 570, desc: '속도 +7, 방어 +4' },
    snowcharm: { name: '눈꽃 장식', slot: 'charm', def: 5, spd: 5, price: 720, desc: '방어 +5, 속도 +5' },
    winterscore: { name: '겨울 악보', slot: 'score', pow: 80, price: 900, desc: '기술 위력 +80%' }
  });
  HB.SHOPS.hut = { title: '산장 할머니의 선반', stock: ['honeycake', 'gingertea', 'soup', 'water', 'icemallet', 'furhat', 'furcoat', 'mittens', 'snowshoes', 'snowcharm', 'winterscore'] };

  // ---------- maps ----------
  function buildSnowRoad() {
    const W = 40, H = 28;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.05, 101);
    forestBorder(m, 102, [{ x0: 19, x1: 21, y0: 25, y1: 27 }, { x0: 19, x1: 21, y0: 0, y1: 2 }]);
    sprinkle(m, 'T', 0.04, 103); sprinkle(m, 'r', 0.03, 104);
    m.rect(6, 6, 5, 3, '~'); m.rect(29, 18, 4, 3, '~');
    // switchbacks up the mountain, the hut half way
    m.vline(20, 20, 27, '='); m.hline(8, 20, 20, '='); m.vline(8, 12, 20, '='); m.hline(8, 32, 12, '=');
    m.vline(32, 4, 12, '='); m.hline(20, 32, 4, '='); m.vline(20, 0, 4, '=');
    m.house(11, 15, 6, 13);
    m.set(22, 24, 's');
    return {
      id: 'snowroad', name: '눈꽃 고갯길', sub: '발소리마저 삼키는 눈',
      theme: 'snow', mood: 'snow', music: 'snow', onEnter: 'snowArrived',
      rows: m.rows(),
      spawn: { x: 20.5, y: 26.4, dir: 'up' },
      exits: [
        { x0: 19, x1: 21, y0: 27, y1: 27, to: 'canyon', spawn: { x: 20.5, y: 1.5, dir: 'down' } },
        { x0: 19, x1: 21, y0: 0, y1: 0, to: 'snowpeak', spawn: { x: 15.5, y: 20.4, dir: 'up' } }
      ],
      signs: [{ tx: 22, ty: 24, text: '눈꽃 고갯길 - 중턱에 산장\n※ 정상 얼음 종 근처에서는 큰 소리를 내지 마시오.' }],
      doors: [{ tx: 13, ty: 17, text: '산장 "따순 불". 굴뚝에서 연기가 피어오른다.' }],
      boards: [{ tx: 13, ty: 17, icon: 'bell', name: '산장' }],
      enemies: [
        { x: 26, y: 23, kind: 'snowjelly' }, { x: 14, y: 22, kind: 'frostbat' }, { x: 4, y: 15, kind: 'icegolem' },
        { x: 16, y: 9, kind: 'snowjelly' }, { x: 26, y: 8, kind: 'frostbat' }, { x: 35, y: 15, kind: 'icegolem' },
        { x: 28, y: 3, kind: 'snowjelly' }, { x: 10, y: 4, kind: 'frostbat' }
      ],
      npcs: [
        {
          id: 'hutgran', name: '산장 할머니 눈님', pal: 'hutgran', x: 15.5, y: 19.6, dir: 'down', wander: 0, shop: 'hut',
          lines: ['어서 와, 어서. 언 손 녹이고 필요한 거 골라 가.'],
          linesBy: [{ flag: 'fragment5', lines: ['얼음 종이 울렸다며? 오늘은 눈이 포근하게 내리는구나.'] }]
        },
        {
          id: 'hunter', name: '사냥꾼 매', pal: 'hunter', x: 10.5, y: 19.6, dir: 'down', wander: 0, inn: true, setFlag: 'metHunter',
          lines: ['정상의 얼음 종을 서리날개가 둥지로 삼았어. 그 뒤로 눈보라가 소리를 다 덮어 버려.', '산장에서 몸 녹이고 가. 불은 내가 지펴 둘게.'],
          linesBy: [{ flag: 'fragment5', lines: ['눈보라가 그쳤어. 이제 짐승 발소리도 들려. 쉬어 가.'] }]
        },
        {
          id: 'snowkid', name: '눈사람 만드는 아이', pal: 'child', x: 23.5, y: 21.5, dir: 'left', wander: 0,
          lines: ['얼음꽃 알아? 할머니가 그걸로 차를 끓이면 목소리가 맑아진대.'],
          fetch: {
            item: 'icebloom', count: 3, start: 'bloomAsked', flag: 'bloomDone',
            ask: ['할머니 목이 쉬어서 노래를 못 하셔. 얼음꽃 차를 끓여 드리고 싶어.', '눈송이해파리가 얼음꽃을 품고 다닌대. 세 송이만 구해 줄래?'],
            wait: '얼음꽃이 아직 {n}송이 모자라.',
            thanks: ['우와, 진짜 안 녹아! 할머니 노래 다시 들을 수 있겠다.', '이거, 할머니가 너 주래. 겨울에 짠 장식이래.'],
            reward: { items: { snowcharm: 1 }, gold: 300 }
          }
        }
      ]
    };
  }

  function buildSnowPeak() {
    const W = 30, H = 22;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.05, 111);
    forestBorder(m, 112, [{ x0: 14, x1: 16, y0: 19, y1: 21 }, { x0: 14, x1: 16, y0: 0, y1: 2 }]);
    sprinkle(m, 'r', 0.05, 113);
    m.rect(11, 3, 9, 6, '.');
    m.vline(15, 9, 21, '='); m.set(14, 6, 'X'); m.set(15, 6, 'X'); m.vline(15, 7, 8, '=');
    m.vline(15, 0, 2, '=');
    m.set(17, 17, 's');
    return {
      id: 'snowpeak', name: '눈꽃 산마루', sub: '얼음 종이 매달린 꼭대기',
      theme: 'snow', mood: 'snow', music: 'snow',
      moodAfter: { flag: 'fragment5', mood: 'day' },
      musicAfter: { flag: 'fragment5', music: 'snowBell' },
      rows: m.rows(),
      spawn: { x: 15.5, y: 20.4, dir: 'up' },
      exits: [
        { x0: 14, x1: 16, y0: 21, y1: 21, to: 'snowroad', spawn: { x: 20.5, y: 1.5, dir: 'down' } },
        { x0: 14, x1: 16, y0: 0, y1: 0, to: 'starpath', spawn: { x: 4.5, y: 20.4, dir: 'up' }, need: 'chapter5',
          blocked: '산마루 너머는 끝없는 구름이다. 별이 길을 비춰 주기 전엔 갈 수 없다.' }
      ],
      signs: [{ tx: 17, ty: 17, text: '눈꽃 산마루 정상\n북쪽 - 별빛 천문대 (구름다리, 밤에만 열림)' }],
      altar: {
        tx: 14, ty: 6, w: 2, h: 1, n: 5, boss: 'frostwing', art: 'icebell',
        intro: ['얼음 종 안에 금빛 조각이 얼어붙어 있다.', '종을 건드리자 눈보라가 치솟고, 거대한 하얀 날개가 내려앉았다!'],
        take: ['눈보라가 걷힌 얼음 종 안에서 조각이 반짝인다.', '조각을 꺼내자, 얼음 종이 녹으며 산 아래까지 맑게 울렸다.'],
        got: ['다섯 번째 소절이다. 산 너머 구름 위로 별이 하나 떴다.', '종지기 노인에게 돌아가 소절을 들려주자.'],
        taken: '녹아내린 종 자리에 작은 물방울 종들이 매달려 있다.'
      },
      enemies: [{ x: 8, y: 14, kind: 'icegolem' }, { x: 22, y: 12, kind: 'snowjelly' }, { x: 6, y: 6, kind: 'frostbat' }, { x: 24, y: 5, kind: 'icegolem' }],
      npcs: []
    };
  }

  Object.assign(HB.MAPS, { snowroad: buildSnowRoad, snowpeak: buildSnowPeak });

  // ---------- story ----------
  HB.QUESTS = HB.QUESTS || [];
  HB.QUESTS.push(
    {
      id: 'ch5', name: '눈꽃 산마루', start: (f) => f.chapter4,
      steps: [
        ['협곡 북쪽 고갯길을 오른다', (f) => f.snowArrived],
        ['산장의 사냥꾼과 이야기한다', (f) => f.metHunter],
        ['정상의 서리날개를 물리친다', (f) => f.boss5],
        ['얼음 종에서 다섯 번째 조각을 얻는다', (f) => f.fragment5],
        ['종지기에게 돌아간다', (f) => f.chapter5]
      ]
    },
    {
      id: 'blooms', name: '할머니의 얼음꽃 차', start: (f) => f.bloomAsked,
      steps: [
        [(f, P) => '얼음꽃을 모은다 (' + Math.min(3, P.items.icebloom || 0) + ' / 3)', (f, P) => (P.items.icebloom || 0) >= 3 || f.bloomDone],
        ['산장 앞 아이에게 가져간다', (f) => f.bloomDone]
      ]
    }
  );
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[5] = {
    title: '눈꽃 산마루의 얼음 종',
    lines: ['눈 속에 잠들었던 소리가 녹아 흐른다.', '남은 두 소절은 별과, 종 안에 있다.'],
    keeper: ['다섯 번째... 차갑고 맑은 소리로군. 얼음 종이었나.', '이제 노래의 끝이 보이네. 산마루 너머 구름다리에 별이 떴다지?', '천문대의 별지기가 여섯 번째 소절을 지키고 있을 걸세.'],
    keeperAfter: ['산마루 북쪽 구름다리가 별빛으로 이어졌네. 천문대로 가 보게.'],
    next: ['다섯 소절이 모이자, 산마루 너머 구름 위로 별빛 다리가 놓였다.', '눈꽃 산마루 정상에서 북쪽으로 가 보자.']
  };

  // ---------- art and music ----------
  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.ALTAR_ART.icebell = function () {
    const [c, x] = HB.makeCanvas(44, 52);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // an ice bell hanging from a wooden frame
    r(4, 4, 4, 46, '#4a3220'); r(36, 4, 4, 46, '#4a3220'); r(2, 2, 40, 4, '#6a4a30'); r(2, 2, 40, 1, '#8a6a48');
    for (let j = 0; j < 26; j++) {
      const half = Math.round(5 + j * 0.45 + (j > 20 ? (j - 20) * 1.2 : 0));
      r(22 - half, 10 + j, half * 2, 1, '#a8d8f0'); r(22 - half, 10 + j, 2, 1, '#e8f8ff'); r(22 + half - 2, 10 + j, 2, 1, '#6aa0c8');
    }
    r(21, 6, 2, 4, '#c8e8f8'); r(20, 36, 4, 4, '#e8f8ff');
    r(0, 48, 44, 4, '#c4ccd8');
    return c;
  };

  HB.SONG_DEFS = HB.SONG_DEFS || {};
  // snow: sparse bells over a long pad, the theme slowed to half speed
  HB.SONG_DEFS.snow = (k) => {
    const s = new k.Song({ bpm: 60, loop: true, steps: 16 * 16 });
    s.add('box', k.seq(k.THEME_B, 1).notes.filter((n, i) => i % 2 === 0), 0, 0.6);
    k.chordsTo(s, k.CH_B.concat(k.CH_A), 0, (c, at) => {
      c.forEach((m) => s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: m, vel: 0.7 }));
      s.events.push({ inst: 'bell', step: at * 2 + 8, len: 4, midi: c[2] + 24, vel: 0.35 });
    });
    return s.finalize();
  };
  HB.SONG_DEFS.snowBell = (k) => {
    const s = HB.SONG_DEFS.snow(k);
    s.add('soft', k.seq(k.THEME_A).notes, 0, 0.6);
    return s.finalize();
  };
})(window.HB);
