// Pedestrians: low-poly walkers on the sidewalks. They stroll, wait at corners,
// and scatter when the player drives or shoots near them.
import { makeRng } from './random.js';

const SHIRT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf];
const SKIN_COLORS = [0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf2c89a];

export function makePedMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN_COLORS) });
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
  legs.position.y = 0.4; legs.name = 'legs'; g.add(legs);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), shirt);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.75; g.add(head);
  g.userData.walkPhase = rng.range(0, Math.PI * 2);
  return g;
}

export class Pedestrians {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.peds = [];
    const group = new THREE.Group(); group.name = 'pedestrians'; scene.add(group);
    for (let i = 0; i < 40; i++) {
      const mesh = makePedMesh(this.rng);
      group.add(mesh);
      const x = this.rng.range(-480, 520);
      const z = this.rng.range(-480, 520);
      this.peds.push({
        mesh, x, z,
        dir: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.4),
        panic: 0,
      });
    }
  }
  update(dt, playerPos, playerSpeed, gunfire) {
    for (const p of this.peds) {
      const dx = p.x - playerPos.x, dz = p.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 900 || (gunfire && d2 < 6400)) p.panic = 2.5;
      if (p.panic > 0) {
        p.panic -= dt;
        const d = Math.sqrt(d2) || 1;
        p.dir = Math.atan2(dx / d, dz / d);
        p.speed = 5.5;
      } else {
        p.speed = 1.8;
        // wander: small random heading changes at intersections
        if (this.rng.chance(dt * 0.15)) p.dir += this.rng.range(-1.2, 1.2);
      }
      p.x += Math.sin(p.dir) * p.speed * dt;
      p.z += Math.cos(p.dir) * p.speed * dt;
      if (p.x > 540) p.x = 540; if (p.x < -300) p.x = -300;
      if (p.z > 540) p.z = 540; if (p.z < -540) p.z = -540;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.dir;
      // walk bob
      p.mesh.userData.walkPhase += dt * p.speed * 4;
      p.mesh.children[0].position.y = 0.4 + Math.abs(Math.sin(p.mesh.userData.walkPhase)) * 0.12;
    }
  }
}
