import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMIES,
  CLASS_SKILLS,
  createBattle,
  takePlayerTurn,
  takeEnemyTurn,
  enemyIntent,
  getAvailableActions,
} from '../src/utils/battleEngine.js';

const hero = { hp: 100, maxHp: 100, damage: 20, armor: 20, speed: 2.5, stamina: 100 };
const battle = (overrides = {}) => createBattle({ character: 'Soldier', stats: hero, ...overrides });
const resolve = (state, action = 'attack') => takeEnemyTurn(takePlayerTurn(state, action));

test('enemies expose distinct difficulty and scale mildly without mutating templates', () => {
  assert.equal(ENEMIES.length, 3);
  assert.deepEqual(ENEMIES.map(({ hp }) => hp), [55, 90, 160]);
  assert.equal(ENEMIES[2].boss, true);
  const state = battle({ enemyId: ENEMIES[2].id, level: 3 });
  assert.equal(state.enemy.maxHp, 186);
  assert.equal(state.enemy.damage, 15);
  assert.equal(ENEMIES[2].hp, 160);
  assert.deepEqual(state.rewards, { gold: 0, xp: 0 });
});

test('speed grants opening initiative only, with no skipped player rounds', () => {
  let state = battle({ stats: { ...hero, speed: 1 }, enemyId: 'ruin-sentinel' });
  assert.equal(state.phase, 'enemy');
  assert.strictEqual(takePlayerTurn(state, 'attack'), state);
  state = takeEnemyTurn(state);
  assert.equal(state.round, 1);
  assert.equal(state.phase, 'player');
  state = resolve(state);
  assert.equal(state.round, 2);
  assert.equal(state.phase, 'player');
  assert.equal(state.enemy.attacks, 2);
  assert.equal(battle({ enemyId: 'ruin-sentinel' }).phase, 'player');
  assert.equal(battle({ stats: { ...hero, speed: 0.9 } }).phase, 'player', 'ties favor the player');
});

test('strike applies enemy defense, costs no stamina, and leaves the input unchanged', () => {
  const state = battle({ enemyId: 'ruin-sentinel' });
  const snapshot = structuredClone(state);
  const after = takePlayerTurn(state, 'attack');
  assert.equal(after.lastEvent.damage, 16);
  assert.equal(after.enemy.hp, 74);
  assert.equal(after.player.stamina, 100);
  assert.equal(after.phase, 'enemy');
  assert.deepEqual(state, snapshot);
  assert.notStrictEqual(after.player, state.player);
  assert.notStrictEqual(after.enemy, state.enemy);
});

test('each class has a distinct tactical skill and consumes the documented stamina', async (t) => {
  const expected = { Mage: [42, false, 1], Mercenary: [34, false, 1], Ranger: [30, false, 2], Soldier: [21, true, 1] };
  for (const [character, [damage, guarding, hitCount]] of Object.entries(expected)) {
    await t.test(character, () => {
      const state = battle({ character, enemyId: 'ruin-sentinel' });
      const after = takePlayerTurn(state, 'skill');
      assert.equal(after.lastEvent.damage, damage);
      assert.equal(after.lastEvent.hits.length, hitCount);
      assert.equal(after.guarding, guarding);
      assert.equal(after.player.stamina, state.player.stamina - CLASS_SKILLS[character].cost);
    });
  }
});

test('guard restores capped stamina and halves exactly the next armored hit', () => {
  const state = battle({ stamina: 94 });
  const guarded = takePlayerTurn(state, 'guard');
  assert.equal(guarded.player.stamina, 100);
  assert.equal(guarded.lastEvent.staminaRecovered, 6);
  const after = takeEnemyTurn(guarded);
  assert.equal(after.player.hp, 96, '10 damage reduced by 20% armor and then halved');
  assert.equal(after.guarding, false);
  const unguarded = resolve(after);
  assert.equal(unguarded.player.hp, 88, 'guard does not persist into another turn');
});

test('heavy intent predicts every third attack and matches resolved damage', () => {
  let state = battle();
  assert.equal(enemyIntent(state).heavy, false);
  state = resolve(resolve(state, 'guard'), 'guard');
  assert.equal(state.enemy.attacks, 2);
  assert.equal(enemyIntent(state).heavy, true);
  const after = takeEnemyTurn(takePlayerTurn(state, 'guard'));
  assert.equal(after.lastEvent.heavy, true);
  assert.equal(after.lastEvent.damage, 7, '17.5 raw becomes 14 armored damage, then 7 guarded');
  assert.equal(enemyIntent(after).heavy, false);
});

test('recover heals the documented amount, caps at max HP, and costs stamina', () => {
  let state = battle({ stats: { ...hero, hp: 40 } });
  const after = takePlayerTurn(state, 'recover');
  assert.equal(after.player.hp, 62);
  assert.equal(after.player.stamina, 88);
  assert.equal(after.lastEvent.healing, 22);
  state = battle({ stats: { ...hero, hp: 95 } });
  assert.equal(takePlayerTurn(state, 'recover').player.hp, 100);
  assert.equal(takePlayerTurn(state, 'recover').lastEvent.healing, 5);
});

test('invalid, out-of-turn, full-health, and unaffordable commands preserve state identity', () => {
  const state = battle({ stamina: 11 });
  for (const action of ['unknown', 'skill', 'recover', null, undefined, {}, '__proto__']) {
    assert.strictEqual(takePlayerTurn(state, action), state);
  }
  const full = battle();
  assert.strictEqual(takePlayerTurn(full, 'recover'), full);
  assert.strictEqual(takeEnemyTurn(full), full);
  const enemyTurn = takePlayerTurn(state, 'attack');
  assert.strictEqual(takePlayerTurn(enemyTurn, 'attack'), enemyTurn);
  const commands = getAvailableActions(state);
  assert.equal(commands.find(({ id }) => id === 'skill').disabled, true);
  assert.match(commands.find(({ id }) => id === 'skill').reason, /20 stamina/);
  assert.equal(commands.find(({ id }) => id === 'attack').available, true);
  assert.ok(getAvailableActions(enemyTurn).every(({ disabled }) => disabled));
});

test('victory grants rewards once, clamps overkill, and rejects further turns', () => {
  const state = battle({ stats: { ...hero, damage: 999 } });
  const won = takePlayerTurn(state, 'attack');
  assert.equal(won.phase, 'victory');
  assert.equal(won.enemy.hp, 0);
  assert.equal(won.lastEvent.damage, 55);
  assert.deepEqual(won.rewards, { gold: 35, xp: 25 });
  assert.strictEqual(takeEnemyTurn(won), won);
  assert.strictEqual(takePlayerTurn(won, 'attack'), won);
});

test('defeat clamps HP at zero and is a terminal state without rewards', () => {
  const state = battle({ stats: { ...hero, hp: 1 } });
  const lost = resolve(state);
  assert.equal(lost.phase, 'defeat');
  assert.equal(lost.player.hp, 0);
  assert.equal(lost.lastEvent.damage, 1);
  assert.deepEqual(lost.rewards, { gold: 0, xp: 0 });
  assert.strictEqual(takeEnemyTurn(lost), lost);
  assert.strictEqual(takePlayerTurn(lost, 'recover'), lost);
  assert.equal(battle({ stats: { ...hero, hp: 0 } }).phase, 'defeat');
});

test('retreat always exposes the player to the telegraphed attack before escape', () => {
  const state = battle();
  const fleeing = takePlayerTurn(state, 'flee');
  assert.equal(fleeing.phase, 'enemy');
  assert.equal(fleeing.player.hp, 100);
  assert.equal(fleeing.pendingEscape, true);
  const escaped = takeEnemyTurn(fleeing);
  assert.equal(escaped.phase, 'escaped');
  assert.equal(escaped.player.hp, 92);
  assert.deepEqual(escaped.rewards, { gold: 0, xp: 0 });
  assert.strictEqual(takePlayerTurn(escaped, 'attack'), escaped);
  assert.strictEqual(takeEnemyTurn(escaped), escaped);
  const wounded = battle({ stats: { ...hero, hp: 1 } });
  assert.equal(resolve(wounded, 'flee').phase, 'defeat', 'a lethal parting strike prevents escape');
  const beforeHeavy = resolve(resolve(state, 'guard'), 'guard');
  const heavyEscape = resolve(beforeHeavy, 'flee');
  assert.equal(heavyEscape.lastEvent.heavy, true);
  assert.equal(heavyEscape.lastEvent.damage, 14);
});

test('corrupt inputs cannot create negative HP, unbounded resistance, or excess stamina', () => {
  const state = battle({
    character: 'not-a-class',
    enemyId: 'missing',
    level: -10,
    stamina: 500,
    stats: { hp: 500, maxHp: 90, damage: -20, defense: 999, speed: -4, stamina: 80 },
  });
  assert.equal(state.character, 'Soldier');
  assert.equal(state.enemy.id, 'roadside-raider');
  assert.equal(state.level, 1);
  assert.equal(state.player.hp, 90);
  assert.equal(state.player.maxHp, 90);
  assert.equal(state.player.stamina, 80);
  assert.equal(state.player.defense, 80);
  assert.equal(state.player.damage, 1);
  assert.equal(state.player.speed, 0.1);
  assert.equal(battle({ stats: { hp: NaN, maxHp: Infinity, damage: Infinity } }).player.maxHp, 100);
});

test('deterministic command sequences produce identical results without mutating prior states', () => {
  const simulate = () => {
    let state = battle({ character: 'Ranger', enemyId: 'ashen-warlord' });
    const initial = structuredClone(state);
    const first = state;
    for (let turn = 0; turn < 30 && !['victory', 'defeat'].includes(state.phase); turn += 1) {
      const action = enemyIntent(state).heavy ? 'guard' : state.player.stamina >= 20 ? 'skill' : 'attack';
      state = resolve(state, action);
    }
    assert.deepEqual(first, initial);
    assert.equal(state.phase, 'victory');
    assert.ok(state.player.hp > 0);
    return state;
  };
  assert.deepEqual(simulate(), simulate());
});
