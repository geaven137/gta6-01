// Street races: three events that start at the Aurelia Bowl. Press T at
// the start line (while driving) to race two rivals through checkpoints
// against the clock. Win and the purse is yours, plus reputation; the
// district where you finish remembers it too. Rivals drive the same
// checkpoints with a simple chase-the-waypoint brain.
import * as THREE from '../vendor/three.module.min.js';
import { PLACES } from './config.js';
import { createCarMesh, ArcadeCar } from './vehicles.js';
import { makeBeacon } from './missions.js';

export const RACES = [
  {
    id: 'sprint', name: 'Marina Sprint', minRank: 1, reward: 600, timeLimit: 150,
    gates: ['raceGate3', 'northMarina', 'raceGate1'],
  },
  {
    id: 'circuit', name: 'Bowl Circuit', minRank: 2, reward: 900, timeLimit: 200,
    gates: ['raceGate2', 'raceGate1', 'docks', 'northMarina'],
  },
  {
    id: 'tour', name: 'Tide Grand Tour', minRank: 4, reward: 1400, timeLimit: 280,
    gates: ['raceGate3', 'raceGate2', 'raceGate1', 'docks', 'northMarina'],
  },
];

const RIVALS = [
  { name: 'Dizzy', color: 0xe67e22, body: 'sports' },
  { name: 'Nadia', color: 0x8e44ad, body: 'sports' },
];

const GATE_RADIUS = 10;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class RaceManager {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.def = null;
    this.gateIdx = 0;
    this.timer = 0;
    this.rivals = []; // { car, gateIdx, stuckTimer, reverseTimer, finishedAt }
    this.finishOrder = []; // names in finish order
    this.won = new Set();
    this.bestTimes = {}; // raceId -> seconds
    // The orange start beacon at the Bowl.
    this.startBeacon = makeBeacon(0xff9a3c);
    this.startBeacon.position.set(PLACES.bowl.x, 0, PLACES.bowl.z);
    scene.add(this.startBeacon);
    this.gateBeacon = makeBeacon(0xff9a3c);
    this.gateBeacon.visible = false;
    scene.add(this.gateBeacon);
  }

  // The next race on the list the player has unlocked but not won yet.
  nextRace(rankIdx) {
    const unlocked = RACES.filter((r) => rankIdx >= r.minRank);
    if (unlocked.length === 0) return null;
    return unlocked.find((r) => !this.won.has(r.id)) || unlocked[unlocked.length - 1];
  }

  nearStart(world) {
    const p = world.player.position;
    return Math.hypot(p.x - PLACES.bowl.x, p.z - PLACES.bowl.z) < 12;
  }

  startRace(def, world) {
    if (this.active || !def) return false;
    this.active = true;
    this.def = def;
    this.gateIdx = 0;
    this.timer = 0;
    this.finishOrder = [];
    this.rivals = RIVALS.map((r, i) => {
      const car = new ArcadeCar(createCarMesh(r.body, r.color), {
        x: PLACES.bowl.x - 4 + i * 8, z: PLACES.bowl.z + 6,
        heading: Math.PI / 2, name: `${r.name}'s ride`, maxSpeed: 38 + i,
      });
      this.scene.add(car.mesh);
      world.extraCars.push(car);
      return { car, name: r.name, gateIdx: 0, stuckTimer: 0, reverseTimer: 0, finishedAt: null };
    });
    this._placeGateBeacon();
    world.hud.flashMessage(`${def.name} — ${def.gates.length} checkpoints, ${def.timeLimit}s on the clock. GO!`, 5);
    world.hud.showDialogue('Rosa', 'The Bowl crowd is watching. Beat Dizzy and Nadia — beat them all.', 5);
    world.audio.missionStart();
    return true;
  }

  _placeGateBeacon() {
    const place = this.nextGatePlace();
    if (!place) { this.gateBeacon.visible = false; return; }
    this.gateBeacon.position.set(place.x, 0, place.z);
    this.gateBeacon.visible = true;
  }

  nextGatePlace() {
    if (!this.active || !this.def) return null;
    const key = this.def.gates[this.gateIdx];
    return key ? PLACES[key] : null;
  }

  // Progress score for live positions: gates banked, then closeness.
  _progress(gateIdx, x, z) {
    const key = this.def.gates[Math.min(gateIdx, this.def.gates.length - 1)];
    const place = PLACES[key];
    const d = place ? Math.hypot(x - place.x, z - place.z) : 0;
    return gateIdx * 10000 - d;
  }

  position(world) {
    if (!this.active) return null;
    const entries = [{ name: 'Mara', p: this._progress(this.gateIdx, world.player.position.x, world.player.position.z), finished: this.gateIdx >= this.def.gates.length }];
    for (const r of this.rivals) {
      entries.push({ name: r.name, p: this._progress(r.gateIdx, r.car.position.x, r.car.position.z), finished: r.finishedAt !== null });
    }
    entries.sort((a, b) => b.p - a.p);
    const idx = entries.findIndex((e) => e.name === 'Mara');
    return { place: idx + 1, of: entries.length, entries };
  }

  _driveRival(r, dt, world) {
    if (r.finishedAt !== null) {
      // Finished: cruise on, slowing down.
      r.car.drive(0.2, 0, dt, world.city);
      r.car.updateVisual(dt, world.time);
      return;
    }
    const key = this.def.gates[r.gateIdx];
    const place = PLACES[key];
    const dx = place.x - r.car.position.x;
    const dz = place.z - r.car.position.z;
    const want = Math.atan2(dx, dz);
    const diff = angleDiff(want, r.car.heading);
    let throttle = 1;
    let steer = Math.max(-1, Math.min(1, diff * 2.2));
    if (Math.abs(diff) > 1.1) throttle = 0.25;
    // Stuck against a wall? Back up for a second, then go again.
    if (Math.abs(r.car.speed) < 1.5) r.stuckTimer += dt;
    else r.stuckTimer = 0;
    if (r.stuckTimer > 2.5) {
      r.reverseTimer = 1.1;
      r.stuckTimer = 0;
    }
    if (r.reverseTimer > 0) {
      r.reverseTimer -= dt;
      throttle = -1;
      steer = -steer;
    }
    r.car.drive(throttle, steer, dt, world.city);
    r.car.updateVisual(dt, world.time);
    if (Math.hypot(dx, dz) < GATE_RADIUS) {
      r.gateIdx += 1;
      if (r.gateIdx >= this.def.gates.length) {
        r.finishedAt = this.timer;
        this.finishOrder.push(r.name);
      }
    }
  }

  _endRace(world, playerFinished) {
    const def = this.def;
    const place = this.position(world).place;
    const won = playerFinished && place === 1;
    const reward = won ? def.reward : place === 2 ? Math.round(def.reward / 2) : 100;
    world.cash += reward;
    let line;
    if (won) {
      world.reputation += 1;
      this.won.add(def.id);
      if (!this.bestTimes[def.id] || this.timer < this.bestTimes[def.id]) {
        this.bestTimes[def.id] = Math.round(this.timer);
      }
      line = `You won the ${def.name}! +$${reward} and +1 rep.`;
      world.hud.showDialogue('Rosa', 'Champion of the Bowl! The crowd goes wild!', 5);
    } else if (playerFinished) {
      line = `Finished ${place === 2 ? '2nd' : '3rd'} in the ${def.name}. +$${reward}.`;
    } else {
      line = `Out of time in the ${def.name}. +$${reward} for showing up.`;
    }
    // The finish district remembers the race.
    const finish = PLACES[def.gates[def.gates.length - 1]];
    const tier = world.districts.addStanding(world.districts.current(finish.x, finish.z).id, won ? 12 : 5);
    if (tier) line += ` ${world.districts.current(finish.x, finish.z).name} is now ${tier}.`;
    world.hud.flashMessage(line, 5);
    world.audio.missionComplete();
    world.saveGame();
    for (const r of this.rivals) {
      this.scene.remove(r.car.mesh);
      const i = world.extraCars.indexOf(r.car);
      if (i >= 0) world.extraCars.splice(i, 1);
    }
    this.rivals = [];
    this.active = false;
    this.def = null;
    this.gateBeacon.visible = false;
  }

  rivalCars() {
    return this.rivals.map((r) => r.car);
  }

  update(dt, world) {
    // Animate the beacons.
    const t = world.time;
    for (const b of [this.startBeacon, this.gateBeacon]) {
      if (!b.visible) continue;
      b.userData.beam.material.opacity = 0.18 + Math.sin(t * 2.4) * 0.07;
      b.userData.diamond.rotation.y += dt * 2;
      b.userData.diamond.position.y = 4.2 + Math.sin(t * 2) * 0.4;
    }
    if (!this.active) return;
    this.timer += dt;
    // Player gates.
    const place = this.nextGatePlace();
    if (place) {
      const p = world.player.position;
      if (Math.hypot(p.x - place.x, p.z - place.z) < GATE_RADIUS) {
        this.gateIdx += 1;
        if (this.gateIdx >= this.def.gates.length) {
          this.finishOrder.push('Mara');
          this._endRace(world, true);
          return;
        }
        this._placeGateBeacon();
        world.hud.flashMessage(`Checkpoint ${this.gateIdx}/${this.def.gates.length} — keep going!`, 2);
        world.audio.stageComplete();
      }
    }
    for (const r of this.rivals) this._driveRival(r, dt, world);
    if (this.timer >= this.def.timeLimit) {
      this._endRace(world, false);
    }
  }

  serialize() {
    return { won: [...this.won], bestTimes: this.bestTimes };
  }

  load(data) {
    if (!data) return;
    if (Array.isArray(data.won)) {
      for (const id of data.won) if (RACES.some((r) => r.id === id)) this.won.add(id);
    }
    if (data.bestTimes) this.bestTimes = { ...data.bestTimes };
  }
}
