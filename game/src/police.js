// Wanted system: heat builds stars, stars bring SAPD cruisers that route
// along the grid and ram the player, HAWK-1 the police helicopter at 3+
// stars, and roadblocks at 4+. Hiding bleeds the heat away until the chase
// is lost — unless the helicopter is overhead, watching. Get caught standing
// still on foot and you are busted.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED_TUNING, CAR_TUNING } from './config.js';
import { range, pick } from './random.js';
import { createCarMesh, ArcadeCar } from './vehicles.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const CALLSIGNS = ['UNIT 7', 'UNIT 12', 'UNIT 3', 'UNIT 21', 'UNIT 9', 'UNIT 15', 'UNIT 4'];
const ROLES = ['PURSUE', 'FLANKING', 'RAMMING', 'PIT', 'CLOSING IN'];

// HAWK-1: a low-poly police helicopter with a spinning rotor, a searchlight
// cone and a real spotlight that tracks the player.
function createHelicopterMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1c4d8f, roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.12, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  box(2.4, 1.5, 4.6, bodyMat, 0, 0, 0); // fuselage
  box(2.5, 0.5, 3.2, blueMat, 0, 0.6, 0.2); // blue stripe band
  box(2.0, 0.9, 1.4, glassMat, 0, 0.25, 2.1); // cockpit glass
  box(0.5, 0.5, 4.4, blueMat, 0, 0.35, -4.2); // tail boom
  box(0.18, 1.4, 0.9, blueMat, 0, 0.8, -6.2); // tail fin
  box(2.6, 0.12, 0.3, darkMat, -1.2, -1.0, 0.8); // skid L
  box(2.6, 0.12, 0.3, darkMat, 1.2, -1.0, 0.8); // skid R
  box(0.12, 0.5, 0.12, darkMat, -1.2, -0.7, 1.6);
  box(0.12, 0.5, 0.12, darkMat, 1.2, -0.7, 1.6);
  box(0.12, 0.5, 0.12, darkMat, -1.2, -0.7, 0);
  box(0.12, 0.5, 0.12, darkMat, 1.2, -0.7, 0);
  // Main rotor: two long blades on a hub that spins in update().
  const rotor = new THREE.Group();
  rotor.position.y = 1.05;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.07, 0.34), bladeMat);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 9.5), bladeMat);
  rotor.add(blade1, blade2);
  group.add(rotor);
  // Searchlight cone: apex at the belly, base on the ground far below.
  const coneGeo = new THREE.ConeGeometry(7.5, CAR_TUNING.heliHeight, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.13,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.rotation.x = Math.PI; // apex up, at the helicopter
  cone.position.y = -CAR_TUNING.heliHeight / 2;
  group.add(cone);
  // Searchlight pool on the ground.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -CAR_TUNING.heliHeight + 0.15;
  group.add(pool);
  group.userData = { rotor, cone, pool };
  return group;
}

export class WantedSystem {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.stars = 0;
    this.police = []; // { car, callsign, routeTarget, repath, stuck, reverseTimer }
    this.roadblocks = []; // { cars: [ArcadeCar, ArcadeCar], timer }
    this.heli = null; // { mesh, light, lightTarget, rotorPhase }
    this.heliPinned = false; // staging pinned it in place: update() won't remove it
    this.callIndex = 0;
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
    this.roadblockTimer = 0;
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
    this._clearRoadblocks();
    this._removeHeli();
    this.heliPinned = false;
  }

  cars() {
    return this.police.map((p) => p.car);
  }

  roadblockCars() {
    const out = [];
    for (const rb of this.roadblocks) out.push(...rb.cars);
    return out;
  }

  heliPosition() {
    return this.heli ? this.heli.mesh.position : null;
  }

  // Dispatch board: every unit SAPD has on the player, with its role and
  // distance. The HUD renders this as the dispatch panel.
  dispatchInfo(playerPos) {
    const units = [];
    const sorted = [...this.police].sort((a, b) =>
      Math.hypot(a.car.position.x - playerPos.x, a.car.position.z - playerPos.z) -
      Math.hypot(b.car.position.x - playerPos.x, b.car.position.z - playerPos.z));
    sorted.forEach((p, i) => {
      units.push({
        call: p.callsign,
        role: ROLES[Math.min(i, ROLES.length - 1)],
        dist: Math.hypot(p.car.position.x - playerPos.x, p.car.position.z - playerPos.z),
      });
    });
    if (this.heli) {
      units.push({
        call: 'HAWK-1',
        role: 'SPOTLIGHT',
        dist: Math.hypot(
          this.heli.mesh.position.x - playerPos.x,
          this.heli.mesh.position.z - playerPos.z,
        ),
      });
    }
    for (const rb of this.roadblocks) {
      const c = rb.cars[0];
      units.push({
        call: 'ROADBLOCK',
        role: 'BLOCKING',
        dist: Math.hypot(c.position.x - playerPos.x, c.position.z - playerPos.z),
      });
    }
    return units;
  }

  nearestPoliceDist(pos) {
    let best = Infinity;
    for (const p of this.police) {
      const d = Math.hypot(p.car.position.x - pos.x, p.car.position.z - pos.z);
      if (d < best) best = d;
    }
    return best;
  }

  _nextCallsign() {
    const call = CALLSIGNS[this.callIndex % CALLSIGNS.length];
    this.callIndex += 1;
    return call;
  }

  _addPoliceCar(car, x, z) {
    this.scene.add(car.mesh);
    this.police.push({
      car,
      callsign: this._nextCallsign(),
      routeTarget: this.city.nearestIntersection(x, z),
      repath: 0,
      stuck: 0,
      reverseTimer: 0,
    });
    return car;
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
      this._addPoliceCar(car, p.x, p.z);
      return;
    }
  }

  // Place a cruiser exactly (screenshot staging): bypasses the spawn timer.
  spawnAt(x, z, heading) {
    const car = new ArcadeCar(createCarMesh('police', 0xf2f2f2), {
      x, z, heading, maxSpeed: CAR_TUNING.policeSpeed, accel: 30,
    });
    return this._addPoliceCar(car, x, z);
  }

  // HAWK-1 spawns above the player and shadows them until the heat drops.
  _spawnHeli(playerPos) {
    if (this.heli) return;
    const mesh = createHelicopterMesh();
    mesh.position.set(playerPos.x + 30, CAR_TUNING.heliHeight, playerPos.z + 30);
    this.scene.add(mesh);
    const light = new THREE.SpotLight(0xfff2b0, 900, 120, 0.42, 0.6, 1.1);
    light.position.copy(mesh.position);
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(playerPos.x, 0, playerPos.z);
    this.scene.add(lightTarget);
    light.target = lightTarget;
    this.scene.add(light);
    this.heli = { mesh, light, lightTarget, rotorPhase: 0 };
  }

  _removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.scene.remove(this.heli.light);
    this.scene.remove(this.heli.lightTarget);
    this.heli = null;
  }

  // Force the helicopter in (screenshot staging). Pinned: it stays until
  // the wanted level is cleared, even at zero stars.
  ensureHeli(playerPos) {
    this._spawnHeli(playerPos);
    this.heliPinned = true;
  }

  _clearRoadblocks() {
    for (const rb of this.roadblocks) {
      for (const car of rb.cars) this.scene.remove(car.mesh);
    }
    this.roadblocks = [];
  }

  // Two cruisers parked across the road ahead of the player, nose to nose.
  _spawnRoadblock(playerPos, playerHeading) {
    const ahead = 55;
    const cx = playerPos.x + Math.sin(playerHeading) * ahead;
    const cz = playerPos.z + Math.cos(playerHeading) * ahead;
    const near = this.city.nearestIntersection(cx, cz);
    // Block the road the player is on: cars perpendicular to the heading.
    const blockHeading = playerHeading + Math.PI / 2;
    const px = Math.sin(blockHeading);
    const pz = Math.cos(blockHeading);
    const cars = [];
    for (const off of [-3.4, 3.4]) {
      const car = new ArcadeCar(createCarMesh('police', 0xf2f2f2), {
        x: near.x + px * off,
        z: near.z + pz * off,
        heading: blockHeading,
        maxSpeed: CAR_TUNING.policeSpeed,
        accel: 30,
      });
      car.speed = 0;
      this.scene.add(car.mesh);
      cars.push(car);
    }
    this.roadblocks.push({ cars, timer: WANTED_TUNING.roadblockLifetime });
  }

  // Place a roadblock exactly (screenshot staging).
  spawnRoadblockAt(x, z, heading) {
    const px = Math.sin(heading + Math.PI / 2);
    const pz = Math.cos(heading + Math.PI / 2);
    const cars = [];
    for (const off of [-3.4, 3.4]) {
      const car = new ArcadeCar(createCarMesh('police', 0xf2f2f2), {
        x: x + px * off, z: z + pz * off, heading: heading + Math.PI / 2,
        maxSpeed: CAR_TUNING.policeSpeed, accel: 30,
      });
      this.scene.add(car.mesh);
      cars.push(car);
    }
    this.roadblocks.push({ cars, timer: WANTED_TUNING.roadblockLifetime });
    return cars;
  }

  _updateHeli(dt, playerPos) {
    const heli = this.heli;
    if (!heli) return;
    heli.rotorPhase += dt * 22;
    heli.mesh.userData.rotor.rotation.y = heli.rotorPhase;
    // A pinned helicopter (screenshot staging) holds its placed position;
    // only the rotor and the spotlight track the player.
    if (!this.heliPinned) {
      const targetX = playerPos.x - Math.sin(0.6) * 12;
      const targetZ = playerPos.z - Math.cos(0.6) * 12;
      const k = Math.min(1, dt * 1.1);
      const prevX = heli.mesh.position.x;
      const prevZ = heli.mesh.position.z;
      heli.mesh.position.x += (targetX - heli.mesh.position.x) * k;
      heli.mesh.position.z += (targetZ - heli.mesh.position.z) * k;
      // Ease toward cruise height instead of snapping: a staged helicopter
      // placed lower for the camera drifts up slowly, it never jumps.
      const targetY = CAR_TUNING.heliHeight + Math.sin(this._heliTime * 0.8) * 1.5;
      heli.mesh.position.y += (targetY - heli.mesh.position.y) * k;
      const desiredYaw = Math.atan2(
        playerPos.x - heli.mesh.position.x,
        playerPos.z - heli.mesh.position.z,
      );
      // Gentle bank into lateral movement.
      const vx = heli.mesh.position.x - prevX;
      const vz = heli.mesh.position.z - prevZ;
      heli.mesh.rotation.z = THREE.MathUtils.clamp((vz * Math.cos(desiredYaw) - vx * Math.sin(desiredYaw)) * -0.06, -0.18, 0.18);
      heli.mesh.rotation.y = desiredYaw;
    }
    // The searchlight pool stays on the ground whatever height the heli is at.
    heli.mesh.userData.pool.position.y = 0.15 - heli.mesh.position.y;
    heli.light.position.copy(heli.mesh.position);
    heli.lightTarget.position.set(playerPos.x, 0, playerPos.z);
  }

  update(dt, world) {
    const { player, audio, hud } = world;
    const playerPos = player.position;
    this.spawnTimer -= dt;
    this.roadblockTimer -= dt;
    this._heliTime = (this._heliTime || 0) + dt;

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

    // HAWK-1 at 3+ stars; gone when the heat drops below.
    if (this.stars >= WANTED_TUNING.heliStars) {
      if (!this.heli) {
        this._spawnHeli(playerPos);
        hud.flashMessage('HAWK-1 is overhead — the spotlight is on you.', 4);
        audio.heliRadio();
      }
    } else if (this.heli && !this.heliPinned) {
      this._removeHeli();
    }
    this._updateHeli(dt, playerPos);

    // Roadblocks at 4+ stars, one at a time, ahead of the player.
    if (this.stars >= WANTED_TUNING.roadblockStars) {
      if (this.roadblocks.length === 0 && this.roadblockTimer <= 0 && player.state === 'driving') {
        this._spawnRoadblock(playerPos, player.heading);
        this.roadblockTimer = WANTED_TUNING.roadblockInterval;
        hud.flashMessage('SAPD dispatch: roadblock ahead!', 4);
      }
    } else if (this.roadblocks.length > 0) {
      this._clearRoadblocks();
    }
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.timer -= dt;
      const d = Math.hypot(rb.cars[0].position.x - playerPos.x, rb.cars[0].position.z - playerPos.z);
      if (rb.timer <= 0 || d > 140) {
        for (const car of rb.cars) this.scene.remove(car.mesh);
        this.roadblocks.splice(i, 1);
      } else {
        for (const car of rb.cars) car.updateVisual(dt, 0); // light bars keep flashing
      }
    }

    // Heat decay while no police can see the player. The helicopter's
    // spotlight counts as being seen: no losing them while HAWK-1 is up.
    const nearest = this.nearestPoliceDist(playerPos);
    if (this.stars > 0) {
      if ((nearest > 45 || this.police.length === 0) && !this.heli) {
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

    // Siren loudness follows the nearest cruiser; the rotor follows HAWK-1.
    audio.setSiren(this.stars > 0 && nearest < 90, nearest);
    audio.setHeli(!!this.heli);

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
