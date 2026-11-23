// Cash pickups: spinning banknotes scattered over the sidewalks. Free-roam
// progression between missions — grab one and the wallet grows.
import * as THREE from '../vendor/three.module.min.js';
import { ECONOMY } from './config.js';
import { makeCashTexture } from './textures.js';

export class CashPickupField {
  constructor(scene, city, rng, count = 12) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.texture = makeCashTexture();
    this.pickups = [];
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.DoubleSide, transparent: true });
      const a = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), mat);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), mat);
      b.rotation.y = Math.PI / 2;
      group.add(a, b);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.2, 20),
        new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      group.add(ring);
      scene.add(group);
      const pickup = { group, phase: rng() * Math.PI * 2 };
      this.pickups.push(pickup);
      this._place(pickup, { x: -29, z: -29 }, 25);
    }
  }

  _place(pickup, awayFrom, minDist) {
    for (let tries = 0; tries < 20; tries++) {
      const p = this.city.randomSidewalkPoint(this.rng);
      if (Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z) >= minDist) {
        pickup.group.position.set(p.x, 1.3, p.z);
        return;
      }
    }
    const p = this.city.randomSidewalkPoint(this.rng);
    pickup.group.position.set(p.x, 1.3, p.z);
  }

  positions() {
    return this.pickups.map((p) => p.group.position);
  }

  update(dt, world) {
    const playerPos = world.player.position;
    for (const p of this.pickups) {
      p.phase += dt * 2.2;
      p.group.rotation.y = p.phase;
      p.group.position.y = 1.3 + Math.sin(p.phase * 1.4) * 0.25;
      const d = Math.hypot(p.group.position.x - playerPos.x, p.group.position.z - playerPos.z);
      if (d < 2.4) {
        world.cash += ECONOMY.pickupValue;
        world.audio.pickup();
        world.effects.burst(p.group.position, 0x2ecc71, 14, 4, 0.6);
        world.hud.floatText(`+$${ECONOMY.pickupValue}`, '#2ecc71');
        world.saveGame();
        this._place(p, playerPos, 45);
      }
    }
  }
}
