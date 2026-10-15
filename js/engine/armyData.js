// Armies in the Nation era: the kinds of soldiers, the ground they fight
// on, and the orders they take. Pure data.

export const COMPANY_SIZE = 10; // A full company.
export const MIN_COMPANY = 5; // The fewest a company can be raised with.

// Each kind of company. melee and ranged are what each soldier is worth in
// a fight, compared with an ordinary spearman; arrows is how much harm
// arrows do to them. needs: a discovery. cost: paid when it is raised.
export const KINDS = {
  spearmen: {
    name: 'Spearmen', one: 'company of spearmen', melee: 1, ranged: 0, arrows: 1, brace: true,
    cost: { wood: 10 }, about: 'Brace against charges, and hold a line. The backbone of an army.',
  },
  shields: {
    name: 'Shield infantry', one: 'company of shield infantry', melee: 0.9, ranged: 0, arrows: 0.6, shieldWall: true, needs: 'drill',
    cost: { wood: 10, goods: 10 }, about: 'Lock shields against arrows, and hold. Slow to strike, hard to break.',
  },
  archers: {
    name: 'Archers', one: 'company of archers', melee: 0.4, ranged: 1, arrows: 1, frail: true, needs: 'bows',
    cost: { wood: 10 }, about: 'Shoot before the lines meet, at any enemy in front of them. Easily ridden down up close.',
  },
  cavalry: {
    name: 'Cavalry', one: 'company of cavalry', melee: 1.3, ranged: 0, arrows: 1, mounted: true, charge: 1.4, needs: 'cavalry',
    cost: { horses: 10, goods: 5 }, about: 'Fast and hard-hitting: they charge, swing round a flank, and run down an enemy that breaks. Braced spears are their bane.',
  },
  skirmishers: {
    name: 'Skirmishers', one: 'company of skirmishers', melee: 0.6, ranged: 0.5, arrows: 1, evasive: 0.7, scouts: true,
    cost: { goods: 5 }, about: 'Light and quick: hard to pin down, good in rough ground, and they scout the enemy before a battle.',
  },
  engines: {
    name: 'Siege engines', one: 'company with siege engines', melee: 0.15, ranged: 0.3, arrows: 1, siege: true, needs: 'siegeEngines',
    cost: { wood: 30, stone: 20 }, about: 'Rams and catapults, with their crews. Of little use in the field, but they batter down walls.',
  },
};
export const KIND_ORDER = Object.keys(KINDS);

// The enemy's kinds of soldiers.
export const FOE_KINDS = {
  warriors: { name: 'warriors', melee: 1, ranged: 0, arrows: 1, brace: true },
  bowmen: { name: 'bowmen', melee: 0.4, ranged: 1, arrows: 1, frail: true },
  horseArchers: { name: 'horse archers', melee: 0.5, ranged: 0.8, arrows: 1, mounted: true, evasive: 0.8 },
  lancers: { name: 'lancers', melee: 1.2, ranged: 0, arrows: 1, mounted: true, charge: 1.4 },
  sellswords: { name: 'sell-swords', melee: 1.1, ranged: 0, arrows: 0.7 },
  crossbows: { name: 'crossbowmen', melee: 0.5, ranged: 1.1, arrows: 0.9, frail: true },
};

// The ground in each region. cavalry: how well mounted soldiers fight there;
// ranged: how well arrows fly; rough: how much the ground favors light,
// quick soldiers; hold: how much it favors a side that stands its ground.
export const TERRAIN = {
  valley: { name: 'forest and river meadows', cavalry: 0.85, ranged: 0.9, rough: 1.15, hold: 1 },
  lakes: { name: 'marsh and shore', cavalry: 0.7, ranged: 1, rough: 1.1, hold: 1.05 },
  coast: { name: 'dunes and shore', cavalry: 0.9, ranged: 1, rough: 1, hold: 1 },
  hills: { name: 'steep, broken hills', cavalry: 0.6, ranged: 0.9, rough: 1.2, hold: 1.2 },
  plains: { name: 'open grass', cavalry: 1.25, ranged: 1.1, rough: 0.9, hold: 1 },
  woods: { name: 'dark forest', cavalry: 0.6, ranged: 0.7, rough: 1.3, hold: 1.05 },
  desert: { name: 'sand and stone', cavalry: 1.1, ranged: 1.05, rough: 0.95, hold: 1 },
  ruins: { name: 'fallen walls and rubble', cavalry: 0.7, ranged: 0.9, rough: 1.15, hold: 1.15 },
  steppe: { name: 'open steppe', cavalry: 1.3, ranged: 1.1, rough: 0.9, hold: 1 },
  delta: { name: 'channels and islands', cavalry: 0.5, ranged: 1, rough: 1.1, hold: 1.1 },
};

// Orders a zone can be given in a field battle. needs: a kind that can do it.
export const FIELD_ORDERS = {
  hold: { past: 'held', name: 'Hold', about: 'Stand and fight; archers shoot.' },
  attack: { past: 'attacked', name: 'Attack', about: 'Close and strike hard; cavalry charge.' },
  shieldWall: { past: 'locked shields', name: 'Shield wall', about: 'Shield infantry lock shields: little harm from arrows, but they strike at half strength.', needs: 'shieldWall' },
  brace: { past: 'braced their spears', name: 'Brace spears', about: 'Spearmen brace: chargers who hit them suffer for it.', needs: 'brace' },
  flank: { past: 'swung round the flank', name: 'Swing round the flank', about: 'Cavalry on a flank ride round to strike the enemy center from the side.', needs: 'mounted' },
  fallBack: { past: 'fell back', name: 'Fall back', about: 'Withdraw to the reserve, taking little harm.' },
};
export const FIELD_ZONES = ['left', 'center', 'right'];
export const ZONE_WORDS = { left: 'left flank', center: 'center', right: 'right flank', reserve: 'reserve' };

// Commanders' traits.
export const TRAITS = {
  bold: { name: 'bold', about: 'Their soldiers strike 15 percent harder when they attack or charge, and take a tenth more harm.' },
  careful: { name: 'careful', about: 'Their soldiers take 15 percent less harm, and lose half as many when they withdraw.' },
  beloved: { name: 'beloved', about: 'Their soldiers hold together far longer before they break, and come home gladly.' },
};

// What a soldier's training makes them worth, by the choice in the tree.
export const TRAINING = { militia: 1, levies: 0.85, standing: 1.25 };

// ----- Raising armies -----

export const MAX_ARMIES = 3;
export const MAX_COMPANIES = 8; // In one army.
export const KEEP_CAPITAL = 30; // People who must stay in the capital.
export const KEEP_TOWN = 12; // People who must stay in a settlement.
export const TOWN_SHARE = 0.3; // Of a settlement's people who can serve.
export const LEVY_SHARE = 0.5; // ...with Levies.
export const IRON_PER_COMPANY = 5; // Iron arms for a company, with Iron weapons.
export const IRON_ARMS = 1.2; // What iron arms make a soldier worth.
export const STANDING_PAY = 2; // Coin a season for each company of a standing army.
export const SUPPLY_SEASONS = 2; // Seasons of food an army carries.
export const KILLED_SHARE = { won: 0.4, lost: 0.5 }; // Of soldiers lost in battle, the share killed; the rest are wounded.
export const ARMY_NAMES = ['First army', 'Second army', 'Third army', 'Fourth army', 'Fifth army'];

// What each army does when a battle comes.
export const STANCES = {
  ask: { name: 'Ask me', about: 'You choose each time: command the battle yourself, or let the commander fight it.' },
  commander: { name: 'The commander fights', about: 'The commander fights every battle, and the report tells you how it went.' },
  withdraw: { name: 'Fight only with good odds', about: 'The commander fights when likely to win, and otherwise falls back a region toward home before the enemy can attack.' },
};
export const STANCE_ORDER = Object.keys(STANCES);

// Orders on the regional map.
export const ARMY_ORDERS = {
  hold: { name: 'Hold', about: 'Stay and defend the region: meet raiders heading for your settlements there, and in the valley, for the capital.' },
  march: { name: 'March', about: 'March to another region. Winter stops the march, spring mud slows it, and roads speed it.' },
  raid: { name: 'Raid', about: 'Burn and plunder the enemy\'s land: food and goods for you, and the enemy may come out to fight.' },
  besiege: { name: 'Besiege', about: 'Surround the enemy\'s home. Each season they go hungrier; storm it when you are ready, or starve them out.' },
  holdPass: { name: 'Hold the high pass', about: 'Block the road east: the hill clans cannot come through, and Skarn skirmishers cannot reach the iron hills.' },
};

// The peoples an army can make war on. home: the region of their home;
// walls: the cover their home's walls give (null for none); garrison: the
// share of their warriors behind them; hunger: the share of the garrison a
// siege takes each season; yields: seasons of siege before they give in.
export const FOES = {
  skarn: {
    name: 'the Skarn', home: 'valley', homeName: 'Skarn hold', walls: 0.6, garrison: 1, hunger: 0.08, yields: 6,
    kinds: [['warriors', 0.7], ['bowmen', 0.3]], loot: { food: 60, goods: 30 },
  },
  orhai: {
    name: 'the Orhai', home: 'steppe', homeName: 'the great camp', walls: null, garrison: 0.45, hunger: 0.06, yields: 6,
    kinds: [['horseArchers', 0.6], ['lancers', 0.4]], loot: { horses: 20, coin: 20 },
  },
  ostrani: {
    name: 'the Ostrani', home: 'delta', homeName: 'Ostra', walls: 0.4, garrison: 0.6, hunger: 0.04, yields: 10,
    kinds: [['sellswords', 0.6], ['crossbows', 0.4]], loot: { coin: 80, goods: 40 },
  },
  clans: {
    name: 'the hill clans', home: 'hills', homeName: null, walls: null, garrison: 0, hunger: 0, yields: 0,
    kinds: [['warriors', 1]], loot: {},
  },
};
export const WAR_FOES = ['skarn', 'orhai', 'ostrani'];

// War score: from -100 (losing badly) to 100 (winning outright).
export const WAR_SCORE = {
  battleWon: 12, battleLost: -12, raidSeason: 4, siegeSeason: 6, stormed: 40, starved: 30, townSacked: -10, townSaved: 5,
};

// What they will make peace for. score: the war score they need to see
// first (null for always).
export const PEACE_TERMS = {
  white: { name: 'Peace on even terms', score: { skarn: -20, orhai: -10, ostrani: -40 } },
  tribute: { name: 'Peace, and they pay you tribute', score: 30 },
  land: { name: 'Peace, and they give up land', score: 50 },
  vassal: { name: 'They become your vassals', score: 70, only: ['skarn'] },
  pay: { name: 'Pay them for peace', score: null },
};
export const PEACE_ORDER = Object.keys(PEACE_TERMS);
export const TRIBUTE_YEARS = 5;
export const TRIBUTES = {
  skarn: { food: 25, goods: 10 },
  orhai: { horses: 10 },
  ostrani: { coin: 20 },
};
export const LAND_TERMS = {
  skarn: 'Their lands beyond the hold become yours.',
  orhai: 'They pull back to the steppe: their riders no longer reach the great plains or the desert edge.',
  ostrani: 'A free quay in Ostra: every trade with them brings a fifth more.',
};
export const WAR_TRUCE = 8; // Seasons after a peace before war can be declared on them again.
