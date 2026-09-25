import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, LAYOUT, BUILD_PHASES } from '../../three/worldState';
import { seg, stagger, easeOutCubic, easeOutBack, rng, flicker } from '../../three/anim';
import * as M from '../../three/materials';
import { blueprintTexture, glowTexture, shadowTexture } from '../../three/textures';
import { Prop } from './Prop';

/*
 * The restaurant set, built in code and assembled by the scroll:
 *   floor tiles are laid → walls rise → (oven: see Oven.jsx) → counter,
 *   shelves, tables and chairs arrive → lamps come down and switch on.
 * Objects rise out of the floor or drop from above; nothing is ever
 * `visible = false`, so every shader is compiled up-front (no hitches).
 */

const { room } = LAYOUT;
const HIDDEN = 0.0001;
const phase = (name) => seg(world.build, ...BUILD_PHASES[name]);

/** Moves an object up out of the floor: t = 0 → hidden below, 1 → in place. */
const rise = (obj, t, depth) => {
  obj.position.y = -depth * (1 - easeOutCubic(t));
};

/** Drops an object from above and hides it until it starts to fall. */
const drop = (obj, t, height, baseY = 0) => {
  obj.position.y = baseY + height * (1 - easeOutCubic(t));
  obj.scale.setScalar(t > 0 ? 1 : HIDDEN);
};

/* ── Floor ─────────────────────────────────────────────────────── */

function Floor() {
  const tiles = useRef(null);
  const last = useRef(-1);
  const size = QUALITY.tier === 'low' ? 0.7 : 0.5;

  const { data, geo } = useMemo(() => {
    const cols = Math.ceil(room.width / size);
    const rows = Math.ceil(room.depth / size);
    const origin = [0.4, -1.2]; // tiles are laid outward from here
    const out = [];
    let maxD = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = room.leftX + size * (c + 0.5);
        const z = room.backZ + size * (r + 0.5);
        const d = Math.hypot(x - origin[0], z - origin[1]);
        maxD = Math.max(maxD, d);
        out.push({ x, z, d, rot: ((r + c) % 4) * (Math.PI / 2) });
      }
    }
    out.forEach((t) => (t.d /= maxD));
    return { data: out, geo: new THREE.PlaneGeometry(size * 0.985, size * 0.985).rotateX(-Math.PI / 2) };
  }, [size]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame(() => {
    const p = phase('floor');
    if (p === last.current || !tiles.current) return;
    last.current = p;
    data.forEach((t, i) => {
      const local = seg(p, t.d * 0.62, t.d * 0.62 + 0.38);
      const s = local > 0 ? easeOutBack(local, 1.3) : HIDDEN;
      tmp.p.set(t.x, (1 - easeOutCubic(local)) * 0.3, t.z);
      tmp.q.setFromAxisAngle(tmp.up, t.rot);
      tmp.s.set(s, 1, s);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      tiles.current.setMatrixAt(i, tmp.m);
    });
    tiles.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* dark ground under everything (also hides whatever still waits below the floor) */}
      <mesh position={[0, -0.004, room.backZ + room.depth / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[room.width + 4, room.depth + 4]} />
        <meshStandardMaterial color="#17110c" roughness={0.95} />
      </mesh>
      <instancedMesh ref={tiles} args={[geo, M.tile(), data.length]} receiveShadow frustumCulled={false} />
    </>
  );
}

/* ── Golden floor plan (the idea, before anything is built) ───── */

function Blueprint() {
  const mat = useRef(null);
  useFrame(() => {
    if (mat.current) mat.current.opacity = world.blueprint * 0.95;
  });
  return (
    <mesh position={[0, 0.006, room.backZ + room.depth / 2]} rotation-x={-Math.PI / 2} renderOrder={2}>
      <planeGeometry args={[room.width, room.depth]} />
      <meshBasicMaterial ref={mat} map={blueprintTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} toneMapped={false} />
    </mesh>
  );
}

/* ── Walls + the wooden arch behind the oven ───────────────────── */

function archGeometry() {
  const R = 1.55;
  const H = 2.2;
  const r = 1.36;
  const outer = new THREE.Shape();
  outer.moveTo(-R, 0);
  outer.lineTo(-R, H);
  outer.absarc(0, H, R, Math.PI, 0, true);
  outer.lineTo(R, 0);
  outer.lineTo(-R, 0);
  const hole = new THREE.Path();
  hole.moveTo(-r, 0);
  hole.lineTo(-r, H);
  hole.absarc(0, H, r, Math.PI, 0, true);
  hole.lineTo(r, 0);
  hole.lineTo(-r, 0);
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 40 });
}

function Walls() {
  const back = useRef(null);
  const side = useRef(null);
  const arch = useRef(null);
  const recess = useRef(null);
  const s = QUALITY.shadows;
  const geo = useMemo(
    () => ({
      back: new THREE.BoxGeometry(room.width, room.height, 0.25).translate(0, room.height / 2, 0),
      side: new THREE.BoxGeometry(0.25, room.height, room.depth).translate(0, room.height / 2, 0),
      arch: archGeometry(),
    }),
    [],
  );

  useFrame(() => {
    const p = phase('walls');
    rise(back.current, seg(p, 0, 0.7), room.height + 0.1);
    rise(side.current, seg(p, 0.2, 0.9), room.height + 0.1);
    rise(recess.current, seg(p, 0.35, 0.95), room.height + 0.1);
    rise(arch.current, seg(p, 0.45, 1), room.height + 0.1);
  });

  const O = LAYOUT.oven;
  return (
    <>
      <mesh ref={back} geometry={geo.back} material={M.brick(7, 2.1)} position={[0, 0, room.backZ - 0.125]} receiveShadow={s} />
      <mesh ref={side} geometry={geo.side} material={M.brick(5.5, 2.1)} position={[room.leftX - 0.125, 0, room.backZ + room.depth / 2]} receiveShadow={s} />
      {/* darker brick inside the arch */}
      <group ref={recess} position={[O.x, 0, room.backZ + 0.004]}>
        <mesh position={[0, 1.8, 0]}>
          <planeGeometry args={[2.8, 3.6]} />
          <meshStandardMaterial map={M.brick(1.4, 1.8).map} bumpMap={M.brick(1.4, 1.8).bumpMap} bumpScale={2} color="#b9a992" roughness={0.95} />
        </mesh>
      </group>
      <mesh ref={arch} geometry={geo.arch} material={M.wood('light', 1.5, 1.5)} position={[O.x, 0, room.backZ]} castShadow={s} />
      <Shopfront />
    </>
  );
}

/**
 * The glass front on the right, like the real facade: a low brick base, a
 * black steel window grid and dark glass that reflects the warm room.
 */
function Shopfront() {
  const group = useRef(null);
  const x = room.leftX + room.width + 0.1;
  const zc = room.backZ + room.depth / 2;
  const baseH = 0.55;
  const bays = 7;
  const bay = room.depth / bays;
  const transom = 2.7;
  const frame = M.blackMetal();
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#16191b', metalness: 0.35, roughness: 0.08, envMapIntensity: 2.4, emissive: '#070b10' }),
    [],
  );

  useFrame(() => {
    rise(group.current, seg(phase('walls'), 0.3, 1), room.height + 0.1);
  });

  return (
    <group ref={group} position={[x, 0, zc]}>
      <mesh position={[0, baseH / 2, 0]} material={M.brick(4.5, 0.3)}>
        <boxGeometry args={[0.25, baseH, room.depth]} />
      </mesh>
      <mesh position={[0.05, (baseH + room.height) / 2, 0]} rotation-y={-Math.PI / 2} material={glass}>
        <planeGeometry args={[room.depth, room.height - baseH]} />
      </mesh>
      {/* mullions */}
      {Array.from({ length: bays + 1 }, (_, i) => (
        <mesh key={i} position={[0, (baseH + room.height) / 2, -room.depth / 2 + i * bay]} material={frame}>
          <boxGeometry args={[0.12, room.height - baseH, 0.07]} />
        </mesh>
      ))}
      {/* sill, transom and head */}
      {[baseH, transom, room.height - 0.04].map((y, i) => (
        <mesh key={`h${i}`} position={[0, y, 0]} material={frame}>
          <boxGeometry args={[0.13, 0.07, room.depth]} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Shelves with jars and bottles (right of the arch) ─────────── */

function Shelves() {
  const group = useRef(null);
  const leds = useRef([]);
  const x0 = 4.85;
  const w = 1.9;
  const h = 2.3;
  const d = 0.36;
  const y0 = 0.95;
  const levels = 4;

  const items = useMemo(() => {
    const r = rng(77);
    const out = [];
    for (let lv = 0; lv < levels; lv++) {
      for (let c = 0; c < 3; c++) {
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const kind = r();
          out.push({
            x: x0 - w / 2 + (c + 0.2 + (k + 0.5) * (0.6 / n)) * (w / 3),
            y: y0 + (lv * h) / levels + 0.02,
            kind: kind < 0.4 ? 'jar' : kind < 0.75 ? 'bottle' : 'can',
            h: 0.14 + r() * 0.16,
            color: ['#3c5a2a', '#6b4a1c', '#2c3e2a', '#8a2a1c'][Math.floor(r() * 4)],
          });
        }
      }
    }
    return out;
  }, []);

  useFrame(() => {
    const p = phase('furniture');
    rise(group.current, seg(p, 0, 0.5), 3.6);
    const on = world.lights;
    leds.current.forEach((m) => m && (m.emissiveIntensity = on * 2.2));
  });

  const woodMat = M.wood('oak', 1, 1);
  return (
    <group ref={group} position={[0, 0, room.backZ + d / 2 + 0.01]}>
      {/* lower cabinet */}
      <mesh position={[x0, y0 / 2, 0.08]} material={M.wood('dark', 2, 1)}>
        <boxGeometry args={[w, y0, d + 0.16]} />
      </mesh>
      <mesh position={[x0, y0 + 0.01, 0.08]} material={M.marble()}>
        <boxGeometry args={[w + 0.04, 0.04, d + 0.2]} />
      </mesh>
      {/* back panel, uprights, boards */}
      <mesh position={[x0, y0 + h / 2, -d / 2 + 0.01]} material={woodMat}>
        <boxGeometry args={[w, h, 0.02]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`u${i}`} position={[x0 - w / 2 + (i * w) / 3, y0 + h / 2, 0]} material={woodMat}>
          <boxGeometry args={[0.035, h, d]} />
        </mesh>
      ))}
      {Array.from({ length: levels + 1 }, (_, i) => (
        <mesh key={`b${i}`} position={[x0, y0 + (i * h) / levels, 0]} material={woodMat}>
          <boxGeometry args={[w, 0.03, d]} />
        </mesh>
      ))}
      {/* warm LED strip under each board */}
      {Array.from({ length: levels }, (_, i) => (
        <mesh key={`l${i}`} position={[x0, y0 + ((i + 1) * h) / levels - 0.022, d / 2 - 0.03]}>
          <boxGeometry args={[w - 0.08, 0.008, 0.012]} />
          <meshStandardMaterial ref={(m) => (leds.current[i] = m)} color="#2a1a0c" emissive="#ffb35c" emissiveIntensity={0} />
        </mesh>
      ))}
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y + it.h / 2, 0.02]} material={it.kind === 'can' ? M.flat('#a0301f', 0.4) : M.glass(it.color)}>
          {it.kind === 'bottle' ? <cylinderGeometry args={[0.035, 0.04, it.h, 12]} /> : <cylinderGeometry args={[0.055, 0.055, it.h * 0.7, 14]} />}
        </mesh>
      ))}
    </group>
  );
}

/* ── The counter where the pizza is made ───────────────────────── */

function Counter() {
  const body = useRef(null);
  const props = useRef(null);
  const C = LAYOUT.counter;
  const s = QUALITY.shadows;
  const backZ = C.z - C.depth / 2 + 0.16;

  useFrame(() => {
    const p = phase('oven');
    rise(body.current, seg(p, 0.15, 0.6), 1.2);
    const t = seg(p, 0.6, 1);
    props.current.scale.setScalar(t > 0 ? easeOutBack(t) : HIDDEN);
  });

  return (
    <>
      <group ref={body}>
        <Prop name="counter" shadows={s}>
          <mesh position={[C.x, (C.height - 0.05) / 2, C.z]} material={M.wood('dark', 3, 1)} castShadow={s} receiveShadow={s}>
            <boxGeometry args={[C.width, C.height - 0.05, C.depth]} />
          </mesh>
          <mesh position={[C.x, C.height - 0.025, C.z]} material={M.marble()} castShadow={s} receiveShadow={s}>
            <boxGeometry args={[C.width + 0.05, 0.05, C.depth + 0.06]} />
          </mesh>
        </Prop>
      </group>
      {/* decor at the far end of the counter (the pizza's ingredients: PizzaAnimation/Ingredients.jsx) */}
      <group ref={props} position={[0, C.height, 0]}>
        {/* olive oil */}
        <mesh position={[C.x - 1.0, 0.13, backZ - 0.02]} material={M.glass('#6b5a1a')}>
          <cylinderGeometry args={[0.035, 0.045, 0.26, 14]} />
        </mesh>
      </group>
    </>
  );
}

/* ── Tables and chairs ─────────────────────────────────────────── */

function Chair({ material, frame }) {
  const legs = [
    [-0.17, -0.17],
    [0.17, -0.17],
    [-0.17, 0.17],
    [0.17, 0.17],
  ];
  return (
    <group>
      <mesh position={[0, 0.46, 0]} material={material} castShadow={QUALITY.shadows}>
        <boxGeometry args={[0.42, 0.035, 0.42]} />
      </mesh>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.225, z]} material={frame}>
          <cylinderGeometry args={[0.013, 0.011, 0.45, 8]} />
        </mesh>
      ))}
      {[-0.17, 0.17].map((x, i) => (
        <mesh key={`p${i}`} position={[x, 0.68, 0.19]} material={frame}>
          <cylinderGeometry args={[0.012, 0.012, 0.44, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.86, 0.19]} material={material}>
        <boxGeometry args={[0.42, 0.08, 0.025]} />
      </mesh>
    </group>
  );
}

function TableSet({ t, index, count }) {
  const group = useRef(null);
  const chairs = useRef([]);
  const shadow = useRef(null);
  const s = QUALITY.shadows;

  useFrame(() => {
    const p = phase('furniture');
    const tt = stagger(seg(p, 0.1, 0.85), index, count, 0.55);
    drop(group.current, seg(tt, 0, 0.6), 2.4);
    const c = seg(tt, 0.45, 1);
    chairs.current.forEach((ch, k) => {
      if (!ch) return;
      const out = (1 - easeOutCubic(c)) * 0.9;
      const a = (k / t.chairs) * Math.PI * 2;
      ch.position.set(Math.sin(a) * (0.72 + out), 0, Math.cos(a) * (0.72 + out));
      ch.scale.setScalar(c > 0 ? 1 : HIDDEN);
    });
    if (shadow.current) shadow.current.opacity = seg(tt, 0.3, 0.6) * 0.85;
  });

  const top = M.wood('light', 1, 1);
  const frame = M.blackMetal();
  const seat = M.wood('dark', 1, 1);
  return (
    <group position={[t.x, 0, t.z]} rotation-y={t.rot}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]}>
        <planeGeometry args={[2.1, 2.1]} />
        <meshBasicMaterial ref={shadow} map={shadowTexture()} transparent depthWrite={false} opacity={0} color="#000" />
      </mesh>
      <group ref={group}>
        <Prop name="table" shadows={s}>
          <mesh position={[0, 0.74, 0]} material={top} castShadow={s} receiveShadow={s}>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 40]} />
          </mesh>
          <mesh position={[0, 0.37, 0]} material={frame}>
            <cylinderGeometry args={[0.035, 0.035, 0.72, 12]} />
          </mesh>
          <mesh position={[0, 0.0125, 0]} material={frame} castShadow={s}>
            <cylinderGeometry args={[0.24, 0.26, 0.025, 28]} />
          </mesh>
        </Prop>
      </group>
      {Array.from({ length: t.chairs }, (_, k) => (
        <group key={k} ref={(el) => (chairs.current[k] = el)} rotation-y={(k / t.chairs) * Math.PI * 2}>
          <Prop name="chair" shadows={s}>
            <Chair material={seat} frame={frame} />
          </Prop>
        </group>
      ))}
    </group>
  );
}

function Tables() {
  return LAYOUT.tables.map((t, i) => <TableSet key={i} t={t} index={i} count={LAYOUT.tables.length} />);
}

/* ── Pendant lamps: come down, then switch on one by one ──────── */

export const LAMPS = (() => {
  const [px, , pz] = LAYOUT.prep;
  return [
    { x: px + 0.15, z: pz - 0.05, y: 2.18 },
    { x: px - 1.1, z: pz - 0.05, y: 2.18 },
    ...LAYOUT.tables.map((t) => ({ x: t.x, z: t.z, y: 2.1 })),
  ];
})();

function Pendants() {
  const groups = useRef([]);
  const bulbs = useRef([]);
  const glows = useRef([]);
  const glowMap = glowTexture();

  useFrame((state) => {
    const p = phase('lamps');
    const time = state.clock.elapsedTime;
    LAMPS.forEach((l, i) => {
      const g = groups.current[i];
      if (!g) return;
      const t = stagger(p, i, LAMPS.length, 0.5);
      g.position.y = l.y + 2.6 * (1 - easeOutBack(t, 1.1));
      g.scale.setScalar(t > 0 ? 1 : HIDDEN);
      // switch-on: each lamp flickers to life
      const on = seg(world.lights, i * 0.08, i * 0.08 + 0.35);
      const buzz = on > 0 && on < 1 ? (Math.sin(time * 45 + i * 7) > -0.2 ? 1 : 0.25) : 1;
      const level = on * buzz * flicker(time, i) * 1.08;
      if (bulbs.current[i]) bulbs.current[i].emissiveIntensity = 0.2 + level * 5;
      if (glows.current[i]) glows.current[i].opacity = level * 0.55;
    });
  });

  return LAMPS.map((l, i) => (
    <group key={i} ref={(el) => (groups.current[i] = el)} position={[l.x, l.y, l.z]}>
      <Prop name="lamp">
        <mesh position={[0, 2.02, 0]} material={M.blackMetal()}>
          <cylinderGeometry args={[0.004, 0.004, 4, 5]} />
        </mesh>
        <mesh position={[0, 0.12, 0]} material={M.brass()}>
          <cylinderGeometry args={[0.018, 0.018, 0.06, 10]} />
        </mesh>
        <mesh material={M.brass()} castShadow={false}>
          <coneGeometry args={[0.17, 0.2, 32, 1, true]} />
        </mesh>
      </Prop>
      <mesh position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.042, 16, 12]} />
        <meshStandardMaterial ref={(m) => (bulbs.current[i] = m)} color="#3a2410" emissive="#ffc27a" emissiveIntensity={0.2} />
      </mesh>
      <sprite position={[0, -0.08, 0]} scale={[0.95, 0.95, 0.95]}>
        <spriteMaterial ref={(m) => (glows.current[i] = m)} map={glowMap} color="#ffb869" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  ));
}

export function Restaurant() {
  return (
    <group>
      <Floor />
      <Blueprint />
      <Walls />
      <Shelves />
      <Counter />
      <Tables />
      <Pendants />
    </group>
  );
}
