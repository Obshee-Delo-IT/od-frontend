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
 * Next hands route params **already decoded**, so a legitimate Cyrillic slug
 * arrives as literal Cyrillic and a surviving `%` can only be a re-encoding
 * attempt. That is why there is no decode-again loop: `%2e%2e` never gets the
 * chance to become `..`, because `%` is not an allowed character.
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
 * The upstream URL for a slug, or `null` if anything about it is off — an
 * unlisted character, a traversal attempt, an unconfigured origin, or a
 * composed URL that somehow does not land on the configured origin.
 *
 * The origin assertion is the belt to the allowlist's braces: it is what makes
 * "no outbound request ever leaves the configured origin" true by construction
 * rather than by exhaustive reasoning about the character class.
 */
export const buildLegacyUrl = (segments: readonly string[] | undefined, origin: string | null): string | null => {
  if (!origin || !segments || segments.length === 0) {
    return null;
  }
  if (!segments.every(isAllowedSegment)) {
    return null;
  }

  let url: URL;
  try {
    // `encodeURI` percent-encodes the non-ASCII slugs WordPress serves and
    // leaves the separators alone; the allowlist has already guaranteed there
    // is nothing else to encode.
    url = new URL(encodeURI(legacyPathname(segments)), origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) {
    return null;
  }
  url.search = LEGACY_EMBED_QUERY;
  return url.toString();
};
