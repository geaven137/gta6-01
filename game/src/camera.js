// Third-person chase camera: follows behind the player's heading, lets the
// mouse drag an orbit that eases back, kicks the FOV with speed, and shakes
// on impacts. A slow orbit frames the city behind the start menu.
import * as THREE from '../vendor/three.module.min.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // look direction (world): camera sits opposite it
    this.pitch = 0.32;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.trauma = 0;
    this.menuAngle = 0.6;
    this.reverse = false; // screenshot staging: look back at the chase
    this.position = new THREE.Vector3(0, 40, 120);
    this.lookTarget = new THREE.Vector3(0, 2, 0);
  }

  get lookYaw() {
    return this.yaw;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, target, heading, mode, input, speed) {
    const { dx, dy } = input.consumeMouse();
    if (input.dragging || input.mouseDown) {
      this.orbitYaw -= dx * 0.0045;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.003, -0.25, 0.45);
    } else {
      // Ease the orbit back to straight behind the player.
      this.orbitYaw *= Math.max(0, 1 - dt * 1.4);
      this.orbitPitch *= Math.max(0, 1 - dt * 1.4);
    }

    let desiredYaw;
    let distance;
    let height;
    let fov = 62;
    if (mode === 'menu') {
      this.menuAngle += dt * 0.045;
      const cx = Math.sin(this.menuAngle) * 130;
      const cz = Math.cos(this.menuAngle) * 130;
      this.position.lerp(new THREE.Vector3(cx, 58, cz), Math.min(1, dt * 1.5));
      this.lookTarget.lerp(new THREE.Vector3(0, 4, 0), Math.min(1, dt * 1.5));
      this.camera.position.copy(this.position);
      this.camera.lookAt(this.lookTarget);
      this.camera.fov += (58 - this.camera.fov) * Math.min(1, dt * 2);
      this.camera.updateProjectionMatrix();
      return;
    }
    if (mode === 'driving') {
      desiredYaw = heading + this.orbitYaw + (this.reverse ? Math.PI : 0);
      distance = 10.5;
      height = 4.4;
      fov = 62 + Math.min(12, Math.abs(speed) * 0.28);
    } else {
      desiredYaw = heading + this.orbitYaw + (this.reverse ? Math.PI : 0);
      distance = 7.2;
      height = 3.1;
    }
    const diff = wrapAngle(desiredYaw - this.yaw);
    const rate = mode === 'driving' ? 3.2 : 5.0;
    this.yaw += THREE.MathUtils.clamp(diff, -rate * dt, rate * dt);
    this.pitch += ((mode === 'driving' ? 0.3 : 0.36) + this.orbitPitch - this.pitch) * Math.min(1, dt * 4);

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const desired = new THREE.Vector3(
      target.x - fx * distance,
      target.y + height + Math.sin(this.pitch) * distance * 0.4,
      target.z - fz * distance,
    );
    desired.y = Math.max(1.6, desired.y);
    this.position.lerp(desired, Math.min(1, dt * 7));
    this.lookTarget.lerp(new THREE.Vector3(target.x + fx * 2.5, target.y + 1.7, target.z + fz * 2.5), Math.min(1, dt * 9));

    // Trauma shake, decaying.
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const shake = this.trauma * this.trauma;
    const sx = (Math.random() * 2 - 1) * shake * 0.5;
    const sy = (Math.random() * 2 - 1) * shake * 0.4;
    this.camera.position.set(this.position.x + sx, this.position.y + sy, this.position.z);
    this.camera.lookAt(this.lookTarget);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
  }

  snapBehind(target, heading) {
    this.yaw = heading;
    this.orbitYaw = 0;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    this.position.set(target.x - fx * 9, target.y + 4, target.z - fz * 9);
    this.lookTarget.set(target.x, target.y + 1.7, target.z);
  }
}
