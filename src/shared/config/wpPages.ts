/**
 * Which paths are rendered **natively from WordPress** instead of through the
 * A6 legacy embed (D6).
 *
 * The general mechanism, in one place: WordPress already holds 189 pages at the
 * paths the live site serves them from, so a page listed here needs no route,
 * no component and no content migration — the catch-all fetches
 * `/wp/v2/pages?slug=…`, verifies the permalink matches, and renders the
 * Gutenberg body with the same pipeline the news article uses. **The URL does
 * not change**, so entry pages and their rankings are untouched; editors keep
 * managing the content in WP.
 *
 * **Opt-in, not automatic.** Dropping the list and rendering every page
 * natively is one `if` away, and the content would mostly survive it — measured
 * 2026-08-15, 165 of 174 od-dev pages are Gutenberg blocks and **none** still
 * holds a shortcode, the `cmsms-gutenberg-upgrade` migration having already
 * run. What 23 of them still carry is bare `cmsms_*` class names, styled by a
 * theme we don't ship; the iframe does ship it. So a path moves here once
 * someone has looked at the page, which is cheap — one line — and the legacy
 * fallback stays the safety net underneath: if WP has no published page at the
 * path, the route falls back to the embed rather than 404ing.
 */
/**
 * The three programme pages — the `/projects/` cards' destinations, and the
 * section's whole detail level (D6). Each is one banner, a goal/tasks column
 * and a grid of linked film posters; the leftover `cmsms_heading` on their
 * closing links reads as a plain bold link without the old theme, which is what
 * that markup was anyway.
 */
export const NATIVE_WP_PAGES = ['/healthy-russia/', '/healthy-kids/', '/healthy-youth/'];

const NATIVE_WP_PAGE_SET = new Set(NATIVE_WP_PAGES);

export const isNativeWpPage = (path: string): boolean => NATIVE_WP_PAGE_SET.has(path);
