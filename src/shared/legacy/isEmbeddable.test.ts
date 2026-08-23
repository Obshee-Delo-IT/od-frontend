import { describe, expect, it } from 'vitest';
import { isEmbeddable } from './isEmbeddable';

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

  /**
   * A post's only address here is the bare `/<id>/`. WordPress answers any
   * `/news/…` path with its «Наши дела» archive at 200, so the fallback used to
   * embed that archive under every integer and canonicalise it onto itself
   * (ROUTE-01).
   */
  it('rejects the post shapes this site deliberately does not serve', () => {
    expect(isEmbeddable(['news', '60862'])).toBe(false);
    expect(isEmbeddable(['news', '99999999'])).toBe(false);
    expect(isEmbeddable(['video', '67400'])).toBe(false);
    // The section index itself, and a real page under it, are unaffected.
    expect(isEmbeddable(['news'])).toBe(true);
    expect(isEmbeddable(['news', 'kak-eto-bylo'])).toBe(true);
    expect(isEmbeddable(['about', '2024'])).toBe(true);
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
});
