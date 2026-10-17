// Auto hunt (Q, or 메뉴 > 자동 사냥): walk to the nearest monster along a
// tile path and fight it on auto battle. Stops, and says why, when HP runs
// low, the area is clear, or the player takes the controls.
(function (HB) {
  'use strict';

  const T = HB.TILE, DIRS = ['up', 'down', 'left', 'right'];
  const tileOf = (x, y) => [Math.floor(x / T), Math.floor((y - 2) / T)];

  // breadth-first search from the player's tile to the closest tile holding a
  // foe; returns the path as [[tx, ty], ...] or null
  function pathToFoe(map, from, foes) {
    const goal = new Set(foes.map((e) => tileOf(e.x, e.y).join(',')));
    const prev = new Map([[from.join(','), null]]);
    const q = [from];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i], k = x + ',' + y;
      if (goal.has(k)) {
        const path = [];
        for (let c = k; c; c = prev.get(c)) path.unshift(c.split(',').map(Number));
        return path;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = nx + ',' + ny;
        if (prev.has(nk) || (map.solidAt(nx, ny) && !goal.has(nk))) continue;
        prev.set(nk, k);
        q.push([nx, ny]);
      }
    }
    return null;
  }

  const AutoHunt = {
    on: false, path: null, repath: 0,

    start() { this.on = true; this.path = null; this.repath = 0; HB.sfx('ok'); },
    stop(why) {
      this.on = false;
      this.release();
      if (why) HB.dialog.open(why, { voice: 'narrate' });
    },
    release() { DIRS.forEach((d) => { HB.input.down[d] = false; }); },

    update(w, dt, fading) {
      const inp = HB.input;
      if (inp.hit('auto') && !HB.Battle.active) { if (this.on) { HB.sfx('cancel'); this.stop(); } else this.start(); }
      if (!this.on) return false;
      if (HB.Battle.active || fading || HB.Menu.open || HB.Cutscene.steps) { this.release(); return false; }
      // the player's own direction key takes over (we hold keys without "pressing" them)
      if (DIRS.some((d) => inp.pressed[d])) { this.stop('직접 움직여서 자동 사냥을 멈췄다.'); return false; }
      const P = HB.party, foes = HB.Field.enemies.filter((e) => !e.dead && e.kind !== 'boss');
      if (P.hp < P.maxHp * 0.4) { this.stop('체력이 낮아 자동 사냥을 멈췄다. 여관이나 약초로 회복하자.'); return false; }
      if (!(w.def.enemies || []).length) { this.stop('이곳에는 싸울 상대가 없다. 들판으로 나가 보자.'); return false; }
      if (!foes.length) { this.stop('이 근처의 적을 모두 물리쳤다. 다른 곳에 들렀다 오면 다시 나타난다.'); return false; }

      const p = w.player;
      this.repath -= dt;
      if (!this.path || this.repath <= 0) {
        this.path = pathToFoe(w.map, tileOf(p.x, p.y), foes);
        this.repath = 0.25;
        if (!this.path) { this.stop('갈 수 있는 곳에 적이 없다.'); return false; }
      }
      // walk toward the next tile centre on the path
      const here = tileOf(p.x, p.y).join(',');
      while (this.path.length > 1 && this.path[0].join(',') !== here) this.path.shift();
      const next = this.path[1] || this.path[0];
      const dx = next[0] * T + 8 - p.x, dy = next[1] * T + 12 - p.y;
      inp.down.left = dx < -1; inp.down.right = dx > 1;
      inp.down.up = dy < -1; inp.down.down = dy > 1;
      return false;
    },

    drawOverlay(w, g) {
      if (!this.on || HB.Battle.active) return;
      HB.drawWindow(g, HB.W - 132, 4, 128, 18, 0.85);
      HB.text(g, '자동 사냥 중 · Q로 멈춤', HB.W - 68, 7, '#ffe08a', { font: 'g9', align: 'center' });
    }
  };

  HB.AutoHunt = AutoHunt;
  HB.worldPlugins.push(AutoHunt);
  HB.Menu.hooks.push({ label: '자동 사냥', act: (w) => { HB.Menu.close(); AutoHunt.start(); } });
})(window.HB);
