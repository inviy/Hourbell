// Pause menu (X / Esc on the map), the flower shop, and saving.
(function (HB) {
  'use strict';

  const T = HB.TILE;
  // localStorage itself can throw (blocked storage, sandboxed frames)
  const store = () => { try { return window.localStorage; } catch (e) { return null; } };
  HB.save = (w) => HB.saveGame(store(), {
    party: HB.party, flags: w.flags, map: w.def.id,
    x: w.player.x / T, y: w.player.y / T, dir: w.player.dir
  });
  HB.load = () => HB.loadGame(store());

  const MAIN = [{ id: 'items', label: '도구' }, { id: 'save', label: '기록' }, { id: 'close', label: '닫기' }];

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  };

  const Menu = {
    open: false, mode: 'main', cur: 0, note: '', stock: null,

    openShop(stock) {
      this.open = true; this.mode = 'shop'; this.cur = 0; this.note = ''; this.stock = stock;
    },
    close() { this.open = false; HB.sfx('cancel'); },
    itemIds() { return Object.keys(HB.party.items); },

    update(w, dt, fading) {
      const inp = HB.input;
      if (!this.open) {
        if (fading || HB.Battle.active || !inp.hit('cancel')) return false;
        this.open = true; this.mode = 'main'; this.cur = 0; this.note = '';
        HB.sfx('ok');
        return true;
      }
      const list = this.mode === 'main' ? MAIN : this.mode === 'shop' ? this.stock : this.itemIds();
      const n = list.length;
      if (n && inp.hit('up')) { this.cur = (this.cur + n - 1) % n; HB.sfx('move'); }
      if (n && inp.hit('down')) { this.cur = (this.cur + 1) % n; HB.sfx('move'); }
      if (inp.hit('cancel')) {
        if (this.mode === 'items') { this.mode = 'main'; this.cur = 0; this.note = ''; HB.sfx('cancel'); }
        else this.close();
        return true;
      }
      if (!inp.hit('ok')) return true;
      const P = HB.party;
      if (this.mode === 'main') {
        const id = MAIN[this.cur].id;
        if (id === 'items') {
          if (!this.itemIds().length) { HB.sfx('cancel'); this.note = '가진 도구가 없다.'; }
          else { HB.sfx('ok'); this.mode = 'items'; this.cur = 0; this.note = ''; }
        } else if (id === 'save') {
          const ok = HB.save(w);
          HB.sfx(ok ? 'fragment' : 'cancel');
          this.note = ok ? '모험을 기록했다.' : '기록할 수 없었다. (브라우저 저장소가 막혀 있음)';
        } else this.close();
      } else if (this.mode === 'items') {
        const id = list[this.cur], it = HB.ITEMS[id];
        if (it.cure) { HB.sfx('cancel'); this.note = '전투 중에만 쓸 수 있다.'; return true; }
        if ((it.hp && P.hp >= P.maxHp) || (it.mp && P.mp >= P.maxMp)) { HB.sfx('cancel'); this.note = '지금은 쓸 필요가 없다.'; return true; }
        const got = HB.useItem(P, id);
        HB.sfx('heal');
        this.note = it.name + ': ' + (got.hp ? 'HP +' + got.hp : '울림 +' + got.mp);
        if (!P.items[id]) this.cur = Math.max(0, this.cur - 1);
        if (!this.itemIds().length) { this.mode = 'main'; this.cur = 0; }
      } else if (this.mode === 'shop') {
        const it = HB.ITEMS[list[this.cur]];
        if (HB.buyItem(P, list[this.cur])) { HB.sfx('ok'); this.note = HB.josa(it.name, '을를') + ' 샀다. (' + P.items[list[this.cur]] + '개 보유)'; }
        else { HB.sfx('cancel'); this.note = '골드가 모자라다.'; }
      }
      return true;
    },

    drawOverlay(w, g) {
      if (!this.open) return;
      const P = HB.party;
      g.fillStyle = 'rgba(10,8,24,0.35)'; g.fillRect(0, 0, HB.W, HB.H);
      if (this.mode === 'shop') {
        const x = 90, y = 40, wdt = 300;
        HB.drawWindow(g, x, y, wdt, 30 + this.stock.length * 18);
        HB.text(g, '꽃집 아이라의 가게', x + 12, y + 6, '#ffe08a');
        HB.text(g, '보유 ' + P.gold + '골드', x + wdt - 12, y + 7, '#ffe08a', { font: 'g9', align: 'right' });
        this.stock.forEach((id, i) => {
          const it = HB.ITEMS[id], yy = y + 26 + i * 18;
          HB.text(g, it.name, x + 24, yy, P.gold >= it.price ? '#f4f0e8' : '#8a8aa8');
          HB.text(g, it.desc, x + 96, yy + 2, '#c8c0e0', { font: 'g9' });
          HB.text(g, it.price + '골드', x + wdt - 12, yy + 1, '#f4f0e8', { font: 'g9', align: 'right' });
          if (i === this.cur) HB.drawCursor(g, x + 12, yy + 3);
        });
        this.drawNote(g, '결정: 사기   취소: 나가기');
        return;
      }
      // left: commands (or the item list)
      if (this.mode === 'items') {
        const ids = this.itemIds();
        HB.drawWindow(g, 8, 8, 120, 14 + ids.length * 16);
        ids.forEach((id, i) => {
          HB.text(g, HB.ITEMS[id].name, 24, 14 + i * 16);
          HB.text(g, 'x' + P.items[id], 118, 15 + i * 16, '#c8c0e0', { font: 'g9', align: 'right' });
          if (i === this.cur) HB.drawCursor(g, 14, 17 + i * 16);
        });
        const cur = ids[this.cur];
        this.drawNote(g, this.note || (cur ? HB.ITEMS[cur].desc : ''));
      } else {
        HB.drawWindow(g, 8, 8, 72, 14 + MAIN.length * 18);
        MAIN.forEach((m, i) => {
          HB.text(g, m.label, 26, 14 + i * 18);
          if (i === this.cur) HB.drawCursor(g, 14, 17 + i * 18);
        });
        this.drawNote(g, this.note);
      }
      // right: status
      const x = 136, y = 8, wdt = 200;
      HB.drawWindow(g, x, y, wdt, 178);
      HB.text(g, P.name, x + 12, y + 6, '#ffe08a');
      HB.text(g, 'Lv ' + P.lvl, x + wdt - 12, y + 7, '#c8c0e0', { font: 'g9', align: 'right' });
      HB.drawBar(g, x + 12, y + 30, 'HP', P.hp, P.maxHp, P.hp / P.maxHp < 0.3 ? '#ff7a6a' : '#7ae08a');
      HB.drawBar(g, x + 12, y + 44, '울림', P.mp, P.maxMp, '#7ab0ff');
      const rows = [
        ['공격', P.atk], ['방어', P.def], ['속도', P.spd],
        ['기술', HB.skillsFor(P.lvl).map((id) => HB.SKILLS[id].name).join(' ')],
        ['다음 레벨까지', HB.expToNext(P.lvl) - P.exp],
        ['골드', P.gold],
        ['종소리 조각', (w.flags.fragment1 ? 1 : 0) + ' / 7'],
        ['플레이 시간', fmtTime(P.time)]
      ];
      rows.forEach(([k, v], i) => {
        HB.text(g, k, x + 12, y + 56 + i * 14, '#c8c0e0', { font: 'g9' });
        HB.text(g, String(v), x + wdt - 12, y + 56 + i * 14, '#f4f0e8', { font: 'g9', align: 'right' });
      });
    },

    drawNote(g, text) {
      if (!text) return;
      HB.drawWindow(g, 8, HB.H - 30, HB.W - 16, 22);
      HB.text(g, text, 18, HB.H - 26);
    }
  };

  HB.Menu = Menu;
  HB.worldPlugins.push(Menu);
})(window.HB);
