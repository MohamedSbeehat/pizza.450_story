import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, N8AO, Bloom, DepthOfField, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { QUALITY } from '../../config/quality';
import { world } from '../../three/worldState';

/**
 * The "camera" look of the 3D scenes:
 *  - N8AO ambient occlusion: soft contact shadows where things meet
 *    (toppings on the pizza, chairs on the floor, the oven on the tiles)
 *  - Bloom: lamps, embers and the oven mouth glow like real light
 *  - Depth of field (desktop, high tier): auto-focus on what the camera
 *    looks at; close-ups get the shallow focus of food photography
 *  - Neutral tone mapping: keeps food colours true (tomato stays red)
 *
 * Phones (low tier) skip the composer entirely; the renderer applies the
 * same neutral tone mapping directly (see World.jsx).
 */
export function Effects() {
  const dof = useRef(null);
  const bloom = useRef(null);
  const tier = QUALITY.tier;

  useFrame(({ camera }) => {
    // in the dark, golden part of the pizza chapter the highlights glow more
    const b = bloom.current;
    if (b) {
      const gold = Math.max(world.mood * 0.6, world.beams);
      b.intensity = 0.55 + 0.4 * gold;
      b.luminanceMaterial.threshold = 0.92 - 0.2 * gold;
    }
    const effect = dof.current;
    if (!effect) return;
    const c = world.cam;
    effect.target.set(c.tx, c.ty, c.tz);
    const d = camera.position.distanceTo(effect.target);
    // close-ups: a few centimetres in focus; wide shots: everything
    effect.cocMaterial.focusRange = Math.max(0.1, d * 0.5);
  });

  if (tier === 'low') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes aoRadius={0.45} distanceFalloff={0.6} intensity={2.4} color="#1a0f08" quality={tier === 'high' ? 'medium' : 'performance'} />
      <Bloom ref={bloom} mipmapBlur intensity={0.55} luminanceThreshold={0.92} luminanceSmoothing={0.2} radius={0.7} />
      {tier === 'high' ? <DepthOfField ref={dof} target={[0, 0, 0]} focalLength={0.02} bokehScale={2.2} worldFocusRange={2} /> : null}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}
