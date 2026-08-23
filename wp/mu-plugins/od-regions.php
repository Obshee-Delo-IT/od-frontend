<?php
/**
 * Plugin Name: OD — the /contacts/ region accordion
 * Description: `[od_regions]` renders one disclosure per regional page, built
 *              from those pages rather than from a copy of them.
 *
 * Install at `wp-content/mu-plugins/od-regions.php`. The canonical copy is
 * `wp/mu-plugins/od-regions.php` in the frontend repo — edit there, `scp` here.
 *
 * **PHP 7.4 syntax only.** An mu-plugin loads on every *site* request, and
 * od-dev — where this is installed and tested first — serves the site with
 * `apache2handler` PHP **7.4.33** (its CLI is 8.2.32, production's mu-plugin
 * runtime is 8.2). Anything newer than 7.4 here is a parse error that takes the
 * whole site down the moment WordPress loads: no `str_contains`, no
 * `str_starts_with`, no `match`, no constructor promotion, no `?->`, no enums,
 * no `readonly`. Arrow functions, typed properties, `??=` and spread-in-arrays
 * are 7.4 and fine.
 *
 * ---------------------------------------------------------------------------
 *
 * Why this exists. `/contacts/` (page 529) listed its regions as **50
 * hand-written `wp:details` blocks**, each one retyping a branch's legal name,
 * its coordinator, a phone, an e-mail and a link — all of which the region's own
 * page already holds, and holds in the card `od_pages_branch_card()` wrote there
 * (D4). Two copies of one fact means the index goes stale silently: at the time
 * this replaced it, **25 of the 74 published `/contacts/<region>/` pages had no
 * spoiler at all**, three of the 49 that did linked to `общее-дело.рф` rather
 * than to this site, and nobody could tell from the admin. A new region now
 * appears on the index by being published, and an edit to a branch's card shows
 * up in both places at once.
 *
 * Why a shortcode rather than a `core/query` loop, which is how every other
 * repeated thing on this site is drawn. A query loop can list the children and
 * bind a title — but the design is a **disclosure**, and core has no accordion
 * block. `core/details` is the block that renders one, and it is not usable in a
 * loop: its `summary` is
 * `{"type":"rich-text","source":"rich-text","selector":"summary"}` with no
 * `"role":"content"`, so the Block Bindings API will not bind it — and core's
 * only binding sources are `core/post-meta` and `core/pattern-overrides`
 * anyway, neither of which can produce a post title or a permalink. There is no
 * ladder rung between «a class and some CSS» and this.
 *
 * What it is *not*: a second source of truth. Everything rendered below is read
 * out of a page — the title, the permalink and the card — and the only strings
 * this file owns are the CSS class names and the link's label.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * The one regional page that is not a child of `/contacts/`. Addressed by
 * **path, not id**: ids differ between od-dev and production (the house rule
 * `od-pages.php` and `od-wp.php` both follow), while this path is public and
 * cannot change — it is the page's live URL and the reason it was never
 * re-parented.
 */
const OD_REGIONS_EXTRA_PATH = 'khabarovskiy';

/** The class `od_pages_branch_card()` puts on the card this lifts. */
const OD_REGIONS_CARD_CLASS = 'od-branch';

/** The link under each card. Figma `contact` (`754:587`). */
const OD_REGIONS_LINK_LABEL = 'Страница отделения';

add_action('init', 'od_regions_register');

function od_regions_register()
{
    add_shortcode('od_regions', 'od_regions_shortcode');
}

/**
 * `[od_regions]` — the accordion for the page the shortcode sits on.
 *
 * The parent is the current post rather than a path or an id, so the file holds
 * neither: on any environment it lists the children of whatever page carries the
 * shortcode. Inside a REST render that is the page being fetched, because
 * `WP_REST_Posts_Controller::prepare_item_for_response()` calls
 * `setup_postdata()` before running `the_content` filters.
 *
 * @param array|string $atts Unused; the shortcode takes none.
 * @return string
 */
function od_regions_shortcode($atts = [])
{
    return od_regions_html(od_regions_records((int) get_the_ID()));
}

/**
 * One record per region, in the order the accordion draws them.
 *
 * `menu_order` then title, which is what puts «Центральный Аппарат» first —
 * `/contacts/moscow/` carries `menu_order = -1`, written by
 * `od_wp_page_order()` in `wp/scripts/od-wp.php`. Every other page is 0 and so
 * sorts by title.
 *
 * @param int $parentId The page the shortcode is on.
 * @return array<int, array{title: string, permalink: string, card: string}>
 */
function od_regions_records($parentId)
{
    if ($parentId <= 0) {
        return [];
    }

    $pages = get_posts([
        'post_type' => 'page',
        'post_status' => 'publish',
        'post_parent' => $parentId,
        'numberposts' => -1,
        'orderby' => 'menu_order title',
        'order' => 'ASC',
        'suppress_filters' => false,
    ]);

    $extra = get_page_by_path(OD_REGIONS_EXTRA_PATH, OBJECT, 'page');
    if ($extra && $extra->post_status === 'publish') {
        $pages = od_regions_insert($pages, $extra);
    }

    $records = [];
    foreach ($pages as $page) {
        $records[] = [
            'title' => get_the_title($page),
            'permalink' => (string) get_permalink($page),
            'card' => od_regions_card($page->post_content),
        ];
    }

    return $records;
}

/**
 * Хабаровский край put where the alphabet has it, rather than after the last
 * child of `/contacts/`.
 *
 * A page that is *already* in the list is left alone rather than inserted
 * twice: the extra page is found by path, and on an install where it is also a
 * child of the index the two sources overlap.
 *
 * The list arrives ordered by the database, `menu_order` then title under
 * MySQL's own collation, and **stays that way**: this walks it for the first row
 * the extra page sorts before and splices it in there. Re-sorting the whole
 * array in PHP would compare the other 75 titles byte by byte, which is not the
 * comparison the query made — a page that only needs to be inserted is not a
 * reason to re-order the pages that were already right.
 *
 * @param array<int, WP_Post> $pages Children of the index, in the query's order.
 * @param WP_Post             $extra The page to insert.
 * @return array<int, WP_Post>
 */
function od_regions_insert(array $pages, $extra)
{
    // Already there: `/contacts/khabarovskiy/` is looked up by path *and* is a
    // child of the index on some installs, and the union of the two had no
    // membership check — the accordion then drew two «Хабаровский край»
    // disclosures (WP-10).
    foreach ($pages as $page) {
        $sameId = isset($page->ID, $extra->ID) && (int) $page->ID === (int) $extra->ID;
        if ($sameId || $page->post_name === $extra->post_name) {
            return $pages;
        }
    }

    $index = count($pages);

    foreach ($pages as $position => $page) {
        $order = (int) $page->menu_order - (int) $extra->menu_order;

        if ($order > 0 || ($order === 0 && strcmp($page->post_title, $extra->post_title) > 0)) {
            $index = $position;
            break;
        }
    }

    array_splice($pages, $index, 0, [$extra]);

    return $pages;
}

/**
 * The `od-branch` card out of a region's body, rendered.
 *
 * `parse_blocks()` + `render_block()` rather than a regex over the HTML: the
 * card is a `core/group`, the class is in the block's attributes (where it is
 * JSON, `-`-escaped and not always in the rendered `<div>`), and the
 * `.wp-block-group__inner-container` the D4 styling keys on is added at *render*
 * time by core's layout support, not stored in `post_content`.
 *
 * Returns `''` for a page with no card — `/contacts/sverdlovskaya/`, the one
 * region that never had an «Об отделении» accordion for D4 to convert. Its
 * disclosure is a summary and a link, which is the truth about that page.
 *
 * @param string $content A region page's `post_content`.
 * @return string Rendered HTML, or `''`.
 */
function od_regions_card($content)
{
    $card = od_regions_find_card(parse_blocks($content));

    return $card === null ? '' : render_block($card);
}

/**
 * Depth-first search for the first block carrying {@see OD_REGIONS_CARD_CLASS}.
 * The card is nested inside the migrator's `group > columns > column` wrapper, so
 * a scan of the top level would miss it.
 *
 * @param array<int, array> $blocks
 * @return array|null
 */
function od_regions_find_card(array $blocks)
{
    foreach ($blocks as $block) {
        if (od_regions_has_class($block, OD_REGIONS_CARD_CLASS)) {
            return $block;
        }

        if (!empty($block['innerBlocks'])) {
            $found = od_regions_find_card($block['innerBlocks']);
            if ($found !== null) {
                return $found;
            }
        }
    }

    return null;
}

/**
 * Whether a parsed block declares `$class`. Compared as a whole token, not as a
 * substring — the same reason `od_has_block_class()` in `od-pages.php` does:
 * every body ever written contains «od-branch» as a substring of nothing, but a
 * substring test on a class list matches prefixes.
 *
 * @param array  $block
 * @param string $class
 * @return bool
 */
function od_regions_has_class(array $block, $class)
{
    $className = isset($block['attrs']['className']) ? (string) $block['attrs']['className'] : '';

    return in_array($class, preg_split('~\s+~', trim($className)), true);
}

/**
 * The accordion's HTML. **Pure** — an array of records in, a string out, no
 * WordPress lookups — which is what `wp/tests/od-regions.test.php` calls.
 *
 * A native `<details>` per region: no script, no state, and the summary is a
 * real one, so keyboard and find-in-page work without anything from us. Every
 * item renders **closed** — the one open item in the Figma frame is the designer
 * showing the expanded state, not a default.
 *
 * `card` is already-rendered block HTML and is the one value not escaped here;
 * it comes from `render_block()`, which is WordPress's own output for content an
 * editor with `unfiltered_html` wrote. Everything else is a database string and
 * goes through `esc_html()` / `esc_url()`.
 *
 * @param array<int, array{title: string, permalink: string, card: string}> $regions
 * @return string
 */
function od_regions_html(array $regions)
{
    if ($regions === []) {
        return '';
    }

    $items = '';
    foreach ($regions as $region) {
        $items .= sprintf(
            '<details class="wp-block-details od-region"><summary>%s</summary>'
                . '<div class="od-region__body">%s'
                . '<a class="wp-block-button__link wp-element-button od-region__link" href="%s">%s</a>'
                . '</div></details>',
            esc_html($region['title']),
            $region['card'],
            esc_url($region['permalink']),
            esc_html(OD_REGIONS_LINK_LABEL)
        );
    }

    return '<div class="od-regions">' . $items . '</div>';
}
