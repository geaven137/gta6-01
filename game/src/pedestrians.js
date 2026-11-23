// Pedestrians: sidewalk walkers with a simple walk cycle who flee gunshots
// and fast cars, and go down when hit. One humanoid builder serves peds and
// the player, with different clothes. Locals have names for the chatter.
import * as THREE from '../vendor/three.module.min.js';
import { PALETTE } from './config.js';
import { range, pick } from './random.js';

// First names for Santa Aurelia locals (used by the chatter system).
export const PED_NAMES = [
  'Ana', 'Marco', 'Luz', 'Tomas', 'Elena', 'Rico', 'Sofia', 'Diego',
  'Carmen', 'Luis', 'Nina', 'Pablo', 'Isabel', 'Jorge', 'Marta', 'Felix',
];

export function buildHumanoid({ shirt, pants, skin, capColor = null }) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });

  const limb = (w, h, d, mat, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    pivot.add(mesh); // limbs skip the shadow pass: torso and head carry it
    group.add(pivot);
    return pivot;
  };

  const legL = limb(0.22, 0.8, 0.24, pantsMat, -0.13, 0.82);
  const legR = limb(0.22, 0.8, 0.24, pantsMat, 0.13, 0.82);
  const armL = limb(0.16, 0.68, 0.18, shirtMat, -0.4, 1.48);
  const armR = limb(0.16, 0.68, 0.18, shirtMat, 0.4, 1.48);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.34), shirtMat);
  torso.position.y = 1.16;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);

  if (capColor !== null) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.8 }));
    cap.position.y = 1.94;
    group.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.8 }));
    brim.position.set(0, 1.9, 0.3);
    group.add(brim);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), new THREE.MeshStandardMaterial({ color: pickHair(), roughness: 0.95 }));
    hair.position.y = 1.93;
    group.add(hair);
  }

  group.userData = { legL, legR, armL, armR };
  return group;
}

function pickHair() {
  return [0x1a1a1a, 0x4a2f1a, 0x7a5a2a, 0x8a8a8a, 0x2a1a0a][Math.floor(Math.random() * 5)];
}

export function animateWalk(mesh, phase, amount) {
  const { legL, legR, armL, armR } = mesh.userData;
  const swing = Math.sin(phase) * 0.65 * amount;
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  armL.rotation.x = -swing * 0.8;
  armR.rotation.x = swing * 0.8;
}

export class PedestrianManager {
  constructor(scene, city, rng, count = 22) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const mesh = buildHumanoid({
        shirt: pick(rng, PALETTE.pedShirt),
        pants: pick(rng, [0x2c3e50, 0x5d4037, 0x37474f, 0x1a1a2e]),
        skin: pick(rng, PALETTE.pedSkin),
      });
      const start = city.randomSidewalkPoint(rng);
      mesh.position.set(start.x, 0, start.z);
      scene.add(mesh);
      this.peds.push({
        mesh,
        name: PED_NAMES[Math.floor(rng() * PED_NAMES.length)],
        heading: range(rng, 0, Math.PI * 2),
        speed: range(rng, 1.2, 2.0),
        target: city.randomSidewalkPoint(rng),
        state: 'walk',
        timer: 0,
        phase: range(rng, 0, Math.PI * 2),
        fleeFrom: null,
      });
    }
  }

  pedsNear(x, z, range_) {
    const out = [];
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < range_) out.push({ ped: p, dist: d });
    }
    return out;
  }

  knockDown(ped, fromX, fromZ) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.timer = 0;
    ped.downFrom = { x: fromX, z: fromZ };
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.state !== 'walk') continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < radius) {
        p.state = 'flee';
        p.timer = range(this.rng, 2, 3.5);
        p.fleeFrom = { x, z };
      }
    }
  }

  update(dt, playerPos, cars) {
    for (const p of this.peds) {
      const m = p.mesh;
      if (p.state === 'down') {
        // Fall over, lie still, then get up far away and walk off.
        p.timer += dt;
        const k = Math.min(1, p.timer / 0.25);
        m.rotation.x = -Math.PI / 2 * k;
        if (p.timer > 5) {
          const spot = this.city.randomSidewalkPoint(this.rng);
          if (Math.hypot(spot.x - playerPos.x, spot.z - playerPos.z) < 40) continue;
          m.position.set(spot.x, 0, spot.z);
          m.rotation.x = 0;
          p.state = 'walk';
          p.target = this.city.randomSidewalkPoint(this.rng);
        }
        continue;
      }
      let speed = p.speed;
      let tx;
      let tz;
      if (p.state === 'flee') {
        p.timer -= dt;
        speed = 6.5;
        const dx = m.position.x - p.fleeFrom.x;
        const dz = m.position.z - p.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = m.position.x + (dx / d) * 20;
        tz = m.position.z + (dz / d) * 20;
        if (p.timer <= 0) {
          p.state = 'walk';
          p.target = this.city.randomSidewalkPoint(this.rng);
        }
      } else {
        tx = p.target.x;
        tz = p.target.z;
        // A fast car bearing down makes peds scatter.
        for (const car of cars) {
          if (Math.abs(car.speed) < 7) continue;
          const d = Math.hypot(car.position.x - m.position.x, car.position.z - m.position.z);
          if (d < 9) {
            p.state = 'flee';
            p.timer = 2.5;
            p.fleeFrom = { x: car.position.x, z: car.position.z };
            break;
          }
        }
        if (Math.hypot(tx - m.position.x, tz - m.position.z) < 2) {
          p.target = this.city.randomSidewalkPoint(this.rng);
        }
      }
      const dx = tx - m.position.x;
      const dz = tz - m.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1) {
        const desired = Math.atan2(dx, dz);
        let diff = desired - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += THREE.MathUtils.clamp(diff, -3.2 * dt, 3.2 * dt);
        m.position.x += Math.sin(p.heading) * speed * dt;
        m.position.z += Math.cos(p.heading) * speed * dt;
        m.rotation.y = p.heading;
        p.phase += dt * speed * 3.2;
        animateWalk(m, p.phase, Math.min(1, speed / 2));
      }
      // Stay out of buildings and the sea.
      m.position.x = Math.max(-260, Math.min(this.city.bounds.waterX - 4, m.position.x));
      m.position.z = Math.max(-260, Math.min(260, m.position.z));
    }
  }
}
