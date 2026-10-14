// Events that only happen in a village: rivalries between groups, heroes,
// fires, herds, travelers, the council's own opinions, festivals, and the
// neighbors at your borders. Most are choices. They join the other events.

import { NEIGHBORS, PRIORITY_AREAS, SKILLS, PLACES } from './data.js';
import {
  living, inVillage, seasonIndex, year, placeName, knownPlaces, canFight, personById,
} from './state.js';
import { advisorPerson, ADVISOR_ROLES } from './advisors.js';
import { GROUP_NAMES, newcomer } from './village.js';
import { changeRelation } from './neighbors.js';
import {
  nation, nationsActive, remember, owner,
} from './nations.js';
import { recordDeed } from './legacy.js';
import { chance, pick, randomInt } from './rng.js';
import { clamp, listNames, capital } from './util.js';

const WORK_GROUPS = ['farm', 'hunt', 'forage', 'wood', 'quarry', 'craft', 'build'];

function members(state, task) {
  return living(state).filter((p) => p.task === task && p.age >= 16);
}

function lift(people, amount) {
  for (const p of people) p.morale = clamp(p.morale + amount);
}

// The two largest working groups, if both have at least 3 adults.
function rivalGroups(state) {
  const sized = WORK_GROUPS.map((t) => [t, members(state, t).length]).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  return sized.length >= 2 ? [sized[0][0], sized[1][0]] : null;
}

const RIVAL_REASONS = ['the best land near the village', 'who eats first at the long table', 'the good tools', 'who works hardest', 'a broken promise between two families'];

// What each kind of hero does, by their best skill.
const HERO_DEEDS = {
  hunting: 'killed a great bear that had been taking the herds',
  foraging: 'found a hidden grove of wild fruit trees',
  building: 'held up the roof of a burning hut until everyone was out',
  healing: 'saved a mother and her baby through a terrible birth',
  scouting: 'found a hidden pass through the hills, and came back to tell of it',
  learning: 'worked out how to read the seasons in the stars',
};

function bestSkill(p) {
  return [...SKILLS].sort((a, b) => p.skills[b] - p.skills[a])[0];
}

function heroCandidates(state) {
  const heroes = new Set((state.heroes || []).map((h) => h.id));
  return living(state).filter((p) => p.age >= 16 && p.health >= 40 && !heroes.has(p.id) && p.skills[bestSkill(p)] >= 4);
}

function shelters(state) {
  return (state.buildings.hut || 0) + (state.buildings.leanTo || 0);
}

// Lose one shelter, a hut before a lean-to. Returns its name.
function loseShelter(state) {
  if (state.buildings.hut > 0) { state.buildings.hut -= 1; return 'a hut'; }
  if (state.buildings.leanTo > 0) { state.buildings.leanTo -= 1; return 'a lean-to'; }
  return null;
}

// A priority the council member would push, and why. Or null.
function objection(state) {
  const pr = state.priorities;
  const able = living(state).filter(canFight).length;
  const sk = nation(state, 'skarn');
  const options = [];
  if (sk && state.neighbors.skarn.known && sk.warriors >= able * 0.5 && pr.defense !== 'high') {
    options.push({ role: 'warChief', area: 'defense', why: `The Skarn have about ${sk.warriors} warriors, and we have ${able} fit to fight. We need more guards on the walls.` });
  }
  if (state.knowledge.current && pr.learning !== 'high') {
    options.push({ role: 'scholar', area: 'learning', why: 'We are close to understanding so much more. Give me more scholars, and we will get there years sooner.' });
  }
  if (state.buildQueue.length >= 3 && pr.building !== 'high') {
    options.push({ role: 'steward', area: 'building', why: `There are ${state.buildQueue.length} buildings waiting in the queue. At this pace, some of us will be old before they stand.` });
  }
  return options;
}

// Neighboring nations whose land touches land the village holds.
function borderNeighbors(state) {
  if (!nationsActive(state)) return [];
  return ['velari', 'tellani'].filter((id) => state.neighbors[id].known && Object.keys(state.places)
    .some((pl) => owner(state, pl) === 'player' && PLACES[pl].neighbors.some((n) => owner(state, n) === id)));
}

export const VILLAGE_EVENTS = {
  rivalry: {
    choice: true,
    weight: (state) => (inVillage(state) && rivalGroups(state) ? 0.6 : 0),
    start(state) {
      const [a, b] = rivalGroups(state);
      return { a, b, reason: pick(state, RIVAL_REASONS) };
    },
    view(state, ev) {
      const A = GROUP_NAMES[ev.a].toLowerCase();
      const B = GROUP_NAMES[ev.b].toLowerCase();
      const hall = state.buildings.meetingHall > 0;
      const options = [
        { id: 'a', label: `Side with the ${A}.` },
        { id: 'b', label: `Side with the ${B}.` },
        { id: 'split', label: 'Split the difference. Neither side will be happy.' },
      ];
      if (hall) options.push({ id: 'council', label: 'Let the council hear both sides in the meeting hall.' });
      else if ((state.resources.goods || 0) >= 5) options.push({ id: 'council', label: 'Let the council judge, with 5 goods to settle the losers.' });
      return {
        title: 'A rivalry in the village',
        text: `The ${A} and the ${B} have fallen out over ${ev.reason}. Voices are raised around every fire, and both sides want the council to choose.`,
        options,
        advice: [['steward', `There are ${members(state, ev.a).length} ${A} and ${members(state, ev.b).length} ${B}. Whoever loses will sulk at their work for a while.`]],
      };
    },
    resolve(state, ev, choice) {
      const A = members(state, ev.a);
      const B = members(state, ev.b);
      const nameA = GROUP_NAMES[ev.a].toLowerCase();
      const nameB = GROUP_NAMES[ev.b].toLowerCase();
      if (choice === 'a' || choice === 'b') {
        const [win, lose, wn, ln] = choice === 'a' ? [A, B, nameA, nameB] : [B, A, nameB, nameA];
        lift(win, 8);
        lift(lose, -12);
        return [`You sided with the ${wn}. They are pleased; the ${ln} are bitter.`];
      }
      if (choice === 'council') {
        if (!state.buildings.meetingHall) state.resources.goods -= 5;
        lift(living(state), 3);
        return ['The council heard both sides and found a fair way through. The village is calmer for it.'];
      }
      lift([...A, ...B], -3);
      return ['You split the difference. Both sides grumble, but the quarrel cooled.'];
    },
  },

  heroDeed: {
    choice: true,
    weight: (state) => (inVillage(state) && heroCandidates(state).length ? 0.5 : 0),
    start(state) {
      const p = pick(state, heroCandidates(state));
      return { person: p.id, skill: bestSkill(p) };
    },
    view(state, ev) {
      const p = personById(state, ev.person);
      const name = p ? p.name : 'Someone';
      const options = [];
      if ((state.resources.stone || 0) >= 10) options.push({ id: 'cairn', label: `Raise a cairn of 10 stone in ${name}'s honor, for all to see.` });
      const feast = living(state).length * 2;
      if (state.resources.food >= feast) options.push({ id: 'feast', label: `Hold a feast in ${name}'s name, with ${feast} food.` });
      options.push({ id: 'thanks', label: `Thank ${name} quietly, in front of the council.` });
      return {
        title: 'A hero of the village',
        text: `${name} ${HERO_DEEDS[ev.skill]}. The whole village is talking about it.`,
        options,
        advice: [['speaker', 'Deeds like this are how a village remembers who it is. How we honor them will be remembered too.']],
      };
    },
    resolve(state, ev, choice) {
      const p = personById(state, ev.person);
      if (!p || !p.alive) return ['The moment passed.'];
      state.heroes = state.heroes || [];
      state.heroes.push({ id: p.id, name: p.name, deed: HERO_DEEDS[ev.skill], year: year(state) });
      if (p.skills[ev.skill] < 5) p.skills[ev.skill] += 1;
      if (choice === 'cairn' && (state.resources.stone || 0) >= 10) {
        state.resources.stone -= 10;
        lift(living(state), 8);
        return [`A cairn now stands for ${p.name}, who ${HERO_DEEDS[ev.skill]}. Everyone who passes it stands a little taller.`];
      }
      if (choice === 'feast' && state.resources.food >= living(state).length * 2) {
        state.resources.food -= living(state).length * 2;
        lift(living(state), 10);
        recordDeed(state, 'feasts');
        return [`The village feasted in ${p.name}'s name. The story of the deed will be told for years.`];
      }
      lift([p], 15);
      return [`The council thanked ${p.name} before everyone. ${p.name} is now remembered as a hero of the village.`];
    },
  },

  hutFire: {
    choice: true,
    weight: (state) => (inVillage(state) && shelters(state) >= 2 ? (seasonIndex(state) === 3 ? 0.6 : 0.4) : 0),
    start: () => ({}),
    view(state) {
      return {
        title: 'Fire in the village',
        text: 'A spark from a cooking fire caught the thatch, and the flames are spreading from roof to roof.',
        options: [
          { id: 'fight', label: 'Everyone fights the fire. Some will be burned, but every home may be saved.' },
          { id: 'break', label: 'Pull down the next two homes to stop it spreading. No one gets hurt, but you lose them.' },
          { id: 'stores', label: 'Save the stores and let the home burn.' },
        ],
        advice: [['healer', 'Burns are slow to heal. But a village without roofs in winter is worse.']],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'fight') {
        const hurt = living(state).filter((p) => p.age >= 12 && p.health >= 40).slice(0, randomInt(state, 2, 3));
        for (const p of hurt) p.health = clamp(p.health - randomInt(state, 15, 25));
        if (chance(state, 0.8)) return [`The village beat the fire back. ${listNames(hurt)} ${hurt.length === 1 ? 'was' : 'were'} burned, but every home still stands.`];
        const lost = loseShelter(state);
        return [`The village fought hard, but the fire took ${lost} all the same. ${listNames(hurt)} ${hurt.length === 1 ? 'was' : 'were'} burned.`];
      }
      if (choice === 'break') {
        const lost = [loseShelter(state), loseShelter(state)].filter(Boolean);
        return [`Your people pulled down ${listNames(lost.map((x) => ({ name: x })))} to stop the fire. No one was hurt.`];
      }
      const lost = loseShelter(state);
      const food = Math.floor(state.resources.food * 0.1);
      state.resources.food -= food;
      return [`The fire took ${lost}, and ${food} food stored inside it. The main stores were saved.`];
    },
  },

  herdSickness: {
    choice: true,
    weight: (state) => (inVillage(state) && state.buildings.pasture > 0 ? 0.5 : 0),
    start: () => ({}),
    view(state) {
      const healer = living(state).filter((p) => p.health >= 40).sort((a, b) => b.skills.healing - a.skills.healing)[0];
      const options = [{ id: 'cull', label: 'Cull the sick animals at once. You will lose one pasture\'s herd, but no more.' }];
      if (healer && healer.skills.healing >= 3) options.push({ id: 'tend', label: `Have ${healer.name} tend the herds. Most likely they recover.` });
      options.push({ id: 'fate', label: 'Leave it to fate.' });
      return {
        title: 'Sickness in the herds',
        text: 'Goats in the pastures are coughing and refusing their feed. The herders fear it will spread.',
        options,
        advice: [['healer', healer && healer.skills.healing >= 3 ? 'I have seen this before. With care, most will pull through.' : 'I do not know this sickness well.']],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'cull') {
        state.buildings.pasture = Math.max(0, state.buildings.pasture - 1);
        return ['You culled the sick animals. One pasture stands empty, but the sickness stopped there.'];
      }
      if (choice === 'tend' && chance(state, 0.75)) return ['Your healer nursed the herds through. The sickness passed.'];
      if (choice === 'fate' && chance(state, 0.5)) return ['The sickness passed on its own. You were lucky.'];
      const lost = Math.min(state.buildings.pasture, 2);
      state.buildings.pasture -= lost;
      return [`The sickness spread through the herds. ${lost === 1 ? 'One pasture stands' : `${lost} pastures stand`} empty.`];
    },
  },

  craftsman: {
    choice: true,
    weight: (state) => (inVillage(state) ? 0.4 : 0),
    start: () => ({}),
    view(state) {
      const options = [];
      if ((state.resources.goods || 0) >= 15) options.push({ id: 'goods', label: 'Pay him 15 goods to stay a season and teach.' });
      if (state.resources.food >= 30) options.push({ id: 'food', label: 'Pay him 30 food to stay a season and teach.' });
      options.push({ id: 'decline', label: 'Thank him and send him on his way.' });
      return {
        title: 'A traveling craftsman',
        text: 'A grey-bearded craftsman arrives with a pack of tools and tales of the great towns beyond the hills. For a price, he will stay a season and teach what he knows.',
        options,
        advice: [['scholar', 'A man like that carries a lifetime of knowing. Our builders and scholars would learn a great deal.']],
      };
    },
    resolve(state, ev, choice) {
      const paid = (choice === 'goods' && (state.resources.goods || 0) >= 15) || (choice === 'food' && state.resources.food >= 30);
      if (!paid) return ['The craftsman shrugged and went on his way.'];
      if (choice === 'goods') state.resources.goods -= 15;
      else state.resources.food -= 30;
      const pupils = living(state).filter((p) => p.age >= 12 && ['build', 'craft', 'quarry', 'wood'].includes(p.task) && p.skills.building < 5)
        .sort((a, b) => b.skills.building - a.skills.building).slice(0, 3);
      for (const p of pupils) p.skills.building += 1;
      const k = state.knowledge;
      let study = '';
      if (k.current) {
        k.progress[k.current] = (k.progress[k.current] || 0) + 15;
        study = ' He also shared ideas that moved your scholars\' study along.';
      }
      return [`The craftsman stayed and taught.${pupils.length ? ` ${listNames(pupils)} ${pupils.length === 1 ? 'is' : 'are'} better builders for it.` : ''}${study}`];
    },
  },

  councilObjects: {
    choice: true,
    weight: (state) => (inVillage(state) && objection(state).length ? 0.5 : 0),
    start(state) {
      const o = pick(state, objection(state));
      return { role: o.role, area: o.area, why: o.why };
    },
    view(state, ev) {
      const adv = advisorPerson(state, ev.role);
      const name = adv ? adv.name : `Your ${ADVISOR_ROLES[ev.role].title.toLowerCase()}`;
      const area = PRIORITY_AREAS[ev.area].name.toLowerCase();
      const current = state.priorities[ev.area];
      const options = [{ id: 'agree', label: `Agree, and set the ${area} priority to high.` }];
      if (current === 'low') options.push({ id: 'compromise', label: `Meet them halfway: set it to normal.` });
      options.push({ id: 'overrule', label: `Overrule ${name}. The priorities stay as they are.` });
      return {
        title: `${name} disagrees`,
        text: `${name}, your ${ADVISOR_ROLES[ev.role].title.toLowerCase()}, speaks up before the council: "${ev.why}" The ${area} priority is ${current} now.`,
        options,
        advice: [],
      };
    },
    resolve(state, ev, choice) {
      const adv = advisorPerson(state, ev.role);
      const area = PRIORITY_AREAS[ev.area].name.toLowerCase();
      if (choice === 'agree') {
        state.priorities[ev.area] = 'high';
        if (adv) lift([adv], 10);
        return [`You agreed. The ${area} priority is now high.`];
      }
      if (choice === 'compromise' && state.priorities[ev.area] === 'low') {
        state.priorities[ev.area] = 'normal';
        return [`You met them halfway. The ${area} priority is now normal.`];
      }
      if (adv) lift([adv], -15);
      lift(living(state), -2);
      return [`You overruled ${adv ? adv.name : 'them'}. The council follows your word, though not happily.`];
    },
  },

  festival: {
    choice: true,
    weight: (state) => (inVillage(state) && [1, 2].includes(seasonIndex(state)) ? 0.5 : 0),
    start: () => ({}),
    view(state) {
      const food = living(state).length * 2;
      const options = [];
      if ((state.resources.goods || 0) >= 10) options.push({ id: 'goods', label: 'Celebrate with 10 goods: garlands, music, and gifts for the children.' });
      if (state.resources.food >= food) options.push({ id: 'food', label: `Celebrate with a feast of ${food} food.` });
      options.push({ id: 'skip', label: 'Not this year. There is too much to do.' });
      return {
        title: 'Festival day',
        text: `It is ${seasonIndex(state) === 1 ? 'midsummer' : 'harvest time'}, and the young people of the village want a festival like the ones the old ones remember.`,
        options,
        advice: [['speaker', 'A village that never celebrates forgets what it works for.']],
      };
    },
    resolve(state, ev, choice) {
      if (choice === 'goods' && (state.resources.goods || 0) >= 10) {
        state.resources.goods -= 10;
        lift(living(state), 10);
        recordDeed(state, 'feasts');
        return ['The festival filled the village with music and garlands. Spirits are high.'];
      }
      if (choice === 'food' && state.resources.food >= living(state).length * 2) {
        state.resources.food -= living(state).length * 2;
        lift(living(state), 8);
        recordDeed(state, 'feasts');
        return ['The festival feast went on late into the night. Spirits are high.'];
      }
      lift(living(state), -4);
      return ['There was no festival this year. The young people were disappointed.'];
    },
  },

  marriage: {
    choice: true,
    weight: (state) => (inVillage(state) && ['velari', 'tellani'].some((id) => state.neighbors[id].known && state.neighbors[id].relation >= 20) ? 0.35 : 0),
    start(state) {
      return { from: pick(state, ['velari', 'tellani'].filter((id) => state.neighbors[id].known && state.neighbors[id].relation >= 20)) };
    },
    view(state, ev) {
      const who = NEIGHBORS[ev.from];
      return {
        title: 'A wedding between peoples',
        text: `A young person from ${who.name} and one of yours want to marry, and the newcomer would come to live in the village. Their families are waiting to hear what the council says.`,
        options: [
          { id: 'welcome', label: `Welcome them. It will bind your people to ${who.name}.` },
          { id: 'forbid', label: 'Forbid it. Your people marry their own.' },
        ],
        advice: [['speaker', `${capital(who.name)} would take a welcome as a great honor, and a refusal as an insult.`]],
      };
    },
    resolve(state, ev, choice) {
      const who = NEIGHBORS[ev.from];
      if (choice === 'welcome') {
        const p = newcomer(state, `Came from ${who.name} to marry into the village.`);
        changeRelation(state, ev.from, 8);
        recordDeed(state, 'welcomed');
        remember(state, ev.from, `welcomed one of their people in marriage in Year ${year(state)}`, 4);
        return [`The wedding was a joyful one. ${p.name} of ${who.name} now lives in the village, and the two peoples are closer for it.`];
      }
      changeRelation(state, ev.from, -6);
      recordDeed(state, 'turnedAway');
      return [`You forbade the marriage. ${capital(who.name)} took it as an insult.`];
    },
  },

  borderGrazing: {
    choice: true,
    weight: (state) => (borderNeighbors(state).length ? 0.4 : 0),
    start(state) {
      const from = pick(state, borderNeighbors(state));
      const place = pick(state, Object.keys(state.places).filter((pl) => owner(state, pl) === 'player' && pl !== 'camp'
        && PLACES[pl].neighbors.some((n) => owner(state, n) === from)));
      return { from, place: place || 'camp' };
    },
    view(state, ev) {
      const who = NEIGHBORS[ev.from];
      return {
        title: 'Herders on your land',
        text: `Herders from ${who.name} have driven their animals onto ${placeName(state, ev.place)}, which your village holds. They say the grazing has always been open to all.`,
        options: [
          { id: 'share', label: 'Let them graze. There is enough for everyone.' },
          { id: 'drive', label: 'Drive them off. The land is yours.' },
          { id: 'pay', label: 'Let them stay, for a payment of 15 food.' },
        ],
        advice: [['speaker', `Driving them off would anger ${who.name}. Asking for payment might, too, if they do not think well of us.`]],
      };
    },
    resolve(state, ev, choice) {
      const who = NEIGHBORS[ev.from];
      if (choice === 'share') {
        changeRelation(state, ev.from, 4);
        return [`You let ${who.name} graze ${placeName(state, ev.place)}. They were grateful.`];
      }
      if (choice === 'drive') {
        changeRelation(state, ev.from, -8);
        remember(state, ev.from, `drove their herders off ${placeName(state, ev.place)} in Year ${year(state)}`, -3);
        return [`Your people drove the herders off ${placeName(state, ev.place)}. ${capital(who.name)} are angry.`];
      }
      if (state.neighbors[ev.from].relation >= 0) {
        state.resources.food += 15;
        changeRelation(state, ev.from, -2);
        return [`${capital(who.name)} paid 15 food to graze ${placeName(state, ev.place)} for the season.`];
      }
      changeRelation(state, ev.from, -6);
      return [`${capital(who.name)} refused to pay, and went home angry.`];
    },
  },

  refugees: {
    choice: true,
    weight: (state) => {
      if (!nationsActive(state) || state.laws?.strangers === 'closed') return 0;
      const sk = nation(state, 'skarn');
      return sk && sk.warriors >= 10 && ['velari', 'tellani'].some((id) => state.neighbors[id].known) ? 0.35 : 0;
    },
    start(state) {
      return {
        from: pick(state, ['velari', 'tellani'].filter((id) => state.neighbors[id].known)),
        count: randomInt(state, 3, 5),
      };
    },
    view(state, ev) {
      const who = NEIGHBORS[ev.from];
      const need = ev.count * 2;
      return {
        title: 'Refugees at the gate',
        text: `${ev.count} people of ${who.name} have come to the gate, fleeing Skarn raids. They ask for shelter. Each will eat 2 food a season.`,
        options: [
          { id: 'all', label: `Take in all ${ev.count}.` },
          { id: 'some', label: 'Take in two who can work.' },
          { id: 'turn', label: 'Turn them away.' },
        ],
        advice: [['steward', `${ev.count} more mouths is ${need} more food a season. We have ${state.resources.food}.`], ['speaker', `${capital(who.name)} will remember what we do.`]],
      };
    },
    resolve(state, ev, choice) {
      const who = NEIGHBORS[ev.from];
      if (choice === 'turn') {
        changeRelation(state, ev.from, -6);
        recordDeed(state, 'turnedAway');
        remember(state, ev.from, `turned away their people fleeing the Skarn in Year ${year(state)}`, -5);
        return [`You turned the refugees away. ${capital(who.name)} will not forget it.`];
      }
      const n = choice === 'all' ? ev.count : 2;
      const came = [];
      for (let i = 0; i < n; i++) came.push(newcomer(state, `Fled the Skarn from ${who.name}.`));
      changeRelation(state, ev.from, choice === 'all' ? 8 : 3);
      recordDeed(state, 'welcomed');
      remember(state, ev.from, `took in their people fleeing the Skarn in Year ${year(state)}`, choice === 'all' ? 8 : 3);
      return [`${listNames(came)} found shelter in the village.`];
    },
  },

  ruins: {
    weight: (state) => (inVillage(state) && knownPlaces(state).length >= 8 ? 0.3 : 0),
    apply(state) {
      const place = pick(state, knownPlaces(state).filter((id) => id !== 'camp'));
      const k = state.knowledge;
      if (k.current) {
        k.progress[k.current] = (k.progress[k.current] || 0) + 20;
        return { events: [`Scouts found old ruins at ${placeName(state, place)}: carved stones and broken tools from people long gone. Your scholars learned from them, and their study moved ahead.`] };
      }
      state.resources.goods = (state.resources.goods || 0) + 10;
      return { events: [`Scouts found old ruins at ${placeName(state, place)}, and brought back 10 goods' worth of old tools and beads.`] };
    },
  },
};
