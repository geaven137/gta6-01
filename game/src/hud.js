// DOM HUD: wanted stars, cash, health, speed, objective, prompts, mission
// cards and menus — plus the SAPD dispatch panel, the weapon bar, the radio
// display, dialogue boxes, vehicle name + condition, and the respect rank.
// Everything the player reads is DOM, never canvas, so it stays crisp in
// screenshots.
import { rankFor } from './config.js';

export class Hud {
  constructor(callbacks) {
    this.cb = callbacks;
    const $ = (id) => document.getElementById(id);
    this.el = {
      stars: $('wanted-stars'),
      cash: $('cash'),
      rep: $('rep'),
      rankBar: $('rank-fill'),
      healthFill: $('health-fill'),
      speedWrap: $('speed-wrap'),
      speed: $('speed'),
      vehicle: $('vehicle'),
      objective: $('objective'),
      objectiveStage: $('objective-stage'),
      objectiveDist: $('objective-dist'),
      prompt: $('prompt'),
      flash: $('flash'),
      missionCard: $('mission-card'),
      missionCardTitle: $('mission-card-title'),
      missionCardText: $('mission-card-text'),
      missionComplete: $('mission-complete'),
      completeTitle: $('complete-title'),
      completeLine: $('complete-line'),
      completeReward: $('complete-reward'),
      completeNext: $('complete-next'),
      vignette: $('vignette'),
      bustedWarning: $('busted-warning'),
      bustedFill: $('busted-fill'),
      menu: $('menu'),
      continueBtn: $('btn-continue'),
      startBtn: $('btn-start'),
      pauseMenu: $('pause-menu'),
      endScreen: $('end-screen'),
      endTitle: $('end-title'),
      endText: $('end-text'),
      crosshair: $('crosshair'),
      clock: $('clock'),
      location: $('location'),
      floatLayer: $('float-layer'),
      dispatch: $('dispatch'),
      dispatchRows: $('dispatch-rows'),
      weapons: $('weapons'),
      radio: $('radio'),
      radioStation: $('radio-station'),
      radioTrack: $('radio-track'),
      dialogue: $('dialogue'),
      dialogueName: $('dialogue-name'),
      dialogueText: $('dialogue-text'),
      district: $('district'),
      districtName: $('district-name'),
      districtFill: $('district-fill'),
      crewRows: $('crew-rows'),
      race: $('race'),
      racePos: $('race-pos'),
      raceGate: $('race-gate'),
      raceTime: $('race-time'),
      garagePanel: $('garage-panel'),
      garageCash: $('garage-cash'),
      garageList: $('garage-list'),
      crewOverlay: $('crew-overlay'),
      crewCash: $('crew-cash'),
      crewList: $('crew-list'),
    };
    this.flashTimer = 0;
    this.cardTimer = 0;
    this.dialogueTimer = 0;
    this._lastStars = -1;
    this._lastCash = -1;
    this._lastDispatch = '';
    this._lastWeapons = '';
    this._lastRadio = '';
    this._lastCrew = '';
    this._lastDistrict = '';
    this._lastRace = '';
    this._garageCb = null;
    this._crewCb = null;

    this.el.startBtn.addEventListener('click', () => this.cb.onStart(false));
    this.el.continueBtn.addEventListener('click', () => this.cb.onStart(true));
    $('btn-resume').addEventListener('click', () => this.cb.onResume());
    $('btn-restart-mission').addEventListener('click', () => this.cb.onRestartMission());
    $('btn-save').addEventListener('click', () => { this.cb.onSave(); this.flashMessage('Progress saved.'); });
    $('btn-quit').addEventListener('click', () => this.cb.onQuit());
    $('btn-respawn').addEventListener('click', () => this.cb.onRespawn());
    $('btn-complete-continue').addEventListener('click', () => this.cb.onMissionContinue());
    $('btn-garage-close').addEventListener('click', () => this.cb.onGarageClose());
    $('btn-crew-close').addEventListener('click', () => this.cb.onCrewClose());
    // Shop buttons are re-rendered on every action: one delegated listener.
    this.el.garageList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !this._garageCb) return;
      this._garageCb(btn.dataset.action, btn.dataset.id);
    });
    this.el.crewList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !this._crewCb) return;
      this._crewCb(btn.dataset.action, btn.dataset.id);
    });
  }

  setStars(n) {
    if (n === this._lastStars) return;
    this._lastStars = n;
    const stars = this.el.stars.querySelectorAll('.star');
    stars.forEach((s, i) => s.classList.toggle('lit', i < n));
    this.el.stars.classList.toggle('hot', n >= 3);
  }

  setCash(n) {
    if (n === this._lastCash) return;
    this._lastCash = n;
    this.el.cash.textContent = '$' + n.toLocaleString('en-US');
  }

  // Respect: a named rank and a progress bar toward the next one.
  setRep(n) {
    const rank = rankFor(n);
    this.el.rep.textContent = `${rank.name} · REP ${n}`;
    const next = rank.min === 9 ? 9 : rank.min + 1;
    const pct = rank.min >= 9 ? 100 : Math.round(((n - rank.min) / Math.max(1, next - rank.min)) * 100);
    if (this.el.rankBar) this.el.rankBar.style.width = pct + '%';
  }

  setHealth(h, max) {
    const pct = Math.max(0, Math.round((h / max) * 100));
    this.el.healthFill.style.width = pct + '%';
    this.el.healthFill.classList.toggle('low', pct <= 30);
  }

  setSpeed(kmh, driving) {
    this.el.speedWrap.style.display = driving ? 'block' : 'none';
    if (driving) this.el.speed.textContent = Math.round(kmh);
  }

  // Vehicle name + condition %, shown beside the speedometer while driving.
  setVehicle(name, health) {
    if (!this.el.vehicle) return;
    if (!name) {
      this.el.vehicle.style.display = 'none';
      return;
    }
    this.el.vehicle.style.display = 'block';
    const pct = Math.max(0, Math.round(health));
    const state = pct > 70 ? '' : pct > 35 ? ' · DENTED' : ' · WRECKED';
    const text = `${name} · ${pct}%${state}`;
    if (this.el.vehicle.textContent !== text) this.el.vehicle.textContent = text;
  }

  setObjective(text, dist, stage) {
    if (this.el.objective.textContent !== text) this.el.objective.textContent = text;
    this.el.objectiveDist.textContent = dist !== null && dist !== undefined ? Math.round(dist) + ' m' : '';
    if (this.el.objectiveStage) {
      const s = stage || '';
      if (this.el.objectiveStage.textContent !== s) this.el.objectiveStage.textContent = s;
    }
  }

  setPrompt(text) {
    if (this.el.prompt.textContent !== (text || '')) {
      this.el.prompt.textContent = text || '';
      this.el.prompt.style.display = text ? 'block' : 'none';
    }
  }

  flashMessage(text, seconds = 4) {
    this.el.flash.textContent = text;
    this.el.flash.classList.add('show');
    this.flashTimer = seconds;
  }

  // Dialogue box: a named speaker and one line, bottom centre.
  showDialogue(name, text, seconds = 5) {
    if (!this.el.dialogue) return;
    this.el.dialogueName.textContent = name;
    this.el.dialogueText.textContent = text;
    this.el.dialogue.classList.add('show');
    this.dialogueTimer = seconds;
  }

  hideDialogue() {
    if (!this.el.dialogue) return;
    this.el.dialogue.classList.remove('show');
    this.dialogueTimer = 0;
  }

  // SAPD dispatch panel: every unit on the player, its role, its distance.
  setDispatch(units, stars) {
    if (!this.el.dispatch) return;
    if (stars <= 0 || units.length === 0) {
      this.el.dispatch.style.display = 'none';
      this._lastDispatch = '';
      return;
    }
    const key = units.map((u) => `${u.call}|${u.role}|${Math.round(u.dist / 5) * 5}`).join(';');
    if (key === this._lastDispatch) return;
    this._lastDispatch = key;
    this.el.dispatch.style.display = 'block';
    this.el.dispatchRows.innerHTML = units.map((u) =>
      `<div class="dispatch-row"><span class="dispatch-call">${u.call}</span><span class="dispatch-role">${u.role}</span><span class="dispatch-dist">${Math.round(u.dist)} m</span></div>`,
    ).join('');
  }

  // Weapon bar: four slots with magazines, reserves and the active slot.
  // Locked slots (respect-gated) show as dimmed with a lock.
  setWeapons(states) {
    if (!this.el.weapons) return;
    const key = states.map((s) => `${s.slot}:${s.mag}/${s.reserve}${s.active ? '*' : ''}${s.reloading ? 'R' : ''}${s.locked ? 'L' : ''}`).join(';');
    if (key === this._lastWeapons) return;
    this._lastWeapons = key;
    this.el.weapons.innerHTML = states.map((s) =>
      `<div class="weapon-slot${s.active ? ' active' : ''}${s.locked ? ' locked' : ''}"><span class="weapon-key">${s.slot}</span><span class="weapon-name">${s.name}</span><span class="weapon-ammo">${s.locked ? 'LOCKED' : s.reloading ? 'RELOADING' : `${s.mag} / ${s.reserve}`}</span></div>`,
    ).join('');
  }

  // District standing: the current district, its tier and a fill bar.
  setDistrict(name, standing, tier) {
    if (!this.el.district) return;
    const key = `${name}|${standing}|${tier}`;
    if (key === this._lastDistrict) return;
    this._lastDistrict = key;
    this.el.districtName.textContent = `${name} · ${tier} ${standing}`;
    this.el.districtFill.style.width = standing + '%';
  }

  // Crew panel: the recruited specialists and their abilities.
  setCrew(members) {
    if (!this.el.crewRows) return;
    const key = members.map((m) => m.id).join(',');
    if (key === this._lastCrew) return;
    this._lastCrew = key;
    if (members.length === 0) {
      this.el.crewRows.innerHTML = '<div class="crew-row empty">No crew yet — press C</div>';
      return;
    }
    this.el.crewRows.innerHTML = members.map((m) =>
      `<div class="crew-row"><span class="crew-name">${m.name}</span><span class="crew-role">${m.role}</span><span class="crew-ability">${m.ability}</span></div>`,
    ).join('');
  }

  // Race HUD: live position, checkpoint count and the clock.
  setRace(race) {
    if (!this.el.race) return;
    if (!race) {
      this.el.race.style.display = 'none';
      this._lastRace = '';
      return;
    }
    const key = `${race.place}|${race.gate}|${Math.floor(race.timeLeft)}`;
    if (key === this._lastRace) return;
    this._lastRace = key;
    this.el.race.style.display = 'block';
    const ord = ['1st', '2nd', '3rd'][race.place - 1] || `${race.place}th`;
    this.el.racePos.textContent = `${ord} / ${race.of} · ${race.name}`;
    this.el.raceGate.textContent = `CHECKPOINT ${Math.min(race.gate, race.gates)}/${race.gates}`;
    const left = Math.max(0, Math.ceil(race.timeLeft));
    this.el.raceTime.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }

  // Garage shop: car rows with buy/select and upgrade buttons.
  showGarage(data, cb) {
    this._garageCb = cb;
    this.el.garageCash.textContent = `Cash: $${data.cash.toLocaleString('en-US')} — prices bend with Northside standing.`;
    this.el.garageList.innerHTML = data.cars.map((car) => {
      const up = car.upgrades;
      let actions = '';
      if (!car.owned) {
        actions = car.rankOk
          ? `<button class="shop-btn" data-action="buy" data-id="${car.id}">Buy — $${car.price}</button>`
          : `<span class="shop-lock">${car.lockReason}</span>`;
      } else {
        const sel = car.active
          ? '<span class="shop-active">On the forecourt</span>'
          : `<button class="shop-btn" data-action="select" data-id="${car.id}">Roll out</button>`;
        const eng = up.engine >= 3
          ? '<span class="shop-max">Engine MAX</span>'
          : `<button class="shop-btn" data-action="engine" data-id="${car.id}">Engine ${up.engine}/3 — $${data.upgradePrices.engine}</button>`;
        const arm = up.armor >= 3
          ? '<span class="shop-max">Armour MAX</span>'
          : `<button class="shop-btn" data-action="armor" data-id="${car.id}">Armour ${up.armor}/3 — $${data.upgradePrices.armor}</button>`;
        const paint = `<button class="shop-btn" data-action="paint" data-id="${car.id}">Respray — $${data.upgradePrices.paint}</button>`;
        actions = `${sel} ${eng} ${arm} ${paint}`;
      }
      return `<div class="shop-row"><div class="shop-name">${car.name}</div><div class="shop-desc">Top ${car.maxSpeed * 3.6 | 0} km/h · ${car.health} HP</div><div class="shop-actions">${actions}</div></div>`;
    }).join('');
    this.el.garagePanel.classList.add('show');
  }

  hideGarage() {
    this.el.garagePanel.classList.remove('show');
    this._garageCb = null;
  }

  // Crew recruiting: one row per specialist, with cost or lock reason.
  showCrew(data, cb) {
    this._crewCb = cb;
    this.el.crewCash.textContent = `Cash: $${data.cash.toLocaleString('en-US')} — the Last Tide needs at least one crew member.`;
    this.el.crewList.innerHTML = data.members.map((m) => {
      let action = '';
      if (m.recruited) action = '<span class="shop-active">On the crew</span>';
      else if (!m.rankOk) action = `<span class="shop-lock">${m.lockReason}</span>`;
      else action = `<button class="shop-btn" data-action="recruit" data-id="${m.id}">Recruit — $${m.cost}</button>`;
      return `<div class="shop-row"><div class="shop-name">${m.name} · ${m.role}</div><div class="shop-desc"><b>${m.ability}</b> — ${m.desc}</div><div class="shop-actions">${action}</div></div>`;
    }).join('');
    this.el.crewOverlay.classList.add('show');
  }

  hideCrew() {
    this.el.crewOverlay.classList.remove('show');
    this._crewCb = null;
  }

  // Radio: station name + the track now playing.
  setRadio(station) {
    if (!this.el.radio) return;
    const key = station ? station.name + station.track : '';
    if (key === this._lastRadio) return;
    this._lastRadio = key;
    if (!station) {
      this.el.radio.style.display = 'none';
      return;
    }
    this.el.radio.style.display = 'block';
    this.el.radioStation.textContent = '♪ ' + station.name;
    this.el.radioTrack.textContent = station.track;
  }

  showMissionCard(title, briefing) {
    this.el.missionCardTitle.textContent = title;
    this.el.missionCardText.textContent = briefing;
    this.el.missionCard.classList.add('show');
    this.cardTimer = 7;
  }

  hideMissionCard() {
    this.el.missionCard.classList.remove('show');
    this.cardTimer = 0;
  }

  showMissionComplete(title, line, reward, nextTitle) {
    this.el.completeTitle.textContent = 'MISSION PASSED — ' + title;
    this.el.completeLine.textContent = line;
    this.el.completeReward.textContent = '+$' + reward;
    this.el.completeNext.textContent = nextTitle ? 'Next job: ' + nextTitle : 'Story complete. Santa Aurelia is yours.';
    this.el.missionComplete.classList.add('show');
  }

  hideMissionComplete() {
    this.el.missionComplete.classList.remove('show');
  }

  showBustedWarning(k) {
    this.el.bustedWarning.style.display = k > 0 ? 'block' : 'none';
    this.el.bustedFill.style.width = Math.round(k * 100) + '%';
  }

  damageFlash() {
    this.el.vignette.classList.remove('flash');
    void this.el.vignette.offsetWidth;
    this.el.vignette.classList.add('flash');
  }

  floatText(text, color) {
    const div = document.createElement('div');
    div.className = 'float-text';
    div.textContent = text;
    div.style.color = color || '#2ecc71';
    this.el.floatLayer.appendChild(div);
    setTimeout(() => div.remove(), 1400);
  }

  setCrosshair(visible) {
    this.el.crosshair.style.display = visible ? 'block' : 'none';
  }

  setClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  setLocation(text) {
    if (this.el.location.textContent !== text) this.el.location.textContent = text;
  }

  showMenu(hasSave) {
    this.el.menu.classList.add('show');
    this.el.continueBtn.style.display = hasSave ? 'block' : 'none';
  }

  hideMenu() {
    this.el.menu.classList.remove('show');
  }

  showPause() {
    this.el.pauseMenu.classList.add('show');
  }

  hidePause() {
    this.el.pauseMenu.classList.remove('show');
  }

  showEnd(kind, fine) {
    this.el.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    this.el.endTitle.className = kind === 'busted' ? 'end-blue' : 'end-red';
    this.el.endText.textContent = kind === 'busted'
      ? `SAPD caught up with you. Fine: $${fine}.`
      : `Mara didn't make it. Hospital bill: $${fine}.`;
    this.el.endScreen.classList.add('show');
  }

  hideEnd() {
    this.el.endScreen.classList.remove('show');
  }

  update(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.el.flash.classList.remove('show');
    }
    if (this.cardTimer > 0) {
      this.cardTimer -= dt;
      if (this.cardTimer <= 0) this.el.missionCard.classList.remove('show');
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.el.dialogue.classList.remove('show');
    }
  }
}
