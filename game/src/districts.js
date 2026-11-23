// Districts: Santa Aurelia is six named districts, each with a standing
// meter (0-100). Finishing jobs in a district raises its standing; high
// standing cuts garage prices there and makes SAPD slower to escalate heat,
// because the neighbourhood looks the other way.
export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown Aurelia' },
  { id: 'beach', name: 'South Beach' },
  { id: 'docks', name: 'South Docks' },
  { id: 'northside', name: 'Northside' },
  { id: 'westend', name: 'West End' },
  { id: 'marina', name: 'North Marina' },
];

export function districtAt(x, z) {
  if (z >= 145 && x < 205) return 'docks';
  if (x > 205) return 'beach';
  if (z <= -145) return 'northside';
  if (x <= -145) return 'westend';
  if (x > 116 && z < -58) return 'marina';
  return 'downtown';
}

export function districtName(id) {
  const d = DISTRICTS.find((x) => x.id === id);
  return d ? d.name : 'Santa Aurelia';
}

export function tierFor(standing) {
  if (standing >= 60) return 'LOYAL';
  if (standing >= 25) return 'FRIENDLY';
  return 'NEUTRAL';
}

export class DistrictManager {
  constructor() {
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.id] = 0;
  }

  current(x, z) {
    const id = districtAt(x, z);
    return { id, name: districtName(id), standing: this.standing[id], tier: tierFor(this.standing[id]) };
  }

  // Jobs finished here raise standing; returns the tier change, if any.
  addStanding(id, amount) {
    const before = tierFor(this.standing[id]);
    this.standing[id] = Math.max(0, Math.min(100, this.standing[id] + amount));
    const after = tierFor(this.standing[id]);
    return before === after ? null : after;
  }

  // Heat multiplier at a spot: 1.0 in a neutral district, 0.7 where the
  // neighbourhood is loyal.
  heatFactorAt(x, z) {
    return 1 - (this.standing[districtAt(x, z)] / 100) * 0.3;
  }

  // Price multiplier at a spot: 1.0 neutral, 0.8 where loyal.
  priceFactorAt(x, z) {
    return 1 - (this.standing[districtAt(x, z)] / 100) * 0.2;
  }

  serialize() {
    return { ...this.standing };
  }

  load(data) {
    if (!data) return;
    for (const d of DISTRICTS) {
      if (typeof data[d.id] === 'number') {
        this.standing[d.id] = Math.max(0, Math.min(100, data[d.id]));
      }
    }
  }
}
