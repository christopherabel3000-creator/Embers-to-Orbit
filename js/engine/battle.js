// Tactical battles. The field has three zones (left flank, center, right
// flank) plus a reserve. Each round both sides give every group an order at
// the same time, then the round resolves. Groups break and flee when they
// lose too much strength; a side wins when the other breaks or flees.

import { living, personById, canFight, hasKnowledge } from './state.js';
import { randomBetween, randomInt, chance, pick, nextRandom } from './rng.js';
import { gainExperience } from './skills.js';
import { refreshAdvisors } from './advisors.js';
import { meet, changeRelation } from './neighbors.js';
import { listNames, clamp, plural } from './util.js';
import { recordDeed, hasTradition } from './legacy.js';

export const ZONES = ['left', 'center', 'right'];
export const ZONE_NAMES = { left: 'left flank', center: 'center', right: 'right flank', reserve: 'reserve' };
const AT = { left: 'On the left flank', center: 'In the center', right: 'On the right flank' };
export const ORDER_NAMES = {
  hold: 'Hold',
  attack: 'Attack',
  flank: 'Swing round to hit the enemy center',
  fallBack: 'Fall back to the reserve',
};
export const MAX_ROUNDS = 4;
const RAIDER_STRENGTH = 6;
const PACE = 0.4; // Share of strength that turns into damage each round.
const BREAK_AT = 0.4; // A group breaks below this share of its starting strength.
const ENEMY_RETREAT_AT = 0.35; // The enemy gives up below this share of its fighters.
const WOUND_EVERY = 6; // About one wound for this much damage.

// ---------- strength ----------

export function fighterStrength(state, p) {
  const spears = hasKnowledge(state, 'spears') ? 1.5 : 0;
  const warriors = hasTradition(state, 'warrior') ? 1.5 : 0;
  const bows = hasKnowledge(state, 'bows') ? 1.5 : 0;
  return (4 + p.skills.hunting * 1.5 + spears + warriors + bows) * Math.max(0.3, p.health / 100) * guardBonus(state, p);
}

// Guards are trained and ready; drill and a chieftain make them stronger.
export function guardBonus(state, p) {
  if (p.task !== 'guard') return 1;
  return (hasKnowledge(state, 'drill') ? 1.5 : 1.25) + (hasKnowledge(state, 'chieftain') ? 0.15 : 0);
}

function groupStrength(state, ids) {
  return ids.reduce((sum, id) => {
    const p = personById(state, id);
    return p && p.alive ? sum + fighterStrength(state, p) : sum;
  }, 0);
}

function aliveIds(state, ids) {
  return ids.filter((id) => {
    const p = personById(state, id);
    return p && p.alive;
  });
}

export function enemyTotal(battle) {
  return ZONES.reduce((sum, z) => sum + battle.enemy[z], 0);
}

// ---------- setting up ----------

// Splits the enemy across the three zones.
function enemyDeployment(state, n, side) {
  const patterns = side === 'attack'
    ? [[0.3, 0.4, 0.3], [0.25, 0.5, 0.25]]
    : [[0.34, 0.33, 0.33], [0.25, 0.5, 0.25], [0.5, 0.3, 0.2], [0.2, 0.3, 0.5]];
  const shares = pick(state, patterns);
  const counts = shares.map((s) => Math.floor(n * s));
  let left = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % 3, left -= 1) counts[i] += 1;
  return { left: counts[0], center: counts[1], right: counts[2] };
}

// A raid or expedition waiting for the player to deploy.
// side: 'defend' (raiders at your camp) or 'attack' (you assault Skarn hold).
export function createBattle(state, ev) {
  const side = ev.side || 'defend';
  const enemy = enemyDeployment(state, ev.raiders, side);
  return {
    side,
    from: ev.from || 'skarn',
    warned: side === 'attack' ? true : ev.warned,
    terrain: {
      palisade: side === 'defend' && state.buildings.palisade > 0,
      wall: side === 'defend' && state.buildings.stoneWall > 0,
      treeline: side === 'defend' ? 'left' : null,
      hillfort: side === 'attack',
    },
    phase: 'deploy',
    round: 0,
    enemyStart: ev.raiders,
    enemy,
    enemyZoneStart: { ...enemy },
    ours: { left: [], center: [], right: [], reserve: [] },
    oursStart: { left: 0, center: 0, right: 0 },
    fought: [],
    fled: [],
    breakIns: 0,
    loot: { food: 0, wood: 0 },
    lastRound: [],
    history: [],
  };
}

export const FORMATIONS = {
  even: 'An even line across all three zones',
  center: 'A strong center',
  left: 'A strong left flank',
  right: 'A strong right flank',
  reserve: 'An even line with a fifth held in reserve',
  mirror: 'Match the enemy: more where they are stronger',
};

// Suggests where each fighter should stand. Returns { personId: zone }.
export function formationPlan(state, battle, formation) {
  const fighters = living(state).filter(canFight)
    .sort((a, b) => fighterStrength(state, b) - fighterStrength(state, a));
  const plan = {};
  let shares;
  if (formation === 'center') shares = { left: 0.25, center: 0.5, right: 0.25 };
  else if (formation === 'left') shares = { left: 0.5, center: 0.3, right: 0.2 };
  else if (formation === 'right') shares = { left: 0.2, center: 0.3, right: 0.5 };
  else if (formation === 'mirror') {
    const total = enemyTotal(battle) || 1;
    shares = Object.fromEntries(ZONES.map((z) => [z, battle.enemy[z] / total]));
  } else shares = { left: 1 / 3, center: 1 / 3, right: 1 / 3 };
  let pool = fighters;
  if (formation === 'reserve') {
    const keep = Math.max(1, Math.round(fighters.length / 5));
    for (const p of fighters.slice(-keep)) plan[p.id] = 'reserve';
    pool = fighters.slice(0, -keep);
  }
  // Deal the strongest first, each to the zone furthest below its share.
  const filled = { left: 0, center: 0, right: 0 };
  const totalStrength = pool.reduce((sum, p) => sum + fighterStrength(state, p), 0) || 1;
  for (const p of pool) {
    const zone = ZONES
      .filter((z) => shares[z] > 0)
      .sort((a, b) => (filled[a] / totalStrength - shares[a]) - (filled[b] / totalStrength - shares[b]))[0];
    plan[p.id] = zone;
    filled[zone] += fighterStrength(state, p);
  }
  return plan;
}

// The war chief's choice of formation.
export function warChiefFormation(battle) {
  return battle.warned ? 'mirror' : 'even';
}

// Places the fighters. assignments: { personId: 'left' | 'center' | 'right' | 'reserve' | 'out' }.
export function deploy(state, battle, assignments) {
  const ours = { left: [], center: [], right: [], reserve: [] };
  for (const [idText, zone] of Object.entries(assignments)) {
    const p = personById(state, Number(idText));
    if (!p || !canFight(p) || !(zone in ours)) continue;
    ours[zone].push(p.id);
  }
  if (!ZONES.some((z) => ours[z].length) && !ours.reserve.length) {
    return { error: 'Place at least one fighter on the field.' };
  }
  battle.ours = ours;
  battle.oursStart = Object.fromEntries(ZONES.map((z) => [z, groupStrength(state, ours[z])]));
  battle.fought = [...ZONES.flatMap((z) => ours[z]), ...ours.reserve];
  battle.phase = 'fight';
  battle.round = 1;
  return { ok: true };
}

// ---------- orders ----------

function enemyOrders(state, battle) {
  const orders = {};
  for (const z of ZONES) {
    const n = battle.enemy[z];
    if (!n) continue;
    const ours = groupStrength(state, battle.ours[z]);
    const theirs = n * RAIDER_STRENGTH;
    if (battle.side === 'attack') {
      // Defending their hold: mostly hold the walls, strike when strong.
      orders[z] = theirs > ours * 1.5 && chance(state, 0.5) ? 'attack' : 'hold';
      continue;
    }
    if (n < battle.enemyZoneStart[z] * 0.55 && chance(state, 0.4)) orders[z] = 'fallBack';
    else if (!battle.ours[z].length) orders[z] = 'attack';
    else if (z !== 'center' && battle.ours.center.length && chance(state, 0.2)) orders[z] = 'flank';
    else orders[z] = chance(state, 0.75) ? 'attack' : 'hold';
  }
  return orders;
}

// What the war chief would order. Also used for advice and auto-resolve.
export function warChiefOrders(state, battle) {
  const orders = {};
  let weakest = null;
  let weakestRatio = Infinity;
  for (const z of ZONES) {
    const ids = battle.ours[z];
    const theirs = battle.enemy[z] * RAIDER_STRENGTH;
    if (!ids.length) {
      if (theirs > 0 && 0 < weakestRatio) { weakest = z; weakestRatio = 0; }
      continue;
    }
    const ours = groupStrength(state, ids);
    const ratio = theirs ? ours / theirs : Infinity;
    if (theirs && ratio < weakestRatio) { weakest = z; weakestRatio = ratio; }
    if (!theirs) {
      if (battle.side === 'attack') orders[z] = 'attack';
      else orders[z] = z !== 'center' && battle.enemy.center ? 'flank' : 'hold';
    } else if (battle.side === 'attack') {
      orders[z] = ratio >= 1.2 ? 'attack' : 'hold';
    } else {
      orders[z] = ratio >= 1.4 ? 'attack' : 'hold';
    }
  }
  orders.reserve = battle.ours.reserve.length && weakest ? weakest : 'stay';
  return orders;
}

export function describeOrders(orders) {
  const parts = ZONES.filter((z) => orders[z]).map((z) => {
    const verb = { hold: 'hold', attack: 'attack', flank: 'swing round to the center', fallBack: 'fall back' }[orders[z]];
    return `${verb} on the ${ZONE_NAMES[z]}`;
  });
  if (orders.reserve && orders.reserve !== 'stay') parts.push(`send the reserve to the ${ZONE_NAMES[orders.reserve]}`);
  return parts.join(', ');
}

// ---------- resolving a round ----------

function inMultiplier(battle, order, zone, ourSide) {
  if (order === 'fallBack') return 0.5;
  if (order !== 'hold') return 1;
  if (ourSide) {
    if (battle.terrain.wall) return 0.35;
    if (battle.terrain.palisade) return 0.45;
    if (battle.terrain.treeline === zone) return 0.6;
    return 0.7;
  }
  return battle.terrain.hillfort ? 0.5 : 0.7;
}

function outMultiplier(order, battle = null, ourSide = false) {
  // Defenders behind a palisade strike from the walls as hard as in the open.
  if (order === 'hold' && ourSide && battle && battle.terrain.wall) return 1.25;
  if (order === 'hold' && ourSide && battle && battle.terrain.palisade) return 1.1;
  return { hold: 0.8, attack: 1.2, flank: 1.5, fallBack: 0 }[order] ?? 1;
}

// Wounds spread across a group.
function woundGroup(state, ids, damage, lines) {
  const members = aliveIds(state, ids);
  if (!members.length || damage <= 0) return;
  let hits = Math.floor(damage / WOUND_EVERY) + (nextRandom(state) < (damage % WOUND_EVERY) / WOUND_EVERY ? 1 : 0);
  const wounded = new Set();
  const killed = [];
  while (hits > 0) {
    hits -= 1;
    const p = personById(state, pick(state, aliveIds(state, members)) ?? members[0]);
    if (!p || !p.alive) break;
    p.health = clamp(p.health - randomInt(state, 20, 35));
    wounded.add(p);
    if (p.health <= 0) {
      p.alive = false;
      killed.push(p);
    }
  }
  const hurtOnly = [...wounded].filter((p) => p.alive);
  if (hurtOnly.length) lines.push(`Wounded: ${listNames(hurtOnly)}.`);
  for (const p of killed) lines.push(`${p.name} was killed.`);
}

// Resolves one round. orders: { left, center, right, reserve }.
export function resolveRound(state, battle, ourOrders) {
  const lines = [];
  const surprised = !battle.warned && battle.round === 1;
  const enemy = enemyOrders(state, battle);
  const ours = { ...ourOrders };
  for (const z of ZONES) {
    if (!battle.ours[z].length) delete ours[z];
    else if (!ours[z] || (ours[z] === 'flank' && z === 'center')) ours[z] = 'hold';
  }

  // The reserve joins a zone first.
  const target = ourOrders.reserve;
  if (target && target !== 'stay' && ZONES.includes(target) && battle.ours.reserve.length) {
    const joining = aliveIds(state, battle.ours.reserve);
    battle.ours[target].push(...joining);
    battle.oursStart[target] += groupStrength(state, joining);
    battle.ours.reserve = [];
    if (!ours[target]) ours[target] = 'hold';
    lines.push(`The reserve joined the ${ZONE_NAMES[target]}: ${listNames(joining.map((id) => personById(state, id)))}.`);
  }

  // Who fights where. Flankers strike the enemy center from the side.
  const fronts = Object.fromEntries(ZONES.map((z) => [z, { ours: [], theirs: [] }]));
  for (const z of ZONES) {
    if (ours[z]) fronts[ours[z] === 'flank' ? 'center' : z].ours.push({ zone: z, order: ours[z] });
    if (enemy[z]) fronts[enemy[z] === 'flank' ? 'center' : z].theirs.push({ zone: z, order: enemy[z] });
  }

  const enemyLosses = { left: 0, center: 0, right: 0 };
  for (const z of ZONES) {
    const f = fronts[z];
    const oursHere = f.ours;
    const theirsHere = f.theirs;
    const ourOut = oursHere.reduce((sum, g) => sum + groupStrength(state, battle.ours[g.zone]) * outMultiplier(g.order, battle, true), 0)
      * (surprised ? 0.75 : 1);
    const theirOut = theirsHere.reduce((sum, g) => sum + battle.enemy[g.zone] * RAIDER_STRENGTH * outMultiplier(g.order), 0)
      * (surprised ? 1.2 : 1);
    const bothHold = oursHere.every((g) => g.order === 'hold') && theirsHere.every((g) => g.order === 'hold');
    const skirmish = bothHold ? 0.4 : 1;

    if (!theirsHere.length && oursHere.length) {
      if (battle.side === 'attack' && oursHere.some((g) => g.order === 'attack')) {
        battle.breakIns += 1;
        lines.push(`${AT[z]}, your fighters met no one and pushed through the Skarn defenses.`);
      }
      continue;
    }
    if (theirsHere.length && !oursHere.some((g) => g.order !== 'fallBack')) {
      // Nobody stands against them here.
      if (battle.side === 'defend') {
        const n = theirsHere.reduce((sum, g) => sum + battle.enemy[g.zone], 0);
        const food = Math.min(state.resources.food, n * 2);
        const wood = Math.min(state.resources.wood, n);
        state.resources.food -= food;
        state.resources.wood -= wood;
        battle.loot.food += food;
        battle.loot.wood += wood;
        lines.push(`${AT[z]}, nobody stood in the raiders' way. They carried off ${food} food and ${wood} wood.`);
      }
      if (!oursHere.length) continue;
    }

    // Damage, shared out by strength.
    lines.push(`${AT[z]}, the two sides ${bothHold ? 'traded blows from cover' : 'clashed'}.`);
    const toUs = theirOut * PACE * skirmish * randomBetween(state, 0.8, 1.2);
    const toThem = ourOut * PACE * skirmish * randomBetween(state, 0.8, 1.2);
    for (const g of oursHere) {
      const share = groupStrength(state, battle.ours[g.zone]) / Math.max(1, oursHere.reduce((s, x) => s + groupStrength(state, battle.ours[x.zone]), 0));
      woundGroup(state, battle.ours[g.zone], toUs * share * inMultiplier(battle, g.order, g.zone, true), lines);
    }
    const theirTotal = theirsHere.reduce((s, g) => s + battle.enemy[g.zone], 0) || 1;
    for (const g of theirsHere) {
      const share = battle.enemy[g.zone] / theirTotal;
      const dmg = toThem * share * inMultiplier(battle, g.order, g.zone, false);
      const fallen = Math.min(battle.enemy[g.zone], Math.floor(dmg / RAIDER_STRENGTH) + (nextRandom(state) < (dmg % RAIDER_STRENGTH) / RAIDER_STRENGTH ? 1 : 0));
      enemyLosses[g.zone] += fallen;
    }
  }

  // Enemy losses and flight.
  const foe = battle.from === 'outlaws' ? 'outlaws' : 'Skarn';
  for (const z of ZONES) {
    const lost = Math.min(battle.enemy[z], enemyLosses[z]);
    battle.enemy[z] -= lost;
    if (lost) lines.push(`The ${foe} lost ${lost} ${AT[z].replace(/^On|^In/, (w) => w.toLowerCase())}.`.replace(/ (on|in) the/, ' $1 the'));
    if (battle.enemy[z] > 0 && battle.enemy[z] < battle.enemyZoneStart[z] * BREAK_AT) {
      lines.push(`The ${foe} on the ${ZONE_NAMES[z]} broke and ran.`);
      battle.enemy[z] = 0;
    } else if (enemy[z] === 'fallBack' && battle.enemy[z] > 0) {
      lines.push(`The ${foe} on the ${ZONE_NAMES[z]} pulled back.`);
      battle.enemy[z] = 0;
    }
  }

  // Our groups: the fallen are gone, the falling-back join the reserve,
  // and groups that have lost too much break.
  for (const z of ZONES) {
    battle.ours[z] = aliveIds(state, battle.ours[z]);
    if (!battle.ours[z].length) continue;
    if (ours[z] === 'fallBack') {
      battle.ours.reserve.push(...battle.ours[z]);
      lines.push(`Your fighters on the ${ZONE_NAMES[z]} fell back to the reserve.`);
      battle.ours[z] = [];
      battle.oursStart[z] = 0;
      continue;
    }
    if (groupStrength(state, battle.ours[z]) < battle.oursStart[z] * BREAK_AT) {
      lines.push(`Your fighters on the ${ZONE_NAMES[z]} broke and fled back to camp: ${listNames(battle.ours[z].map((id) => personById(state, id)))}.`);
      battle.fled.push(...battle.ours[z]);
      battle.ours[z] = [];
      battle.oursStart[z] = 0;
    }
  }
  battle.ours.reserve = aliveIds(state, battle.ours.reserve);

  battle.lastRound = lines;
  battle.history.push(...lines);
  battle.round += 1;
  return { lines, outcome: checkOutcome(state, battle) };
}

function checkOutcome(state, battle) {
  const ourLeft = ZONES.some((z) => battle.ours[z].length) || battle.ours.reserve.length;
  if (!ourLeft) return 'defeat';
  if (enemyTotal(battle) <= battle.enemyStart * ENEMY_RETREAT_AT || enemyTotal(battle) === 0) return 'victory';
  if (battle.side === 'attack' && battle.breakIns >= 2) return 'victory';
  if (battle.round > MAX_ROUNDS) return 'stalemate';
  return null;
}

// ---------- ending ----------

export function finishBattle(state, battle, outcome) {
  const lines = [];
  const all = living(state);
  const foe = battle.from === 'outlaws' ? 'outlaws' : 'Skarn';
  const veterans = battle.fought.map((id) => personById(state, id)).filter((p) => p && p.alive);
  const res = state.resources;
  const takeShare = (foodShare, woodShare) => {
    const f = Math.max(0, Math.floor(res.food * foodShare));
    const w = Math.max(0, Math.floor(res.wood * woodShare));
    res.food -= f;
    res.wood -= w;
    return [f, w];
  };

  if (outcome === 'victory') recordDeed(state, 'battlesWon');
  if (battle.side === 'attack') recordDeed(state, 'attacks');
  if (battle.side === 'defend') {
    if (outcome === 'victory') {
      lines.push(`The ${foe} broke and fled. ${state.campName} is safe.`);
      for (const p of all) p.morale = clamp(p.morale + 8);
      if (battle.from !== 'outlaws') changeRelation(state, 'skarn', -5);
    } else if (outcome === 'stalemate') {
      lines.push(`At dusk the ${foe} pulled back${battle.loot.food || battle.loot.wood ? `, carrying off ${battle.loot.food} food and ${battle.loot.wood} wood` : ''}.`);
    } else if (outcome === 'retreat') {
      const [f, w] = takeShare(0.3, 0.2);
      lines.push(`Your people abandoned the fight and fled into the trees. The ${foe} took ${f} food and ${w} wood.`);
      for (const p of all) p.morale = clamp(p.morale - 8);
    } else {
      const [f, w] = takeShare(0.4, 0.3);
      lines.push(`Your defenders were overwhelmed. The ${foe} took ${f + battle.loot.food} food and ${w + battle.loot.wood} wood in all.`);
      for (const p of all) p.morale = clamp(p.morale - 10);
    }
  } else if (outcome === 'victory') {
    const food = 30;
    const wood = 20;
    res.food += food;
    res.wood += wood;
    const sk = state.neighbors.skarn;
    sk.relation = Math.max(sk.relation + 15, 10);
    sk.truceUntil = Math.max(sk.truceUntil, state.turn + 8);
    state.raidThreat = false;
    for (const p of all) p.morale = clamp(p.morale + 10);
    lines.push(`Skarn hold has fallen to your fighters. You carried home ${food} food and ${wood} wood. The Skarn chiefs swore to leave you alone for two years, and they respect you now. A lasting peace may be possible.`);
  } else {
    changeRelation(state, 'skarn', -10);
    state.raidThreat = true;
    for (const p of all) p.morale = clamp(p.morale - 8);
    lines.push(outcome === 'retreat'
      ? 'Your fighters turned back from Skarn hold. The Skarn will want revenge.'
      : 'The attack on Skarn hold failed, and your fighters straggled home. The Skarn will want revenge.');
  }

  // Battle is the hardest teacher: two seasons of hunting practice.
  const hardened = veterans.filter((p) => gainExperience(p, 'hunting', 2));
  if (hardened.length) lines.push(`The battle hardened ${hardened.map((p) => `${p.name} (hunting ${p.skills.hunting})`).join(', ')}.`);

  if (battle.from !== 'outlaws' && meet(state, 'skarn', { contact: false })) {
    lines.push('After the fighting, a wounded raider told your people who they were: the Skarn, from a fortified hold in the rocky hills. You can now deal with them on the Neighbors screen.');
  }
  state.pendingEvent = null;
  refreshAdvisors(state);
  if (living(state).length === 0) state.gameOver = true;
  return lines;
}

// The war chief fights the whole battle. Returns all the lines.
export function autoBattle(state, ev, assignments = null) {
  const battle = ev.battle || createBattle(state, ev);
  const lines = [];
  if (battle.phase === 'deploy') {
    const plan = assignments || formationPlan(state, battle, warChiefFormation(battle));
    const placed = deploy(state, battle, plan);
    if (placed.error) return { error: placed.error };
  }
  let outcome = null;
  while (!outcome) {
    const round = resolveRound(state, battle, warChiefOrders(state, battle));
    outcome = round.outcome;
  }
  lines.push(...summarize(state, battle));
  lines.push(...finishBattle(state, battle, outcome));
  return { lines, outcome };
}

// A short account of how a battle went, for the season report.
export function summarize(state, battle) {
  const rounds = battle.round - 1;
  const fallen = battle.fought.map((id) => personById(state, id)).filter((p) => p && !p.alive);
  const parts = [`The battle lasted ${plural(rounds, 'round', 'rounds')}.`];
  if (fallen.length) parts.push(`Killed: ${listNames(fallen)}.`);
  if (battle.loot.food || battle.loot.wood) parts.push(`Raiders reached the stores and took ${battle.loot.food} food and ${battle.loot.wood} wood.`);
  return [parts.join(' ')];
}

// How the field looks, for the player.
export function enemyWord(battle, n) {
  if (battle.warned || battle.round > 1) return String(n);
  return n ? `about ${n}` : 'none seen';
}

export function oddsWord(ours, theirs) {
  if (!theirs) return 'unopposed';
  const r = ours / theirs;
  if (r >= 1.4) return 'stronger';
  if (r >= 0.8) return 'evenly matched';
  return 'outmatched';
}

export function zoneStrength(state, battle, zone) {
  return groupStrength(state, battle.ours[zone]);
}

export { RAIDER_STRENGTH };

// Estimates the chance of victory by quietly fighting the battle many times
// on copies of the game. Used by the war chief's advice.
export function estimateBattle(state, ev, defenderIds = null, trials = 24) {
  let wins = 0;
  for (let i = 0; i < trials; i++) {
    const copy = structuredClone(state);
    copy.rng = (state.rng + 7919 * (i + 1)) >>> 0;
    copy.log = [];
    const pending = { ...ev, battle: ev.battle ? structuredClone(ev.battle) : createBattle(copy, ev) };
    copy.pendingEvent = pending;
    let assignments = null;
    if (pending.battle.phase === 'deploy') {
      const plan = formationPlan(copy, pending.battle, warChiefFormation(pending.battle));
      assignments = defenderIds
        ? Object.fromEntries(Object.entries(plan).filter(([id]) => defenderIds.includes(Number(id))))
        : plan;
      if (!Object.keys(assignments).length) return 0;
    }
    const result = autoBattle(copy, pending, assignments);
    if (!result.error && result.outcome === 'victory') wins += 1;
  }
  return wins / trials;
}

// ---------- what the player sees ----------

// Everything the battle screens need, in plain words.
export function battleView(state) {
  const ev = state.pendingEvent;
  if (!ev || ev.type !== 'raid') return null;
  // Older saves may have a raid waiting without a battle; plan one on a copy
  // so that looking at the screen never changes the game.
  const battle = ev.battle || createBattle(structuredClone(state), ev);
  const attack = battle.side === 'attack';
  const foe = battle.from === 'outlaws' ? 'outlaws' : state.neighbors.skarn.known || attack ? 'Skarn' : 'raiders';
  const terrain = [];
  if (battle.terrain.wall) terrain.push('Your stone wall covers every zone: fighters who hold behind it take very little harm and strike hard from the top.');
  else if (battle.terrain.palisade) terrain.push('Your palisade covers every zone: fighters who hold behind it take far less harm and strike hard from the walls.');
  if (battle.terrain.treeline) terrain.push(`The treeline covers your ${ZONE_NAMES[battle.terrain.treeline]}: fighters holding there take less harm.`);
  if (battle.terrain.hillfort) terrain.push('The Skarn hold their walls on a rocky hill: they take far less harm while they hold. Attack where they are thin; pushing through two zones they have left empty wins the day.');
  if (!battle.warned) terrain.push('You were caught by surprise: in the first round your fighters strike weaker and the raiders harder.');
  const enemyLines = ZONES.map((z) => `${capitalize(ZONE_NAMES[z])}: ${enemyWord(battle, battle.enemy[z])} ${foe}.`);
  const view = {
    phase: battle.phase,
    side: battle.side,
    foe,
    round: battle.round,
    maxRounds: MAX_ROUNDS,
    terrain,
    enemyLines,
    enemyTotal: enemyTotal(battle),
    lastRound: battle.lastRound,
    loot: battle.loot,
  };
  if (battle.phase === 'deploy') {
    const suggested = warChiefFormation(battle);
    view.suggestedFormation = suggested;
    view.plan = formationPlan(state, battle, suggested);
    view.fighters = living(state).filter(canFight).map((p) => ({ id: p.id, name: p.name, hunting: p.skills.hunting, health: p.health, sick: p.sick }));
    return view;
  }
  view.zones = ZONES.map((z) => {
    const ids = battle.ours[z];
    const ours = groupStrength(state, ids);
    const theirs = battle.enemy[z] * RAIDER_STRENGTH;
    return {
      zone: z,
      name: ZONE_NAMES[z],
      people: ids.map((id) => personById(state, id).name),
      enemy: battle.enemy[z],
      odds: ids.length ? oddsWord(ours, theirs) : null,
      orders: !ids.length ? [] : ['hold', 'attack', ...(z !== 'center' ? ['flank'] : []), 'fallBack'],
    };
  });
  view.reserve = battle.ours.reserve.map((id) => personById(state, id).name);
  const advice = warChiefOrders(state, battle);
  view.advice = advice;
  view.adviceText = describeOrders(advice);
  return view;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
