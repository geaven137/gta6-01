// DOM HUD: wanted stars, cash, health, speed, objective, prompts, mission
// cards and menus. Everything the player reads is DOM, never canvas, so it
// stays crisp in screenshots.
export class Hud {
  constructor(callbacks) {
    this.cb = callbacks;
    const $ = (id) => document.getElementById(id);
    this.el = {
      stars: $('wanted-stars'),
      cash: $('cash'),
      rep: $('rep'),
      healthFill: $('health-fill'),
      speedWrap: $('speed-wrap'),
      speed: $('speed'),
      objective: $('objective'),
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
    };
    this.flashTimer = 0;
    this.cardTimer = 0;
    this._lastStars = -1;
    this._lastCash = -1;

    this.el.startBtn.addEventListener('click', () => this.cb.onStart(false));
    this.el.continueBtn.addEventListener('click', () => this.cb.onStart(true));
    $('btn-resume').addEventListener('click', () => this.cb.onResume());
    $('btn-restart-mission').addEventListener('click', () => this.cb.onRestartMission());
    $('btn-save').addEventListener('click', () => { this.cb.onSave(); this.flashMessage('Progress saved.'); });
    $('btn-quit').addEventListener('click', () => this.cb.onQuit());
    $('btn-respawn').addEventListener('click', () => this.cb.onRespawn());
    $('btn-complete-continue').addEventListener('click', () => this.cb.onMissionContinue());
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

  setRep(n) {
    this.el.rep.textContent = 'REP ' + n;
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

  setObjective(text, dist) {
    if (this.el.objective.textContent !== text) this.el.objective.textContent = text;
    this.el.objectiveDist.textContent = dist !== null && dist !== undefined ? Math.round(dist) + ' m' : '';
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
    this.el.completeNext.textContent = nextTitle ? 'Next job: ' + nextTitle : 'Story complete. Solmar Bay is yours.';
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
      ? `Solmar PD caught up with you. Fine: $${fine}.`
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
  }
}
