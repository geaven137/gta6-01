// Traffic: cars that drive the road grid with right-hand lanes, turn at
// intersections, brake for the car ahead — and parked cars waiting to be
// stolen. Density follows the player so the streets always feel alive.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_TUNING, PALETTE, CITY } from './config.js';
import { range, pick, chance } from './random.js';
import { createCarMesh, ArcadeCar } from './vehicles.js';

const LANE = 3.5;

function laneOffset(axis, dir) {
  // Right-hand traffic: eastbound keeps south, southbound keeps west.
  if (axis === 'x') return dir > 0 ? LANE : -LANE;
  return dir > 0 ? -LANE : LANE;
}

function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function findNearestCar(cars, x, z, maxRange) {
  let best = null;
  let bestD = maxRange;
  for (const car of cars) {
    const d = Math.hypot(car.position.x - x, car.position.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export class TrafficManager {
  constructor(scene, city, rng, movingCount = 14) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = []; // moving traffic: { car, axis, coord, dir, waypoint, stuck }
    this.parked = [];
    this._spawnMoving(movingCount);
    this._spawnParked();
  }

  allCars() {
    return [...this.cars.map((t) => t.car), ...this.parked];
  }

  _nextRoadCoord(from, dir) {
    const roads = this.city.roads;
    if (dir > 0) {
      for (const r of roads) if (r > from + 1) return r;
    } else {
      for (let i = roads.length - 1; i >= 0; i--) if (roads[i] < from - 1) return roads[i];
    }
    return null;
  }

  _waypointFor(axis, coord, dir, fromX, fromZ) {
    const along = axis === 'x' ? fromX : fromZ;
    const next = this._nextRoadCoord(along, dir);
    if (next === null) return null;
    const lane = coord + laneOffset(axis, dir);
    return axis === 'x' ? { x: next, z: lane } : { x: lane, z: next };
  }

  _spawnMoving(count) {
    for (let i = 0; i < count; i++) {
      const axis = this.rng() < 0.5 ? 'x' : 'z';
      const coord = pick(this.rng, this.city.roads);
      const dir = this.rng() < 0.5 ? 1 : -1;
      const along = range(this.rng, -this.city.extent + 20, this.city.extent - 20);
      const lane = coord + laneOffset(axis, dir);
      const x = axis === 'x' ? along : lane;
      const z = axis === 'x' ? lane : along;
      const type = chance(this.rng, 0.12) ? 'taxi' : chance(this.rng, 0.15) ? 'van' : chance(this.rng, 0.12) ? 'sports' : 'sedan';
      const car = new ArcadeCar(createCarMesh(type, pick(this.rng, PALETTE.car)), {
        x, z, heading: headingFor(axis, dir), maxSpeed: CAR_TUNING.trafficSpeed + range(this.rng, 0, 3),
      });
      car.speed = range(this.rng, 6, 10);
      this.scene.add(car.mesh);
      const waypoint = this._waypointFor(axis, coord, dir, x, z) || { x: -x, z: -z };
      this.cars.push({ car, axis, coord, dir, waypoint, stuck: 0 });
    }
  }

  _spawnParked() {
    const spots = [...this.city.parkingSpots];
    // Shuffle deterministically, take a dozen.
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (const spot of spots.slice(0, 12)) {
      const type = chance(this.rng, 0.2) ? 'sports' : chance(this.rng, 0.2) ? 'van' : 'sedan';
      const car = new ArcadeCar(createCarMesh(type, pick(this.rng, PALETTE.car)), {
        x: spot.x, z: spot.z, heading: spot.heading,
      });
      this.scene.add(car.mesh);
      this.parked.push(car);
    }
    // A few more parked at curbs along roads.
    for (let i = 0; i < 6; i++) {
      const axis = this.rng() < 0.5 ? 'x' : 'z';
      const road = pick(this.rng, this.city.roads);
      const along = range(this.rng, -180, 180);
      const side = this.rng() < 0.5 ? 5.6 : -5.6;
      const x = axis === 'x' ? along : road + side;
      const z = axis === 'x' ? road + side : along;
      const car = new ArcadeCar(createCarMesh('sedan', pick(this.rng, PALETTE.car)), {
        x, z, heading: headingFor(axis, side > 0 ? 1 : -1),
      });
      this.scene.add(car.mesh);
      this.parked.push(car);
    }
  }

  // Place a moving traffic car exactly (screenshot staging).
  spawnAt(x, z, axis, dir) {
    const coord = this.city.nearestRoadCoord(axis === 'x' ? z : x);
    const lane = coord + laneOffset(axis, dir);
    const type = chance(this.rng, 0.15) ? 'taxi' : 'sedan';
    const car = new ArcadeCar(createCarMesh(type, pick(this.rng, PALETTE.car)), {
      x: axis === 'x' ? x : lane,
      z: axis === 'x' ? lane : z,
      heading: headingFor(axis, dir),
      maxSpeed: CAR_TUNING.trafficSpeed + 2,
    });
    car.speed = 9;
    this.scene.add(car.mesh);
    const waypoint = this._waypointFor(axis, coord, dir, car.position.x, car.position.z) || { x: 0, z: 0 };
    this.cars.push({ car, axis, coord, dir, waypoint, stuck: 0 });
    return car;
  }

  _retarget(t, playerPos) {
    const { car } = t;
    const roll = this.rng();
    const atEdge = this._nextRoadCoord(t.axis === 'x' ? car.position.x : car.position.z, t.dir) === null;
    if (roll < 0.55 && !atEdge) {
      // Straight on.
      const wp = this._waypointFor(t.axis, t.coord, t.dir, car.position.x, car.position.z);
      if (wp) { t.waypoint = wp; return; }
    }
    // Turn onto the crossing road (or turn around at the edge).
    const newAxis = t.axis === 'x' ? 'z' : 'x';
    const cross = t.axis === 'x' ? car.position.x : car.position.z;
    const newCoord = this.city.nearestRoadCoord(cross);
    // Left or right relative to current heading.
    const left = this.rng() < 0.5;
    let newDir;
    if (t.axis === 'x') newDir = (t.dir > 0) === left ? -1 : 1;
    else newDir = (t.dir > 0) === left ? 1 : -1;
    const wp = this._waypointFor(newAxis, newCoord, newDir, car.position.x, car.position.z);
    if (wp) {
      t.axis = newAxis;
      t.coord = newCoord;
      t.dir = newDir;
      t.waypoint = wp;
    } else {
      t.dir = -t.dir;
      const wp2 = this._waypointFor(t.axis, t.coord, t.dir, car.position.x, car.position.z);
      if (wp2) t.waypoint = wp2;
    }
    void playerPos;
  }

  _blockedAhead(t, others) {
    const { car } = t;
    const f = car.forward();
    for (const other of others) {
      if (other === car) continue;
      const dx = other.position.x - car.position.x;
      const dz = other.position.z - car.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 11 && d > 0.1) {
        const ahead = (dx * f.x + dz * f.z) / d;
        if (ahead > 0.55) return true;
      }
    }
    return false;
  }

  update(dt, playerPos, allCars) {
    for (const t of this.cars) {
      const { car } = t;
      if (car.dead) continue;
      // Keep the action near the player: recycle distant cars.
      const distPlayer = Math.hypot(car.position.x - playerPos.x, car.position.z - playerPos.z);
      if (distPlayer > 280) {
        // Recycle onto a road near the player, in the correct lane.
        const p = this.city.randomRoadPoint(this.rng);
        const axis = this.rng() < 0.5 ? 'x' : 'z';
        const nearCoord = this.city.nearestRoadCoord(axis === 'x' ? playerPos.z : playerPos.x);
        const coord = this.rng() < 0.6 ? nearCoord : this.city.nearestRoadCoord(nearCoord + (this.rng() < 0.5 ? -CITY.pitch : CITY.pitch));
        const dir = this.rng() < 0.5 ? 1 : -1;
        const lane = coord + laneOffset(axis, dir);
        const along = axis === 'x' ? playerPos.x + range(this.rng, -90, 90) : playerPos.z + range(this.rng, -90, 90);
        car.position.x = axis === 'x' ? along : lane;
        car.position.z = axis === 'x' ? lane : along;
        car.heading = headingFor(axis, dir);
        car.speed = 8;
        t.axis = axis; t.coord = coord; t.dir = dir;
        t.waypoint = this._waypointFor(axis, t.coord, dir, car.position.x, car.position.z) || { x: 0, z: 0 };
        continue;
      }
      const dx = t.waypoint.x - car.position.x;
      const dz = t.waypoint.z - car.position.z;
      const distWp = Math.hypot(dx, dz);
      if (distWp < 6) this._retarget(t, playerPos);
      const desired = Math.atan2(t.waypoint.x - car.position.x, t.waypoint.z - car.position.z);
      const steer = THREE.MathUtils.clamp(wrapAngle(desired - car.heading) * 2.2, -1, 1);
      let throttle = distWp < 14 ? 0.3 : 0.6;
      if (this._blockedAhead(t, allCars)) throttle = car.speed > 1 ? -0.8 : 0;
      if (car.speed < 0.4 && throttle > 0) {
        t.stuck += dt;
        if (t.stuck > 4) {
          t.stuck = 0;
          this._retarget(t, playerPos);
        }
      } else {
        t.stuck = 0;
      }
      car.drive(throttle, steer, dt, this.city);
      car.updateVisual(dt, 0);
    }
    for (const car of this.parked) {
      // Parked cars only need their visuals refreshed if the player drives one.
      if (car.isPlayer) car.updateVisual(dt, 0);
    }
  }
}
