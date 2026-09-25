import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, PIZZA_SET, BUILD_PHASES } from '../../three/worldState';
import { seg, easeOutBack, rng } from '../../three/anim';
import * as M from '../../three/materials';
import { sauceTexture, cheeseFiberBump, tomatoCutTexture, graterAlpha } from '../../three/textures';
import { COUNTER_Y, BOWL_POS, ladlePose, DRIPS, dripPos, MOZZ_BOARD, MOZZ_BALL, tornFraction, graterPose } from '../../three/pizzaPlan';
import { tomatoGeometry } from './pizzaGeometry';

/*
 * The ingredients on the counter, each shown as itself before it goes onto
 * the pizza: a mound of flour, a bowl of tomato sauce with whole and halved
 * tomatoes and a steel ladle, a whole mozzarella ball on a board, a block of
 * cheese on a grater. (The basil leaves are part of Pizza.jsx.)
 */

const HIDDEN = 0.0001;

/* ── materials (created once) ─────────────────────────────── */
const cache = new Map();
const once = (k, make) => (cache.has(k) ? cache.get(k) : cache.set(k, make()).get(k));
const steel = () => once('steel', () => new THREE.MeshStandardMaterial({ color: '#d9dcdf', metalness: 1, roughness: 0.16, side: THREE.DoubleSide }));
const tomatoSkin = () => once('tomato', () => new THREE.MeshPhysicalMaterial({ color: '#c3200f', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.2, sheenColor: new THREE.Color('#ff8a70') }));
const leafGreen = () => once('calyx', () => new THREE.MeshStandardMaterial({ color: '#3f6b25', roughness: 0.6, side: THREE.DoubleSide }));
const sauceSurface = () =>
  once('sauce-surface', () => new THREE.MeshPhysicalMaterial({ map: sauceTexture(), roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.15 }));
const sauceFlat = () => once('sauce-flat', () => new THREE.MeshPhysicalMaterial({ color: '#8f1c0c', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.12 }));
const mozzarella = () =>
  once('mozz', () =>
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.22,
      bumpMap: cheeseFiberBump(),
      bumpScale: 0.25,
      sheen: 0.8,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#ffffff'),
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      // milky: a little light seems to come from inside
      emissive: new THREE.Color('#2a2621'),
    }),
  );
const flourMat = () => once('flour', () => new THREE.MeshPhysicalMaterial({ color: '#f5f1e8', roughness: 0.96, sheen: 0.8, sheenRoughness: 0.9, sheenColor: new THREE.Color('#ffffff') }));
const hardCheese = () => once('hard-cheese', () => new THREE.MeshPhysicalMaterial({ color: '#efd38a', roughness: 0.55, sheen: 0.3, bumpMap: cheeseFiberBump(), bumpScale: 0.3 }));
const graterMat = () =>
  once('grater', () => new THREE.MeshStandardMaterial({ color: '#d4d7da', metalness: 1, roughness: 0.22, alphaMap: graterAlpha(), alphaTest: 0.5, side: THREE.DoubleSide }));

/** Ceramic bowl (open lathe, thick rim). */
function bowlGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.045, 0.0],
    [0.07, 0.012],
    [0.088, 0.04],
    [0.094, 0.062],
    [0.088, 0.063],
    [0.082, 0.045],
    [0.066, 0.02],
    [0.04, 0.011],
    [0.0, 0.011],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 48);
}

/** Lumpy mound of flour. */
function flourGeometry() {
  const r = rng(3);
  const pts = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    const rad = 0.075 * (1 - t) ** 0.8;
    pts.push(new THREE.Vector2(rad, 0.034 * (1 - (1 - t) ** 2.2)));
  }
  const g = new THREE.LatheGeometry(pts.reverse(), 40);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.12 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 11) + (r() - 0.5) * 0.02;
    p.setXYZ(i, x * k, p.getY(i) * (1 + 0.1 * Math.sin(a * 3)), z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Ladle: bowl (origin = its lowest point) + a long handle going up and back. */
function Ladle({ fill, stream }) {
  const geo = useMemo(() => {
    const R = 0.042;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(a) * R, R - Math.cos(a) * R));
    }
    const handle = new THREE.CatmullRomCurve3([
      new THREE.Vector3(R * 0.95, R, 0),
      new THREE.Vector3(R + 0.05, R + 0.07, 0),
      new THREE.Vector3(R + 0.12, R + 0.2, 0),
      new THREE.Vector3(R + 0.16, R + 0.3, 0),
      new THREE.Vector3(R + 0.145, R + 0.325, 0),
    ]);
    return { bowl: new THREE.LatheGeometry(pts, 40), handle: new THREE.TubeGeometry(handle, 40, 0.004, 8, false), R };
  }, []);
  return (
    <>
      <mesh geometry={geo.bowl} material={steel()} castShadow={QUALITY.shadows} />
      <mesh position={[0, geo.R, 0]} rotation-x={Math.PI / 2} material={steel()}>
        <torusGeometry args={[geo.R, 0.0022, 8, 48]} />
      </mesh>
      <mesh geometry={geo.handle} material={steel()} castShadow={QUALITY.shadows} />
      {/* sauce inside the ladle */}
      <mesh ref={fill} position={[0, geo.R * 0.72, 0]} rotation-x={-Math.PI / 2} material={sauceFlat()}>
        <circleGeometry args={[geo.R * 0.93, 32]} />
      </mesh>
      {/* sauce pouring from the lip (scaled by the pour) */}
      <group ref={stream} position={[-geo.R * 0.95, geo.R, 0]}>
        <mesh position={[0, -0.5, 0]} material={sauceFlat()}>
          <cylinderGeometry args={[0.006, 0.009, 1, 12, 1, true]} />
        </mesh>
      </group>
    </>
  );
}

export function Ingredients() {
  const root = useRef(null);
  const ladle = useRef(null);
  const ladleFill = useRef(null);
  const ladleStream = useRef(null);
  const drips = useRef([]);
  const ball = useRef(null);
  const grater = useRef(null);
  const block = useRef(null);
  const pose = useMemo(() => ({ pos: new THREE.Vector3(), tilt: 0, fill: 1, pour: 0 }), []);
  const gpose = useMemo(() => ({ pos: new THREE.Vector3(), tilt: 0, yaw: 0, block: 0, wear: 0 }), []);
  const tv = useMemo(() => new THREE.Vector3(), []);
  const geo = useMemo(() => ({ bowl: bowlGeometry(), flour: flourGeometry(), tomato: tomatoGeometry() }), []);

  useFrame((state) => {
    const w = world;
    const props = seg(seg(w.build, ...BUILD_PHASES.oven), 0.6, 1);
    root.current.scale.setScalar(props > 0 ? 1 : HIDDEN);
    root.current.position.y = (1 - easeOutBack(props)) * 0.3;

    /* ladle */
    ladlePose(w.sauce, state.clock.elapsedTime, pose);
    const l = ladle.current;
    l.position.copy(pose.pos);
    l.rotation.set(0, -0.55, pose.tilt);
    ladleFill.current.scale.setScalar(Math.max(HIDDEN, pose.fill));
    ladleFill.current.position.y = 0.042 * (0.25 + 0.5 * pose.fill);
    if (pose.pour > 0.01) {
      // stream from the lip straight down to the pizza
      const lipY = pose.pos.y + 0.03;
      const len = Math.max(0.001, lipY - (COUNTER_Y + 0.01));
      ladleStream.current.scale.set(pose.pour, len, pose.pour);
      ladleStream.current.rotation.z = -pose.tilt;
    } else ladleStream.current.scale.setScalar(HIDDEN);
    DRIPS.forEach((d, i) => {
      const m = drips.current[i];
      if (!m) return;
      const p = dripPos(d, w.sauce, tv);
      if (p) {
        m.position.copy(p);
        m.scale.set(1, 1.5, 1);
      } else m.scale.setScalar(HIDDEN);
    });

    /* mozzarella ball: smaller with every piece torn off */
    const left = 1 - tornFraction(w.cheese);
    const k = Math.cbrt(Math.max(0, left));
    ball.current.scale.set(k, k * 0.9, k);
    ball.current.position.y = COUNTER_Y + 0.012 + MOZZ_BALL.r * 0.9 * k;

    /* grater */
    graterPose(w.finish, gpose);
    const gr = grater.current;
    gr.position.copy(gpose.pos);
    gr.rotation.set(0, gpose.yaw, gpose.tilt);
    block.current.position.x = gpose.block * 0.07;
    block.current.scale.set(1 - gpose.wear * 0.25, 1, 1);
  });

  const [fx, fz] = PIZZA_SET.flour;
  const shadows = QUALITY.shadows;
  return (
    <group ref={root}>
      {/* flour */}
      <mesh geometry={geo.flour} material={flourMat()} position={[fx, COUNTER_Y + 0.001, fz]} receiveShadow={shadows} />

      {/* sauce bowl + tomatoes */}
      <group position={[BOWL_POS.x, COUNTER_Y, BOWL_POS.z]}>
        <mesh geometry={geo.bowl} material={M.ceramic()} castShadow={shadows} receiveShadow={shadows} />
        <mesh position={[0, 0.052, 0]} rotation-x={-Math.PI / 2} material={sauceSurface()}>
          <circleGeometry args={[0.083, 40]} />
        </mesh>
      </group>
      {PIZZA_SET.tomatoes.map(([x, z, turn, kind], i) =>
        kind === 'half' ? (
          <group key={i} position={[x, COUNTER_Y + 0.026, z]} rotation-y={turn}>
            {/* lower half of the tomato, cut face up */}
            <mesh scale={[0.031, 0.026, 0.031]} material={tomatoSkin()} castShadow={shadows}>
              <sphereGeometry args={[1, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            </mesh>
            <mesh position={[0, 0.0002, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.031, 40]} />
              <meshPhysicalMaterial map={tomatoCutTexture()} roughness={0.2} clearcoat={1} clearcoatRoughness={0.1} />
            </mesh>
          </group>
        ) : (
          <group key={i} position={[x, COUNTER_Y + 0.028, z]} rotation-y={turn}>
            <mesh scale={0.031} geometry={geo.tomato} material={tomatoSkin()} castShadow={shadows} />
            {/* calyx: five small sepals and a stem */}
            {[0, 1, 2, 3, 4].map((k2) => (
              <mesh key={k2} position={[Math.cos((k2 / 5) * Math.PI * 2) * 0.006, 0.027, Math.sin((k2 / 5) * Math.PI * 2) * 0.006]} rotation={[0, -(k2 / 5) * Math.PI * 2, 0.35]} material={leafGreen()}>
                <planeGeometry args={[0.014, 0.004]} />
              </mesh>
            ))}
            <mesh position={[0, 0.031, 0]} material={leafGreen()}>
              <cylinderGeometry args={[0.0015, 0.002, 0.008, 6]} />
            </mesh>
          </group>
        ),
      )}

      {/* ladle + drips */}
      <group ref={ladle}>
        <Ladle fill={ladleFill} stream={ladleStream} />
      </group>
      {DRIPS.map((_, i) => (
        <mesh key={i} ref={(el) => (drips.current[i] = el)} material={sauceFlat()}>
          <sphereGeometry args={[0.0035, 10, 8]} />
        </mesh>
      ))}

      {/* mozzarella on a small board */}
      <group position={[MOZZ_BOARD.x, COUNTER_Y, MOZZ_BOARD.z]}>
        <mesh position={[0, 0.006, 0]} material={M.wood('oak', 1, 1)} castShadow={shadows} receiveShadow={shadows}>
          <cylinderGeometry args={[0.085, 0.085, 0.012, 40]} />
        </mesh>
        {/* a little whey on the board */}
        <mesh position={[0.012, 0.0125, 0.02]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.024, 32]} />
          <meshPhysicalMaterial color="#f4f0e4" transparent opacity={0.18} roughness={0.05} clearcoat={1} />
        </mesh>
      </group>
      <mesh ref={ball} position={[MOZZ_BALL.center.x, MOZZ_BALL.center.y, MOZZ_BALL.center.z]} material={mozzarella()} castShadow={shadows}>
        <sphereGeometry args={[MOZZ_BALL.r, 48, 32]} />
      </mesh>

      {/* grater + block of cheese */}
      <group ref={grater}>
        <mesh rotation-x={-Math.PI / 2} material={graterMat()} castShadow={shadows}>
          <planeGeometry args={[0.26, 0.058]} />
        </mesh>
        <mesh position={[0.18, 0.002, 0]} material={M.blackMetal()}>
          <boxGeometry args={[0.11, 0.012, 0.026]} />
        </mesh>
        <group ref={block} position={[0, 0.022, 0]}>
          <RoundedBox args={[0.065, 0.04, 0.045]} radius={0.006} smoothness={3} material={hardCheese()} castShadow={shadows} />
        </group>
      </group>
    </group>
  );
}
