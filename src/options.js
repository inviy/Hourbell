// Options: volumes, text speed and comfort switches. Stored apart from the
// save so they apply on the title screen and survive a new game.
(function (HB) {
  'use strict';

  const KEY = 'hourbell.options';
  const store = () => { try { return window.localStorage; } catch (e) { return null; } };
  try { HB.options = HB.sanitizeOptions(JSON.parse(store().getItem(KEY))); } catch (e) { /* defaults */ }

  function set(k, v) {
    HB.options = HB.sanitizeOptions(Object.assign({}, HB.options, { [k]: v }));
    try { store().setItem(KEY, JSON.stringify(HB.options)); } catch (e) { /* blocked storage: lasts this session */ }
    HB.setVolume();
    HB.sfx('move'); // plays at the new effect volume
  }

  const TEXT = ['느림', '보통', '빠름'];
  HB.Menu.hooks.push({ label: '옵션', mode: 'options' });
  const ISSUES = 'https://github.com/inviy/Hourbell/issues';
  HB.menuScreens.options = (menu) => {
    const O = HB.options;
    const num = (k, label, desc) => ({ label, right: '< ' + O[k] + ' >', desc, adjust: (d) => set(k, O[k] + d), act: () => set(k, (O[k] + 1) % 11) });
    const flag = (k, label, desc) => ({ label, right: O[k] ? '켬' : '끔', desc, adjust: () => set(k, !O[k]), act: () => set(k, !O[k]) });
    return [
      num('music', '음악', '배경 음악 크기 (좌우로 조절)'),
      num('sfx', '효과음', '효과음 크기 (좌우로 조절)'),
      { label: '글자 속도', right: '< ' + TEXT[O.text] + ' >', desc: '대사가 나오는 속도', adjust: (d) => set('text', (O.text + d + 3) % 3), act: () => set('text', (O.text + 1) % 3) },
      flag('shake', '화면 흔들림', '전투 중 화면 흔들림'),
      flag('flash', '섬광, 왜곡', '전투 시작의 번쩍임과 화면 일렁임. 빛에 민감하면 끄세요.'),
      // a popup blocker may stop the new tab: the address stays on screen
      { label: '의견 보내기', desc: '버그나 의견을 GitHub Issues에 남긴다 (새 창)', act: () => {
        HB.sfx('ok');
        const tab = window.open(ISSUES, '_blank'); // ('noopener' would always return null)
        if (tab) tab.opener = null;
        else menu.note = '새 창이 막혔다. 주소: github.com/inviy/Hourbell/issues';
      } }
    ];
  };
  HB.menuDraw.options = () => {}; // just the list, no status panel
})(window.HB);
