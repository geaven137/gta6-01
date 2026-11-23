// Garage: Rosa's shop at the Northside garage. Buy cars (respect-gated),
// upgrade the one you own (engine, armour, paint), and keep them parked
// here — select one and it rolls out to the forecourt. Prices bend with
// the Northside district standing, and Kingpins pay half for upgrades.
import { createCarMesh, ArcadeCar } from './vehicles.js';
import { PLACES } from './config.js';
import { rankIndex } from './respect.js';

// Every buy re-checks the respect rank (the panel enforces it too, but the
// manager is the authority).

export const GARAGE_CARS = [
  { id: 'vesper', name: 'Vesper Roadster', body: 'sports', color: 0x16a085, price: 800, minRank: 1, maxSpeed: 42, accel: 26, health: 100 },
  { id: 'falcon', name: 'Falcon SS', body: 'sports', color: 0xd8dee2, price: 1500, minRank: 3, maxSpeed: 44, accel: 28, health: 110 },
  { id: 'comet', name: 'Comet GT-R', body: 'sports', color: 0xc0392b, price: 2500, minRank: 4, maxSpeed: 46, accel: 30, health: 120 },
  { id: 'golden', name: 'Golden Comet', body: 'sports', color: 0xd4af37, price: 4000, minRank: 5, maxSpeed: 50, accel: 34, health: 140 },
];

export const PAINTS = [
  { name: 'Sunset Red', color: 0xc0392b },
  { name: 'Ocean Blue', color: 0x2980b9 },
  { name: 'Vice Gold', color: 0xd4af37 },
  { name: 'Palm Green', color: 0x27ae60 },
  { name: 'Neon Violet', color: 0x8e44ad },
  { name: 'Arctic White', color: 0xecf0f1 },
];

export const UPGRADES = {
  engine: { name: 'Engine', max: 3, basePrice: 400, desc: '+4 top speed, +2 accel per level' },
  armor: { name: 'Armour', max: 3, basePrice: 300, desc: '+40 health per level' },
};

const GARAGE_SPOT = { x: -87, z: -138, heading: Math.PI / 2 };

export class GarageManager {
  constructor(scene) {
    this.scene = scene;
    this.owned = new Set();
    this.upgrades = {}; // carId -> { engine: n, armor: n, paint: color }
    this.activeId = null;
    this.activeCar = null; // the spawned ArcadeCar, if any
  }

  priceOf(car, world) {
    const f = world.districts.priceFactorAt(PLACES.chopGarage.x, PLACES.chopGarage.z);
    return Math.round(car.price * f);
  }

  upgradePrice(kind, world) {
    const base = UPGRADES[kind].basePrice;
    const f = world.districts.priceFactorAt(PLACES.chopGarage.x, PLACES.chopGarage.z);
    const kingpin = world.reputation >= 9 ? 0.5 : 1;
    return Math.round(base * f * kingpin);
  }

  paintPrice(world) {
    const f = world.districts.priceFactorAt(PLACES.chopGarage.x, PLACES.chopGarage.z);
    const kingpin = world.reputation >= 9 ? 0.5 : 1;
    return Math.round(150 * f * kingpin);
  }

  _up(carId) {
    if (!this.upgrades[carId]) this.upgrades[carId] = { engine: 0, armor: 0, paint: null };
    return this.upgrades[carId];
  }

  buy(carId, world) {
    const car = GARAGE_CARS.find((c) => c.id === carId);
    if (!car || this.owned.has(carId)) return false;
    if (rankIndex(world.reputation) < car.minRank) {
      world.hud.flashMessage(`The ${car.name} needs more respect first.`, 3);
      return false;
    }
    const price = this.priceOf(car, world);
    if (world.cash < price) {
      world.hud.flashMessage(`Not enough cash — the ${car.name} is $${price}.`, 3);
      return false;
    }
    world.cash -= price;
    this.owned.add(carId);
    this._up(carId);
    world.hud.flashMessage(`${car.name} is yours — parked at Rosa's.`, 4);
    world.audio.stageComplete();
    world.saveGame();
    return true;
  }

  upgrade(carId, kind, world) {
    const up = this._up(carId);
    const spec = UPGRADES[kind];
    if (up[kind] >= spec.max) return false;
    const price = this.upgradePrice(kind, world);
    if (world.cash < price) {
      world.hud.flashMessage(`Not enough cash — ${spec.name} is $${price}.`, 3);
      return false;
    }
    world.cash -= price;
    up[kind] += 1;
    // Apply live to the spawned car, if this is the active one.
    if (this.activeId === carId && this.activeCar) {
      if (kind === 'engine') {
        this.activeCar.maxSpeed += 4;
        this.activeCar.accel += 2;
      } else if (kind === 'armor') {
        this.activeCar.health = Math.min(this.activeCar.health + 40, this._maxHealth(carId));
      }
    }
    world.hud.flashMessage(`${spec.name} level ${up[kind]} fitted.`, 3);
    world.audio.stageComplete();
    world.saveGame();
    return true;
  }

  // The next paint in the cycle after the car's current one.
  nextPaintColor(carId) {
    const cur = this._up(carId).paint;
    const idx = PAINTS.findIndex((p) => p.color === cur);
    return PAINTS[(idx + 1) % PAINTS.length].color;
  }

  paint(carId, color, world) {
    const price = this.paintPrice(world);
    if (world.cash < price) {
      world.hud.flashMessage(`Not enough cash — a respray is $${price}.`, 3);
      return false;
    }
    world.cash -= price;
    this._up(carId).paint = color;
    if (this.activeId === carId && this.activeCar) {
      const mat = this.activeCar.mesh.userData.paintMat;
      if (mat) mat.color.set(color);
    }
    world.hud.flashMessage('Fresh paint — looking sharp.', 3);
    world.audio.stageComplete();
    world.saveGame();
    return true;
  }

  _maxHealth(carId) {
    const car = GARAGE_CARS.find((c) => c.id === carId);
    return car.health + this._up(carId).armor * 40;
  }

  // Roll the selected car out to the forecourt; the old one goes back in.
  select(carId, world) {
    if (!this.owned.has(carId)) return false;
    const car = GARAGE_CARS.find((c) => c.id === carId);
    const up = this._up(carId);
    if (this.activeCar) {
      if (world.player.car === this.activeCar) world.player.exitCar();
      this.scene.remove(this.activeCar.mesh);
      const i = world.extraCars.indexOf(this.activeCar);
      if (i >= 0) world.extraCars.splice(i, 1);
      this.activeCar = null;
    }
    const color = up.paint !== null ? up.paint : car.color;
    const mesh = createCarMesh(car.body, color);
    const ride = new ArcadeCar(mesh, {
      x: GARAGE_SPOT.x, z: GARAGE_SPOT.z, heading: GARAGE_SPOT.heading,
      name: car.name, maxSpeed: car.maxSpeed + up.engine * 4,
      accel: car.accel + up.engine * 2, health: this._maxHealth(carId),
    });
    this.scene.add(mesh);
    world.extraCars.push(ride);
    this.activeCar = ride;
    this.activeId = carId;
    world.hud.flashMessage(`${car.name} is on the forecourt — get in.`, 3);
    world.saveGame();
    return true;
  }

  // Panel data: every car with its price, lock state and upgrade levels.
  panelData(world) {
    return GARAGE_CARS.map((car) => ({
      ...car,
      price: this.priceOf(car, world),
      owned: this.owned.has(car.id),
      active: this.activeId === car.id,
      upgrades: { ...this._up(car.id) },
    }));
  }

  serialize() {
    return {
      owned: [...this.owned],
      upgrades: this.upgrades,
      activeId: this.activeId,
    };
  }

  load(data) {
    if (!data) return;
    if (Array.isArray(data.owned)) {
      for (const id of data.owned) {
        if (GARAGE_CARS.some((c) => c.id === id)) this.owned.add(id);
      }
    }
    if (data.upgrades) {
      for (const id of Object.keys(data.upgrades)) {
        if (GARAGE_CARS.some((c) => c.id === id)) this.upgrades[id] = data.upgrades[id];
      }
    }
    if (typeof data.activeId === 'string' && this.owned.has(data.activeId)) {
      this.activeId = data.activeId;
    }
  }
}
