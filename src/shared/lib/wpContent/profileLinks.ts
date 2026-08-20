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
 * How many profiles one body may pull. The input is editor-controlled and each
 * one is a WordPress round trip, so there is a ceiling — but the ceiling has to
 * clear the real page that needs the most.
 *
 * That page is `/team/`, whose roster is **11** (D3). It was 8 until then, on the
 * reasoning that nothing on od-dev linked more than three; the cap is now the
 * roster plus room to grow, since a 12th member appearing in the admin must not
 * silently vanish from the page.
 *
 * ponytail: still a flat cap with no signal to the reader that it bit. Report the
 * overflow if a page ever wants more than this.
 */
const MAX_PROFILES_PER_PAGE = 16;

/** `<li …>…</li>` — one item of a list, non-greedy because a card holds no nested list. */
const LIST_ITEM = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
const CLASS_ATTR = /\bclass=["']([^"']*)["']/i;

/**
 * The classes are compared whole, not as substrings: `wp-block-post-title` and
 * `wp-block-post-featured-image` both *contain* `wp-block-post`, and only the
 * `<li>` is the card.
 */
const isPostCard = (attrs: string): boolean =>
  (attrs.match(CLASS_ATTR)?.[1] ?? '').split(/\s+/).includes('wp-block-post');

/**
 * The `/profile/…` hrefs that a `wp:query` **card** addresses, as opposed to the
 * ones a paragraph links.
 *
 * Two things read this. `parsePost` swaps the whole card for the person's card —
 * the `<li>` and not the anchor, because a query teaser renders the same href
 * twice (once in the featured image's `<figure>`, once in the title) and
 * replacing anchors would draw the card twice. And `resolveProfileEmbeds` gives
 * those cards a **photo** without needing a marker class: a teaser that already
 * showed a featured image is asking for the portrait variant.
 *
 * This is the 74 regional `/contacts/<region>/` pages: their coordinator list is
 * a query over `pl-categs`, so no page body can name the people it shows.
 */
export const collectQueryCardProfileHrefs = (html?: string | null): Set<string> => {
  if (!html) {
    return new Set();
  }

  const hrefs = [...html.matchAll(LIST_ITEM)]
    .filter(([, attrs]) => isPostCard(attrs))
    .flatMap(([, , inner]) => [...inner.matchAll(PROFILE_HREF)].map(([, href]) => href));

  return new Set(hrefs);
};

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
