// Screenshot staging: ?shot=<scene> puts the game into a composed moment
// so the dossier's screenshots show the systems at their best — a police
// chase, on-foot street life, a mission delivery, a city vista. Normal play
// ignores these parameters entirely.
import { createCarMesh, ArcadeCar } from './vehicles.js';

function stageChase(world) {
  world.beginPlay(false);
  // Mara in a red sports car, flying north up the beach avenue — the camera
  // looks back at her, so the cruisers on her tail fill the frame.
  const car = new ArcadeCar(createCarMesh('sports', 0xc0392b), {
    x: -25.5, z: 60, heading: Math.PI, maxSpeed: 42,
  });
  car.speed = 30;
  world.scene.add(car.mesh);
  world.extraCars.push(car);
  world.player.enterCar(car);
  // Three stars and three cruisers on her tail, plus traffic behind them.
  world.police.setWanted(3);
  const spots = [[-29, 84], [-25.5, 96], [-32.5, 108]];
  for (const [x, z] of spots) {
    const cop = world.police.spawnAt(x, z, Math.PI);
    cop.speed = 30;
  }
  world.traffic.spawnAt(-29, 132, 'z', -1);
  world.traffic.spawnAt(-29, 152, 'z', -1);
  // Mission 3, final stage: the safehouse beacon waits ahead.
  world.missions.index = 2;
  world.missions.startMission(world);
  world.missions.stageIdx = 1;
  world.missions._placeBeacon();
  world.missions._runStageStart(world);
  world.hud.hideMissionCard();
  world.hud.flashMessage('Three stars — the whole PD is on you. RUN.', 6);
  world.chaseCam.reverse = true;
  world.chaseCam.snapBehind(car.position, car.heading + Math.PI);
}

function stageFoot(world) {
  world.beginPlay(false);
  world.player.mesh.position.set(-24, 0, -33);
  world.player.heading = Math.PI * 0.75;
  world.player.mesh.rotation.y = world.player.heading;
  // Pull a few pedestrians into frame on the sidewalk.
  const near = [[-20, -28], [-16, -38], [-28, -22], [-12, -30]];
  world.peds.peds.slice(0, 4).forEach((p, i) => {
    p.mesh.position.set(near[i][0], 0, near[i][1]);
    p.target = { x: near[i][0] + 20, z: near[i][1] + 10 };
  });
  world.chaseCam.snapBehind(world.player.mesh.position, world.player.heading);
  world.hud.flashMessage('Solmar Bay — on foot, anything can happen', 6);
}

function stageMission(world) {
  world.beginPlay(false);
  // Mission 2, final stage: Mara delivers the gold Comet up the avenue,
  // two stars up, a roadblock waiting ahead and cruisers behind.
  world.missions.index = 1;
  world.missions.startMission(world);
  world.missions.stageIdx = 1;
  world.missions._placeBeacon();
  world.hud.hideMissionCard();
  const comet = world.missions.missionCar;
  comet.position.set(-25.5, 0, -29);
  comet.heading = Math.PI;
  comet.mesh.rotation.y = Math.PI;
  comet.speed = 22;
  world.player.enterCar(comet);
  world.police.setWanted(2);
  const cop1 = world.police.spawnAt(-29, -5, Math.PI);
  const cop2 = world.police.spawnAt(-25.5, 8, Math.PI);
  cop1.speed = 24;
  cop2.speed = 24;
  // Roadblock ahead: a parked cruiser across the road.
  const block = new ArcadeCar(createCarMesh('police', 0xf2f2f2), { x: -29, z: -160, heading: Math.PI / 2 });
  world.scene.add(block.mesh);
  world.extraCars.push(block);
  world.traffic.spawnAt(-29, 42, 'z', -1);
  world.hud.flashMessage("Deliver the Comet to Rosa's garage", 6);
  world.chaseCam.snapBehind(comet.position, comet.heading);
}

function stageVista(world) {
  world.beginPlay(false);
  // Mara on foot on the beach avenue; the camera orbits the whole city.
  world.player.mesh.position.set(210, 0, 16);
  world.player.heading = -Math.PI / 2;
  world.player.mesh.rotation.y = world.player.heading;
  world.vistaMode = true;
  world.hud.flashMessage('Solmar Bay — sun, sea, and somewhere to be', 8);
}

export function stageScreenshot(world, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  if (shot === 'chase') stageChase(world);
  else if (shot === 'foot') stageFoot(world);
  else if (shot === 'mission') stageMission(world);
  else if (shot === 'vista') stageVista(world);
  else if (shot === 'start') return false; // the menu is the shot
  else return false;
  world.hud.setObjective(world.missions.objectiveText(), null);
  window.__shotReady = true;
  return true;
}
