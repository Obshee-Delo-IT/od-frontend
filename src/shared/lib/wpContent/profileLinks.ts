/**
 * Finding the `profile` records a page body links to, so the page can draw them
 * as cards instead of repeating their contact details in prose.
 *
 * **The link is the whole mechanism.** WordPress has no relation between a page
 * and a `profile`: no meta key, no ACF group, no shared taxonomy — pages carry
 * no taxonomy at all on this install (measured over od-dev 2026-08-17). So the
 * marker is the thing an editor can already make and already understands: a link
 * to the coordinator's profile page, alone in its own paragraph. Nothing to
 * register, nothing to remember, and it is WordPress's own convention for
 * "embed this" — a URL on a line of its own is how core auto-embeds work.
 *
 * It also degrades correctly. If the record is unpublished, or the fetch fails,
 * or this code is removed, what is left in the body is a working link to that
 * person's page. That is the reason to prefer it over a `className` marker,
 * which renders as nothing.
 */

/** Every `/profile/…` href in the body, in document order. Both quote styles: WP emits both. */
const PROFILE_HREF = /\bhref=["'](\/profile\/[^"'\s]+)["']/gi;

/**
 * How many profiles one body may pull. Nothing on od-dev links more than three,
 * but the input is editor-controlled and each one is a WordPress round trip.
 *
 * ponytail: a flat cap, with no signal to the reader that it bit — raise it, or
 * report the overflow, if a page ever legitimately lists a team.
 */
const MAX_PROFILES_PER_PAGE = 8;

export const collectProfileHrefs = (html?: string | null): string[] => {
  if (!html) {
    return [];
  }
  const hrefs = [...html.matchAll(PROFILE_HREF)].map(([, href]) => href);
  return [...new Set(hrefs)].slice(0, MAX_PROFILES_PER_PAGE);
};

/**
 * `/profile/%d0%b3%d0%be%d1%80…/` → `%d0%b3%d0%be%d1%80…`.
 *
 * Left **encoded**, deliberately: WP's `?slug=` matches every spelling of these
 * 194-character percent-encoded Cyrillic slugs, and handing it the string the
 * URL already carries is the one form that needs no decision. A path that names
 * a profile by **id** (`/profile/28087/` — one page on od-dev does) yields
 * `28087`, which matches no slug, so that link is simply left as a link.
 */
export const profileSlug = (href: string): string => href.split('/').filter(Boolean).pop() ?? '';
