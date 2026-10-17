// Pause menu (X / Esc on the map), shops, and saving.
// Every screen is a mode whose rows() returns { label, right, dim, desc, act };
// cancel walks back up the mode stack.
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

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  };
  const bag = (gear) => Object.keys(HB.party.items).filter((id) => HB.isGear(id) === gear);
  const statLine = (it) => ['atk', 'def', 'spd'].filter((k) => it[k]).map((k) => ({ atk: '공격', def: '방어', spd: '속도' })[k] + '+' + it[k]).join(' ');

  const Menu = {
    open: false, stack: [], note: '',
    hooks: [], // extra main-menu entries: { label, mode } (quest log, options)

    get mode() { return this.stack[this.stack.length - 1]; },
    push(m) { this.stack.push(Object.assign({ cur: 0 }, m)); this.note = ''; HB.sfx('ok'); },
    back() {
      this.stack.pop(); this.note = '';
      HB.sfx('cancel');
      if (!this.stack.length) this.open = false;
    },
    close() { this.open = false; this.stack = []; HB.sfx('cancel'); },

    openShop(title, stock) {
      this.open = true; this.stack = [];
      this.push({ id: 'shop', title, stock, tab: 0 });
    },

    // ---------- screens ----------
    rows(w) {
      const m = this.mode, P = HB.party, menu = this;
      if (m.id === 'main') {
        return [
          { label: '도구', act: () => (bag(false).length ? menu.push({ id: 'items' }) : menu.fail('가진 도구가 없다.')) },
          { label: '장비', act: () => menu.push({ id: 'equip' }) }
        ].concat(this.hooks.map((h) => ({ label: h.label, act: () => menu.push({ id: h.mode }) })), [
          { label: '기록', act: () => { const ok = HB.save(w); HB.sfx(ok ? 'fragment' : 'cancel'); menu.note = ok ? '모험을 기록했다.' : '기록할 수 없었다. (브라우저 저장소가 막혀 있음)'; } },
          { label: '닫기', act: () => menu.close() }
        ]);
      }
      if (m.id === 'items') {
        return bag(false).map((id) => ({ label: HB.ITEMS[id].name, right: 'x' + P.items[id], desc: HB.ITEMS[id].desc, act: () => menu.useItem(id) }));
      }
      if (m.id === 'equip') {
        return Object.keys(HB.SLOTS).map((slot) => {
          const cur = P.equip[slot];
          return { label: HB.SLOTS[slot], right: cur ? HB.ITEMS[cur].name : '-', desc: cur ? HB.ITEMS[cur].desc : '비어 있음', act: () => menu.push({ id: 'gear', slot }) };
        });
      }
      if (m.id === 'gear') {
        const ids = bag(true).filter((id) => HB.ITEMS[id].slot === m.slot);
        const rows = ids.map((id) => ({ label: HB.ITEMS[id].name, right: statLine(HB.ITEMS[id]), desc: menu.diff(id), act: () => { HB.equip(P, id); HB.sfx('ok'); menu.stack.pop(); menu.note = HB.josa(HB.ITEMS[id].name, '을를') + ' 장비했다.'; } }));
        if (P.equip[m.slot]) rows.push({ label: '벗기', right: '', desc: HB.ITEMS[P.equip[m.slot]].name + ' 해제', act: () => { HB.unequip(P, m.slot); HB.sfx('move'); menu.stack.pop(); } });
        if (!rows.length) rows.push({ label: '(가진 장비 없음)', dim: true, act: () => menu.fail('대장장이에게서 살 수 있다.') });
        return rows;
      }
      if (m.id === 'shop') {
        if (m.tab === 0) {
          return m.stock.map((id) => {
            const it = HB.ITEMS[id];
            return { label: it.name, right: it.price + '골드', dim: P.gold < it.price, desc: it.desc + (it.slot ? '   ' + menu.diff(id) : ''), act: () => menu.buy(id) };
          });
        }
        const ids = Object.keys(P.items).filter((id) => !HB.isKey(id));
        if (!ids.length) return [{ label: '(팔 것이 없음)', dim: true, act: () => menu.fail('팔 것이 없다.') }];
        return ids.map((id) => ({ label: HB.ITEMS[id].name + ' x' + P.items[id], right: HB.sellPrice(id) + '골드', desc: HB.ITEMS[id].desc, act: () => menu.sell(id) }));
      }
      return (HB.menuScreens[m.id] || (() => []))(this, w);
    },

    fail(msg) { HB.sfx('cancel'); this.note = msg; },
    // "공격 8 → 11" when wearing id instead of what is worn now
    diff(id) {
      const P = HB.party, it = HB.ITEMS[id], now = HB.eff(P);
      const after = HB.eff(Object.assign({}, P, { equip: Object.assign({}, P.equip, { [it.slot]: id }) }));
      return ['atk', 'def', 'spd'].filter((k) => after[k] !== now[k])
        .map((k) => ({ atk: '공격', def: '방어', spd: '속도' })[k] + ' ' + now[k] + ' → ' + after[k]).join('  ') || '변화 없음';
    },
    useItem(id) {
      const P = HB.party, it = HB.ITEMS[id];
      if (it.key) return this.fail('소중한 물건이다. 쓸 수는 없다.');
      if (it.cure) return this.fail('전투 중에만 쓸 수 있다.');
      if ((it.hp && P.hp >= P.maxHp) || (it.mp && P.mp >= P.maxMp)) return this.fail('지금은 쓸 필요가 없다.');
      const got = HB.useItem(P, id);
      HB.sfx('heal');
      this.note = it.name + ': ' + (got.hp ? 'HP +' + got.hp : '울림 +' + got.mp);
      const n = bag(false).length;
      if (!n) this.stack.pop(); else this.mode.cur = Math.min(this.mode.cur, n - 1);
    },
    buy(id) {
      const P = HB.party, it = HB.ITEMS[id];
      if (!HB.buyItem(P, id)) return this.fail('골드가 모자라다.');
      HB.sfx('ok');
      this.note = HB.josa(it.name, '을를') + ' 샀다.' + (it.slot ? ' 메뉴의 장비에서 착용할 수 있다.' : ' (' + P.items[id] + '개 보유)');
    },
    sell(id) {
      const P = HB.party, name = HB.ITEMS[id].name;
      HB.sellItem(P, id);
      HB.sfx('ok');
      this.note = HB.josa(name, '을를') + ' 팔았다. (+' + HB.sellPrice(id) + '골드)';
      this.mode.cur = Math.min(this.mode.cur, Math.max(0, Object.keys(P.items).filter((k) => !HB.isKey(k)).length - 1));
    },

    // ---------- input ----------
    update(w, dt, fading) {
      const inp = HB.input;
      if (!this.open) {
        if (fading || HB.Battle.active || (HB.Cutscene && HB.Cutscene.steps) || !inp.hit('cancel')) return false;
        this.open = true; this.stack = [];
        this.push({ id: 'main' });
        return true;
      }
      const m = this.mode, rows = this.rows(w), n = rows.length;
      if (m.id === 'shop' && (inp.hit('left') || inp.hit('right'))) { m.tab ^= 1; m.cur = 0; this.note = ''; HB.sfx('move'); }
      const row = rows[m.cur];
      if (row && row.adjust && (inp.hit('left') || inp.hit('right'))) row.adjust(inp.hit('left') ? -1 : 1);
      if (n && inp.hit('up')) { m.cur = (m.cur + n - 1) % n; HB.sfx('move'); }
      if (n && inp.hit('down')) { m.cur = (m.cur + 1) % n; HB.sfx('move'); }
      if (inp.hit('cancel')) { this.back(); return true; }
      if (inp.hit('ok') && rows[m.cur]) rows[m.cur].act(); // each act plays its own sound
      return true;
    },

    // ---------- draw ----------
    drawList(g, rows, x, y, wdt, cur) {
      HB.drawWindow(g, x, y, wdt, 14 + rows.length * 16);
      rows.forEach((r, i) => {
        HB.text(g, r.label, x + 18, y + 6 + i * 16, r.dim ? '#8a8aa8' : '#f4f0e8');
        if (r.right) HB.text(g, r.right, x + wdt - 10, y + 7 + i * 16, '#c8c0e0', { font: 'g9', align: 'right' });
        if (i === cur) HB.drawCursor(g, x + 6, y + 9 + i * 16);
      });
    },

    drawOverlay(w, g) {
      if (!this.open || !this.mode) return;
      const P = HB.party, m = this.mode, rows = this.rows(w), sel = rows[m.cur];
      g.fillStyle = 'rgba(10,8,24,0.35)'; g.fillRect(0, 0, HB.W, HB.H);
      if (m.id === 'shop') {
        const x = 70, y = 30, wdt = 340;
        HB.drawWindow(g, x, y, wdt, 22);
        HB.text(g, m.title, x + 12, y + 4, '#ffe08a');
        ['사기', '팔기'].forEach((t, i) => HB.text(g, t, x + 196 + i * 40, y + 5, i === m.tab ? '#fff4d8' : '#7a7a98', { font: 'g9' }));
        HB.text(g, P.gold + '골드', x + wdt - 12, y + 5, '#ffe08a', { font: 'g9', align: 'right' });
        this.drawList(g, rows, x, y + 24, wdt, m.cur);
        this.drawNote(g, this.note || (sel && sel.desc) || '');
        HB.text(g, '좌우: 사기 / 팔기', HB.W - 12, HB.H - 44, '#a898c0', { font: 'g9', align: 'right' });
        return;
      }
      const wide = m.id === 'main' ? 72 : m.id === 'gear' ? 220 : 150;
      if (m.id !== 'main') this.drawList(g, this.rowsOf(w, 'main'), 8, 8, 72, -1); // backdrop, no cursor
      this.drawList(g, rows, m.id === 'main' ? 8 : 20, m.id === 'main' ? 8 : 24, wide, m.cur);
      this.drawNote(g, this.note || (sel && sel.desc) || '');
      if (m.id === 'gear' || m.id === 'items') return; // keep the list readable
      if (HB.menuDraw[m.id]) { HB.menuDraw[m.id](g, w); return; }
      this.drawStatus(g, w);
    },
    rowsOf(w, id) {
      const saved = this.stack;
      this.stack = [{ id, cur: 0 }];
      const r = this.rows(w);
      this.stack = saved;
      return r;
    },

    drawStatus(g, w) {
      const P = HB.party, e = HB.eff(P);
      const x = 176, y = 8, wdt = 200;
      HB.drawWindow(g, x, y, wdt, 192);
      HB.text(g, P.name, x + 12, y + 6, '#ffe08a');
      HB.text(g, 'Lv ' + P.lvl, x + wdt - 12, y + 7, '#c8c0e0', { font: 'g9', align: 'right' });
      HB.drawBar(g, x + 12, y + 30, 'HP', P.hp, P.maxHp, P.hp / P.maxHp < 0.3 ? '#ff7a6a' : '#7ae08a');
      HB.drawBar(g, x + 12, y + 44, '울림', P.mp, P.maxMp, '#7ab0ff');
      const plus = (k) => e[k] + (e[k] !== P[k] ? ' (+' + (e[k] - P[k]) + ')' : '');
      const rows = [
        ['공격', plus('atk')], ['방어', plus('def')], ['속도', plus('spd')],
        ['기술', HB.skillsFor(P.lvl).map((id) => HB.SKILLS[id].name).join(' ')],
        ['동료', P.ally ? HB.ALLIES[P.ally.id].name + '  HP ' + P.ally.hp + '/' + HB.allyStats(P.ally.id, P.lvl).maxHp : '-'],
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

  // later modules add screens: HB.menuScreens[id] = (menu, w) => rows, HB.menuDraw[id] = (g, w) => {}
  HB.menuScreens = {};
  HB.menuDraw = {};
  HB.Menu = Menu;
  HB.worldPlugins.push(Menu);
})(window.HB);
