// Field plugin: visible wandering monsters, the shrine and its bell
// fragment, the small status HUD, and town reactions to progress.
(function (HB) {
  'use strict';

  const T = HB.TILE;
  // per kind: palette, sight, chase speed, wander radius, draw scale
  const KINDS = {
    wisp: { pal: null, sight: 72, chase: 36, roam: 40, scale: 1 },
    flicker: { pal: { dark: '#1e5a6a', mid: '#3aa8b8', light: '#a8f0f0' }, sight: 90, chase: 50, roam: 56, scale: 1 },
    guard: { pal: { dark: '#6a1e4a', mid: '#b04a7a', light: '#f08ab0' }, sight: 52, chase: 30, roam: 16, scale: 1 },
    boss: { pal: { out: '#0a0612', dark: '#1e1430', mid: '#3a2a5a', light: '#7a6aa8', eye: '#f4c450' }, sight: 0, chase: 0, roam: 0, scale: 2 }
  };
  const frames = {};
  function framesFor(kind) {
    if (!frames[kind]) {
      const img = HB.makeWispFrames(KINDS[kind].pal || undefined);
      frames[kind] = { img, flash: img.map((f) => HB.flashOf(f, '#ffffff')) };
    }
    return frames[kind];
  }

  const Field = {
    enemies: [], shrine: null, grace: 0,

    musicFor(w) {
      if (w.def.id === 'field' && w.flags.fragment1) return 'fieldBell';
      return w.def.music;
    },

    onLoad(w, def) {
      this.grace = 1.2;
      this.enemies = (def.enemies || []).map((e) => ({
        x: e.x * T, y: e.y * T, home: { x: e.x * T, y: e.y * T }, kind: e.kind || 'wisp',
        ph: Math.random() * 6, wander: null, cool: 0, dead: false, inBattle: false,
        flash: 0, hitShake: 0, dying: 0
      }));
      this.shrine = def.shrine ? {
        x: (def.shrine.tx + 2) * T, y: (def.shrine.ty + 2) * T,
        img: HB.makeShrine(), frag: HB.makeFragment(), glow: HB.makeGlow(16, 'rgba(255,220,120,0.7)')
      } : null;
      if (w.tower) {
        const n = 7;
        w.tower.frames = w.flags.fragment1
          ? Array.from({ length: n }, (_, i) => HB.makeBellTower(((i / (n - 1)) - 0.5) * 0.16))
          : null;
      }
      if (def.id === 'field' && w.flags.fragment1) HB.music.play('fieldBell');
    },

    update(w, dt, fading) {
      if (HB.Battle.active) return HB.Battle.update(w, dt);
      if (fading || HB.dialog.active || HB.Menu.open) return false;
      this.grace = Math.max(0, this.grace - dt);
      const p = w.player;
      for (const e of this.enemies) {
        if (e.dead) continue;
        e.cool = Math.max(0, e.cool - dt);
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
        const k = KINDS[e.kind];
        if (d < k.sight && this.grace <= 0 && e.cool <= 0) {
          e.x += (dx / d) * k.chase * dt; e.y += (dy / d) * k.chase * dt;
        } else {
          if (!e.wander || Math.hypot(e.wander.x - e.x, e.wander.y - e.y) < 2) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * k.roam;
            e.wander = { x: e.home.x + Math.cos(a) * r, y: e.home.y + Math.sin(a) * r };
          }
          const vx = e.wander.x - e.x, vy = e.wander.y - e.y, vd = Math.hypot(vx, vy) || 1;
          e.x += (vx / vd) * 12 * dt; e.y += (vy / vd) * 12 * dt;
        }
        if (d < 12 && this.grace <= 0 && e.cool <= 0) {
          // anyone close to the fight joins in (up to three)
          const near = this.enemies.filter((o) => o !== e && !o.dead && o.cool <= 0 &&
            (Math.hypot(o.x - e.x, o.y - e.y) < 80 || Math.hypot(o.x - p.x, o.y - p.y) < 90));
          near.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
          const group = [e].concat(near).slice(0, 3);
          HB.Battle.start(w, group);
          return true;
        }
      }
      return false;
    },

    talk(w, npc) {
      const id = npc.def.id;
      if (id === 'innkeep') {
        HB.dialog.open(npc.def.lines.concat(['...그래도 잠깐 앉았다 가게. 차 한 잔은 공짜일세.']), {
          name: npc.def.name,
          onClose: () => {
            const P = HB.party;
            P.hp = P.maxHp; P.mp = P.maxMp;
            HB.sfx('heal');
            const saved = HB.save(w);
            HB.dialog.open('따뜻한 차를 마셨다. HP와 울림이 모두 회복되었다.' + (saved ? '\n(모험을 기록했다)' : ''));
          }
        });
        return true;
      }
      if (id === 'florist') {
        HB.dialog.open('바람결에 나갈 거야? 약초랑 울림방울, 맑은물도 챙겨 가!', { name: npc.def.name, onClose: () => HB.Menu.openShop(['herb', 'drop', 'water']) });
        return true;
      }
      if (id === 'keeper' && w.flags.fragment1) {
        const first = !w.flags.chapter1;
        HB.dialog.open([
          '오오... 방금 그 소리, 첫 소절이로군!',
          '보게, 종이 아주 조금 흔들리고 있네. 나머지 소절도 분명 어딘가에 있을 걸세.'
        ].concat(first ? ['...들리는가? 아워벨이 아주 작게, 한 번 울렸네.'] : []), {
          name: npc.def.name,
          onClose: first ? () => {
            w.flags.chapter1 = true;
            HB.save(w);
            HB.sfx('bell');
            HB.music.stop(2.0);
            HB.fadeTo(() => HB.setScene(HB.Ending), { dur: 2.0, color: '#fff4e0' });
          } : null
        });
        return true;
      }
      if (id === 'child' && w.flags.fragment1) {
        HB.dialog.open(['방금 종이 흔들렸어! 봤어? 봤지?', '내일이 오려나 봐!'], { name: npc.def.name });
        return true;
      }
      return false;
    },

    interact(w, tx, ty) {
      if (w.map.at(tx, ty) !== 'X' || !this.shrine) return false;
      if (!w.flags.boss1) {
        HB.dialog.open([
          '제단 위에 금빛 조각이 떠 있다.',
          '손을 뻗는 순간, 바람이 뚝 멎었다. 제단 뒤에서 커다란 그림자가 일어선다!'
        ], {
          voice: 'narrate',
          onClose: () => {
            const boss = { x: this.shrine.x, y: this.shrine.y + 4, home: { x: this.shrine.x, y: this.shrine.y + 4 }, kind: 'boss',
              ph: 0, cool: 0, dead: false, inBattle: false, flash: 0, hitShake: 0, dying: 0 };
            this.enemies.push(boss);
            HB.Battle.start(w, [boss]);
          }
        });
        return true;
      }
      if (w.flags.fragment1) {
        HB.dialog.open('바람이 풍경을 스칠 때마다 희미하게 그 선율이 들려온다.');
        return true;
      }
      HB.dialog.open([
        '제단 위에 금빛 조각이 떠 있다.',
        '손을 뻗자, 바람 속에서 맑은 종소리가 울려 퍼졌다.'
      ], {
        voice: 'narrate',
        onClose: () => {
          w.flags.fragment1 = true;
          HB.sfx('fragment');
          HB.music.play('fieldBell', { fadeOut: 1.2, fadeIn: 2.0 });
          HB.dialog.open(['종소리 조각을 손에 넣었다!  (1 / 7)', '들판의 노래에 첫 소절이 돌아왔다.'], { voice: 'narrate' });
        }
      });
      return true;
    },

    drawables(w, list) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        list.push({
          y: e.y,
          draw: (g, cam) => {
            const fr = Math.floor(HB.time * 6 + e.ph) % 4;
            const fs = framesFor(e.kind), s = KINDS[e.kind].scale;
            const bob = Math.round(Math.sin(HB.time * 3 + e.ph) * 2);
            const shake = e.hitShake > 0 ? Math.round(Math.sin(HB.time * 80) * 2) : 0;
            const sx = Math.round(e.x - cam.x), sy = Math.round(e.y - cam.y);
            g.save();
            if (e.dying > 0) g.globalAlpha = e.dying / 0.7;
            else if (HB.Battle.active && !e.inBattle) g.globalAlpha = 0.3; // bystanders fade back
            HB.drawShadow(g, sx, sy - 2, 12 * s);
            const img = e.flash > 0 && Math.floor(HB.time * 30) % 2 ? fs.flash[fr] : fs.img[fr];
            const rise = e.dying > 0 ? Math.round((0.7 - e.dying) * 24) : 0;
            g.drawImage(img, sx - 12 * s + shake, sy - 26 * s + bob - rise, 24 * s, 24 * s);
            g.restore();
          }
        });
      }
      if (this.shrine) {
        const s = this.shrine;
        list.push({
          y: s.y,
          draw: (g, cam) => {
            const sx = Math.round(s.x - cam.x), sy = Math.round(s.y - cam.y);
            g.drawImage(s.img, sx - 32, sy - 40);
            if (!w.flags.fragment1) {
              const fy = sy - 34 + Math.round(Math.sin(HB.time * 2) * 2);
              g.save();
              g.globalCompositeOperation = 'lighter';
              g.globalAlpha = 0.7 + Math.sin(HB.time * 3) * 0.2;
              g.drawImage(s.glow, sx - 16, fy - 12);
              g.restore();
              g.drawImage(s.frag, sx - 5, fy - 5);
              if (Math.sin(HB.time * 5) > 0.7) { g.fillStyle = '#fffbe0'; g.fillRect(sx + 3, fy - 6, 1, 1); }
            }
          }
        });
      }
      // swaying tower once the first fragment is back
      if (w.tower && w.tower.frames) {
        const fr = w.tower.frames;
        const i = Math.round((Math.sin(HB.time * 1.4) * 0.5 + 0.5) * (fr.length - 1));
        w.tower.img = fr[i];
      }
    },

    drawOverlay(w, g, cam) {
      if (HB.Battle.active) { HB.Battle.drawOverlay(g, cam); return; }
      if (w.def.id !== 'field' || HB.dialog.active) return;
      const P = HB.party;
      HB.drawWindow(g, 4, 4, 76, 42, 0.85);
      HB.text(g, P.name, 10, 6, '#ffe08a', { font: 'g9' });
      HB.text(g, 'Lv' + P.lvl, 74, 6, '#c8c0e0', { font: 'g9', align: 'right' });
      HB.text(g, 'HP ' + P.hp + '/' + P.maxHp, 10, 19, P.hp / P.maxHp < 0.3 ? '#ff8a7a' : '#f4f0e8', { font: 'g9' });
      HB.text(g, '울림 ' + P.mp + '/' + P.maxMp, 10, 31, '#9ab8ff', { font: 'g9' });
    }
  };

  HB.Field = Field;
  HB.worldPlugins.push(Field);
})(window.HB);
