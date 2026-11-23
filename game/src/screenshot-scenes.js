// Puerto Brisa 3D — the four screenshot scenes.
//
// Each scene poses the live game state (no update loop runs in shot
// mode, so what is staged is exactly what renders): the harbour
// chase cover first — golden hour, an orange sports car running the
// marina boulevard, three LPD cars and KITE-1's searchlight on it,
// the vault job at stage 3 of 4 — then Rosa on foot in the plaza
// with EL CUERVO in reach, the heist board, and the empire map.

import { showDialogue, showBanner } from './config.js';
import { createVehicle } from './vehicles-3d.js';
import { createHelicopter } from './helicopter.js';
import { spawnPedestrian } from './traffic-ai.js';
import { giveWeapon } from './combat-weapons.js';
import { planVaultHeist, heistPayout } from './heist-planning.js';

function baseProgress(S, missions, cash, respect) {
  S.progress.missionsDone = missions.slice();
  S.progress.cash = cash;
  S.progress.respect = respect;
  S.progress.respectLevel = 1 + Math.floor(respect / 60);
}

function policeCar(S, x, y, angle, name, role) {
  const veh = createVehicle(S, 'police', x, y, angle, { driver: 'police' });
  veh.unitName = name;
  veh.unitRole = role;
  return veh;
}

function stageHarbour(S) {
  S.screen = 'game';
  S.dayT = 17.55; // golden hour over the marina
  S.weather.storm = 0.25;
  baseProgress(S, [1, 2, 3, 4, 5, 6, 7, 8], 86400, 214);
  S.progress.shellsFound = 9;
  S.progress.territoryTaken = [0];
  S.progress.bountiesCaught = ['LA VIUDA'];
  S.businesses[0].owned = true;
  S.businesses[1].owned = true;

  // The getaway car, mid-run on the marina boulevard.
  const car = createVehicle(S, 'sports', 1500, 1378, 0, { color: '#ff7a1a', driver: 'player' });
  car.speed = 320;
  const p = S.player;
  p.inVehicle = car;
  p.x = car.x; p.y = car.y; p.angle = 0;
  p.health = 88; p.armour = 60;
  giveWeapon(S, 'rifle');
  giveWeapon(S, 'smg');

  // The net: two cars behind, one coming the other way, KITE-1 above.
  policeCar(S, 1270, 1322, 0.15, 'CORAL-48', 'RAMMING');
  policeCar(S, 1310, 1446, -0.1, 'DELTA-7', 'INTERCEPT');
  policeCar(S, 1830, 1400, Math.PI, 'SIERRA-2', 'PURSUIT');
  createHelicopter(S, 1660, 1150);
  S.heli.x = 1660; S.heli.y = 1150;

  // The roadblock: two LPD cars angled across the Avenida ahead of
  // her, close enough to read as the trap she has to beat.
  const blockA = policeCar(S, 1692, 1352, Math.PI / 2 - 0.42, 'VEGA-5', 'ROADBLOCK');
  blockA.driver = 'roadblock';
  const blockB = policeCar(S, 1710, 1406, Math.PI / 2 + 0.38, 'ORO-9', 'ROADBLOCK');
  blockB.driver = 'roadblock';

  // Civilian traffic thickens both carriageways of the Avenida and
  // the marina front road below, so the boulevard feels lived-in.
  createVehicle(S, 'compact', 1905, 1356, 0, { color: '#e8b34b', driver: 'traffic' });
  createVehicle(S, 'taxi', 2060, 1402, Math.PI, { driver: 'traffic' });
  createVehicle(S, 'van', 1610, 1466, 0, { color: '#7a8894', driver: 'traffic' });
  createVehicle(S, 'pickup', 1360, 1510, Math.PI, { color: '#96755a', driver: 'traffic' });
  createVehicle(S, 'muscle', 1150, 1354, 0, { color: '#22262b', driver: 'traffic' });
  createVehicle(S, 'sedan', 1850, 1510, Math.PI, { color: '#c9563c', driver: 'traffic' });

  // Pavement life on both sidewalks of the Avenida.
  spawnPedestrian(S, 1330, 1314, 'walker', { angle: Math.PI });
  spawnPedestrian(S, 1420, 1314, 'walker', { angle: 0 });
  spawnPedestrian(S, 1600, 1314, 'walker', { angle: 0 });
  spawnPedestrian(S, 1880, 1314, 'walker', { angle: Math.PI });
  spawnPedestrian(S, 1470, 1438, 'walker', { angle: 0 });
  spawnPedestrian(S, 1720, 1438, 'walker', { angle: Math.PI });
  spawnPedestrian(S, 1810, 1438, 'walker', { angle: Math.PI });
  spawnPedestrian(S, 1990, 1438, 'walker', { angle: 0 });

  S.wanted.heat = 4.6;
  S.wanted.lastCrimeAt = S.t;

  // The job at stage 3 of 4.
  S.mission.active = true;
  S.mission.id = 9;
  S.briefing = { title: 'The Vault of Brisa', giver: 'Tomás Ibarra', cash: heistPayout(S) };
  S.mission.objectives = [
    { text: 'Break the vault seal', state: 'done' },
    { text: 'Load the gold into the getaway car', state: 'done' },
    { text: 'Lose the heat', state: 'active' },
    { text: 'Reach the seaplane dock', state: 'todo' },
  ];
  S.mission.target = { x: 5170, y: 1480 };
  showDialogue(S, 'Tomás Ibarra', "They're boxing you in, Rosa — break for the marina and lose them in the storm.", '#ffd34d', 9999);
  S.camOverride = { eye: [1215, 1620, 92], look: [1560, 1360, 24] };
}

function stageFoot(S) {
  S.screen = 'game';
  S.dayT = 18.4; // golden hour in the plaza, the cover's light
  S.weather.storm = 0.1;
  baseProgress(S, [1, 2, 3, 4, 5, 6], 31200, 150);
  S.progress.shellsFound = 5;
  const p = S.player;
  p.x = 748; p.y = 830; p.angle = Math.atan2(800 - 830, 700 - 748);
  p.health = 92; p.armour = 35;
  giveWeapon(S, 'pistol');
  giveWeapon(S, 'rifle'); // given last, so the rifle is the one in hand
  // EL CUERVO holds the plaza, in reach — his ped was spawned at boot
  // at (700, 800); give him his gold bounty ring and turn him to her.
  const cuervo = S.bounties.find((b) => b.name === 'EL CUERVO');
  if (cuervo && cuervo.ped) {
    cuervo.ped.ring = '#ffd34d';
    cuervo.ped.angle = Math.atan2(p.y - cuervo.ped.y, p.x - cuervo.ped.x);
  }
  // Three Herrera shooters between Rosa and the target, facing her.
  const faceRosa = (x, y) => Math.atan2(p.y - y, p.x - x);
  spawnPedestrian(S, 722, 822, 'gunman', { weapon: 'rifle', shirt: '#7a1f2b', angle: faceRosa(722, 822) });
  spawnPedestrian(S, 712, 778, 'gunman', { weapon: 'rifle', shirt: '#7a1f2b', angle: faceRosa(712, 778) });
  spawnPedestrian(S, 742, 786, 'gunman', { weapon: 'rifle', shirt: '#7a1f2b', angle: faceRosa(742, 786) });
  // Plaza life: shoppers around the fountain and the market stalls.
  spawnPedestrian(S, 664, 856, 'walker', { angle: 0.4 });
  spawnPedestrian(S, 716, 742, 'walker', { angle: 2.6 });
  spawnPedestrian(S, 618, 788, 'walker', { angle: -0.5 });
  spawnPedestrian(S, 742, 700, 'walker', { angle: 1.2 });
  spawnPedestrian(S, 612, 852, 'walker', { angle: 0.9 });
  spawnPedestrian(S, 668, 742, 'walker', { angle: -2.2 });
  // Parked cars dress the streets at the plaza's edges.
  createVehicle(S, 'taxi', 600, 768, Math.PI, { driver: 'parked' });
  createVehicle(S, 'sedan', 500, 768, Math.PI, { color: '#3f6fb5', driver: 'parked' });
  createVehicle(S, 'compact', 478, 908, Math.PI / 2, { color: '#c94f6d', driver: 'parked' });
  policeCar(S, 1080, 690, Math.PI, 'CORAL-48', 'PURSUIT');
  S.wanted.heat = 1.6;
  S.wanted.lastCrimeAt = S.t;
  S.mission.active = true;
  S.mission.id = 7;
  S.briefing = { title: 'Plaza Kings', giver: 'Tomás Ibarra', cash: 2000 };
  S.mission.objectives = [
    { text: 'Clear the plaza of Herrera shooters', state: 'active' },
    { text: 'Hold Plaza del Faro', state: 'todo' },
  ];
  S.mission.target = { x: 700, y: 800 };
  showBanner(S, 'BOUNTY — EL CUERVO', '$6,500 ALIVE', 9999);
  showDialogue(S, 'Capt. Elías Ruiz', 'That is EL CUERVO himself, Rosa. Alive pays double — walk up and take him.', '#9fd8ff', 9999);
  // Street level, over Rosa's shoulder: ~70 units behind her and low,
  // looking down the plaza at EL CUERVO, blocks framing both sides.
  S.camOverride = { eye: [830, 950, 42], look: [705, 805, 16] };
}

function stageHeist(S) {
  planVaultHeist(S);
  S.heistPlan.entry = 1; // dock
  S.heistPlan.escape = 0; // seaplane
  S.heistPlan.row = 3; // the lock row, ready
  S.heistPlan.locked = false;
  baseProgress(S, [1, 2, 3, 4, 5, 6, 7, 8], 86400, 214);
  S.screen = 'heist';
}

function stageEmpire(S) {
  baseProgress(S, [1, 2, 3, 4, 5, 6, 7, 8], 129600, 262);
  S.progress.shellsFound = 10;
  S.progress.territoryTaken = [0, 1];
  S.progress.bountiesCaught = ['EL CUERVO', 'LA VIUDA', 'SABLE'];
  S.businesses[0].owned = true;
  S.businesses[1].owned = true;
  S.businesses[2].owned = true;
  S.safehouses[1].owned = true;
  const p = S.player;
  p.x = 3200; p.y = 1400; p.angle = -Math.PI / 2;
  S.screen = 'map';
}

function stageTitle(S) {
  S.screen = 'title';
  S.dayT = 17.7; // golden hour for the orbit behind the menu
  S.weather.storm = 0.1;
  // A run worth showing on the stats strip: six jobs done, a foothold
  // in the empire, cash in hand. baseProgress(…, 150) lands respect
  // at level 3. No camOverride — the title orbit camera frames it.
  baseProgress(S, [1, 2, 3, 4, 5, 6], 31200, 150);
  S.progress.shellsFound = 5;
  S.progress.territoryTaken = [0];
  S.businesses[0].owned = true;
  S.businesses[1].owned = true;
}

export function stageScreenshotScene(S, name) {
  if (name === 'harbour') stageHarbour(S);
  else if (name === 'foot') stageFoot(S);
  else if (name === 'heist') stageHeist(S);
  else if (name === 'empire') stageEmpire(S);
  else if (name === 'title') stageTitle(S);
  else stageHarbour(S);
}
