/**
 * Optional 3D models (.glb / .gltf)
 * ─────────────────────────────────
 * The restaurant, the oven and the pizza are built in code (procedural 3D),
 * so the site needs no model files. To replace a procedural prop with a real
 * model:
 *
 *   1. Put the file in /public/models/   (e.g. /public/models/oven.glb)
 *      Keep it light: < 2 MB, low polygon count, Draco/Meshopt compression OK.
 *   2. Set its `url` below.
 *   3. Adjust `scale`, `position` (offset in metres) and `rotation` (radians)
 *      until it sits where the procedural one was.
 *
 * The build/scroll animations are applied to the wrapper, so they keep
 * working with the model. If the file fails to load, the procedural prop is
 * used instead.
 */
export const MODELS = {
  oven: { url: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
  table: { url: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
  chair: { url: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
  lamp: { url: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
  counter: { url: null, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] },
};
