// Hourbell core: screen, loop, input, scene manager, utilities.
window.HB = window.HB || {};
(function (HB) {
  'use strict';

  const W = 480, H = 270;
  HB.W = W; HB.H = H;

  // ---------- screen ----------
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const g = buf.getContext('2d');
  g.imageSmoothingEnabled = false;
  HB.g = g;

  // touch screens get the D-pad and A / B buttons (src/touch.js): in landscape
  // they sit beside the game, in portrait below it, so the game fits the room
  // left over. Phones use any scale to fill it; PCs, tablets and big screens
  // keep whole-number pixels.
  HB.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const SIDE = 160, BELOW = 170; // css px the controls take (see touch.js)
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    let aw = vw, ah = vh;
    if (HB.isTouch) { if (vw >= vh) aw -= 2 * SIDE; else ah -= BELOW + vh * 0.12; } // 0.12: index.html portrait top padding
    const fit = Math.max(0.1, Math.min(aw * dpr / W, ah * dpr / H));
    const phone = HB.isTouch && Math.min(vw, vh) < 600 && window.matchMedia('(pointer: coarse)').matches;
    const s = Math.max(1, phone ? Math.ceil(fit) : Math.floor(fit));
    // phones: exactly the fit. Elsewhere whole pixels, and below 1x (tiny
    // windows) shrink the canvas instead of overflowing
    const css = (phone ? fit : Math.min(1, fit) * s) / dpr;
    canvas.width = W * s;
    canvas.height = H * s;
    canvas.style.width = (W * css) + 'px';
    canvas.style.height = (H * css) + 'px';
    ctx.imageSmoothingEnabled = false;
    HB.scale = s;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- input ----------
  // key code -> action. Players can rebind (options > 키 설정); kept in localStorage
  HB.DEFAULT_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok',
    KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel',
    KeyQ: 'auto'
  };
  HB.ACTIONS = ['up', 'down', 'left', 'right', 'ok', 'cancel', 'auto'];
  // a stored map is used only if every action still has a key
  const usable = (m) => !!m && typeof m === 'object' && HB.ACTIONS.every((a) => Object.values(m).includes(a)) && Object.values(m).every((a) => HB.ACTIONS.includes(a));
  let KEYMAP = Object.assign({}, HB.DEFAULT_KEYS);
  try { const k = JSON.parse(window.localStorage.getItem('hourbell.keys')); if (usable(k)) KEYMAP = k; } catch (e) { /* defaults */ }
  HB.keymap = () => KEYMAP;
  HB.setKeys = function (m) {
    if (!usable(m)) return false;
    KEYMAP = m;
    try { window.localStorage.setItem('hourbell.keys', JSON.stringify(m)); } catch (e) { /* lasts this session */ }
    return true;
  };
  const input = { down: {}, pressed: {}, any: false };
  input.isDown = (a) => !!input.down[a];
  input.hit = (a) => !!input.pressed[a];
  input.press = (a) => { if (!input.down[a]) input.pressed[a] = true; input.down[a] = true; input.any = true; };
  input.release = (a) => { input.down[a] = false; };
  window.addEventListener('keydown', (e) => {
    // options > 키 설정 is waiting for a key: it takes this one and nothing else happens
    if (HB.captureKey) { e.preventDefault(); const cb = HB.captureKey; HB.captureKey = null; cb(e.code); return; }
    if (HB.paused) { HB.paused = false; e.preventDefault(); HB.onUserGesture && HB.onUserGesture(); return; } // the key that resumes does nothing else
    const a = KEYMAP[e.code];
    if (a) { e.preventDefault(); input.press(a); }
    HB.onUserGesture && HB.onUserGesture();
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) input.release(a);
  });
  // pause when the window loses focus; any key, click or touch resumes
  HB.paused = false;
  window.addEventListener('blur', () => { input.down = {}; HB.paused = true; });
  window.addEventListener('pointerdown', () => { HB.paused = false; });
  HB.input = input;

  // ---------- utilities ----------
  HB.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  HB.lerp = (a, b, t) => a + (b - a) * t;
  HB.hash2 = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  HB.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  HB.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  };
  // '#rrggbb' -> shaded '#rrggbb' (amt -1..1)
  HB.shade = function (hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    r = f(r); gg = f(gg); b = f(b);
    return '#' + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
  };

  // ---------- scenes & fades ----------
  let scene = null;
  let fade = null; // {t, dur, dir, color, cb}
  HB.time = 0; // seconds
  HB.frame = 0;

  HB.setScene = function (s, arg) {
    if (scene && scene.exit) scene.exit();
    scene = s;
    if (scene.enter) scene.enter(arg);
  };
  HB.getScene = () => scene;

  // fade out -> cb() -> fade in
  HB.fadeTo = function (cb, opts) {
    opts = opts || {};
    if (fade) return;
    fade = { t: 0, dur: opts.dur || 0.45, dir: 1, color: opts.color || '#000', cb };
  };
  HB.isFading = () => !!fade;

  // ---------- loop ----------
  // a thrown error must not freeze the game: it goes to the console, the next
  // frame still comes, and an error repeating every frame gets a note on screen
  // count: how many times the most repeated error has come up in a row
  const err = { seen: {}, count: 0, quiet: 0 };
  HB.loopError = err;
  function report(e) {
    const msg = String((e && e.message) || e);
    const n = err.seen[msg] = (err.seen[msg] || 0) + 1;
    if (n === 1) console.error('게임 오류: ' + msg, e);
    else if (n % 600 === 0) console.error('같은 오류가 ' + n + '번 반복됨: ' + msg);
    err.count = Math.max(err.count, n);
    err.quiet = 0;
  }

  const STEP = 1 / 60;
  let last = performance.now(), acc = 0;
  function tick(now) {
    requestAnimationFrame(tick); // first, so nothing below can stop the loop
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    try { if (HB.pollPads) HB.pollPads(); } catch (e) { report(e); } // src/gamepad.js
    acc += dt;
    if (HB.paused) acc = 0;
    while (acc >= STEP) {
      try { update(STEP); } catch (e) { report(e); }
      acc -= STEP;
    }
    try { render(); } catch (e) { report(e); }
    err.quiet += dt;
    if (err.quiet > 1) { err.seen = {}; err.count = 0; }
  }
  function update(dt) {
    HB.time += dt;
    HB.frame++;
    if (fade) {
      fade.t += dt;
      if (fade.dir === 1 && fade.t >= fade.dur) {
        const cb = fade.cb;
        fade.dir = -1; fade.t = 0; // first: a callback that throws must not run again every frame
        if (cb) cb();
      } else if (fade.dir === -1 && fade.t >= fade.dur) {
        fade = null;
      }
    }
    try {
      if (scene && scene.update) scene.update(dt, !!fade);
    } finally { input.pressed = {}; } // a throw must not leave a key pressed every frame
  }
  function render() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    try {
      if (scene && scene.draw) scene.draw(g);
    } catch (e) {
      report(e);
      // the draw may have left save()s without restore(): start the buffer clean
      if (g.reset) g.reset(); else for (let i = 0; i < 64; i++) g.restore();
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.imageSmoothingEnabled = false;
    }
    if (fade) {
      const p = HB.clamp(fade.t / fade.dur, 0, 1);
      const a = fade.dir === 1 ? p : 1 - p;
      // stepped fade for a retro feel
      g.globalAlpha = Math.round(a * 6) / 6;
      g.fillStyle = fade.color;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    if (HB.paused) {
      g.fillStyle = 'rgba(10,8,24,0.6)'; g.fillRect(0, 0, W, H);
      HB.text(g, '일시정지', W / 2, H / 2 - 12, '#fff4d8', { align: 'center' });
      HB.text(g, '아무 키나 누르거나 화면을 누르면 계속', W / 2, H / 2 + 6, '#c8c0e0', { align: 'center', font: 'g9' });
    }
    if (err.count >= 30) {
      g.fillStyle = 'rgba(60,10,20,0.85)'; g.fillRect(2, 2, 236, 14);
      HB.text(g, '오류가 반복되고 있어요. 새로고침해 주세요.', 6, 4, '#ffd0d0', { font: 'g9' });
    }
    ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
  }
  HB.start = function () { requestAnimationFrame(tick); };
})(window.HB);
