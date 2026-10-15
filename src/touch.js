// On-screen controls for phones and tablets: a D-pad and A / B buttons.
// Only shown on touch devices; they feed the same input actions as the keyboard.
(function (HB) {
  'use strict';

  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  const css = document.createElement('style');
  css.textContent = [
    '.hb-pad{position:fixed;bottom:18px;left:18px;width:132px;height:132px;touch-action:none;z-index:5}',
    '.hb-pad div{position:absolute;width:44px;height:44px;background:rgba(240,236,255,.16);border:2px solid rgba(240,236,255,.35);border-radius:8px}',
    '.hb-pad .u{left:44px;top:0}.hb-pad .d{left:44px;bottom:0}.hb-pad .l{left:0;top:44px}.hb-pad .r{right:0;top:44px}',
    '.hb-pad div.on,.hb-btn.on{background:rgba(255,224,138,.45)}',
    '.hb-btn{position:fixed;width:58px;height:58px;border-radius:50%;background:rgba(240,236,255,.16);border:2px solid rgba(240,236,255,.4);',
    'color:#fff4d8;font:16px Galmuri11,sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none;z-index:5;user-select:none}',
    '.hb-a{right:22px;bottom:70px}.hb-b{right:92px;bottom:26px}'
  ].join('');
  document.head.appendChild(css);

  const pad = document.createElement('div');
  pad.className = 'hb-pad';
  const dirs = { u: 'up', d: 'down', l: 'left', r: 'right' };
  const cells = {};
  Object.keys(dirs).forEach((k) => { const c = document.createElement('div'); c.className = k; pad.appendChild(c); cells[k] = c; });
  document.body.appendChild(pad);

  // the pad reads the finger angle so diagonals work naturally
  function padInput(e) {
    e.preventDefault();
    HB.onUserGesture && HB.onUserGesture();
    const r = pad.getBoundingClientRect();
    const held = { up: false, down: false, left: false, right: false };
    for (const t of e.touches) {
      const x = t.clientX - (r.left + r.width / 2), y = t.clientY - (r.top + r.height / 2);
      if (Math.hypot(x, y) < 12 || Math.abs(x) > r.width || Math.abs(y) > r.height) continue;
      const a = Math.atan2(y, x);
      if (a > -2.75 && a < -0.4) held.up = true;
      if (a > 0.4 && a < 2.75) held.down = true;
      if (Math.abs(a) > 1.95) held.left = true;
      if (Math.abs(a) < 1.2) held.right = true;
    }
    Object.keys(dirs).forEach((k) => {
      const act = dirs[k];
      if (held[act]) HB.input.press(act); else HB.input.release(act);
      cells[k].classList.toggle('on', held[act]);
    });
  }
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((ev) => pad.addEventListener(ev, padInput, { passive: false }));

  function button(label, cls, action) {
    const b = document.createElement('div');
    b.className = 'hb-btn ' + cls;
    b.textContent = label;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); HB.onUserGesture && HB.onUserGesture(); HB.input.press(action); b.classList.add('on'); }, { passive: false });
    const up = (e) => { e.preventDefault(); HB.input.release(action); b.classList.remove('on'); };
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    document.body.appendChild(b);
  }
  // tapping the game screen itself also confirms (handy on the title screen)
  const screen = document.getElementById('screen');
  screen.addEventListener('touchstart', (e) => { e.preventDefault(); HB.onUserGesture && HB.onUserGesture(); HB.input.press('ok'); }, { passive: false });
  screen.addEventListener('touchend', (e) => { e.preventDefault(); HB.input.release('ok'); }, { passive: false });

  button('A', 'hb-a', 'ok');
  button('B', 'hb-b', 'cancel');
  HB.touchControls = true;
})(window.HB);
