// Tanjung Emas — main game: bootstrap, loop, input, camera, player, driving,
// boats, garage, pause map, title screen, and the ?shot= staging used for the
// four screenshots. Everything is wired here; systems live in their own files.
import { SEED, MISSIONS, CAR_MODELS, GARAGE_ITEMS, ECONOMY } from './config.js';
import { buildWorld, collideCircle, districtAt, streetName } from './world.js';
import { PlayerCar, Traffic, makeCarMesh } from './vehicles.js';
import { BoatFleet } from './boats.js';
import { Pedestrians } from './traffic.js';
import { Police } from './police.js';
import { MissionRunner } from './missions.js';
import { Combat } from './combat.js';
import { Hud, respectRank } from './hud.js';
import { Minimap } from './minimap.js';
import { Radio } from './audio.js';
import { Weather } from './weather.js';
import { loadSlot, saveSlot, listSlots, percentComplete } from './save.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.state = 'title'; // title | playing | paused | garage
    this.money = ECONOMY.startMoney;
    this.respect = 0;
    this.health = 100;
    this.armour = 0;
    this.clockMin = 17 * 60 + 30;
    this.day = 5; // 0=MON .. 6=SUN, start Friday
    this.stats = { carsStolen: 0, distanceKm: 0, moneyEarned: 0, collectibles: 0 };
    this.inCar = false;
    this.inBoat = false;
    this.nitro = 1;
    this.crewCooldown = { C: 0 };
    this.crewActive = [false, false, false];
    this.input = { forward: false, back: false, left: false, right: false, nitro: false };
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.mouseDown = false;
    this.errors = [];
  }

  init() {
    const canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(0, 8, -12);

    const world = buildWorld(this.scene, SEED);
    this.colliders = world.colliders;
    this.traffic = new Traffic(this.scene, SEED + 1, this.colliders);
    this.peds = new Pedestrians(this.scene, SEED + 2);
    this.police = new Police(this.scene, SEED + 3);
    this.boats = new BoatFleet(this.scene, SEED + 4);
    this.combat = new Combat(this.scene, this.camera);
    this.weather = new Weather(this.scene);
    this.hud = new Hud();
    this.minimap = new Minimap();
    this.radio = new Radio();

    // player on foot
    this.player = this.makePlayerMesh();
    this.scene.add(this.player.mesh);
    this.playerPos = new THREE.Vector3(-240, 0, 220);
    this.playerHeading = 0;
    this.playerSpeed = 0;

    // drivable car (hidden until the player steals one)
    this.car = new PlayerCar(this.scene, CAR_MODELS[0]);
    this.car.mesh.visible = false;

    // parked stealable cars at mission spots
    this.stealables = [];
    this.spawnParkedCar(-200, 160, 0);
    this.spawnParkedCar(-280, -200, 2);
    this.spawnParkedCar(240, 240, 3);

    // collectibles: golden geckos + sunset tapes
    this.collectibles = [];
    const rng = (function (s) { let a = s; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })(SEED + 9);
    const geo = new THREE.SphereGeometry(0.55, 10, 8);
    for (let i = 0; i < 40; i++) {
      const golden = i % 2 === 0;
      const mat = new THREE.MeshBasicMaterial({ color: golden ? 0xffd34f : 0xff4fd8 });
      const m = new THREE.Mesh(geo, mat);
      const x = -280 + rng() * 780, z = -480 + rng() * 960;
      m.position.set(x, 1.2, z);
      this.scene.add(m);
      this.collectibles.push({ mesh: m, x, z, taken: false, kind: golden ? 'Golden Gecko' : 'Sunset Tape' });
    }

    this.missions = new MissionRunner(this.scene, {
      onDialog: (d) => this.hud.showDialog(d),
      onStageComplete: () => { this.radio.sfx('pickup'); },
      onMissionComplete: (m) => {
        this.money += m.pay; this.stats.moneyEarned += m.pay;
        this.respect += ECONOMY.respectPerMission;
        this.hud.showMessage(`MISSION PASSED — ${m.name}  +$${m.pay}`, 4);
        this.radio.sfx('mission');
        this.autosave();
        this.weather.setStorm(false);
        if (m.storm) this.hud.showMessage('Badai reda. Langit kembali jingga.', 3);
      },
      onCrime: (n) => this.police.addHeat(n),
    });

    this.bindInput();
    this.buildTitle();
    this.buildGarage();
    this.buildPause();
    window.addEventListener('resize', () => this.onResize());

    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    if (shot) this.applyShot(shot);
    else this.showTitle();

    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(() => this.tick());
    window.TANJUNG = this; // debug handle for play-testing
  }

  makePlayerMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const jacket = new THREE.MeshLambertMaterial({ color: 0xff7a3c });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), pants);
    legs.position.y = 0.42; legs.name = 'legs'; g.add(legs);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.38), jacket);
    body.position.y = 1.22; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.82; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.48), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
    cap.position.y = 2.06; g.add(cap);
    return { mesh: g, walkPhase: 0 };
  }

  spawnParkedCar(x, z, modelIdx) {
    const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
    const mesh = makeCarMesh(model, null);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    this.stealables.push({ mesh, model, x, z, taken: false });
  }

  bindInput() {
    const key = (e, down) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.input.forward = down;
      if (k === 's' || k === 'arrowdown') this.input.back = down;
      if (k === 'a' || k === 'arrowleft') this.input.left = down;
      if (k === 'd' || k === 'arrowright') this.input.right = down;
      if (k === 'shift') this.input.nitro = down;
      if (down) this.onKeyPress(k, e);
    };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      key(e, true);
    });
    window.addEventListener('keyup', (e) => key(e, false));
    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('.overlay')) return;
      this.mouseDown = true;
      if (this.state === 'playing' && !this.inCar && !this.inBoat) this.tryShoot();
      this.dragX = e.clientX; this.dragY = e.clientY; this.dragging = true;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.camYaw -= (e.clientX - this.dragX) * 0.005;
      this.camPitch = Math.max(0.08, Math.min(0.9, this.camPitch + (e.clientY - this.dragY) * 0.003));
      this.dragX = e.clientX; this.dragY = e.clientY;
    });
    $('game').addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyPress(k, e) {
    if (this.state === 'title') return;
    if (k === 'm') { this.togglePause(); return; }
    if (k === 'escape') { if (this.state === 'paused') this.togglePause(); if (this.state === 'garage') this.closeGarage(); return; }
    if (this.state !== 'playing') return;
    if (k === 'f') this.tryEnterVehicle();
    if (k === 'e') this.tryGarage();
    if (k === 'r') { this.radio.nextStation(); this.hud.showMessage(`Radio: ${this.radio.currentStation().name}`, 2); }
    if (k >= '1' && k <= '6') { this.combat.select(Number(k) - 1); }
    if (k === 'z') this.useCrew(0);
    if (k === 'x') this.useCrew(1);
    if (k === 'c') this.useCrew(2);
  }

  useCrew(i) {
    if (i === 0) { this.crewActive[0] = true; this.hud.showMessage('SINTA: Nitro lebih lama — aktif!', 2); setTimeout(() => { this.crewActive[0] = false; }, 30000); }
    if (i === 1) { this.crewActive[1] = true; this.hud.showMessage('BIMO: Diskon garage 25% — aktif 60 dtk!', 2); setTimeout(() => { this.crewActive[1] = false; }, 60000); }
    if (i === 2) {
      if (this.crewCooldown.C > 0) { this.hud.showMessage(`NADIA: cooldown ${Math.ceil(this.crewCooldown.C)} dtk`, 2); return; }
      if (this.police.wanted > 0) { this.police.heat = Math.max(0, this.police.heat - 20); this.police.recomputeStars(); this.hud.showMessage('NADIA: 1 bintang wanted dihapus!', 2); }
      else this.hud.showMessage('NADIA: tidak ada wanted saat ini', 2);
      this.crewCooldown.C = 90;
    }
  }

  tryShoot() {
    if (this.combat.weapon().id === 'fists') return;
    const ok = this.combat.shoot(performance.now(), this.playerPos, this.playerHeading, (enemy) => {
      this.money += 25; this.stats.moneyEarned += 25;
      this.radio.sfx('pickup');
    });
    if (ok) { this.radio.sfx('shot'); this.police.addHeat(2); }
  }

  nearestStealable(maxD) {
    let best = null, bestD = maxD * maxD, kind = null;
    for (const s of this.stealables) {
      if (s.taken) continue;
      const d2 = (s.x - this.playerPos.x) ** 2 + (s.z - this.playerPos.z) ** 2;
      if (d2 < bestD) { bestD = d2; best = s; kind = 'car'; }
    }
    const parked = this.traffic.nearestParked(this.playerPos, maxD);
    if (parked) {
      const d2 = (parked.x - this.playerPos.x) ** 2 + (parked.z - this.playerPos.z) ** 2;
      if (d2 < bestD) { bestD = d2; best = parked; kind = 'traffic'; }
    }
    return best ? { obj: best, kind } : null;
  }

  tryEnterVehicle() {
    if (this.inCar) { this.exitCar(); return; }
    if (this.inBoat) { this.exitBoat(); return; }
    // boat first when near the marina water
    const boat = this.boats.nearestDocked(this.playerPos, 8);
    if (boat && this.playerPos.x < -290) {
      this.boats.board(boat);
      this.inBoat = true;
      this.player.mesh.visible = false;
      this.hud.showMessage(`Naik ${boat.model.name} — tekan F untuk turun`, 3);
      return;
    }
    const near = this.nearestStealable(7);
    if (near) {
      const model = near.obj.model || near.obj.mesh.userData.model;
      this.car.setModel(model);
      this.car.reset(near.obj.x ?? near.obj.mesh.position.x, near.obj.z ?? near.obj.mesh.position.z, near.obj.mesh.rotation.y);
      this.car.mesh.visible = true;
      if (near.kind === 'traffic') { near.obj.mesh.visible = false; this.traffic.cars = this.traffic.cars.filter(c => c !== near.obj); }
      else near.obj.taken = true;
      near.obj.mesh.visible = false;
      this.inCar = true;
      this.player.mesh.visible = false;
      this.stats.carsStolen++;
      this.police.addHeat(25);
      this.hud.showMessage(`Mobil dicuri: ${model.name} — wanted naik!`, 3);
      this.radio.sfx('siren');
    }
  }

  exitCar() {
    this.inCar = false;
    this.car.mesh.visible = false;
    this.playerPos.set(this.car.pos.x + 3, 0, this.car.pos.z + 3);
    this.player.mesh.visible = true;
    this.player.mesh.position.copy(this.playerPos);
  }

  exitBoat() {
    this.inBoat = false;
    this.boats.leave();
    this.playerPos.set(-300, 0, this.boats.playerBoat.mesh.position.z);
    this.player.mesh.visible = true;
    this.player.mesh.position.copy(this.playerPos);
  }

  tryGarage() {
    const dx = this.playerPos.x - 400, dz = this.playerPos.z - 20;
    if (dx * dx + dz * dz < 20 * 20) {
      this.state = 'garage';
      $('garage').classList.remove('hidden');
    }
  }
  closeGarage() {
    this.state = 'playing';
    $('garage').classList.add('hidden');
  }

  buildGarage() {
    const list = $('garage-items');
    for (const item of GARAGE_ITEMS) {
      const row = document.createElement('div');
      row.className = 'garage-row';
      row.innerHTML = `<span class="g-name">${item.name}</span><span class="g-desc">${item.desc}</span><button data-id="${item.id}">$${item.price}</button>`;
      row.querySelector('button').addEventListener('click', () => this.buyGarage(item));
      list.appendChild(row);
    }
    $('garage-close').addEventListener('click', () => this.closeGarage());
  }

  buyGarage(item) {
    let price = item.price;
    if (this.crewActive[1]) price = Math.round(price * 0.75);
    if (this.money < price) { this.hud.showMessage('Uang tidak cukup!', 2); return; }
    this.money -= price;
    if (item.id === 'repair') this.car.condition = 100;
    if (item.id === 'respray') this.police.clearWanted();
    if (item.id === 'tune') this.car.tuned = true;
    if (item.id === 'armour') this.armour = 100;
    if (item.id === 'nitro') this.car.hasNitro = true;
    this.hud.showMessage(`${item.name} dibeli — $${price}`, 2);
    this.radio.sfx('pickup');
  }

  buildPause() {
    $('resume-btn').addEventListener('click', () => this.togglePause());
    $('quit-btn').addEventListener('click', () => this.showTitle());
    $('save-btn').addEventListener('click', () => { this.autosave(); this.hud.showMessage('Game disimpan (slot 1)', 2); this.refreshPause(); });
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      $('pause').classList.remove('hidden');
      this.refreshPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      $('pause').classList.add('hidden');
    }
  }

  refreshPause() {
    this.minimap.drawFullMap(this.playerPos, this.missions.stageTarget(), this.stats, this.missions.listStatus(), listSlots());
    const ml = $('mission-list');
    ml.innerHTML = '';
    for (const m of this.missions.listStatus()) {
      const li = document.createElement('li');
      li.className = 'mission-' + m.status.toLowerCase();
      li.textContent = `${m.id}. ${m.name} — ${m.status}`;
      ml.appendChild(li);
    }
    $('career-stats').innerHTML =
      `Mobil dicuri: ${this.stats.carsStolen} &nbsp;•&nbsp; Jarak tempuh: ${this.stats.distanceKm.toFixed(1)} km<br>` +
      `Uang didapat: $${this.stats.moneyEarned} &nbsp;•&nbsp; Kolektibel: ${this.stats.collectibles}/40<br>` +
      `Respect: ${this.respect} (${respectRank(this.respect)}) &nbsp;•&nbsp; Misi selesai: ${this.missions.completed.size}/8`;
    const sl = $('save-slots');
    sl.innerHTML = '';
    for (const s of listSlots()) {
      const div = document.createElement('div');
      div.className = 'save-slot';
      div.textContent = s.empty ? `SLOT ${s.slot} — KOSONG` : `SLOT ${s.slot} — ${s.act} • ${Math.round(percentComplete(s))}% • $${s.money}`;
      sl.appendChild(div);
    }
  }

  buildTitle() {
    $('newgame-btn').addEventListener('click', () => this.newGame());
    $('continue-btn').addEventListener('click', () => this.continueGame());
    $('settings-btn').addEventListener('click', () => {
      this.radio.nextStation();
      $('settings-btn').textContent = `Radio: ${this.radio.currentStation().name}`;
    });
  }

  showTitle() {
    this.state = 'title';
    $('title').classList.remove('hidden');
    $('pause').classList.add('hidden');
    $('garage').classList.add('hidden');
    $('hud').classList.add('hidden');
    const save = loadSlot(1);
    $('continue-btn').disabled = !save;
    if (save) {
      $('continue-btn').textContent = `Continue — ${save.act} • ${Math.round(percentComplete(save))}% • $${save.money}`;
    }
  }

  hideTitle() {
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
  }

  newGame() {
    this.money = ECONOMY.startMoney; this.respect = 0; this.health = 100; this.armour = 0;
    this.stats = { carsStolen: 0, distanceKm: 0, moneyEarned: 0, collectibles: 0 };
    this.playerPos.set(-240, 0, 220);
    this.police.clearWanted();
    this.combat.clearEnemies();
    this.missions.index = 0; this.missions.completed.clear();
    this.hideTitle();
    this.state = 'playing';
    this.radio.start();
    this.missions.start();
  }

  continueGame() {
    const s = loadSlot(1);
    if (!s) return;
    this.money = s.money; this.respect = s.respect;
    this.stats = s.stats || this.stats;
    this.playerPos.set(s.playerPos[0], 0, s.playerPos[1]);
    this.missions.index = s.missionIndex; this.missions.completed = new Set(s.completedMissions || []);
    this.hideTitle();
    this.state = 'playing';
    this.radio.start();
    this.missions.start();
  }

  autosave() {
    saveSlot(1, {
      money: this.money, respect: this.respect, missionIndex: this.missions.index,
      completedMissions: [...this.missions.completed], stats: this.stats,
      playerPos: [this.playerPos.x, this.playerPos.z], collectibles: this.stats.collectibles,
    });
  }

  applyShot(shot) {
    this.hideTitle();
    this.state = 'playing';
    this.radio.start();
    if (shot === 'title') { this.showTitle(); return; }
    if (shot === 'chase') {
      this.missions.index = 2; this.missions.start();
      this.car.setModel(CAR_MODELS[3]);
      this.car.reset(100, 100, -Math.PI / 2); // heading west, into the sunset
      this.car.mesh.visible = true;
      this.inCar = true; this.player.mesh.visible = false;
      this.car.speed = 16;
      this.input.forward = true; // keep rolling through the shot
      this.police.heat = 70; this.police.recomputeStars();
      // stage the chase so it is visible in frame: two patrol cars right
      // behind, one roadblock ahead on the same road, heli ahead-left
      this.police.placeCar(0, 118, 94, -Math.PI / 2);
      this.police.placeCar(1, 128, 108, -Math.PI / 2);
      this.police.placeCar(2, 140, 100, -Math.PI / 2);
      this.police.placeRoadblock(0, 20, 100, 0);
      this.police.heli.angle = 2.6;
      this.police.update(0.1, { x: 100, z: 100 }, 20, this.colliders, false);
      this.clockMin = 17 * 60 + 41;
      this.money = 18450;
      this.hud.showDialog({ name: 'NADIA', role: 'Hacker', line: 'Polisi sudah di belakang kita! Jangan berhenti di boulevard!' });
    }
    if (shot === 'combat') {
      this.missions.index = 1; this.missions.start(); this.missions.stage = 1;
      this.missions.placeBeacon();
      this.weather.setStorm(true);
      this.playerPos.set(-280, 0, -190);
      this.combat.select(2);
      // enemies ahead of the player, inside the camera's view (camera looks -z)
      this.combat.spawnEnemies([-282, -215], 4);
      this.missions.enemiesLeft = 4;
      this._fightSpawned = true; // enemies already on the field; don't spawn twice
      this.police.heat = 45; this.police.recomputeStars();
      this.clockMin = 21 * 60 + 5;
      this.money = 6420;
      this.health = 78;
      this.hud.showDialog({ name: 'BIMO', role: 'Mechanic', line: 'Mereka datang dari gang! Cari perlindungan!' });
    }
    if (shot === 'map') {
      this.missions.index = 0; this.missions.completed.add(1); this.missions.index = 1;
      this.missions.start();
      this.stats.carsStolen = 7; this.stats.distanceKm = 48.2; this.stats.moneyEarned = 3210;
      this.respect = 960;
      this.money = 18450;
      this.state = 'paused';
      $('pause').classList.remove('hidden');
      this.refreshPause();
    }
    this.snapCamera();
  }

  // put the camera exactly where the chase camera would be, so a staged
  // screenshot is framed correctly on the very first frame
  snapCamera() {
    const focus = this.inCar ? this.car.pos : (this.inBoat ? this.boats.playerBoat.mesh.position : this.playerPos);
    const heading = this.inCar ? this.car.heading : (this.inBoat ? this.boats.playerBoat.heading : this.camYaw);
    const dist = this.inCar ? 13 : (this.inBoat ? 12 : 8.5);
    const height = this.inCar ? 5.5 : (this.inBoat ? 5 : 3.8);
    this.camera.position.set(
      focus.x - Math.sin(heading) * dist,
      focus.y + height + Math.sin(this.camPitch) * 4,
      focus.z - Math.cos(heading) * dist,
    );
    this.camera.lookAt(focus.x + Math.sin(heading) * 6, focus.y + 1.5, focus.z + Math.cos(heading) * 6);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    try {
      if (this.state === 'playing') this.update(dt, now);
      this.render(dt);
    } catch (err) {
      this.errors.push(String(err && err.message || err));
      console.error(err);
    }
  }

  update(dt, now) {
    // in-game clock
    this.clockMin += dt * 0.6;
    if (this.crewCooldown.C > 0) this.crewCooldown.C -= dt;
    const speedKmh = this.inCar ? this.car.speed * 3.6 : (this.inBoat ? this.boats.playerBoat.speed * 3.6 : this.playerSpeed * 3.6);

    // movement
    if (this.inCar) {
      const nitroBoost = this.input.nitro && this.car.hasNitro && this.nitro > 0;
      if (nitroBoost) this.nitro = Math.max(0, this.nitro - dt * 0.4);
      else this.nitro = Math.min(1, this.nitro + dt * 0.05);
      const before = this.car.pos.clone();
      this.car.update(dt, this.input, this.colliders, nitroBoost || this.crewActive[0]);
      this.stats.distanceKm += before.distanceTo(this.car.pos) / 1000;
      this.playerPos.copy(this.car.pos);
      this.playerSpeed = Math.abs(this.car.speed);
    } else if (this.inBoat) {
      const b = this.boats.updatePlayer(dt, this.input);
      if (b) { this.playerPos.set(b.x, 0, b.z); this.playerSpeed = Math.abs(b.speed); }
    } else {
      const run = this.input.nitro ? 1.8 : 1;
      const move = (this.input.forward ? 1 : 0) - (this.input.back ? 1 : 0);
      const strafe = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      const speed = 6 * run;
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const mx = (sin * move + cos * strafe) * speed * dt;
      const mz = (cos * move - sin * strafe) * speed * dt;
      this.playerPos.x += mx; this.playerPos.z += mz;
      this.playerPos.x = Math.max(-560, Math.min(560, this.playerPos.x));
      this.playerPos.z = Math.max(-560, Math.min(560, this.playerPos.z));
      collideCircle(this.playerPos, 0.7, this.colliders);
      this.playerSpeed = Math.hypot(mx, mz) / Math.max(dt, 0.001);
      if (this.playerSpeed > 0.5) {
        this.playerHeading = Math.atan2(mx, mz);
        this.player.walkPhase += dt * this.playerSpeed * 1.6;
        this.player.mesh.children[0].position.y = 0.42 + Math.abs(Math.sin(this.player.walkPhase)) * 0.12;
      }
      this.player.mesh.position.copy(this.playerPos);
      this.player.mesh.rotation.y = this.playerHeading;
      // hold-to-shoot with mouse
      if (this.mouseDown && this.combat.weapon().id !== 'fists') this.tryShoot();
    }

    // traffic + peds + police + weather + missions
    this.traffic.update(dt, this.playerPos);
    this.peds.update(dt, this.playerPos, this.playerSpeed, now - this.combat.lastShot < 400);
    const onWater = this.inBoat || this.playerPos.x < -300;
    this.police.update(dt, this.playerPos, this.playerSpeed, this.colliders, onWater);
    this.boats.updatePolice(dt, this.playerPos, this.police.wanted);
    this.weather.update(dt, this.playerPos);
    this.missions.update(dt);

    // mission stage check (fight stages need live enemy count)
    if (this.missions.active) {
      const st = this.missions.stageTarget();
      if (st && st.type === 'fight') {
        if (!this._fightSpawned) {
          this._fightSpawned = true;
          this.missions.enemiesLeft = this.combat.spawnEnemies([st.x, st.z], 4);
        }
        this.missions.enemiesLeft = this.combat.aliveCount();
      } else this._fightSpawned = false;
      const before = this.missions.stage;
      this.missions.checkStage(this.playerPos, { inCar: this.inCar, inBoat: this.inBoat, enemiesSpawned: this._fightSpawned });
      if (this.missions.stage !== before) {
        const m = this.missions.current();
        if (m && m.storm) this.weather.setStorm(true);
      }
    }

    // combat enemies shoot back
    this.combat.update(dt, this.playerPos, (dmg) => {
      if (this.armour > 0) { const absorbed = Math.min(this.armour, dmg); this.armour -= absorbed; dmg -= absorbed; }
      this.health -= dmg;
      if (this.health <= 0) this.die();
    });

    // collectibles
    for (const c of this.collectibles) {
      if (c.taken) continue;
      const d2 = (c.x - this.playerPos.x) ** 2 + (c.z - this.playerPos.z) ** 2;
      if (d2 < 9) {
        c.taken = true; c.mesh.visible = false;
        this.money += 50; this.stats.collectibles++;
        this.hud.showMessage(`${c.kind} ditemukan! +$50`, 2);
        this.radio.sfx('pickup');
      }
    }

    // context prompt
    const prompt = $('prompt');
    if (!this.inCar && !this.inBoat) {
      const nearCar = this.nearestStealable(7);
      const nearBoat = this.boats.nearestDocked(this.playerPos, 8);
      const nearGarage = (this.playerPos.x - 400) ** 2 + (this.playerPos.z - 20) ** 2 < 400;
      if (nearCar) { prompt.textContent = '[F] STEAL CAR'; prompt.classList.remove('hidden'); }
      else if (nearBoat && this.playerPos.x < -290) { prompt.textContent = '[F] BOARD BOAT'; prompt.classList.remove('hidden'); }
      else if (nearGarage) { prompt.textContent = '[E] GARAGE'; prompt.classList.remove('hidden'); }
      else prompt.classList.add('hidden');
    } else if (this.inCar || this.inBoat) {
      prompt.textContent = '[F] KELUAR';
      prompt.classList.remove('hidden');
    }

    // HUD
    const mission = this.missions.missionText();
    const target = this.missions.stageTarget();
    const district = districtAt(this.playerPos.x, this.playerPos.z);
    const hours = Math.floor(this.clockMin / 60) % 24;
    const mins = Math.floor(this.clockMin % 60);
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    this.hud.update(dt, {
      mission,
      money: this.money,
      wanted: this.police.wanted,
      clock: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
      dayName: dayNames[this.day],
      policeStatus: this.police.status(),
      health: this.health,
      armour: this.armour,
      district: district.name.toUpperCase(),
      street: streetName(this.playerPos.x, this.playerPos.z),
      respect: this.respect,
      respectRank: respectRank(this.respect),
      speedKmh,
      vehicleName: this.inCar ? this.car.mesh.userData.model.name : (this.inBoat ? this.boats.playerBoat.mesh.userData.model.name : 'JALAN KAKI'),
      condition: this.inCar ? this.car.condition : 100,
      gear: this.inCar ? `G${Math.min(5, 1 + Math.floor(Math.abs(this.car.speed) / 10))}` : '—',
      nitro: this.nitro,
      ammo: this.combat.ammo,
      weaponIndex: this.combat.weaponIndex,
      units: this.police.units.map(u => ({ name: u.name, dist: u.dist, tactic: u.tactic })),
      crewActive: this.crewActive,
      station: this.radio.currentStation().name,
      song: this.radio.currentSong(),
      objectiveDist: target ? Math.hypot(target.x - this.playerPos.x, target.z - this.playerPos.z) : null,
    });
    this.minimap.drawRadar(this.playerPos, this.camYaw, target, this.police.cars, this.traffic.cars);
  }

  die() {
    this.health = 100;
    this.armour = 0;
    this.money = Math.max(0, this.money - 100);
    this.police.clearWanted();
    this.playerPos.set(-240, 0, 280);
    if (this.inCar) { this.inCar = false; this.car.mesh.visible = false; }
    if (this.inBoat) { this.inBoat = false; this.boats.leave(); }
    this.player.mesh.visible = true;
    this.player.mesh.position.copy(this.playerPos);
    this.hud.showMessage('Kamu pingsan — diantar ke rumah sakit. -$100', 4);
  }

  render(dt) {
    // title screen: slow cinematic orbit over the city at sunset
    if (this.state === 'title') {
      const t = performance.now() / 1000;
      const a = t * 0.03;
      this.camera.position.set(Math.cos(a) * 420, 130, Math.sin(a) * 420);
      this.camera.lookAt(0, 25, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // third-person chase camera
    const focus = this.inCar ? this.car.pos : (this.inBoat ? this.boats.playerBoat.mesh.position : this.playerPos);
    const heading = this.inCar ? this.car.heading : (this.inBoat ? this.boats.playerBoat.heading : this.camYaw);
    const dist = this.inCar ? 13 : (this.inBoat ? 12 : 8.5);
    const height = this.inCar ? 5.5 : (this.inBoat ? 5 : 3.8);
    const tx = focus.x - Math.sin(heading) * dist;
    const tz = focus.z - Math.cos(heading) * dist;
    const ty = focus.y + height + Math.sin(this.camPitch) * 4;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 6);
    this.camera.lookAt(focus.x + Math.sin(heading) * 6, focus.y + 1.5, focus.z + Math.cos(heading) * 6);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  try {
    game.init();
  } catch (err) {
    console.error(err);
    document.getElementById('fatal').textContent = 'Game gagal dibuka: ' + (err && err.message);
    document.getElementById('fatal').classList.remove('hidden');
  }
});
