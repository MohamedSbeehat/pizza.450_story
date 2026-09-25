import * as THREE from 'three';
import { LAYOUT, PIZZA_SET } from './worldState';
import { seg, smooth, lerp, rng } from './anim';
import cheeseMap from '../data/pizza.cheese.json';

/*
 * The choreography of the pizza (Scene 5), shared by every 3D piece.
 * Everything is a pure function of the world state, so scrolling backwards
 * plays the film backwards exactly.
 *
 * Pizza units: the pizza group is scaled by SIZE, so 1 unit = the radius of
 * the finished pizza (≈ 16 cm). "local" = inside that scaled group.
 */

export const SIZE = 0.16;
export const BOARD_H = 0.025;
export const COUNTER_Y = LAYOUT.counter.height;
export const SURFACE = 0.058; // top of the stretched base, in pizza units

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const O = LAYOUT.oven;
const T = LAYOUT.tables.find((t) => t.first);

export const PREP = V(LAYOUT.prep[0], COUNTER_Y + 0.002, LAYOUT.prep[2]);
export const SERVE = V(LAYOUT.serve[0], COUNTER_Y + BOARD_H, LAYOUT.serve[2]);
const OVEN_FRONT = V(O.x, O.deckY + 0.07, O.z + O.radius + 0.62);
const OVEN_IN = V(O.x, O.deckY + 0.004, O.z + 0.12);
const TABLE = V(T.x, LAYOUT.tableTop + BOARD_H, T.z);

const PATH_IN = new THREE.CatmullRomCurve3([PREP, V(PREP.x + 0.15, 1.18, PREP.z + 0.45), V(0.35, 1.3, -1.25), OVEN_FRONT, OVEN_IN]);
const PATH_OUT = new THREE.CatmullRomCurve3([OVEN_IN, OVEN_FRONT, V(0.7, 1.25, -1.55), V(SERVE.x + 0.05, SERVE.y + 0.22, SERVE.z + 0.3), SERVE]);
const PATH_SERVE = new THREE.CatmullRomCurve3([SERVE, V(SERVE.x + 0.1, 1.35, SERVE.z + 0.6), V(0.5, 1.4, -0.2), V(TABLE.x, TABLE.y + 0.3, TABLE.z - 0.25), TABLE]);

/* ───────────────────────── Where is the pizza? ───────────────────────── */

/** Pizza pose: world position + yaw, and the peel offset (−1 = no peel). */
export function pizzaPose(w, time, out = { pos: new THREE.Vector3(), yaw: 0, peel: -1 }) {
  let peel = -1;
  if (w.serve > 0) out.pos.copy(PATH_SERVE.getPointAt(smooth(w.serve)));
  else if (w.out > 0) {
    out.pos.copy(PATH_OUT.getPointAt(smooth(seg(w.out, 0.15, 0.9))));
    if (w.out < 0.15) peel = (1 - seg(w.out, 0, 0.15)) * 1.3;
    else if (w.out < 0.9) peel = 0;
    else if (w.out < 1) peel = seg(w.out, 0.9, 1) * 1.2;
  } else if (w.peel > 0) {
    out.pos.copy(PATH_IN.getPointAt(smooth(seg(w.peel, 0.1, 0.85))));
    if (w.peel < 0.1) peel = (1 - seg(w.peel, 0, 0.1)) * 1.2;
    else if (w.peel < 0.85) peel = 0;
    else if (w.peel < 1) peel = seg(w.peel, 0.85, 1) * 1.3;
  } else out.pos.copy(PREP);
  out.yaw = w.peel * 0.5 + w.bake * 2.4 + w.out * 0.4 + w.serve * 0.8 + (w.steam > 0 && w.finish >= 1 ? time * 0.04 : 0);
  out.peel = peel;
  return out;
}

/** world → pizza-local (units) for a given pose. */
export function toLocal(world, pose, out = new THREE.Vector3()) {
  out.copy(world).sub(pose.pos).divideScalar(SIZE);
  return out.applyAxisAngle(UP, -pose.yaw);
}
/** pizza-local (units) → world for a given pose. */
export function toWorld(local, pose, out = new THREE.Vector3()) {
  out.copy(local).applyAxisAngle(UP, pose.yaw).multiplyScalar(SIZE);
  return out.add(pose.pos);
}
const UP = new THREE.Vector3(0, 1, 0);

/** The pose while the toppings are finished (steady on the serving board). */
const FINISH_POSE = pizzaPose({ peel: 1, bake: 1, out: 1, serve: 0, steam: 0, finish: 0 }, 0);

/* ───────────────────────────── Dough ───────────────────────────── */

/** Morph weights of the base: [pressed, stretched disc, puffed crust]. */
export function doughWeights(w, out = [0, 0, 0]) {
  const press = smooth(seg(w.dough, 0, 0.4));
  const stretch = smooth(seg(w.dough, 0.4, 1));
  const puff = smooth(seg(w.bake, 0.1, 0.6));
  out[0] = press * (1 - stretch);
  out[1] = stretch * (1 - puff);
  out[2] = stretch * puff;
  return out;
}
/** Finger dents while the dough is pressed (0–1). */
export const dimples = (w) => smooth(seg(w.dough, 0.05, 0.4)) * (1 - smooth(seg(w.dough, 0.55, 0.95)));
/** The dough turns as it is stretched — two full turns, so it ends aligned. */
export const doughSpin = (w) => smooth(seg(w.dough, 0.4, 1)) * Math.PI * 4;

/* ───────────────────────────── Sauce ───────────────────────────── */

/** Turns of the spreading spiral. Must match the sauce shader. */
export const SAUCE_TURNS = 3;
const SAUCE_RADIUS = 0.8; // units — the sauce disc
const BOWL = V(PIZZA_SET.bowl[0], COUNTER_Y, PIZZA_SET.bowl[1]);
export const BOWL_POS = BOWL;
const BOWL_SAUCE_Y = COUNTER_Y + 0.052;

/**
 * Sauce clock (w.sauce 0→1):
 *   0.00–0.14 scoop · 0.14–0.26 travel · 0.26–0.36 pour · 0.36–0.90 spread · 0.90–1 back
 * Returns the reveal parameter of the spiral (0 → ~1.18).
 */
export function sauceReveal(v) {
  if (v < 0.26) return 0;
  if (v < 0.36) return 0.14 * smooth(seg(v, 0.26, 0.36));
  return lerp(0.14, 1.18, seg(v, 0.36, 0.9));
}

/** Local position of the spreading ladle for a reveal value s. */
export function spiralPoint(s, out = new THREE.Vector3()) {
  const rho = Math.min(s, 1) * SAUCE_RADIUS;
  const theta = ((s * SAUCE_TURNS) % 1 - 0.5) * Math.PI * 2;
  return out.set(Math.cos(theta) * rho, SURFACE, -Math.sin(theta) * rho);
}

/**
 * Ladle pose in world space: pos = the lowest point of the ladle's bowl,
 * tilt = rotation about its own z axis (pouring), fill = sauce inside (0–1),
 * pour = strength of the sauce stream (0–1).
 */
const _l = new THREE.Vector3();
export function ladlePose(v, time, out = { pos: new THREE.Vector3(), tilt: 0, fill: 1, pour: 0 }) {
  const rest = _l.set(BOWL.x + 0.006, COUNTER_Y + 0.022, BOWL.z);
  const above = V(PREP.x, PREP.y + 0.13, PREP.z);
  out.pour = 0;
  out.fill = 1;
  if (v <= 0) {
    out.pos.copy(rest);
    out.tilt = -0.42;
  } else if (v < 0.14) {
    const dip = Math.sin(seg(v, 0, 0.05) * Math.PI) * 0.012;
    const lift = smooth(seg(v, 0.05, 0.14));
    out.pos.copy(rest);
    out.pos.y += -dip + lift * 0.12;
    out.tilt = lerp(-0.42, 0, smooth(seg(v, 0.03, 0.12)));
  } else if (v < 0.26) {
    const t = smooth(seg(v, 0.14, 0.26));
    out.pos.set(BOWL.x, rest.y + 0.12, BOWL.z).lerp(above, t);
    out.pos.y += Math.sin(t * Math.PI) * 0.05;
    out.tilt = 0;
  } else if (v < 0.36) {
    const t = seg(v, 0.26, 0.36);
    out.pos.copy(above);
    out.pos.y -= smooth(seg(t, 0, 0.5)) * 0.07;
    out.tilt = Math.sin(t * Math.PI) * 1.05;
    out.pour = Math.sin(seg(t, 0.15, 0.95) * Math.PI);
    out.fill = 1 - smooth(seg(t, 0.2, 0.95)) * 0.92;
  } else if (v < 0.9) {
    const s = sauceReveal(v);
    toWorld(spiralPoint(s, out.pos), PIZZA_AT_PREP, out.pos);
    out.pos.y += 0.0015 + Math.sin(time * 9) * 0.0006; // pressing lightly
    out.tilt = 0.08 * Math.sin(v * 60);
    out.fill = 0.08;
  } else {
    const t = smooth(seg(v, 0.9, 1));
    const from = toWorld(spiralPoint(1.18), PIZZA_AT_PREP);
    out.pos.copy(from).lerp(rest, t);
    out.pos.y += Math.sin(t * Math.PI) * 0.1;
    out.tilt = lerp(0, -0.42, t);
    out.fill = t > 0.9 ? 1 : 0.08;
  }
  return out;
}
const PIZZA_AT_PREP = { pos: PREP, yaw: 0 };

/** Drips falling from the ladle back into the bowl as it is lifted. */
export const DRIPS = [0.075, 0.095, 0.115, 0.14].map((at, i) => ({ at, dur: 0.035 + i * 0.004 }));
export function dripPos(drip, v, out) {
  const t = seg(v, drip.at, drip.at + drip.dur);
  if (t <= 0 || t >= 1) return null;
  const from = ladlePose(drip.at, 0).pos;
  out.copy(from);
  out.y = lerp(from.y - 0.004, BOWL_SAUCE_Y, t * t);
  return out;
}

/* ─────────────────────────── Mozzarella ─────────────────────────── */

const MOZZ = V(PIZZA_SET.mozzarella[0], COUNTER_Y, PIZZA_SET.mozzarella[1]);
export const MOZZ_BOARD = MOZZ;
export const MOZZ_BALL = { r: 0.034, center: V(MOZZ.x, COUNTER_Y + 0.012 + 0.034 * 0.9, MOZZ.z) };

/** Photographed basil (the 3D leaves land on them). x/z: pizza units. */
export const PHOTO_BASIL = [
  { x: -0.336, z: -0.414, rot: -0.1, s: 1.15 },
  { x: 0.064, z: -0.707, rot: -1.72, s: 0.85 },
  { x: 0.416, z: -0.488, rot: -0.67, s: 1.25 },
  { x: 0.416, z: 0.152, rot: -0.57, s: 1.95 },
  { x: -0.229, z: 0.299, rot: -2.79, s: 1.7 },
];

/** The grated-cheese pile of the photo, in pizza units. */
export const PILE = {
  x: (cheeseMap.pile.x - 0.5) * 2,
  z: (cheeseMap.pile.y - 0.5) * 2,
  r: cheeseMap.pile.r * 2,
};

/**
 * Torn mozzarella pieces. They land where the real pizza has melted cheese
 * (pizza.cheese.json, found by `npm run images`), plus where the basil and
 * the grated pile were removed from the photo, plus an even fill.
 */
export const CHEESE_PIECES = (() => {
  const r = rng(450);
  const spots = cheeseMap.blobs.map((b) => ({ x: b.x, z: b.z, meltR: Math.min(0.14, b.r * 1.1) }));
  PHOTO_BASIL.forEach((b) => spots.push({ x: b.x, z: b.z, meltR: 0.1 + 0.02 * b.s }));
  spots.push({ x: PILE.x, z: PILE.z, meltR: 0.15 }, { x: PILE.x + 0.12, z: PILE.z + 0.1, meltR: 0.11 });
  // even fill (Poisson-like) so no area of the pizza stays bare
  for (let tries = 0; tries < 900 && spots.length < 36; tries++) {
    const a = r() * Math.PI * 2;
    const rad = 0.7 * Math.sqrt(r());
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    if (spots.every((s) => Math.hypot(s.x - x, s.z - z) > s.meltR + 0.1)) spots.push({ x, z, meltR: 0.09 + r() * 0.03 });
  }
  // shuffle → pieces land all over the pizza, not in rows
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const n = spots.length;
  const toPizza = new THREE.Vector3(PREP.x - MOZZ.x, 0, PREP.z - MOZZ.z).normalize();
  return spots.map((s, i) => {
    // where on the ball it is torn from: the side facing the pizza, and the top
    const a = (i / n) * Math.PI * 2 * 3.1;
    const dir = new THREE.Vector3(Math.cos(a) * 0.7, 0.35 + r() * 0.6, Math.sin(a) * 0.7).addScaledVector(toPizza, 0.8).normalize();
    const from = MOZZ_BALL.center.clone().add(new THREE.Vector3(dir.x * MOZZ_BALL.r, dir.y * MOZZ_BALL.r * 0.9, dir.z * MOZZ_BALL.r));
    return {
      x: s.x,
      z: s.z,
      meltR: s.meltR,
      size: s.meltR * 0.62,
      ax: 0.78 + r() * 0.5,
      az: 0.78 + r() * 0.5,
      rot: r() * Math.PI * 2,
      tumble: [r() * 6 - 3, r() * 6 - 3, r() * 6 - 3],
      brown: r() < 0.3,
      launch: 0.04 + (i / Math.max(1, n - 1)) * 0.7,
      from: toLocal(from, PIZZA_AT_PREP), // pizza-local start
    };
  });
})();
export const CHEESE_FLIGHT = 0.24;
/** Fraction of the ball already torn away. */
export const tornFraction = (v) => CHEESE_PIECES.filter((p) => v >= p.launch).length / CHEESE_PIECES.length;

/** Melting in the oven. */
export function bakePhases(b) {
  return {
    melt: smooth(seg(b, 0.12, 0.6)), // pieces soften, spread, brown
    photo: smooth(seg(b, 0.3, 0.85)), // the real (clean) pizza appears
    sink: smooth(seg(b, 0.55, 0.95)), // the melted 3D cheese becomes the photo's cheese
  };
}

/* ─────────────────────────── Finishing ─────────────────────────── */

/**
 * Finish clock (w.finish 0→1):
 *   0.00–0.10 grater lifts off the counter · 0.10–0.56 grating over the pizza
 *   0.56–0.68 grater goes back · 0.48–0.84 basil leaves float down
 *   0.82–1.00 the finished pizza becomes the photograph
 */
export const finishReal = (v) => smooth(seg(v, 0.82, 1));

/** Basil leaves waiting on the counter (world) and their flight. */
export const BASIL_LEAVES = (() => {
  const r = rng(77);
  const [bx, bz] = PIZZA_SET.basil;
  const offs = [
    [0, 0],
    [0.045, 0.022],
    [-0.042, 0.03],
    [0.018, -0.038],
    [0.068, -0.016],
  ];
  return PHOTO_BASIL.map((target, i) => ({
    target,
    counter: V(bx + offs[i][0], COUNTER_Y + 0.004, bz + offs[i][1]),
    counterYaw: r() * Math.PI * 2,
    launch: 0.48 + i * 0.07,
    sway: 0.6 + r() * 0.8,
  }));
})();
export const BASIL_FLIGHT = 0.16;

/** Pile centre in world space (the pizza is on the serving board, steady). */
const PILE_WORLD = toWorld(V(PILE.x, SURFACE, PILE.z), FINISH_POSE);
const GRATER_REST = V(PIZZA_SET.grater[0], COUNTER_Y + 0.003, PIZZA_SET.grater[1]);
const GRATER_HOVER = V(PILE_WORLD.x, PILE_WORLD.y + 0.2, PILE_WORLD.z);

/**
 * Grater pose (world): plate centre, tilt (about z), yaw, and where the
 * cheese block is along the plate (−1…1).
 */
export function graterPose(v, out = { pos: new THREE.Vector3(), tilt: 0, yaw: 0, block: 0, wear: 0 }) {
  const up = smooth(seg(v, 0, 0.1));
  const back = smooth(seg(v, 0.56, 0.68));
  const t = up * (1 - back);
  out.pos.copy(GRATER_REST).lerp(GRATER_HOVER, t);
  out.pos.y += Math.sin(t * Math.PI) * 0.06 * (v < 0.3 ? 1 : 0.4);
  out.tilt = t * 0.34;
  out.yaw = lerp(0.2, -0.35, t);
  const grating = seg(v, 0.1, 0.56);
  out.block = grating > 0 && grating < 1 ? Math.sin(grating * Math.PI * 11) : 0;
  out.wear = grating;
  return out;
}

/** Grated strands: fall from the grater, pile up where the photo has its pile. */
export const STRANDS = (count) => {
  const r = rng(91);
  return Array.from({ length: count }, (_, i) => {
    const launch = 0.12 + (i / count) * 0.42 + r() * 0.02;
    const g = graterPose(launch);
    // released under the block, slightly scattered
    const along = g.block * 0.06 + (r() - 0.5) * 0.03;
    const start = V(g.pos.x + Math.cos(g.yaw) * along, g.pos.y - 0.008 - Math.sin(g.tilt) * along, g.pos.z - Math.sin(g.yaw) * along);
    const rad = PILE.r * Math.sqrt(r()) * 0.95;
    const a = r() * Math.PI * 2;
    const x = PILE.x + Math.cos(a) * rad;
    const z = PILE.z + Math.sin(a) * rad;
    const h = 0.16 * (1 - (rad / PILE.r) ** 2) * Math.sqrt(r());
    return {
      from: toLocal(start, FINISH_POSE),
      to: V(x, SURFACE + 0.01 + h, z),
      launch,
      dur: 0.06 + r() * 0.05,
      yaw: r() * Math.PI * 2,
      tilt: (r() - 0.5) * 1.1,
      roll: (r() - 0.5) * 1.4,
      spin: (r() - 0.5) * 14,
      len: 0.75 + r() * 0.6,
    };
  });
};

/* ─────────────────────────── Labels ─────────────────────────── */

/** World points the ingredient labels are pinned to. */
export function anchorPoint(id, w, out = new THREE.Vector3()) {
  switch (id) {
    case 'flour':
      return out.set(PIZZA_SET.flour[0], COUNTER_Y + 0.03, PIZZA_SET.flour[1]);
    case 'sauce':
      return out.set(BOWL.x, COUNTER_Y + 0.07, BOWL.z);
    case 'cheese':
      return out.copy(MOZZ_BALL.center).setY(MOZZ_BALL.center.y + MOZZ_BALL.r);
    case 'grated':
      return out.copy(graterPose(w.finish).pos).setY(out.y + 0.04);
    case 'basil':
      return out.set(PIZZA_SET.basil[0], COUNTER_Y + 0.01, PIZZA_SET.basil[1]);
    default:
      return null;
  }
}
