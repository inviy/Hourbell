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
      flag('easy', '쉬움', '적에게 받는 피해가 3/4로 줄어든다. 언제든 바꿀 수 있다'),
      num('music', '음악', '배경 음악 크기 (좌우로 조절)'),
      num('sfx', '효과음', '효과음 크기 (좌우로 조절)'),
      { label: '글자 속도', right: '< ' + TEXT[O.text] + ' >', desc: '대사가 나오는 속도', adjust: (d) => set('text', (O.text + d + 3) % 3), act: () => set('text', (O.text + 1) % 3) },
      flag('shake', '화면 흔들림', '전투 중 화면 흔들림'),
      flag('flash', '섬광, 왜곡', '전투 시작의 번쩍임과 화면 일렁임. 빛에 민감하면 끄세요.'),
      { label: '음악 감상', desc: '들어 본 곡을 골라 듣는다', act: () => menu.push({ id: 'jukebox' }) },
      { label: '바뀐 점', desc: '버전마다 바뀐 점(패치 노트)을 새 창으로 본다', act: () => {
        HB.sfx('ok');
        const tab = window.open('https://github.com/inviy/Hourbell/blob/main/CHANGELOG.md', '_blank');
        if (tab) tab.opener = null; else menu.note = '새 창이 막혔다. 주소: github.com/inviy/Hourbell 의 CHANGELOG.md';
      } },
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

  // 음악 감상: each song opens once the story has played it (flag; none = from the start)
  HB.JUKEBOX = [
    ['title', '타이틀'], ['town', '울림골'], ['field', '바람결 들판'], ['battle', '전투'], ['boss', '보스', 'boss1'],
    ['fieldBell', '들판의 종', 'fragment1'], ['mist', '물안개 길', 'chapter1'], ['port', '물안개 항구', 'chapter1'], ['portBell', '항구의 종', 'fragment2'],
    ['canyon', '메아리 협곡', 'chapter2'], ['mine', '울림 광산', 'chapter2'], ['past', '50년 전 울림골', 'chapter3'], ['pastwood', '째깍 숲', 'chapter3'],
    ['snow', '눈꽃 산마루', 'chapter4'], ['snowBell', '얼음 종', 'fragment5'], ['stars', '별빛 천문대', 'chapter5'], ['starsBell', '별의 종', 'fragment6'],
    ['bellcore', '아워벨 내부', 'chapter6'], ['finalBoss', '정적', 'fragment7'], ['finale', '일곱 소절', 'fragment7'], ['townNight', '울림골의 밤', 'chapter7']
  ];
  HB.menuScreens.jukebox = (menu, w) => HB.JUKEBOX.map(([id, label, need]) => (need && !w.flags[need]
    ? { label: '???', dim: true, desc: '이야기를 더 진행하면 들을 수 있다', act: () => menu.fail('아직 들어 보지 못한 곡이다.') }
    : { label, desc: label + ' (메뉴를 닫으면 원래 음악으로)', act: () => { HB.music.play(id, { restart: true, fadeIn: 0.3 }); menu.listening = true; menu.note = '재생 중: ' + label; } }));
  HB.menuDraw.jukebox = () => {};
})(window.HB);
