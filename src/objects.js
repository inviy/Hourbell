// Larger hand-built props: the Hourbell tower and light glows.
(function (HB) {
  'use strict';

  function px(x, cx, cy, col) { x.fillStyle = col; x.fillRect(cx, cy, 1, 1); }

  // the great bell tower, 48x96, anchored at bottom-center
  HB.makeBellTower = function (bellAngle) {
    const [c, x] = HB.makeCanvas(48, 96);
    const stone = '#a89c88', stoneL = '#c8bca4', stoneD = '#6c6252', stoneDD = '#4a4238';
    const slate = '#3a4a7a', slateL = '#5a6ca0', slateD = '#242e52';
    const gold = '#c8962c', goldL = '#f4cc64', goldD = '#7a5418';

    function blocks(x0, y0, w, h) {
      x.fillStyle = stone; x.fillRect(x0, y0, w, h);
      for (let r = 0; r * 6 < h; r++) {
        const y = y0 + r * 6;
        x.fillStyle = stoneD; x.fillRect(x0, y + 5, w, 1);
        x.fillStyle = stoneL; x.fillRect(x0, y, w, 1);
        const off = (r % 2) * 5;
        for (let bx = x0 + off; bx < x0 + w; bx += 10) {
          x.fillStyle = stoneD; x.fillRect(bx, y, 1, 5);
          x.fillStyle = stoneL; x.fillRect(bx + 1, y + 1, 1, 3);
        }
      }
      // weathering
      for (let k = 0; k < w * h / 18; k++) {
        const hx = x0 + Math.floor(HB.hash2(k, x0, 3) * w), hy = y0 + Math.floor(HB.hash2(k, y0, 4) * h);
        px(x, hx, hy, HB.hash2(k, 1, 5) < 0.5 ? stoneD : '#8a9a6a');
      }
      x.fillStyle = stoneDD; x.fillRect(x0, y0, 1, h); x.fillRect(x0 + w - 1, y0, 1, h);
    }

    // body
    blocks(6, 42, 36, 48);
    // shading on right side
    x.fillStyle = 'rgba(30,16,50,0.22)'; x.fillRect(30, 42, 11, 48);
    // steps
    x.fillStyle = stoneD; x.fillRect(2, 90, 44, 6);
    x.fillStyle = stoneL; x.fillRect(2, 90, 44, 1); x.fillRect(4, 93, 40, 1);
    // door arch
    x.fillStyle = stoneDD; x.fillRect(17, 72, 14, 18); x.fillRect(19, 70, 10, 2);
    x.fillStyle = '#1a1226'; x.fillRect(18, 73, 12, 17); x.fillRect(20, 71, 8, 2);
    x.fillStyle = '#5a3a24'; x.fillRect(19, 76, 10, 14);
    x.fillStyle = '#3c2616'; x.fillRect(23, 76, 2, 14);
    px(x, 21, 83, goldL); px(x, 26, 83, goldL);

    // clock face (stopped at ten to seven)
    const ccx = 24, ccy = 56, R = 8;
    for (let j = -R - 1; j <= R + 1; j++) for (let i = -R - 1; i <= R + 1; i++) {
      const d = Math.sqrt(i * i + j * j);
      if (d <= R - 1) px(x, ccx + i, ccy + j, '#f2e8cc');
      else if (d <= R + 0.6) px(x, ccx + i, ccy + j, goldD);
      else if (d <= R + 1.4) px(x, ccx + i, ccy + j, gold);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      px(x, Math.round(ccx + Math.sin(a) * (R - 2)), Math.round(ccy - Math.cos(a) * (R - 2)), '#8a7a5a');
    }
    function hand(angDeg, len, col) {
      const a = angDeg * Math.PI / 180;
      for (let r = 0; r <= len; r += 0.5) px(x, Math.round(ccx + Math.sin(a) * r), Math.round(ccy - Math.cos(a) * r), col);
    }
    hand(205, 4, '#2a1c2c');
    hand(300, 6, '#2a1c2c');
    px(x, ccx, ccy, goldD);

    // cornice
    x.fillStyle = stoneDD; x.fillRect(4, 40, 40, 3);
    x.fillStyle = stoneL; x.fillRect(4, 40, 40, 1);

    // belfry
    blocks(9, 16, 30, 24);
    x.fillStyle = 'rgba(30,16,50,0.2)'; x.fillRect(29, 16, 9, 24);
    x.fillStyle = stoneDD; x.fillRect(14, 20, 20, 20); x.fillRect(16, 18, 16, 2);
    x.fillStyle = '#140e22'; x.fillRect(15, 21, 18, 19); x.fillRect(17, 19, 14, 2);
    // beam and bell
    x.fillStyle = '#5a3a24'; x.fillRect(15, 21, 18, 2);
    const bell = document.createElement('canvas'); bell.width = 16; bell.height = 16;
    const b = bell.getContext('2d');
    const shape = [3, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 8]; // half widths per row
    for (let r = 0; r < shape.length; r++) {
      const hw = shape[r];
      for (let i = -hw; i < hw; i++) {
        let col = gold;
        if (i < -hw + 2) col = goldD;
        else if (i > hw - 3) col = goldD;
        else if (i > -hw + 2 && i < -hw + 5 && r > 1) col = goldL;
        if (r === shape.length - 1) col = goldD;
        b.fillStyle = col; b.fillRect(8 + i, r + 1, 1, 1);
      }
    }
    b.fillStyle = goldD; b.fillRect(7, 0, 2, 1);
    b.fillStyle = '#3a2410'; b.fillRect(7, 14, 2, 2); // clapper
    x.save();
    x.translate(24, 22);
    x.rotate(bellAngle || 0);
    x.drawImage(bell, -8, 0);
    x.restore();

    // roof
    for (let j = 0; j < 17; j++) {
      const hw = Math.round(2 + j * 1.25);
      for (let i = -hw; i <= hw; i++) {
        let col = slate;
        if (i < -hw + 2 + j / 6) col = slateL;
        if (i > hw * 0.4) col = slateD;
        if ((j % 4 === 3)) col = HB.shade(col === slateL ? slate : slateD, -0.1);
        px(x, 24 + i, 2 + j, col);
      }
    }
    x.fillStyle = slateD; x.fillRect(3, 18, 42, 2);
    // finial
    x.fillStyle = goldD; x.fillRect(23, 0, 2, 3);
    px(x, 23, 0, goldL);
    return c;
  };

  // warm additive glow
  HB.makeGlow = function (r, color) {
    const [c, x] = HB.makeCanvas(r * 2, r * 2);
    const grd = x.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grd;
    x.fillRect(0, 0, r * 2, r * 2);
    return c;
  };
})(window.HB);
