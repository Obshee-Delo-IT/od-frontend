import { describe, expect, it } from 'vitest';
import { isEmbeddable, LEGACY_DENYLIST } from './isEmbeddable';

describe('isEmbeddable (LPF-001)', () => {
  it.each([['team'], ['materials', 'plakati'], ['profile', 'ivanov'], ['about', 'history', 'early']])(
    'accepts the ordinary page /%s/',
    (...slug) => {
      expect(isEmbeddable(slug)).toBe(true);
    }
  );

  it.each([['legacy'], ['_next'], ['api']])('rejects the reserved first segment %s', (first) => {
    expect(isEmbeddable([first])).toBe(false);
    expect(isEmbeddable([first, 'team'])).toBe(false);
    expect(isEmbeddable([first.toUpperCase(), 'team'])).toBe(false);
  });

  it('rejects a dotted last segment, which names a file rather than a page', () => {
    expect(isEmbeddable(['favicon.png'])).toBe(false);
    expect(isEmbeddable(['apple-touch-icon.png'])).toBe(false);
    expect(isEmbeddable(['materials', 'sitemap.xml'])).toBe(false);
  });

  it('allows a dot earlier in the path', () => {
    expect(isEmbeddable(['v1.0', 'team'])).toBe(true);
  });

  it('rejects an empty slug or an empty segment', () => {
    expect(isEmbeddable([])).toBe(false);
    expect(isEmbeddable(undefined)).toBe(false);
    expect(isEmbeddable(['materials', '', 'plakati'])).toBe(false);
  });

  it('rejects absurd depth at the boundary', () => {
    expect(isEmbeddable(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(true);
    expect(isEmbeddable(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe(false);
  });

  it('ships with an empty denylist, so no path is rejected on those grounds', () => {
    expect(LEGACY_DENYLIST).toEqual([]);
  });

  /**
   * The mechanism, exercised without shipping an opinion about which pages are
   * dead — that is a content decision nobody has made (decision D12).
   */
  it('rejects a denylisted path when one is configured', () => {
    const denylist = LEGACY_DENYLIST as string[];
    denylist.push('/retired/page/');
    try {
      expect(isEmbeddable(['retired', 'page'])).toBe(false);
      expect(isEmbeddable(['retired'])).toBe(true);
    } finally {
      denylist.length = 0;
    }
  });
});
