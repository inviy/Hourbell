// Debug tools, only with ?debug in the address (never shown otherwise):
//   menu > 디버그: warp to any map, level up, toggle story flags, take no damage
//   ?debug&map=<id>&lvl=<n>: skip the title and start a new party on that map
(function (HB) {
  'use strict';

  const q = new URLSearchParams(location.search);
  if (!q.has('debug')) return;
  HB.debug = { god: false, start: q.get('map') ? { map: q.get('map'), lvl: Math.max(1, +q.get('lvl') || 1) } : null };

  const FLAGS = [1, 2, 3, 4, 5, 6, 7].flatMap((n) => ['boss' + n, 'fragment' + n, 'chapter' + n]);
  HB.Menu.hooks.push({ label: '디버그', mode: 'debug' });
  HB.menuScreens.debug = (menu) => {
    const P = HB.party;
    return [
      { label: '워프', desc: '아무 지도로나 바로 간다', act: () => menu.push({ id: 'debugWarp' }) },
      { label: '레벨 +1', right: 'Lv ' + P.lvl, desc: 'HP와 울림도 채운다', act: () => { HB.levelUp(P); P.hp = P.maxHp; P.mp = P.maxMp; } },
      { label: '무적', right: HB.debug.god ? '켬' : '끔', desc: '적에게 받는 피해 0', act: () => { HB.debug.god = !HB.debug.god; } },
      { label: '플래그', desc: '장 진행 플래그를 켜고 끈다', act: () => menu.push({ id: 'debugFlags' }) }
    ];
  };
  HB.menuScreens.debugWarp = (menu, w) => Object.keys(HB.MAPS).map((id) => ({ label: id, act: () => { menu.close(); w.load(id); } }));
  HB.menuScreens.debugFlags = (menu, w) => FLAGS.map((k) => ({ label: k, right: w.flags[k] ? '켬' : '끔', act: () => { w.flags[k] = !w.flags[k]; } }));
  HB.menuDraw.debug = HB.menuDraw.debugWarp = HB.menuDraw.debugFlags = () => {};

  // ?map=: a fresh party at the level asked, on that map
  HB.debugStart = function () {
    const s = HB.debug.start, w = HB.World;
    if (!s || !HB.MAPS[s.map]) return false;
    HB.party = HB.newParty();
    while (HB.party.lvl < s.lvl) HB.levelUp(HB.party);
    HB.party.hp = HB.party.maxHp; HB.party.mp = HB.party.maxMp;
    w.flags = {}; w.visited = { intro: true };
    HB.setScene(w, { map: s.map });
    return true;
  };
})(window.HB);
