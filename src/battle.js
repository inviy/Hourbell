// Seamless battles: fights happen right where you meet the enemy,
// the camera stays put and everyone steps into position.
(function (HB) {
  'use strict';

  // Korean particle helper: josa('소리먹이', '을를') -> '소리먹이를'
  HB.josa = function (word, pair) {
    const ch = word.charCodeAt(word.length - 1);
    let batchim = false;
    if (ch >= 0xac00 && ch <= 0xd7a3) batchim = (ch - 0xac00) % 28 !== 0;
    else if (/[0-9]$/.test(word)) batchim = '013678'.indexOf(word.slice(-1)) >= 0;
    return word + (batchim ? pair[0] : pair[1]);
  };

  const COMMANDS = [
    { id: 'attack', label: '공격' },
    { id: 'chime', label: '종소리', cost: HB.SKILLS.chime },
    { id: 'heal', label: '회복', cost: HB.SKILLS.heal },
    { id: 'item', label: '도구' },
    { id: 'guard', label: '방어' },
    { id: 'flee', label: '도망' }
  ];
  // offsets from the screen centre
  const SLOTS = [[56, 4], [80, -22], [84, 28]];
  const HERO = [-64, 14];
  const rnd = HB.rnd;

  const Battle = {
    active: false,

    start(w, foes) {
      this.active = true;
      this.w = w;
      this.cam = { x: Math.round(w.cam.x), y: Math.round(w.cam.y) };
      this.phase = 'busy';
      this.msg = '';
      this.nums = []; this.fx = [];
      this.cursor = 0; this.target = 0;
      this.shake = 0; this.distort = 0; this.flash = 0;
      this.co = null; this.wait = 0;
      this.turn = 0; this.guarding = false; this.silenced = 0;
      this.isBoss = foes.some((e) => e.kind === 'boss');
      HB.party.battles++;
      const count = {}, seen = {};
      foes.forEach((e) => { count[e.kind] = (count[e.kind] || 0) + 1; });
      this.foes = foes.slice(0, 3).map((e, i) => {
        Object.assign(e, HB.makeFoe(e.kind));
        e.inBattle = true; e.hp = e.maxHp;
        // same-kind foes get A / B / C
        if (count[e.kind] > 1) { seen[e.kind] = (seen[e.kind] || 0) + 1; e.name += ' ' + 'ABC'[seen[e.kind] - 1]; }
        e.flash = 0; e.hitShake = 0; e.dying = 0; e.dead = false;
        e.slot = { x: this.cam.x + HB.W / 2 + SLOTS[i][0], y: this.cam.y + HB.H / 2 + SLOTS[i][1] };
        return e;
      });
      const p = w.player;
      p.moving = false;
      this.heroOrigin = { x: p.x, y: p.y };
      this.heroSlot = { x: this.cam.x + HB.W / 2 + HERO[0], y: this.cam.y + HB.H / 2 + HERO[1] };
      this.run(this.introSeq());
    },

    run(gen) { this.co = gen; this.wait = 0; },

    // ---------- helpers for sequences ----------
    *moveTo(a, x, y, dur, face) {
      const sx = a.x, sy = a.y;
      let t = 0;
      if (a.sprites) a.moving = true;
      while (t < dur) {
        t += 1 / 60;
        const k = Math.min(1, t / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        a.x = sx + (x - sx) * e; a.y = sy + (y - sy) * e;
        if (a.sprites) a.anim += 1 / 60;
        yield 0;
      }
      a.x = x; a.y = y;
      if (a.sprites) { a.moving = false; if (face) a.dir = face; }
    },
    *waitOk() {
      this.waitingOk = true;
      while (!HB.input.hit('ok') && !HB.input.hit('cancel')) yield 0;
      this.waitingOk = false;
      HB.sfx('tick');
    },
    num(x, y, text, color) { this.nums.push({ x, y, text: String(text), color, t: 0 }); },
    alive() { return this.foes.filter((f) => !f.dead && f.hp > 0); },

    // ---------- sequences ----------
    *introSeq() {
      HB.sfx('encounter');
      HB.music.play(this.isBoss ? 'boss' : 'battle', { fadeOut: 0.15, fadeIn: 0 });
      this.distort = 0.55; this.flash = 0.12;
      yield 0.2;
      this.flash = 0.1;
      const p = this.w.player;
      const moves = [this.moveTo(p, this.heroSlot.x, this.heroSlot.y, 0.45, 'right')]
        .concat(this.foes.map((f) => this.moveTo(f, f.slot.x, f.slot.y, 0.45)));
      // run all moves together
      let running = true;
      while (running) {
        running = false;
        for (const m of moves) if (!m.next().done) running = true;
        yield 0;
      }
      p.dir = 'right';
      this.msg = this.foes.length > 1 ? '소리를 먹는 것들이 나타났다!' : HB.josa(this.foes[0].name, '이가') + ' 나타났다!';
      yield 0.8;
      if (this.isBoss) { this.msg = '주변의 모든 소리가 숨을 죽였다...'; yield 1.2; }
      this.toMenu();
    },

    toMenu() {
      this.phase = 'menu'; this.msg = '';
      this.turn++; this.guarding = false;
    },

    *heroAttack(t) {
      const P = HB.party, p = this.w.player;
      this.msg = P.name + '의 공격!';
      const home = { x: p.x, y: p.y };
      yield* this.moveTo(p, t.x - 22, t.y, 0.16, 'right');
      const crit = Math.random() < HB.critChance;
      let dmg = HB.hitDmg(P.atk, t.def);
      if (crit) dmg = Math.round(dmg * 1.8);
      HB.sfx('hit');
      this.fx.push({ kind: 'slash', x: t.x, y: t.y - 14, t: 0 });
      t.hp -= dmg; t.flash = 0.2; t.hitShake = 0.3;
      if (crit) { this.shake = 0.3; this.msg = '회심의 일격!'; }
      this.num(t.x, t.y - 26, dmg, crit ? '#ffb040' : '#fff4c0');
      yield 0.35;
      yield* this.moveTo(p, home.x, home.y, 0.2, 'right');
      if (t.hp <= 0) yield* this.kill(t);
      yield 0.15;
      yield* this.resolveRound();
    },

    *heroChime() {
      const P = HB.party, p = this.w.player;
      P.mp -= HB.SKILLS.chime;
      this.msg = HB.josa(P.name, '은는') + ' 종소리를 울렸다!';
      HB.sfx('chime');
      this.fx.push({ kind: 'rings', x: p.x, y: p.y - 8, t: 0 });
      yield 0.55;
      const targets = this.alive();
      for (const f of targets) {
        const dmg = HB.chimeDmg(P);
        f.hp -= dmg; f.flash = 0.25; f.hitShake = 0.25;
        this.fx.push({ kind: 'sparkle', x: f.x, y: f.y - 14, t: 0 });
        this.num(f.x, f.y - 26, dmg, '#ffe680');
        HB.sfx('hit');
        yield 0.16;
      }
      yield 0.35;
      for (const f of targets) if (f.hp <= 0) yield* this.kill(f);
      yield 0.15;
      yield* this.resolveRound();
    },

    *heroHeal() {
      const P = HB.party, p = this.w.player;
      P.mp -= HB.SKILLS.heal;
      const amt = Math.min(P.maxHp - P.hp, HB.healAmt(P));
      this.msg = HB.josa(P.name, '은는') + ' 맑은 종소리로 몸을 감쌌다.';
      HB.sfx('heal');
      this.fx.push({ kind: 'sparkle', x: p.x, y: p.y - 10, t: 0, color: '#a8f0b8' });
      yield 0.4;
      P.hp += amt;
      this.num(p.x, p.y - 22, amt, '#88f0a0');
      this.msg = 'HP가 ' + amt + ' 회복되었다.';
      yield 0.7;
      yield* this.resolveRound();
    },

    *heroItem(id) {
      const P = HB.party, p = this.w.player;
      const got = HB.useItem(P, id);
      this.msg = HB.josa(P.name, '은는') + ' ' + HB.josa(HB.ITEMS[id].name, '을를') + ' 사용했다.';
      HB.sfx('heal');
      this.fx.push({ kind: 'sparkle', x: p.x, y: p.y - 10, t: 0, color: got.hp ? '#a8f0b8' : '#a8c8ff' });
      yield 0.4;
      if (got.hp) this.num(p.x, p.y - 22, got.hp, '#88f0a0');
      if (got.mp) this.num(p.x, p.y - 34, '울림 +' + got.mp, '#9ab8ff');
      yield 0.6;
      yield* this.resolveRound();
    },

    *heroGuard() {
      const P = HB.party, p = this.w.player;
      this.guarding = true;
      this.msg = HB.josa(P.name, '은는') + ' 몸을 낮추고 숨을 골랐다.';
      const gain = Math.min(2, P.maxMp - P.mp);
      P.mp += gain;
      HB.sfx('move');
      if (gain) this.num(p.x, p.y - 22, '울림 +' + gain, '#9ab8ff');
      yield 0.7;
      yield* this.resolveRound();
    },

    *flee() {
      const P = HB.party, p = this.w.player;
      if (this.isBoss) {
        this.msg = '정적이 발을 붙잡는다. 도망칠 수 없다!';
        HB.sfx('cancel');
        yield 0.9;
        yield* this.resolveRound();
        return;
      }
      if (Math.random() < 0.7) {
        this.msg = HB.josa(P.name, '은는') + ' 재빨리 몸을 피했다!';
        HB.sfx('run');
        p.dir = 'left';
        yield* this.moveTo(p, p.x - 36, p.y, 0.3, 'left');
        yield 0.3;
        this.foes.forEach((f) => { f.cool = 3; f.inBattle = false; f.hp = f.maxHp; });
        this.end(false);
        return;
      }
      this.msg = '도망칠 수 없었다!';
      HB.sfx('cancel');
      yield 0.7;
      yield* this.resolveRound();
    },

    *kill(f) {
      if (f.dead) return;
      HB.sfx('vanish');
      f.dying = 0.7;
      this.msg = HB.josa(f.name, '을를') + ' 물리쳤다!';
      yield 0.7;
      f.dead = true;
    },

    *foeAct(f) {
      const P = HB.party, p = this.w.player;
      const intent = HB.foeIntent(f, this.turn, P, this.silenced > 0);
      if (intent === 'silence') {
        this.msg = HB.josa(f.name, '이가') + ' 정적을 내리깔았다! 종소리를 낼 수 없다!';
        HB.sfx('vanish');
        f.hitShake = 0.4; this.distort = 0.3;
        this.silenced = 2;
        yield 1.1;
        return;
      }
      if (intent === 'wave') {
        this.msg = HB.josa(f.name, '이가') + ' 고요의 파동을 일으켰다!';
        f.hitShake = 0.5;
        yield 0.5;
        this.fx.push({ kind: 'rings', x: f.x, y: f.y - 8, t: 0 });
        yield 0.3;
      }
      if (intent === 'swallow') {
        this.msg = HB.josa(f.name, '이가') + ' 주변의 소리를 삼켰다!';
        HB.sfx('vanish');
        f.hitShake = 0.4;
        yield 0.45;
        const lost = Math.min(P.mp, 2);
        P.mp -= lost;
        this.num(p.x, p.y - 22, '울림 -' + lost, '#9ab8ff');
        yield 0.6;
        return;
      }
      const home = { x: f.x, y: f.y };
      if (intent === 'attack') {
        this.msg = f.name + '의 공격!';
        yield 0.2;
        yield* this.moveTo(f, p.x + (f.boss ? 30 : 20), p.y, 0.15);
      }
      const dmg = HB.foeDmg(f, P, intent, this.guarding);
      P.hp = Math.max(0, P.hp - dmg);
      HB.sfx('hurt');
      this.shake = 0.25; this.heroFlash = 0.2;
      this.num(p.x, p.y - 22, dmg, '#ff8a7a');
      yield 0.3;
      yield* this.moveTo(f, home.x, home.y, 0.2);
      yield 0.2;
    },

    *resolveRound() {
      if (!this.alive().length) { yield* this.win(); return; }
      if (this.silenced > 0 && --this.silenced === 0) { this.msg = '목소리가 돌아왔다.'; yield 0.7; }
      for (const f of this.alive()) {
        yield* this.foeAct(f);
        if (HB.party.hp <= 0) { yield* this.lose(); return; }
      }
      this.toMenu();
    },

    *win() {
      const P = HB.party;
      HB.music.play('victory', { fadeOut: 0.1, fadeIn: 0 });
      this.msg = this.isBoss ? '정적이 깨지고, 바람 소리가 돌아왔다!' : '모두 물리쳤다!';
      if (this.isBoss) this.w.flags.boss1 = true;
      yield 1.2;
      const exp = this.foes.reduce((s, f) => s + f.exp, 0);
      const gold = this.foes.reduce((s, f) => s + rnd(f.gold[0], f.gold[1]), 0);
      P.exp += exp; P.gold += gold;
      this.msg = '경험치 ' + exp + ', ' + gold + '골드를 얻었다.';
      yield* this.waitOk();
      for (const f of this.foes) {
        if (Math.random() >= f.drop[1]) continue;
        P.items[f.drop[0]] = (P.items[f.drop[0]] || 0) + 1;
        this.msg = HB.josa(f.name, '이가') + ' ' + HB.josa(HB.ITEMS[f.drop[0]].name, '을를') + ' 떨어뜨렸다.';
        HB.sfx('ok');
        yield* this.waitOk();
      }
      while (P.exp >= HB.expToNext(P.lvl)) {
        P.exp -= HB.expToNext(P.lvl);
        const g = HB.levelUp(P);
        HB.sfx('fragment');
        this.msg = '레벨 ' + P.lvl + '!  HP+' + g.maxHp + '  울림+' + g.maxMp + '  공격+' + g.atk + '  방어+' + g.def;
        yield* this.waitOk();
      }
      this.end(true);
    },

    *lose() {
      const P = HB.party;
      HB.music.stop(1.2);
      this.msg = HB.josa(P.name, '은는') + ' 쓰러졌다...';
      this.w.player.dir = 'down';
      yield 1.6;
      yield* this.waitOk();
      HB.fadeTo(() => {
        this.active = false;
        P.hp = P.maxHp; P.mp = P.maxMp;
        const lost = Math.floor(P.gold / 2);
        P.gold -= lost;
        this.w.load('town');
        HB.dialog.open(['...정신을 차려 보니 울림골이었다.', '바람 속에서 누군가 데려다준 것 같다.']
          .concat(lost ? ['주머니가 가벼워졌다... (' + lost + '골드를 잃었다)'] : []), { voice: 'narrate' });
      }, { dur: 1.0 });
      while (this.active) yield 0;
    },

    end(won) {
      this.active = false;
      this.co = null;
      this.phase = 'none';
      this.msg = '';
      const w = this.w;
      w.player.moving = false;
      // never leave the hero standing inside a tree or the river
      if (w.blocked(w.player.x, w.player.y, w.player)) { w.player.x = this.heroOrigin.x; w.player.y = this.heroOrigin.y; }
      for (const f of this.foes) { if (won || f.dead) f.dead = true; f.inBattle = false; }
      if (HB.Field) HB.Field.grace = 2.5;
      HB.music.play(HB.Field ? HB.Field.musicFor(w) : w.def.music, { fadeIn: 1.0, fadeOut: 0.6 });
    },

    // ---------- update ----------
    update(w, dt) {
      // keep the camera steady with optional shake
      const sh = this.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * (this.shake / 0.3)) : 0;
      w.cam.x = this.cam.x + sh; w.cam.y = this.cam.y + (sh ? Math.round((Math.random() - 0.5) * 3) : 0);
      this.shake = Math.max(0, this.shake - dt);
      this.distort = Math.max(0, this.distort - dt);
      this.flash = Math.max(0, this.flash - dt);
      this.heroFlash = Math.max(0, (this.heroFlash || 0) - dt);
      for (const f of this.foes) {
        f.flash = Math.max(0, f.flash - dt);
        f.hitShake = Math.max(0, f.hitShake - dt);
        if (f.dying > 0) f.dying = Math.max(0, f.dying - dt);
      }
      this.nums.forEach((n) => { n.t += dt; });
      this.nums = this.nums.filter((n) => n.t < 1.1);
      this.fx.forEach((f) => { f.t += dt; });
      this.fx = this.fx.filter((f) => f.t < 0.9);

      if (this.phase === 'menu') this.updateMenu();
      else if (this.phase === 'target') this.updateTarget();
      else if (this.phase === 'item') this.updateItem();
      if (this.co) {
        if (this.wait > 0) this.wait -= dt;
        else {
          const r = this.co.next();
          if (r.done) this.co = null;
          else this.wait = r.value || 0;
        }
      }
      return true;
    },

    updateMenu() {
      const inp = HB.input;
      const c = this.cursor, n = COMMANDS.length;
      if (inp.hit('up')) { this.cursor = (c + n - 2) % n; HB.sfx('move'); }
      if (inp.hit('down')) { this.cursor = (c + 2) % n; HB.sfx('move'); }
      if (inp.hit('left') || inp.hit('right')) { this.cursor = c ^ 1; HB.sfx('move'); }
      if (!inp.hit('ok')) return;
      const cmd = COMMANDS[this.cursor];
      if (cmd.cost && HB.party.mp < cmd.cost) { HB.sfx('cancel'); this.msg = '울림이 부족하다.'; return; }
      if (cmd.id === 'chime' && this.silenced) { HB.sfx('cancel'); this.msg = '정적 때문에 종소리를 낼 수 없다.'; return; }
      if (cmd.id === 'item') {
        this.items = Object.keys(HB.party.items);
        if (!this.items.length) { HB.sfx('cancel'); this.msg = '가진 도구가 없다.'; return; }
        HB.sfx('ok');
        this.phase = 'item'; this.itemCursor = 0; this.msg = '무엇을 쓸까?';
        return;
      }
      HB.sfx('ok');
      this.phase = 'busy';
      if (cmd.id === 'attack') {
        const alive = this.alive();
        if (alive.length === 1) this.run(this.heroAttack(alive[0]));
        else { this.phase = 'target'; this.target = 0; this.msg = '누구를 공격할까?'; }
      } else if (cmd.id === 'chime') this.run(this.heroChime());
      else if (cmd.id === 'heal') this.run(this.heroHeal());
      else if (cmd.id === 'guard') this.run(this.heroGuard());
      else this.run(this.flee());
    },

    updateItem() {
      const inp = HB.input, n = this.items.length;
      if (inp.hit('up')) { this.itemCursor = (this.itemCursor + n - 1) % n; HB.sfx('move'); }
      if (inp.hit('down')) { this.itemCursor = (this.itemCursor + 1) % n; HB.sfx('move'); }
      if (inp.hit('cancel')) { HB.sfx('cancel'); this.phase = 'menu'; this.msg = ''; return; }
      if (inp.hit('ok')) { HB.sfx('ok'); this.phase = 'busy'; this.run(this.heroItem(this.items[this.itemCursor])); }
    },

    updateTarget() {
      const inp = HB.input, alive = this.alive();
      if (inp.hit('up') || inp.hit('left')) { this.target = (this.target + alive.length - 1) % alive.length; HB.sfx('move'); }
      if (inp.hit('down') || inp.hit('right')) { this.target = (this.target + 1) % alive.length; HB.sfx('move'); }
      if (inp.hit('cancel')) { HB.sfx('cancel'); this.toMenu(); return; }
      if (inp.hit('ok')) { HB.sfx('ok'); this.phase = 'busy'; this.run(this.heroAttack(alive[this.target])); }
    },

    // ---------- draw ----------
    drawEffects(g, cam) {
      for (const f of this.fx) {
        const x = Math.round(f.x - cam.x), y = Math.round(f.y - cam.y);
        if (f.kind === 'slash') {
          const k = Math.min(1, f.t / 0.15);
          g.fillStyle = f.t < 0.25 ? '#ffffff' : 'rgba(255,255,255,0.4)';
          for (let i = 0; i < 14 * k; i++) {
            g.fillRect(x - 7 + i, y - 7 + i, 2, 1);
            g.fillRect(x - 5 + i, y - 8 + i, 1, 1);
          }
        } else if (f.kind === 'rings') {
          g.save();
          g.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) {
            const r = (f.t - k * 0.12) * 160;
            if (r <= 0) continue;
            g.strokeStyle = 'rgba(255,214,120,' + Math.max(0, 0.8 - f.t).toFixed(2) + ')';
            g.lineWidth = 2;
            g.beginPath(); g.ellipse(x, y + 6, r, r * 0.45, 0, 0, Math.PI * 2); g.stroke();
          }
          g.restore();
        } else if (f.kind === 'sparkle') {
          g.fillStyle = f.color || '#fff4c0';
          for (let k = 0; k < 6; k++) {
            const a = k * 1.047 + f.t * 3, r = 4 + f.t * 22;
            const sx = Math.round(x + Math.cos(a) * r), sy = Math.round(y + Math.sin(a) * r * 0.7 - f.t * 10);
            if (f.t > 0.7 && k % 2) continue;
            g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3);
          }
        }
      }
      for (const n of this.nums) {
        const bounce = n.t < 0.25 ? -Math.sin(n.t / 0.25 * Math.PI) * 8 : 0;
        const rise = n.t > 0.6 ? (n.t - 0.6) * 20 : 0;
        g.save();
        g.globalAlpha = n.t > 0.85 ? Math.max(0, 1 - (n.t - 0.85) / 0.25) : 1;
        HB.text(g, n.text, Math.round(n.x - cam.x), Math.round(n.y - cam.y + bounce - rise), n.color, { align: 'center' });
        g.restore();
      }
    },

    drawOverlay(g, cam) {
      // encounter: wavy distortion and a white flash
      if (this.distort > 0) {
        const [tc, tx] = HB.makeCanvas(HB.W, HB.H);
        tx.drawImage(g.canvas, 0, 0);
        const amp = (this.distort / 0.55) * 10;
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, HB.W, HB.H);
        for (let y = 0; y < HB.H; y += 2) {
          const off = Math.round(Math.sin(y * 0.12 + HB.time * 30) * amp);
          g.drawImage(tc, 0, y, HB.W, 2, off, y, HB.W, 2);
        }
      }
      // soft vignette to focus the fight
      const grd = g.createRadialGradient(HB.W / 2, HB.H / 2 + 2, 90, HB.W / 2, HB.H / 2 + 2, 300);
      grd.addColorStop(0, 'rgba(10,0,30,0)');
      grd.addColorStop(1, 'rgba(10,0,30,0.45)');
      g.fillStyle = grd; g.fillRect(0, 0, HB.W, HB.H);

      this.drawEffects(g, cam);
      if (this.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, this.flash * 8).toFixed(2) + ')'; g.fillRect(0, 0, HB.W, HB.H); }

      // target cursor
      if (this.phase === 'target') {
        const t = this.alive()[this.target];
        if (t) {
          const x = Math.round(t.x - cam.x), y = Math.round(t.y - cam.y - 36 + Math.sin(HB.time * 8) * 2);
          g.fillStyle = '#1a1430'; g.fillRect(x - 4, y - 1, 9, 1); g.fillRect(x - 3, y, 7, 2); g.fillRect(x - 2, y + 2, 5, 1); g.fillRect(x - 1, y + 3, 3, 1);
          g.fillStyle = '#fff8e0'; g.fillRect(x - 3, y, 7, 1); g.fillRect(x - 2, y + 1, 5, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x, y + 3, 1, 1);
        }
      }

      if (this.msg) {
        HB.drawWindow(g, 8, 6, HB.W - 16, 22);
        HB.text(g, this.msg, HB.W / 2, 10, '#f4f0e8', { align: 'center' });
        if (this.waitingOk && Math.floor(HB.time * 3) % 2 === 0) {
          g.fillStyle = '#fff8e0';
          g.fillRect(HB.W - 22, 20, 5, 1); g.fillRect(HB.W - 21, 21, 3, 1); g.fillRect(HB.W - 20, 22, 1, 1);
        }
      }
      this.drawPanel(g);
    },

    drawPanel(g) {
      const P = HB.party;
      const ox = Math.floor((HB.W - 308) / 2) - 6, oy = HB.H - 52 - 128;
      g.save();
      g.translate(ox, oy);
      // commands
      HB.drawWindow(g, 6, 110, 116, 64);
      const active = this.phase === 'menu';
      COMMANDS.forEach((c, i) => {
        const cx = 22 + (i % 2) * 52, cy = 118 + Math.floor(i / 2) * 18;
        const poor = (c.cost && P.mp < c.cost) || (c.id === 'chime' && this.silenced) || (c.id === 'flee' && this.isBoss);
        const col = !active ? '#8a8aa8' : poor ? '#9a90b0' : '#f4f0e8';
        HB.text(g, c.label, cx, cy, col);
        if (c.cost) HB.text(g, String(c.cost), cx + HB.textWidth(c.label) + 3, cy + 2, '#9ab8ff', { font: 'g9' });
        if (active && i === this.cursor) HB.drawCursor(g, cx - 10, cy + 3);
      });
      if (this.phase === 'item') {
        const h = this.items.length * 16 + 10, y = 108 - h;
        HB.drawWindow(g, 6, y, 116, h);
        this.items.forEach((id, i) => {
          HB.text(g, HB.ITEMS[id].name, 22, y + 6 + i * 16);
          HB.text(g, 'x' + P.items[id], 112, y + 7 + i * 16, '#c8c0e0', { font: 'g9', align: 'right' });
          if (i === this.itemCursor) HB.drawCursor(g, 12, y + 9 + i * 16);
        });
      }
      if (this.silenced) HB.text(g, '침묵 ' + this.silenced, 300, 120, '#c8a0ff', { font: 'g9', align: 'right' });
      // status
      HB.drawWindow(g, 126, 128, 188, 46);
      HB.text(g, P.name, 136, 134, this.heroFlash > 0 ? '#ff8a7a' : '#ffe08a');
      HB.text(g, 'Lv ' + P.lvl, 300, 135, '#c8c0e0', { align: 'right', font: 'g9' });
      bar(g, 136, 151, 'HP', P.hp, P.maxHp, P.hp / P.maxHp < 0.3 ? '#ff7a6a' : '#7ae08a');
      bar(g, 136, 165, '울림', P.mp, P.maxMp, '#7ab0ff');
      g.restore();
    }
  };

  function bar(g, x, y, label, v, max, col) {
    HB.text(g, label, x, y - 5, '#c8c0e0', { font: 'g9' });
    const bx = x + 30, w = 90;
    g.fillStyle = '#0a0a1a'; g.fillRect(bx - 1, y - 1, w + 2, 6);
    g.fillStyle = '#2a2a48'; g.fillRect(bx, y, w, 4);
    g.fillStyle = col; g.fillRect(bx, y, Math.round(w * Math.max(0, v) / max), 4);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx, y, Math.round(w * Math.max(0, v) / max), 1);
    HB.text(g, v + '/' + max, x + 170, y - 4, '#f4f0e8', { font: 'g9', align: 'right' });
  }
  HB.drawBar = bar;

  HB.Battle = Battle;
})(window.HB);
