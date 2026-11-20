// Shared low-poly humanoid: jointed limbs on pivot groups so walk, aim and
// fall animations can move them. Raka, the gang enemies and the pedestrians
// all use this builder — only the colours, accessories and height change.
// All parts cast shadows; hero characters get a cartoon outline (a second
// mesh with a black BackSide material, scaled 1.04) and fadeable materials
// so a fall can fade the body out.
function std(color, fadeable) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, transparent: !!fadeable });
}

function addOutline(mesh) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x0a0612, side: THREE.BackSide }));
  o.scale.setScalar(1.04);
  mesh.add(o);
}

export function makeHumanoid(o = {}) {
  const {
    skin = 0xe8b88a, shirt = 0xff7a3c, pants = 0x2a2a3a,
    hair = 0x1a1a22, hairStyle = 'none', // cap|ponytail|helmet|hat|hood|headphones|hijab|spiky|none
    jacketPanel = null, backpack = false, gloves = false,
    height = 1, outline = false, fadeable = false, gun = false,
  } = o;
  const g = new THREE.Group();
  const fadeMats = [];
  const part = (geo, color) => {
    const m = new THREE.Mesh(geo, std(color, fadeable));
    m.castShadow = true;
    if (outline) addOutline(m);
    if (fadeable) fadeMats.push(m.material);
    return m;
  };

  // legs: pivot groups at the hips so they can swing
  const legL = new THREE.Group(); legL.position.set(-0.14, 0.85, 0);
  const legLMesh = part(new THREE.BoxGeometry(0.22, 0.85, 0.3), pants); legLMesh.position.y = -0.42; legL.add(legLMesh);
  const legR = new THREE.Group(); legR.position.set(0.14, 0.85, 0);
  const legRMesh = part(new THREE.BoxGeometry(0.22, 0.85, 0.3), pants); legRMesh.position.y = -0.42; legR.add(legRMesh);
  g.add(legL, legR);

  // torso: pivot at the waist for the breathing bob and the run lean
  const torso = new THREE.Group(); torso.position.set(0, 0.85, 0);
  const torsoMesh = part(new THREE.BoxGeometry(0.65, 0.75, 0.38), shirt); torsoMesh.position.y = 0.38; torso.add(torsoMesh);
  if (jacketPanel) {
    const panel = part(new THREE.BoxGeometry(0.5, 0.5, 0.06), jacketPanel);
    panel.position.set(0, 0.4, 0.2); torso.add(panel);
  }
  if (backpack) {
    const pack = part(new THREE.BoxGeometry(0.5, 0.6, 0.16), 0x2a2a3a);
    pack.position.set(0, 0.4, -0.27); torso.add(pack);
  }
  g.add(torso);

  // head: pivot at the neck
  const head = new THREE.Group(); head.position.set(0, 1.62, 0);
  const headMesh = part(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin); headMesh.position.y = 0.22; head.add(headMesh);
  const hairMat = (c) => std(c, fadeable);
  const hairTop = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, hairMat(color)); m.castShadow = true; m.position.set(x, y, z);
    if (outline) addOutline(m);
    if (fadeable) fadeMats.push(m.material);
    head.add(m);
  };
  if (hairStyle === 'cap') {
    hairTop(new THREE.BoxGeometry(0.48, 0.14, 0.48), 0x1a1a22, 0, 0.46, 0);
    hairTop(new THREE.BoxGeometry(0.44, 0.06, 0.2), 0x1a1a22, 0, 0.42, 0.28);
  } else if (hairStyle === 'ponytail') {
    hairTop(new THREE.BoxGeometry(0.46, 0.16, 0.46), hair, 0, 0.46, 0);
    hairTop(new THREE.BoxGeometry(0.16, 0.42, 0.16), hair, 0, 0.28, -0.28);
  } else if (hairStyle === 'helmet') {
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), hairMat(0xc23a2a));
    hm.scale.y = 0.85; hm.castShadow = true; hm.position.y = 0.32; head.add(hm);
    hairTop(new THREE.BoxGeometry(0.4, 0.1, 0.1), 0x1a1a22, 0, 0.28, 0.24);
  } else if (hairStyle === 'hat') {
    hairTop(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 10), hair, 0, 0.48, 0);
    hairTop(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10), hair, 0, 0.56, 0);
  } else if (hairStyle === 'hood') {
    hairTop(new THREE.BoxGeometry(0.48, 0.2, 0.48), shirt, 0, 0.46, 0);
    hairTop(new THREE.BoxGeometry(0.5, 0.3, 0.12), shirt, 0, 0.28, -0.22);
  } else if (hairStyle === 'headphones') {
    hairTop(new THREE.BoxGeometry(0.46, 0.12, 0.46), hair, 0, 0.46, 0);
    hairTop(new THREE.BoxGeometry(0.08, 0.18, 0.1), 0x1a1a22, -0.26, 0.22, 0);
    hairTop(new THREE.BoxGeometry(0.08, 0.18, 0.1), 0x1a1a22, 0.26, 0.22, 0);
    hairTop(new THREE.BoxGeometry(0.56, 0.06, 0.1), 0x1a1a22, 0, 0.44, 0);
  } else if (hairStyle === 'hijab') {
    hairTop(new THREE.BoxGeometry(0.48, 0.5, 0.48), hair, 0, 0.22, -0.04);
  } else if (hairStyle === 'spiky') {
    for (const dx of [-0.14, 0, 0.14]) hairTop(new THREE.ConeGeometry(0.09, 0.22, 5), hair, dx, 0.52, 0);
  } else {
    hairTop(new THREE.BoxGeometry(0.46, 0.12, 0.46), hair, 0, 0.46, 0);
  }
  g.add(head);

  // arms: pivot groups at the shoulders so they can swing and aim
  const armL = new THREE.Group(); armL.position.set(-0.4, 1.52, 0);
  const armLMesh = part(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt); armLMesh.position.y = -0.35; armL.add(armLMesh);
  const armR = new THREE.Group(); armR.position.set(0.4, 1.52, 0);
  const armRMesh = part(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt); armRMesh.position.y = -0.35; armR.add(armRMesh);
  if (gloves) {
    const gl = part(new THREE.BoxGeometry(0.22, 0.16, 0.26), 0x1a1a22);
    gl.position.y = -0.72; armL.add(gl);
    const gr = part(new THREE.BoxGeometry(0.22, 0.16, 0.26), 0x1a1a22);
    gr.position.y = -0.72; armR.add(gr);
  }
  if (gun) {
    const gunMesh = part(new THREE.BoxGeometry(0.12, 0.12, 0.9), 0x111111);
    gunMesh.position.set(0, -0.7, 0.3); armR.add(gunMesh);
  }
  g.add(armL, armR);

  g.scale.setScalar(height);

  const h = {
    group: g, parts: { legL, legR, torso, head, armL, armR },
    falling: false, fallT: 0,
    // fall: the group tips over and (when fadeable) fades out; animate()
    // advances it, so callers just keep calling animate() each frame
    fall() { this.falling = true; this.fallT = 0; },
    // stand back up after a fall (player respawn): restore pose + opacity
    reset() {
      this.falling = false; this.fallT = 0;
      g.rotation.x = 0; g.position.y = 0;
      if (fadeable) for (const m of fadeMats) m.opacity = 1;
    },
    animate(dt, a = {}) {
      const { phase = 0, moving = false, running = false, aiming = false, idleTime = 0 } = a;
      if (this.falling) {
        this.fallT += dt;
        const k = Math.min(1, this.fallT / 0.3);
        g.rotation.x = -Math.PI / 2 * k;
        g.position.y = 0.4 * k;
        if (fadeable) {
          const op = Math.max(0, 1 - (this.fallT - 0.3) / 0.8);
          for (const m of fadeMats) m.opacity = op;
        }
        return;
      }
      const swing = moving ? (running ? 0.7 : 0.55) : 0;
      const s = Math.sin(phase);
      legL.rotation.x = s * swing;
      legR.rotation.x = -s * swing;
      if (aiming) {
        armR.rotation.x = -1.45; // right arm raised, weapon forward
        armL.rotation.x = -0.5;
      } else {
        armL.rotation.x = -s * swing * 0.7;
        armR.rotation.x = s * swing * 0.7;
      }
      if (moving) {
        torso.rotation.x = running ? 0.12 : 0.05; // lean into the run
        torso.position.y = 0.85 + Math.abs(Math.sin(phase)) * 0.03;
      } else {
        // idle breathing: slow rise and fall of the chest
        torso.rotation.x = 0;
        torso.position.y = 0.85 + Math.sin(idleTime * 2) * 0.02;
      }
    },
  };
  return h;
}
