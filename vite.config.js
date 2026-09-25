import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The heavy 3D stack (three, @react-three/*) is only imported by the lazily
// loaded world (src/components/RestaurantScene/World.jsx), so Vite puts it in a
// separate chunk automatically. The first paint needs only React + GSAP.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
