// Crisp pixel text: renders Galmuri glyphs into the low-res buffer
// and thresholds alpha so no blurry anti-aliased edges remain.
(function (HB) {
  'use strict';

  const FONTS = {
    g11: { css: '12px HourbellText11', h: 14, line: 15 },
    g9: { css: '10px HourbellText9', h: 12, line: 12 }
  };
  const cache = new Map();
  const [mc, mx] = HB.makeCanvas(4, 4);

  function measure(str, font) {
    mx.font = FONTS[font || 'g11'].css;
    return Math.ceil(mx.measureText(str).width);
  }

  function render(str, font, color) {
    const key = font + '|' + color + '|' + str;
    let c = cache.get(key);
    if (c) return c;
    const f = FONTS[font];
    const w = Math.max(1, measure(str, font) + 2);
    const [cv, cx] = HB.makeCanvas(w, f.h + 2);
    cx.font = f.css;
    cx.textBaseline = 'top';
    cx.fillStyle = '#fff';
    cx.fillText(str, 0, 2); // glyphs can start one row above 'top'
    const img = cx.getImageData(0, 0, w, f.h + 2);
    const d = img.data;
    const n = parseInt(color.slice(1), 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 110) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
      else d[i + 3] = 0;
    }
    cx.putImageData(img, 0, 0);
    if (cache.size > 600) cache.clear();
    cache.set(key, cv);
    return cv;
  }

  // draw text with a 1px drop shadow
  HB.text = function (g, str, x, y, color, opts) {
    opts = opts || {};
    const font = opts.font || 'g11';
    if (!str) return 0;
    const shadow = opts.shadow === undefined ? '#0a0a1a' : opts.shadow;
    let w = measure(str, font);
    if (opts.align === 'center') x -= Math.floor(w / 2);
    else if (opts.align === 'right') x -= w;
    if (shadow) g.drawImage(render(str, font, shadow), Math.round(x) + 1, Math.round(y) - 1);
    g.drawImage(render(str, font, color || '#f4f0e8'), Math.round(x), Math.round(y) - 2);
    return w;
  };
  // scaled text for logos and headings (nearest-neighbor)
  HB.textScaled = function (g, str, x, y, color, scale, opts) {
    opts = opts || {};
    const font = opts.font || 'g11';
    const w = measure(str, font) * scale;
    if (opts.align === 'center') x -= Math.floor(w / 2);
    const img = render(str, font, color);
    if (opts.shadow) g.drawImage(render(str, font, opts.shadow), 0, 0, img.width, img.height, Math.round(x) + scale, Math.round(y) + scale - 2 * scale, img.width * scale, img.height * scale);
    g.drawImage(img, 0, 0, img.width, img.height, Math.round(x), Math.round(y) - 2 * scale, img.width * scale, img.height * scale);
    return w;
  };
  HB.textWidth = measure;
  HB.FONTS = FONTS;

  // wrap a paragraph to lines that fit maxW
  HB.wrap = function (str, maxW, font) {
    const out = [];
    str.split('\n').forEach((para) => {
      let line = '';
      for (const ch of para) {
        const t = line + ch;
        if (measure(t, font) > maxW && line) {
          // prefer breaking at the last space
          const sp = line.lastIndexOf(' ');
          if (sp > 0) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
          else { out.push(line); line = ch; }
        } else line = t;
      }
      out.push(line);
    });
    return out;
  };

  HB.fontsReady = Promise.all([
    document.fonts.load('12px HourbellText11', '가A'),
    document.fonts.load('10px HourbellText9', '가A')
  ]).catch(() => {});
})(window.HB);
