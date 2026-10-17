// A deterministic battle model. Rendering and animation timers live in the UI;
// each function here resolves exactly one combatant's turn without mutating input.

export const ENEMIES = Object.freeze([
  Object.freeze({
    id: 'roadside-raider',
    name: 'Roadside Raider',
    description: 'A quick skirmish against a bandit stalking the roads of Elendor.',
    hp: 55,
    damage: 10,
    defense: 8,
    speed: 0.9,
    gold: 35,
    xp: 25,
    boss: false,
  }),
  Object.freeze({
    id: 'ruin-sentinel',
    name: 'Ruin Sentinel',
    description: 'An armored guardian of the old ruins. Magic can pierce its defenses.',
    hp: 90,
    damage: 13,
    defense: 22,
    speed: 1.25,
    gold: 65,
    xp: 50,
    boss: false,
  }),
  Object.freeze({
    id: 'ashen-warlord',
    name: 'Ashen Warlord',
    description: 'A relentless commander. Watch for the heavy strike and guard before it lands.',
    hp: 160,
    damage: 14,
    defense: 28,
    speed: 1.4,
    gold: 140,
    xp: 100,
    boss: true,
  }),
]);

export const CLASS_SKILLS = Object.freeze({
  Mage: Object.freeze({
    name: 'Arcane Burst',
    cost: 20,
    description: 'Deal 210% damage, ignoring all enemy defense.',
  }),
  Mercenary: Object.freeze({
    name: 'Cleave',
    cost: 20,
    description: 'Commit to a crushing strike for 220% damage.',
  }),
  Ranger: Object.freeze({
    name: 'Twin Shot',
    cost: 20,
    description: 'Fire two arrows, each dealing 95% damage.',
  }),
  Soldier: Object.freeze({
    name: 'Shield Bash',
    cost: 20,
    description: 'Deal 135% damage and halve the next incoming hit.',
  }),
});

const RECOVERY_COST = 12;
const GUARD_STAMINA = 15;
const TERMINAL_PHASES = new Set(['victory', 'defeat', 'escaped']);

function bounded(value, fallback, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function damageAfterDefense(rawDamage, defense) {
  // Equipment uses defense as percentage resistance, just like character armor.
  return Math.max(1, Math.round(rawDamage * (1 - defense / 100)));
}

function appendLog(state, message) {
  return [...state.log, message];
}

export function createBattle({ character = 'Soldier', stats = {}, stamina, enemyId, level = 1 } = {}) {
  const characterClass = Object.hasOwn(CLASS_SKILLS, character) ? character : 'Soldier';
  const battleLevel = Math.floor(bounded(level, 1, 1, 100));
  const template = ENEMIES.find((enemy) => enemy.id === enemyId) || ENEMIES[0];
  const maxHp = Math.round(bounded(stats.maxHp ?? stats.hp, 100, 1, 9999));
  const maxStamina = Math.round(bounded(stats.maxStamina ?? stats.stamina, 100, 1, 999));
  const player = {
    hp: Math.round(bounded(stats.hp, maxHp, 0, maxHp)),
    maxHp,
    damage: bounded(stats.damage, 20, 1, 999),
    defense: bounded(stats.defense ?? stats.armor, 0, 0, 80),
    speed: bounded(stats.speed, 1, 0.1, 100),
    stamina: Math.round(bounded(stamina ?? stats.stamina, maxStamina, 0, maxStamina)),
    maxStamina,
  };
  const enemyMaxHp = Math.round(template.hp * (1 + (battleLevel - 1) * 0.08));
  const enemy = {
    ...template,
    hp: enemyMaxHp,
    maxHp: enemyMaxHp,
    damage: Math.round(template.damage * (1 + (battleLevel - 1) * 0.04)),
    gold: Math.round(template.gold * (1 + (battleLevel - 1) * 0.1)),
    xp: Math.round(template.xp * (1 + (battleLevel - 1) * 0.1)),
    attacks: 0,
  };
  const openingEnemyTurn = enemy.speed > player.speed;

  return {
    character: characterClass,
    player,
    enemy,
    level: battleLevel,
    phase: player.hp === 0 ? 'defeat' : openingEnemyTurn ? 'enemy' : 'player',
    round: 1,
    openingEnemyTurn,
    pendingEscape: false,
    guarding: false,
    rewards: { gold: 0, xp: 0 },
    log: [
      `${enemy.name} blocks your path.`,
      player.hp === 0
        ? 'You are too wounded to fight.'
        : openingEnemyTurn
          ? `${enemy.name} is faster and moves first.`
          : 'You take the initiative.',
    ],
    lastEvent: null,
  };
}

export function enemyIntent(state) {
  const heavy = ((state.enemy.attacks || 0) + 1) % 3 === 0;
  return {
    label: heavy ? 'Heavy strike' : 'Strike',
    heavy,
    description: heavy
      ? 'A heavy strike is coming: 175% damage. Guard to halve the hit.'
      : 'The enemy prepares a normal strike.',
  };
}

/** All commands remain visible so the UI can explain unavailable actions. */
export function getAvailableActions(state) {
  const canAct = state.phase === 'player';
  const skill = CLASS_SKILLS[state.character] || CLASS_SKILLS.Soldier;
  const choices = [
    { id: 'attack', name: 'Strike', cost: 0, description: 'Attack using your damage stat.' },
    { id: 'skill', name: skill.name, cost: skill.cost, description: skill.description },
    { id: 'guard', name: 'Guard', cost: 0, description: 'Halve the next hit and restore 15 stamina.' },
    { id: 'recover', name: 'Recover', cost: RECOVERY_COST, description: 'Restore 22% of your maximum HP.' },
    { id: 'flee', name: 'Retreat', cost: 0, description: 'Escape after taking one final enemy strike.' },
  ];
  return choices.map((choice) => {
    const reason = !canAct
      ? 'Wait for your turn.'
      : choice.id === 'recover' && state.player.hp >= state.player.maxHp
        ? 'HP is already full.'
        : choice.cost > state.player.stamina
          ? `Requires ${choice.cost} stamina.`
          : '';
    return { ...choice, available: reason === '', disabled: reason !== '', reason };
  });
}

export function takePlayerTurn(state, action) {
  if (state.phase !== 'player') return state;
  const choice = getAvailableActions(state).find(({ id }) => id === action);
  if (!choice?.available) return state;

  const player = { ...state.player, stamina: state.player.stamina - choice.cost };
  let enemy = state.enemy;
  let guarding = false;
  let message;
  const lastEvent = { actor: 'player', action };

  if (action === 'attack' || action === 'skill') {
    let hits;
    if (action === 'attack') {
      hits = [damageAfterDefense(player.damage, enemy.defense)];
    } else {
      switch (state.character) {
        case 'Mage':
          hits = [Math.max(1, Math.round(player.damage * 2.1))];
          break;
        case 'Mercenary':
          hits = [damageAfterDefense(player.damage * 2.2, enemy.defense)];
          break;
        case 'Ranger':
          hits = [
            damageAfterDefense(player.damage * 0.95, enemy.defense),
            damageAfterDefense(player.damage * 0.95, enemy.defense),
          ];
          break;
        default:
          hits = [damageAfterDefense(player.damage * 1.35, enemy.defense)];
          guarding = true;
      }
    }
    const damage = Math.min(enemy.hp, hits.reduce((total, hit) => total + hit, 0));
    enemy = { ...enemy, hp: Math.max(0, enemy.hp - damage) };
    Object.assign(lastEvent, { damage, hits });
    message = `${action === 'skill' ? choice.name : 'Your strike'} deals ${damage} damage${guarding ? '; your shield is raised' : ''}.`;
  } else if (action === 'guard') {
    guarding = true;
    const recovered = Math.min(GUARD_STAMINA, player.maxStamina - player.stamina);
    player.stamina += recovered;
    lastEvent.staminaRecovered = recovered;
    message = `You guard the next hit and restore ${recovered} stamina.`;
  } else if (action === 'recover') {
    const healing = Math.min(player.maxHp - player.hp, Math.max(1, Math.round(player.maxHp * 0.22)));
    player.hp += healing;
    lastEvent.healing = healing;
    message = `You catch your breath and recover ${healing} HP.`;
  } else {
    message = 'You retreat. The enemy gets one final strike before you escape.';
  }

  const victory = enemy.hp === 0;
  const log = appendLog(state, message);
  if (victory) log.push(`${enemy.name} falls. You earn ${enemy.gold} gold and ${enemy.xp} XP.`);
  return {
    ...state,
    player,
    enemy,
    guarding,
    phase: victory ? 'victory' : 'enemy',
    pendingEscape: action === 'flee',
    rewards: victory ? { gold: enemy.gold, xp: enemy.xp } : { gold: 0, xp: 0 },
    log,
    lastEvent,
  };
}

export function takeEnemyTurn(state) {
  if (TERMINAL_PHASES.has(state.phase) || state.phase !== 'enemy') return state;
  const intent = enemyIntent(state);
  const defendedDamage = damageAfterDefense(state.enemy.damage * (intent.heavy ? 1.75 : 1), state.player.defense);
  const incomingDamage = state.guarding ? Math.max(1, Math.ceil(defendedDamage / 2)) : defendedDamage;
  const damage = Math.min(state.player.hp, incomingDamage);
  const player = { ...state.player, hp: Math.max(0, state.player.hp - damage) };
  const phase = player.hp === 0 ? 'defeat' : state.pendingEscape ? 'escaped' : 'player';
  const log = appendLog(
    state,
    `${state.enemy.name} uses ${intent.label.toLowerCase()} for ${damage} damage${state.guarding ? ' (guarded)' : ''}.`,
  );
  if (phase === 'defeat') log.push('You fall in battle. Return to safety to recover.');
  if (phase === 'escaped') log.push('You escape safely, carrying no battle rewards.');

  return {
    ...state,
    player,
    enemy: { ...state.enemy, attacks: (state.enemy.attacks || 0) + 1 },
    phase,
    round: state.round + (phase === 'player' && !state.openingEnemyTurn ? 1 : 0),
    openingEnemyTurn: false,
    pendingEscape: false,
    guarding: false,
    rewards: { gold: 0, xp: 0 },
    log,
    lastEvent: { actor: 'enemy', action: 'attack', damage, heavy: intent.heavy },
  };
}
