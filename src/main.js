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
      if (this.awake && this.t - this.awakeT > 0.4 && (HB.input.hit('ok') || HB.input.hit('cancel'))) {
        this.leaving = true;
        HB.sfx && HB.sfx('start');
        HB.music.stop(0.9);
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
      if (this.t > 1.4 && Math.floor(this.t * 2) % 2 === 0) {
        const msg = HB.touchControls ? (this.awake ? '한 번 더 터치하면 모험 시작' : '화면을 터치하세요')
          : (this.awake ? 'Z / Enter  모험 시작' : '아무 키나 누르세요');
        HB.text(g, msg, W / 2, H - 36, '#fff4d8', { align: 'center' });
      }
      if (this.awake && !HB.touchControls) HB.text(g, 'M  소리 켜기 / 끄기', 4, H - 11, '#8a7aa8', { font: 'g9', shadow: null });
      HB.text(g, 'prototype v0.1', W - 4, H - 11, '#8a7aa8', { align: 'right', font: 'g9', shadow: null });
    }
  };
  HB.Title = Title;

  HB.fontsReady.then(() => {
    HB.setScene(Title);
    HB.start();
  });
})(window.HB);
