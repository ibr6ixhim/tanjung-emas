// Boats: low-poly hulls at the marina, player boat driving on the bay, and the
// water-police boat that chases the player when wanted on the water.
import { BOAT_MODELS } from './config.js';
import { makeRng } from './random.js';

export function makeBoatMesh(model) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 6.5), new THREE.MeshLambertMaterial({ color: model.color }));
  hull.position.y = 0.4; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 4.5), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
  deck.position.y = 1.0; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: 0x1a2530 }));
  cabin.position.set(0, 1.6, -0.6); g.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
  mast.position.set(0, 2.6, 0.8); g.add(mast);
  g.userData.model = model;
  return g;
}

export class BoatFleet {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.docked = [];
    const spots = [[-330, -300], [-330, -330], [-360, -290], [-300, -340]];
    for (let i = 0; i < spots.length; i++) {
      const model = BOAT_MODELS[i % BOAT_MODELS.length];
      const mesh = makeBoatMesh(model);
      mesh.position.set(spots[i][0], 0.2, spots[i][1]);
      mesh.rotation.y = this.rng.range(-0.4, 0.4);
      scene.add(mesh);
      this.docked.push({ mesh, model, x: spots[i][0], z: spots[i][1], taken: false });
    }
    // the player's boat (hidden until boarded)
    this.playerBoat = { mesh: makeBoatMesh(BOAT_MODELS[1]), speed: 0, heading: 0, active: false };
    this.playerBoat.mesh.visible = false;
    scene.add(this.playerBoat.mesh);
    // water police boat
    this.policeBoat = { mesh: makeBoatMesh({ name: 'PATROLI LAUT', color: 0x2a4a8a, top: 34 }), speed: 0, heading: 0, active: false };
    this.policeBoat.mesh.visible = false;
    scene.add(this.policeBoat.mesh);
  }
  nearestDocked(pos, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const b of this.docked) {
      if (b.taken) continue;
      const dx = b.x - pos.x, dz = b.z - pos.z, d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = b; }
    }
    return best;
  }
  board(boat) {
    boat.taken = true; boat.mesh.visible = false;
    const pb = this.playerBoat;
    pb.active = true; pb.mesh.visible = true;
    pb.mesh.position.set(boat.x, 0.2, boat.z);
    pb.speed = 0; pb.heading = boat.mesh.rotation.y;
    return pb;
  }
  leave() {
    this.playerBoat.active = false;
    this.playerBoat.mesh.visible = false;
  }
  updatePlayer(dt, input) {
    const pb = this.playerBoat;
    if (!pb.active) return null;
    const top = 38;
    if (input.forward) pb.speed += 14 * dt;
    else if (input.back) pb.speed -= 10 * dt;
    else pb.speed *= Math.max(0, 1 - 1.2 * dt);
    pb.speed = Math.max(-8, Math.min(top, pb.speed));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    pb.heading += steer * 1.4 * dt * Math.sign(pb.speed || 1);
    const p = pb.mesh.position;
    p.x = Math.max(-780, Math.min(-320, p.x + Math.sin(pb.heading) * pb.speed * dt));
    p.z = Math.max(-560, Math.min(560, p.z + Math.cos(pb.heading) * pb.speed * dt));
    // bob on the swell
    p.y = 0.2 + Math.sin(performance.now() / 500 + p.x * 0.05) * 0.25;
    pb.mesh.rotation.y = pb.heading;
    pb.mesh.rotation.z = -steer * 0.06;
    return { x: p.x, z: p.z, speed: pb.speed, name: pb.mesh.userData.model.name };
  }
  updatePolice(dt, targetPos, wanted) {
    const pb = this.policeBoat;
    if (wanted >= 2 && targetPos.x < -300) {
      if (!pb.active) {
        pb.active = true; pb.mesh.visible = true;
        pb.mesh.position.set(targetPos.x - 60, 0.2, targetPos.z + 40);
      }
      const p = pb.mesh.position;
      const dx = targetPos.x - p.x, dz = targetPos.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      pb.heading = Math.atan2(dx, dz);
      pb.speed = Math.min(30, pb.speed + 10 * dt);
      p.x += Math.sin(pb.heading) * pb.speed * dt;
      p.z += Math.cos(pb.heading) * pb.speed * dt;
      pb.mesh.rotation.y = pb.heading;
      return { x: p.x, z: p.z, dist: d };
    }
    if (pb.active) { pb.active = false; pb.mesh.visible = false; pb.speed = 0; }
    return null;
  }
}
