// Particles, tracers, muzzle flashes and explosions — the juice that makes
// impacts, gunfire and crashes read on screen and in screenshots.
import * as THREE from '../vendor/three.module.min.js';
import { makeGlowTexture } from './textures.js';

const MAX_PARTICLES = 700;

export class ParticleEffects {
  constructor(scene) {
    this.scene = scene;
    this.glowTexture = makeGlowTexture();
    // Additive spark points: colour darkens as life fades, so dead sparks vanish.
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.baseColor = new Float32Array(MAX_PARTICLES * 3);
    this.gravity = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.55, map: this.glowTexture, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;

    // Smoke sprites for wrecks and explosions.
    this.smokePool = [];
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.glowTexture, color: 0x555550, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.smokePool.push({ sprite, life: 0, maxLife: 1 });
    }

    // Tracer lines for gunfire.
    this.tracers = [];
    for (let i = 0; i < 6; i++) {
      const geoLine = new THREE.BufferGeometry();
      geoLine.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geoLine, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.tracerCursor = 0;

    // Muzzle flash light.
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 14, 1.8);
    scene.add(this.flashLight);
  }

  burst(pos, colorHex, count, speed, life = 0.7, gravity = -9) {
    const color = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.velocities[i * 3] = Math.cos(a) * s;
      this.velocities[i * 3 + 1] = up * s;
      this.velocities[i * 3 + 2] = Math.sin(a) * s;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.7);
      this.baseColor[i * 3] = color.r;
      this.baseColor[i * 3 + 1] = color.g;
      this.baseColor[i * 3 + 2] = color.b;
      this.gravity[i] = gravity;
    }
  }

  smoke(pos, scale = 2.5, life = 1.6) {
    const slot = this.smokePool.find((s) => s.life <= 0) || this.smokePool[0];
    slot.sprite.visible = true;
    slot.sprite.position.copy(pos);
    slot.sprite.scale.setScalar(scale);
    slot.sprite.material.opacity = 0.55;
    slot.life = slot.maxLife = life;
  }

  // Handbrake skid: a quick pale puff at the rear wheels.
  skid(pos) {
    this.smoke(pos, 1.4, 0.7);
    this.burst(pos, 0xd8d2c4, 3, 1.5, 0.3, -2);
  }

  tracer(from, to) {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    const attr = t.line.geometry.getAttribute('position');
    attr.setXYZ(0, from.x, from.y, from.z);
    attr.setXYZ(1, to.x, to.y, to.z);
    attr.needsUpdate = true;
    t.line.material.opacity = 0.9;
    t.life = 0.09;
  }

  muzzleFlash(pos) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 26;
    this.burst(pos, 0xffd27a, 6, 3, 0.12, 0);
  }

  explosion(pos) {
    this.burst(pos, 0xff7722, 46, 9, 0.9, -4);
    this.burst(pos, 0xffcc44, 24, 6, 0.6, -2);
    this.smoke(new THREE.Vector3(pos.x, pos.y + 1.5, pos.z), 4.5, 2.2);
    this.smoke(new THREE.Vector3(pos.x, pos.y + 2.5, pos.z), 3.5, 1.8);
    this.flashLight.position.set(pos.x, pos.y + 2, pos.z);
    this.flashLight.intensity = 60;
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
        continue;
      }
      this.velocities[i * 3 + 1] += this.gravity[i] * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        this.velocities[i * 3 + 1] *= -0.4;
      }
      const k = this.life[i] / this.maxLife[i];
      this.colors[i * 3] = this.baseColor[i * 3] * k;
      this.colors[i * 3 + 1] = this.baseColor[i * 3 + 1] * k;
      this.colors[i * 3 + 2] = this.baseColor[i * 3 + 2] * k;
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
    for (const s of this.smokePool) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = Math.max(0, s.life / s.maxLife);
      s.sprite.material.opacity = 0.55 * k;
      s.sprite.scale.multiplyScalar(1 + dt * 0.7);
      s.sprite.position.y += dt * 1.2;
      if (s.life <= 0) s.sprite.visible = false;
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    }
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 320);
  }
}
