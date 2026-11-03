// Screen layout on phones, tablets and PCs: the game must not sit under the
// on-screen D-pad or A / B buttons, phones in portrait fill the width, and
// PCs and tablets keep whole-number pixel scaling. Saves a screenshot of each
// with a dialog open, and of the map screen. Run: node tests/layout.mjs   (about a minute)
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const VIEWS = [
  // name, css width, height, device pixel ratio, touch phone/tablet?
  ['phone-portrait', 390, 844, 3, true],
  ['phone-landscape', 844, 390, 3, true],
  ['small-phone-portrait', 375, 667, 2, true],
  ['small-phone-landscape', 667, 375, 2, true],
  ['tablet-portrait', 820, 1180, 2, true],
  ['tablet-landscape', 1180, 820, 2, true],
  ['pc-1080p', 1920, 1080, 1, false],
  ['pc-4k', 3840, 2160, 1, false],
  ['laptop-4k-200', 1920, 1080, 2, false]
];

const { OUT, URL_, send, ev, sleep, shot, errors, close } = await openGame('hourbell-layout');
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
try {
  await send('Runtime.enable'); await send('Page.enable');
  // headless Chrome reports touch points even on a PC: a mouse PC has none
  let noTouch = null;
  for (const [name, w, h, dpr, touch] of VIEWS) {
    if (!touch && !noTouch) noTouch = (await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 })" })).result.identifier;
    if (touch && noTouch) { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: noTouch }); noTouch = null; }
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: touch });
    await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    await send('Page.navigate', { url: URL_ }); await sleep(2500);
    await ev(`HB.setScene(HB.World, { map: 'town' })`); await sleep(1500);
    await ev(`HB.dialog.open('대화창이 버튼에 가리지 않는지 확인하는 문장입니다. 끝까지 보여야 합니다.')`); await sleep(1500);
    await shot('layout-' + name);
    // phones in portrait: the line moves to the HTML panel between the game and the buttons
    const talk = () => ev(`(() => {
      const t = document.getElementById('hb-talk'), r = t && t.getBoundingClientRect();
      if (!t || getComputedStyle(t).display === 'none') return null;
      return { box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, on: t.classList.contains('on'), text: t.innerText,
        fit: t.scrollHeight <= t.clientHeight + 1, choices: t.querySelectorAll('li').length, cur: (t.querySelector('li.cur') || {}).textContent || null,
        minFont: Math.min(...[...t.querySelectorAll('*')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))) };
    })()`);
    const portraitPhone = touch && h > w && Math.min(w, h) < 600;
    const panel = await talk();
    if (!portraitPhone) assert.equal(panel, null, name + ': no dialogue panel');
    else {
      assert.ok(panel && panel.on && panel.text.includes('끝까지 보여야 합니다'), name + ': the line is in the panel');
      assert.ok(panel.minFont >= 16, name + ': panel text is 16px or more (' + panel.minFont + ')');
      assert.ok(panel.fit, name + ': the line fits without scrolling');
      assert.ok(panel.box.left >= 0 && panel.box.right <= w && panel.box.bottom <= h, name + ': panel on screen');
      await ev(`HB.dialog.open('어느 쪽으로 갈까?', { name: '미오', choices: ['항구', '광산', '그만두기'] })`); await sleep(300);
      await ev(`HB.input.press('down'); setTimeout(() => HB.input.release('down'), 50)`); await sleep(300);
      const ch = await talk();
      assert.ok(ch.text.startsWith('미오') && ch.choices === 3 && ch.cur === '광산', name + ': speaker and choices, cursor follows');
      await ev(`(() => { HB.dialog.close(); HB.Menu.open = true; HB.Menu.stack = []; HB.Menu.push({ id: 'main' }); HB.Menu.push({ id: 'items' }); })()`); await sleep(300);
      const mn = await talk();
      assert.ok(mn.on && mn.text.startsWith(await ev("HB.ITEMS[Object.keys(HB.party.items)[0]].name")), name + ': menu help in the panel (' + mn.text + ')');
      await ev('HB.Menu.close()'); await sleep(200);
      await ev(`(() => { const p = HB.World.player; HB.Battle.start(HB.World, [{ kind: 'wisp', x: p.x + 48, y: p.y }]); })()`); await sleep(1500);
      const bt = await talk();
      assert.ok(bt.on && /나타났다/.test(bt.text), name + ': battle message in the panel (' + bt.text + ')');
      await ev(`(() => { HB.Battle.active = false; HB.setScene(HB.World, { map: 'town' }); })()`); await sleep(1200);
      assert.equal((await talk()).on, false, name + ': empty panel when nothing is said');
      await ev(`HB.dialog.open('대화창이 버튼에 가리지 않는지 확인하는 문장입니다. 끝까지 보여야 합니다.')`); await sleep(300);
    }
    // the map screen late in the story (most regions shown), for legibility
    await ev(`(() => { HB.dialog.close(); Object.assign(HB.World.flags, { chapter1: true, chapter2: true, chapter3: true, chapter4: true, chapter5: true, chapter6: true, grovePuzzle: true });
      HB.Menu.open = true; HB.Menu.stack = []; HB.Menu.push({ id: 'main' }); HB.Menu.push({ id: 'map' }); })()`);
    await sleep(400); await shot('map-' + name);
    await ev('HB.Menu.close()');
    const m = await ev(`(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const c = document.getElementById('screen');
      return { canvas: box(c), px: c.width, controls: [...document.querySelectorAll('.hb-pad, .hb-btn')].map(box), touch: !!HB.touchControls };
    })()`);
    const c = m.canvas, scale = m.px / 480;
    const line = name + ': game ' + Math.round(c.width) + 'x' + Math.round(c.height) + ' css, ' + (c.width * dpr / 480).toFixed(2) + 'x';
    console.log(line);
    assert.ok(c.left >= -0.5 && c.top >= -0.5 && c.right <= w + 0.5 && c.bottom <= h + 0.5, name + ': the game fits the screen');
    assert.equal(m.touch, touch, name + ': on-screen controls only on touch screens');
    for (const k of m.controls) assert.ok(!overlap(c, k), name + ': no control over the game');
    if (panel) for (const k of [c, ...m.controls]) assert.ok(!overlap(panel.box, k), name + ': the panel overlaps neither the game nor a control');
    if (name.startsWith('phone') || name.startsWith('small-phone')) {
      if (h > w) assert.ok(c.width >= w - 1, name + ': portrait fills the width');
      assert.ok(c.width >= 320, name + ': not tiny');
    } else {
      assert.ok(Number.isInteger(scale) && Math.abs(c.width * dpr - m.px) < 0.5, name + ': whole-number pixels (' + scale + 'x)');
    }
  }
  assert.deepEqual(errors, [], 'no JS errors');
  console.log('ok, screenshots in ' + OUT);
} catch (e) {
  console.error('FAILED:', e.message);
  if (errors.length) console.error('JS errors:', errors);
  process.exitCode = 1;
} finally { close(); }
