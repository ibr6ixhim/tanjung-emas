// Weather: sunset default, storm mode for mission 7 (rain streaks, lightning
// flashes, thick fog, night lighting), and a calm dusk variant.
export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.storm = false;
    this.lightningTimer = 0;
    this.flashLight = new THREE.DirectionalLight(0xdde8ff, 0);
    this.flashLight.position.set(200, 400, -100);
    scene.add(this.flashLight);
    // rain: one Points cloud recycled above the player
    const count = 1600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaac8e8, size: 0.35, transparent: true, opacity: 0.7 }));
    this.rain.visible = false;
    this.rain.name = 'rain';
    scene.add(this.rain);
    this.rainVel = 55;
  }
  setStorm(on) {
    this.storm = on;
    this.rain.visible = on;
    this.scene.fog = new THREE.Fog(on ? 0x1a2233 : 0xd97a5a, on ? 60 : 500, on ? 420 : 1400);
    // dim the sun light in a storm, and darken the sky dome itself
    this.scene.traverse((o) => {
      if (o.userData.origIntensity === undefined && (o.isDirectionalLight || o.isAmbientLight)) o.userData.origIntensity = o.intensity;
      if (o.isDirectionalLight && o !== this.flashLight) o.intensity = on ? o.userData.origIntensity * 0.3 : o.userData.origIntensity;
      if (o.isAmbientLight) o.intensity = on ? o.userData.origIntensity * 0.4 : o.userData.origIntensity;
      if (o.material && o.material.uniforms && o.material.uniforms.top) {
        if (!this._skyOrig) this._skyOrig = { top: o.material.uniforms.top.value.getHex(), mid: o.material.uniforms.mid.value.getHex(), low: o.material.uniforms.low.value.getHex() };
        const src = on ? { top: 0x0a0a1e, mid: 0x2a2a4e, low: 0x3a3a58 } : this._skyOrig;
        o.material.uniforms.top.value.setHex(src.top);
        o.material.uniforms.mid.value.setHex(src.mid);
        o.material.uniforms.low.value.setHex(src.low);
      }
    });
  }
  update(dt, playerPos) {
    if (!this.storm) return;
    // rain follows the player and falls
    this.rain.position.set(playerPos.x, 0, playerPos.z);
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - this.rainVel * dt;
      if (y < 0) y = 60;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    // lightning: random flash every 4–9 seconds
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 4 + Math.random() * 5;
      this.flashLight.intensity = 3.2;
      setTimeout(() => { this.flashLight.intensity = 0; }, 140);
      setTimeout(() => { this.flashLight.intensity = 2.0; }, 260);
      setTimeout(() => { this.flashLight.intensity = 0; }, 420);
    }
  }
}
