// Static game data for the Survival era: seasons, tasks, buildings,
// the hand-crafted starting survivors, and discoveries.

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

export const SKILLS = ['hunting', 'foraging', 'building', 'healing', 'scouting', 'learning'];

export const TASKS = {
  hunt: { name: 'Hunt', skill: 'hunting', description: 'Bring back meat. Risk of injury.' },
  forage: { name: 'Forage', skill: 'foraging', description: 'Gather plants and berries. Nothing to find in winter.' },
  wood: { name: 'Gather wood', skill: 'building', description: 'Collect wood for building and winter fires.' },
  build: { name: 'Build', skill: 'building', description: 'Work on the current building project.' },
  scout: { name: 'Scout', skill: 'scouting', description: 'Explore the land. May find useful places or people.' },
  heal: { name: 'Tend the hurt', skill: 'healing', description: 'Treat the injured and sick.' },
  study: { name: 'Study', skill: 'learning', description: 'Experiment and share what people know, to make new discoveries.' },
  farm: { name: 'Farm', skill: 'foraging', description: 'Plant in spring, tend in summer, harvest in autumn. Needs fields. Nothing to do in winter.', requires: 'farming' },
  quarry: { name: 'Quarry', skill: 'building', description: 'Cut stone for the strongest buildings.', requires: 'stonecutting' },
  craft: { name: 'Craft', skill: 'building', description: 'Make goods: cloth, baskets, tools, and pots, for trade, gifts, and fine buildings.', requires: 'weaving' },
  guard: { name: 'Guard', skill: 'hunting', description: 'Train with weapons and watch the paths. Guards fight harder, spot raiders early, and keep some away.', era: 'village' },
  rest: { name: 'Rest', skill: null, description: 'Recover health and spirits.' },
};

export const TASK_ORDER = ['hunt', 'forage', 'farm', 'wood', 'quarry', 'craft', 'build', 'scout', 'guard', 'heal', 'study', 'rest'];

export const BUILDINGS = {
  leanTo: {
    name: 'Lean-to',
    cost: 15,
    work: 8,
    repeatable: true,
    description: 'Shelters 4 more people from the cold.',
  },
  hut: {
    name: 'Hut',
    cost: 30,
    work: 14,
    repeatable: true,
    era: 'village',
    description: 'A sturdy hut of logs and thatch that shelters 8 people.',
  },
  granary: {
    name: 'Granary',
    cost: 20,
    stone: 40,
    work: 20,
    repeatable: true,
    max: 2,
    requires: 'masonry',
    description: 'A raised stone granary with room to store 300 more food.',
  },
  pasture: {
    name: 'Pasture',
    cost: 30,
    work: 12,
    repeatable: true,
    max: 3,
    requires: 'husbandry',
    description: 'A fenced pasture for goats and cattle. Gives 6 food every season, even in winter.',
  },
  workshop: {
    name: 'Workshop',
    cost: 30,
    stone: 15,
    work: 16,
    repeatable: false,
    requires: 'weaving',
    description: 'Benches, looms, and tools in one place. Every crafter makes 1 more goods each season.',
  },
  market: {
    name: 'Market',
    cost: 30,
    stone: 30,
    goods: 20,
    work: 20,
    repeatable: false,
    requires: 'markets',
    description: 'A market square where neighbors come to trade. Every trade brings half again as much, and all your neighbors will buy goods.',
  },
  meetingHall: {
    name: 'Meeting hall',
    cost: 40,
    stone: 40,
    goods: 20,
    work: 24,
    repeatable: false,
    requires: 'oralLaw',
    description: 'A great hall where the village gathers and the council meets. Spirits settle higher, and quarrels are rarer.',
  },
  shrine: {
    name: 'Shrine',
    cost: 30,
    stone: 30,
    goods: 30,
    work: 20,
    repeatable: false,
    requires: 'oralLaw',
    description: 'A shrine to the old powers, hung with offerings. Spirits settle 2 higher, fever takes hold less often, and deaths weigh less on the village.',
  },
  stoneWall: {
    name: 'Stone wall',
    cost: 20,
    stone: 80,
    work: 30,
    repeatable: false,
    requires: 'masonry',
    needsBuilding: 'palisade',
    description: 'Stone raised behind the palisade. Defenders who hold take even less harm and strike harder.',
  },
  storehouse: {
    name: 'Storehouse',
    cost: 25,
    work: 12,
    repeatable: true,
    max: 3,
    description: 'Room to store 150 more food. Your first storehouse also cuts spoilage from 12 percent to 4 percent each season.',
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
  fields: {
    name: 'Field',
    cost: 15,
    work: 10,
    repeatable: true,
    requires: 'farming',
    description: 'Cleared, dug ground with room for 6 plots of grain.',
  },
};

export const BUILDING_ORDER = ['leanTo', 'hut', 'fields', 'pasture', 'storehouse', 'granary', 'healersHut', 'workshop', 'market', 'meetingHall', 'shrine', 'watchtower', 'palisade', 'stoneWall'];

export const PLOTS_PER_FIELD = 6;

// The tent the survivors arrive with.
export const STARTING_SHELTER = 4;

// How much food the camp can store. Food beyond this rots quickly.
export const BASE_STORAGE = 100; // Baskets, pits, and smoking racks.
export const STORAGE_PER_STOREHOUSE = 150;
export const STORAGE_PER_GRANARY = 300;
export const OVERFLOW_ROT = 0.5; // Share of the food beyond the room that rots each season.

// Lean times: conditions that make a season harder, so a reserve of food
// and wood matters. Each lasts a set number of seasons.
export const LEAN_TIMES = {
  hardWinter: {
    name: 'A hard winter',
    effect: 'The fires burn half again as much wood, and hunting is poor.',
    ends: 'The hard winter has broken.',
  },
  drought: {
    name: 'Drought',
    effect: 'Foraging brings in less, and the harvest will be smaller.',
    ends: 'Rain has come at last. The drought is over.',
  },
};

export const SHELTER_PER_LEAN_TO = 4;
export const SHELTER_PER_HUT = 8;

// Hand-crafted founding survivors. Skills run from 0 to 5.
export const AGE_BY_NAME = { Aric: 34, Brenna: 29, Corvin: 31, Dalia: 40, Esker: 22, Fenna: 38, Garrow: 45, Hesta: 36, Iven: 17, Jora: 27, Kael: 33, Lisbet: 24, Maren: 40, Noll: 35, Orla: 26, Pell: 19, Rhosyn: 30, Senna: 25, Tobin: 44, Ula: 58 };
export const LEARNING_BY_NAME = { Aric: 1, Brenna: 2, Corvin: 0, Dalia: 4, Esker: 2, Fenna: 3, Garrow: 1, Hesta: 3, Iven: 3, Jora: 1, Kael: 0, Lisbet: 2, Maren: 1, Noll: 1, Orla: 0, Pell: 3, Rhosyn: 2, Senna: 1, Tobin: 2, Ula: 1 };
export const FOUNDERS = [
  { name: 'Aric', age: 34, note: 'A quiet tracker who has hunted these woods before.', skills: { hunting: 4, foraging: 1, building: 1, healing: 0, scouting: 3, learning: 1 } },
  { name: 'Brenna', age: 29, note: 'Knows every edible root and berry.', skills: { hunting: 0, foraging: 5, building: 1, healing: 2, scouting: 1, learning: 2 } },
  { name: 'Corvin', age: 31, note: 'Broad-shouldered and good with an axe.', skills: { hunting: 2, foraging: 0, building: 4, healing: 0, scouting: 0, learning: 0 } },
  { name: 'Dalia', age: 40, note: 'A seasoned herbalist with steady hands.', skills: { hunting: 0, foraging: 2, building: 0, healing: 5, scouting: 0, learning: 4 } },
  { name: 'Esker', age: 22, note: 'Restless and sharp-eyed, always over the next ridge.', skills: { hunting: 2, foraging: 1, building: 0, healing: 0, scouting: 4, learning: 2 } },
  { name: 'Fenna', age: 38, note: 'A practical organizer who keeps count of everything.', skills: { hunting: 0, foraging: 3, building: 2, healing: 1, scouting: 1, learning: 3 } },
  { name: 'Garrow', age: 45, note: 'A former soldier, scarred and fearless.', skills: { hunting: 3, foraging: 0, building: 2, healing: 0, scouting: 1, learning: 1 } },
  { name: 'Hesta', age: 36, note: 'A carpenter who misses her old workshop.', skills: { hunting: 0, foraging: 1, building: 5, healing: 0, scouting: 0, learning: 3 } },
  { name: 'Iven', age: 17, note: 'Young, eager, and good at a little of everything.', skills: { hunting: 1, foraging: 2, building: 1, healing: 1, scouting: 2, learning: 3 } },
  { name: 'Jora', age: 27, note: 'A patient trapper.', skills: { hunting: 3, foraging: 2, building: 0, healing: 0, scouting: 1, learning: 1 } },
  { name: 'Kael', age: 33, note: 'Strong but slow to trust anyone.', skills: { hunting: 1, foraging: 0, building: 3, healing: 0, scouting: 1, learning: 0 } },
  { name: 'Lisbet', age: 24, note: 'Raised by a midwife, calm in a crisis.', skills: { hunting: 0, foraging: 2, building: 0, healing: 3, scouting: 0, learning: 2 } },
];

// People who may be found while scouting and invited to join.
export const WANDERERS = [
  { name: 'Maren', age: 40, note: 'A lone fisher whose village was burned.', skills: { hunting: 2, foraging: 3, building: 1, healing: 0, scouting: 1, learning: 1 } },
  { name: 'Noll', age: 35, note: 'A wandering woodcutter.', skills: { hunting: 1, foraging: 0, building: 4, healing: 0, scouting: 1, learning: 1 } },
  { name: 'Orla', age: 26, note: 'A hunter traveling with her bow and little else.', skills: { hunting: 4, foraging: 1, building: 0, healing: 0, scouting: 2, learning: 0 } },
  { name: 'Pell', age: 19, note: 'A runaway apprentice healer.', skills: { hunting: 0, foraging: 1, building: 1, healing: 3, scouting: 0, learning: 3 } },
  { name: 'Rhosyn', age: 30, note: 'A guide who knows the hill paths.', skills: { hunting: 2, foraging: 1, building: 0, healing: 0, scouting: 4, learning: 2 } },
  { name: 'Senna', age: 25, note: 'A forager with a basket and a quick laugh.', skills: { hunting: 0, foraging: 4, building: 1, healing: 1, scouting: 1, learning: 1 } },
  { name: 'Tobin', age: 44, note: 'A builder of boats and fences.', skills: { hunting: 1, foraging: 0, building: 3, healing: 0, scouting: 1, learning: 2 } },
  { name: 'Ula', age: 58, note: 'An old soldier who wants somewhere to belong.', skills: { hunting: 3, foraging: 0, building: 2, healing: 1, scouting: 1, learning: 1 } },
];

// The local map of the forest valley. Places are nodes connected to their
// neighbors. Bonuses are added to each worker's yield at that place.
// distance: 0 = camp, 1 = nearby, 2 = a day's walk, 3 = far.
export const PLACES = {
  camp: {
    name: 'Camp', distance: 0, neighbors: ['riverbank', 'oakWoods', 'meadow'],
    tasks: ['hunt', 'forage', 'wood', 'quarry'], bonus: { quarry: -1 },
    description: 'Your camp, in a clearing beside the river. Loose stones lie about.',
  },
  riverbank: {
    name: 'Riverbank', distance: 1, neighbors: ['camp', 'berryThicket'],
    tasks: ['hunt', 'forage', 'quarry'], bonus: { hunt: 1, forage: 1 },
    description: 'Reeds, shallows, and waterfowl. Some hunting and foraging, and river stones for the taking.',
  },
  oakWoods: {
    name: 'Oak woods', distance: 1, neighbors: ['camp', 'deerTrails', 'deadfall'],
    tasks: ['forage', 'wood'], bonus: { forage: 1, wood: 1 },
    description: 'Old oaks with acorns, mushrooms, and good timber.',
  },
  meadow: {
    name: 'North meadow', distance: 1, neighbors: ['camp', 'herbHillside', 'abandonedCamp', 'velariFields'],
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
    name: 'Storm deadfall', distance: 2, neighbors: ['oakWoods', 'greyCliffs'],
    tasks: ['wood'], bonus: { wood: 3 },
    found: 'a stretch of storm-felled trees. Woodcutters will gather far more there.',
    description: 'A swath of trees knocked flat by an old storm. Easy wood.',
  },
  greyCliffs: {
    name: 'Grey cliffs', distance: 3, neighbors: ['deadfall'],
    tasks: ['quarry'], bonus: { quarry: 3 },
    found: 'grey cliffs of good, splitting stone. Quarriers will cut far more there.',
    description: 'Sheer grey rock above the deadfall, easy to split into blocks.',
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
    name: 'Beaver ponds', distance: 3, neighbors: ['berryThicket', 'telnLanding'],
    tasks: ['hunt', 'forage'], bonus: { hunt: 2, forage: 2 },
    found: 'a chain of beaver ponds full of game and plants. It is far, so work there goes a little slower.',
    description: 'Ponds full of fish, fowl, and plants. Far from camp.',
  },
  raiderTrail: {
    name: 'Raider trail', distance: 3, neighbors: ['deerTrails', 'skarnHold'],
    tasks: [], bonus: {},
    found: 'a trail used by raiders. From now on, you will always see raiders coming.',
    description: 'A trail the raiders use. Watching it means raiders never catch you by surprise.',
  },
  velariFields: {
    name: 'Velari fields', distance: 3, neighbors: ['meadow'], people: 'velari',
    tasks: [], bonus: {},
    found: 'terraced fields of grain in the eastern hills, and the round houses of the people who tend them. They call themselves the Velari.',
    description: 'Terraced grain fields and round houses in the eastern hills. Home of the Velari.',
  },
  telnLanding: {
    name: 'Teln landing', distance: 3, neighbors: ['beaverPonds'], people: 'tellani',
    tasks: [], bonus: {},
    found: 'a busy river landing where boats come and go. The people here call themselves the Tellani.',
    description: 'A river landing downstream, crowded with boats. Home port of the Tellani traders.',
  },
  skarnHold: {
    name: 'Skarn hold', distance: 4, neighbors: ['raiderTrail'], people: 'skarn',
    tasks: [], bonus: {},
    found: 'a fortified hilltop camp at the end of the raider trail. This is where the raiders live. They call themselves the Skarn.',
    description: 'A fortified camp on a rocky hilltop at the end of the raider trail. Home of the Skarn.',
  },
};

export const PLACE_ORDER = Object.keys(PLACES);
export const STARTING_PLACES = ['camp', 'riverbank', 'oakWoods'];

// Version 1 saves recorded discoveries instead of places.
export const V1_DISCOVERY_TO_PLACE = {
  huntingGrounds: 'deerTrails', berryThicket: 'berryThicket', deadfall: 'deadfall',
  abandonedCamp: 'abandonedCamp', raiderTracks: 'raiderTrail', herbGarden: 'herbHillside',
};

export const MILESTONE_POPULATION = 16;

// The first knowledge tree. Cost is in study points. Each discovery can
// need earlier discoveries (after) and a known place (place).
export const KNOWLEDGE = {
  spears: {
    branch: 'war',
    name: 'Fire-hardened spears',
    cost: 15,
    effect: 'Hunters bring back 1 more food each, and defenders fight harder against raiders.',
  },
  smoking: {
    branch: 'food',
    name: 'Smoking and drying',
    cost: 15,
    effect: 'Smoked meat and dried berries keep longer. Food spoils a third less.',
  },
  stoneTools: {
    branch: 'building',
    name: 'Stone tools',
    cost: 20,
    effect: 'Builders get 1 more work done each, and woodcutters gather 1 more wood each.',
  },
  clothing: {
    branch: 'crafts',
    name: 'Warm clothing',
    cost: 15,
    effect: 'Furs and hides stitched into warm clothes. Cold and exposure do much less harm.',
  },
  medicine: {
    branch: 'society',
    name: 'Herbal medicine',
    cost: 20,
    place: 'herbHillside',
    effect: 'Healing is a fifth more effective, and the sick recover from fever faster.',
  },
  pottery: {
    branch: 'crafts',
    name: 'Pottery',
    cost: 25,
    after: ['smoking'],
    effect: 'Sealed clay jars keep out damp and mice. Food spoils half as much again, and mice can no longer get into the stores.',
  },
  farming: {
    branch: 'food',
    name: 'Farming',
    cost: 35,
    after: ['stoneTools'],
    place: 'meadow',
    effect: 'Wild grain from the North meadow can be planted. Unlocks fields and the Farm task. Plant in spring, tend in summer, harvest in autumn.',
  },

  // ----- The Settlement era: discoveries a village can make -----
  husbandry: {
    branch: 'food', era: 'village',
    name: 'Animal husbandry',
    cost: 50,
    after: ['farming'],
    effect: 'Goats and cattle, penned and bred. Unlocks pastures, which give food every season, even in winter.',
  },
  irrigation: {
    branch: 'food', era: 'village',
    name: 'Irrigation',
    cost: 60,
    after: ['farming', 'stonecutting'],
    effect: 'Stone-lined ditches carry river water to the fields. Every plot yields 2 more food, and drought hurts the harvest half as much.',
  },
  stonecutting: {
    branch: 'building', era: 'village',
    name: 'Stonecutting',
    cost: 40,
    after: ['stoneTools'],
    effect: 'Splitting and shaping stone. Unlocks the Quarry task. Stone is needed for the strongest buildings.',
  },
  masonry: {
    branch: 'building', era: 'village',
    name: 'Masonry',
    cost: 60,
    after: ['stonecutting'],
    effect: 'Building with fitted stone. Unlocks granaries and a stone wall.',
  },
  weaving: {
    branch: 'crafts', era: 'village',
    name: 'Weaving',
    cost: 40,
    after: ['clothing'],
    effect: 'Looms, cloth, and baskets. Unlocks the Craft task and the workshop. The Tellani will trade for your goods.',
  },
  kilns: {
    branch: 'crafts', era: 'village',
    name: 'Kilns',
    cost: 50,
    after: ['weaving', 'pottery'],
    effect: 'Fired pots and glazed ware. Every crafter makes 1 more goods each season.',
  },
  markets: {
    branch: 'crafts', era: 'village',
    name: 'Markets',
    cost: 60,
    after: ['weaving'],
    effect: 'Weights, measures, and a market day. Unlocks the market.',
  },
  bows: {
    branch: 'war', era: 'village',
    name: 'Bows',
    cost: 40,
    after: ['spears'],
    effect: 'Hunters bring back 1 more food each, and every fighter strikes harder.',
  },
  drill: {
    branch: 'war', era: 'village',
    name: 'Shields and drill',
    cost: 50,
    after: ['bows'],
    effect: 'Guards train together with shields. Guards fight half again as hard, instead of a quarter.',
  },
  oralLaw: {
    branch: 'society', era: 'village',
    name: 'Oral law',
    cost: 40,
    effect: 'The village keeps its customs by speaking them aloud. Unlocks the meeting hall, and a choice of who leads.',
  },
  elders: {
    branch: 'society', era: 'village',
    name: 'Council of elders',
    cost: 50,
    after: ['oralLaw'],
    excludes: ['chieftain'],
    effect: 'The wise lead together. Every scholar adds 1 more study point, and settlers come more often. Choosing this closes off a chieftain.',
  },
  chieftain: {
    branch: 'society', era: 'village',
    name: 'Chieftain',
    cost: 50,
    after: ['oralLaw'],
    excludes: ['elders'],
    effect: 'One strong leader speaks for all. Guards fight harder still, and raiders come less often. Choosing this closes off a council of elders.',
  },
};

// The branches of the research tree.
export const BRANCHES = {
  food: 'Food and farming',
  building: 'Building and stone',
  crafts: 'Crafts and trade',
  war: 'War and defense',
  society: 'Society and healing',
};

export const KNOWLEDGE_ORDER = Object.keys(KNOWLEDGE);

// Life stages, by age in years.
export const AGES = {
  child: 5, // Old enough to help with light work.
  youth: 12, // Old enough for any work, and to defend the camp.
  adult: 16,
  elder: 55, // Strength begins to fade.
  oldAgeDeaths: 60, // From here, each year brings a chance of dying peacefully.
};

// Light work that children from 5 to 11 can do.
export const CHILD_TASKS = ['forage', 'farm', 'study', 'rest'];

// Names for children born in the camp.
export const BABY_NAMES = [
  'Wren', 'Alder', 'Bryony', 'Cass', 'Dell', 'Ember', 'Finch', 'Garnet', 'Hale', 'Ivy',
  'Juniper', 'Kestrel', 'Linden', 'Moss', 'Nell', 'Oakley', 'Pip', 'Quill', 'Rowan', 'Sage',
  'Tamsin', 'Umber', 'Vale', 'Willow', 'Yarrow', 'Ash', 'Bram', 'Clover', 'Dara', 'Elm',
  'Fern', 'Gale', 'Heath', 'Isla', 'Jasper', 'Kit', 'Lark', 'Merle', 'Nim', 'Ora',
  'Perrin', 'Reed', 'Sorrel', 'Tarn', 'Ulla', 'Vesper', 'Wynn', 'Zephyr', 'Briar', 'Cedar',
];

// ----- The Settlement era -----

// The eras in order. A camp becomes a village by the player's choice.
export const ERAS = ['camp', 'village', 'nation'];
export const ERA_NAMES = { camp: 'the Survival era', village: 'the Settlement era', nation: 'the Nation era' };

// What the player can push the council toward in a village.
export const PRIORITY_AREAS = {
  building: { name: 'Building', about: 'How many people the council puts on the build queue.' },
  learning: { name: 'Learning', about: 'How many people study, while a discovery is chosen.' },
  defense: { name: 'Defense', about: 'How many people train and stand watch as guards.' },
  exploration: { name: 'Exploration', about: 'How many people scout, while there is anything left to find.' },
  crafts: { name: 'Crafts', about: 'How many people make goods, once your people can weave.' },
};
export const PRIORITY_LEVELS = ['low', 'normal', 'high'];

// How much food the council keeps in store before it stops growing more and
// sends spare hands to building and crafts: seasons of food, or 'full' for
// as much as the stores hold.
export const FOOD_STORE_CHOICES = [4, 6, 8, 12, 'full'];
export const DEFAULT_FOOD_STORES = 8;

// How each valley people grows into a nation once your camp is a village.
// growth: share added to their population each spring. warriors: share of
// their people under arms. expansion: the places they claim, in order.
export const NATIONS = {
  velari: {
    start: (y) => 30 + 2 * y, growth: 0.05, warriors: 0.12,
    expansion: ['herbHillside', 'abandonedCamp', 'meadow'],
  },
  tellani: {
    start: (y) => 24 + y, growth: 0.04, warriors: 0.1,
    expansion: ['beaverPonds', 'berryThicket', 'riverbank'],
  },
  skarn: {
    start: (y) => 40 + 3 * y, growth: 0.08, warriors: 0.45,
    expansion: ['raiderTrail', 'deerTrails', 'oakWoods'],
  },
};

// Laws a village can adopt once it knows Oral law. Each law has two
// options; with neither chosen, the village keeps to custom (no effect).
export const LAWS = {
  food: {
    name: 'Sharing food',
    options: {
      equal: { name: 'Equal shares', effect: 'Everyone eats the same. Spirits settle 5 higher.' },
      byWork: { name: 'By work', effect: 'Those who work hardest eat best. Everyone works 5 percent better, but spirits settle 5 lower.' },
    },
  },
  strangers: {
    name: 'Strangers',
    options: {
      open: { name: 'Open gates', effect: 'All may come. Settlers arrive more often, but fever takes hold more easily. The Velari approve.' },
      closed: { name: 'Closed gates', effect: 'Strangers are turned away. No settlers come, but the village is close-knit: spirits settle 3 higher, fever takes hold far less often, and Skarn skirmishers find it much harder to surprise you. The Velari and Tellani think you cold.' },
    },
  },
  service: {
    name: 'Service',
    options: {
      militia: { name: 'Militia', effect: 'Every adult drills with weapons. All fighters strike 15 percent harder, but everyone works 3 percent less.' },
      guilds: { name: 'Guilds', effect: 'Crafts are taught and guarded. Crafters make 1 more goods and builders do 1 more work, but everyone but the guards fights 10 percent weaker.' },
    },
  },
  justice: {
    name: 'Justice',
    options: {
      mercy: { name: 'Mercy', effect: 'Wrongs are forgiven where they can be. The Velari approve; the Skarn see softness.' },
      harsh: { name: 'Harsh law', effect: 'Wrongs are punished hard. Quarrels are far rarer and the Skarn respect you, but spirits settle 3 lower and the Velari disapprove.' },
    },
  },
};
export const LAW_ORDER = Object.keys(LAWS);
export const LAW_CHANGE_GAP = 4; // Seasons before the same law can change again.

// Treaties a village can make with a nation.
export const TREATIES = {
  trade: {
    name: 'Trade pact', phrase: 'a trade pact', with: ['velari', 'tellani'], relation: 20, trust: 40,
    effect: 'Every trade with them brings a quarter more, and both peoples grow warmer toward each other.',
  },
  openLands: {
    name: 'Open lands', phrase: 'an open lands pact', with: ['velari', 'tellani'], relation: 15, trust: 30,
    effect: 'Each people may hunt, gather, and cut wood on the other\'s land without offense.',
  },
  alliance: {
    name: 'Alliance', phrase: 'an alliance', with: ['velari', 'tellani'], relation: 50, trust: 60,
    effect: 'They send warriors to stand with you when raiders come. In return they will call on you when the Skarn attack them.',
  },
};
export const TREATY_ORDER = Object.keys(TREATIES);

// Names for settlers drawn to the village from beyond the valley.
export const SETTLER_NAMES = [
  'Ansel', 'Brisa', 'Calder', 'Doran', 'Edda', 'Fallon', 'Gideon', 'Halla', 'Idris', 'Jessamy',
  'Korin', 'Lyra', 'Madoc', 'Neve', 'Osric', 'Petra', 'Quinlan', 'Runa', 'Soren', 'Thea',
  'Ulric', 'Vida', 'Wystan', 'Yselde', 'Aldo', 'Bethan', 'Cormac', 'Delphine', 'Eamon', 'Freya',
  'Gareth', 'Hild', 'Ione', 'Jorah', 'Kenna', 'Lorcan', 'Maeve', 'Niall', 'Odette', 'Piers',
  'Rhea', 'Stellan', 'Tova', 'Uma', 'Viggo', 'Wilda', 'Yorick', 'Zora', 'Bastian', 'Cerys',
];
export const SETTLER_NOTES = [
  'A farmer whose village flooded, looking for steadier ground.',
  'A traveling woodworker who liked what she heard of the village.',
  'A young hunter tired of wandering alone.',
  'A herb-gatherer who followed the smoke of your fires.',
  'A former trader who wants to put down roots.',
  'A quiet laborer who works from dawn to dusk.',
  'A storyteller who has walked half the world.',
  'A runaway from a harsh chieftain beyond the hills.',
];

// The peoples of the forest valley. Relations run from -100 to 100 and
// drift slowly toward each people's own temperament (baseline).
export const NEIGHBORS = {
  velari: {
    name: 'the Velari',
    title: 'Velari',
    home: 'velariFields',
    temperament: 'peaceful farmers',
    description: 'Patient hill farmers who have worked their terraces for generations. Slow to trust, but loyal once won over. They have more grain than wood.',
    baseline: 10,
    giftValue: 6, // Relation gained per gift.
    trades: { woodForFood: 14, goodsForFood: 25 }, // Give 20 wood (or 10 goods) for this much food, before relations.
    wants: 'wood',
    offers: 'food',
  },
  tellani: {
    name: 'the Tellani',
    title: 'Tellani',
    home: 'telnLanding',
    temperament: 'river traders',
    description: 'Boat people who trade up and down the river. They care about a fair deal more than friendship, and they give the best prices.',
    baseline: 5,
    giftValue: 4,
    trades: { woodForFood: 16, foodForWood: 22, goodsForFood: 30, goodsForWood: 25 },
    wants: 'food and wood',
    offers: 'food and wood',
  },
  skarn: {
    name: 'the Skarn',
    title: 'Skarn',
    home: 'skarnHold',
    temperament: 'raiders',
    description: 'A hard people from the rocky hills who take what they need. They respect strength, and they can be bought off, for a while.',
    baseline: -30,
    giftValue: 3,
    trades: {},
    wants: 'food',
    offers: 'nothing but peace',
  },
};

export const NEIGHBOR_ORDER = Object.keys(NEIGHBORS);

// Young people from friendly neighbors who may ask to join the camp.
export const NEIGHBOR_RECRUITS = {
  velari: [
    { name: 'Tamar', note: 'A Velari farmer\'s daughter who wants to see more of the world.', skills: { hunting: 0, foraging: 3, building: 1, healing: 1, scouting: 1, learning: 2 } },
    { name: 'Odo', note: 'A quiet Velari terrace builder.', skills: { hunting: 1, foraging: 2, building: 3, healing: 0, scouting: 0, learning: 1 } },
    { name: 'Liss', note: 'A Velari herb-gatherer with a gift for remedies.', skills: { hunting: 0, foraging: 2, building: 0, healing: 3, scouting: 1, learning: 2 } },
  ],
  tellani: [
    { name: 'Corrin', note: 'A Tellani boatman tired of the river.', skills: { hunting: 2, foraging: 1, building: 2, healing: 0, scouting: 3, learning: 1 } },
    { name: 'Mira', note: 'A sharp-eyed Tellani trader\'s apprentice.', skills: { hunting: 0, foraging: 1, building: 1, healing: 0, scouting: 2, learning: 3 } },
  ],
};
