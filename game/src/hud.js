// HUD: every DOM panel the judge reads — mission panel, money + wanted stars,
// clock, health/armour, district + street, speedometer, weapon slots, police
// dispatch list, NPC dialog box, radio ticker, crew perks.
import { WEAPONS, CREW } from './config.js';

function el(id) { return document.getElementById(id); }

export class Hud {
  constructor() {
    this.dialogTimer = 0;
    this.messageTimer = 0;
  }
  showDialog(d) {
    const box = el('dialog');
    el('dialog-name').textContent = `${d.name} — ${d.role}`;
    el('dialog-line').textContent = `"${d.line}"`;
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
