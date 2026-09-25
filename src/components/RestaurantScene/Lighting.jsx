import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, LAYOUT } from '../../three/worldState';
import { lerp } from '../../three/anim';

/**
 * Light follows the story: a cool, flat work light while the place is being
 * built → warm lamps and a glowing oven once the lights come on.
 */
export function Lighting() {
  const hemi = useRef(null);
  const key = useRef(null);
  const counterLamp = useRef(null);
  const tableLamp = useRef(null);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const cold = useMemo(() => new THREE.Color('#b8c3d1'), []);
  const warm = useMemo(() => new THREE.Color('#ffe6c8'), []);
  const T = LAYOUT.tables.find((t) => t.first);
  const [px, , pz] = LAYOUT.prep;

  useFrame(() => {
    const L = world.lights;
    hemi.current.intensity = lerp(0.55, 0.42, L);
    key.current.intensity = lerp(1.25, 1.05, L);
    key.current.color.copy(cold).lerp(warm, L);
    counterLamp.current.intensity = L * 3.2;
    tableLamp.current.intensity = L * 3.6;
    scene.environmentIntensity = lerp(0.35, 0.75, L);
    // neutral tone mapping keeps colours true but does not squash highlights,
    // so the exposure sits lower than a filmic curve would need
    gl.toneMappingExposure = lerp(0.74, 0.8, L);
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
    </>
  );
}
