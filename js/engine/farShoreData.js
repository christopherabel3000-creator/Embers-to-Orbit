// The far shore, across the open sea: the waters ships sail, the far
// shore's regions and places, and the peoples who live there. Hand-crafted,
// like the valley and the wider world, and kept apart from them so the
// world beyond the valley, its expeditions, and its settlements are
// untouched. The Age of Discovery is in farShore.js.

// The waters, as nodes joined by sea lanes, a season's sailing each.
// storm: the chance each season at sea there that a storm finds a fleet
// (twice that in winter). coasts: far shore regions a fleet can reach from
// here, one more season's sailing.
export const WATERS = {
  homeWaters: {
    name: 'Your home waters', lanes: ['openSea'], storm: 0, home: true,
    description: 'The grey water off your harbor at the headland, where your ships put out and come home.',
  },
  openSea: {
    name: 'The open sea', lanes: ['homeWaters', 'westernIsles', 'farWaters'], storm: 0.15,
    description: 'Deep water out of sight of land, where the swells run long and the storms come without warning. Only a navigator can cross it.',
  },
  westernIsles: {
    name: 'The western isles', lanes: ['openSea', 'farWaters'], storm: 0.04,
    heard: 'Your sailors saw birds that roost on land, far out on the open sea, and green smudges to the south.',
    description: 'A chain of small green islands with sheltered coves, halfway across: a longer way over, but a safer one.',
  },
  farWaters: {
    name: 'The far waters', lanes: ['openSea', 'westernIsles'], storm: 0.08, coasts: ['landfall', 'greatRiver', 'southBays', 'fjords'],
    description: 'The water off the far shore, warmer and greener than your own, where the land is never out of sight for long.',
  },
};
export const WATER_ORDER = Object.keys(WATERS);

// The far shore's regions. coastal: a fleet can reach it from the far
// waters. people: the homeland of one of its peoples.
export const SHORE_REGIONS = {
  landfall: {
    name: 'The landfall coast', coastal: true, neighbors: ['greatRiver', 'tallForest', 'fjords'],
    description: 'A long coast of dunes and pine where your first ship came ashore, with a sheltered cove and meadows behind it.',
  },
  greatRiver: {
    name: 'The great river', coastal: true, neighbors: ['landfall', 'tallForest', 'southBays'], people: 'tavari',
    heard: 'South of the landfall a river wider than any in your world runs into the sea, brown with the soil of the whole country.',
    description: 'A river so wide the far bank is a blue line, running through fields and towns to a delta of islands. The homeland of the Tavari.',
  },
  southBays: {
    name: 'The southern bays', coastal: true, neighbors: ['greatRiver', 'highPlateau'],
    heard: 'Beyond the great river, the Tavari say, the coast turns warm, and the trees bear fruit that smells of fire.',
    description: 'Warm bays behind reefs, with groves of strange fragrant trees and shallows that stain the hand red.',
  },
  fjords: {
    name: 'The northern fjords', coastal: true, neighbors: ['landfall', 'tallForest'],
    heard: 'North of the landfall, the coast breaks into deep cold inlets under black cliffs.',
    description: 'Deep inlets between black cliffs, cold and rich in fish and fur, where the snow comes early.',
  },
  tallForest: {
    name: 'The tall forest', coastal: false, neighbors: ['landfall', 'greatRiver', 'fjords', 'highPlateau'], people: 'ossiren',
    heard: 'Inland from the landfall stand trees taller than any tower, and the forest beneath them is dark at noon.',
    description: 'A forest of trees taller than towers, dim and quiet beneath, crossed by game trails older than memory. The homeland of the Ossiren.',
  },
  highPlateau: {
    name: 'The high plateau', coastal: false, neighbors: ['tallForest', 'southBays'], people: 'ondari',
    heard: 'Far inland, the Tavari say, the land climbs to a high cold plain where the people work bright metal.',
    description: 'A high, windy plain ringed with mountains, where rivers run over gold and the herds graze to the sky. The homeland of the Ondari.',
  },
};
export const SHORE_ORDER = Object.keys(SHORE_REGIONS);

// Places on the far shore and the isles. kind as in the wider world:
// settle (a place for a colony), people, wonder, ruins, danger, or route.
// goods: what a colony there would ship home (from phase 2). harbor: a
// colony there could be a port. study: points toward a discovery when found.
// at: the waters or region it lies in.
export const SHORE_PLACES = {
  // The western isles
  fogIsle: {
    at: 'westernIsles', kind: 'route', name: 'Fog isle', harbor: true,
    description: 'An island of springs and sheltered coves, where a fleet can take on water and wait out bad weather.',
  },
  birdRock: {
    at: 'westernIsles', kind: 'wonder', name: 'Bird rock',
    description: 'A sheer stack of white stone where a million seabirds wheel and cry. Sailors salute it as they pass.',
  },
  wreckersReef: {
    at: 'westernIsles', kind: 'danger', name: 'The wreckers\' reef',
    description: 'A hidden reef that has torn the bottom out of more than one ship. Its place is charted now, and your captains steer wide of it.',
  },
  // The landfall coast
  landfallCove: {
    at: 'landfall', kind: 'settle', name: 'Landfall cove', harbor: true, goods: 'timber',
    description: 'The sheltered cove where your first ship came ashore, with fresh water, tall pines, and good holding ground.',
  },
  saltMeadow: {
    at: 'landfall', kind: 'settle', name: 'Salt meadow', goods: 'furs',
    description: 'Wide meadows behind the dunes, grazed by deer that have never seen a hunter.',
  },
  whaleStrand: {
    at: 'landfall', kind: 'wonder', name: 'The whale strand',
    description: 'A beach where the bones of great whales lie bleaching in rows, as if set there on purpose.',
  },
  // The great river
  tavariTowns: {
    at: 'greatRiver', kind: 'people', people: 'tavari', name: 'The river towns',
    description: 'Towns of timber and woven reed along the river banks, with fields of tall grain around them: the home of the Tavari.',
  },
  riverIslands: {
    at: 'greatRiver', kind: 'settle', name: 'The delta islands', harbor: true, goods: 'sugar',
    description: 'Low green islands in the river mouth, warm and wet, where a sweet cane grows wild.',
  },
  ferryStones: {
    at: 'greatRiver', kind: 'route', name: 'The ferry stones',
    description: 'A ford of flat stones where the river runs shallow, and the trails of the whole country cross it.',
  },
  // The southern bays
  spiceGrove: {
    at: 'southBays', kind: 'settle', name: 'The spice groves', harbor: true, goods: 'spices',
    description: 'Groves of trees whose bark and seeds smell of fire and flowers, behind a bay sheltered by reefs.',
  },
  redShallows: {
    at: 'southBays', kind: 'settle', name: 'The red shallows', goods: 'dyes',
    description: 'Warm shallows where a small shellfish stains everything a deep, lasting red.',
  },
  drownedReef: {
    at: 'southBays', kind: 'danger', name: 'The drowned reef',
    description: 'A reef across the mouth of the bays that shows only at low water. Your captains know where it lies now.',
  },
  // The northern fjords
  furInlet: {
    at: 'fjords', kind: 'settle', name: 'Fur inlet', harbor: true, goods: 'furs',
    description: 'A deep inlet where seals haul out on the rocks and the forest above teems with fur-bearing game.',
  },
  iceTongue: {
    at: 'fjords', kind: 'wonder', name: 'The ice tongue',
    description: 'A river of blue ice that runs down from the mountains into the sea, groaning and breaking as it goes.',
  },
  // The tall forest
  ossirenHalls: {
    at: 'tallForest', kind: 'people', people: 'ossiren', name: 'The hollow halls',
    description: 'Halls hollowed into the roots of the greatest trees, where the Ossiren live and keep their dead.',
  },
  greatTrees: {
    at: 'tallForest', kind: 'settle', name: 'The great trees', goods: 'timber',
    description: 'A grove of the tallest trees of all, straight and sound: masts and beams for a hundred ships.',
  },
  mistHollow: {
    at: 'tallForest', kind: 'danger', name: 'Mist hollow',
    description: 'A valley where the mist never lifts and those who enter lose their way. The Ossiren will not go there.',
  },
  // The high plateau
  ondariForges: {
    at: 'highPlateau', kind: 'people', people: 'ondari', name: 'The high forges',
    description: 'Walled towns on the plateau rim, their forges smoking day and night: the home of the Ondari.',
  },
  goldRiver: {
    at: 'highPlateau', kind: 'settle', name: 'The gold river', goods: 'gold',
    description: 'A cold river that runs over gravel bright with gold. The Ondari count it theirs.',
  },
  skyLake: {
    at: 'highPlateau', kind: 'wonder', name: 'The sky lake',
    description: 'A lake so high and still it holds the whole sky, ringed with snow peaks.',
  },
  oldRoad: {
    at: 'highPlateau', kind: 'ruins', name: 'The old road', study: 40,
    description: 'A paved road older than the Ondari, running straight across the plateau to nowhere, carved with the stars.',
  },
};
export const SHORE_PLACE_ORDER = Object.keys(SHORE_PLACES);

// The peoples of the far shore: nations of their own, with feelings toward
// you. baseline: where their feelings rest before your deeds move them.
// teaches: what only they can teach (from phase 2).
export const SHORE_PEOPLES = {
  tavari: {
    name: 'the Tavari',
    title: 'Tavari',
    homeland: 'greatRiver',
    home: 'tavariTowns',
    nature: 'river farmers of the great river',
    description: 'Farmers and traders of the great river, who live in many towns under councils of elders and grow a tall grain your people have never seen.',
    values: 'They prize hospitality, fair trade, and the word of elders, and are slow to anger and slow to forget.',
    teaches: 'their tall grain and how to grow it',
    baseline: 15,
    finds: 0.25, // The chance each season, once your foothold stands near, that they find it first.
  },
  ossiren: {
    name: 'the Ossiren',
    title: 'Ossiren',
    homeland: 'tallForest',
    home: 'ossirenHalls',
    nature: 'hunters of the tall forest',
    description: 'Hunters who live in halls among the roots of the great trees, few and watchful, who know every trail and plant of their forest.',
    values: 'They prize their forest above everything, and the trees above any trade. Strangers who cut them are enemies.',
    teaches: 'the medicines of the forest',
    baseline: -5,
    finds: 0.1,
  },
  ondari: {
    name: 'the Ondari',
    title: 'Ondari',
    homeland: 'highPlateau',
    home: 'ondariForges',
    nature: 'smiths and herders of the high plateau',
    description: 'A proud people of walled towns on the high plateau, herders and smiths who work gold and copper as no one in your world can.',
    values: 'They prize skill, strength, and a bargain well struck, and think little of a people who come with nothing to trade.',
    teaches: 'the working of gold and copper',
    baseline: 0,
    finds: 0,
  },
};
export const SHORE_PEOPLE_ORDER = Object.keys(SHORE_PEOPLES);

// Ships: what a merchant ship costs, how long a shipyard takes to build
// one, what it costs each season to keep, and what it can carry.
export const SHIP = {
  cost: { wood: 40, iron: 10, coin: 15 },
  seasons: 2,
  upkeep: 1, // Coin a season for each ship, afloat or in port.
  food: 60, // Food each ship can carry.
  people: 6, // People each ship can carry.
};
export const STORM_SINKS = 0.25; // Of the storms that find a fleet, the share that sink a ship.
export const FOOTHOLD_FOOD_CAP = 300; // More than this spoils.
export const SCOUT_SEASONS = 2;
export const SCOUT_PARTY = 3;
