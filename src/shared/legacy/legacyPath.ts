/**
 * Turning a visitor-supplied slug into an upstream URL (LCP-002).
 *
 * This is the app's first route that builds a server-side URL out of user
 * input, so it is written as an **allowlist**: a segment may contain only
 * Unicode letters, Unicode digits, `-`, `_`, `.` and `~`. Everything else —
 * `/`, `\`, `:`, `@`, `?`, `#`, `%`, control characters, and the homoglyphs
 * nobody thought to enumerate (a full-width `％`, a zero-width joiner) — is
 * rejected by not being on the list rather than by a rule naming it.
 *
 * Params arrive **percent-encoded**, so each segment is decoded exactly once
 * before it meets the allowlist. This file originally asserted the opposite —
 * that Next hands route params already decoded — and the assumption was simply
 * wrong: measured, `/profile/дегтярёв-алексей-анатольевич/` reached the loader as
 * `%D0%B4%D0%B5%D0%B3…` and was rejected, so every Cyrillic legacy URL 404'd.
 *
 * Exactly once, and the traversal guarantee survives it: `%2e%2e` decodes to
 * `..` and `%2f` to `/`, both of which the allowlist refuses, and a
 * double-encoded `%252e%252e` decodes to a literal `%` that is not on the list
 * either. What is never done is decoding in a loop until it stops changing —
 * that is the construction this guards against.
 */

/** Unicode letters and digits plus the three unreserved URL punctuation marks. */
const ALLOWED_SEGMENT = /^[\p{L}\p{N}\-_.~]+$/u;

/**
 * The chromeless-render hint (decision D3).
 *
 * **Not `?embed=1`** — that is reserved by WordPress core and returns a 21 KB
 * oEmbed *card* in place of the page. A namespaced parameter is inert on a host
 * that does not implement it, which is what we want on live prod today, and
 * meaningful on a frozen copy that later does.
 *
 * Fixed, never derived from the request: the visitor's own query string is
 * discarded entirely, so two requests differing only in query hit the same
 * upstream URL and the same store key.
 */
export const LEGACY_EMBED_QUERY = 'od_embed=1';

export const isAllowedSegment = (segment: string): boolean => {
  if (!segment || segment === '.' || segment === '..') {
    return false;
  }
  return ALLOWED_SEGMENT.test(segment);
};

/** `['materials', 'plakati']` → `/materials/plakati/`. */
export const legacyPathname = (segments: readonly string[]): string => `/${segments.join('/')}/`;

/**
 * Decode one layer of percent-encoding off each segment and check the result
 * against the allowlist, or `null` if any segment fails.
 *
 * The single place that turns what the router hands us into segments the rest of
 * this module may use, so "decoded exactly once, then allowlisted" is a property
 * of one function rather than a convention every caller has to remember.
 */
export const decodeSegments = (segments: readonly string[] | undefined): string[] | null => {
  if (!segments || segments.length === 0) {
    return null;
  }
  const decoded: string[] = [];
  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch (_error) {
      return null; // a malformed escape like `%zz`
    }
    if (!isAllowedSegment(value)) {
      return null;
    }
    decoded.push(value);
  }
  return decoded;
};

/**
 * The upstream URL for a slug, or `null` if anything about it is off — an
 * unlisted character, a traversal attempt, an unconfigured origin, or a
 * composed URL that somehow does not land on the configured origin.
 *
 * The origin assertion is the belt to the allowlist's braces: it is what makes
 * "no outbound request ever leaves the configured origin" true by construction
 * rather than by exhaustive reasoning about the character class.
 */
export const buildLegacyUrl = (segments: readonly string[] | undefined, origin: string | null): string | null => {
  if (!origin) {
    return null;
  }
  // Idempotent when the caller has already decoded: a clean slug holds no `%`,
  // so a second pass returns it unchanged, and one that does hold a `%` is
  // rejected either way.
  const decoded = decodeSegments(segments);
  if (!decoded) {
    return null;
  }

  let url: URL;
  try {
    // `encodeURI` percent-encodes the non-ASCII slugs WordPress serves and
    // leaves the separators alone; the allowlist has already guaranteed there
    // is nothing else to encode.
    url = new URL(encodeURI(legacyPathname(decoded)), origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) {
    return null;
  }
  url.search = LEGACY_EMBED_QUERY;
  return url.toString();
};
