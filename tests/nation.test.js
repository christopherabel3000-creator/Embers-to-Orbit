import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyAction } from '../js/engine/game.js';
import {
  living, makePerson, migrate, SAVE_VERSION, knowledgeBlocker,
} from '../js/engine/state.js';
import {
  governorChoices, settlementsSeason, harrySettlements, settlementBlocker, settlerSources, nextProject, aidCost,
} from '../js/engine/settlements.js';
import {
  expectedShipment, townGroups, governorFactor, loyaltyTarget, loyaltyFactor, landFit, bestRole, townStudy,
  fortressHelp, fortressWatch, hasRoad, settlementById,
} from '../js/engine/realm.js';
import { alliedHelpers, harryChance, nation } from '../js/engine/nations.js';
import { studyPoints, expectedWork, foodPerPlot } from '../js/engine/rules.js';
import { describePending, maybeStartEvent } from '../js/engine/events.js';
import { advanceLife } from '../js/engine/life.js';
import { birthOutlook } from '../js/engine/population.js';

const act = (state, action) => {
  const r = applyAction(state, action);
  assert.equal(r.error, undefined, r.error);
  return r.state;
};

// A village of 64 that holds the North meadow, the oak woods, the storm
// deadfall, and the Grey cliffs.
function readyVillage(seed = 1, extra = 52) {
  let s = newGame({ seed, difficulty: 'easy' });
  for (let i = 0; i < extra; i++) {
    s.people.push(makePerson({ name: `Villager${i}`, note: '', age: 20 + (i % 20), skills: { hunting: 2, foraging: 2, building: 2, healing: 1, scouting: 1, learning: 1 } }, s.nextPersonId++, 'forage'));
  }
  Object.assign(s.buildings, { storehouse: 2, palisade: 1, leanTo: 20 });
  s.knowledge.learned.push('farming', 'stoneTools', 'stonecutting', 'oralLaw');
  s.milestoneReached = true;
  for (const id of ['meadow', 'deadfall', 'greyCliffs']) s.places[id].known = true;
  s = act(s, { type: 'foundVillage' });
  for (const id of ['meadow', 'oakWoods', 'deadfall', 'greyCliffs']) s = act(s, { type: 'claimPlace', placeId: id });
  Object.assign(s.resources, { food: 600, wood: 400, stone: 200, goods: 100 });
  return s;
}

function found(s, extra = {}) {
  return act(s, {
    type: 'foundSettlement', placeId: 'meadow', name: 'Thornfield', settlers: 14, governorId: governorChoices(s)[0].id, ...extra,
  });
}

test('a settlement takes the role its land suits, normal demands, and a governor with skills', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  assert.equal(t.role, 'farming');
  assert.equal(t.demands, 'normal');
  assert.equal(t.loyalty, 70);
  assert.ok(t.governor.skills && t.governor.age, 'the governor is a whole person');
  assert.deepEqual(t.priorities, { defense: 'normal', learning: 'normal' });
  assert.ok(t.buildings.homes * 8 >= t.population + 2, 'the settlers built homes enough for themselves');
  assert.equal(bestRole('greyCliffs'), 'mining');
  assert.equal(bestRole('deadfall'), 'timber');
  assert.equal(bestRole('meadow'), 'farming');
});

test('roles send home different things, and the land matters', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  s.turn = 5; // Summer.
  const food = expectedShipment(s, t);
  assert.equal(food.kind, 'food');
  assert.ok(food.amount > 0);
  assert.ok(landFit('farming', 'meadow') > 1, 'the meadow is rich foraging');
  assert.equal(landFit('mining', 'meadow'), 0.5, 'no stone to cut there');
  s.knowledge.learned.push('weaving');
  for (const [role, kind] of [['timber', 'wood'], ['mining', 'stone'], ['market', 'goods']]) {
    const r = applyAction(s, { type: 'setTownRole', settlementId: 1, role });
    assert.equal(r.error, undefined);
    assert.equal(expectedShipment(r.state, r.state.settlements[0]).kind, kind);
  }
  const fort = act(s, { type: 'setTownRole', settlementId: 1, role: 'fortress' });
  assert.equal(expectedShipment(fort, fort.settlements[0]).amount, 0, 'a fortress sends nothing home');
  assert.ok(townGroups(fort, fort.settlements[0]).guards >= Math.round(townGroups(fort, fort.settlements[0]).workers * 0.4) - 1);
  const noWeaving = found(readyVillage());
  assert.match(applyAction(noWeaving, { type: 'setTownRole', settlementId: 1, role: 'market' }).error, /weaving/);
});

test('demands set what is sent home, how fast it grows, and how loyal it is', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  s.turn = 5;
  const normal = expectedShipment(s, t).amount;
  t.demands = 'heavy';
  const heavy = expectedShipment(s, t).amount;
  const heavyTarget = loyaltyTarget(s, t).target;
  t.demands = 'light';
  const light = expectedShipment(s, t).amount;
  assert.ok(light < normal && normal < heavy);
  assert.equal(loyaltyTarget(s, t).target - heavyTarget, 20, 'light demands are 20 more loyal than heavy');
  const before = t.population;
  s.turn = 8; // Spring.
  settlementsSeason(s, { routine: [] });
  assert.ok(t.population - before >= 1);
  assert.match(applyAction(s, { type: 'setTownDemands', settlementId: 1, demands: 'crushing' }).error, /light, normal, or heavy/);
});

test('a skilled governor gets more from a settlement, and grows with practice', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  t.governor.skills.foraging = 0;
  t.governor.skills.learning = 0;
  assert.equal(governorFactor(t), 0.85);
  t.governor.skills.foraging = 5;
  t.governor.skills.learning = 5;
  assert.ok(Math.abs(governorFactor(t) - 1.3) < 1e-9);
  t.governor.skills.foraging = 1;
  t.governor.xp = {};
  for (let i = 0; i < 6; i++) settlementsSeason(s, { routine: [] });
  assert.ok(t.governor.skills.foraging >= 2, 'governing a farming town is foraging practice');
});

test('loyalty drifts toward its target, and low loyalty sends less', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  s.turn = 5;
  t.demands = 'heavy';
  t.governor.skills.learning = 0;
  const { target, reasons } = loyaltyTarget(s, t);
  assert.ok(reasons.some(([text]) => /heavy demands/.test(text)));
  assert.equal(target, 55 - 10 - 4);
  for (let i = 0; i < 12; i++) settlementsSeason(s, { routine: [] });
  assert.ok(Math.abs(t.loyalty - target) <= 3, `drifted to ${t.loyalty}`);
  assert.equal(loyaltyFactor(80), 1.1);
  assert.equal(loyaltyFactor(30), 0.6);
  t.loyalty = 80;
  const devoted = expectedShipment(s, t).amount;
  t.loyalty = 30;
  assert.ok(expectedShipment(s, t).amount < devoted * 0.6);
});

test('neglect lowers loyalty, and aid lifts it once a year', () => {
  let s = found(readyVillage());
  const t = s.settlements[0];
  assert.match(applyAction(s, { type: 'sendAid', settlementId: 1, kind: 'goods' }).error, /this past year/, 'just founded, with supplies');
  s.turn += 13;
  assert.ok(loyaltyTarget(s, s.settlements[0]).reasons.some(([text, n]) => /no aid/.test(text) && n < 0));
  const goods = s.resources.goods;
  const loyal = t.loyalty;
  s = act(s, { type: 'sendAid', settlementId: 1, kind: 'goods' });
  assert.equal(s.resources.goods, goods - aidCost(t, 'goods'));
  assert.equal(s.settlements[0].loyalty, loyal + 10);
  assert.ok(!loyaltyTarget(s, s.settlements[0]).reasons.some(([text]) => /no aid/.test(text)));
  assert.match(applyAction(s, { type: 'sendAid', settlementId: 1, kind: 'food' }).error, /this past year/);
});

test('the player can choose a new governor, and the old one comes home', () => {
  let s = found(readyVillage());
  const old = s.settlements[0].governor;
  const next = governorChoices(s)[0];
  const capital = living(s).length;
  s = act(s, { type: 'appointGovernor', settlementId: 1, personId: next.id });
  const t = s.settlements[0];
  assert.equal(t.governor.id, next.id);
  assert.ok(s.people.some((p) => p.id === old.id && p.alive), 'the old governor is home');
  assert.ok(!s.people.some((p) => p.id === next.id), 'the new one has left the capital');
  assert.equal(living(s).length, capital);
  assert.equal(t.loyalty, 65, 'a loyal settlement misses its old governor');
  assert.match(applyAction(s, { type: 'appointGovernor', settlementId: 1, personId: 99999 }).error, /notable/);
});

test('a governor who dies is followed by the best of the settlement, or one of its own', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  t.governor.age = 90;
  t.notables = [];
  s.turn = 8;
  let out = { urgent: [] };
  for (let i = 0; i < 10 && !out.urgent.length; i++) {
    out = settlementsSeason(s, { routine: [] });
    s.turn += 4;
  }
  assert.ok(out.urgent.some((l) => /died in old age.*one of their own/.test(l)), out.urgent.join(' '));
  assert.ok(t.governor && t.governor.age < 60);
});

test('a settlement whose loyalty falls below 20 defies you, and each answer settles it', () => {
  const base = found(readyVillage());
  base.settlements[0].loyalty = 15;
  base.turn += 8;
  maybeStartEvent(base);
  assert.equal(base.pendingEvent.id, 'defiance');
  const view = describePending(base);
  assert.match(view.title, /Thornfield defies you/);
  assert.deepEqual(view.options.map((o) => o.id), ['goods', 'food', 'governor', 'keep']);
  for (const option of view.options) {
    const r = applyAction(base, { type: 'resolveEvent', choice: option.id });
    assert.equal(r.error, undefined);
    const t = r.state.settlements[0];
    if (option.id === 'keep') {
      assert.equal(t.demands, 'light');
      assert.equal(expectedShipment(r.state, t).amount, 0, 'it keeps everything for a year');
      assert.equal(maybeStartEvent(r.state).urgent.some((l) => /defies/.test(l)), false, 'no more defiance while it keeps all');
    } else {
      assert.ok(t.loyalty >= 35, `${option.id} lifts loyalty, to ${t.loyalty}`);
    }
  }
});

test('more settlements: from the capital, and from a large settlement', () => {
  let s = found(readyVillage(2, 70));
  assert.equal(settlementBlocker(s), null);
  s = act(s, {
    type: 'foundSettlement', placeId: 'greyCliffs', name: 'Greystone', settlers: 10, governorId: governorChoices(s)[0].id, role: 'mining', demands: 'heavy',
  });
  assert.equal(s.settlements.length, 2);
  assert.equal(s.settlements[1].id, 2);
  assert.equal(s.settlements[1].role, 'mining');
  assert.ok(s.report.decisions.some((l) => /now has 3 settlements/.test(l)));
  // A settlement of 30 or more can send settlers of its own.
  s.settlements[0].population = 34;
  assert.ok(settlerSources(s).some((x) => x.from === 1));
  const before = living(s).length;
  s = act(s, {
    type: 'foundSettlement', placeId: 'deadfall', name: 'Fellwood', settlers: 10, governorId: governorChoices(s, 1)[0].id, from: 1,
  });
  assert.equal(s.settlements[0].population, 34 - 9, 'the governor came from the capital, the rest from Thornfield');
  assert.equal(living(s).length, before - 1);
  assert.equal(s.settlements[2].role, 'timber');
  assert.match(applyAction(s, {
    type: 'foundSettlement', placeId: 'oakWoods', name: 'X', settlers: 10, governorId: governorChoices(s)[0].id, from: 2,
  }).error, /30 people/);
});

test('roads are built in order, and a settlement with one loses nothing on the way', () => {
  let s = found(readyVillage());
  const t = s.settlements[0];
  s.turn = 5;
  t.place = 'greyCliffs'; // Far off, for the test.
  t.role = 'mining';
  const unroaded = expectedShipment(s, t);
  assert.ok(unroaded.lost > 0);
  assert.match(applyAction(s, { type: 'queueBuilding', buildingId: 'road' }).error, /needs Roads/);
  s.knowledge.learned.push('roads');
  s = act(s, { type: 'queueBuilding', buildingId: 'road' });
  assert.match(applyAction(s, { type: 'queueBuilding', buildingId: 'road' }).error, /Every settlement has a road/);
  s.buildings.road = 1;
  s.buildQueue = [];
  const roaded = expectedShipment(s, s.settlements[0]);
  assert.equal(roaded.lost, 0);
  assert.ok(roaded.amount > unroaded.amount);
  assert.ok(hasRoad(s, s.settlements[0]));
  assert.ok(loyaltyTarget(s, s.settlements[0]).reasons.some(([text, n]) => /road/.test(text) && n === 5));
});

test('the Learning branch: Writing, Mathematics, Astronomy, and Schools', () => {
  const s = found(readyVillage());
  assert.equal(knowledgeBlocker(newGame({ seed: 1 }), 'writing'), 'Becomes possible in the Nation era, once your village founds a second settlement.');
  assert.equal(knowledgeBlocker(s, 'writing'), null);
  const p = living(s)[0];
  const study = studyPoints(p, s);
  const work = expectedWork(p, s);
  const plot = foodPerPlot(1, s);
  s.knowledge.learned.push('writing', 'mathematics', 'astronomy');
  assert.ok(Math.abs(studyPoints(p, s) - study * 1.25) < 1e-9);
  assert.ok(expectedWork(p, s) > work);
  assert.equal(foodPerPlot(1, s), plot + 1);
  assert.match(knowledgeBlocker(s, 'schools'), /meeting hall/);
  s.buildings.meetingHall = 1;
  assert.equal(knowledgeBlocker(s, 'schools'), null);
});

test('scholars in the settlements study for the nation', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  t.population = 50;
  t.priorities.learning = 'high';
  const high = townStudy(s);
  assert.ok(high > 0);
  t.priorities.learning = 'low';
  assert.equal(townStudy(s), 0);
  t.priorities.learning = 'high';
  s.knowledge.learned.push('schools');
  assert.ok(townStudy(s) > high);
  s.knowledge.current = 'writing';
  const before = s.knowledge.progress.writing || 0;
  for (const p of living(s)) p.task = 'forage';
  s.turn = 5;
  act(s, { type: 'endTurn' });
  const after = applyAction(s, { type: 'endTurn' }).state.knowledge;
  assert.ok((after.progress.writing || 0) > before || after.learned.includes('writing'));
});

test('a fortress turns back raiders and keeps skirmishers away', () => {
  const s = found(readyVillage());
  s.neighbors.skarn.known = true;
  nation(s, 'skarn').warriors = 30;
  const helpers = alliedHelpers(s);
  const harry = harryChance(s);
  const t = s.settlements[0];
  t.role = 'fortress';
  t.population = 30;
  assert.ok(fortressHelp(s) >= 3);
  assert.equal(alliedHelpers(s), helpers + fortressHelp(s));
  assert.equal(fortressWatch(s), 0.85);
  assert.ok(Math.abs(harryChance(s) - harry * 0.85) < 1e-9);
});

test('the governor builds homes, walls, and the works of its role', () => {
  const s = found(readyVillage());
  const t = s.settlements[0];
  t.population = 22;
  t.buildings.homes = 4;
  assert.equal(nextProject(s, t), 'palisade');
  t.buildings.palisade = 1;
  assert.equal(nextProject(s, t), 'works');
  t.population = 31;
  assert.equal(nextProject(s, t), 'homes', 'room for 32 is too little for 31');
  t.buildings.homes = 6;
  t.buildings.works = { farming: 3 };
  assert.equal(nextProject(s, t), 'hall');
  const lines = [];
  for (let i = 0; i < 20; i++) lines.push(...settlementsSeason(s, { routine: [] }).events);
  assert.ok(lines.some((l) => /Thornfield finished a hall/.test(l)), lines.join(' '));
});

test('settlements with guards drive off skirmishers; without them, settlers die and loyalty falls', () => {
  const s = found(readyVillage());
  s.neighbors.skarn.known = true;
  nation(s, 'skarn').warriors = 200;
  const t = s.settlements[0];
  t.priorities.defense = 'low';
  let killed = 0;
  for (let i = 0; i < 40; i++) {
    for (const l of harrySettlements(s)) if (/killed/.test(l)) killed++;
  }
  assert.ok(killed > 0);
  assert.ok(t.harriedAt != null);
  assert.ok(loyaltyTarget(s, t).reasons.some(([text]) => /skirmishers/.test(text)));
});

test('a capital past 100 people counts its people by group', () => {
  let s = found(readyVillage(3, 110));
  assert.ok(living(s).length > 100);
  for (let i = 0; i < 2 && !s.gameOver; i++) {
    if (s.pendingEvent) break;
    s = act(s, { type: 'endTurn' });
  }
  assert.ok(s.capitalCounted);
  // From then on, births are counted rather than named.
  s.feastThisSeason = true;
  s.resources.food = 5000;
  const out = advanceLife(s);
  assert.ok(!out.events.some((l) => /had a baby, named/.test(l)));
});

test('in the Nation era a large capital can have more than one birth a season', () => {
  const village = readyVillage(4, 110);
  village.buildings.leanTo = 40; // Room for everyone.
  assert.equal(birthOutlook(village).chance, 0.5, 'one a season at most, before the Nation era');
  const s = found(village);
  assert.ok(birthOutlook(s).chance > 1);
});

test('settlements from version 28 saves gain a role, demands, a governor, and loyalty', () => {
  const s = readyVillage();
  const old = JSON.parse(JSON.stringify(s));
  old.version = 28;
  delete old.capitalCounted;
  delete old.buildings.road;
  const gov = living(old)[3];
  old.settlements = [{
    id: 1, name: 'Old Cliffs', place: 'greyCliffs', population: 15, governor: { id: gov.id, name: gov.name },
    people: [{ ...gov, task: 'settler' }, { ...living(old)[4], skills: { ...living(old)[4].skills, building: 5 }, task: 'settler' }],
    policy: 'supply', founded: 3, lastShipment: null,
  }];
  old.era = 'nation';
  const m = migrate(old);
  assert.equal(m.version, SAVE_VERSION);
  const t = settlementById(m, 1);
  assert.equal(t.role, 'mining');
  assert.equal(t.demands, 'heavy');
  assert.equal(t.loyalty, 70);
  assert.equal(t.governor.name, gov.name);
  assert.equal(t.notables.length, 1, 'only the master keeps a name');
  assert.equal(t.people, undefined);
  assert.equal(m.buildings.road, 0);
  assert.equal(m.capitalCounted, false);
  assert.ok(expectedShipment(m, t).kind === 'stone');
});
