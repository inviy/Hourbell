// Windows, cursor and the dialogue box.
(function (HB) {
  'use strict';

  const WIN = {
    top: '#3c5cc8', bottom: '#141c58',
    rimLight: '#eeeaf8', rimMid: '#9aa4d8', rimDark: '#1a1430'
  };

  // SNES-style gradient window with a beveled rim
  HB.drawWindow = function (g, x, y, w, h, alpha) {
    g.save();
    g.globalAlpha = alpha === undefined ? 0.94 : alpha;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      g.fillStyle = mix(WIN.top, WIN.bottom, t);
      const y0 = y + 2 + Math.floor((h - 4) * i / steps);
      const y1 = y + 2 + Math.floor((h - 4) * (i + 1) / steps);
      g.fillRect(x + 2, y0, w - 4, y1 - y0);
    }
    g.globalAlpha = 1;
    // rim
    g.fillStyle = WIN.rimDark;
    g.fillRect(x + 1, y, w - 2, 1); g.fillRect(x + 1, y + h - 1, w - 2, 1);
    g.fillRect(x, y + 1, 1, h - 2); g.fillRect(x + w - 1, y + 1, 1, h - 2);
    g.fillStyle = WIN.rimLight;
    g.fillRect(x + 2, y + 1, w - 4, 1); g.fillRect(x + 1, y + 2, 1, h - 4);
    g.fillStyle = WIN.rimMid;
    g.fillRect(x + 2, y + h - 2, w - 4, 1); g.fillRect(x + w - 2, y + 2, 1, h - 4);
    g.restore();
  };

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')';
  }
  HB.mix = mix;

  // small pointing cursor (6x7)
  const CURSOR = [
    '.kk...',
    'kwwk..',
    'kwwwk.',
    'kwwwwk',
    'kwwwk.',
    'kwwk..',
    '.kk...'
  ];
  HB.drawCursor = function (g, x, y) {
    const bob = Math.floor(HB.time * 4) % 2;
    for (let r = 0; r < CURSOR.length; r++) {
      for (let c = 0; c < 6; c++) {
        const ch = CURSOR[r][c];
        if (ch === '.') continue;
        g.fillStyle = ch === 'k' ? '#1a1430' : '#fff8e0';
        g.fillRect(x + c + bob, y + r, 1, 1);
      }
    }
  };

  // blinking "more" arrow
  function drawMore(g, x, y) {
    if (Math.floor(HB.time * 3) % 2) return;
    g.fillStyle = '#fff8e0';
    g.fillRect(x, y, 5, 1); g.fillRect(x + 1, y + 1, 3, 1); g.fillRect(x + 2, y + 2, 1, 1);
  }

  // ---------- dialogue ----------
  const BOX = { w: 400, h: 52 };
  BOX.x = Math.floor((HB.W - BOX.w) / 2); BOX.y = HB.H - BOX.h - 6;
  const MAX_LINES = 3;
  const dlg = { open: false, pages: [], page: 0, shown: 0, name: null, onClose: null };

  HB.dialog = {
    get active() { return dlg.open; },
    close() { dlg.open = false; dlg.onClose = null; },
    open(texts, opts) {
      opts = opts || {};
      const pages = [];
      (Array.isArray(texts) ? texts : [texts]).forEach((t) => {
        const lines = HB.wrap(t, BOX.w - 20, 'g11');
        for (let i = 0; i < lines.length; i += MAX_LINES) pages.push(lines.slice(i, i + MAX_LINES));
      });
      dlg.pages = pages; dlg.page = 0; dlg.shown = 0;
      dlg.name = opts.name || null;
      dlg.voice = opts.voice || 'blip';
      dlg.onClose = opts.onClose || null;
      dlg.open = true;
      dlg.lastBlip = 0;
    },
    update(dt) {
      if (!dlg.open) return;
      const total = dlg.pages[dlg.page].join('').length;
      if (dlg.shown < total) {
        const speed = HB.input.isDown('ok') ? 120 : [24, 42, 80][HB.options.text];
        const before = Math.floor(dlg.shown);
        dlg.shown = Math.min(total, dlg.shown + speed * dt);
        const after = Math.floor(dlg.shown);
        if (after !== before && HB.time - dlg.lastBlip > 0.055) {
          const ch = dlg.pages[dlg.page].join('')[after - 1];
          if (ch && ch !== ' ' && HB.sfx) HB.sfx(dlg.voice);
          dlg.lastBlip = HB.time;
        }
        if (HB.input.hit('ok') && dlg.shown > 1) dlg.shown = total;
      } else if (HB.input.hit('ok') || HB.input.hit('cancel')) {
        if (HB.sfx) HB.sfx('tick');
        if (dlg.page < dlg.pages.length - 1) { dlg.page++; dlg.shown = 0; }
        else {
          dlg.open = false;
          const cb = dlg.onClose; dlg.onClose = null;
          if (cb) cb();
        }
      }
    },
    draw(g) {
      if (!dlg.open) return;
      HB.drawWindow(g, BOX.x, BOX.y, BOX.w, BOX.h);
      if (dlg.name) {
        const nw = HB.textWidth(dlg.name, 'g9') + 12;
        HB.drawWindow(g, BOX.x + 6, BOX.y - 12, nw, 14, 0.97);
        HB.text(g, dlg.name, BOX.x + 12, BOX.y - 10, '#ffe08a', { font: 'g9' });
      }
      let remain = Math.floor(dlg.shown);
      const lines = dlg.pages[dlg.page];
      for (let i = 0; i < lines.length && remain > 0; i++) {
        const part = lines[i].slice(0, remain);
        remain -= lines[i].length;
        HB.text(g, part, BOX.x + 10, BOX.y + 6 + i * 15, '#f4f0e8');
      }
      const total = lines.join('').length;
      if (dlg.shown >= total) drawMore(g, BOX.x + BOX.w - 14, BOX.y + BOX.h - 8);
    }
  };

  // area name banner shown when entering a map
  const banner = { text: '', sub: '', t: 0 };
  HB.showBanner = function (text, sub) { banner.text = text; banner.sub = sub || ''; banner.t = 3.2; };
  HB.updateBanner = function (dt) { if (banner.t > 0) banner.t -= dt; };
  HB.drawBanner = function (g) {
    if (banner.t <= 0) return;
    const a = Math.min(1, banner.t / 0.6, (3.2 - banner.t) / 0.6);
    g.save();
    g.globalAlpha = Math.max(0, a);
    const w = Math.max(HB.textWidth(banner.text, 'g11'), HB.textWidth(banner.sub, 'g9')) + 40;
    const x = Math.floor((HB.W - w) / 2), y = 18;
    g.fillStyle = 'rgba(10,8,24,0.55)';
    g.fillRect(x, y, w, banner.sub ? 32 : 20);
    g.fillStyle = '#ffe08a';
    g.fillRect(x + 8, y + 2, w - 16, 1);
    g.fillRect(x + 8, y + (banner.sub ? 29 : 17), w - 16, 1);
    HB.text(g, banner.text, HB.W / 2, y + 4, '#fff4d8', { align: 'center' });
    if (banner.sub) HB.text(g, banner.sub, HB.W / 2, y + 18, '#c8c0e0', { align: 'center', font: 'g9' });
    g.restore();
  };
})(window.HB);
