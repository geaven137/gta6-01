// Respect: the reputation ladder. Reputation comes from finished missions
// (+1 each) and race wins (+1 each); each rank unlocks weapons, garage
// cars, crew recruits and race tiers. The ladder itself lives in config
// (RANKS); this module is the gatekeeper that answers "can I use this yet?"
// and names what a new rank just unlocked.
import { RANKS, rankFor } from './config.js';

export function rankIndex(rep) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (rep >= RANKS[i].min) idx = i;
  return idx;
}

export function rankName(rep) {
  return rankFor(rep).name;
}

// Minimum rank index for each weapon slot (0 = pistol, always open).
const WEAPON_MIN_RANK = [0, 1, 2, 3];

export const RANK_UNLOCKS = {
  1: ['VK SMG unlocked', 'Vesper Roadster for sale at Rosa\'s', 'Race: Marina Sprint'],
  2: ['M870 Shotgun unlocked', 'Rook the gunman joins the crew list', 'Race: Bowl Circuit'],
  3: ['AR-7 Rifle unlocked', 'Falcon SS for sale at Rosa\'s', 'Iris the hacker joins the crew list'],
  4: ['Comet GT-R for sale at Rosa\'s', 'Vega the driver joins the crew list', 'Race: Tide Grand Tour'],
  5: ['Golden Comet for sale at Rosa\'s', 'Garage upgrades half price'],
};

export class RespectManager {
  canUseWeapon(index, rep) {
    return rankIndex(rep) >= this.weaponMinRank(index);
  }

  weaponMinRank(index) {
    return WEAPON_MIN_RANK[index] ?? 0;
  }

  weaponLocked(index, rep) {
    return rankIndex(rep) < this.weaponMinRank(index);
  }

  lockReasonForRank(minRank) {
    return `Reach ${RANKS[minRank].name}`;
  }

  // What crossing from oldRep to newRep just unlocked, as toast lines.
  unlocksNew(oldRep, newRep) {
    const out = [];
    const from = rankIndex(oldRep);
    const to = rankIndex(newRep);
    for (let r = from + 1; r <= to; r++) {
      out.push(`NEW RANK — ${RANKS[r].name}`);
      for (const line of RANK_UNLOCKS[r] || []) out.push('  ' + line);
    }
    return out;
  }

  // Only the highest rank just reached, as toast lines. A multi-rank
  // jump (a staged save, a big payout) shows one short banner instead
  // of pasting every crossed rank across the screen.
  latestUnlocks(oldRep, newRep) {
    const from = rankIndex(oldRep);
    const to = rankIndex(newRep);
    if (to <= from) return [];
    const out = [`NEW RANK — ${RANKS[to].name}`];
    for (const line of RANK_UNLOCKS[to] || []) out.push('  ' + line);
    return out;
  }
}
