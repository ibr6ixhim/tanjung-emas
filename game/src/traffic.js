// Pedestrians: low-poly walkers on the sidewalks. They stroll, wait at corners,
// and scatter when the player drives or shoots near them.
import { makeRng } from './random.js';
import { makeHumanoid } from './humanoid.js';

const SHIRT_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf];
const SKIN_COLORS = [0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf2c89a];
const HAIR_COLORS = [0x1a1a22, 0x3a2a1a, 0x6a4a2a, 0x8a8a8a];
// random accessories: hat, bag (backpack), hijab, umbrella, or nothing
const ACCESSORIES = ['hat', 'bag', 'hijab', 'umbrella', 'none', 'none', 'none'];

export function makePedMesh(rng) {
  const acc = rng.pick(ACCESSORIES);
  const h = makeHumanoid({
    skin: rng.pick(SKIN_COLORS),
    shirt: rng.pick(SHIRT_COLORS),
    pants: rng.pick([0x2a2a3a, 0x3a2a1a, 0x1a2a3a]),
    hair: rng.pick(HAIR_COLORS),
    hairStyle: acc === 'hijab' ? 'hijab' : (acc === 'hat' ? 'hat' : rng.pick(['none', 'spiky', 'ponytail'])),
    backpack: acc === 'bag',
    height: rng.range(0.9, 1.1),
  });
  if (acc === 'umbrella') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
    stick.position.set(0.42, 1.9, 0.1); stick.castShadow = true; h.group.add(stick);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.28, 8), new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) }));
    canopy.position.set(0.42, 2.5, 0.1); canopy.castShadow = true; h.group.add(canopy);
  }
  h.group.userData.walkPhase = rng.range(0, Math.PI * 2);
  h.group.userData.humanoid = h;
  return h.group;
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
      // jointed walk: legs swing opposite, arms swing, faster when panicking
      p.mesh.userData.walkPhase += dt * p.speed * 4;
      const hum = p.mesh.userData.humanoid;
      if (hum) hum.animate(dt, { phase: p.mesh.userData.walkPhase, moving: true, running: p.panic > 0, idleTime: 0 });
    }
  }
}
