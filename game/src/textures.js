// Puerto Brisa 3D — canvas-painted textures.
//
// The game ships no image files: every texture is painted on a 2D canvas
// at boot. The big one is the ground — a 2048x2048 top-down painting of
// the whole city (district ground tones, asphalt roads with lane dashes,
// pavements, beach, harbour concrete, the deep water under the animated
// surface plane). Buildings get a small shared facade texture whose
// window grid is tinted per building by the vertex colours. Signs are
// painted per text.

import { CFG } from './config.js';

// World -> ground-canvas transform (the canvas is square, the world is
// not, so x and y scale differently — the painter hides that here).
const GROUND_PX = 2048;
export function groundScale() {
  return { sx: GROUND_PX / CFG.WORLD_W, sy: GROUND_PX / CFG.WORLD_H };
}

export function paintGroundTexture(S) {
  const cnv = document.createElement('canvas');
  cnv.width = GROUND_PX;
  cnv.height = GROUND_PX;
  const g = cnv.getContext('2d');
  const { sx, sy } = groundScale();
  const X = (x) => x * sx, Y = (y) => y * sy, W = (w) => w * sx, H = (h) => h * sy;
  const city = S.city;

  // Base: open sea colour everywhere; land masses paint over it.
  g.fillStyle = '#14486b';
  g.fillRect(0, 0, GROUND_PX, GROUND_PX);
  // Sea shading: lighter shallows near the land edges.
  g.fillStyle = '#1a5a80';
  for (const l of city.lands) g.fillRect(X(l.x - 60), Y(l.y - 60), W(l.w + 120), H(l.h + 120));

  // Land base in sand, then each district's ground tone.
  for (const l of city.lands) {
    g.fillStyle = '#c9b183';
    g.fillRect(X(l.x), Y(l.y), W(l.w), H(l.h));
  }
  for (const d of city.districts) {
    g.fillStyle = d.ground;
    g.fillRect(X(d.rect.x), Y(d.rect.y), W(d.rect.w), H(d.rect.h));
  }

  // Beach: a pale rim along the south and west land edges.
  g.fillStyle = '#ecd9a8';
  for (const l of city.lands) {
    g.fillRect(X(l.x), Y(l.y + l.h - 90), W(l.w), H(90));
    g.fillRect(X(l.x), Y(l.y), W(70), H(l.h));
  }

  // Inland waters (harbour basin, smugglers' cove) over the land.
  g.fillStyle = '#175d84';
  for (const w of city.waters) {
    if (w.x > 100 && w.y > 100 && w.x + w.w < CFG.WORLD_W - 100) {
      g.fillRect(X(w.x), Y(w.y), W(w.w), H(w.h));
    }
  }

  // Pavements: a light apron under every road band.
  g.fillStyle = '#9a917e';
  for (const r of city.roads) g.fillRect(X(r.x - 16), Y(r.y - 16), W(r.w + 32), H(r.h + 32));
  // Asphalt.
  for (const r of city.roads) {
    g.fillStyle = r.name && r.name.includes('Avenida') ? '#4c463f' : '#554f45';
    g.fillRect(X(r.x), Y(r.y), W(r.w), H(r.h));
  }
  // Bridges read as pale causeways over the channel.
  g.fillStyle = '#8d8574';
  for (const b of city.bridges) g.fillRect(X(b.x), Y(b.y), W(b.w), H(b.h));
  // Lane dashes down the middle of every road.
  g.fillStyle = '#e8d9a0';
  for (const r of city.roads) {
    if (r.dir === 'v') {
      const cx = X(r.x + r.w / 2) - 2;
      for (let y = r.y + 26; y < r.y + r.h - 30; y += 74) g.fillRect(cx, Y(y), 4, H(38));
    } else {
      const cy = Y(r.y + r.h / 2) - 2;
      for (let x = r.x + 26; x < r.x + r.w - 30; x += 74) g.fillRect(X(x), cy, W(38), 4);
    }
  }

  // Harbour concrete + dock fingers.
  g.fillStyle = '#a49a83';
  g.fillRect(X(200), Y(2180), W(1700), H(90));
  g.fillStyle = '#8d8471';
  for (const d of city.docks) g.fillRect(X(d.x - 30), Y(d.y - 16), W(150), H(26));

  // The airstrip: a long pale runway with threshold marks.
  if (city.airstrip) {
    const a = city.airstrip;
    g.fillStyle = '#6e6a60';
    g.fillRect(X(a.x), Y(a.y), W(a.w), H(a.h));
    g.fillStyle = '#e8e4d8';
    for (let x = a.x + 60; x < a.x + a.w - 60; x += 130) g.fillRect(X(x), Y(a.y + a.h / 2) - 3, W(64), 6);
    // Helipad circle.
    const hp = a.helipad;
    g.beginPath();
    g.arc(X(hp.x), Y(hp.y), hp.r * sx, 0, Math.PI * 2);
    g.strokeStyle = '#ffd34d';
    g.lineWidth = 7;
    g.stroke();
  }

  // Plaza paving in El Mirador (the foot scene's stage): a warm stone
  // square with a fountain ring at its heart.
  g.fillStyle = '#d8bd8d';
  g.fillRect(X(560), Y(660), W(560), H(420));
  g.strokeStyle = '#b08d57';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(X(840), Y(870), 90 * sx, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#7fb6c9';
  g.beginPath();
  g.arc(X(840), Y(870), 74 * sx, 0, Math.PI * 2);
  g.fill();

  return cnv;
}

// The shared building facade: near-white plaster (the vertex colour
// tints it) with a grid of dark windows. The top-left corner texel block
// is left solid so roof faces can sample a plain patch.
export function paintFacadeTexture() {
  const cnv = document.createElement('canvas');
  cnv.width = 256;
  cnv.height = 256;
  const g = cnv.getContext('2d');
  g.fillStyle = '#f2ede2';
  g.fillRect(0, 0, 256, 256);
  // Subtle plaster noise bands.
  g.fillStyle = 'rgba(120, 100, 70, 0.08)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 3);
  // Windows: 6 columns x 4 rows per texture tile; the tile repeats per
  // floor band via the mesh UVs.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 14 + col * 40, y = 16 + row * 62;
      const lit = (row * 7 + col * 13) % 5 === 0;
      g.fillStyle = lit ? '#ffd98a' : '#2c3e50';
      g.fillRect(x, y, 24, 34);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 24, 8);
      g.fillStyle = '#d8d2c2';
      g.fillRect(x - 3, y + 34, 30, 5); // sill
    }
  }
  // The plain patch (roofs sample uv ~ (0.004, 0.004)): repaint the
  // corner solid after the windows so no window bleeds into it.
  g.fillStyle = '#f2ede2';
  g.fillRect(0, 0, 10, 10);
  return cnv;
}

// A painted sign: bold text on a board, used for the harbour board, shop
// fronts and the vault. Returns a canvas the caller turns into a texture.
export function paintSignTexture(text, opts = {}) {
  const cnv = document.createElement('canvas');
  cnv.width = 512;
  cnv.height = 128;
  const g = cnv.getContext('2d');
  g.fillStyle = opts.bg || '#12303f';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = opts.fg || '#ffd34d';
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 112);
  g.fillStyle = opts.fg || '#ffd34d';
  g.font = `bold ${opts.size || 56}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  return cnv;
}

// A soft round blob (radial gradient) used for searchlight pools and
// spray: drawn on transparent quads in the effects pass.
export function paintGlowTexture() {
  const cnv = document.createElement('canvas');
  cnv.width = 128;
  cnv.height = 128;
  const g = cnv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return cnv;
}
