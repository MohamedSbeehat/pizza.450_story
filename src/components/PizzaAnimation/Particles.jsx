import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, LAYOUT } from '../../three/worldState';
import { seedGeometry, flourMaterial, steamMaterial, emberMaterial, dustMaterial } from '../../three/shaders';
import { pizzaPose } from '../../three/pizzaPlan';

/**
 * All particle systems of the world, each a single draw call:
 * flour on the counter, steam over the hot pizza, embers from the oven
 * mouth and dust floating in the warm light.
 */
export function Particles() {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const k = QUALITY.particles;
  const pose = useMemo(() => ({ pos: new THREE.Vector3(), yaw: 0, peel: -1 }), []);

  const systems = useMemo(() => {
    const O = LAYOUT.oven;
    const flour = { geo: seedGeometry(Math.round(420 * k), 3), mat: flourMaterial() };
    flour.mat.uniforms.uOrigin.value.set(LAYOUT.prep[0], LAYOUT.counter.height, LAYOUT.prep[2]);
    const steam = { geo: seedGeometry(Math.round(90 * k), 5), mat: steamMaterial() };
    const embers = { geo: seedGeometry(Math.round(110 * k), 7), mat: emberMaterial() };
    embers.mat.uniforms.uOrigin.value.set(O.x, O.deckY + 0.2, O.z + O.radius + 0.1);
    const dust = { geo: seedGeometry(Math.round(260 * k), 9), mat: dustMaterial() };
    return { flour, steam, embers, dust };
  }, [k]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const viewH = size.height * dpr;
    const { flour, steam, embers, dust } = systems;
    for (const s of [flour, steam, embers, dust]) s.mat.uniforms.uViewH.value = viewH;

    flour.mat.uniforms.uP.value = world.flour;

    steam.mat.uniforms.uTime.value = t;
    steam.mat.uniforms.uAmount.value = world.steam;
    steam.mat.uniforms.uOrigin.value.copy(pizzaPose(world, t, pose).pos);

    embers.mat.uniforms.uTime.value = t;
    embers.mat.uniforms.uAmount.value = Math.max(0, world.fire - 0.2) * 1.25;

    dust.mat.uniforms.uTime.value = t;
    dust.mat.uniforms.uAmount.value = world.lights;
  });

  return (
    <>
      <points geometry={systems.flour.geo} material={systems.flour.mat} renderOrder={3} />
      <points geometry={systems.steam.geo} material={systems.steam.mat} renderOrder={4} />
      <points geometry={systems.embers.geo} material={systems.embers.mat} renderOrder={4} />
      <points geometry={systems.dust.geo} material={systems.dust.mat} renderOrder={4} />
    </>
  );
}
