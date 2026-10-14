// The interface. It reads the game state and sends actions to the engine;
// it never changes the game state directly. This file wires up the
// screens and the player's clicks; core.js holds what every screen
// shares, and each screen lives in js/ui/screens/.

import { formationPlan } from '../engine/battle.js';
import { newGame } from '../engine/game.js';
import { POLICIES } from '../engine/settlements.js';
import { dateLabel, personById, inVillage } from '../engine/state.js';
import { storage } from '../storage.js';
import { $main, $nav, state, refocus, announce, act, show, render, setState, registerScreens } from './core.js';
import { advisorsScreen } from './screens/advisors.js';
import { raidScreen, positionSummary, readPositions } from './screens/battle.js';
import { buildScreen } from './screens/build.js';
import { chronicleScreen } from './screens/chronicle.js';
import { foundVillageScreen, foundSettlementScreen } from './screens/founding.js';
import { knowledgeScreen } from './screens/knowledge.js';
import { mapScreen } from './screens/map.js';
import { menuScreen } from './screens/menu.js';
import { neighborsScreen } from './screens/neighbors.js';
import { taskCounts, peopleScreen } from './screens/people.js';
import { reportScreen } from './screens/report.js';
import { storyScreen } from './screens/story.js';
import { titleScreen, newGameScreen } from './screens/title.js';
import { villageScreen } from './screens/village.js';

registerScreens({
  title: titleScreen,
  newGame: newGameScreen,
  foundVillage: foundVillageScreen,
  foundSettlement: foundSettlementScreen,
  report: reportScreen,
  people: () => (inVillage(state) ? villageScreen() : peopleScreen()),
  map: mapScreen,
  build: buildScreen,
  knowledge: knowledgeScreen,
  neighbors: neighborsScreen,
  advisors: advisorsScreen,
  chronicle: chronicleScreen,
  menu: menuScreen,
  raid: raidScreen,
  story: storyScreen,
});

// ---------- events ----------

function startNewGame(campName) {
  setState(newGame({ seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, campName }));
  storage.save(state);
  show('report');
}

function triggerImport() {
  const input = document.getElementById('importInput');
  if (input) input.click();
}

$main.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    show(navBtn.dataset.nav);
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  handleAction(btn.dataset.action, btn);
});

$nav.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    show(navBtn.dataset.nav);
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (btn) handleAction(btn.dataset.action, btn);
});

function handleAction(action, btn) {
  switch (action) {
    case 'continue':
      setState(storage.load());
      if (state) show('report');
      break;
    case 'showNewGame':
      show('newGame');
      break;
    case 'title':
      show(state ? 'menu' : 'title');
      break;
    case 'importSave':
      triggerImport();
      break;
    case 'exportSave':
      storage.exportFile(state);
      announce('Save file exported.');
      break;
    case 'endTurn': {
      const msg = act({ type: 'endTurn' });
      if (msg) show('report');
      break;
    }
    case 'queueBuilding': {
      const msg = act({ type: 'queueBuilding', buildingId: btn.dataset.building });
      if (msg) {
        show('build', { focus: false });
        refocus(`[data-action="queueBuilding"][data-building="${btn.dataset.building}"]`, '#queueHeading');
        announce(msg);
      }
      break;
    }
    case 'moveBuilding': {
      const index = Number(btn.dataset.index);
      const by = Number(btn.dataset.by);
      const msg = act({ type: 'moveBuilding', index, by });
      if (msg) {
        show('build', { focus: false });
        refocus(`#queue-item-${index + by}`);
        announce(msg);
      }
      break;
    }
    case 'removeBuilding': {
      const msg = act({ type: 'removeBuilding', index: Number(btn.dataset.index) });
      if (msg) {
        show('build', { focus: false });
        refocus('#queueHeading');
        announce(msg);
      }
      break;
    }
    case 'sallyOut': {
      const msg = act({ type: 'sallyOut' });
      if (msg) {
        show('report');
        announce(msg);
      }
      break;
    }
    case 'payBesiegers': {
      const msg = act({ type: 'payBesiegers', goods: Boolean(btn.dataset.goods) });
      if (msg) {
        show('report');
        announce(msg);
      }
      break;
    }
    case 'hireMaster':
    case 'hireSwords': {
      const msg = act(action === 'hireMaster' ? { type: 'hireMaster', skill: document.getElementById('hireSkill').value } : { type: 'hireSwords' });
      if (msg) {
        show('people', { focus: false });
        refocus('#hireHeading');
        announce(msg);
      }
      break;
    }
    case 'claimPlace': {
      const msg = act({ type: 'claimPlace', placeId: btn.dataset.place });
      if (msg) {
        show('map', { focus: false });
        refocus(`#place-${btn.dataset.place}`, '#landsHeading');
        announce(msg);
      }
      break;
    }
    case 'foundVillage': {
      const msg = act({ type: 'foundVillage' });
      if (msg) {
        show('people');
        announce(msg);
      }
      break;
    }
    case 'holdFeast': {
      const msg = act({ type: 'holdFeast', guest: btn.dataset.guest || null });
      if (msg) {
        show('report', { focus: false });
        refocus('#feastStatus', '#storesHeading');
        announce(msg);
      }
      break;
    }
    case 'giftClans': {
      const msg = act({ type: 'giftClans' });
      if (msg) {
        show('neighbors', { focus: false });
        refocus('#clansHeading', '#neighbor-skarn');
        announce(msg);
      }
      break;
    }
    case 'diplomacy': {
      const id = btn.dataset.neighbor;
      const msg = act({ type: 'diplomacy', neighborId: id, act: btn.dataset.act });
      if (msg) {
        show('neighbors', { focus: false });
        refocus(`#neighbor-${id}`);
        announce(msg);
      }
      break;
    }
    case 'queueStudy':
    case 'unqueueStudy': {
      const msg = act({ type: action, knowledgeId: btn.dataset.knowledge });
      if (msg) {
        show('knowledge', { focus: false });
        refocus('#studyQueueHeading');
        announce(msg);
      }
      break;
    }
    case 'setStudy': {
      const msg = act({ type: 'setStudy', knowledgeId: btn.dataset.knowledge });
      if (msg) {
        show('knowledge', { focus: false });
        announce(msg);
        const h = $main.querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      }
      break;
    }
    case 'assignBest': {
      const msg = act({ type: 'assignBest' });
      if (msg) {
        show('people', { focus: false });
        const again = $main.querySelector('[data-action="assignBest"]');
        if (again) again.focus();
        announce(msg);
      }
      break;
    }
    case 'bulkMove': {
      const from = document.getElementById('bulkFrom').value;
      const to = document.getElementById('bulkTo').value;
      const msg = act({ type: 'assignAll', fromTask: from, task: to });
      if (msg) {
        for (const sel of $main.querySelectorAll('select[data-person]')) {
          const p = personById(state, Number(sel.dataset.person));
          if (p) sel.value = p.task;
        }
        document.getElementById('taskSummary').textContent = `${taskCounts()}.`;
        announce(msg);
      }
      break;
    }
    case 'battleAuto': {
      const msg = act({ type: 'battleAuto' });
      if (msg) show('report');
      break;
    }
    case 'hide':
    case 'callOff': {
      const msg = act({ type: 'resolveRaid', plan: 'hide' });
      if (msg) show('report');
      break;
    }
    case 'battleRetreat': {
      if (!window.confirm('Abandon the fight? The raiders will take what they want.')) break;
      const msg = act({ type: 'battleRetreat' });
      if (msg) show('report');
      break;
    }
    case 'applyFormation': {
      const plan = formationPlan(state, state.pendingEvent.battle, document.getElementById('formation').value);
      for (const sel of $main.querySelectorAll('select[data-position]')) sel.value = plan[sel.dataset.position] || 'out';
      document.getElementById('deploySummary').textContent = positionSummary(readPositions());
      announce(`Fighters arranged. ${positionSummary(readPositions())}`);
      break;
    }
    default:
      break;
  }
}

$main.addEventListener('change', (e) => {
  const sel = e.target.closest('select[data-person]');
  if (sel) {
    const ok = act({ type: 'assign', personId: Number(sel.dataset.person), task: sel.value });
    if (ok) document.getElementById('taskSummary').textContent = `${taskCounts()}.`;
    return;
  }
  if (e.target.id === 'peopleView') {
    storage.setSetting('peopleView', e.target.value);
    render();
    const again = document.getElementById('peopleView');
    if (again) again.focus();
    announce(e.target.value === 'compact' ? 'Compact list.' : 'Detailed list.');
    return;
  }
  const site = e.target.closest('select[data-site]');
  if (site) {
    const msg = act({ type: 'setWorkSite', task: site.dataset.site, placeId: site.value });
    if (msg) announce(msg);
    return;
  }
  const policySel = e.target.closest('select[data-settlement-policy]');
  if (policySel) {
    const msg = act({ type: 'setSettlementPolicy', settlementId: Number(policySel.dataset.settlementPolicy), policy: policySel.value });
    if (msg) {
      const about = document.getElementById(`policy-${policySel.dataset.settlementPolicy}-about`);
      if (about) about.textContent = ` ${POLICIES[policySel.value].about}`;
      announce(msg);
    }
    return;
  }
  const lawSel = e.target.closest('select[data-law]');
  if (lawSel) {
    const law = lawSel.dataset.law;
    const msg = act({ type: 'setLaw', law, option: lawSel.value || null });
    if (msg) {
      show('people', { focus: false });
      refocus(`#law-${law}`, '#lawsHeading');
      announce(msg);
    } else {
      lawSel.value = state.laws[law] || '';
    }
    return;
  }
  const stores = e.target.closest('select[data-food-stores]');
  if (stores) {
    const msg = act({ type: 'setFoodStores', choice: stores.value });
    if (msg) {
      // Redraw so the target in the description matches the new choice.
      show('people', { focus: false });
      refocus('#foodStores');
      announce(msg);
    }
    return;
  }
  const priority = e.target.closest('select[data-priority]');
  if (priority) {
    const msg = act({ type: 'setPriority', area: priority.dataset.priority, level: priority.value });
    if (msg) announce(msg);
    return;
  }
  const order = e.target.closest('[data-order]');
  if (order) {
    const value = order.type === 'checkbox' ? order.checked : order.value;
    act({ type: 'setOrder', id: order.dataset.order, value });
    return;
  }
  if (e.target.matches('select[data-position]')) {
    document.getElementById('deploySummary').textContent = positionSummary(readPositions());
    return;
  }
  if (e.target.id === 'importInput' && e.target.files[0]) {
    storage.importFile(e.target.files[0])
      .then((data) => {
        setState(data);
        storage.save(state);
        show('report');
        announce(`Loaded ${state.campName}, ${dateLabel(state)}.`);
      })
      .catch((err) => announce(err.message));
  }
});

$main.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'newGameForm') {
    startNewGame(document.getElementById('campName').value);
    return;
  }
  if (e.target.id === 'storyForm') {
    const picked = e.target.querySelector('input[name="choice"]:checked');
    if (!picked) {
      announce('Choose one of the options first.');
      return;
    }
    const msg = act({ type: 'resolveEvent', choice: picked.value });
    if (msg) show('report');
    return;
  }
  if (e.target.id === 'settlementForm') {
    const place = e.target.querySelector('input[name="settlementPlace"]:checked');
    const policy = e.target.querySelector('input[name="settlementPolicy"]:checked');
    const msg = act({
      type: 'foundSettlement',
      placeId: place ? place.value : null,
      name: document.getElementById('settlementName').value,
      settlers: Number(document.getElementById('settlementCount').value),
      governorId: Number(document.getElementById('settlementGovernor').value),
      policy: policy ? policy.value : 'grow',
    });
    if (msg) {
      show('people');
      announce(msg);
    }
    return;
  }
  if (e.target.id === 'deployForm') {
    const msg = act({ type: 'battleDeploy', assignments: readPositions() });
    if (msg) show('report');
    return;
  }
  if (e.target.id === 'ordersForm') {
    const orders = {};
    for (const sel of e.target.querySelectorAll('select[data-zone]')) orders[sel.dataset.zone] = sel.value;
    const msg = act({ type: 'battleOrders', orders });
    if (msg) show('report');
  }
});

// ---------- start ----------

show('title');

