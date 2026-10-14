// Tactical battles. The field has three zones (left flank, center, right
// flank) plus a reserve. Each round both sides give every group an order at
// the same time, then the round resolves. Groups break and flee when they
// lose too much strength; a side wins when the other breaks or flees.

import {
  living, personById, canFight, hasKnowledge, placeName,
} from './state.js';
import { lawFight } from './laws.js';
import { randomBetween, randomInt, chance, pick, nextRandom } from './rng.js';
import { gainExperience } from './skills.js';
import { refreshAdvisors } from './advisors.js';
import { meet, changeRelation } from './neighbors.js';
import {
  listNames, clamp, plural, capital,
} from './util.js';
import { recordDeed, hasTradition } from './legacy.js';
import { skarnLosses, skarnArms } from './nations.js';
import { clansMarching, skarnStrength } from './clans.js';
import { weatherEffects, weatherLine } from './weather.js';

export const ZONES = ['left', 'center', 'right'];
export const ZONE_NAMES = { left: 'left flank', center: 'center', right: 'right flank', reserve: 'reserve' };
const AT = { left: 'On the left flank', center: 'In the center', right: 'On the right flank' };
export const ORDER_NAMES = {
  hold: 'Hold',
  attack: 'Attack',
  flank: 'Swing round to hit the enemy center',
  shieldWall: 'Form a shield wall',
  brace: 'Brace spears against a charge',
  fallBack: 'Fall back to the reserve',
};

// Shield walls and braced spears. A shield wall takes little harm from
// arrows and less from blows, but strikes weakly. Braced spears stand in
// front of any walls: they strike charging fighters very hard, and anyone
// else weakly, and give no shelter from arrows. Your people need Shields and
// drill for the one and Fire-hardened spears for the other; Skarn bands use
// both once they are well armed.
export const SHIELD_ARROWS = 0.3;
export const SHIELD_MELEE = 0.6;
export const SHIELD_OUT = 0.5;
export const BRACE_IN = 0.7;
export const BRACE_CHARGED = 1.3;
export const BRACE_IDLE = 0.5;
export const SKARN_TACTICS_ARMS = 1.3;
const HOLDING = new Set(['hold', 'shieldWall', 'brace']);
const CHARGING = new Set(['attack', 'flank']);

// The orders a zone of your fighters can be given.
export function zoneOrders(state, zone) {
  return ['hold', 'attack', ...(zone !== 'center' ? ['flank'] : []),
    ...(hasKnowledge(state, 'drill') ? ['shieldWall'] : []),
    ...(hasKnowledge(state, 'spears') ? ['brace'] : []), 'fallBack'];
}

const WORKER_WORDS = {
  hunt: 'hunters', forage: 'foragers', wood: 'woodcutters', quarry: 'quarriers',
};
export const MAX_ROUNDS = 4;
const RAIDER_STRENGTH = 6;

// How hard each enemy strikes in this battle. Skarn warriors grow stronger
// the longer they have been a nation (see skarnArms), and are as much harder
// to bring down; hill clansmen and outlaws fight like the old raiders.
// What the enemy are called in battle lines.
export function foeName(battle) {
  return { outlaws: 'outlaws', clans: 'hill clansmen' }[battle.from] || 'Skarn';
}

export function foeStrength(battle) {
  return battle.foeStrength || RAIDER_STRENGTH;
}

export function foeStrengthFor(state, ev, side) {
  if ((ev.from || 'skarn') !== 'skarn' || !state.neighbors.skarn.nation) return RAIDER_STRENGTH;
  const arms = skarnArms(state);
  const total = skarnStrength(state);
  const clanShare = side === 'attack' || !total ? 0 : clansMarching(state) / total;
  return Math.round(RAIDER_STRENGTH * (arms * (1 - clanShare) + clanShare) * 100) / 100;
}
const PACE = 0.4; // Share of strength that turns into damage each round.
const BREAK_AT = 0.4; // A group breaks below this share of its starting strength.
const ENEMY_RETREAT_AT = 0.35; // The enemy gives up below this share of its fighters.
const WOUND_EVERY = 6; // About one wound for this much damage.

// ---------- strength ----------

export function fighterStrength(state, p) {
  const spears = hasKnowledge(state, 'spears') ? 1.5 : 0;
  const warriors = hasTradition(state, 'warrior') ? 1.5 : 0;
  const bows = hasKnowledge(state, 'bows') ? 1.5 : 0;
  return (4 + p.skills.hunting * 1.5 + spears + warriors + bows) * Math.max(0.3, p.health / 100) * guardBonus(state, p) * lawFight(state, p);
}

// Guards are trained and ready; drill and a chieftain make them stronger.
export function guardBonus(state, p) {
  if (p.task !== 'guard') return 1;
  const base = (hasKnowledge(state, 'drill') ? 1.5 : 1.25) + (hasKnowledge(state, 'chieftain') ? 0.15 : 0);
  return base * (state.guardsArmed ? 1.2 : 1); // Armed with goods by standing order.
}

// Archers: anyone who knows the bow and hunts well (hunting 3 or more)
// shoots rather than fighting hand to hand. Guards stand in the line.
export function isArcher(state, p) {
  return hasKnowledge(state, 'bows') && p.skills.hunting >= 3 && p.task !== 'guard';
}

// A group's strength, split into archers and those who fight up close.
function groupParts(state, ids) {
  let archers = 0;
  let melee = 0;
  for (const id of ids) {
    const p = personById(state, id);
    if (!p || !p.alive) continue;
    if (isArcher(state, p)) archers += fighterStrength(state, p);
    else melee += fighterStrength(state, p);
  }
  return { archers, melee };
}

export function archerCount(state, ids) {
  return ids.filter((id) => {
    const p = personById(state, id);
    return p && p.alive && isArcher(state, p);
  }).length;
}

const ENEMY_ARCHERS = 0.25; // Share of a Skarn nation's war band who are archers.

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
  const open = Boolean(ev.sally || ev.ambush); // No walls or trees to hold behind.
  const from = ev.from || 'skarn';
  return {
    side,
    from,
    warned: side === 'attack' ? true : ev.warned,
    sally: Boolean(ev.sally), // Fighting the besiegers in the open, outside the walls.
    // Workers caught at a work site: { place, task }. Only `eligible` fight,
    // and `reinforcements` (guards who came running) start in the reserve.
    ambush: ev.ambush || null,
    eligible: ev.eligible || null,
    reinforcements: ev.reinforcements || [],
    weather: state.weather || 'clear',
    // Well-armed Skarn bands form shield walls and brace spears.
    foeTactics: from === 'skarn' && Boolean(state.neighbors.skarn.nation) && skarnArms(state) >= SKARN_TACTICS_ARMS,
    terrain: {
      palisade: side === 'defend' && !open && state.buildings.palisade > 0,
      wall: side === 'defend' && !open && state.buildings.stoneWall > 0,
      treeline: side === 'defend' && !open ? 'left' : null,
      hillfort: side === 'attack',
      siegeworks: Boolean(ev.sally), // Besiegers dig in behind stakes and ditches.
    },
    phase: 'deploy',
    round: 0,
    enemyStart: ev.raiders,
    foeStrength: foeStrengthFor(state, ev, side),
    enemy,
    enemyZoneStart: { ...enemy },
    // Once the Skarn are a nation, a quarter of their fighters are archers.
    archers: Object.fromEntries(ZONES.map((z) => [z, (ev.from || 'skarn') === 'skarn' && state.neighbors.skarn.nation ? Math.round(enemy[z] * ENEMY_ARCHERS) : 0])),
    breached: {}, // Zones where the enemy broke through the palisade or wall.
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
  const eligible = battle.eligible ? new Set(battle.eligible) : null;
  const reinforcements = new Set(battle.reinforcements || []);
  const plan = {};
  const fighters = living(state).filter(canFight)
    .filter((p) => !eligible || eligible.has(p.id))
    .filter((p) => {
      if (!reinforcements.has(p.id)) return true;
      plan[p.id] = 'reserve'; // Guards who came running join from the reserve.
      return false;
    })
    .sort((a, b) => fighterStrength(state, b) - fighterStrength(state, a));
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
    if (battle.eligible && !battle.eligible.includes(p.id)) continue; // Not at the ambush.
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
    const theirs = n * foeStrength(battle);
    if (battle.side === 'attack' || battle.sally) {
      // Defending their hold or their siege works: mostly hold, strike when strong.
      orders[z] = theirs > ours * 1.5 && chance(state, 0.5) ? 'attack' : 'hold';
    } else if (n < battle.enemyZoneStart[z] * 0.55 && chance(state, 0.4)) orders[z] = 'fallBack';
    else if (!battle.ours[z].length) orders[z] = 'attack';
    else if (z !== 'center' && battle.ours.center.length && chance(state, 0.2)) orders[z] = 'flank';
    else orders[z] = chance(state, 0.75) ? 'attack' : 'hold';
    // Well-armed Skarn learn from the last round: they will not charge into
    // spears they saw braced. Those who stand their ground lock shields
    // against archers, or brace spears against fighters strong enough to
    // charge them.
    const seen = battle.lastOrders ? battle.lastOrders.ours[z] : null;
    if (battle.foeTactics && orders[z] === 'attack' && seen === 'brace' && battle.ours[z].length && chance(state, 0.7)) orders[z] = 'hold';
    if (battle.foeTactics && orders[z] === 'hold' && battle.ours[z].length) {
      const parts = groupParts(state, battle.ours[z]);
      if (parts.archers >= parts.melee && chance(state, 0.7)) orders[z] = 'shieldWall';
      else if (ours >= theirs * 0.8 && chance(state, 0.6)) orders[z] = 'brace';
    }
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
    const theirs = battle.enemy[z] * foeStrength(battle);
    if (!ids.length) {
      if (theirs > 0 && 0 < weakestRatio) { weakest = z; weakestRatio = 0; }
      continue;
    }
    const ours = groupStrength(state, ids);
    const ratio = theirs ? ours / theirs : Infinity;
    if (theirs && ratio < weakestRatio) { weakest = z; weakestRatio = ratio; }
    if (!theirs) {
      if (battle.side === 'attack' || battle.sally) orders[z] = 'attack';
      else orders[z] = z !== 'center' && battle.enemy.center ? 'flank' : 'hold';
    } else if (battle.side === 'attack' || battle.sally) {
      orders[z] = ratio >= 1.2 ? 'attack' : 'hold';
    } else {
      orders[z] = ratio >= 1.4 ? 'attack' : 'hold';
    }
    // Holding against archers, lock shields; holding in the open against
    // warriors who will charge, brace spears, unless they held back from
    // the spears last round.
    if (orders[z] === 'hold' && theirs) {
      const archers = Math.min(battle.enemy[z], (battle.archers && battle.archers[z]) || 0);
      const theyHeld = battle.lastOrders && HOLDING.has(battle.lastOrders.theirs[z]);
      if (hasKnowledge(state, 'drill') && archers * 2 >= battle.enemy[z]) orders[z] = 'shieldWall';
      else if (hasKnowledge(state, 'spears') && !coverAt(battle, z) && battle.side === 'defend' && !battle.sally && !theyHeld) orders[z] = 'brace';
    }
  }
  orders.reserve = battle.ours.reserve.length && weakest ? weakest : 'stay';
  return orders;
}

export function describeOrders(orders) {
  const parts = ZONES.filter((z) => orders[z]).map((z) => {
    const verb = {
      hold: 'hold', attack: 'attack', flank: 'swing round to the center', shieldWall: 'form a shield wall', brace: 'brace spears', fallBack: 'fall back',
    }[orders[z]];
    return `${verb} on the ${ZONE_NAMES[z]}`;
  });
  if (orders.reserve && orders.reserve !== 'stay') parts.push(`send the reserve to the ${ZONE_NAMES[orders.reserve]}`);
  return parts.join(', ');
}

// ---------- resolving a round ----------

// The cover our fighters have in a zone: 'wall', 'palisade', or null.
export function coverAt(battle, zone) {
  if (!battle || (battle.breached && battle.breached[zone])) return null;
  if (battle.terrain.wall) return 'wall';
  if (battle.terrain.palisade) return 'palisade';
  return null;
}

// The share of harm a group takes while holding its ground here.
function holdCover(battle, zone, ourSide) {
  if (ourSide) {
    const cover = coverAt(battle, zone);
    if (cover === 'wall') return 0.45;
    if (cover === 'palisade') return 0.55;
    if (battle.terrain.treeline === zone) return 0.6;
    return 0.7;
  }
  return battle.terrain.hillfort ? 0.5 : battle.terrain.siegeworks ? 0.55 : 0.7;
}

function inMultiplier(battle, order, zone, ourSide) {
  if (order === 'fallBack') return 0.5;
  // Your braced spears stand in front of the walls; the Skarn keep their works.
  if (order === 'brace') return ourSide ? BRACE_IN : holdCover(battle, zone, false);
  if (order === 'shieldWall') return Math.min(holdCover(battle, zone, ourSide), SHIELD_MELEE);
  if (order !== 'hold') return 1;
  return holdCover(battle, zone, ourSide);
}

// charged: whether the other side charges this front this round.
function outMultiplier(order, battle = null, ourSide = false, zone = null, charged = false) {
  // Defenders behind a palisade strike from the walls as hard as in the open.
  if (order === 'hold' && ourSide && battle) {
    const cover = coverAt(battle, zone);
    if (cover === 'wall') return 1.15;
    if (cover === 'palisade') return 1;
  }
  if (order === 'shieldWall') return SHIELD_OUT;
  if (order === 'brace') return charged ? BRACE_CHARGED : BRACE_IDLE;
  return { hold: 0.8, attack: 1.2, flank: 1.5, fallBack: 0 }[order] ?? 1;
}

// Archers shoot at full strength even while holding, and from behind braced
// spears; crouched behind a shield wall, they shoot at half.
function archerOut(order, battle, ourSide, zone) {
  const o = order === 'brace' ? 'hold' : order;
  const m = outMultiplier(o, battle, ourSide, zone);
  return o === 'hold' ? Math.max(1, m) : m;
}

// Arrows come over walls: cover protects only half as well against them.
function arrowMultiplier(inMult) {
  return 1 - (1 - inMult) / 2;
}

const MELEE_ON_ARCHERS = 1.3; // Archers caught up close by warriors suffer.

// Wounds spread across a group.
function woundGroup(state, ids, damage, lines, extraHarm = 0) {
  const members = aliveIds(state, ids);
  if (!members.length || damage <= 0) return;
  let hits = Math.floor(damage / WOUND_EVERY) + (nextRandom(state) < (damage % WOUND_EVERY) / WOUND_EVERY ? 1 : 0);
  const wounded = new Set();
  const killed = [];
  while (hits > 0) {
    hits -= 1;
    const p = personById(state, pick(state, aliveIds(state, members)) ?? members[0]);
    if (!p || !p.alive) break;
    p.health = clamp(p.health - randomInt(state, 20, 35) - extraHarm);
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
  battle.breached = battle.breached || {}; // Older saved battles.
  battle.archers = battle.archers || { left: 0, center: 0, right: 0 };
  const surprised = !battle.warned && battle.round === 1;
  const enemy = enemyOrders(state, battle);
  const ours = { ...ourOrders };
  for (const z of ZONES) {
    if (!battle.ours[z].length) delete ours[z];
    else if (!ours[z] || !zoneOrders(state, z).includes(ours[z])) ours[z] = 'hold';
  }
  const w = weatherEffects(battle.weather || 'clear', battle.round);

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
    const enemyArchers = (zone) => Math.min(battle.enemy[zone], (battle.archers && battle.archers[zone]) || 0);
    const theyCharge = theirsHere.some((g) => CHARGING.has(g.order) && battle.enemy[g.zone] > enemyArchers(g.zone));
    const weCharge = oursHere.some((g) => CHARGING.has(g.order));
    // What each side strikes for, split into arrows and blows. The weather
    // blunts arrows and charges, and in snow and late in a hot day, everyone.
    let ourArrows = 0;
    let ourBlows = 0;
    for (const g of oursHere) {
      const parts = groupParts(state, battle.ours[g.zone]);
      ourArrows += parts.archers * archerOut(g.order, battle, true, g.zone) * w.arrows;
      ourBlows += parts.melee * outMultiplier(g.order, battle, true, g.zone, theyCharge) * (CHARGING.has(g.order) ? w.charge : 1);
    }
    const ourScale = (surprised ? 0.75 : 1) * w.all;
    const ourOut = (ourArrows + ourBlows) * ourScale;
    const ourArrowShare = ourOut ? ourArrows * ourScale / ourOut : 0;
    const theirScale = (surprised ? 1.2 : 1) * w.all;
    const theirArrows = theirsHere.reduce((sum, g) => sum + enemyArchers(g.zone) * foeStrength(battle) * archerOut(g.order) * w.arrows, 0) * theirScale;
    const theirBlows = theirsHere.reduce((sum, g) => sum + (battle.enemy[g.zone] - enemyArchers(g.zone)) * foeStrength(battle)
      * outMultiplier(g.order, null, false, null, weCharge) * (CHARGING.has(g.order) ? w.charge : 1), 0) * theirScale;
    const theirOut = theirArrows + theirBlows;
    const arrowShare = theirOut ? theirArrows / theirOut : 0;
    const bothHold = oursHere.every((g) => HOLDING.has(g.order)) && theirsHere.every((g) => HOLDING.has(g.order));
    const skirmish = bothHold ? 0.4 : 1;

    if (!theirsHere.length && oursHere.length) {
      if ((battle.side === 'attack' || battle.sally) && oursHere.some((g) => g.order === 'attack')) {
        battle.breakIns += 1;
        lines.push(`${AT[z]}, your fighters met no one and pushed through the Skarn ${battle.sally ? 'siege works' : 'defenses'}.`);
      }
      continue;
    }
    if (theirsHere.length && !oursHere.some((g) => g.order !== 'fallBack')) {
      // Nobody stands against them here.
      if (battle.side === 'defend' && !battle.sally && !battle.ambush) {
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
    for (const g of theirsHere) {
      if (g.order === 'shieldWall') lines.push(`${AT[g.zone]}, the ${foeName(battle)} locked their shields together.`);
      if (g.order === 'brace') lines.push(`${AT[g.zone]}, the ${foeName(battle)} braced their spears.`);
    }
    lines.push(`${AT[z]}, the two sides ${bothHold ? 'traded blows from cover' : 'clashed'}.`);
    const toUs = theirOut * PACE * skirmish * randomBetween(state, 0.8, 1.2);
    const toThem = ourOut * PACE * skirmish * randomBetween(state, 0.8, 1.2);
    for (const g of oursHere) {
      const share = groupStrength(state, battle.ours[g.zone]) / Math.max(1, oursHere.reduce((s, x) => s + groupStrength(state, battle.ours[x.zone]), 0));
      const cover = inMultiplier(battle, g.order, g.zone, true);
      const arrowsIn = g.order === 'shieldWall' ? SHIELD_ARROWS : g.order === 'brace' ? 1 : arrowMultiplier(cover);
      const parts = groupParts(state, battle.ours[g.zone]);
      const exposed = theyCharge && parts.archers > parts.melee ? MELEE_ON_ARCHERS : 1;
      woundGroup(state, battle.ours[g.zone], toUs * share * (cover * (1 - arrowShare) + arrowsIn * arrowShare) * exposed, lines, w.woundExtra);
    }
    const theirTotal = theirsHere.reduce((s, g) => s + battle.enemy[g.zone], 0) || 1;
    for (const g of theirsHere) {
      const share = battle.enemy[g.zone] / theirTotal;
      const exposed = weCharge && enemyArchers(g.zone) * 2 > battle.enemy[g.zone] ? MELEE_ON_ARCHERS : 1;
      const cover = inMultiplier(battle, g.order, g.zone, false);
      const arrowsIn = g.order === 'shieldWall' ? SHIELD_ARROWS : cover;
      const dmg = toThem * share * (cover * (1 - ourArrowShare) + arrowsIn * ourArrowShare) * exposed;
      const tough = foeStrength(battle); // Better-armed warriors are harder to bring down.
      const fallen = Math.min(battle.enemy[g.zone], Math.floor(dmg / tough) + (nextRandom(state) < (dmg % tough) / tough ? 1 : 0));
      enemyLosses[g.zone] += fallen;
    }
  }

  // Enemy losses and flight.
  const foe = foeName(battle);
  // Warriors charging an undermanned stretch of wall may break through it.
  for (const z of ZONES) {
    if (battle.side !== 'defend' || !coverAt(battle, z) || enemy[z] !== 'attack') continue;
    const warriors = battle.enemy[z] - ((battle.archers && battle.archers[z]) || 0);
    if (warriors <= 0) continue;
    const defenders = battle.ours[z].length;
    let p = defenders ? Math.max(0.05, Math.min(0.5, 0.1 + 0.04 * (warriors - defenders))) : 0.6;
    if (battle.terrain.wall) p *= 0.5;
    if (chance(state, p)) {
      battle.breached[z] = true;
      lines.push(`${AT[z]}, the ${foeName(battle)} broke through the ${battle.terrain.wall ? 'wall' : 'palisade'}. Fighters there no longer have its cover.`);
    }
  }

  for (const z of ZONES) {
    const lost = Math.min(battle.enemy[z], enemyLosses[z]);
    if (battle.archers && battle.enemy[z]) {
      battle.archers[z] = Math.max(0, battle.archers[z] - Math.round(lost * battle.archers[z] / battle.enemy[z]));
    }
    battle.enemy[z] -= lost;
    if (lost) lines.push(`The ${foe} lost ${lost} ${AT[z].replace(/^On|^In/, (w) => w.toLowerCase())}.`.replace(/ (on|in) the/, ' $1 the'));
    if (battle.enemy[z] > 0 && battle.enemy[z] < battle.enemyZoneStart[z] * BREAK_AT) {
      lines.push(`The ${foe} on the ${ZONE_NAMES[z]} broke and ran.`);
      battle.enemy[z] = 0;
      if (battle.archers) battle.archers[z] = 0;
    } else if (enemy[z] === 'fallBack' && battle.enemy[z] > 0) {
      lines.push(`The ${foe} on the ${ZONE_NAMES[z]} pulled back.`);
      battle.enemy[z] = 0;
      if (battle.archers) battle.archers[z] = 0;
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
  battle.lastOrders = { ours, theirs: enemy }; // What each side saw the other do.
  battle.history.push(...lines);
  battle.round += 1;
  return { lines, outcome: checkOutcome(state, battle) };
}

function checkOutcome(state, battle) {
  const ourLeft = ZONES.some((z) => battle.ours[z].length) || battle.ours.reserve.length;
  if (!ourLeft) return 'defeat';
  if (enemyTotal(battle) <= battle.enemyStart * ENEMY_RETREAT_AT || enemyTotal(battle) === 0) return 'victory';
  if ((battle.side === 'attack' || battle.sally) && battle.breakIns >= 2) return 'victory';
  if (battle.round > MAX_ROUNDS) return 'stalemate';
  return null;
}

// ---------- ending ----------

export function finishBattle(state, battle, outcome) {
  const lines = [];
  const all = living(state);
  const foe = foeName(battle);
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
  // Skarn who fall are lost to their nation.
  if (battle.from === 'clans') {
    // Hill clansmen who fall are lost to the clans until the next spring.
    const left = Object.values(battle.enemy).reduce((sum, n) => sum + n, 0);
    const fallen = Math.max(0, battle.enemyStart - left);
    const c = state.clans || { warriors: 0 };
    c.warriors = Math.max(0, c.warriors - fallen);
    if (fallen) lines.push(`The hill clans lost ${fallen} warriors.`);
  } else if (battle.from !== 'outlaws' && state.neighbors.skarn.nation) {
    const left = Object.values(battle.enemy).reduce((sum, n) => sum + n, 0);
    const fallen = Math.max(0, battle.enemyStart - left);
    const sk = state.neighbors.skarn.nation;
    const clansmen = battle.side === 'attack' ? 0 : skarnLosses(state, fallen);
    if (battle.side === 'attack') {
      sk.warriors = Math.max(0, sk.warriors - fallen);
      sk.population = Math.max(sk.warriors, sk.population - Math.ceil(fallen / 2));
    }
    if (battle.side === 'defend' && outcome !== 'victory') sk.wealth += battle.ambush ? 10 : 40; // Plunder feeds them.
    if (fallen) lines.push(`The Skarn lost ${fallen} warriors${clansmen ? `, ${clansmen} of them hill clansmen` : ''}. They now have about ${sk.warriors}.`);
  }
  if (battle.side === 'attack') recordDeed(state, 'attacks');
  if (battle.sally) {
    // A sally out against besiegers: win and the siege is broken; otherwise
    // the survivors fall back inside the walls and the siege goes on.
    const left = Object.values(battle.enemy).reduce((sum, n) => sum + n, 0);
    if (outcome === 'victory' || left < 4) {
      state.siege = null;
      lines.push(`Your fighters routed the besiegers. The siege of ${state.campName} is broken.`);
      for (const p of all) p.morale = clamp(p.morale + 10);
      changeRelation(state, 'skarn', -5);
    } else {
      if (state.siege) state.siege.raiders = left;
      lines.push(`Your fighters fell back inside the walls. About ${left} Skarn still hold the siege.`);
      for (const p of all) p.morale = clamp(p.morale - 5);
    }
  } else if (battle.ambush) {
    // Workers caught afield: fight them off, or be driven from the place.
    const where = placeName(state, battle.ambush.place);
    const who = WORKER_WORDS[battle.ambush.task] || 'workers';
    if (outcome === 'victory') {
      lines.push(`Your ${who} fought off the ambush at ${where}.`);
      for (const p of all) p.morale = clamp(p.morale + 5);
      changeRelation(state, 'skarn', -3);
    } else {
      state.harried = battle.ambush.place;
      lines.push(`Your ${who} were driven from ${where}. Anyone working there this season will bring back half as much.`);
      for (const p of all) p.morale = clamp(p.morale - 5);
    }
  } else if (battle.side === 'defend') {
    if (outcome === 'victory') {
      lines.push(`The ${foe} broke and fled. ${state.campName} is safe.`);
      for (const p of all) p.morale = clamp(p.morale + 8);
      if (battle.from === 'skarn') changeRelation(state, 'skarn', -5);
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

  if (battle.from === 'skarn' && meet(state, 'skarn', { contact: false })) {
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
// Whether the enemy's numbers are known: warned, and no fog; or after a round.
export function enemySeen(battle) {
  return (battle.warned && battle.weather !== 'fog') || battle.round > 1;
}

export function enemyWord(battle, n) {
  if (enemySeen(battle)) return String(n);
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
  const foe = battle.from === 'skarn' ? (state.neighbors.skarn.known || attack ? 'Skarn' : 'raiders') : foeName(battle);
  const terrain = [];
  const weather = weatherLine(battle.weather);
  if (weather) terrain.push(weather);
  if (battle.ambush) terrain.push(`Your ${WORKER_WORDS[battle.ambush.task] || 'workers'} are caught in the open at ${placeName(state, battle.ambush.place)}, with no walls or trees to hold behind${(battle.reinforcements || []).length ? '. Guards on watch who came running wait in the reserve' : ''}.`);
  if (battle.sally) terrain.push('You are sallying out against the besiegers. They have dug in behind stakes and ditches and take less harm while they hold; you have no walls out here. Beat them down, or push through two zones they leave empty, and the siege is broken.');
  if (battle.terrain.wall) terrain.push('Your stone wall covers every zone: fighters who hold behind it take much less harm and strike hard from the top. Arrows still come over it, and warriors who charge an undermanned stretch may break through.');
  else if (battle.terrain.palisade) terrain.push('Your palisade covers every zone: fighters who hold behind it take less harm and strike well from the walls. Arrows still come over it, and warriors who charge an undermanned stretch may break through.');
  const broken = ZONES.filter((z) => battle.breached && battle.breached[z]);
  if (broken.length) terrain.push(`The defenses are broken on the ${broken.map((z) => ZONE_NAMES[z]).join(' and ')}: fighters there have no cover.`);
  if (battle.terrain.treeline) terrain.push(`The treeline covers your ${ZONE_NAMES[battle.terrain.treeline]}: fighters holding there take less harm.`);
  if (battle.terrain.hillfort) terrain.push('The Skarn hold their walls on a rocky hill: they take far less harm while they hold. Attack where they are thin; pushing through two zones they have left empty wins the day.');
  if (!battle.warned) terrain.push('You were caught by surprise: in the first round your fighters strike weaker and the raiders harder.');
  const enemyLines = ZONES.map((z) => {
    const archers = battle.archers ? Math.min(battle.enemy[z], battle.archers[z] || 0) : 0;
    return `${capital(ZONE_NAMES[z])}: ${enemyWord(battle, battle.enemy[z])} ${foe}${archers && enemySeen(battle) ? `, ${archers === 1 ? '1 of them an archer' : `${archers} of them archers`}` : ''}.`;
  });
  const view = {
    phase: battle.phase,
    side: battle.side,
    foe,
    numbersSeen: enemySeen(battle),
    ambushPlace: battle.ambush ? placeName(state, battle.ambush.place) : null,
    ambushWorkers: battle.ambush ? WORKER_WORDS[battle.ambush.task] || 'workers' : null,
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
    view.fighters = living(state).filter(canFight).filter((p) => !battle.eligible || battle.eligible.includes(p.id)).map((p) => ({ id: p.id, name: p.name, hunting: p.skills.hunting, health: p.health, sick: p.sick, archer: isArcher(state, p) }));
    return view;
  }
  view.zones = ZONES.map((z) => {
    const ids = battle.ours[z];
    const ours = groupStrength(state, ids);
    const theirs = battle.enemy[z] * foeStrength(battle);
    return {
      zone: z,
      name: ZONE_NAMES[z],
      people: ids.map((id) => `${personById(state, id).name}${isArcher(state, personById(state, id)) ? ' (archer)' : ''}`),
      archers: archerCount(state, ids),
      enemyArchers: battle.archers ? Math.min(battle.enemy[z], battle.archers[z] || 0) : 0,
      breached: Boolean(battle.breached && battle.breached[z]),
      enemy: battle.enemy[z],
      odds: ids.length ? oddsWord(ours, theirs) : null,
      orders: !ids.length ? [] : zoneOrders(state, z),
    };
  });
  view.reserve = battle.ours.reserve.map((id) => personById(state, id).name);
  const advice = warChiefOrders(state, battle);
  view.advice = advice;
  view.adviceText = describeOrders(advice);
  return view;
}

