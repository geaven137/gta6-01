// Missions and story: nine jobs for Mara Voss, chained through Delgado's
// marker, each a short chain of stages with a beacon in the world, a blip on
// the minimap, named dialogue at every stage, and a cash reward at the end.
// Stage kinds: reach, timed reach, enterCar, deliver, wait (hold a spot),
// lose (shake the wanted level back to zero).
import * as THREE from '../vendor/three.module.min.js';
import { PLACES, ECONOMY } from './config.js';
import { createCarMesh, ArcadeCar } from './vehicles.js';

const MISSION_DEFS = [
  {
    title: 'First Fare',
    briefing: "Delgado: 'You owe me, Mara. Drive my client across town and we'll call it square — for today.'",
    stages: [
      { kind: 'reach', target: 'pickupFare', text: 'Pick up the client at the Marina', line: ['Delgado', 'Client waits at the Marina. Don\'t keep him waiting — he pays in cash.'] },
      { kind: 'reach', target: 'dropoffHotel', text: 'Drop the client at Hotel Miramonte', line: ['Client', 'Lovely sunset. Drive smooth and there\'s a tip in it.'] },
    ],
    completeLine: 'Client delivered. Delgado is pleased — for now.',
  },
  {
    title: 'Hot Wheels',
    briefing: "Rosa: 'A gold Comet is parked uptown. Bring it to my garage — and try not to bring the whole PD with you.'",
    stages: [
      { kind: 'enterCar', target: 'hotCar', car: 'comet', text: 'Steal the gold Comet', line: ['Rosa', 'Gold Comet, uptown. The alarm is loud, so be quick about it.'] },
      { kind: 'deliver', target: 'chopGarage', car: 'comet', text: "Deliver the Comet to Rosa's garage", line: ['Rosa', 'Bring her in the back way. Cops watch the front.'] },
    ],
    completeLine: 'The Comet is chopped. Rosa pays cash, no questions.',
  },
  {
    title: 'Harbor Run',
    briefing: "Delgado: 'A package is waiting at the North marina. The docks crew pays on delivery. No detours.'",
    stages: [
      { kind: 'reach', target: 'northMarina', text: 'Collect the package at the North marina', line: ['Delgado', 'North marina, pier end. The package is in a blue crate.'] },
      { kind: 'reach', target: 'docks', text: 'Deliver the package to the South docks', line: ['Dockhand', 'You\'re the courier? About time — the tide waits for no one.'] },
    ],
    completeLine: 'Package delivered. The docks crew remembers reliable couriers.',
  },
  {
    title: 'The Getaway',
    briefing: "Delgado: 'One last job. Grab the package at the South docks, then disappear. The cops know your face now.'",
    stages: [
      { kind: 'reach', target: 'docks', text: 'Grab the package at the South docks', line: ['Delgado', 'The package is hot. SAPD is already sniffing around.'] },
      { kind: 'reach', target: 'safehouse', text: 'Reach the safehouse — and stay free', heatOnStart: 3, line: ['Mara', 'Three stars. Time to disappear.'] },
    ],
    completeLine: 'Clean getaway. Mara Voss is free — for tonight.',
  },
  {
    title: 'Street King',
    briefing: "Rosa: 'The Aurelia Bowl crowd wants a show. Three checkpoints, one clock. Beat it and you're the Street King.'",
    stages: [
      { kind: 'reach', target: 'raceGate1', text: 'Checkpoint 1 — beat the clock', timeLimit: 75, line: ['Rosa', 'Seventy-five seconds to the first gate. Floor it.'] },
      { kind: 'reach', target: 'raceGate2', text: 'Checkpoint 2 — keep it up', timeLimit: 75, line: ['Rosa', 'One down. The crowd is on its feet!'] },
      { kind: 'reach', target: 'raceGate3', text: 'Checkpoint 3 — finish the run', timeLimit: 75, line: ['Rosa', 'Last gate. Make it count!'] },
    ],
    completeLine: 'Street King! The Bowl crowd chants your name.',
  },
  {
    title: 'The Vault Job',
    briefing: "Delgado: 'Aurelia Trust keeps its vault light on Fridays. Get in, crack it, get out. The safehouse is waiting.'",
    stages: [
      { kind: 'reach', target: 'bank', text: 'Reach Aurelia Trust Bank', line: ['Delgado', 'The bank closes at six. You have a window — use it.'] },
      { kind: 'wait', target: 'bank', seconds: 20, text: 'Crack the vault — hold position', line: ['Mara', 'Twenty seconds on the tumblers. Nobody move.'] },
      { kind: 'reach', target: 'safehouse', text: 'Lose the heat — reach the safehouse', heatOnStart: 2, line: ['Delgado', 'The alarm tripped. Run, and don\'t stop.'] },
    ],
    completeLine: 'The vault is empty and the money is yours.',
  },
  {
    title: 'Heat Wave',
    briefing: "Rosa: 'Four stars, Mara. The whole of SAPD is awake tonight. Show them what Aurelia drivers are made of — then vanish.'",
    stages: [
      { kind: 'reach', target: 'bowl', text: 'Draw the chase to the Aurelia Bowl', heatOnStart: 4, line: ['Rosa', 'Four stars! Lead them to the Bowl — the crowd loves a chase.'] },
      { kind: 'lose', text: 'Lose the cops — drop to zero stars', line: ['Mara', 'Now I vanish. Alleys, side streets, anywhere but here.'] },
    ],
    completeLine: 'The heat is gone. SAPD never saw you leave.',
  },
  {
    title: 'Wheels Up',
    briefing: "Delgado: 'A silver Falcon is parked at the North marina — a collector's piece. Bring it to Rosa. Quietly, if you can.'",
    stages: [
      { kind: 'enterCar', target: 'falconCar', car: 'falcon', text: 'Steal the silver Falcon', line: ['Delgado', 'Silver Falcon, marina lot. Worth more than your debt.'] },
      { kind: 'deliver', target: 'chopGarage', car: 'falcon', text: "Deliver the Falcon to Rosa's garage", line: ['Rosa', 'A Falcon! Park it inside — I\'ve got a buyer already.'] },
    ],
    completeLine: 'The Falcon changes hands. Everyone gets paid.',
  },
  {
    title: 'The Last Tide',
    briefing: "Delgado: 'Tonight it ends. The docks, the bank, then home free. Four stars the whole way — make them count.'",
    stages: [
      { kind: 'reach', target: 'docks', text: 'Settle the docks account', heatOnStart: 2, line: ['Delgado', 'The docks first. They owe us, and tonight we collect.'] },
      { kind: 'reach', target: 'bank', text: 'Settle the bank account', line: ['Mara', 'One more stop. Then I\'m done with this city\'s debts.'] },
      { kind: 'reach', target: 'safehouse', text: 'Reach the safehouse — free at last', heatOnStart: 4, line: ['Mara', 'Four stars and the whole city behind me. Home. Now.'] },
    ],
    completeLine: 'Debts settled. Santa Aurelia is yours, Mara Voss.',
  },
];

// Free-roam chatter: when no mission runs, a nearby local says something.
// Shown as a dialogue line, never blocking anything.
export const CHATTER = [
  ['Fisherman', 'The tide brings in the strangest things at dusk.'],
  ['Tourist', 'Is it always this orange here? My camera loves it.'],
  ['Taxi driver', 'I have seen three chases today. Three!'],
  ['Old-timer', 'Back in my day the cops walked the beat. Now they fly it.'],
  ['Street vendor', 'Cold drinks! Cold drinks! Best in Aurelia!'],
  ['Jogger', 'You run from the cops often? Asking for a friend.'],
  ['Dockhand', 'The Falcon? Someone stole a Falcon last week. Shame.'],
  ['Student', 'The sunset here is unreal. The traffic is worse.'],
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
    this.stageTimer = 0; // counts down for timed stages, up for wait stages
    this.beacon = makeBeacon(0xffd23c);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.marker = makeBeacon(0x2ecc71);
    this.marker.visible = false;
    scene.add(this.marker);
    // The gold Comet for mission 2, parked uptown from the start.
    this.missionCar = new ArcadeCar(createCarMesh('sports', 0xd4af37), {
      x: PLACES.hotCar.x, z: PLACES.hotCar.z, heading: Math.PI / 2, name: 'Gold Comet',
    });
    this.missionCar.isMissionCar = true;
    scene.add(this.missionCar.mesh);
    // The silver Falcon for mission 8, parked at the North marina.
    this.falconCar = new ArcadeCar(createCarMesh('sports', 0xd8dee2), {
      x: PLACES.falconCar.x, z: PLACES.falconCar.z, heading: Math.PI / 2, name: 'Silver Falcon',
    });
    this.falconCar.isMissionCar = true;
    scene.add(this.falconCar.mesh);
  }

  missionCars() {
    return [this.missionCar, this.falconCar];
  }

  _stageCar(stage) {
    return stage && stage.car === 'falcon' ? this.falconCar : this.missionCar;
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
    if (stage && stage.target) return PLACES[stage.target];
    if (stage && stage.kind === 'lose') return null;
    if (this.remaining() > 0) return PLACES.delgadoOffice;
    return null;
  }

  // "MISSION 4/9 — The Getaway · STAGE 2/2" for the HUD's stage line.
  stageText() {
    if (!this.active || !this.def) {
      if (this.remaining() > 0) return `MISSION ${this.index + 1}/${MISSION_DEFS.length} — ${MISSION_DEFS[this.index].title}`;
      return 'STORY COMPLETE';
    }
    return `MISSION ${this.index + 1}/${MISSION_DEFS.length} — ${this.def.title} · STAGE ${this.stageIdx + 1}/${this.def.stages.length}`;
  }

  objectiveText() {
    const stage = this.currentStage();
    if (stage) {
      if (stage.kind === 'deliver' && this._playerNotInMissionCar) {
        const name = stage.car === 'falcon' ? 'Falcon' : 'Comet';
        return stage.text + ` (get back in the ${name})`;
      }
      if (stage.kind === 'timed' || stage.timeLimit) {
        return `${stage.text} — ${Math.max(0, Math.ceil(this.stageTimer))}s left`;
      }
      if (stage.kind === 'wait') {
        return `${stage.text} — ${Math.max(0, Math.ceil(stage.seconds - this.stageTimer))}s`;
      }
      return stage.text;
    }
    if (this.remaining() > 0) return `Go to Delgado's office to start: ${MISSION_DEFS[this.index].title}`;
    return 'Story complete — Santa Aurelia is yours. Free roam!';
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
    this.stageTimer = stage.timeLimit || 0;
    if (stage.heatOnStart) {
      world.police.setWanted(stage.heatOnStart);
      world.hud.flashMessage(`${stage.heatOnStart} stars — the whole PD is on you. RUN.`);
    }
    if (stage.line) {
      world.hud.showDialogue(stage.line[0], stage.line[1], 5.5);
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
    // Timed stages: the clock runs out and the job fails.
    if (stage.timeLimit) {
      this.stageTimer -= dt;
      if (this.stageTimer <= 0) {
        this.fail(world, 'out of time');
        return;
      }
    }
    if (stage.kind === 'lose') {
      if (world.police.stars === 0) this._advanceStage(world);
      return;
    }
    const place = PLACES[stage.target];
    const d = Math.hypot(player.position.x - place.x, player.position.z - place.z);
    if (stage.kind === 'reach') {
      if (d < 8) this._advanceStage(world);
    } else if (stage.kind === 'wait') {
      if (d < 9) {
        this.stageTimer += dt;
        if (this.stageTimer >= stage.seconds) this._advanceStage(world);
      } else {
        this.stageTimer = Math.max(0, this.stageTimer - dt * 2); // leaving resets progress
      }
    } else if (stage.kind === 'enterCar') {
      const car = this._stageCar(stage);
      if (player.state === 'driving' && player.car === car) {
        world.police.addHeat(26, 'stolen car');
        world.hud.flashMessage("The alarm is screaming — the cops are coming!");
        this._advanceStage(world);
      }
    } else if (stage.kind === 'deliver') {
      const car = this._stageCar(stage);
      this._playerNotInMissionCar = player.car !== car;
      if (!this._playerNotInMissionCar && d < 9) this._advanceStage(world);
    }
  }
}
