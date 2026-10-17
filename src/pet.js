// The pet 방울: follows the hero on the map, mends HP while walking, and
// cheers from beside the hero in battle. It never fights (see rules.js).
(function (HB) {
  'use strict';

  let frames = null;
  function makeFrames() {
    return [0, 1].map((f) => {
      const [c, x] = HB.makeCanvas(12, 13);
      const put = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const d = Math.sqrt(i * i + j * j);
        if (d > 4.4) continue;
        put(6 + i, 5 + j, d > 3.6 ? '#6a4a8a' : i + j < -2 ? '#ffffff' : '#f0e4ff');
      }
      // wisp tail and a tiny golden bell for an eye
      [[5, 10], [6, 10 + f], [7, 10], [6, 11 + f]].forEach(([i, j]) => put(i, j, '#c8b4f0'));
      put(6, 5, '#f0c040'); put(7, 5, '#f0c040'); put(6, 6, '#c8962c'); put(7, 6, '#c8962c');
      return c;
    });
  }

  const Pet = {
    trail: [], regenT: 0,

    onLoad() { this.trail = []; },

    update(w, dt) {
      const P = HB.party, p = w.player;
      if (!P.pet || HB.Battle.active) return false;
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trail.push({ x: p.x, y: p.y });
      if (this.trail.length > 12) this.trail.shift();
      if (p.moving) {
        this.regenT += dt;
        if (this.regenT >= HB.PET_REGEN) { this.regenT = 0; if (P.hp > 0 && P.hp < P.maxHp) P.hp++; }
      }
      return false;
    },

    drawables(w, list) {
      if (!HB.party.pet) return;
      if (!frames) frames = makeFrames();
      const B = HB.Battle;
      const pos = B.active && B.heroSlot ? { x: B.heroSlot.x - 18, y: B.heroSlot.y + 10 }
        : this.trail[0] || { x: w.player.x - 12, y: w.player.y };
      list.push({
        y: pos.y,
        draw: (g, cam) => {
          const sx = Math.round(pos.x - cam.x), sy = Math.round(pos.y - cam.y);
          const bob = Math.round(Math.sin(HB.time * (B.active ? 9 : 4)) * (B.active ? 2.5 : 1.5)); // hops to cheer in battle
          HB.drawShadow(g, sx, sy - 2, 8);
          g.drawImage(frames[Math.floor(HB.time * 4) % 2], sx - 6, sy - 17 + bob);
        }
      });
    }
  };

  HB.Pet = Pet;
  HB.worldPlugins.push(Pet);
})(window.HB);
