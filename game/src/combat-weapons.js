// Puerto Brisa 3D — combat: weapons, hitscan fire, gunmen, damage.
//
// Four weapons (fists, pistol, SMG, rifle) with per-weapon ammunition.
// Fire is hitscan with a generous auto-aim cone: the nearest valid
// target inside the cone takes the round, a tracer and a muzzle flash
// go into the effects list for the renderer, and walkers nearby scatter.
// Herrera gunmen keep their distance band, shoot on a cooldown, and
// drop ammunition when they fall.

import { clamp } from './config.js';
import { collideWithBuildings, pointInRect } from './city-world.js';

export const WEAPONS = {
  fists: { name: 'FISTS', dmg: 0, range: 0, rate: 0.4, auto: false, spread: 0 },
  pistol: { name: 'PISTOL', dmg: 26, range: 540, rate: 0.3, auto: false, spread: 0.03, ammo: 48 },
  smg: { name: 'SMG', dmg: 15, range: 500, rate: 0.09, auto: true, spread: 0.08, ammo: 150 },
  rifle: { name: 'RIFLE', dmg: 42, range: 780, rate: 0.48, auto: false, spread: 0.012, ammo: 40 },
};
export const WEAPON_SLOTS = ['fists', 'pistol', 'smg', 'rifle'];

function ensureKit(p) {
  if (!p.ownedWeapons) {
    p.ownedWeapons = { fists: true };
    p.ammo = {};
    p.fireCd = 0;
  }
}

export function giveWeapon(S, w) {
  const p = S.player;
  ensureKit(p);
  if (!p.ownedWeapons[w]) {
    p.ownedWeapons[w] = true;
    p.ammo[w] = WEAPONS[w].ammo || 0;
  } else {
    p.ammo[w] = (p.ammo[w] || 0) + (WEAPONS[w].ammo || 0);
  }
  p.weapon = w;
}

export function selectWeapon(S, slot) {
  const p = S.player;
  ensureKit(p);
  const w = WEAPON_SLOTS[slot - 1];
  if (w && p.ownedWeapons[w]) p.weapon = w;
}

export function damagePlayer(S, dmg) {
  const p = S.player;
  if (p.dead) return;
  const absorbed = Math.min(p.armour, dmg * 0.6);
  p.armour -= absorbed;
  p.health -= dmg - absorbed;
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    if (S.hooks.onWasted) S.hooks.onWasted(S);
  }
}

export function damagePed(S, ped, dmg) {
  if (ped.dead) return;
  ped.health -= dmg;
  if (ped.health <= 0) {
    ped.dead = true;
    ped.health = 0;
    if (S.hooks.onPedDown) S.hooks.onPedDown(S, ped);
  }
}

function lineBlocked(S, x1, y1, x2, y2) {
  // Buildings block fire: sample the segment at three interior points.
  for (const t of [0.3, 0.55, 0.8]) {
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    for (const b of S.city.buildings) {
      if (pointInRect(x, y, b)) return true;
    }
  }
  return false;
}

function pushEffect(S, eff) {
  S.effects.push(eff);
  if (S.effects.length > 240) S.effects.splice(0, S.effects.length - 240);
}

// Fire one round for `shooter` ({x, y, angle, weapon}) — the player when
// isPlayer, else a gunman ped shooting at the player. Returns true if a
// round actually left the barrel.
export function fireWeapon(S, shooter, isPlayer) {
  const def = WEAPONS[shooter.weapon || 'pistol'];
  if (!def || def.range === 0) return false;
  const ox = shooter.x + Math.cos(shooter.angle) * 18;
  const oy = shooter.y + Math.sin(shooter.angle) * 18;
  let hitX = ox + Math.cos(shooter.angle) * def.range;
  let hitY = oy + Math.sin(shooter.angle) * def.range;
  let hitZ = 20;

  if (isPlayer) {
    // Nearest ped in the aim cone wins; vehicles are the fallback.
    let best = null, bestScore = Infinity;
    for (const ped of S.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - ox, ped.y - oy);
      if (d > def.range) continue;
      const diff = Math.abs(angleDiff(shooter.angle, Math.atan2(ped.y - oy, ped.x - ox)));
      if (diff > 0.42) continue;
      const score = diff * 900 + d * 0.25;
      if (score < bestScore && !lineBlocked(S, ox, oy, ped.x, ped.y)) { bestScore = score; best = ped; }
    }
    if (best) {
      hitX = best.x; hitY = best.y; hitZ = 18;
      damagePed(S, best, def.dmg);
    } else {
      for (const veh of S.vehicles) {
        if (veh.driver === 'player' || veh.health <= 0) continue;
        const d = Math.hypot(veh.x - ox, veh.y - oy);
        if (d > def.range) continue;
        const diff = Math.abs(angleDiff(shooter.angle, Math.atan2(veh.y - oy, veh.x - ox)));
        if (diff < 0.3 && !lineBlocked(S, ox, oy, veh.x, veh.y)) {
          hitX = veh.x; hitY = veh.y; hitZ = 14;
          veh.health -= def.dmg * 0.35;
          break;
        }
      }
    }
    if (S.hooks.onPlayerShot) S.hooks.onPlayerShot(S);
    S.stats.shotsFired++;
    // Bystanders scatter from the noise.
    for (const ped of S.peds) {
      if (!ped.dead && ped.kind === 'walker' && Math.hypot(ped.x - ox, ped.y - oy) < 260) {
        ped.fleeT = 3; ped.threatX = ox; ped.threatY = oy;
      }
    }
  } else {
    // A gunman shooting at Rosa: accuracy falls off with distance.
    const p = S.player;
    const tx = p.inVehicle ? p.inVehicle.x : p.x;
    const ty = p.inVehicle ? p.inVehicle.y : p.y;
    const d = Math.hypot(tx - ox, ty - oy);
    if (d <= def.range && !lineBlocked(S, ox, oy, tx, ty)) {
      hitX = tx; hitY = ty; hitZ = 18;
      const hitChance = clamp(0.62 - d / 1400, 0.12, 0.55);
      if (Math.random() < hitChance) {
        if (p.inVehicle) p.inVehicle.health -= def.dmg * 0.3;
        else damagePlayer(S, def.dmg * 0.55);
      }
    }
  }

  pushEffect(S, {
    kind: 'tracer', x1: ox, y1: oy, z1: 23, x2: hitX, y2: hitY, z2: hitZ,
    t: 0.07, life: 0.07, color: [1, 0.85, 0.4, 0.85],
  });
  pushEffect(S, {
    kind: 'flash', x: ox, y: oy, z: 23, t: 0.05, life: 0.05,
    color: [1, 0.8, 0.35, 0.9],
  });
  if (S.hooks.onShotSound) S.hooks.onShotSound(S, shooter.weapon);
  return true;
}

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Rosa's trigger: F fires (held for automatics, pressed for the rest).
export function playerFireControl(S, dt) {
  const p = S.player;
  ensureKit(p);
  p.fireCd = Math.max(0, (p.fireCd || 0) - dt);
  if (p.inVehicle || p.dead || p.weapon === 'fists') return;
  const def = WEAPONS[p.weapon];
  const want = def.auto ? S.input.keys.has('f') : S.input.pressed.has('f');
  if (!want || p.fireCd > 0) return;
  if ((p.ammo[p.weapon] || 0) <= 0) {
    p.weapon = 'fists';
    if (S.hooks.onMessage) S.hooks.onMessage(S, 'Out of ammo — fists it is.');
    return;
  }
  p.ammo[p.weapon]--;
  p.fireCd = def.rate;
  fireWeapon(S, { x: p.x, y: p.y, angle: p.angle, weapon: p.weapon }, true);
}

// Herrera gunmen: keep the 200–340 band, shoot on cooldown, never
// walk through walls. They are peds with kind 'gunman'.
export function updateGunmen(S, dt) {
  const p = S.player;
  const tx = p.inVehicle ? p.inVehicle.x : p.x;
  const ty = p.inVehicle ? p.inVehicle.y : p.y;
  for (const ped of S.peds) {
    if (ped.kind !== 'gunman' || ped.dead) continue;
    const d = Math.hypot(tx - ped.x, ty - ped.y);
    ped.angle = Math.atan2(ty - ped.y, tx - ped.x);
    let mx = 0, my = 0;
    if (d > 340) { mx = Math.cos(ped.angle); my = Math.sin(ped.angle); }
    else if (d < 190) { mx = -Math.cos(ped.angle); my = -Math.sin(ped.angle); }
    else {
      // Strafe slowly sideways to feel alive in the band.
      const s = Math.sin(S.t * 0.7 + ped.id) > 0 ? 1 : -1;
      mx = -Math.sin(ped.angle) * s * 0.5;
      my = Math.cos(ped.angle) * s * 0.5;
    }
    if (mx || my) {
      const nx = ped.x + mx * 62 * dt, ny = ped.y + my * 62 * dt;
      const hit = collideWithBuildings(S, nx, ny, 12);
      ped.x = hit.x; ped.y = hit.y;
      ped.walkPhase += dt * 7;
    }
    ped.fireT -= dt;
    const range = (WEAPONS[ped.weapon || 'rifle'] || WEAPONS.rifle).range;
    if (d < range && ped.fireT <= 0 && !p.dead) {
      ped.fireT = 0.55 + Math.random() * 0.5;
      fireWeapon(S, ped, false);
    }
  }
}
