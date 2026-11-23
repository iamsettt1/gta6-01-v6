// Puerto Brisa 3D — garages and the phone.
//
// Two garages re-spray and tune whatever Rosa is driving (R repaints,
// T buys the next tuning tier). The phone (P) lists the city's
// contacts; the last one is El Arreglador, the fixer who — for
// $1,500 and a minute of quiet — makes one wanted star go away.

import { showMessage, showDialogue } from './config.js';
import { clearWantedStars, wantedStars } from './police-pursuit.js';
import { VEHICLE_CLASSES } from './vehicles-3d.js';

export const GARAGES = [
  { name: 'Taller Hermanos', x: 4350, y: 760 },
  { name: 'Puerto Paint', x: 1150, y: 1560 },
];
export const REPAINT_COST = 250;
export const TUNE_COST = 800;
export const BRIBE_COST = 1500;

export function garageNear(S) {
  const p = S.player;
  if (!p.inVehicle) return null;
  for (const g of GARAGES) {
    if (Math.hypot(p.inVehicle.x - g.x, p.inVehicle.y - g.y) < 150) return g;
  }
  return null;
}

export function repaintVehicle(S) {
  const veh = S.player.inVehicle;
  if (!veh || !garageNear(S)) return false;
  if (S.progress.cash < REPAINT_COST) { showMessage(S, `A re-spray is $${REPAINT_COST}.`); return true; }
  S.progress.cash -= REPAINT_COST;
  const colors = VEHICLE_CLASSES[veh.cls].colors;
  const at = colors.indexOf(veh.color);
  veh.color = colors[(at + 1) % colors.length];
  showMessage(S, `Fresh paint — $${REPAINT_COST}.`, 2.6);
  return true;
}

export function tuneVehicle(S) {
  const veh = S.player.inVehicle;
  if (!veh || !garageNear(S)) return false;
  veh.tuneStage = veh.tuneStage || 0;
  if (veh.tuneStage >= 4) { showMessage(S, 'Fully tuned — she sings already.'); return true; }
  if (S.progress.cash < TUNE_COST) { showMessage(S, `Tuning is $${TUNE_COST} a tier.`); return true; }
  S.progress.cash -= TUNE_COST;
  veh.tuneStage++;
  // Alternate engine and grip tiers.
  if (veh.tuneStage % 2 === 1) veh.topMult = 1 + 0.09 * Math.ceil(veh.tuneStage / 2);
  else veh.gripMult = 1 + 0.08 * (veh.tuneStage / 2);
  showMessage(S, `Tuning tier ${veh.tuneStage}/4 — $${TUNE_COST}.`, 2.6);
  return true;
}

// --- Phone ------------------------------------------------------------

export const PHONE_CONTACTS = [
  { name: 'Tomás Ibarra', desc: 'Jobs and the Herrera war',
    line: 'Rosa. The board at the safehouse, the vault when you are ready. No sooner.' },
  { name: 'Lucía Ferrer', desc: 'The race league',
    line: 'Harbour Circuit whenever you want it, chica. My three are already scared.' },
  { name: 'Capt. Elías Ruiz', desc: 'Bounty board',
    line: 'Four names, Rosa. Alive pays. The plaza one calls himself El Cuervo.' },
  { name: 'El Arreglador', desc: 'Clear one wanted star — $1,500',
    line: 'One star, forgotten. Cash only, and give me a minute to forget it.' },
];

export function updatePhone(S, dt, pressed) {
  const ph = S.phone;
  const has = (k) => pressed.has(k);
  if (has('w') || has('arrowup')) ph.idx = (ph.idx + PHONE_CONTACTS.length - 1) % PHONE_CONTACTS.length;
  if (has('s') || has('arrowdown')) ph.idx = (ph.idx + 1) % PHONE_CONTACTS.length;
  if (has('enter')) {
    const c = PHONE_CONTACTS[ph.idx];
    if (ph.idx === PHONE_CONTACTS.length - 1) {
      // The fixer's deal.
      if (wantedStars(S) <= 0) { showMessage(S, 'No heat to clear. Save the cash.'); return; }
      if (S.t - (ph.bribeAt || -999) < 60) { showMessage(S, 'El Arreglador needs a minute between favours.'); return; }
      if (S.progress.cash < BRIBE_COST) { showMessage(S, `The fixer charges $${BRIBE_COST}.`); return; }
      S.progress.cash -= BRIBE_COST;
      ph.bribeAt = S.t;
      clearWantedStars(S, 1);
      showMessage(S, 'One star, forgotten. — El Arreglador', 3.5);
    } else {
      showDialogue(S, c.name, c.line, '#9fd8ff', 5);
    }
  }
}

export function drawPhone(S, ctx, W, H) {
  const ph = S.phone;
  const pw = 300, ph2 = 400;
  const x = W - pw - 26, y = 120;
  ctx.fillStyle = 'rgba(10,16,24,0.94)';
  ctx.strokeStyle = 'rgba(140,220,255,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, pw, ph2, 18);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.fillText('BRISA MOBILE', x + 20, y + 32);
  ctx.fillStyle = 'rgba(230,242,248,0.55)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('4 contacts · signal strong · La Madre approaching', x + 20, y + 52);
  PHONE_CONTACTS.forEach((c, i) => {
    const cy = y + 84 + i * 66;
    if (i === ph.idx) {
      ctx.fillStyle = 'rgba(255,211,77,0.16)';
      roundRect(ctx, x + 10, cy - 22, pw - 20, 56, 10);
      ctx.fill();
    }
    ctx.fillStyle = '#e6f2f8';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(c.name, x + 22, cy);
    ctx.fillStyle = 'rgba(230,242,248,0.65)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(c.desc, x + 22, cy + 19);
  });
  ctx.fillStyle = 'rgba(230,242,248,0.55)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('W/S choose · Enter call · P/Esc hang up', x + 20, y + ph2 - 16);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

