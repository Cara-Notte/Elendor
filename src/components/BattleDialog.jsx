import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ENEMIES,
  CLASS_SKILLS,
  createBattle,
  takePlayerTurn,
  takeEnemyTurn,
  enemyIntent,
} from '../utils/battleEngine';
import '../styles/BattleDialog.css';

const ENCOUNTER_COPY = {
  'roadside-raider': { category: 'Skirmish', description: 'A road-weary marauder blocks the forest trail. A good place to learn your strengths.' },
  'ruin-sentinel': { category: 'Challenge', description: 'An armored guardian watches over the forgotten ruins. Watch its heavy attacks.' },
  'ashen-warlord': { category: 'Boss encounter', description: 'Beyond the embers, a warlord awaits. Prepare your equipment and fight with care.' },
};
const ENCOUNTER_IDS = ['roadside-raider', 'ruin-sentinel', 'ashen-warlord'];
const TERMINAL_PHASES = ['victory', 'defeat', 'escaped'];

function BattleIcon({ type, ...props }) {
  const paths = {
    attack: <><path d="m5 19 4-4M4 16l4 4M9 15 19 5l-1-3-3 1L5 13" /><path d="m8 10 6 6" /></>,
    skill: <><path d="m12 2 2.6 6.5L21 11l-6.4 2.5L12 21l-2.6-7.5L3 11l6.4-2.5Z" /><path d="m19 17 2 2M3 3l2 2" /></>,
    guard: <><path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    recover: <><path d="M8 3h8v4l3 4v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7l3-4Z" /><path d="M9 3h6M9 14h6M12 11v6" /></>,
    flee: <><path d="M14 4h6v16h-6M4 12h11m-5-5 5 5-5 5" /></>,
    gold: <><circle cx="12" cy="12" r="8" /><path d="M14 8h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3M12 6v2m0 8v2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[type] || paths.attack}</svg>;
}

function EnemySprite({ enemy, attacking = false, small = false }) {
  const boss = enemy.boss || enemy.id === 'ashen-warlord';
  const image = boss
    ? `/assets/enemy boss/boss ${attacking ? 'attack/attack' : 'walk/walk'} - sword shield.png`
    : `/assets/enemy/standard/${attacking ? 'slash' : 'combat_idle'}.png`;
  return <span className={`battle-enemy-sprite${boss ? ' battle-enemy-sprite--boss' : ''}${attacking ? ' battle-enemy-sprite--attacking' : ''}${small ? ' battle-enemy-sprite--small' : ''}${enemy.id === 'ruin-sentinel' ? ' battle-enemy-sprite--sentinel' : ''}`} style={{ backgroundImage: `url("${image}")` }} aria-hidden="true" />;
}

function HealthBar({ label, value, max, enemy = false, stamina = false }) {
  const percent = Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0));
  return <div className={`battle-meter${enemy ? ' battle-meter--enemy' : ''}${stamina ? ' battle-meter--stamina' : ''}`}>
    <div className="battle-meter-label"><span>{label}</span><span data-battle-stat={stamina ? 'stamina' : enemy ? 'enemy-hp' : 'player-hp'}>{value} <span>/ {max}</span></span></div>
    <div className="battle-meter-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><span style={{ width: `${percent}%` }} /></div>
  </div>;
}

export default function BattleDialog({ character, stats, stamina, playerName, location, level = 1, onComplete }) {
  const [selectedId, setSelectedId] = useState(null);
  const [battle, setBattle] = useState(null);
  const [animation, setAnimation] = useState(null);
  const [idleFrame, setIdleFrame] = useState(7);
  const dialogRef = useRef(null);
  const returnRef = useRef(null);
  const completedRef = useRef(false);
  const characterName = typeof character === 'string' ? character : character?.name || 'Soldier';
  const heroName = playerName || characterName;
  const previews = useMemo(() => ENCOUNTER_IDS.map(id => {
    const source = ENEMIES.find(enemy => enemy.id === id);
    return source && createBattle({ character: characterName, stats, stamina, enemyId: id, level }).enemy;
  }).filter(Boolean), [characterName, stats, stamina, level]);
  const selectedEnemy = previews.find(enemy => enemy.id === selectedId);
  const finished = Boolean(battle && TERMINAL_PHASES.includes(battle.phase));
  const skill = CLASS_SKILLS[characterName] || CLASS_SKILLS.Soldier;
  const intent = battle && !finished ? enemyIntent(battle) : null;

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => { if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus(); };
  }, []);

  useEffect(() => {
    const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let timer;
    const updateMotion = () => {
      window.clearInterval(timer);
      if (!motionPreference?.matches) timer = window.setInterval(() => setIdleFrame(frame => frame === 7 ? 8 : 7), 450);
    };
    updateMotion();
    motionPreference?.addEventListener('change', updateMotion);
    return () => {
      window.clearInterval(timer);
      motionPreference?.removeEventListener('change', updateMotion);
    };
  }, []);

  useEffect(() => {
    if (battle?.phase !== 'enemy') return undefined;
    const timer = window.setTimeout(() => setBattle(current => current?.phase === 'enemy' ? takeEnemyTurn(current) : current), 750);
    return () => window.clearTimeout(timer);
  }, [battle?.phase, battle?.round]);

  useEffect(() => {
    if (!battle?.lastEvent) return undefined;
    setAnimation(battle.lastEvent);
    const timer = window.setTimeout(() => setAnimation(null), 650);
    return () => window.clearTimeout(timer);
  }, [battle?.lastEvent]);

  useEffect(() => {
    if (finished) returnRef.current?.focus();
  }, [finished]);

  const complete = result => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(result);
  };

  const handleKeyDown = event => {
    event.stopPropagation();
    if (event.key === 'Escape' && !battle) {
      event.preventDefault();
      complete(null);
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first) {
      event.preventDefault();
      dialogRef.current.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };

  const takeAction = action => setBattle(current => current?.phase === 'player' ? takePlayerTurn(current, action) : current);
  const heroIsAttacking = animation?.actor === 'player' && ['attack', 'skill'].includes(animation.action);
  const enemyIsAttacking = animation?.actor === 'enemy';
  const turnLabel = finished ? battle.phase === 'victory' ? 'Encounter won' : battle.phase === 'escaped' ? 'Safely withdrawn' : 'You have fallen' : battle?.phase === 'enemy' ? 'Enemy turn' : 'Your turn';

  return <div className="battle-backdrop" onKeyDown={handleKeyDown} onKeyUp={event => event.stopPropagation()}>
    <section className={`battle-dialog${battle ? ' battle-dialog--active' : ''}`} role="dialog" aria-modal="true" aria-labelledby="battle-title" ref={dialogRef} tabIndex={-1} data-testid="battle-dialog" data-battle-phase={battle?.phase || 'selection'}>
      <header className="battle-header">
        <div><p className="battle-eyebrow">{location || 'The wilds of Elendor'} <span> / </span> {battle ? `Round ${battle.round}` : `Rank ${level}`}</p><h2 id="battle-title">{battle ? battle.enemy.name : 'Choose your encounter'}</h2></div>
        {battle ? <span className={`battle-turn${battle.phase === 'enemy' ? ' battle-turn--enemy' : ''}`}><i />{turnLabel}</span> : <button className="battle-close" type="button" onClick={() => complete(null)} aria-label="Close battle encounters">×</button>}
      </header>

      {!battle ? <div className="battle-selection">
        <p className="battle-intro">Steel yourself for a turn-based duel. Read your enemy, choose your actions, and earn your place in Elendor.</p>
        <div className="battle-encounters" aria-label="Available encounters">
          {previews.map(enemy => <button type="button" key={enemy.id} className={`battle-encounter${selectedId === enemy.id ? ' battle-encounter--selected' : ''}${enemy.boss ? ' battle-encounter--boss' : ''}`} aria-pressed={selectedId === enemy.id} onClick={() => setSelectedId(enemy.id)} data-enemy-id={enemy.id}>
            <div className="battle-encounter-scene"><span className="battle-encounter-category">{ENCOUNTER_COPY[enemy.id]?.category}</span><EnemySprite enemy={enemy} small /><span className="battle-encounter-ground" /></div>
            <div className="battle-encounter-copy"><h3>{enemy.name}</h3><p>{ENCOUNTER_COPY[enemy.id]?.description}</p><dl className="battle-mini-stats"><div><dt>HP</dt><dd>{enemy.maxHp}</dd></div><div><dt>ATK</dt><dd>{enemy.damage}</dd></div><div><dt>DEF</dt><dd>{enemy.defense}%</dd></div><div><dt>SPD</dt><dd>{enemy.speed}</dd></div></dl><div className="battle-encounter-rewards"><span><BattleIcon type="gold" />{enemy.gold} gold</span><span>{enemy.xp} XP</span></div></div>
            <span className="battle-encounter-select">{selectedId === enemy.id ? 'Selected' : 'Select encounter'}<span aria-hidden="true">{selectedId === enemy.id ? '✓' : '→'}</span></span>
          </button>)}
        </div>
        <footer className="battle-selection-footer"><div><strong>{heroName} <span>· {characterName}</span></strong><p>{stats.hp}/{stats.maxHp} HP <span>·</span> {Math.floor(stamina)}/{stats.stamina} stamina <span>·</span> Rank sets enemy difficulty</p></div><button className="battle-primary" data-testid="battle-begin" type="button" disabled={!selectedEnemy || stats.hp <= 0} onClick={() => setBattle(createBattle({ character: characterName, stats, stamina, enemyId: selectedId, level }))}>{selectedEnemy ? 'Begin battle' : 'Select an encounter'}<span aria-hidden="true">→</span></button></footer>
        <p className="battle-help">Basic attacks are free. Skills use stamina. Guard to restore it and soften the next hit. Health and stamina carry back to the world. Retreating costs one final enemy strike.</p>
      </div> : <>
        <div className={`battle-arena${battle.enemy.boss ? ' battle-arena--boss' : ''}`}>
          <div className="battle-combatant-plate battle-combatant-plate--hero"><div className="battle-combatant-name"><strong>{heroName}</strong><span>{characterName}</span></div><HealthBar label="Your HP" value={battle.player.hp} max={battle.player.maxHp} /></div>
          <div className="battle-combatant-plate battle-combatant-plate--enemy"><div className="battle-combatant-name"><strong>{battle.enemy.name}</strong><span>{battle.enemy.boss ? 'Boss' : 'Foe'}</span></div><HealthBar label="Enemy HP" value={battle.enemy.hp} max={battle.enemy.maxHp} enemy /></div>
          <div className={`battle-fighter battle-fighter--hero${heroIsAttacking ? ' battle-fighter--lunge' : ''}${enemyIsAttacking && animation.damage > 0 ? ' battle-fighter--hurt' : ''}${battle.phase === 'defeat' ? ' battle-fighter--fallen' : ''}${battle.guarding ? ' battle-fighter--guarding' : ''}`}><span className="battle-sprite-shadow" /><img src={`/assets/${characterName}PC/${characterName}Idle/idle${idleFrame}.png`} alt={`${characterName} ready for battle`} draggable="false" className="battle-hero-sprite" />{enemyIsAttacking && animation.damage > 0 && <span className="battle-damage" key={`${battle.round}-enemy`}>−{animation.damage}</span>}{animation?.healing > 0 && animation.actor === 'player' && <span className="battle-damage battle-damage--healing">+{animation.healing}</span>}{battle.guarding && <span className="battle-guard-effect" aria-label="Guarding"><BattleIcon type="guard" /></span>}</div>
          <div className={`battle-fighter battle-fighter--enemy${enemyIsAttacking ? ' battle-fighter--enemy-lunge' : ''}${heroIsAttacking && animation.damage > 0 ? ' battle-fighter--hurt' : ''}${battle.phase === 'victory' ? ' battle-fighter--fallen' : ''}`}><span className="battle-sprite-shadow" /><EnemySprite enemy={battle.enemy} attacking={enemyIsAttacking} />{heroIsAttacking && animation.damage > 0 && <span className="battle-damage" key={`${battle.round}-player`}>−{animation.damage}</span>}{heroIsAttacking && animation.action === 'skill' && <span className="battle-skill-effect" />}</div>
          <div className="battle-arena-caption"><span />{finished ? 'The dust settles' : 'Choose each turn with care'}<span /></div>
        </div>

        <div className="battle-lower" data-testid="battle-state" data-phase={battle.phase} data-player-hp={battle.player.hp} data-enemy-hp={battle.enemy.hp} data-stamina={battle.player.stamina}>
          <div className="battle-command-panel">
            <div className="battle-attributes" aria-label="Your combat stats"><div><span>ATK</span><strong>{battle.player.damage}</strong></div><div><span>DEF</span><strong>{battle.player.defense}%</strong></div><div><span>SPD</span><strong>{battle.player.speed}</strong></div><HealthBar label="Stamina" value={battle.player.stamina} max={battle.player.maxStamina} stamina /></div>
            {finished ? <div className={`battle-outcome battle-outcome--${battle.phase}`} role="status"><p className="battle-eyebrow">{battle.phase === 'victory' ? 'Victory' : battle.phase === 'escaped' ? 'Retreat' : 'Defeat'}</p><h3>{battle.phase === 'victory' ? 'The field is yours.' : battle.phase === 'escaped' ? 'Live to fight another day.' : 'Your journey continues.'}</h3><p>{battle.phase === 'victory' ? `You defeated ${battle.enemy.name}. Your spoils await.` : battle.phase === 'escaped' ? 'You escaped the encounter. No rewards were earned.' : 'Travelers rescue you with 30% health restored. You lose 10% of your carried gold.'}</p>{battle.phase === 'victory' && <div className="battle-loot"><span><BattleIcon type="gold" /><strong>+{battle.rewards.gold}</strong> gold</span><span><strong>+{battle.rewards.xp}</strong> XP</span></div>}<button ref={returnRef} data-testid="battle-return" className="battle-primary" type="button" onClick={() => complete(battle)}>Return to world<span aria-hidden="true">→</span></button></div> : <>
              <div className={`battle-intent${intent?.heavy ? ' battle-intent--heavy' : ''}`}><BattleIcon type={intent?.heavy ? 'attack' : 'guard'} /><div><span>Enemy intent</span><strong>{intent?.label}</strong><p>{intent?.description}</p></div></div>
              <div className="battle-actions" aria-label="Battle actions" aria-busy={battle.phase === 'enemy'}>
                <button type="button" className="battle-action battle-action--attack" disabled={battle.phase !== 'player'} data-action="attack" onClick={() => takeAction('attack')}><BattleIcon type="attack" /><span><strong>Strike</strong><small>Strike with your equipped weapon · free</small></span><em>Basic</em></button>
                <button type="button" className="battle-action battle-action--skill" disabled={battle.phase !== 'player' || battle.player.stamina < skill.cost} data-action="skill" onClick={() => takeAction('skill')} title={battle.player.stamina < skill.cost ? `Requires ${skill.cost} stamina. ${skill.description}` : skill.description}><BattleIcon type="skill" /><span><strong>{skill.name}</strong><small>{skill.description}</small></span><em>{skill.cost} STA</em></button>
                <button type="button" className="battle-action" disabled={battle.phase !== 'player'} data-action="guard" onClick={() => takeAction('guard')}><BattleIcon type="guard" /><span><strong>Guard</strong><small>Reduce next hit · restore 15 stamina</small></span><em>+15 STA</em></button>
                <button type="button" className="battle-action" disabled={battle.phase !== 'player' || battle.player.stamina < 12 || battle.player.hp >= battle.player.maxHp} title={battle.player.hp >= battle.player.maxHp ? 'Your health is already full' : battle.player.stamina < 12 ? 'Requires 12 stamina' : 'Restore 22% of your maximum health'} data-action="recover" onClick={() => takeAction('recover')}><BattleIcon type="recover" /><span><strong>Recover</strong><small>Restore 22% of your maximum health</small></span><em>12 STA</em></button>
              </div>
              <div className="battle-command-footer"><span role="status">{battle.pendingEscape ? 'Retreating. Brace for one final strike…' : battle.phase === 'enemy' ? 'Your enemy is making a move…' : 'Your move. Choose an action.'}</span><button type="button" className="battle-flee" disabled={battle.phase !== 'player'} data-action="flee" title="Escape after taking one final enemy strike" onClick={() => takeAction('flee')}><BattleIcon type="flee" /><span>Retreat<small>Take one final hit</small></span></button></div>
            </>}
          </div>
          <aside className="battle-log-panel" aria-label="Battle log"><div className="battle-log-heading"><h3>Battle chronicle</h3><span>Round {battle.round}</span></div><ol className="battle-log" role="log" aria-live="polite" aria-relevant="additions text">{battle.log.slice(-7).map((entry, index) => <li key={`${battle.log.length - Math.min(battle.log.length, 7) + index}-${entry}`} className={index === Math.min(battle.log.length, 7) - 1 ? 'battle-log-latest' : ''}>{entry}</li>)}</ol><p className="battle-log-tip">Attack and defense include your equipment. Speed decides the opening turn.</p></aside>
        </div>
      </>}
    </section>
  </div>;
}
