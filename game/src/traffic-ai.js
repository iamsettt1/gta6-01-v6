// Puerto Brisa 3D — ambient life: traffic cars and pedestrians.
//
// Traffic follows the road bands: each car owns a road and a direction,
// steers for a point ahead on its lane, and at the end of a band picks a
// connecting road (or turns around). Cars that drift too far from the
// player are quietly respawned on roads nearer by, so the streets around
// Rosa are always alive without simulating the whole map. Pedestrians
// wander the pavements, stand at their posts if they are mission givers,
// and run when shots land near them.

import { clamp, angleDelta } from './config.js';
import { isOnRoad, nearestRoadPoint, collideWithBuildings } from './city-world.js';
import { VEHICLE_CLASSES, CAR_CLASS_KEYS, createVehicle, updateVehiclePhysics } from './vehicles-3d.js';
import { drawHumanoid } from './player-3d.js';

const TRAFFIC_TOP = 265;

// Steer a vehicle toward a world point; shared by traffic, police and
// racers in spirit, tuned here for calm street driving.
export function steerToward(S, veh, tx, ty, dt, opts = {}) {
  const want = Math.atan2(ty - veh.y, tx - veh.x);
  const delta = angleDelta(veh.angle, want);
  const steer = clamp(delta * 2.4, -1, 1);
  const top = opts.top || TRAFFIC_TOP;
  let throttle = Math.abs(delta) > 1.9 ? -0.45 : Math.abs(delta) > 0.7 ? 0.35 : 0.8;
  if (veh.speed > top) throttle = 0;
  if (opts.throttle !== undefined) throttle = opts.throttle;
  return { throttle, steer, brake: !!opts.brake };
}

// Is there a vehicle close ahead of this one? Traffic queues politely.
function vehicleAhead(S, veh, gap) {
  const fx = Math.cos(veh.angle), fy = Math.sin(veh.angle);
  for (const other of S.vehicles) {
    if (other === veh || other.health <= 0) continue;
    const dx = other.x - veh.x, dy = other.y - veh.y;
    const ahead = dx * fx + dy * fy;
    if (ahead > 0 && ahead < gap && Math.abs(dx * -fy + dy * fx) < 34) return other;
  }
  return null;
}

export function spawnTrafficCar(S, rand, nearX, nearY) {
  // A road point within a ring around (nearX, nearY), so spawns cluster
  // where the player actually is.
  for (let tries = 0; tries < 12; tries++) {
    const road = rand.pick(S.city.roads);
    const along = rand.next();
    const x = road.dir === 'v' ? road.x + road.w / 2 : road.x + along * road.w;
    const y = road.dir === 'v' ? road.y + along * road.h : road.y + road.h / 2;
    const d = Math.hypot(x - nearX, y - nearY);
    if (d < 500 || d > 1900) continue;
    const dir = rand.sign();
    const clsKey = rand.pick(CAR_CLASS_KEYS);
    const veh = createVehicle(S, clsKey, x, y, 0, {
      color: rand.pick(VEHICLE_CLASSES[clsKey].colors), driver: 'traffic',
    });
    veh.ai.road = road;
    veh.ai.dir = dir;
    veh.angle = road.dir === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    return veh;
  }
  return null;
}

export function spawnTraffic(S, rand, n) {
  for (let i = 0; i < n; i++) spawnTrafficCar(S, rand, S.player.x, S.player.y);
}

export function scatterParkedCars(S, rand, n) {
  for (let i = 0; i < n; i++) {
    const road = rand.pick(S.city.roads);
    const clsKey = rand.pick(CAR_CLASS_KEYS);
    const along = rand.range(0.06, 0.94);
    const side = rand.sign();
    let x, y, angle;
    if (road.dir === 'v') {
      x = road.x + road.w / 2 + side * (road.w / 2 - 13);
      y = road.y + along * road.h;
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road.x + along * road.w;
      y = road.y + road.h / 2 + side * (road.h / 2 - 13);
      angle = side > 0 ? 0 : Math.PI;
    }
    createVehicle(S, clsKey, x, y, angle, {
      color: rand.pick(VEHICLE_CLASSES[clsKey].colors), driver: 'parked',
    });
  }
}

function lanePoint(veh) {
  const road = veh.ai.road;
  if (!road) return null;
  const off = veh.ai.dir * 22; // right-hand traffic
  if (road.dir === 'v') {
    return {
      x: road.x + road.w / 2 + off,
      y: veh.y + veh.ai.dir * 190,
      endDist: veh.ai.dir > 0 ? road.y + road.h - veh.y : veh.y - road.y,
    };
  }
  return {
    x: veh.x + veh.ai.dir * 190,
    y: road.y + road.h / 2 - off,
    endDist: veh.ai.dir > 0 ? road.x + road.w - veh.x : veh.x - road.x,
  };
}

// At a band's end: find a road crossing near the exit point and take it,
// preferring a turn over going straight; U-turn if the street dies.
function pickNextRoad(S, veh, rand) {
  const road = veh.ai.road;
  const exitX = road.dir === 'v' ? veh.x : veh.ai.dir > 0 ? road.x + road.w : road.x;
  const exitY = road.dir === 'v' ? (veh.ai.dir > 0 ? road.y + road.h : road.y) : veh.y;
  const options = [];
  for (const r of S.city.roads) {
    if (r === road) continue;
    const nx = Math.max(r.x, Math.min(exitX, r.x + r.w));
    const ny = Math.max(r.y, Math.min(exitY, r.y + r.h));
    if (Math.hypot(nx - exitX, ny - exitY) < 130) options.push(r);
  }
  if (!options.length) {
    veh.ai.dir *= -1;
    return;
  }
  const next = rand.pick(options);
  veh.ai.road = next;
  // Direction on the new road: whichever way leads away from the entry.
  if (next.dir === 'v') veh.ai.dir = veh.y < next.y + next.h / 2 ? 1 : -1;
  else veh.ai.dir = veh.x < next.x + next.w / 2 ? 1 : -1;
}

export function updateTraffic(S, dt, rand) {
  const p = S.player;
  for (const veh of S.vehicles) {
    if (veh.driver === 'traffic') {
      const distP = Math.hypot(veh.x - p.x, veh.y - p.y);
      if (distP > 2700) {
        // Respawn near the player instead of simulating the far side.
        const spot = spawnTrafficCar(S, rand, p.x, p.y);
        if (spot) {
          veh.x = spot.x; veh.y = spot.y; veh.angle = spot.angle;
          veh.ai.road = spot.ai.road; veh.ai.dir = spot.ai.dir;
          veh.speed = 0;
          S.vehicles.splice(S.vehicles.indexOf(spot), 1);
        }
        continue;
      }
      if (!veh.ai.road || !isOnRoad(S, veh.x, veh.y)) {
        const near = nearestRoadPoint(S, veh.x, veh.y);
        if (near) { veh.ai.road = near.road; }
      }
      const lane = lanePoint(veh);
      if (!lane) continue;
      let controls = steerToward(S, veh, lane.x, lane.y, dt, {});
      const ahead = vehicleAhead(S, veh, 120);
      if (ahead) controls = { throttle: ahead.speed > veh.speed ? 0.15 : 0, steer: controls.steer, brake: veh.speed > ahead.speed + 12 };
      if (lane.endDist < 110) pickNextRoad(S, veh, rand);
      // A car that has not moved in a while reverses out of trouble.
      if (Math.abs(veh.speed) < 6) {
        veh.ai.stuckT += dt;
        if (veh.ai.stuckT > 2.4) { veh.ai.waitT = 0.7; veh.ai.stuckT = 0; }
      } else veh.ai.stuckT = 0;
      if (veh.ai.waitT > 0) {
        veh.ai.waitT -= dt;
        controls = { throttle: -0.55, steer: -controls.steer, brake: false };
      }
      updateVehiclePhysics(S, veh, dt, controls);
    } else if (veh.driver === 'parked' || veh.driver === 'none') {
      updateVehiclePhysics(S, veh, dt, {});
    }
  }
}

// ------------------------------------------------------------ pedestrians --

const PED_SHIRTS = ['#e8b34b', '#39c2d7', '#c94f6d', '#7fb069', '#e0e4e6', '#e08a3c', '#8a6f4d', '#f0e0b0'];
const PED_PANTS = ['#2e3440', '#4c5a68', '#6e5636', '#3a3f45', '#7a4a3a'];
const PED_SKINS = ['#a06a42', '#7a4a2a', '#c98d5f', '#8a5a34', '#e0aa72'];

export function spawnPedestrian(S, x, y, kind, opts = {}) {
  const ped = {
    id: S.nextId++,
    x, y, angle: opts.angle || 0, speed: 0,
    kind, // walker | giver | gunman | bounty
    name: opts.name || '',
    shirt: opts.shirt || PED_SHIRTS[(S.nextId * 7) % PED_SHIRTS.length],
    pants: opts.pants || PED_PANTS[(S.nextId * 3) % PED_PANTS.length],
    skin: opts.skin || PED_SKINS[(S.nextId * 5) % PED_SKINS.length],
    hair: opts.hair || '#241a12',
    health: 100, dead: false,
    walkPhase: (x * 0.37 + y * 0.73) % 6,
    wanderT: 0, tx: x, ty: y,
    fleeT: 0, threatX: 0, threatY: 0,
    homeX: x, homeY: y,
    weapon: opts.weapon || null,
    fireT: 0, bountyIdx: -1, ring: null,
  };
  S.peds.push(ped);
  return ped;
}

export function scatterPedestrians(S, rand, n) {
  for (let i = 0; i < n; i++) {
    const road = rand.pick(S.city.roads);
    const along = rand.next();
    const side = rand.sign();
    let x, y;
    if (road.dir === 'v') {
      x = road.x + road.w / 2 + side * (road.w / 2 + 20);
      y = road.y + along * road.h;
    } else {
      x = road.x + along * road.w;
      y = road.y + road.h / 2 + side * (road.h / 2 + 20);
    }
    spawnPedestrian(S, x, y, 'walker');
  }
}

export function updatePedestrians(S, dt, rand) {
  const p = S.player;
  for (const ped of S.peds) {
    if (ped.dead || ped.kind === 'gunman') continue; // combat moves gunmen
    let tx = null, ty = null, speed = 52;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      tx = ped.x + (ped.x - ped.threatX);
      ty = ped.y + (ped.y - ped.threatY);
      speed = 165;
    } else if (ped.kind === 'giver') {
      // Givers hold their post and face whoever comes to talk.
      const d = Math.hypot(p.x - ped.x, p.y - ped.y);
      if (d < 200 && !p.inVehicle) ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
      continue;
    } else if (ped.kind === 'bounty') {
      // Bounty targets prowl a small turf around their home corner.
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = rand.range(2.5, 5);
        ped.tx = ped.homeX + rand.range(-170, 170);
        ped.ty = ped.homeY + rand.range(-170, 170);
      }
      tx = ped.tx; ty = ped.ty; speed = 44;
    } else {
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = rand.range(3, 7);
        ped.tx = ped.x + rand.range(-340, 340);
        ped.ty = ped.y + rand.range(-340, 340);
      }
      tx = ped.tx; ty = ped.ty;
    }
    if (tx === null) continue;
    const dx = tx - ped.x, dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) continue;
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const hit = collideWithBuildings(S, nx, ny, 12);
    ped.x = hit.x;
    ped.y = hit.y;
    ped.walkPhase += dt * 7.5;
  }
}

export function drawPedestrians(S, dyn, dynT) {
  const cam = S.cam;
  for (const ped of S.peds) {
    if (Math.abs(ped.x - cam.x) > 2100 || Math.abs(ped.y - cam.y) > 2100) continue;
    if (ped.dead) {
      // A downed figure lies flat: one low box, no ceremony.
      dyn.box(ped.x, ped.y, 3, 30, 11, 5, ped.angle, ped.shirt);
      continue;
    }
    drawHumanoid(dyn, dynT, {
      x: ped.x, y: ped.y, angle: ped.angle,
      shirt: ped.shirt, pants: ped.pants, skin: ped.skin, hair: ped.hair,
      walkPhase: ped.walkPhase, weapon: ped.weapon,
      ring: ped.ring,
    });
  }
}
