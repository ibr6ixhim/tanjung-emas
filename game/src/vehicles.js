// Vehicles: low-poly car factory, the player's drivable car, and the traffic
// system that keeps the streets alive.
import { CAR_MODELS } from './config.js';
import { makeRng } from './random.js';
import { collideCircle } from './world.js';

export function makeCarMesh(model, rng) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530, transparent: true, opacity: 0.75 });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

  // Chassis / lower body
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 4.2), darkMat);
  chassis.position.y = 0.35; chassis.castShadow = true; g.add(chassis);

  // Main body (cabin base + sides)
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 3.6), bodyMat);
  mainBody.position.set(0, 0.62, 0.1); mainBody.castShadow = true; g.add(mainBody);

  // Hood (sloping front)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.4), bodyMat);
  hood.position.set(0, 0.72, 1.55);
  hood.rotation.x = -0.12; // slight slope
  hood.castShadow = true; g.add(hood);

  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.28, 0.9), bodyMat);
  trunk.position.set(0, 0.75, -1.55); trunk.castShadow = true; g.add(trunk);

  // Cabin / greenhouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.48, 1.8), glassMat);
  cabin.position.set(0, 1.05, -0.15); cabin.castShadow = true; g.add(cabin);

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 1.5), bodyMat);
  roof.position.set(0, 1.32, -0.15); roof.castShadow = true; g.add(roof);

  // Windshield slope (extra panel)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.05), glassMat);
  windshield.position.set(0, 1.05, 0.75);
  windshield.rotation.x = 0.45; g.add(windshield);

  // Front bumper
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.18), darkMat);
  bumperF.position.set(0, 0.42, 2.15); g.add(bumperF);

  // Rear bumper
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.22, 0.16), darkMat);
  bumperR.position.set(0, 0.42, -2.15); g.add(bumperR);

  // Wheel arches (fenders)
  const archMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.35], [0.92, -1.35]]) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.85), archMat);
    arch.position.set(x, 0.55, z); g.add(arch);
  }

  // Wheels with simple rims
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const rimMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const wheels = [];
  for (const [x, z] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.35], [0.92, -1.35]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.castShadow = true;
    pivot.add(w);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    pivot.add(rim);
    g.add(pivot);
    wheels.push(pivot);
  }

  // Headlights (two separate)
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), hlMat);
  hlL.position.set(-0.55, 0.62, 2.12); g.add(hlL);
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), hlMat);
  hlR.position.set(0.55, 0.62, 2.12); g.add(hlR);
  const hl = new THREE.Group(); // for compatibility with existing code that expects userData.headlight
  hl.add(hlL); hl.add(hlR); g.add(hl);

  // Taillights
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), tlMat);
  tlL.position.set(-0.5, 0.65, -2.12); g.add(tlL);
  const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), tlMat);
  tlR.position.set(0.5, 0.65, -2.12); g.add(tlR);
  const tl = new THREE.Group();
  tl.add(tlL); tl.add(tlR); g.add(tl);

  // Side mirrors
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.18), chromeMat);
  mirror.position.set(-0.95, 0.95, 0.4); g.add(mirror);
  const mirror2 = mirror.clone();
  mirror2.position.x = 0.95; g.add(mirror2);

  // Optional spoiler for faster / sports models
  const sports = model.name && (model.name.includes('GT') || model.name.includes('S') || model.name.includes('COUPE') || model.top > 44);
  if (sports) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.35), bodyMat);
    spoiler.position.set(0, 1.15, -1.85);
    spoiler.rotation.x = -0.15; g.add(spoiler);
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), darkMat);
    support.position.set(-0.4, 1.05, -1.75); g.add(support);
    const support2 = support.clone(); support2.position.x = 0.4; g.add(support2);
  }

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
    if (tl && tl.children) {
      const color = this.braking ? 0xff2a2a : 0x991111;
      for (const child of tl.children) if (child.material) child.material.color.setHex(color);
    }
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
