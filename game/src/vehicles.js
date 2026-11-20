// Vehicles: low-poly car factory, the player's drivable car, and the traffic
// system that keeps the streets alive.
import { CAR_MODELS } from './config.js';
import { makeRng } from './random.js';
import { collideCircle } from './world.js';

export function makeCarMesh(model, rng) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: model.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w);
  }
  // headlights + taillights so night driving reads on screen
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.6, 2.22); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  tl.position.set(0, 0.6, -2.22); g.add(tl);
  g.userData.model = model;
  return g;
}

export class PlayerCar {
  constructor(scene, model) {
    this.scene = scene;
    this.mesh = makeCarMesh(model, makeRng(1));
    this.mesh.name = 'playerCar';
    scene.add(this.mesh);
    this.speed = 0; this.heading = 0;
    this.topSpeed = model.top; this.accel = model.accel;
    this.condition = 100; this.nitro = false; this.hasNitro = false; this.tuned = false;
    this.pos = new THREE.Vector3(0, 0, 0);
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
    this.scene.add(this.mesh);
    this.topSpeed = model.top; this.accel = model.accel;
    this.sync();
  }
  sync() {
    this.mesh.position.copy(this.pos);
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
    this.pos.x = clamped.x; this.pos.z = clamped.z;
    collideCircle(this.pos, 2.2, colliders);
    // body lean into corners + wheel spin feel
    this.mesh.rotation.z = -steer * 0.05 * Math.min(1, Math.abs(this.speed) / 20);
    this.sync();
  }
}

export class Traffic {
  constructor(scene, seed, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.rng = makeRng(seed);
    this.cars = [];
    const group = new THREE.Group(); group.name = 'traffic'; scene.add(group);
    for (let i = 0; i < 26; i++) {
      const model = this.rng.pick(CAR_MODELS);
      const mesh = makeCarMesh(model, this.rng);
      group.add(mesh);
      const axis = this.rng.chance(0.5) ? 'x' : 'z';
      const lane = this.rng.int(-5, 5) * 100 + (this.rng.chance(0.5) ? 4 : -4);
      const along = this.rng.range(-500, 500);
      this.cars.push({
        mesh, axis, speed: this.rng.range(8, 15) * (this.rng.chance(0.5) ? 1 : -1),
        x: axis === 'x' ? along : lane, z: axis === 'x' ? lane : along,
      });
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
