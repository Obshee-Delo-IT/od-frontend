import { RUSSIA_MAP_REGIONS, RUSSIA_MAP_VIEW_BOX } from './regions.generated';
import css from './RussiaMap.module.css';

/**
 * The clickable map of Russia on `/contacts/` (D4) — Figma `contact`
 * (`754:587`).
 *
 * A **Server Component with no client boundary**: 82 `<path>`s, 70 of them
 * wrapped in a real `<a href>`, and nothing else. The live page does the same
 * job with jqvmap — jQuery 1.7.2 off a Google CDN, two `../wp-includes/…`
 * scripts that 404 against our origin, and an `onRegionClick` whose entire body
 * is `parent.location.assign("/contacts/<slug>/")`. A link is what that was
 * imitating, so a link is what this ships: middle-click and «open in new tab»
 * work, and the page loads no JavaScript for it.
 *
 * `<a>` rather than `next/link` on purpose — 70 prefetching links would pull 70
 * region pages into the router cache for a visitor who will open one.
 *
 * The region table is generated; see `scripts/generate-russia-map.mjs` for where
 * the hrefs come from and why twelve regions are drawn but not clickable.
 */

/** The `/contacts/` index — the one page this map belongs on. */
export const CONTACTS_INDEX_PATH = '/contacts/';

export const RussiaMap = () => (
  <div className={css.card}>
    <svg className={css.map} viewBox={RUSSIA_MAP_VIEW_BOX} aria-label="Региональные отделения на карте России">
      {RUSSIA_MAP_REGIONS.map(({ code, name, path, href }) =>
        href ? (
          /* `<title>` is the native tooltip — the old map's only tooltip too, its
             `data_obj` having been left empty. `aria-label` names the link for
             assistive tech, which reads the label over a descendant `<title>`. */
          <a key={code} href={href} aria-label={name} className={css.link}>
            <title>{name}</title>
            <path className={css.region} d={path} />
          </a>
        ) : (
          /* No page answers for this region, so it is drawn, greyed and nothing
             more — a link to a 404 is worse than a silhouette. The old page made
             the same distinction with jqvmap's `selectRegion`. */
          <path key={code} className={`${css.region} ${css.unlinked}`} d={path} />
        )
      )}
    </svg>
  </div>
);
