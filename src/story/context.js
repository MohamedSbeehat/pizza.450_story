import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { useStory } from './store';

/** Registry that scenes use to hand their timeline builder to the provider. */
export const StoryContext = createContext({ register: () => () => {} });

/** Which scene a component belongs to (index in TIMELINE + id). */
export const SceneContext = createContext({ index: 0, id: 'hero' });

/**
 * Register this scene's part of the film.
 *
 * `build(tl)` receives an empty GSAP timeline and adds the scene's tweens on a
 * NORMALISED clock: 0 = scene start, 1 = scene end. The provider stretches it
 * to the scene's `duration` from src/data/story.js and places it in the
 * master timeline that the scroll position drives.
 */
export function useSceneTimeline(build) {
  const { id } = useContext(SceneContext);
  const { register } = useContext(StoryContext);
  const ref = useRef(build);
  ref.current = build;
  useLayoutEffect(() => register(id, (tl) => ref.current(tl)), [id, register]);
}

/** True once this scene is close enough to the playhead to load its media. */
export function useSceneArmed() {
  const { index } = useContext(SceneContext);
  return useStory((s) => s.armedUpTo >= index);
}
