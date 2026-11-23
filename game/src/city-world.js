// Puerto Brisa 3D — the city: districts, roads, buildings, dressing.
//
// The world is a flat 6800x4600 plane (x east, y south) lifted into 3D
// by the renderer. Eight districts sit on two land masses split by a
// channel with two bridges. Roads are bands inside each district plus a
// ring road and the east-west Avenida del Puerto. Buildings are placed
// in the block INTERIORS between road bands — never on a blind grid —
// so no building ever lands on a road, in the water or on the airstrip.

import { CFG } from './config.js';

export const DISTRICTS = [
  {
    name: 'El Mirador', rect: { x: 240, y: 240, w: 1420, h: 1060 },
    ground: '#cbb98a', road: '#5a5148',
    roofs: ['#b6543a', '#c96f43', '#a8482f', '#d08355', '#9c4a34'],
    walls: ['#e8d9b8', '#dfc9a0', '#e2b48f', '#d9c6a5'],
    accent: '#e8b34b', signs: ['Plaza del Faro', 'Calle Alba', 'Mirador Alto'],
    blurb: 'Old town on the hill: tiled roofs, plazas, arcades.',
  },
  {
    name: 'Avenida Coral', rect: { x: 1760, y: 240, w: 1560, h: 1060 },
    ground: '#c2b490', road: '#575046',
    roofs: ['#7fb0b8', '#e0e4e6', '#c96f43', '#88b8a2', '#d8cfc0'],
    walls: ['#eef0ea', '#dce8e4', '#e8ddc8', '#f0e6da'],
    accent: '#39c2d7', signs: ['Avenida Coral', 'Hotel Brisa', 'Café Litoral'],
    blurb: 'The grand boulevard: hotels, cafés, neon at dusk.',
  },
  {
    name: 'Puerto Brisa Marina', rect: { x: 240, y: 1420, w: 1760, h: 1180 },
    ground: '#bdb08e', road: '#544c40',
    roofs: ['#4a7d96', '#c96f43', '#7d94a6', '#b6543a', '#5d8a7a'],
    walls: ['#e6ddc4', '#d8e2e2', '#e0d2ae', '#cfdde0'],
    accent: '#ffd34d', signs: ['Muelle Uno', 'Capitanía', 'Mercado del Puerto'],
    blurb: 'Working harbour: docks, cranes, the vault convoy route.',
  },
  {
    name: 'Barrio Iris', rect: { x: 2100, y: 1420, w: 1420, h: 1180 },
    ground: '#c9ae8d', road: '#5c5044',
    roofs: ['#a85f9e', '#c94f6d', '#e08a3c', '#7a4a9e', '#3f8f6e'],
    walls: ['#f0d7c8', '#e8c8d8', '#d8e0c0', '#f0e0b0'],
    accent: '#ff5da2', signs: ['Barrio Iris', 'Club Iris', 'La Esquina'],
    blurb: 'Painted blocks, the nightclub, murals on every wall.',
  },
  {
    name: 'Playa Brisa', rect: { x: 3620, y: 1420, w: 1420, h: 1180 },
    ground: '#d9c491', road: '#5a5148',
    roofs: ['#e8e4da', '#7fb0b8', '#e8b34b', '#c96f43', '#88b8a2'],
    walls: ['#f4efe2', '#e8f0ee', '#f0e6cc', '#e2ece6'],
    accent: '#39c2d7', signs: ['Playa Brisa', 'Paseo del Mar', 'Chiringuito Sol'],
    blurb: 'Beachfront: white hotels, the promenade, gulls.',
  },
  {
    name: 'Las Lomas', rect: { x: 3620, y: 240, w: 1420, h: 1060 },
    ground: '#bfae87', road: '#575046',
    roofs: ['#8a6f4d', '#a8482f', '#6e7f4a', '#96755a', '#7d5a8a'],
    walls: ['#e0d2ae', '#d8c8a2', '#e6dcc2', '#cfc0a0'],
    accent: '#b08d57', signs: ['Las Lomas', 'Taller Hermanos', 'Alto del Faro'],
    blurb: 'Dry hills, workshops, the chop shop on the ridge.',
  },
  {
    name: 'Zona Libre', rect: { x: 5140, y: 240, w: 1520, h: 1420 },
    ground: '#c0b28c', road: '#544c40',
    roofs: ['#5d7a8a', '#96a0a6', '#c9a24b', '#7d94a6', '#a85f3f'],
    walls: ['#dde2da', '#d0d8d2', '#e6e0cc', '#ccd6da'],
    accent: '#ffd34d', signs: ['Zona Libre', 'Pista Brisa', 'Aduana'],
    blurb: 'Free-port warehouses and the island airstrip.',
  },
  {
    name: 'Isla Ancla', rect: { x: 5140, y: 1760, w: 1520, h: 1340 },
    ground: '#c4b28a', road: '#575046',
    roofs: ['#4a7d96', '#b6543a', '#5d8a7a', '#c96f43', '#7d5a8a'],
    walls: ['#e6ddc4', '#dce6da', '#e0d2ae', '#d8e2e2'],
    accent: '#14c8bc', signs: ['Isla Ancla', 'El Faro', 'Cala del Contrabando'],
    blurb: 'Smugglers’ island: the lighthouse, the cove, no questions.',
  },
];

// ------------------------------------------------------------- geometry --

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inflate(r, by) {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

// The free spans of [lo, hi] left between sorted bands [start, end].
function freeSpans(lo, hi, bands) {
  const spans = [];
  let cur = lo;
  for (const [s, e] of bands) {
    if (s > cur) spans.push([cur, Math.min(s, hi)]);
    cur = Math.max(cur, e);
  }
  if (cur < hi) spans.push([cur, hi]);
  return spans.filter(([s, e]) => e - s > 30);
}

// ---------------------------------------------------------------- build --

export function buildCity(S, rand) {
  const city = (S.city = {});
  city.districts = DISTRICTS;
  city.lands = [
    { x: 140, y: 140, w: 4900, h: 2960 }, // mainland
    { x: 5140, y: 140, w: 1520, h: 2960 }, // east shore
  ];
  city.waters = [
    { x: 0, y: 0, w: CFG.WORLD_W, h: 140 },
    { x: 0, y: 3100, w: CFG.WORLD_W, h: CFG.WORLD_H - 3100 },
    { x: 0, y: 0, w: 140, h: CFG.WORLD_H },
    { x: 6660, y: 0, w: 140, h: CFG.WORLD_H },
    { x: 5040, y: 0, w: 100, h: CFG.WORLD_H }, // the channel
    { x: 240, y: 2240, w: 1500, h: 420 }, // harbour basin
    { x: 5560, y: 2940, w: 940, h: 160 }, // smugglers' cove
  ];
  city.bridges = [
    { x: 4960, y: 940, w: 280, h: 92, name: 'Puente Norte' },
    { x: 4960, y: 2380, w: 280, h: 92, name: 'Puente Largo' },
  ];
  city.airstrip = {
    x: 5420, y: 420, w: 1020, h: 132,
    helipad: { x: 6180, y: 860, r: 64 },
  };
  city.seaplaneDock = { x: 5170, y: 1480 };
  city.lighthouse = { x: 6420, y: 2900 };
  city.docks = [
    { x: 420, y: 2230 }, { x: 760, y: 2230 }, { x: 1100, y: 2230 },
    { x: 1440, y: 2230 }, { x: 5180, y: 1520 }, { x: 5960, y: 2930 },
  ];
  city.plaza = { x: 560, y: 660, w: 560, h: 420 }; // El Mirador plaza
  buildRoadGrid(S);
  buildBlocks(S, rand);
  buildProps(S, rand);
  return city;
}

function buildRoadGrid(S) {
  const roads = [];
  const add = (x, y, w, h, dir, name) => roads.push({ x, y, w, h, dir, name: name || '' });
  for (const d of DISTRICTS) {
    const r = d.rect;
    for (let x = r.x + 190; x < r.x + r.w - 80; x += 340) add(x, r.y + 30, 92, r.h - 60, 'v');
    for (let y = r.y + 170; y < r.y + r.h - 60; y += 320) add(r.x + 30, y, r.w - 60, 92, 'h');
    add(r.x + 26, r.y + 26, r.w - 52, 84, 'h');
    add(r.x + 26, r.y + r.h - 110, r.w - 52, 84, 'h');
  }
  for (const b of S.city.bridges) add(b.x, b.y, b.w, b.h, 'h', b.name);
  add(140, 1330, 4900, 96, 'h', 'Avenida del Puerto');
  add(5140, 1330, 1520, 96, 'h', 'Avenida del Puerto');
  S.city.roads = roads;
}

// Clearings no building may touch: waters, the airstrip, the helipad,
// the plaza (the on-foot stage) and the marina spawn apron.
function buildingClearings(S) {
  const out = S.city.waters.map((w) => inflate(w, 6));
  out.push(inflate(S.city.airstrip, 30));
  out.push({ x: 6100, y: 780, w: 180, h: 180 });
  out.push(inflate(S.city.plaza, 12));
  out.push({ x: 500, y: 1940, w: 280, h: 280 });
  return out;
}

function buildBlocks(S, rand) {
  const buildings = [];
  const clearings = buildingClearings(S);
  const blocked = (rect) =>
    S.city.roads.some((rd) => rectsOverlap(rect, inflate(rd, 10))) ||
    clearings.some((c) => rectsOverlap(rect, c));
  for (const d of DISTRICTS) {
    const r = d.rect;
    // This district's own road bands, clipped to the rect and sorted.
    const vBands = [], hBands = [];
    for (const rd of S.city.roads) {
      if (rd.dir === 'v' && rd.x >= r.x - 4 && rd.x + rd.w <= r.x + r.w + 4) {
        vBands.push([rd.x, rd.x + rd.w]);
      }
      if (rd.dir === 'h' && rd.y >= r.y - 4 && rd.y + rd.h <= r.y + r.h + 4) {
        hBands.push([rd.y, rd.y + rd.h]);
      }
    }
    vBands.sort((a, b) => a[0] - b[0]);
    hBands.sort((a, b) => a[0] - b[0]);
    const xSpans = freeSpans(r.x + 8, r.x + r.w - 8, vBands);
    const ySpans = freeSpans(r.y + 8, r.y + r.h - 8, hBands);
    for (const [x0, x1] of xSpans) {
      for (const [y0, y1] of ySpans) {
        // One block interior: shrink, then split into 1-4 plots.
        const ix = x0 + 7, iy = y0 + 7, iw = x1 - x0 - 14, ih = y1 - y0 - 14;
        if (iw < 54 || ih < 50) continue;
        const cols = iw >= 430 ? 3 : iw >= 200 ? 2 : 1, rows = ih >= 400 ? 3 : ih >= 190 ? 2 : 1;
        const cw = iw / cols, ch = ih / rows;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            if (rand.chance(0.08)) continue; // an open plot now and then
            const w = Math.min(cw - 10, rand.range(56, 150));
            const dep = Math.min(ch - 10, rand.range(52, 132));
            const bx = ix + cx * cw + (cw - w) / 2 + rand.range(-6, 6);
            const by = iy + cy * ch + (ch - dep) / 2 + rand.range(-5, 5);
            const rect = { x: bx, y: by, w, h: dep };
            if (blocked(rect)) continue;
            const floors = rand.int(1, 6);
            buildings.push({
              x: bx, y: by, w, d: dep,
              floors, height: floors * 22 + rand.range(8, 16),
              roof: rand.pick(d.roofs), wall: rand.pick(d.walls),
              district: d.name,
            });
          }
        }
      }
    }
  }
  S.city.buildings = buildings;
}

function buildProps(S, rand) {
  const props = [];
  const city = S.city;
  const nearWater = (x, y, pad) => city.waters.some((w) => pointInRect(x, y, inflate(w, pad)));
  const inBuilding = (x, y, pad) =>
    city.buildings.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.d + pad);
  // Palms lean over the pavements: sample along every road's edges.
  for (const rd of city.roads) {
    const len = rd.dir === 'v' ? rd.h : rd.w;
    for (let s = 60; s < len - 40; s += 250) {
      if (!rand.chance(0.55)) continue;
      const side = rand.sign();
      const off = (rd.dir === 'v' ? rd.w : rd.h) / 2 + 30;
      const x = rd.dir === 'v' ? rd.x + rd.w / 2 + side * off : rd.x + s;
      const y = rd.dir === 'v' ? rd.y + s : rd.y + rd.h / 2 + side * off;
      if (nearWater(x, y, -6) || inBuilding(x, y, 10)) continue;
      props.push({
        kind: 'palm', x, y,
        h: rand.range(48, 78), lean: rand.range(-7, 7),
        fronds: rand.int(5, 7), tone: rand.pick(['#2e7d4f', '#35955c', '#27784a', '#3fa065']),
      });
    }
  }
  // Lamps along the Avenida and the marina front.
  for (let x = 300; x < 4900; x += 430) props.push({ kind: 'lamp', x, y: 1312 });
  for (let x = 300; x < 1900; x += 320) props.push({ kind: 'lamp', x, y: 2206 });
  // Crates cluster at the docks.
  for (const d of city.docks) {
    const n = rand.int(2, 5);
    for (let i = 0; i < n; i++) {
      props.push({
        kind: 'crate',
        x: d.x + rand.range(-40, 130), y: d.y + rand.range(-34, 6),
        size: rand.range(20, 34), rot: rand.range(0, Math.PI),
        tone: rand.pick(['#a4763a', '#7d94a6', '#96755a', '#5d8a7a']),
      });
    }
  }
  // Market stalls ring the Mirador plaza fountain.
  const stallTones = ['#c94f6d', '#e8b34b', '#39c2d7', '#ff5da2', '#7fb069', '#e08a3c'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    props.push({
      kind: 'stall',
      x: 840 + Math.cos(a) * 215, y: 870 + Math.sin(a) * 165,
      rot: a + Math.PI / 2, tone: stallTones[i],
    });
  }
  city.props = props;
}

// --------------------------------------------------------------- queries --

export function isOnLand(S, x, y) {
  if (S.city.bridges.some((b) => pointInRect(x, y, b))) return true;
  if (S.city.waters.some((w) => pointInRect(x, y, w))) return false;
  return S.city.lands.some((l) => pointInRect(x, y, l));
}

export function isWaterAt(S, x, y) {
  if (S.city.bridges.some((b) => pointInRect(x, y, b))) return false;
  if (S.city.waters.some((w) => pointInRect(x, y, w))) return true;
  return !S.city.lands.some((l) => pointInRect(x, y, l));
}

export function isOnRoad(S, x, y) {
  return S.city.roads.some((r) => pointInRect(x, y, r));
}

export function districtAt(S, x, y) {
  for (const d of DISTRICTS) if (pointInRect(x, y, d.rect)) return d;
  return null;
}

// Solid-building collision for a circle body; returns the pushed-out
// position and whether anything was hit.
export function collideWithBuildings(S, x, y, rad) {
  let out = { x, y, hit: false };
  for (const b of S.city.buildings) {
    if (x < b.x - rad || x > b.x + b.w + rad || y < b.y - rad || y > b.y + b.d + rad) continue;
    // Push out along the smallest penetration axis.
    const left = x - (b.x - rad), right = b.x + b.w + rad - x;
    const top = y - (b.y - rad), bottom = b.y + b.d + rad - y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) out.x = b.x - rad;
    else if (m === right) out.x = b.x + b.w + rad;
    else if (m === top) out.y = b.y - rad;
    else out.y = b.y + b.d + rad;
    out.hit = true;
    x = out.x;
    y = out.y;
  }
  return out;
}

// Nearest point on any road — traffic spawns, respawns and fares use it.
export function nearestRoadPoint(S, x, y) {
  let best = null, bestD = Infinity;
  for (const r of S.city.roads) {
    const nx = Math.max(r.x, Math.min(x, r.x + r.w));
    const ny = Math.max(r.y, Math.min(y, r.y + r.h));
    const d = (nx - x) * (nx - x) + (ny - y) * (ny - y);
    if (d < bestD) { bestD = d; best = { x: nx, y: ny, road: r }; }
  }
  return best;
}

// --------------------------------------------------------- static meshes --

// Fill four MeshBuilders from the city data: `ground` (one textured
// quad), `tex` (buildings, facade texture), `col` (palms, lamps, crates,
// stalls, bridges, the lighthouse), `water` (translucent surface) and
// `sign` (the harbour board, textured separately). Face shades match
// engine-3d's baked directions.
export function buildCityMeshes(S, b) {
  const city = S.city;
  // Ground quad. With the renderer's flip-Y textures, uv (0,1) is the
  // canvas's top-left = world north-west.
  {
    const B = b.ground;
    const a = B.vert(0, 0, 0, '#ffffff', 1, 0, 1);
    const c = B.vert(CFG.WORLD_W, 0, 0, '#ffffff', 1, 1, 1);
    const d = B.vert(CFG.WORLD_W, CFG.WORLD_H, 0, '#ffffff', 1, 1, 0);
    const e = B.vert(0, CFG.WORLD_H, 0, '#ffffff', 1, 0, 0);
    B.quad(a, c, d, e);
  }
  // Buildings into the textured builder.
  for (const bd of city.buildings) buildBuilding(b.tex, bd);
  // Bridges: pale decks with side rails, over the channel.
  for (const br of city.bridges) {
    b.col.box(br.x + br.w / 2, br.y + br.h / 2, 3, br.w, br.h, 6, 0, '#8d8574');
    b.col.box(br.x + br.w / 2, br.y + 4, 16, br.w, 6, 26, 0, '#6e685c');
    b.col.box(br.x + br.w / 2, br.y + br.h - 4, 16, br.w, 6, 26, 0, '#6e685c');
  }
  // The lighthouse: striped tower on Isla Ancla.
  {
    const { x, y } = city.lighthouse;
    b.col.cyl(x, y, 55, 20, 110, 0, '#e8e4da', { seg: 10 });
    b.col.cyl(x, y, 62, 21, 26, 0, '#c0392b', { seg: 10 });
    b.col.cyl(x, y, 116, 12, 12, 0, '#2c3e50', { seg: 8 });
    b.col.disc(x, y, 124, 10, '#ffd34d', 10);
  }
  // Props.
  for (const p of city.props) {
    if (p.kind === 'palm') buildPalm(b.col, p);
    else if (p.kind === 'lamp') {
      b.col.cyl(p.x, p.y, 30, 3, 60, 0, '#3a3f45', { seg: 6 });
      b.col.box(p.x, p.y, 63, 12, 12, 7, 0, '#ffe9a8');
    } else if (p.kind === 'crate') {
      b.col.box(p.x, p.y, p.size / 2, p.size, p.size, p.size, p.rot, p.tone);
    } else if (p.kind === 'stall') {
      b.col.box(p.x, p.y, 20, 64, 40, 40, p.rot, '#d8c8a2');
      b.col.prism(p.x, p.y, 40, 76, 52, 16, p.rot, p.tone);
    }
  }
  // Plaza fountain basin.
  b.col.cyl(840, 870, 7, 92, 14, 0, '#b08d57', { seg: 18, openEnded: true });
  // Water surfaces, slightly above the painted deep water.
  for (const w of city.waters) {
    b.water.plane(w.x + w.w / 2, w.y + w.h / 2, 2.5, w.w, w.h, 0, [0.16, 0.44, 0.62, 0.8], 1);
  }
  b.water.disc(840, 870, 9, 74, [0.35, 0.62, 0.75, 0.85], 18);
  // The harbour board: one textured wall over the marina entrance.
  b.sign.wall(420, 2196, 44, 460, 64, 0, '#ffffff', 1);
}

function buildBuilding(B, bd) {
  const x0 = bd.x, y0 = bd.y, x1 = bd.x + bd.w, y1 = bd.y + bd.d, h = bd.height;
  const uRep = Math.max(1, Math.round(bd.w / 120));
  const vRep = Math.max(1, bd.floors / 3);
  const wallQuad = (ax, ay, bx, by, shade) => {
    const a = B.vert(ax, ay, 0, bd.wall, shade, 0, 0);
    const bq = B.vert(bx, by, 0, bd.wall, shade, uRep, 0);
    const c = B.vert(bx, by, h, bd.wall, shade, uRep, vRep);
    const d = B.vert(ax, ay, h, bd.wall, shade, 0, vRep);
    B.quad(a, bq, c, d);
  };
  wallQuad(x0, y1, x1, y1, 0.92); // south face
  wallQuad(x1, y0, x0, y0, 0.76); // north face
  wallQuad(x1, y1, x1, y0, 0.66); // east face
  wallQuad(x0, y0, x0, y1, 0.84); // west face
  // Roof: all four corners sample the facade texture's plain patch.
  const r0 = B.vert(x0, y0, h, bd.roof, 1, 0.019, 0.019);
  const r1 = B.vert(x1, y0, h, bd.roof, 1, 0.019, 0.019);
  const r2 = B.vert(x1, y1, h, bd.roof, 1, 0.019, 0.019);
  const r3 = B.vert(x0, y1, h, bd.roof, 1, 0.019, 0.019);
  B.quad(r0, r1, r2, r3);
  // A parapet lip and a rooftop box (lift housing / tank) for silhouette.
  B.box(bd.x + bd.w / 2, bd.y + bd.d / 2, h + 3, bd.w + 6, bd.d + 6, 6, 0, bd.roof);
}

function buildPalm(B, p) {
  const topX = p.x + p.lean, topY = p.y + p.lean * 0.4;
  B.cyl(p.x, p.y, p.h / 2, 3.4, p.h, 0, '#8a6f4d', { seg: 6, leanX: p.lean, leanY: p.lean * 0.4 });
  for (let i = 0; i < p.fronds; i++) {
    const a = (i / p.fronds) * Math.PI * 2 + p.x * 0.01;
    B.box(
      topX + Math.cos(a) * 15, topY + Math.sin(a) * 15, p.h - 3,
      36, 6, 2, a, p.tone, { pitch: 0.5 },
    );
  }
  B.disc(topX, topY, p.h + 1, 5, '#6e5636', 6);
}
