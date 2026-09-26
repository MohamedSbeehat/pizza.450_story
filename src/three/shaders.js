import * as THREE from 'three';
import { rng } from './anim';

/*
 * GPU particles and flames.
 * Scroll-driven particles (flour) are a pure function of a progress uniform,
 * so scrubbing backwards replays them exactly. Ambient ones (steam, embers,
 * dust) loop on time.
 */

/** N points, each with a random vec4 seed. Positions are computed in the shader. */
export function seedGeometry(count, seed) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) seeds[i] = i % 4 === 3 ? r() : r() * 2 - 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // never frustum-culled
  return g;
}

// world-size points: size (m) → pixels
const SIZE = /* glsl */ `
  uniform float uViewH;
  float pointSize(float worldSize, vec4 mv) {
    return worldSize * projectionMatrix[1][1] * uViewH * 0.5 / max(0.001, -mv.z);
  }
`;

const SOFT_FRAG = (color) => /* glsl */ `
  varying float vAlpha;
  ${color.includes('vColor') ? 'varying vec3 vColor;' : ''}
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(${color}, vAlpha * soft);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const common = (extra = {}) => ({
  transparent: true,
  depthWrite: false,
  ...extra,
});

/** Flour thrown on the counter: puff → arc → settles as a dusting (uP 0→1). */
export const flourMaterial = () =>
  new THREE.ShaderMaterial({
    ...common(),
    uniforms: { uP: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uViewH: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uP;
      uniform vec3 uOrigin;
      varying float vAlpha;
      ${SIZE}
      void main() {
        float delay = aSeed.w * 0.35;
        float t = clamp((uP - delay) / 0.6, 0.0, 1.0);
        float puff = step(0.82, aSeed.w);
        vec3 start = uOrigin + vec3(aSeed.x * 0.03, 0.34 + aSeed.y * 0.04, aSeed.z * 0.03);
        float r = 0.05 + abs(aSeed.x) * 0.26 * (1.0 + puff * 0.5);
        float ang = aSeed.y * 3.14159 + aSeed.z * 3.0;
        vec3 end = uOrigin + vec3(cos(ang) * r, 0.004 + puff * (0.04 + aSeed.w * 0.05), sin(ang) * r * 0.75);
        float e = 1.0 - pow(1.0 - t, 2.4);
        vec3 p = mix(start, end, e);
        p.y += sin(t * 3.14159) * (0.08 + aSeed.w * 0.08);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = pointSize(mix(0.0026, 0.028, puff), mv);
        float alive = step(0.001, t);
        vAlpha = alive * mix(mix(0.85, 0.55, smoothstep(0.8, 1.0, t)), 0.07 * (1.0 - smoothstep(0.55, 1.0, t)), puff);
      }
    `,
    fragmentShader: SOFT_FRAG('vec3(1.0, 0.88, 0.66)'), // flour in the golden light
  });

/** Steam rising from the hot pizza (loops on time). */
export const steamMaterial = () =>
  new THREE.ShaderMaterial({
    ...common(),
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uViewH: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uAmount;
      uniform vec3 uOrigin;
      varying float vAlpha;
      ${SIZE}
      void main() {
        float life = fract(uTime * (0.16 + aSeed.w * 0.12) + aSeed.x * 3.7 + aSeed.y);
        vec3 p = uOrigin + vec3(aSeed.y * 0.11, 0.02 + life * 0.4, aSeed.z * 0.11);
        p.x += sin(uTime * 1.2 + aSeed.x * 9.0) * 0.04 * life;
        p.z += cos(uTime * 0.9 + aSeed.z * 9.0) * 0.04 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = pointSize(0.04 + life * 0.1, mv);
        vAlpha = uAmount * sin(life * 3.14159) * 0.15;
      }
    `,
    fragmentShader: SOFT_FRAG('vec3(1.0, 0.9, 0.72)'), // steam lit in gold
  });

/** Embers flying out of the oven mouth (additive, loops on time). */
export const emberMaterial = () =>
  new THREE.ShaderMaterial({
    ...common({ blending: THREE.AdditiveBlending }),
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uViewH: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uAmount;
      uniform vec3 uOrigin;
      varying float vAlpha;
      varying vec3 vColor;
      ${SIZE}
      void main() {
        float life = fract(uTime * (0.3 + aSeed.w * 0.35) + aSeed.x * 5.3);
        vec3 p = uOrigin + vec3(aSeed.y * 0.22, life * (0.7 + aSeed.w * 0.7), life * (0.25 + (aSeed.z + 1.0) * 0.2));
        p.x += sin(uTime * 3.0 + aSeed.z * 20.0) * 0.06 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = pointSize(0.005 + aSeed.w * 0.006, mv);
        // fade out embers that fly right up to the lens
        vAlpha = uAmount * (1.0 - life) * step(0.35 - uAmount * 0.3, aSeed.w) * smoothstep(0.25, 0.7, -mv.z);
        vColor = mix(vec3(1.0, 0.78, 0.38), vec3(1.0, 0.32, 0.05), life) * 1.8;
      }
    `,
    fragmentShader: SOFT_FRAG('vColor'),
  });

/** Dust drifting in the warm light of the finished room. */
export const dustMaterial = () =>
  new THREE.ShaderMaterial({
    ...common({ blending: THREE.AdditiveBlending }),
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uViewH: { value: 800 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uAmount;
      varying float vAlpha;
      ${SIZE}
      void main() {
        vec3 p = vec3(aSeed.x * 6.0, 0.4 + (aSeed.y * 0.5 + 0.5) * 3.2, -0.6 + aSeed.z * 4.2);
        p.x += sin(uTime * 0.13 + aSeed.w * 30.0) * 0.4;
        p.y += sin(uTime * 0.09 + aSeed.x * 20.0) * 0.25;
        p.z += cos(uTime * 0.11 + aSeed.y * 25.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = pointSize(0.012, mv);
        vAlpha = uAmount * (0.25 + 0.35 * sin(uTime * 0.7 + aSeed.w * 40.0) * 0.5 + 0.2);
      }
    `,
    fragmentShader: SOFT_FRAG('vec3(1.0, 0.82, 0.55)'),
  });

/** A tongue of flame on a plane (additive). */
export const flameMaterial = (seed = 0) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uSeed: { value: seed } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uSeed;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 uv = vUv;
        float n = fbm(vec2(uv.x * 3.2 + uSeed * 7.0, uv.y * 2.2 - uTime * 1.8));
        float width = mix(0.44, 0.05, uv.y);
        float body = 1.0 - smoothstep(width * 0.35, width, abs(uv.x - 0.5 + (n - 0.5) * 0.3 * uv.y));
        float height = 1.0 - smoothstep(0.15, 0.95, uv.y + (n - 0.5) * 0.6);
        float f = body * height * uIntensity;
        vec3 col = mix(vec3(0.7, 0.1, 0.02), vec3(1.0, 0.48, 0.08), smoothstep(0.1, 0.5, f));
        col = mix(col, vec3(1.0, 0.88, 0.6), smoothstep(0.55, 1.0, f));
        gl_FragColor = vec4(col * 0.6, f * 0.55);
      }
    `,
  });
