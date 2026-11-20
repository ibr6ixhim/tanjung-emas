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
  // one warm palette for sky, fog and light: violet top, orange middle,
  // yellow low — the whole scene reads as one golden hour
  const skyGeo = new THREE.SphereGeometry(1500, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2b1b5a) }, mid: { value: new THREE.Color(0xff7a59) }, low: { value: new THREE.Color(0xffc27a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  group.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sunDisc.position.set(-900, 180, 500); sunDisc.lookAt(0, 100, 0);
  sunDisc.name = 'sunDisc';
  group.add(sunDisc);

  // --- lights: warm sunset sun + purple ambient + cool eastern fill ---
  // three r149 (pre-r155): light intensity works in legacy units, so the
  // numbers below are tuned for this revision — see the ACES setup in main.js
  const sunLight = new THREE.DirectionalLight(0xffa860, 1.6);
  sunLight.position.set(-500, 320, 300);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60; sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60; sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 400;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);
  const fillLight = new THREE.DirectionalLight(0x8a7aff, 0.45);
  fillLight.position.set(500, 220, -200);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0x6a4a8a, 0.6));
  const hemi = new THREE.HemisphereLight(0xffb98a, 0x3a2a5a, 0.7);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xff9b6b, 80, 420);

  // --- ground: grass base, sand strip, sea plane ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size * 2.4, CITY.size * 2.4), new THREE.MeshLambertMaterial({ color: PALETTE.grass }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(100, -0.2, 0);
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, CITY.size * 1.4), new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(CITY.beachX - 15, 0, 0);
  sand.receiveShadow = true;
  group.add(sand);
  // bay water: low-roughness standard material so the low sun glints on it;
  // segmented so the waves below can move its vertices
  const seaGeo = new THREE.PlaneGeometry(900, CITY.size * 1.6, 24, 48);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.15, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(CITY.seaX - 480, -0.5, 0);
  sea.name = 'sea';
  sea.userData.base = seaGeo.attributes.position.array.slice();
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
  // centre dashes are collected for one instanced draw call below
  const dashA = []; // 8x1 dashes along x-roads
  const dashB = []; // 1x8 dashes along z-roads
  for (const v of grid) {
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size + 100, CITY.road), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(0, 0.05, v); rz.receiveShadow = true; group.add(rz);
    roads.push({ x: 0, z: v, axis: 'x', len: CITY.size + 100 });
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, CITY.size + 100), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(v, 0.05, 0); rx.receiveShadow = true; group.add(rx);
    roads.push({ x: v, z: 0, axis: 'z', len: CITY.size + 100 });
    // centre dashes
    for (let d = -480; d <= 480; d += 40) {
      dashA.push({ x: d, z: v + 0.2 });
      dashB.push({ x: v + 0.2, z: d });
    }
  }
  const dummy = new THREE.Object3D();
  const dashMeshA = new THREE.InstancedMesh(new THREE.PlaneGeometry(8, 1), lineMat, dashA.length);
  const dashMeshB = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 8), lineMat, dashB.length);
  dashA.forEach((p, i) => {
    dummy.position.set(p.x, 0.08, p.z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    dashMeshA.setMatrixAt(i, dummy.matrix);
  });
  dashB.forEach((p, i) => {
    dummy.position.set(p.x, 0.08, p.z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix();
    dashMeshB.setMatrixAt(i, dummy.matrix);
  });
  group.add(dashMeshA, dashMeshB);
  // beach boulevard (the sunset strip)
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(20, CITY.size), roadMat);
  blvd.rotation.x = -Math.PI / 2; blvd.position.set(CITY.beachX + 18, 0.05, 0);
  blvd.receiveShadow = true;
  group.add(blvd);
  roads.push({ x: CITY.beachX + 18, z: 0, axis: 'z', len: CITY.size });

  // --- buildings: one or two per block, skipped on roads and near the beach ---
  // one instanced draw call for all buildings (shared unit box, per-instance
  // scale + colour) and one for the roof caps — the same seeded layout as
  // before, so colliders and mission targets do not move
  const winTex = windowTexture(rng);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingData = [];
  for (let bx = -450; bx <= 450; bx += CITY.block) {
    for (let bz = -450; bz <= 450; bz += CITY.block) {
      if (bx < -250) continue; // beach side stays open
      if (rng.chance(0.04)) continue; // plaza / parking gap
      const w = rng.range(34, 52), d = rng.range(34, 52);
      const h = bz > 100 && bx > 100 ? rng.range(45, 110) : rng.range(14, 48); // downtown towers
      const color = rng.pick(BUILDING_COLORS);
      const px = bx + rng.range(-8, 8), pz = bz + rng.range(-8, 8);
      buildingData.push({ x: px, y: h / 2, z: pz, w, h, d, color });
      colliders.push({ minX: px - w / 2, maxX: px + w / 2, minZ: pz - d / 2, maxZ: pz + d / 2 });
    }
  }
  const buildingMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ map: winTex }), buildingData.length);
  buildingMesh.castShadow = true; buildingMesh.receiveShadow = true;
  const roofMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: PALETTE.roof }), buildingData.length);
  roofMesh.castShadow = true;
  buildingData.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z); dummy.scale.set(b.w, b.h, b.d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    buildingMesh.setMatrixAt(i, dummy.matrix);
    buildingMesh.setColorAt(i, new THREE.Color(b.color));
    dummy.position.set(b.x, b.h + 0.7, b.z); dummy.scale.set(b.w + 1, 1.5, b.d + 1); dummy.updateMatrix();
    roofMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(buildingMesh, roofMesh);

  // --- palms along the boulevard and the beach (instanced trunks + fronds) ---
  // A crown used to be one 5-sided cone; from some angles it read as a flat
  // teal triangle floating over the street. Now each crown is six thin
  // fronds drooping out and down (~129° from straight up) plus a small
  // heart cone, so a palm reads as a palm from every angle. The palm
  // positions are unchanged (same seeded layout).
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e5f });
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 9, 6);
  const frondGeo = new THREE.ConeGeometry(0.85, 6, 4);
  const heartGeo = new THREE.ConeGeometry(1.1, 2.2, 6);
  const palmData = [];
  for (let z = -480; z <= 480; z += 40) {
    // Palms flank the boulevard (x=-282, spans -292..-272). The old west
    // column (beachX+2 = -298) stood INSIDE the north-south street at
    // x=-300 (spans -308..-292), and any palm whose z fell within an
    // east-west street corridor (streets every 100 m, 16 m wide) stood in
    // the middle of that street — one was visible in the chase shot.
    // West column moves onto the sand (x=-312: clear of the x=-300 street,
    // east of the shoreline at -340); east column stays at -266. Palms
    // whose z lands in a cross-street corridor shift +20 m along the
    // boulevard, clear of the 16 m road (corridors are 100 m apart, so
    // +20 can never land in another one).
    for (const x of [CITY.beachX - 12, CITY.beachX + 34]) {
      const px = x + rng.range(-2, 2);
      let pz = z + rng.range(-4, 4);
      const nearestStreet = Math.round(pz / CITY.block) * CITY.block;
      if (Math.abs(pz - nearestStreet) < 10) pz += 20;
      palmData.push({ x: px, z: pz });
    }
  }
  const FRONDS = 6;
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmData.length);
  const frondMesh = new THREE.InstancedMesh(frondGeo, leafMat, palmData.length * FRONDS);
  const heartMesh = new THREE.InstancedMesh(heartGeo, leafMat, palmData.length);
  trunkMesh.castShadow = true; frondMesh.castShadow = true; heartMesh.castShadow = true;
  const up = new THREE.Vector3(0, 1, 0);
  const tilt = 129 * Math.PI / 180; // fronds droop 39° below horizontal
  palmData.forEach((p, i) => {
    dummy.position.set(p.x, 4.5, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 9.8, p.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    heartMesh.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < FRONDS; j++) {
      const a = (j / FRONDS) * Math.PI * 2 + i * 0.7;
      const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
      dummy.position.set(p.x + dir.x * 2.0, 9.3 + dir.y * 2.0, p.z + dir.z * 2.0);
      dummy.quaternion.setFromUnitVectors(up, dir);
      dummy.updateMatrix();
      frondMesh.setMatrixAt(i * FRONDS + j, dummy.matrix);
    }
  });
  group.add(trunkMesh, frondMesh, heartMesh);

  // --- street lamps with warm glow (instanced poles + bulbs) ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  const lampData = [];
  for (const v of grid) {
    for (const d of [-400, -200, 0, 200, 400]) {
      lampData.push({ x: d + 10, z: v + 10 });
    }
  }
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 5), poleMat, lampData.length);
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat, lampData.length);
  lampData.forEach((l, i) => {
    dummy.position.set(l.x, 3.5, l.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(l.x, 7.2, l.z); dummy.updateMatrix();
    bulbMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(poleMesh, bulbMesh);

  // --- marina: wooden pier + docks on the water side ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 1.5, 14), pierMat);
  pier.position.set(-330, 0.6, -260); pier.castShadow = true; pier.receiveShadow = true; group.add(pier);
  colliders.push({ minX: -390, maxX: -270, minZ: -267, maxZ: -253 });
  const pier2 = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 90), pierMat);
  pier2.position.set(-380, 0.6, -300); pier2.castShadow = true; group.add(pier2);

  // --- causeway bridge over the bay (north) ---
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(160, 2, 18), new THREE.MeshLambertMaterial({ color: 0x9a8f80 }));
  bridge.position.set(-380, 2.5, 420); bridge.castShadow = true; group.add(bridge);

  // --- landmark: lighthouse on the north point ---
  const lhMat = new THREE.MeshLambertMaterial({ color: 0xf2ead8 });
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 34, 10), lhMat);
  lh.position.set(-320, 17, 60); lh.castShadow = true; group.add(lh);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 10), new THREE.MeshLambertMaterial({ color: 0xd83a3a }));
  lhTop.position.set(-320, 36, 60); lhTop.castShadow = true; group.add(lhTop);
  const lhLight = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lhLight.position.set(-320, 39, 60); lhLight.name = 'lighthouseLight'; group.add(lhLight);
  colliders.push({ minX: -327, maxX: -313, minZ: 53, maxZ: 67 });

  // --- district labels as floating sign boards (readable from the air) ---
  // kept small and high: at street level they stay out of the camera's
  // frame instead of filling the top of the screen over the weapon bar
  for (const dist of DISTRICTS) {
    const sign = makeTextSprite(dist.name.toUpperCase(), dist.color);
    sign.position.set(dist.center[0], 58, dist.center[1]);
    sign.name = 'districtSign';
    group.add(sign);
  }

  // --- garage + safehouse props ---
  const garage = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 20), new THREE.MeshLambertMaterial({ color: 0x4a6b8a }));
  garage.position.set(400, 5, 20); garage.castShadow = true; garage.receiveShadow = true; group.add(garage);
  colliders.push({ minX: 385, maxX: 415, minZ: 10, maxZ: 30 });
  const safehouse = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), new THREE.MeshLambertMaterial({ color: 0xd98a5f }));
  safehouse.position.set(-240, 4, 280); safehouse.castShadow = true; safehouse.receiveShadow = true; group.add(safehouse);
  colliders.push({ minX: -249, maxX: -231, minZ: 273, maxZ: 287 });

  scene.add(group);
  return { colliders, roads, group, sunLight, sky, sunDisc, sea };
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
  spr.scale.set(48, 9, 1);
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
  const names = ['Liberty Street', 'Sunset Street', 'Harbor Street', 'Golden Street', 'Wave Street', 'Neon Street', 'Marina Street', 'Hill Street'];
  const pick = names[Math.abs(gx / 100 + gz / 100) % names.length];
  return Math.abs(x - gx) < Math.abs(z - gz) ? pick + ' North' : pick + ' East';
}
