import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'test-results/battle');
await fs.mkdir(output, { recursive: true });
const server = await preview({ root, preview: { host: '127.0.0.1', port: 0 } });
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
const errors = [];
const checks = [];
let browser;
let page;
const exactButton = name => page.getByRole('button', { name, exact: true });
const state = () => page.getByTestId('battle-state').evaluate(el => ({
  phase: el.dataset.phase,
  hp: Number(el.dataset.playerHp),
  enemyHp: Number(el.dataset.enemyHp),
  stamina: Number(el.dataset.stamina),
}));
async function waitPhase(phase) {
  await page.waitForFunction(phase => document.querySelector('[data-testid="battle-state"]')?.dataset.phase === phase, phase);
}
async function command(action) {
  await page.locator(`[data-action="${action}"]`).click();
}
async function openBattle(enemy = 'roadside-raider') {
  await exactButton('Battle').click();
  await page.locator(`[data-enemy-id="${enemy}"]`).click();
  const begin = page.getByTestId('battle-begin');
  if (await begin.count()) await begin.click();
  await page.getByTestId('battle-state').waitFor();
}
async function returnToWorld() {
  await page.getByTestId('battle-return').click();
  await page.getByTestId('battle-dialog').waitFor({ state: 'detached' });
}
async function pauseSave() {
  await exactButton('Pause game').click();
  await exactButton('Save/Load Game').click();
  await exactButton('Save Game').click();
  return page.evaluate(() => JSON.parse(localStorage.getItem('elendorGameSave')));
}
async function load(data) {
  if (!await page.getByRole('dialog', { name: 'Save and load', exact: true }).count()) {
    await exactButton('Pause game').click();
    await exactButton('Save/Load Game').click();
  }
  await page.evaluate(data => localStorage.setItem('elendorGameSave', JSON.stringify(data)), data);
  await exactButton('Load Game').click();
  await page.getByRole('dialog', { name: 'Pause menu', exact: true }).waitFor({ state: 'detached' });
}
async function bounded() {
  const info = await page.getByTestId('battle-dialog').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, scroll: el.scrollWidth, width: el.clientWidth };
  });
  const { width, height } = page.viewportSize();
  assert(info.x >= -1 && info.y >= -1 && info.right <= width + 1 && info.bottom <= height + 1, JSON.stringify(info));
  assert(info.scroll <= info.width + 1, 'Battle has horizontal overflow');
}
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) errors.push(`Missing asset: ${response.url()}`); });
  await page.goto(url);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Soldier', exact: true }).focus();
  await page.keyboard.press('Enter');
  await exactButton("Yes, I'm sure").click();
  await page.locator('#playerName').fill('Battle QA');
  await page.locator('#startBtn').click();
  await page.getByTestId('player').waitFor();
  const initial = await pauseSave();
  await load(initial);

  const position = await page.getByTestId('player').evaluate(el => ({ x: el.style.left, y: el.style.top }));
  await openBattle();
  await waitPhase('player');
  const before = await state();
  assert.equal(before.hp, 90);
  assert.equal(before.enemyHp, 55);
  await page.keyboard.press('d');
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  assert.deepEqual(await page.getByTestId('player').evaluate(el => ({ x: el.style.left, y: el.style.top })), position);
  assert.equal(await page.getByRole('dialog', { name: 'Pause menu', exact: true }).count(), 0);
  await command('guard');
  await waitPhase('player');
  assert.equal((await state()).hp, before.hp - 4, 'Guard halves armored damage');
  await command('skill');
  await waitPhase('player');
  assert.equal((await state()).stamina, before.stamina - 20);
  assert.equal((await state()).enemyHp, 24);
  await command('recover');
  await waitPhase('player');
  assert((await state()).hp > 75, 'Recovery must heal before the enemy responds');
  await command('skill');
  await waitPhase('victory');
  const victory = await state();
  await page.screenshot({ path: path.join(output, 'victory.png') });
  await returnToWorld();
  const saved = await pauseSave();
  assert.equal(saved.worldState.currentStats.hp, victory.hp);
  assert.equal(saved.worldState.playerGold, initial.worldState.playerGold + 35);
  assert.deepEqual(saved.worldState.battleProgress, { xp: 25, victories: 1 });
  await load(saved);
  await openBattle();
  assert.equal((await state()).hp, victory.hp, 'Save/load preserves combat wounds');
  checks.push('Soldier skill, guard, recover, victory, exact rewards, world input blocking, live-stat save/load');

  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await bounded();
    for (const action of ['attack', 'skill', 'guard', 'recover', 'flee']) {
      const control = page.locator(`[data-action="${action}"]`);
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      assert(box.height >= 44, `${action} target below 44px`);
    }
    await page.screenshot({ path: path.join(output, `${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await command('flee');
  await waitPhase('escaped');
  await returnToWorld();
  const escaped = await pauseSave();
  assert.equal(escaped.worldState.playerGold, saved.worldState.playerGold);
  assert.deepEqual(escaped.worldState.battleProgress, saved.worldState.battleProgress);
  checks.push('Battle layout and 44px controls on five screen sizes; retreat has no rewards');

  const wounded = structuredClone(saved);
  wounded.worldState.currentStats.hp = 1;
  wounded.worldState.currentStamina = 0;
  await load(wounded);
  await openBattle();
  assert(await page.locator('[data-action="skill"]').isDisabled());
  assert(await page.locator('[data-action="recover"]').isDisabled());
  await command('guard');
  await waitPhase('defeat');
  await returnToWorld();
  const defeated = await pauseSave();
  assert.equal(defeated.worldState.currentStats.hp, 27);
  assert.equal(defeated.worldState.playerGold, saved.worldState.playerGold - Math.floor(saved.worldState.playerGold * .1));
  assert.deepEqual(defeated.worldState.battleProgress, saved.worldState.battleProgress);
  checks.push('Unavailable stamina actions, defeat rescue, exact gold penalty, no defeat rewards');

  // Exercise equipment restoration through the existing load UI and live battle stats.
  const equipped = structuredClone(saved);
  equipped.worldState.equipmentSlots.weapon = { id: 'qa-sword', name: 'QA Sword', type: 'sword', stats: { damage: 4 } };
  equipped.worldState.equipmentSlots.helmet = { id: 'qa-cap', name: 'QA Cap', type: 'helmet', stats: { hp: 8 } };
  equipped.worldState.currentStats.damage = 29;
  equipped.worldState.currentStats.hp = 70;
  equipped.worldState.currentStats.maxHp = 98;
  equipped.worldState.currentStats.speed = 4; // A temporary food bonus must not become permanent on load.
  await load(equipped);
  await openBattle();
  assert.equal(await page.getByRole('progressbar', { name: 'Your HP', exact: true }).getAttribute('aria-valuemax'), '98');
  assert.equal(await page.locator('.battle-attributes > div').nth(2).locator('strong').textContent(), '1');
  await command('attack');
  await waitPhase('player');
  assert.equal((await state()).enemyHp, 28, 'Equipped damage survives loading and affects combat');
  assert.equal((await state()).hp, 62, 'Equipment must not refill wounded HP');
  await command('flee');
  await waitPhase('escaped');
  await returnToWorld();
  checks.push('Equipped damage and maximum HP survive load without healing wounds; temporary speed resets');

  const legacy = structuredClone(initial);
  delete legacy.worldState;
  await load(legacy);
  await openBattle('ashen-warlord');
  await waitPhase('player');
  assert.equal((await state()).enemyHp, 160);
  await command('flee');
  await waitPhase('escaped');
  await returnToWorld();
  checks.push('Legacy saves load; boss encounter opens and resolves an enemy-first retreat');
  assert.deepEqual(errors, [], 'Uncaught browser errors or missing combat assets');
  console.log(JSON.stringify({ passed: true, browser: browser.version(), checks, errors }, null, 2));
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ passed: false, checks, errors, failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
