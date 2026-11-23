// Combat: four weapon slots with magazines, reserves and reloads, plus the
// punch. Bullets test pedestrians and cars with the raycaster and buildings
// with a hand-rolled ray-vs-AABB test, so shots stop at walls. Keys 1-4
// switch weapons, Q cycles, R reloads, the mouse wheel cycles too.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED_TUNING, WEAPONS } from './config.js';

const MAX_RANGE = 120;

// Slab test: ray vs an AABB that spans y 0..top. Returns distance or null.
function rayHitBox(origin, dir, box, top) {
  let tmin = 0;
  let tmax = MAX_RANGE;
  const slabs = [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.y, dir.y, 0, top],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ];
  for (const [o, d, lo, hi] of slabs) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export class CombatSystem {
  constructor(scene, camera, effects) {
    this.scene = scene;
    this.camera = camera;
    this.effects = effects;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_RANGE;
    this.cooldown = 0;
    this.center = new THREE.Vector2(0, 0);
    this.weaponIndex = 0;
    this.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
    this.reloading = 0; // seconds left, 0 when not reloading
    this.damageMul = 1; // Rook's crew bonus, set by the game each frame
    this.canUse = null; // (index) => bool, set by the game (respect locks)
  }

  currentWeapon() {
    return WEAPONS[this.weaponIndex];
  }

  weaponState() {
    return WEAPONS.map((w, i) => ({
      name: w.name,
      slot: w.slot,
      mag: this.ammo[i].mag,
      magSize: w.mag,
      reserve: this.ammo[i].reserve,
      active: i === this.weaponIndex,
      reloading: i === this.weaponIndex && this.reloading > 0,
      locked: this.canUse ? !this.canUse(i) : false,
    }));
  }

  selectWeapon(index, hud) {
    if (index < 0 || index >= WEAPONS.length || index === this.weaponIndex) return;
    if (this.canUse && !this.canUse(index)) {
      if (hud) hud.flashMessage(`${WEAPONS[index].name} is locked — earn more respect.`, 2.5);
      return;
    }
    this.weaponIndex = index;
    this.reloading = 0;
    this.cooldown = Math.max(this.cooldown, 0.15); // a beat to draw the gun
    if (hud) hud.flashMessage(WEAPONS[index].name, 1.5);
  }

  cycleWeapon(dir, hud) {
    // Skip locked slots when cycling.
    for (let step = 1; step <= WEAPONS.length; step++) {
      const next = (this.weaponIndex + dir * step + WEAPONS.length * 2) % WEAPONS.length;
      if (!this.canUse || this.canUse(next)) {
        this.selectWeapon(next, hud);
        return;
      }
    }
  }

  reload(hud) {
    const w = this.currentWeapon();
    const a = this.ammo[this.weaponIndex];
    if (this.reloading > 0 || a.mag >= w.mag || a.reserve <= 0) return;
    this.reloading = w.reload;
    if (hud) hud.flashMessage('Reloading…', 1.2);
  }

  refillAmmo() {
    this.ammo.forEach((a, i) => {
      a.reserve = Math.min(WEAPONS[i].reserve, a.reserve + Math.ceil(WEAPONS[i].reserve / 2));
      a.mag = WEAPONS[i].mag;
    });
  }

  muzzlePosition(player) {
    const f = player.forward;
    return new THREE.Vector3(
      player.mesh.position.x + f.x * 0.7,
      1.45,
      player.mesh.position.z + f.z * 0.7,
    );
  }

  _firePellet(world, origin, dir, damage) {
    const { peds, police, audio, hud } = world;
    this.raycaster.set(origin, dir);
    this.raycaster.far = this.currentWeapon().range;
    // Mesh hits: pedestrians and cars.
    const targets = [];
    for (const p of peds.peds) if (p.state !== 'down') targets.push(p.mesh);
    for (const car of world.allCars()) targets.push(car.mesh);
    const meshHits = this.raycaster.intersectObjects(targets, true);

    // Building hits: manual AABB test.
    let buildingDist = Infinity;
    for (const box of world.city.colliders) {
      const t = rayHitBox(origin, dir, box, 60);
      if (t !== null && t < buildingDist) buildingDist = t;
    }
    // Ground hit.
    let groundDist = Infinity;
    if (dir.y < -1e-4) groundDist = -origin.y / dir.y;

    const meshDist = meshHits.length ? meshHits[0].distance : Infinity;
    const best = Math.min(meshDist, buildingDist, groundDist, this.currentWeapon().range);
    const hitPoint = origin.clone().addScaledVector(dir, best);

    if (meshDist <= buildingDist && meshDist <= groundDist && meshHits.length) {
      const hitObject = meshHits[0].object;
      // Walk up to the ped or car root group.
      let root = hitObject;
      while (root.parent && root.parent !== this.scene && root.parent.type !== 'Scene') root = root.parent;
      const ped = peds.peds.find((p) => p.mesh === root);
      if (ped) {
        peds.knockDown(ped, world.player.position.x, world.player.position.z);
        this.effects.burst(hitPoint, 0xcc2222, 10, 3, 0.5);
        police.addHeat(WANTED_TUNING.killPedestrian, 'ped down');
        hud.flashMessage('Pedestrian down — the cops are coming');
        return { type: 'ped', point: hitPoint };
      }
      const car = world.allCars().find((c) => c.mesh === root);
      if (car) {
        car.damage(damage);
        this.effects.burst(hitPoint, 0xffcc44, 12, 5, 0.5);
        if (car.dead && !car.exploded) {
          car.exploded = true;
          this.effects.explosion(car.position.clone().setY(1));
          audio.explosion();
          world.cameraShake(0.7);
        }
        return { type: 'car', point: hitPoint };
      }
    }
    this.effects.burst(hitPoint, 0xffe9a0, 8, 4, 0.4);
    return { type: 'world', point: hitPoint };
  }

  shoot(world) {
    if (this.cooldown > 0 || this.reloading > 0) return null;
    const { player, peds, police, audio, hud } = world;
    if (player.state !== 'foot') return null;
    const w = this.currentWeapon();
    const a = this.ammo[this.weaponIndex];
    if (a.mag <= 0) {
      if (a.reserve > 0) this.reload(hud);
      else hud.flashMessage(`${w.name} is dry — find an ammo crate`, 2);
      return null;
    }
    a.mag -= 1;
    this.cooldown = w.cooldown;

    this.raycaster.setFromCamera(this.center, this.camera);
    const origin = this.raycaster.ray.origin.clone();
    const baseDir = this.raycaster.ray.direction.clone();

    const muzzle = this.muzzlePosition(player);
    this.effects.muzzleFlash(muzzle);
    audio.gunshot(w.id);
    police.addHeat(WANTED_TUNING.shoot, 'gunfire');
    peds.scare(player.position.x, player.position.z, 26);

    let result = null;
    for (let p = 0; p < w.pellets; p++) {
      const dir = baseDir.clone();
      if (w.spread > 0) {
        dir.x += (Math.random() - 0.5) * w.spread * 2;
        dir.y += (Math.random() - 0.5) * w.spread * 2;
        dir.z += (Math.random() - 0.5) * w.spread * 2;
        dir.normalize();
      }
      const r = this._firePellet(world, origin, dir, w.damage * this.damageMul);
      if (p === 0) {
        this.effects.tracer(muzzle, r.point);
        result = r;
      } else if (r.type !== 'world') {
        result = r;
      }
    }
    return result;
  }

  // Click on foot: punch when someone is in reach, otherwise fire.
  punchOrShoot(world) {
    const { player, peds, police, audio } = world;
    if (player.state !== 'foot') return null;
    const hit = player.punch(peds);
    if (hit) {
      audio.punch();
      police.addHeat(WANTED_TUNING.hitPedestrian, 'assault');
      world.hud.flashMessage('That hurt someone — witnesses called it in');
      return { type: 'punch' };
    }
    return this.shoot(world);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const w = this.currentWeapon();
        const a = this.ammo[this.weaponIndex];
        const needed = w.mag - a.mag;
        const taken = Math.min(needed, a.reserve);
        a.mag += taken;
        a.reserve -= taken;
      }
    }
  }
}
