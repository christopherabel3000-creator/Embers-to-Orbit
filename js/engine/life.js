// The cycle of life: births, growing up, growing old.

import { AGES, BABY_NAMES } from './data.js';
import {
  living, seasonIndex, makePerson, allowedTasksFor,
} from './state.js';
import { chance, pick } from './rng.js';
import { parents, birthOutlook } from './population.js';
import { refreshAdvisors } from './advisors.js';
import { clamp, plural } from './util.js';
import { isNotable } from './village.js';

function babyName(state) {
  const used = new Set(state.people.map((p) => p.name));
  const free = BABY_NAMES.filter((n) => !used.has(n));
  if (free.length) return pick(state, free);
  const base = pick(state, BABY_NAMES);
  let n = 2;
  while (used.has(`${base} the ${['Second', 'Third', 'Fourth', 'Fifth'][n - 2] || 'Younger'}`)) n += 1;
  return `${base} the ${['Second', 'Third', 'Fourth', 'Fifth'][n - 2] || 'Younger'}`;
}

// Runs at the start of each new season. Returns report lines.
export function advanceLife(state) {
  const out = { urgent: [], events: [] };
  const s = seasonIndex(state);

  // Everyone grows a year older each spring.
  if (s === 0) {
    const grown = { child: [], youth: [], adult: [] };
    const departed = [];
    for (const p of living(state)) {
      p.age += 1;
      if (p.age === AGES.child) grown.child.push(p);
      if (p.age === AGES.youth) grown.youth.push(p);
      if (p.age === AGES.adult) grown.adult.push(p);
      if (p.age >= AGES.oldAgeDeaths && chance(state, (p.age - 55) * 0.02)) departed.push(p);
    }
    for (const p of grown.child) if (p.task === 'rest') p.task = 'forage';
    if (state.capitalCounted) {
      // A large capital counts its ordinary people rather than naming them.
      const n = grown.child.length + grown.youth.length + grown.adult.length;
      if (n) out.events.push(`Coming of age this spring: ${[[grown.child, 'turned 5 and can help with light work'], [grown.youth, 'turned 12 and can take on any work'], [grown.adult, 'turned 16 and are counted among the adults']].filter(([list]) => list.length).map(([list, what]) => `${list.length} ${what}`).join('; ')}.`);
      const named = departed.filter((p) => isNotable(state, p));
      for (const p of named) out.urgent.push(`${p.name} died peacefully in old age, at ${p.age}. ${state.campName} gathered to remember.`);
      if (departed.length > named.length) out.events.push(`${plural(departed.length - named.length, 'elder', 'elders')} died peacefully in old age.`);
      for (const p of departed) p.alive = false;
    } else {
      for (const p of grown.child) out.events.push(`${p.name} is 5 now, old enough to help with light work, and has started foraging.`);
      for (const p of grown.youth) out.events.push(`${p.name} turned 12 and can now take on any work, and help defend the camp.`);
      for (const p of grown.adult) out.events.push(`${p.name} turned 16 and is now counted among the adults.`);
      for (const p of departed) {
        p.alive = false;
        out.urgent.push(`${p.name} died peacefully in old age, at ${p.age}. The camp gathered to remember.`);
      }
    }
    if (departed.length) {
      for (const p of living(state)) p.morale = clamp(p.morale - 5 * departed.length);
      refreshAdvisors(state);
    }
  }

  // Keep the very young away from work they cannot do.
  for (const p of living(state)) {
    if (!allowedTasksFor(state, p).includes(p.task)) p.task = 'rest';
  }

  // Births. In the Nation era a large capital can have more than one a season.
  const outlook = birthOutlook(state);
  const expected = outlook.chance;
  const births = Math.floor(expected) + (expected % 1 > 0 && chance(state, expected % 1) ? 1 : 0);
  const born = [];
  for (let i = 0; i < births; i++) {
    const parent = pick(state, parents(state));
    const baby = makePerson({ name: babyName(state), note: `Born in ${state.era === 'camp' ? 'the camp' : state.campName} to ${parent.name}.`, age: 0, skills: {} }, state.nextPersonId++, 'rest');
    baby.skills = { hunting: 0, foraging: 0, building: 0, healing: 0, scouting: 0, learning: 0 };
    baby.morale = 70;
    baby.parent = parent.id;
    state.people.push(baby);
    born.push({ baby, parent });
  }
  if (born.length) {
    for (const p of living(state)) p.morale = clamp(p.morale + 4);
    if (state.capitalCounted) out.events.push(`${born.length === 1 ? 'A child was' : `${born.length} children were`} born in ${state.campName}.`);
    else out.events.push(...born.map(({ baby, parent }) => `${parent.name} had a baby, named ${baby.name}. The whole ${state.era === 'camp' ? 'camp' : 'village'} celebrated.`));
  }
  return out;
}

