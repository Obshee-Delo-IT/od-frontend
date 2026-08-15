import { describe, expect, it } from 'vitest';
import { svgoConfig } from './svgo';

/**
 * Not a rendering test — vitest's svgr runs no svgo at all (see
 * `vitest.config.ts`), so the ids a component test sees are the raw Figma ones
 * and would pass with or without this plugin. What this does guard is the one
 * line whose removal broke the footer: without `prefixIds` every icon ships an
 * `id="a"`, and `url(#a)` resolves document-wide to the first one.
 */
describe('svgoConfig', () => {
  it('keeps ids unique across files and viewBox intact', () => {
    expect(svgoConfig.plugins).toContain('prefixIds');

    const preset = svgoConfig.plugins.find((plugin) => typeof plugin === 'object' && plugin.name === 'preset-default');
    expect(preset).toMatchObject({ params: { overrides: { removeViewBox: false } } });
  });
});
