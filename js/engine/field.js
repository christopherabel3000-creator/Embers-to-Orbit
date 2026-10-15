// Field battles between armies: your companies against an enemy's, on the
// ground of the region where they meet. The same zones as a raid at the
// capital (left, center, right, and a reserve), with the kinds of soldiers
// that make the mix matter: archers shoot before the lines meet, cavalry
// charge, swing round a flank, and run down a broken enemy, spearmen brace
// against them, and shield infantry lock shields against arrows. Companies
// break long before they are destroyed, and an army breaks when most of it
// has fled. Storming walls is the same battle against an enemy behind them,
// which siege engines batter down.

import {
  KINDS, FOE_KINDS, TERRAIN, FIELD_ZONES, ZONE_WORDS, FIELD_ORDERS, TRAITS,
} from './armyData.js';
import { randomBetween, chance } from './rng.js';
import { listWords, plural } from './util.js';

export const SOLDIER = 6; // What an ordinary soldier is worth, as a raider is.
export const FIELD_ROUNDS = 6;
const PACE = 0.15; // Share of strength that turns into harm each round.
const BREAK_AT = 0.5; // A company breaks below this share of its soldiers.
const BELOVED_BREAK_AT = 0.3;
const WALLED_BREAK_AT = 0.25;
const ARMY_BREAK_AT = 0.4; // An army breaks below this share of its soldiers still fighting.
const PURSUIT = 0.2; // Cavalry cut down this share of a company that breaks.
export const WALL_COVER = 0.4; // Harm taken by defenders behind walls.
const WALL_STRIKE = 1.2; // Defenders strike harder from their walls.
const ENGINE_BATTER = 0.1; // Cover each company of engines knocks down each round.

function kindOf(u) {
  return u.ours ? KINDS[u.kind] : FOE_KINDS[u.kind];
}

export function unitName(u) {
  return u.ours ? u.name : `${u.soldiers} ${kindOf(u).name}`;
}

export function fighting(units) {
  return units.filter((u) => !u.broken && u.soldiers > 0);
}

function inZone(units, zone) {
  return fighting(units).filter((u) => u.zone === zone);
}

export function soldiersIn(units) {
  return fighting(units).reduce((sum, u) => sum + u.soldiers, 0);
}

function startTotal(units) {
  return units.reduce((sum, u) => sum + u.start, 0);
}

// Creates a field battle. us: units built by armies.js from the army's
// companies; them: the enemy's units. attacker: 'us' or 'them'.
export function createField({
  region, foe, foeName, us, them, attacker = 'them', walls = null, commander = null, weather = 'clear', seen = true, title = null,
}) {
  const battle = {
    type: 'field',
    region,
    terrain: TERRAIN[region] ? region : 'valley',
    foe,
    foeName,
    attacker,
    walls, // { side: 'them' or 'us', cover } when one side stands behind walls.
    commander, // { name, trait, level }
    weather,
    seen,
    title,
    us,
    them,
    round: 0,
    phase: 'deploy',
    lastOrders: { us: {}, them: {} },
    log: [],
  };
  // The pace of the battle follows what its soldiers are worth on average,
  // so that better-armed armies on both sides fight as long a battle as
  // worse-armed ones: what decides it is how they compare.
  const all = [...us, ...them];
  const count = all.reduce((sum, u) => sum + u.soldiers, 0);
  battle.scale = count ? all.reduce((sum, u) => sum + u.soldiers * u.power, 0) / count / SOLDIER : 1;
  deployFoe(battle);
  return battle;
}

// The enemy spreads its companies across the field: mounted on the flanks,
// archers behind the center, the rest along the line.
function deployFoe(battle) {
  const zones = FIELD_ZONES;
  let i = 0;
  for (const u of battle.them) {
    const k = kindOf(u);
    if (k.mounted && battle.foe === 'orhai') u.zone = i % 2 === 0 ? 'left' : 'right';
    else u.zone = zones[i % 3];
    i += 1;
  }
}

// Formations for your companies: where each kind goes.
export const FIELD_FORMATIONS = {
  match: { name: 'Match the enemy', about: 'Companies placed to meet the enemy where they stand, as far as your scouts can tell.' },
  line: { name: 'An even line', about: 'Every kind spread evenly across the field.' },
  center: { name: 'A strong center', about: 'Most companies in the center, a few on each flank.' },
  flanks: { name: 'Cavalry on the flanks', about: 'Infantry and archers in the center, cavalry and skirmishers on the flanks.' },
  reserve: { name: 'A line with a reserve', about: 'An even line, with one company held back to join where it is needed.' },
};

export function fieldFormation(battle, formation) {
  const plan = {};
  const units = battle.us;
  const zones = FIELD_ZONES;
  const byKind = (fn) => units.filter((u) => fn(KINDS[u.kind]));
  if (formation === 'match' && battle.seen) {
    // Each company goes where the enemy is strongest for the companies
    // already placed there.
    const weight = {};
    for (const z of zones) weight[z] = battle.them.filter((u) => u.zone === z).reduce((s, u) => s + u.soldiers * u.power, 0);
    const placed = { left: 0, center: 0, right: 0 };
    const order = [...units].filter((u) => !KINDS[u.kind].siege).sort((a, b) => b.soldiers * b.power - a.soldiers * a.power);
    for (const u of order) {
      const z = zones.slice().sort((a, b) => (weight[b] - placed[b]) - (weight[a] - placed[a]))[0];
      plan[u.id] = z;
      placed[z] += u.soldiers * u.power;
    }
  } else if (formation === 'center') {
    units.forEach((u, i) => { plan[u.id] = i % 4 === 1 ? 'left' : i % 4 === 3 ? 'right' : 'center'; });
  } else if (formation === 'flanks') {
    let f = 0;
    for (const u of byKind((k) => k.mounted || k.scouts)) { plan[u.id] = f % 2 === 0 ? 'left' : 'right'; f += 1; }
    for (const u of byKind((k) => !(k.mounted || k.scouts))) plan[u.id] = 'center';
    if (!units.some((u) => plan[u.id] !== 'center')) units.forEach((u, i) => { plan[u.id] = zones[i % 3]; });
  } else {
    units.forEach((u, i) => { plan[u.id] = zones[i % 3]; });
    if (formation === 'reserve' && units.length >= 3) {
      const keep = [...units].sort((a, b) => b.soldiers - a.soldiers).find((u) => !KINDS[u.kind].siege);
      if (keep) plan[keep.id] = 'reserve';
    }
  }
  for (const u of byKind((k) => k.siege)) plan[u.id] = 'reserve'; // Engines stay back in the field.
  return plan;
}

export function deployField(battle, plan) {
  for (const u of battle.us) {
    const z = plan[u.id];
    u.zone = [...FIELD_ZONES, 'reserve'].includes(z) ? z : 'center';
  }
  if (!fighting(battle.us).some((u) => u.zone !== 'reserve')) return { error: 'Put at least one company in the line.' };
  battle.phase = 'fight';
  return {};
}

// Orders a zone can take, given who stands there.
export function ordersFor(units, zone) {
  const here = inZone(units, zone);
  if (!here.length) return [];
  return Object.keys(FIELD_ORDERS).filter((o) => {
    const need = FIELD_ORDERS[o].needs;
    if (!need) return true;
    if (o === 'flank' && zone === 'center') return false;
    return here.some((u) => kindOf(u)[need]);
  });
}

function zoneMounted(units, zone) {
  return inZone(units, zone).some((u) => kindOf(u).mounted);
}

function zonePower(units, zone, field) {
  return inZone(units, zone).reduce((sum, u) => sum + u.soldiers * u.power * (kindOf(u)[field] || 0), 0);
}

// ----- The commanders' orders -----

// What your commander orders each round: honest, simple tactics.
export function commanderOrders(battle) {
  const orders = {};
  const them = battle.them;
  const us = battle.us;
  for (const zone of FIELD_ZONES) {
    const here = inZone(us, zone);
    if (!here.length) continue;
    const allowed = ordersFor(us, zone);
    const archers = here.filter((u) => KINDS[u.kind].ranged >= 1).reduce((s, u) => s + u.soldiers, 0);
    const total = here.reduce((s, u) => s + u.soldiers, 0);
    const foeMelee = zonePower(them, zone, 'melee');
    const foeRanged = zonePower(them, zone, 'ranged');
    const ours = zonePower(us, zone, 'melee');
    let order = 'hold';
    if (archers >= total * 0.6) order = 'hold';
    // Brace against riders who charge; riders who hold back and shoot are met
    // by holding, or by an attack when we are the stronger.
    else if (allowed.includes('brace') && zoneMounted(them, zone) && (battle.round === 0 || ['attack', 'flank'].includes((battle.lastOrders.them || {})[zone]))) order = 'brace';
    else if (allowed.includes('shieldWall') && foeRanged > foeMelee) order = 'shieldWall';
    else if (allowed.includes('flank') && zone !== 'center' && (!foeMelee || ours > foeMelee * 1.5)) order = 'flank';
    else if (ours >= foeMelee * 1.2) order = 'attack';
    orders[zone] = order;
  }
  // The reserve joins the zone where the enemy is strongest against us.
  // Siege engines stay back.
  if (inZone(us, 'reserve').some((u) => !KINDS[u.kind].siege)) {
    const worst = FIELD_ZONES.map((z) => [z, zonePower(them, z, 'melee') + zonePower(them, z, 'ranged') - zonePower(us, z, 'melee')])
      .sort((a, b) => b[1] - a[1])[0];
    orders.reserve = worst && worst[1] > 0 ? worst[0] : 'stay';
  }
  return orders;
}

// The enemy's orders, by their way of war.
function foeOrders(state, battle) {
  const orders = {};
  const ourLast = battle.lastOrders.us || {};
  for (const zone of FIELD_ZONES) {
    const here = inZone(battle.them, zone);
    if (!here.length) continue;
    const ranged = here.filter((u) => FOE_KINDS[u.kind].ranged >= 0.8).reduce((s, u) => s + u.soldiers, 0);
    const total = here.reduce((s, u) => s + u.soldiers, 0);
    const braced = ourLast[zone] === 'brace';
    let order = 'attack';
    if (battle.walls && battle.walls.side === 'them') order = 'hold'; // Defenders keep to their walls.
    else if (ranged >= total * 0.6) order = 'hold';
    else if (battle.foe === 'orhai' && zone !== 'center' && zoneMounted(battle.them, zone) && !braced && !inZone(battle.us, 'center').some((u) => KINDS[u.kind].brace) && chance(state, 0.5)) order = 'flank';
    else if (braced && zoneMounted(battle.them, zone)) order = 'hold';
    // Warriors brace against riders who charged them.
    else if (zoneMounted(battle.us, zone) && here.some((u) => FOE_KINDS[u.kind].brace) && ['attack', 'flank'].includes(ourLast[zone])) order = 'brace';
    else if (battle.foe === 'ostrani' && battle.round === 0) order = 'hold';
    orders[zone] = order;
  }
  return orders;
}

// ----- A round -----

function weatherRanged(w) {
  return w === 'rain' ? 0.5 : w === 'fog' ? 0.7 : 1;
}

function commanderPower(battle, order, ourSide) {
  if (!ourSide || !battle.commander) return 1;
  const c = battle.commander;
  let f = 1 + 0.04 * (c.level || 0);
  if (c.trait === 'bold' && (order === 'attack' || order === 'flank')) f *= 1.15;
  return f;
}

function commanderHarm(battle, ourSide) {
  if (!ourSide || !battle.commander) return 1;
  if (battle.commander.trait === 'bold') return 1.1;
  if (battle.commander.trait === 'careful') return 0.85;
  return 1;
}

// How hard a unit strikes in melee under an order.
function strikeMult(u, order, foeOrder, foeMounted, terrain) {
  const k = kindOf(u);
  if (order === 'fallBack') return 0;
  let m = 1;
  if (order === 'attack' || order === 'flank') m = k.mounted ? (k.charge || 1.2) * terrain.cavalry : 1.2;
  else if (order === 'hold') m = 0.85;
  else if (order === 'shieldWall') m = k.shieldWall ? 0.5 : 0.85;
  else if (order === 'brace') {
    // Braced spears punish a charge by riders; against men on foot they fight
    // as if holding, and against a foe who does not charge they stand idle.
    const charged = foeOrder === 'attack' || foeOrder === 'flank';
    m = !k.brace ? 0.85 : charged && foeMounted ? 1.5 : charged ? 0.85 : 0.5;
  }
  if (k.mounted && !(order === 'attack' || order === 'flank')) m *= terrain.cavalry;
  if (k.evasive) m *= terrain.rough;
  return m;
}

// How much harm a unit takes in melee under an order.
function takeMult(u, order, foeCharging, foeBraced) {
  const k = kindOf(u);
  let m = 1;
  if (order === 'hold') m = 0.7;
  else if (order === 'shieldWall') m = k.shieldWall ? 0.6 : 0.7;
  else if (order === 'brace') m = 0.7;
  else if (order === 'fallBack') m = 0.3;
  if (k.frail && foeCharging) m *= 1.3;
  if (k.evasive) m *= k.evasive;
  if (k.mounted && foeBraced && (order === 'attack' || order === 'flank')) m *= 1.5;
  return m;
}

function arrowTake(u, order) {
  const k = kindOf(u);
  let m = k.arrows || 1;
  if (order === 'shieldWall' && k.shieldWall) m = 0.3;
  if (order === 'fallBack') m *= 0.5;
  if (k.evasive) m *= k.evasive;
  return m;
}

// What a soldier strikes with. Better arms and training count, but less
// than numbers do: a soldier worth a quarter more strikes about a seventh
// harder than the average soldier on the field.
const QUALITY = 0.6;
function punch(battle, u) {
  const scale = SOLDIER * (battle.scale || 1);
  return scale * (u.power / scale) ** QUALITY;
}

// Spreads harm over units in proportion to their size and how exposed they
// are; returns soldiers lost.
function harm(units, damage, exposure, cover, careful, scale = 1) {
  const weights = units.map((u) => u.soldiers * exposure(u));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total || damage <= 0) return 0;
  let lost = 0;
  units.forEach((u, i) => {
    const share = damage * (weights[i] / total) * cover * careful;
    const n = Math.min(u.soldiers, share / (SOLDIER * scale));
    u.soldiers = Math.max(0, u.soldiers - n);
    lost += n;
  });
  return lost;
}

// Resolves a round. ourOrders: zone to order, and reserve to 'stay' or a
// zone. Returns { lines, outcome } where outcome is 'won', 'lost', or null.
export function resolveField(state, battle, ourOrders) {
  const terrain = TERRAIN[battle.terrain];
  const scale = battle.scale || 1;
  const lines = [];
  // The reserve joins the line.
  for (const side of ['us', 'them']) {
    const target = side === 'us' ? ourOrders.reserve : null;
    if (target && FIELD_ZONES.includes(target)) for (const u of inZone(battle[side], 'reserve').filter((x) => !kindOf(x).siege)) u.zone = target;
  }
  // Companies with no enemy in front of them turn to join the fight where
  // the enemy is strongest.
  const turned = [];
  for (const [side, other] of [['us', 'them'], ['them', 'us']]) {
    const strongest = FIELD_ZONES.map((z) => [z, inZone(battle[other], z).reduce((s, u) => s + u.soldiers * u.power, 0)])
      .sort((a, b) => b[1] - a[1])[0];
    if (!strongest || !strongest[1]) continue;
    for (const zone of FIELD_ZONES) {
      if (zone === strongest[0] || inZone(battle[other], zone).length) continue;
      for (const u of inZone(battle[side], zone)) {
        u.zone = strongest[0];
        if (side === 'us') turned.push(u.name);
      }
    }
  }
  if (turned.length) lines.push(`With no enemy before them, ${listWords(turned)} turned to the ${ZONE_WORDS[FIELD_ZONES.find((z) => battle.us.some((u) => turned.includes(u.name) && u.zone === z))]}.`);
  const orders = { us: {}, them: foeOrders(state, battle) };
  for (const zone of FIELD_ZONES) {
    const allowed = ordersFor(battle.us, zone);
    if (!allowed.length) continue;
    orders.us[zone] = allowed.includes(ourOrders[zone]) ? ourOrders[zone] : 'hold';
  }
  const theirs = orders.them;
  const ours = orders.us;
  // Walls: engines batter them down, round by round.
  if (battle.walls && battle.walls.cover < 1) {
    const batterers = fighting(battle.walls.side === 'them' ? battle.us : battle.them).filter((u) => kindOf(u).siege).length;
    if (batterers) {
      battle.walls.cover = Math.min(1, battle.walls.cover + ENGINE_BATTER * batterers);
      lines.push(battle.walls.cover >= 1 ? 'The siege engines have broken the walls open.' : 'The siege engines batter the walls.');
    }
  }
  const before = { us: soldiersIn(battle.us), them: soldiersIn(battle.them) };
  const lost = { us: 0, them: 0 };
  const sides = [['us', 'them', ours, theirs], ['them', 'us', theirs, ours]];
  // Fortune: each side's luck for the whole battle, and each round's.
  if (!battle.fortune) battle.fortune = { us: randomBetween(state, 0.75, 1.25), them: randomBetween(state, 0.75, 1.25) };
  let luck = 1;
  const variance = () => randomBetween(state, 0.75, 1.25) * luck;
  const coverFor = (side) => (battle.walls && battle.walls.side === side ? battle.walls.cover : 1);
  const careful = (side) => commanderHarm(battle, side === 'us');

  // Flanking cavalry ride round to strike the enemy center this round.
  const flankers = { us: [], them: [] };
  for (const [side, , mine] of sides) {
    for (const zone of ['left', 'right']) {
      if (mine[zone] === 'flank') flankers[side].push(...inZone(battle[side], zone).filter((u) => kindOf(u).mounted));
    }
  }

  // 1. Arrows, before the lines meet.
  for (const [side, other, mine, foes] of sides) {
    luck = battle.fortune[side];
    for (const zone of FIELD_ZONES) {
      const shooters = inZone(battle[side], zone).filter((u) => kindOf(u).ranged > 0 && mine[zone] !== 'fallBack'
        && (mine[zone] !== 'attack' || kindOf(u).mounted) && !flankers[side].includes(u));
      if (!shooters.length) continue;
      const power = shooters.reduce((s, u) => s + u.soldiers * punch(battle, u) * kindOf(u).ranged, 0) * terrain.ranged * weatherRanged(battle.weather) * variance() * commanderPower(battle, mine[zone], side === 'us');
      let targets = inZone(battle[other], zone);
      if (!targets.length) targets = inZone(battle[other], 'center');
      if (!targets.length) continue;
      lost[other] += harm(targets, power * PACE, (u) => arrowTake(u, foes[u.zone]), coverFor(other) < 1 ? Math.min(1, coverFor(other) + 0.2) : 1, careful(other), scale);
    }
  }

  // 2. The lines meet.
  for (const [side, other, mine, foes] of sides) {
    luck = battle.fortune[side];
    for (const zone of FIELD_ZONES) {
      let strikers = inZone(battle[side], zone).filter((u) => !flankers[side].includes(u));
      let targets = inZone(battle[other], zone).filter((u) => !flankers[other].includes(u));
      let bonus = 1;
      if (zone === 'center' && flankers[side].length) {
        strikers = strikers.concat(flankers[side]);
        bonus = 1; // Flankers add their own bonus below.
      }
      if (!strikers.length) continue;
      if (!targets.length) {
        // No one to meet them here: they push through to the center.
        if (zone === 'center' || mine[zone] !== 'attack') continue;
        targets = inZone(battle[other], 'center');
        if (!targets.length) continue;
        bonus = 0.8;
      }
      const foeOrder = foes[zone] || 'hold';
      const foeMounted = targets.some((u) => kindOf(u).mounted);
      const power = strikers.reduce((s, u) => {
        const order = flankers[side].includes(u) ? 'flank' : mine[zone];
        const flank = flankers[side].includes(u) ? 1.3 : 1;
        return s + u.soldiers * punch(battle, u) * kindOf(u).melee * strikeMult(u, order, foeOrder, foeMounted, terrain) * flank
          * commanderPower(battle, order, side === 'us');
      }, 0) * bonus * variance() * (battle.walls && battle.walls.side === side ? terrain.hold * (1 + (WALL_STRIKE - 1) * (1 - battle.walls.cover) / (1 - WALL_COVER)) : 1);
      const charging = mine[zone] === 'attack' || flankers[side].length > 0;
      const braced = foeOrder === 'brace';
      lost[other] += harm(targets, power * PACE, (u) => takeMult(u, foes[u.zone] || 'hold', charging, false), coverFor(other), careful(other), scale);
      // Chargers who hit braced spears take harm from them in turn.
      if (braced && charging) {
        const chargers = strikers.filter((u) => kindOf(u).mounted && !flankers[side].includes(u));
        const spears = targets.filter((u) => kindOf(u).brace);
        if (chargers.length && spears.length) {
          const back = spears.reduce((s, u) => s + u.soldiers * punch(battle, u) * 0.5, 0) * PACE;
          lost[side] += harm(chargers, back, (u) => takeMult(u, 'attack', false, true), 1, careful(side), scale);
        }
      }
    }
  }

  // Falling back: those ordered back go to the reserve.
  for (const [side, , mine] of sides) {
    for (const zone of FIELD_ZONES) if (mine[zone] === 'fallBack') for (const u of inZone(battle[side], zone)) u.zone = 'reserve';
    // Flankers return to their flank.
  }

  // 3. Companies that lose too many break, and cavalry run them down.
  for (const [side, other] of sides) {
    // Defenders behind walls have nowhere to run, and fight on far longer.
    const walled = battle.walls && battle.walls.side === side && battle.walls.cover < 1;
    const breakAt = walled ? WALLED_BREAK_AT : side === 'us' && battle.commander && battle.commander.trait === 'beloved' ? BELOVED_BREAK_AT : BREAK_AT;
    const pursuers = fighting(battle[other]).some((u) => kindOf(u).mounted);
    for (const u of fighting(battle[side])) {
      if (u.soldiers >= u.start * breakAt) continue;
      u.broken = true;
      const cut = pursuers ? u.soldiers * PURSUIT : 0;
      u.soldiers = Math.max(0, u.soldiers - cut);
      lost[side] += cut;
      lines.push(side === 'us' ? `${unitName(u)} broke and fled${cut >= 1 ? ', and riders cut down some as they ran' : ''}.` : `The enemy's ${FOE_KINDS[u.kind].name} broke and fled${cut >= 1 ? ', ridden down as they ran' : ''}.`);
    }
  }

  battle.round += 1;
  battle.lastOrders = orders;
  const ourLoss = Math.round(before.us - soldiersIn(battle.us));
  const theirLoss = Math.round(before.them - soldiersIn(battle.them));
  lines.unshift(`Round ${battle.round}: ${describeFieldOrders(battle, ours)} The enemy ${describeFoeOrders(theirs)} You lost about ${ourLoss}; they lost about ${theirLoss}.`);
  battle.log.push(...lines);
  battle.lastLines = lines;
  return { lines, outcome: fieldOutcome(battle) };
}

function describeFieldOrders(battle, orders) {
  const parts = FIELD_ZONES.filter((z) => orders[z]).map((z) => `${ZONE_WORDS[z]} ${FIELD_ORDERS[orders[z]].past}`);
  return parts.length ? `Your ${listWords(parts)}.` : '';
}

function describeFoeOrders(orders) {
  const zones = FIELD_ZONES.filter((z) => orders[z]);
  if (!zones.length) return 'had no one left in the line.';
  if (zones.length > 1 && zones.every((z) => orders[z] === orders[zones[0]])) return `${FIELD_ORDERS[orders[zones[0]]].past} all along the line.`;
  return `${listWords(zones.map((z) => `${FIELD_ORDERS[orders[z]].past} on the ${ZONE_WORDS[z]}`))}.`;
}

export function fieldOutcome(battle) {
  const ours = soldiersIn(battle.us);
  const theirs = soldiersIn(battle.them);
  const ourBroken = ours < startTotal(battle.us) * ARMY_BREAK_AT || !fighting(battle.us).some((u) => !kindOf(u).siege);
  const theirBroken = theirs < startTotal(battle.them) * ARMY_BREAK_AT || !fighting(battle.them).length;
  if (theirBroken && !ourBroken) return 'won';
  if (ourBroken && !theirBroken) return 'lost';
  if (ourBroken && theirBroken) {
    // Both break at once: whoever has more of their soldiers left holds the field.
    const left = (units) => units.reduce((sum, u) => sum + u.soldiers, 0) / Math.max(1, startTotal(units));
    const diff = left(battle.us) - left(battle.them);
    if (Math.abs(diff) > 0.02) return diff > 0 ? 'won' : 'lost';
    return battle.attacker === 'us' ? 'lost' : 'won';
  }
  if (battle.round >= FIELD_ROUNDS) {
    // The attacker had to win the field: unless it is clearly the stronger
    // at the end, the defender holds it.
    const power = (units) => fighting(units).reduce((s, u) => s + u.soldiers * u.power * (kindOf(u).melee + kindOf(u).ranged), 0);
    // Walls still standing hold out until their defenders break.
    if (battle.walls && battle.walls.cover < 1) return battle.walls.side === 'them' ? 'lost' : 'won';
    if (battle.attacker === 'us') return power(battle.us) > power(battle.them) * 1.2 ? 'won' : 'lost';
    return power(battle.them) > power(battle.us) * 1.2 ? 'lost' : 'won';
  }
  return null;
}

// Fights the rest of the battle on the commander's orders. Returns the outcome.
export function autoField(state, battle) {
  if (battle.phase === 'deploy') deployField(battle, fieldFormation(battle, battle.seen ? 'match' : 'reserve'));
  let outcome = fieldOutcome(battle);
  while (!outcome) outcome = resolveField(state, battle, commanderOrders(battle)).outcome;
  battle.phase = 'done';
  return outcome;
}

// The commander's honest estimate: the battle fought many times over in
// their head. Returns the chance of winning.
export function estimateField(state, battle, trials = 24) {
  let wins = 0;
  for (let i = 0; i < trials; i++) {
    const copy = structuredClone(battle);
    const scratch = { rng: (state.rng + 7919 * (i + 1)) >>> 0 };
    if (autoField(scratch, copy) === 'won') wins += 1;
  }
  return wins / trials;
}

// "likely to win (about 7 in 10)", for the advice before a battle.
export function oddsPhrase(chanceOfWinning) {
  if (chanceOfWinning >= 0.95) return 'all but certain to win';
  if (chanceOfWinning <= 0.05) return 'all but certain to lose';
  return `${oddsWords(chanceOfWinning)} (about ${Math.max(1, Math.min(9, Math.round(chanceOfWinning * 10)))} in 10)`;
}

export function oddsWords(chanceOfWinning) {
  if (chanceOfWinning >= 0.75) return 'likely to win';
  if (chanceOfWinning >= 0.45) return 'an even fight';
  return 'likely to lose';
}

// What each side has where, for the screen.
export function fieldView(battle) {
  const zones = [...FIELD_ZONES, 'reserve'].map((zone) => {
    const ours = inZone(battle.us, zone);
    const theirs = inZone(battle.them, zone);
    const foeWords = theirs.length ? (battle.seen || battle.round > 0 ? listWords(theirs.map((u) => `${Math.round(u.soldiers)} ${FOE_KINDS[u.kind].name}`)) : 'enemy soldiers, how many you cannot tell') : 'no one';
    return {
      zone,
      name: ZONE_WORDS[zone],
      ours: ours.map((u) => `${u.name}, ${plural(Math.round(u.soldiers), 'soldier', 'soldiers')}`),
      theirs: foeWords,
      orders: ordersFor(battle.us, zone),
    };
  });
  return {
    zones,
    us: Math.round(soldiersIn(battle.us)),
    them: Math.round(soldiersIn(battle.them)),
    terrain: TERRAIN[battle.terrain].name,
    walls: battle.walls ? Math.round((1 - battle.walls.cover) * 100) : null,
    commander: battle.commander ? `${battle.commander.name}, ${TRAITS[battle.commander.trait].name}` : null,
  };
}
