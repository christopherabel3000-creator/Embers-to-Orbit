// The great nations beyond the valley. The standard game will have seven;
// the first two are designed here, and the rest come later in the Nation era.

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
};
// The Ostrani trade in everything; the Orhai will not trade until there is a peace pact.
export const TRADES_BY = {
  ostrani: ['sellGoods', 'sellFine', 'sellSalt', 'sellIron', 'buyIron', 'buySalt', 'buyFood'],
  orhai: ['sellGoods', 'sellIron', 'buyFood', 'buyHorses'],
};

// Treaties with the great nations, once there is an embassy.
export const GREAT_TREATIES = {
  trade: {
    name: 'Trade pact', phrase: 'a trade pact', with: ['ostrani', 'orhai'], relation: 20, trust: 40,
    effect: 'Every trade with them brings a quarter more, and a trade route brings 2 more coin a season.',
  },
  peace: {
    name: 'Peace pact', phrase: 'a peace pact', with: ['orhai'], relation: 10, trust: 40,
    effect: 'Their riders leave your settlements alone, and they will trade with you.',
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
      strength: id === 'orhai' ? 50 : 30, // Riders or soldiers under arms.
      pulledBack: false, // The Orhai pulled back to the steppe, by a peace.
      quay: false, // A free quay in Ostra, by a peace.
    };
  }
  return all;
}
