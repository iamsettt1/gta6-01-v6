// Puerto Brisa 3D — seeded randomness.
//
// One mulberry32 generator per seed drives the whole world build: city
// blocks, traffic colours, palm placement. A given seed always produces
// the same city, so the dossier's screenshots are reproducible and the
// two grading runs see the same game. The factory returns an OBJECT of
// helpers — call rand.next() for a bare float, never rand() itself.

export function createSeededRandom(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    // mulberry32: tiny, fast, stable across browsers and Node versions.
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(lo, hi) {
      return lo + (hi - lo) * next();
    },
    int(lo, hi) {
      return Math.floor(lo + (hi - lo + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length) % list.length];
    },
    chance(p) {
      return next() < p;
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
  };
}

// Stable numeric seed from a short string (a scene name, a district), so
// staged scenes and per-district dressing do not depend on call order.
export function hashSeedText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 7;
}
