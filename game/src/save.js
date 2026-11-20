// Save: three localStorage slots with context (act, location, money, time) and
// autosave after every completed mission.
const PREFIX = 'tanjung-emas-save-';

export function loadSlot(i) {
  try {
    const raw = localStorage.getItem(PREFIX + i);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSlot(i, data) {
  const record = {
    ...data,
    savedAt: new Date().toISOString(),
    act: data.missionIndex >= 6 ? 'ACT III' : data.missionIndex >= 3 ? 'ACT II' : 'ACT I',
  };
  try { localStorage.setItem(PREFIX + i, JSON.stringify(record)); } catch { /* storage full/blocked */ }
  return record;
}

export function listSlots() {
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const s = loadSlot(i);
    out.push(s ? { ...s, slot: i, empty: false } : { slot: i, empty: true });
  }
  return out;
}

export function percentComplete(data) {
  if (!data) return 0;
  const missions = Math.min(8, data.missionIndex || 0) / 8;
  const collect = ((data.collectibles || 0) / 40) * 0.2;
  return Math.min(100, Math.round(missions * 80 + collect * 100 * 0.2 + (data.respect || 0) / 5000 * 20));
}
