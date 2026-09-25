import { QUALITY } from '../config/quality';
import { world, SHOTS } from '../three/worldState';

/*
 * Timeline helpers shared by all scenes.
 * All times are on the scene's normalised clock (0 → 1).
 */

const blurVars = (px) => (QUALITY.textBlur ? { filter: `blur(${px}px)` } : {});
const words = (el) => (el ? el.querySelectorAll('.w') : []);

/** Words rise out of a blur, one after another (the film's title reveal). */
export function textIn(tl, el, at, { dur = 0.1, stagger = 0.018, y = 28, blur = 14, ease = 'power2.out' } = {}) {
  const w = words(el);
  if (!w.length) return tl;
  return tl.fromTo(
    w,
    { autoAlpha: 0, y, ...blurVars(blur) },
    { autoAlpha: 1, y: 0, ...blurVars(0), duration: dur, stagger, ease },
    at,
  );
}

/** Words dissolve upward into a blur. */
export function textOut(tl, el, at, { dur = 0.07, stagger = 0.008, y = -22, blur = 12, ease = 'power1.in' } = {}) {
  const w = words(el);
  if (!w.length) return tl;
  return tl.to(w, { autoAlpha: 0, y, ...blurVars(blur), duration: dur, stagger, ease }, at);
}

/** Fade an element in (autoAlpha also toggles visibility, so hidden layers cost nothing). */
export function fadeIn(tl, el, at, dur = 0.08, from = {}, to = {}) {
  if (!el) return tl;
  return tl.fromTo(el, { autoAlpha: 0, ...from }, { autoAlpha: 1, duration: dur, ...to }, at);
}

export function fadeOut(tl, el, at, dur = 0.08, to = {}) {
  if (!el) return tl;
  return tl.to(el, { autoAlpha: 0, duration: dur, ...to }, at);
}

/** Move the 3D camera to a named shot (see SHOTS in three/worldState.js). */
export function shot(tl, name, at, dur, ease = 'power2.inOut') {
  return tl.to(world.cam, { ...SHOTS[name], duration: dur, ease }, at);
}

/** Tween values of the 3D world state (e.g. { sauce: 1 }). */
export function worldTo(tl, vars, at, dur, ease = 'power1.inOut') {
  return tl.to(world, { ...vars, duration: dur, ease }, at);
}

/** Scale camera moves down for viewers who prefer reduced motion. */
export const m = (v, base = 1) => base + (v - base) * QUALITY.motion;
