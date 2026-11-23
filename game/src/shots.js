// Screenshot staging: ?shot=<scene> puts the game into a composed moment
// so the dossier's screenshots show the systems at their best — a golden-hour
// police chase under the helicopter with the crew on the job, Rosa's garage
// shop open on the forecourt, a street race against two rivals at the Bowl,
// a sunset city vista. Normal play ignores these parameters entirely.
import { createCarMesh, ArcadeCar } from './vehicles.js';
import { RACES } from './races.js';

function stageChase(world) {
  world.beginPlay(false);
  // V3 state on show: a full crew, WHEELMAN rank, Downtown loyal.
  world.reputation = 7;
  world.cash = 5000;
  world.crew.recruit('rook', world);
  world.crew.recruit('iris', world);
  world.crew.recruit('vega', world);
  world.districts.addStanding('downtown', 70);
  // Mara in a red sports car, flying north up the beach avenue — the camera
  // looks back at her, so the cruisers on her tail fill the frame, HAWK-1
  // overhead with its spotlight cone on the car.
  const car = new ArcadeCar(createCarMesh('sports', 0xc0392b), {
    x: -25.5, z: 60, heading: Math.PI, maxSpeed: 42, name: 'Comet GT',
  });
  car.speed = 30;
  world.scene.add(car.mesh);
  world.extraCars.push(car);
  world.player.enterCar(car);
  // Three stars and three cruisers on her tail, close enough to fill the
  // frame, plus traffic behind them.
  world.police.setWanted(3);
  const spots = [[-29, 74], [-25.5, 84], [-32.5, 94]];
  for (const [x, z] of spots) {
    const cop = world.police.spawnAt(x, z, Math.PI);
    cop.speed = 30;
  }
  // HAWK-1 placed low and in frame: above the road ahead, so the reverse
  // camera catches the helicopter and its spotlight cone.
  world.police.ensureHeli(world.player.position);
  world.police.heli.mesh.position.set(-25.5, 24, 115);
  world.traffic.spawnAt(-29, 132, 'z', -1);
  world.traffic.spawnAt(-29, 152, 'z', -1);
  // Mission 4, final stage: the safehouse beacon waits ahead.
  world.missions.index = 3;
  world.missions.startMission(world);
  world.missions.stageIdx = 1;
  world.missions._placeBeacon();
  world.missions._runStageStart(world);
  world.hud.hideMissionCard();
  world.hud.flashMessage('Three stars — the whole PD is on you. RUN.', 6);
  world.hud.showDialogue('Mara', 'Three stars and a helicopter. Time to disappear.', 8);
  world.chaseCam.reverse = true;
  world.chaseCam.snapBehind(car.position, car.heading + Math.PI);
}

function stageFoot(world) {
  world.beginPlay(false);
  // On foot at Rosa's garage, the shop open: the Vesper Roadster bought and
  // rolled out on the forecourt behind the panel, Rook on the crew.
  world.reputation = 3;
  world.cash = 3000;
  world.crew.recruit('rook', world);
  world.garage.buy('vesper', world);
  world.garage.select('vesper', world);
  world.player.mesh.position.set(-83, 0, -138);
  world.player.heading = Math.PI * 0.5;
  world.player.mesh.rotation.y = world.player.heading;
  // Pull a few pedestrians into frame on the sidewalk.
  const near = [[-80, -132], [-76, -142], [-90, -130], [-84, -148]];
  world.peds.peds.slice(0, 4).forEach((p, i) => {
    p.mesh.position.set(near[i][0], 0, near[i][1]);
    p.target = { x: near[i][0] + 20, z: near[i][1] + 10 };
  });
  world.chaseCam.snapBehind(world.player.mesh.position, world.player.heading);
  world.hud.flashMessage("Rosa's garage — buy, upgrade, roll out", 6);
  world.hud.showDialogue('Rosa', 'Vesper Roadster, fresh off the forecourt. She is all yours.', 8);
  world.openGarage();
}

function stageRace(world) {
  world.beginPlay(false);
  // Mid-race at the Bowl: Mara leads the Marina Sprint into checkpoint 2,
  // Dizzy and Nadia on her tail, the race HUD counting down.
  world.reputation = 1;
  world.cash = 1000;
  const car = new ArcadeCar(createCarMesh('sports', 0x16a085), {
    x: 60, z: -100, heading: Math.atan2(203 - 60, -87 - (-100)), maxSpeed: 44, name: 'Vesper Roadster',
  });
  car.speed = 30;
  world.scene.add(car.mesh);
  world.extraCars.push(car);
  world.player.enterCar(car);
  world.races.startRace(RACES[0], world);
  world.races.gateIdx = 1; // checkpoint 1 banked
  world.races._placeGateBeacon();
  world.races.timer = 42;
  for (const r of world.races.rivals) {
    r.car.position.set(52, 0, -112);
    r.car.heading = car.heading;
    r.car.mesh.rotation.y = car.heading;
    r.car.speed = 28;
  }
  world.hud.hideMissionCard();
  world.hud.flashMessage('Marina Sprint — checkpoint 2 ahead, hold the lead!', 6);
  world.hud.showDialogue('Rosa', 'The Bowl crowd is watching. Beat Dizzy and Nadia — beat them all.', 8);
  world.chaseCam.snapBehind(car.position, car.heading);
}

function stageVista(world) {
  world.beginPlay(false);
  // Mara on foot on the beach avenue at sunset; the camera orbits the city
  // with HAWK-1 patrolling the skyline in the distance. Kingpin rank, a
  // full crew, and South Beach loyal.
  world.reputation = 9;
  world.cash = 5000;
  world.crew.recruit('rook', world);
  world.crew.recruit('iris', world);
  world.crew.recruit('vega', world);
  world.districts.addStanding('beach', 80);
  world.player.mesh.position.set(210, 0, 16);
  world.player.heading = -Math.PI / 2;
  world.player.mesh.rotation.y = world.player.heading;
  world.vistaMode = true;
  world.police.ensureHeli({ x: 120, z: -40 });
  world.hud.flashMessage('Santa Aurelia — sun, sea, and somewhere to be', 8);
}

export function stageScreenshot(world, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  if (shot === 'chase') stageChase(world);
  else if (shot === 'foot') stageFoot(world);
  else if (shot === 'race') stageRace(world);
  else if (shot === 'vista') stageVista(world);
  else if (shot === 'start') return false; // the menu is the shot
  else return false;
  world.hud.setObjective(world.missions.objectiveText(), null, world.missions.stageText());
  window.__shotReady = true;
  return true;
}
