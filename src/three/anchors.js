/**
 * Labels pinned to 3D objects.
 *
 * DOM overlays register an element for an id (e.g. 'cheese'); the 3D world
 * (AnchorProjector in World.jsx) projects that object's position to the
 * screen every frame and moves the element there. No three.js here, so the
 * DOM side can import it without loading the 3D chunk.
 */
export const anchorEls = new Map();

export function registerAnchor(id, el) {
  if (el) anchorEls.set(id, el);
  else anchorEls.delete(id);
}
