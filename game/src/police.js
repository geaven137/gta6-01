// Wanted system: heat builds stars, stars bring police cars that route
// along the grid and ram the player, and hiding bleeds the heat away until
// the chase is lost. Get caught standing still on foot and you are busted.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED_TUNING, CAR_TUNING } from './config.js';
import { range, pick } from './random.js';
import { createCarMesh, ArcadeCar } from './vehicles.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class WantedSystem {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.stars = 0;
    this.police = []; // { car, routeTarget, repath, stuck, reverseTimer }
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
    this.lostThemAnnounced = false;
  }

  starsForHeat(heat) {
    const t = WANTED_TUNING.heatPerStar;
    let stars = 0;
    for (let i = 1; i < t.length; i++) if (heat >= t[i]) stars = i;
    return stars;
  }

  addHeat(amount, reason) {
    if (amount <= 0) return this.stars;
    const before = this.stars;
    this.heat = Math.min(100, this.heat + amount);
    this.stars = this.starsForHeat(this.heat);
    this.hiddenTimer = 0;
    this.lostThemAnnounced = false;
    void reason;
    return this.stars - before;
  }

  setWanted(stars) {
    this.heat = WANTED_TUNING.heatPerStar[Math.min(5, Math.max(0, stars))];
    this.stars = this.starsForHeat(this.heat);
    this.hiddenTimer = 0;
  }

  clearWanted() {
    this.heat = 0;
    this.stars = 0;
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    for (const p of this.police) {
      this.scene.remove(p.car.mesh);
    }
    this.police = [];
  }

  cars() {
    return this.police.map((p) => p.car);
  }

  nearestPoliceDist(pos) {
    let best = Infinity;
    for (const p of this.police) {
      const d = Math.hypot(p.car.position.x - pos.x, p.car.position.z - pos.z);
      if (d < best) best = d;
    }
    return best;
  }

  _spawnPolice(playerPos) {
    for (let tries = 0; tries < 12; tries++) {
      const p = this.city.randomRoadPoint(this.rng);
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d < 65 || d > 110) continue;
      const car = new ArcadeCar(createCarMesh('police', 0xf2f2f2), {
        x: p.x, z: p.z,
        heading: Math.atan2(playerPos.x - p.x, playerPos.z - p.z),
        maxSpeed: CAR_TUNING.policeSpeed,
        accel: 30,
      });
      this.scene.add(car.mesh);
      this.police.push({
        car,
        routeTarget: this.city.nearestIntersection(playerPos.x, playerPos.z),
        repath: 0,
        stuck: 0,
        reverseTimer: 0,
      });
      return;
    }
  }

  // Place a cruiser exactly (screenshot staging): bypasses the spawn timer.
  spawnAt(x, z, heading) {
    const car = new ArcadeCar(createCarMesh('police', 0xf2f2f2), {
      x, z, heading, maxSpeed: CAR_TUNING.policeSpeed, accel: 30,
    });
    this.scene.add(car.mesh);
    this.police.push({
      car,
      routeTarget: this.city.nearestIntersection(x, z),
      repath: 0,
      stuck: 0,
      reverseTimer: 0,
    });
    return car;
  }

  update(dt, world) {
    const { player, audio, hud } = world;
    const playerPos = player.position;
    this.spawnTimer -= dt;

    // Spawn / despawn to match the wanted level.
    const wanted = Math.min(5, this.stars);
    if (this.police.length < wanted && this.spawnTimer <= 0) {
      this._spawnPolice(playerPos);
      this.spawnTimer = 1.4;
    }
    while (this.police.length > wanted) {
      const far = this.police.reduce((a, b) =>
        Math.hypot(a.car.position.x - playerPos.x, a.car.position.z - playerPos.z) >
        Math.hypot(b.car.position.x - playerPos.x, b.car.position.z - playerPos.z) ? a : b);
      this.scene.remove(far.car.mesh);
      this.police.splice(this.police.indexOf(far), 1);
    }

    // Heat decay while no police can see the player.
    const nearest = this.nearestPoliceDist(playerPos);
    if (this.stars > 0) {
      if (nearest > 45 || this.police.length === 0) {
        this.hiddenTimer += dt;
        if (this.hiddenTimer > WANTED_TUNING.hiddenDelaySeconds) {
          this.heat = Math.max(0, this.heat - WANTED_TUNING.decayHiddenPerSecond * dt);
          const newStars = this.starsForHeat(this.heat);
          if (newStars < this.stars) {
            this.stars = newStars;
            hud.flashMessage(newStars === 0 ? 'You lost them.' : `Heat dropping — ${newStars} star${newStars === 1 ? '' : 's'}`);
          }
        }
      } else {
        this.hiddenTimer = 0;
      }
    }

    // Siren loudness follows the nearest cruiser.
    audio.setSiren(this.stars > 0 && nearest < 90, nearest);

    // Busted: standing still on foot next to a cruiser.
    if (this.stars > 0 && player.state === 'foot' && nearest < WANTED_TUNING.bustedRange && player.speed < 1) {
      this.bustedTimer += dt;
      hud.showBustedWarning(this.bustedTimer / WANTED_TUNING.bustedStillSeconds);
      if (this.bustedTimer > WANTED_TUNING.bustedStillSeconds) {
        this.bustedTimer = 0;
        world.onBusted();
        return;
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      hud.showBustedWarning(0);
    }

    // Chase AI: route along the grid, then ram.
    for (const p of this.police) {
      const car = p.car;
      if (car.dead) continue;
      const dx = playerPos.x - car.position.x;
      const dz = playerPos.z - car.position.z;
      const dist = Math.hypot(dx, dz);
      let target;
      if (dist < 24) {
        target = { x: playerPos.x, z: playerPos.z };
      } else {
        p.repath -= dt;
        if (p.repath <= 0) {
          p.repath = 1.5;
          const from = this.city.nearestIntersection(car.position.x, car.position.z);
          const to = this.city.nearestIntersection(playerPos.x, playerPos.z);
          p.routeTarget = this.city.gridStepTowards(from, to);
        }
        target = p.routeTarget;
      }
      const desired = Math.atan2(target.x - car.position.x, target.z - car.position.z);
      const steer = THREE.MathUtils.clamp(wrapAngle(desired - car.heading) * 2.4, -1, 1);
      let throttle = 1;
      if (p.reverseTimer > 0) {
        p.reverseTimer -= dt;
        throttle = -0.8;
      } else if (Math.abs(car.speed) < 0.6 && dist > 6) {
        p.stuck += dt;
        if (p.stuck > 2.2) {
          p.stuck = 0;
          p.reverseTimer = 0.9;
        }
      } else {
        p.stuck = 0;
      }
      car.drive(throttle, steer, dt, this.city);
      car.updateVisual(dt, 0);
    }
  }
}
