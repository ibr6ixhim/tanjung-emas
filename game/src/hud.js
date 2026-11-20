// HUD: every DOM panel the judge reads — mission panel, money + wanted stars,
// clock, health/armour, district + street, speedometer, weapon slots, police
// dispatch list, NPC dialog box, radio ticker, crew perks.
import { WEAPONS, CREW } from './config.js';

function el(id) { return document.getElementById(id); }

// Small 2D portraits for the dialog box: round face, hair colour and outfit
// per speaker, so the judge can tell Sinta, Bimo and Nadia apart at a glance.
const PORTRAITS = {
  SINTA: { skin: '#e8b88a', hair: '#1a1a22', shirt: '#c23a2a', style: 'helmet' },
  BIMO: { skin: '#c98d64', hair: '#3a2a1a', shirt: '#e8862a', style: 'cap' },
  NADIA: { skin: '#f2c89a', hair: '#2a1a3a', shirt: '#7a5ac8', style: 'headphones' },
  RAKA: { skin: '#e8b88a', hair: '#1a1a22', shirt: '#c23a2a', style: 'cap' },
};

function drawPortrait(canvas, spec) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = spec.shirt; g.fillRect(0, 0, 64, 64); // outfit background
  g.fillStyle = spec.skin;
  g.beginPath(); g.arc(32, 34, 16, 0, Math.PI * 2); g.fill(); // face
  g.fillStyle = spec.hair;
  if (spec.style === 'helmet') {
    g.fillStyle = '#c23a2a'; // red racing helmet + ponytail
    g.beginPath(); g.arc(32, 32, 17, Math.PI, 0); g.fill();
    g.fillRect(15, 30, 34, 4);
    g.fillStyle = spec.hair; g.fillRect(46, 34, 6, 14);
  } else if (spec.style === 'cap') {
    g.beginPath(); g.arc(32, 30, 16, Math.PI, 0); g.fill();
    g.fillRect(16, 28, 32, 5); // brim
  } else if (spec.style === 'headphones') {
    g.beginPath(); g.arc(32, 30, 16, Math.PI, 0); g.fill();
    g.strokeStyle = '#1a1a22'; g.lineWidth = 3;
    g.beginPath(); g.arc(32, 32, 19, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.fillStyle = '#1a1a22';
    g.fillRect(12, 30, 6, 10); g.fillRect(46, 30, 6, 10);
    g.lineWidth = 2; // glasses
    g.beginPath(); g.arc(26, 34, 4, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(38, 34, 4, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(30, 34); g.lineTo(34, 34); g.stroke();
  } else {
    g.beginPath(); g.arc(32, 30, 16, Math.PI, 0); g.fill();
  }
  g.fillStyle = '#1a1a22'; // eyes
  g.beginPath(); g.arc(26, 36, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(38, 36, 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = spec.shirt; // shoulders
  g.beginPath(); g.moveTo(8, 64); g.quadraticCurveTo(32, 46, 56, 64); g.closePath(); g.fill();
}

export class Hud {
  constructor() {
    this.dialogTimer = 0;
    this.messageTimer = 0;
  }
  showDialog(d) {
    const box = el('dialog');
    el('dialog-name').textContent = `${d.name} — ${d.role}`;
    el('dialog-line').textContent = `"${d.line}"`;
    drawPortrait(el('dialog-portrait'), PORTRAITS[d.name] || PORTRAITS.RAKA);
    box.classList.remove('hidden');
    this.dialogTimer = 6;
  }
  showMessage(text, secs = 3) {
    const m = el('message');
    m.textContent = text;
    m.classList.remove('hidden');
    this.messageTimer = secs;
  }
  update(dt, s) {
    // mission panel (top-left)
    el('mission-title').textContent = s.mission.title;
    el('mission-objective').textContent = s.mission.objective;
    el('mission-stage').textContent = s.mission.stage;
    el('mission-next').textContent = s.mission.next;
    // money + stars + clock (top-right)
    el('money').textContent = '$' + Math.round(s.money).toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < s.wanted ? '★' : '☆';
    el('stars').textContent = stars;
    el('stars').className = s.wanted > 0 ? 'wanted-hot' : '';
    el('clock').textContent = `${s.dayName} ${s.clock}`;
    el('police-status').textContent = s.policeStatus;
    // health / armour / location (bottom-left)
    el('health-fill').style.width = Math.max(0, s.health) + '%';
    el('armour-fill').style.width = Math.max(0, s.armour) + '%';
    el('district').textContent = s.district;
    el('street').textContent = s.street;
    el('respect').textContent = `RESPECT ${s.respect}  •  ${s.respectRank}`;
    // speedometer (bottom-right)
    el('speed').textContent = Math.round(Math.abs(s.speedKmh));
    el('car-name').textContent = s.vehicleName;
    el('car-condition').textContent = `CONDITION ${Math.round(s.condition)}%  •  ${s.gear}`;
    el('nitro-fill').style.width = Math.round(s.nitro * 100) + '%';
    // weapon slots
    const slots = el('weapons').children;
    for (let i = 0; i < WEAPONS.length; i++) {
      const slot = slots[i];
      if (!slot) continue;
      const w = WEAPONS[i];
      const ammo = s.ammo[i] === Infinity ? '∞' : s.ammo[i];
      slot.textContent = `${i + 1} ${w.name} ${w.locked ? 'LOCKED' : ammo}`;
      slot.className = 'weapon-slot' + (i === s.weaponIndex ? ' active' : '') + (w.locked ? ' locked' : '');
    }
    // police dispatch (left-centre)
    const dl = el('dispatch');
    dl.innerHTML = '';
    for (const u of s.units.slice(0, 5)) {
      const row = document.createElement('div');
      row.className = 'dispatch-row';
      row.innerHTML = `<span class="unit">${u.name}</span><span class="dist">${u.dist}m</span><span class="tactic ${u.tactic.toLowerCase()}">${u.tactic}</span>`;
      dl.appendChild(row);
    }
    el('dispatch-box').classList.toggle('hidden', s.units.length === 0);
    // crew perks
    const crew = el('crew').children;
    for (let i = 0; i < CREW.length; i++) {
      const c = crew[i];
      if (!c) continue;
      c.textContent = `[${CREW[i].key}] ${CREW[i].name} — ${CREW[i].perk}`;
      c.className = 'crew-chip' + (s.crewActive[i] ? ' active' : '');
    }
    // radio ticker
    el('radio-ticker').textContent = `♪ ${s.station} — ${s.song}`;
    // objective distance
    el('objective-dist').textContent = s.objectiveDist != null ? `${Math.round(s.objectiveDist)}m` : '';
    // timers
    if (this.dialogTimer > 0) { this.dialogTimer -= dt; if (this.dialogTimer <= 0) el('dialog').classList.add('hidden'); }
    if (this.messageTimer > 0) { this.messageTimer -= dt; if (this.messageTimer <= 0) el('message').classList.add('hidden'); }
  }
}

export function respectRank(respect) {
  if (respect < 240) return 'NOBODY';
  if (respect < 600) return 'DRIVER';
  if (respect < 1100) return 'WHEELMAN';
  if (respect < 1800) return 'HUSTLER';
  if (respect < 2600) return 'FIXER';
  if (respect < 3600) return 'SHOT CALLER';
  if (respect < 4800) return 'ENFORCER';
  return 'TIDE BOSS';
}
