// Real pointer regression check, using Chrome's built-in debugging protocol.
// CHROME_BIN can point at another Chromium executable. No saved workshop is loaded.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read) {
  for (let i = 0; i < 100; i++) {
    const result = await read();
    if (result) return result;
    await pause(50);
  }
  throw Error('Browser check timed out');
}
const candidates = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
const chrome = await until(async () => {
  for (const path of candidates) { try { await access(path); return path; } catch {} }
  throw Error('Set CHROME_BIN to a Chrome or Chromium executable');
});
const profile = await mkdtemp(join(tmpdir(), 'nozzle-drag-'));
await mkdir('.scratch', { recursive: true });
const fixture = `.scratch/drag-check-${process.pid}.html`;
let server, browser, ws;
try {
  await writeFile(fixture, `<!doctype html><html><body><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BuildDetail} from '/src/screens/BuildDetail.tsx';
import {seedState} from '/src/seed.ts';
import * as workshop from '/src/workshop.ts';
import '/src/index.css';
const noop=()=>{};
function Preview(){
 const [state,setState]=React.useState(()=>{
  let s=seedState(); s.builds[0].parts=s.builds[0].parts.slice(0,6);
  const mode=new URLSearchParams(location.search).get('mode');
  if(mode==='motion') {
   s.builds[0].parts=s.builds[0].parts.slice(0,3);
   s.builds[0].parts.forEach((p,i)=>{if(i>0)p.note='ready for second round of graphite powder';});
   s=workshop.linkParts(s,s.builds[0].parts.map(p=>p.id));
  }
  if(mode==='group') s=workshop.linkParts(s,['p2','p3']);
  if(mode==='pairs'){
   s=workshop.nameAssembly(workshop.linkParts(s,['p1','p2']),'p1','Left arm');
   s=workshop.nameAssembly(workshop.linkParts(s,['p3','p4']),'p3','Right arm');
  }
  return s;
 });
 window.previewState=state;
 return React.createElement(BuildDetail,{build:state.builds[0],onNavigate:noop,onBack:noop,
  onAddPart:noop,onEditSteps:noop,onRenameBuild:noop,onDeleteBuild:noop,onLinkPart:noop,
  onSetImage:noop,onSetNote:noop,onNameAssembly:noop,
  onDrop:drop=>{window.dropCalls=(window.dropCalls||0)+1;setState(s=>workshop.dropParts(s,drop));},
  rowActions:{onMove:noop,onRename:noop,onNote:noop,onDelete:noop}});
}
createRoot(document.getElementById('root')).render(React.createElement(Preview));
</script></body></html>`);
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  const origin = await until(() => output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]);
  browser = spawn(chrome, ['--headless', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
  const port = await until(async () => {
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { return null; }
  });
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let next = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') console.error(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (!message.id) return;
    const call = pending.get(message.id);
    pending.delete(message.id);
    message.error ? call.reject(message.error) : call.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y,
    button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  const box = selector => evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
  const parts = () => evaluate('window.previewState.builds[0].parts');
  const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  async function load(mode = 'loose') {
    const loaded = new Promise(resolve => ws.addEventListener('message', function onMessage(event) {
      if (JSON.parse(event.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', onMessage); resolve(); }
    }));
    const navigation = await send('Page.navigate', { url: `${origin}/${fixture}?mode=${mode}` });
    assert.ok(!navigation.errorText, navigation.errorText);
    await loaded;
    try { await until(() => evaluate('!!window.previewState')); }
    catch (error) { console.error(await evaluate('JSON.stringify({url:location.href,body:document.body.outerHTML.slice(0,1500)})')); throw error; }
    await click('View: Tiles');
  }
  async function lift(selector) {
    const source = await box(selector);
    const x = source.x + 180, y = source.y + source.height / 2;
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y);
    await mouse('mouseMoved', x, y + 8);
    await pause(50);
    return x;
  }
  async function drop(x, y) {
    await mouse('mouseMoved', x, y);
    await pause(220);
    await mouse('mouseReleased', x, y);
    await pause(120);
    assert.equal(await evaluate('window.dropCalls'), 1, 'one complete action per drop');
  }
  // A continuous drag through the source and its neighbours must not resize
  // the assembly. Checking only that a gap exists missed this bounce.
  await load('motion');
  const first = await box('[data-part="p1"]'), last = await box('[data-part="p3"]');
  const dragX = await lift('[data-part="p2"]');
  await evaluate(`window.motion=[]; window.recording=true;
    function record(){if(!window.recording)return;
      window.motion.push({height:document.querySelector('[data-group]').getBoundingClientRect().height,
        animated:Array.from(document.querySelectorAll('[data-part]')).some(e=>e.getAnimations().length>0)});
      requestAnimationFrame(record);
    }record();`);
  const low = first.y + first.height / 2, high = last.y + last.height - 1;
  for (const [from, to, step] of [[low, high, 3], [high, low, -6], [low, high, 6]]) {
    for (let y = from; step > 0 ? y < to : y > to; y += step) {
      await mouse('mouseMoved', dragX, y);
      await pause(12);
    }
  }
  await pause(250);
  const motion = await evaluate('window.recording=false;window.motion');
  const heights = motion.map(frame => frame.height);
  assert.ok(motion.some(frame => frame.animated), 'neighbouring rows should slide, not snap');
  assert.ok(Math.max(...heights) - Math.min(...heights) < 2,
    `assembly bounces during internal reorder: ${Math.min(...heights)}..${Math.max(...heights)}px`);
  await mouse('mouseReleased', dragX, last.y + last.height - 3);
  console.log('drag motion: rows slide while assembly height stays constant, including reversals');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await load('motion');
  const reducedTarget = await box('[data-part="p3"]');
  const reducedX = await lift('[data-part="p2"]');
  await mouse('mouseMoved', reducedX, reducedTarget.y + reducedTarget.height - 8);
  await pause(30);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-part],[data-group]')).some(e=>e.getAnimations().length>0)`), false);
  await mouse('mouseReleased', reducedX, reducedTarget.y + reducedTarget.height - 8);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  for (const [mode, selector, source] of [
    ['loose', '[data-part="p2"]', 'p1'],
    ['group', '[data-part="p2"]', 'p1'],
    ['group', '[data-group]', 'p1'],
    ['group', '[data-part="p1"]', 'p6'],
    ['pairs', '[data-group]', 'p5'],
  ]) {
    await load(mode);
    const boundary = await box(selector);
    const x = await lift(`[data-part="${source}"]`);
    await mouse('mouseMoved', x, boundary.y + boundary.height - 8);
    await pause(220);
    for (let offset = -8; offset <= 20; offset += 2) {
      await mouse('mouseMoved', x, boundary.y + boundary.height + offset);
      await pause(180);
      const gap = await evaluate(`Array.from(document.querySelectorAll('[data-drop-gap]')).some(e=>e.getBoundingClientRect().height>4)`);
      assert.ok(gap, `${mode}: insertion gap collapsed at boundary offset ${offset}`);
    }
    await mouse('mouseReleased', x, boundary.y + boundary.height + 20);
    console.log(`drag boundary: ${mode} ${selector} stable`);
  }
  await load();
  const seam = await box('[data-part="p2"]');
  await drop(await lift('[data-part="p1"]'), seam.y + seam.height + 4);
  assert.deepEqual((await parts()).slice(0, 3).map(p => p.id), ['p2', 'p1', 'p3']);

  for (const progress of [false, true]) {
    await load('pairs');
    if (progress) await click('Sort: Manual');
    const initial = await parts();
    const target = await box('[data-part="p4"]');
    await drop(await lift('[data-part="p1"]'), target.y + 8);
    const after = await parts();
    assert.equal(after.find(p => p.id === 'p1').linkGroupName, 'Right arm');
    assert.equal(after.find(p => p.id === 'p2').linkGroupId, undefined);
    assert.deepEqual(after.map(p => p.id), progress ? initial.map(p => p.id) : ['p2', 'p3', 'p1', 'p4', 'p5', 'p6']);
  }
  await load('pairs');
  const initial = await parts();
  const groupId = initial[0].linkGroupId;
  const target = await box('[data-part="p4"]');
  const head = await box(`[data-group="${groupId}"] > [class*="groupHead"]`);
  await mouse('mouseMoved', head.x + 180, head.y + head.height / 2);
  await mouse('mousePressed', head.x + 180, head.y + head.height / 2);
  await mouse('mouseMoved', head.x + 180, head.y + head.height / 2 + 8);
  await pause(50);
  await drop(head.x + 180, target.y + target.height - 8);
  const after = await parts();
  assert.deepEqual(after.map(p => p.id), ['p3', 'p4', 'p1', 'p2', 'p5', 'p6']);
  assert.equal(after.find(p => p.id === 'p1').linkGroupId, groupId);
  assert.notEqual(after.find(p => p.id === 'p3').linkGroupId, groupId);
  await load();
  const unchanged = await parts();
  const x = await lift('[data-part="p1"]');
  await mouse('mouseMoved', x, seam.y + seam.height + 4);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await mouse('mouseReleased', x, seam.y + seam.height + 4);
  await pause(180);
  assert.deepEqual(await parts(), unchanged);
  assert.equal(await evaluate('window.dropCalls || 0'), 0, 'Escape discards the drop');
  console.log('drag drops: order, assembly transfer, Progress, whole-assembly moves and cancel ok');

} finally {
  ws?.close();
  for (const child of [browser, server]) {
    if (child && child.exitCode === null) {
      const closed = new Promise(resolve => child.once('close', resolve));
      child.kill();
      await closed;
    }
  }
  await rm(fixture, { force: true });
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
