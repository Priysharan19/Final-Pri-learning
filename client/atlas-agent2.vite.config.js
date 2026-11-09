// Isolated prototype build. Does not enter the production app.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-atlas-agent2',
    emptyOutDir: true,
    rollupOptions: { input: 'atlas-agent2.html' }
  }
});
