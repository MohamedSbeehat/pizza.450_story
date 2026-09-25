/**
 * Procedural rooftop silhouettes for the opening shot.
 * Deterministic (seeded) so the city is the same on every visit.
 * Details are typical of local rooftops: flat roofs, parapets, water tanks
 * on stands, solar water heaters, stair boxes and antennas.
 */

export const VIEW = { W: 1600, H: 500 };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rect = (x, y, w, h) => `M${x.toFixed(1)} ${(y + h).toFixed(1)}V${y.toFixed(1)}H${(x + w).toFixed(1)}V${(y + h).toFixed(1)}Z`;

function roofDetails(r, x, w, top, detail) {
  let d = '';
  // parapet lip
  d += rect(x - 1.5, top - 3, w + 3, 3);
  const items = Math.floor(r() * 3 * detail);
  for (let i = 0; i < items; i++) {
    const kind = r();
    const ix = x + 6 + r() * Math.max(4, w - 34);
    if (kind < 0.42) {
      // water tank on legs
      const tw = 12 + r() * 9;
      const th = 10 + r() * 7;
      const leg = 5 + r() * 4;
      d += rect(ix, top - leg - th, tw, th);
      d += rect(ix + 1.5, top - leg, 2, leg) + rect(ix + tw - 3.5, top - leg, 2, leg);
    } else if (kind < 0.66) {
      // solar water heater: slanted collector, tank on top, back leg
      d += `M${ix} ${top}L${ix + 5} ${top}L${ix + 25} ${top - 13}L${ix + 20} ${top - 13}Z`;
      d += rect(ix + 15, top - 19.5, 19, 6.5);
      d += rect(ix + 29, top - 13, 2.2, 13);
    } else if (kind < 0.84) {
      // stair box
      d += rect(ix, top - 12 - r() * 8, 18 + r() * 12, 20);
    } else {
      // TV antenna: mast + horizontal boom with short elements (side view)
      const ah = 18 + r() * 26;
      const y = top - ah;
      d += rect(ix, y, 1.6, ah) + rect(ix - 12, y + 2, 26, 1.3);
      for (let k = 0; k < 4; k++) d += rect(ix - 11 + k * 7, y - 1 + (k % 2), 1.2, 5 - (k % 2) * 2);
    }
  }
  return d;
}

function windowsFor(r, x, w, top, H, density) {
  const out = [];
  const cols = Math.max(1, Math.floor((w - 12) / 18));
  const rows = Math.floor((H - top - 24) / 26);
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      if (r() > density) continue;
      out.push({ x: x + 8 + c * 18, y: top + 14 + row * 26, w: 8, h: 11 });
    }
  }
  return out;
}

/**
 * @returns {{ d: string, windows: Array, hero?: {x,y,w,h} }}
 */
export function skyline({ seed, min, max, detail = 1, lit = 0, hero = null }) {
  const { W, H } = VIEW;
  const r = rng(seed);
  let d = '';
  const windows = [];
  let heroWindow = null;

  const building = (x, w, h) => {
    const top = H - h;
    d += rect(x, top, w, h);
    d += roofDetails(r, x, w, top, detail);
    if (lit) windows.push(...windowsFor(r, x, w, top, H, lit));
  };

  const fill = (from, to) => {
    let x = from;
    while (x < to) {
      const w = Math.min(60 + r() * 120, to - x);
      if (w < 8) break;
      building(x, w, min + r() * (max - min));
      x += w + (r() < 0.12 ? 6 + r() * 20 : 0);
    }
  };

  if (hero) {
    const hx = hero.x - hero.w / 2;
    fill(-30, hx - 4);
    const top = H - hero.h;
    d += rect(hx, top, hero.w, hero.h);
    d += roofDetails(r, hx, hero.w, top, 1.2);
    // The window where the light of the idea appears.
    heroWindow = { x: hero.x - 17, y: top + hero.h * 0.36, w: 34, h: 44 };
    fill(hx + hero.w + 4, W + 30);
  } else {
    fill(-30, W + 30);
  }
  return { d, windows, hero: heroWindow };
}
