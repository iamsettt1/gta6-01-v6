// Puerto Brisa 3D — the LPD: wanted heat, named response units, pursuit,
// roadblocks and the bust meter.
//
// Wanted is a heat float: crimes add heat, stars are ceil(heat), and
// heat bleeds away while no unit has eyes on Rosa. Police cars are real
// vehicles driven at the player; from three stars they also park across
// the road ahead as roadblocks, and from four the KITE-1 helicopter
// joins. The HUD's response panel reads the live units from here —
// names, roles and distances are the actual spawned cars, not dressing.

import { clamp, angleDelta } from './config.js';
import { nearestRoadPoint } from './city-world.js';
import { createVehicle, updateVehiclePhysics } from './vehicles-3d.js';
import { createHelicopter, removeHelicopter } from './helicopter.js';

export const CAR_UNITS = [
  { name: 'CORAL-48', role: 'RAMMING' },
  { name: 'CORAL-85', role: 'FLANKING' },
  { name: 'DELTA-7', role: 'INTERCEPT' },
  { name: 'SIERRA-2', role: 'PURSUIT' },
  { name: 'MARLIN-3', role: 'SHORE WATCH' },
  { name: 'VEGA-5', role: 'ROADBLOCK' },
  { name: 'ORO-9', role: 'PURSUIT' },
  { name: 'BRISA-1', role: 'INTERCEPT' },
];
const DESIRED_CARS = [0, 2, 3, 4, 5, 6];

const CRIME_HEAT = {
  carjack: 1.0, crash: 0.3, shot: 0.7, pedDown: 1.2,
  gunmanDown: 0.4, copCrash: 1.5, theft: 0.8, race: 0.5,
};

export function wantedStars(S) {
  return S.wanted.heat <= 0 ? 0 : Math.min(5, Math.ceil(S.wanted.heat));
}

export function reportCrime(S, kind) {
  const add = CRIME_HEAT[kind] || 0.5;
  S.wanted.heat = Math.min(5, S.wanted.heat + add);
  S.wanted.lastCrimeAt = S.t;
}

export function setWanted(S, stars) {
  S.wanted.heat = stars <= 0 ? 0 : Math.max(S.wanted.heat, stars - 0.2);
  if (stars > 0) S.wanted.lastCrimeAt = S.t;
}

export function clearWantedStars(S, n) {
  S.wanted.heat = Math.max(0, S.wanted.heat - n);
}

function playerPos(S) {
  const p = S.player;
  return p.inVehicle ? { x: p.inVehicle.x, y: p.inVehicle.y, veh: p.inVehicle } : { x: p.x, y: p.y, veh: null };
}

function policeCars(S) {
  return S.vehicles.filter((v) => v.driver === 'police' || v.driver === 'roadblock');
}

function spawnPoliceCar(S, rand, x, y) {
  const unit = CAR_UNITS[policeCars(S).length % CAR_UNITS.length];
  const veh = createVehicle(S, 'police', x, y, 0, { driver: 'police' });
  veh.unitName = unit.name;
  veh.unitRole = unit.role;
  return veh;
}

export function updateWanted(S, dt, rand) {
  const W = S.wanted;
  const stars = wantedStars(S);
  const pp = playerPos(S);

  // Heat decay: slow in the open, faster with no eyes on her.
  if (S.t - W.lastCrimeAt > 9 && stars > 0) {
    const eyes = policeCars(S).some((v) => Math.hypot(v.x - pp.x, v.y - pp.y) < 560) || !!S.heli;
    W.heat = Math.max(0, W.heat - dt * (eyes ? 0.012 : 0.05));
  }

  // Spawn / despawn the car fleet toward the star level's strength.
  const cars = policeCars(S).filter((v) => v.driver === 'police');
  W.spawnT = (W.spawnT || 0) - dt;
  if (cars.length < DESIRED_CARS[stars] && W.spawnT <= 0) {
    W.spawnT = 1.1;
    // A road point in the ring around the player: close, not visible.
    for (let tries = 0; tries < 10; tries++) {
      const a = rand.range(0, Math.PI * 2);
      const d = rand.range(760, 1080);
      const near = nearestRoadPoint(S, pp.x + Math.cos(a) * d, pp.y + Math.sin(a) * d);
      if (near && Math.hypot(near.x - pp.x, near.y - pp.y) > 620) {
        spawnPoliceCar(S, rand, near.x, near.y);
        break;
      }
    }
  }
  // Far-away units give up and are struck from the fleet.
  for (const v of policeCars(S)) {
    if (Math.hypot(v.x - pp.x, v.y - pp.y) > 3000 || (stars === 0 && Math.hypot(v.x - pp.x, v.y - pp.y) > 500)) {
      S.vehicles.splice(S.vehicles.indexOf(v), 1);
    }
  }

  // The helicopter joins at four stars and leaves below them.
  if (stars >= 4 && !S.heli) createHelicopter(S, pp.x + 500, pp.y - 500);
  if (stars < 4 && S.heli) removeHelicopter(S);

  // Roadblocks from three stars: two cars parked across the road ahead.
  W.blockT = (W.blockT || 0) - dt;
  if (stars >= 3 && pp.veh && W.blockT <= 0) {
    W.blockT = 17;
    const ahead = 620;
    const fx = Math.cos(pp.veh.angle), fy = Math.sin(pp.veh.angle);
    const near = nearestRoadPoint(S, pp.x + fx * ahead, pp.y + fy * ahead);
    if (near) {
      const road = near.road;
      for (const s of [-1, 1]) {
        const bx = road.dir === 'v' ? road.x + road.w / 2 + s * 20 : near.x;
        const by = road.dir === 'v' ? near.y : road.y + road.h / 2 + s * 20;
        const veh = spawnPoliceCar(S, rand, bx, by);
        veh.driver = 'roadblock';
        veh.unitRole = 'ROADBLOCK';
        veh.angle = road.dir === 'v' ? 0 : Math.PI / 2;
      }
    }
  }

  // The bust meter: boxed in and slow with units close, she is taken.
  const speed = pp.veh ? Math.abs(pp.veh.speed) : S.player.moving ? 120 : 0;
  const close = policeCars(S).filter((v) => Math.hypot(v.x - pp.x, v.y - pp.y) < 155).length;
  if (stars > 0 && speed < 32 && close >= 1) {
    W.bustT += dt * (close >= 2 ? 1.35 : 0.8) * (S.heli ? 1.3 : 1);
    if (W.bustT >= 1.6) {
      W.bustT = 0;
      if (S.hooks.onBusted) S.hooks.onBusted(S);
    }
  } else {
    W.bustT = Math.max(0, W.bustT - dt * 2);
  }
}

export function updatePolice(S, dt) {
  const pp = playerPos(S);
  const pvx = pp.veh ? Math.cos(pp.veh.angle) * pp.veh.speed : 0;
  const pvy = pp.veh ? Math.sin(pp.veh.angle) * pp.veh.speed : 0;
  for (const veh of S.vehicles) {
    if (veh.driver === 'roadblock') {
      // A roadblock wakes into a pursuit once she blows past it.
      if (Math.hypot(veh.x - pp.x, veh.y - pp.y) < 150) veh.driver = 'police';
      else { updateVehiclePhysics(S, veh, dt, {}); continue; }
    }
    if (veh.driver !== 'police') continue;
    // Intercept point: where she will be, not where she is.
    const tx = pp.x + pvx * 0.45, ty = pp.y + pvy * 0.45;
    const want = Math.atan2(ty - veh.y, tx - veh.x);
    const delta = angleDelta(veh.angle, want);
    const dist = Math.hypot(tx - veh.x, ty - veh.y);
    let throttle = 1;
    if (Math.abs(delta) > 2.2) throttle = -0.6; // overshot: back up and swing round
    else if (Math.abs(delta) > 1.1) throttle = 0.45;
    else if (dist < 110) throttle = 0.6;
    if (veh.speed > 505) throttle = 0;
    updateVehiclePhysics(S, veh, dt, {
      throttle, steer: clamp(delta * 2.6, -1, 1), brake: false,
    });
  }
}

// The HUD panel's data: the helicopter first, then the nearest cars,
// with live distances in metres (20 world units to the metre).
export function policePanel(S) {
  const pp = playerPos(S);
  const out = [];
  if (S.heli) {
    out.push({
      name: 'KITE-1', role: 'AIR UNIT',
      dist: Math.round(Math.hypot(S.heli.x - pp.x, S.heli.y - pp.y) / 20),
    });
  }
  const cars = policeCars(S)
    .map((v) => ({
      name: v.unitName || 'LPD', role: v.unitRole || 'PURSUIT',
      dist: Math.round(Math.hypot(v.x - pp.x, v.y - pp.y) / 20),
    }))
    .sort((a, b) => a.dist - b.dist);
  return out.concat(cars).slice(0, 6);
}
