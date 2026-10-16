import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

// Real Chromium, production bundle and original image/collision/location assets.
// Browser touch events are emulated; this does not replace physical-device testing.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputDir = path.resolve(root, process.env.RESPONSIVE_QA_OUTPUT || 'test-results/responsive');
const viewports = [[320,568],[390,844],[768,1024],[844,390],[1366,768],[768,390],[568,320]];
const report = { browser: null, viewports: [], regressions: [], errors: [], limitations: [
  'Chromium emulation only; physical phones, Safari and Android browsers were not tested.',
  'A shortened viewport tests name-entry scrolling; a real software keyboard was not opened.',
  'Boundary and quest cases load reproducible saved positions sampled from the real collision and location images.'
] };
await fs.mkdir(outputDir, { recursive: true });
const server = await preview({ root, preview: { host: '127.0.0.1', port: 0 } });
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
let browser;
const settle = async page => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
async function box(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
function inside(inner, outer, message, tolerance = 1) {
  assert(inner.width > 0 && inner.height > 0, `${message}: empty bounds`);
  assert(inner.x >= outer.x-tolerance && inner.y >= outer.y-tolerance &&
    inner.x+inner.width <= outer.x+outer.width+tolerance &&
    inner.y+inner.height <= outer.y+outer.height+tolerance, `${message}: ${JSON.stringify({inner,outer})}`);
}
async function bounded(page, locator, message) {
  inside(await box(locator), {x:0,y:0,...page.viewportSize()}, message);
  assert(await locator.evaluate(el => el.scrollWidth <= el.clientWidth+1), `${message}: horizontal overflow`);
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`) });
}
async function worldPosition(page) {
  return page.getByTestId('player').evaluate(el => ({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
}
async function camera(page) {
  return page.getByTestId('world-map').evaluate(el => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return {x:-matrix.m41 || 0,y:-matrix.m42 || 0};
  });
}
async function fittedWorld(page) {
  await settle(page);
  const frame = await box(page.getByTestId('map-frame'));
  const viewport = await box(page.getByTestId('gameplay-viewport'));
  const available = await page.getByTestId('map-frame').evaluate(el => {
    const s=getComputedStyle(el);
    return {width:el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),
      height:el.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)};
  });
  inside(viewport, frame, 'Painted game viewport stays in map frame');
  assert(viewport.width<=available.width+1 && viewport.height<=available.height+1, 'Viewport exceeds content bounds');
  assert(Math.abs(viewport.width/viewport.height-4/3)<0.01, 'Logical 4:3 viewport was distorted');
  assert(Math.abs(viewport.width-available.width)<1 || Math.abs(viewport.height-available.height)<1, 'Viewport does not fill available space');
  const hud=page.getByTestId('game-hud');
  await bounded(page,hud,'HUD fits screen');
  assert(await hud.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'HUD controls require vertical scrolling');
  const hudBox=await box(hud);
  for (const control of await hud.locator('button').all()) {
    const r=await box(control);
    inside(r,hudBox,'HUD control is visible');
    assert(r.width>=43 && r.height>=43,'HUD target smaller than 44 CSS pixels');
    assert(await control.evaluate(el=>{
      const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return hit===el || el.contains(hit);
    }),'HUD control is obscured at its center');
  }
  return {frame,viewport,hud:hudBox};
}
async function hiddenPanels(page) {
  assert.equal(await page.getByTestId('game-panels').evaluate(el=>getComputedStyle(el).display),'none');
  assert(await page.getByTestId('gameplay-viewport').evaluate(el=>{
    const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return !hit?.closest('[data-testid="game-panels"]');
  }),'Closed panels cover the painted map');
}
async function scrollPanel(page, name) {
  const panel=page.getByTestId(name);
  await bounded(page,panel,name);
  // Panel padding has an existing 300ms transition at orientation breakpoints.
  await page.waitForTimeout(320);
  await panel.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await settle(page);
  const end=await panel.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));
  assert(Math.abs(end.top-end.max)<=1,`${name}: bottom content is not reachable ${JSON.stringify(end)}`);
  await panel.evaluate(el=>{el.scrollTop=0;});
  assert(await panel.evaluate(el=>{
    const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+Math.min(24,r.height/2));
    return hit===el || el.contains(hit);
  }),`${name}: panel header is covered by another layer`);
  return end.max>0;
}
async function markerAligned(page) {
  const point=await worldPosition(page);
  const image=page.getByRole('img',{name:'World Map',exact:true});
  assert(await image.evaluate(el=>el.complete && el.naturalWidth===2048 && el.naturalHeight===1639),'Original world-map art did not load');
  const mapBox=await box(image), mark=await box(page.getByTestId('map-marker'));
  assert(Math.abs((mark.x+mark.width/2-mapBox.x)/mapBox.width-point.x/2048)<0.002,'Map marker X is misaligned');
  assert(Math.abs((mark.y+mark.height/2-mapBox.y)/mapBox.height-point.y/1639)<0.002,'Map marker Y is misaligned');
  await bounded(page,page.getByRole('dialog',{name:'World map',exact:true}),'World map popup');
}
async function startGame(page, name, enter=false) {
  const card=page.getByRole('button',{name:'Choose Mage',exact:true});
  await card.waitFor();
  // The existing floating animation never becomes stable; use a real coordinate click.
  const r=await box(card);await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
  await bounded(page,page.locator('.confirmation-content'),'Character confirmation');
  await screenshot(page,`${page.viewportSize().width}x${page.viewportSize().height}-confirmation`);
  await page.getByRole('button',{name:"Yes, I'm sure",exact:true}).click();
  await bounded(page,page.getByRole('dialog',{name:'Character details',exact:true}),'Character details');
  await screenshot(page,`${page.viewportSize().width}x${page.viewportSize().height}-details`);
  await page.locator('#playerName').fill(name);
  const originalSize=page.viewportSize();
  if(originalSize.width===390 && originalSize.height===844){
    await page.setViewportSize({width:390,height:360});
    await bounded(page,page.getByRole('dialog',{name:'Character details',exact:true}),'Character details with shortened viewport');
    await page.locator('#playerName').scrollIntoViewIfNeeded();
    inside(await box(page.locator('#playerName')),await box(page.getByRole('dialog',{name:'Character details',exact:true})),'Name field remains reachable');
    await screenshot(page,'390x360-name-entry');
    await page.setViewportSize(originalSize);
  }
  if (enter) await page.locator('#playerName').press('Enter');
  else await page.locator('#startBtn').click();
  await page.getByTestId('player').waitFor();
  await page.waitForFunction(()=>{
    const el=document.querySelector('[data-testid="world-map"]');
    return el && getComputedStyle(el).backgroundImage.includes('Elendor.png');
  });
  await settle(page);
}
async function save(page) {
  await page.getByRole('button',{name:'Pause game',exact:true}).click();
  await page.getByRole('button',{name:'Save/Load Game',exact:true}).click();
  await page.getByRole('button',{name:'Save Game',exact:true}).click();
  return page.evaluate(()=>JSON.parse(localStorage.getItem('elendorGameSave')));
}
async function loadPosition(page, data, position) {
  // Exercise the game's Load Game UI with positions chosen from its real pixel maps.
  if (!await page.getByRole('dialog',{name:'Pause menu',exact:true}).count()) {
    await page.getByRole('button',{name:'Pause game',exact:true}).click();
  }
  if (!await page.getByRole('dialog',{name:'Save and load',exact:true}).count()) {
    await page.getByRole('button',{name:'Save/Load Game',exact:true}).click();
  }
  await page.evaluate(({data,position})=>localStorage.setItem('elendorGameSave',JSON.stringify({...data,position})),{data,position});
  await page.getByRole('button',{name:'Load Game',exact:true}).click();
  await settle(page);
  assert.deepEqual(await worldPosition(page),position,'Loading did not restore position');
  const expected={x:Math.max(0,Math.min(Math.floor(position.x-200),1648)),y:Math.max(0,Math.min(Math.floor(position.y-150),1339))};
  assert.deepEqual(await camera(page),expected,'Loading did not restore camera before movement');
}
async function realMapSamples(page) {
  return page.evaluate(async()=>{
    async function pixels(src) {
      const image=new Image();image.src=src;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      return {width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
    }
    const collision=await pixels('/assets/map/Collision.png');
    const locations=await pixels('/assets/map/WorldLocations.png');
    const blocked=(x,y)=>{
      const i=(Math.floor(y)*collision.width+Math.floor(x))*4;
      return collision.data[i]===0 && collision.data[i+1]===0 && collision.data[i+2]===0;
    };
    const clear=(x,y)=>[[6,20],[12,20],[6,24],[12,24],[9,20],[9,24],[6,22],[12,22],[9,22]].every(([dx,dy])=>!blocked(x+dx,y+dy));
    const color=(x,y)=>{const i=(y*locations.width+x)*4;return [locations.data[i],locations.data[i+1],locations.data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');};
    let open=null,wall=null,lakers=null;
    const boundaries={left:null,right:null,top:null,bottom:null};
    for(let y=30;y<collision.height-30;y+=3)for(let x=20;x<collision.width-25;x+=3){
      if(!clear(x,y))continue;
      const p={x,y};
      if(x<180 && !boundaries.left)boundaries.left=p;
      if(x>1860 && !boundaries.right)boundaries.right=p;
      if(y<120 && !boundaries.top)boundaries.top=p;
      if(y>1510 && !boundaries.bottom)boundaries.bottom=p;
      if(!lakers && color(x,y)==='ed2024')lakers=p;
      if(!open && x>300 && x<1700 && y>250 && y<1350 &&
        Array.from({length:41},(_,i)=>i*3-60).every(d=>clear(x+d,y) && clear(x,y+d)))open=p;
      if(!wall && x>250 && x<1750 && y>200 && y<1400 &&
        Array.from({length:9},(_,i)=>i*3).every(d=>clear(x+d,y)) && !clear(x+27,y))wall=p;
    }
    return {dimensions:{width:collision.width,height:collision.height},open,wall,lakers,boundaries};
  });
}
async function selectionChecks(page) {
  await page.locator('.character-card').waitFor();
  await page.setViewportSize({width:320,height:568});
  for(const name of ['Mercenary','Ranger','Soldier','Mage']){
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByRole('button',{name:`Choose ${name}`,exact:true}).waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.nav-button')].every(button=>!button.disabled));
    await page.mouse.move(0,0);
    await page.waitForTimeout(220);
    await page.locator(`img[alt="${name} logo"]`).evaluate(el=>el.decode());
    await bounded(page,page.locator('.floating-card-container'),`${name} selector`);
    await page.getByRole('button',{name:`Choose ${name}`,exact:true}).focus();await page.keyboard.press('Enter');
    await bounded(page,page.locator('.confirmation-content'),`${name} confirmation`);
    await page.getByRole('button',{name:"Yes, I'm sure",exact:true}).click();
    await bounded(page,page.getByRole('dialog',{name:'Character details',exact:true}),`${name} details`);
    await page.getByRole('button',{name:'← Back',exact:true}).click();
  }
  const card=page.getByRole('button',{name:'Choose Mage',exact:true});
  await card.focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'No, go back',exact:true}).click();
  await card.focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:'No, go back',exact:true}).click();
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('link',{name:'Read me',exact:true}).click();await bounded(page,page.locator('.rules-box'),'Game guide');
  await page.getByRole('button',{name:'Close rules',exact:true}).click();
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('link',{name:'Relics',exact:true}).click();await bounded(page,page.locator('.Relic-box'),'Relic guide');
  await page.locator('.relic-card').first().click();
  await page.locator('.relic-details').scrollIntoViewIfNeeded();await bounded(page,page.locator('.Relic-box'),'Selected relic description');
  await page.getByRole('button',{name:'Close relics',exact:true}).click();
  report.regressions.push('All four character choices, Enter/Space selection and phone guide/relic dialogs');
  await page.setViewportSize({width:390,height:844});
}
async function regressions(page, context) {
  const data=await save(page);assert(data.position && data.inventory && data.characterStats,'Save missing state');
  await page.getByRole('button',{name:'Load Game',exact:true}).click();
  const samples=await realMapSamples(page);
  assert.deepEqual(samples.dimensions,{width:2048,height:1639});
  assert(samples.open && samples.wall && samples.lakers,'Could not find real walkable/collision/location samples');
  report.realMapSamples=samples;
  await loadPosition(page,data,samples.open);
  for(const size of viewports){
    const position=await worldPosition(page),cam=await camera(page);
    await page.setViewportSize({width:size[0],height:size[1]});
    await fittedWorld(page);assert.deepEqual(await worldPosition(page),position);assert.deepEqual(await camera(page),cam);
    await page.getByRole('button',{name:'Toggle world map',exact:true}).click();
    await markerAligned(page);
    await page.getByRole('button',{name:'Close world map',exact:true}).click();
  }
  report.regressions.push('Live resizing/orientation across all seven sizes preserves position, camera and map marker');

  await page.setViewportSize({width:390,height:844});await fittedWorld(page);
  for(const [key,testid] of [['i','inventory-panel'],['t','stats-panel']]){
    await page.keyboard.down(key);await page.keyboard.down(key);await page.keyboard.down(key);await settle(page);
    assert.equal(await page.getByTestId(testid).count(),1,'Repeated shortcut closed panel');
    await page.keyboard.up(key);await page.keyboard.press(key);
  }
  await page.keyboard.down('m');await page.keyboard.down('m');await settle(page);
  assert(await page.getByRole('dialog',{name:'World map',exact:true}).isVisible(),'Repeated map shortcut closed popup');
  await page.keyboard.up('m');await page.keyboard.press('Escape');
  await page.keyboard.down('d');await page.waitForTimeout(140);await page.keyboard.up('d');await settle(page);
  assert((await worldPosition(page)).x>samples.open.x,'Keyboard movement failed on walkable pixels');
  report.regressions.push('Keyboard movement and held menu shortcuts');

  await loadPosition(page,data,samples.open);
  const cdp=await context.newCDPSession(page);
  const right=page.getByRole('button',{name:'Move right',exact:true});
  const touch=async(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const center=async locator=>{const r=await box(locator);return {x:r.x+r.width/2,y:r.y+r.height/2,id:1};};
  await page.evaluate(()=>{
    window.qaPointerId=null;document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')window.qaPointerId=event.pointerId;});
  });
  let point=await center(right);
  await touch('touchStart',[point]);await page.waitForTimeout(110);
  assert(await right.evaluate(el=>el.hasPointerCapture(window.qaPointerId)),'Native touch did not capture pointer');
  await page.keyboard.down('d');await page.keyboard.up('d');
  const beforeDrag=await worldPosition(page);
  await touch('touchMove',[{...point,x:20,y:100}]);await page.waitForTimeout(110);
  assert((await worldPosition(page)).x>beforeDrag.x,'Dragging captured touch or releasing matching keyboard key stopped movement');
  await touch('touchEnd',[]);await settle(page);
  let stopped=await worldPosition(page);await page.waitForTimeout(110);assert.deepEqual(await worldPosition(page),stopped,'Touch release left movement stuck');
  await touch('touchStart',[await center(right)]);await page.waitForTimeout(70);await touch('touchCancel',[]);await settle(page);
  stopped=await worldPosition(page);await page.waitForTimeout(110);assert.deepEqual(await worldPosition(page),stopped,'Native touch cancellation left movement stuck');
  report.regressions.push('Native Chromium touch capture, drag outside, matching keyboard release, pointerup and pointercancel');

  await loadPosition(page,data,samples.open);
  await touch('touchStart',[await center(right)]);await page.waitForTimeout(70);
  await page.setViewportSize({width:844,height:390});await settle(page);
  stopped=await worldPosition(page);await page.waitForTimeout(110);assert.deepEqual(await worldPosition(page),stopped,'Orientation change left movement stuck');
  await touch('touchCancel',[]);
  await touch('touchStart',[await center(right)]);await page.waitForTimeout(70);
  await page.keyboard.press('Escape');await settle(page);stopped=await worldPosition(page);
  await page.keyboard.press('Escape');await page.waitForTimeout(110);assert.deepEqual(await worldPosition(page),stopped,'Unpausing resumed interrupted touch');
  await touch('touchCancel',[]);
  await page.keyboard.down('d');await page.waitForTimeout(70);
  // Deliver focus loss to the real browser; physical app switching remains a device check.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await settle(page);
  stopped=await worldPosition(page);await page.waitForTimeout(110);assert.deepEqual(await worldPosition(page),stopped,'Blur left keyboard movement stuck');
  await page.keyboard.up('d');
  report.regressions.push('Orientation, pause/resume and delivered focus-loss event release movement');

  await loadPosition(page,data,samples.wall);
  await page.keyboard.down('d');await page.waitForTimeout(650);await page.keyboard.up('d');await settle(page);
  const collisionStop=await worldPosition(page);
  assert(collisionStop.x>samples.wall.x && collisionStop.x<samples.wall.x+27,'Player did not stop at actual black collision pixels');
  await page.keyboard.down('d');await page.waitForTimeout(140);await page.keyboard.up('d');await settle(page);
  assert.deepEqual(await worldPosition(page),collisionStop,'Player crossed collision boundary');
  for(const [edge,position] of Object.entries(samples.boundaries)){
    assert(position,`No walkable ${edge} boundary sample`);await loadPosition(page,data,position);
    const cam=await camera(page);
    if(edge==='left')assert.equal(cam.x,0);if(edge==='right')assert.equal(cam.x,1648);
    if(edge==='top')assert.equal(cam.y,0);if(edge==='bottom')assert.equal(cam.y,1339);
    await page.setViewportSize({width:320,height:568});await fittedWorld(page);assert.deepEqual(await camera(page),cam);
    await page.setViewportSize({width:844,height:390});await fittedWorld(page);assert.deepEqual(await camera(page),cam);
  }
  report.regressions.push('Movement stops on real collision pixels; all four camera boundaries survive orientation changes');

  await loadPosition(page,data,samples.lakers);
  await page.getByRole('button',{name:'Interact with location',exact:true}).click();
  await page.getByRole('button',{name:'Sejarah Quest'}).click();
  await loadPosition(page,data,samples.open);
  await hiddenPanels(page);
  await loadPosition(page,data,samples.lakers);
  await page.getByRole('button',{name:'Interact with location',exact:true}).click();
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});await scrollPanel(page,'visit-panel');
    await page.getByRole('button',{name:'Lakers General Store'}).click();await scrollPanel(page,'shop-panel');
    await page.getByRole('button',{name:'Close shop panel',exact:true}).click();
    await page.getByRole('button',{name:'Lakers Hill Inn'}).click();await scrollPanel(page,'lodge-panel');
    await page.getByRole('button',{name:'Close lodge panel',exact:true}).click();
    await page.getByRole('button',{name:'Talk to Locals'}).click();await scrollPanel(page,'dialog-panel');
    await page.getByRole('button',{name:'Close conversation panel',exact:true}).click();
    await page.getByRole('button',{name:'Sejarah Quest'}).click();await scrollPanel(page,'quest-panel');
    await page.getByRole('button',{name:'Close quest panel',exact:true}).click();
  }
  report.regressions.push('Location, shop, lodge, conversation and quest panels fit and scroll at all seven sizes');
  await scrollPanel(page,'visit-panel');
  await page.getByRole('button',{name:'Sejarah Quest'}).click();
  await page.setViewportSize({width:320,height:568});await scrollPanel(page,'quest-panel');
  await screenshot(page,'320x568-quest');
  for(const [index,answer] of ['A. Raden Wijaya','A. 1293','A. Ken Arok','A. Negarakertagama','A. Gajah Mada'].entries()){
    const button=page.getByRole('button',{name:answer,exact:true});await button.waitFor();await button.click();
    await page.setViewportSize(index%2?{width:320,height:568}:{width:844,height:390});
    await scrollPanel(page,'quest-panel');
  }
  await page.getByText('Anda telah menyelesaikan semua gelombang!',{exact:true}).waitFor();
  const stats=await page.evaluate(()=>JSON.parse(localStorage.getItem('characterStats')));
  assert.equal(stats.gold,data.characterStats.gold+1000,'Final wave gold was lost');assert(stats.relics.includes('Majapahit Relic'),'Relic reward missing');
  await page.getByRole('button',{name:'Close quest panel',exact:true}).click();
  await page.getByRole('button',{name:'Lakers General Store'}).click();
  await page.getByRole('button',{name:/Leather Cap - 80G/}).click();
  await page.getByText('Purchase successful!',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Close shop panel',exact:true}).click();
  await page.getByRole('button',{name:'Close location panel',exact:true}).click();
  const saved=await save(page);
  assert(saved.inventory.main.some(item=>item?.name==='Leather Cap'),'Purchased inventory item not saved');
  await page.setViewportSize({width:390,height:844});await bounded(page,page.getByRole('dialog',{name:'Save and load',exact:true}),'Save/load after orientation');
  await page.getByRole('button',{name:'Load Game',exact:true}).click();await settle(page);
  assert.deepEqual(await worldPosition(page),saved.position);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('characterStats'))),saved.characterStats);
  const savedAgain=await save(page);assert.deepEqual(savedAgain.inventory,saved.inventory,'Load lost purchased inventory');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog',{name:'Save and load',exact:true}).count(),0,'Escape did not dismiss save/load first');
  assert(await page.getByRole('dialog',{name:'Pause menu',exact:true}).isVisible(),'Escape unpaused behind save/load');
  await page.getByRole('button',{name:'Restart Game',exact:true}).click();await settle(page);
  const restart=await worldPosition(page),restartCamera=await camera(page);
  assert.deepEqual(restartCamera,{x:Math.max(0,Math.min(restart.x-200,1648)),y:Math.max(0,Math.min(restart.y-150,1339))},'Restart did not restore camera');
  await hiddenPanels(page);
  report.regressions.push('Loading at another location and restarting dismiss stale location dialogs; Escape closes save/load before pause');
  report.regressions.push('Five real-location quest waves across orientation changes; earned gold, relic, inventory and position save/load');
}
try {
  browser=await chromium.launch({headless:true});report.browser=browser.version();
  for(const [width,height] of process.env.RESPONSIVE_QA_REGRESSIONS_ONLY ? [] : viewports){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(url);await page.locator('.character-card').waitFor();
    await bounded(page,page.locator('.floating-card-container'),'Hero selector');
    const title=await box(page.locator('.selection-title')),clock=await box(page.locator('#clock'));
    assert(title.y>=clock.y+clock.height || title.y+title.height<=clock.y,'Selection title overlaps clock');
    await screenshot(page,`${width}x${height}-selection`);
    await startGame(page, 'Responsive QA', width===320);
    const bounds=await fittedWorld(page);await hiddenPanels(page);
    await screenshot(page,`${width}x${height}-game`);
    const entry={width,height,bounds,checks:['selection, confirmation, character details and name entry','painted 4:3 viewport and unobscured closed panels','visible 44px HUD controls without scrolling']};
    await page.getByRole('button',{name:'Open inventory',exact:true}).click();await scrollPanel(page,'inventory-panel');
    await page.getByRole('button',{name:'Open stats',exact:true}).click();await scrollPanel(page,'stats-panel');await scrollPanel(page,'inventory-panel');
    await page.getByRole('button',{name:'Close inventory panel',exact:true}).click();await scrollPanel(page,'stats-panel');
    await screenshot(page,`${width}x${height}-stats`);
    await page.getByRole('button',{name:'Close stats panel',exact:true}).click();await hiddenPanels(page);
    entry.checks.push('inventory and stats scrolling, simultaneous panels and independent closing');
    await page.getByRole('button',{name:'Toggle world map',exact:true}).click();await markerAligned(page);await screenshot(page,`${width}x${height}-map`);
    await page.getByRole('button',{name:'Close world map',exact:true}).click();
    await save(page);await bounded(page,page.getByRole('dialog',{name:'Pause menu',exact:true}),'Pause menu');
    await bounded(page,page.getByRole('dialog',{name:'Save and load',exact:true}),'Save/load menu');
    await screenshot(page,`${width}x${height}-save-load`);
    await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Resume Game',exact:true}).click();
    entry.checks.push('world map, marker, pause and save/load popup bounds and reachable controls');
    report.viewports.push(entry);console.log(`PASS ${width}x${height}`);await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await selectionChecks(page);await startGame(page,'Regression QA');
  await regressions(page,context);await context.close();assert.deepEqual(report.errors,[],'Uncaught browser errors');
  report.passed=true;console.log(JSON.stringify({passed:true,browser:report.browser,viewports:report.viewports.length,regressions:report.regressions},null,2));
} catch(error) {
  const failedPage=browser?.contexts().at(-1)?.pages().at(-1);
  if(failedPage)await screenshot(failedPage,'failure').catch(()=>{});
  report.passed=false;report.failure=error.stack;throw error;
} finally {
  await fs.writeFile(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
  await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));
}
