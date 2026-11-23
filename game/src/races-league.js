// Puerto Brisa 3D — Lucía Ferrer's race league: four street races,
// three AI rivals each, checkpoint to checkpoint over the real road
// grid. Position is computed live from checkpoint progress; winning
// pays and feeds Rosa's respect. The Harbour Circuit doubles as
// story mission 8.

import { showMessage, showBanner } from './config.js';
import { createVehicle, updateVehiclePhysics } from './vehicles-3d.js';
import { steerToward } from './traffic-ai.js';

export const RACES = [
  { name: 'Harbour Circuit', checkpoints: [
    [1500, 1378], [4800, 1378], [4876, 900], [4876, 350], [2400, 308], [660, 308], [660, 1378]] },
  { name: 'Marina Loop', checkpoints: [
    [430, 1378], [1836, 1378], [1836, 2000], [1200, 2532], [430, 2000], [430, 1378]] },
  { name: 'Two Bridges GP', checkpoints: [
    [4600, 986], [6010, 986], [6010, 350], [6010, 2426], [4600, 2426], [4600, 986]] },
  { name: 'Storm Run', checkpoints: [
    [5376, 2000], [6412, 2000], [6412, 2900], [5600, 3032], [5376, 2500], [5376, 2000]] },
];
const RIVAL_CLASSES = ['sports', 'muscle', 'sedan'];
export const RACE_WIN_CASH = 2500;

export function startRace(S, idx) {
  const p = S.player;
  if (!p.inVehicle) return false;
  const race = RACES[idx];
  const [sx, sy] = race.checkpoints[0];
  const rivals = [];
  for (let i = 0; i < 3; i++) {
    const veh = createVehicle(S, RIVAL_CLASSES[i], sx + (i - 1) * 70, sy + 90 + (i % 2) * 55, -Math.PI / 2, { driver: 'racer' });
    veh.racerCp = 0;
    veh.racerDone = false;
    rivals.push(veh);
  }
  S.race = {
    idx, cp: 0, pos: 1, finished: false, won: false,
    rivals, t: 0, countdown: 2.5,
    target: { x: race.checkpoints[1][0], y: race.checkpoints[1][1] },
  };
  showBanner(S, race.name.toUpperCase(), 'Three rivals. Every checkpoint. Go!', 2.6);
  return true;
}

function raceProgress(S, veh, cp) {
  // Progress = checkpoints cleared, tie-broken by closeness to next.
  const race = RACES[S.race.idx];
  const next = race.checkpoints[Math.min(cp + 1, race.checkpoints.length - 1)];
  const d = Math.hypot(veh.x - next[0], veh.y - next[1]);
  return cp * 100000 - d;
}

export function updateRace(S, dt) {
  const R = S.race;
  if (!R || R.finished) return;
  const race = RACES[R.idx];
  const p = S.player;
  R.t += dt;
  if (R.countdown > 0) { R.countdown -= dt; return; }

  // Rivals chase their own next checkpoint.
  for (const veh of R.rivals) {
    if (veh.racerDone) continue;
    const cp = race.checkpoints[veh.racerCp + 1];
    if (!cp) { veh.racerDone = true; continue; }
    updateVehiclePhysics(S, veh, dt, steerToward(S, veh, cp[0], cp[1], dt, { top: 462 }));
    if (Math.hypot(veh.x - cp[0], veh.y - cp[1]) < 150) {
      veh.racerCp++;
      if (veh.racerCp >= race.checkpoints.length - 1) veh.racerDone = true;
    }
  }

  // Rosa's progress.
  if (p.inVehicle) {
    const cp = race.checkpoints[R.cp + 1];
    if (cp && Math.hypot(p.inVehicle.x - cp[0], p.inVehicle.y - cp[1]) < 150) {
      R.cp++;
      showMessage(S, `Checkpoint ${R.cp}/${race.checkpoints.length - 1}`, 1.6);
    }
  }
  const nextCp = race.checkpoints[Math.min(R.cp + 1, race.checkpoints.length - 1)];
  R.target = { x: nextCp[0], y: nextCp[1] };

  // Live position.
  const mine = raceProgress(S, p.inVehicle || p, R.cp);
  let pos = 1;
  for (const veh of R.rivals) {
    if (raceProgress(S, veh, veh.racerCp) > mine) pos++;
  }
  R.pos = pos;

  if (R.cp >= race.checkpoints.length - 1) {
    R.finished = true;
    R.won = R.pos === 1;
    for (const veh of R.rivals) if (veh.driver === 'racer') veh.driver = 'traffic';
    if (R.won) {
      S.progress.cash += RACE_WIN_CASH;
      S.progress.respect += 10;
      showBanner(S, 'RACE WON', `${race.name} — $${RACE_WIN_CASH.toLocaleString('en-US')}`, 3.4);
    } else {
      showBanner(S, `FINISHED ${R.pos}${['st', 'nd', 'rd', 'th'][R.pos - 1] || 'th'}`, `${race.name} — the league keeps the pot.`, 3.2);
    }
    if (S.hooks.onRaceFinish) S.hooks.onRaceFinish(S, R.won, R.idx);
  }
}

// The start-line helper the giver flow uses: is Rosa sitting on a
// race start in a car? (Mission 8 calls startRace directly.)
export function raceName(idx) {
  return RACES[idx] ? RACES[idx].name : '';
}
