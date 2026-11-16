'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { existsSync } = require('node:fs');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  const binary = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => p && existsSync(p));
  assert(binary, 'Install Chrome or set CHROME_BIN to run the cockpit check.');
  assert.equal(typeof WebSocket, 'function', 'The cockpit check needs Node 22 or newer.');
  const output = await mkdtemp(join(tmpdir(), 'semi-cockpit-'));
  const profile = join(output, 'profile');
  const chrome = spawn(binary, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const port = await new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error('Chrome did not start within 15 seconds.')), 15000);
      let text = '';
      chrome.once('error', error => { clearTimeout(timer); reject(error); });
      chrome.stderr.on('data', chunk => {
        text += chunk;
        const match = text.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timer); accept(match[1]); }
      });
    });
    const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await once(socket, 'open');
    let sequence = 0;
    const pending = new Map(), errors = [], network = [];
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (data.id) {
        const request = pending.get(data.id);
        if (!request) return;
        pending.delete(data.id); clearTimeout(request.timer);
        if (data.error) request.reject(new Error(JSON.stringify(data.error)));
        else request.accept(data.result);
      } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
      else if (data.method === 'Network.requestWillBeSent') network.push(data.params.request.url);
    });
    function call(method, params = {}) {
      return new Promise((accept, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
        pending.set(id, { accept, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function js(expression) {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function until(expression) {
      const end = Date.now() + 8000;
      while (Date.now() < end) {
        if (await js(expression)) return;
        await delay(80);
      }
      assert.fail(`Condition did not become true: ${expression}`);
    }
    const size = (width, height) => call('Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false });
    async function shot(name) {
      const { data } = await call('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(output, `${name}.png`), Buffer.from(data, 'base64'));
    }
    const key = (type, value) => call('Input.dispatchKeyEvent', { type, key: value, code: `Key${value.toUpperCase()}` });

    await call('Runtime.enable');
    await call('Network.enable');
    await call('Page.enable');
    await size(844, 390);
    const gameUrl = process.argv[2] || pathToFileURL(resolve(__dirname, '../index.html')).href;
    await call('Page.navigate', { url: gameUrl });
    await until("typeof s !== 'undefined' && s !== null && typeof renderer !== 'undefined'");
    await js("document.getElementById('go').click()");
    await until('running && lastView !== ""');
    await shot('cockpit-844');
    assert.equal(await js('lastView'), 'Cab', 'A new shift must start in the inside POV.');
    assert.equal(await js("document.querySelectorAll('#cockpit .cab-screen').length"), 2, 'Cab has two screens.');
    await until("document.getElementById('cockpit').getBoundingClientRect().height > 0");

    const initialWheel = await js("getComputedStyle(document.getElementById('cabWheel')).transform");
    await key('keyDown', 'd');
    await until('input.steer > 0.15');
    assert.notEqual(await js("getComputedStyle(document.getElementById('cabWheel')).transform"), initialWheel,
      'The wheel must respond to steering.');
    await key('keyUp', 'd');
    await key('keyDown', 'w');
    await until('s.v > 0.15');
    await key('keyUp', 'w');
    await key('keyDown', 's');
    await until('Math.abs(s.v) < 0.05');
    await key('keyUp', 's');
    await js("document.getElementById('gear').click()");
    await until("s.gear < 0 && lastView === 'Top'");
    assert.equal(await js("getComputedStyle(document.getElementById('cockpit')).display"), 'none',
      'The cab must not cover the reverse docking view.');
    await shot('reverse-top');
    await js("document.getElementById('gear').click()");
    await until("s.gear > 0 && lastView === 'Cab'");
    for (const view of ['Top', 'Chase', 'Cab']) {
      await js("document.getElementById('cam').click()");
      await until(`lastView === '${view}'`);
    }
    await js("document.getElementById('cam').focus()");
    await key('keyDown', 'w');
    assert(await js("keys.has('w')"), 'A focused camera button must not block driving keys.');
    await key('keyUp', 'w');
    await js('document.activeElement.blur()');

    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const pads = await js(`['steer', 'accel'].map((id, i) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return {id: i + 1, x: r.left + r.width * (i ? .5 : .72), y: r.top + r.height * .3};
    })`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pads[0]] });
    const heldSteer = await js('touch.steer');
    const stray = await js(`(() => {
      const r = document.getElementById('steer').getBoundingClientRect();
      return {id: 4, x: r.left + 12, y: r.top + r.height / 2};
    })()`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pads[0], stray] });
    assert.equal(await js('touch.steer'), heldSteer, 'A second finger must not take over a held pad.');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [stray] });
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pads });
    await until('input.steer > .2 && input.throttle > .5');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pads[1]] });
    await until('input.steer > .2 && input.throttle === 0');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await until('touch.steer === null && input.steer === 0');
    await key('keyDown', 's');
    await until('Math.abs(s.v) < .05');
    await key('keyUp', 's');

    for (const [width, height] of [[667, 375], [780, 360], [915, 412], [1024, 768], [1180, 820], [1440, 900]]) {
      await size(width, height);
      await delay(160);
      const fits = await js(`Array.from(document.querySelectorAll('#cockpit .cab-screen, #steer, #brake, #accel, #gear')).every(el => {
        const r = el.getBoundingClientRect();
        return r.width >= 44 && r.height >= 44 && r.left >= -1 && r.top >= -1 &&
          r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      })`);
      assert(fits, `Screens and controls must fit at ${width}×${height}.`);
      const separate = await js(`Array.from(document.querySelectorAll('#cockpit .cab-screen')).every(screen => {
        const a = screen.getBoundingClientRect();
        return ['steer', 'brake', 'accel', 'gear'].every(id => {
          const b = document.getElementById(id).getBoundingClientRect();
          return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        });
      })`);
      assert(separate, `Touch controls must not cover an instrument screen at ${width}×${height}.`);
      assert(await js("document.getElementById('mapInfo').scrollWidth <= document.getElementById('mapInfo').clientWidth"),
        `Navigation text must fit at ${width}×${height}.`);
      await shot(`cockpit-${width}`);
    }
    await size(844, 390);
    const held = await js(`(() => {
      const r = document.getElementById('accel').getBoundingClientRect();
      return {id: 3, x: r.left + r.width / 2, y: r.top + r.height / 3};
    })()`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [held] });
    await until('input.throttle > .5');
    await size(390, 844);
    await until("getComputedStyle(document.getElementById('rotate')).display !== 'none'");
    const time = await js('s.time');
    await delay(200);
    assert.equal(await js('s.time'), time, 'The mission pauses in portrait.');
    assert.equal(await js('input.throttle'), 0, 'Rotation must release a held accelerator.');
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await shot('portrait');
    assert.deepEqual(errors, [], 'The browser must not throw.');
    assert(!network.some(url => /^https?:/.test(url) && new URL(url).origin !== new URL(gameUrl).origin),
      'The game must not load external resources.');
    console.log('PASS: inside POV, two screens, driving, reverse, camera cycle, two-thumb input, phone/tablet layouts, portrait pause/input release, no external assets.');
    console.log(`Screenshots: ${output}`);
  } finally {
    socket?.close();
    if (chrome.exitCode === null) {
      chrome.kill('SIGTERM');
      await Promise.race([once(chrome, 'exit'), delay(3000)]);
      if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await once(chrome, 'exit'); }
    }
    await rm(profile, { recursive: true, force: true });
    console.log(`Browser evidence: ${output}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
