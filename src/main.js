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
      for (let i = 0; i < 70; i++) this.stars.push({ x: r() * HB.W, y: r() * 95, p: r() * 6.28, b: r() });
      // distant hills silhouette
      this.hills = [];
      for (let x = 0; x <= HB.W; x++) {
        this.hills.push(118 + Math.sin(x * 0.021) * 7 + Math.sin(x * 0.057 + 1) * 4);
      }
      if (HB.music) HB.music.play('title');
    },
    update(dt) {
      this.t += dt;
      if (this.leaving) return;
      if (this.t > 0.6 && (HB.input.hit('ok') || HB.input.hit('cancel') || HB.input.any && Object.keys(HB.input.pressed).length)) {
        this.leaving = true;
        HB.sfx && HB.sfx('start');
        HB.fadeTo(() => HB.setScene(HB.World, { map: 'town' }), { dur: 0.9 });
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
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * 2 + s.p)) * (1 - s.y / 110);
        g.fillStyle = 'rgba(255,244,220,' + a.toFixed(2) + ')';
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        if (s.b > 0.93) { g.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1); g.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3); }
      }
      // setting sun (never quite sets)
      const sunY = 124;
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
      g.drawImage(this.rim, 214, 72);
      g.drawImage(this.tower, 215, 72);
      // logo
      const lift = Math.min(1, this.t / 1.6);
      const ly = Math.round(26 - (1 - lift) * 8);
      g.save();
      g.globalAlpha = lift;
      HB.textScaled(g, 'Hourbell', W / 2, ly, '#ffe6a8', 3, { align: 'center', shadow: '#2a1430' });
      HB.text(g, '잊힌 종소리를 찾아서', W / 2, ly + 40, '#f4d8e8', { align: 'center', font: 'g9' });
      g.restore();
      if (this.t > 1.4 && Math.floor(this.t * 2) % 2 === 0) {
        HB.text(g, '아무 키나 누르세요', W / 2, 160, '#fff4d8', { align: 'center' });
      }
      HB.text(g, 'prototype v0.1', W - 4, H - 11, '#8a7aa8', { align: 'right', font: 'g9', shadow: null });
    }
  };
  HB.Title = Title;

  HB.fontsReady.then(() => {
    HB.setScene(Title);
    HB.start();
  });
})(window.HB);
