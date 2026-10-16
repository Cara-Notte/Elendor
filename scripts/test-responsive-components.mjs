import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { JSDOM, VirtualConsole } from 'jsdom';

// Component regressions only: JSDOM cannot verify painted layouts or real touch devices.
// Container dimensions and collision/location pixels below are deterministic fixtures.
const root = fileURLToPath(new URL('../', import.meta.url));
const { output } = await build({root, logLevel:'silent', build:{write:false}});
const bundle = output.find(item => item.type === 'chunk').code;
const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
const errors = [];
let width = 390, height = 844;
const observers = new Set();
const dom = new JSDOM('<style>' + css + '</style><div id="root"></div>', {
  url: 'https://elendor-test.invalid/', runScripts: 'outside-only', pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
});
const { window: w } = dom;
w.addEventListener('error', event => errors.push(event.error?.stack || event.message));
Object.defineProperty(w, 'innerWidth', {get: () => width});
Object.defineProperty(w, 'innerHeight', {get: () => height});
Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', {get() {
  if (this.dataset.testid === 'map-frame') return width >= 480 && height <= 480 ? width - Math.max(200, Math.min(220, width * .26)) : width <= 768 ? width : width - Math.max(220, Math.min(300,width * .22));
  return 400;
}});
Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', {get() {
  if (this.dataset.testid === 'map-frame') return height - 60 - (width <= 768 && !(width >= 480 && height <= 480) ? 220 : 0);
  return 300;
}});
w.ResizeObserver = class {
  constructor(callback) { this.callback = callback; }
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
};
w.HTMLElement.prototype.setPointerCapture = function() {};
w.HTMLMediaElement.prototype.play = () => Promise.resolve();
w.HTMLMediaElement.prototype.pause = () => {};
// Fixtures isolate component/input behavior; these do not constitute collision-image tests.
w.Image = class {
  width = 1; height = 1;
  set src(value) { this._src = value; setTimeout(() => this.onload?.(), 0); }
  get src() { return this._src; }
};
w.HTMLCanvasElement.prototype.getContext = () => ({drawImage() {},getImageData() {return {data:new Uint8ClampedArray([237,32,36,255])};}});
w.fetch = () => Promise.resolve({ok:true,json:async()=>({})});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(callback, message) {
  const end = Date.now() + 6000;
  while (Date.now() < end) { if (callback()) return; await wait(20); }
  throw new Error(message);
}
const doc = w.document;
const byText = text => [...doc.querySelectorAll('button')].find(el => el.textContent.trim() === text);
const click = el => { assert(el, 'Expected control exists'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); };
function pointer(el, type, pointerId=1) {
  const event = new w.MouseEvent(type,{bubbles:true,button:0});
  Object.defineProperty(event,'pointerId',{value:pointerId});
  el.dispatchEvent(event);
}
const playerX = () => parseFloat(doc.querySelector('[data-testid="player"]').style.left);
const results = [];
try {
  w.eval(bundle);
  await until(() => doc.querySelector('.card-container'),'Character menu failed to load');
  click(doc.querySelector('.character-card'));
  await until(() => byText("Yes, I'm sure"),'Selection confirmation missing');
  click(byText("Yes, I'm sure"));
  await until(() => doc.querySelector('#playerName'),'Character details missing');
  const input = doc.querySelector('#playerName');
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,'Responsive QA');
  input.dispatchEvent(new w.Event('input',{bubbles:true}));
  await until(() => !doc.querySelector('#startBtn').disabled,'Name input did not enable start');
  click(doc.querySelector('#startBtn'));
  await until(() => doc.querySelector('[data-testid="player"]'),'World did not initialize');
  results.push('Character selection, name entry and game initialization');

  for (const [newW,newH] of [[320,568],[390,844],[768,1024],[844,390],[1366,768],[768,390],[568,320]]) {
    width=newW; height=newH;
    const xBefore=playerX();
    for (const observer of observers) observer.callback();
    w.dispatchEvent(new w.Event('resize'));
    await wait(30);
    const frame=doc.querySelector('[data-testid="map-frame"]');
    const styles=w.getComputedStyle(frame);
    const availableW=frame.clientWidth-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight);
    const availableH=frame.clientHeight-parseFloat(styles.paddingTop)-parseFloat(styles.paddingBottom);
    const scale=Number(doc.querySelector('[data-testid="gameplay-viewport"]').style.transform.match(/scale\((.*)\)/)[1]);
    assert(scale>0 && 400*scale<=availableW+.01 && 300*scale<=availableH+.01,`Viewport overflow at ${width}x${height}`);
    assert(Math.abs(400*scale-availableW)<.01 || Math.abs(300*scale-availableH)<.01,'Scale does not maximize usable area');
    assert.equal(playerX(),xBefore,'Resizing changed world position');
  }
  results.push('Resize-hook fit checks for seven container fixtures; world position preserved');

  assert.equal(w.getComputedStyle(doc.querySelector('[data-testid="game-panels"]')).display,'none');
  click(byText('I')); await wait(30);
  assert.equal(w.getComputedStyle(doc.querySelector('[data-testid="game-panels"]')).display,'flex');
  click(byText('T')); await wait(30);
  click(byText('I')); await wait(30);
  assert.equal(w.getComputedStyle(doc.querySelector('[data-testid="game-panels"]')).display,'flex','Closing inventory hid still-open stats');
  click(byText('T')); await wait(30);
  assert.equal(w.getComputedStyle(doc.querySelector('[data-testid="game-panels"]')).display,'none');
  results.push('Closed panel hidden; opening/closing concurrent inventory and stats');

  const right=doc.querySelector('[aria-label="Move right"]');
  const x0=playerX();
  pointer(right,'pointerdown'); await wait(180);
  assert(playerX()>x0,'Pointer input did not move player');
  pointer(right,'pointercancel'); await wait(50);
  const stopped=playerX(); await wait(150);
  assert.equal(playerX(),stopped,'Pointer cancellation left movement stuck');
  pointer(right,'pointerdown'); await wait(100);
  w.dispatchEvent(new w.Event('blur')); await wait(40);
  const blurred=playerX(); await wait(100);
  assert.equal(playerX(),blurred,'Losing focus left movement stuck');
  results.push('Pointer movement stops on cancellation and focus loss');

  pointer(right,'pointerdown',1); pointer(right,'pointerdown',2); await wait(60);
  pointer(right,'pointerup',1); const oneReleased=playerX(); await wait(80);
  assert(playerX()>oneReleased,'Releasing one pointer stopped another held pointer');
  pointer(right,'lostpointercapture',2); await wait(40);
  const captureLost=playerX(); await wait(80);
  assert.equal(playerX(),captureLost,'Lost pointer capture left movement stuck');
  pointer(right,'pointerdown'); await wait(60);
  w.dispatchEvent(new w.Event('resize')); await wait(40);
  const resized=playerX(); await wait(80);
  assert.equal(playerX(),resized,'Resizing left a held pointer active');
  results.push('Independent pointer releases, lost capture and resize cleanup');

  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'i',bubbles:true})); await wait(30);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'i',repeat:true,bubbles:true})); await wait(30);
  assert(doc.querySelector('[data-testid="inventory-panel"]'),'Repeating shortcut closed inventory');
  w.dispatchEvent(new w.KeyboardEvent('keyup',{key:'i',bubbles:true}));
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'i',bubbles:true})); await wait(30);
  assert(!doc.querySelector('[data-testid="inventory-panel"]'));
  results.push('Menu shortcut auto-repeat does not toggle twice');

  click(byText('M')); await wait(30);
  assert(doc.querySelector('[aria-label="World map"]'));
  click(doc.querySelector('[aria-label="Close world map"]')); await wait(30);
  click(byText('E')); await wait(30);
  const quest=[...doc.querySelectorAll('button')].find(el=>el.textContent.includes('Sejarah Quest'));
  assert(quest,'Location quest action missing');
  click(quest); await wait(30);
  for (const answer of ['A. Raden Wijaya','A. 1293','A. Ken Arok','A. Negarakertagama','A. Gajah Mada']) {
    await until(()=>byText(answer) && !byText(answer).disabled,'Quest wave did not advance');
    click(byText(answer));
  }
  await until(()=>doc.body.textContent.includes('Anda telah menyelesaikan semua gelombang'),'Quest completion failed');
  await until(()=>JSON.parse(w.localStorage.getItem('characterStats')).relics?.includes('Majapahit Relic'),'Relic reward was not persisted');
  const completedStats=JSON.parse(w.localStorage.getItem('characterStats'));
  assert(completedStats.relics.includes('Majapahit Relic'),'Quest did not award relic');
  assert.equal(completedStats.gold,1050,'Relic award overwrote earned gold');
  results.push('Five quest waves, relic award and earned gold preserved');
  click(byText('P')); await wait(30);
  click(byText('Save/Load Game')); await wait(30);
  click(byText('Save Game')); await wait(30);
  const saved=JSON.parse(w.localStorage.getItem('elendorGameSave'));
  assert(saved.position && saved.inventory && saved.characterStats,'Save missing game state');
  click(byText('Load Game')); await wait(50);
  assert.equal(playerX(),Math.floor(saved.position.x));
  results.push('World map toggle, pause, save and load');
  assert.deepEqual(errors,[],'Uncaught component errors');
  console.log(JSON.stringify({passed:true,checks:results},null,2));
} finally {w.close();}
