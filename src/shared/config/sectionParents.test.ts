import { describe, expect, it } from 'vitest';
import { LEGACY_EMBED_PAGES } from './legacyEmbedPages';
import { sectionParent } from './sectionParents';

describe('sectionParent', () => {
  it('puts a social-ads page under its hub', () => {
    expect(sectionParent('/materials/plakati/')).toEqual({
      title: 'Социальная реклама',
      href: '/materials/social-reklama/',
    });
  });

  it('and a printed-products page under its own', () => {
    expect(sectionParent('/materials/books/')).toEqual({
      title: 'Печатная продукция',
      href: '/materials/printed-products/',
    });
  });

  it('leaves the hubs themselves alone — WordPress already has their parent', () => {
    expect(sectionParent('/materials/social-reklama/')).toBeNull();
    expect(sectionParent('/materials/printed-products/')).toBeNull();
    expect(sectionParent('/materials/')).toBeNull();
  });

  it('and every other page on the site', () => {
    expect(sectionParent('/materials/metodichki/')).toBeNull();
    expect(sectionParent('/healthy-russia/')).toBeNull();
  });

  /** Paths are compared whole, so the trailing slash is part of the key. */
  it('is written in the form the catch-all resolves', () => {
    expect(sectionParent('/materials/plakati')).toBeNull();
  });

  /**
   * A page on the A6 iframe renders no breadcrumb of ours, so an entry here for
   * one would be dead config — and both former entries came off the list when
   * these pages were redesigned (D6l, D6m).
   */
  it('names no page that is still on the legacy fallback', () => {
    for (const path of LEGACY_EMBED_PAGES) {
      expect(sectionParent(path)).toBeNull();
    }
  });
});
