// Puerto Brisa 3D — the vault job's planning board.
//
// At any safehouse Rosa can open the board (H): pick the entry, pick
// the escape, pick the crew. The choices are real — entry changes the
// vault guards, escape changes the heat, crew cuts change the payout
// Rosa actually banks when mission 9 completes. Crew skill bars start
// after their printed labels, the way a real board is drawn.

export const HEIST_ENTRIES = [
  { id: 'front', name: 'FRONT GATE', desc: 'In loud through the lobby. Honest, hot.', heat: 1, mult: 1.0 },
  { id: 'dock', name: 'DOCK', desc: 'In by boat at shift change. Quiet, wet.', heat: 0, mult: 1.05 },
  { id: 'roof', name: 'ROOF', desc: 'Down from the roof. Slow, clean.', heat: 0, mult: 0.95 },
];
export const HEIST_ESCAPES = [
  { id: 'seaplane', name: 'SEAPLANE', desc: 'Off the water before they scramble.', heat: 2, mult: 1.1 },
  { id: 'muscle', name: 'MUSCLE CAR', desc: 'Out the front, pedal down.', heat: 1, mult: 1.0 },
  { id: 'tunnel', name: 'SERVICE TUNNEL', desc: 'Gone before the alarm finishes.', heat: 0, mult: 0.9 },
];
export const HEIST_CREW = [
  { id: 'driver', name: 'NICO', role: 'Wheelman', cut: 0.20, skill: 0.86 },
  { id: 'muscle', name: 'BIG RUIZ', role: 'Muscle', cut: 0.18, skill: 0.78 },
  { id: 'tech', name: 'PILAR', role: 'Vault tech', cut: 0.22, skill: 0.92 },
];
export const HEIST_BASE = 48000;

export function planVaultHeist(S) {
  S.heistPlan = {
    entry: 1, escape: 0,
    crew: { driver: true, muscle: true, tech: true },
    row: 0, locked: false,
  };
}

export function heistEntry(S) {
  return HEIST_ENTRIES[S.heistPlan ? S.heistPlan.entry : 1];
}

export function heistEscape(S) {
  return HEIST_ESCAPES[S.heistPlan ? S.heistPlan.escape : 0];
}

export function heistHeat(S) {
  if (!S.heistPlan) return 4;
  return Math.min(5, Math.max(3, 3 + heistEntry(S).heat + heistEscape(S).heat - 1));
}

export function heistPayout(S) {
  if (!S.heistPlan) return Math.round(HEIST_BASE * 0.4);
  let cut = 0;
  for (const c of HEIST_CREW) if (S.heistPlan.crew[c.id]) cut += c.cut;
  return Math.round(HEIST_BASE * (1 - cut) * heistEntry(S).mult * heistEscape(S).mult);
}

// Board controls: W/S (or arrows) choose the row, A/D change the
// choice, 1/2/3 toggle crew members, Enter locks the plan.
export function updateHeistPlanning(S, dt, pressed) {
  const plan = S.heistPlan;
  if (!plan) { planVaultHeist(S); return; }
  const has = (k) => pressed.has(k);
  if (has('w') || has('arrowup')) plan.row = (plan.row + 3) % 4;
  if (has('s') || has('arrowdown')) plan.row = (plan.row + 1) % 4;
  const dir = (has('d') || has('arrowright') ? 1 : 0) - (has('a') || has('arrowleft') ? 1 : 0);
  if (dir) {
    if (plan.row === 0) plan.entry = (plan.entry + dir + HEIST_ENTRIES.length) % HEIST_ENTRIES.length;
    if (plan.row === 1) plan.escape = (plan.escape + dir + HEIST_ESCAPES.length) % HEIST_ESCAPES.length;
  }
  for (let i = 0; i < HEIST_CREW.length; i++) {
    if (has(String(i + 1))) {
      const id = HEIST_CREW[i].id;
      plan.crew[id] = !plan.crew[id];
    }
  }
  if (has('enter') && plan.row === 3) {
    if (S.hooks.onPlanLocked) S.hooks.onPlanLocked(S, plan);
  }
}

export function drawHeistPlanning(S, ctx, W, H) {
  const plan = S.heistPlan || { entry: 1, escape: 0, crew: { driver: true, muscle: true, tech: true }, row: 0 };
  ctx.fillStyle = 'rgba(6,12,20,0.94)';
  ctx.fillRect(0, 0, W, H);

  // Left: the vault diagram with the three entries drawn as routes.
  ctx.strokeStyle = 'rgba(140,220,255,0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(90, 120, 460, 330);
  ctx.strokeRect(300, 240, 120, 90); // the vault room
  ctx.fillStyle = '#ffd34d';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('BANCO DE BRISA — MARINA VAULT', 90, 100);
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('VAULT', 338, 290);
  const routes = [
    { label: 'FRONT GATE', color: '#ff5d47', pts: [[90, 285], [200, 285], [300, 285]] },
    { label: 'DOCK', color: '#38e0c8', pts: [[320, 450], [320, 380], [330, 330]] },
    { label: 'ROOF', color: '#c792ff', pts: [[520, 120], [430, 200], [400, 240]] },
  ];
  routes.forEach((r, i) => {
    ctx.strokeStyle = r.color;
    ctx.lineWidth = plan.entry === i ? 4 : 2;
    ctx.beginPath();
    r.pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.fillStyle = r.color;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(r.label, r.pts[0][0] + 4, r.pts[0][1] - 8);
  });
  ctx.fillStyle = 'rgba(230,242,248,0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Entry routes glow brighter when chosen.', 90, 490);
  ctx.fillText('Crew bars start after their names — nobody works for free.', 90, 514);

  // Right: the choices.
  const X = 620;
  ctx.fillStyle = '#ffd34d';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('THE VAULT OF BRISA — PLAN', X, 84);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#ff8f7a';
  const heat = heistHeat(S);
  ctx.fillText(`EXPECTED HEAT ${'★'.repeat(heat)}${'☆'.repeat(5 - heat)}`, X, 118);
  ctx.fillStyle = '#38e0c8';
  ctx.fillText(`PAYOUT  $${heistPayout(S).toLocaleString('en-US')}  of $${HEIST_BASE.toLocaleString('en-US')}`, X, 144);

  const rows = [
    { label: 'ENTRY', value: `< ${heistEntry(S).name} >`, desc: heistEntry(S).desc },
    { label: 'ESCAPE', value: `< ${heistEscape(S).name} >`, desc: heistEscape(S).desc },
  ];
  rows.forEach((r, i) => {
    const y = 196 + i * 74;
    if (plan.row === i) { ctx.fillStyle = 'rgba(255,211,77,0.14)'; ctx.fillRect(X - 10, y - 24, 560, 58); }
    ctx.fillStyle = '#8fb8c8';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(r.label, X, y);
    ctx.fillStyle = '#e6f2f8';
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillText(r.value, X + 90, y);
    ctx.fillStyle = 'rgba(230,242,248,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(r.desc, X + 90, y + 22);
  });

  // Crew: name, role, cut — then the skill bar AFTER the label text.
  const cy = 360;
  if (plan.row === 2) { ctx.fillStyle = 'rgba(255,211,77,0.14)'; ctx.fillRect(X - 10, cy - 24, 560, 118); }
  ctx.fillStyle = '#8fb8c8';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('CREW  (keys 1–3)', X, cy);
  HEIST_CREW.forEach((c, i) => {
    const y = cy + 26 + i * 28;
    const on = plan.crew[c.id];
    ctx.fillStyle = on ? '#e6f2f8' : 'rgba(230,242,248,0.4)';
    ctx.font = '700 14px system-ui, sans-serif';
    const label = `${i + 1}  ${c.name} — ${c.role}  ·  cut ${Math.round(c.cut * 100)}%`;
    ctx.fillText(label, X + 90, y);
    const barX = X + 90 + ctx.measureText(label).width + 18;
    ctx.strokeStyle = 'rgba(230,242,248,0.4)';
    ctx.strokeRect(barX, y - 11, 110, 10);
    ctx.fillStyle = on ? '#38e0c8' : 'rgba(56,224,200,0.3)';
    ctx.fillRect(barX, y - 11, 110 * c.skill, 10);
  });

  // Lock row.
  const ly = 540;
  if (plan.row === 3) { ctx.fillStyle = 'rgba(56,224,200,0.2)'; ctx.fillRect(X - 10, ly - 26, 560, 44); }
  ctx.fillStyle = '#38e0c8';
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.fillText('LOCK THE PLAN  →  ENTER', X, ly);
  ctx.fillStyle = 'rgba(230,242,248,0.6)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('W/S choose · A/D change · Esc closes', X, ly + 28);
}
