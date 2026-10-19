// Gamepads (standard mapping): the same actions as the keyboard and the
// on-screen buttons. Read once a frame from the loop (src/core.js).
//   A / B: ok / cancel, Start: cancel (menu), Y: auto hunt,
//   D-pad or the left stick: move
(function (HB) {
  'use strict';

  const BUTTONS = { 0: 'ok', 1: 'cancel', 9: 'cancel', 3: 'auto', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const DEAD = 0.5; // stick travel before it counts as a direction
  let held = {};

  HB.pollPads = function () {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    const now = {};
    for (const p of pads) {
      if (!p) continue;
      for (const i in BUTTONS) if (p.buttons[i] && p.buttons[i].pressed) now[BUTTONS[i]] = true;
      const x = p.axes[0] || 0, y = p.axes[1] || 0;
      if (x < -DEAD) now.left = true; else if (x > DEAD) now.right = true;
      if (y < -DEAD) now.up = true; else if (y > DEAD) now.down = true;
    }
    for (const a in now) {
      if (held[a]) continue;
      if (HB.paused) { HB.paused = false; continue; } // the press that resumes does nothing else
      HB.input.press(a);
    }
    for (const a in held) if (!now[a]) HB.input.release(a);
    held = now;
  };
})(window.HB);
