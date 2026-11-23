// Solmar Heat — tuning constants and shared world layout.
// One source of truth for sizes, speeds and scoring so every system agrees.

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
};

export const ECONOMY = {
  startCash: 120,
  pickupValue: 50,
  fineBusted: 100,
  fineWasted: 100,
  missionReward: [250, 400, 800],
};

export const PALETTE = {
  sky: 0x8ec9ee,
  fog: 0xcfe6f2,
  sun: 0xfff1cf,
  ground: 0x8a9a72,
  sand: 0xe9d9a4,
  sea: 0x2f7fa6,
  asphalt: 0x3a3f45,
  sidewalk: 0xb9b2a0,
  building: [0xf2e3c6, 0xe8b48c, 0xd9e4e8, 0xf0d9a0, 0xcfe0d4, 0xe6c9c9, 0xd8d2c4, 0xf5ead0],
  car: [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400],
  pedShirt: [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8, 0x00cec9],
  pedSkin: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac],
};

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
  hospital: { x: 29, z: -145, label: 'Solmar General' },
  policeStation: { x: 29, z: 145, label: 'Solmar PD' },
};

export const SAVE_KEY = 'solmar-heat-save-v1';
