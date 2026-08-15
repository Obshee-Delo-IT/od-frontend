/**
 * Main-navigation entries this site doesn't surface.
 *
 * The menu is editorial data — editors own it in WordPress — but two entries
 * don't belong in this site's nav: «ОБЩЕЕДЕЛО-ПРО», a sibling property the site
 * doesn't advertise yet, and «Заказать материалы», a child of «Материалы».
 * Both are dropped on the way through rather than forked out of the menu.
 *
 * **Matched on the label, not the destination.** The two WordPress installs
 * store different URLs for this one entry — od-dev an old domain that no longer
 * resolves, prod the `od-pro.ru` contest landing — while both label it
 * «ОБЩЕЕДЕЛО-ПРО» under the same item id (both read 2026-08-13). Matching the
 * destination would mean keeping a list of stale addresses here and re-checking
 * it on every `WP_BASE` repoint; the label is the part that stays put.
 */

/** Upper-cased, because WordPress editors type the label however they please. */
const HIDDEN_LABELS = ['ОБЩЕЕДЕЛО-ПРО', 'ЗАКАЗАТЬ МАТЕРИАЛЫ'];

/** Whether the menu entry carrying this label should be left out of the nav. */
export const isNavLabelHidden = (label: string): boolean => HIDDEN_LABELS.includes(label.trim().toUpperCase());
