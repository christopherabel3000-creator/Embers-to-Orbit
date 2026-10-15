// The world beyond the forest valley: hand-crafted regions, each with a few
// places that expeditions can find. The valley's own places are in data.js;
// these are kept apart so the valley's map, work sites, and claims are
// untouched by them.

// Regions, as nodes connected to their neighbors. dir: where it lies from
// the valley. river: reachable by boat down the river. winterPasses: no
// travel or exploring there in winter. hardWinter: winter is more dangerous.
// skarn: within reach of Skarn skirmishers.
export const REGIONS = {
  valley: {
    name: 'The forest valley', dir: 'home', neighbors: ['lakes', 'hills', 'plains', 'woods'], skarn: true,
    description: 'Your home: the river valley where your people first made camp. Its places are on the Map screen.',
  },
  lakes: {
    name: 'The lake country', dir: 'south, downriver', neighbors: ['valley', 'coast', 'plains'], river: true,
    heard: 'The Tellani speak of a country of long lakes downriver, where the reeds grow higher than a man.',
    description: 'Downriver, the valley opens into a country of long lakes, reed beds, and slow channels. Fish, fowl, and easy water.',
  },
  coast: {
    name: 'The coast', dir: 'south, beyond the lakes', neighbors: ['lakes', 'desert'], river: true,
    heard: 'Beyond the lakes, they say, the water turns salt and runs to the edge of the sky.',
    description: 'Where the lakes drain into the sea: dunes, salt marsh, and grey water to the edge of sight.',
  },
  hills: {
    name: 'The iron hills', dir: 'east, beyond the Skarn', neighbors: ['valley', 'ruins'], winterPasses: true, skarn: true,
    heard: 'East of Skarn hold the hills turn red, and the Skarn trade for knives made there.',
    description: 'Bare red hills east of the valley, scarred where the rock bleeds rust. The passes close with snow in winter.',
  },
  plains: {
    name: 'The great plains', dir: 'west', neighbors: ['valley', 'lakes', 'desert'],
    heard: 'West of the valley the forest ends, and the grass begins.',
    description: 'West of the valley the trees give way to grass: a sea of it, rolling to the sky.',
  },
  woods: {
    name: 'The northern woods', dir: 'north', neighbors: ['valley', 'ruins'], hardWinter: true,
    heard: 'North of the valley the pines grow dark and close, and winter comes early.',
    description: 'Dark pine forest running north, where winter comes early and stays late. The best timber, and the hardest winters.',
  },
  desert: {
    name: 'The desert edge', dir: 'southwest, beyond the plains', neighbors: ['plains', 'coast'],
    heard: 'Past the plains, travelers say, the grass thins to sand.',
    description: 'Beyond the plains the grass thins to sand and stone. Caravan tracks lead south to peoples no one in the valley has seen.',
  },
  ruins: {
    name: 'The old ruins', dir: 'northeast', neighbors: ['woods', 'hills'],
    heard: 'Hunters speak of broken stone towns in the northeast, older than any people they know.',
    description: 'The broken towns of a people who lived here long before yours, half buried in moss.',
  },
};
export const REGION_ORDER = Object.keys(REGIONS);

// Places in the regions. kind: settle (a place for a settlement), people
// (a small people), wonder, ruins, danger, or route. Bonuses work as on
// the valley's map, for what a settlement there brings in; fish counts
// toward a farming town. ore and salt are worked by a mining town.
export const WORLD_PLACES = {
  // The lake country
  reedShallows: {
    region: 'lakes', kind: 'settle', name: 'Reed shallows', tasks: ['hunt', 'forage'], bonus: { forage: 2, hunt: 1, fish: 2 },
    description: 'Wide shallows thick with reeds, fish, and waterfowl.',
  },
  longLake: {
    region: 'lakes', kind: 'settle', name: 'Long Lake', tasks: ['hunt', 'forage'], bonus: { fish: 3, hunt: 1 },
    description: 'A lake a day\'s walk long, so full of fish the water boils at dusk.',
  },
  stiltVillage: {
    region: 'lakes', kind: 'people', name: 'Stilt village', people: 'reedFolk', tasks: [], bonus: {},
    description: 'Houses on stilts above the water, home of the Reed folk, who fish and weave and keep to themselves.',
  },
  willowIsle: {
    region: 'lakes', kind: 'wonder', name: 'Willow isle', tasks: [], bonus: {},
    description: 'An island of ancient willows where the water lies still as glass. Those who have seen it speak of it softly.',
  },
  // The coast
  saltFlats: {
    region: 'coast', kind: 'settle', name: 'Salt flats', tasks: ['quarry'], salt: true, bonus: { fish: 1 },
    description: 'Flat white pans where seawater dries to salt. A mining town here would rake salt.',
  },
  shellStrand: {
    region: 'coast', kind: 'settle', name: 'Shell strand', tasks: ['hunt', 'forage'], bonus: { fish: 3, forage: 1 },
    description: 'A long beach of shells and tide pools, with the richest fishing anywhere.',
  },
  greyHeadland: {
    region: 'coast', kind: 'settle', name: 'Grey headland', tasks: ['hunt', 'forage'], harbor: true, bonus: { fish: 2 },
    description: 'A rocky headland with a deep, sheltered cove: the one place on this coast a harbor could stand.',
  },
  wreck: {
    region: 'coast', kind: 'ruins', name: 'The wreck', tasks: [], bonus: {}, study: 30,
    description: 'The ribs of a great ship, far larger than any boat the Tellani build. Its makers came from somewhere across the water, or along the coast.',
  },
  // The iron hills
  redScar: {
    region: 'hills', kind: 'settle', name: 'Red scar', tasks: ['quarry'], ore: true, bonus: { quarry: 2 },
    description: 'A hillside of red rock, streaked through with iron ore.',
  },
  oldDiggings: {
    region: 'hills', kind: 'settle', name: 'Old diggings', tasks: ['quarry'], ore: true, bonus: { quarry: 1 },
    description: 'Shafts dug by some forgotten people. There is ore in them still.',
  },
  highPass: {
    region: 'hills', kind: 'route', name: 'The high pass', tasks: [], bonus: {},
    description: 'A narrow pass through the hills, closed by snow in winter. Whoever holds it holds the road east.',
  },
  cairnSteading: {
    region: 'hills', kind: 'people', name: 'Cairn steading', people: 'cairnFolk', tasks: [], bonus: {},
    description: 'Stone houses behind stone walls, home of the Cairn folk, a hill clan that has never bowed to the Skarn.',
  },
  // The great plains
  horseGrounds: {
    region: 'plains', kind: 'settle', name: 'Wild horse grounds', tasks: ['hunt', 'forage'], horses: true, bonus: { hunt: 2 },
    description: 'Grassland where herds of wild horses run. No one in the valley has ever ridden one.',
  },
  grassSea: {
    region: 'plains', kind: 'settle', name: 'Grass sea', tasks: ['hunt', 'forage'], bonus: { forage: 1, hunt: 2 },
    description: 'Endless grass over deep black soil, good for grazing and for grain.',
  },
  burnedCamp: {
    region: 'plains', kind: 'danger', name: 'Burned riders\' camp', tasks: [], bonus: {}, risk: 0.06,
    description: 'Blackened rings where tents once stood, and the bones of horses. Riders camped here, and riders came for them.',
  },
  // The northern woods
  pineDeeps: {
    region: 'woods', kind: 'settle', name: 'Pine deeps', tasks: ['wood', 'hunt'], bonus: { wood: 3, hunt: 1 },
    description: 'Tall pines, straight and close: the best timber anywhere.',
  },
  trapperRuns: {
    region: 'woods', kind: 'settle', name: 'Trapper runs', tasks: ['hunt', 'wood'], bonus: { hunt: 3, wood: 1 },
    description: 'Streams and runs thick with fur and game.',
  },
  frozenFalls: {
    region: 'woods', kind: 'wonder', name: 'Frozen falls', tasks: [], bonus: {},
    description: 'A waterfall frozen into a wall of blue ice for half the year, ringing like a bell in the wind.',
  },
  wolfCountry: {
    region: 'woods', kind: 'danger', name: 'Wolf country', tasks: [], bonus: {}, risk: 0.06,
    description: 'Great packs of wolves own these woods. Travelers go in numbers, and never alone at night.',
  },
  // The desert edge
  saltPans: {
    region: 'desert', kind: 'settle', name: 'Salt pans', tasks: ['quarry'], salt: true, bonus: {},
    description: 'Dry lake beds crusted thick with salt. A mining town here would rake salt.',
  },
  oasis: {
    region: 'desert', kind: 'settle', name: 'Palm oasis', tasks: ['forage'], bonus: { forage: 2 },
    description: 'Springs and palms in the sand: water enough for a town.',
  },
  caravanTrack: {
    region: 'desert', kind: 'route', name: 'Caravan track', tasks: [], bonus: {},
    description: 'A road of hoofprints and cart ruts heading south, to peoples no one in the valley has met.',
  },
  // The old ruins
  brokenCity: {
    region: 'ruins', kind: 'ruins', name: 'Broken city', tasks: [], bonus: {}, study: 40,
    description: 'Streets and walls of fitted stone, roofless, overgrown, and silent.',
  },
  sealedVault: {
    region: 'ruins', kind: 'ruins', name: 'Sealed vault', tasks: [], bonus: {}, reveals: true,
    description: 'A stone vault under the hill, its door carved with signs. Inside, tablets that someone took great care to keep.',
  },
  stoneCircle: {
    region: 'ruins', kind: 'wonder', name: 'Stone circle', tasks: [], bonus: {}, study: 20,
    description: 'A ring of standing stones aligned to the midwinter sunrise. Whoever raised them watched the sky closely.',
  },
};
export const WORLD_PLACE_ORDER = Object.keys(WORLD_PLACES);

// Small peoples who live in the regions.
export const SMALL_PEOPLES = {
  reedFolk: { name: 'the Reed folk', title: 'Reed folk' },
  cairnFolk: { name: 'the Cairn folk', title: 'Cairn folk' },
};

// What expeditions report when they find each kind of place.
export const FIND_WORDS = {
  settle: 'a place to settle',
  people: 'a people of their own',
  wonder: 'a wonder',
  ruins: 'ruins',
  danger: 'a danger',
  route: 'a route',
};

// How many regions away from the valley each region lies, by the shortest way.
export const HOPS = (() => {
  const hops = { valley: 0 };
  const queue = ['valley'];
  while (queue.length) {
    const id = queue.shift();
    for (const n of REGIONS[id].neighbors) {
      if (hops[n] === undefined) {
        hops[n] = hops[id] + 1;
        queue.push(n);
      }
    }
  }
  return hops;
})();

// Places in other regions are far from the capital: 4 in a region next to
// the valley, 5 beyond.
for (const place of Object.values(WORLD_PLACES)) place.distance = 3 + HOPS[place.region];

// The world as a new game knows it: only the valley.
export function initialWorld() {
  const regions = {};
  for (const id of REGION_ORDER) regions[id] = { status: id === 'valley' ? 'explored' : 'unknown', mapped: id === 'valley' };
  const places = {};
  for (const id of WORLD_PLACE_ORDER) places[id] = { known: false, owner: null };
  return { regions, places, expeditions: [], nextExpedition: 1, peoples: {} };
}
