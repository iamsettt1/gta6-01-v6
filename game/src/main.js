// Puerto Brisa 3D — Storm Surge: the conductor.
//
// Boot builds the city, paints its textures, spawns traffic, peds,
// givers, bounties and Rosa, then runs the frame loop: input and
// screens, the game step (player, traffic, police, missions and all
// the side systems), the camera, and the render — WebGL world first
// (sky, ground, city, water, dynamic meshes), then the 2D HUD canvas
// for whichever screen is up. In screenshot mode (?shot=...) the
// staged scene renders without the update loop, exactly as posed.

import {
  CFG, createPuertoBrisaState, clamp, angleDelta,
  showMessage, showBanner,
} from './config.js';
import { createSeededRandom } from './random.js';
import { createRenderer, MeshBuilder, skyPalette } from './engine-3d.js';
import {
  paintGroundTexture, paintFacadeTexture, paintSignTexture, paintGlowTexture,
} from './textures.js';
import { buildCity, buildCityMeshes, districtAt } from './city-world.js';
import { updateVehiclePhysics, drawVehicle, vehicleRadius } from './vehicles-3d.js';
import {
  createPlayer, drawPlayer, updatePlayerOnFoot,
  nearestVehicle, tryEnterVehicle, exitVehicle,
} from './player-3d.js';
import {
  spawnTraffic, scatterParkedCars, scatterPedestrians, spawnPedestrian,
  updateTraffic, updatePedestrians, drawPedestrians,
} from './traffic-ai.js';
import { updateHelicopter, drawHelicopter } from './helicopter.js';
import { updateWanted, updatePolice, reportCrime, wantedStars } from './police-pursuit.js';
import { playerFireControl, updateGunmen, selectWeapon } from './combat-weapons.js';
import {
  startMission, updateMission, currentGiver, currentBriefing, nextMissionId, GIVERS,
} from './missions-story.js';
import { planVaultHeist, updateHeistPlanning, drawHeistPlanning, heistPayout } from './heist-planning.js';
import {
  createBusinesses, createSafehouses, tryBuyBusiness, tryBuySafehouse,
  nearestSafehouse, updateEmpire,
} from './empire-businesses.js';
import { createBounties, updateBounties, tryCaptureBounty } from './bounty-board.js';
import { updateRace } from './races-league.js';
import {
  createShells, updateShells, drawShells, updateTaxi, updateTerritory,
} from './side-activities.js';
import { repaintVehicle, tuneVehicle, updatePhone, drawPhone } from './shops-phone.js';
import { drawHUD } from './hud-overlay.js';
import { drawTitleScreen, drawBriefingScreen, drawMapScreen } from './screens.js';
import { stageScreenshotScene } from './screenshot-scenes.js';
import {
  unlockAudio, updateAudio, shotSound, cashSound, thudSound, chimeSound,
} from './audio-synth.js';

// ---------------------------------------------------------------- boot

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot');

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
const W = CFG.VIEW_W, H = CFG.VIEW_H;

const S = createPuertoBrisaState(seed);
window.__game = S;
const rand = createSeededRandom(seed);
S.rand = rand;

S.city = buildCity(S, rand);
const R = createRenderer(glCanvas);
S.renderer = R;
const groundTex = R.textureFromCanvas(paintGroundTexture(S));
const facadeTex = R.textureFromCanvas(paintFacadeTexture());
const signTex = R.textureFromCanvas(paintSignTexture('PUERTO BRISA · MARINA'));
const glowTex = R.textureFromCanvas(paintGlowTexture());
const cityBuilders = {
  ground: new MeshBuilder(), tex: new MeshBuilder(), col: new MeshBuilder(),
  water: new MeshBuilder(), sign: new MeshBuilder(),
};
buildCityMeshes(S, cityBuilders);
S.meshes = {
  ground: cityBuilders.ground.build(R.gl),
  tex: cityBuilders.tex.build(R.gl),
  col: cityBuilders.col.build(R.gl),
  water: cityBuilders.water.build(R.gl),
  sign: cityBuilders.sign.build(R.gl),
};
S.textures = { groundTex, facadeTex, signTex, glowTex };
// Persistent dynamic meshes: rebuilt into these buffers every frame.
const dynMesh = new MeshBuilder().build(R.gl, true);
const dynTMesh = new MeshBuilder().build(R.gl, true);

S.businesses = createBusinesses(S);
S.safehouses = createSafehouses();
S.player = createPlayer(S, 640, 2080);
spawnTraffic(S, rand, 46);
scatterParkedCars(S, rand, 26);
scatterPedestrians(S, rand, 90);
for (const key of Object.keys(GIVERS)) {
  const g = GIVERS[key];
  const ped = spawnPedestrian(S, g.x, g.y, 'giver', { shirt: g.shirt });
  ped.name = g.name;
}
createBounties(S);
createShells(S);
planVaultHeist(S);
S.briefing = currentBriefing(S);
S.cam.x = 640; S.cam.y = 2340; S.cam.z = 115;
S.cam.lx = 640; S.cam.ly = 2080; S.cam.lz = 24;

// ---------------------------------------------------------------- hooks

function respawnAtHospital() {
  const p = S.player;
  if (p.inVehicle) { p.inVehicle.driver = 'traffic'; p.inVehicle = null; }
  p.dead = false;
  p.health = 100;
  p.armour = 0;
  p.x = 430; p.y = 1560; p.angle = -Math.PI / 2;
  S.progress.cash = Math.max(0, S.progress.cash - 250);
  S.wanted.heat = 0;
  S._deathT = 0;
  showBanner(S, 'DISCHARGED', 'The hospital took $250 and asked no questions.', 3);
}

function bustRespawn() {
  const p = S.player;
  if (p.inVehicle) { p.inVehicle.driver = 'traffic'; p.inVehicle = null; }
  p.x = 2540; p.y = 1180; p.angle = Math.PI / 2;
  S.progress.cash = Math.max(0, S.progress.cash - 300);
  S.wanted.heat = 0;
  S.wanted.bustT = 0;
  S._bustedFlash = S.t + 1.8;
  showBanner(S, 'BUSTED', 'The LPD took $300 and your afternoon.', 3);
}

S.hooks = {
  onVehicleCrash(S2, veh) {
    if (veh.driver === 'player') {
      thudSound(S2);
      if (S2.t - (S2._crashT || -9) > 2.5) {
        S2._crashT = S2.t;
        reportCrime(S2, 'crash');
      }
    }
  },
  onCarjack(S2) {
    reportCrime(S2, 'carjack');
    showMessage(S2, 'Carjacked — the LPD noticed.', 3);
  },
  onPedDown(S2, ped) {
    const p = S2.player;
    if (ped.kind === 'gunman') {
      reportCrime(S2, 'gunmanDown');
      if (p.ammo && p.ownedWeapons) {
        if (p.ownedWeapons.pistol) p.ammo.pistol = (p.ammo.pistol || 0) + 10;
        if (p.ownedWeapons.rifle) p.ammo.rifle = (p.ammo.rifle || 0) + 6;
      }
    } else if (ped.kind === 'walker') {
      reportCrime(S2, 'pedDown');
      showMessage(S2, 'A bystander is down — that brings heat.', 3.5);
    }
  },
  onPlayerShot(S2) {
    if (S2.t - (S2._shotT || -9) > 1.5) {
      S2._shotT = S2.t;
      reportCrime(S2, 'shot');
    }
  },
  onShotSound(S2, weapon) { shotSound(S2, weapon); },
  onWasted() { /* the frame loop times the hospital respawn */ },
  onBusted() { bustRespawn(); },
  onMissionComplete() { cashSound(S); },
  onMissionFail() { thudSound(S); },
  onRaceFinish(S2, won) { if (won) cashSound(S2); },
  onBusinessBought() { cashSound(S); },
  onEmpireComplete() { showBanner(S, 'EMPIRE COMPLETE', 'Every business in Puerto Brisa answers to Rosa.', 4); },
  onBountyCaught() { cashSound(S); },
  onShell(S2, n) { chimeSound(S2); if (n === 12) showBanner(S, 'ALL SHELLS FOUND', 'Every beach in Puerto Brisa, walked.', 3.5); },
  onTaxiFare() { cashSound(S); },
  onTerritoryComplete() { chimeSound(S); },
  onPlanLocked(S2, plan) {
    plan.locked = true;
    S2.screen = 'game';
    showMessage(S2, `Plan locked — the vault pays $${heistPayout(S2).toLocaleString('en-US')}. Tomás has the job.`, 4.5);
  },
  onMessage(S2, text) { showMessage(S2, text); },
};

// ---------------------------------------------------------------- input

window.addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase();
  S.input.keys.add(k);
  S.input.pressed.add(k);
  unlockAudio(S);
  if (k === ' ' || k.startsWith('arrow')) ev.preventDefault();
});
window.addEventListener('keyup', (ev) => {
  S.input.keys.delete(ev.key.toLowerCase());
});
window.addEventListener('error', (ev) => {
  (window.__errors = window.__errors || []).push(String(ev.message || ev.error));
});

// ---------------------------------------------------------------- screens

function handleScreens() {
  const pr = S.input.pressed;
  if (S.screen === 'title') {
    if (pr.has('enter')) {
      S.briefing = currentBriefing(S);
      S._briefingFrom = 'title';
      S.screen = 'briefing';
    }
    return;
  }
  if (S.screen === 'briefing') {
    if (pr.has('enter')) S.screen = 'game';
    else if (pr.has('escape')) S.screen = S._briefingFrom === 'game' ? 'game' : 'title';
    return;
  }
  if (S.screen === 'map') {
    if (pr.has('m') || pr.has('escape')) S.screen = 'game';
    return;
  }
  if (S.screen === 'heist') {
    if (pr.has('escape')) { S.screen = 'game'; return; }
    updateHeistPlanning(S, 0, pr);
    return;
  }
  if (S.screen === 'phone') {
    if (pr.has('p') || pr.has('escape')) { S.screen = 'game'; return; }
    updatePhone(S, 0, pr);
    return;
  }
  // Game screen: the toggles into the other screens.
  if (pr.has('m')) { S.screen = 'map'; return; }
  if (pr.has('p')) { S.screen = 'phone'; return; }
  if (pr.has('h')) {
    const p = S.player;
    const sh = nearestSafehouse(S, p.x, p.y, true);
    if (sh) S.screen = 'heist';
    else showMessage(S, 'The heist board hangs in a safehouse.', 3);
  }
}

function interact() {
  const p = S.player;
  if (p.inVehicle) { exitVehicle(S); return; }
  const veh = nearestVehicle(S, p.x, p.y, 100);
  if (veh) { tryEnterVehicle(S); return; }
  if (!S.mission.active) {
    const giver = currentGiver(S);
    if (giver && Math.hypot(p.x - giver.x, p.y - giver.y) < 115) {
      const id = nextMissionId(S);
      if (id) {
        startMission(S, id);
        S._briefingFrom = 'game';
        S.screen = 'briefing';
      }
      return;
    }
  }
  if (tryBuyBusiness(S)) return;
  tryBuySafehouse(S);
}

function handleGamePressed() {
  const pr = S.input.pressed;
  if (pr.has('e')) interact();
  if (pr.has('f') && !S.player.inVehicle) {
    if (tryCaptureBounty(S)) {
      pr.delete('f');
      S.input.keys.delete('f');
    }
  }
  for (let i = 1; i <= 4; i++) {
    if (pr.has(String(i))) selectWeapon(S, i);
  }
  if (pr.has('r')) repaintVehicle(S);
  if (pr.has('t')) tuneVehicle(S);
}

// ---------------------------------------------------------------- the step

function resolveVehicleCollisions() {
  const vs = S.vehicles;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    for (let j = i + 1; j < vs.length; j++) {
      const b = vs[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = vehicleRadius(a) + vehicleRadius(b);
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const closing = Math.abs(a.speed - b.speed);
      if (closing > 190) {
        a.health -= 5; b.health -= 5;
        if (a.driver === 'player' || b.driver === 'player') {
          thudSound(S);
          if (S.t - (S._crashT || -9) > 2.5) { S._crashT = S.t; reportCrime(S, 'crash'); }
        }
        if (a.driver === 'police' || b.driver === 'police') reportCrime(S, 'copCrash');
      }
      a.speed *= 0.55; b.speed *= 0.55;
    }
  }
}

function nearestCopDistance() {
  const p = S.player;
  let best = Infinity;
  for (const v of S.vehicles) {
    if (v.driver === 'police' || v.driver === 'roadblock') {
      best = Math.min(best, Math.hypot(v.x - p.x, v.y - p.y));
    }
  }
  if (S.heli) best = Math.min(best, Math.hypot(S.heli.x - p.x, S.heli.y - p.y));
  return best;
}

function stepGame(dt) {
  const p = S.player;
  handleGamePressed();

  if (p.inVehicle) {
    const v = p.inVehicle;
    const keys = S.input.keys;
    const controls = {
      throttle: (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 0.75 : 0),
      steer: (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0),
      brake: keys.has(' '),
    };
    updateVehiclePhysics(S, v, dt, controls);
    p.x = v.x; p.y = v.y; p.angle = v.angle;
  } else {
    updatePlayerOnFoot(S, dt);
    playerFireControl(S, dt);
  }

  updateTraffic(S, dt, rand);
  updatePolice(S, dt);
  resolveVehicleCollisions();
  updateWanted(S, dt, rand);
  updatePedestrians(S, dt, rand);
  updateGunmen(S, dt);
  if (S.heli) updateHelicopter(S, dt);
  updateMission(S, dt);
  updateRace(S, dt);
  updateTerritory(S, dt);
  updateEmpire(S, dt);
  updateBounties(S);
  updateShells(S);
  updateTaxi(S, dt, rand);

  // The clock turns (one real second is one game minute), the storm
  // breathes toward calm, and the timed HUD lines count down.
  S.dayT = (S.dayT + (dt * CFG.MINUTES_PER_SECOND) / 60) % 24;
  S.weather.storm += (0.22 - S.weather.storm) * dt * 0.006;
  S.wanted.stars = wantedStars(S);
  if (S.message) S.message.t -= dt;
  if (S.dialogue) S.dialogue.t -= dt;
  if (S.banner) S.banner.t -= dt;

  const ref = p.inVehicle || p;
  const d = districtAt(S.city, ref.x, ref.y);
  S._districtName = d ? d.name : 'Puerto Brisa';
  S._nextGiverPos = S.mission.active ? null : currentGiver(S);

  for (const eff of S.effects) eff.t -= dt;
  S.effects = S.effects.filter((eff) => eff.t > 0);

  updateAudio(S, dt, wantedStars(S), nearestCopDistance());
}

// ---------------------------------------------------------------- camera

function updateCamera(dt) {
  const cam = S.cam;
  const p = S.player;
  if (S.camOverride) {
    cam.mode = 'fixed';
    cam.x = S.camOverride.eye[0]; cam.y = S.camOverride.eye[1]; cam.z = S.camOverride.eye[2];
    cam.lx = S.camOverride.look[0]; cam.ly = S.camOverride.look[1]; cam.lz = S.camOverride.look[2];
    cam.fov = CFG.BASE_FOV;
    return;
  }
  if (S.screen === 'title') {
    cam.mode = 'orbit';
    cam.x = 1500 + Math.cos(S.t * 0.07) * 820;
    cam.y = 1500 + Math.sin(S.t * 0.07) * 820;
    cam.z = 300;
    cam.lx = 1500; cam.ly = 1500; cam.lz = 0;
    cam.fov = CFG.BASE_FOV;
    return;
  }
  const ease = Math.min(1, dt * 5.5);
  if (p.inVehicle) {
    const v = p.inVehicle;
    if (cam.mode !== 'chase') { cam.x = v.x - Math.cos(v.angle) * CFG.CHASE_DIST; cam.y = v.y - Math.sin(v.angle) * CFG.CHASE_DIST; cam.z = CFG.CHASE_HEIGHT; }
    cam.mode = 'chase';
    const back = CFG.CHASE_DIST + Math.abs(v.speed) * 0.14;
    const tx = v.x - Math.cos(v.angle) * back;
    const ty = v.y - Math.sin(v.angle) * back;
    cam.x += (tx - cam.x) * ease;
    cam.y += (ty - cam.y) * ease;
    cam.z += (CFG.CHASE_HEIGHT - cam.z) * ease;
    cam.lx = v.x + Math.cos(v.angle) * 150;
    cam.ly = v.y + Math.sin(v.angle) * 150;
    cam.lz = 26;
    cam.fov = CFG.BASE_FOV + clamp(Math.abs(v.speed) / 520, 0, 1) * 11;
  } else {
    if (cam.mode !== 'foot') { cam.yaw = p.angle; cam.x = p.x - Math.cos(p.angle) * CFG.FOOT_DIST; cam.y = p.y - Math.sin(p.angle) * CFG.FOOT_DIST; cam.z = CFG.FOOT_HEIGHT; }
    cam.mode = 'foot';
    cam.yaw += angleDelta(cam.yaw, p.angle) * Math.min(1, dt * 6);
    const tx = p.x - Math.cos(cam.yaw) * CFG.FOOT_DIST;
    const ty = p.y - Math.sin(cam.yaw) * CFG.FOOT_DIST;
    cam.x += (tx - cam.x) * ease;
    cam.y += (ty - cam.y) * ease;
    cam.z += (CFG.FOOT_HEIGHT - cam.z) * ease;
    cam.lx = p.x + Math.cos(cam.yaw) * 170;
    cam.ly = p.y + Math.sin(cam.yaw) * 170;
    cam.lz = 26;
    cam.fov = CFG.BASE_FOV;
  }
}

// ---------------------------------------------------------------- render

function renderWorld() {
  const sky = skyPalette(S.dayT, S.weather.storm);
  R.frame(S, sky);
  R.sky(S, sky);
  R.drawMesh(S.meshes.ground, { tex: S.textures.groundTex });
  R.drawMesh(S.meshes.tex, { tex: S.textures.facadeTex });
  R.drawMesh(S.meshes.sign, { tex: S.textures.signTex });
  R.drawMesh(S.meshes.col, {});

  const dyn = new MeshBuilder();
  const dynT = new MeshBuilder();
  const p = S.player;
  for (const veh of S.vehicles) {
    if (Math.hypot(veh.x - p.x, veh.y - p.y) < 2800) drawVehicle(S, dyn, dynT, veh);
  }
  drawPedestrians(S, dyn, dynT);
  drawPlayer(S, dyn, dynT);
  if (S.heli) drawHelicopter(S, dyn, dynT);
  dyn.upload(R.gl, dynMesh, true);
  R.drawMesh(dynMesh, {});

  R.drawMesh(S.meshes.water, { transparent: true });
  drawShells(S, dynT);
  // Markers: the mission target, the next giver, the taxi fare.
  if (S.mission.active && S.mission.target) {
    dynT.ring(S.mission.target.x, S.mission.target.y, 3, 55 + Math.sin(S.t * 5) * 7, 44 + Math.sin(S.t * 5) * 6, [1, 0.83, 0.3, 0.9], 14);
  } else if (S._nextGiverPos) {
    dynT.ring(S._nextGiverPos.x, S._nextGiverPos.y, 3, 42 + Math.sin(S.t * 5) * 6, 34 + Math.sin(S.t * 5) * 5, [1, 0.83, 0.3, 0.9], 12);
  }
  if (S.race && !S.race.finished && S.race.target) {
    dynT.ring(S.race.target.x, S.race.target.y, 3, 60, 48, [0.3, 0.9, 1, 0.85], 14);
  }
  if (S.taxi) {
    const tx = S.taxi.stage === 'pickup' ? S.taxi.x : S.taxi.destX;
    const ty = S.taxi.stage === 'pickup' ? S.taxi.y : S.taxi.destY;
    dynT.ring(tx, ty, 3, 46, 37, [1, 0.95, 0.3, 0.9], 12);
  }
  for (const eff of S.effects) {
    if (eff.kind === 'tracer') dynT.beam(eff.x1, eff.y1, eff.z1, eff.x2, eff.y2, eff.z2, 1.6, eff.color);
    else if (eff.kind === 'flash') dynT.disc(eff.x, eff.y, eff.z, 11, eff.color, 8);
  }
  dynT.upload(R.gl, dynTMesh, true);
  R.drawMesh(dynTMesh, { transparent: true });
}

function render() {
  renderWorld();
  hud.clearRect(0, 0, W, H);
  if (S.screen === 'title') drawTitleScreen(S, hud, W, H);
  else if (S.screen === 'briefing') drawBriefingScreen(S, hud, W, H);
  else if (S.screen === 'map') drawMapScreen(S, hud, W, H);
  else if (S.screen === 'heist') drawHeistPlanning(S, hud, W, H);
  else if (S.screen === 'phone') { drawHUD(S, hud, W, H); drawPhone(S, hud, W, H); }
  else drawHUD(S, hud, W, H);
}

// ---------------------------------------------------------------- loop

if (shotName) stageScreenshotScene(S, shotName);

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.t += dt;
  if (!shotName) {
    if (S.player.dead) {
      S._deathT = (S._deathT || 0) + dt;
      if (S._deathT > 2.4) respawnAtHospital();
    } else {
      handleScreens();
      if (S.screen === 'game') stepGame(dt);
    }
    S.input.pressed.clear();
  }
  updateCamera(dt);
  render();
  if (shotName && !window.__shotReady) window.__shotReady = true;
}
requestAnimationFrame(frame);
