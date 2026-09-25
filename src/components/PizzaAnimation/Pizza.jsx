import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world, BUILD_PHASES } from '../../three/worldState';
import { seg, smooth, lerp, easeOutCubic, easeOutBack } from '../../three/anim';
import { doughTextures, sauceTexture, sauceBump, dimpleBump, cheeseFiberBump, basilTextures } from '../../three/textures';
import * as M from '../../three/materials';
import {
  SIZE,
  BOARD_H,
  SERVE,
  SURFACE,
  SAUCE_TURNS,
  pizzaPose,
  toLocal,
  doughWeights,
  dimples,
  doughSpin,
  sauceReveal,
  CHEESE_PIECES,
  CHEESE_FLIGHT,
  bakePhases,
  finishReal,
  BASIL_LEAVES,
  BASIL_FLIGHT,
  STRANDS,
} from '../../three/pizzaPlan';
import { baseGeometry, cheeseGeometry, strandGeometry, leafGeometry } from './pizzaGeometry';

/*
 * The first pizza, made in front of the viewer like a food film (Scene 5),
 * then served (Scene 6). The choreography lives in three/pizzaPlan.js.
 *
 *   dough   a ball → pressed with the fingers (dents) → stretched and turned
 *   sauce   spreads in a spiral behind the ladle (Ingredients.jsx)
 *   cheese  torn pieces fly from the mozzarella ball and land on the pizza
 *   oven    the crust puffs up, the cheese melts, spreads and browns, and
 *           the pizza becomes the real Pizzeria 450 pizza (their photo)
 *   finish  grated cheese falls into a pile, fresh basil floats down
 */

const HIDDEN = 0.0001;

const loader = new THREE.TextureLoader();
function loadTexture(url, srgb) {
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = QUALITY.tier === 'low' ? 4 : 8;
  return t;
}

/** Dough → baked crust → the real pizza (clean, then with its toppings). */
function useBaseMaterial() {
  return useMemo(() => {
    const { raw, baked } = doughTextures();
    const clean = loadTexture('/textures/pizza-top-clean.webp', true);
    const full = loadTexture('/textures/pizza-top.webp', true);
    const photoBump = loadTexture('/textures/pizza-top-bump.webp', false);
    const dents = dimpleBump();
    const uniforms = {
      uBake: { value: 0 },
      uFinal: { value: 0 },
      uCrust: { value: baked },
      uClean: { value: clean },
      uFull: { value: full },
    };
    const mat = new THREE.MeshPhysicalMaterial({
      map: raw,
      roughness: 0.86,
      bumpMap: dents,
      bumpScale: 0,
      sheen: 0.7,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color('#fff0d8'),
      clearcoat: 0.02,
      clearcoatRoughness: 0.45,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uBake;\nuniform float uFinal;\nuniform sampler2D uCrust;\nuniform sampler2D uClean;\nuniform sampler2D uFull;')
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          #ifdef USE_MAP
            vec4 rawColor = texture2D( map, vMapUv );
            vec4 crust = texture2D( uCrust, vMapUv );
            vec4 cleanPhoto = texture2D( uClean, vMapUv );
            vec4 fullPhoto = texture2D( uFull, vMapUv );
            vec4 real = mix( cleanPhoto, fullPhoto, uFinal );
            vec3 bakedColor = mix( crust.rgb, real.rgb, real.a );
            diffuseColor.rgb *= mix( rawColor.rgb, bakedColor, uBake );
          #endif`,
        );
    };
    mat.customProgramCacheKey = () => 'pizza-base-v3';
    return { mat, uniforms, dents, photoBump };
  }, []);
}

/** Sauce: revealed along the ladle's spiral (same maths as pizzaPlan). */
function useSauceMaterial() {
  return useMemo(() => {
    const uniforms = { uReveal: { value: 0 } };
    const mat = new THREE.MeshPhysicalMaterial({
      map: sauceTexture(),
      bumpMap: sauceBump(),
      bumpScale: 1.4,
      roughness: 0.28,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
      transparent: true,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uReveal;').replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
          {
            if ( texture2D( map, vMapUv ).a < 0.5 ) discard;
            diffuseColor.a = opacity;
            // the ladle passes this pixel at spiral time sStar
            vec2 q = vMapUv - 0.5;
            float r = length(q) * 2.0;
            float a = atan(q.y, q.x) / 6.2831853 + 0.5;
            float T = ${SAUCE_TURNS.toFixed(1)};
            float k = ceil(r * T - 0.5 - a);
            float sStar = (a + k) / T;
            // ragged, hand-spread edge
            float n = fract(sin(dot(floor(vMapUv * 90.0), vec2(12.9898, 78.233))) * 43758.5453);
            sStar += (n - 0.5) * 0.03;
            if (sStar > uReveal) discard;
          }`,
      );
    };
    mat.customProgramCacheKey = () => 'pizza-sauce-spiral';
    return { mat, uniforms };
  }, []);
}

export function Pizza() {
  const group = useRef(null);
  const inner = useRef(null);
  const base = useRef(null);
  const sauce = useRef(null);
  const cheese = useRef(null);
  const basil = useRef(null);
  const strands = useRef(null);
  const peel = useRef(null);
  const board = useRef(null);

  const strandList = useMemo(() => STRANDS(QUALITY.tier === 'low' ? 150 : 320), []);
  const geo = useMemo(
    () => ({
      base: baseGeometry(),
      sauce: new THREE.CircleGeometry(0.8, 96).rotateX(-Math.PI / 2),
      cheese: cheeseGeometry(),
      leaf: leafGeometry(),
      strand: strandGeometry(),
    }),
    [],
  );
  const baseMat = useBaseMaterial();
  const sauceMat = useSauceMaterial();
  // fresh fior di latte: milky white, wet and glossy
  const cheeseMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.36,
        bumpMap: cheeseFiberBump(),
        bumpScale: 0.6,
        sheen: 0.5,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#fffaf0'),
        clearcoat: 0.55,
        clearcoatRoughness: 0.35,
      }),
    [],
  );
  const basilMat = useMemo(() => {
    const { map, bump } = basilTextures();
    return new THREE.MeshPhysicalMaterial({
      map,
      bumpMap: bump,
      bumpScale: 1.2,
      roughness: 0.4,
      clearcoat: 0.6,
      clearcoatRoughness: 0.28,
      sheen: 0.25,
      sheenColor: new THREE.Color('#bfe8a6'),
      side: THREE.DoubleSide,
    });
  }, []);
  const strandMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#f6e9c2', roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#fff7df') }),
    [],
  );

  const tmp = useMemo(
    () => ({
      pose: { pos: new THREE.Vector3(), yaw: 0, peel: -1 },
      weights: [0, 0, 0],
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      e: new THREE.Euler(),
      c: new THREE.Color(),
      raw: new THREE.Color('#fbf8f1'),
      melted: new THREE.Color('#f9e7b4'),
      browned: new THREE.Color('#dca25c'),
      basilFresh: new THREE.Color('#ffffff'),
    }),
    [],
  );

  useFrame((state) => {
    const w = world;
    const time = state.clock.elapsedTime;
    const pose = pizzaPose(w, time, tmp.pose);
    const phase = bakePhases(w.bake);
    const props = seg(seg(w.build, ...BUILD_PHASES.oven), 0.6, 1); // counter props appear

    /* ── the pizza moves ─────────────────────────────────── */
    const g = group.current;
    g.position.copy(pose.pos);
    g.rotation.y = pose.yaw;

    if (pose.peel >= 0) {
      peel.current.scale.setScalar(1);
      peel.current.position.set(pose.pos.x, pose.pos.y - 0.006, pose.pos.z + pose.peel);
    } else peel.current.scale.setScalar(HIDDEN);

    board.current.scale.setScalar(props > 0 ? easeOutBack(props) : HIDDEN);
    if (w.serve > 0) board.current.position.set(pose.pos.x, pose.pos.y - BOARD_H / 2, pose.pos.z);
    else board.current.position.set(SERVE.x, SERVE.y - BOARD_H / 2, SERVE.z);

    /* ── dough: ball → pressed → stretched → puffed crust ─ */
    const b = base.current;
    doughWeights(w, tmp.weights);
    b.morphTargetInfluences[0] = tmp.weights[0];
    b.morphTargetInfluences[1] = tmp.weights[1];
    b.morphTargetInfluences[2] = tmp.weights[2];
    b.rotation.y = doughSpin(w);
    // a soft "slap" as it is thrown and stretched
    const stretch = seg(w.dough, 0.4, 1);
    const slap = Math.sin(stretch * Math.PI * 4) * 0.05 * (1 - stretch) * (stretch > 0 ? 1 : 0);
    b.scale.set(1 + slap, 1 - slap * 1.5, 1 + slap);

    const bm = baseMat.mat;
    const baking = phase.photo;
    baseMat.uniforms.uBake.value = baking;
    baseMat.uniforms.uFinal.value = finishReal(w.finish);
    if (w.bake > 0.25) {
      bm.bumpMap = baseMat.photoBump;
      bm.bumpScale = lerp(0, 1.1, baking);
    } else {
      bm.bumpMap = baseMat.dents;
      bm.bumpScale = dimples(w) * 9;
    }
    bm.roughness = lerp(0.86, 0.58, baking);
    bm.sheen = lerp(0.7, 0.08, baking);
    bm.clearcoat = lerp(0.02, 0.3, baking);

    /* ── sauce ───────────────────────────────────────────── */
    const s = sauceReveal(w.sauce);
    sauceMat.uniforms.uReveal.value = s;
    sauceMat.mat.opacity = 1 - smooth(seg(w.bake, 0.35, 0.8));
    sauce.current.scale.setScalar(s > 0.001 && w.bake < 0.85 ? 1 : HIDDEN);
    sauceMat.mat.color.setScalar(lerp(1, 0.8, phase.melt));

    /* ── torn mozzarella: flies, lands, melts ─────────────── */
    const cm = cheese.current;
    CHEESE_PIECES.forEach((pc, i) => {
      const t = seg(w.cheese, pc.launch, pc.launch + CHEESE_FLIGHT);
      if (t <= 0 || phase.sink >= 0.999) {
        tmp.m.makeScale(HIDDEN, HIDDEN, HIDDEN);
        cm.setMatrixAt(i, tmp.m);
        return;
      }
      // flight: slow-motion arc from the ball to its spot
      const e = t < 1 ? smooth(t) : 1;
      tmp.p.set(lerp(pc.from.x, pc.x, e), 0, lerp(pc.from.z, pc.z, e));
      const restY = SURFACE + pc.size * 0.3;
      tmp.p.y = lerp(pc.from.y, restY, e) + Math.sin(t * Math.PI) * (0.9 + pc.size * 2);
      // tumbling in the air, settling flat on landing
      const air = 1 - easeOutCubic(t);
      tmp.e.set(pc.tumble[0] * air, pc.rot + pc.tumble[1] * air, pc.tumble[2] * air);
      tmp.q.setFromEuler(tmp.e);
      // torn off: grows from the ball; lands with a small squash
      const born = smooth(seg(t, 0, 0.12));
      const land = Math.sin(seg(t, 0.86, 1) * Math.PI) * 0.22;
      // oven: softens, spreads to the photo's cheese, browns, sinks into it
      const melt = phase.melt;
      const bubble = melt * (1 - phase.sink) * 0.05 * Math.sin(time * 5 + i * 1.7);
      const spread = lerp(pc.size, pc.meltR, melt) * (1 + bubble);
      const height = lerp(pc.size * 0.62, 0.018, melt) * (1 - land);
      tmp.p.y -= melt * pc.size * 0.25 + phase.sink * 0.035;
      tmp.s.set(spread * pc.ax * (1 + land * 0.5) * (0.4 + 0.6 * born), height * (0.4 + 0.6 * born), spread * pc.az * (1 + land * 0.5) * (0.4 + 0.6 * born));
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      cm.setMatrixAt(i, tmp.m);
      tmp.c.copy(tmp.raw).lerp(tmp.melted, melt);
      if (pc.brown) tmp.c.lerp(tmp.browned, smooth(seg(w.bake, 0.4, 0.8)) * 0.7);
      cm.setColorAt(i, tmp.c);
    });
    cm.instanceMatrix.needsUpdate = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    cheeseMat.clearcoat = lerp(0.55, 0.9, phase.melt);
    cheeseMat.roughness = lerp(0.36, 0.25, phase.melt);

    /* ── grated cheese: falls into a pile ────────────────── */
    const sm = strands.current;
    const fade = finishReal(w.finish);
    strandList.forEach((st, i) => {
      const t = seg(w.finish, st.launch, st.launch + st.dur);
      if (t <= 0 || fade >= 0.999) {
        tmp.m.makeScale(HIDDEN, HIDDEN, HIDDEN);
        sm.setMatrixAt(i, tmp.m);
        return;
      }
      tmp.p.set(lerp(st.from.x, st.to.x, t), lerp(st.from.y, st.to.y, t * t), lerp(st.from.z, st.to.z, t));
      const air = 1 - t;
      tmp.e.set(st.tilt + air * st.spin * 0.3, st.yaw + air * st.spin, st.roll * (0.4 + air));
      tmp.q.setFromEuler(tmp.e);
      const k = st.len * (1 - fade);
      tmp.s.set(k, 1 - fade * 0.8, 1 - fade * 0.8);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      sm.setMatrixAt(i, tmp.m);
    });
    sm.instanceMatrix.needsUpdate = true;

    /* ── basil: waits on the counter, floats down ────────── */
    const bl = basil.current;
    BASIL_LEAVES.forEach((leaf, i) => {
      const t = seg(w.finish, leaf.launch, leaf.launch + BASIL_FLIGHT);
      const home = toLocal(leaf.counter, pose, tmp.p.clone());
      const tg = leaf.target;
      if (t <= 0) {
        // on the counter (appears with the other ingredients)
        tmp.p.copy(home);
        tmp.e.set(0, leaf.counterYaw - pose.yaw, 0);
        tmp.s.setScalar(props > 0 ? 1.15 * easeOutBack(props) : HIDDEN);
      } else {
        const e = smooth(t);
        const endY = SURFACE + 0.075;
        tmp.p.set(lerp(home.x, tg.x, e), 0, lerp(home.z, tg.z, e));
        // lifted, then falls slowly with a side-to-side sway
        tmp.p.y = lerp(home.y, endY, e) + Math.sin(t * Math.PI) * 1.6;
        const sway = (1 - e) * leaf.sway;
        tmp.p.x += Math.sin(t * Math.PI * 3) * 0.25 * sway;
        tmp.e.set(Math.sin(t * Math.PI * 4) * 0.7 * sway, lerp(leaf.counterYaw - pose.yaw, tg.rot, e) + (1 - e) * 2.5, Math.cos(t * Math.PI * 3) * 0.5 * sway);
        tmp.s.setScalar(lerp(1.15, tg.s, e));
      }
      tmp.q.setFromEuler(tmp.e);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      bl.setMatrixAt(i, tmp.m);
    });
    bl.instanceMatrix.needsUpdate = true;
  });

  const shadows = QUALITY.shadows;
  return (
    <>
      <group ref={group}>
        <group ref={inner} scale={SIZE}>
          <mesh ref={base} args={[geo.base, baseMat.mat]} castShadow={shadows} receiveShadow={shadows} />
          <mesh ref={sauce} geometry={geo.sauce} material={sauceMat.mat} position={[0, SURFACE - 0.002, 0]} />
          <instancedMesh ref={cheese} args={[geo.cheese, cheeseMat, CHEESE_PIECES.length]} frustumCulled={false} castShadow={shadows} />
          <instancedMesh ref={strands} args={[geo.strand, strandMat, strandList.length]} frustumCulled={false} castShadow={shadows} />
          <instancedMesh ref={basil} args={[geo.leaf, basilMat, BASIL_LEAVES.length]} frustumCulled={false} castShadow={shadows} />
        </group>
      </group>

      {/* wooden peel (pala) */}
      <group ref={peel}>
        <mesh position={[0, -0.004, 0]} material={M.wood('light', 1, 1)}>
          <cylinderGeometry args={[0.2, 0.2, 0.008, 40]} />
        </mesh>
        <mesh position={[0, -0.004, 0.72]} rotation-x={Math.PI / 2} material={M.wood('light', 1, 1)}>
          <cylinderGeometry args={[0.016, 0.016, 1.05, 10]} />
        </mesh>
      </group>

      {/* serving board */}
      <group ref={board}>
        <mesh material={M.wood('oak', 1, 1)} castShadow={shadows} receiveShadow={shadows}>
          <cylinderGeometry args={[0.215, 0.215, BOARD_H, 48]} />
        </mesh>
        <mesh position={[0, 0, 0.255]} material={M.wood('oak', 1, 1)}>
          <boxGeometry args={[0.08, BOARD_H, 0.1]} />
        </mesh>
      </group>
    </>
  );
}
