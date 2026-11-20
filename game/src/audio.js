// Audio: two radio stations built from WebAudio oscillators (no audio files, no
// network) plus small synthesized sound effects for shots, pickups and sirens.
import { RADIO_STATIONS } from './config.js';

const SCALES = {
  senja: [110, 130.8, 164.8, 196, 220, 261.6, 329.6],   // A minor-ish synthwave
  pantai: [130.8, 164.8, 196, 246.9, 261.6, 329.6, 392], // C major island pop
};

export class Radio {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.song = 0;
    this.step = 0;
    this.timer = null;
    this.master = null;
    this.playing = false;
  }
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  currentStation() { return RADIO_STATIONS[this.station]; }
  currentSong() { return this.currentStation().songs[this.song]; }
  start() {
    this.ensure();
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.timer = setInterval(() => this.tick(), 240);
  }
  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  nextStation() {
    this.station = (this.station + 1) % RADIO_STATIONS.length;
    this.song = (this.song + 1) % this.currentStation().songs.length;
    this.step = 0;
  }
  nextSong() {
    this.song = (this.song + 1) % this.currentStation().songs.length;
  }
  tick() {
    if (!this.playing || !this.ctx) return;
    const scale = SCALES[this.currentStation().id];
    const s = this.step++;
    // bass on beats 0 and 2 of each bar
    if (s % 4 === 0) this.note(scale[0] / 2, 0.5, 'triangle', 0.5);
    if (s % 8 === 6) this.note(scale[3] / 2, 0.3, 'triangle', 0.4);
    // lead arpeggio
    const pattern = this.currentStation().id === 'senja' ? [0, 2, 4, 3, 5, 4, 2, 1] : [0, 1, 2, 4, 3, 2, 1, 0];
    const n = pattern[s % 8];
    this.note(scale[n] * 2, 0.18, this.currentStation().id === 'senja' ? 'square' : 'sine', 0.16);
    // pad every 8 steps
    if (s % 8 === 0) {
      this.note(scale[0], 1.8, 'sine', 0.08);
      this.note(scale[2], 1.8, 'sine', 0.06);
    }
    if (s % 64 === 0) this.nextSong();
  }
  note(freq, dur, type, vol) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  sfx(kind) {
    this.ensure();
    if (!this.ctx) return;
    if (kind === 'shot') this.note(180, 0.08, 'square', 0.25);
    if (kind === 'pickup') { this.note(660, 0.12, 'sine', 0.2); setTimeout(() => this.note(880, 0.15, 'sine', 0.2), 90); }
    if (kind === 'mission') { [523, 659, 784].forEach((f, i) => setTimeout(() => this.note(f, 0.25, 'triangle', 0.2), i * 120)); }
    if (kind === 'siren') this.note(740, 0.4, 'sawtooth', 0.05);
  }
}
