// Minimap: a north-up 2D canvas that redraws the city grid, the player
// arrow, mission blips, police and cash every frame.
import { CITY, PLACES } from './config.js';

export class Minimap {
  constructor(canvas, city) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.city = city;
    this.size = canvas.width;
    this.worldSpan = CITY.groundSize * 0.78; // world units across the map
    this.scale = this.size / this.worldSpan;
    this.flash = 0;
  }

  _toMap(x, z) {
    return {
      x: this.size / 2 + x * this.scale,
      y: this.size / 2 + z * this.scale,
    };
  }

  draw(world) {
    const { ctx, size } = this;
    const { player, missions, police, pickups } = world;
    this.flash += 0.12;
    ctx.clearRect(0, 0, size, size);

    // Round clip.
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // Base + water + beach. Golden hour: the sea reads warm, not cold blue.
    ctx.fillStyle = '#16222c';
    ctx.fillRect(0, 0, size, size);
    const water = this._toMap(CITY.waterX, 0);
    ctx.fillStyle = '#274b66';
    ctx.fillRect(water.x, 0, size - water.x, size);
    const beach = this._toMap(CITY.beachX, 0);
    ctx.fillStyle = '#8a7a4a';
    ctx.fillRect(beach.x, 0, water.x - beach.x, size);

    // Blocks.
    ctx.fillStyle = '#2b3a46';
    const bs = CITY.blockSize * this.scale;
    for (const bx of this.city.blocks) {
      for (const bz of this.city.blocks) {
        const p = this._toMap(bx, bz);
        ctx.fillRect(p.x - bs / 2, p.y - bs / 2, bs, bs);
      }
    }
    // Roads.
    ctx.strokeStyle = '#5d6d7a';
    ctx.lineWidth = Math.max(2, CITY.roadWidth * this.scale);
    for (const r of this.city.roads) {
      const a = this._toMap(r, -this.worldSpan / 2);
      const b = this._toMap(r, this.worldSpan / 2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = this._toMap(-this.worldSpan / 2, r);
      const d = this._toMap(this.worldSpan / 2, r);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }

    // Cash pickups.
    ctx.fillStyle = '#2ecc71';
    for (const pos of pickups.positions()) {
      const p = this._toMap(pos.x, pos.z);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // Traffic cars.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const car of world.traffic.allCars()) {
      const p = this._toMap(car.position.x, car.position.z);
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    // Mission target blip (pulsing).
    const target = missions.targetPlace();
    if (target) {
      const p = this._toMap(target.x, target.z);
      const pulse = 4 + Math.sin(this.flash * 2) * 1.5;
      ctx.fillStyle = missions.active ? '#ffd23c' : '#2ecc71';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - pulse);
      ctx.lineTo(p.x + pulse, p.y);
      ctx.lineTo(p.x, p.y + pulse);
      ctx.lineTo(p.x - pulse, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.stroke();
    }
    // Race: next checkpoint blip (orange), the Bowl start and Rosa's garage.
    if (world.races && world.races.active) {
      const gate = world.races.nextGatePlace();
      if (gate) {
        const p = this._toMap(gate.x, gate.z);
        const pulse = 4 + Math.sin(this.flash * 2) * 1.5;
        ctx.fillStyle = '#ff9a3c';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - pulse);
        ctx.lineTo(p.x + pulse, p.y);
        ctx.lineTo(p.x, p.y + pulse);
        ctx.lineTo(p.x - pulse, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = '#c77dff';
    const g = this._toMap(PLACES.chopGarage.x, PLACES.chopGarage.z);
    ctx.fillRect(g.x - 2.5, g.y - 2.5, 5, 5);
    ctx.fillStyle = '#ff9a3c';
    const b = this._toMap(PLACES.bowl.x, PLACES.bowl.z);
    ctx.fillRect(b.x - 2.5, b.y - 2.5, 5, 5);
    // Police: flashing red/blue.
    const policeColor = Math.floor(this.flash * 2) % 2 === 0 ? '#ff4444' : '#4488ff';
    ctx.fillStyle = policeColor;
    for (const car of police.cars()) {
      const p = this._toMap(car.position.x, car.position.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Roadblocks: orange squares. HAWK-1: a gold ring.
    ctx.fillStyle = '#ff9a3c';
    for (const car of police.roadblockCars()) {
      const p = this._toMap(car.position.x, car.position.z);
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }
    const heli = police.heliPosition();
    if (heli) {
      const p = this._toMap(heli.x, heli.z);
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Player arrow.
    const pp = this._toMap(player.position.x, player.position.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(Math.PI - player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    // North marker.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', size / 2, 13);
  }
}
