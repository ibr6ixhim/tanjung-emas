// Particles: one pooled THREE.Points cloud for tire smoke, nitro flames and
// collision sparks. Per-particle fade is done by darkening the vertex colour
// (additive blending makes black invisible), so there is a single draw call.
export class Particles {
  constructor(scene, max = 300) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); // seconds left
    this.ttl = new Float32Array(max);  // seconds total
    this.baseColor = new Float32Array(max * 3);
    this.cursor = 0;
    this.positions.fill(99999); // park unused points far away
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.9, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.ttl[i] = life;
    this.baseColor[i * 3] = r; this.baseColor[i * 3 + 1] = g; this.baseColor[i * 3 + 2] = b;
  }
  // grey-white smoke puff (drifting tyre smoke)
  smoke(x, y, z) {
    for (let k = 0; k < 3; k++) {
      this.spawn(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5,
        0.9 + Math.random() * 0.5, 0.55, 0.5, 0.45);
    }
  }
  // orange nitro flame at the exhaust
  flame(x, y, z, bx, bz) {
    for (let k = 0; k < 2; k++) {
      this.spawn(x, y, z, -bx * 6 + (Math.random() - 0.5) * 2, 0.5 + Math.random(), -bz * 6 + (Math.random() - 0.5) * 2,
        0.25 + Math.random() * 0.2, 1.0, 0.55 + Math.random() * 0.3, 0.15);
    }
  }
  // yellow-white sparks on impact
  sparks(x, y, z) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      this.spawn(x, y + 0.5, z, Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp,
        0.4 + Math.random() * 0.3, 1.0, 0.85, 0.4);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.positions[i * 3] = 99999; this.colors[i * 3] = 0; this.colors[i * 3 + 1] = 0; this.colors[i * 3 + 2] = 0; continue; }
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 2 * dt; // sparks fall, smoke keeps rising slowly
      const f = this.life[i] / this.ttl[i];
      this.colors[i * 3] = this.baseColor[i * 3] * f;
      this.colors[i * 3 + 1] = this.baseColor[i * 3 + 1] * f;
      this.colors[i * 3 + 2] = this.baseColor[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
