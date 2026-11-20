// Combat: on-foot weapons, shooting with a raycaster, muzzle flash, tracer
// lines, and the rival-gang enemies missions spawn.
import { WEAPONS } from './config.js';
import { makeRng } from './random.js';
import { makeHumanoid } from './humanoid.js';

export function makeEnemyMesh(rng) {
  // Neon gang: dark red shirts, random skin, gun in the right hand, cartoon
  // outline — the silhouette reads as a hostile at a glance
  const h = makeHumanoid({
    skin: rng.pick([0xe8b88a, 0xc98d64, 0xf2c89a]),
    shirt: rng.pick([0x8a1a2a, 0x6a1a2a, 0x7a2a1a]), pants: 0x1a1a22,
    hairStyle: 'none', gun: true, outline: true, fadeable: true,
  });
  const g = h.group;
  // health bar above the head
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.85 }));
  barBg.position.y = 2.35; barBg.name = 'barBg'; g.add(barBg);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.1), new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
  bar.position.set(0, 2.35, 0.01); bar.name = 'bar'; g.add(bar);
  g.userData.humanoid = h;
  return g;
}

export class Combat {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.rng = makeRng(99);
    this.weaponIndex = 1; // pistol
    this.ammo = WEAPONS.map(w => w.ammo);
    this.lastShot = 0;
    this.enemies = [];
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffd27a, 0, 18);
    scene.add(this.flash);
    this.crosshairHit = false;
    this.holdFlash = false; // staged ?shot= frame only: keep the last shot
    // lit for the still; live play never sets this
  }
  weapon() { return WEAPONS[this.weaponIndex]; }
  select(i) {
    if (i >= 0 && i < WEAPONS.length && !WEAPONS[i].locked) this.weaponIndex = i;
  }
  buy(i, money) {
    const w = WEAPONS[i];
    if (!w.locked || money < w.price) return money;
    w.locked = false;
    return money - w.price;
  }
  spawnEnemies(center, count) {
    for (let i = 0; i < count; i++) {
      const mesh = makeEnemyMesh(this.rng);
      const x = center[0] + this.rng.range(-14, 14);
      const z = center[1] + this.rng.range(-14, 14);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.enemies.push({ mesh, hp: 100, x, z, shootTimer: this.rng.range(1, 3), dead: false, walkPhase: this.rng.range(0, Math.PI * 2) });
    }
    return this.enemies.filter(e => !e.dead).length;
  }
  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }
  shoot(now, playerPos, playerHeading, onHit) {
    const w = this.weapon();
    if (now - this.lastShot < w.rate) return false;
    if (this.ammo[this.weaponIndex] <= 0 && w.ammo !== Infinity) return false;
    this.lastShot = now;
    if (w.ammo !== Infinity) this.ammo[this.weaponIndex]--;
    // shoot from the player's chest toward the point the camera looks at:
    // a ray from the high chase camera itself dives into the ground and
    // passes over enemies' heads at combat range, so it can never hit
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const origin = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
    const aim = origin.clone().add(fwd.clone().multiplyScalar(30));
    aim.y = playerPos.y + 1.5;
    this.raycaster.set(origin, aim.clone().sub(origin).normalize());
    this.raycaster.far = w.range + 10;
    const targets = this.enemies.filter(e => !e.dead).map(e => e.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    // muzzle flash + tracer (from the player's chest, where the shot starts)
    this.flash.position.copy(origin).add(new THREE.Vector3(0, 0.2, 0));
    this.flash.intensity = 3;
    const end = hits.length ? hits[0].point : this.raycaster.ray.at(w.range, new THREE.Vector3());
    const start = origin.clone();
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.08 });
    if (hits.length) {
      const hitEnemy = this.enemies.find(e => !e.dead && hits[0].object && this.meshContains(e.mesh, hits[0].object));
      if (hitEnemy) {
        hitEnemy.hp -= w.damage;
        const bar = hitEnemy.mesh.getObjectByName('bar');
        if (bar) bar.scale.x = Math.max(0, hitEnemy.hp / 100);
        if (hitEnemy.hp <= 0) {
          hitEnemy.dead = true;
          // shot down: the body tips over and fades out (humanoid fall)
          hitEnemy.mesh.userData.humanoid.fall();
          onHit(hitEnemy);
        }
      }
    }
    return true;
  }
  meshContains(mesh, obj) {
    let o = obj;
    while (o) { if (o === mesh) return true; o = o.parent; }
    return false;
  }
  update(dt, playerPos, onPlayerHit) {
    if (this.holdFlash) {
      // staged frame: the flash stays at full brightness and the tracer
      // never expires, so the still shows the shot in flight
      this.flash.intensity = 3;
      for (const t of this.tracers) t.ttl = 0.08;
    } else {
      this.flash.intensity = Math.max(0, this.flash.intensity - dt * 30);
      for (const t of this.tracers) t.ttl -= dt;
    }
    this.tracers = this.tracers.filter(t => {
      if (t.ttl <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); return false; }
      return true;
    });
    // enemies shuffle toward the player and shoot back
    for (const e of this.enemies) {
      const hum = e.mesh.userData.humanoid;
      if (e.dead) {
        // keep advancing the fall (tip over + fade out)
        if (hum) hum.animate(dt, {});
        continue;
      }
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 6) {
        e.x += (dx / d) * 3.2 * dt;
        e.z += (dz / d) * 3.2 * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      // jointed walk toward the player, gun arm raised while shooting
      e.walkPhase += dt * 5;
      if (hum) hum.animate(dt, { phase: e.walkPhase, moving: d > 6, aiming: d < 42, idleTime: 0 });
      const barBg = e.mesh.getObjectByName('barBg');
      const bar = e.mesh.getObjectByName('bar');
      if (barBg) barBg.lookAt(this.camera.position);
      if (bar) bar.lookAt(this.camera.position);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 42) {
        e.shootTimer = this.rng.range(1.4, 2.6);
        if (this.rng.chance(0.45)) onPlayerHit(this.rng.int(4, 9));
      }
    }
  }
  aliveCount() { return this.enemies.filter(e => !e.dead).length; }
}
