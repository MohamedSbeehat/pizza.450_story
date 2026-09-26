import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, LAYOUT } from '../../three/worldState';
import { seg } from '../../three/anim';

/**
 * «The lights go out… then golden beams slowly appear from above and from the
 * sides, and the pizza becomes the only thing lit.»
 *
 * Each beam is an open cone with an additive shader (brighter where it faces
 * the camera, fading at its edges and toward the table) — a painted light
 * shaft, not a volumetric simulation, so it costs almost nothing. Golden dust
 * drifts inside the main beam. Driven by `world.beams` (0→1, the beams come
 * in one after another).
 */
const [SX, SY, SZ] = LAYOUT.serve;
const TARGET = new THREE.Vector3(SX, SY + 0.02, SZ);
const BEAMS = [
  { from: [SX + 0.05, SY + 2.3, SZ + 0.05], radius: 0.4 }, // straight down
  { from: [SX - 1.7, SY + 1.9, SZ + 0.7], radius: 0.3 }, // from the left
  { from: [SX + 1.4, SY + 2.1, SZ - 0.9], radius: 0.28 }, // from the back right
];

const beamVertex = /* glsl */ `
  uniform float uLength;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vAlong = position.y / uLength + 0.5; // 0 at the table, 1 at the source
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const beamFragment = /* glsl */ `
  uniform float uAmount;
  uniform float uTime;
  uniform vec3 uColor;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float core = pow(facing, 2.4);
    float along = smoothstep(0.0, 0.22, vAlong) * mix(0.45, 1.0, vAlong);
    float shimmer = 0.88 + 0.12 * sin(vAlong * 34.0 - uTime * 0.9 + facing * 5.0);
    float a = uAmount * core * along * shimmer * 0.2;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uViewH;
  attribute vec3 seed;
  varying float vTwinkle;
  void main() {
    // slow upward drift inside the beam, looping; a gentle sideways sway
    float h = fract(seed.y + uTime * 0.018);
    float r = seed.x * mix(0.05, 0.38, 1.0 - h);
    float ang = seed.z * 6.2832 + uTime * 0.12;
    vec3 p = vec3(cos(ang) * r, mix(0.05, 2.0, h), sin(ang) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uViewH * 0.0022 / -mv.z;
    vTwinkle = 0.55 + 0.45 * sin(uTime * 1.7 + seed.z * 40.0);
  }
`;
const dustFragment = /* glsl */ `
  uniform float uAmount;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * uAmount * vTwinkle * 0.85;
    gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a, a);
  }
`;

export function Beams() {
  const group = useRef(null);
  const beams = useMemo(
    () =>
      BEAMS.map((b) => {
        const from = new THREE.Vector3(...b.from);
        const dir = TARGET.clone().sub(from);
        const length = dir.length();
        const geometry = new THREE.ConeGeometry(b.radius, length, 40, 1, true);
        const material = new THREE.ShaderMaterial({
          vertexShader: beamVertex,
          fragmentShader: beamFragment,
          uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uLength: { value: length }, uColor: { value: new THREE.Color('#ffc569') } },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        // a cone's apex is at +y: point its axis from the source to the pizza
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize().negate());
        const position = from.clone().addScaledVector(dir, 0.5);
        return { geometry, material, quaternion, position };
      }),
    [],
  );

  const dust = useMemo(() => {
    const n = Math.round(160 * QUALITY.particles);
    const seeds = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) seeds[i] = Math.random();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.5);
    const material = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uViewH: { value: 800 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geometry, material };
  }, []);

  useFrame((state) => {
    // not drawn at all outside their moment
    group.current.visible = world.beams > 0.001;
    if (!group.current.visible) return;
    const t = state.clock.elapsedTime;
    beams.forEach((b, i) => {
      b.material.uniforms.uAmount.value = seg(world.beams, i * 0.18, i * 0.18 + 0.64);
      b.material.uniforms.uTime.value = t;
    });
    dust.material.uniforms.uAmount.value = seg(world.beams, 0.2, 0.9);
    dust.material.uniforms.uTime.value = t;
    dust.material.uniforms.uViewH.value = state.size.height * state.viewport.dpr;
  });

  return (
    <group ref={group} visible={false}>
      {beams.map((b, i) => (
        <mesh key={i} geometry={b.geometry} material={b.material} position={b.position} quaternion={b.quaternion} renderOrder={5} frustumCulled={false} />
      ))}
      <points geometry={dust.geometry} material={dust.material} position={[SX, SY, SZ]} renderOrder={6} frustumCulled={false} />
    </group>
  );
}
