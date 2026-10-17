// Creating a new game, loading old saves, plus small read-only helpers
// about the game state.

import {
  FOUNDERS, SEASONS, STARTING_SHELTER, SHELTER_PER_LEAN_TO, SHELTER_PER_HUT, BUILDING_ORDER, ERAS, BUILDINGS,
  PLACES, PLACE_ORDER, STARTING_PLACES, V1_DISCOVERY_TO_PLACE, LEARNING_BY_NAME, placeData,
  KNOWLEDGE, TASKS, TASK_ORDER, PLOTS_PER_FIELD, AGE_BY_NAME, AGES, CHILD_TASKS,
  NEIGHBORS, NEIGHBOR_ORDER, BASE_STORAGE, STORAGE_PER_STOREHOUSE, STORAGE_PER_GRANARY, LEAN_TIMES,
  DEFAULT_FOOD_STORES,
} from './data.js';
import { emptyDeeds } from './legacy.js';
import { WORLD_PLACES, REGIONS, initialWorld } from './worldData.js';
import { initialGreat, GREAT_NATIONS } from './greatData.js';
import { initialGreatWorld } from './greatWorld.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from './difficulty.js';

export const SAVE_VERSION = 36;

export const DEFAULT_PRIORITIES = {
  building: 'normal', learning: 'normal', defense: 'normal', exploration: 'normal', crafts: 'normal',
};

const STARTING_TASKS = {
  Aric: 'hunt', Brenna: 'forage', Corvin: 'wood', Dalia: 'forage', Esker: 'scout',
  Fenna: 'forage', Garrow: 'hunt', Hesta: 'build', Iven: 'wood', Jora: 'hunt',
  Kael: 'wood', Lisbet: 'forage',
};

export const DEFAULT_ORDERS = {
  restWhenHurt: true,
  keepHealer: false,
  foodReserve: 0, // 0 = off, otherwise the number of seasons food must last.
  winterForagers: false,
  placeNewcomers: true,
  autoAssign: false, // Put everyone on their best work each season.
  staffFields: false, // Move people to and from the fields as the year requires.
  autoShelter: false, // Queue a lean-to when the shelters are nearly full.
  harvestFeast: false, // Hold a feast after the harvest when there is food to spare.
  comforts: false, // Share out goods as comforts each season (a village).
  armGuards: false, // Spend goods on arms for the guards each season (a village).
  raidPolicy: 'ask', // 'ask', 'fightIfLikely', or 'auto'.
  inviteReserve: null, // Nation era: invite settlers for coin while the treasury keeps this much; null is off.
  spreadAbove: null, // Nation era: send people to the settlements while the capital has more than this; null is off.
};

export function makePerson(template, id, task = 'forage') {
  return {
    id,
    name: template.name,
    note: template.note,
    age: template.age ?? 30, // Years. Everyone grows a year older each spring.
    skills: { ...template.skills },
    health: 100,
    morale: 60,
    alive: true,
    task,
    orderReturn: null, // Set when a standing order moved this person.
    sick: false,
    xp: {}, // Practice toward the next level in each skill.
  };
}

function initialNeighbors() {
  const all = {};
  for (const id of NEIGHBOR_ORDER) {
    all[id] = {
      known: false,
      relation: NEIGHBORS[id].baseline,
      lastEnvoy: -1, // The turn of the last diplomatic act, one per season.
      contactPending: false, // First contact is waiting to happen.
      peace: false, // A lasting peace (the Skarn).
      truceUntil: -1, // Tribute buys a truce until this turn.
      peaceWarned: false, // The Skarn have warned that they think you weak.
      honoredUntil: -1, // Gifts keep the Skarn to the peace until this turn.
      honorsInARow: 0, // Years in a row the peace has been bought with gifts.
      chief: null, // The Skarn chief, and the turn the chief dies (set once they are known).
      chiefUntil: null,
      joined: 0, // How many of their people have joined the camp.
    };
  }
  return all;
}

function initialPlaces() {
  const places = {};
  for (const id of PLACE_ORDER) {
    places[id] = { known: STARTING_PLACES.includes(id), abundance: { hunt: 100, forage: 100 } };
  }
  return places;
}

export function newGame({ seed = Date.now(), campName = 'Emberhold', difficulty = DEFAULT_DIFFICULTY } = {}) {
  const people = FOUNDERS.map((f, i) => makePerson(f, i + 1, STARTING_TASKS[f.name] || 'forage'));
  const buildings = {};
  for (const id of BUILDING_ORDER) buildings[id] = 0;
  const state = {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    rng: seed >>> 0,
    campName: campName.trim() || 'Emberhold',
    turn: 0,
    resources: {
      food: 50, wood: 30, stone: 0, goods: 0, iron: 0, salt: 0, coin: 0, horses: 0,
    },
    people,
    nextPersonId: people.length + 1,
    wanderersMet: 0,
    buildings,
    buildQueue: [], // Buildings in order: { id, progress, paid }.
    places: initialPlaces(),
    workSites: { hunt: 'camp', forage: 'camp', wood: 'camp', scout: 'camp', quarry: 'camp' },
    foreignWorkOk: {}, // Task to a place on another people's land that the player chose to work anyway.
    orders: { ...DEFAULT_ORDERS },
    conditions: [], // Ongoing situations, like wolves at a place.
    lastFeast: -99, // The turn of the last feast. One a year.
    feastStreak: 0, // Feasts held in a row, a year or so apart: in a village, a custom.
    weather: 'clear', // This season's weather: clear, rain, fog, snow, or heat.
    difficulty: DIFFICULTIES[difficulty] ? difficulty : DEFAULT_DIFFICULTY, // How many raiders come; see difficulty.js.
    era: 'camp', // 'camp' (Survival era), 'village' (Settlement era), then 'nation' with a second settlement.
    villageFounded: null, // The turn the camp became a village.
    priorities: { ...DEFAULT_PRIORITIES }, // What the village council pushes for.
    foodStores: DEFAULT_FOOD_STORES, // Seasons of food the council keeps before it stops growing more, or 'full'.
    settlersMet: 0,
    lastInvite: null, // The turn settlers were last invited for coin.
    invited: 0, // Settlers invited for coin over the campaign.
    movedOut: 0, // People who moved from the capital to the settlements.
    skarnHost: null, // The turn a gathered Skarn host will march, if any.
    settlements: [], // Other settlements the village has founded.
    capitalCounted: false, // Past 100 people, the capital counts its ordinary people instead of naming them.
    world: initialWorld(), // The regions beyond the valley, and expeditions to them.
    great: initialGreat(), // The great nations beyond the valley.
    greatWorld: initialGreatWorld(), // Their feelings for each other, their wars, and their alliances.
    nationFounded: null, // The turn the Nation era began.
    armies: [], // Armies in the field: see armies.js.
    nextArmyId: 1,
    nextCompanyId: 1,
    wars: {}, // People to { since, score, reason, stormed, battles }: see war.js.
    warEnded: {}, // People to the turn peace was made with them.
    tributes: [], // Tribute owed to you: { foe, until, food, goods, coin, horses }.
    lastHarm: {}, // People to the turn they last raided you: a reason for war.
    voyage: null, // The first ship across the open sea, which ends the Nation era.
    voyageNoticed: false, // Whether the report has said the nation is ready for it.
    laws: { food: null, strangers: null, service: null, justice: null }, // null keeps to custom.
    lawChanged: {}, // Law to the turn it last changed.
    siege: null, // { raiders, supplies, started } while the Skarn besiege the village.
    heroes: [], // { id, name, deed, year }: people the village remembers for a great deed.
    lastHire: -99, // The turn a master was last hired.
    swordsUntil: -1, // Sell-swords guard the roads until this turn.
    guardsArmed: false, // Whether the guards were armed with goods this season.
    clans: { warriors: 0, quietUntil: -1, arrived: false }, // Hill clansmen who march with the Skarn, and how long gifts keep them home.
    eventHistory: {}, // Event id to the turn it last happened.
    knowledge: { learned: [], progress: {}, current: null, queue: [] },
    farm: { planted: 0, tended: 0 }, // Plots planted this year, and plots tended.
    neighbors: initialNeighbors(),
    deeds: emptyDeeds(), // What the camp has done: the root of traditions and reputation.
    traditions: [],
    advisors: { steward: 6, warChief: 7, healer: 4, scholar: 8, speaker: 9 }, // Fenna, Garrow, Dalia, Hesta, Iven
    pendingEvent: null,
    report: null,
    log: [],
    gameOver: false,
    milestoneReached: false,
  };
  state.report = {
    title: 'Spring, Year 1',
    urgent: [],
    events: [
      `Twelve survivors have made camp at ${state.campName}, in a sheltered forest valley beside a river.`,
      'They have one tent, a little food, and each other. Assign everyone a task, add something to the build queue, then end the season.',
      'They know only the riverbank and the oak woods nearby. Scouts can explore farther; the Map screen shows what you know.',
      'People set to study can make discoveries, like better tools or, one day, farming. See the Knowledge screen.',
    ],
    routine: [],
    orders: [],
  };
  return state;
}

// Brings a save from any earlier version up to the current one.
// Returns null if the data is not a usable save.
export function migrate(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.people) || !data.resources) return null;
  if (data.version === 1) {
    data.places = initialPlaces();
    for (const d of data.discoveries || []) {
      const placeId = V1_DISCOVERY_TO_PLACE[d];
      if (placeId) data.places[placeId].known = true;
    }
    delete data.discoveries;
    data.workSites = { hunt: 'camp', forage: 'camp', wood: 'camp', scout: 'camp' };
    data.orders = { ...DEFAULT_ORDERS };
    for (const p of data.people) p.orderReturn = null;
    if (data.report) data.report.orders = [];
    data.version = 2;
  }
  if (data.version === 2) {
    data.conditions = [];
    data.eventHistory = {};
    for (const p of data.people) p.sick = false;
    data.version = 3;
  }
  if (data.version === 3) {
    for (const p of data.people) {
      if (p.skills.learning === undefined) p.skills.learning = LEARNING_BY_NAME[p.name] ?? 1;
    }
    data.knowledge = { learned: [], progress: {}, current: null };
    data.farm = { planted: 0, tended: 0 };
    data.buildings.fields = 0;
    const taken = Object.values(data.advisors);
    const scholar = data.people.filter((p) => p.alive && !taken.includes(p.id))
      .sort((a, b) => b.skills.learning - a.skills.learning)[0];
    data.advisors.scholar = scholar ? scholar.id : null;
    data.version = 4;
  }
  if (data.version === 4) {
    for (const p of data.people) p.xp = {};
    data.version = 5;
  }
  if (data.version === 5) {
    for (const p of data.people) p.age = AGE_BY_NAME[p.name] ?? 30;
    data.version = 6;
  }
  if (data.version === 6) {
    // Dalia's starting age changed from 61 to 47.
    const dalia = data.people.find((p) => p.name === 'Dalia' && p.id === 4);
    if (dalia) {
      dalia.age = Math.max(47, dalia.age - 14);
      dalia.note = 'A seasoned herbalist with steady hands.';
    }
    data.version = 7;
  }
  if (data.version === 7) {
    // Dalia's starting age changed again, from 47 to 40.
    const dalia = data.people.find((p) => p.name === 'Dalia' && p.id === 4);
    if (dalia) dalia.age = Math.max(40, dalia.age - 7);
    data.version = 8;
  }
  if (data.version === 8) {
    data.buildQueue = data.project ? [{ id: data.project.id, progress: data.project.progress, paid: true }] : [];
    delete data.project;
    data.knowledge.queue = [];
    data.version = 9;
  }
  if (data.version === 9) {
    for (const id of PLACE_ORDER) {
      if (!data.places[id]) data.places[id] = { known: false, abundance: { hunt: 100, forage: 100 } };
    }
    data.neighbors = initialNeighbors();
    const taken = Object.values(data.advisors);
    const speaker = data.people.filter((p) => p.alive && p.age >= 16 && !taken.includes(p.id))
      .sort((a, b) => b.skills.learning - a.skills.learning)[0];
    data.advisors.speaker = speaker ? speaker.id : null;
    data.version = 10;
  }
  if (data.version === 10) {
    data.deeds = emptyDeeds();
    data.deeds.discoveries = data.knowledge.learned.length;
    data.deeds.built = Object.values(data.buildings).reduce((sum, n) => sum + n, 0);
    data.traditions = [];
    data.version = 11;
  }
  if (data.version === 11) {
    data.lastFeast = -99;
    data.orders.harvestFeast = false;
    if (data.deeds && data.deeds.feasts === undefined) data.deeds.feasts = 0;
    data.version = 12;
  }
  if (data.version === 12) {
    data.era = 'camp';
    data.villageFounded = null;
    data.priorities = { ...DEFAULT_PRIORITIES };
    data.settlersMet = 0;
    data.buildings.hut = 0;
    data.version = 13;
  }
  if (data.version === 13) {
    data.resources.stone = 0;
    data.resources.goods = 0;
    data.workSites.quarry = 'camp';
    data.priorities = { ...DEFAULT_PRIORITIES, ...(data.priorities || {}) };
    for (const id of PLACE_ORDER) {
      if (!data.places[id]) data.places[id] = { known: false, abundance: { hunt: 100, forage: 100 } };
    }
    for (const id of BUILDING_ORDER) if (data.buildings[id] === undefined) data.buildings[id] = 0;
    data.version = 14;
  }
  if (data.version === 14) {
    // Nations: a village save gets its nations at the start of its next season.
    data.skarnHost = null;
    data.version = 15;
  }
  if (data.version === 15) {
    data.settlements = [];
    data.version = 16;
  }
  if (data.version === 16) {
    data.laws = { food: null, strangers: null, service: null, justice: null };
    data.lawChanged = {};
    data.version = 17;
  }
  if (data.version === 17) {
    data.siege = null;
    data.version = 18;
  }
  if (data.version === 18) {
    data.heroes = [];
    data.version = 19;
  }
  if (data.version === 19) {
    data.orders.comforts = false;
    data.orders.armGuards = false;
    data.lastHire = -99;
    data.swordsUntil = -1;
    data.guardsArmed = false;
    data.buildings.shrine = 0;
    data.version = 20;
  }
  if (data.version === 20) {
    // Relations between the nations start where they would have.
    if (data.neighbors.skarn.nation && !data.valley) data.valley = { 'tellani|velari': 30, 'skarn|velari': -40, 'skarn|tellani': -20 };
    data.version = 21;
  }
  if (data.version === 21) {
    data.clans = { warriors: 0, quietUntil: -1, arrived: false };
    data.version = 22;
  }
  if (data.version === 22) {
    data.foodStores = DEFAULT_FOOD_STORES;
    data.version = 23;
  }
  if (data.version === 23) {
    for (const id of NEIGHBOR_ORDER) {
      Object.assign(data.neighbors[id], { peaceWarned: false, honoredUntil: -1, honorsInARow: 0, chief: null, chiefUntil: null });
    }
    data.version = 24;
  }
  if (data.version === 24) {
    data.foreignWorkOk = {};
    if (data.report && !data.report.routine) data.report.routine = [];
    data.version = 25;
  }
  if (data.version === 25) {
    data.feastStreak = 0;
    data.version = 26;
  }
  if (data.version === 26) {
    data.weather = 'clear';
    data.version = 27;
  }
  if (data.version === 27) {
    data.difficulty = 'easy'; // Games begun before difficulty play on as they did.
    data.version = 28;
  }
  if (data.version === 28) {
    // Settlements gain roles, governors with skills, and loyalty.
    for (const t of data.settlements || []) upgradeSettlement(data, t);
    data.capitalCounted = false;
    data.buildings.road = 0;
    data.version = 29;
  }
  if (data.version === 29) {
    // The world beyond the valley; in the Nation era, its nearest regions are known by name.
    data.world = initialWorld();
    if (data.era === 'nation') for (const id of REGIONS.valley.neighbors) data.world.regions[id].status = 'heard';
    data.resources.iron = 0;
    data.resources.salt = 0;
    data.version = 30;
  }
  if (data.version === 30) {
    // Coin, the great nations, and their homelands at the edge of the world.
    data.resources.coin = 0;
    data.great = initialGreat();
    const nation = data.era === 'nation';
    for (const id of Object.keys(data.great)) data.great[id].heard = nation;
    const fresh = initialWorld();
    for (const [id, r] of Object.entries(fresh.regions)) if (!data.world.regions[id]) data.world.regions[id] = r;
    for (const [id, p] of Object.entries(fresh.places)) if (!data.world.places[id]) data.world.places[id] = p;
    for (const [id, r] of Object.entries(REGIONS)) {
      if (data.world.regions[id].status !== 'explored') continue;
      for (const n of r.neighbors) if (data.world.regions[n].status === 'unknown') data.world.regions[n].status = 'heard';
    }
    data.nationFounded = nation ? Math.min(...(data.settlements || []).map((t) => t.founded), data.turn) : null;
    data.version = 31;
  }
  if (data.version === 31) {
    // Armies, wars, and horses.
    Object.assign(data, {
      armies: [], nextArmyId: 1, nextCompanyId: 1, wars: {}, warEnded: {}, tributes: [], lastHarm: {},
    });
    data.resources.horses = 0;
    if (data.great) {
      const fresh = initialGreat();
      for (const id of Object.keys(data.great)) data.great[id].strength = fresh[id].strength;
    }
    data.version = 32;
  }
  if (data.version === 32) {
    // The five other great nations, their homelands, and the voyage.
    const fresh = initialWorld();
    for (const [id, r] of Object.entries(fresh.regions)) if (!data.world.regions[id]) data.world.regions[id] = r;
    for (const [id, p] of Object.entries(fresh.places)) if (!data.world.places[id]) data.world.places[id] = p;
    for (const [id, r] of Object.entries(REGIONS)) {
      if (data.world.regions[id].status !== 'explored') continue;
      for (const n of r.neighbors) if (data.world.regions[n].status === 'unknown') data.world.regions[n].status = 'heard';
    }
    const great = initialGreat();
    for (const [id, g] of Object.entries(great)) {
      if (data.great[id]) continue;
      data.great[id] = g;
      const home = data.world.regions[GREAT_NATIONS[id].homeland];
      g.heard = home.status !== 'unknown';
    }
    data.voyage = null;
    data.voyageNoticed = false;
    data.version = 33;
  }
  if (data.version === 33) {
    // Settlers invited for coin, and the steward's order to invite them.
    data.orders.inviteReserve = null;
    data.lastInvite = null;
    data.invited = 0;
    data.version = 34;
  }
  if (data.version === 34) {
    // People moving out of the capital to the settlements, and the order to send them.
    data.orders.spreadAbove = null;
    data.movedOut = 0;
    data.version = 35;
  }
  if (data.version === 35) {
    // The great nations' feelings for each other, their wars, and their alliances.
    data.greatWorld = initialGreatWorld();
    data.version = 36;
  }
  return data.version === SAVE_VERSION ? data : null;
}

// A settlement from before roles: its policy becomes demands, its land's
// best work its role, and only its governor and masters keep their names.
function upgradeSettlement(data, t) {
  const b = PLACES[t.place].bonus || {};
  const best = [['mining', b.quarry || 0], ['timber', b.wood || 0], ['farming', Math.max(b.hunt || 0, b.forage || 0)]]
    .sort((x, y) => y[1] - x[1])[0];
  t.role = best[1] > 0 ? best[0] : 'farming';
  t.demands = { grow: 'light', supply: 'heavy' }[t.policy] || 'normal';
  delete t.policy;
  t.priorities = { defense: 'normal', learning: 'normal' };
  t.loyalty = 70;
  const people = t.people || [];
  const gov = people.find((p) => t.governor && p.id === t.governor.id)
    || { ...makePerson({ name: (t.governor && t.governor.name) || 'Governor', note: '', age: 40, skills: { hunting: 1, foraging: 2, building: 2, healing: 0, scouting: 1, learning: 2 } }, (t.governor && t.governor.id) || data.nextPersonId++) };
  t.governor = { ...gov, task: 'govern' };
  t.governorSince = t.founded;
  t.notables = people.filter((p) => p.id !== gov.id && Object.values(p.skills).some((v) => v >= 5)).map((p) => ({ ...p, task: 'settler' }));
  delete t.people;
  t.buildings = { homes: Math.ceil((t.population + 4) / 8), palisade: 0, stoneWall: 0, hall: 0, works: {} };
  t.project = null;
  t.lastAid = data.turn;
  t.harriedAt = null;
  t.keepUntil = null;
}

export function seasonIndex(state) {
  return state.turn % 4;
}

export function seasonName(state, offset = 0) {
  return SEASONS[(state.turn + offset) % 4];
}

export function year(state, offset = 0) {
  return Math.floor((state.turn + offset) / 4) + 1;
}

export function dateLabel(state, offset = 0) {
  return `${seasonName(state, offset)}, Year ${year(state, offset)}`;
}

export function living(state) {
  return state.people.filter((p) => p.alive);
}

export function personById(state, id) {
  return state.people.find((p) => p.id === id);
}

export function shelterCapacity(state) {
  return STARTING_SHELTER + state.buildings.leanTo * SHELTER_PER_LEAN_TO
    + (state.buildings.hut || 0) * SHELTER_PER_HUT;
}

// Whether the game has reached an era yet ('camp', 'village', ...).
export function eraAtLeast(state, era) {
  return ERAS.indexOf(state.era || 'camp') >= ERAS.indexOf(era);
}

export function inVillage(state) {
  return eraAtLeast(state, 'village');
}

// How much food the stores can hold. Food beyond this rots quickly.
export function storageCapacity(state) {
  const room = BASE_STORAGE + (state.buildings.storehouse || 0) * STORAGE_PER_STOREHOUSE
    + (state.buildings.granary || 0) * STORAGE_PER_GRANARY;
  return Math.round(room * (hasKnowledge(state, 'pottery') ? 1.5 : 1));
}

export function isKnown(state, placeId) {
  return Boolean(state.places[placeId] && state.places[placeId].known);
}

export function placeName(state, placeId) {
  return placeId === 'camp' ? state.campName : placeData(placeId).name;
}

// Whether expeditions have found a place beyond the valley with this
// feature (ore, salt, horses).
export function worldFound(state, feature) {
  const places = (state.world && state.world.places) || {};
  return Object.keys(places).some((id) => places[id].known && WORLD_PLACES[id][feature]);
}

export function knownPlaces(state) {
  return PLACE_ORDER.filter((id) => isKnown(state, id));
}

export function unexploredNeighbors(state, placeId) {
  return PLACES[placeId].neighbors.filter((n) => !isKnown(state, n));
}

export function metNeighbors(state) {
  return NEIGHBOR_ORDER.filter((id) => state.neighbors && state.neighbors[id].known);
}

// Whether a valley people is met and still a people of its own: not yet
// joined to your nation.
export function independent(state, id) {
  const n = state.neighbors && state.neighbors[id];
  return Boolean(n && n.known && !n.joined);
}

export function relationWord(value) {
  if (value >= 60) return 'close friends';
  if (value >= 25) return 'friendly';
  if (value >= -10) return 'neutral';
  if (value >= -40) return 'wary';
  return 'hostile';
}

// What a discovery costs now: a crown comes cheaper to a people led by a
// chieftain, an assembly to one led by a council of elders, and the Haldi's
// shipwrights teach what they know to a nation with an embassy among them.
export function knowledgeCost(state, id) {
  const k = KNOWLEDGE[id];
  let cost = k.cost;
  if ((id === 'crown' && hasKnowledge(state, 'chieftain')) || (id === 'assembly' && hasKnowledge(state, 'elders'))) cost = Math.round(cost * 2 / 3);
  if ((id === 'shipbuilding' || id === 'navigation') && state.great && state.great.haldi && state.great.haldi.embassy) cost = Math.round(cost * 2 / 3);
  return cost;
}

export function hasKnowledge(state, id) {
  return Boolean(state.knowledge && state.knowledge.learned.includes(id));
}

// Why a discovery cannot be studied yet, or null if it can.
// Why a discovery can never be made, because a choice closed it off; or null.
export function knowledgeClosed(state, id) {
  const chosen = (state.knowledge.learned || []).find((other) => (KNOWLEDGE[other].excludes || []).includes(id));
  return chosen ? `Your people chose ${KNOWLEDGE[chosen].name.toLowerCase()} instead.` : null;
}

export function knowledgeBlocker(state, id) {
  const k = KNOWLEDGE[id];
  if (hasKnowledge(state, id)) return 'Already known.';
  const closed = knowledgeClosed(state, id);
  if (closed) return closed;
  if (k.era && !eraAtLeast(state, k.era)) {
    return k.era === 'nation'
      ? 'Becomes possible in the Nation era, once your village founds a second settlement.'
      : 'Becomes possible once your camp is a village.';
  }
  const missing = (k.after || []).filter((a) => !hasKnowledge(state, a));
  if (missing.length) return `Needs ${missing.map((a) => KNOWLEDGE[a].name).join(' and ')} first.`;
  if (k.place && !isKnown(state, k.place)) return `Your people must find ${PLACES[k.place].name} first.`;
  if (k.needsBuilding && !(state.buildings[k.needsBuilding] > 0)) return `Needs a ${BUILDINGS[k.needsBuilding].name.toLowerCase()} first.`;
  if (k.needsFind && !worldFound(state, k.needsFind)) return `Your expeditions must find ${{ ore: 'iron ore', horses: 'the wild horse grounds', harbor: 'a place for a harbor' }[k.needsFind] || k.needsFind} first.`;
  if (k.needsResource && !(state.resources[k.needsResource] > 0)) return `Needs ${k.needsResource} in store first.`;
  return null;
}

// Whether the capital now counts its ordinary people instead of naming them.
export function capitalCounted(state) {
  return Boolean(state.capitalCounted);
}

export function taskAvailable(state, task) {
  const t = TASKS[task];
  return Boolean(t) && (!t.requires || hasKnowledge(state, t.requires)) && (!t.era || eraAtLeast(state, t.era));
}

export function availableTasks(state) {
  return TASK_ORDER.filter((t) => taskAvailable(state, t));
}

export function fieldPlots(state) {
  return (state.buildings.fields || 0) * PLOTS_PER_FIELD;
}

export function wolvesAt(state, placeId) {
  return (state.conditions || []).some((c) => c.id === 'wolves' && c.place === placeId);
}

// Food eaten each season: 2 per person, 1 for children under 12.
// Accepts a list of people, or a plain count of adults.
// The food the village council aims to keep in store: some seasons' worth
// at today's needs, never more than the stores can hold.
export function foodStoreTarget(state) {
  const room = storageCapacity(state);
  const choice = state.foodStores ?? DEFAULT_FOOD_STORES;
  if (choice === 'full') return room;
  return Math.min(room, choice * foodNeeded(living(state)));
}

// Whether the stores hold all the council aims to keep.
export function foodStocked(state) {
  return inVillage(state) && state.resources.food >= foodStoreTarget(state);
}

export function foodNeeded(people) {
  if (typeof people === 'number') return people * 2;
  return people.reduce((sum, p) => sum + (p.age < AGES.youth ? 1 : 2), 0);
}

// Shelter space needed: children under 12 take half a place.
export function shelterNeeded(people) {
  return people.reduce((sum, p) => sum + (p.age < AGES.youth ? 0.5 : 1), 0);
}

export function lifeStage(person) {
  if (person.age < AGES.child) return 'infant';
  if (person.age < AGES.youth) return 'child';
  if (person.age < AGES.adult) return 'youth';
  if (person.age < AGES.elder) return 'adult';
  return 'elder';
}

// The tasks this person can be given, given their age and what is known.
export function allowedTasksFor(state, person) {
  const stage = lifeStage(person);
  if (stage === 'infant') return ['rest'];
  const tasks = availableTasks(state);
  return stage === 'child' ? tasks.filter((t) => CHILD_TASKS.includes(t)) : tasks;
}

export function canFight(person) {
  return person.alive && person.age >= AGES.youth && person.health >= 40;
}

export function woodNeededForWarmth(seasonIdx, count, hardWinter = false) {
  if (seasonIdx === 3) return hardWinter ? Math.ceil(count * 1.5) : count;
  if (seasonIdx === 2) return Math.ceil(count / 2);
  return 0;
}

export function leanTimesNow(state) {
  return (state.conditions || []).filter((c) => LEAN_TIMES[c.id]);
}

// Whether an ongoing condition (a hard winter, a drought) is in force.
export function hasCondition(state, id) {
  return Boolean(state.conditions && state.conditions.some((c) => c.id === id));
}

export function spoilageRate(state) {
  let rate = state.buildings.storehouse > 0 ? 0.04 : 0.12;
  if (hasKnowledge(state, 'smoking')) rate *= 2 / 3;
  if (hasKnowledge(state, 'pottery')) rate *= 0.5;
  if (salting(state)) rate *= 0.5;
  return rate;
}

// Food packed in salt, while there is salt to pack it in.
export function salting(state) {
  return hasKnowledge(state, 'salting') && (state.resources.salt || 0) > 0;
}

// Salt the stores use each season: 1 for every 100 food.
export const FOOD_PER_SALT = 100;
export function saltNeeded(state) {
  return salting(state) ? Math.ceil(Math.max(0, state.resources.food) / FOOD_PER_SALT) : 0;
}

export function healthWord(health) {
  if (health >= 75) return 'healthy';
  if (health >= 40) return 'hurt';
  return 'badly hurt';
}

export function moraleWord(morale) {
  if (morale >= 70) return 'high spirits';
  if (morale >= 45) return 'steady';
  if (morale >= 25) return 'low spirits';
  return 'despairing';
}

export function abundanceWord(value) {
  if (value >= 70) return 'plentiful';
  if (value >= 40) return 'thinning';
  return 'scarce';
}

export function isBadlyHurt(person) {
  return person.alive && person.health < 40;
}
