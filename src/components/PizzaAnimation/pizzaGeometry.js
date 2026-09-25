import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../../three/anim';

/*
 * Geometry for the pizza, in "pizza units": radius 1 = the finished pizza.
 * The group is scaled to real size (≈ 32 cm) in Pizza.jsx.
 */

const N = 34; // points per profile — all profiles must match for the morph
const SEGMENTS = 96;

/** Resample a polyline to n points evenly spaced along its length. */
function resample(points, n) {
  const lens = [0];
  for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lens[lens.length - 1];
  const out = [];
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const t = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    out.push(points[i - 1].clone().lerp(points[i], t));
  }
  return out;
}
const profile = (pts) => resample(pts.map(([x, y]) => new THREE.Vector2(x, y)), N);

/** A ball of dough resting on the counter (slightly squashed). */
function ballProfile() {
  const R = 0.36;
  const out = [];
  for (let k = 0; k < N; k++) {
    const th = (k / (N - 1)) * Math.PI;
    const x = Math.max(0, Math.sin(th) * R * 1.06);
    const y = Math.max(0, R * 0.84 + Math.cos(th) * R * 0.84);
    out.push(new THREE.Vector2(k === 0 || k === N - 1 ? 0 : x, y));
  }
  return out;
}
/** Pressed flat by the fingers: a thick round cushion. */
const pressedProfile = () =>
  profile([
    [0, 0.17],
    [0.38, 0.168],
    [0.52, 0.155],
    [0.6, 0.12],
    [0.63, 0.07],
    [0.61, 0.02],
    [0.54, 0],
    [0, 0],
  ]);
/** Stretched base: thin centre, puffy hand-shaped rim (cornicione). */
const discProfile = () =>
  profile([
    [0, 0.05],
    [0.45, 0.05],
    [0.76, 0.054],
    [0.84, 0.075],
    [0.9, 0.125],
    [0.95, 0.158],
    [0.99, 0.13],
    [1.0, 0.085],
    [0.985, 0.03],
    [0.94, 0.004],
    [0.5, 0],
    [0, 0],
  ]);
/** In the oven the rim rises and swells (the air in the dough expands). */
const puffedProfile = () =>
  profile([
    [0, 0.052],
    [0.45, 0.052],
    [0.74, 0.058],
    [0.81, 0.09],
    [0.87, 0.165],
    [0.935, 0.215],
    [0.985, 0.19],
    [1.015, 0.12],
    [1.0, 0.04],
    [0.94, 0.004],
    [0.5, 0],
    [0, 0],
  ]);

/** Hand-made irregularity along the rim (same pattern for every shape). */
function roughen(geo, amount) {
  const r = rng(450);
  const ph = [r() * 6, r() * 6, r() * 6];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const rim = THREE.MathUtils.smoothstep(rad, 0.5, 0.96);
    const n = Math.sin(a * 3 + ph[0]) * 0.5 + Math.sin(a * 7 + ph[1]) * 0.3 + Math.sin(a * 13 + ph[2]) * 0.2;
    const k = 1 + n * 0.025 * rim * amount;
    pos.setXYZ(i, x * k * 1.015, y + n * 0.02 * rim * amount * (y > 0.02 ? 1 : 0), z * k);
  }
  geo.computeVertexNormals();
}

/**
 * The base: a dough-ball LatheGeometry with three morph targets:
 *   [0] pressed  [1] stretched disc  [2] puffed crust (baked)
 * UVs are planar (top view, from the stretched disc), so the dough and photo
 * textures map like a photo from above.
 * Profiles are written top → bottom; LatheGeometry wants bottom → top.
 */
export function baseGeometry() {
  const lathe = (p) => new THREE.LatheGeometry(p.reverse(), SEGMENTS);
  const ball = lathe(ballProfile());
  const pressed = lathe(pressedProfile());
  const disc = lathe(discProfile());
  const puffed = lathe(puffedProfile());
  roughen(pressed, 0.5);
  roughen(disc, 1);
  roughen(puffed, 1.2);
  ball.computeVertexNormals();

  const pos = disc.attributes.position;
  const uv = ball.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 0.5 + 0.5, 0.5 - pos.getZ(i) * 0.5);

  ball.morphAttributes.position = [pressed.attributes.position, disc.attributes.position, puffed.attributes.position];
  ball.morphAttributes.normal = [pressed.attributes.normal, disc.attributes.normal, puffed.attributes.normal];
  return ball;
}

/** A torn piece of fresh mozzarella: a soft, lumpy blob (smooth normals). */
export function cheeseGeometry() {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const d =
      1 +
      0.08 * Math.sin(2.1 * x + 1.3) * Math.sin(1.9 * y + 0.4) * Math.sin(2.3 * z + 2.1) +
      0.05 * Math.sin(3.3 * x + 1.6 * z + 0.7) +
      0.025 * Math.sin(5.1 * z - 2.3 * y);
    // flatter underside: it rests on the pizza
    p.setXYZ(i, x * d, y < 0 ? y * d * 0.55 : y * d, z * d);
  }
  g.computeVertexNormals();
  return g;
}

/** One strand of grated cheese: a thin, slightly curled ribbon. */
export function strandGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.09, 0, 0),
    new THREE.Vector3(-0.03, 0.02, 0.012),
    new THREE.Vector3(0.03, -0.01, -0.01),
    new THREE.Vector3(0.09, 0.012, 0.004),
  ]);
  const g = new THREE.TubeGeometry(curve, 8, 0.011, 4, false);
  g.scale(1, 0.7, 1); // flat-ish ribbon
  return g;
}

/** A basil leaf, cupped, with normalised UVs for its vein texture. */
export function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.11);
  s.bezierCurveTo(0.078, -0.07, 0.072, 0.06, 0, 0.125);
  s.bezierCurveTo(-0.072, 0.06, -0.078, -0.07, 0, -0.11);
  const g = new THREE.ShapeGeometry(s, 14);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    uv.setXY(i, (x + 0.08) / 0.16, (y + 0.115) / 0.245);
    // cupped along the midrib, tip curls down a little
    p.setZ(i, x * x * 3.4 - Math.max(0, y - 0.06) * 0.25 + y * y * 0.4);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Whole tomato: slightly lobed sphere. */
export function tomatoGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 28);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const lobe = 1 + 0.045 * Math.cos(a * 5) * (1 - Math.abs(y));
    const flat = y > 0 ? 0.86 : 0.92;
    p.setXYZ(i, x * lobe, y * flat - (y > 0.85 ? (y - 0.85) * 0.5 : 0), z * lobe);
  }
  g.computeVertexNormals();
  return g;
}
