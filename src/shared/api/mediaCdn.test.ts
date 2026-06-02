import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WP_MEDIA_CDN, getWpMediaCdn } from './mediaCdn';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getWpMediaCdn', () => {
  it('uses WP_MEDIA_CDN when set', () => {
    vi.stubEnv('WP_MEDIA_CDN', 'https://cdn.test');
    expect(getWpMediaCdn()).toBe('https://cdn.test');
  });

  it('returns an empty string when explicitly disabled', () => {
    vi.stubEnv('WP_MEDIA_CDN', '');
    expect(getWpMediaCdn()).toBe('');
  });

  it('falls back to the committed default when unset', () => {
    vi.stubEnv('WP_MEDIA_CDN', undefined);
    expect(getWpMediaCdn()).toBe(DEFAULT_WP_MEDIA_CDN);
  });
});
