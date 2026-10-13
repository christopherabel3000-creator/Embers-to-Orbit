// Static game data for the Survival era: seasons, tasks, buildings,
// the hand-crafted starting survivors, and discoveries.

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const SKILLS = ['hunting', 'foraging', 'building', 'healing', 'scouting'];

export const TASKS = {
  hunt: { name: 'Hunt', skill: 'hunting', description: 'Bring back meat. Risk of injury.' },
  forage: { name: 'Forage', skill: 'foraging', description: 'Gather plants and berries. Nothing to find in winter.' },
  wood: { name: 'Gather wood', skill: 'building', description: 'Collect wood for building and winter fires.' },
  build: { name: 'Build', skill: 'building', description: 'Work on the current building project.' },
  scout: { name: 'Scout', skill: 'scouting', description: 'Explore the land. May find useful places or people.' },
  heal: { name: 'Tend the hurt', skill: 'healing', description: 'Treat the injured and sick.' },
  rest: { name: 'Rest', skill: null, description: 'Recover health and spirits.' },
};

export const TASK_ORDER = ['hunt', 'forage', 'wood', 'build', 'scout', 'heal', 'rest'];

export const BUILDINGS = {
  leanTo: {
    name: 'Lean-to',
    cost: 15,
    work: 8,
    repeatable: true,
    description: 'Shelters 4 more people from the cold.',
  },
  storehouse: {
    name: 'Storehouse',
    cost: 25,
    work: 12,
    repeatable: false,
    description: 'Cuts food spoilage from 12 percent to 4 percent each season.',
  },
  healersHut: {
    name: "Healer's hut",
    cost: 15,
    work: 8,
    repeatable: false,
    description: 'Healing is half again as effective, and the hurt recover faster.',
  },
  watchtower: {
    name: 'Watchtower',
    cost: 20,
    work: 10,
    repeatable: false,
    description: 'Raiders are always spotted early, so defenders are ready.',
  },
  palisade: {
    name: 'Palisade',
    cost: 40,
    work: 20,
    repeatable: false,
    description: 'A wall of sharpened logs. Greatly strengthens defense against raids.',
  },
};

export const BUILDING_ORDER = ['leanTo', 'storehouse', 'healersHut', 'watchtower', 'palisade'];

// The tent the survivors arrive with.
export const STARTING_SHELTER = 4;
export const SHELTER_PER_LEAN_TO = 4;

// Hand-crafted founding survivors. Skills run from 0 to 5.
export const FOUNDERS = [
  { name: 'Aric', note: 'A quiet tracker who has hunted these woods before.', skills: { hunting: 4, foraging: 1, building: 1, healing: 0, scouting: 3 } },
  { name: 'Brenna', note: 'Knows every edible root and berry.', skills: { hunting: 0, foraging: 5, building: 1, healing: 2, scouting: 1 } },
  { name: 'Corvin', note: 'Broad-shouldered and good with an axe.', skills: { hunting: 2, foraging: 0, building: 4, healing: 0, scouting: 0 } },
  { name: 'Dalia', note: 'An old herbalist with steady hands.', skills: { hunting: 0, foraging: 2, building: 0, healing: 5, scouting: 0 } },
  { name: 'Esker', note: 'Restless and sharp-eyed, always over the next ridge.', skills: { hunting: 2, foraging: 1, building: 0, healing: 0, scouting: 4 } },
  { name: 'Fenna', note: 'A practical organizer who keeps count of everything.', skills: { hunting: 0, foraging: 3, building: 2, healing: 1, scouting: 1 } },
  { name: 'Garrow', note: 'A former soldier, scarred and fearless.', skills: { hunting: 3, foraging: 0, building: 2, healing: 0, scouting: 1 } },
  { name: 'Hesta', note: 'A carpenter who misses her old workshop.', skills: { hunting: 0, foraging: 1, building: 5, healing: 0, scouting: 0 } },
  { name: 'Iven', note: 'Young, eager, and good at a little of everything.', skills: { hunting: 1, foraging: 2, building: 1, healing: 1, scouting: 2 } },
  { name: 'Jora', note: 'A patient trapper.', skills: { hunting: 3, foraging: 2, building: 0, healing: 0, scouting: 1 } },
  { name: 'Kael', note: 'Strong but slow to trust anyone.', skills: { hunting: 1, foraging: 0, building: 3, healing: 0, scouting: 1 } },
  { name: 'Lisbet', note: 'Raised by a midwife, calm in a crisis.', skills: { hunting: 0, foraging: 2, building: 0, healing: 3, scouting: 0 } },
];

// People who may be found while scouting and invited to join.
export const WANDERERS = [
  { name: 'Maren', note: 'A lone fisher whose village was burned.', skills: { hunting: 2, foraging: 3, building: 1, healing: 0, scouting: 1 } },
  { name: 'Noll', note: 'A wandering woodcutter.', skills: { hunting: 1, foraging: 0, building: 4, healing: 0, scouting: 1 } },
  { name: 'Orla', note: 'A hunter traveling with her bow and little else.', skills: { hunting: 4, foraging: 1, building: 0, healing: 0, scouting: 2 } },
  { name: 'Pell', note: 'A runaway apprentice healer.', skills: { hunting: 0, foraging: 1, building: 1, healing: 3, scouting: 0 } },
  { name: 'Rhosyn', note: 'A guide who knows the hill paths.', skills: { hunting: 2, foraging: 1, building: 0, healing: 0, scouting: 4 } },
  { name: 'Senna', note: 'A forager with a basket and a quick laugh.', skills: { hunting: 0, foraging: 4, building: 1, healing: 1, scouting: 1 } },
  { name: 'Tobin', note: 'A builder of boats and fences.', skills: { hunting: 1, foraging: 0, building: 3, healing: 0, scouting: 1 } },
  { name: 'Ula', note: 'An old soldier who wants somewhere to belong.', skills: { hunting: 3, foraging: 0, building: 2, healing: 1, scouting: 1 } },
];

// The local map of the forest valley. Places are nodes connected to their
// neighbors. Bonuses are added to each worker's yield at that place.
// distance: 0 = camp, 1 = nearby, 2 = a day's walk, 3 = far.
export const PLACES = {
  camp: {
    name: 'Camp', distance: 0, neighbors: ['riverbank', 'oakWoods', 'meadow'],
    tasks: ['hunt', 'forage', 'wood'], bonus: {},
    description: 'Your camp, in a clearing beside the river.',
  },
  riverbank: {
    name: 'Riverbank', distance: 1, neighbors: ['camp', 'berryThicket'],
    tasks: ['hunt', 'forage'], bonus: { hunt: 1, forage: 1 },
    description: 'Reeds, shallows, and waterfowl. Some hunting and foraging.',
  },
  oakWoods: {
    name: 'Oak woods', distance: 1, neighbors: ['camp', 'deerTrails', 'deadfall'],
    tasks: ['forage', 'wood'], bonus: { forage: 1, wood: 1 },
    description: 'Old oaks with acorns, mushrooms, and good timber.',
  },
  meadow: {
    name: 'North meadow', distance: 1, neighbors: ['camp', 'herbHillside', 'abandonedCamp'],
    tasks: ['forage'], bonus: { forage: 2 },
    found: 'an open meadow full of wild greens and roots. Good foraging outside of winter.',
    description: 'Open grassland, rich with greens and roots outside of winter.',
  },
  deerTrails: {
    name: 'Deer trails', distance: 2, neighbors: ['oakWoods', 'raiderTrail'],
    tasks: ['hunt'], bonus: { hunt: 3 },
    found: 'well-worn deer trails. Hunters will do much better there.',
    description: 'Game trails where deer pass in numbers. The best hunting nearby.',
  },
  deadfall: {
    name: 'Storm deadfall', distance: 2, neighbors: ['oakWoods'],
    tasks: ['wood'], bonus: { wood: 3 },
    found: 'a stretch of storm-felled trees. Woodcutters will gather far more there.',
    description: 'A swath of trees knocked flat by an old storm. Easy wood.',
  },
  berryThicket: {
    name: 'Berry thicket', distance: 2, neighbors: ['riverbank', 'beaverPonds'],
    tasks: ['forage'], bonus: { forage: 3 },
    found: 'a huge berry thicket along a stream. The richest foraging nearby, outside of winter.',
    description: 'Brambles heavy with berries in summer and autumn.',
  },
  herbHillside: {
    name: 'Herb hillside', distance: 2, neighbors: ['meadow'],
    tasks: [], bonus: {},
    found: 'a hillside of medicinal herbs. From now on, healing is more effective.',
    description: 'Medicinal herbs grow here. Knowing this place makes healing more effective.',
  },
  abandonedCamp: {
    name: 'Abandoned camp', distance: 2, neighbors: ['meadow'],
    tasks: [], bonus: {},
    found: 'an abandoned camp, and brought back 15 food and 10 wood.',
    description: 'The cold remains of someone else\'s camp. Already searched.',
  },
  beaverPonds: {
    name: 'Beaver ponds', distance: 3, neighbors: ['berryThicket'],
    tasks: ['hunt', 'forage'], bonus: { hunt: 2, forage: 2 },
    found: 'a chain of beaver ponds full of game and plants. It is far, so work there goes a little slower.',
    description: 'Ponds full of fish, fowl, and plants. Far from camp.',
  },
  raiderTrail: {
    name: 'Raider trail', distance: 3, neighbors: ['deerTrails'],
    tasks: [], bonus: {},
    found: 'a trail used by raiders. From now on, you will always see raiders coming.',
    description: 'A trail the raiders use. Watching it means raiders never catch you by surprise.',
  },
};

export const PLACE_ORDER = Object.keys(PLACES);
export const STARTING_PLACES = ['camp', 'riverbank', 'oakWoods'];

// Version 1 saves recorded discoveries instead of places.
export const V1_DISCOVERY_TO_PLACE = {
  huntingGrounds: 'deerTrails', berryThicket: 'berryThicket', deadfall: 'deadfall',
  abandonedCamp: 'abandonedCamp', raiderTracks: 'raiderTrail', herbGarden: 'herbHillside',
};

export const MILESTONE_POPULATION = 20;
