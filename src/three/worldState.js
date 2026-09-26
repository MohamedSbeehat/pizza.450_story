/**
 * The 3D world is driven by plain numbers.
 *
 * Scene timelines (DOM side) tween these values with GSAP; the 3D components
 * read them every frame in useFrame. Nothing here imports three.js, so the
 * scroll timeline can be built before the 3D chunk has even loaded.
 *
 * Units are metres. The camera looks roughly toward −z; the back wall is at
 * z = −4.2, the oven stands against it, the dining area is toward +z.
 */

export const LAYOUT = {
  room: { width: 14, depth: 11, backZ: -4.2, leftX: -7, height: 4.2 },
  oven: { x: 1.9, z: -2.75, radius: 1.05, deckY: 0.98 },
  counter: { x: -1.3, z: -3.15, width: 3, depth: 0.9, height: 0.94 },
  // Where the pizza is made (on the counter), served (next to the oven) and eaten.
  prep: [-1.05, 0.95, -3.0],
  serve: [-0.12, 0.95, -3.0],
  tables: [
    { x: -2.7, z: 1.2, chairs: 2, rot: 0.3 },
    { x: 0.9, z: 1.9, chairs: 2, rot: -0.2, first: true },
    { x: 4.0, z: 0.9, chairs: 2, rot: 0.9 },
    { x: -5.0, z: -0.9, chairs: 2, rot: 1.4 },
  ],
  tableTop: 0.76,
};

/**
 * The ingredients waiting on the counter (x, z on the counter top).
 * Each one is shown as itself before it goes onto the pizza.
 */
export const PIZZA_SET = {
  flour: [-1.34, -2.86], // a small mound of flour next to the dough
  bowl: [-1.62, -3.26], // tomato sauce, with the ladle resting in it
  tomatoes: [
    [-1.8, -3.07, 0.2], // x, z, turn
    [-1.73, -2.97, 2.1],
    [-1.46, -3.4, 0, 'half'], // a halved tomato, cut side up
  ],
  mozzarella: [-0.62, -3.3], // a whole ball on a small board
  grater: [-0.3, -3.47], // cheese block + grater (used after the oven)
  basil: [0.06, -3.43], // fresh leaves (used after the oven)
};

export const world = {
  /** Camera: position (x,y,z), target (tx,ty,tz), field of view. */
  cam: { x: 7, y: 8.5, z: 10.5, tx: 0, ty: 0, tz: -0.8, fov: 38 },

  /** 0→1: the restaurant assembles (floor → walls → oven → furniture → lamps). */
  build: 0,
  /** 0→1: golden floor-plan grid at the very start. */
  blueprint: 0,
  /** 0→1: from cold work light to warm, lived-in light. */
  lights: 0,

  /** The pizza, step by step (all 0→1). Sub-phases: three/pizzaPlan.js */
  flour: 0, // flour is thrown on the counter
  dough: 0, // ball → pressed with the fingers → stretched and turned
  sauce: 0, // ladle scoops → pours in the centre → spreads in a spiral
  cheese: 0, // pieces are torn from the mozzarella ball and land on the pizza
  peel: 0, // counter → into the oven
  fire: 0, // oven fire intensity
  bake: 0, // crust puffs, cheese melts, the real pizza appears
  out: 0, // oven → serving board
  finish: 0, // cheese is grated on top, fresh basil falls
  steam: 0,
  serve: 0, // serving board → first table

  /** The pizza chapter's light, like a food commercial (all 0→1). */
  mood: 0, // the kitchen sinks into a dark, warm atmosphere; a golden spot on the counter
  blackout: 0, // «the lights go out»: only the oven fire (and the golden light) remain
  beams: 0, // golden beams from above and the sides onto the serving board
  sweep: 0, // the hero spotlight travels slowly across the finished pizza
};

/** When each part of the restaurant is built, on the `world.build` 0→1 clock. */
export const BUILD_PHASES = {
  floor: [0.0, 0.2],
  walls: [0.14, 0.4],
  oven: [0.36, 0.64],
  furniture: [0.58, 0.84],
  lamps: [0.78, 1.0],
};

/** Initial values, used to reset after hot reload. */
export const WORLD_INITIAL = JSON.parse(JSON.stringify(world));

const [px, py, pz] = LAYOUT.prep;
const [sx, sy, sz] = LAYOUT.serve;
const T = LAYOUT.tables.find((t) => t.first);
const O = LAYOUT.oven;
const [bx, bz] = PIZZA_SET.bowl;
const [mx, mz] = PIZZA_SET.mozzarella;

/**
 * Named camera shots. Scenes move between them with shot(tl, name, at, dur).
 * On portrait screens the camera automatically steps back (CameraRig).
 * The pizza shots are framed like a food film: low macro angles, close-ups
 * on each ingredient, shallow focus (Effects.jsx focuses on the target).
 */
export const SHOTS = {
  // Scene 4 — building the place
  buildStart: { x: 5.5, y: 9.5, z: 9.0, tx: 0, ty: 0, tz: -0.8, fov: 38 },
  buildMid: { x: -6.2, y: 4.6, z: 7.6, tx: 0.4, ty: 0.9, tz: -1.4, fov: 38 },
  buildEnd: { x: 3.1, y: 2.5, z: 4.4, tx: 0.9, ty: 1.15, tz: -2.5, fov: 40 },

  // Scene 5 — the pizza
  doughLow: { x: px + 0.2, y: 1.03, z: pz + 0.34, tx: px - 0.03, ty: 0.975, tz: pz - 0.02, fov: 30 },
  doughTop: { x: px + 0.04, y: py + 0.44, z: pz + 0.34, tx: px, ty: py, tz: pz - 0.01, fov: 34 },
  sauceBowl: { x: bx + 0.3, y: 1.1, z: bz + 0.32, tx: bx - 0.02, ty: 0.99, tz: bz, fov: 30 },
  sauceSpread: { x: px + 0.1, y: py + 0.48, z: pz + 0.32, tx: px, ty: py, tz: pz, fov: 34 },
  mozzBall: { x: mx + 0.06, y: 1.04, z: mz + 0.23, tx: mx, ty: 0.98, tz: mz, fov: 28 },
  cheeseFlight: { x: -0.74, y: 1.28, z: -2.42, tx: -0.86, ty: 0.97, tz: -3.12, fov: 38 },
  cheeseTop: { x: px - 0.12, y: py + 0.42, z: pz + 0.34, tx: px, ty: py, tz: pz, fov: 34 },
  ovenFront: { x: O.x - 1.1, y: 1.55, z: O.z + 3.6, tx: O.x - 0.2, ty: 1.05, tz: O.z + 0.4, fov: 40 },
  ovenMouth: { x: O.x + 0.02, y: O.deckY + 0.16, z: O.z + 1.55, tx: O.x, ty: O.deckY + 0.03, tz: O.z + 0.1, fov: 38 },
  finishTop: { x: sx + 0.28, y: sy + 0.36, z: sz + 0.42, tx: sx, ty: sy + 0.07, tz: sz - 0.02, fov: 36 },
  pizzaHero: { x: sx + 0.12, y: sy + 0.6, z: sz + 0.6, tx: sx, ty: sy + 0.02, tz: sz, fov: 34 },
  // «the lights go out»: far enough back to see the dark kitchen around the oven fire
  ovenDark: { x: O.x - 1.9, y: 1.35, z: O.z + 3.2, tx: O.x - 0.9, ty: 1.0, tz: O.z + 0.1, fov: 42 },
  // the hero: a slow orbit around the finished pizza in the golden light, then a close-up
  heroOrbitA: { x: sx - 0.55, y: sy + 0.42, z: sz + 0.5, tx: sx, ty: sy + 0.03, tz: sz, fov: 34 },
  heroOrbitB: { x: sx + 0.62, y: sy + 0.36, z: sz + 0.38, tx: sx, ty: sy + 0.03, tz: sz, fov: 34 },
  heroClose: { x: sx + 0.2, y: sy + 0.2, z: sz + 0.26, tx: sx - 0.02, ty: sy + 0.03, tz: sz - 0.02, fov: 32 },

  // Scene 6 — the first table
  tableClose: { x: T.x + 1.0, y: 1.42, z: T.z + 1.25, tx: T.x, ty: LAYOUT.tableTop + 0.04, tz: T.z, fov: 36 },
  roomWide: { x: -4.6, y: 3.3, z: 8.4, tx: 0.6, ty: 1.2, tz: -1.2, fov: 40 },
};
