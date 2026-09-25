import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from '../../config/quality';
import { world } from '../../three/worldState';

/**
 * Places the camera from world.cam every frame, plus:
 *  - steps back on narrow/portrait screens so the subject still fits
 *  - a lens shift that moves the subject away from the text column
 *    (left of the text on desktop, above it on phones)
 *  - a very small sway that follows the mouse (desktop)
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    if (!QUALITY.pointerParallax) return undefined;
    const onMove = (e) => {
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, dt) => {
    const c = world.cam;
    const p = pointer.current;
    const k = Math.min(1, dt * 2.2);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;

    const aspect = size.width / size.height;
    const fit = aspect < 1 ? 1 + (1 - aspect) * 1.05 : aspect < 1.4 ? 1 + (1.4 - aspect) * 0.35 : 1;

    target.set(c.tx, c.ty, c.tz);
    camera.position.set(c.tx + (c.x - c.tx) * fit, c.ty + (c.y - c.ty) * fit, c.tz + (c.z - c.tz) * fit);
    const dist = camera.position.distanceTo(target);
    camera.position.x += p.x * 0.022 * dist;
    camera.position.y -= p.y * 0.014 * dist;
    camera.lookAt(target);

    camera.fov = c.fov;
    const shiftX = aspect >= 1.05 ? 0.13 : 0;
    const shiftY = aspect < 1.05 ? 0.13 : 0;
    camera.setViewOffset(size.width, size.height, shiftX * size.width, shiftY * size.height, size.width, size.height);
    camera.updateProjectionMatrix();
  });

  return null;
}
