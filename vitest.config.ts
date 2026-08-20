import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    svgr({
      include: '**/*.svg',
      // No svgoConfig here on purpose: @svgr/plugin-svgo isn't installed, so
      // vite-plugin-svgr runs no svgo at all and a test sees the raw Figma
      // markup (ids like `clip0_838_1531`). Passing the app's config would
      // read as coverage it doesn't have — see svgo.config.ts.
      // `svgProps` mirrors next.config.ts — the decorative-icon default is a
      // rendered attribute, so a test that asserts on it has to see it too.
      svgrOptions: { exportType: 'default', svgProps: { 'aria-hidden': 'true' } },
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    /**
     * The default 5s is a bet on runner speed, not a correctness bound, and it
     * lost: `transformLegacyHtml` parses whole legacy fixture pages, and what
     * takes 1.5s for the entire file locally takes 175s on a GitHub runner —
     * its slowest single case measured **30s** there. That had CI red on `main`
     * for three pushes with nothing broken. 60s is far past any real case and
     * still fails a genuine hang inside a minute.
     */
    testTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: {
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
  css: {
    postcss: { plugins: [] },
  },
});
