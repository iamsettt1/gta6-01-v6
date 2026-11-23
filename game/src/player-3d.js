// Puerto Brisa 3D — the player and the humanoid figure.
//
// Rosa Camacho, and every pedestrian, gunman and bounty target in the
// city, is the same little low-poly figure: box legs that swing as they
// walk, a torso, arms, a head with a hair cap. drawHumanoid paints one
// into the dynamic batch; updatePlayerOnFoot moves Rosa through the
// world with building collision and a camera-relative WASD scheme;
// tryEnterVehicle / exitVehicle handle the E key's car work.

import { CFG, clamp, angleDelta } from './config.js';
import { collideWithBuildings, isWaterAt } from './city-world.js';
import { vehicleRadius } from './vehicles-3d.js';

export function createPlayer(S, x, y) {
  const player = {
    x, y, angle: -Math.PI / 2, // facing north, toward the marina office
    health: 100, armour: 0,
    inVehicle: null,
    weapon: 'fists', // fists | pistol | smg | rifle
    walkPhase: 0, moving: 0,
    shirt: '#14c8bc', pants: '#2e3440', skin: '#a06a42', hair: '#1d1410',
    dead: false,
  };
  S.player = player;
  return player;
}

// Paint one humanoid. o: {x, y, angle, shirt, pants, skin, hair,
// walkPhase, weapon, ring} — ring (a colour) draws the bounty/territory
// marker circle under the figure in the transparent pass.
export function drawHumanoid(dyn, dynT, o) {
  const swing = Math.sin(o.walkPhase || 0) * 0.55;
  const aim = o.weapon && o.weapon !== 'fists';
  if (o.ring) dynT.ring(o.x, o.y, 1.6, 30, 24, o.ring, 22);
  dynT.plane(o.x, o.y, 1.1, 30, 22, o.angle, [0, 0, 0, 0.3], 1);
  const P = (lx, ly, lz) => {
    const c = Math.cos(o.angle), s = Math.sin(o.angle);
    return [o.x + lx * c - ly * s, o.y + lx * s + ly * c, lz];
  };
  // Legs (swing opposite), torso, arms, head.
  for (const side of [-1, 1]) {
    const [lx, ly] = P(0, side * 4.5, 0);
    dyn.box(lx, ly, 6, 5.5, 5, 12, o.angle, o.pants, { pitch: side * swing });
  }
  dyn.box(o.x, o.y, 18, 8.5, 15, 12, o.angle, o.shirt);
  for (const side of [-1, 1]) {
    const [ax, ay] = P(0, side * 10, 0);
    const pitch = aim ? -1.25 : -side * swing * 0.8;
    dyn.box(ax, ay, 19, 4.5, 4.5, 12, o.angle, o.shirt, { pitch });
  }
  dyn.box(o.x, o.y, 28.5, 8.5, 9, 8, o.angle, o.skin);
  dyn.box(o.x, o.y, 33.5, 9.5, 10, 3, o.angle, o.hair);
  if (aim) {
    const len = o.weapon === 'rifle' ? 24 : o.weapon === 'smg' ? 17 : 12;
    const [gx, gy] = P(10 + len / 2, 2, 0);
    dyn.box(gx, gy, 21, len, 3.5, 4.5, o.angle, '#22262b');
  }
}

export function drawPlayer(S, dyn, dynT) {
  const p = S.player;
  if (p.inVehicle || p.dead) return;
  drawHumanoid(dyn, dynT, {
    x: p.x, y: p.y, angle: p.angle,
    shirt: p.shirt, pants: p.pants, skin: p.skin, hair: p.hair,
    walkPhase: p.walkPhase, weapon: p.weapon, ring: null,
  });
}

// WASD in camera space: W runs away from the camera, A/D strafe. The
// camera yaw is Rosa's own smoothed heading, kept in S.cam.yaw by the
// camera code, so movement and view never fight.
export function updatePlayerOnFoot(S, dt) {
  const p = S.player;
  if (p.inVehicle || p.dead) return;
  const keys = S.input.keys;
  let ix = 0, iy = 0;
  if (keys.has('w') || keys.has('arrowup')) iy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) iy += 1;
  if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
  if (keys.has('d') || keys.has('arrowright')) ix += 1;
  const moving = ix !== 0 || iy !== 0;
  p.moving = moving ? 1 : 0;
  if (!moving) return;
  // Screen-space input -> world direction through the camera yaw. The
  // camera looks along +yaw; screen up (iy=-1) is world forward.
  const yaw = S.cam.yaw;
  const fx = Math.cos(yaw), fy = Math.sin(yaw);
  const rx = -fy, ry = fx; // screen right in world terms
  let mx = fx * -iy + rx * ix;
  let my = fy * -iy + ry * ix;
  const ml = Math.hypot(mx, my) || 1;
  mx /= ml; my /= ml;
  const run = keys.has('shift');
  const speed = run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
  // Turn toward the move direction, then step (per axis, so walls slide).
  const target = Math.atan2(my, mx);
  p.angle += clamp(angleDelta(p.angle, target), -11 * dt, 11 * dt);
  const nx = p.x + mx * speed * dt;
  if (!isWaterAt(S, nx, p.y)) {
    const hit = collideWithBuildings(S, nx, p.y, CFG.PLAYER_RADIUS);
    p.x = hit.x;
  }
  const ny = p.y + my * speed * dt;
  if (!isWaterAt(S, p.x, ny)) {
    const hit = collideWithBuildings(S, p.x, ny, CFG.PLAYER_RADIUS);
    p.y = hit.y;
  }
  p.x = clamp(p.x, 24, CFG.WORLD_W - 24);
  p.y = clamp(p.y, 24, CFG.WORLD_H - 24);
  p.walkPhase += dt * (run ? 11 : 8);
}

// The nearest usable vehicle within reach, or null.
export function nearestVehicle(S, x, y, range = CFG.ENTER_RANGE) {
  let best = null, bestD = range;
  for (const veh of S.vehicles) {
    if (veh.health <= 0) continue;
    const d = Math.hypot(veh.x - x, veh.y - y) - vehicleRadius(veh);
    if (d < bestD) { bestD = d; best = veh; }
  }
  return best;
}

export function tryEnterVehicle(S) {
  const p = S.player;
  const veh = nearestVehicle(S, p.x, p.y);
  if (!veh) return false;
  const hadDriver = veh.driver === 'traffic' || veh.driver === 'racer';
  veh.driver = 'player';
  p.inVehicle = veh;
  if (hadDriver && S.hooks.onCarjack) S.hooks.onCarjack(S, veh);
  if (S.hooks.onEnterVehicle) S.hooks.onEnterVehicle(S, veh);
  return true;
}

export function exitVehicle(S) {
  const p = S.player;
  const veh = p.inVehicle;
  if (!veh) return;
  // Step out on the left side of the car, clear of its body: the local
  // offset (0, -side) rotated into world space by the car's heading.
  const side = vehicleRadius(veh) + 18;
  const c = Math.cos(veh.angle), s = Math.sin(veh.angle);
  p.x = veh.x + side * s;
  p.y = veh.y - side * c;
  const hit = collideWithBuildings(S, p.x, p.y, CFG.PLAYER_RADIUS);
  p.x = hit.x;
  p.y = hit.y;
  p.angle = veh.angle;
  veh.driver = 'none';
  if (Math.abs(veh.speed) > 4) veh.speed = 4;
  p.inVehicle = null;
}
