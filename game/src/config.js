// Tanjung Emas — game configuration: city, districts, crew, missions, vehicles,
// weapons, radio and economy. Everything the other modules read lives here so a
// single edit rebalances the whole game.
export const SEED = 7;
export const CITY = {
  size: 1200,          // playable square, metres
  block: 100,          // city block pitch
  road: 16,            // road width
  seaX: -340,          // shoreline: everything west of this is water
  beachX: -300,        // sand strip starts here
};

export const DISTRICTS = [
  { id: 'senja',   name: 'Sunset Beach', color: 0xff9a5c, standing: 'FRIENDLY', bonus: 'Nitro refills 2x faster', center: [-260, 260],  radius: 190 },
  { id: 'pelabuhan', name: 'Old Harbor', color: 0x8a7a5a, standing: 'NEUTRAL',  bonus: 'Garage prices -10%',       center: [-260, -260], radius: 190 },
  { id: 'pusat',   name: 'Downtown',     color: 0x5c8aff, standing: 'NEUTRAL',  bonus: 'Police search 15% shorter', center: [180, 180], radius: 210 },
  { id: 'marina',  name: 'Marina',         color: 0x3fd2c0, standing: 'FRIENDLY', bonus: 'Free boat repairs', center: [180, -260], radius: 170 },
  { id: 'neon',    name: 'Neon Village',   color: 0xff4fd8, standing: 'HOSTILE',  bonus: 'Weapon prices +15%',      center: [420, 60],   radius: 170 },
  { id: 'bukit',   name: 'Golden Hill',  color: 0xffd34f, standing: 'NEUTRAL',  bonus: 'Mission pay +10%',          center: [420, 420],  radius: 180 },
];

export const CREW = [
  { key: 'Z', name: 'Sinta', role: 'Driver',   perk: 'LONG NITRO', desc: 'Nitro lasts 2x longer', active: false },
  { key: 'X', name: 'Bimo',  role: 'Mechanic', perk: 'GARAGE DISCOUNT', desc: 'All garage prices -25% for 60 sec', active: false },
  { key: 'C', name: 'Nadia', role: 'Hacker',   perk: 'CLEAR STAR', desc: 'Removes 1 wanted star (90 sec cooldown)', active: false },
];

export const WEAPONS = [
  { id: 'fists',   name: 'FISTS',    ammo: Infinity, damage: 12, rate: 320, range: 3,   price: 0,    locked: false },
  { id: 'pistol',  name: 'PISTOL',   ammo: 120,      damage: 22, rate: 260, range: 45,  price: 250,  locked: false },
  { id: 'smg',     name: 'SMG',      ammo: 240,      damage: 14, rate: 90,  range: 38,  price: 900,  locked: false },
  { id: 'shotgun', name: 'SHOTGUN',  ammo: 48,       damage: 55, rate: 700, range: 22,  price: 1400, locked: true },
  { id: 'ar',      name: 'ASSAULT',  ammo: 180,      damage: 30, rate: 130, range: 60,  price: 2600, locked: true },
  { id: 'rpg',     name: 'RPG',      ammo: 6,        damage: 120, rate: 1500, range: 70, price: 5200, locked: true },
];

export const CAR_MODELS = [
  { name: 'KANCIL GT',  color: 0xffc93c, top: 42, accel: 16, price: 1200 },
  { name: 'SAGU SEDAN', color: 0x3fa7ff, top: 36, accel: 13, price: 800 },
  { name: 'OMBAK VAN',  color: 0x8a8f98, top: 30, accel: 11, price: 600 },
  { name: 'MERAK S',    color: 0xff4f6d, top: 48, accel: 19, price: 3200 },
  { name: 'BAYU PICKUP',color: 0x59d867, top: 34, accel: 12, price: 950 },
  { name: 'NUSA COUPE', color: 0xb46bff, top: 45, accel: 17, price: 2400 },
];

export const BOAT_MODELS = [
  { name: 'SAILBOAT', color: 0xf2ead8, top: 26, price: 0 },
  { name: 'SPEEDBOAT',    color: 0xff5a3c, top: 40, price: 1500 },
];

export const GARAGE_ITEMS = [
  { id: 'repair',  name: 'REPAIR',       desc: 'Repair the car to 100%',      price: 250 },
  { id: 'respray', name: 'RESPRAY',      desc: 'Fresh paint — wanted clears instantly', price: 400 },
  { id: 'tune',    name: 'TUNE ENGINE',  desc: '+12% top speed',                  price: 1800 },
  { id: 'armour',  name: 'ARMOUR PLATE', desc: 'Car takes 2x less bullet damage',   price: 2400 },
  { id: 'nitro',   name: 'NITRO KIT',    desc: 'Install nitro (Shift to boost)', price: 1500 },
];

export const RADIO_STATIONS = [
  { id: 'senja', name: 'DUSK FM 98.1', genre: 'SYNTHWAVE',
    songs: ['Kip Sorrento — Arepa Lights', 'Luna Shore — Drive Into Dusk', 'Neon Wave — Golden Hour Run'] },
  { id: 'pantai', name: 'SHORE TUNES 101.5', genre: 'ISLAND POP',
    songs: ['Dara Strait — Morning Waves', 'Three Brothers — Dusk Coffee', 'Mira Sea — Way Home'] },
];

// 8 story missions. Each stage: { text, type, target:[x,z], dialog:{name,role,line} }.
// Types: goto (walk/drive to marker), steal (steal the marked car), chase (reach marker
// while wanted), fight (defeat all enemies at marker), boat (board boat, reach marker),
// deliver (drive the marked car to marker), storm (reach marker in the storm).
export const MISSIONS = [
  { id: 1, name: 'Morning at Sunset Beach', pay: 400, stages: [
    { text: 'Meet Sinta on the Sunset Beach boulevard', type: 'goto', target: [-240, 200], dialog: { name: 'SINTA', role: 'Driver', line: 'Raka! You finally came home. This city needs a fearless driver.' } },
    { text: 'Steal the car parked at the curb', type: 'steal', target: [-200, 160], dialog: { name: 'SINTA', role: 'Driver', line: 'The red one. Quick, before its owner comes back!' } },
    { text: 'Drive Sinta to the Old Harbor', type: 'deliver', target: [-240, -220], dialog: { name: 'SINTA', role: 'Driver', line: 'Nice. You still have the golden touch, Raka.' } },
  ]},
  { id: 2, name: 'Neon Village Debt', pay: 700, stages: [
    { text: 'Meet Bimo at the Neon Village garage', type: 'goto', target: [400, 40], dialog: { name: 'BIMO', role: 'Mechanic', line: 'The Neon gang is collecting my debt. They are coming armed.' } },
    { text: 'Take out the debt collectors in the back alley', type: 'fight', target: [440, 90], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Do not hesitate. They will not stop.' } },
    { text: 'Head back to Bimo\u2019s garage', type: 'goto', target: [400, 40], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Debt paid. This garage is ours now.' } },
  ]},
  { id: 3, name: 'Marina Escape', pay: 900, stages: [
    { text: 'Meet Nadia at the Marina', type: 'goto', target: [180, -240], dialog: { name: 'NADIA', role: 'Hacker', line: 'I already hacked the harbor cameras. We have 5 minutes.' } },
    { text: 'Steal the speedboat at the east dock', type: 'boat', target: [-322, -302], dialog: { name: 'NADIA', role: 'Hacker', line: 'Get in! The water police will never expect us to go by sea.' } },
    { text: 'Escape to the far end of the bay by boat', type: 'boat', target: [-380, -320], dialog: { name: 'NADIA', role: 'Hacker', line: 'They lost our trail. Good work, captain.' } },
  ]},
  { id: 4, name: 'Golden Hill Race', pay: 1200, stages: [
    { text: 'Sign up for the race at Golden Hill', type: 'goto', target: [420, 400], dialog: { name: 'SINTA', role: 'Driver', line: 'Tonight\u2019s prize: 1,200. Win, and our name rises.' } },
    { text: 'Win the street race (clear 3 checkpoints)', type: 'chase', target: [300, 300], dialog: { name: 'SINTA', role: 'Driver', line: 'Do not brake in the corners! Full throttle!' } },
    { text: 'Collect the prize at the finish line', type: 'deliver', target: [480, 480], dialog: { name: 'SINTA', role: 'Driver', line: 'Champion! Golden Hill knows the name Raka now.' } },
  ]},
  { id: 5, name: 'Old Harbor Cargo', pay: 1500, stages: [
    { text: 'Grab the cargo truck at the dock', type: 'steal', target: [-280, -200], dialog: { name: 'BIMO', role: 'Mechanic', line: 'That truck is full of smuggled goods. Drive gently.' } },
    { text: 'Dodge the police and deliver the cargo to the warehouse', type: 'deliver', target: [-180, -300], dialog: { name: 'BIMO', role: 'Mechanic', line: 'They are onto us. Do not stop!' } },
    { text: 'Hand the cargo to the fence at the warehouse', type: 'goto', target: [-160, -320], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Done. That fence will not forget you.' } },
  ]},
  { id: 6, name: 'Downtown Ambush', pay: 1800, stages: [
    { text: 'Meet the informant in Downtown', type: 'goto', target: [150, 100], dialog: { name: 'NADIA', role: 'Hacker', line: 'The Neon gang convoy passes here at 6 PM. We ambush it.' } },
    { text: 'Take out the convoy guards', type: 'fight', target: [220, 220], dialog: { name: 'NADIA', role: 'Hacker', line: 'Here they come! Take cover!' } },
    { text: 'Steal the convoy car and run', type: 'steal', target: [250, 200], dialog: { name: 'NADIA', role: 'Hacker', line: 'That car is ours now. Go!' } },
    { text: 'Take the car to the Sunset Beach safehouse', type: 'deliver', target: [-240, 300], dialog: { name: 'NADIA', role: 'Hacker', line: 'Perfect. No one knows we are here.' } },
  ]},
  { id: 7, name: 'Storm in the Strait', pay: 2200, storm: true, stages: [
    { text: 'The storm is coming — meet Sinta at the lighthouse', type: 'storm', target: [-310, 60], dialog: { name: 'SINTA', role: 'Driver', line: 'Heavy rain, slick roads. But this is the only way out.' } },
    { text: 'Steal a boat and cross the strait in the storm', type: 'boat', target: [-380, -100], dialog: { name: 'SINTA', role: 'Driver', line: 'Huge waves! Hold the wheel tight!' } },
    { text: 'Reach the hidden dock', type: 'boat', target: [-340, -280], dialog: { name: 'SINTA', role: 'Driver', line: 'We made it. The storm covered our trail.' } },
  ]},
  { id: 8, name: 'King of Tanjung Emas', pay: 3000, stages: [
    { text: 'Gather the crew at the Neon Village hideout', type: 'goto', target: [400, 60], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Everyone is ready. Tonight we take the city.' } },
    { text: 'Storm the Neon gang hideout', type: 'fight', target: [460, 120], dialog: { name: 'NADIA', role: 'Hacker', line: 'I already killed their alarm. Go in!' } },
    { text: 'Face the gang boss on the hideout roof', type: 'fight', target: [480, 140], dialog: { name: 'SINTA', role: 'Driver', line: 'There he is. End this, Raka.' } },
    { text: 'Return to Sunset Beach as a legend', type: 'goto', target: [-282, 260], dialog: { name: 'SINTA', role: 'Driver', line: 'Tanjung Emas is ours now.' } },
  ]},
];

export const POLICE_UNITS = ['PATROL-3', 'PATROL-7', 'PATROL-11', 'PATROL-19', 'PATROL-23', 'PATROL-31'];
export const AIR_UNITS = ['EAGLE-1', 'EAGLE-2'];
export const WATER_UNITS = ['SEA-5', 'SEA-9'];

export const COLLECTIBLES = [
  { id: 'gecko', name: 'Golden Gecko', total: 20 },
  { id: 'tape', name: 'Sunset Tape', total: 20 },
];

export const ECONOMY = { startMoney: 350, respectPerMission: 240 };
