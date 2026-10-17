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

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const availW = window.innerWidth * dpr, availH = window.innerHeight * dpr;
    const fit = Math.min(availW / W, availH / H);
    const s = Math.max(1, Math.floor(fit));
    // below 1x (tiny windows) shrink the canvas instead of overflowing
    const css = Math.min(1, fit) * s / dpr;
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
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok',
    KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel',
    KeyQ: 'auto'
  };
  const input = { down: {}, pressed: {}, any: false };
  input.isDown = (a) => !!input.down[a];
  input.hit = (a) => !!input.pressed[a];
  input.press = (a) => { if (!input.down[a]) input.pressed[a] = true; input.down[a] = true; input.any = true; };
  input.release = (a) => { input.down[a] = false; };
  window.addEventListener('keydown', (e) => {
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
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0;
  function tick(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    if (HB.paused) acc = 0;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(tick);
  }
  function update(dt) {
    HB.time += dt;
    HB.frame++;
    if (fade) {
      fade.t += dt;
      if (fade.dir === 1 && fade.t >= fade.dur) {
        if (fade.cb) fade.cb();
        fade.dir = -1; fade.t = 0;
      } else if (fade.dir === -1 && fade.t >= fade.dur) {
        fade = null;
      }
    }
    if (scene && scene.update) scene.update(dt, !!fade);
    input.pressed = {};
  }
  function render() {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    if (scene && scene.draw) scene.draw(g);
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
    ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
  }
  HB.start = function () { requestAnimationFrame(tick); };
})(window.HB);
