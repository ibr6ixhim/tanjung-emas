// Minimap: the circular radar (bottom-left) and the full pause map (M key) with
// districts, icons, mission list, career stats and save slots.
import { DISTRICTS, MISSIONS } from './config.js';

const MAP_COLORS = { road: '#3a3540', block: '#241f2e', sea: '#1f6f8b', sand: '#c8a86a', player: '#ffd34f', police: '#ff3a3a', mission: '#ffd34f' };

export class Minimap {
  constructor() {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.mapCanvas = document.getElementById('fullmap');
    this.mapCtx = this.mapCanvas.getContext('2d');
  }
  drawRadar(player, heading, target, policeUnits, cars) {
    const ctx = this.ctx, W = 190, H = 190;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 92, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#12101c'; ctx.fillRect(0, 0, W, H);
    const scale = 190 / 320; // show ~320m around the player
    const cx = W / 2, cy = H / 2;
    const toMap = (x, z) => [cx + (x - player.x) * scale, cy + (z - player.z) * scale];
    // sea + sand on the west
    ctx.fillStyle = MAP_COLORS.sea; ctx.fillRect(0, 0, Math.max(0, cx + (-340 - player.x) * scale), H);
    ctx.fillStyle = MAP_COLORS.sand; ctx.fillRect(Math.max(0, cx + (-300 - player.x) * scale), 0, 12, H);
    // roads
    ctx.strokeStyle = MAP_COLORS.road; ctx.lineWidth = 5;
    for (let v = -500; v <= 500; v += 100) {
      const [ax, ay] = toMap(v, -500); const [bx, by] = toMap(v, 500);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx2, cy2] = toMap(-500, v); const [dx2, dy2] = toMap(500, v);
      ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(dx2, dy2); ctx.stroke();
    }
    // mission marker
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      ctx.fillStyle = MAP_COLORS.mission;
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // police dots
    ctx.fillStyle = MAP_COLORS.police;
    for (const u of policeUnits) {
      const [px, py] = toMap(u.x, u.z);
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    }
    // north marker
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('N', cx + Math.sin(heading) * 0, cy - 78);
    // player arrow (always up)
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(0);
    ctx.fillStyle = MAP_COLORS.player;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 92, 0, Math.PI * 2); ctx.stroke();
  }
  drawFullMap(player, target, stats, missionList, saveSlots) {
    const ctx = this.mapCtx, W = this.mapCanvas.width, H = this.mapCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#14111d'; ctx.fillRect(0, 0, W, H);
    const scale = W / 1300;
    const toMap = (x, z) => [(x + 650) * scale, (z + 650) * scale];
    // sea + beach
    ctx.fillStyle = MAP_COLORS.sea; ctx.fillRect(0, 0, (-340 + 650) * scale, H);
    ctx.fillStyle = MAP_COLORS.sand; ctx.fillRect((-300 + 650) * scale, 0, 10, H);
    // roads
    ctx.strokeStyle = MAP_COLORS.road; ctx.lineWidth = 4;
    for (let v = -500; v <= 500; v += 100) {
      const [ax, ay] = toMap(v, -500); const [bx, by] = toMap(v, 500);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const [cx2, cy2] = toMap(-500, v); const [dx2, dy2] = toMap(500, v);
      ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(dx2, dy2); ctx.stroke();
    }
    // districts: label offset away from the sea on the west side, with a
    // dark pill behind the text so it stays readable over roads and water
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [dx, dy] = toMap(d.center[0], d.center[1]);
      const lx = Math.max(58, Math.min(W - 58, dx + (d.center[0] < 0 ? 48 : -48)));
      const name = d.name.toUpperCase();
      ctx.font = 'bold 11px Arial';
      const pw = Math.max(ctx.measureText(name).width, ctx.measureText(d.standing).width) + 10;
      ctx.fillStyle = 'rgba(8,6,16,0.65)';
      ctx.fillRect(lx - pw / 2, dy - 42, pw, 30);
      ctx.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
      ctx.fillText(name, lx, dy - 30);
      ctx.fillStyle = '#999'; ctx.font = '10px Arial';
      ctx.fillText(d.standing, lx, dy - 16);
    }
    // icons: garage, safehouse, gun shop, race, police station. GUN SHOP's
    // label goes on the left of its dot: on the right it piled onto the
    // GARAGE label 20 m above it
    const icons = [
      { x: 400, y: 20, label: 'GARAGE', c: '#4ecdc4' }, { x: -240, y: 280, label: 'SAFEHOUSE', c: '#95e1d3' },
      { x: 420, y: 60, label: 'GUN SHOP', c: '#ff6b6b', side: 'left' }, { x: 420, y: 400, label: 'RACE', c: '#ffe66d' },
      { x: 180, y: 180, label: 'POLICE', c: '#ff3a3a' }, { x: 180, y: -260, label: 'MARINA', c: '#3fd2c0' },
    ];
    for (const ic of icons) {
      const [ix, iy] = toMap(ic.x, ic.y);
      ctx.fillStyle = ic.c;
      ctx.beginPath(); ctx.arc(ix, iy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial';
      if (ic.side === 'left') { ctx.textAlign = 'right'; ctx.fillText(ic.label, ix - 10, iy + 3); }
      else { ctx.textAlign = 'left'; ctx.fillText(ic.label, ix + 10, iy + 3); }
    }
    // mission marker + player
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      ctx.fillStyle = MAP_COLORS.mission;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    const [px, py] = toMap(player.x, player.z);
    ctx.fillStyle = MAP_COLORS.player;
    ctx.beginPath(); ctx.moveTo(px, py - 10); ctx.lineTo(px + 8, py + 8); ctx.lineTo(px - 8, py + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    // side lists (drawn as DOM in index.html; here we only return data)
    return { stats, missionList, saveSlots };
  }
}
