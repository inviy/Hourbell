// Overworld scene: walking, talking, depth sorting and atmosphere.
(function (HB) {
  'use strict';

  const T = HB.TILE;
  const SPEED = 75; // px per second
  const NPC_SPEED = 26;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const WALK_SEQ = [1, 0, 2, 0];

  // ---------- entities ----------
  function Actor(x, y, pal, dir) {
    this.x = x; this.y = y; this.dir = dir || 'down';
    this.sprites = HB.makeCharacter(HB.PALETTES[pal] || pal);
    this.anim = 0; this.moving = false;
  }
  Actor.prototype.frame = function () {
    if (!this.moving) return this.sprites[this.dir][0];
    return this.sprites[this.dir][WALK_SEQ[Math.floor(this.anim * 8) % 4]];
  };
  Actor.prototype.draw = function (g, cam) {
    const sx = Math.round(this.x - cam.x), sy = Math.round(this.y - cam.y);
    HB.drawShadow(g, sx, sy - 3, 10);
    g.drawImage(this.frame(), sx - 8, sy - 15);
  };

  // ---------- scene ----------
  const World = {
    map: null, def: null, player: null, npcs: [], cam: { x: 0, y: 0 },
    motes: [], clouds: [], visited: {}, tower: null, glow: null, hintT: 0,

    load(id, spawn) {
      const def = HB.MAPS[id]();
      this.def = def;
      this.map = new HB.TileMap(def);
      const sp = spawn || def.spawn;
      if (!this.player) this.player = new Actor(0, 0, 'hero');
      this.player.x = sp.x * T; this.player.y = sp.y * T; this.player.dir = sp.dir || 'down';
      this.player.moving = false;
      this.npcs = (def.npcs || []).map((n) => {
        const a = new Actor(n.x * T, n.y * T, n.pal, n.dir);
        a.def = n; a.home = { x: a.x, y: a.y }; a.wait = 1 + Math.random() * 2; a.target = null;
        return a;
      });
      this.tower = def.tower ? { x: (def.tower.tx + 1.5) * T, y: (def.tower.ty + 2) * T, img: HB.makeBellTower(0) } : null;
      this.glow = HB.makeGlow(14, 'rgba(255,190,90,0.55)');
      this.motes = []; this.clouds = [];
      this.snapCamera();
      if (HB.music) HB.music.play(def.music);
      HB.showBanner(def.name, def.sub);
      if (this.onLoad) this.onLoad(def);
      if (HB.worldHooks && HB.worldHooks.onLoad) HB.worldHooks.onLoad(this, def);
    },

    enter(arg) {
      this.load(arg && arg.map || 'town', arg && arg.spawn);
      if (!this.visited.intro) {
        this.visited.intro = true;
        this.hintT = 9;
        HB.dialog.open([
          '세계의 시간을 알리던 대종, 아워벨이 멈췄다.',
          '그날 이후, 울림골에는 끝나지 않는 노을이 내려앉아 있다.'
        ], { voice: 'narrate' });
      }
    },

    // ---------- collision ----------
    blocked(x, y, self) {
      const hw = 5, top = 5;
      const pts = [[x - hw, y - top], [x + hw - 1, y - top], [x - hw, y - 1], [x + hw - 1, y - 1]];
      for (const [px, py] of pts) {
        if (this.map.solidAt(Math.floor(px / T), Math.floor(py / T))) return true;
      }
      const actors = this.npcs.concat([this.player]);
      for (const a of actors) {
        if (a === self) continue;
        if (Math.abs(a.x - x) < 10 && Math.abs(a.y - y) < 6) return true;
      }
      if (this.extraBlock && this.extraBlock(x, y, self)) return true;
      return false;
    },
    tryMove(a, dx, dy) {
      // move per axis so walls slide nicely
      if (dx && !this.blocked(a.x + dx, a.y, a)) a.x += dx;
      if (dy && !this.blocked(a.x, a.y + dy, a)) a.y += dy;
    },

    // ---------- update ----------
    update(dt, fading) {
      HB.updateBanner(dt);
      if (this.hintT > 0 && !HB.dialog.active) this.hintT -= dt;
      if (HB.dialog.active) { HB.dialog.update(dt); this.player.moving = false; this.updateFx(dt); return; }
      if (this.overlayUpdate && this.overlayUpdate(dt)) { this.updateFx(dt); return; }
      if (!fading) this.updatePlayer(dt);
      this.updateNpcs(dt);
      this.updateFx(dt);
      this.updateCamera(dt);
      if (HB.worldHooks && HB.worldHooks.update) HB.worldHooks.update(this, dt, fading);
    },

    updatePlayer(dt) {
      const p = this.player, inp = HB.input;
      let dx = 0, dy = 0;
      if (inp.isDown('left')) dx -= 1;
      if (inp.isDown('right')) dx += 1;
      if (inp.isDown('up')) dy -= 1;
      if (inp.isDown('down')) dy += 1;
      p.moving = !!(dx || dy);
      if (p.moving) {
        if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
        if (Math.abs(dy) >= Math.abs(dx)) p.dir = dy < 0 ? 'up' : 'down';
        else p.dir = dx < 0 ? 'left' : 'right';
        const ox = p.x, oy = p.y;
        this.tryMove(p, dx * SPEED * dt, dy * SPEED * dt);
        p.anim += dt * (Math.hypot(p.x - ox, p.y - oy) > 0.01 ? 1 : 0.4);
        this.checkExits();
      } else p.anim = 0;
      if (inp.hit('ok')) this.interact();
    },

    checkExits() {
      const p = this.player;
      const tx = Math.floor(p.x / T), ty = Math.floor((p.y - 2) / T);
      for (const e of this.def.exits || []) {
        if (tx >= e.x0 && tx <= e.x1 && ty >= e.y0 && ty <= e.y1) {
          // only leave when walking off toward the map edge
          const edgeY = ty === this.map.h - 1 && p.dir === 'down';
          const edgeT = ty === 0 && p.dir === 'up';
          const edgeX = (tx === 0 && p.dir === 'left') || (tx === this.map.w - 1 && p.dir === 'right');
          if (!(edgeY || edgeT || edgeX)) continue;
          HB.sfx && HB.sfx('step');
          HB.fadeTo(() => this.load(e.to, e.spawn));
          return;
        }
      }
    },

    interact() {
      const p = this.player;
      const [dx, dy] = DIRS[p.dir];
      const qx = p.x + dx * 12, qy = p.y - 3 + dy * 12;
      for (const n of this.npcs) {
        if (Math.abs(n.x - qx) < 10 && Math.abs(n.y - 3 - qy) < 10) {
          n.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[p.dir];
          n.moving = false; n.target = null; n.wait = 2.5;
          HB.dialog.open(n.def.lines, { name: n.def.name });
          return;
        }
      }
      const tx = Math.floor(qx / T), ty = Math.floor(qy / T);
      if (HB.worldHooks && HB.worldHooks.interact && HB.worldHooks.interact(this, tx, ty)) return;
      const t = this.map.at(tx, ty);
      const find = (list) => (list || []).find((s) => s.tx === tx && s.ty === ty);
      const sign = find(this.def.signs), door = find(this.def.doors);
      if (sign) HB.dialog.open(sign.text);
      else if (door) HB.dialog.open(door.text);
      else if (t === 'B') {
        HB.sfx && HB.sfx('thud');
        HB.dialog.open([
          '탑을 두드려 보았지만, 둔탁한 소리만 돌아올 뿐이다.',
          '거대한 종이 미동도 없이 매달려 있다.',
          '시계탑의 바늘은 일곱 시 십 분 전에 멈춰 있다.'
        ]);
      } else if (t === '~') HB.dialog.open('물결 위로 노을빛이 일렁인다.');
    },

    updateNpcs(dt) {
      for (const n of this.npcs) {
        const range = (n.def.wander || 0) * T;
        if (!range) { n.moving = false; continue; }
        if (n.target) {
          const vx = n.target.x - n.x, vy = n.target.y - n.y;
          const d = Math.hypot(vx, vy);
          if (d < 1.5) { n.target = null; n.moving = false; n.wait = 1.5 + Math.random() * 3; continue; }
          const sx = (vx / d) * NPC_SPEED * dt, sy = (vy / d) * NPC_SPEED * dt;
          const ox = n.x, oy = n.y;
          this.tryMove(n, sx, sy);
          if (Math.abs(vy) > Math.abs(vx)) n.dir = vy < 0 ? 'up' : 'down'; else n.dir = vx < 0 ? 'left' : 'right';
          n.moving = true; n.anim += dt * 0.7;
          if (Math.hypot(n.x - ox, n.y - oy) < 0.05) { n.target = null; n.moving = false; n.wait = 1; }
        } else {
          n.wait -= dt;
          if (n.wait <= 0) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * range;
            n.target = { x: n.home.x + Math.cos(a) * r, y: n.home.y + Math.sin(a) * r };
          }
        }
      }
    },

    snapCamera() {
      const p = this.player;
      this.cam.x = this.camTarget(p.x, this.map.w * T, HB.W);
      this.cam.y = this.camTarget(p.y - 8, this.map.h * T, HB.H);
    },
    camTarget(v, size, view) {
      if (size <= view) return -Math.floor((view - size) / 2);
      return HB.clamp(v - view / 2, 0, size - view);
    },
    updateCamera(dt) {
      const p = this.player;
      const tx = this.camTarget(p.x, this.map.w * T, HB.W);
      const ty = this.camTarget(p.y - 8, this.map.h * T, HB.H);
      const k = 1 - Math.pow(0.0001, dt);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    },

    // ---------- atmosphere ----------
    updateFx(dt) {
      const mood = this.def.mood;
      const cx = this.cam.x, cy = this.cam.y;
      const want = mood === 'sunset' ? 34 : 18;
      while (this.motes.length < want) {
        this.motes.push({
          x: cx + Math.random() * HB.W, y: cy + Math.random() * HB.H,
          vx: (Math.random() - 0.3) * 6, vy: mood === 'sunset' ? -3 - Math.random() * 5 : 2 + Math.random() * 4,
          ph: Math.random() * 6.28, life: 4 + Math.random() * 6, kind: mood
        });
      }
      for (const m of this.motes) {
        m.x += (m.vx + Math.sin(HB.time * 1.5 + m.ph) * 4) * dt;
        m.y += m.vy * dt;
        m.life -= dt;
      }
      this.motes = this.motes.filter((m) => m.life > 0 && m.x > cx - 20 && m.x < cx + HB.W + 20 && m.y > cy - 20 && m.y < cy + HB.H + 20);
      if (mood === 'day') {
        while (this.clouds.length < 3) {
          this.clouds.push({ x: cx - 140 - Math.random() * 200, y: cy + Math.random() * HB.H, s: 0.7 + Math.random() * 0.7 });
        }
        for (const c of this.clouds) c.x += 9 * dt;
        this.clouds = this.clouds.filter((c) => c.x < cx + HB.W + 140);
      }
    },

    drawMood(g) {
      const mood = this.def.mood;
      const cam = this.cam;
      if (mood === 'sunset') {
        g.save();
        g.globalCompositeOperation = 'multiply';
        const grd = g.createLinearGradient(0, 0, 0, HB.H);
        grd.addColorStop(0, '#ffb07a');
        grd.addColorStop(0.55, '#f4a088');
        grd.addColorStop(1, '#a088c8');
        g.fillStyle = grd; g.fillRect(0, 0, HB.W, HB.H);
        g.globalCompositeOperation = 'lighter';
        for (const w of this.map.windows) {
          const sx = w.x - cam.x, sy = w.y - cam.y;
          if (sx < -20 || sy < -20 || sx > HB.W + 20 || sy > HB.H + 20) continue;
          g.globalAlpha = 0.55 + Math.sin(HB.time * 3 + w.x) * 0.08;
          g.drawImage(this.glow, Math.round(sx - 14), Math.round(sy - 12));
        }
        g.globalAlpha = 1;
        for (const m of this.motes) {
          const a = Math.min(1, m.life / 1.5) * (0.5 + 0.5 * Math.sin(HB.time * 3 + m.ph));
          g.fillStyle = 'rgba(255,214,140,' + (a * 0.9).toFixed(2) + ')';
          g.fillRect(Math.round(m.x - cam.x), Math.round(m.y - cam.y), 1, 1);
        }
        g.restore();
      } else if (mood === 'day') {
        g.save();
        for (const c of this.clouds) {
          const sx = Math.round(c.x - cam.x), sy = Math.round(c.y - cam.y);
          g.fillStyle = 'rgba(30,40,80,0.10)';
          g.beginPath();
          g.ellipse(sx, sy, 60 * c.s, 22 * c.s, 0, 0, Math.PI * 2);
          g.ellipse(sx + 34 * c.s, sy - 6 * c.s, 34 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = '#fff4e0'; g.fillRect(0, 0, HB.W, HB.H);
        g.globalCompositeOperation = 'source-over';
        for (const m of this.motes) {
          const sx = Math.round(m.x - cam.x), sy = Math.round(m.y - cam.y);
          g.fillStyle = (m.ph > 3) ? '#ffe0ec' : '#fffbe8';
          g.fillRect(sx, sy, 2, 1);
          if (Math.sin(HB.time * 6 + m.ph) > 0) g.fillRect(sx + 1, sy - 1, 1, 1);
        }
        g.restore();
      }
    },

    // ---------- draw ----------
    draw(g) {
      const cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
      g.fillStyle = '#10101c'; g.fillRect(0, 0, HB.W, HB.H);
      this.map.drawGround(g, cam);
      const list = [this.player].concat(this.npcs);
      if (this.tower) list.push({ y: this.tower.y, draw: (gg) => gg.drawImage(this.tower.img, Math.round(this.tower.x - 24 - cam.x), Math.round(this.tower.y + 4 - 96 - cam.y)) });
      if (this.extraDrawables) this.extraDrawables(list);
      list.sort((a, b) => a.y - b.y);
      for (const a of list) a.draw(g, cam);
      this.map.drawTops(g, cam);
      this.drawMood(g);
      if (this.overlayDraw) this.overlayDraw(g, cam);
      HB.drawBanner(g);
      if (this.hintT > 0 && !HB.dialog.active) {
        g.save();
        g.globalAlpha = Math.min(1, this.hintT);
        HB.text(g, '이동: 방향키   조사 / 대화: Z, Enter', HB.W / 2, HB.H - 14, '#fff4d8', { align: 'center', font: 'g9' });
        g.restore();
      }
      HB.dialog.draw(g);
    }
  };

  HB.World = World;
  HB.Actor = Actor;
})(window.HB);
