// Golden Tide — tuning constants and shared world layout.
// One source of truth for sizes, speeds and scoring so every system agrees.

export const CITY_NAME = 'Santa Aurelia';
export const GAME_TITLE = 'Golden Tide';

export const CITY = {
  blocksPerSide: 7,
  blockSize: 44,
  roadWidth: 14,
  pitch: 58, // blockSize + roadWidth
  // Roads sit at (i - 3.5) * pitch for i in 0..7  =>  -203 .. 203 step 58.
  // Block centres sit at (i - 3) * pitch for i in 0..6  =>  -174 .. 174.
  groundSize: 640,
  beachX: 216, // sand strip starts here (east edge)
  waterX: 268, // sea plane starts here
};

export const PLAYER_TUNING = {
  walkSpeed: 6,
  runSpeed: 10.5,
  turnRate: 12,
  maxHealth: 100,
  enterCarRange: 4.2,
  punchRange: 2.4,
  punchDamage: 34,
};

export const CAR_TUNING = {
  accel: 26,
  brake: 42,
  maxSpeed: 42, // ~150 km/h arcade
  maxReverse: 12,
  grip: 8.5,
  drag: 0.55,
  steerRate: 2.4,
  trafficSpeed: 11,
  policeSpeed: 40,
  heliSpeed: 26,
  heliHeight: 38,
};

export const WANTED_TUNING = {
  heatPerStar: [0, 10, 30, 55, 80, 96],
  hitPedestrian: 26,
  killPedestrian: 12,
  hitCar: 8,
  stealCar: 14,
  shoot: 16,
  decayHiddenPerSecond: 9,
  hiddenDelaySeconds: 6,
  bustedRange: 7,
  bustedStillSeconds: 2.6,
  heliStars: 3, // HAWK-1 joins the chase at this many stars
  roadblockStars: 4, // SAPD throws roadblocks at this many stars
  roadblockInterval: 20,
  roadblockLifetime: 45,
};

export const ECONOMY = {
  startCash: 120,
  pickupValue: 50,
  fineBusted: 100,
  fineWasted: 100,
  missionReward: [250, 400, 350, 800, 600, 1200, 700, 500, 1500],
};

// Golden hour: the whole game is shot at sunset — warm orange sky, a low
// amber sun, long shadows, windows already lit. 17:41, every run.
export const GOLDEN_HOUR = {
  clockStartMinutes: 17 * 60 + 41,
  sunOffset: { x: -165, y: 48, z: 62 }, // low in the west
  sunColor: 0xffb066,
  sunIntensity: 2.7,
  hemiSky: 0xffd9a0,
  hemiGround: 0x7a5a4a,
  hemiIntensity: 1.15,
  ambientColor: 0xffe0b3,
  ambientIntensity: 0.35,
  exposure: 1.22,
};

export const PALETTE = {
  sky: 0xf7a85c,
  fog: 0xf2b27a,
  sun: 0xffd27a,
  ground: 0x8a9a72,
  sand: 0xe9c98a,
  sea: 0x3d6a8a,
  asphalt: 0x3a3f45,
  sidewalk: 0xb9b2a0,
  building: [0xf2e3c6, 0xe8b48c, 0xd9e4e8, 0xf0d9a0, 0xcfe0d4, 0xe6c9c9, 0xd8d2c4, 0xf5ead0],
  car: [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400],
  pedShirt: [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8, 0x00cec9],
  pedSkin: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac],
};

// Weapon slots: 1-4 to switch, Q to cycle, R to reload. Ammo is per weapon;
// ammo crates around the city top every reserve up.
export const WEAPONS = [
  { id: 'pistol', name: 'P9 Pistol', slot: 1, damage: 30, cooldown: 0.22, mag: 12, reserve: 120, range: 90, pellets: 1, spread: 0, auto: false, reload: 1.0 },
  { id: 'smg', name: 'VK SMG', slot: 2, damage: 14, cooldown: 0.09, mag: 30, reserve: 240, range: 70, pellets: 1, spread: 0.02, auto: true, reload: 1.3 },
  { id: 'shotgun', name: 'M870 Shotgun', slot: 3, damage: 12, cooldown: 0.85, mag: 6, reserve: 48, range: 45, pellets: 6, spread: 0.06, auto: false, reload: 1.6 },
  { id: 'rifle', name: 'AR-7 Rifle', slot: 4, damage: 55, cooldown: 0.34, mag: 24, reserve: 96, range: 120, pellets: 1, spread: 0.005, auto: false, reload: 1.4 },
];

// Radio: three synthesized stations. F cycles them. Each station is a
// 16-step pattern: a bass line and an arpeggio over its own scale.
export const RADIO = [
  { name: 'Sol FM 94.7', track: "'Amber Sky' — Los Dorados", tempo: 112, root: 220.0, scale: [0, 3, 5, 7, 10, 12, 15], bass: [0, 0, 7, 5] },
  { name: 'Onda 101', track: "'Tide Line' — Marisol", tempo: 96, root: 196.0, scale: [0, 2, 4, 7, 9, 12, 14], bass: [0, 5, 3, 7] },
  { name: 'Night Drive 88.5', track: "'Neon Coast' — Vega", tempo: 128, root: 174.61, scale: [0, 3, 5, 7, 10, 12, 15], bass: [0, 0, 10, 7] },
];

// Respect ranks: reputation is earned one point per finished mission.
export const RANKS = [
  { min: 0, name: 'STREET NOBODY' },
  { min: 1, name: 'RUNNER' },
  { min: 3, name: 'FIXER' },
  { min: 5, name: 'WHEELMAN' },
  { min: 7, name: 'SHOT CALLER' },
  { min: 9, name: 'KINGPIN OF AURELIA' },
];

export function rankFor(rep) {
  let rank = RANKS[0];
  for (const r of RANKS) if (rep >= r.min) rank = r;
  return rank;
}

// Named places the story and the HUD refer to. All coordinates sit on or
// beside roads so a car can reach them.
export const PLACES = {
  playerStart: { x: -29, z: -29, heading: Math.PI / 2 },
  delgadoOffice: { x: -29, z: 29, label: "Delgado's office" },
  pickupFare: { x: 87, z: -87, label: 'Marina pickup' },
  dropoffHotel: { x: -145, z: 145, label: 'Hotel Miramonte' },
  hotCar: { x: 145, z: 29, label: 'Gold Comet' },
  chopGarage: { x: -87, z: -145, label: "Rosa's garage" },
  docks: { x: 203, z: 145, label: 'South docks' },
  safehouse: { x: -145, z: -87, label: 'Safehouse' },
  hospital: { x: 29, z: -145, label: 'Aurelia General' },
  policeStation: { x: 29, z: 145, label: 'SAPD Central' },
  bank: { x: -87, z: 87, label: 'Aurelia Trust Bank' },
  raceGate1: { x: 87, z: 145, label: 'Checkpoint 1' },
  raceGate2: { x: -145, z: -29, label: 'Checkpoint 2' },
  raceGate3: { x: 29, z: -87, label: 'Checkpoint 3' },
  northMarina: { x: 203, z: -87, label: 'North marina' },
  bowl: { x: 145, z: -145, label: 'Aurelia Bowl' },
  falconCar: { x: 203, z: -29, label: 'Silver Falcon' },
};

export const SAVE_KEY = 'golden-tide-save-v1';
