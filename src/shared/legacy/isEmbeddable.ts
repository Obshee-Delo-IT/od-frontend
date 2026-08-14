import { decodeSegments } from './legacyPath';

/**
 * Which paths the catch-all is willing to hand to the legacy embed (LPF-001).
 *
 * Not a guard against real routes — App Router precedence already gives a
 * static or dynamic segment priority over `[...slug]`, so adding a native route
 * retires that path's fallback with no edit here. This is about not embedding a
 * request for `/favicon.png`, and not recursing `/legacy/…` back through the
 * proxy.
 *
 * Pure, no I/O: it runs before anything is fetched.
 */

/** `/legacy/*` would recurse through the proxy; the other two are Next's own. */
const RESERVED_FIRST_SEGMENTS = new Set(['legacy', '_next', 'api']);

/**
 * Deeper than any legacy page: the deepest measured is three segments
 * (`/materials/printed-products/`-shaped). The bound exists so a crafted path
 * cannot fan out indefinitely, not because six is meaningful.
 */
const MAX_DEPTH = 6;

export const isEmbeddable = (slug: readonly string[] | undefined): boolean => {
  if (!slug || slug.length === 0 || slug.length > MAX_DEPTH) {
    return false;
  }
  // Decoded before anything is judged: the router hands segments percent-encoded,
  // so `%2E` would otherwise slip past the dot test below.
  const segments = decodeSegments(slug);
  if (!segments) {
    return false;
  }
  if (RESERVED_FIRST_SEGMENTS.has(segments[0].toLowerCase())) {
    return false;
  }
  // A dot in the last segment means a file, not a page — `/favicon.png/`,
  // `/apple-touch-icon.png/`. `trailingSlash: true` installs a redirect for the
  // dotted form, so what reaches here is the odd crawler or a broken link.
  return !segments[segments.length - 1].includes('.');
};
