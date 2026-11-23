// Combat: a hitscan pistol with tracers and muzzle flash, plus the punch.
// Bullets test pedestrians and cars with the raycaster and buildings with a
// hand-rolled ray-vs-AABB test, so shots stop at walls.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED_TUNING } from './config.js';

const MAX_RANGE = 90;

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
  }

  muzzlePosition(player) {
    const f = player.forward;
    return new THREE.Vector3(
      player.mesh.position.x + f.x * 0.7,
      1.45,
      player.mesh.position.z + f.z * 0.7,
    );
  }

  shoot(world) {
    if (this.cooldown > 0) return null;
    const { player, peds, police, audio, hud } = world;
    if (player.state !== 'foot') return null;
    this.cooldown = 0.22;

    this.raycaster.setFromCamera(this.center, this.camera);
    const origin = this.raycaster.ray.origin;
    const dir = this.raycaster.ray.direction;

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

    const muzzle = this.muzzlePosition(player);
    this.effects.muzzleFlash(muzzle);
    audio.gunshot();
    police.addHeat(WANTED_TUNING.shoot, 'gunfire');
    peds.scare(player.position.x, player.position.z, 26);

    const meshDist = meshHits.length ? meshHits[0].distance : Infinity;
    const best = Math.min(meshDist, buildingDist, groundDist, MAX_RANGE);
    const hitPoint = origin.clone().addScaledVector(dir, best);
    this.effects.tracer(muzzle, hitPoint);

    if (meshDist <= buildingDist && meshDist <= groundDist && meshHits.length) {
      const hitObject = meshHits[0].object;
      // Walk up to the ped or car root group.
      let root = hitObject;
      while (root.parent && root.parent !== this.scene && root.parent.type !== 'Scene') root = root.parent;
      const ped = peds.peds.find((p) => p.mesh === root);
      if (ped) {
        peds.knockDown(ped, player.position.x, player.position.z);
        this.effects.burst(hitPoint, 0xcc2222, 10, 3, 0.5);
        police.addHeat(WANTED_TUNING.killPedestrian, 'ped down');
        hud.flashMessage('Pedestrian down — the cops are coming');
        return { type: 'ped', point: hitPoint };
      }
      const car = world.allCars().find((c) => c.mesh === root);
      if (car) {
        car.damage(30);
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
  }
}
