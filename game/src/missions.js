// Missions: the 8-chapter story. A small state machine — one active mission, one
// active stage — with a floating beacon marker, dialog lines, and completion
// payouts (money, respect, autosave).
import { MISSIONS } from './config.js';

export class MissionRunner {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks; // {onDialog, onMissionComplete, onStageComplete, onCrime}
    this.index = 0;      // mission index (0-based)
    this.stage = 0;
    this.active = false;
    this.enemiesLeft = 0;
    this.completed = new Set();
    // floating beacon at the current objective
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd34f, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.2, 3.4, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd34f, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }
  current() { return MISSIONS[this.index]; }
  start() {
    this.active = true; this.stage = 0;
    this.showStageDialog();
    this.placeBeacon();
  }
  showStageDialog() {
    const m = this.current();
    if (!m) return;
    const s = m.stages[this.stage];
    if (s && s.dialog) this.hooks.onDialog(s.dialog);
  }
  placeBeacon() {
    const m = this.current();
    if (!m || !this.active) { this.beacon.visible = false; this.ring.visible = false; return; }
    const s = m.stages[this.stage];
    if (!s) { this.beacon.visible = false; this.ring.visible = false; return; }
    this.beacon.position.set(s.target[0], 13, s.target[1]);
    this.ring.position.set(s.target[0], 0.15, s.target[1]);
    this.beacon.visible = true; this.ring.visible = true;
  }
  stageTarget() {
    const m = this.current();
    if (!m || !this.active) return null;
    const s = m.stages[this.stage];
    return s ? { x: s.target[0], z: s.target[1], type: s.type, text: s.text } : null;
  }
  missionText() {
    const m = this.current();
    if (!m) return { title: 'SEMUA MISI SELESAI', objective: 'Kota ini milikmu, Raka.', stage: '', next: '' };
    const s = m.stages[this.stage];
    const next = m.stages[this.stage + 1];
    return {
      title: `MISSION ${m.id}/8 — ${m.name.toUpperCase()}`,
      objective: s ? s.text : '',
      stage: `STAGE ${Math.min(this.stage + 1, m.stages.length)}/${m.stages.length}`,
      next: next ? `NEXT: ${next.text}` : `NEXT: Selesaikan misi — hadiah $${m.pay}`,
    };
  }
  // called every frame: returns true when the current stage just completed
  checkStage(playerPos, state) {
    if (!this.active) return false;
    const m = this.current();
    if (!m) return false;
    const s = m.stages[this.stage];
    if (!s) return false;
    const dx = playerPos.x - s.target[0], dz = playerPos.z - s.target[1];
    const d = Math.hypot(dx, dz);
    if (s.type === 'fight') {
      if (this.enemiesLeft <= 0 && state.enemiesSpawned) { this.completeStage(); return true; }
      return false;
    }
    if (s.type === 'steal' && state.inCar && d < 40) { this.completeStage(); return true; }
    if (s.type === 'boat' && state.inBoat) { this.completeStage(); return true; }
    if (s.type === 'deliver' && (state.inCar || state.inBoat) && d < 12) { this.completeStage(); return true; }
    if (s.type !== 'deliver' && s.type !== 'steal' && s.type !== 'boat' && d < 12) { this.completeStage(); return true; }
    return false;
  }
  completeStage() {
    const m = this.current();
    this.stage++;
    this.hooks.onStageComplete(m, this.stage);
    if (this.stage >= m.stages.length) this.completeMission();
    else { this.showStageDialog(); this.placeBeacon(); }
  }
  completeMission() {
    const m = this.current();
    this.completed.add(m.id);
    this.hooks.onMissionComplete(m);
    this.index++;
    this.active = false;
    this.beacon.visible = false; this.ring.visible = false;
    if (this.index < MISSIONS.length) {
      setTimeout(() => this.start(), 1500);
    }
  }
  listStatus() {
    return MISSIONS.map((m, i) => ({
      id: m.id, name: m.name,
      status: this.completed.has(m.id) ? 'DONE' : (i === this.index ? 'NEXT' : (i < this.index ? 'DONE' : 'LOCKED')),
    }));
  }
  update(dt) {
    if (this.beacon.visible) {
      this.beacon.rotation.y += dt * 1.2;
      const s = 1 + Math.sin(performance.now() / 400) * 0.08;
      this.beacon.scale.set(s, 1, s);
    }
  }
}
