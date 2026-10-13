// The save layer. All saving and loading goes through this module, so the
// browser storage used now can later be swapped for native app storage or
// Steam Cloud without touching the game itself.

import { migrate } from './engine/state.js';

// The key stays the same across save versions; old saves are upgraded on load.
const KEY = 'embers-to-orbit/save/v1';

function upgrade(data) {
  if (!data || typeof data !== 'object' || typeof data.turn !== 'number') return null;
  return migrate(data);
}

export const storage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return upgrade(JSON.parse(raw));
    } catch {
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to clear.
    }
  },

  // Offers the save as a file the player can keep or move to another device.
  exportFile(state) {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = state.campName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'camp';
    a.href = url;
    a.download = `embers-to-orbit-${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async importFile(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file is not an Embers to Orbit save.');
    }
    const upgraded = upgrade(data);
    if (!upgraded) throw new Error('That file is not an Embers to Orbit save, or it is from an incompatible version.');
    return upgraded;
  },
};
