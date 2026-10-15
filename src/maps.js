// Map definitions, built with small helper functions so layouts stay
// readable and easy to tweak.
(function (HB) {
  'use strict';

  function Grid(w, h, fill) {
    this.w = w; this.h = h;
    this.c = [];
    for (let y = 0; y < h; y++) this.c.push(new Array(w).fill(fill));
  }
  Grid.prototype.set = function (x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = ch; };
  Grid.prototype.get = function (x, y) { return this.c[y] && this.c[y][x]; };
  Grid.prototype.rect = function (x, y, w, h, ch) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch); };
  Grid.prototype.hline = function (x0, x1, y, ch) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, ch); };
  Grid.prototype.vline = function (x, y0, y1, ch) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, ch); };
  // roof 2 rows + wall row with windows and a door
  Grid.prototype.house = function (x, y, w, doorX) {
    this.rect(x, y, w, 2, '^');
    for (let i = 0; i < w; i++) {
      const cx = x + i;
      this.set(cx, y + 2, cx === doorX ? 'D' : (i === 0 || i === w - 1) ? '#' : (i % 2 === 1 ? 'W' : '#'));
    }
    this.set(doorX, y + 3, '=');
  };
  Grid.prototype.rows = function () { return this.c.map((r) => r.join('')); };

  function sprinkle(grid, ch, chance, seed, onlyOn) {
    const r = HB.rng(seed);
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      if (grid.get(x, y) === (onlyOn || '.') && r() < chance) grid.set(x, y, ch);
    }
  }
  function forestBorder(grid, seed, gaps) {
    const r = HB.rng(seed);
    const isGap = (x, y) => gaps.some((g) => x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1);
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      const edge = Math.min(x, y, grid.w - 1 - x, grid.h - 1 - y);
      if (isGap(x, y)) continue;
      if (edge === 0 || (edge === 1 && r() < 0.55) || (edge === 2 && r() < 0.12)) grid.set(x, y, 'T');
    }
  }

  // ---------- Town: 울림골 ----------
  function buildTown() {
    const W = 34, H = 24;
    const m = new Grid(W, H, '.');
    sprinkle(m, ',', 0.07, 7);
    forestBorder(m, 3, [{ x0: 16, x1: 17, y0: 20, y1: 23 }]);

    // plaza with the tower
    m.rect(11, 9, 12, 7, '_');
    m.rect(15, 10, 3, 2, 'B');

    // houses
    m.house(3, 3, 7, 6);
    m.house(24, 3, 7, 27);
    m.house(3, 15, 6, 5);
    m.house(25, 15, 7, 28); // inn

    // paths
    m.vline(6, 7, 11, '='); m.hline(6, 10, 11, '=');
    m.vline(27, 7, 11, '='); m.hline(23, 27, 11, '=');
    m.vline(5, 19, 20, '='); m.hline(5, 15, 20, '=');
    m.vline(28, 19, 20, '='); m.hline(18, 28, 20, '=');
    m.vline(16, 16, 23, '='); m.vline(17, 16, 23, '=');
    m.vline(16, 6, 8, '='); m.vline(17, 6, 8, '=');

    // pond
    m.rect(28, 9, 4, 3, '~');
    m.rect(29, 12, 2, 1, '~');
    m.set(28, 8, 'r');

    // garden fence near the south-west house
    m.hline(10, 13, 18, 'F');
    m.vline(10, 18, 19, 'F');
    m.rect(11, 19, 3, 1, ',');

    // signs and rocks
    m.set(18, 21, 's');
    m.set(13, 8, 's');
    m.set(9, 13, 'r'); m.set(21, 6, 'r');

    return {
      id: 'town',
      name: '울림골',
      sub: '종소리가 멈춘 노을의 마을',
      theme: 'town',
      mood: 'sunset',
      music: 'town',
      rows: m.rows(),
      spawn: { x: 16.5, y: 18, dir: 'up' },
      tower: { tx: 15, ty: 10 },
      exits: [{ x0: 16, x1: 17, y0: 23, y1: 23, to: 'field', spawn: { x: 20.5, y: 1.5, dir: 'down' } }],
      signs: [
        { tx: 18, ty: 21, text: '남쪽 - 바람결 들판\n해가 지기 전에 돌아오시오.' },
        { tx: 13, ty: 8, text: '울림골 - 아워벨이 시간을 지키는 마을' }
      ],
      doors: [
        { tx: 6, ty: 5, text: '문이 잠겨 있다. 안에서 냄비 끓는 소리가 들린다.' },
        { tx: 27, ty: 5, text: '문틈으로 오래된 오르골 소리가 새어 나온다.' },
        { tx: 5, ty: 17, text: '"지금은 바빠요! 꽃 포장 중이에요!"' },
        { tx: 28, ty: 17, text: '여관 "쉬어가는 종". 안쪽이 따뜻해 보인다.' }
      ],
      npcs: [
        {
          id: 'keeper', name: '종지기 노인', pal: 'keeper', x: 16.5, y: 13.4, dir: 'down', wander: 0,
          lines: [
            '종이 멈춘 지 꽤 되었지. 그날 이후로 해가 지지도, 뜨지도 않아.',
            '종소리는 원래 하나의 노래였네. 멈추던 날, 그 노래가 바람에 실려 흩어져 버렸지.',
            '들판에 나가 보게. 바람결 어딘가에 첫 소절이 남아 있을지도 모르네.'
          ]
        },
        {
          id: 'florist', name: '꽃집 아이라', pal: 'florist', x: 9.5, y: 12.5, dir: 'right', wander: 2.5,
          lines: [
            '들판에 나가면 바람 소리가 꼭 노래처럼 들려.',
            '그런데 요즘엔 소리를 먹는 이상한 것들이 떠다닌대. 조심해!'
          ]
        },
        {
          id: 'innkeep', name: '여관 주인', pal: 'innkeep', x: 28.5, y: 19.6, dir: 'down', wander: 0,
          lines: [
            '쉬었다 가게. ...라고 하고 싶은데, 오늘이 끝나질 않으니 숙박비를 받을 수가 있어야지.'
          ]
        },
        {
          id: 'child', name: '꼬마 토비', pal: 'child', x: 20.5, y: 17.5, dir: 'left', wander: 4,
          lines: [
            '종이 다시 울리면 내일이 와?',
            '내일이 내 생일이란 말이야. 벌써 백 번째 오늘이야!'
          ]
        },
        {
          id: 'fisher', name: '낚시꾼', pal: 'fisher', x: 26.6, y: 10.5, dir: 'right', wander: 0,
          lines: ['물고기도 시간이 멈춘 걸 아는 모양이야. 같은 녀석이 벌써 열두 번째 낚였어.']
        }
      ]
    };
  }

  HB.MAPS = { town: buildTown };
  HB.Grid = Grid;
  HB.mapTools = { sprinkle, forestBorder };
})(window.HB);
