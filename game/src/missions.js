// Missions and story: three jobs for Mara Voss, chained through Delgado's
// marker, each a short chain of stages with a beacon in the world, a blip on
// the minimap and a cash reward at the end.
import * as THREE from '../vendor/three.module.min.js';
import { PLACES, ECONOMY } from './config.js';
import { createCarMesh, ArcadeCar } from './vehicles.js';

const MISSION_DEFS = [
  {
    title: 'First Fare',
    briefing: "Delgado: 'You owe me, Mara. Drive my client across town and we'll call it square — for today.'",
    stages: [
      { kind: 'reach', target: 'pickupFare', text: 'Pick up the client at the Marina' },
      { kind: 'reach', target: 'dropoffHotel', text: 'Drop the client at Hotel Miramonte' },
    ],
    completeLine: 'Client delivered. Delgado is pleased — for now.',
  },
  {
    title: 'Hot Wheels',
    briefing: "Rosa: 'A gold Comet is parked uptown. Bring it to my garage — and try not to bring the whole PD with you.'",
    stages: [
      { kind: 'enterCar', target: 'hotCar', text: 'Steal the gold Comet' },
      { kind: 'deliver', target: 'chopGarage', text: "Deliver the Comet to Rosa's garage" },
    ],
    completeLine: 'The Comet is chopped. Rosa pays cash, no questions.',
  },
  {
    title: 'The Getaway',
    briefing: "Delgado: 'One last job. Grab the package at the South docks, then disappear. The cops know your face now.'",
    stages: [
      { kind: 'reach', target: 'docks', text: 'Grab the package at the South docks' },
      { kind: 'reach', target: 'safehouse', text: 'Reach the safehouse — and stay free', heatOnStart: 3 },
    ],
    completeLine: 'Clean getaway. Mara Voss is free — and Solmar Bay is hers.',
  },
];

function makeBeacon(color) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.9, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 13;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.3, 3.1, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 4.2;
  group.add(diamond);
  group.userData = { beam, ring, diamond };
  return group;
}

export class MissionManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.index = 0; // next mission to play
    this.active = false;
    this.stageIdx = 0;
    this.def = null;
    this.beacon = makeBeacon(0xffd23c);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.marker = makeBeacon(0x2ecc71);
    this.marker.visible = false;
    scene.add(this.marker);
    // The gold Comet for mission 2, parked uptown from the start.
    this.missionCar = new ArcadeCar(createCarMesh('sports', 0xd4af37), {
      x: PLACES.hotCar.x, z: PLACES.hotCar.z, heading: Math.PI / 2,
    });
    this.missionCar.isMissionCar = true;
    scene.add(this.missionCar.mesh);
  }

  missionCars() {
    return [this.missionCar];
  }

  remaining() {
    return MISSION_DEFS.length - this.index;
  }

  currentStage() {
    if (!this.active || !this.def) return null;
    return this.def.stages[this.stageIdx];
  }

  targetPlace() {
    const stage = this.currentStage();
    if (stage) return PLACES[stage.target];
    if (this.remaining() > 0) return PLACES.delgadoOffice;
    return null;
  }

  objectiveText() {
    const stage = this.currentStage();
    if (stage) {
      if (stage.kind === 'deliver' && this._playerNotInMissionCar) return stage.text + ' (get back in the Comet)';
      return stage.text;
    }
    if (this.remaining() > 0) return `Go to Delgado's office to start: ${MISSION_DEFS[this.index].title}`;
    return 'Story complete — Solmar Bay is yours. Free roam!';
  }

  startMission(world) {
    if (this.active || this.remaining() <= 0) return false;
    this.def = MISSION_DEFS[this.index];
    this.active = true;
    this.stageIdx = 0;
    this.marker.visible = false;
    this.beacon.visible = true;
    this._placeBeacon();
    this._runStageStart(world);
    world.hud.showMissionCard(this.def.title, this.def.briefing);
    world.audio.missionStart();
    return true;
  }

  _placeBeacon() {
    const place = this.targetPlace();
    if (!place) { this.beacon.visible = false; return; }
    this.beacon.position.set(place.x, 0, place.z);
    this.beacon.visible = true;
  }

  _runStageStart(world) {
    const stage = this.currentStage();
    if (!stage) return;
    if (stage.heatOnStart) {
      world.police.setWanted(stage.heatOnStart);
      world.hud.flashMessage('Three stars — the whole PD is on you. RUN.');
    }
  }

  fail(world, reason) {
    if (!this.active) return;
    this.active = false;
    this.stageIdx = 0;
    this.def = null;
    this.beacon.visible = false;
    world.hud.flashMessage(`Mission failed: ${reason}. Go back to Delgado to retry.`);
  }

  _completeMission(world) {
    const reward = ECONOMY.missionReward[this.index];
    const title = this.def.title;
    const line = this.def.completeLine;
    this.index += 1;
    this.active = false;
    this.stageIdx = 0;
    this.def = null;
    this.beacon.visible = false;
    world.cash += reward;
    world.reputation += 1;
    world.police.clearWanted();
    world.saveGame();
    world.hud.showMissionComplete(title, line, reward, this.remaining() > 0 ? MISSION_DEFS[this.index].title : null);
    world.audio.missionComplete();
    if (world.onMissionComplete) world.onMissionComplete(title);
  }

  _advanceStage(world) {
    this.stageIdx += 1;
    if (this.stageIdx >= this.def.stages.length) {
      this._completeMission(world);
      return;
    }
    this._placeBeacon();
    this._runStageStart(world);
    world.audio.stageComplete();
    world.hud.flashMessage(this.currentStage().text);
  }

  update(dt, world) {
    const { player } = world;
    // Animate beacons.
    for (const b of [this.beacon, this.marker]) {
      if (!b.visible) continue;
      const t = world.time;
      b.userData.beam.material.opacity = 0.18 + Math.sin(t * 2.4) * 0.07;
      b.userData.diamond.rotation.y += dt * 2;
      b.userData.diamond.position.y = 4.2 + Math.sin(t * 2) * 0.4;
    }
    if (!this.active) {
      // The green marker waits at Delgado's office.
      if (this.remaining() > 0) {
        this.marker.visible = true;
        this.marker.position.set(PLACES.delgadoOffice.x, 0, PLACES.delgadoOffice.z);
        const d = Math.hypot(player.position.x - PLACES.delgadoOffice.x, player.position.z - PLACES.delgadoOffice.z);
        if (d < 7) {
          world.hud.setPrompt(`[E] Start mission: ${MISSION_DEFS[this.index].title}`);
          if (world.input.pressed('KeyE')) this.startMission(world);
        }
      } else {
        this.marker.visible = false;
      }
      return;
    }
    const stage = this.currentStage();
    const place = PLACES[stage.target];
    const d = Math.hypot(player.position.x - place.x, player.position.z - place.z);
    if (stage.kind === 'reach') {
      if (d < 8) this._advanceStage(world);
    } else if (stage.kind === 'enterCar') {
      if (player.state === 'driving' && player.car === this.missionCar) {
        world.police.addHeat(26, 'stolen Comet');
        world.hud.flashMessage("The Comet's alarm is screaming — the cops are coming!");
        this._advanceStage(world);
      }
    } else if (stage.kind === 'deliver') {
      this._playerNotInMissionCar = player.car !== this.missionCar;
      if (!this._playerNotInMissionCar && d < 9) this._advanceStage(world);
    }
  }
}
