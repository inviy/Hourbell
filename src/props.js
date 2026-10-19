// Map props: doors that lead indoors, treasure chests, and the wind-chime
// puzzle. Map defs declare them (doors[].to, chests[], chimes[] + puzzle).
(function (HB) {
  'use strict';

  const T = HB.TILE;
  let art = null;

  function makeArt() {
    const chest = (open) => {
      const [c, x] = HB.makeCanvas(16, 16);
      const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
      r(1, 6, 14, 9, '#3a2010'); r(2, 7, 12, 7, '#a8682c'); r(2, 7, 12, 1, '#d08a44');
      r(2, 10, 12, 1, '#6a3a18'); r(7, 7, 2, 7, '#f0c040');
      if (open) { r(1, 2, 14, 5, '#3a2010'); r(2, 3, 12, 3, '#6a3a18'); r(3, 5, 10, 2, '#1a0e08'); }
      else { r(1, 3, 14, 4, '#3a2010'); r(2, 3, 12, 3, '#c07a34'); r(2, 3, 12, 1, '#e09a50'); r(7, 5, 2, 3, '#f0c040'); r(7, 7, 2, 1, '#7a5418'); }
      return c;
    };
    // a post with a crossbar; chime length shows the pitch (long = low)
    const post = (note) => {
      const [c, x] = HB.makeCanvas(16, 28);
      const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
      r(7, 4, 3, 24, '#5a3a20'); r(7, 4, 1, 24, '#8a5a34');
      r(2, 3, 13, 2, '#5a3a20'); r(2, 3, 13, 1, '#8a5a34');
      const len = [14, 10, 6][note];
      [4, 12].forEach((cx) => { r(cx, 5, 1, len, '#c89a3c'); r(cx, 5 + len, 1, 1, '#fff0a0'); });
      return c;
    };
    // hanging board: a picture and the shop's name, readable from across town
    const board = (paint) => (name) => {
      const w = 18 + HB.textWidth(name, 'g9');
      const [c, x] = HB.makeCanvas(w, 13);
      const r = (a, b, ww, h, col) => { x.fillStyle = col; x.fillRect(a, b, ww, h); };
      r(0, 0, w, 13, '#3a2010'); r(1, 1, w - 2, 11, '#c8945c'); r(1, 1, w - 2, 1, '#e0b07a');
      paint(r);
      HB.text(x, name, 15, 1, '#3a2010', { font: 'g9', shadow: null });
      return c;
    };
    const boards = {
      flower: board((r) => {
        r(7, 8, 2, 3, '#3a7a34');
        [[5, 4], [9, 4], [7, 2], [7, 6]].forEach(([a, b]) => r(a, b, 2, 2, '#f070a0'));
        r(7, 4, 2, 2, '#ffe040');
      }),
      anvil: board((r) => {
        r(3, 3, 10, 2, '#5a5a66'); r(3, 3, 10, 1, '#9a9aa8'); r(1, 4, 2, 1, '#5a5a66');
        r(6, 5, 4, 3, '#44444e'); r(4, 8, 8, 2, '#5a5a66');
      }),
      bell: board((r) => {
        r(7, 2, 2, 1, '#7a5418');
        [[6, 3, 4], [5, 4, 6], [5, 5, 6], [4, 6, 8], [4, 7, 8]].forEach(([a, b, w]) => r(a, b, w, 1, '#f0c040'));
        r(3, 8, 10, 1, '#c8962c'); r(7, 9, 2, 1, '#7a5418'); r(6, 4, 1, 3, '#fff0a0');
      })
    };
    return { chest: [chest(false), chest(true)], posts: [post(0), post(1), post(2)], boards };
  }

  const NOTES = ['ding0', 'ding1', 'ding2'];
  const find = (list, tx, ty) => (list || []).find((p) => p.tx === tx && p.ty === ty);

  const Props = {
    seq: [], ring: {}, boardCache: {},
    boardImg(b) { return this.boardCache[b.name] || (this.boardCache[b.name] = art.boards[b.icon](b.name)); },

    onLoad(w) {
      if (!art) art = makeArt();
      this.seq = []; this.ring = {};
    },

    interact(w, tx, ty) {
      const def = w.def;
      const door = find(def.doors, tx, ty);
      if (door && door.shop) {
        const shop = HB.SHOPS[door.shop];
        HB.dialog.open(door.text, { onClose: () => HB.Menu.openShop(shop.title, shop.stock) });
        return true;
      }
      if (door && door.to) {
        HB.sfx('step');
        HB.fadeTo(() => w.load(door.to, door.spawn));
        return true;
      }
      const chest = find(def.chests, tx, ty);
      if (chest) { this.openChest(w, chest); return true; }
      const pick = find(def.pickups, tx, ty);
      if (pick && !w.flags['pick_' + pick.id]) {
        w.flags['pick_' + pick.id] = true;
        HB.party.items[pick.item] = (HB.party.items[pick.item] || 0) + 1;
        HB.sfx('fragment');
        HB.dialog.open(pick.text + '\n' + HB.josa(HB.ITEMS[pick.item].name, '을를') + ' 손에 넣었다.', { voice: 'narrate' });
        return true;
      }
      const chime = find(def.chimes, tx, ty);
      if (chime) { this.ringChime(w, chime); return true; }
      return false;
    },

    openChest(w, c) {
      const key = 'chest_' + c.id, P = HB.party;
      if (w.flags[key]) { HB.dialog.open('빈 상자다.'); return; }
      if (c.locked && !w.flags[c.locked]) {
        HB.sfx('thud');
        HB.dialog.open(['상자가 단단히 잠겨 있다.', c.hint ? '뚜껑에 글이 새겨져 있다. "' + c.hint + '"' : '자물쇠에 작은 풍경 무늬가 새겨져 있다.']);
        return;
      }
      w.flags[key] = true;
      HB.sfx('fragment');
      let got;
      if (c.gold) { P.gold += c.gold; got = c.gold + '골드'; }
      else {
        const n = c.count || 1;
        P.items[c.item] = (P.items[c.item] || 0) + n;
        got = HB.ITEMS[c.item].name + (n > 1 ? ' ' + n + '개' : '');
      }
      HB.dialog.open('상자를 열었다! ' + HB.josa(got, '을를') + ' 손에 넣었다.' +
        (c.item && HB.isGear(c.item) ? '\n(메뉴의 장비에서 착용할 수 있다)' : ''), { voice: 'narrate' });
    },

    ringChime(w, ch) {
      const pz = w.def.puzzle;
      HB.sfx(NOTES[ch.note]);
      this.ring[ch.tx + ',' + ch.ty] = HB.time;
      if (!pz || w.flags[pz.flag]) return;
      this.seq.push(ch.note);
      const ok = this.seq.every((n, i) => n === pz.order[i]);
      if (!ok) { this.seq = []; setTimeout(() => HB.sfx('thud'), 450); return; }
      if (this.seq.length === pz.order.length) {
        w.flags[pz.flag] = true;
        setTimeout(() => HB.sfx('fragment'), 500);
        HB.dialog.open(['세 개의 풍경이 하나의 화음으로 울렸다.', '어디선가 찰칵, 자물쇠가 풀리는 소리가 났다.'], { voice: 'narrate' });
      }
    },

    drawables(w, list) {
      for (const c of w.def.chests || []) {
        const open = !!w.flags['chest_' + c.id];
        list.push({ y: (c.ty + 1) * T - 1, draw: (g, cam) => g.drawImage(art.chest[open ? 1 : 0], c.tx * T - cam.x, c.ty * T - cam.y) });
      }
      for (const b of w.def.boards || []) {
        const img = this.boardImg(b);
        list.push({ y: b.ty * T, draw: (g, cam) => g.drawImage(img, b.tx * T + 8 - (img.width >> 1) - cam.x, b.ty * T - 12 - cam.y) });
      }
      for (const p of w.def.pickups || []) {
        if (w.flags['pick_' + p.id]) continue;
        list.push({
          y: p.ty * T + 8,
          draw: (g, cam) => {
            const x = p.tx * T - cam.x + 8, y = p.ty * T - cam.y + 10, sway = Math.round(Math.sin(HB.time * 3) * 1.5);
            g.fillStyle = '#3a7a34'; g.fillRect(x, y - 6, 1, 7);
            g.fillStyle = '#a8f0ff'; g.fillRect(x - 2 + sway, y - 9, 5, 3); g.fillRect(x - 1 + sway, y - 10, 3, 5);
            g.fillStyle = '#ffffff'; g.fillRect(x + sway, y - 9, 1, 1);
            if (Math.sin(HB.time * 4) > 0.6) { g.fillStyle = '#fffbe0'; g.fillRect(x + 4, y - 13, 1, 1); }
          }
        });
      }
      for (const ch of w.def.chimes || []) {
        const at = this.ring[ch.tx + ',' + ch.ty];
        list.push({
          y: (ch.ty + 1) * T - 1,
          draw: (g, cam) => {
            const k = at !== undefined ? Math.max(0, 1 - (HB.time - at) / 1.2) : 0;
            const sway = Math.round(Math.sin(HB.time * 20) * 2 * k);
            g.drawImage(art.posts[ch.note], ch.tx * T - cam.x + sway, ch.ty * T - 12 - cam.y);
          }
        });
      }
    }
  };

  HB.Props = Props;
  HB.worldPlugins.push(Props);
})(window.HB);
