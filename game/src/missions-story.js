// Puerto Brisa 3D — the story: ten missions for Rosa Camacho.
//
// Rosa runs jobs for fixer Tomás Ibarra against the Herrera family;
// Lucía Ferrer runs the race league and Capt. Elías Ruiz keeps the
// harbour honest. Each mission is a list of stages (reach, deliver,
// tail, shootout, stop, territory, race, escape) advanced by
// updateMission; givers are looked up from the GIVERS table and the
// entry itself is returned, so talk checks read its .x/.y directly.

import { showMessage, showDialogue, showBanner } from './config.js';
import { createVehicle, updateVehiclePhysics } from './vehicles-3d.js';
import { steerToward } from './traffic-ai.js';
import { spawnPedestrian } from './traffic-ai.js';
import { giveWeapon } from './combat-weapons.js';
import { setWanted } from './police-pursuit.js';
import { heistPayout, heistHeat } from './heist-planning.js';
import { startTerritory } from './side-activities.js';
import { startRace } from './races-league.js';

export const GIVERS = {
  tomas: { name: 'Tomás Ibarra', x: 640, y: 2080, shirt: '#ffc845', role: 'Fixer' },
  lucia: { name: 'Lucía Ferrer', x: 4280, y: 1560, shirt: '#ff5da2', role: 'Race organiser' },
  elias: { name: 'Capt. Elías Ruiz', x: 5960, y: 620, shirt: '#7fb0b8', role: 'Harbour master' },
};

export const MISSIONS = [
  { id: 1, title: 'First Wheels', giver: 'tomas', cash: 600, respect: 12,
    brief: 'Tomás: "A Coral Sedan waits by the Mirador plaza, Rosa. Take it, bring it to my dock. Quietly."' },
  { id: 2, title: 'Tail the Courier', giver: 'tomas', cash: 750, respect: 14,
    brief: 'Tomás: "The Herrera courier crosses El Mirador at noon. Follow him home — close is blown, far is lost."' },
  { id: 3, title: 'Dockside Static', giver: 'tomas', cash: 1200, respect: 20,
    brief: 'Tomás: "Herrera shooters on my docks. Clear the marina, all of them, and keep the boats floating."' },
  { id: 4, title: 'Shell Run', giver: 'lucia', cash: 900, respect: 14,
    brief: 'Lucía: "Three markers, one clock, every beach road on the island. Show me the league is wrong about you."' },
  { id: 5, title: 'Two Bridges', giver: 'tomas', cash: 1800, respect: 24,
    brief: 'Tomás: "An armoured Herrera van crosses both bridges tonight. Stop it before Isla Ancla — whatever it takes."' },
  { id: 6, title: 'Wet Cargo', giver: 'tomas', cash: 1600, respect: 22,
    brief: 'Tomás: "Crates to Isla Ancla, dry and quiet. The LPD will smell it — outrun them, deliver dry."' },
  { id: 7, title: 'Plaza Kings', giver: 'tomas', cash: 2000, respect: 26,
    brief: 'Tomás: "The plaza flies Herrera red. Take it, hold it, paint the hill teal. The city is watching."' },
  { id: 8, title: 'King Tide Run', giver: 'lucia', cash: 2200, respect: 26,
    brief: 'Lucía: "The Harbour Circuit, three of my best, one tide coming in. Win it and the league is yours."' },
  { id: 9, title: 'The Vault of Brisa', giver: 'tomas', cash: 48000, respect: 34,
    brief: 'Tomás: "The marina vault, Rosa. Plan it on my board first — then we take the city’s breath away."' },
  { id: 10, title: 'Storm Surge', giver: 'tomas', cash: 5000, respect: 40,
    brief: 'Tomás: "La Madre is here. Supplies to three corners of this city, then the lighthouse. Drive like the storm owes you."' },
];

// Stage lists. Kinds: reach (get there), deliver (get there in a car),
// tail (shadow the courier), shootout (clear tagged gunmen), stop
// (wreck the van), territory (run the plaza defence), race (win the
// Harbour Circuit), escape (reach the dock under heat).
const STAGES = {
  1: [
    { kind: 'reach', x: 760, y: 980, radius: 110, text: 'Take the Coral Sedan by the plaza' },
    { kind: 'deliver', x: 430, y: 2140, radius: 120, text: 'Bring it to the marina dock' },
  ],
  2: [
    { kind: 'tail', text: 'Tail the courier — stay in the pocket' },
  ],
  3: [
    { kind: 'shootout', text: 'Clear the marina of Herrera shooters' },
  ],
  4: [
    { kind: 'reach', x: 4876, y: 1378, radius: 130, text: 'Marker one — the east artery' },
    { kind: 'reach', x: 840, y: 870, radius: 130, text: 'Marker two — the plaza fountain' },
    { kind: 'reach', x: 6010, y: 1378, radius: 130, text: 'Marker three — Zona Libre gate' },
  ],
  5: [
    { kind: 'stop', text: 'Stop the armoured van before Isla Ancla' },
  ],
  6: [
    { kind: 'reach', x: 1100, y: 2140, radius: 110, text: 'Collect the crates at the dock' },
    { kind: 'deliver', x: 5960, y: 2880, radius: 130, text: 'Deliver to the smugglers’ cove' },
  ],
  7: [
    { kind: 'territory', text: 'Take and hold Plaza del Faro' },
  ],
  8: [
    { kind: 'race', text: 'Win the Harbour Circuit' },
  ],
  9: [
    { kind: 'reach', x: 2540, y: 760, radius: 110, text: 'Reach the vault on Avenida Coral' },
    { kind: 'shootout', text: 'Deal with the vault guards' },
    { kind: 'escape', x: 5170, y: 1480, radius: 140, text: 'Escape — lose them at the seaplane dock' },
  ],
  10: [
    { kind: 'reach', x: 1250, y: 2500, radius: 130, text: 'Supplies — the marina west end' },
    { kind: 'reach', x: 4280, y: 2500, radius: 130, text: 'Supplies — Playa Brisa south' },
    { kind: 'reach', x: 6420, y: 2840, radius: 150, text: 'Ride out La Madre at the lighthouse' },
  ],
};

const COURIER_ROUTE = [
  [1500, 500], [2400, 420], [2900, 900], [2900, 1300], [2400, 1750],
];
const VAN_ROUTE = [
  [6010, 986], [5300, 986], [4600, 986], [4600, 1600], [4600, 2426],
  [5300, 2426], [6010, 2426], [6010, 2900],
];

export function missionDefinition(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function nextMissionId(S) {
  for (const m of MISSIONS) {
    if (!S.progress.missionsDone.includes(m.id)) return m.id;
  }
  return 0;
}

// The GIVERS entry itself (it carries .x/.y) for the next mission's
// giver, or null when the story is done.
export function currentGiver(S) {
  const id = nextMissionId(S);
  if (!id) return null;
  return GIVERS[missionDefinition(id).giver];
}

export function currentBriefing(S) {
  const id = nextMissionId(S) || S.mission.id || 1;
  const def = missionDefinition(id);
  if (!def) return { title: 'PUERTO BRISA', giver: 'Tomás Ibarra', text: 'The city is yours, Rosa.', cash: 0 };
  return {
    title: def.title, giver: GIVERS[def.giver].name,
    text: def.brief, cash: def.id === 9 ? heistPayout(S) : def.cash,
  };
}

function playerRef(S) {
  const p = S.player;
  return p.inVehicle ? { x: p.inVehicle.x, y: p.inVehicle.y } : { x: p.x, y: p.y };
}

function rebuildObjectives(S) {
  const def = missionDefinition(S.mission.id);
  const stages = STAGES[def.id];
  S.mission.objectives = stages.map((st, i) => ({
    text: st.text,
    state: i < S.mission.stage ? 'done' : i === S.mission.stage ? 'active' : 'todo',
  }));
}

function spawnGunmen(S, spots, tag) {
  for (const [x, y] of spots) {
    const ped = spawnPedestrian(S, x, y, 'gunman', { weapon: 'rifle', shirt: '#7a1f2b' });
    ped.tag = tag;
  }
}

function setupStage(S, def, idx) {
  const stage = STAGES[def.id][idx];
  const M = S.mission;
  M.target = stage.x !== undefined ? { x: stage.x, y: stage.y } : null;
  M.stageData = {};
  if (def.id === 1 && idx === 0) {
    M.stageData.veh = createVehicle(S, 'sedan', 760, 920, Math.PI / 2, { color: '#3f6fb5', driver: 'target' });
  }
  if (stage.kind === 'tail') {
    const car = createVehicle(S, 'muscle', COURIER_ROUTE[0][0], COURIER_ROUTE[0][1], 0, { color: '#7a1f2b', driver: 'target' });
    M.stageData = { veh: car, wp: 1, lostT: 0, madeT: 0 };
    M.target = { x: car.x, y: car.y };
  }
  if (stage.kind === 'shootout') {
    const tag = `m${def.id}`;
    if (def.id === 3) {
      spawnGunmen(S, [[520, 2100], [900, 2180], [1250, 2080], [1560, 2180]], tag);
      M.target = { x: 900, y: 2140 };
    } else {
      // Vault guards: the dock entry slips past one of them.
      const plan = S.heistPlan;
      const spots = plan && plan.entry === 1
        ? [[2480, 700], [2620, 820]]
        : [[2480, 700], [2540, 830], [2620, 700]];
      spawnGunmen(S, spots, tag);
      M.target = { x: 2540, y: 760 };
    }
    M.stageData.tag = tag;
  }
  if (stage.kind === 'stop') {
    const van = createVehicle(S, 'van', VAN_ROUTE[0][0], VAN_ROUTE[0][1], Math.PI, { color: '#4c5a68', driver: 'target' });
    van.health = 380;
    M.stageData = { veh: van, wp: 1 };
    M.target = { x: van.x, y: van.y };
  }
  if (def.id === 6 && idx === 1) setWanted(S, 2);
  if (stage.kind === 'territory') {
    startTerritory(S, 0);
  }
  if (stage.kind === 'race') {
    if (!startRace(S, 0)) {
      showMessage(S, 'You need a car on the start line to race.');
    }
  }
  if (stage.kind === 'escape') {
    setWanted(S, heistHeat(S));
  }
  if (def.id === 10) S.weather.storm = 0.85;
  rebuildObjectives(S);
}

export function startMission(S, id) {
  const def = missionDefinition(id);
  if (!def) return;
  const M = S.mission;
  M.active = true;
  M.id = id;
  M.stage = 0;
  M.timer = def.id === 4 ? 170 : 0;
  S.briefing = {
    title: def.title, giver: GIVERS[def.giver].name,
    text: def.brief, cash: id === 9 ? heistPayout(S) : def.cash,
  };
  if (id === 3) giveWeapon(S, 'rifle');
  if (id === 5) giveWeapon(S, 'smg');
  if (id === 9 && !(S.heistPlan && S.heistPlan.locked)) showMessage(S, 'Plan the job on the heist board (H at a safehouse) for the full cut.');
  setupStage(S, def, 0);
  showDialogue(S, GIVERS[def.giver].name, def.brief.replace(/^[^:]+:\s*/, '').replace(/^"|"$/g, ''), '#ffd34d', 7);
}

function advanceStage(S) {
  const def = missionDefinition(S.mission.id);
  S.mission.stage++;
  if (S.mission.stage >= STAGES[def.id].length) {
    completeMission(S, def);
    return;
  }
  setupStage(S, def, S.mission.stage);
  showMessage(S, STAGES[def.id][S.mission.stage].text);
}

export function completeMission(S, def) {
  const M = S.mission;
  M.active = false;
  M.target = null;
  const pay = def.id === 9 ? heistPayout(S) : def.cash;
  if (!S.progress.missionsDone.includes(def.id)) {
    S.progress.missionsDone.push(def.id);
    S.progress.cash += pay;
    S.progress.respect += def.respect;
    S.progress.respectLevel = 1 + Math.floor(S.progress.respect / 60);
  }
  showBanner(S, 'MISSION COMPLETE', `${def.title} — $${pay.toLocaleString('en-US')}`, 3.4);
  if (S.hooks.onMissionComplete) S.hooks.onMissionComplete(S, def);
  if (def.id === 10) {
    showBanner(S, 'STORM SURGE', 'Rosa Camacho owns Puerto Brisa now. Free roam!', 5);
    S.weather.storm = 0.3;
  }
}

export function failMission(S, why) {
  const M = S.mission;
  if (!M.active) return;
  M.active = false;
  M.target = null;
  showMessage(S, `Mission failed — ${why} Talk to the giver to retry.`, 5);
  if (S.hooks.onMissionFail) S.hooks.onMissionFail(S, why);
}

export function updateMission(S, dt) {
  const M = S.mission;
  if (!M.active) return;
  const def = missionDefinition(M.id);
  const stage = STAGES[def.id][M.stage];
  const ref = playerRef(S);
  if (M.timer > 0) {
    M.timer -= dt;
    if (M.timer <= 0) { failMission(S, 'out of time.'); return; }
  }
  const reach = (radius) => Math.hypot(ref.x - stage.x, ref.y - stage.y) < (radius || stage.radius || 100);

  switch (stage.kind) {
    case 'reach':
      if (reach()) advanceStage(S);
      break;
    case 'deliver':
      if (S.player.inVehicle && reach()) advanceStage(S);
      break;
    case 'escape':
      if (reach()) advanceStage(S);
      break;
    case 'tail': {
      const car = M.stageData.veh;
      if (!car || car.health <= 0) { failMission(S, 'the courier is gone.'); break; }
      const wp = COURIER_ROUTE[M.stageData.wp];
      if (wp) {
        updateVehiclePhysics(S, car, dt, steerToward(S, car, wp[0], wp[1], dt, { top: 235 }));
        if (Math.hypot(car.x - wp[0], car.y - wp[1]) < 90) M.stageData.wp++;
      } else {
        advanceStage(S); // he made it home with Rosa on his tail
        break;
      }
      M.target = { x: car.x, y: car.y };
      const d = Math.hypot(ref.x - car.x, ref.y - car.y);
      if (d > 320) { M.stageData.lostT += dt; if (M.stageData.lostT > 6) failMission(S, 'you lost him.'); }
      else M.stageData.lostT = Math.max(0, M.stageData.lostT - dt);
      if (d < 58) { M.stageData.madeT += dt; if (M.stageData.madeT > 4) failMission(S, 'he made you.'); }
      else M.stageData.madeT = Math.max(0, M.stageData.madeT - dt);
      break;
    }
    case 'shootout': {
      const alive = S.peds.some((ped) => ped.tag === M.stageData.tag && !ped.dead);
      if (!alive) advanceStage(S);
      break;
    }
    case 'stop': {
      const van = M.stageData.veh;
      if (!van) { failMission(S, 'the van is gone.'); break; }
      const wp = VAN_ROUTE[M.stageData.wp];
      if (wp) {
        updateVehiclePhysics(S, van, dt, steerToward(S, van, wp[0], wp[1], dt, { top: 300 }));
        if (Math.hypot(van.x - wp[0], van.y - wp[1]) < 100) M.stageData.wp++;
      } else {
        failMission(S, 'the van reached Isla Ancla.');
        break;
      }
      M.target = { x: van.x, y: van.y };
      if (van.health <= 30) advanceStage(S);
      break;
    }
    case 'territory':
      if (S.progress.territoryTaken.includes(0) && !S.territory) advanceStage(S);
      break;
    case 'race':
      // The race can only start with Rosa in a car; retry the start
      // whenever she climbs into one.
      if (!S.race && S.player.inVehicle) startRace(S, 0);
      if (S.race && S.race.finished) {
        if (S.race.won) advanceStage(S);
        else failMission(S, 'the league keeps its crown — this time.');
      }
      break;
    default:
      break;
  }
}

