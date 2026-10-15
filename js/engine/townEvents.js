// Events the nation's own settlements bring: a settlement whose loyalty has
// fallen below 20 defies the capital. It comes on its own, before any other
// event, rather than by chance.

import { settlementById, loyaltyReasonsText, governorSkill, ROLES } from './realm.js';
import {
  defiantTown, aidCost, appointGovernor, bestGovernorFor,
} from './settlements.js';
import { placeRegion } from './data.js';
import { clamp } from './util.js';

// An army close enough to bring a defiant settlement to heel: in the valley,
// or in the settlement's own region.
function armyNear(state, t) {
  return (state.armies || []).find((a) => !a.march && (a.location === 'valley' || a.location === placeRegion(t.place))
    && a.companies.some((c) => c.soldiers > 0)) || null;
}

export const TOWN_EVENTS = {
  defiance: {
    choice: true,
    weight: () => 0,
    start(state) {
      return { town: defiantTown(state).id };
    },
    view(state, ev) {
      const t = settlementById(state, ev.town);
      const goods = aidCost(t, 'goods');
      const food = aidCost(t, 'food');
      const next = bestGovernorFor(state, t);
      const options = [];
      if ((state.resources.goods || 0) >= goods) options.push({ id: 'goods', label: `Send ${goods} goods to win them back.` });
      if (state.resources.food >= food) options.push({ id: 'food', label: `Send ${food} food to win them back.` });
      if (next) options.push({ id: 'governor', label: `Send ${next.name} to govern in ${t.governor.name}'s place.` });
      const army = armyNear(state, t);
      if (army) options.push({ id: 'army', label: `Send the ${army.name.toLowerCase()} to bring them to heel. They will obey, but resent it, and your other settlements will hear of it.` });
      options.push({ id: 'keep', label: 'Let them keep all they make for a year.' });
      const skill = governorSkill(t);
      return {
        title: `${t.name} defies you`,
        text: `${t.governor.name}, governor of ${t.name}, has sent word that the settlement will send nothing more to ${state.campName}. Its loyalty has fallen to ${t.loyalty}, because of ${loyaltyReasonsText(state, t, { against: true })}.`,
        options,
        advice: [
          ['speaker', `Gifts would win back their goodwill for now, but unless what drove them to this changes, it will fall again. ${t.demands === 'heavy' ? 'Heavy demands are the root of it.' : ''}`.trim()],
          ['steward', next ? `${next.name} has ${skill} ${next.skills[skill]} and learning ${next.skills.learning}; a fresh governor would calm them, for a time.` : `No one in ${state.campName} is free to govern there; letting them be for a year costs us what a ${ROLES[t.role].name.toLowerCase()} sends, and nothing else.`],
        ],
      };
    },
    resolve(state, ev, choice) {
      const t = settlementById(state, ev.town);
      if (choice === 'goods' || choice === 'food') {
        const cost = aidCost(t, choice);
        state.resources[choice] -= cost;
        t.lastAid = state.turn;
        t.loyalty = clamp(t.loyalty + 30);
        return [`You sent ${cost} ${choice} to ${t.name}, and ${t.governor.name} agreed to send home what its demands ask. Its loyalty is ${t.loyalty} now.`];
      }
      if (choice === 'governor') {
        const next = bestGovernorFor(state, t);
        const before = t.loyalty;
        const old = t.governor.name;
        appointGovernor(state, { settlementId: t.id, personId: next.id });
        t.loyalty = clamp(before + 20);
        return [`${next.name} rode to ${t.name} to govern in ${old}'s place, and ${old} came home to ${state.campName}. The settlement will send home what its demands ask; its loyalty is ${t.loyalty} now.`];
      }
      if (choice === 'army' && armyNear(state, t)) {
        const army = armyNear(state, t);
        t.loyalty = 35;
        t.population = Math.max(3, t.population - 1);
        for (const other of state.settlements.filter((x) => x !== t)) other.loyalty = clamp(other.loyalty - 5);
        return [`The ${army.name.toLowerCase()} marched into ${t.name}, and ${t.governor.name} gave way. One of its people was killed in the scuffles. It will send home what its demands ask, though its loyalty is only ${t.loyalty}, and your other settlements, hearing of it, are 5 less loyal.`];
      }
      t.keepUntil = state.turn + 4;
      t.demands = 'light';
      return [`You let ${t.name} keep all it makes for a year. Its demands are light now, and its people should warm to you again.`];
    },
  },
};

// The defiance of a settlement comes before any other event.
export function townCrisis(state) {
  return defiantTown(state) ? 'defiance' : null;
}
