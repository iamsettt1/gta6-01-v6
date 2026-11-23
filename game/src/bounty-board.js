// Puerto Brisa 3D — Capt. Ruiz's bounty board: four named targets
// who hold their turf around the city. Brought in alive (walk up and
// press F) pays full price plus the alive bonus; brought in cold
// pays half. EL CUERVO holds the Mirador plaza itself.

import { showMessage } from './config.js';
import { spawnPedestrian } from './traffic-ai.js';

const TARGET_DEFS = [
  { name: 'EL CUERVO', x: 700, y: 800, reward: 6500, shirt: '#1c1c22' },
  { name: 'LA VIUDA', x: 2900, y: 2100, reward: 5200, shirt: '#3a2b4f' },
  { name: 'MARCO EL BREVE', x: 4600, y: 900, reward: 5800, shirt: '#5a4632' },
  { name: 'SABLE', x: 6000, y: 2400, reward: 7100, shirt: '#24404f' },
];
export const ALIVE_BONUS = 0.25;

export function createBounties(S) {
  S.bounties = TARGET_DEFS.map((t, i) => ({ ...t, idx: i, caught: false, paid: false, ped: null }));
  for (const b of S.bounties) {
    const ped = spawnPedestrian(S, b.x, b.y, 'bounty', { shirt: b.shirt, weapon: 'pistol' });
    ped.name = b.name;
    ped.bountyIdx = b.idx;
    b.ped = ped;
  }
}

// Cold deliveries are settled here: a target found dead pays half,
// once. (Alive capture is tryCaptureBounty, called from the F key.)
export function updateBounties(S) {
  for (const b of S.bounties) {
    if (b.caught || b.paid || !b.ped) continue;
    if (b.ped.dead) {
      b.paid = true;
      const pay = Math.floor(b.reward / 2);
      S.progress.cash += pay;
      showMessage(S, `${b.name} brought in cold — $${pay.toLocaleString('en-US')}. Ruiz pays half for cold.`, 4.5);
    }
  }
}

// The nearest living target within arm's reach of Rosa, or null.
export function bountyTargetNear(S, radius) {
  const p = S.player;
  if (p.inVehicle) return null;
  let best = null, bestD = radius || 75;
  for (const b of S.bounties) {
    if (b.caught || !b.ped || b.ped.dead) continue;
    const d = Math.hypot(b.ped.x - p.x, b.ped.y - p.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function tryCaptureBounty(S) {
  const b = bountyTargetNear(S, 75);
  if (!b) return false;
  b.caught = true;
  b.paid = true;
  const pay = b.reward + Math.round(b.reward * ALIVE_BONUS);
  S.progress.cash += pay;
  S.progress.bountiesCaught.push(b.name);
  const at = S.peds.indexOf(b.ped);
  if (at >= 0) S.peds.splice(at, 1);
  showMessage(S, `${b.name} taken alive — $${pay.toLocaleString('en-US')} with the alive bonus.`, 5);
  if (S.hooks.onBountyCaught) S.hooks.onBountyCaught(S, b);
  return true;
}
