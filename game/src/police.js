// Police: the wanted system (0–5 stars), named dispatch units with live distance
// and tactics, chasing patrol cars, roadblocks, and the ELANG helicopter with its
// spotlight cone.
import { POLICE_UNITS, AIR_UNITS } from './config.js';
import { makeRng } from './random.js';
import { collideCircle } from './world.js';

function makePoliceCarMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xd8e8f8, transparent: true, opacity: 0.7 });

  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 4.2), darkMat);
  chassis.position.y = 0.35; g.add(chassis);

  // Main body
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 3.6), bodyMat);
  mainBody.position.set(0, 0.62, 0.1); g.add(mainBody);

  // Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.4), bodyMat);
  hood.position.set(0, 0.72, 1.55);
  hood.rotation.x = -0.12; g.add(hood);

  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.28, 0.9), bodyMat);
  trunk.position.set(0, 0.75, -1.55); g.add(trunk);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.48, 1.8), glassMat);
  cabin.position.set(0, 1.05, -0.15); g.add(cabin);

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 1.5), bodyMat);
  roof.position.set(0, 1.32, -0.15); g.add(roof);

  // White stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 3.8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stripe.position.set(0, 0.78, 0.05); g.add(stripe);

  // Light bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  bar.position.set(0, 1.48, -0.15); bar.name = 'lightbar'; g.add(bar);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.35], [0.92, -1.35]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wheels.push(pivot);
  }

  g.userData.wheels = wheels;
  return g;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), new THREE.MeshLambertMaterial({ color: 0x2a3a5a }));
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.0), new THREE.MeshLambertMaterial({ color: 0x2a3a5a }));
  tail.position.set(0, 0.2, -4.0); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
  rotor.position.y = 1.0; rotor.name = 'rotor'; g.add(rotor);
  const spot = new THREE.Mesh(new THREE.ConeGeometry(6, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
  spot.position.y = -14; spot.rotation.x = Math.PI; spot.name = 'spotcone'; g.add(spot);
  const lamp = new THREE.PointLight(0xfff2b0, 2.2, 60);
  lamp.position.y = -2; g.add(lamp);
  return g;
}

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.wanted = 0;
    this.heat = 0;          // 0..100, drives star changes
    this.searchTimer = 0;
    this.cars = [];
    this.roadblocks = [];
    this.units = [];        // dispatch list entries {name, dist, tactic}
    this.heli = { mesh: makeHeliMesh(), active: false, angle: 0 };
    this.heli.mesh.visible = false;
    scene.add(this.heli.mesh);
    const group = new THREE.Group(); group.name = 'police'; scene.add(group);
    this.group = group;
  }
  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    this.recomputeStars();
  }
  clearWanted() { this.heat = 0; this.wanted = 0; this.searchTimer = 0; }
  recomputeStars() {
    const stars = this.heat <= 0 ? 0 : this.heat < 20 ? 1 : this.heat < 40 ? 2 : this.heat < 60 ? 3 : this.heat < 85 ? 4 : 5;
    if (stars !== this.wanted) { this.wanted = stars; this.syncForce(); }
  }
  syncForce() {
    // spawn or remove patrol cars to match the wanted level
    const want = Math.min(5, this.wanted + 1);
    while (this.cars.length < want) {
      const mesh = makePoliceCarMesh();
      this.group.add(mesh);
      this.cars.push({ mesh, x: 0, z: 0, heading: 0, speed: 0, name: POLICE_UNITS[this.cars.length % POLICE_UNITS.length], tactic: 'PURSUIT' });
    }
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.group.remove(c.mesh);
    }
    this.heli.active = this.wanted >= 3;
    this.heli.mesh.visible = this.heli.active;
    // roadblocks at wanted 4+
    while (this.roadblocks.length < (this.wanted >= 4 ? 2 : 0)) {
      const mesh = makePoliceCarMesh();
      this.group.add(mesh);
      this.roadblocks.push({ mesh, x: 0, z: 0, heading: 0, placed: false });
    }
    while (this.roadblocks.length > (this.wanted >= 4 ? 2 : 0)) {
      const r = this.roadblocks.pop();
      this.group.remove(r.mesh);
    }
  }
  update(dt, targetPos, targetSpeed, colliders, onWater) {
    // heat decays when the player is slow and no police is close
    const nearest = this.units.length ? Math.min(...this.units.map(u => u.dist)) : 9999;
    if (this.wanted > 0 && targetSpeed < 3 && nearest > 90) {
      this.heat = Math.max(0, this.heat - dt * 2.2);
      this.searchTimer = Math.max(0, this.searchTimer - dt);
      if (this.heat <= 0) this.wanted = 0;
      else this.recomputeStars();
    }
    this.units = [];
    for (const c of this.cars) {
      const dx = targetPos.x - c.x, dz = targetPos.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 220) { // respawn closer when far away
        const a = this.rng.range(0, Math.PI * 2);
        c.x = targetPos.x + Math.sin(a) * 140;
        c.z = targetPos.z + Math.cos(a) * 140;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      // ram when close, pursue otherwise
      c.tactic = d < 18 ? 'RAMMING' : (d < 70 ? 'PURSUIT' : 'CLOSING IN');
      c.speed = Math.min(30 + this.wanted * 2, c.speed + (c.tactic === 'RAMMING' ? 22 : 14) * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      collideCircle({ x: c.x, z: c.z }, 2.2, colliders);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // wheels spin with road speed
      const spin = (c.speed / 0.38) * dt;
      for (const w of (c.mesh.userData.wheels || [])) w.rotation.x += spin;
      // flashing light bar: red / blue, the police flash in the chase
      const bar = c.mesh.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2a2a : 0x2a6bff);
      this.units.push({ name: c.name, dist: Math.round(d), tactic: c.tactic });
    }
    // roadblocks sit ahead of the player's direction of travel
    for (let i = 0; i < this.roadblocks.length; i++) {
      const r = this.roadblocks[i];
      if (!r.placed) {
        r.x = targetPos.x + (i === 0 ? 70 : -60);
        r.z = targetPos.z + (i === 0 ? 20 : 60);
        r.heading = this.rng.range(0, Math.PI * 2);
        r.placed = true;
      }
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.y = r.heading;
      this.units.push({ name: 'ROADBLOCK', dist: Math.round(Math.hypot(r.x - targetPos.x, r.z - targetPos.z)), tactic: 'ROADBLOCK' });
    }
    // helicopter circles above the player, low enough to stay in frame
    if (this.heli.active && !onWater) {
      this.heli.angle += dt * 0.45;
      const hx = targetPos.x + Math.cos(this.heli.angle) * 55;
      const hz = targetPos.z + Math.sin(this.heli.angle) * 55;
      this.heli.mesh.position.set(hx, 30, hz);
      this.heli.mesh.rotation.y = Math.atan2(targetPos.x - hx, targetPos.z - hz);
      const rotor = this.heli.mesh.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
      this.units.push({ name: AIR_UNITS[0], dist: Math.round(Math.hypot(hx - targetPos.x, hz - targetPos.z)), tactic: 'SPOTLIGHT' });
    }
    if (this.wanted > 0 && this.searchTimer <= 0 && this.units.length && nearest > 90) {
      this.searchTimer = 11;
    }
  }
  // staged ?shot= frame: rebuild the dispatch list from the placed units
  // without moving anything, so the frozen chase keeps its live distances
  updateFrozen(targetPos) {
    this.units = [];
    for (const c of this.cars) {
      const d = Math.hypot(targetPos.x - c.x, targetPos.z - c.z) || 1;
      this.units.push({ name: c.name, dist: Math.round(d), tactic: d < 18 ? 'RAMMING' : (d < 70 ? 'PURSUIT' : 'CLOSING IN') });
    }
    for (const r of this.roadblocks) {
      if (!r.placed) continue;
      this.units.push({ name: 'ROADBLOCK', dist: Math.round(Math.hypot(r.x - targetPos.x, r.z - targetPos.z)), tactic: 'ROADBLOCK' });
    }
    if (this.heli.active) {
      this.units.push({ name: AIR_UNITS[0], dist: Math.round(Math.hypot(this.heli.mesh.position.x - targetPos.x, this.heli.mesh.position.z - targetPos.z)), tactic: 'SPOTLIGHT' });
    }
  }
  // stage a unit at an exact spot (used by the ?shot= staging so the cover
  // screenshot shows the chase instead of empty road)
  placeCar(i, x, z, heading) {
    const c = this.cars[i];
    if (!c) return;
    c.x = x; c.z = z; c.heading = heading; c.speed = 12;
    c.mesh.position.set(x, 0, z);
    c.mesh.rotation.y = heading;
  }
  placeRoadblock(i, x, z, heading) {
    const r = this.roadblocks[i];
    if (!r) return;
    r.x = x; r.z = z; r.heading = heading; r.placed = true;
    r.mesh.position.set(x, 0, z);
    r.mesh.rotation.y = heading;
  }
  status() {
    if (this.wanted === 0) return 'CLEAN';
    const nearest = this.units.length ? Math.min(...this.units.map(u => u.dist)) : 9999;
    return nearest > 90 ? 'SEARCHING' : 'IN SIGHT';
  }
}
