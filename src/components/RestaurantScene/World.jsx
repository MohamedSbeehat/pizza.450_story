import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { QUALITY } from '../../config/quality';
import { useStory } from '../../story/store';
import { SHOTS } from '../../three/worldState';
import { CameraRig } from './CameraRig';
import { Lighting } from './Lighting';
import { Restaurant } from './Restaurant';
import { Oven } from './Oven';
import { Pizza } from '../PizzaAnimation/Pizza';
import { Particles } from '../PizzaAnimation/Particles';
import { Effects } from './Effects';
import { Ingredients } from '../PizzaAnimation/Ingredients';
import { AnchorProjector } from './AnchorProjector';
import { SafeBoundary } from './SafeBoundary';

/**
 * Renders one frame as soon as the world is mounted — while it is still
 * hidden — so shaders compile and textures upload before the viewer
 * reaches Scene 4 (no hitch when the 3D appears).
 */
function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      gl.compile(scene, camera);
      advance(performance.now());
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera, advance]);
  return null;
}

/**
 * The 3D restaurant (Scenes 4–6). Everything in it is driven by the numbers
 * in three/worldState.js, which the scroll timeline tweens.
 * The canvas only renders while its scenes are on screen.
 */
export default function World() {
  const visible = useStory((s) => s.worldVisible);
  const [dpr, setDpr] = useState(QUALITY.dpr[1]);
  const start = SHOTS.buildStart;

  return (
    <Canvas
      frameloop={visible ? 'always' : 'never'}
      dpr={[QUALITY.dpr[0], dpr]}
      shadows={QUALITY.shadows ? 'percentage' : false}
      gl={{ antialias: QUALITY.antialias, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: start.fov, near: 0.03, far: 60, position: [start.x, start.y, start.z] }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        // colour-true tone mapping (the post-processing composer takes over on desktop)
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <color attach="background" args={['#0b0806']} />
      <fog attach="fog" args={['#0b0806', 13, 32]} />

      {/* lower the resolution on devices that can't hold the frame rate */}
      <PerformanceMonitor
        bounds={() => [45, 58]}
        onDecline={() => setDpr((d) => Math.max(QUALITY.dpr[0], d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(QUALITY.dpr[1], d + 0.25))}
      />

      {/* Reflections for the copper and brass, rendered once from soft light panels (no HDR download) */}
      <Environment resolution={QUALITY.tier === 'low' ? 64 : 128} frames={1}>
        <color attach="background" args={['#2b1b10']} />
        <Lightformer form="rect" intensity={0.9} color="#ffcf9a" position={[0, 2, -9]} scale={[18, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffd9b0" position={[9, 2, 0]} rotation-y={-Math.PI / 2} scale={[18, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#ffdcae" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ff9a4a" position={[3, 1.2, 5]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#fff1de" position={[-6, 2.5, 1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={1.8} color="#ffb870" position={[0, 2, 7]} scale={2.5} />
      </Environment>

      <Lighting />
      <Restaurant />
      <Oven />
      <Pizza />
      <Ingredients />
      <Particles />
      <CameraRig />
      <AnchorProjector />
      {/* if a device can't run the effects, the film keeps playing without them */}
      <SafeBoundary name="effects">
        <Effects />
      </SafeBoundary>
      <Warmup />
    </Canvas>
  );
}
