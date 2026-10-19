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
    { id: 'skill', label: '기술' },
    { id: 'item', label: '도구' },
    { id: 'guard', label: '방어' },
    { id: 'flee', label: '도망' },
    { id: 'auto', label: '자동' }
  ];
  // offsets from the screen centre; companions stand around the hero
  const SLOTS = [[56, 4], [80, -22], [84, 28]];
  const HERO = [-64, 14];
  const ALLY_SLOTS = [[-20, -28], [-28, 30], [-46, 2]];
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
      this.turn = 0; this.guarding = false; this.silenced = 0; this.buff = 0; this.fog = 0; this.fogName = '안개';
      this.isBoss = foes.some((e) => HB.FOES[e.kind] && HB.FOES[e.kind].boss);
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
      // companions step in beside the hero
      this.allies = HB.party.allies.slice(0, HB.MAX_ALLIES).map((a, i) => {
        const m = Object.assign(HB.allyStats(a.id, HB.party.lvl), { hp: a.hp, sang: false, covering: false, covered: false });
        m.actor = new HB.Actor(p.x, p.y, m.pal, 'right');
        m.slot = { x: this.heroSlot.x + ALLY_SLOTS[i][0], y: this.heroSlot.y + ALLY_SLOTS[i][1] };
        return m;
      });
      // auto stays on between battles once chosen, and always while auto-hunting
      this.auto = this.keepAuto || !!(HB.AutoHunt && HB.AutoHunt.on);
      this.run(this.introSeq());
    },

    run(gen) { this.co = gen; this.wait = 0; this.phase = 'busy'; },

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
      yield 0; // the press that closed the previous message must not close this one too
      while (!HB.input.hit('ok') && !HB.input.hit('cancel')) yield 0;
      this.waitingOk = false;
      HB.sfx('tick');
    },
    num(x, y, text, color) { this.nums.push({ x, y, text: String(text), color, t: 0 }); },
    alive() { return this.foes.filter((f) => !f.dead && f.hp > 0); },

    // ---------- sequences ----------
    *introSeq() {
      HB.sfx('encounter');
      const lead = this.foes[0];
      HB.music.play(this.isBoss ? lead.music || 'boss' : 'battle', { fadeOut: 0.15, fadeIn: 0 });
      this.distort = 0.55; this.flash = 0.12;
      yield 0.2;
      this.flash = 0.1;
      const p = this.w.player;
      const moves = [this.moveTo(p, this.heroSlot.x, this.heroSlot.y, 0.45, 'right')]
        .concat(this.allies.map((m) => this.moveTo(m.actor, m.slot.x, m.slot.y, 0.5, 'right')))
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
      if (this.isBoss) { this.msg = this.foes[0].intro || '주변의 모든 소리가 숨을 죽였다...'; yield 1.2; }
      this.toMenu();
    },

    toMenu() {
      this.phase = 'menu'; this.msg = '';
      this.turn++; this.guarding = false;
      if (this.fog > 0 && --this.fog === 0) this.msg = HB.josa(this.fogName, '이가') + ' 걷혔다.';
      const boss = this.alive().find((f) => HB.waveNext(f, this.turn));
      if (boss) this.msg = HB.josa(boss.name, '이가') + ' 깊게 숨을 들이마신다... (방어하면 파동 피해 절반)';
    },

    *heroAttack(t) {
      if (t.hp <= 0) t = this.alive()[0]; // a companion got there first
      if (!t) return;
      const P = HB.party, p = this.w.player;
      this.msg = P.name + '의 공격!';
      const home = { x: p.x, y: p.y };
      yield* this.moveTo(p, t.x - 22, t.y, 0.16, 'right');
      const crit = HB.rand() < HB.critChance;
      let dmg = HB.hitDmg(HB.effAtk(P, this.buff > 0), t.def);
      if (crit) dmg = Math.round(dmg * 1.8);
      dmg = HB.fogged(dmg, this.fog > 0);
      HB.sfx('hit');
      this.fx.push({ kind: 'slash', x: t.x, y: t.y - 14, t: 0 });
      t.hp -= dmg; t.flash = 0.2; t.hitShake = 0.3;
      if (crit) { this.shake = 0.3; this.msg = '회심의 일격!'; }
      this.num(t.x, t.y - (t.boss ? 36 : 26), dmg, crit ? '#ffb040' : '#fff4c0');
      yield 0.35;
      yield* this.moveTo(p, home.x, home.y, 0.2, 'right');
      if (t.hp <= 0) yield* this.kill(t);
      yield 0.15;
    },

    // x1.5 / x0.5 feedback above the target
    elemNote(f, el) {
      const m = HB.elemMul(f, el);
      if (m > 1) this.num(f.x, f.y - (f.boss ? 74 : 40), '약점!', '#ffd060');
      else if (m < 1) this.num(f.x, f.y - (f.boss ? 74 : 40), '내성', '#a8a0c8');
    },

    *heroChime() {
      const P = HB.party, p = this.w.player;
      P.mp -= HB.SKILLS.chime.cost;
      this.msg = HB.josa(P.name, '은는') + ' 종소리를 울렸다!';
      HB.sfx('chime');
      this.fx.push({ kind: 'rings', x: p.x, y: p.y - 8, t: 0 });
      yield 0.55;
      const targets = this.alive();
      for (const f of targets) {
        const dmg = HB.chimeDmg(P, f);
        f.hp -= dmg; f.flash = 0.25; f.hitShake = 0.25;
        this.fx.push({ kind: 'sparkle', x: f.x, y: f.y - 14, t: 0 });
        this.num(f.x, f.y - (f.boss ? 36 : 26), dmg, '#ffe680');
        this.elemNote(f, 'sound');
        HB.sfx('hit');
        yield 0.16;
      }
      yield 0.35;
      for (const f of targets) if (f.hp <= 0) yield* this.kill(f);
      yield* this.clearFog('종소리');
      yield 0.15;
    },

    // sound and wind blow the fog away
    *clearFog(what) {
      if (!this.fog) return;
      this.fog = 0;
      this.msg = what + '에 ' + HB.josa(this.fogName, '이가') + ' 걷혔다!';
      yield 0.6;
    },

    *heroGust(t) {
      if (t.hp <= 0) t = this.alive()[0];
      if (!t) return;
      const P = HB.party;
      P.mp -= HB.SKILLS.gust.cost;
      this.msg = HB.josa(P.name, '은는') + ' 바람결을 일으켰다!';
      HB.sfx('run');
      for (let i = 0; i < 3; i++) this.fx.push({ kind: 'slash', x: t.x - 6 + i * 6, y: t.y - 18 + i * 4, t: -i * 0.08 });
      yield 0.4;
      const dmg = HB.gustDmg(P, t, this.buff > 0);
      t.hp -= dmg; t.flash = 0.25; t.hitShake = 0.35;
      HB.sfx('hit');
      this.num(t.x, t.y - (t.boss ? 36 : 26), dmg, '#b8f0d0');
      this.elemNote(t, 'wind');
      yield 0.6;
      if (t.hp <= 0) yield* this.kill(t);
      yield* this.clearFog('바람');
      yield 0.15;
    },

    *heroRing() {
      const P = HB.party, p = this.w.player;
      P.mp -= HB.SKILLS.ring.cost;
      this.buff = HB.SKILLS.ring.buff; this.castRing = true;
      this.msg = '맑은울림이 ' + HB.josa(P.name, '을를') + ' 감쌌다! 공격이 오른다!';
      HB.sfx('chime');
      this.fx.push({ kind: 'rings', x: p.x, y: p.y - 8, t: 0 });
      this.fx.push({ kind: 'sparkle', x: p.x, y: p.y - 10, t: 0, color: '#ffd890' });
      yield 0.9;
    },

    *heroHeal() {
      const P = HB.party, p = this.w.player;
      P.mp -= HB.SKILLS.heal.cost;
      const amt = Math.min(P.maxHp - P.hp, HB.healAmt(P));
      this.msg = HB.josa(P.name, '은는') + ' 맑은 종소리로 몸을 감쌌다.';
      HB.sfx('heal');
      this.fx.push({ kind: 'sparkle', x: p.x, y: p.y - 10, t: 0, color: '#a8f0b8' });
      yield 0.4;
      P.hp += amt;
      this.num(p.x, p.y - 22, amt, '#88f0a0');
      this.msg = 'HP가 ' + amt + ' 회복되었다.';
      yield 0.7;
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
      if (HB.ITEMS[id].cure && this.silenced) { this.silenced = 0; yield 0.3; this.msg = '목소리가 돌아왔다!'; }
      yield 0.6;
    },

    // guarding is set when the command is chosen, so it covers faster foes too
    *heroGuard() {
      const P = HB.party, p = this.w.player;
      this.msg = HB.josa(P.name, '은는') + ' 몸을 낮추고 숨을 골랐다.';
      const gain = Math.min(2, P.maxMp - P.mp);
      P.mp += gain;
      HB.sfx('move');
      if (gain) this.num(p.x, p.y - 22, '울림 +' + gain, '#9ab8ff');
      yield 0.7;
    },

    *flee() {
      const P = HB.party, p = this.w.player;
      if (this.isBoss) {
        this.msg = '정적이 발을 붙잡는다. 도망칠 수 없다!';
        HB.sfx('cancel');
        yield 0.9;
        return;
      }
      if (HB.rand() < 0.7) {
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
      let intent = HB.foeIntent(f, this.turn, P, { silenced: this.silenced > 0, fog: this.fog > 0 });
      if (intent === 'fog') { // a free action: the attack still comes
        this.fogName = f.fogName || '안개'; // chapters name their own: 눈보라, 별먼지...
        this.msg = HB.josa(f.name, '이가') + ' 짙은 ' + HB.josa(this.fogName, '을를') + ' 뿜었다! (평범한 공격은 반감, 소리나 바람으로 걷어 낼 수 있다)';
        HB.sfx('vanish');
        f.hitShake = 0.4;
        this.fog = HB.FOG_TURNS;
        yield 1.3;
        intent = 'attack';
      }
      if (intent === 'silence') {
        this.msg = HB.josa(f.name, '이가') + ' 정적을 내리깔았다! 기술을 쓸 수 없다!';
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
      const pick = intent === 'attack' ? HB.foeTarget(this.allies) : 'hero';
      const tgt = pick === 'hero' ? p : pick.actor;
      if (intent === 'attack') {
        this.msg = f.name + '의 공격!' + (pick !== 'hero' && pick.covering ? ' (' + HB.josa(pick.name, '이가') + ' 막아선다)' : '');
        yield 0.2;
        yield* this.moveTo(f, tgt.x + (f.boss ? 30 : 20), tgt.y, 0.15);
      }
      if (pick === 'hero') {
        const dmg = HB.foeDmg(f, P, intent, this.guarding);
        P.hp = Math.max(0, P.hp - dmg);
        this.shake = 0.25; this.heroFlash = 0.2;
        this.num(p.x, p.y - 22, dmg, '#ff8a7a');
      }
      // the wave washes over everyone
      const hit = intent === 'wave' ? this.allies.filter((m) => m.hp > 0) : pick === 'hero' ? [] : [pick];
      for (const m of hit) {
        const d = HB.foeDmg(f, m, intent, false);
        m.hp = Math.max(0, m.hp - d);
        this.num(m.actor.x, m.actor.y - 22, d, '#ff8a7a');
        if (!m.hp) { yield 0.3; this.msg = HB.josa(m.name, '이가') + ' 쓰러졌다!'; m.actor.dir = 'down'; }
      }
      HB.sfx('hurt');
      yield 0.3;
      yield* this.moveTo(f, home.x, home.y, 0.2);
      yield 0.2;
    },

    // a companion's turn: decided by HB.allyIntent, shared with the tests
    *allyAct(a) {
      const A = a.actor, P = HB.party, p = this.w.player;
      a.covering = false;
      const i = HB.allyIntent(a, [P].concat(this.allies), this.alive(), this.silenced > 0);
      a.sang = i.act === 'song';
      if (i.act === 'song') {
        const who = i.target === P ? p : i.target.actor;
        const amt = Math.min(i.target.maxHp - i.target.hp, HB.songAmt(P.lvl));
        this.msg = a.name + '의 노래! 맑은 선율이 ' + (i.target === a ? '자신을' : HB.josa(i.target.name, '을를')) + ' 감쌌다.';
        HB.sfx('heal');
        this.fx.push({ kind: 'sparkle', x: who.x, y: who.y - 10, t: 0, color: '#c8f0ff' });
        yield 0.5;
        i.target.hp += amt;
        this.num(who.x, who.y - 22, amt, '#88f0a0');
        yield 0.6;
        return;
      }
      if (i.act === 'cover') {
        a.covering = true; a.covered = true;
        this.msg = HB.josa(a.name, '이가') + ' ' + HB.josa(P.name, '을를') + ' 감싸며 앞을 막아섰다!';
        HB.sfx('thud');
        yield* this.moveTo(A, p.x + 14, p.y - 4, 0.2, 'right');
        yield 0.6;
        return;
      }
      if (i.act === 'spell') {
        const t = i.target;
        this.msg = a.name + '의 ' + (i.el === 'wind' ? '바람 주문!' : i.el === 'sound' ? '울림 주문!' : '주문!');
        HB.sfx(i.el === 'wind' ? 'run' : 'chime');
        this.fx.push({ kind: 'rings', x: A.x, y: A.y - 8, t: 0 });
        yield 0.45;
        const dmg = HB.spellDmg(a, t, i.el);
        t.hp -= dmg; t.flash = 0.25; t.hitShake = 0.3;
        this.fx.push({ kind: 'sparkle', x: t.x, y: t.y - 14, t: 0, color: i.el === 'wind' ? '#b8f0d0' : '#ffe680' });
        this.num(t.x, t.y - (t.boss ? 36 : 26), dmg, '#d8c0ff');
        if (i.el) this.elemNote(t, i.el);
        yield 0.5;
        if (t.hp <= 0) yield* this.kill(t);
        if (i.el) yield* this.clearFog(a.name + '의 주문');
        yield 0.1;
        return;
      }
      const t = i.target, home = { x: A.x, y: A.y };
      this.msg = a.name + '의 공격!';
      yield* this.moveTo(A, t.x - 22, t.y, 0.16, 'right');
      const dmg = HB.fogged(HB.hitDmg(a.atk, t.def), this.fog > 0);
      HB.sfx('hit');
      this.fx.push({ kind: 'slash', x: t.x, y: t.y - 14, t: 0 });
      t.hp -= dmg; t.flash = 0.2; t.hitShake = 0.3;
      this.num(t.x, t.y - (t.boss ? 36 : 26), dmg, '#fff4c0');
      yield 0.3;
      yield* this.moveTo(A, home.x, home.y, 0.2, 'right');
      if (t.hp <= 0) yield* this.kill(t);
      yield 0.1;
    },

    // one round: everyone acts in speed order (HB.turnOrder); the hero's
    // turn runs the chosen action. 침묵 and 맑은울림 tick down on the hero's turn.
    *round(action) {
      this.castRing = false;
      for (const who of HB.turnOrder(HB.party, this.alive(), this.allies)) {
        if (who.isAlly) {
          if (who.hp > 0 && this.alive().length) yield* this.allyAct(who);
        } else if (who === 'hero') {
          const wasSilenced = this.silenced > 0;
          yield* action;
          if (!this.active) return; // fled
          if (wasSilenced && this.silenced > 0 && --this.silenced === 0) { this.msg = '목소리가 돌아왔다.'; yield 0.7; }
          if (this.buff > 0 && !this.castRing && --this.buff === 0) { this.msg = '맑은울림이 잦아들었다.'; yield 0.6; }
        } else if (!who.dead && who.hp > 0) {
          yield* this.foeAct(who);
          if (HB.party.hp <= 0) { yield* this.lose(); return; }
        }
        if (!this.alive().length) { yield* this.win(); return; }
      }
      this.toMenu();
    },

    *win() {
      const P = HB.party;
      HB.music.play('victory', { fadeOut: 0.1, fadeIn: 0 });
      this.msg = this.isBoss ? this.foes[0].won || '정적이 깨지고, 바람 소리가 돌아왔다!' : '모두 물리쳤다!';
      for (const f of this.foes) if (f.flag) this.w.flags[f.flag] = true;
      if (this.isBoss) HB.saveSoon();
      yield 1.2;
      const exp = this.foes.reduce((s, f) => s + f.exp, 0);
      const gold = this.foes.reduce((s, f) => s + rnd(f.gold[0], f.gold[1]), 0);
      P.exp += exp; P.gold += gold;
      for (const f of this.foes) P.kills[f.kind] = (P.kills[f.kind] || 0) + 1;
      this.msg = '경험치 ' + exp + ', ' + gold + '골드를 얻었다.';
      yield* this.waitOk();
      for (const f of this.foes) {
        if (HB.rand() >= f.drop[1]) continue;
        P.items[f.drop[0]] = (P.items[f.drop[0]] || 0) + 1;
        this.msg = HB.josa(f.name, '이가') + ' ' + HB.josa(HB.ITEMS[f.drop[0]].name, '을를') + ' 떨어뜨렸다.';
        HB.sfx('ok');
        yield* this.waitOk();
      }
      const found = P.pet && HB.petFind(P.lvl);
      if (found) {
        if (found.gold) P.gold += found.gold; else P.items[found.item] = (P.items[found.item] || 0) + 1;
        this.msg = HB.josa(HB.PETS[P.pet].name, '이가') + ' 반짝이는 것을 물어 왔다! (' + (found.gold ? found.gold + '골드' : HB.ITEMS[found.item].name) + ')';
        HB.sfx('ok');
        yield* this.waitOk();
      }
      while (P.exp >= HB.expToNext(P.lvl)) {
        P.exp -= HB.expToNext(P.lvl);
        const g = HB.levelUp(P);
        HB.sfx('fragment');
        this.msg = '레벨 ' + P.lvl + '!  HP+' + g.maxHp + '  울림+' + g.maxMp + '  공격+' + g.atk + '  방어+' + g.def + '  속도+' + g.spd;
        yield* this.waitOk();
        for (const id of HB.learnedAt(P.lvl)) {
          HB.sfx('chime');
          this.msg = HB.josa(HB.SKILLS[id].name, '을를') + ' 배웠다!  (' + HB.SKILLS[id].desc + ')';
          yield* this.waitOk();
        }
      }
      this.end(true);
    },

    *lose() {
      const P = HB.party;
      if (HB.AutoHunt) HB.AutoHunt.on = false;
      HB.music.stop(1.2);
      this.msg = HB.josa(P.name, '은는') + ' 쓰러졌다...';
      this.w.player.dir = 'down';
      yield 1.6;
      yield* this.waitOk();
      HB.fadeTo(() => {
        this.active = false;
        P.hp = P.maxHp; P.mp = P.maxMp;
        P.allies.forEach((a) => { a.hp = HB.allyStats(a.id, P.lvl).maxHp; });
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
      // companions keep their HP (and any level-up gain); a fallen one gets back up with 1
      this.allies.forEach((m, i) => {
        const max = HB.allyStats(m.id, HB.party.lvl).maxHp, saved = HB.party.allies[i];
        if (saved) saved.hp = Math.max(1, Math.min(max, m.hp + (m.hp ? max - m.maxHp : 0)));
      });
      this.allies = [];
      if (HB.Field) HB.Field.grace = 2.5;
      HB.music.play(HB.Field ? HB.Field.musicFor(w) : w.def.music, { fadeIn: 1.0, fadeOut: 0.6 });
    },

    // ---------- update ----------
    update(w, dt) {
      // keep the camera steady with optional shake
      const sh = this.shake > 0 && HB.options.shake ? Math.round((Math.random() - 0.5) * 6 * (this.shake / 0.3)) : 0;
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

      // X turns auto off at any point; the hero then waits for orders next turn
      if (this.auto && HB.input.hit('cancel')) { this.auto = this.keepAuto = false; HB.sfx('cancel'); this.msg = '자동 전투를 껐다.'; }
      if (this.phase === 'menu' && this.auto && !this.co) this.autoAct();
      else if (this.phase === 'menu') this.updateMenu();
      else if (this.phase === 'target') this.updateTarget();
      else if (this.phase === 'list') this.updateList();
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
      const inp = HB.input, P = HB.party, n = COMMANDS.length;
      if (inp.hit('up')) { this.cursor = (this.cursor + n - 1) % n; HB.sfx('move'); }
      if (inp.hit('down')) { this.cursor = (this.cursor + 1) % n; HB.sfx('move'); }
      if (!inp.hit('ok')) return;
      const id = COMMANDS[this.cursor].id;
      if (id === 'skill') {
        if (this.silenced) { HB.sfx('cancel'); this.msg = '정적 때문에 기술을 쓸 수 없다.'; return; }
        this.openList('skill', HB.skillsFor(P.lvl).map((k) => ({ id: k, label: HB.SKILLS[k].name, right: String(HB.SKILLS[k].cost), dim: P.mp < HB.SKILLS[k].cost })), '어떤 기술을 쓸까?');
      } else if (id === 'item') {
        const ids = Object.keys(P.items).filter((k) => !HB.isGear(k) && !HB.isKey(k));
        if (!ids.length) { HB.sfx('cancel'); this.msg = '가진 도구가 없다.'; return; }
        this.openList('item', ids.map((k) => ({ id: k, label: HB.ITEMS[k].name, right: 'x' + P.items[k] })), '무엇을 쓸까?');
      } else if (id === 'attack') {
        HB.sfx('ok');
        this.aim((t) => this.heroAttack(t), '누구를 공격할까?');
      } else if (id === 'auto') {
        HB.sfx('ok');
        this.auto = this.keepAuto = true;
        this.autoAct();
      } else {
        HB.sfx('ok');
        if (id === 'guard') this.guarding = true;
        this.run(this.round(id === 'guard' ? this.heroGuard() : this.flee()));
      }
    },

    // auto battle: the same picks the balance tests play with (HB.autoPick)
    autoAct() {
      const alive = this.alive();
      const pick = HB.autoPick(HB.party, alive, { silenced: this.silenced > 0, buff: this.buff, fog: this.fog > 0, waveNext: alive.some((f) => HB.waveNext(f, this.turn)) });
      const t = pick.target || alive[0];
      if (pick.act === 'guard') { this.guarding = true; this.run(this.round(this.heroGuard())); }
      else if (pick.act === 'item') this.run(this.round(this.heroItem(pick.id)));
      else if (pick.act === 'skill') {
        const id = pick.id;
        this.run(this.round(id === 'gust' ? this.heroGust(t) : id === 'chime' ? this.heroChime() : id === 'heal' ? this.heroHeal() : this.heroRing()));
      } else this.run(this.round(this.heroAttack(t)));
    },

    openList(kind, list, msg) {
      HB.sfx('ok');
      this.phase = 'list'; this.listKind = kind; this.list = list; this.listCursor = 0; this.msg = msg;
    },

    // pick a target (skipped when only one foe is left), then run the round
    aim(make, msg) {
      const alive = this.alive();
      if (alive.length === 1) { this.run(this.round(make(alive[0]))); return; }
      this.phase = 'target'; this.target = 0; this.msg = msg; this.pending = make;
    },

    updateList() {
      const inp = HB.input, n = this.list.length;
      if (inp.hit('up')) { this.listCursor = (this.listCursor + n - 1) % n; HB.sfx('move'); }
      if (inp.hit('down')) { this.listCursor = (this.listCursor + 1) % n; HB.sfx('move'); }
      if (inp.hit('cancel')) { HB.sfx('cancel'); this.phase = 'menu'; this.msg = ''; return; }
      if (!inp.hit('ok')) return;
      const e = this.list[this.listCursor];
      if (e.dim) { HB.sfx('cancel'); this.msg = '울림이 부족하다.'; return; }
      HB.sfx('ok');
      if (this.listKind === 'item') { this.run(this.round(this.heroItem(e.id))); return; }
      if (e.id === 'gust') { this.aim((t) => this.heroGust(t), '누구에게 바람을 보낼까?'); return; }
      this.run(this.round(e.id === 'chime' ? this.heroChime() : e.id === 'heal' ? this.heroHeal() : this.heroRing()));
    },

    updateTarget() {
      const inp = HB.input, alive = this.alive();
      if (inp.hit('up') || inp.hit('left')) { this.target = (this.target + alive.length - 1) % alive.length; HB.sfx('move'); }
      if (inp.hit('down') || inp.hit('right')) { this.target = (this.target + 1) % alive.length; HB.sfx('move'); }
      if (inp.hit('cancel')) { HB.sfx('cancel'); this.phase = 'menu'; this.msg = ''; return; }
      if (inp.hit('ok')) { HB.sfx('ok'); this.run(this.round(this.pending(alive[this.target]))); }
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
      if (this.distort > 0 && HB.options.flash) {
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

      // fog veil while it lasts
      if (this.fog > 0) {
        g.fillStyle = 'rgba(220,228,240,0.28)'; g.fillRect(0, 0, HB.W, HB.H);
        for (let k = 0; k < 5; k++) {
          const fx = ((HB.time * 14 + k * 113) % (HB.W + 160)) - 80, fy = 60 + k * 34;
          g.fillStyle = 'rgba(240,244,250,0.18)';
          g.beginPath(); g.ellipse(fx, fy, 80, 18, 0, 0, Math.PI * 2); g.fill();
        }
      }
      this.drawEffects(g, cam);
      if (this.flash > 0 && HB.options.flash) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, this.flash * 8).toFixed(2) + ')'; g.fillRect(0, 0, HB.W, HB.H); }

      // boss HP bar
      for (const f of this.foes) {
        if (!f.boss || f.dead) continue;
        const x = Math.round(f.x - cam.x) - 24, y = Math.round(f.y - cam.y) - 60;
        g.fillStyle = '#0a0a1a'; g.fillRect(x - 1, y - 1, 50, 5);
        g.fillStyle = '#2a2a48'; g.fillRect(x, y, 48, 3);
        g.fillStyle = f.hp / f.maxHp < 0.5 ? '#ff7a6a' : '#e0a0ff';
        g.fillRect(x, y, Math.round(48 * Math.max(0, f.hp) / f.maxHp), 3);
      }

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
      HB.drawWindow(g, 6, 82, 116, 92);
      const active = this.phase === 'menu' && !this.auto;
      if (this.auto) HB.text(g, '자동 전투 중 · X로 끄기', 8, 70, '#ffe08a', { font: 'g9' });
      COMMANDS.forEach((c, i) => {
        const cx = 22, cy = 89 + i * 14;
        const poor = (c.id === 'skill' && this.silenced) || (c.id === 'flee' && this.isBoss);
        HB.text(g, c.label, cx, cy, !active ? '#8a8aa8' : poor ? '#9a90b0' : '#f4f0e8');
        if (active && i === this.cursor) HB.drawCursor(g, cx - 10, cy + 3);
      });
      if (this.phase === 'list') {
        const h = this.list.length * 16 + 10, y = 80 - h;
        HB.drawWindow(g, 6, y, 116, h);
        this.list.forEach((e, i) => {
          HB.text(g, e.label, 22, y + 6 + i * 16, e.dim ? '#8a8aa8' : '#f4f0e8');
          HB.text(g, e.right, 112, y + 7 + i * 16, this.listKind === 'skill' ? '#9ab8ff' : '#c8c0e0', { font: 'g9', align: 'right' });
          if (i === this.listCursor) HB.drawCursor(g, 12, y + 9 + i * 16);
        });
      }
      const n = this.allies.length, ah = n ? 6 + n * 11 : 0, ay = 127 - ah;
      const marks = (this.fog ? this.fogName + ' ' + this.fog + '  ' : '') + (this.silenced ? '침묵 ' + this.silenced + '  ' : '') + (this.buff ? '공격↑ ' + this.buff : '');
      if (marks) HB.text(g, marks, 300, ay - 12, '#c8a0ff', { font: 'g9', align: 'right' });
      if (n) HB.drawWindow(g, 126, ay, 188, ah);
      this.allies.forEach((a, i) => {
        const y = ay + 3 + i * 11, w = Math.round(80 * a.hp / a.maxHp);
        HB.text(g, a.name + (a.covering ? ' 막기' : ''), 136, y, a.hp ? '#c8f0ff' : '#8a8aa8', { font: 'g9' });
        g.fillStyle = '#0a0a1a'; g.fillRect(179, y + 4, 82, 5);
        g.fillStyle = '#2a2a48'; g.fillRect(180, y + 5, 80, 3);
        g.fillStyle = a.hp / a.maxHp < 0.3 ? '#ff7a6a' : '#7ae08a'; g.fillRect(180, y + 5, w, 3);
        HB.text(g, a.hp + '/' + a.maxHp, 304, y, '#f4f0e8', { font: 'g9', align: 'right' });
      });
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
