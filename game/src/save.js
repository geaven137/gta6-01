// Save / load: cash, reputation and mission progress in localStorage, so a
// run survives a closed tab. Everything is guarded: a missing or corrupt
// save just means a fresh game.
import { SAVE_KEY, ECONOMY } from './config.js';

export function defaultSave() {
  return {
    cash: ECONOMY.startCash, reputation: 0, missionIndex: 0, weapon: 0,
    crew: [], districts: {}, garage: { owned: [], upgrades: {}, activeId: null },
    races: { won: [], bestTimes: {} }, savedAt: Date.now(),
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return {
      cash: data.cash,
      reputation: typeof data.reputation === 'number' ? data.reputation : 0,
      missionIndex: Math.max(0, Math.min(9, Math.floor(data.missionIndex))),
      weapon: typeof data.weapon === 'number' ? Math.max(0, Math.min(3, Math.floor(data.weapon))) : 0,
      crew: Array.isArray(data.crew) ? data.crew : [],
      districts: data.districts && typeof data.districts === 'object' ? data.districts : {},
      garage: data.garage && typeof data.garage === 'object' ? data.garage : { owned: [], upgrades: {}, activeId: null },
      races: data.races && typeof data.races === 'object' ? data.races : { won: [], bestTimes: {} },
      savedAt: data.savedAt || 0,
    };
  } catch (e) {
    return null;
  }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Ignore: no storage, no save.
  }
}
