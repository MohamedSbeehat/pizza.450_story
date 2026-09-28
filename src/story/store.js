import { useSyncExternalStore } from 'react';

/**
 * Shared story state.
 *
 * - `state` holds values that change rarely (active scene, chapter…). React
 *   components subscribe to it with useStory(selector).
 * - Per-frame values (time, progress) are NOT reactive: they live directly on
 *   `story` and are pushed to `story.onFrame` callbacks, which write to the DOM
 *   without re-rendering React.
 */
const state = {
  sceneIndex: 0,
  sceneId: 'hero',
  chapter: -1, // index in CHAPTERS, -1 = before chapter 01
  armedUpTo: 1, // scenes with index <= armedUpTo may load their media
  worldArmed: false, // mount the 3D world (lazy chunk)
  worldVisible: false, // the 3D canvas is on screen → render it
  worldFailed: false, // the 3D could not run → scenes show photos instead
  worldCovered: false, // a full-screen film hides the 3D → pause its rendering
  started: false, // the viewer has started scrolling
  ready: false, // master timeline is built
};

const listeners = new Set();

export const story = {
  get: () => state,
  set(patch) {
    let changed = false;
    for (const k in patch) {
      if (state[k] !== patch[k]) {
        state[k] = patch[k];
        changed = true;
      }
    }
    if (changed) listeners.forEach((l) => l());
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Film clock (in screens) and 0–1 progress — updated every frame. */
  time: 0,
  progress: 0,
  /** Callbacks (time, progress) run on every timeline update. */
  onFrame: new Set(),

  /** Filled by StoryProvider: { master, marks, total, trigger } */
  film: null,
  lenis: null,

  /** Scroll position (px) that shows film time `t`. */
  scrollFor(t) {
    const f = this.film;
    if (!f) return 0;
    const p = Math.min(1, Math.max(0, t / f.total));
    return f.trigger.start + p * (f.trigger.end - f.trigger.start);
  },

  /** Smoothly scroll the film to a time (in screens). */
  seekTime(t, { instant = false } = {}) {
    const y = this.scrollFor(t);
    if (instant) {
      if (this.lenis) this.lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      return;
    }
    const distance = Math.abs(y - window.scrollY) / window.innerHeight;
    const duration = Math.min(4.5, 1.2 + distance * 0.18);
    if (this.lenis) this.lenis.scrollTo(y, { duration, easing: (x) => 1 - Math.pow(1 - x, 3) });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  },

  /** Jump to the moment a scene is fully on screen. */
  seekScene(id, opts) {
    const m = this.film?.marks[id];
    if (!m) return;
    this.seekTime(m.start + Math.min(0.45, (m.end - m.start) * 0.12), opts);
  },
};

export function useStory(selector) {
  return useSyncExternalStore(story.subscribe, () => selector(state));
}
