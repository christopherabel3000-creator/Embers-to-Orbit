// War in the Nation era: declaring it, with a reason or without; the
// enemy's forces and the hosts they send; the battles your armies fight;
// raids and sieges; and peace, on terms. The armies themselves are in
// armies.js, and the battlefield in field.js.

import {
  FOES, WAR_FOES, WAR_SCORE, PEACE_TERMS, PEACE_ORDER, TRIBUTE_YEARS, TRIBUTES, LAND_TERMS, WAR_TRUCE,
  KILLED_SHARE, FOE_KINDS, COMPANY_SIZE, HOSTS,
} from './armyData.js';
import { REGIONS } from './worldData.js';
import { GREAT_TREATIES, GREAT_NATIONS, GREAT_ORDER } from './greatData.js';
import { enemiesOf, alliesOf } from './greatWorld.js';
import {
  createField, autoField, estimateField, soldiersIn, fighting, SOLDIER,
} from './field.js';
import {
  armies, armyById, armiesIn, armySoldiers, armyPower, companyUnit, fieldCommander, companyLosses,
  pruneArmy, pathTo, regionName, armiesUpkeep, supplyCapacity,
} from './armies.js';
import {
  atWar, homeBesieged, armyHolding, warWeariness, warYears,
} from './warStatus.js';
import { NEIGHBORS, NEIGHBOR_ORDER, placeRegion } from './data.js';
import {
  living, year, seasonIndex, eraAtLeast, placeName, hasKnowledge,
} from './state.js';
import {
  nation, skarnArms, skarnLosses, remember, landsOf,
} from './nations.js';
import { clans, clansMarching } from './clans.js';
import {
  great, greatMet, changeGreat, greatRemember, tributeCost,
} from './great.js';
import { changeRelation } from './neighbors.js';
import { endPeace } from './peace.js';
import { makeVassal } from './union.js';
import { townDefense } from './settlements.js';
import { createBattle } from './battle.js';
import { startSiege } from './siege.js';
import { recordDeed } from './legacy.js';
import { chance, pick } from './rng.js';
import {
  clamp, listWords, plural, capital, lowerFirst,
} from './util.js';

export { atWar };

export function warWith(state, foe) {
  return (state.wars || {})[foe] || null;
}

export function foeName(foe) {
  return FOES[foe].name;
}

// ----- The enemy's forces -----

function nationYears(state) {
  return state.nationFounded == null ? 0 : Math.max(0, state.turn - state.nationFounded) / 4;
}

// What one of their soldiers is worth, against an ordinary raider.
export function foeWorth(state, foe) {
  if (foe === 'skarn' || foe === 'clans') return skarnArms(state);
  if (foe === 'orhai') return Math.min(2.4, 1.8 + 0.03 * nationYears(state));
  return FOES[foe].worth || 2.2;
}

// Everyone they could send to fight.
export function foeForce(state, foe) {
  if (foe === 'skarn') {
    const nat = nation(state, 'skarn');
    return (nat ? nat.warriors : 0) + clansMarching(state);
  }
  if (foe === 'clans') return clans(state).warriors;
  const g = great(state, foe);
  return g ? g.strength || 0 : 0;
}

// Their soldiers as units on the field, in companies of about ten.
export function foeUnits(state, foe, count) {
  const units = [];
  const total = Math.max(1, Math.round(count));
  const power = SOLDIER * foeWorth(state, foe);
  let given = 0;
  FOES[foe].kinds.forEach(([kind, share], i) => {
    let n = i === FOES[foe].kinds.length - 1 ? total - given : Math.round(total * share);
    given += n;
    while (n > 0) {
      let size = Math.min(COMPANY_SIZE, n);
      if (n - size > 0 && n - size < 4) size = n; // A small remainder stays with the last company.
      units.push({
        id: `${kind}${units.length}`, kind, soldiers: size, start: size, power, ours: false, broken: false, zone: 'center',
      });
      n -= size;
    }
  });
  return units;
}

// Those of theirs who fell are lost to them.
export function foeLosses(state, foe, fallen) {
  const n = Math.max(0, Math.round(fallen));
  if (!n) return;
  if (foe === 'skarn') skarnLosses(state, n);
  else if (foe === 'clans') clans(state).warriors = Math.max(0, clans(state).warriors - n);
  else {
    const g = great(state, foe);
    if (g) g.strength = Math.max(0, (g.strength || 0) - n);
  }
}

// ----- Declaring war -----

// Their part in it: a reason for war, if they have given you one recently.
export function warReason(state, foe) {
  // A great nation allied to you is at war with them.
  if (foe !== 'skarn' && state.great) {
    const ally = GREAT_ORDER.find((id) => id !== foe && state.great[id].treaties.alliance && enemiesOf(state, id).includes(foe));
    if (ally) return `your alliance with ${GREAT_NATIONS[ally].name}`;
  }
  const harm = (state.lastHarm || {})[foe] ?? -99;
  if (state.turn - harm <= 8) return foe === 'orhai' ? 'their riders\' raids on your settlements' : 'their raids on your people';
  if (foe === 'orhai') {
    const g = great(state, foe);
    if (g && state.turn - (g.lastDemand ?? -99) <= 8) return 'their demands for tribute';
  }
  return null;
}

// Whether declaring war on them would break your word.
export function wouldBreakWord(state, foe) {
  if (foe === 'skarn') {
    const sk = state.neighbors.skarn;
    return Boolean(sk.peace) || sk.truceUntil > state.turn;
  }
  const g = great(state, foe);
  return Boolean(g && g.treaties && g.treaties.peace);
}

function hostWords(foe) {
  return { orhai: 'their hosts will ride against your armies and settlements on the plains and the desert edge', ostrani: 'their galleys will raid your settlements on the coast and in the lake country' }[foe]
    || `${HOSTS[foe].who.replace(/^An? /, '').toLowerCase()} will come against your armies and settlements in ${listWords(HOSTS[foe].reach.map((r) => lowerFirst(REGIONS[r].name)))}`;
}

export function foeMet(state, foe) {
  if (foe === 'skarn') return Boolean(state.neighbors.skarn.known && nation(state, 'skarn'));
  return greatMet(state, foe);
}

export function warBlocker(state, foe) {
  if (!FOES[foe] || !WAR_FOES.includes(foe)) return 'Choose a people to make war on.';
  if (!eraAtLeast(state, 'nation')) return 'Wars between nations come in the Nation era.';
  if (!foeMet(state, foe)) return 'Your people have not met them.';
  if (atWar(state, foe)) return `You are already at war with ${foeName(foe)}.`;
  const ended = (state.warEnded || {})[foe];
  if (ended != null && state.turn - ended < WAR_TRUCE) return `You made peace with ${foeName(foe)} less than two years ago, and your word holds until then.`;
  if (foe === 'skarn' && state.neighbors.skarn.vassal) return 'The Skarn are your vassals.';
  if (hasKnowledge(state, 'assembly') && (!warReason(state, foe) || wouldBreakWord(state, foe))) return 'The assembly will not vote for a war without a reason, or one that breaks your word.';
  return null;
}

// What declaring war on them would cost: the lines the War section shows.
export function warCostWords(state, foe) {
  const reason = warReason(state, foe);
  const broken = wouldBreakWord(state, foe);
  const parts = [];
  if (reason && !broken) parts.push(`You have a reason: ${reason}.`);
  else parts.push(`${broken ? 'It would break your word to them' : 'You have no reason your people would accept'}: every other people would think less of you (relations 10 lower), and your settlements would be 5 less loyal for two years.`);
  if (foe === 'skarn') parts.push('Their raids go on as before, and your armies could raid their land or besiege Skarn hold.');
  if (foe !== 'skarn') parts.push(`Their embassy, treaties, trade, and trade route end, and ${hostWords(foe)}.${REGIONS[FOES[foe].home].sea ? ' Your armies cannot reach their islands.' : ''}`);
  return parts.join(' ');
}

export function declareWar(state, { foe }) {
  const why = warBlocker(state, foe);
  if (why) return { error: why };
  const reason = warReason(state, foe);
  const broken = wouldBreakWord(state, foe);
  if (!state.wars) state.wars = {};
  state.wars[foe] = {
    since: state.turn, score: 0, reason, stormed: false, battles: 0,
  };
  const lines = [];
  if (foe === 'skarn') {
    const sk = state.neighbors.skarn;
    if (sk.peace) endPeace(state, 'you declared war on them');
    sk.truceUntil = -1;
    sk.honoredUntil = -1;
    changeRelation(state, 'skarn', -15);
    remember(state, 'skarn', `were declared war on in Year ${year(state)}`, broken ? -20 : 0);
  } else {
    const g = great(state, foe);
    const had = [g.embassy && 'your embassy', g.route && 'the trade route', Object.values(g.treaties).some(Boolean) && 'every treaty'].filter(Boolean);
    g.embassy = false;
    g.route = false;
    g.treaties = {};
    g.paidUntil = -1;
    changeGreat(state, foe, -20);
    greatRemember(state, foe, `declared war on them in Year ${year(state)}`, broken ? -20 : -5);
    if (had.length) lines.push(`${capital(listWords(had))} with them ${had.length === 1 ? 'is' : 'are'} gone.`);
  }
  if (!reason || broken) {
    state.unjustWarUntil = state.turn + 8;
    for (const id of NEIGHBOR_ORDER) {
      if (id !== foe && state.neighbors[id].known && !state.neighbors[id].joined) changeRelation(state, id, -10);
    }
    for (const id of WAR_FOES) if (id !== foe && id !== 'skarn' && greatMet(state, id)) changeGreat(state, id, -10);
    lines.push(broken ? 'You broke your word to them: every other people thinks less of you, and your own settlements are troubled.' : 'You gave no reason your people would accept: every other people thinks less of you, and your own settlements are troubled.');
  }
  return { message: `You are at war with ${foeName(foe)}${reason && !broken ? `, for ${reason}` : ''}. ${lines.join(' ')}`.trim() };
}

function addScore(state, foe, n) {
  const w = warWith(state, foe);
  if (w) w.score = Math.max(-100, Math.min(100, w.score + n));
}

// ----- Battles -----

function shake(state, n) {
  for (const p of living(state)) p.morale = clamp(p.morale + n);
}

// The battle as it would begin, without starting it.
function buildBattle(state, spec) {
  const { army, foe } = spec;
  const us = army.companies.filter((c) => c.soldiers > 0).map((c) => companyUnit(state, c));
  const scouts = army.companies.some((c) => c.kind === 'skirmishers' && c.soldiers > 0);
  return createField({
    region: army.location,
    foe,
    foeName: foeName(foe),
    us,
    them: foeUnits(state, foe, spec.count),
    attacker: spec.attacker || 'them',
    walls: spec.walls || null,
    commander: fieldCommander(army),
    weather: state.weather,
    seen: scouts || state.weather !== 'fog',
    title: spec.title,
  });
}

// Builds and starts a battle for one of your armies. spec: { army, foe,
// count, context ('road', 'relief', 'town', 'meet', 'sally', 'raid', or
// 'storm'),
// attacker, walls, townId, raid, title, text }. With the army's stance at
// "ask" and nothing else waiting, it waits for the player; otherwise the
// commander fights it at once, or falls back if the stance says so.
// Returns report lines.
export function armyBattle(state, spec) {
  const { army, foe } = spec;
  const battle = buildBattle(state, spec);
  const us = battle.us;
  const ev = {
    type: 'field', armyId: army.id, foe, context: spec.context, townId: spec.townId ?? null, raid: spec.raid || null, text: spec.text, battle,
  };
  if (!us.length) return finishField(state, ev, 'lost');
  if (battle.attacker === 'them' && army.stance === 'withdraw' && estimateField(state, battle, 12) < 0.5) return withdraw(state, ev, true);
  if (army.stance === 'ask' && !state.pendingEvent) {
    state.pendingEvent = ev;
    return [`${spec.text} The ${army.name.toLowerCase()} awaits your orders.`];
  }
  return finishField(state, ev, autoField(state, battle));
}

// The battle the player is shown, if any.
export function pendingField(state) {
  const ev = state.pendingEvent;
  return ev && ev.type === 'field' ? ev : null;
}

// Falls back one region toward the valley; in the valley, it stays.
function fallBack(state, army) {
  army.siege = null;
  army.march = null;
  army.order = 'hold';
  const path = pathTo(state, army.location, 'valley');
  if (path && path.length) army.location = path[0];
}

// The army pulls back without fighting it out: riders cut some down.
// before: whether it pulled back before the battle began.
function withdraw(state, ev, before) {
  const army = armyById(state, ev.armyId);
  const battle = ev.battle;
  const riders = fighting(battle.them).some((u) => FOE_KINDS[u.kind].mounted);
  let lost = 0;
  if (!before) applyOurLosses(state, ev, 'lost');
  if (riders) {
    for (const c of army.companies) {
      const n = Math.ceil(c.soldiers * 0.1);
      const killed = Math.ceil(n / 2);
      companyLosses(state, c, killed, n - killed);
      lost += n;
    }
  }
  const lines = [`${ev.text} ${army.commander ? army.commander.name : 'The army'} ${before ? 'judged the odds too poor and' : ''} pulled the ${army.name.toLowerCase()} back${riders && lost ? `, and riders cut down or wounded ${lost} on the way` : ''}.`.replace(/ {2}/g, ' ')];
  lines.push(...consequences(state, ev, 'lost', army));
  fallBack(state, army);
  endArmyIfEmpty(state, army, lines);
  if (state.pendingEvent === ev) state.pendingEvent = null;
  if (ev.context === 'road') lines.push(...raidersGoOn(state, ev));
  return lines;
}

export function fieldWithdraw(state) {
  const ev = pendingField(state);
  if (!ev) return { error: 'There is no battle to withdraw from.' };
  return { lines: withdraw(state, ev, ev.battle.phase === 'deploy') };
}

// Our losses, by company: of those who fell, some are killed, the rest wounded.
function applyOurLosses(state, ev, outcome) {
  const army = armyById(state, ev.armyId);
  let killed = 0;
  let wounded = 0;
  const heroes = [];
  for (const u of ev.battle.us) {
    const c = army.companies.find((x) => x.id === u.id);
    if (!c) continue;
    const lost = Math.min(c.soldiers, Math.round(u.start - u.soldiers));
    if (lost <= 0) continue;
    // Physicians save a third of those who would have died.
    const k = Math.round(lost * KILLED_SHARE[outcome === 'won' ? 'won' : 'lost'] * (hasKnowledge(state, 'physicians') ? 2 / 3 : 1));
    heroes.push(...companyLosses(state, c, k, lost - k));
    killed += k;
    wounded += lost - k;
    u.start = u.soldiers; // Counted once.
  }
  return { killed, wounded, heroes };
}

function endArmyIfEmpty(state, army, lines) {
  pruneArmy(state, army);
  if (army.companies.length) return;
  state.armies = armies(state).filter((a) => a !== army);
  if (army.commander) state.people.push({ ...army.commander, task: 'rest', orderReturn: null });
  lines.push(`Nothing is left of the ${army.name.toLowerCase()}.${army.commander ? ` ${army.commander.name} has come home.` : ''}`);
}

// Ends a battle: losses on both sides, the commander's experience, the war,
// and what it decided. Returns report lines.
export function finishField(state, ev, outcome) {
  const army = armyById(state, ev.armyId);
  const battle = ev.battle;
  const won = outcome === 'won';
  const ours = applyOurLosses(state, ev, outcome);
  const theirLost = battle.them.reduce((sum, u) => sum + (u.start - u.soldiers), 0);
  foeLosses(state, ev.foe, theirLost * 0.6);
  const lines = [];
  const lead = battle.title ? `${battle.title}: ` : '';
  lines.push(`${lead}${won ? `The ${army.name.toLowerCase()} won` : `The ${army.name.toLowerCase()} was beaten`}. ${ours.killed || ours.wounded ? `${plural(ours.killed, 'soldier was', 'soldiers were')} killed and ${ours.wounded} wounded` : 'None of yours fell'}; ${foeName(ev.foe)} lost about ${Math.round(theirLost)}.${ours.heroes.length ? ` Among the dead: ${listWords(ours.heroes)}.` : ''}`);
  if (army.commander) {
    army.commander.command = (army.commander.command || 0) + 1;
    if (!won && chance(state, 0.15)) {
      lines.push(`${army.commander.name}, who commanded it, was killed.`);
      army.commander = null;
    }
  }
  const w = warWith(state, ev.foe);
  if (w) {
    w.battles = (w.battles || 0) + 1;
    addScore(state, ev.foe, won ? WAR_SCORE.battleWon : WAR_SCORE.battleLost);
  }
  if (won) recordDeed(state, 'battlesWon');
  shake(state, won ? 3 : -3);
  lines.push(...consequences(state, ev, outcome, army));
  if (!won && ['meet', 'sally', 'raid'].includes(ev.context)) {
    fallBack(state, army);
    lines.push(`It fell back to ${regionName(army.location)}.`);
  }
  endArmyIfEmpty(state, army, lines);
  if (state.pendingEvent === ev) state.pendingEvent = null;
  // Raiders who beat the army on the road go on to the capital.
  if (!won && ev.context === 'road') lines.push(...raidersGoOn(state, ev));
  return lines;
}

// What the battle decided, beyond the losses.
function consequences(state, ev, outcome, army) {
  const won = outcome === 'won';
  const lines = [];
  if (ev.context === 'road' && won) lines.push(`${state.campName} is safe: the raiders never reached it.`);
  if (ev.context === 'relief') {
    if (won) {
      state.siege = null;
      lines.push(`The siege of ${state.campName} is broken: the Skarn have gone.`);
    } else if (state.siege) {
      state.siege.raiders = Math.max(0, Math.round(soldiersIn(ev.battle.them)));
      lines.push('The siege goes on.');
    }
  }
  if (ev.context === 'town') {
    const t = (state.settlements || []).find((x) => x.id === ev.townId);
    if (t && won) {
      t.loyalty = clamp(t.loyalty + 5);
      addScore(state, ev.foe, WAR_SCORE.townSaved);
      lines.push(`${t.name} is safe, and its people saw your army defend them.`);
    } else if (t) {
      lines.push(sackTown(state, t, ev.foe));
    }
  }
  if (ev.context === 'storm') {
    if (won) lines.push(...homeFallen(state, ev.foe, army, 'stormed'));
    else lines.push(`The walls of ${FOES[ev.foe].homeName} held. The siege goes on.`);
  }
  return lines;
}

// Raiders who got past the army fall on the capital, or lay siege. The army
// falls back to the walls and fights beside the defenders: half its soldiers
// turn back as many raiders.
function raidersGoOn(state, ev) {
  const army = armyById(state, ev.armyId);
  const help = army && army.location === 'valley' ? Math.round(armySoldiers(army) / 2) : 0;
  const left = Math.max(0, Math.round(soldiersIn(ev.battle.them)) - help);
  if (left < 3 || state.pendingEvent) return left < 3 ? ['The raiders were too few to go on.'] : [];
  const r = ev.raid || { from: 'skarn' };
  if (r.siege) return [startSiege(state, left)];
  state.pendingEvent = {
    type: 'raid', raiders: left, warned: true, from: r.from || 'skarn', host: Boolean(r.host),
  };
  state.pendingEvent.battle = createBattle(state, state.pendingEvent);
  return [`About ${left} of them went on toward ${state.campName}${help ? `; the army fell back to the walls, and turned back ${help} more` : ''}. Decide how to respond.`];
}

// An army holding the valley meets raiders on the road to the capital.
// Returns report lines, or null when no army is there to meet them.
export function meetOnRoad(state, {
  raiders, from = 'skarn', host = false, siege = false,
}) {
  const army = armiesIn(state, 'valley', { holding: true }).filter((a) => armySoldiers(a) > 0)
    .sort((a, b) => armyPower(state, b) - armyPower(state, a))[0];
  if (!army) return null;
  const foe = from === 'clans' ? 'clans' : 'skarn';
  const who = foe === 'clans' ? 'hill clansmen' : host ? 'the Skarn host' : 'Skarn raiders';
  return armyBattle(state, {
    army,
    foe,
    count: raiders,
    context: 'road',
    attacker: 'them',
    raid: {
      raiders, from, host, siege,
    },
    title: `On the road to ${state.campName}`,
    text: `About ${raiders} ${who} are marching on ${state.campName}, and the ${army.name.toLowerCase()} stands in their way.`,
  });
}

// ----- Settlements under attack -----

export function sackTown(state, t, foe) {
  const lost = Math.max(2, Math.round(t.population * 0.15));
  t.population = Math.max(3, t.population - lost);
  t.loyalty = clamp(t.loyalty - 15);
  t.harriedAt = state.turn;
  addScore(state, foe, WAR_SCORE.townSacked);
  return `${capital(foeName(foe))} sacked ${t.name}: ${plural(lost, 'settler was', 'settlers were')} killed or carried off, and its people feel abandoned.`;
}

// Where their hosts can reach: a peace that pushed them back holds them to
// their homeland.
function hostReach(state, foe) {
  const g = great(state, foe);
  if (g && g.pulledBack) return [FOES[foe].home];
  return HOSTS[foe] ? HOSTS[foe].reach : [];
}

// The chance a settlement holds out against a host without an army: as
// against skirmishers, but harder, and a keep holds far longer.
export function holdOutChance(state, t) {
  return Math.min(0.95, townDefense(state, t) * 0.6 + (t.buildings.keep ? 0.3 : 0) + (hasKnowledge(state, 'wells') ? 0.1 : 0));
}

// At war, the Orhai and the Ostrani send hosts against your settlements and
// armies within their reach. Returns report lines.
function hostSeason(state, foe) {
  const lines = [];
  if (homeBesieged(state, foe)) return lines;
  if (!chance(state, HOSTS[foe].chance)) return lines;
  const size = Math.max(12, Math.round(foeForce(state, foe) * (foe === 'orhai' ? 0.35 : 0.3)));
  const reach = hostReach(state, foe);
  const towns = (state.settlements || []).filter((t) => reach.includes(placeRegion(t.place)));
  const who = HOSTS[foe].who;
  if (towns.length) {
    const t = pick(state, towns);
    const region = placeRegion(t.place);
    const army = armiesIn(state, region).filter((a) => armySoldiers(a) > 0 && !a.siege)[0];
    if (army) {
      return armyBattle(state, {
        army,
        foe,
        count: size,
        context: 'town',
        townId: t.id,
        attacker: 'them',
        walls: t.buildings.stoneWall ? { side: 'us', cover: 0.4 } : t.buildings.palisade ? { side: 'us', cover: 0.6 } : null,
        title: `Before ${t.name}`,
        text: `${who}, about ${size} strong, came against ${t.name}, and the ${army.name.toLowerCase()} stands before it.`,
      });
    }
    if (chance(state, holdOutChance(state, t))) {
      addScore(state, foe, WAR_SCORE.townSaved);
      foeLosses(state, foe, Math.round(size * 0.15));
      lines.push(`${who}, about ${size} strong, came against ${t.name}, and it held out${t.buildings.keep ? ' behind its keep' : ''}.`);
      return lines;
    }
    lines.push(`${who}, about ${size} strong, came against ${t.name}. ${sackTown(state, t, foe)}`);
    return lines;
  }
  const target = armies(state).filter((a) => reach.includes(a.location) && !a.march && armySoldiers(a) > 0)[0];
  if (target) {
    return armyBattle(state, {
      army: target,
      foe,
      count: size,
      context: 'meet',
      attacker: 'them',
      title: `In ${regionName(target.location)}`,
      text: `${who}, about ${size} strong, came against the ${target.name.toLowerCase()} in ${regionName(target.location)}.`,
    });
  }
  return lines;
}

// ----- Raids and sieges -----

function raidSeason(state, army, foe) {
  const lines = [];
  const n = armySoldiers(army);
  const s = seasonIndex(state);
  const loot = { food: n * (s === 1 || s === 2 ? 2 : 1) };
  if (foe === 'skarn') loot.goods = Math.round(n / 2);
  if (foe === 'ostrani') loot.coin = Math.round(n / 3);
  if (foe === 'orhai') loot.horses = Math.round(n / 10);
  // The army fills its packs first; the rest goes home.
  const keep = Math.min(loot.food, Math.max(0, supplyCapacity(state, army) - army.food));
  army.food += keep;
  const home = { ...loot, food: loot.food - keep };
  for (const [res, k] of Object.entries(home)) state.resources[res] = (state.resources[res] || 0) + k;
  if (foe === 'skarn') {
    const nat = nation(state, 'skarn');
    nat.wealth = Math.max(0, nat.wealth - 20);
    nat.population = Math.max(nat.warriors, nat.population - 2);
  }
  addScore(state, foe, WAR_SCORE.raidSeason);
  const got = Object.entries(loot).filter(([, k]) => k > 0).map(([res, k]) => `${k} ${res}`);
  lines.push(`The ${army.name.toLowerCase()} raided ${foeName(foe)}'s land and took ${listWords(got)}.`);
  if (chance(state, 0.4) && foeForce(state, foe) >= 6) {
    const count = Math.round(foeForce(state, foe) * 0.6);
    lines.push(...armyBattle(state, {
      army,
      foe,
      count,
      context: 'raid',
      attacker: 'them',
      title: `Raiding ${foeName(foe)}`,
      text: `${capital(foeName(foe))} came out to stop the raid, about ${count} strong.`,
    }));
  }
  return lines;
}

function siegeSeason(state, army) {
  const lines = [];
  const foe = army.siege.foe;
  const f = FOES[foe];
  if (!atWar(state, foe)) {
    army.siege = null;
    army.order = 'hold';
    return lines;
  }
  const garrison = () => Math.round(foeForce(state, foe) * f.garrison);
  if (army.siege.garrison == null) army.siege.garrison = garrison();
  // An army too small to hem them in is no siege at all: they come and go
  // as they please, and come out to fight it.
  const ratio = garrison() * foeWorth(state, foe) * 1.2 / Math.max(1, armyPower(state, army));
  const seasons = state.turn - army.siege.started + 1;
  if (ratio > 2) {
    army.siege.started += 1; // The siege has not really begun.
    lines.push(`The ${army.name.toLowerCase()} is too small to hem in ${f.homeName}: ${foeName(foe)} come and go as they please.`);
  } else {
    const hungry = Math.ceil(garrison() * f.hunger);
    foeLosses(state, foe, hungry);
    addScore(state, foe, WAR_SCORE.siegeSeason);
    if (seasons >= f.yields || garrison() < army.siege.garrison * 0.45 || garrison() < 5) {
      lines.push(...homeFallen(state, foe, army, 'starved'));
      return lines;
    }
    lines.push(`The siege of ${f.homeName} goes on: ${plural(seasons, 'season', 'seasons')}, and hunger has taken ${hungry} more of them. About ${garrison()} hold out.`);
  }
  // They come out to fight more often the stronger they are against the army.
  if (garrison() >= 6 && chance(state, Math.max(0.1, Math.min(0.7, 0.5 * ratio - 0.15)))) {
    const count = Math.round(garrison() * 0.8);
    lines.push(...armyBattle(state, {
      army,
      foe,
      count,
      context: 'sally',
      attacker: 'them',
      title: `The siege of ${f.homeName}`,
      text: `${capital(foeName(foe))} came out of ${f.homeName} to break the siege, about ${count} strong.`,
    }));
  }
  return lines;
}

// Why the army cannot storm now, or null.
export function stormBlocker(state, army) {
  if (!army) return 'There is no such army.';
  if (!army.siege || army.march) return 'An army must besiege the enemy\'s home before it can storm it.';
  if (state.pendingEvent) return 'Deal with what is happening first.';
  if (!armySoldiers(army)) return 'Every soldier in the army is wounded.';
  return null;
}

function stormSpec(state, army) {
  const foe = army.siege.foe;
  const f = FOES[foe];
  const count = Math.max(4, Math.round(foeForce(state, foe) * f.garrison));
  return {
    army,
    foe,
    count,
    context: 'storm',
    attacker: 'us',
    walls: f.walls ? { side: 'them', cover: f.walls } : null,
    title: `Storming ${f.homeName}`,
    text: `The ${army.name.toLowerCase()} storms ${f.homeName}, held by about ${count} of ${foeName(foe)}.`,
  };
}

// The commander's honest odds of storming it now, as a chance.
export function stormOdds(state, army) {
  if (stormBlocker(state, army)) return null;
  return estimateField(state, buildBattle(state, stormSpec(state, army)), 16);
}

// Storming the enemy's home: a battle against them behind their walls.
export function stormHome(state, { armyId }) {
  const army = armyById(state, armyId);
  const why = stormBlocker(state, army);
  if (why) return { error: why };
  return { lines: armyBattle(state, stormSpec(state, army)) };
}

// Their home falls, stormed or starved out: they will accept any terms.
function homeFallen(state, foe, army, how) {
  const f = FOES[foe];
  const w = warWith(state, foe);
  if (w) w.stormed = true;
  addScore(state, foe, how === 'stormed' ? WAR_SCORE.stormed : WAR_SCORE.starved);
  if (foe === 'skarn') {
    const nat = nation(state, 'skarn');
    nat.population = Math.max(nat.warriors, Math.round(nat.population * 0.85));
    nat.wealth = 0;
  }
  for (const [res, n] of Object.entries(f.loot)) state.resources[res] = (state.resources[res] || 0) + n;
  if (army) {
    army.siege = null;
    army.order = 'hold';
  }
  recordDeed(state, 'battlesWon');
  shake(state, 6);
  const loot = listWords(Object.entries(f.loot).map(([res, n]) => `${n} ${res}`));
  return [`${capital(f.homeName)} has fallen: ${how === 'stormed' ? 'your army stormed it' : 'hunger forced them to open the gates'}. You carried off ${loot}. ${capital(foeName(foe))} will accept any terms of peace now.`];
}

// ----- Peace -----

export function payCost(state, foe) {
  if (foe === 'skarn') return { food: 40, goods: 20 };
  if (foe === 'orhai') return { coin: tributeCost(state) * 2 };
  return { coin: 40 };
}

function hasLand(foe) {
  return Boolean(LAND_TERMS[foe]);
}

function costText(cost) {
  return listWords(Object.entries(cost).map(([k, n]) => `${n} ${k}`));
}

function tributeText(foe) {
  return `${costText(TRIBUTES[foe])} each spring for ${TRIBUTE_YEARS} years`;
}

function needScore(term, foe) {
  const t = PEACE_TERMS[term];
  if (t.score == null) return null;
  return typeof t.score === 'object' ? t.score[foe] : t.score;
}

// What they would make peace for now: [{ id, label, why }].
export function peaceOptions(state, foe) {
  const w = warWith(state, foe);
  if (!w) return [];
  const out = [];
  const short = (score) => (w.stormed || w.score >= score ? null : `They will not agree while the war stands at ${w.score}; they would at ${score} or more.`);
  for (const id of PEACE_ORDER) {
    const t = PEACE_TERMS[id];
    if (t.only && !t.only.includes(foe)) continue;
    if (id === 'land' && !hasLand(foe)) continue;
    if (id === 'pay') {
      const cost = payCost(state, foe);
      if (!short(needScore('white', foe))) continue; // Only when they will not take even terms.
      const lack = Object.entries(cost).filter(([k, n]) => (state.resources[k] || 0) < n);
      out.push({ id, label: `${t.name}: ${costText(cost)}`, why: lack.length ? `You have ${listWords(lack.map(([k]) => `${state.resources[k] || 0} ${k}`))}.` : null });
      continue;
    }
    const label = id === 'tribute' ? `${t.name}: ${tributeText(foe)}` : id === 'land' ? `${t.name}. ${LAND_TERMS[foe]}` : t.name;
    out.push({ id, label, why: short(needScore(id, foe)) });
  }
  return out;
}

export function makePeace(state, { foe, terms }) {
  const w = warWith(state, foe);
  if (!w) return { error: `You are not at war with ${foeName(foe)}.` };
  const option = peaceOptions(state, foe).find((o) => o.id === terms);
  if (!option) return { error: 'Choose terms they could accept.' };
  if (option.why) return { error: option.why };
  const lines = [];
  if (terms === 'pay') {
    for (const [k, n] of Object.entries(payCost(state, foe))) state.resources[k] -= n;
  }
  delete state.wars[foe];
  if (!state.warEnded) state.warEnded = {};
  state.warEnded[foe] = state.turn;
  for (const a of armies(state)) {
    if (a.siege && a.siege.foe === foe) {
      a.siege = null;
      a.order = 'hold';
    }
  }
  if (foe === 'skarn') {
    const sk = state.neighbors.skarn;
    if (terms === 'vassal') {
      makeVassal(state);
      lines.push('The Skarn are your vassals now: they keep the peace, pay tribute each spring, and a fifth of their warriors stand with you when raiders come.');
    } else {
      sk.peace = true;
      sk.peaceWarned = false;
      sk.honoredUntil = state.turn + 4; // They keep this peace for a year at least.
      state.raidThreat = false;
    }
    changeRelation(state, 'skarn', 10);
    remember(state, 'skarn', `made peace with you in Year ${year(state)}`, 5);
    if (terms === 'land') {
      const taken = landsOf(state, 'skarn').filter((id) => id !== NEIGHBORS.skarn.home);
      for (const id of taken) state.places[id].owner = 'player';
      if (taken.length) lines.push(`Their lands beyond the hold are yours now: ${listWords(taken.map((id) => placeName(state, id)))}.`);
    }
  } else {
    const g = great(state, foe);
    if (GREAT_TREATIES.peace.with.includes(foe)) g.treaties.peace = true;
    changeGreat(state, foe, 10);
    greatRemember(state, foe, `made peace with you in Year ${year(state)}`, 5);
    if (terms === 'land' && ['orhai', 'dravan', 'haldi'].includes(foe)) g.pulledBack = true;
    if (terms === 'land' && foe === 'ostrani') g.quay = true;
    if (terms === 'land' && foe === 'ashani') g.richRoute = true;
    if (terms === 'land') lines.push(LAND_TERMS[foe]);
  }
  if (terms === 'tribute') {
    if (!state.tributes) state.tributes = [];
    state.tributes.push({ foe, until: state.turn + 4 * TRIBUTE_YEARS, ...TRIBUTES[foe] });
    lines.push(`They will pay ${tributeText(foe)}.`);
  }
  if (GREAT_TREATIES.peace.with.includes(foe)) lines.push('A peace pact holds between you: their raiders leave your settlements alone, and they will trade.');
  return { message: `Peace with ${foeName(foe)}${terms === 'pay' ? ', bought and paid for' : ''}. ${lines.join(' ')}`.trim() };
}

// ----- Each season -----

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

// Tribute owed to you, paid each spring. Runs once the new season has begun.
export function tributesYear(state) {
  const lines = [];
  if (seasonIndex(state) !== 0 || !state.tributes) return lines;
  for (const t of state.tributes) {
    if (t.until <= state.turn) continue;
    const got = [];
    for (const res of ['food', 'goods', 'coin', 'horses', 'iron']) {
      if (!t[res]) continue;
      state.resources[res] = (state.resources[res] || 0) + t[res];
      got.push(`${t[res]} ${res}`);
    }
    lines.push(`${capital(foeName(t.foe))} paid their tribute: ${listWords(got)}.`);
  }
  state.tributes = state.tributes.filter((t) => t.until > state.turn);
  return lines;
}

// Runs each season: the armies' upkeep and marches, their raids and sieges,
// the enemy's hosts, tribute, and the war's weight at home.
// Returns { urgent, events, routine }.
export function warSeason(state) {
  const out = { urgent: [], events: [], routine: [] };
  if (!eraAtLeast(state, 'nation')) return out;
  const up = armiesUpkeep(state);
  out.urgent.push(...up.urgent);
  out.events.push(...up.events);
  out.routine.push(...up.routine);
  // An army in the valley may break a siege of the capital: it attacks the
  // besiegers, unless it fights only with good odds and these are not.
  const relief = state.siege && armiesIn(state, 'valley', { holding: true }).filter((a) => armySoldiers(a) > 0)
    .sort((a, b) => armyPower(state, b) - armyPower(state, a))[0];
  if (relief) {
    const spec = {
      army: relief,
      foe: 'skarn',
      count: state.siege.raiders,
      context: 'relief',
      attacker: 'us',
      title: `Before ${state.campName}`,
      text: `The ${relief.name.toLowerCase()} can attack the Skarn besieging ${state.campName}, about ${state.siege.raiders} of them.`,
    };
    if (relief.stance !== 'withdraw' || estimateField(state, buildBattle(state, spec), 12) >= 0.6) out.urgent.push(...armyBattle(state, spec));
  }
  for (const army of [...armies(state)]) {
    if (army.march || !armyById(state, army.id)) continue;
    if (army.order === 'raid') {
      const foe = Object.keys(state.wars || {}).find((id) => FOES[id].home === army.location);
      if (foe) out.urgent.push(...raidSeason(state, army, foe));
      else army.order = 'hold';
    } else if (army.siege) {
      out.urgent.push(...siegeSeason(state, army));
    }
  }
  for (const foe of Object.keys(HOSTS)) if (atWar(state, foe)) out.urgent.push(...hostSeason(state, foe));
  out.urgent.push(...alliesInYourWars(state));
  if (seasonIndex(state) === 0 && warYears(state) >= 2) {
    const tired = warWeariness(state);
    out.events.push(`The war is in its ${ORDINALS[warYears(state)] || `${warYears(state) + 1}th`} year. Your people tire of it: the settlements are ${tired.loyalty} less loyal, and spirits in ${state.campName} settle ${tired.spirits} lower.`);
  }
  return out;
}

// Great nations allied to you may fight beside you against a great nation:
// each decides once, when your war begins (7 in 10 come), and each season
// after wears the enemy down and turns the war your way. An ally of your
// enemy's never comes. Returns report lines.
export const ALLY_JOINS = 0.7;
export const ALLY_WEAR = 0.03;
export const ALLY_SCORE = 3;
function alliesInYourWars(state) {
  const lines = [];
  if (!state.great) return lines;
  for (const foe of Object.keys(state.wars || {}).filter((f) => GREAT_NATIONS[f])) {
    const war = state.wars[foe];
    if (!war.allyAnswers) war.allyAnswers = {};
    for (const id of GREAT_ORDER.filter((x) => x !== foe && state.great[x].treaties.alliance && !atWar(state, x) && !alliesOf(state, x).includes(foe))) {
      if (!(id in war.allyAnswers)) {
        war.allyAnswers[id] = chance(state, ALLY_JOINS);
        lines.push(war.allyAnswers[id]
          ? `${capital(GREAT_NATIONS[id].name)}, your allies, have joined your war on ${foeName(foe)}.`
          : `${capital(GREAT_NATIONS[id].name)}, your allies, will not join your war on ${foeName(foe)}.`);
      }
      if (!war.allyAnswers[id]) continue;
      const g = great(state, foe);
      g.strength = Math.max(5, Math.round((g.strength || 0) * (1 - ALLY_WEAR)));
      addScore(state, foe, ALLY_SCORE);
    }
  }
  return lines;
}

// The commander's honest odds for the battle waiting, as a chance.
export function fieldOdds(state) {
  const ev = pendingField(state);
  return ev ? estimateField(state, ev.battle, 16) : null;
}

// What each people's war looks like, for the Armies screen.
export function warStatusLines(state) {
  return WAR_FOES.filter((id) => foeMet(state, id)).map((id) => {
    const w = warWith(state, id);
    if (!w) return { id, name: capital(foeName(id)), atWar: false };
    const years = Math.floor((state.turn - w.since) / 4);
    return {
      id,
      name: capital(foeName(id)),
      atWar: true,
      line: `At war for ${years ? plural(years, 'year', 'years') : 'less than a year'}${w.reason ? `, over ${w.reason}` : ''}. War score ${w.score}${w.stormed ? `; ${FOES[id].homeName} has fallen, and they will accept any terms` : ''}. About ${Math.round(foeForce(state, id))} of them under arms, each worth ${foeWorth(state, id).toFixed(1)}.`,
    };
  });
}

export { armyHolding };
