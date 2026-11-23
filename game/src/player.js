// The player, Mara Voss: on-foot movement with a walk cycle, entering and
// leaving cars, health, and a punch for close trouble. Aurelia General
// patches her up when she walks past it.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER_TUNING, PLACES } from './config.js';
import { collideCircle } from './city.js';
import { buildHumanoid, animateWalk } from './pedestrians.js';

export class PlayerController {
  constructor(scene, start) {
    this.mesh = buildHumanoid({
      shirt: 0x8e2f2f,
      pants: 0x2c3e50,
      skin: 0xe0ac69,
      capColor: 0x1a1a1a,
    });
    this.mesh.position.set(start.x, 0, start.z);
    this.heading = start.heading || 0;
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
    this.state = 'foot'; // 'foot' | 'driving'
    this.car = null;
    this.health = PLAYER_TUNING.maxHealth;
    this.moveSpeed = 0;
    this.walkPhase = 0;
    this.punchCooldown = 0;
  }

  get position() {
    return this.state === 'driving' && this.car ? this.car.position : this.mesh.position;
  }

  get speed() {
    if (this.state === 'driving' && this.car) return Math.abs(this.car.speed);
    return this.moveSpeed;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  update(dt, input, cameraYaw, city) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (this.state === 'driving') {
      if (!this.car) { this.state = 'foot'; return; }
      const throttle = input.down('KeyW') || input.down('ArrowUp') ? 1 : input.down('KeyS') || input.down('ArrowDown') ? -1 : 0;
      let steer = 0;
      if (input.down('KeyA') || input.down('ArrowLeft')) steer += 1;
      if (input.down('KeyD') || input.down('ArrowRight')) steer -= 1;
      const impact = this.car.drive(throttle, steer, dt, city);
      if (input.down('Space')) {
        this.car.speed *= Math.max(0, 1 - 3.2 * dt); // handbrake
      }
      this.heading = this.car.heading;
      this.mesh.position.copy(this.car.position);
      this.mesh.rotation.y = this.heading;
      return impact;
    }

    // On foot: WASD relative to the camera's ground-projected forward.
    const axes = input.moveAxes();
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const rx = -Math.cos(cameraYaw);
    const rz = Math.sin(cameraYaw);
    let mx = fx * -axes.z + rx * axes.x;
    let mz = fz * -axes.z + rz * axes.x;
    const len = Math.hypot(mx, mz);
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const target = len > 0.01 ? (running ? PLAYER_TUNING.runSpeed : PLAYER_TUNING.walkSpeed) : 0;
    this.moveSpeed += (target - this.moveSpeed) * Math.min(1, dt * 10);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const desired = Math.atan2(mx, mz);
      let diff = desired - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += THREE.MathUtils.clamp(diff, -PLAYER_TUNING.turnRate * dt, PLAYER_TUNING.turnRate * dt);
      this.mesh.position.x += mx * this.moveSpeed * dt;
      this.mesh.position.z += mz * this.moveSpeed * dt;
      this.walkPhase += dt * this.moveSpeed * 1.6;
      animateWalk(this.mesh, this.walkPhase, Math.min(1, this.moveSpeed / PLAYER_TUNING.walkSpeed));
    } else {
      animateWalk(this.mesh, this.walkPhase, 0);
    }
    this.mesh.rotation.y = this.heading;
    collideCircle(this.mesh.position, 0.6, city.colliders);
    const b = city.bounds;
    this.mesh.position.x = Math.max(b.min, Math.min(b.waterX - 3, this.mesh.position.x));
    this.mesh.position.z = Math.max(b.min, Math.min(b.max, this.mesh.position.z));
    // Aurelia General heals on foot, slowly, when Mara walks past it.
    if (Math.hypot(this.mesh.position.x - PLACES.hospital.x, this.mesh.position.z - PLACES.hospital.z) < 14) {
      this.heal(6 * dt);
    }
    return 0;
  }

  enterCar(car) {
    this.car = car;
    this.state = 'driving';
    car.isPlayer = true;
    this.mesh.visible = false;
    this.heading = car.heading;
  }

  exitCar() {
    if (!this.car) return;
    const f = this.car.forward();
    // Step out on the car's left side.
    this.mesh.position.set(
      this.car.position.x - f.z * 2.2,
      0,
      this.car.position.z + f.x * 2.2,
    );
    this.car.isPlayer = false;
    this.car = null;
    this.state = 'foot';
    this.mesh.visible = true;
    this.moveSpeed = 0;
  }

  punch(peds) {
    if (this.punchCooldown > 0 || this.state !== 'foot') return null;
    this.punchCooldown = 0.45;
    const f = this.forward;
    let best = null;
    let bestD = PLAYER_TUNING.punchRange;
    for (const { ped, dist } of peds.pedsNear(this.mesh.position.x, this.mesh.position.z, PLAYER_TUNING.punchRange)) {
      const dx = ped.mesh.position.x - this.mesh.position.x;
      const dz = ped.mesh.position.z - this.mesh.position.z;
      const facing = (dx * f.x + dz * f.z) / (dist || 1);
      if (facing > 0.2 && dist < bestD) { bestD = dist; best = ped; }
    }
    if (best) peds.knockDown(best, this.mesh.position.x, this.mesh.position.z);
    // Swing animation: quick arm jab.
    this.mesh.userData.armR.rotation.x = -1.6;
    setTimeout(() => { this.mesh.userData.armR.rotation.x = 0; }, 180);
    return best;
  }

  takeDamage(amount) {
    if (this.health <= 0) return true;
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(PLAYER_TUNING.maxHealth, this.health + amount);
  }

  respawn(start) {
    if (this.car) {
      this.car.isPlayer = false;
      this.car = null;
    }
    this.state = 'foot';
    this.mesh.visible = true;
    this.mesh.position.set(start.x, 0, start.z);
    this.heading = start.heading || 0;
    this.mesh.rotation.y = this.heading;
    this.health = PLAYER_TUNING.maxHealth;
    this.moveSpeed = 0;
  }
}
