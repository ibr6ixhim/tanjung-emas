// Tanjung Emas — the city itself. Builds the whole low-poly island from a seeded
// random generator: streets, building blocks, palms, beach, sea, sky and lamps.
// Also exports the collision boxes and the road network the traffic uses.
import { CITY, DISTRICTS } from './config.js';
import { makeRng } from './random.js';

const PALETTE = {
  road: 0x2e2a33, sidewalk: 0x8a7f72, sand: 0xe8c98a, sea: 0x1f6f8b,
  grass: 0x4a7c4f, roof: 0x3a3340, lamp: 0xffd9a0,
};
const BUILDING_COLORS = [0xd98a5f, 0xe8b04b, 0x7fb2d9, 0xc96f7a, 0x9a86c8, 0x6fb98a, 0xe0d6c0, 0x5a7d9a];

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2530'; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 56; x += 16) {
      const lit = rng.chance(0.45);
      g.fillStyle = lit ? (rng.chance(0.5) ? '#ffd27a' : '#9ad8ff') : '#1a1620';
      g.fillRect(x, y, 10, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene, seed) {
  const rng = makeRng(seed);
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const roads = [];       // {x,z,axis:'x'|'z',len}
  const group = new THREE.Group();
  group.name = 'city';

  // --- sunset sky: big gradient dome + low sun disc ---
  const skyGeo = new THREE.SphereGeometry(1500, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2a1a4a) }, mid: { value: new THREE.Color(0xff7a4d) }, low: { value: new THREE.Color(0xffc46b) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sun.position.set(-900, 180, 500); sun.lookAt(0, 100, 0);
  group.add(sun);

  // --- lights: warm sunset sun + purple ambient + cool eastern fill ---
  const sunLight = new THREE.DirectionalLight(0xffb070, 1.6);
  sunLight.position.set(-500, 320, 300);
  scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0x8a7aff, 0.45);
  fillLight.position.set(500, 220, -200);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0x6a4a8a, 1.0));
  const hemi = new THREE.HemisphereLight(0xff9a6b, 0x2a1a3a, 0.5);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xd97a5a, 500, 1400);

  // --- ground: grass base, sand strip, sea plane ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size * 2.4, CITY.size * 2.4), new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(100, -0.2, 0);
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, CITY.size * 1.4), new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(CITY.beachX - 15, 0, 0);
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, CITY.size * 1.6), new THREE.MeshLambertMaterial({ color: PALETTE.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(CITY.seaX - 480, -0.5, 0);
  group.add(sea);
  // gentle animated swell lines on the sea
  const swellMat = new THREE.MeshBasicMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 10; i++) {
    const swell = new THREE.Mesh(new THREE.PlaneGeometry(700, 2), swellMat);
    swell.rotation.x = -Math.PI / 2;
    swell.position.set(CITY.seaX - 420, 0.1, -600 + i * 130);
    swell.name = 'swell';
    group.add(swell);
  }

  // --- road grid: streets every 100m from -500 to 500 ---
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  const grid = [];
  for (let v = -500; v <= 500; v += CITY.block) grid.push(v);
  for (const v of grid) {
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size + 100, CITY.road), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(0, 0.05, v); group.add(rz);
    roads.push({ x: 0, z: v, axis: 'x', len: CITY.size + 100 });
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, CITY.size + 100), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(v, 0.05, 0); group.add(rx);
    roads.push({ x: v, z: 0, axis: 'z', len: CITY.size + 100 });
    // centre dashes
    for (let d = -480; d <= 480; d += 40) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.08, v + 0.2); group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 8), lineMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(v + 0.2, 0.08, d); group.add(dash2);
    }
  }
  // beach boulevard (the sunset strip)
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(20, CITY.size), roadMat);
  blvd.rotation.x = -Math.PI / 2; blvd.position.set(CITY.beachX + 18, 0.05, 0);
  group.add(blvd);
  roads.push({ x: CITY.beachX + 18, z: 0, axis: 'z', len: CITY.size });

  // --- buildings: one or two per block, skipped on roads and near the beach ---
  const winTex = windowTexture(rng);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -450; bx <= 450; bx += CITY.block) {
    for (let bz = -450; bz <= 450; bz += CITY.block) {
      if (bx < -250) continue; // beach side stays open
      if (rng.chance(0.12)) continue; // plaza / parking gap
      const w = rng.range(34, 52), d = rng.range(34, 52);
      const h = bz > 100 && bx > 100 ? rng.range(45, 110) : rng.range(14, 48); // downtown towers
      const color = rng.pick(BUILDING_COLORS);
      const mat = new THREE.MeshLambertMaterial({ color, map: winTex });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(bx + rng.range(-8, 8), h / 2, bz + rng.range(-8, 8));
      group.add(b);
      // flat roof cap
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: PALETTE.roof }));
      roof.scale.set(w + 1, 1.5, d + 1); roof.position.set(b.position.x, h + 0.7, b.position.z);
      group.add(roof);
      colliders.push({ minX: b.position.x - w / 2, maxX: b.position.x + w / 2, minZ: b.position.z - d / 2, maxZ: b.position.z + d / 2 });
    }
  }

  // --- palms along the boulevard and the beach ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 5, 5);
  for (let z = -480; z <= 480; z += 40) {
    for (const x of [CITY.beachX + 2, CITY.beachX + 34]) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x + rng.range(-2, 2), 4.5, z + rng.range(-4, 4));
      group.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(trunk.position.x, 10.5, trunk.position.z);
      group.add(leaves);
    }
  }

  // --- street lamps with warm glow ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  for (const v of grid) {
    for (const d of [-400, -200, 0, 200, 400]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 5), poleMat);
      pole.position.set(d + 10, 3.5, v + 10); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat);
      bulb.position.set(d + 10, 7.2, v + 10); group.add(bulb);
    }
  }

  // --- marina: wooden pier + docks on the water side ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 1.5, 14), pierMat);
  pier.position.set(-330, 0.6, -260); group.add(pier);
  colliders.push({ minX: -390, maxX: -270, minZ: -267, maxZ: -253 });
  const pier2 = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 90), pierMat);
  pier2.position.set(-380, 0.6, -300); group.add(pier2);

  // --- causeway bridge over the bay (north) ---
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(160, 2, 18), new THREE.MeshLambertMaterial({ color: 0x9a8f80 }));
  bridge.position.set(-380, 2.5, 420); group.add(bridge);

  // --- landmark: lighthouse on the north point ---
  const lhMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 34, 10), lhMat);
  lh.position.set(-320, 17, 60); group.add(lh);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 10), new THREE.MeshLambertMaterial({ color: 0xd83a3a }));
  lhTop.position.set(-320, 36, 60); group.add(lhTop);
  const lhLight = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lhLight.position.set(-320, 39, 60); lhLight.name = 'lighthouseLight'; group.add(lhLight);
  colliders.push({ minX: -327, maxX: -313, minZ: 53, maxZ: 67 });

  // --- district labels as floating sign boards (readable from the air) ---
  for (const dist of DISTRICTS) {
    const sign = makeTextSprite(dist.name.toUpperCase(), dist.color);
    sign.position.set(dist.center[0], 42, dist.center[1]);
    sign.name = 'districtSign';
    group.add(sign);
  }

  // --- garage + safehouse props ---
  const garage = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 20), new THREE.MeshLambertMaterial({ color: 0x4a6b8a }));
  garage.position.set(400, 5, 20); group.add(garage);
  colliders.push({ minX: 385, maxX: 415, minZ: 10, maxZ: 30 });
  const safehouse = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), new THREE.MeshLambertMaterial({ color: 0xd98a5f }));
  safehouse.position.set(-240, 4, 280); group.add(safehouse);
  colliders.push({ minX: -249, maxX: -231, minZ: 273, maxZ: 287 });

  scene.add(group);
  return { colliders, roads, group };
}

function makeTextSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,8,18,0.65)'; g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#' + color.toString(16).padStart(6, '0');
  g.font = 'bold 44px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(90, 17, 1);
  return spr;
}

// Circle (player/car/boat) vs building AABB push-out. Returns corrected position.
export function collideCircle(pos, radius, colliders) {
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = b.maxX + radius;
      }
    }
  }
  return pos;
}

export function districtAt(x, z) {
  let best = DISTRICTS[0], bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.center[0], dz = z - d.center[1];
    const dd = dx * dx + dz * dz;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function streetName(x, z) {
  const gx = Math.round(x / 100) * 100, gz = Math.round(z / 100) * 100;
  const names = ['Jalan Merdeka', 'Jalan Senja', 'Jalan Pelabuhan', 'Jalan Kencana', 'Jalan Ombak', 'Jalan Neon', 'Jalan Marina', 'Jalan Bukit'];
  const pick = names[Math.abs(gx / 100 + gz / 100) % names.length];
  return Math.abs(x - gx) < Math.abs(z - gz) ? pick + ' Utara' : pick + ' Timur';
}
