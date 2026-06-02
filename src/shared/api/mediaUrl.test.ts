import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMediaUrl, toCdnUrl } from './mediaUrl';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('toCdnUrl', () => {
  it('rewrites a WP-origin URL to the configured CDN base', () => {
    vi.stubEnv('WP_BASE', 'https://wp.test');
    vi.stubEnv('WP_MEDIA_CDN', 'https://cdn.test/');
    expect(toCdnUrl('https://wp.test/wp-content/uploads/2023/a.jpg')).toBe(
      'https://cdn.test/wp-content/uploads/2023/a.jpg'
    );
  });

  it('returns null when no CDN is configured', () => {
    vi.stubEnv('WP_BASE', 'https://wp.test');
    vi.stubEnv('WP_MEDIA_CDN', '');
    expect(toCdnUrl('https://wp.test/wp-content/uploads/a.jpg')).toBeNull();
  });

  it('returns null for URLs that are not under the WP origin', () => {
    vi.stubEnv('WP_BASE', 'https://wp.test');
    vi.stubEnv('WP_MEDIA_CDN', 'https://cdn.test');
    expect(toCdnUrl('https://other.example/a.jpg')).toBeNull();
  });
});

describe('resolveMediaUrl', () => {
  it('returns the full-size WP URL untouched when no CDN is configured', async () => {
    vi.stubEnv('WP_MEDIA_CDN', '');
    expect(await resolveMediaUrl('https://wp.test/uploads/cover-300x169.jpg')).toBe(
      'https://wp.test/uploads/cover.jpg'
    );
  });

  it('uses the CDN copy when the object exists there (HEAD 200)', async () => {
    vi.stubEnv('WP_BASE', 'https://wp.test');
    vi.stubEnv('WP_MEDIA_CDN', 'https://cdn.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    expect(await resolveMediaUrl('https://wp.test/wp-content/uploads/2023/onS3.jpg')).toBe(
      'https://cdn.test/wp-content/uploads/2023/onS3.jpg'
    );
  });

  it('falls back to the WP origin when the CDN redirects/misses (HEAD 301)', async () => {
    vi.stubEnv('WP_BASE', 'https://wp.test');
    vi.stubEnv('WP_MEDIA_CDN', 'https://cdn.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 301 }));
    expect(await resolveMediaUrl('https://wp.test/wp-content/uploads/2025/notYetOnS3.jpg')).toBe(
      'https://wp.test/wp-content/uploads/2025/notYetOnS3.jpg'
    );
  });

  it('falls back to the WP origin when the CDN probe errors out', async () => {
    vi.stubEnv('WP_BASE', 'https://wp.test');
    vi.stubEnv('WP_MEDIA_CDN', 'https://cdn.test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await resolveMediaUrl('https://wp.test/wp-content/uploads/2024/flaky.jpg')).toBe(
      'https://wp.test/wp-content/uploads/2024/flaky.jpg'
    );
  });

  it('returns null for nullish input', async () => {
    expect(await resolveMediaUrl(null)).toBeNull();
    expect(await resolveMediaUrl(undefined)).toBeNull();
  });
});
