// Chiptune audio: a tiny Web Audio synth, a step sequencer with an
// SNES-style echo bus, crossfading music, and sound effects.
(function (HB) {
  'use strict';

  let ac = null, master, musicBus, sfxBus, echoIn;
  const waves = {};
  let noiseBuf = null;
  let muted = false;

  // ---------- setup ----------
  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.8;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);

    musicBus = ac.createGain(); musicBus.gain.value = 0.55 * HB.options.music / 10; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.7 * HB.options.sfx / 10; sfxBus.connect(master);

    // echo: the warm, roomy tail SNES soundtracks were known for
    echoIn = ac.createGain(); echoIn.gain.value = 0.22;
    const delay = ac.createDelay(1); delay.delayTime.value = 0.27;
    const fb = ac.createGain(); fb.gain.value = 0.32;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
    lp.connect(master);

    [0.125, 0.25, 0.5].forEach((d) => { waves[d] = pulseWave(d); });
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    if (pending) { const p = pending; pending = null; music.play(p.name, p.opts); }
  }
  HB.onUserGesture = function () {
    if (!ac) init();
    else if (ac.state === 'suspended') ac.resume();
  };
  window.addEventListener('pointerdown', () => HB.onUserGesture());

  function pulseWave(duty) {
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    return ac.createPeriodicWave(re, im);
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNote(s) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    if (!m) throw new Error('bad note ' + s);
    return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
  }

  // ---------- instruments ----------
  function env(gain, t, a, peak, d, sus, len, r) {
    const g = gain.gain;
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.setTargetAtTime(peak * sus, t + a, d);
    g.setTargetAtTime(0.0001, t + Math.max(len, a), r);
  }

  function tone(dest, t, freq, len, o) {
    const osc = ac.createOscillator();
    if (o.wave === 'tri') osc.type = 'triangle';
    else if (o.wave === 'sine') osc.type = 'sine';
    else osc.setPeriodicWave(waves[o.duty || 0.25]);
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + len);
    const g = ac.createGain();
    let node = osc;
    if (o.lp) {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(dest);
    if (o.echo) g.connect(echoIn);
    env(g, t, o.a || 0.005, o.vol, o.d || 0.1, o.sus === undefined ? 0.6 : o.sus, len, o.r || 0.05);
    if (o.vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(len, 0.35));
      l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(t + len + 0.6);
    }
    osc.start(t); osc.stop(t + len + (o.r || 0.05) * 6 + 0.05);
  }

  function noise(dest, t, len, o) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.value = o.freq || 6000;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + len);
    const g = ac.createGain();
    src.connect(f); f.connect(g); g.connect(dest);
    if (o.echo) g.connect(echoIn);
    g.gain.setValueAtTime(o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.start(t, Math.random() * 0.5); src.stop(t + len + 0.02);
  }

  // bell: inharmonic sine partials with a long decay
  function bell(dest, t, freq, vol, len) {
    [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.18], [8.93, 0.08]].forEach(([ratio, amp], i) => {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len / (1 + i * 0.6));
      o.connect(g); g.connect(dest); g.connect(echoIn);
      o.start(t); o.stop(t + len + 0.1);
    });
  }

  const INST = {
    lead: (d, t, f, len, v) => tone(d, t, f, len, { duty: 0.25, vol: 0.13 * v, vib: 14, echo: true, sus: 0.7 }),
    soft: (d, t, f, len, v) => tone(d, t, f, len, { duty: 0.5, lp: 1900, vol: 0.13 * v, a: 0.03, vib: 10, echo: true, sus: 0.75, r: 0.12 }),
    box: (d, t, f, len, v) => { tone(d, t, f, len, { wave: 'sine', vol: 0.16 * v, d: 0.25, sus: 0.15, echo: true, r: 0.3 }); tone(d, t, f * 2, len, { wave: 'tri', vol: 0.04 * v, d: 0.08, sus: 0.05, r: 0.1 }); },
    harp: (d, t, f, len, v) => tone(d, t, f, len, { duty: 0.125, vol: 0.06 * v, d: 0.09, sus: 0.2, echo: true, r: 0.08 }),
    pad: (d, t, f, len, v) => tone(d, t, f, len, { wave: 'tri', vol: 0.05 * v, a: 0.25, d: 0.5, sus: 0.8, r: 0.4, echo: true }),
    bass: (d, t, f, len, v) => tone(d, t, f, len, { wave: 'tri', vol: 0.3 * v, d: 0.12, sus: 0.55, r: 0.04 }),
    kick: (d, t, f, len, v) => tone(d, t, 150, 0.12, { wave: 'sine', vol: 0.5 * v, slide: 0.3, d: 0.05, sus: 0.1, r: 0.03 }),
    snare: (d, t, f, len, v) => { noise(d, t, 0.14, { vol: 0.16 * v, freq: 1800, echo: true }); tone(d, t, 220, 0.05, { wave: 'tri', vol: 0.12 * v, slide: 0.5, sus: 0.1 }); },
    hat: (d, t, f, len, v) => noise(d, t, 0.035, { vol: 0.05 * v, freq: 8000 }),
    bell: (d, t, f, len, v) => bell(d, t, f, 0.1 * v, 2.4)
  };

  // ---------- song building ----------
  // "F#5:2 E5 D5 A4:2" -> durations in eighth notes (default 1), r = rest
  function seq(str, octShift) {
    const out = []; let pos = 0;
    str.trim().split(/\s+/).forEach((tok) => {
      if (tok === '|') return;
      const [n, d] = tok.split(':');
      const len = d ? parseFloat(d) : 1;
      if (n !== 'r') out.push({ at: pos, len, midi: parseNote(n) + (octShift || 0) * 12 });
      pos += len;
    });
    return { notes: out, length: pos };
  }

  const THEME_A = 'F#5:2 E5 D5 A4:2 D5:2 | E5:3 F#5 E5:2 r:2 | G5:2 F#5 E5 B4:2 E5:2 | F#5:6 r:2 | ' +
    'A5:2 G5 F#5 D5:2 G5:2 | F#5:3 E5 D5:2 B4:2 | C#5:2 D5 E5 A5:2 G5 E5 | D5:6 r:2';
  const THEME_B = 'B4:2 D5 F#5 B5:2 A5:2 | G5:3 F#5 E5:2 D5:2 | E5:2 F#5 G5 A5:2 D5:2 | F#5:6 r:2 | ' +
    'B4:2 C#5 D5 E5:2 F#5:2 | G5:3 A5 F#5:2 D5:2 | E5:2 E5 F#5 E5:2 C#5:2 | D5:6 r:2';
  const CH_A = ['D', 'A', 'Em', 'D', 'G', 'Bm', 'A', 'D'];
  const CH_B = ['Bm', 'G', 'A', 'D', 'Em', 'D', 'A', 'D'];
  const CHORDS = {
    D: [50, 54, 57], A: [45, 49, 52], Em: [52, 55, 59], G: [43, 47, 50], Bm: [47, 50, 54],
    Dm: [50, 53, 57], Am: [45, 48, 52], Gm: [43, 46, 50], Bb: [46, 50, 53], C: [48, 52, 55]
  };

  // parallel-minor version of the theme for battle (keeps the leading tone)
  function toMinor(str) {
    return str.replace(/F#/g, 'F').replace(/B(\d)/g, 'Bb$1');
  }

  function Song(def) { Object.assign(this, def); this.events = []; }
  Song.prototype.add = function (inst, notes, startEighth, vel) {
    for (const n of notes) this.events.push({ inst, step: (startEighth + n.at) * 2, len: n.len, midi: n.midi, vel: vel || 1 });
    return this;
  };
  Song.prototype.hits = function (inst, pattern, bars, vel, startBar) {
    // pattern: 16 chars per bar, x = hit, o = soft hit
    for (let b = 0; b < bars; b++) for (let i = 0; i < 16; i++) {
      const c = pattern[i % pattern.length];
      if (c === 'x' || c === 'o') this.events.push({ inst, step: ((startBar || 0) + b) * 16 + i, len: 0.5, midi: 60, vel: (vel || 1) * (c === 'o' ? 0.5 : 1) });
    }
    return this;
  };
  Song.prototype.finalize = function () {
    this.events.sort((a, b) => a.step - b.step);
    if (!this.steps) this.steps = Math.max(...this.events.map((e) => e.step)) + 1;
    return this;
  };

  function chordsTo(song, chords, startBar, fn) {
    chords.forEach((name, i) => fn(CHORDS[name], (startBar + i) * 8));
  }

  // ---------- songs ----------
  const SONGS = {
    title() {
      const s = new Song({ bpm: 66, loop: true, steps: 16 * 8 });
      s.add('box', seq(THEME_A, 1).notes, 0, 0.9);
      chordsTo(s, CH_A, 0, (c, at) => {
        c.forEach((m) => s.events.push({ inst: 'pad', step: at * 2, len: 8, midi: m + 12, vel: 0.9 }));
        s.events.push({ inst: 'bass', step: at * 2, len: 7.5, midi: c[0] - 12, vel: 0.5 });
      });
      s.events.push({ inst: 'bell', step: 0, len: 4, midi: 62, vel: 1 });
      return s.finalize();
    },
    town() {
      const s = new Song({ bpm: 84, loop: true, steps: 16 * 16 });
      s.add('soft', seq(THEME_A).notes, 0);
      s.add('soft', seq(THEME_B).notes, 64);
      chordsTo(s, CH_A.concat(CH_B), 0, (c, at) => {
        const arp = [c[0], c[1] + 12, c[2] + 12, c[1] + 12, c[0] + 12, c[2] + 12, c[1] + 12, c[2]];
        arp.forEach((m, i) => s.events.push({ inst: 'harp', step: (at + i) * 2, len: 0.9, midi: m + 12, vel: 0.9 }));
        s.events.push({ inst: 'bass', step: at * 2, len: 3.5, midi: c[0] - 12, vel: 0.8 });
        s.events.push({ inst: 'bass', step: (at + 4) * 2, len: 3.5, midi: c[2] - 12, vel: 0.65 });
      });
      return s.finalize();
    },
    field() {
      const s = new Song({ bpm: 128, loop: true, steps: 16 * 16 });
      s.add('lead', seq(THEME_A).notes, 0);
      s.add('lead', seq(THEME_B).notes, 64);
      chordsTo(s, CH_A.concat(CH_B), 0, (c, at) => {
        for (let i = 0; i < 16; i++) {
          const m = [c[0], c[1], c[2], c[1] + 12][i % 4] + 12;
          s.events.push({ inst: 'harp', step: at * 2 + i, len: 0.4, midi: m + (i >= 8 ? 12 : 0), vel: 0.75 });
        }
        for (let i = 0; i < 8; i++) s.events.push({ inst: 'bass', step: (at + i) * 2, len: 0.8, midi: c[0] - 12 + (i % 2 ? 12 : 0), vel: 0.85 });
      });
      s.hits('kick', 'x.......x.......', 16);
      s.hits('snare', '....x.......x...', 16, 0.8);
      s.hits('hat', 'o.x.o.x.o.x.o.x.', 16);
      return s.finalize();
    },
    // the field theme once the first bell fragment is back: bells answer the melody
    fieldBell() {
      const s = SONGS.field();
      chordsTo(s, CH_A.concat(CH_B), 0, (c, at) => {
        s.events.push({ inst: 'bell', step: at * 2, len: 4, midi: c[0] + 24, vel: 0.55 });
        s.events.push({ inst: 'bell', step: (at + 6) * 2, len: 2, midi: c[2] + 24, vel: 0.3 });
      });
      return s.finalize();
    },
    battle() {
      const intro = 16; // one bar of pickup, played once
      const s = new Song({ bpm: 156, loop: true, loopFrom: intro, steps: intro + 16 * 16 });
      const A = toMinor(THEME_A), B = toMinor(THEME_B).replace('Bb4:2 C#5', 'Bb4:2 C5');
      s.add('lead', seq(A).notes, 8, 1.1);
      s.add('lead', seq(B).notes, 72, 1.1);
      const ch = ['Dm', 'Am', 'Gm', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'C', 'Dm', 'A', 'Dm'];
      // pickup bar: driving bass and a snare roll
      for (let i = 0; i < 16; i++) s.events.push({ inst: 'bass', step: i, len: 0.4, midi: 38 + (i % 4 === 3 ? 12 : 0), vel: 0.9 });
      s.hits('snare', '....x...x.x.xxxx', 1, 0.7);
      ch.forEach((name, b) => {
        const c = CHORDS[name], base = intro + b * 16;
        for (let i = 0; i < 16; i++) {
          s.events.push({ inst: 'bass', step: base + i, len: 0.4, midi: c[0] - 12 + (i % 4 === 2 ? 12 : 0), vel: 0.9 });
          s.events.push({ inst: 'harp', step: base + i, len: 0.35, midi: [c[0], c[2], c[1] + 12, c[2]][i % 4] + 12, vel: 0.65 });
        }
      });
      s.hits('kick', 'x.....x.x.......', 16, 1, 1);
      s.hits('snare', '....x.......x..o', 16, 0.9, 1);
      s.hits('hat', 'x.o.x.o.x.o.x.ox', 16, 1, 1);
      return s.finalize();
    },
    // the battle theme a semitone down and faster, for the shrine guardian
    boss() {
      const s = SONGS.battle();
      s.bpm = 168;
      s.events.forEach((e) => { e.midi -= 1; });
      return s;
    },
    victory() {
      const s = new Song({ bpm: 140, loop: false, steps: 40 });
      const run = seq('D5:0.5 F#5:0.5 A5:0.5 D6:0.5 F#6:2 E6 D6 A6:6');
      s.add('lead', run.notes, 0, 1.1);
      s.add('harp', seq('D5:0.5 F#5:0.5 A5:0.5 D6:0.5 D6:2 C#6 B5 F#6:6').notes, 0, 1);
      [[0, 'D'], [8, 'A'], [12, 'D']].forEach(([at, n]) => CHORDS[n].forEach((m) => s.events.push({ inst: 'pad', step: at * 2 + 4, len: at === 12 ? 6 : 2, midi: m + 12, vel: 1.4 })));
      s.events.push({ inst: 'bass', step: 4, len: 2, midi: 38, vel: 1 });
      s.events.push({ inst: 'bass', step: 12, len: 1, midi: 33, vel: 1 });
      s.events.push({ inst: 'bass', step: 16, len: 6, midi: 38, vel: 1 });
      s.events.push({ inst: 'bell', step: 16, len: 4, midi: 74, vel: 0.8 });
      return s.finalize();
    }
  };
  const songCache = {};
  // chapter files add songs to HB.SONG_DEFS as (kit) => Song, built from the same theme
  const kit = () => ({ Song, seq, THEME_A, THEME_B, CH_A, CH_B, CHORDS, chordsTo, toMinor, SONGS });
  function getSong(name) {
    return songCache[name] || (songCache[name] = SONGS[name] ? SONGS[name]() : HB.SONG_DEFS[name](kit()));
  }

  // ---------- player ----------
  let pending = null;
  let current = null; // {name, song, gain, step, next, timer}

  function startTrack(name, opts) {
    const song = getSong(name);
    const gain = ac.createGain();
    gain.connect(musicBus);
    const fadeIn = opts.fadeIn === undefined ? 0.5 : opts.fadeIn;
    const t0 = ac.currentTime + 0.05;
    gain.gain.setValueAtTime(fadeIn ? 0.0001 : 1, t0);
    if (fadeIn) gain.gain.linearRampToValueAtTime(1, t0 + fadeIn);
    const tr = { name, song, gain, step: 0, next: t0, idx: 0, onEnd: opts.onEnd, done: false };
    const stepDur = 60 / song.bpm / 4;
    tr.timer = setInterval(() => {
      if (tr.done) return;
      while (tr.next < ac.currentTime + 0.15) {
        while (tr.idx < song.events.length && song.events[tr.idx].step === tr.step) {
          const e = song.events[tr.idx++];
          INST[e.inst](gain, tr.next, mtof(e.midi), e.len * stepDur * 2 * 0.92, e.vel);
        }
        while (tr.idx < song.events.length && song.events[tr.idx].step < tr.step) tr.idx++;
        tr.step++; tr.next += stepDur;
        if (tr.step >= song.steps) {
          if (song.loop) {
            tr.step = song.loopFrom || 0;
            tr.idx = song.events.findIndex((e) => e.step >= tr.step);
            if (tr.idx < 0) tr.idx = song.events.length;
          } else {
            tr.done = true;
            const wait = (tr.next - ac.currentTime) * 1000 + 600;
            setTimeout(() => { stopTrack(tr, 0.4); if (tr.onEnd) tr.onEnd(); }, wait);
            break;
          }
        }
      }
    }, 25);
    return tr;
  }
  function stopTrack(tr, fade) {
    if (!tr || tr.stopped) return;
    tr.stopped = true;
    clearInterval(tr.timer);
    const t = ac.currentTime;
    tr.gain.gain.cancelScheduledValues(t);
    tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
    tr.gain.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.05));
    setTimeout(() => tr.gain.disconnect(), ((fade || 0.05) + 3) * 1000);
  }

  const music = {
    play(name, opts) {
      opts = opts || {};
      if (!name) return;
      if (!ac) { pending = { name, opts }; return; }
      if (current && current.name === name && !current.stopped && !opts.restart) return;
      stopTrack(current, opts.fadeOut === undefined ? 0.6 : opts.fadeOut);
      current = startTrack(name, opts);
    },
    stop(fade) { if (ac) stopTrack(current, fade); current = null; pending = null; },
    get name() { return current && !current.stopped ? current.name : null; }
  };
  HB.music = music;

  // ---------- sound effects ----------
  const SFX = {
    blip(t) { tone(sfxBus, t, 740 + Math.random() * 60, 0.025, { duty: 0.5, vol: 0.05, d: 0.02, sus: 0.5, r: 0.01 }); },
    narrate(t) { tone(sfxBus, t, 520, 0.03, { wave: 'tri', vol: 0.08, d: 0.03, sus: 0.4, r: 0.01 }); },
    tick(t) { tone(sfxBus, t, 1320, 0.02, { duty: 0.125, vol: 0.06, sus: 0.3, r: 0.01 }); },
    move(t) { tone(sfxBus, t, 990, 0.03, { duty: 0.25, vol: 0.07, sus: 0.3, r: 0.01 }); },
    ok(t) { tone(sfxBus, t, 880, 0.04, { duty: 0.25, vol: 0.08, sus: 0.5 }); tone(sfxBus, t + 0.05, 1320, 0.06, { duty: 0.25, vol: 0.08, sus: 0.5 }); },
    cancel(t) { tone(sfxBus, t, 660, 0.04, { duty: 0.25, vol: 0.07 }); tone(sfxBus, t + 0.05, 440, 0.06, { duty: 0.25, vol: 0.07 }); },
    start(t) { [62, 66, 69, 74].forEach((m, i) => tone(sfxBus, t + i * 0.06, mtof(m + 12), 0.12, { duty: 0.25, vol: 0.07, echo: true })); bell(sfxBus, t + 0.25, mtof(62), 0.14, 3); },
    bell(t) { bell(sfxBus, t, mtof(50), 0.16, 3.5); },
    thud(t) { noise(sfxBus, t, 0.25, { vol: 0.18, type: 'lowpass', freq: 260 }); tone(sfxBus, t, 70, 0.2, { wave: 'sine', vol: 0.2, slide: 0.6, sus: 0.2 }); },
    step(t) { noise(sfxBus, t, 0.05, { vol: 0.05, type: 'lowpass', freq: 900 }); },
    encounter(t) {
      noise(sfxBus, t, 0.5, { vol: 0.12, type: 'bandpass', freq: 400, sweep: 5000 });
      tone(sfxBus, t, 220, 0.45, { duty: 0.125, vol: 0.07, slide: 4, sus: 0.9 });
    },
    hit(t) { noise(sfxBus, t, 0.12, { vol: 0.2, freq: 1200 }); tone(sfxBus, t, 300, 0.1, { duty: 0.5, vol: 0.09, slide: 0.4 }); },
    hurt(t) { noise(sfxBus, t, 0.2, { vol: 0.2, type: 'lowpass', freq: 1400 }); tone(sfxBus, t, 180, 0.18, { duty: 0.25, vol: 0.1, slide: 0.5 }); },
    chime(t) { [74, 78, 81, 86, 90].forEach((m, i) => bell(sfxBus, t + i * 0.07, mtof(m), 0.05, 1.4)); },
    heal(t) { [69, 73, 76, 81].forEach((m, i) => tone(sfxBus, t + i * 0.07, mtof(m), 0.1, { wave: 'tri', vol: 0.1, echo: true })); },
    run(t) { [72, 67, 64, 60].forEach((m, i) => tone(sfxBus, t + i * 0.05, mtof(m), 0.05, { duty: 0.5, vol: 0.06 })); },
    vanish(t) { noise(sfxBus, t, 0.6, { vol: 0.12, type: 'bandpass', freq: 3000, sweep: 200 }); tone(sfxBus, t, 880, 0.5, { duty: 0.125, vol: 0.06, slide: 0.2 }); },
    // the three grove chimes (low, mid, high)
    ding0(t) { bell(sfxBus, t, mtof(62), 0.14, 2.4); },
    ding1(t) { bell(sfxBus, t, mtof(69), 0.13, 2.2); },
    ding2(t) { bell(sfxBus, t, mtof(78), 0.12, 2.0); },
    fragment(t) { [62, 69, 74, 78, 81].forEach((m, i) => bell(sfxBus, t + i * 0.12, mtof(m + 12), 0.08, 2.4)); }
  };
  HB.sfx = function (name) {
    if (!ac || muted || !SFX[name]) return;
    SFX[name](ac.currentTime + 0.01);
  };

  HB.setVolume = function () {
    if (!ac) return; // init() reads HB.options
    musicBus.gain.setTargetAtTime(0.55 * HB.options.music / 10, ac.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(0.7 * HB.options.sfx / 10, ac.currentTime, 0.05);
  };
  // silent while the game is paused (window blurred) or the tab is hidden;
  // the key or tap that unpauses calls HB.onUserGesture, which resumes
  window.addEventListener('blur', () => { if (ac) ac.suspend(); });
  document.addEventListener('visibilitychange', () => { if (ac && document.hidden) ac.suspend(); });

  HB.toggleMute = function () {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05);
    return muted;
  };
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') HB.toggleMute(); });

  HB.audio = { init, get ctx() { return ac; }, seq, parseNote };
})(window.HB);
