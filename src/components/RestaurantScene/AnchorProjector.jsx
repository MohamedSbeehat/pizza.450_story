import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { anchorEls } from '../../three/anchors';
import { anchorPoint } from '../../three/pizzaPlan';
import { world } from '../../three/worldState';

/** Moves the DOM ingredient labels onto their 3D objects every frame. */
export function AnchorProjector() {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    anchorEls.forEach((el, id) => {
      if (!anchorPoint(id, world, v)) return;
      v.project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.opacity = visible ? '' : '0';
      if (!visible) return;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
  }); // mounted after CameraRig, so it runs after the camera has moved
  return null;
}
