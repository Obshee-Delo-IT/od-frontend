/**
 * Main-navigation entries this site doesn't surface.
 *
 * The menu is editorial data — editors own it in WordPress — but
 * «ОБЩЕЕДЕЛО-ПРО» is a sibling property the site doesn't advertise yet, so the
 * entry is dropped on the way through rather than forked out of the menu.
 *
 * **Matched on the label, not the destination.** The two WordPress installs
 * store different URLs for this one entry — od-dev an old domain that no longer
 * resolves, prod the `od-pro.ru` contest landing — while both label it
 * «ОБЩЕЕДЕЛО-ПРО» under the same item id (both read 2026-08-13). Matching the
 * destination would mean keeping a list of stale addresses here and re-checking
 * it on every `WP_BASE` repoint; the label is the part that stays put.
 */

/** The one switch: `true` puts «ОБЩЕЕДЕЛО-ПРО» back in the header. */
export const SHOW_PRO_IN_NAV: boolean = false;

const hiddenLabels = new Set((SHOW_PRO_IN_NAV ? [] : ['ОБЩЕЕДЕЛО-ПРО']).map((label) => label.toUpperCase()));

/** Whether the menu entry carrying this label should be left out of the nav. */
export const isNavLabelHidden = (label: string): boolean => hiddenLabels.has(label.trim().toUpperCase());
