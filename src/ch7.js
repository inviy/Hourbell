// Chapter 7: 아워벨 내부. With six fragments the tower opens into the bell
// itself: gears, bronze and a hush at its heart that stopped the song.
// The last fragment ends the story and rolls the credits.
(function (HB) {
  'use strict';

  const { sprinkle } = HB.mapTools;
  const Grid = HB.Grid;

  Object.assign(HB.THEMES, {
    bell: {
      grass: '#8a6a3a', grassLight: '#a8844a', grassDark: '#6a5028', tuft: '#c8a050',
      path: '#d8b058', pathLight: '#f0cc70', pathDark: '#a88438',
      stone: '#7a6040', stoneLight: '#a08058', stoneDark: '#4a3820',
      water: '#2a1a40', waterDark: '#1a1030', waterLight: '#6a5aa0', foam: '#f4c450',
      roof: '#6a4a24', roofDark: '#4a3218', roofLight: '#8a6a3a',
      wall: '#c8a060', wallDark: '#987840', beam: '#4a3218',
      leaf: '#a07a38', leafDark: '#6a5024', leafLight: '#d0a850', trunk: '#4a3218',
      flowers: ['#f4c450', '#fff0a0', '#e8a040', '#ffffff']
    }
  });

  Object.assign(HB.PALETTES, {
    bellspirit: { h: '#f4e0a0', s: '#f8e8d0', c: '#f0d070', C: '#c8a040', g: '#ffffff', b: '#8a6a3a' }
  });

  // ---------- foes ----------
  Object.assign(HB.FOES, {
    bellwisp: { name: '종먹이', hp: 210, atk: 96, def: 30, spd: 18, exp: 78, gold: [82, 101], drop: ['starhoney', 0.2], swallow: 0.35, weak: 'sound' },
    clockgolem: { name: '시계골렘', hp: 280, atk: 102, def: 42, spd: 8, exp: 96, gold: [101, 120], drop: ['gingertea', 0.3], weak: 'wind', resist: 'sound' },
    timestar: { name: '시간별', hp: 200, atk: 98, def: 30, spd: 22, exp: 76, gold: [79, 98], drop: ['starhoney', 0.2], weak: 'sound', resist: 'wind' },
    hush: {
      name: '정적', hp: 1450, atk: 68, def: 36, spd: 18, exp: 3000, gold: [2000, 2000], drop: ['starhoney', 1], boss: true,
      flag: 'boss7', waveEvery: 4, waveMul: 0.75, fogEvery: 5, fogName: '정적', music: 'finalBoss',
      intro: '모든 소리가 사라졌다. 심장 소리마저...', won: '정적이 깨지고, 아워벨 안에 일곱 소절이 한꺼번에 울려 퍼졌다!'
    }
  });
  HB.FOE_ART = Object.assign(HB.FOE_ART || {}, {
    bellwisp: { shape: 'wisp', pal: { out: '#3a2a10', dark: '#8a6a24', mid: '#d0a840', light: '#fff0a0', eye: '#2a1a40' }, sight: 84, chase: 46, roam: 44, scale: 1 },
    clockgolem: { shape: 'golem', pal: { out: '#1a1008', dark: '#5a3a18', mid: '#9a6a30', light: '#d8a050', eye: '#f4e0a0', glow: '#fff0a0' }, sight: 56, chase: 28, roam: 20, scale: 1 },
    timestar: { shape: 'star', pal: { out: '#3a2a10', dark: '#a87a28', mid: '#f0c850', light: '#fff8d0', eye: '#3a2a10' }, sight: 90, chase: 50, roam: 50, scale: 1 },
    hush: { shape: 'wisp', pal: { out: '#000000', dark: '#0a0a14', mid: '#1a1a2a', light: '#3a3a5a', eye: '#f4c450', hand: '#f4c450' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  });

  // ---------- items: the last weapon and score ----------
  Object.assign(HB.ITEMS, {
    hourmallet: { name: '아워벨 종채', slot: 'weapon', atk: 40, spd: 2, price: 1500, desc: '공격 +40, 속도 +2' },
    lastscore: { name: '마지막 소절', slot: 'score', pow: 125, price: 1600, desc: '기술 위력 +125%' }
  });
  HB.SHOPS.bellcore = { title: '종의 정령이 모아 둔 것들', stock: ['starhoney', 'gingertea', 'water', 'hourmallet', 'lastscore'] };

  // ---------- map ----------
  function buildBellCore() {
    const W = 26, H = 26;
    const m = new Grid(W, H, '~');
    // a round bronze floor inside the bell, open sky below its rim
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 12.5) / 11.5, dy = (y - 13) / 12.5;
      if (dx * dx + dy * dy < 1) m.set(x, y, '.');
    }
    sprinkle(m, ',', 0.08, 141);
    sprinkle(m, 'r', 0.03, 142);
    m.vline(12, 6, 25, '='); m.vline(13, 6, 25, '='); m.hline(5, 20, 14, '=');
    m.rect(9, 2, 8, 3, '.'); m.set(12, 3, 'X'); m.set(13, 3, 'X'); m.set(12, 4, '='); m.set(13, 4, '='); m.vline(12, 5, 5, '='); m.vline(13, 5, 5, '=');
    m.set(15, 20, 's');
    return {
      id: 'bellcore', name: '아워벨 내부', sub: '노래가 멈춘 자리',
      theme: 'bell', mood: 'inside', music: 'bellcore', onEnter: 'coreArrived',
      musicAfter: { flag: 'fragment7', music: 'finale' },
      rows: m.rows(),
      spawn: { x: 12.5, y: 22.4, dir: 'up' },
      exits: [{ x0: 12, x1: 13, y0: 25, y1: 25, to: 'town', spawn: { x: 14.5, y: 12.8, dir: 'down' } }],
      signs: [{ tx: 15, ty: 20, text: '(종 안쪽 벽에 오래된 글씨가 새겨져 있다)\n"일곱 소절이 하나가 되면, 멈춘 시간이 다시 흐르리라."' }],
      altar: {
        tx: 12, ty: 3, w: 2, h: 1, n: 7, boss: 'hush', art: 'greatbell',
        intro: ['종추가 매달려야 할 자리에 마지막 조각이 떠 있다.', '그 둘레의 어둠이 몸을 일으켰다. 종을 멈춘 정적, 그 자체였다!'],
        take: ['정적이 사라진 자리에서 마지막 조각이 따뜻하게 빛난다.', '조각을 들자, 여섯 소절이 날아와 하나의 노래가 되었다.'],
        got: ['아워벨이 다시 울린다. 노을이 저물고, 처음으로 밤이 온다.', '종지기 노인에게 돌아가 노래를 들려주자.'],
        taken: '종추가 제자리에서 천천히 흔들리고 있다.'
      },
      enemies: [
        { x: 6, y: 10, kind: 'bellwisp' }, { x: 19, y: 10, kind: 'timestar' }, { x: 7, y: 18, kind: 'clockgolem' },
        { x: 18, y: 18, kind: 'bellwisp' }, { x: 9, y: 7, kind: 'timestar' }, { x: 17, y: 7, kind: 'clockgolem' }
      ],
      npcs: [
        {
          id: 'bellspirit', name: '종의 정령', pal: 'bellspirit', x: 10.5, y: 16.6, dir: 'down', wander: 0, inn: true, setFlag: 'metSpirit',
          lines: ['...왔구나. 여섯 소절을 데리고.', '나는 이 종에 깃든 노래. 정적이 내 마지막 소절을 삼켰어.', '여기서 쉬어 가. 준비가 되면 종추 자리로 가.'],
          linesBy: [{ flag: 'fragment7', lines: ['고마워. 이제 나는 다시 노래가 될 수 있어.'] }]
        },
        {
          id: 'bellshop', name: '종의 정령 (메아리)', pal: 'bellspirit', x: 15.5, y: 16.6, dir: 'down', wander: 0, shop: 'bellcore',
          lines: ['오래 모아 둔 것들이야. 마지막 싸움에 가져가.']
        }
      ]
    };
  }

  HB.MAPS.bellcore = buildBellCore;

  // ---------- story ----------
  HB.QUESTS = HB.QUESTS || [];
  HB.QUESTS.push({
    id: 'ch7', name: '아워벨 내부', start: (f) => f.chapter6,
    steps: [
      ['시계탑을 통해 아워벨 안으로 들어간다', (f) => f.coreArrived],
      ['종의 정령과 이야기한다', (f) => f.metSpirit],
      ['종을 멈춘 정적을 물리친다', (f) => f.boss7],
      ['마지막 조각을 얻는다', (f) => f.fragment7],
      ['종지기에게 노래를 들려준다', (f) => f.chapter7]
    ]
  });
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[7] = {
    title: '아워벨, 다시 울리다',
    lines: ['일곱 소절이 하나의 노래가 되어 마을에 울려 퍼진다.', '노을이 저물고, 울림골에 처음으로 밤이 왔다.'],
    keeper: ['...들리네. 일곱 소절, 온전한 노래가.', '오십 년을 기다린 보람이 있었어. 고맙네, 젊은 친구.', '자, 들어 보게. 내일을 부르는 종소리일세.'],
    keeperAfter: ['종이 매일 저녁 울리고 있네. 내일도, 그 다음 날도.'],
    final: true,
    credits: [
      ['아워벨', '종소리를 되찾아 준 리안, 미오, 단비, 하루', '그리고 방울에게'],
      ['만든 사람', 'inviy', '함께 만든 이  Claude'],
      ['그림과 음악', '모든 그림과 음악은 코드로 직접 그렸습니다', '글꼴  Galmuri (quiple, SIL OFL 1.1)'],
      ['끝까지 함께해 주셔서 고맙습니다', '울림골의 종은 오늘도 울립니다']
    ]
  };

  // ---------- art and music ----------
  HB.ALTAR_ART = HB.ALTAR_ART || {};
  HB.ALTAR_ART.greatbell = function () {
    const [c, x] = HB.makeCanvas(56, 40);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // the clapper's empty cradle: a bronze yoke over the floor
    r(4, 2, 48, 5, '#4a3218'); r(4, 2, 48, 1, '#8a6a3a');
    r(8, 7, 4, 28, '#6a4a24'); r(44, 7, 4, 28, '#6a4a24');
    r(26, 7, 4, 10, '#c8a050'); r(27, 7, 1, 10, '#fff0a0');
    for (let j = 0; j < 12; j++) { const h = 3 + j; r(28 - h, 18 + j, h * 2, 1, j % 3 ? '#a87a38' : '#d8a850'); }
    r(0, 34, 56, 6, '#7a6040'); r(0, 34, 56, 1, '#c8a060');
    return c;
  };

  HB.SONG_DEFS = HB.SONG_DEFS || {};
  // inside the bell: the theme on bells alone, slow, with a heartbeat kick
  HB.SONG_DEFS.bellcore = (k) => {
    const s = new k.Song({ bpm: 58, loop: true, steps: 16 * 16 });
    s.add('bell', k.seq(k.THEME_A).notes.filter((n, i) => i % 2 === 0), 0, 0.5);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: c[0] - 12, vel: 0.9 }));
    s.hits('kick', 'x..x............', 16, 0.5);
    return s.finalize();
  };
  // the last fight: the boss theme a tone lower and harder
  HB.SONG_DEFS.finalBoss = (k) => {
    const s = k.SONGS.boss();
    s.events.forEach((e) => { e.midi -= 1; });
    s.bpm = 176;
    return s;
  };
  // after it: the whole theme, every instrument at once
  HB.SONG_DEFS.finale = (k) => {
    const s = new k.Song({ bpm: 84, loop: true, steps: 16 * 16 });
    s.add('lead', k.seq(k.THEME_A).notes, 0, 0.8);
    s.add('lead', k.seq(k.THEME_B).notes, 64, 0.8);
    k.chordsTo(s, k.CH_A.concat(k.CH_B), 0, (c, at) => {
      c.forEach((m) => s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: m + 12, vel: 0.7 }));
      [0, 2, 4, 6].forEach((o, i) => s.events.push({ inst: 'harp', step: (at + o) * 2, len: 1, midi: c[i % 3] + 24, vel: 0.6 }));
      s.events.push({ inst: 'bass', step: at * 2, len: 6, midi: c[0] - 12, vel: 0.7 });
      s.events.push({ inst: 'bell', step: at * 2, len: 4, midi: c[0] + 24, vel: 0.45 });
    });
    s.hits('hat', '....x.......x...', 16, 0.5);
    return s.finalize();
  };
})(window.HB);
