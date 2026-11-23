// Puerto Brisa 3D — vehicles: meshes, classes and the shared physics.
//
// One physics step (updateVehiclePhysics) moves every car and boat in
// the game — player, traffic, police, racers — and every caller passes
// the state S first and a plain {throttle, steer, brake} control set.
// Cars are boxes with a cabin and cylinder wheels; boats are prism
// hulls. Eight car classes plus two boat classes, each with its own
// proportions, pace and paint list.

import { CFG, clamp } from './config.js';
import { collideWithBuildings, isWaterAt } from './city-world.js';

export const VEHICLE_CLASSES = {
  sedan: {
    name: 'Coral Sedan', kind: 'car', l: 92, w: 44, bodyH: 15, cabinH: 13,
    top: 430, accel: 250, grip: 2.0,
    colors: ['#c9563c', '#3f6fb5', '#7a8894', '#d8d2c2', '#4a7d5d', '#8a4a6e'],
  },
  taxi: {
    name: 'Brisa Cab', kind: 'car', l: 92, w: 44, bodyH: 15, cabinH: 13,
    top: 415, accel: 245, grip: 2.0, colors: ['#f2b63c'],
  },
  sports: {
    name: 'Véloce GT', kind: 'car', l: 96, w: 46, bodyH: 11, cabinH: 10,
    top: 580, accel: 360, grip: 2.5,
    colors: ['#e8641e', '#d7263d', '#f2c94c', '#26547c', '#10b5a6'],
  },
  pickup: {
    name: 'Mulo Pickup', kind: 'car', l: 100, w: 47, bodyH: 17, cabinH: 13,
    top: 400, accel: 235, grip: 1.9,
    colors: ['#96755a', '#5d6e5a', '#a33b2e', '#4c5a68'],
  },
  van: {
    name: 'Carga Van', kind: 'car', l: 104, w: 48, bodyH: 26, cabinH: 6,
    top: 370, accel: 215, grip: 1.8,
    colors: ['#d8d2c2', '#7a8894', '#3f6fb5', '#c9563c'],
  },
  muscle: {
    name: 'Trueno Muscle', kind: 'car', l: 98, w: 47, bodyH: 13, cabinH: 11,
    top: 540, accel: 330, grip: 2.2,
    colors: ['#7a1f2b', '#1e3a5f', '#e08a3c', '#22262b'],
  },
  compact: {
    name: 'Pico Compact', kind: 'car', l: 76, w: 40, bodyH: 14, cabinH: 12,
    top: 390, accel: 240, grip: 2.2,
    colors: ['#7fb069', '#e8b34b', '#c94f6d', '#39c2d7', '#e0e4e6'],
  },
  police: {
    name: 'LPD Interceptor', kind: 'car', l: 94, w: 45, bodyH: 15, cabinH: 12,
    top: 545, accel: 320, grip: 2.4, colors: ['#eef1f5'],
  },
  skiff: {
    name: 'Harbour Skiff', kind: 'boat', l: 84, w: 34, bodyH: 10, cabinH: 0,
    top: 300, accel: 170, grip: 1.4, colors: ['#e8e4da', '#7fb0b8', '#c9563c'],
  },
  speedboat: {
    name: 'Flecha Speedboat', kind: 'boat', l: 96, w: 36, bodyH: 9, cabinH: 6,
    top: 460, accel: 260, grip: 1.6, colors: ['#e8641e', '#26547c', '#f2c94c'],
  },
};

export const CAR_CLASS_KEYS = Object.keys(VEHICLE_CLASSES).filter(
  (k) => VEHICLE_CLASSES[k].kind === 'car' && k !== 'police',
);

let nextVehicleId = 1;

export function createVehicle(S, clsKey, x, y, angle, opts = {}) {
  const cls = VEHICLE_CLASSES[clsKey];
  const veh = {
    id: nextVehicleId++,
    cls: clsKey, kind: cls.kind,
    x, y, angle, speed: 0,
    health: 100, color: opts.color || cls.colors[0],
    driver: opts.driver || 'none', // player | traffic | police | parked | racer | target | none
    unitName: '', unitRole: '',
    ai: { tx: x, ty: y, waitT: 0, stuckT: 0, lane: 0 },
    topMult: 1, gripMult: 1,
    wheelSpin: 0,
  };
  S.vehicles.push(veh);
  return veh;
}

export function vehicleRadius(veh) {
  const cls = VEHICLE_CLASSES[veh.cls];
  return Math.max(cls.l, cls.w) * 0.36;
}

export function vehicleName(veh) {
  return VEHICLE_CLASSES[veh.cls].name;
}

// The shared physics step. Controls are normalised: throttle -1..1
// (negative is reverse), steer -1..1, brake a boolean. Empty control
// sets are fine — traffic steps parked cars with {} every frame.
export function updateVehiclePhysics(S, veh, dt, controls = {}) {
  const cls = VEHICLE_CLASSES[veh.cls];
  const throttle = clamp(controls.throttle || 0, -1, 1);
  const steer = clamp(controls.steer || 0, -1, 1);
  const brake = !!controls.brake;
  const wrecked = veh.health <= 0;

  if (wrecked || throttle === 0) {
    veh.speed -= veh.speed * Math.min(1, (wrecked ? 2.2 : 0.7) * dt);
    if (Math.abs(veh.speed) < 2) veh.speed = 0;
  } else if (brake) {
    veh.speed -= Math.sign(veh.speed) * Math.min(Math.abs(veh.speed), 620 * dt);
  } else {
    const top = cls.top * veh.topMult * (throttle > 0 ? 1 : 0.32);
    veh.speed += throttle * cls.accel * dt;
    if (veh.speed > top) veh.speed = Math.max(top, veh.speed - 300 * dt);
    if (veh.speed < -top) veh.speed = -top;
  }
  if (brake) veh.speed -= veh.speed * 0.8 * dt;

  // Steering bites with speed; a parked car cannot turn on the spot.
  if (Math.abs(veh.speed) > 3) {
    const bite = clamp(Math.abs(veh.speed) / 200, 0.25, 1.15);
    veh.angle += steer * cls.grip * veh.gripMult * bite * dt * Math.sign(veh.speed);
  }

  const fx = Math.cos(veh.angle), fy = Math.sin(veh.angle);
  let nx = veh.x + fx * veh.speed * dt;
  let ny = veh.y + fy * veh.speed * dt;

  if (veh.kind === 'boat') {
    // Boats live on water; land is a soft, grinding stop.
    if (!isWaterAt(S, nx, ny)) {
      veh.speed *= 0.4;
      nx = veh.x;
      ny = veh.y;
    }
    veh.x = clamp(nx, 30, CFG.WORLD_W - 30);
    veh.y = clamp(ny, 30, CFG.WORLD_H - 30);
  } else {
    // Cars drown their run in water: treat the shoreline as a wall.
    if (isWaterAt(S, nx, ny)) {
      if (Math.abs(veh.speed) > 150) {
        veh.health -= 6;
        if (S.hooks.onVehicleCrash) S.hooks.onVehicleCrash(S, veh, null);
      }
      veh.speed *= -0.18;
      nx = veh.x;
      ny = veh.y;
    }
    const hit = collideWithBuildings(S, nx, ny, vehicleRadius(veh));
    if (hit.hit) {
      if (Math.abs(veh.speed) > 140) {
        veh.health -= (Math.abs(veh.speed) - 120) * 0.07;
        if (S.hooks.onVehicleCrash) S.hooks.onVehicleCrash(S, veh, null);
      }
      veh.speed = hit.hit && Math.abs(veh.speed) > 60 ? veh.speed * -0.22 : 0;
      nx = hit.x;
      ny = hit.y;
    }
    veh.x = clamp(nx, 30, CFG.WORLD_W - 30);
    veh.y = clamp(ny, 30, CFG.WORLD_H - 30);
  }
  veh.wheelSpin += veh.speed * dt * 0.09;
  if (veh.driver === 'player') S.stats.distanceDriven += Math.abs(veh.speed) * dt;
}

// --------------------------------------------------------------- drawing --

function localPoint(veh, lx, ly) {
  const c = Math.cos(veh.angle), s = Math.sin(veh.angle);
  return [veh.x + lx * c - ly * s, veh.y + lx * s + ly * c];
}

export function drawVehicle(S, dyn, dynT, veh) {
  const cls = VEHICLE_CLASSES[veh.cls];
  const wheelR = veh.kind === 'boat' ? 0 : 9;
  // Soft shadow blob first (transparent pass).
  dynT.plane(veh.x, veh.y, 1.2, cls.l * 1.04, cls.w * 1.5, veh.angle, [0, 0, 0, 0.3], 1);

  if (veh.kind === 'boat') {
    // Prism hull, a small cabin, an outboard block at the stern.
    dyn.prism(veh.x, veh.y, 7, cls.l, cls.w, 9, veh.angle, veh.color);
    if (cls.cabinH > 0) {
      dyn.box(veh.x, veh.y, 13, cls.l * 0.34, cls.w * 0.6, cls.cabinH, veh.angle, '#223240');
    }
    const [bx, by] = localPoint(veh, -cls.l / 2 - 4, 0);
    dyn.box(bx, by, 8, 8, 14, 12, veh.angle, '#2b2f36');
    return;
  }

  const bodyZ = wheelR + cls.bodyH / 2 - 2;
  // Wheels: cylinders whose axis runs across the car.
  const wheelOffs = [
    [cls.l * 0.32, cls.w / 2 - 3], [cls.l * 0.32, -cls.w / 2 + 3],
    [-cls.l * 0.32, cls.w / 2 - 3], [-cls.l * 0.32, -cls.w / 2 + 3],
  ];
  for (const [lx, ly] of wheelOffs) {
    const [wx, wy] = localPoint(veh, lx, ly);
    dyn.cyl(wx, wy, wheelR, wheelR, 7, veh.angle + Math.PI / 2, '#17191d', { axis: 'x', seg: 10 });
    dyn.disc(wx, wy, wheelR + 0.5, 4, '#8a929c', 8);
  }
  // Body + cabin.
  dyn.box(veh.x, veh.y, bodyZ, cls.l, cls.w, cls.bodyH, veh.angle, veh.color, {
    top: veh.cls === 'police' ? '#2b2f36' : veh.color,
  });
  const cabinL = cls.l * (veh.cls === 'van' ? 0.3 : 0.46);
  const cabinX = veh.cls === 'van' ? cls.l * 0.28 : -cls.l * 0.04;
  const [cbx, cby] = localPoint(veh, cabinX, 0);
  dyn.box(cbx, cby, bodyZ + cls.bodyH / 2 + cls.cabinH / 2, cabinL, cls.w * 0.84, cls.cabinH,
    veh.angle, '#223240', { top: veh.color });
  // Headlights and tail lights: small bright blocks at both ends.
  for (const s of [-1, 1]) {
    const [hx, hy] = localPoint(veh, cls.l / 2 + 1, s * cls.w * 0.3);
    dyn.box(hx, hy, bodyZ + 1, 3, 9, 5, veh.angle, '#fff0b3');
    const [tx, ty] = localPoint(veh, -cls.l / 2 - 1, s * cls.w * 0.3);
    dyn.box(tx, ty, bodyZ + 1, 3, 9, 5, veh.angle, '#c22e2e');
  }
  if (veh.cls === 'taxi') {
    dyn.box(veh.x, veh.y, bodyZ + cls.bodyH / 2 + cls.cabinH + 4, 16, 10, 6, veh.angle, '#ffd34d');
  }
  if (veh.cls === 'sports') {
    const [sx, sy] = localPoint(veh, -cls.l / 2 + 4, 0);
    dyn.box(sx, sy, bodyZ + cls.bodyH / 2 + 5, 6, cls.w * 0.9, 4, veh.angle, '#22262b');
  }
  if (veh.cls === 'pickup') {
    // Open bed: two low side walls behind the cabin.
    for (const s of [-1, 1]) {
      const [px, py] = localPoint(veh, -cls.l * 0.3, s * (cls.w / 2 - 3));
      dyn.box(px, py, bodyZ + cls.bodyH / 2, cls.l * 0.36, 5, 9, veh.angle, veh.color);
    }
  }
  if (veh.cls === 'police') {
    // The light bar: red and blue strobes alternate on a fast phase.
    const phase = Math.floor(S.t * 5 + veh.id) % 2 === 0;
    const barZ = bodyZ + cls.bodyH / 2 + cls.cabinH + 3;
    const [rx, ry] = localPoint(veh, cabinX, 8);
    const [bx2, by2] = localPoint(veh, cabinX, -8);
    dyn.box(rx, ry, barZ, 14, 13, 6, veh.angle, phase ? [1, 0.12, 0.12] : [0.45, 0.05, 0.05]);
    dyn.box(bx2, by2, barZ, 14, 13, 6, veh.angle, phase ? [0.1, 0.2, 0.6] : [0.25, 0.45, 1]);
    dyn.box(veh.x, veh.y, barZ, 15, 30, 3, veh.angle, '#22262b');
  }
  // A wreck smokes: a dark, pulsing block over the hood.
  if (veh.health < 35) {
    const puff = 8 + Math.sin(S.t * 6 + veh.id) * 2.5;
    const [ex, ey] = localPoint(veh, cls.l * 0.3, 0);
    dynT.box(ex, ey, bodyZ + cls.bodyH + 8, puff, puff, puff, veh.angle, [0.12, 0.12, 0.12, 0.4]);
  }
}
