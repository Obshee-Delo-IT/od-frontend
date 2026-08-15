/**
 * Main-navigation entries this site doesn't surface.
 *
 * The menu is editorial data — editors own it in WordPress — but «ОБЩЕЕДЕЛО-ПРО»
 * doesn't belong in this site's nav: it's a sibling property the site doesn't
 * advertise yet. It's dropped on the way through rather than forked out of the
 * menu. («Заказать материалы» used to be here too; on 2026-08-15 it was deleted
 * from the menu in WordPress itself, on both prod and od-dev — see
 * `docs/next-steps.md` — so it no longer reaches this code.)
 *
 * **Matched on the label, not the destination.** The two WordPress installs
 * store different URLs for this one entry — od-dev an old domain that no longer
 * resolves, prod the `od-pro.ru` contest landing — while both label it
 * «ОБЩЕЕДЕЛО-ПРО» under the same item id (both read 2026-08-13). Matching the
 * destination would mean keeping a list of stale addresses here and re-checking
 * it on every `WP_BASE` repoint; the label is the part that stays put.
 */

/** Upper-cased, because WordPress editors type the label however they please. */
const HIDDEN_LABELS = ['ОБЩЕЕДЕЛО-ПРО'];

/** Whether the menu entry carrying this label should be left out of the nav. */
export const isNavLabelHidden = (label: string): boolean => HIDDEN_LABELS.includes(label.trim().toUpperCase());
