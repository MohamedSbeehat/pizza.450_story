import { Component, Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { MODELS } from '../../data/models';

class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('[3D] model failed to load, using the procedural prop instead:', err?.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GltfModel({ url, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0], shadows }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !!shadows;
        o.receiveShadow = !!shadows;
      }
    });
    return c;
  }, [scene, shadows]);
  return <primitive object={clone} scale={scale} position={position} rotation={rotation} />;
}

/**
 * A swappable 3D prop: renders the procedural version (children) unless a
 * .glb is configured for `name` in src/data/models.js. The build animation
 * is applied by the parent group, so it works for both.
 */
export function Prop({ name, children, shadows = false }) {
  const cfg = MODELS[name];
  if (!cfg?.url) return children;
  return (
    <ModelBoundary fallback={children}>
      <Suspense fallback={children}>
        <GltfModel {...cfg} shadows={shadows} />
      </Suspense>
    </ModelBoundary>
  );
}
