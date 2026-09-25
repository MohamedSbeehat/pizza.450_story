import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, LAYOUT, BUILD_PHASES } from '../../three/worldState';
import { seg, easeOutCubic, easeOutBack, flicker } from '../../three/anim';
import * as M from '../../three/materials';
import { glowTexture } from '../../three/textures';
import { flameMaterial } from '../../three/shaders';
import { BRAND } from '../../data/story';
import { Prop } from './Prop';

/*
 * The copper oven — modelled on the real one at Pizzeria 450:
 * a hammered copper drum, a seamed copper dome, a black mouth with a
 * landing, and a copper flue that climbs to the ceiling.
 * It assembles during Scene 4 (body rises, dome lands, flue grows) and its
 * fire is driven by `world.fire`.
 */

const O = LAYOUT.oven;
const R = O.radius;
const BODY_H = 1.3;
const MOUTH_Y = O.deckY + 0.15; // centre of the black mouth housing
const HIDDEN = 0.0001;
// world position of the glow sprite in front of the mouth
const GLOW_POS = new THREE.Vector3(O.x, MOUTH_Y - 0.02, O.z + R + 0.2);

function mouthGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.33);
  s.lineTo(0.5, -0.33);
  s.lineTo(0.5, 0.33);
  s.lineTo(-0.5, 0.33);
  s.lineTo(-0.5, -0.33);
  const hole = new THREE.Path();
  hole.moveTo(-0.29, -0.15);
  hole.lineTo(-0.29, 0);
  hole.absarc(0, 0, 0.29, Math.PI, 0, true);
  hole.lineTo(0.29, -0.15);
  hole.lineTo(-0.29, -0.15);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.46, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 32 });
}

function domeGeometry() {
  const pts = [
    [R + 0.1, 0],
    [R + 0.13, 0.04],
    [R + 0.08, 0.16],
    [R - 0.03, 0.36],
    [R - 0.2, 0.56],
    [R - 0.43, 0.74],
    [R - 0.67, 0.86],
    [0.22, 0.92],
    [0.15, 0.95],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 72);
}

function Plaque() {
  const map = useTexture(`${BRAND.logo.src}.webp`);
  map.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[0, 0.3, R + 0.02]} rotation-x={-0.42}>
      <circleGeometry args={[0.13, 40]} />
      <meshStandardMaterial map={map} transparent roughness={0.4} metalness={0.2} />
    </mesh>
  );
}

export function Oven() {
  const body = useRef(null);
  const dome = useRef(null);
  const flue = useRef(null);
  const light = useRef(null);
  const fireLight = useRef(null);
  const glow = useRef(null);
  const inner = useRef(null);
  const deck = useRef(null);
  const s = QUALITY.shadows;

  const gap = 2 * Math.asin(0.5 / R); // opening in the drum behind the mouth
  const geo = useMemo(() => {
    const flueCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, BODY_H + 0.9, 0),
      new THREE.Vector3(0, 3.1, 0),
      new THREE.Vector3(0, 3.45, -0.22),
      new THREE.Vector3(0, 3.6, -0.7),
      new THREE.Vector3(0, 3.62, LAYOUT.room.backZ - O.z + 0.05),
    ]);
    return {
      body: new THREE.CylinderGeometry(R, R * 1.02, BODY_H, 72, 1, true, gap / 2, Math.PI * 2 - gap).translate(0, BODY_H / 2, 0),
      plinth: new THREE.CylinderGeometry(R + 0.025, R + 0.035, 0.09, 72, 1, true, gap / 2, Math.PI * 2 - gap).translate(0, 0.045, 0),
      dome: domeGeometry(),
      mouth: mouthGeometry(),
      flue: new THREE.TubeGeometry(flueCurve, 80, 0.12, 18, false),
    };
  }, [gap]);

  const flames = useMemo(() => [0, 1, 2].map((i) => flameMaterial(i * 1.7)), []);
  const glowMap = glowTexture();

  useFrame((state) => {
    const { camera } = state;
    const p = seg(world.build, ...BUILD_PHASES.oven);
    const time = state.clock.elapsedTime;

    // assemble: drum rises → dome lands → flue grows
    body.current.position.y = -1.7 * (1 - easeOutCubic(seg(p, 0, 0.36)));
    const d = seg(p, 0.34, 0.72);
    dome.current.position.y = BODY_H + 2.8 * (1 - easeOutBack(d, 0.6));
    dome.current.scale.setScalar(d > 0 ? 1 : HIDDEN);
    const f = easeOutCubic(seg(p, 0.66, 1));
    const count = geo.flue.index.count;
    geo.flue.setDrawRange(0, Math.floor((count * f) / 6) * 6);

    // fire
    const fire = world.fire;
    const fl = flicker(time, 1.3);
    flames.forEach((m) => {
      m.uniforms.uTime.value = time;
      m.uniforms.uIntensity.value = fire * (0.9 + 0.1 * fl);
    });
    light.current.intensity = fire * fl * 7;
    // the fire lights the inside of the oven (and the pizza on the deck)
    fireLight.current.intensity = fire * fl * 5.5;
    // the glow at the mouth is seen from the room; it fades when the camera
    // comes close, so the inside stays clear
    const near = THREE.MathUtils.smoothstep(camera.position.distanceTo(GLOW_POS), 1.3, 2.6);
    glow.current.opacity = Math.min(1, fire * 0.85) * fl * near;
    inner.current.emissiveIntensity = fire * (0.35 + 0.1 * fl);
    deck.current.emissiveIntensity = fire * 0.18;
  });

  return (
    <group position={[O.x, 0, O.z]}>
      <group ref={body}>
        <Prop name="oven" shadows={s}>
          <mesh geometry={geo.body} material={M.copper()} castShadow={s} receiveShadow={s} />
          <mesh geometry={geo.plinth} material={M.copperPipe()} />
          <mesh position={[0, BODY_H, 0]} rotation-x={Math.PI / 2} material={M.copperPipe()}>
            <torusGeometry args={[R + 0.012, 0.035, 12, 96]} />
          </mesh>
          {/* black mouth housing with the arch opening */}
          <mesh geometry={geo.mouth} position={[0, MOUTH_Y, R - 0.3]} material={M.blackMetal()} castShadow={s} />
          {/* copper panel below the mouth */}
          <mesh position={[0, (MOUTH_Y - 0.33) / 2, R - 0.07]} material={M.copper()}>
            <boxGeometry args={[1.0, MOUTH_Y - 0.33, 0.46]} />
          </mesh>
          {/* landing shelf */}
          <mesh position={[0, O.deckY - 0.02, R + 0.3]} material={M.blackMetal()} castShadow={s}>
            <boxGeometry args={[1.15, 0.04, 0.34]} />
          </mesh>
        </Prop>

        {/* inside the oven: glowing vault, deck and flames */}
        <mesh position={[0, O.deckY, 0]}>
          <sphereGeometry args={[0.93, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {/* soot-darkened brick vault, lit by the fire */}
          <meshStandardMaterial ref={inner} side={THREE.BackSide} color="#3a2418" roughness={1} emissive="#5a1804" emissiveIntensity={0} />
        </mesh>
        <pointLight ref={fireLight} position={[-0.3, O.deckY + 0.28, -0.42]} color="#ff7a26" distance={2.6} decay={2} intensity={0} />
        <mesh position={[0, O.deckY + 0.002, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.93, 48]} />
          <meshStandardMaterial ref={deck} color="#6a5040" roughness={0.95} emissive="#ff5a1a" emissiveIntensity={0} />
        </mesh>
        {flames.map((m, i) => (
          <mesh key={i} position={[-0.28 + i * 0.05, O.deckY + 0.36, -0.42]} rotation-y={(i - 1) * (Math.PI / 3)} material={m}>
            <planeGeometry args={[0.85, 0.75]} />
          </mesh>
        ))}
        <sprite position={[0, MOUTH_Y - 0.02, R + 0.2]} scale={[1.5, 1.2, 1]}>
          <spriteMaterial ref={glow} map={glowMap} color="#ff8a33" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <pointLight ref={light} position={[0, MOUTH_Y, R + 0.5]} color="#ff7a2a" distance={6} decay={2} intensity={0} />
      </group>

      <group ref={dome} position={[0, BODY_H, 0]}>
        <mesh geometry={geo.dome} material={M.copperDome()} castShadow={s} />
        <mesh position={[0, 0.97, 0]} material={M.copperPipe()}>
          <cylinderGeometry args={[0.17, 0.17, 0.06, 32]} />
        </mesh>
        <Suspense fallback={null}>
          <Plaque />
        </Suspense>
      </group>

      <mesh ref={flue} geometry={geo.flue} material={M.copperPipe()} castShadow={s} />
    </group>
  );
}
