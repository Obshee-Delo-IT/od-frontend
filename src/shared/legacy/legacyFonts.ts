/**
 * The legacy theme's own webfonts, re-declared against **this** origin.
 *
 * Fonts are the one subresource the browser always fetches in CORS mode. The
 * legacy origin answers them 200 with no `Access-Control-Allow-Origin`, which is
 * fine on its own site — same origin, no preflight — and fatal under our `<base
 * href>`, where every one of them is cross-origin. Measured on `/about/`: three
 * requests, three `net::ERR_FAILED`, and the console saying so in as many words.
 * What the visitor sees is the icon glyphs missing from every card (`fontello`
 * is an icon font, so those cards have no images to lose — the icons *are* the
 * font) and headings falling back off the condensed face.
 *
 * So the bytes have to come from us. {@link LEGACY_FONT_PREFIX} is relayed by
 * `src/proxy.ts` to the same files on the legacy origin — a relay, not a copy:
 * these are the client's own assets and `MyriadPro` is licensed to them, not to
 * this repository.
 *
 * `%SITE%` is substituted with `location.origin` **at run time, in the frame**,
 * and that is not squeamishness about `SITE_URL`. Under `<base
 * href="https://obshee-delo.ru/…">` even a rooted `/legacy-font/…` resolves to
 * the legacy origin, so the URL has to be absolute; and `SITE_URL` is unset in
 * local development, where it defaults to production — i.e. to the legacy origin
 * again. The document is the only thing that reliably knows what origin it was
 * served from.
 */

/** Where the relay lives on this origin. Kept in step with `src/proxy.ts`. */
export const LEGACY_FONT_PREFIX = '/legacy-font/';

/** Under the legacy origin's theme directory, which is where all of them sit. */
export const LEGACY_FONT_UPSTREAM = '/wp-content/themes/welfare/';

/**
 * Path, family and descriptors copied from the theme's own declarations —
 * `fontello.css` for the icons, an inline `<style>` in every page for the four
 * Myriad faces. The descriptors have to match or these are additions to the font
 * set rather than replacements of it.
 */
const FACES: ReadonlyArray<readonly [family: string, file: string, weight: string, style: string]> = [
  ['fontello', 'css/fonts/fontello.woff', 'normal', 'normal'],
  ['Myriad Pro', 'fonts/MyriadPro-Cond.woff', 'normal', 'normal'],
  ['Myriad Pro', 'fonts/MyriadPro-CondIt.woff', 'normal', 'italic'],
  ['Myriad Pro', 'fonts/MyriadPro-BoldCond.woff', 'bold', 'normal'],
  ['Myriad Pro', 'fonts/MyriadPro-BoldCondIt.woff', 'bold', 'italic'],
];

/**
 * Only `woff`. The theme lists `eot`, `woff`, `ttf` and `svg` in that order, of
 * which `woff` is the one every browser this site supports actually takes — the
 * other three exist for IE8 and for a WebKit bug that predates the site.
 */
export const legacyFontFaces = (): string =>
  FACES.map(
    ([family, file, weight, style]) =>
      `@font-face{font-family:'${family}';` +
      `src:url(%SITE%${LEGACY_FONT_PREFIX}${file}) format('woff');` +
      `font-weight:${weight};font-style:${style}}`
  ).join('');

/**
 * The relayed path for one upstream file, or `null` if it is not a font request
 * we are willing to make.
 *
 * A positive shape, not a denylist: letters, digits, `.`, `-`, `_` and `/`,
 * ending in `.woff` or `.woff2`. No `%`, so nothing arrives encoded and has to
 * be decoded here; no `..`, so the composed path cannot climb out of the theme
 * directory. The relay is a fixed prefix on a fixed origin either way, but the
 * whole point of this feature is that it never becomes a way to fetch something
 * else.
 */
export const legacyFontTarget = (pathname: string): string | null => {
  if (!pathname.startsWith(LEGACY_FONT_PREFIX)) {
    return null;
  }
  const file = pathname.slice(LEGACY_FONT_PREFIX.length);
  if (!/^[a-z0-9._/-]+\.woff2?$/i.test(file) || file.includes('..')) {
    return null;
  }
  return `${LEGACY_FONT_UPSTREAM}${file}`;
};
