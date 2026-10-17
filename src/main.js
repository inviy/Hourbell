// Title screen and boot.
(function (HB) {
  'use strict';

  const Title = {
    enter() {
      this.t = 0;
      this.leaving = false;
      // tower as a dusk silhouette with a warm rim light
      const src = HB.makeBellTower(0);
      const [sil, sx] = HB.makeCanvas(48, 96);
      sx.drawImage(src, 0, 0);
      sx.globalCompositeOperation = 'source-atop';
      sx.fillStyle = '#26182f'; sx.fillRect(0, 0, 48, 96);
      sx.globalCompositeOperation = 'source-over';
      const [rim, rx] = HB.makeCanvas(48, 96);
      rx.drawImage(src, 0, 0);
      rx.globalCompositeOperation = 'source-atop';
      rx.fillStyle = '#e8945c'; rx.fillRect(0, 0, 48, 96);
      this.tower = sil; this.rim = rim;
      const r = HB.rng(42);
      this.stars = [];
      for (let i = 0; i < 150; i++) this.stars.push({ x: r() * HB.W, y: r() * (HB.H - 85), p: r() * 6.28, b: r() });
      // distant hills silhouette
      this.hills = [];
      for (let x = 0; x <= HB.W; x++) {
        this.hills.push(HB.H - 62 + Math.sin(x * 0.021) * 7 + Math.sin(x * 0.057 + 1) * 4);
      }
      this.awake = false; // first key wakes the audio, second starts the game
      this.saved = HB.load();
      this.choice = this.saved ? 0 : 1; // 0 continue, 1 new game
    },
    update(dt) {
      this.t += dt;
      if (this.leaving) return;
      const pressed = Object.keys(HB.input.pressed).length > 0;
      if (!this.awake && pressed && this.t > 0.3) {
        this.awake = true; this.awakeT = this.t;
        HB.music.play('title', { fadeIn: 1.2 });
        return;
      }
      if (!this.awake || this.t - this.awakeT < 0.4) return;
      if (this.saved && (HB.input.hit('up') || HB.input.hit('down'))) { this.choice ^= 1; this.confirmNew = false; HB.sfx('move'); }
      if (this.saved && this.choice === 1 && !this.confirmNew && HB.input.hit('ok')) { this.confirmNew = true; HB.sfx('cancel'); return; }
      if (HB.input.hit('ok') || (!this.saved && HB.input.hit('cancel'))) {
        this.leaving = true;
        HB.sfx && HB.sfx('start');
        HB.music.stop(0.9);
        const d = this.choice === 0 ? this.saved : null;
        HB.fadeTo(() => {
          const w = HB.World;
          HB.party = d ? d.party : HB.newParty();
          w.flags = d ? d.flags : {};
          w.visited = d ? { intro: true } : {};
          HB.setScene(w, d ? { map: d.map, spawn: { x: d.x, y: d.y, dir: d.dir } } : { map: 'town' });
        }, { dur: 0.9 });
      }
    },
    draw(g) {
      const W = HB.W, H = HB.H;
      // dusk sky
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#141436');
      sky.addColorStop(0.45, '#4a2c5e');
      sky.addColorStop(0.72, '#c8605a');
      sky.addColorStop(0.86, '#f4a860');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // banded dithering for a 16-bit feel
      g.fillStyle = 'rgba(20,10,40,0.18)';
      for (let y = 0; y < H; y += 2) if (y % 8 < 2) g.fillRect(0, y, W, 1);
      for (const s of this.stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * 2 + s.p)) * (1 - s.y / (H - 70));
        g.fillStyle = 'rgba(255,244,220,' + a.toFixed(2) + ')';
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        if (s.b > 0.93) { g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1); g.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3); }
      }
      // setting sun (never quite sets)
      const sunY = H - 56;
      g.fillStyle = 'rgba(255,214,140,0.25)';
      g.beginPath(); g.arc(W / 2, sunY, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd890';
      g.beginPath(); g.arc(W / 2, sunY, 22, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 4; i++) { g.fillStyle = '#e88c5c'; g.fillRect(W / 2 - 24, sunY - 10 + i * 6, 48, 1 + (i > 1 ? 1 : 0)); }
      // hills
      g.fillStyle = '#2a1a3a';
      for (let x = 0; x < W; x++) g.fillRect(x, Math.round(this.hills[x]), 1, H);
      g.fillStyle = '#1a1028';
      for (let x = 0; x < W; x++) g.fillRect(x, Math.round(this.hills[x] + 14 + Math.sin(x * 0.09) * 3), 1, H);
      // tower silhouette
      const tx = W / 2 + 54, ty = H - 108;
      g.drawImage(this.rim, tx - 1, ty);
      g.drawImage(this.tower, tx, ty);
      // logo
      const lift = Math.min(1, this.t / 1.6);
      const ly = Math.round(H * 0.2 - (1 - lift) * 8);
      g.save();
      g.globalAlpha = lift;
      HB.textScaled(g, 'Hourbell', W / 2, ly, '#ffe6a8', 3, { align: 'center', shadow: '#2a1430' });
      HB.text(g, '잊힌 종소리를 찾아서', W / 2, ly + 40, '#f4d8e8', { align: 'center', font: 'g9' });
      g.restore();
      if (this.awake && this.saved) {
        ['이어하기', '처음부터'].forEach((label, i) => {
          const y = H - 50 + i * 16;
          HB.text(g, label, W / 2 - 24, y, i === this.choice ? '#fff4d8' : '#a898c0');
          if (i === this.choice) HB.drawCursor(g, W / 2 - 38, y + 3);
        });
        const P = this.saved.party;
        HB.text(g, this.confirmNew ? '처음부터 시작해도 기록은 남지만, 다음에 기록하면 덮어써집니다. 한 번 더 누르면 시작'
          : 'Lv ' + P.lvl + '  ·  조각 ' + (this.saved.flags.fragment1 ? 1 : 0) + ' / 7', W / 2, H - 16, this.confirmNew ? '#ffd080' : '#c8b8d8', { font: 'g9', align: 'center' });
      } else if (this.t > 1.4 && Math.floor(this.t * 2) % 2 === 0) {
        const msg = HB.touchControls ? (this.awake ? '한 번 더 터치하면 모험 시작' : '화면을 터치하세요')
          : (this.awake ? 'Z / Enter  모험 시작' : '아무 키나 누르세요');
        HB.text(g, msg, W / 2, H - 36, '#fff4d8', { align: 'center' });
      }
      if (this.awake && !HB.touchControls) HB.text(g, 'M  소리 켜기 / 끄기', 4, H - 11, '#8a7aa8', { font: 'g9', shadow: null });
      HB.text(g, 'prototype v0.7', W - 4, H - 11, '#8a7aa8', { align: 'right', font: 'g9', shadow: null });
    }
  };
  HB.Title = Title;

  // end of chapter one: a quiet roll of what you did, then back to the title
  const Ending = {
    enter() {
      this.t = 0; this.leaving = false;
      const P = HB.party, m = Math.floor(P.time / 60);
      this.lines = [
        ['제1장  바람결의 첫 소절', '#ffe6a8', 0.5],
        ['- 완 -', '#f4d8e8', 1.5],
        ['Lv ' + P.lvl + '  ·  ' + Math.floor(m / 60) + '시간 ' + (m % 60) + '분  ·  전투 ' + P.battles + '회', '#c8c0e0', 3.0],
        ['멈춰 있던 노을이, 아주 조금 기울었다.', '#f4f0e8', 4.5],
        ['남은 여섯 소절은 다른 시대에 잠들어 있다.', '#f4f0e8', 6.0],
        ['- 다음 장에서 계속 -', '#ffe08a', 8.0]
      ];
      this.stars = Title.stars || [];
      HB.music.play('title', { fadeIn: 3 });
    },
    update(dt) {
      this.t += dt;
      if (this.leaving || this.t < 9) return;
      if (HB.input.hit('ok') || HB.input.hit('cancel')) {
        this.leaving = true;
        HB.sfx('ok');
        HB.music.stop(1.2);
        HB.fadeTo(() => HB.setScene(Title), { dur: 1.2 });
      }
    },
    draw(g) {
      const W = HB.W, H = HB.H;
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0e0e2a'); sky.addColorStop(0.7, '#3a2450'); sky.addColorStop(1, '#a85a5a');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        g.fillStyle = 'rgba(255,244,220,' + (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 1.5 + s.p))).toFixed(2) + ')';
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      this.lines.forEach(([text, col, at], i) => {
        const a = HB.clamp((this.t - at) / 1.2, 0, 1);
        if (!a) return;
        g.save(); g.globalAlpha = a;
        HB.text(g, text, W / 2, 50 + i * 28 + Math.round((1 - a) * 4), col, { align: 'center' });
        g.restore();
      });
      if (this.t > 9 && Math.floor(this.t * 2) % 2 === 0) HB.text(g, 'Z / Enter  타이틀로', W / 2, H - 24, '#a898c0', { align: 'center', font: 'g9' });
    }
  };
  HB.Ending = Ending;

  HB.fontsReady.then(() => {
    HB.setScene(Title);
    HB.start();
  });
})(window.HB);
