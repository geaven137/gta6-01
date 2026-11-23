// Golden Tide — entry point. Builds the renderer, the city and every system,
// then runs the game loop: input, player, traffic, pedestrians, police,
// missions, collisions, camera, HUD and sound. The whole game is shot at
// golden hour: a low amber sun in the west, 17:41 on the clock.
import * as THREE from '../vendor/three.module.min.js';
import { PLACES, PLAYER_TUNING, ECONOMY, WANTED_TUNING, PALETTE, GOLDEN_HOUR } from './config.js';
import { rankIndex } from './respect.js';
import { DistrictManager } from './districts.js';
import { RespectManager } from './respect.js';
import { CrewManager, CREW_DEFS } from './crew.js';
import { GarageManager } from './garage.js';
import { RaceManager } from './races.js';
import { createRng } from './random.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { PlayerController } from './player.js';
import { TrafficManager, findNearestCar } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { WantedSystem } from './police.js';
import { MissionManager, CHATTER } from './missions.js';
import { CashPickupField, AmmoPickupField } from './pickups.js';
import { CombatSystem } from './combat.js';
import { ParticleEffects } from './effects.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { ChaseCamera } from './camera.js';
import { SoundBank } from './audio.js';
import { loadSave, storeSave, defaultSave } from './save.js';
import { stageScreenshot } from './shots.js';

export class GoldenTideGame {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.params = params;
    this.seed = Number(params.get('seed')) || 7;
    this.rng = createRng(this.seed);
    this.time = 0;
    this.state = 'menu'; // menu | playing | paused | busted | wasted | missionComplete
    this.cash = ECONOMY.startCash;
    this.reputation = 0;
    this.extraCars = [];
    this.vistaMode = false;
    this.endKind = 'busted';
    this.smokeTimer = 0;
    this.chatterTimer = 30;
    this.skidTimer = 0;
    this.save = loadSave();

    // Renderer: golden-hour look — warm low sun, long soft shadows, ACES.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = GOLDEN_HOUR.exposure;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 200, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 40, 120);

    this.sun = new THREE.DirectionalLight(GOLDEN_HOUR.sunColor, GOLDEN_HOUR.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -130;
    this.sun.shadow.camera.right = 130;
    this.sun.shadow.camera.top = 130;
    this.sun.shadow.camera.bottom = -130;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 520;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(GOLDEN_HOUR.hemiSky, GOLDEN_HOUR.hemiGround, GOLDEN_HOUR.hemiIntensity));
    this.scene.add(new THREE.AmbientLight(GOLDEN_HOUR.ambientColor, GOLDEN_HOUR.ambientIntensity));

    // World and systems.
    this.city = buildCity(this.scene, this.rng);
    this.input = new Input(window);
    this.effects = new ParticleEffects(this.scene);
    this.audio = new SoundBank();
    this.player = new PlayerController(this.scene, PLACES.playerStart);
    this.traffic = new TrafficManager(this.scene, this.city, this.rng, 16);
    this.peds = new PedestrianManager(this.scene, this.city, this.rng, 22);
    this.police = new WantedSystem(this.scene, this.city, this.rng);
    this.missions = new MissionManager(this.scene, this.city);
    this.pickups = new CashPickupField(this.scene, this.city, this.rng, 12);
    this.ammoPickups = new AmmoPickupField(this.scene, this.city, this.rng, 4);
    this.combat = new CombatSystem(this.scene, this.camera, this.effects);
    // V3 systems: districts, respect, crew, garage, races.
    this.districts = new DistrictManager();
    this.respect = new RespectManager();
    this.crew = new CrewManager();
    this.garage = new GarageManager(this.scene);
    this.races = new RaceManager(this.scene);
    this._lastRep = 0;
    if (this.save) {
      this.crew.load(this.save.crew);
      this.districts.load(this.save.districts);
      this.garage.load(this.save.garage);
      this.races.load(this.save.races);
    }
    this.combat.canUse = (i) => this.respect.canUseWeapon(i, this.reputation);
    this.chaseCam = new ChaseCamera(this.camera);
    this.minimap = new Minimap(document.getElementById('minimap'), this.city);
    this.hud = new Hud({
      onStart: (useSave) => this.beginPlay(useSave),
      onResume: () => { this.state = 'playing'; this.hud.hidePause(); },
      onRestartMission: () => this.restartMission(),
      onSave: () => this.saveGame(),
      onQuit: () => { this.saveGame(); this.state = 'menu'; this.hud.hidePause(); this.hud.showMenu(!!loadSave()); },
      onRespawn: () => this.respawnAfterEnd(),
      onMissionContinue: () => { this.hud.hideMissionComplete(); this.state = 'playing'; },
      onGarageClose: () => this.closeShop(),
      onCrewClose: () => this.closeShop(),
    });

    this.hud.showMenu(!!this.save);
    this.hud.setCash(this.cash);
    this.hud.setRep(this.reputation);

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('error', (e) => this.showError(e.message || 'error'));
    window.addEventListener('unhandledrejection', (e) => this.showError(String(e.reason)));

    // Screenshot staging (?shot=chase|foot|mission|vista) or the menu.
    if (!stageScreenshot(this, params)) {
      window.__shotReady = true;
    }
    window.__goldenTide = this;
  }

  allCars() {
    return [...this.traffic.allCars(), ...this.police.cars(), ...this.police.roadblockCars(), ...this.missions.missionCars(), ...this.races.rivalCars(), ...this.extraCars];
  }

  saveGame() {
    storeSave({
      cash: this.cash, reputation: this.reputation, missionIndex: this.missions.index, weapon: this.combat.weaponIndex,
      crew: this.crew.serialize(), districts: this.districts.serialize(),
      garage: this.garage.serialize(), races: this.races.serialize(),
    });
  }

  beginPlay(useSave) {
    if (useSave && this.save) {
      this.cash = this.save.cash;
      this.reputation = this.save.reputation;
      this.missions.index = this.save.missionIndex;
      if (typeof this.save.weapon === 'number') this.combat.selectWeapon(this.save.weapon);
      this.crew.load(this.save.crew);
      this.districts.load(this.save.districts);
      this.garage.load(this.save.garage);
      this.races.load(this.save.races);
    } else {
      const fresh = defaultSave();
      this.cash = fresh.cash;
      this.reputation = fresh.reputation;
      this.missions.index = 0;
      this.crew.recruited.clear();
      this.districts = new DistrictManager();
      this.races.won.clear();
      this.races.bestTimes = {};
      if (this.garage.activeCar) {
        if (this.player.car === this.garage.activeCar) this.player.exitCar();
        this.scene.remove(this.garage.activeCar.mesh);
        const i = this.extraCars.indexOf(this.garage.activeCar);
        if (i >= 0) this.extraCars.splice(i, 1);
      }
      this.garage = new GarageManager(this.scene);
    }
    this._lastRep = this.reputation;
    this.audio.unlock();
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.setCash(this.cash);
    this.hud.setRep(this.reputation);
    this.chaseCam.snapBehind(this.player.position, this.player.heading);
  }

  restartMission() {
    if (this.missions.active) {
      this.missions.fail(this, 'restarted');
      this.police.clearWanted();
      this.hud.flashMessage('Mission restarted — head back to Delgado.');
    } else {
      this.hud.flashMessage('No mission in progress.');
    }
    this.hud.hidePause();
    this.state = 'playing';
  }

  onBusted() {
    if (this.state !== 'playing') return;
    this.endKind = 'busted';
    this.state = 'busted';
    this.missions.fail(this, 'busted');
    this.cash = Math.max(0, this.cash - ECONOMY.fineBusted);
    this.police.clearWanted();
    this.hud.showEnd('busted', ECONOMY.fineBusted);
    this.saveGame();
  }

  onWasted() {
    if (this.state !== 'playing') return;
    this.endKind = 'wasted';
    this.state = 'wasted';
    this.missions.fail(this, 'wasted');
    this.cash = Math.max(0, this.cash - ECONOMY.fineWasted);
    this.police.clearWanted();
    this.hud.showEnd('wasted', ECONOMY.fineWasted);
    this.saveGame();
  }

  respawnAfterEnd() {
    const spot = this.endKind === 'busted' ? PLACES.policeStation : PLACES.hospital;
    this.player.respawn(spot);
    this.hud.hideEnd();
    this.state = 'playing';
    this.chaseCam.snapBehind(this.player.position, this.player.heading);
  }

  onMissionComplete() {
    this.state = 'missionComplete';
  }

  cameraShake(amount) {
    this.chaseCam.shake(amount);
  }

  showError(message) {
    const el = document.getElementById('error');
    if (el) {
      el.textContent = 'Error: ' + message;
      el.style.display = 'block';
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  locationName() {
    const p = this.player.position;
    return this.districts.current(p.x, p.z).name;
  }

  // --- Shop panels (garage + crew): the game pauses while one is open. ---
  openGarage() {
    if (this.state !== 'playing') return;
    this.state = 'shop';
    this._renderGarage();
  }

  _renderGarage() {
    const rankIdx = rankIndex(this.reputation);
    this.hud.showGarage({
      cash: this.cash,
      cars: this.garage.panelData(this).map((c) => ({
        ...c,
        rankOk: rankIdx >= c.minRank,
        lockReason: rankIdx >= c.minRank ? '' : this.respect.lockReasonForRank(c.minRank),
      })),
      upgradePrices: {
        engine: this.garage.upgradePrice('engine', this),
        armor: this.garage.upgradePrice('armor', this),
        paint: this.garage.paintPrice(this),
      },
    }, (action, id) => this._garageAction(action, id));
  }

  _garageAction(action, id) {
    if (action === 'buy') this.garage.buy(id, this);
    else if (action === 'select') this.garage.select(id, this);
    else if (action === 'engine') this.garage.upgrade(id, 'engine', this);
    else if (action === 'armor') this.garage.upgrade(id, 'armor', this);
    else if (action === 'paint') this.garage.paint(id, this.garage.nextPaintColor(id), this);
    this._renderGarage();
  }

  openCrew() {
    if (this.state !== 'playing') return;
    this.state = 'shop';
    this._renderCrew();
  }

  _renderCrew() {
    const rankIdx = rankIndex(this.reputation);
    this.hud.showCrew({
      cash: this.cash,
      members: CREW_DEFS.map((d) => ({
        ...d,
        recruited: this.crew.has(d.id),
        rankOk: rankIdx >= d.minRank,
        lockReason: rankIdx >= d.minRank ? '' : this.respect.lockReasonForRank(d.minRank),
      })),
    }, (action, id) => {
      if (action === 'recruit') this.crew.recruit(id, this);
      this._renderCrew();
    });
  }

  closeShop() {
    this.hud.hideGarage();
    this.hud.hideCrew();
    if (this.state === 'shop') this.state = 'playing';
  }

  handleCarEntry() {
    const { player, missions } = this;
    if (player.state === 'driving') {
      player.exitCar();
      return;
    }
    // Delgado's marker owns E when the player stands on it.
    const nearMarker = !missions.active && missions.remaining() > 0 &&
      Math.hypot(player.position.x - PLACES.delgadoOffice.x, player.position.z - PLACES.delgadoOffice.z) < 7;
    if (nearMarker) return;
    // Rosa's garage owns E when the player stands at the forecourt on foot.
    const nearGarage = player.state === 'foot' &&
      Math.hypot(player.position.x - PLACES.chopGarage.x, player.position.z - PLACES.chopGarage.z) < 8;
    if (nearGarage) {
      this.openGarage();
      return;
    }
    const car = findNearestCar(this.allCars(), player.position.x, player.position.z, PLAYER_TUNING.enterCarRange);
    if (!car || car.dead) return;
    player.enterCar(car);
    this.police.addHeat(6, 'stolen car');
    this.hud.flashMessage(`${car.name}. Try not to scratch it.`, 2.5);
  }

  handleImpact(impact) {
    if (impact <= 10) return;
    const died = this.player.takeDamage((impact - 10) * 1.1);
    this.hud.damageFlash();
    this.audio.crash(impact / 25);
    this.chaseCam.shake(Math.min(0.8, impact / 45));
    const f = this.player.car.forward();
    const nose = new THREE.Vector3(
      this.player.car.position.x + f.x * 2.2, 1,
      this.player.car.position.z + f.z * 2.2,
    );
    this.effects.burst(nose, 0xffcc44, 12, 5, 0.5);
    if (impact > 20) this.player.car.damage(12);
    if (died) this.onWasted();
  }

  handleCarPedCollisions() {
    for (const car of this.allCars()) {
      if (Math.abs(car.speed) < 5 || car.dead) continue;
      const near = this.peds.pedsNear(car.position.x, car.position.z, 2.3);
      for (const { ped } of near) {
        this.peds.knockDown(ped, car.position.x, car.position.z);
        this.effects.burst(ped.mesh.position.clone().setY(1), 0xcc2222, 8, 3, 0.5);
        car.speed *= 0.75;
        if (car.isPlayer) {
          this.police.addHeat(WANTED_TUNING.hitPedestrian, 'hit pedestrian');
          this.hud.flashMessage('You hit a pedestrian!');
          this.audio.crash(0.6);
          this.chaseCam.shake(0.4);
        }
      }
    }
  }

  handleCarCarCollisions() {
    const cars = this.allCars();
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        if (a.dead && b.dead) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const d = Math.hypot(dx, dz);
        if (d >= 3.4 || d < 0.01) continue;
        const push = (3.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.position.x -= nx * push;
        a.position.z -= nz * push;
        b.position.x += nx * push;
        b.position.z += nz * push;
        const relSpeed = Math.abs(a.speed - b.speed);
        const playerInvolved = a.isPlayer || b.isPlayer;
        if (relSpeed > 5) {
          const mid = new THREE.Vector3((a.position.x + b.position.x) / 2, 1, (a.position.z + b.position.z) / 2);
          this.effects.burst(mid, 0xffcc44, 8, 4, 0.4);
          if (playerInvolved) {
            this.audio.crash(relSpeed / 20);
            this.chaseCam.shake(Math.min(0.5, relSpeed / 40));
            const playerCar = a.isPlayer ? a : b;
            const other = a.isPlayer ? b : a;
            if (Math.abs(playerCar.speed) > Math.abs(other.speed)) {
              this.police.addHeat(WANTED_TUNING.hitCar, 'hit car');
            }
            if (relSpeed > 14) {
              const died = this.player.takeDamage((relSpeed - 14) * 0.7);
              this.hud.damageFlash();
              if (died) this.onWasted();
            }
          }
          a.speed *= 0.6;
          b.speed *= 0.6;
          if (relSpeed > 8) {
            a.damage(6);
            b.damage(6);
          }
        }
      }
    }
  }

  handleSmokingCars(dt) {
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0) return;
    this.smokeTimer = 0.18;
    for (const car of this.allCars()) {
      if (!car.smoking || car.dead) continue;
      if (Math.hypot(car.position.x - this.player.position.x, car.position.z - this.player.position.z) > 70) continue;
      const f = car.forward();
      this.effects.smoke(new THREE.Vector3(car.position.x + f.x * 1.6, 1.2, car.position.z + f.z * 1.6), 1.6, 1.1);
    }
  }

  handleDeadCars() {
    for (const car of this.allCars()) {
      if (!car.dead || car.exploded) continue;
      car.exploded = true;
      this.effects.explosion(car.position.clone().setY(1));
      this.audio.explosion();
      if (Math.hypot(car.position.x - this.player.position.x, car.position.z - this.player.position.z) < 45) {
        this.chaseCam.shake(0.7);
      }
    }
  }

  updatePrompt() {
    if (this.hud.el.prompt.textContent !== '') return; // a system already spoke
    const { player } = this;
    // Rosa's garage prompt, then the Bowl race prompt, then car entry.
    if (player.state === 'foot') {
      const dGarage = Math.hypot(player.position.x - PLACES.chopGarage.x, player.position.z - PLACES.chopGarage.z);
      if (dGarage < 8) {
        this.hud.setPrompt("[E] Rosa's garage");
        return;
      }
    }
    if (this.races.nearStart(this) && !this.races.active) {
      const race = this.races.nextRace(rankIndex(this.reputation));
      if (race) {
        this.hud.setPrompt(player.state === 'driving' ? `[T] Start race: ${race.name}` : 'Get in a car to race at the Bowl');
        return;
      }
    }
    if (player.state === 'driving') {
      this.hud.setPrompt('[E] Leave car');
      return;
    }
    const car = findNearestCar(this.allCars(), player.position.x, player.position.z, PLAYER_TUNING.enterCarRange);
    if (car && !car.dead) this.hud.setPrompt('[E] Get in car');
  }

  // Free-roam chatter: every so often a local says something. Never while
  // a mission dialogue is showing.
  updateChatter(dt) {
    this.chatterTimer -= dt;
    if (this.chatterTimer > 0) return;
    this.chatterTimer = 35 + this.rng() * 25;
    if (this.missions.active || this.state !== 'playing') return;
    if (this.hud.dialogueTimer > 0) return;
    const line = CHATTER[Math.floor(this.rng() * CHATTER.length)];
    this.hud.showDialogue(line[0], line[1], 4.5);
  }

  update(dt) {
    this.time += dt;
    const { input, player } = this;

    if (input.pressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.flashMessage(muted ? 'Sound off' : 'Sound on', 2);
    }
    if (input.pressed('KeyF')) {
      const st = this.audio.nextStation();
      this.hud.flashMessage(`${st.name} — ${st.track}`, 3);
    }
    if (input.pressed('KeyC') && this.state === 'playing') this.openCrew();
    if (input.pressed('KeyT') && this.state === 'playing' && this.races.nearStart(this) && !this.races.active) {
      if (player.state !== 'driving') {
        this.hud.flashMessage('Get in a car to race.', 2.5);
      } else if (this.missions.active) {
        this.hud.flashMessage('Finish the mission first — one job at a time.', 3);
      } else {
        const race = this.races.nextRace(rankIndex(this.reputation));
        if (!race) this.hud.flashMessage('No races unlocked yet — earn respect first.', 3);
        else this.races.startRace(race, this);
      }
    }
    if (input.pressed('Escape')) {
      if (this.state === 'shop') {
        this.closeShop();
      } else if (this.state === 'playing') {
        this.state = 'paused';
        this.hud.showPause();
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.hud.hidePause();
      }
    }
    if (this.state !== 'playing') {
      // Clicks queued while paused or in a menu must not fire on resume.
      this.input.consumeClicks();
      this.input.consumeWheel();
    }

    if (this.state === 'playing') {
      this.hud.setPrompt(null); // systems re-set it below as needed
      if (input.pressed('KeyE')) this.handleCarEntry();
      // Weapon keys: 1-4 select, Q cycles, R reloads, wheel cycles.
      for (let i = 0; i < 4; i++) {
        if (input.pressed('Digit' + (i + 1))) this.combat.selectWeapon(i, this.hud);
      }
      if (input.pressed('KeyQ')) this.combat.cycleWeapon(1, this.hud);
      if (input.pressed('KeyR')) this.combat.reload(this.hud);
      const wheel = input.consumeWheel();
      if (wheel !== 0) this.combat.cycleWeapon(wheel > 0 ? 1 : -1, this.hud);
      for (const click of input.consumeClicks()) {
        if (click.button === 0) this.combat.punchOrShoot(this);
      }
      // Automatic weapons keep firing while the trigger is held.
      if (input.mouseDown && this.combat.currentWeapon().auto) this.combat.shoot(this);
      const impact = player.update(dt, input, this.chaseCam.lookYaw, this.city);
      if (impact) this.handleImpact(impact);
      // Handbrake at speed kicks up a skid puff.
      this.skidTimer -= dt;
      if (player.state === 'driving' && input.down('Space') && Math.abs(player.car.speed) > 12 && this.skidTimer <= 0) {
        this.skidTimer = 0.12;
        this.effects.skid(player.car.position.clone().setY(0.3));
      }
      this.traffic.update(dt, player.position, this.allCars());
      this.peds.update(dt, player.position, this.allCars());
      this.police.update(dt, this);
      this.pickups.update(dt, this);
      this.ammoPickups.update(dt, this);
      this.missions.update(dt, this);
      this.races.update(dt, this);
      this.combat.update(dt);
      this.handleCarPedCollisions();
      this.handleCarCarCollisions();
      this.handleSmokingCars(dt);
      this.handleDeadCars();
      this.updateChatter(dt);
      this.updatePrompt();
    }

    // Camera, effects and sound run in every state so menus stay alive.
    const mode = (this.state === 'menu' || this.vistaMode) ? 'menu'
      : player.state === 'driving' ? 'driving' : 'foot';
    this.chaseCam.update(dt, player.position, player.heading, mode, input, player.speed);
    this.effects.update(dt);
    this.audio.update(dt);
    this.audio.setEngine(this.state === 'playing' && player.state === 'driving', player.speed);

    // The low golden sun and its shadow frustum follow the player.
    this.sun.position.set(
      player.position.x + GOLDEN_HOUR.sunOffset.x,
      GOLDEN_HOUR.sunOffset.y,
      player.position.z + GOLDEN_HOUR.sunOffset.z,
    );
    this.sun.target.position.set(player.position.x, 0, player.position.z);
    this.sun.target.updateMatrixWorld();

    // District standing bends the heat; Rook bends the damage.
    this.police.heatFactor = this.districts.heatFactorAt(player.position.x, player.position.z);
    this.combat.damageMul = this.crew.damageMul;

    // HUD, every frame.
    this.hud.setStars(this.police.stars);
    this.hud.setCash(this.cash);
    this.hud.setRep(this.reputation);
    // New rank? Toast what it just unlocked.
    if (this.reputation !== this._lastRep) {
      const lines = this.respect.latestUnlocks(this._lastRep, this.reputation);
      if (lines.length > 0) this.hud.flashMessage(lines.join(' · '), 6);
      this._lastRep = this.reputation;
    }
    const here = this.districts.current(player.position.x, player.position.z);
    this.hud.setDistrict(here.name, here.standing, here.tier);
    this.hud.setCrew(this.crew.list());
    if (this.races.active) {
      const pos = this.races.position(this);
      this.hud.setRace({
        place: pos.place, of: pos.of, name: this.races.def.name,
        gate: this.races.gateIdx + 1, gates: this.races.def.gates.length,
        timeLeft: this.races.def.timeLimit - this.races.timer,
      });
    } else {
      this.hud.setRace(null);
    }
    this.hud.setHealth(player.health, PLAYER_TUNING.maxHealth);
    this.hud.setSpeed(player.state === 'driving' && player.car ? player.car.speedKmh() : 0, player.state === 'driving');
    this.hud.setVehicle(player.state === 'driving' && player.car ? player.car.name : null, player.car ? player.car.health : 0);
    this.hud.setDispatch(this.police.dispatchInfo(player.position), this.police.stars);
    this.hud.setWeapons(this.combat.weaponState());
    this.hud.setRadio(this.audio.radioOn ? this.audio.currentStation() : null);
    const target = this.missions.targetPlace();
    const dist = target ? Math.hypot(player.position.x - target.x, player.position.z - target.z) : null;
    this.hud.setObjective(this.missions.objectiveText(), dist, this.missions.stageText());
    this.hud.setCrosshair(this.state === 'playing' && player.state === 'foot' && !this.vistaMode);
    this.hud.setClock(GOLDEN_HOUR.clockStartMinutes + this.time / 4);
    this.hud.setLocation(this.locationName());
    this.hud.update(dt);
    this.minimap.draw(this); // drawn in the menu too, so it is never an empty disc

    this.input.endFrame();
  }

  start() {
    const clock = new THREE.Clock();
    let firstFrame = true;
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      if (firstFrame) {
        firstFrame = false;
        window.__goldenTideReady = true;
      }
    };
    loop();
  }
}

new GoldenTideGame().start();
