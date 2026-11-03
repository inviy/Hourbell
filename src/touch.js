// On-screen controls for phones and tablets: a D-pad and A / B buttons.
// Only shown on touch devices; they feed the same input actions as the keyboard.
(function (HB) {
  'use strict';

  // the layout leaves room for these (src/core.js resize: SIDE, BELOW)
  if (!HB.isTouch) return;

  const css = document.createElement('style');
  css.textContent = [
    '.hb-pad{position:fixed;bottom:18px;left:18px;width:132px;height:132px;touch-action:none;z-index:5}',
    '.hb-pad div{position:absolute;width:44px;height:44px;background:rgba(240,236,255,.16);border:2px solid rgba(240,236,255,.35);border-radius:8px}',
    '.hb-pad .u{left:44px;top:0}.hb-pad .d{left:44px;bottom:0}.hb-pad .l{left:0;top:44px}.hb-pad .r{right:0;top:44px}',
    '.hb-pad div.on,.hb-btn.on{background:rgba(255,224,138,.45)}',
    '.hb-btn{position:fixed;width:58px;height:58px;border-radius:50%;background:rgba(240,236,255,.16);border:2px solid rgba(240,236,255,.4);',
    'color:#fff4d8;font:16px HourbellText11,sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none;z-index:5;user-select:none}',
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
  const screenUp = (e) => { e.preventDefault(); HB.input.release('ok'); };
  screen.addEventListener('touchend', screenUp, { passive: false });
  screen.addEventListener('touchcancel', screenUp, { passive: false });

  // phones in portrait: the empty room between the game and the buttons shows
  // the current line, speaker and choices as large HTML text (read out by
  // screen readers); battle messages and menu / shop help appear there too
  css.textContent += '#hb-talk{position:fixed;left:12px;right:12px;display:none;overflow:auto;box-sizing:border-box;padding:10px 14px;' +
    'font:17px/1.55 sans-serif;color:#f4f0e8;border-radius:8px}#hb-talk.on{background:rgba(28,36,96,.92);border:2px solid #9aa4d8}' +
    '#hb-talk b{display:block;color:#ffe08a;font-size:16px}#hb-talk ol{margin:6px 0 0;padding:0;list-style:none}' +
    '#hb-talk li{color:#a898c0}#hb-talk li.cur{color:#fff4d8}#hb-talk li.cur::before{content:"▶ "}';
  const talk = document.createElement('div');
  talk.id = 'hb-talk';
  talk.setAttribute('aria-live', 'polite');
  document.body.appendChild(talk);
  function place() {
    talk.style.display = HB.phonePortrait ? 'block' : 'none';
    if (!HB.phonePortrait) return;
    const top = screen.getBoundingClientRect().bottom + 8;
    const below = Math.min(pad.getBoundingClientRect().top, document.querySelector('.hb-a').getBoundingClientRect().top);
    talk.style.top = top + 'px';
    talk.style.maxHeight = Math.max(0, below - 8 - top) + 'px';
  }
  function content() {
    const d = HB.dialog.view();
    if (d) return d;
    if (HB.Battle && HB.Battle.active && HB.Battle.msg) return { text: HB.Battle.msg };
    const M = HB.Menu;
    if (M && M.open && M.mode) {
      const sel = M.rows(HB.World)[M.mode.cur];
      const text = M.note || (sel && sel.desc);
      if (text) return { name: M.note ? null : sel.label, text };
    }
    return null;
  }
  let shown = '';
  function sync() {
    try {
      const c = HB.phonePortrait ? content() : null, key = JSON.stringify(c && [c.name, c.text, c.choices]);
      if (key !== shown) {
        shown = key;
        talk.classList.toggle('on', !!c);
        talk.replaceChildren();
        if (c) {
          if (c.name) talk.appendChild(document.createElement('b')).textContent = c.name;
          talk.appendChild(document.createElement('div')).textContent = c.text;
          if (c.choices) {
            const ol = talk.appendChild(document.createElement('ol'));
            c.choices.forEach((t) => { ol.appendChild(document.createElement('li')).textContent = t; });
          }
        }
      }
      // moving the choice cursor only moves the mark, so the line is not read out again
      if (c && c.choices) talk.querySelectorAll('li').forEach((li, i) => li.classList.toggle('cur', i === c.choice));
    } catch (e) { /* the game loop reports errors; the panel just tries again next frame */ }
    requestAnimationFrame(sync);
  }
  window.addEventListener('resize', place);

  button('A', 'hb-a', 'ok');
  button('B', 'hb-b', 'cancel');
  place(); sync();
  HB.touchControls = true;
})(window.HB);
