// Cutscenes: a list of steps played in order while the player waits.
//   ['say', text|lines, opts]     dialogue (waits until closed)
//   ['wait', seconds]
//   ['sfx', name] / ['music', name, opts]
//   ['move', npcId, tx, ty]       walk an NPC to a tile, ignoring walls
//   ['face', npcId|'player', dir]
//   ['call', fn(world)]
(function (HB) {
  'use strict';

  const T = HB.TILE, SPEED = 40;

  const Cutscene = {
    steps: null, waitT: 0, mover: null,

    update(w, dt) {
      if (!this.steps) return false;
      if (this.waitT > 0) { this.waitT -= dt; return true; }
      if (this.mover) {
        const m = this.mover, a = m.actor;
        const dx = m.x - a.x, dy = m.y - a.y, d = Math.hypot(dx, dy);
        if (d < 1) { a.x = m.x; a.y = m.y; a.moving = false; this.mover = null; return true; }
        const s = Math.min(d, SPEED * dt);
        a.x += dx / d * s; a.y += dy / d * s; a.moving = true; a.anim += dt;
        a.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        return true;
      }
      const step = this.steps.shift();
      if (!step) { this.steps = null; return false; }
      const [kind, a, b, c] = step;
      const actor = (id) => (id === 'player' ? w.player : w.npcs.find((n) => n.def.id === id));
      if (kind === 'say') HB.dialog.open(a, b);
      else if (kind === 'wait') this.waitT = a;
      else if (kind === 'sfx') HB.sfx(a);
      else if (kind === 'music') HB.music.play(a, b);
      else if (kind === 'move') { const n = actor(a); if (n) { n.target = null; this.mover = { actor: n, x: b * T, y: c * T }; } }
      else if (kind === 'face') { const n = actor(a); if (n) n.dir = b; }
      else if (kind === 'call') a(w);
      return true;
    }
  };

  HB.cutscene = (steps) => { Cutscene.steps = steps.slice(); Cutscene.waitT = 0; Cutscene.mover = null; };
  HB.Cutscene = Cutscene;
  HB.worldPlugins.push(Cutscene);
})(window.HB);
