/**
 * SVGO settings for every `.svg` imported as a React component.
 *
 * Read by `next.config.ts` (@svgr/webpack under `turbopack.rules`). The test
 * pipeline deliberately doesn't use it — vite-plugin-svgr has no svgo plugin
 * installed, so tests see the raw Figma markup; `svgo.test.ts` guards this
 * object instead of pretending to guard the render.
 */
export const svgoConfig = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // svgo's preset-default drops `viewBox` when the SVG also carries
          // width/height — exactly a Figma export at its natural size. Without
          // it the drawing can't scale: the element resizes but the artwork
          // stays at 1:1 and is simply cropped, which is what the card
          // illustrations did below ~1170px. The icons never showed it because
          // their width/height are set smaller than the viewBox, so it was
          // never removed from those.
          removeViewBox: false,
        },
      },
    },
    // `cleanupIds` (inside preset-default) minifies every id to `a`, `b`, … per
    // file — fine in isolation, broken once two icons share a page: ids are
    // document-global, so all eight `url(#a)` references on the home page
    // resolved to whichever `#a` came first in the DOM. That was a card
    // illustration's clipPath (`M82.5 12.976h170v174.048h-170z`), which clipped
    // the 30×30 footer icons for Odnoklassniki and YouTube down to nothing —
    // VK survived only because it has no clip-path. `prefixIds` prefixes each
    // id with its filename, so they stay unique across the document.
    'prefixIds',
  ],
};
