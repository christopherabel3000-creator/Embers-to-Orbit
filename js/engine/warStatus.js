// Small questions about wars and armies that many parts of the game ask:
// who you are at war with, whether an army holds a region, whether an
// enemy's home is under siege. They only read the state, and import only
// data, so the nations, the settlements, and the season can all use them.

import { FOES } from './armyData.js';

export function atWar(state, foe) {
  return Boolean(state.wars && state.wars[foe]);
}

export function warsNow(state) {
  return Object.keys(state.wars || {});
}

// Whether an army stands in this region (not marching) under orders to hold it.
export function armyHolding(state, region) {
  return (state.armies || []).some((a) => a.location === region && !a.march && a.order === 'hold' && a.companies.some((c) => c.soldiers > 0));
}

// Whether one of your armies besieges this people's home.
export function homeBesieged(state, foe) {
  return (state.armies || []).some((a) => a.siege && a.siege.foe === foe && !a.march && a.location === FOES[foe].home);
}

// Whether an army holds the high pass.
export function passHeld(state) {
  return (state.armies || []).some((a) => a.location === 'hills' && !a.march && a.order === 'holdPass');
}

// Full years the longest war has lasted.
export function warYears(state) {
  const since = warsNow(state).map((id) => state.wars[id].since);
  return since.length ? Math.floor((state.turn - Math.min(...since)) / 4) : 0;
}

// What a long war costs at home: the settlements are 2 less loyal for each
// year after the first, up to 8; spirits in the capital settle 1 lower for
// each, up to 4.
export function warWeariness(state) {
  const years = Math.max(0, warYears(state) - 1);
  return { loyalty: Math.min(8, 2 * years), spirits: Math.min(4, years) };
}

// A war declared without cause, or breaking your word, troubles your own
// people for two years.
export function unjustWar(state) {
  return (state.unjustWarUntil ?? -1) > state.turn;
}

// Soldiers away from a settlement, who are not paid professionals.
export function leviesFrom(state, townId) {
  return (state.armies || []).flatMap((a) => a.companies).filter((c) => c.from === townId && c.training !== 'standing')
    .reduce((sum, c) => sum + c.soldiers + c.wounded, 0);
}
