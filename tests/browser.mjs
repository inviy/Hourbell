// Headless Chrome driving the real game over the DevTools protocol, shared by
// tests/smoke.mjs (plays the story) and tests/real.mjs (real boss fights).
// Chrome runs muted. Set CHROME=/path/to/chrome if it is not found.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function openGame(name) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const OUT = join(tmpdir(), name);
  const CHROME = process.env.CHROME || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].find(existsSync);
  if (!CHROME) { console.error('Chrome not found; set CHROME=/path/to/chrome'); process.exit(2); }

  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    try {
      if (path.includes('..')) throw new Error('bad path');
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const URL_ = 'http://127.0.0.1:' + server.address().port + '/';

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const PORT = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + join(OUT, 'profile'),
    '--window-size=960,540', '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank']);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
    if (!page) await sleep(200);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pend = {}, errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + JSON.stringify(m.params.args.map((a) => a.value)));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(expr + ' -> ' + r.result.exceptionDetails.exception?.description);
    return r.result.result?.value;
  };
  const key = async (code, hold = 60) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code }); await sleep(hold);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code }); await sleep(120);
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
  };
  const W = 'HB.World';
  const busy = () => ev('HB.dialog.active || !!HB.Cutscene.steps');
  const drain = async () => { for (let i = 0; i < 30 && await busy(); i++) { await key('KeyZ'); await sleep(300); } };
  const talkTo = async (npc) => {
    await ev(`(() => { const n = ${W}.npcs.find((n) => n.def.id === '${npc}'); n.def.wander = 0; n.target = null;
      ${W}.player.x = n.x; ${W}.player.y = n.y + 15; ${W}.player.dir = 'up'; })()`);
    await key('KeyZ'); await sleep(300);
  };
  // finish a battle: drop every foe to 1 HP and attack until it is over
  const winBattle = async () => {
    await ev('HB.Battle.foes.forEach((f) => { if (f.hp > 0) f.hp = 1; })');
    for (let i = 0; i < 60 && await ev('HB.Battle.active'); i++) {
      const phase = await ev('HB.Battle.phase');
      if (phase === 'menu') await ev('HB.Battle.cursor = 0');
      if (phase === 'menu' || phase === 'target' || await ev('!!HB.Battle.waitingOk')) await key('KeyZ');
      await sleep(400);
    }
  };
  const close = () => { ws.close(); chrome.kill(); server.close(); };
  return { OUT, URL_, W, send, ev, key, sleep, shot, busy, drain, talkTo, winBattle, errors, close };
}
