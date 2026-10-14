// The title screen and the new game screen.

import { dateLabel } from '../../engine/state.js';
import { storage } from '../../storage.js';
import { esc } from '../core.js';

export function titleScreen() {
  const saved = storage.load();
  return `
    <h1>Embers to Orbit</h1>
    <p>Lead a handful of survivors from a single campfire to a nation among the stars.</p>
    <div class="actions">
      ${saved ? `<button type="button" class="primary" data-action="continue">Continue: ${esc(saved.campName)}, ${esc(dateLabel(saved))}</button>` : ''}
      <button type="button" ${saved ? '' : 'class="primary"'} data-action="showNewGame">New game</button>
      <button type="button" data-action="importSave">Load a save file</button>
    </div>
    <input type="file" id="importInput" accept=".json,application/json" class="visually-hidden" tabindex="-1" aria-hidden="true">
    <h2>About this version</h2>
    <p>Twelve survivors in a forest valley, trying to last through their first winters. Grow strong enough and your camp can become a village, the start of the Settlement era.</p>`;
}

export function newGameScreen() {
  const saved = storage.load();
  return `
    <h1>New game</h1>
    <form id="newGameForm">
      <p><label for="campName">Name your camp</label></p>
      <p><input type="text" id="campName" value="Emberhold" maxlength="30" autocomplete="off"></p>
      <p>Starting region: Forest valley. Mild seasons and plenty of food and timber. Harder regions will come in a later update.</p>
      ${saved ? '<p class="warning">Starting a new game replaces your current saved game.</p>' : ''}
      <div class="actions">
        <button type="submit" class="primary">Start</button>
        <button type="button" data-action="title">Back</button>
      </div>
    </form>`;
}
