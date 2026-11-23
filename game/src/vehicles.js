// Cars: low-poly meshes built from boxes and cylinders, and the arcade
// driving model every car in Santa Aurelia shares — player, traffic, police.
// Every car has a name and a condition, shown on the HUD while driving.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_TUNING } from './config.js';
import { collideCircle } from './city.js';

// Names the HUD shows for each body type. Original names, all ours.
export const CAR_NAMES = {
  sedan: ['Aurora Sedan', 'Marisol Cruiser', 'Vega Four-Door'],
  sports: ['Comet GT', 'Falcon SS', 'Vesper Roadster'],
  taxi: ['Aurelia Cab', 'Sunset Taxi'],
  van: ['Hauler Van', 'Docks Van'],
  police: ['SAPD Cruiser'],
};

const BODY = {
  sedan: { w: 2.0, l: 4.4, h: 0.72, cabinL: 2.2, cabinH: 0.62, y: 0.62 },
  sports: { w: 2.0, l: 4.6, h: 0.58, cabinL: 1.9, cabinH: 0.5, y: 0.52 },
  taxi: { w: 2.0, l: 4.4, h: 0.72, cabinL: 2.2, cabinH: 0.62, y: 0.62 },
  van: { w: 2.1, l: 5.0, h: 1.15, cabinL: 3.4, cabinH: 0.75, y: 0.75 },
  police: { w: 2.0, l: 4.5, h: 0.72, cabinL: 2.2, cabinH: 0.62, y: 0.62 },
};

export function createCarMesh(type, color) {
  const spec = BODY[type] || BODY.sedan;
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.12, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // Body + cabin. The car faces +z; its nose is at +z.
  box(spec.w, spec.h, spec.l, paint, 0, spec.y, 0);
  const cabin = box(spec.w - 0.24, spec.cabinH, spec.cabinL, glass, 0, spec.y + spec.h / 2 + spec.cabinH / 2 - 0.04, -0.25);
  cabin.castShadow = true;
  box(spec.w - 0.2, 0.1, spec.cabinL - 0.1, paint, 0, spec.y + spec.h / 2 + spec.cabinH + 0.02, -0.25); // roof
  if (type === 'sports') {
    box(spec.w - 0.3, 0.08, 0.5, dark, 0, spec.y + spec.h + 0.28, -spec.l / 2 + 0.3); // spoiler
    box(0.1, 0.28, 0.1, dark, -0.7, spec.y + spec.h + 0.12, -spec.l / 2 + 0.3);
    box(0.1, 0.28, 0.1, dark, 0.7, spec.y + spec.h + 0.12, -spec.l / 2 + 0.3);
  }
  if (type === 'taxi') {
    box(0.9, 0.22, 0.4, new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 0.5 }), 0, spec.y + spec.h / 2 + spec.cabinH + 0.16, -0.25);
  }
  // Headlights, taillights, bumpers. Golden hour: the headlights are on.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8d0, emissive: 0xfff2b0, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x881111, emissiveIntensity: 1.1 });
  box(0.42, 0.18, 0.08, headMat, -0.68, spec.y + 0.08, spec.l / 2 + 0.01);
  box(0.42, 0.18, 0.08, headMat, 0.68, spec.y + 0.08, spec.l / 2 + 0.01);
  box(0.42, 0.18, 0.08, tailMat, -0.68, spec.y + 0.08, -spec.l / 2 - 0.01);
  box(0.42, 0.18, 0.08, tailMat, 0.68, spec.y + 0.08, -spec.l / 2 - 0.01);
  box(spec.w + 0.06, 0.22, 0.18, dark, 0, spec.y - 0.22, spec.l / 2);
  box(spec.w + 0.06, 0.22, 0.18, dark, 0, spec.y - 0.22, -spec.l / 2);

  // Police light bar: red and blue beacons that flash in turns.
  let lightBar = null;
  if (type === 'police') {
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.2 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x0033ff, emissiveIntensity: 0.2 });
    box(1.5, 0.14, 0.34, dark, 0, spec.y + spec.h / 2 + spec.cabinH + 0.1, -0.25);
    const red = box(0.6, 0.16, 0.3, redMat, -0.38, spec.y + spec.h / 2 + spec.cabinH + 0.2, -0.25);
    const blue = box(0.6, 0.16, 0.3, blueMat, 0.38, spec.y + spec.h / 2 + spec.cabinH + 0.2, -0.25);
    lightBar = { red: red.material, blue: blue.material };
  }

  // Wheels: steer group > spin group > tyre mesh (axle along local X).
  const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.7 });
  const steerGroups = [];
  const spinGroups = [];
  const wheelZ = spec.l / 2 - 0.85;
  for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const steer = new THREE.Group();
    steer.position.set(sx * (spec.w / 2 - 0.08), 0.36, sz * wheelZ);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    spin.add(tyre, hub);
    steer.add(spin);
    group.add(steer);
    spinGroups.push(spin);
    if (front) steerGroups.push(steer);
  }

  group.userData = { steerGroups, spinGroups, lightBar, type, length: spec.l, paintMat: paint };
  return group;
}

// Arcade car: throttle/steer in, position and heading out, with building
// collision and a crash callback for effects and damage.
export class ArcadeCar {
  constructor(mesh, options = {}) {
    this.mesh = mesh;
    this.heading = options.heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.maxSpeed = options.maxSpeed || CAR_TUNING.maxSpeed;
    this.accel = options.accel || CAR_TUNING.accel;
    this.health = options.health || 100;
    this.type = mesh.userData.type;
    this.isPolice = this.type === 'police';
    this.isPlayer = false;
    // A name for the HUD: the mission cars are named, the rest take the
    // first name of their body type (deterministic, no RNG here).
    this.name = options.name || (CAR_NAMES[this.type] ? CAR_NAMES[this.type][0] : 'Street Car');
    this.sirenPhase = 0;
    this.smoking = false;
    this.dead = false;
    this.mesh.position.set(options.x || 0, 0, options.z || 0);
    this.mesh.rotation.y = this.heading;
  }

  get position() {
    return this.mesh.position;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  // throttle -1..1, steerInput -1..1. Returns impact speed on a crash, else 0.
  drive(throttle, steerInput, dt, city) {
    if (this.dead) { throttle = 0; }
    const braking = throttle < 0 && this.speed > 0.5;
    const power = braking ? CAR_TUNING.brake : this.accel;
    this.speed += throttle * power * dt;
    // Rolling drag + stronger drag at speed.
    this.speed -= this.speed * CAR_TUNING.drag * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = Math.max(-CAR_TUNING.maxReverse, Math.min(this.maxSpeed, this.speed));
    // Steering bites with speed and flips in reverse.
    const grip = Math.min(1, Math.abs(this.speed) / 7);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += steerInput * CAR_TUNING.steerRate * grip * dir * dt;
    this.steer += (steerInput - this.steer) * Math.min(1, dt * 8);

    const f = this.forward();
    const impactSpeed = Math.abs(this.speed);
    this.mesh.position.x += f.x * this.speed * dt;
    this.mesh.position.z += f.z * this.speed * dt;
    this.mesh.rotation.y = this.heading;

    // Two-circle collision: nose and tail.
    let impact = 0;
    for (const off of [1.4, -1.4]) {
      const p = new THREE.Vector3(
        this.mesh.position.x + f.x * off,
        0,
        this.mesh.position.z + f.z * off,
      );
      const before = { x: p.x, z: p.z };
      const hit = collideCircle(p, 1.35, city.colliders);
      if (hit) {
        this.mesh.position.x += p.x - before.x;
        this.mesh.position.z += p.z - before.z;
        if (impactSpeed > 3) impact = Math.max(impact, impactSpeed);
        this.speed *= 0.35;
      }
    }
    // World bounds and the sea.
    const b = city.bounds;
    this.mesh.position.x = Math.max(b.min, Math.min(b.waterX - 3, this.mesh.position.x));
    this.mesh.position.z = Math.max(b.min, Math.min(b.max, this.mesh.position.z));
    return impact;
  }

  updateVisual(dt, time) {
    const { steerGroups, spinGroups, lightBar } = this.mesh.userData;
    for (const s of steerGroups) s.rotation.y = this.steer * 0.42;
    const spin = (this.speed * dt) / 0.36;
    for (const s of spinGroups) s.rotation.x += spin;
    // Body lean into steering and squat under acceleration.
    this.mesh.rotation.z = -this.steer * Math.min(1, Math.abs(this.speed) / 20) * 0.05;
    if (lightBar) {
      this.sirenPhase += dt * 9;
      const on = Math.sin(this.sirenPhase) > 0;
      lightBar.red.emissiveIntensity = on ? 2.6 : 0.15;
      lightBar.blue.emissiveIntensity = on ? 0.15 : 2.6;
      void time;
    }
  }

  setLightBar(on) {
    const bar = this.mesh.userData.lightBar;
    if (!bar) return;
    if (!on) {
      bar.red.emissiveIntensity = 0.15;
      bar.blue.emissiveIntensity = 0.15;
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 35) this.smoking = true;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }
}
