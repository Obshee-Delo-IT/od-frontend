import { describe, expect, it } from 'vitest';
import { legacyFontFaces, legacyFontTarget, LEGACY_FONT_PREFIX, LEGACY_FONT_UPSTREAM } from './legacyFonts';

describe('legacyFontTarget', () => {
  it.each([
    ['the icon font, query and all stripped by the caller', 'css/fonts/fontello.woff'],
    ['a heading face', 'fonts/MyriadPro-BoldCond.woff'],
    ['woff2, which the theme does not ship today but might', 'fonts/Next.woff2'],
  ])('relays %s', (_name, file) => {
    expect(legacyFontTarget(`${LEGACY_FONT_PREFIX}${file}`)).toBe(`${LEGACY_FONT_UPSTREAM}${file}`);
  });

  /**
   * The relay is a fixed prefix on a fixed origin, so none of these could reach
   * another host. They are refused anyway: the value of a positive shape is that
   * it stays correct when someone later makes the prefix configurable.
   */
  it.each([
    ['a traversal', 'css/../../../index.php'],
    ['a traversal that ends in .woff', 'a/../../b.woff'],
    ['a bare parent segment', '../secret.woff'],
    ['an encoded separator', 'css%2Ffonts%2Ffontello.woff'],
    ['an encoded traversal', '..%2F..%2Fx.woff'],
    ['anything percent-encoded at all', 'fonts/%D1%84.woff'],
    ['a stylesheet', 'style.css'],
    ['a script', 'js/script.js'],
    ['a null-byte suffix', 'fontello.woff%00.js'],
    ['a query smuggled into the path', 'fontello.woff?x=1'],
    ['an absolute URL', 'https://evil.example/x.woff'],
    ['nothing at all', ''],
  ])('refuses %s', (_name, file) => {
    expect(legacyFontTarget(`${LEGACY_FONT_PREFIX}${file}`)).toBeNull();
  });

  it('ignores a path that is not the relay', () => {
    expect(legacyFontTarget('/team/')).toBeNull();
    expect(legacyFontTarget('/legacy/team/')).toBeNull();
    expect(legacyFontTarget('/legacy-fontish/x.woff')).toBeNull();
  });
});

describe('legacyFontFaces', () => {
  const css = legacyFontFaces();

  it('re-declares every face the theme does, with the same descriptors', () => {
    // Same family *and* the same weight/style, or these are additions to the
    // font set rather than replacements — the theme's own cross-origin
    // declaration would keep winning for the shapes ours did not name.
    expect(css.match(/@font-face/g)).toHaveLength(5);
    expect(css).toContain("font-family:'fontello';");
    expect(css).toContain('font-weight:bold;font-style:italic}');
    expect(css.match(/font-family:'Myriad Pro'/g)).toHaveLength(4);
  });

  it('leaves the origin for the document to fill in', () => {
    // A rooted path would resolve against the injected `<base>`, i.e. against
    // the legacy origin, which is the fetch that is blocked.
    expect(css.match(/url\(%SITE%/g)).toHaveLength(5);
    expect(css).not.toContain('url(/');
    expect(css).not.toContain('obshee-delo');
  });

  it('asks only for woff, which is the format every supported browser takes', () => {
    expect(css.match(/format\('woff'\)/g)).toHaveLength(5);
    expect(css).not.toContain('.eot');
    expect(css).not.toContain('.ttf');
    expect(css).not.toContain('.svg');
  });

  it('names files the relay is willing to fetch', () => {
    for (const [, url] of css.matchAll(/url\(%SITE%([^)]+)\)/g)) {
      expect(legacyFontTarget(url)).not.toBeNull();
    }
  });
});
