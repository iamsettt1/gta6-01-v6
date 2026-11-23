// Puerto Brisa 3D — side life: twelve collectible shells on the
// scenic spots, taxi fares when Rosa drives a cab, and the three
// Mirador territory blocks (wave defence, then a timed hold) that
// fly teal once taken.

import { showMessage, showBanner } from './config.js';
import { nearestRoadPoint } from './city-world.js';
import { spawnPedestrian } from './traffic-ai.js';

const SHELL_SPOTS = [
  [300, 2900], [4900, 3050], [6600, 3050], [6420, 2820], [250, 300],
  [5170, 1560], [840, 900], [3000, 2500], [4280, 2900], [5960, 2900],
  [1500, 2250], [3600, 300],
];

export function createShells(S) {
  S.shells = SHELL_SPOTS.map(([x, y]) => ({ x, y, found: false }));
}

export function updateShells(S) {
  const p = S.player;
  const rx = p.inVehicle ? p.inVehicle.x : p.x;
  const ry = p.inVehicle ? p.inVehicle.y : p.y;
  for (const shell of S.shells) {
    if (shell.found) continue;
    if (Math.hypot(rx - shell.x, ry - shell.y) < 60) {
      shell.found = true;
      S.progress.shellsFound++;
      showMessage(S, `Shell found — ${S.progress.shellsFound}/12`, 2.6);
      if (S.hooks.onShell) S.hooks.onShell(S, S.progress.shellsFound);
    }
  }
}

// Shells render as small glowing markers in the transparent pass.
export function drawShells(S, dynT) {
  const p = S.player;
  for (const shell of S.shells) {
    if (shell.found) continue;
    if (Math.hypot(shell.x - p.x, shell.y - p.y) > 1500) continue;
    const bob = 8 + Math.sin(S.t * 3 + shell.x) * 3;
    dynT.disc(shell.x, shell.y, bob, 13, [1, 0.85, 0.45, 0.85], 10);
    dynT.cone(shell.x, shell.y, bob, 9, 16, 0, [1, 0.95, 0.8, 0.95], { seg: 10 });
  }
}

// --- Taxi fares -------------------------------------------------------

export function updateTaxi(S, dt, rand) {
  const p = S.player;
  const inTaxi = p.inVehicle && p.inVehicle.cls === 'taxi';
  if (!inTaxi) {
    if (S.taxi && S.taxi.ped) S.taxi.ped.kind = 'walker';
    S.taxi = null;
    return;
  }
  if (!S.taxi) {
    S.taxiWait = (S.taxiWait || 0) + dt;
    if (S.taxiWait > 4) {
      S.taxiWait = 0;
      const a = rand.range(0, Math.PI * 2);
      const near = nearestRoadPoint(S, p.inVehicle.x + Math.cos(a) * 900, p.inVehicle.y + Math.sin(a) * 900);
      if (near) {
        const ped = spawnPedestrian(S, near.x + 24, near.y + 24, 'walker', {});
        ped.name = 'Fare';
        S.taxi = { stage: 'pickup', x: near.x, y: near.y, ped, destX: 0, destY: 0 };
        showMessage(S, 'A fare is waiting — the marker is your pickup.', 3.5);
      }
    }
    return;
  }
  const T = S.taxi;
  const d = Math.hypot(p.inVehicle.x - (T.stage === 'pickup' ? T.x : T.destX), p.inVehicle.y - (T.stage === 'pickup' ? T.y : T.destY));
  if (T.stage === 'pickup' && d < 85 && Math.abs(p.inVehicle.speed) < 25) {
    // Passenger aboard: pick a destination across town.
    const a = rand.range(0, Math.PI * 2);
    const near = nearestRoadPoint(S, T.x + Math.cos(a) * 1700, T.y + Math.sin(a) * 1700);
    if (near) { T.destX = near.x; T.destY = near.y; }
    else { T.destX = T.x + 1200; T.destY = T.y; }
    T.tripDist = Math.hypot(T.destX - T.x, T.destY - T.y);
    const at = S.peds.indexOf(T.ped);
    if (at >= 0) S.peds.splice(at, 1);
    T.ped = null;
    T.stage = 'dropoff';
    showMessage(S, 'Passenger aboard — get them there in one piece.', 3);
  } else if (T.stage === 'dropoff' && d < 85 && Math.abs(p.inVehicle.speed) < 25) {
    const fare = Math.max(8, Math.round(T.tripDist / 20) * 3);
    S.progress.cash += fare;
    showMessage(S, `Fare paid — $${fare}. The cab life provides.`, 3.5);
    if (S.hooks.onTaxiFare) S.hooks.onTaxiFare(S, fare);
    S.taxi = null;
  }
}

// --- Territory --------------------------------------------------------

export const TERRITORY_BLOCKS = [
  { name: 'Plaza del Faro', x: 840, y: 870 },
  { name: 'Los Arcos', x: 1250, y: 500 },
  { name: 'Mirador Alto', x: 500, y: 1150 },
];

export function startTerritory(S, idx) {
  const block = TERRITORY_BLOCKS[idx];
  S.territory = { idx, wave: 0, phase: 'waves', holdT: 22, spawnT: 0 };
  spawnWave(S, idx, 0);
  showBanner(S, 'TERRITORY', `${block.name} — clear the Herrera waves.`, 3);
}

function spawnWave(S, idx, wave) {
  const block = TERRITORY_BLOCKS[idx];
  const n = 3 + wave;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + wave;
    const ped = spawnPedestrian(S, block.x + Math.cos(a) * 260, block.y + Math.sin(a) * 260, 'gunman', { weapon: 'rifle', shirt: '#7a1f2b' });
    ped.tag = `terr${idx}`;
  }
  showMessage(S, `Wave ${wave + 1} — ${n} Herrera shooters.`, 2.6);
}

export function updateTerritory(S, dt) {
  const T = S.territory;
  if (!T) return;
  const alive = S.peds.some((ped) => ped.tag === `terr${T.idx}` && !ped.dead);
  if (T.phase === 'waves') {
    if (!alive) {
      T.wave++;
      if (T.wave >= 3) {
        T.phase = 'hold';
        showMessage(S, 'Waves broken — hold the block until the timer runs out.', 3.5);
      } else {
        spawnWave(S, T.idx, T.wave);
      }
    }
  } else {
    T.holdT -= dt;
    T.spawnT -= dt;
    if (!alive && T.spawnT <= 0) {
      T.spawnT = 8;
      const block = TERRITORY_BLOCKS[T.idx];
      const ped = spawnPedestrian(S, block.x + 320, block.y - 200, 'gunman', { weapon: 'rifle', shirt: '#7a1f2b' });
      ped.tag = `terr${T.idx}`;
    }
    if (T.holdT <= 0) {
      const block = TERRITORY_BLOCKS[T.idx];
      S.progress.territoryTaken.push(T.idx);
      S.progress.cash += 1500;
      showBanner(S, 'TERRITORY TAKEN', `${block.name} flies teal — +$1,500`, 3.6);
      if (S.hooks.onTerritoryComplete) S.hooks.onTerritoryComplete(S, T.idx);
      S.territory = null;
    }
  }
}
