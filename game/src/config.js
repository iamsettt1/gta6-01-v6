// Puerto Brisa 3D — configuration and the shared game state.
//
// Every module receives the state object S as its FIRST argument and reads
// or mutates it; nothing hides in module-level globals. CFG holds the
// tuning constants (world size, camera, HUD sizes), and
// createPuertoBrisaState builds a fresh S for one boot. The world logic
// runs on a flat 2D plane (x east, y south); the renderer lifts it into
// 3D, so gameplay code never touches a z coordinate except heights.

export const CFG = {
  WORLD_W: 6800,
  WORLD_H: 4600,
  VIEW_W: 1280,
  VIEW_H: 800,
  // Player / vehicle feel.
  WALK_SPEED: 150,
  RUN_SPEED: 250,
  PLAYER_RADIUS: 14,
  ENTER_RANGE: 95,
  TALK_RANGE: 110,
  // Camera.
  CHASE_DIST: 340,
  CHASE_HEIGHT: 150,
  FOOT_DIST: 190,
  FOOT_HEIGHT: 120,
  BASE_FOV: 62,
  // HUD minimums (the top entries are dense; so is this).
  HUD_TITLE: 40,
  HUD_BIG: 34,
  HUD_TEXT: 22,
  HUD_SMALL: 20,
  STAR_PX: 56,
  MINIMAP: 300,
  // Game clock: one real second is one game minute, so a full day takes
  // 24 minutes of play; business income ticks once per period below.
  MINUTES_PER_SECOND: 1,
  INCOME_PERIOD: 60, // real seconds per business payout tick
};

// A fresh state for one boot. `seed` comes from the URL (?seed=) and
// defaults to 7; screenshot scenes pass their own seeds via shots.json.
export function createPuertoBrisaState(seed) {
  return {
    seed: seed >>> 0 || 7,
    t: 0, // seconds since boot (drives animation phases)
    dayT: 17.35, // hour of day; the game opens at golden hour
    screen: 'title', // title | briefing | game | phone | map | heist
    shot: null, // screenshot scene name when booted with ?shot=
    frozen: false, // staged scenes freeze world physics, not animation
    input: { keys: new Set(), pressed: new Set() },
    cam: {
      mode: 'orbit', // orbit | chase | foot | fixed
      x: 900, y: 2600, z: 700, // eye position (z is up)
      lx: 900, ly: 2100, lz: 0, // look target
      fov: CFG.BASE_FOV,
      yaw: 0,
    },
    camOverride: null,
    city: null, // filled by buildCity: districts, roads, buildings, ...
    player: null, // filled by createPlayer
    vehicles: [],
    peds: [],
    heli: null,
    effects: [], // tracers, muzzle flashes, spray: short-lived draw data
    wanted: { stars: 0, heat: 0, bustT: 0, lastCrimeAt: -99 },
    mission: {
      active: false, id: 0, stage: 0, target: null, timer: 0,
      objectives: [], stageData: {},
    },
    briefing: null, // {title, giver, text, cash} while screen==='briefing'
    objectives: [], // HUD checklist override used by staged scenes
    progress: {
      cash: 2400, respect: 0, respectLevel: 1,
      missionsDone: [], racesWon: [], bountiesCaught: [],
      shellsFound: 0, territoryTaken: [],
    },
    businesses: [], // filled by createBusinesses
    safehouses: [], // filled by createSafehouses
    bounties: [], // filled by createBounties
    shells: [], // filled by createShells
    race: null, // active race state from races-league
    territory: null, // active territory defence
    taxi: null, // active taxi fare
    heistPlan: null, // filled by planVaultHeist
    phone: { idx: 0, cooldown: 0, bribeAt: -999 },
    weather: { storm: 0.3, rain: 0.0, flash: 0.2 },
    dialogue: null, // {name, text, color, t} bottom-centre box
    message: null, // {text, t} toast line
    banner: null, // {title, sub, t} big centre card
    incomeT: 0,
    audio: {}, // audio-synth keeps its nodes here, all optional
    hooks: {}, // cross-system callbacks, registered in main.js
    stats: { shotsFired: 0, distanceDriven: 0 },
    nextId: 1,
  };
}

// Small shared helpers that every system needs.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2d(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Shortest signed turn from angle a to angle b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Toast line, dialogue box and centre banner: one home for the three
// ways the game talks to the player outside the HUD's fixed zones.
export function showMessage(S, text, seconds = 4) {
  S.message = { text, t: seconds };
}

export function showDialogue(S, name, text, color = '#ffd34d', seconds = 6) {
  S.dialogue = { name, text, color, t: seconds };
}

export function showBanner(S, title, sub = '', seconds = 3.2) {
  S.banner = { title, sub, t: seconds };
}
