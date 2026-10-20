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
      this.saved = HB.load(); this.msg = '';
      this.setOptions();
    },
    // continue (with a save), a new game, or a save code from another device
    setOptions() {
      this.opts = this.saved ? ['continue', 'new', 'code'] : ['new', 'code'];
      this.choice = 0; this.confirmNew = false;
    },
    loadCode() {
      const code = window.prompt('다른 기기에서 복사한 세이브 코드를 붙여넣으세요.');
      HB.input.down = {}; // the dialog swallowed the key release
      if (!code) return;
      if (this.saved && !window.confirm('이 기기의 기록을 코드의 기록으로 덮어씁니다. 계속할까요?')) return;
      if (HB.useCode(code)) {
        this.saved = HB.load(); this.setOptions();
        this.msg = '세이브를 불러왔다! 이어하기로 시작하세요.'; HB.sfx('fragment');
      } else { this.msg = '코드를 읽을 수 없다. 코드 전체를 복사했는지 확인해 주세요.'; HB.sfx('cancel'); }
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
      const n = this.opts.length;
      if (HB.input.hit('up') || HB.input.hit('down')) { this.choice = (this.choice + (HB.input.hit('up') ? n - 1 : 1)) % n; this.confirmNew = false; this.msg = ''; HB.sfx('move'); }
      const opt = this.opts[this.choice];
      if (opt === 'code' && HB.input.hit('ok')) { this.loadCode(); return; }
      if (this.saved && opt === 'new' && !this.confirmNew && HB.input.hit('ok')) { this.confirmNew = true; HB.sfx('cancel'); return; }
      if (HB.input.hit('ok') || (!this.saved && opt === 'new' && HB.input.hit('cancel'))) {
        this.leaving = true;
        HB.sfx && HB.sfx('start');
        HB.music.stop(0.9);
        const d = opt === 'continue' ? this.saved : null;
        HB.fadeTo(() => {
          const w = HB.World;
          HB.party = d ? d.party : HB.newParty();
          w.flags = d ? d.flags : {};
          w.visited = d ? { intro: true } : {};
          HB.setScene(w, d ? { map: d.map, spawn: { x: d.x, y: d.y, dir: d.dir } } : { map: 'town' });
          // back after a while: the place and, under it, what to do next
          if (d) HB.showBanner(w.def.name, '지금 할 일: ' + HB.currentGoal(w.flags, HB.party), 6);
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
      if (this.awake) {
        const labels = { continue: '이어하기', new: this.saved ? '처음부터' : '모험 시작', code: '코드로 불러오기' };
        this.opts.forEach((o, i) => {
          const y = H - 30 - (this.opts.length - i) * 14;
          HB.text(g, labels[o], W / 2 - 24, y, i === this.choice ? '#fff4d8' : '#a898c0');
          if (i === this.choice) HB.drawCursor(g, W / 2 - 38, y + 3);
        });
        const P = this.saved && this.saved.party;
        const info = this.msg || (this.confirmNew ? '처음부터 시작해도 기록은 남지만, 다음에 기록하면 덮어써집니다. 한 번 더 누르면 시작'
          : this.opts[this.choice] === 'code' ? '다른 기기의 메뉴 > 세이브 코드로 복사한 코드를 붙여넣기'
            : P ? 'Lv ' + P.lvl + '  ·  조각 ' + HB.fragments(this.saved.flags) + ' / 7' : '');
        HB.text(g, info, W / 2, H - 16, this.msg || this.confirmNew ? '#ffd080' : '#c8b8d8', { font: 'g9', align: 'center' });
      } else if (this.t > 1.4 && Math.floor(this.t * 2) % 2 === 0) {
        HB.text(g, HB.touchControls ? '화면을 터치하세요' : '아무 키나 누르세요', W / 2, H - 36, '#fff4d8', { align: 'center' });
      }
      if (this.awake && !HB.touchControls) HB.text(g, 'M  소리 켜기 / 끄기', 4, H - 11, '#8a7aa8', { font: 'g9', shadow: null });
      HB.text(g, 'v1.2', W - 4, H - 11, '#8a7aa8', { align: 'right', font: 'g9', shadow: null });
    }
  };
  HB.Title = Title;

  // chapter cards: title, two lines, then on to the next chapter (or the
  // title screen after the last one). Chapter files add their own entries.
  HB.CHAPTERS = HB.CHAPTERS || {};
  HB.CHAPTERS[1] = {
    title: '바람결의 첫 소절',
    lines: ['멈춰 있던 노을이, 아주 조금 기울었다.', '남은 여섯 소절은 다른 시대에 잠들어 있다.'],
    keeper: ['오오... 방금 그 소리, 첫 소절이로군!', '보게, 종이 아주 조금 흔들리고 있네. 나머지 소절도 분명 어딘가에 있을 걸세.', '...들리는가? 아워벨이 아주 작게, 한 번 울렸네.'],
    party: { mio: '처음으로 종소리를 들었어요. ...이 노래, 끝까지 불러 보고 싶어요.' },
    keeperAfter: ['종이 아주 조금 흔들리고 있네. 나머지 소절도 분명 어딘가에 있을 걸세.'],
    next: ['종소리가 울린 뒤, 동쪽 바닷가 쪽 안개가 아주 조금 옅어졌다.', '마을 동쪽 길로 나가면 항구에 닿을 수 있을 것 같다.']
  };

  const Ending = {
    enter(arg) {
      this.t = 0; this.leaving = false;
      this.n = (arg && arg.chapter) || 1;
      const c = this.c = HB.CHAPTERS[this.n];
      const P = HB.party, m = Math.floor(P.time / 60);
      this.lines = [
        ['제' + this.n + '장  ' + c.title, '#ffe6a8', 0.5],
        ['- 완 -', '#f4d8e8', 1.5],
        ['Lv ' + P.lvl + '  ·  ' + Math.floor(m / 60) + '시간 ' + (m % 60) + '분  ·  전투 ' + P.battles + '회', '#c8c0e0', 3.0],
        [c.lines[0], '#f4f0e8', 4.5],
        [c.lines[1], '#f4f0e8', 6.0],
        [c.final ? '- 끝 -' : '- 다음 장에서 계속 -', '#ffe08a', 8.0]
      ];
      // the last card looks back over the seven chapters, then rolls credits, a page at a time
      const recap = c.credits ? [['지나온 길'].concat([1, 2, 3, 4, 5, 6, 7].map((k) => k + '장  ' + HB.CHAPTERS[k].title))] : [];
      const credits = recap.concat(c.credits || []);
      this.pages = [this.lines].concat(credits.map((pg, i) => pg.map((t, j) => [t, j ? '#f4f0e8' : '#ffe6a8', 11 + i * 6 + j * (pg.length > 4 ? 0.4 : 0.8)])));
      this.wait = 9 + credits.length * 6;
      this.stars = Title.stars || [];
      HB.music.play('title', { fadeIn: 3 });
    },
    // the page showing at time t (page 0 until 11s, then one every 6s)
    pageAt(t) { return t < 11 ? 0 : Math.min(this.pages.length - 1, 1 + Math.floor((t - 11) / 6)); },
    update(dt) {
      this.t += dt;
      if (this.leaving) return;
      const press = HB.input.hit('ok') || HB.input.hit('cancel');
      if (this.t < this.wait) {
        // a press skips ahead: to the next page, or to the end of the last one
        if (press && this.t > 1.5) { const p = this.pageAt(this.t); this.t = Math.min(this.wait, p + 1 < this.pages.length ? 11 + p * 6 : this.wait); }
        return;
      }
      if (press) {
        this.leaving = true;
        HB.sfx('ok');
        HB.music.stop(1.2);
        const c = this.c;
        HB.fadeTo(() => {
          if (c.final) { HB.setScene(Title); return; }
          HB.setScene(HB.World, { map: c.returnMap || 'town', spawn: c.spawn });
          if (c.next) HB.dialog.open(c.next, { voice: 'narrate' });
        }, { dur: 1.2 });
      }
    },
    draw(g) {
      const W = HB.W, H = HB.H;
      // each page a different sky, from the sunset towards night and morning
      const tones = [['#0e0e2a', '#3a2450', '#a85a5a'], ['#101a34', '#2a3a60', '#6a7aa8'], ['#0a0c22', '#1c2048', '#3a3a70'], ['#141030', '#3a2a58', '#8a6a9a'], ['#1a2440', '#4a5a80', '#c8a888'], ['#0e0e2a', '#3a2450', '#e8b880']];
      const tone = tones[this.pageAt(this.t) % tones.length], sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, tone[0]); sky.addColorStop(0.7, tone[1]); sky.addColorStop(1, tone[2]);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        g.fillStyle = 'rgba(255,244,220,' + (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 1.5 + s.p))).toFixed(2) + ')';
        g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      const page = this.pages[this.pageAt(this.t)], gap = page.length > 6 ? 22 : 28;
      page.forEach(([text, col, at], i) => {
        const a = HB.clamp((this.t - at) / 1.2, 0, 1);
        if (!a) return;
        g.save(); g.globalAlpha = a;
        HB.text(g, text, W / 2, (page.length > 6 ? 34 : 50) + i * gap + Math.round((1 - a) * 4), col, { align: 'center' });
        g.restore();
      });
      if (this.t > this.wait && Math.floor(this.t * 2) % 2 === 0) HB.text(g, this.c.final ? 'Z / Enter  타이틀로' : 'Z / Enter  계속하기', W / 2, H - 24, '#a898c0', { align: 'center', font: 'g9' });
    }
  };
  HB.Ending = Ending;

  HB.fontsReady.then(() => {
    HB.setScene(Title);
    HB.start();
  });
})(window.HB);
