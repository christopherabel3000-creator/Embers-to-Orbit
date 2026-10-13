// The save layer. All saving and loading goes through this module, so the
// browser storage used now can later be swapped for native app storage or
// Steam Cloud without touching the game itself.

import { SAVE_VERSION } from './engine/state.js';

const KEY = 'embers-to-orbit/save/v1';

function isValidSave(data) {
  return data && typeof data === 'object' && data.version === SAVE_VERSION
    && Array.isArray(data.people) && data.resources && typeof data.turn === 'number';
}

export const storage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return isValidSave(data) ? data : null;
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
    if (!isValidSave(data)) throw new Error('That file is not an Embers to Orbit save, or it is from an incompatible version.');
    return data;
  },
};
