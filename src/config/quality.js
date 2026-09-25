/**
 * Device tier. Decides how much the experience asks of the GPU.
 * Force a tier for testing with ?quality=low|medium|high
 */
const mq = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function detect() {
  const params = new URLSearchParams(window.location.search);
  const small = mq('(max-width: 820px)');
  const touch = mq('(pointer: coarse)');
  const mobile = small || (touch && mq('(max-width: 1100px)'));
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const reducedMotion = mq('(prefers-reduced-motion: reduce)');

  let tier = params.get('quality');
  if (!['low', 'medium', 'high'].includes(tier)) {
    tier = mobile ? 'low' : cores >= 8 && memory >= 8 ? 'high' : 'medium';
  }

  return {
    tier,
    mobile,
    touch,
    reducedMotion,
    webgl: params.has('nowebgl') ? false : hasWebGL(),
    /** Canvas pixel ratio range */
    dpr: tier === 'high' ? [1, 2] : tier === 'medium' ? [1, 1.5] : [1, 1.35],
    antialias: tier !== 'low',
    shadows: tier === 'high',
    /** Multiplier for particle counts */
    particles: tier === 'high' ? 1 : tier === 'medium' ? 0.65 : 0.4,
    /** Size of procedural canvas textures */
    texture: tier === 'low' ? 512 : 1024,
    /** Blur in the text reveal (costly on phones) */
    textBlur: tier !== 'low' && !reducedMotion,
    /** Lenis smooth wheel scrolling (desktop only) */
    smoothScroll: !touch && !reducedMotion,
    /** Subtle camera sway that follows the mouse */
    pointerParallax: !touch && !reducedMotion,
    /** Scale of large camera moves (reduced-motion users get gentler moves) */
    motion: reducedMotion ? 0.35 : 1,
  };
}

export const QUALITY = typeof window !== 'undefined' ? detect() : {};
