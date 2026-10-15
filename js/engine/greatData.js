// The great nations beyond the valley: the seven of the standard game. Word
// of the first two (early) comes when the Nation era begins; of the others,
// when an expedition hears of their homeland. route: coin a season from a
// trade route. needsPeace: they trade only under a peace pact. strength: the
// riders or soldiers they keep under arms (base, more each year of the Nation
// era, up to cap; scaled by the difficulty). drift: how fast their attitude
// moves each season. raids: in peace, their war bands fall on your
// settlements within reach (see great.js).

export const GREAT_NATIONS = {
  ostrani: {
    name: 'the Ostrani',
    title: 'Ostrani',
    homeland: 'delta',
    home: 'ostra',
    temperament: 'mercantile',
    nature: 'merchant princes',
    description: 'Merchant princes of the Ostran delta, who build their city on islands and send their galleys along every coast. They value wealth, fair dealing, and safe roads, and are wary of war, which is bad for trade.',
    values: 'They prize honest trade and kept treaties, and think little of a people who live by the sword.',
    wants: 'goods, salt, and iron',
    offers: 'coin, and iron, salt, or food for coin',
    signature: 'Their galleys: once a settlement of yours stands on the coast, their ships come to it, and every trade with them brings a tenth more.',
    rumor: 'Travelers from downriver speak of the Ostrani, merchant princes of a city on the sea far to the south, who pay in coins of silver for good cloth and salt.',
    baseline: 10,
    likes: { trader: 1, fierce: -0.5 },
    early: true,
    route: 3,
    strength: { base: 30, per: 2, cap: 60 },
  },
  orhai: {
    name: 'the Orhai',
    title: 'Orhai',
    homeland: 'steppe',
    home: 'orhaiCamp',
    temperament: 'expansionist',
    nature: 'riders of the steppe',
    description: 'Riders of the far steppe, who live on horseback and follow their herds and their khans. Proud and restless, they are growing in number, and their grazing grounds are moving east, toward your land.',
    values: 'They respect strength and courage, and despise a people who pay to be left alone.',
    wants: 'grazing land, tribute, and respect',
    offers: 'peace, at a price, and horses',
    signature: 'Their riders: they strike far and fast, and nothing on foot can catch them.',
    rumor: 'Hunters from the west speak of the Orhai, riders of the far steppe who are never seen on foot, and whose herds grow larger every year.',
    baseline: -10,
    likes: { fierce: 1, generous: -0.5 },
    early: true,
    route: 2,
    needsPeace: true,
    strength: {
      base: 50, per: 4, cap: 100, scaled: true,
    },
  },
  keshari: {
    name: 'the Keshari',
    title: 'Keshari',
    homeland: 'highlands',
    home: 'starTowers',
    temperament: 'scholarly',
    nature: 'star-watchers of the highland towers',
    description: 'Heirs of the people who built the old ruins, the Keshari live among towers on the high moors, keep great libraries, and watch the stars. They are few, careful, and curious about everything.',
    values: 'They prize learning, patience, and kept records, and think little of a people who burn what they do not understand.',
    wants: 'goods and fine work',
    offers: 'what their scholars know',
    signature: 'Their scholars: with an embassy among them, every scholar of yours studies a tenth faster, and they sell what they know.',
    rumor: 'Beyond the old ruins, they say, the people who built them still live: the Keshari, who keep libraries in towers on the high moors and watch the stars.',
    baseline: 5,
    likes: { trader: 0.5, fierce: -0.5, learned: 0.5 },
    route: 2,
    strength: { base: 20, per: 1, cap: 40 },
  },
  dravan: {
    name: 'the Dravan',
    title: 'Dravan',
    homeland: 'crags',
    home: 'stonehelm',
    temperament: 'warlike',
    nature: 'mountain lords of the high crags',
    description: 'Iron-helmed lords who keep halls of stone in the crags beyond the iron hills. Their eldest sons inherit; their younger sons come down the passes as the hill clans, to win plunder and a name.',
    values: 'They honor courage and good iron, and keep their word to those who have shown them strength.',
    wants: 'food, goods, and a worthy fight',
    offers: 'iron, and a peace that keeps the hill clans home',
    signature: 'Their sons: under a peace pact with them, the hill clans stay home, and neither march with the Skarn nor raid you on their own.',
    rumor: 'Beyond the high pass, the hill folk say, iron-helmed lords keep halls of stone in the crags: the Dravan, whose younger sons come down as the hill clans.',
    baseline: -15,
    likes: { fierce: 1, generous: -0.3 },
    route: 2,
    needsPeace: true,
    strength: {
      base: 40, per: 3, cap: 80, scaled: true,
    },
    raids: {
      reach: ['hills', 'crags'], who: 'Dravan war bands', stranger: 'Warriors out of the eastern mountains, in iron helms,', after: 24,
    },
  },
  ashani: {
    name: 'the Ashani',
    title: 'Ashani',
    homeland: 'southlands',
    home: 'ashar',
    temperament: 'devout',
    nature: 'caravan kings of the southern wells',
    description: 'Kings of walled cities around the great wells of the south, who send caravans across the sand and raise temples to a hundred gods.',
    values: 'They honor the gods, hospitality, and an open hand, and think a people without temples hardly a people at all.',
    wants: 'iron, horses, and fine goods',
    offers: 'coin, and the richest caravans',
    signature: 'Their caravans: a trade route to them brings 4 coin a season, the richest of any, and they pay well for horses.',
    rumor: 'The caravan track, they say, leads south across the sand to the Ashani, kings of white cities around great wells, who trade in glass and incense.',
    baseline: 5,
    likes: { generous: 0.5, welcoming: 0.5, temples: 10 },
    route: 4,
    strength: { base: 30, per: 2, cap: 60 },
  },
  haldi: {
    name: 'the Haldi',
    title: 'Haldi',
    homeland: 'isles',
    home: 'skerryHold',
    temperament: 'seafaring',
    nature: 'sea rovers of the outer isles',
    description: 'Fishers, traders, and raiders of the outer isles, who sail their longships wherever the wind takes them, and take whatever they find unguarded.',
    values: 'They respect bold sailors and strong arms, and laugh at a people who never leave the shore.',
    wants: 'food, iron, and timber',
    offers: 'plunder, and their shipwrights\' craft',
    signature: 'Their shipwrights: with an embassy among them, Shipbuilding and Navigation cost a third less to study.',
    rumor: 'Fishermen speak of the Haldi, sea rovers of islands out past the grey water, whose longships with striped sails come and go with the wind.',
    baseline: -10,
    likes: { fierce: 0.7 },
    route: 2,
    needsPeace: true,
    strength: {
      base: 30, per: 2, cap: 60, scaled: true,
    },
    raids: {
      reach: ['coast', 'lakes', 'delta', 'isles'], who: 'Haldi longships', stranger: 'Longships out of the sea, under striped sails,', after: 32,
    },
  },
  venn: {
    name: 'the Venn',
    title: 'Venn',
    homeland: 'north',
    home: 'winterCamps',
    temperament: 'wary',
    nature: 'deer herders of the white north',
    description: 'Herders who follow the great deer herds across the white north, living in hide tents, wary of strangers and slow to trust them.',
    values: 'They value patience, a quiet word, and a guest who keeps the peace, and they fear warlike peoples.',
    wants: 'food and iron',
    offers: 'furs, and the art of the winter march',
    signature: 'Their furs: under a trade pact, your armies are clothed for winter, and march through it at half pace.',
    rumor: 'Past the last pines, trappers say, the Venn follow great herds of deer across a white land, and want nothing from anyone.',
    baseline: 0,
    likes: { welcoming: 0.6, fierce: -0.5 },
    route: 1,
    drift: 1,
    strength: { base: 15, per: 1, cap: 30 },
  },
};
export const GREAT_ORDER = Object.keys(GREAT_NATIONS);

// What the great nations buy and sell, in coin for a lot of each.
export const TRADE_LOTS = {
  sellGoods: { give: 'goods', amount: 20, coin: 8, label: 'Sell 20 goods' },
  sellFine: { give: 'goods', amount: 20, coin: 13, label: 'Sell 20 fine goods', needs: 'fineCrafts' },
  sellSalt: { give: 'salt', amount: 10, coin: 6, label: 'Sell 10 salt' },
  sellIron: { give: 'iron', amount: 10, coin: 7, label: 'Sell 10 iron' },
  buyIron: { get: 'iron', amount: 10, coin: 10, label: 'Buy 10 iron' },
  buySalt: { get: 'salt', amount: 10, coin: 8, label: 'Buy 10 salt' },
  buyFood: { get: 'food', amount: 40, coin: 6, label: 'Buy 40 food' },
  buyHorses: { get: 'horses', amount: 10, coin: 15, label: 'Buy 10 horses' },
  sellFood: { give: 'food', amount: 40, coin: 5, label: 'Sell 40 food' },
  sellHorses: { give: 'horses', amount: 10, coin: 18, label: 'Sell 10 horses' },
  buyGoods: { get: 'goods', amount: 20, coin: 8, label: 'Buy 20 goods' },
  buyLearning: { get: 'study', amount: 30, coin: 12, label: 'Buy 30 points of study from their scholars' },
};
// What each trades in. Those who need a peace pact trade only under one.
export const TRADES_BY = {
  ostrani: ['sellGoods', 'sellFine', 'sellSalt', 'sellIron', 'buyIron', 'buySalt', 'buyFood'],
  orhai: ['sellGoods', 'sellIron', 'buyFood', 'buyHorses'],
  keshari: ['sellGoods', 'sellFine', 'buyLearning'],
  dravan: ['sellFood', 'sellGoods', 'buyIron'],
  ashani: ['sellGoods', 'sellFine', 'sellIron', 'sellHorses'],
  haldi: ['sellFood', 'sellIron', 'buyGoods'],
  venn: ['sellFood', 'sellIron', 'buyGoods'],
};

// Treaties with the great nations, once there is an embassy.
export const GREAT_TREATIES = {
  trade: {
    name: 'Trade pact', phrase: 'a trade pact', with: ['ostrani', 'orhai', 'keshari', 'dravan', 'ashani', 'haldi', 'venn'], relation: 20, trust: 40,
    effect: 'Every trade with them brings a quarter more, and a trade route brings 2 more coin a season.',
  },
  peace: {
    name: 'Peace pact', phrase: 'a peace pact', with: ['orhai', 'dravan', 'haldi'], relation: 10, trust: 40,
    effect: 'Their raiders leave your settlements alone, and they will trade with you.',
  },
};

// What a new game knows of them: nothing yet.
export function initialGreat() {
  const all = {};
  for (const id of GREAT_ORDER) {
    all[id] = {
      heard: false,
      met: false,
      contactPending: false,
      relation: GREAT_NATIONS[id].baseline,
      trust: 50,
      embassy: false,
      treaties: {},
      married: false,
      route: false,
      lastEnvoy: -1,
      memory: [],
      tributeInARow: 0,
      paidUntil: -1, // Tribute keeps the Orhai away until this turn.
      angryUntil: -1, // A refusal makes their raids more likely until this turn.
      lastDemand: -99,
      strength: GREAT_NATIONS[id].strength.base, // Riders or soldiers under arms.
      pulledBack: false, // The Orhai pulled back to the steppe, by a peace.
      quay: false, // A free quay in Ostra, by a peace.
    };
  }
  return all;
}
