// Sound: every effect is synthesised with WebAudio — no audio files. Engine
// hum, police siren, gunshots, pickups and mission jingles, all from
// oscillators and filtered noise.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.sirenDist = 100;
    this.time = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass, pitched by speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: square wave, frequency toggled in update().
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  setEngine(driving, speed) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + Math.min(0.1, Math.abs(speed) * 0.002) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 3.2, this.ctx.currentTime, 0.08);
  }

  setSiren(on, dist) {
    this.sirenOn = on;
    this.sirenDist = dist;
  }

  _noiseBurst(duration, filterFreq, gainValue, type = 'lowpass') {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  _tone(freq, duration, type = 'sine', gainValue = 0.2, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  gunshot() {
    this._noiseBurst(0.14, 2400, 0.5, 'bandpass');
    this._tone(160, 0.1, 'square', 0.12, 0, 60);
  }

  punch() {
    this._tone(130, 0.12, 'sine', 0.35, 0, 45);
    this._noiseBurst(0.08, 500, 0.25);
  }

  crash(strength = 1) {
    this._noiseBurst(0.2, 700, 0.3 * Math.min(1, strength));
    this._tone(90, 0.18, 'sine', 0.25, 0, 40);
  }

  explosion() {
    this._noiseBurst(0.7, 420, 0.6);
    this._tone(70, 0.6, 'sine', 0.4, 0, 30);
  }

  pickup() {
    this._tone(880, 0.09, 'sine', 0.18);
    this._tone(1318, 0.14, 'sine', 0.18, 0.09);
  }

  stageComplete() {
    this._tone(660, 0.12, 'triangle', 0.2);
    this._tone(990, 0.18, 'triangle', 0.2, 0.12);
  }

  missionStart() {
    [523, 659, 784].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.2, i * 0.13));
  }

  missionComplete() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.22, i * 0.14));
  }

  update(dt) {
    this.time += dt;
    if (!this.ctx) return;
    if (this.sirenOn) {
      const near = Math.max(0, 1 - this.sirenDist / 95);
      const hi = Math.floor(this.time * 2.4) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, this.ctx.currentTime, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.045 * near + 0.008, this.ctx.currentTime, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
  }
}
