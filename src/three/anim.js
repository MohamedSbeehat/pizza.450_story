/** Small animation helpers used by the 3D components (pure functions). */

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** 0→1 progress of `p` inside the window [a, b]. */
export const seg = (p, a, b) => clamp01((p - a) / (b - a));

/** Progress of item i (of n) when items start one after another inside a phase. */
export const stagger = (p, i, n, spread = 0.6) => {
  const start = n > 1 ? (i / (n - 1)) * spread : 0;
  return clamp01((p - start) / (1 - spread));
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.5) => (t <= 0 ? 0 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2));
export const smooth = (t) => t * t * (3 - 2 * t);

/** Organic flicker for fire and bulbs (time in seconds). */
export const flicker = (t, seed = 0) =>
  0.82 + 0.1 * Math.sin(t * 13.1 + seed) + 0.06 * Math.sin(t * 29.7 + seed * 2.3) + 0.04 * Math.sin(t * 5.3 + seed * 0.7);

/** Deterministic random generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
