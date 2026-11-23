// Crew: three recruitable specialists, each with one ability that changes
// how missions play. Recruiting costs cash and needs a respect rank; once
// recruited, a member is on every job. The driver stretches timed stages,
// the hacker takes the edge off the heat and the vault, the gunman hits
// harder and keeps the ammo full.
import { rankIndex } from './respect.js';
export const CREW_DEFS = [
  {
    id: 'rook', name: 'Rook', role: 'Gunman', ability: 'Heavy Hands',
    desc: 'All damage +25%. Jobs start with full ammo.',
    minRank: 2, cost: 500,
    line: ['Rook', 'You point, I shoot. That is the whole arrangement.'],
  },
  {
    id: 'iris', name: 'Iris', role: 'Hacker', ability: 'Ghost Signal',
    desc: 'Jobs start 1 star cooler. Vault jobs crack 8s faster.',
    minRank: 3, cost: 700,
    line: ['Iris', 'Cameras looped, radios jammed. They will not see us coming.'],
  },
  {
    id: 'vega', name: 'Vega', role: 'Driver', ability: 'Wheelman',
    desc: 'Timed stages get +15 seconds. Mission cars run faster.',
    minRank: 4, cost: 900,
    line: ['Vega', 'Fifteen extra seconds is a lifetime at full throttle.'],
  },
];

export class CrewManager {
  constructor() {
    this.recruited = new Set();
  }

  has(id) {
    return this.recruited.has(id);
  }

  count() {
    return this.recruited.size;
  }

  list() {
    return CREW_DEFS.filter((d) => this.recruited.has(d.id));
  }

  // Bonuses the mission and combat systems read.
  get timeBonus() {
    return this.has('vega') ? 15 : 0;
  }

  get heatReduction() {
    return this.has('iris') ? 1 : 0;
  }

  get waitReduction() {
    return this.has('iris') ? 8 : 0;
  }

  get damageMul() {
    return this.has('rook') ? 1.25 : 1;
  }

  get carSpeedBonus() {
    return this.has('vega') ? 1.1 : 1;
  }

  recruit(id, world) {
    const def = CREW_DEFS.find((d) => d.id === id);
    if (!def || this.recruited.has(id)) return false;
    if (rankIndex(world.reputation) < def.minRank) {
      world.hud.flashMessage(`${def.name} wants more respect before signing on.`, 3);
      return false;
    }
    if (world.cash < def.cost) {
      world.hud.flashMessage(`Not enough cash — ${def.name} costs $${def.cost}.`, 3);
      return false;
    }
    this.recruited.add(id);
    world.cash -= def.cost;
    world.hud.flashMessage(`${def.name} joined the crew — ${def.ability}.`, 4);
    world.hud.showDialogue(def.line[0], def.line[1], 5);
    world.audio.stageComplete();
    world.saveGame();
    return true;
  }

  serialize() {
    return [...this.recruited];
  }

  load(data) {
    if (!Array.isArray(data)) return;
    for (const id of data) {
      if (CREW_DEFS.some((d) => d.id === id)) this.recruited.add(id);
    }
  }
}
