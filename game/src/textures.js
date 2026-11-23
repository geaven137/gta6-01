// Procedural textures, all drawn on canvas at load time: no image assets,
// so the game ships zero files beyond its code and stays fully offline.
import * as THREE from '../vendor/three.module.min.js';
import { CITY } from './config.js';
import { rangeInt } from './random.js';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// One big ground texture for the whole city: roads, sidewalks, lane dashes
// and crosswalks painted in a single pass, so there is no z-fighting.
export function makeGroundTexture(roads) {
  const size = 2048;
  const world = CITY.groundSize;
  const toPx = (v) => ((v + world / 2) / world) * size;
  return canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#8a9a72';
    ctx.fillRect(0, 0, size, size);
    // Sand beach + sea on the east edge. Golden hour: warm sand, a deep
    // teal sea, and amber glints on the water.
    ctx.fillStyle = '#e9c98a';
    ctx.fillRect(toPx(CITY.beachX), 0, toPx(CITY.waterX) - toPx(CITY.beachX), size);
    ctx.fillStyle = '#3d6a8a';
    ctx.fillRect(toPx(CITY.waterX), 0, size - toPx(CITY.waterX), size);
    ctx.fillStyle = '#f2c48d';
    for (let y = 0; y < size; y += 46) {
      ctx.fillRect(toPx(CITY.waterX) + 8, y, 60, 3);
    }
    // Sidewalk slabs under every block.
    ctx.fillStyle = '#b9b2a0';
    for (const bx of roads.blockCentres) {
      for (const bz of roads.blockCentres) {
        const s = ((CITY.blockSize + 4) / world) * size;
        ctx.fillRect(toPx(bx) - s / 2, toPx(bz) - s / 2, s, s);
      }
    }
    // Asphalt strips.
    ctx.fillStyle = '#3a3f45';
    const w = (CITY.roadWidth / world) * size;
    const span = ((roads.extent * 2) / world) * size;
    for (const r of roads.coords) {
      ctx.fillRect(toPx(-roads.extent), toPx(r) - w / 2, span, w);
      ctx.fillRect(toPx(r) - w / 2, toPx(-roads.extent), w, span);
    }
    // Centre dashes (skipped near intersections so they never merge).
    ctx.fillStyle = '#d9b93a';
    const dashW = (3 / world) * size;
    const stepW = 8;
    const nearCrossing = (v) => roads.coords.some((c) => Math.abs(v - c) < 13);
    for (const r of roads.coords) {
      for (let d = -roads.extent; d < roads.extent; d += stepW) {
        if (nearCrossing(d)) continue;
        ctx.fillRect(toPx(d), toPx(r) - 1, dashW, 2);
        ctx.fillRect(toPx(r) - 1, toPx(d), 2, dashW);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(240,240,235,0.85)';
    for (const rx of roads.coords) {
      for (const rz of roads.coords) {
        for (let k = -1; k <= 1; k++) {
          ctx.fillRect(toPx(rx) - w / 2 + 7, toPx(rz) + k * 8 - 1.5, w - 14, 3);
          ctx.fillRect(toPx(rx) + k * 8 - 1.5, toPx(rz) - w / 2 + 7, 3, w - 14);
        }
      }
    }
  });
}

// A building facade: window grid with a few lit windows, tinted per building.
export function makeFacadeTexture(rng, baseColor, floors, cols) {
  const base = typeof baseColor === 'number' ? '#' + baseColor.toString(16).padStart(6, '0') : baseColor;
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical shading so flat walls read as volumes.
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.07)');
    grad.addColorStop(0.25, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / floors;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        // Golden hour: nearly half the windows are already lit.
        const lit = rng() < 0.45;
        ctx.fillStyle = lit ? '#ffe9a8' : (rng() < 0.5 ? '#4a6a7c' : '#5d8296');
        ctx.fillRect(c * cw + cw * 0.22, f * ch + ch * 0.25, cw * 0.56, ch * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(c * cw + cw * 0.22, f * ch + ch * 0.25, cw * 0.56, 2);
      }
    }
    // Ground-floor shopfront band.
    ctx.fillStyle = 'rgba(20,24,30,0.55)';
    ctx.fillRect(0, h - ch * 0.9, w, ch * 0.9);
    ctx.fillStyle = '#ffd98a';
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.6) ctx.fillRect(c * cw + cw * 0.2, h - ch * 0.62, cw * 0.6, ch * 0.4);
    }
  });
}

// Billboard / sign text on a coloured board.
export function makeSignTexture(lines, bg, fg) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      ctx.font = `bold ${i === 0 ? 64 : 34}px system-ui, sans-serif`;
      ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 72);
    });
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

// Floating cash pickup: a green banknote face.
export function makeCashTexture() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#1e8e4f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c8f5d8';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#eafff1';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$50', w / 2, h / 2 + 2);
  });
}

// Floating ammo pickup: an orange supply crate face.
export function makeAmmoTexture() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#b45a1b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd9a8';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#fff3e0';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AMMO', w / 2, h / 2 + 2);
  });
}

// Soft round sprite for particles, muzzle flashes and beacons.
export function makeGlowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return '#' + c.getHexString();
}

export { rangeInt };
