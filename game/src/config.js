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
  { id: 'senja',   name: 'Pantai Senja',   color: 0xff9a5c, standing: 'FRIENDLY', bonus: 'Nitro isi 2x lebih cepat', center: [-260, 260],  radius: 190 },
  { id: 'pelabuhan', name: 'Pelabuhan Tua', color: 0x8a7a5a, standing: 'NEUTRAL',  bonus: 'Harga garage -10%',       center: [-260, -260], radius: 190 },
  { id: 'pusat',   name: 'Kota Pusat',     color: 0x5c8aff, standing: 'NEUTRAL',  bonus: 'Polisi cari 15% lebih singkat', center: [180, 180], radius: 210 },
  { id: 'marina',  name: 'Marina',         color: 0x3fd2c0, standing: 'FRIENDLY', bonus: 'Perahu gratis diperbaiki', center: [180, -260], radius: 170 },
  { id: 'neon',    name: 'Kampung Neon',   color: 0xff4fd8, standing: 'HOSTILE',  bonus: 'Harga senjata +15%',      center: [420, 60],   radius: 170 },
  { id: 'bukit',   name: 'Bukit Kencana',  color: 0xffd34f, standing: 'NEUTRAL',  bonus: 'Uang misi +10%',          center: [420, 420],  radius: 180 },
];

export const CREW = [
  { key: 'Z', name: 'Sinta', role: 'Driver',   perk: 'NITRO PANJANG', desc: 'Nitro bertahan 2x lebih lama', active: false },
  { key: 'X', name: 'Bimo',  role: 'Mechanic', perk: 'DISKON GARAGE', desc: 'Semua harga garage -25% selama 60 dtk', active: false },
  { key: 'C', name: 'Nadia', role: 'Hacker',   perk: 'HAPUS BINTANG', desc: 'Menghapus 1 bintang wanted (cooldown 90 dtk)', active: false },
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
  { name: 'OMBak VAN',  color: 0x8a8f98, top: 30, accel: 11, price: 600 },
  { name: 'MERAK S',    color: 0xff4f6d, top: 48, accel: 19, price: 3200 },
  { name: 'BAYU PICKUP',color: 0x59d867, top: 34, accel: 12, price: 950 },
  { name: 'NUSA COUPE', color: 0xb46bff, top: 45, accel: 17, price: 2400 },
];

export const BOAT_MODELS = [
  { name: 'PERAHU LAYAR', color: 0xf2ead8, top: 26, price: 0 },
  { name: 'SPEEDBOAT',    color: 0xff5a3c, top: 40, price: 1500 },
];

export const GARAGE_ITEMS = [
  { id: 'repair',  name: 'REPAIR',       desc: 'Perbaiki mobil sampai 100%',      price: 250 },
  { id: 'respray', name: 'RESPRAY',      desc: 'Cat baru — wanted langsung hilang', price: 400 },
  { id: 'tune',    name: 'TUNE ENGINE',  desc: '+12% top speed',                  price: 1800 },
  { id: 'armour',  name: 'ARMOUR PLATE', desc: 'Mobil tahan tembakan 2x lipat',   price: 2400 },
  { id: 'nitro',   name: 'NITRO KIT',    desc: 'Pasang nitro (Shift untuk boost)', price: 1500 },
];

export const RADIO_STATIONS = [
  { id: 'senja', name: 'SENJA FM 98.1', genre: 'SYNTHWAVE',
    songs: ['Kip Sorrento — Arepa Lights', 'Luna Pantai — Drive Into Dusk', 'Neon Ombak — Golden Hour Run'] },
  { id: 'pantai', name: 'LAGU PANTAI 101.5', genre: 'ISLAND POP',
    songs: ['Dara Selat — Ombak Pagi', 'Tiga Saudara — Kopi Senja', 'Mira Laut — Jalan Pulang'] },
];

// 8 story missions. Each stage: { text, type, target:[x,z], dialog:{name,role,line} }.
// Types: goto (walk/drive to marker), steal (steal the marked car), chase (reach marker
// while wanted), fight (defeat all enemies at marker), boat (board boat, reach marker),
// deliver (drive the marked car to marker), storm (reach marker in the storm).
export const MISSIONS = [
  { id: 1, name: 'Pagi di Pantai Senja', pay: 400, stages: [
    { text: 'Temui Sinta di boulevard Pantai Senja', type: 'goto', target: [-240, 200], dialog: { name: 'SINTA', role: 'Driver', line: 'Raka! Akhirnya pulang juga. Kota ini butuh sopir yang berani.' } },
    { text: 'Curi mobil yang terparkir di tepi jalan', type: 'steal', target: [-200, 160], dialog: { name: 'SINTA', role: 'Driver', line: 'Yang merah itu. Cepat, sebelum pemiliknya kembali!' } },
    { text: 'Antar Sinta ke Pelabuhan Tua', type: 'deliver', target: [-240, -220], dialog: { name: 'SINTA', role: 'Driver', line: 'Bagus. Kau masih punya tangan emas, Raka.' } },
  ]},
  { id: 2, name: 'Utang Kampung Neon', pay: 700, stages: [
    { text: 'Temui Bimo di bengkel Kampung Neon', type: 'goto', target: [400, 40], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Geng Neon menagih utangku. Mereka datang dengan senjata.' } },
    { text: 'Habisi penagih utang di gang belakang', type: 'fight', target: [440, 90], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Jangan ragu. Mereka tidak akan berhenti.' } },
    { text: 'Kembali ke bengkel Bimo', type: 'goto', target: [400, 40], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Utang lunas. Bengkel ini sekarang milik kita berdua.' } },
  ]},
  { id: 3, name: 'Pelarian Marina', pay: 900, stages: [
    { text: 'Temui Nadia di Marina', type: 'goto', target: [180, -240], dialog: { name: 'NADIA', role: 'Hacker', line: 'Aku sudah meretas kamera pelabuhan. Kita punya 5 menit.' } },
    { text: 'Curi speedboat di dermaga timur', type: 'boat', target: [300, -300], dialog: { name: 'NADIA', role: 'Hacker', line: 'Naik! Polisi air tidak akan menyangka kita lewat laut.' } },
    { text: 'Kabur ke ujung teluk dengan perahu', type: 'boat', target: [-280, -320], dialog: { name: 'NADIA', role: 'Hacker', line: 'Mereka kehilangan jejak kita. Kerja bagus, kapten.' } },
  ]},
  { id: 4, name: 'Balapan Bukit Kencana', pay: 1200, stages: [
    { text: 'Daftar balapan di Bukit Kencana', type: 'goto', target: [420, 400], dialog: { name: 'SINTA', role: 'Driver', line: 'Taruhan malam ini: 1.200. Menang, dan nama kita naik.' } },
    { text: 'Menangkan balapan jalanan (lewati 3 checkpoint)', type: 'chase', target: [300, 300], dialog: { name: 'SINTA', role: 'Driver', line: 'Jangan rem di tikungan! Gas terus!' } },
    { text: 'Ambil hadiah di garis finis', type: 'deliver', target: [480, 480], dialog: { name: 'SINTA', role: 'Driver', line: 'Juara! Bukit Kencana sekarang kenal nama Raka.' } },
  ]},
  { id: 5, name: 'Kargo Pelabuhan Tua', pay: 1500, stages: [
    { text: 'Ambil truk kargo di dermaga', type: 'steal', target: [-280, -200], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Truk itu penuh barang selundupan. Bawa pelan-pelan.' } },
    { text: 'Hindari polisi dan antar kargo ke gudang', type: 'deliver', target: [-180, -300], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Mereka mengendus kita. Jangan berhenti!' } },
    { text: 'Serahkan kargo ke penadah di gudang', type: 'goto', target: [-160, -320], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Beres. Penadah itu tidak akan melupakanmu.' } },
  ]},
  { id: 6, name: 'Penyergapan Kota Pusat', pay: 1800, stages: [
    { text: 'Temui informan di Kota Pusat', type: 'goto', target: [160, 160], dialog: { name: 'NADIA', role: 'Hacker', line: 'Konvoi geng Neon lewat sini jam 6 sore. Kita sergap.' } },
    { text: 'Habisi pengawal konvoi', type: 'fight', target: [220, 220], dialog: { name: 'NADIA', role: 'Hacker', line: 'Mereka datang! Cari perlindungan!' } },
    { text: 'Curi mobil konvoi dan kabur', type: 'steal', target: [240, 240], dialog: { name: 'NADIA', role: 'Hacker', line: 'Mobil itu milik kita sekarang. Pergi!' } },
    { text: 'Bawa mobil ke safehouse Pantai Senja', type: 'deliver', target: [-240, 280], dialog: { name: 'NADIA', role: 'Hacker', line: 'Sempurna. Tidak ada yang tahu kita di sini.' } },
  ]},
  { id: 7, name: 'Badai di Selat', pay: 2200, storm: true, stages: [
    { text: 'Badai datang — temui Sinta di mercusuar', type: 'storm', target: [-320, 60], dialog: { name: 'SINTA', role: 'Driver', line: 'Hujan deras, jalan licin. Tapi ini satu-satunya jalan keluar.' } },
    { text: 'Curi perahu dan lintasi selat di tengah badai', type: 'boat', target: [-380, -100], dialog: { name: 'SINTA', role: 'Driver', line: 'Ombak besar! Pegang kemudi kuat-kuat!' } },
    { text: 'Sampai ke dermaga tersembunyi', type: 'boat', target: [-340, -280], dialog: { name: 'SINTA', role: 'Driver', line: 'Kita lolos. Badai menutupi jejak kita.' } },
  ]},
  { id: 8, name: 'Raja Tanjung Emas', pay: 3000, stages: [
    { text: 'Kumpulkan kru di markas Kampung Neon', type: 'goto', target: [400, 60], dialog: { name: 'BIMO', role: 'Mechanic', line: 'Semua sudah siap. Malam ini kita ambil alih kota.' } },
    { text: 'Serbu markas geng Neon', type: 'fight', target: [460, 120], dialog: { name: 'NADIA', role: 'Hacker', line: 'Alarmmu sudah kumatikan. Masuk!' } },
    { text: 'Hadapi bos geng di atap markas', type: 'fight', target: [480, 140], dialog: { name: 'SINTA', role: 'Driver', line: 'Itu dia. Akhiri ini, Raka.' } },
    { text: 'Kembali ke Pantai Senja sebagai legenda', type: 'goto', target: [-260, 260], dialog: { name: 'SINTA', role: 'Driver', line: 'Tanjung Emas sekarang milik kita.' } },
  ]},
];

export const POLICE_UNITS = ['PATROLI-3', 'PATROLI-7', 'PATROLI-11', 'PATROLI-19', 'PATROLI-23', 'PATROLI-31'];
export const AIR_UNITS = ['ELANG-1', 'ELANG-2'];
export const WATER_UNITS = ['LAUT-5', 'LAUT-9'];

export const COLLECTIBLES = [
  { id: 'gecko', name: 'Golden Gecko', total: 20 },
  { id: 'tape', name: 'Sunset Tape', total: 20 },
];

export const ECONOMY = { startMoney: 350, respectPerMission: 240 };
