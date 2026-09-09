<?php
/**
 * Plugin Name: OD — the /sitemap/ page listing
 * Description: `[od_sitemap]` lists every published page, grouped by section,
 *              replacing the `page-list` plugin's `[pagelist]`.
 *
 * Install at `wp-content/mu-plugins/od-sitemap.php`. The canonical copy is
 * `wp/mu-plugins/od-sitemap.php` in the frontend repo — edit there, `scp` here.
 *
 * **PHP 7.4 syntax only**, for the reason `od-regions.php` states at length: an
 * mu-plugin loads on every site request, and od-dev serves the site on
 * `apache2handler` PHP 7.4.33. No `str_contains`, no `match`, no `?->`.
 *
 * ---------------------------------------------------------------------------
 *
 * Why this exists. `/sitemap/` (a page in the footer's «Ссылки» column) held
 * `[pagelist exclude="22241,22242" offset="5"]` — a shortcode from the
 * `page-list` plugin, which the headless install does not have and will not
 * get. An unregistered shortcode is not removed by WordPress, it is **printed**,
 * so the page rendered the text `[pagelist exclude=»22241,22242″ offset=»5″]`
 * and nothing else. Reported on the demo, 2026-08-27.
 *
 * Why a shortcode rather than a route in the frontend, which was the first
 * attempt: `app/sitemap.ts` already owns `/sitemap.xml`, and Next 16 refuses a
 * `page` and a metadata route on the same segment — «Conflicting page and
 * metadata at /sitemap». Renaming the XML sitemap to free the segment would put
 * the SEO-critical file at risk for a page nobody links from search. This keeps
 * `/sitemap/` a WordPress page, which is also what lets an editor put a
 * paragraph above the list.
 *
 * Why not a `core/query` loop, the same question `od-regions.php` answers: a
 * loop can list pages, but not *group* them under the section they belong to,
 * and there is no block that does.
 *
 * What it is not: a second source of truth. Every title, URL and grouping below
 * is read out of the page tree at render time, so a page published tomorrow is
 * on the map with no edit anywhere.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Paths this list never offers, because the frontend answers them with a 301 —
 * a redirect in a site map is a dead end presented as an address.
 *
 * Matched against the page's path. `video/short` is the whole list today
 * (`src/shared/config/legacyRedirects.ts`); it is here rather than derived
 * because WordPress cannot read the frontend's table, and it is one string.
 */
const OD_SITEMAP_REDIRECTED = ['video/short'];

/** The page this list is on, which must not list itself. */
const OD_SITEMAP_SELF = 'sitemap';

add_action('init', 'od_sitemap_register');

function od_sitemap_register()
{
    add_shortcode('od_sitemap', 'od_sitemap_shortcode');
}

/**
 * `[od_sitemap]` — the whole published page tree, in two levels.
 *
 * @param array|string $atts Unused; the shortcode takes none.
 * @return string
 */
function od_sitemap_shortcode($atts = [])
{
    return od_sitemap_html(od_sitemap_sections(od_sitemap_pages()));
}

/**
 * Every published page as `['path' => …, 'title' => …]`, ordered by title.
 *
 * `post_status => publish` only: a draft has no address, and drafting a page is
 * how `od_wp_draft_empty_branches()` and `od_wp_merge_duplicate_branches()`
 * retire one — a map that listed drafts would undo both.
 *
 * @return array<int, array{path: string, title: string}>
 */
function od_sitemap_pages()
{
    $pages = get_posts([
        'post_type' => 'page',
        'post_status' => 'publish',
        'numberposts' => -1,
        'orderby' => 'title',
        'order' => 'ASC',
        'suppress_filters' => false,
    ]);

    $rows = [];

    foreach ($pages as $page) {
        $path = trim((string) wp_parse_url((string) get_permalink($page), PHP_URL_PATH), '/');

        if ($path === '' || $path === OD_SITEMAP_SELF || in_array($path, OD_SITEMAP_REDIRECTED, true)) {
            continue;
        }

        $title = trim(get_the_title($page));
        if ($title === '') {
            continue;
        }

        $rows[] = ['path' => rawurldecode($path), 'title' => $title];
    }

    return $rows;
}

/**
 * The rows grouped by their first path segment. **Pure** — rows in, sections
 * out, no WordPress lookups — which is what `wp/tests/od-sitemap.test.php`
 * calls.
 *
 * Grouped by path rather than by `post_parent`, because the path is what a
 * visitor navigates: `/contacts/khabarovskiy/` is the one regional page that is
 * not a child of `/contacts/` (see `od-regions.php`), and by path it lands
 * where a reader expects it anyway.
 *
 * A section's own page becomes its heading — `/about/` is «О нас» — and a tree
 * with no index page keeps the segment as its heading, which is honest about
 * there being nothing to link. Sections are ordered by heading, and within a
 * section the rows keep the query's title order.
 *
 * @param array<int, array{path: string, title: string}> $rows
 * @return array<int, array{segment: string, title: string, href: string, children: array}>
 */
function od_sitemap_sections(array $rows)
{
    $sections = [];

    foreach ($rows as $row) {
        $segments = explode('/', $row['path']);
        $segment = $segments[0];

        if (!isset($sections[$segment])) {
            $sections[$segment] = ['segment' => $segment, 'title' => $segment, 'href' => '', 'children' => []];
        }

        if (count($segments) === 1) {
            $sections[$segment]['title'] = $row['title'];
            $sections[$segment]['href'] = '/' . $row['path'] . '/';
            continue;
        }

        $sections[$segment]['children'][] = ['path' => '/' . $row['path'] . '/', 'title' => $row['title']];
    }

    // `strcoll` under the site's locale, not `strcmp`: the headings are Russian,
    // and a byte comparison puts «Я» before «а».
    uasort($sections, static function (array $a, array $b) {
        return strcoll($a['title'], $b['title']);
    });

    return array_values($sections);
}

/**
 * The list's HTML. **Pure**, and every string escaped — these are database
 * values, and unlike `od-regions.php` there is no rendered block among them.
 *
 * Plain `core`-shaped markup (`wp-block-heading`, `wp-block-list`) so the
 * frontend's Gutenberg stylesheet draws it like any other page body; the
 * `od-sitemap*` classes are there for a future refinement, not because
 * anything styles them today.
 *
 * @param array<int, array{segment: string, title: string, href: string, children: array}> $sections
 * @return string
 */
function od_sitemap_html(array $sections)
{
    if ($sections === []) {
        return '';
    }

    $out = '';

    foreach ($sections as $section) {
        $heading = esc_html($section['title']);
        $out .= sprintf(
            '<h2 class="wp-block-heading od-sitemap__section">%s</h2>',
            $section['href'] === ''
                ? $heading
                : sprintf('<a href="%s">%s</a>', esc_url($section['href']), $heading)
        );

        if ($section['children'] === []) {
            continue;
        }

        $items = '';
        foreach ($section['children'] as $child) {
            $items .= sprintf(
                '<li><a href="%s">%s</a></li>',
                esc_url($child['path']),
                esc_html($child['title'])
            );
        }

        $out .= '<ul class="wp-block-list od-sitemap__list">' . $items . '</ul>';
    }

    return '<div class="od-sitemap">' . $out . '</div>';
}
