import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, LAYOUT } from '../../three/worldState';
import { lerp } from '../../three/anim';

/**
 * Light follows the story: a cool, flat work light while the place is being
 * built → warm lamps and a glowing oven once the lights come on.
 *
 * In the pizza chapter it is lit like a food commercial:
 *   mood      the kitchen sinks into darkness; a golden spot pools on the counter
 *   blackout  the room lights go out — only the oven fire and the golden light stay
 *   beams     golden light from above (and a rim from behind) on the serving board
 *   sweep     that light travels slowly across the finished pizza
 */
export function Lighting() {
  const hemi = useRef(null);
  const key = useRef(null);
  const counterLamp = useRef(null);
  const tableLamp = useRef(null);
  const stage = useRef(null);
  const hero = useRef(null);
  const rim = useRef(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const cold = useMemo(() => new THREE.Color('#b8c3d1'), []);
  const warm = useMemo(() => new THREE.Color('#ffe6c8'), []);
  const amber = useMemo(() => new THREE.Color('#ffb56a'), []);
  const T = LAYOUT.tables.find((t) => t.first);
  const [px, py, pz] = LAYOUT.prep;
  const [sx, sy, sz] = LAYOUT.serve;

  // spot targets must live in the scene graph
  const targets = useMemo(() => {
    const prep = new THREE.Object3D();
    prep.position.set(px, py, pz);
    const serve = new THREE.Object3D();
    serve.position.set(sx, sy, sz);
    return { prep, serve };
  }, [px, py, pz, sx, sy, sz]);

  useFrame(() => {
    const L = world.lights;
    const { mood, blackout, beams, sweep } = world;
    // the room: dimmed by the mood, then switched off
    const room = (1 - 0.72 * mood) * (1 - 0.96 * blackout);
    hemi.current.intensity = lerp(0.55, 0.42, L) * room;
    key.current.intensity = lerp(1.25, 1.05, L) * (1 - 0.8 * mood) * (1 - blackout);
    key.current.color.copy(cold).lerp(warm, L).lerp(amber, mood);
    counterLamp.current.intensity = L * 3.2 * (1 - blackout);
    tableLamp.current.intensity = L * 3.6 * (1 - blackout);
    scene.environmentIntensity = lerp(0.35, 0.75, L) * (1 - 0.78 * mood) * (1 - 0.9 * blackout);
    // neutral tone mapping keeps colours true but does not squash highlights,
    // so the exposure sits lower than a filmic curve would need
    gl.toneMappingExposure = lerp(0.74, 0.8, L) * lerp(1, 1.12, mood);

    // the golden pool on the counter while the pizza is made
    stage.current.intensity = mood * (1 - blackout) * 9;
    // the hero light: from above, drifting across the pizza
    hero.current.intensity = beams * 16;
    hero.current.position.set(sx + lerp(-0.55, 0.55, sweep), sy + 1.6, sz + lerp(0.25, -0.1, sweep));
    rim.current.intensity = beams * 7;
  });

  const s = QUALITY.shadows;
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffe8cc', '#1d130c', 0.5]} />
      <directionalLight
        ref={key}
        position={[5, 9, 6]}
        castShadow={s}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <pointLight ref={counterLamp} position={[px + 0.15, 2.05, pz - 0.05]} color="#ffb366" distance={7} decay={2} />
      <pointLight ref={tableLamp} position={[T.x, 2.0, T.z]} color="#ffb366" distance={7} decay={2} />

      <primitive object={targets.prep} />
      <primitive object={targets.serve} />
      <spotLight ref={stage} target={targets.prep} position={[px + 0.25, py + 1.5, pz + 0.3]} color="#ffc27a" angle={0.42} penumbra={0.85} distance={4} decay={2} intensity={0} />
      <spotLight ref={hero} target={targets.serve} position={[sx, sy + 1.6, sz]} color="#ffcf7d" angle={0.36} penumbra={0.9} distance={4} decay={2} intensity={0} />
      <spotLight ref={rim} target={targets.serve} position={[sx - 0.6, sy + 0.55, sz - 1.0]} color="#ff9c45" angle={0.5} penumbra={1} distance={3} decay={2} intensity={0} />
    </>
  );
}
