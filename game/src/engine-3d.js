// Puerto Brisa 3D — a compact hand-written WebGL1 renderer.
//
// No engine, no library: one shader program draws everything as coloured,
// flat-shaded boxes / prisms / cylinders / cones baked into world space on
// the CPU. Per-face brightness is baked into the vertex colours (top faces
// brightest, east faces darkest), which is what sells the early-3D look;
// the depth buffer does the rest. A second tiny program paints the sky
// gradient and the sun. Static city geometry is merged into a couple of
// big meshes (one draw call each); moving actors are rebuilt into a
// dynamic batch every frame — a few tens of thousands of vertices, which
// WebGL1 eats without noticing.

// ---------------------------------------------------------------- math --

export function mat4Perspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function mat4LookAt(eye, target, up) {
  // z axis points from target back to the eye (camera convention).
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  // x axis = up x z, y axis = z x x.
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

// Project a world point through a VP matrix; returns [ndcX, ndcY, inFront].
export function projectPoint(vp, x, y, z) {
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (w <= 0.01) return [0, 0, false];
  return [
    (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w,
    (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w,
    true,
  ];
}

// -------------------------------------------------------------- colours --

// '#rrggbb' (or [r,g,b]) -> [r, g, b] floats in 0..1. Cached: the city
// build calls this thousands of times with the same palette strings.
const hexCache = new Map();
export function hexColor(hex) {
  if (Array.isArray(hex)) return hex;
  let c = hexCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    hexCache.set(hex, c);
  }
  return c;
}

export function shadeColor(color, f) {
  const c = hexColor(color);
  return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
}

export function mixColor(a, b, t) {
  const ca = hexColor(a), cb = hexColor(b);
  return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
}

// ------------------------------------------------------------ sky cycle --

// Keyframed day cycle: deep night, dawn, bright day, the long golden hour
// the game opens in, dusk, night again. `tint` multiplies all vertex
// colours (warm at golden hour, blue-grey at night); the storm mixes
// every colour toward grey and pulls the fog in.
const SKY_STOPS = [
  { h: 0.0, top: '#0a0f24', hor: '#1a2340', sun: '#9db4ff', fog: '#131a2e', tint: 0.5, elev: -32 },
  { h: 5.0, top: '#0e1430', hor: '#27335c', sun: '#aebfff', fog: '#1a2340', tint: 0.55, elev: -14 },
  { h: 7.0, top: '#3a5a9c', hor: '#e8a06a', sun: '#ffb877', fog: '#caa27e', tint: 0.85, elev: 6 },
  { h: 10.0, top: '#2f7fd0', hor: '#bfe0ea', sun: '#fff3c4', fog: '#c3dde6', tint: 1.0, elev: 38 },
  { h: 15.0, top: '#2f7fd0', hor: '#c4e2ea', sun: '#fff3c4', fog: '#c3dde6', tint: 1.0, elev: 52 },
  { h: 17.0, top: '#3a5aa8', hor: '#ffb763', sun: '#ffc46b', fog: '#dfa06a', tint: 1.02, elev: 24 },
  { h: 18.6, top: '#46408f', hor: '#ff8f3f', sun: '#ffab4a', fog: '#d98d5f', tint: 0.97, elev: 9 },
  { h: 19.8, top: '#2c2a63', hor: '#c65f7a', sun: '#ff8f6b', fog: '#8a5a70', tint: 0.8, elev: -2 },
  { h: 21.0, top: '#0d1230', hor: '#232c52', sun: '#9db4ff', fog: '#161d36', tint: 0.58, elev: -18 },
  { h: 24.0, top: '#0a0f24', hor: '#1a2340', sun: '#9db4ff', fog: '#131a2e', tint: 0.5, elev: -32 },
];

export function skyPalette(hour, storm = 0) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1].h <= h) i++;
  const a = SKY_STOPS[i], b = SKY_STOPS[i + 1];
  const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h || 1)));
  const grey = storm * 0.45;
  const mixG = (ca, cb) => {
    const m = mixColor(ca, cb, t);
    const g = (m[0] + m[1] + m[2]) / 3;
    return [m[0] + (g - m[0]) * grey, m[1] + (g - m[1]) * grey, m[2] + (g - m[2]) * grey];
  };
  // Sun azimuth sweeps east -> south -> west across the day.
  const azim = ((h - 6) / 12) * Math.PI; // 6h: east horizon, 18h: west
  const elev = (a.elev + (b.elev - a.elev) * t) * (Math.PI / 180);
  return {
    top: mixG(a.top, b.top),
    horizon: mixG(a.hor, b.hor),
    sun: mixG(a.sun, b.sun),
    fog: mixG(a.fog, b.fog),
    tint: (a.tint + (b.tint - a.tint) * t) * (1 - storm * 0.12),
    fogNear: 1300 - storm * 500,
    fogFar: 6200 - storm * 2200,
    sunDir: [Math.cos(azim) * Math.cos(elev), -Math.sin(azim) * Math.cos(elev), Math.sin(elev)],
    sunUp: Math.sin(elev) > -0.05,
  };
}

// --------------------------------------------------------- mesh builder --

// Accumulates coloured, optionally textured triangles in world space.
// Local frame for the shape helpers: +x is the object's forward (its yaw
// direction), +y its left, +z up. Face shading is baked per direction:
// top 1.0, south 0.92, west 0.84, north 0.76, east 0.66, bottom 0.45 —
// a fixed late-afternoon sun from the south-west.
const FACE_SHADE = { top: 1.0, south: 0.92, west: 0.84, north: 0.76, east: 0.66, bottom: 0.45 };

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.uv = [];
    this.idx = [];
    this.n = 0; // vertices so far
  }

  reset() {
    this.pos.length = 0;
    this.col.length = 0;
    this.uv.length = 0;
    this.idx.length = 0;
    this.n = 0;
  }

  // One vertex. color: [r,g,b] or [r,g,b,a] or '#rrggbb'.
  vert(x, y, z, color, shade = 1, u = 0, v = 0) {
    const c = hexColor(color);
    const a = Array.isArray(color) && color.length > 3 ? color[3] : 1;
    this.pos.push(x, y, z);
    this.col.push(
      Math.min(1, c[0] * shade), Math.min(1, c[1] * shade), Math.min(1, c[2] * shade), a,
    );
    this.uv.push(u, v);
    return this.n++;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  quad(a, b, c, d) {
    // a-b-c-d around the face.
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  // Rotate a local point by yaw then translate to (cx, cy, cz).
  place(cx, cy, cz, yaw, lx, ly, lz) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [cx + lx * c - ly * s, cy + lx * s + ly * c, cz + lz];
  }

  // Centre-based box. opts: {pitch, roll, top (colour), alpha, uvScale,
  // uvTop} — pitch tips the box forward/back around its side axis, roll
  // around its forward axis (limb swings, tracer beams use beam()).
  box(cx, cy, cz, w, d, h, yaw = 0, color = '#ffffff', opts = {}) {
    const pitch = opts.pitch || 0, roll = opts.roll || 0;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const hw = w / 2, hd = d / 2, hh = h / 2;
    // Local corner -> pitched/rolled -> yawed -> world.
    const P = (lx, ly, lz) => {
      // pitch around local y (side) axis: x/z rotate
      let x = lx * cp + lz * sp, z = -lx * sp + lz * cp, y = ly;
      // roll around local x (forward) axis: y/z rotate
      const y2 = y * cr - z * sr, z2 = y * sr + z * cr;
      return this.place(cx, cy, cz, yaw, x, y2, z2);
    };
    const us = opts.uvScale || 0;
    const uvFor = (lx, lz) => (us ? [0.5 + lx / us, 0.5 + lz / us] : [0, 0]);
    const C = {
      t: opts.top || color, b: color, n: color, s: color, e: color, w: color,
    };
    const v = {};
    // 8 corners: (x: -/+ forward, y: -/+ left, z: -/+ up)
    const corners = {
      '---': P(-hw, -hd, -hh), '--+': P(-hw, -hd, hh),
      '-+-': P(-hw, hd, -hh), '-++': P(-hw, hd, hh),
      '+--': P(hw, -hd, -hh), '+-+': P(hw, -hd, hh),
      '++-': P(hw, hd, -hh), '+++': P(hw, hd, hh),
    };
    const face = (name, keys, shadeF, uvMode) => {
      const ids = keys.map((k) => {
        const p = corners[k];
        let u = 0, vv = 0;
        if (uvMode === 'top') { const q = uvFor(p[0] - cx, p[2] - cz); u = q[0]; vv = q[1]; }
        return this.vert(p[0], p[1], p[2], name, shadeF, u, vv);
      });
      this.quad(ids[0], ids[1], ids[2], ids[3]);
    };
    face(C.t, ['-++', '+++', '+-+', '--+'], FACE_SHADE.top, 'top');
    face(C.b, ['---', '+--', '++-', '-+-'], FACE_SHADE.bottom, null);
    face(C.s, ['-+-', '++-', '+++', '-++'], FACE_SHADE.south, null); // +y side
    face(C.n, ['+--', '---', '--+', '+-+'], FACE_SHADE.north, null); // -y side
    face(C.e, ['++-', '+--', '+-+', '+++'], FACE_SHADE.east, null); // +x face
    face(C.w, ['---', '-+-', '-++', '--+'], FACE_SHADE.west, null); // -x face
    return v;
  }

  // Horizontal flat quad (ground details, shadow blobs, discs' base).
  plane(cx, cy, cz, w, d, yaw = 0, color = '#ffffff', shade = 1) {
    const hw = w / 2, hd = d / 2;
    const p = [
      this.place(cx, cy, cz, yaw, -hw, -hd, 0), this.place(cx, cy, cz, yaw, hw, -hd, 0),
      this.place(cx, cy, cz, yaw, hw, hd, 0), this.place(cx, cy, cz, yaw, -hw, hd, 0),
    ];
    const ids = p.map((q) => this.vert(q[0], q[1], q[2], color, shade));
    this.quad(ids[0], ids[1], ids[2], ids[3]);
  }

  // Vertical quad facing local +y (signs, billboards, banners).
  wall(cx, cy, cz, w, h, yaw = 0, color = '#ffffff', shade = 0.95) {
    const hw = w / 2, hh = h / 2;
    const p = [
      this.place(cx, cy, cz, yaw, -hw, 0, -hh), this.place(cx, cy, cz, yaw, hw, 0, -hh),
      this.place(cx, cy, cz, yaw, hw, 0, hh), this.place(cx, cy, cz, yaw, -hw, 0, hh),
    ];
    // u runs toward local -x on purpose: a viewer standing on the +y
    // side (the way the wall faces) has local -x on their right, so
    // painted text reads correctly, not mirrored.
    const ids = p.map((q, i) => this.vert(q[0], q[1], q[2], color, shade, i === 0 || i === 3 ? 1 : 0, i >= 2 ? 1 : 0));
    this.quad(ids[0], ids[1], ids[2], ids[3]);
  }

  // Cylinder. axis 'z' stands up (trunks, poles); 'x' rolls (wheels).
  // opts: {seg, leanX, leanY (top offset), openEnded}
  cyl(cx, cy, cz, r, h, yaw = 0, color = '#ffffff', opts = {}) {
    const seg = opts.seg || 8;
    const axis = opts.axis || 'z';
    const leanX = opts.leanX || 0, leanY = opts.leanY || 0;
    const ring = (t) => {
      const out = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
        let lx, ly, lz;
        if (axis === 'z') { lx = ca; ly = sa; lz = -h / 2 + t * h; }
        else { lx = -h / 2 + t * h; ly = ca; lz = sa; }
        if (t === 1 && axis === 'z') { lx += leanX; ly += leanY; }
        out.push(this.place(cx, cy, cz, yaw, lx, ly, lz));
      }
      return out;
    };
    const lo = ring(0), hi = ring(1);
    const shadeFor = (i) => 0.7 + 0.3 * Math.abs(Math.sin((i / seg) * Math.PI));
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a = this.vert(lo[i][0], lo[i][1], lo[i][2], color, shadeFor(i));
      const b = this.vert(lo[j][0], lo[j][1], lo[j][2], color, shadeFor(j));
      const c = this.vert(hi[j][0], hi[j][1], hi[j][2], color, shadeFor(j));
      const d = this.vert(hi[i][0], hi[i][1], hi[i][2], color, shadeFor(i));
      this.quad(a, b, c, d);
    }
    if (!opts.openEnded) {
      // Caps: fan around the centre points of each end ring.
      const loC = axis === 'z' ? [cx, cy, cz - h / 2] : [cx - h / 2, cy, cz];
      const hiC = axis === 'z' ? [cx + leanX, cy + leanY, cz + h / 2] : [cx + h / 2, cy, cz];
      const cLo = this.vert(loC[0], loC[1], loC[2], color, FACE_SHADE.bottom);
      const cHi = this.vert(hiC[0], hiC[1], hiC[2], color, FACE_SHADE.top);
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        const a = this.vert(lo[i][0], lo[i][1], lo[i][2], color, FACE_SHADE.bottom);
        const b = this.vert(lo[j][0], lo[j][1], lo[j][2], color, FACE_SHADE.bottom);
        this.tri(cLo, b, a);
        const a2 = this.vert(hi[i][0], hi[i][1], hi[i][2], color, FACE_SHADE.top);
        const b2 = this.vert(hi[j][0], hi[j][1], hi[j][2], color, FACE_SHADE.top);
        this.tri(cHi, a2, b2);
      }
    }
  }

  // Cone: apex up by default (frond cones, spotlights use flip for a
  // downward-widening light cone with the apex at the lamp).
  cone(cx, cy, cz, r, h, yaw = 0, color = '#ffffff', opts = {}) {
    const seg = opts.seg || 10;
    const flip = opts.flip || false;
    const apexZ = flip ? cz + h / 2 : cz + h / 2;
    const baseZ = cz - h / 2;
    const apex = this.vert(cx, cy, apexZ, color, 1);
    const ringPts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      ringPts.push(this.place(cx, cy, baseZ, yaw, Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a = this.vert(ringPts[i][0], ringPts[i][1], ringPts[i][2], color, 0.85);
      const b = this.vert(ringPts[j][0], ringPts[j][1], ringPts[j][2], color, 0.85);
      if (flip) this.tri(apex, a, b);
      else this.tri(apex, b, a);
    }
  }

  // Flat disc (rotor blur, heli pad markings).
  disc(cx, cy, cz, r, color, seg = 14) {
    const c = this.vert(cx, cy, cz, color, 1);
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(this.vert(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz, color, 1));
    }
    for (let i = 0; i < seg; i++) this.tri(c, pts[i], pts[(i + 1) % seg]);
  }

  // Flat ring on the ground (bounty rings, territory circles).
  ring(cx, cy, cz, rOuter, rInner, color, seg = 20) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const a = this.vert(cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner, cz, color, 1);
      const b = this.vert(cx + Math.cos(a0) * rOuter, cy + Math.sin(a0) * rOuter, cz, color, 1);
      const c = this.vert(cx + Math.cos(a1) * rOuter, cy + Math.sin(a1) * rOuter, cz, color, 1);
      const d = this.vert(cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner, cz, color, 1);
      this.quad(a, b, c, d);
    }
  }

  // A beam: a box stretched between two world points (tracers, ropes).
  beam(x1, y1, z1, x2, y2, z2, w, color) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 1;
    const fx = dx / len, fy = dy / len, fz = dz / len;
    // side = up x f (fallback when f is vertical), up2 = f x side.
    let sx = -fy, sy = fx, sz = 0;
    const sl = Math.hypot(sx, sy, sz);
    if (sl < 0.01) { sx = 1; sy = 0; sz = 0; } else { sx /= sl; sy /= sl; }
    const ux = fy * sz - fz * sy, uy = fz * sx - fx * sz, uz = fx * sy - fy * sx;
    const h = w / 2;
    const corner = (px, py, pz, so, uo) => [
      px + sx * so + ux * uo, py + sy * so + uy * uo, pz + sz * so + uz * uo,
    ];
    const c000 = corner(x1, y1, z1, -h, -h), c001 = corner(x1, y1, z1, -h, h);
    const c010 = corner(x1, y1, z1, h, -h), c011 = corner(x1, y1, z1, h, h);
    const c100 = corner(x2, y2, z2, -h, -h), c101 = corner(x2, y2, z2, -h, h);
    const c110 = corner(x2, y2, z2, h, -h), c111 = corner(x2, y2, z2, h, h);
    const V = (p) => this.vert(p[0], p[1], p[2], color, 1);
    const a = V(c000), b = V(c010), c = V(c110), d = V(c100);
    const e = V(c001), f = V(c011), g = V(c111), hh = V(c101);
    this.quad(a, b, c, d); this.quad(e, hh, g, f);
    this.quad(a, d, hh, e); this.quad(b, f, g, c);
  }

  // Triangular prism: ridge along local x (stall awnings, boat hulls,
  // roof caps). h is the ridge height above the base centre plane.
  prism(cx, cy, cz, w, d, h, yaw = 0, color = '#ffffff', opts = {}) {
    const hw = w / 2, hd = d / 2;
    const base = cz - (opts.baseDrop || 0);
    const L = (lx, ly, lz) => this.place(cx, cy, cz, yaw, lx, ly, lz);
    const pA = L(-hw, -hd, base - cz), pB = L(hw, -hd, base - cz);
    const pC = L(hw, hd, base - cz), pD = L(-hw, hd, base - cz);
    const r0 = L(-hw, 0, h), r1 = L(hw, 0, h);
    const V = (p, s) => this.vert(p[0], p[1], p[2], color, s);
    const va = V(pA, 0.7), vb = V(pB, 0.7), vc = V(pC, 0.7), vd = V(pD, 0.7);
    const vr0 = V(r0, 1), vr1 = V(r1, 1);
    this.quad(va, vb, vr1, vr0); // south slope
    const va2 = V(pA, 0.8), vb2 = V(pB, 0.8), vc2 = V(pC, 0.8), vd2 = V(pD, 0.8);
    const vr02 = V(r0, 1), vr12 = V(r1, 1);
    this.quad(vc2, vd2, vr02, vr12); // north slope
    this.tri(va2, vr02, vd2); // west gable
    this.tri(vb2, vc2, vr12); // east gable
    void vc; void va; void vb; void vd; void vr0; void vr1;
  }

  // Upload to a GL mesh. dynamic=true keeps the buffers hinted for
  // per-frame re-upload.
  build(gl, dynamic = false) {
    const mesh = {
      posBuf: gl.createBuffer(), colBuf: gl.createBuffer(),
      uvBuf: gl.createBuffer(), idxBuf: gl.createBuffer(), count: 0,
    };
    this.upload(gl, mesh, dynamic);
    return mesh;
  }

  upload(gl, mesh, dynamic = false) {
    const hint = dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.pos), hint);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.col), hint);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.uv), hint);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.idx), hint);
    mesh.count = this.idx.length;
  }
}

// -------------------------------------------------------------- renderer --

const VERT_SRC = `
attribute vec3 aPos;
attribute vec4 aCol;
attribute vec2 aUv;
uniform mat4 uVP;
uniform vec3 uTint;
varying vec4 vCol;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 wp = vec4(aPos, 1.0);
  vec4 vp = uVP * wp;
  vCol = vec4(aCol.rgb * uTint, aCol.a);
  vUv = aUv;
  vDepth = -vp.z;
  gl_Position = vp;
}`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
uniform float uUseTex;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec4 vCol;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 c = vCol;
  if (uUseTex > 0.5) c *= texture2D(uTex, vUv);
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  c.rgb = mix(c.rgb, uFogColor, f);
  gl_FragColor = c;
}`;

const SKY_VERT = `
attribute vec2 aNdc;
varying vec2 vNdc;
void main() {
  vNdc = aNdc;
  gl_Position = vec4(aNdc, 0.999, 1.0);
}`;

const SKY_FRAG = `
precision mediump float;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec2 uSunNdc;
uniform float uSunSize;
varying vec2 vNdc;
void main() {
  float t = smoothstep(-0.25, 0.75, vNdc.y);
  vec3 c = mix(uHorizon, uTop, t);
  float d = distance(vNdc * vec2(1.0, 1.6), uSunNdc * vec2(1.0, 1.6));
  c += uSunColor * 0.5 * pow(max(0.0, 1.0 - d), 5.0);
  c += uSunColor * smoothstep(uSunSize, uSunSize * 0.55, d) * 0.9;
  gl_FragColor = vec4(c, 1.0);
}`;

function compileProgram(gl, vsSrc, fsSrc) {
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL is not available');
  gl.getExtension('OES_element_index_uint');
  const prog = compileProgram(gl, VERT_SRC, FRAG_SRC);
  const skyProg = compileProgram(gl, SKY_VERT, SKY_FRAG);
  const loc = {
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aCol: gl.getAttribLocation(prog, 'aCol'),
    aUv: gl.getAttribLocation(prog, 'aUv'),
    uVP: gl.getUniformLocation(prog, 'uVP'),
    uTint: gl.getUniformLocation(prog, 'uTint'),
    uTex: gl.getUniformLocation(prog, 'uTex'),
    uUseTex: gl.getUniformLocation(prog, 'uUseTex'),
    uFogColor: gl.getUniformLocation(prog, 'uFogColor'),
    uFogNear: gl.getUniformLocation(prog, 'uFogNear'),
    uFogFar: gl.getUniformLocation(prog, 'uFogFar'),
  };
  const skyLoc = {
    aNdc: gl.getAttribLocation(skyProg, 'aNdc'),
    uTop: gl.getUniformLocation(skyProg, 'uTop'),
    uHorizon: gl.getUniformLocation(skyProg, 'uHorizon'),
    uSunColor: gl.getUniformLocation(skyProg, 'uSunColor'),
    uSunNdc: gl.getUniformLocation(skyProg, 'uSunNdc'),
    uSunSize: gl.getUniformLocation(skyProg, 'uSunSize'),
  };
  // One fullscreen triangle for the sky.
  const skyBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const R = {
    gl,
    canvas,
    vp: null,
    palette: null,

    textureFromCanvas(cnv) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Flip Y so uv (0,0) is the canvas's bottom-left: v then grows
      // upward on every painted texture, which keeps text and windows
      // upright with the UVs the mesh builders emit.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      return tex;
    },

    // Begin a frame: size the drawing buffer, compute VP from S.cam,
    // clear to the fog colour.
    frame(S, palette) {
      const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 800;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      this.palette = palette;
      const proj = mat4Perspective(S.cam.fov, canvas.width / canvas.height, 5, 12000);
      const view = mat4LookAt(
        [S.cam.x, S.cam.y, S.cam.z], [S.cam.lx, S.cam.ly, S.cam.lz], [0, 0, 1],
      );
      this.vp = mat4Multiply(proj, view);
      gl.clearColor(palette.fog[0], palette.fog[1], palette.fog[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
    },

    sky(S, palette) {
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(skyProg);
      const sunWorld = [
        S.cam.x + palette.sunDir[0] * 8000,
        S.cam.y + palette.sunDir[1] * 8000,
        S.cam.z + palette.sunDir[2] * 8000,
      ];
      const ndc = projectPoint(this.vp, sunWorld[0], sunWorld[1], sunWorld[2]);
      gl.uniform3fv(skyLoc.uTop, palette.top);
      gl.uniform3fv(skyLoc.uHorizon, palette.horizon);
      gl.uniform3fv(skyLoc.uSunColor, palette.sun);
      gl.uniform2f(skyLoc.uSunNdc, ndc[0], ndc[1]);
      gl.uniform1f(skyLoc.uSunSize, palette.sunUp ? 0.16 : 0.0);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
      gl.enableVertexAttribArray(skyLoc.aNdc);
      gl.vertexAttribPointer(skyLoc.aNdc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    },

    // Draw a built mesh. opts: {tex, transparent}.
    drawMesh(mesh, opts = {}) {
      if (!mesh || mesh.count === 0) return;
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.uVP, false, this.vp);
      const pal = this.palette;
      gl.uniform3f(loc.uTint, pal.tint, pal.tint, pal.tint);
      gl.uniform3fv(loc.uFogColor, pal.fog);
      gl.uniform1f(loc.uFogNear, pal.fogNear);
      gl.uniform1f(loc.uFogFar, pal.fogFar);
      if (opts.tex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, opts.tex);
        gl.uniform1i(loc.uTex, 0);
        gl.uniform1f(loc.uUseTex, 1);
      } else {
        gl.uniform1f(loc.uUseTex, 0);
      }
      if (opts.transparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
      } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
      const bind = (buf, attr, size) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(attr);
        gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 0, 0);
      };
      bind(mesh.posBuf, loc.aPos, 3);
      bind(mesh.colBuf, loc.aCol, 4);
      bind(mesh.uvBuf, loc.aUv, 2);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      if (opts.transparent) {
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
    },
  };
  return R;
}
