// Puerto Brisa 3D — the police helicopter, KITE-1.
//
// At four stars and in the cover scene the LPD puts a helicopter up: it
// holds a station off the player's shoulder, banks toward its velocity,
// and throws a searchlight cone onto the street. It never lands and
// never shoots — its job is pressure and light — but the bust meter
// fills faster under its beam.

import { clamp } from './config.js';

export function createHelicopter(S, x, y) {
  const heli = {
    x, y, z: 250, angle: 0, rotor: 0,
    vx: 0, vy: 0, lightOn: true, lightX: x, lightY: y,
  };
  S.heli = heli;
  return heli;
}

export function removeHelicopter(S) {
  S.heli = null;
}

export function updateHelicopter(S, dt) {
  const heli = S.heli;
  if (!heli) return;
  const p = S.player;
  const px = p.inVehicle ? p.inVehicle.x : p.x;
  const py = p.inVehicle ? p.inVehicle.y : p.y;
  // Station: up-sun of the player, a little behind their heading.
  const tx = px - 190, ty = py - 240;
  const ax = clamp((tx - heli.x) * 1.6, -330, 330);
  const ay = clamp((ty - heli.y) * 1.6, -330, 330);
  heli.vx += (ax - heli.vx) * Math.min(1, dt * 1.7);
  heli.vy += (ay - heli.vy) * Math.min(1, dt * 1.7);
  heli.x += heli.vx * dt;
  heli.y += heli.vy * dt;
  heli.z = 248 + Math.sin(S.t * 0.9) * 9;
  if (Math.abs(heli.vx) + Math.abs(heli.vy) > 12) {
    heli.angle = Math.atan2(heli.vy, heli.vx);
  }
  heli.rotor += dt * 42;
  // The light hunts the player with a slight lag, then settles.
  heli.lightX += (px - heli.lightX) * Math.min(1, dt * 2.6);
  heli.lightY += (py - heli.lightY) * Math.min(1, dt * 2.6);
}

export function drawHelicopter(S, dyn, dynT) {
  const heli = S.heli;
  if (!heli) return;
  const { x, y, z, angle } = heli;
  // Ground shadow + the searchlight pool and cone (transparent pass).
  dynT.plane(x, y, 1.4, 120, 70, angle, [0, 0, 0, 0.16], 1);
  if (heli.lightOn) {
    dynT.disc(heli.lightX, heli.lightY, 3.5, 105, [1, 0.95, 0.72, 0.2], 18);
    dynT.cone(
      (x + heli.lightX) / 2, (y + heli.lightY) / 2, z / 2,
      105, z, 0, [1, 0.95, 0.72, 0.13], { seg: 14, flip: true },
    );
  }
  // Fuselage, tail boom, fin, skids.
  dyn.box(x, y, z, 52, 22, 24, angle, '#eef1f5', { top: '#2b2f36' });
  const tailX = x - Math.cos(angle) * 40, tailY = y - Math.sin(angle) * 40;
  dyn.box(tailX, tailY, z + 3, 34, 6, 8, angle, '#2b2f36');
  dyn.box(tailX - Math.cos(angle) * 16, tailY - Math.sin(angle) * 16, z + 9, 4, 16, 16, angle, '#c22e2e');
  for (const s of [-1, 1]) {
    const sx = x + -Math.sin(angle) * s * 12, sy = y + Math.cos(angle) * s * 12;
    dyn.box(sx, sy, z - 16, 36, 3.5, 3.5, angle, '#2b2f36');
  }
  // Cockpit glass at the nose.
  const noseX = x + Math.cos(angle) * 24, noseY = y + Math.sin(angle) * 24;
  dyn.box(noseX, noseY, z + 2, 10, 18, 13, angle, '#9fd4e8');
  // Rotor: a translucent blur disc plus two blade boxes mid-spin.
  dynT.disc(x, y, z + 15, 56, [0.9, 0.92, 0.95, 0.28], 18);
  dyn.box(x, y, z + 15, 108, 5, 1.6, heli.rotor, '#22262b');
  dyn.box(x, y, z + 15, 108, 5, 1.6, heli.rotor + Math.PI / 2, '#22262b');
}
