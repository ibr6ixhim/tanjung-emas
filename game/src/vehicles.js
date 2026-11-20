// Vehicles: low-poly car factory, the player's drivable car, and the traffic
// system that keeps the streets alive.
import { CAR_MODELS } from './config.js';
import { makeRng } from './random.js';
import { collideCircle } from './world.js';

export function makeCarMesh(model, rng) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  // dark semi-transparent glass so the cabin reads as glass, not paint
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  // cabin: narrower than the body and tapered — a smaller roof panel on top
  // reads as a sloping greenhouse from the chase camera
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.0), glassMat);
  cabin.position.set(0, 1.12, -0.2); cabin.castShadow = true; g.add(cabin);
  const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.6), bodyMat);
  roofPanel.position.set(0, 1.42, -0.2); roofPanel.castShadow = true; g.add(roofPanel);
  // wheel arches: dark fender boxes over each wheel
  const archMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 1.0), archMat);
    arch.position.set(x, 0.62, z); g.add(arch);
  }
  // wheels live in pivot groups so they can spin around the axle (local X)
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.38, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wheels.push(pivot);
  }
  // headlights + taillights so night driving reads on screen
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.6, 2.22); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0x991111 }));
  tl.position.set(0, 0.6, -2.22); g.add(tl);
  g.userData.model = model;
  g.userData.wheels = wheels;
  g.userData.headlight = hl;
  g.userData.taillight = tl;
  return g;
}

export class PlayerCar {
  constructor(scene, model) {
    this.scene = scene;
    this.mesh = makeCarMesh(model, makeRng(1));
    this.mesh.name = 'playerCar';
    this.addHeadlight();
    scene.add(this.mesh);
    this.speed = 0; this.heading = 0;
    this.topSpeed = model.top; this.accel = model.accel;
    this.condition = 100; this.nitro = false; this.hasNitro = false; this.tuned = false;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.bobY = 0;
    this.braking = false;
  }
  // the one real headlight in the game: a spotlight on the player's car
  // only, so the frame rate survives the traffic around it
  addHeadlight() {
    const spot = new THREE.SpotLight(0xfff2b0, 2.5, 60, 0.5, 0.4);
    spot.position.set(0, 1, 2.2);
    const target = new THREE.Object3D();
    target.position.set(0, 0, 20);
    this.mesh.add(target);
    spot.target = target;
    this.mesh.add(spot);
    this.headlight = spot;
  }
  reset(x, z, heading) {
    this.pos.set(x, 0, z); this.heading = heading; this.speed = 0;
    this.sync();
  }
  setModel(model) {
    // swap the visible car body when the player steals a different model
    this.scene.remove(this.mesh);
    this.mesh = makeCarMesh(model, makeRng(1));
    this.mesh.name = 'playerCar';
    this.addHeadlight();
    this.scene.add(this.mesh);
    this.topSpeed = model.top; this.accel = model.accel;
    this.sync();
  }
  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.position.y = this.bobY;
    this.mesh.rotation.y = this.heading;
  }
  update(dt, input, colliders, nitroBoost) {
    const top = this.topSpeed * (this.tuned ? 1.12 : 1) * (nitroBoost ? 1.5 : 1);
    if (input.forward) this.speed += this.accel * dt;
    else if (input.back) this.speed -= this.accel * 0.7 * dt;
    else this.speed *= Math.max(0, 1 - 1.4 * dt);
    this.speed = Math.max(-12, Math.min(top, this.speed));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerRate = 1.9 * Math.min(1, Math.abs(this.speed) / 12);
    this.heading += steer * steerRate * dt * Math.sign(this.speed || 1);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const clamped = { x: Math.max(-560, Math.min(560, nx)), z: Math.max(-560, Math.min(560, nz)) };
    // a hard push-out from a building means the car hit something: report it
    // so the caller can spark + shake (return value: hit strength 0..1)
    const before = { x: clamped.x, z: clamped.z };
    this.pos.x = clamped.x; this.pos.z = clamped.z;
    collideCircle(this.pos, 2.2, colliders);
    const push = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.lastHit = push > 0.4 ? Math.min(1, push / 2) : 0;
    // body lean into corners + bob while driving + wheels spin with speed
    this.mesh.rotation.z = -steer * 0.05 * Math.min(1, Math.abs(this.speed) / 20);
    this.bobY = Math.abs(Math.sin(performance.now() / 90)) * 0.06 * Math.min(1, Math.abs(this.speed) / 20);
    const spin = (this.speed / 0.38) * dt;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    // brake lights flare while the brake key is held
    this.braking = !!input.back;
    const tl = this.mesh.userData.taillight;
    if (tl) tl.material.color.setHex(this.braking ? 0xff2a2a : 0x991111);
    // drifting: hard steer at speed — the caller reads this for tyre smoke
    this.drifting = Math.abs(steer) > 0 && Math.abs(this.speed) > 15;
    this.sync();
    return this.lastHit;
  }
}

export class Traffic {
  constructor(scene, seed, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.rng = makeRng(seed);
    this.cars = [];
    const group = new THREE.Group(); group.name = 'traffic'; scene.add(group);
    for (let i = 0; i < 55; i++) {
      const model = this.rng.pick(CAR_MODELS);
      const mesh = makeCarMesh(model, this.rng);
      group.add(mesh);
      // one in five cars cruises the beach boulevard (x=-282), the sunset
      // strip — the grid lanes never touch it, so it used to sit empty
      if (this.rng.chance(0.2)) {
        this.cars.push({
          mesh, axis: 'z', speed: this.rng.range(8, 14) * (this.rng.chance(0.5) ? 1 : -1),
          x: -282, z: this.rng.range(-500, 500),
        });
        continue;
      }
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const lane = this.rng.int(-5, 5) * 100 + (this.rng.chance(0.5) ? 4 : -4);
      const along = this.rng.range(-500, 500);
      this.cars.push({
        mesh, axis, speed: this.rng.range(8, 15) * (this.rng.chance(0.5) ? 1 : -1),
        x: axis === 'x' ? along : lane, z: axis === 'x' ? lane : along,
      });
    }
  }

  // Staging helper for ?shot= screenshots: place the first N real traffic
  // cars (the same live drivers) onto the given spots [{x, z, axis, speed}].
  // Rotation mirrors update(): axis 'x' cars face east/west by speed sign,
  // axis 'z' cars face south/north.
  placeCars(spots) {
    for (let i = 0; i < spots.length && i < this.cars.length; i++) {
      const c = this.cars[i];
      const s = spots[i];
      c.x = s.x; c.z = s.z; c.axis = s.axis; c.speed = s.speed;
      c.mesh.position.set(s.x, 0, s.z);
      c.mesh.rotation.y = s.axis === 'x' ? (s.speed > 0 ? Math.PI / 2 : -Math.PI / 2) : (s.speed > 0 ? 0 : Math.PI);
    }
  }
  update(dt, playerPos) {
    for (const c of this.cars) {
      if (c.axis === 'x') {
        c.x += c.speed * dt;
        if (c.x > 540) c.x = -540; if (c.x < -540) c.x = 540;
        c.mesh.rotation.y = c.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        c.z += c.speed * dt;
        if (c.z > 540) c.z = -540; if (c.z < -540) c.z = 540;
        c.mesh.rotation.y = c.speed > 0 ? 0 : Math.PI;
      }
      // gentle slowdown when the player is right ahead
      const dx = c.x - playerPos.x, dz = c.z - playerPos.z;
      if (dx * dx + dz * dz < 100) { c.x -= c.speed * dt * 0.5; c.z -= c.speed * dt * 0.5; }
      c.mesh.position.set(c.x, 0, c.z);
      // wheels spin with road speed
      const spin = (c.speed / 0.38) * dt;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
  nearestParked(pos, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const c of this.cars) {
      const dx = c.x - pos.x, dz = c.z - pos.z, d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    return best;
  }
}
