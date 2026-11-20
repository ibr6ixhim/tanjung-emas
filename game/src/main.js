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
import { makeHumanoid } from './humanoid.js';
import { Minimap } from './minimap.js';
import { Radio } from './audio.js';
import { Weather } from './weather.js';
import { loadSlot, saveSlot, listSlots, percentComplete } from './save.js';
import { Particles } from './particles.js';

const $ = (id) => document.getElementById(id);

// The game class. Instantiated once the DOM is ready (see the handler at
// the bottom of this file). Kept as a plain class — the esbuild bundle is
// an IIFE, so no export is needed.
class Game {
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
    this.shotFreeze = false; // only set by ?shot= staging, never in live play
  }

  init() {
    const canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // three r149: sRGB output is `outputEncoding` (outputColorSpace arrived
    // in r152); ACES filmic tone mapping keeps the sunset from blowing out
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(0, 8, -12);

    const world = buildWorld(this.scene, SEED);
    this.colliders = world.colliders;
    this.sunLight = world.sunLight; // low orange sun, follows the player
    this.sky = world.sky;           // gradient dome, follows the camera
    this.sunDisc = world.sunDisc;   // low sun disc, follows the camera
    this.sea = world.sea;           // bay water, vertex waves each frame
    this.traffic = new Traffic(this.scene, SEED + 1, this.colliders);
    this.peds = new Pedestrians(this.scene, SEED + 2);
    this.police = new Police(this.scene, SEED + 3);
    this.boats = new BoatFleet(this.scene, SEED + 4);
    this.combat = new Combat(this.scene, this.camera);
    this.weather = new Weather(this.scene);
    this.hud = new Hud();
    this.minimap = new Minimap();
    this.radio = new Radio();
    this.particles = new Particles(this.scene); // tyre smoke, nitro, sparks
    this.shake = 0; // camera shake after impacts, decays each frame

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
    this.spawnParkedCar(250, 200, 3); // parked on the z=200 road, clear of buildings

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
      onMessage: (t) => this.hud.showMessage(t, 4),
      onMissionComplete: (m) => {
        this.money += m.pay; this.stats.moneyEarned += m.pay;
        this.respect += ECONOMY.respectPerMission;
        this.hud.showMessage(`MISSION PASSED — ${m.name}  +$${m.pay}`, 4);
        this.radio.sfx('mission');
        this.autosave();
        this.weather.setStorm(false);
        if (m.storm) this.hud.showMessage('The storm passed. The sky is orange again.', 3);
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

  // Raka: red-brick contrast jacket with a yellow chest panel, dark
  // backpack, cap — the silhouette the player reads at a glance. Jointed
  // limbs (see humanoid.js) so the walk, aim and fall can move him.
  makePlayerMesh() {
    const h = makeHumanoid({
      skin: 0xe8b88a, shirt: 0xc23a2a, pants: 0x2a2a3a, hair: 0x1a1a22,
      hairStyle: 'cap', jacketPanel: 0xffc93c, backpack: true,
      outline: true, fadeable: true,
    });
    return { mesh: h.group, humanoid: h, walkPhase: 0 };
  }

  // A mission 'steal' stage must always have a car to steal. Free-roam
  // theft can consume the parked mission cars before their mission starts,
  // so when a steal stage is active and no PARKED stealable car is near its
  // target, park one there. Only parked cars count: traffic cars drive away
  // within seconds, so a traffic car near the target is no guarantee.
  // The check goes quiet as soon as a car is in range, so this spawns at
  // most one car per stage.
  ensureStealable(target) {
    for (const s of this.stealables) {
      if (!s.taken && Math.hypot(s.x - target.x, s.z - target.z) < 20) return;
    }
    this.spawnParkedCar(target.x, target.z, this.stealables.length % CAR_MODELS.length);
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
    if (i === 0) { this.crewActive[0] = true; this.hud.showMessage('SINTA: Long nitro — active!', 2); setTimeout(() => { this.crewActive[0] = false; }, 30000); }
    if (i === 1) { this.crewActive[1] = true; this.hud.showMessage('BIMO: Garage discount 25% — active for 60 sec!', 2); setTimeout(() => { this.crewActive[1] = false; }, 60000); }
    if (i === 2) {
      if (this.crewCooldown.C > 0) { this.hud.showMessage(`NADIA: cooldown ${Math.ceil(this.crewCooldown.C)} sec`, 2); return; }
      if (this.police.wanted > 0) { this.police.heat = Math.max(0, this.police.heat - 20); this.police.recomputeStars(); this.hud.showMessage('NADIA: 1 wanted star cleared!', 2); }
      else this.hud.showMessage('NADIA: no wanted level right now', 2);
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
      this.hud.showMessage(`Boarded ${boat.model.name} — press F to get off`, 3);
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
      this.hud.showMessage(`Car stolen: ${model.name} — wanted up!`, 3);
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
    if (this.money < price) { this.hud.showMessage('Not enough money!', 2); return; }
    this.money -= price;
    if (item.id === 'repair') this.car.condition = 100;
    if (item.id === 'respray') this.police.clearWanted();
    if (item.id === 'tune') this.car.tuned = true;
    if (item.id === 'armour') this.armour = 100;
    if (item.id === 'nitro') this.car.hasNitro = true;
    this.hud.showMessage(`${item.name} bought — $${price}`, 2);
    this.radio.sfx('pickup');
  }

  buildPause() {
    $('resume-btn').addEventListener('click', () => this.togglePause());
    $('quit-btn').addEventListener('click', () => this.showTitle());
    $('save-btn').addEventListener('click', () => { this.autosave(); this.hud.showMessage('Game saved (slot 1)', 2); this.refreshPause(); });
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
      `Cars stolen: ${this.stats.carsStolen} &nbsp;•&nbsp; Distance driven: ${this.stats.distanceKm.toFixed(1)} km<br>` +
      `Money earned: $${this.stats.moneyEarned} &nbsp;•&nbsp; Collectibles: ${this.stats.collectibles}/40<br>` +
      `Respect: ${this.respect} (${respectRank(this.respect)}) &nbsp;•&nbsp; Missions done: ${this.missions.completed.size}/8`;
    const sl = $('save-slots');
    sl.innerHTML = '';
    for (const s of listSlots()) {
      const div = document.createElement('div');
      div.className = 'save-slot';
      div.textContent = s.empty ? `SLOT ${s.slot} — EMPTY` : `SLOT ${s.slot} — ${s.act} • ${Math.round(percentComplete(s))}% • $${s.money}`;
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
      // late-game pursuit: M6 stage 4/4 on a 150-second clock, Raka in the
      // MERAK S at 112 km/h with a 4-star response closing in — the first
      // patrol car sits 11 m ahead, inside FIRING range
      this.missions.index = 5; this.missions.completed = new Set([1, 2, 3, 4, 5]); this.missions.start();
      this.missions.stage = 3; this.missions.resetTimer(); this.missions.placeBeacon();
      this.car.setModel(CAR_MODELS[3]);
      this.car.reset(100, 100, -Math.PI / 2); // heading west, into the sunset
      this.car.mesh.visible = true;
      this.inCar = true; this.player.mesh.visible = false;
      this.car.speed = 31; // 112 km/h on the dial
      this.input.forward = false;
      this.police.heat = 70; this.police.recomputeStars();
      // stage the chase INSIDE the camera's frame: the chase camera sits
      // 13 m behind the car looking west, so units must be AHEAD of the
      // car (west of it). Car 0 rides the bumper at 11 m (FIRING); the
      // others flank the road ahead; a roadblock waits 45 m ahead and a
      // second one guards the cross street to the north-east.
      this.police.placeCar(0, 89, 100, -Math.PI / 2);
      this.police.placeCar(1, 78, 93, -Math.PI / 2);
      this.police.placeCar(2, 86, 108, -Math.PI / 2);
      this.police.placeCar(3, 96, 90, -Math.PI / 2);
      this.police.placeCar(4, 70, 104, -Math.PI / 2);
      this.police.placeRoadblock(0, 55, 100, 0);
      this.police.placeRoadblock(1, 62, 68, Math.PI / 2);
      this.police.placeHeli(60, 122, 28); // ahead-left, spotlight in frame
      this.stageChaseCrowd();
      // hold the staged geometry for the still frame: at SwiftShader speed
      // the chase would otherwise drift for seconds before the screenshot
      // and the units would leave the frame again
      this.shotFreeze = true;
      this.clockMin = 17 * 60 + 41;
      this.money = 92480; this.respect = 2900;
      this.hud.showDialog({ name: 'NADIA', role: 'Hacker', line: 'Roadblock ahead and the heli is on us. Do not stop!' });
    }
    if (shot === 'combat') {
      // night storm at the Neon hideout: M8 stage 2/4, Raka on foot facing
      // north into the gang, four enemies in a fan right in front of him —
      // one sits exactly on the x=460 firing line, so the staged shot lands
      this.missions.index = 7; this.missions.completed = new Set([1, 2, 3, 4, 5, 6, 7]); this.missions.start();
      this.missions.stage = 1; this.missions.placeBeacon();
      this.weather.setStorm(true);
      // the hideout stands at (460,120); the open strip south of it is
      // z 108-133 — the building behind starts at z 133.5, and the
      // collider teleports anyone who spawns inside it, so Raka stands
      // at z 128, clear of the wall, facing north into the gang
      this.playerPos.set(452, 0, 128);
      this.playerHeading = Math.PI; this.camYaw = Math.PI; // face north
      this.camDistOverride = 11; // pull the camera back: Raka reads smaller
      // and the gang ahead of him reads bigger in the frame
      this.combat.select(2);
      // enemies ahead of the player, inside the camera's view (camera looks -z)
      this.combat.spawnEnemies([458, 110], 4);
      // pull the four enemies into a tight fan right in front of the
      // player: at 10-14 m their health bars and red shirts fill the
      // middle of the frame instead of reading as dots
      const fan = [[446, 118], [452, 114], [458, 116], [464, 120]];
      this.combat.enemies.forEach((e, i) => {
        const p = fan[i % fan.length];
        e.x = p[0]; e.z = p[1];
        e.mesh.position.set(p[0], 0, p[1]);
      });
      this.missions.enemiesLeft = 4;
      this._fightSpawned = true; // enemies already on the field; don't spawn twice
      this.police.heat = 45; this.police.recomputeStars();
      // patrol cars on the roads around the fight, two of them close enough
      // to read in frame on the z=100 road
      this.police.placeCar(0, 435, 100, 0);
      this.police.placeCar(1, 472, 98, 0);
      this.police.placeCar(2, 400, 140, 0);
      this.police.placeCar(3, 500, 150, 0);
      // low and far so the air unit reads inside the on-foot camera's frame
      this.police.placeHeli(410, 70, 28);
      this.shotFreeze = true; // hold the scattering crowd still for the frame
      // a few civilians caught in the alley, scattering from the gunfire
      this.peds.gather([
        { x: 440, z: 120, dir: Math.PI - 0.3, panic: 2.5 },
        { x: 470, z: 120, dir: Math.PI + 0.3, panic: 2.5 },
        { x: 442, z: 130, dir: Math.PI, panic: 2.5 },
        { x: 468, z: 130, dir: Math.PI, panic: 2.5 },
      ]);
      // two cars on the cross street just past the fight, headlights in the dark
      this.traffic.placeCars([
        { x: 400, z: 80, axis: 'z', speed: 11 },
        { x: 400, z: 160, axis: 'z', speed: -12 },
      ]);
      this.clockMin = 21 * 60 + 5;
      this.money = 92480; this.respect = 2900;
      this.health = 78;
      // one live shot so the muzzle flash + tracer are in the still, then
      // hold them lit (combat.holdFlash) instead of letting them decay.
      // The world matrices must be refreshed first: the enemies were just
      // repositioned and the raycast would otherwise test them at the
      // origin, before the first render updates their matrices.
      this.scene.updateMatrixWorld(true);
      this.tryShoot();
      this.combat.holdFlash = true;
      this.hud.showDialog({ name: 'NADIA', role: 'Hacker', line: 'I already killed their alarm. Go in!' });
    }
    if (shot === 'hero') {
      // the cover: M8 stage 4/4 on a 180-second clock, Raka in the MERAK S
      // at 108 km/h down the Sunset Beach road into the sunset, a 4-star
      // response ahead of him and the heli's spotlight in the sky
      this.missions.index = 7; this.missions.completed = new Set([1, 2, 3, 4, 5, 6, 7]); this.missions.start();
      this.missions.stage = 3; this.missions.resetTimer(); this.missions.placeBeacon();
      this.car.setModel(CAR_MODELS[3]); // MERAK S
      this.car.reset(-240, 200, -Math.PI / 2); // heading west along the z=200 road
      this.car.mesh.visible = true;
      this.inCar = true; this.player.mesh.visible = false;
      this.car.speed = 30; // 108 km/h on the dial
      this.police.heat = 70; this.police.recomputeStars();
      // five patrol cars ahead on the road (one at 17 m, RAMMING), two
      // roadblocks further west, heli ahead-right with its spotlight cone
      this.police.placeCar(0, -262, 192, -Math.PI / 2);
      this.police.placeCar(1, -268, 208, -Math.PI / 2);
      this.police.placeCar(2, -278, 196, -Math.PI / 2);
      this.police.placeCar(3, -256, 206, -Math.PI / 2);
      this.police.placeCar(4, -290, 204, -Math.PI / 2);
      this.police.placeRoadblock(0, -282, 200, 0);
      this.police.placeRoadblock(1, -296, 200, Math.PI / 2);
      this.police.placeHeli(-288, 186, 26);
      this.clockMin = 17 * 60 + 55;
      this.money = 92480; this.respect = 2900;
      this.shotFreeze = true; // hold the gathered crowd still for the frame
      this.stageHeroCrowd();
      this.hud.showDialog({ name: 'SINTA', role: 'Driver', line: 'The whole city is watching, Raka. Do not stop now!' });
    }
    if (shot === 'map') {
      // late-game pause: seven missions done, the finale next, a career
      // worth showing — big money, high respect, miles on the clock
      this.missions.index = 7; this.missions.completed = new Set([1, 2, 3, 4, 5, 6, 7]);
      this.missions.start();
      this.stats.carsStolen = 34; this.stats.distanceKm = 186.4; this.stats.moneyEarned = 41200; this.stats.collectibles = 18;
      this.respect = 2900;
      this.money = 92480;
      this.clockMin = 17 * 60 + 30;
      this.state = 'paused';
      $('pause').classList.remove('hidden');
      this.refreshPause();
    }
    this.snapCamera();
  }

  // Crowd staging for the screenshots: gather REAL pedestrians and traffic
  // cars (the live systems, not props) into the camera's frame. The street
  // is frozen by shotFreeze for the still, so they stay where placed.
  stageHeroCrowd() {
    // the hero chase runs west along the z=200 road; the camera sits 13 m
    // behind the car looking west. Walkers belong on the sidewalks
    // (z=190/210) and the sand edge, traffic on the road ahead — the frame
    // should read as a busy sunset strip, not an empty boulevard
    this.peds.gather([
      { x: -248, z: 190, dir: Math.PI / 2 }, { x: -258, z: 190, dir: -Math.PI / 2 },
      { x: -272, z: 190, dir: Math.PI / 2 }, { x: -284, z: 190, dir: 0 },
      { x: -250, z: 210, dir: -Math.PI / 2 }, { x: -262, z: 210, dir: Math.PI / 2 },
      { x: -276, z: 210, dir: 0 }, { x: -288, z: 210, dir: Math.PI },
      { x: -296, z: 216, dir: -Math.PI / 2 }, { x: -244, z: 216, dir: Math.PI / 2 },
    ]);
    this.traffic.placeCars([
      { x: -252, z: 200, axis: 'x', speed: 10 },
      { x: -266, z: 200, axis: 'x', speed: -11 },
      { x: -280, z: 200, axis: 'x', speed: 9 },
      { x: -300, z: 188, axis: 'z', speed: 10 },
      { x: -300, z: 212, axis: 'z', speed: -9 },
      { x: -230, z: 200, axis: 'x', speed: 12 },
    ]);
    // two cars parked on the sand edge facing the sunset
    this.spawnParkedCar(-302, 208, 2);
    this.spawnParkedCar(-306, 226, 0);
  }

  stageChaseCrowd() {
    // the chase runs west along the z=100 road; the camera sits 13 m behind
    // the car looking west. Walkers belong on the sidewalks (z=90/110),
    // traffic on the road ahead and the x=100 cross street.
    this.peds.gather([
      { x: 45, z: 91, dir: Math.PI / 2 }, { x: 58, z: 91, dir: -Math.PI / 2 }, { x: 70, z: 91, dir: Math.PI / 2 },
      { x: 48, z: 109, dir: -Math.PI / 2 }, { x: 65, z: 109, dir: Math.PI / 2 }, { x: 78, z: 109, dir: 0 },
      { x: 38, z: 91, dir: 0 }, { x: 84, z: 109, dir: Math.PI },
    ]);
    this.traffic.placeCars([
      { x: 48, z: 100, axis: 'x', speed: 10 },
      { x: 68, z: 100, axis: 'x', speed: -11 },
      { x: 88, z: 100, axis: 'x', speed: 9 },
      { x: 100, z: 88, axis: 'z', speed: 10 },
      { x: 100, z: 112, axis: 'z', speed: -9 },
      { x: 40, z: 100, axis: 'x', speed: 12 },
    ]);
  }

  // put the camera exactly where the chase camera would be, so a staged
  // screenshot is framed correctly on the very first frame
  snapCamera() {
    const focus = this.inCar ? this.car.pos : (this.inBoat ? this.boats.playerBoat.mesh.position : this.playerPos);
    const heading = this.inCar ? this.car.heading : (this.inBoat ? this.boats.playerBoat.heading : this.camYaw);
    const dist = this.inCar ? 13 : (this.inBoat ? 12 : (this.camDistOverride || 8.5));
    const height = this.inCar ? 5.5 : (this.inBoat ? 5 : 2.6);
    this.camera.position.set(
      focus.x - Math.sin(heading) * dist,
      focus.y + height + Math.sin(this.camPitch) * 2,
      focus.z - Math.cos(heading) * dist,
    );
    // aim the crosshair at a far point so the camera sits nearly level:
    // a near aim point pitches the view down and the shot ray into the ground
    this.camera.lookAt(focus.x + Math.sin(heading) * 30, focus.y + 1.5, focus.z + Math.cos(heading) * 30);
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
      if (this.shotFreeze) {
        // staged ?shot= frame: hold the car where applyShot put it, the
        // dial still showing its speed; the live game never sets shotFreeze
        this.playerPos.copy(this.car.pos);
        this.playerSpeed = Math.abs(this.car.speed);
      } else {
        const nitroBoost = this.input.nitro && this.car.hasNitro && this.nitro > 0;
        if (nitroBoost) this.nitro = Math.max(0, this.nitro - dt * 0.4);
        else this.nitro = Math.min(1, this.nitro + dt * 0.05);
        const before = this.car.pos.clone();
        const hit = this.car.update(dt, this.input, this.colliders, nitroBoost || this.crewActive[0]);
        this.stats.distanceKm += before.distanceTo(this.car.pos) / 1000;
        this.playerPos.copy(this.car.pos);
        this.playerSpeed = Math.abs(this.car.speed);
        // impact: sparks at the car + a camera shake
        if (hit > 0) {
          this.particles.sparks(this.car.pos.x, 0.8, this.car.pos.z);
          this.shake = Math.max(this.shake, hit * 0.6);
        }
        // drifting: tyre smoke at the rear wheels
        if (this.car.drifting) {
          const h = this.car.heading;
          for (const sx of [-0.95, 0.95]) {
            this.particles.smoke(
              this.car.pos.x + sx * Math.cos(h) - 1.4 * Math.sin(h), 0.4,
              this.car.pos.z - sx * Math.sin(h) - 1.4 * Math.cos(h));
          }
        }
        // nitro: flames at the exhaust, pointing backwards
        if (nitroBoost) {
          const h = this.car.heading;
          this.particles.flame(
            this.car.pos.x - 2.2 * Math.sin(h), 0.5, this.car.pos.z - 2.2 * Math.cos(h),
            Math.sin(h), Math.cos(h));
        }
      }
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
      }
      // jointed walk / aim animation: legs swing opposite, arms swing,
      // right arm raises while aiming, chest breathes when standing still
      this.player.humanoid.animate(dt, {
        phase: this.player.walkPhase,
        moving: this.playerSpeed > 0.5,
        running: !!this.input.nitro,
        aiming: this.mouseDown && this.combat.weapon().id !== 'fists',
        idleTime: now / 1000,
      });
      this.player.mesh.position.copy(this.playerPos);
      this.player.mesh.rotation.y = this.playerHeading;
      // hold-to-shoot with mouse
      if (this.mouseDown && this.combat.weapon().id !== 'fists') this.tryShoot();
    }

    // traffic + peds + police + weather + missions
    if (!this.shotFreeze) {
      // a staged ?shot= frame holds the whole street still, so the crowd
      // gathered for the screenshot stays in frame; live play never sets
      // shotFreeze, so the street always moves there
      this.traffic.update(dt, this.playerPos);
      this.peds.update(dt, this.playerPos, this.playerSpeed, now - this.combat.lastShot < 400);
    }
    const onWater = this.inBoat || this.playerPos.x < -300;
    if (this.shotFreeze) this.police.updateFrozen(this.playerPos);
    else this.police.update(dt, this.playerPos, this.playerSpeed, this.colliders, onWater);
    this.boats.updatePolice(dt, this.playerPos, this.police.wanted);
    this.weather.update(dt, this.playerPos);
    this.particles.update(dt);
    // a staged ?shot= frame freezes the mission clock too, so the TIME
    // badge reads the stage's full limit in the still
    this.missions.update(this.shotFreeze ? 0 : dt);

    // golden hour follows the player: the low sun and its shadow camera
    // stay centred on the action, the sky dome and sun disc on the camera
    this.sunLight.position.set(this.playerPos.x - 120, 60, this.playerPos.z - 80);
    this.sunLight.target.position.copy(this.playerPos);
    this.sunLight.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
    this.sunDisc.position.set(this.camera.position.x - 900, 180, this.camera.position.z + 500);
    this.sunDisc.lookAt(this.camera.position.x, 100, this.camera.position.z);
    // bay swell: gentle vertex waves on the sea plane
    if (this.sea) {
      const pos = this.sea.geometry.attributes.position;
      const base = this.sea.userData.base;
      const t = now / 1000;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        pos.setZ(i, Math.sin(bx * 0.04 + t * 1.2) * 0.35 + Math.cos(by * 0.03 + t * 0.9) * 0.25);
      }
      pos.needsUpdate = true;
      this.sea.geometry.computeVertexNormals();
    }

    // mission stage check (fight stages need live enemy count)
    if (this.missions.active) {
      const st = this.missions.stageTarget();
      if (st && st.type === 'steal') this.ensureStealable(st);
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
        this.hud.showMessage(`${c.kind} found! +$50`, 2);
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
      prompt.textContent = '[F] EXIT';
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
      vehicleName: this.inCar ? this.car.mesh.userData.model.name : (this.inBoat ? this.boats.playerBoat.mesh.userData.model.name : 'ON FOOT'),
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
    this.minimap.drawRadar(this.playerPos, this.camYaw, target, this.police.cars, this.traffic.cars, this.police.wanted);
  }

  die() {
    if (this.dying) return;
    this.dying = true;
    this.player.humanoid.fall(); // tip over on the spot, then wake up in hospital
    setTimeout(() => {
      this.dying = false;
      this.health = 100;
      this.armour = 0;
      this.money = Math.max(0, this.money - 100);
      this.police.clearWanted();
      this.playerPos.set(-240, 0, 280);
      if (this.inCar) { this.inCar = false; this.car.mesh.visible = false; }
      if (this.inBoat) { this.inBoat = false; this.boats.leave(); }
      this.player.mesh.visible = true;
      this.player.humanoid.reset();
      this.player.mesh.position.copy(this.playerPos);
      this.hud.showMessage('You passed out — taken to the hospital. -$100', 4);
    }, 1200);
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
    const dist = this.inCar ? 13 : (this.inBoat ? 12 : (this.camDistOverride || 8.5));
    const height = this.inCar ? 5.5 : (this.inBoat ? 5 : 2.6);
    const tx = focus.x - Math.sin(heading) * dist;
    const tz = focus.z - Math.cos(heading) * dist;
    const ty = focus.y + height + Math.sin(this.camPitch) * 2;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 6);
    // nitro widens the field of view; impacts shake the camera briefly
    const nitroNow = this.inCar && this.input.nitro && this.car.hasNitro && this.nitro > 0;
    const targetFov = nitroNow ? 72 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(focus.x + Math.sin(heading) * 30, focus.y + 1.5, focus.z + Math.cos(heading) * 30);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  try {
    game.init();
  } catch (err) {
    console.error(err);
    document.getElementById('fatal').textContent = 'Game failed to start: ' + (err && err.message);
    document.getElementById('fatal').classList.remove('hidden');
  }
});
