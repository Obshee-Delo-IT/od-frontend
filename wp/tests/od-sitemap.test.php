<?php
/**
 * Tests for `wp/mu-plugins/od-sitemap.php` — the `[od_sitemap]` page listing.
 *
 *     php wp/tests/od-sitemap.test.php
 *
 * WordPress is not loaded: `ABSPATH` plus the three escapers and `add_*` hooks
 * the file calls, the same trick `od-regions.test.php` uses. The two functions
 * under test — grouping and HTML — are pure by construction, which is why the
 * lookup half is a one-liner in the plugin and not tested here.
 *
 * What this guards: a heading that stops linking its section (the whole tree
 * becomes unnavigable text), an unescaped title, and the ordering — a site map
 * sorted by byte value puts «Я» before «а», which reads as a random list.
 *
 * @package od-frontend
 */

declare(strict_types=1);

require __DIR__ . '/harness.php';

define('ABSPATH', __DIR__);

function add_action(string $hook, $callback, int $priority = 10, int $args = 1): bool
{
    return true;
}

function add_shortcode(string $tag, $callback): bool
{
    return true;
}

function esc_html(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function esc_url(string $url): string
{
    return htmlspecialchars(str_replace(' ', '%20', $url), ENT_QUOTES, 'UTF-8');
}

require __DIR__ . '/../mu-plugins/od-sitemap.php';

// -- grouping ----------------------------------------------------------------

$rows = [
    ['path' => 'about', 'title' => 'О нас'],
    ['path' => 'about/ustav', 'title' => 'Устав'],
    ['path' => 'about/reviews', 'title' => 'Письма и отзывы'],
    ['path' => 'materials/books', 'title' => 'Наши книги'],
    ['path' => 'faq', 'title' => 'Частые вопросы'],
];

$sections = od_sitemap_sections($rows);

od_test('one section per first path segment', count($sections) === 3);

$by = [];
foreach ($sections as $section) {
    $by[$section['segment']] = $section;
}

od_test('a section is titled by its own page', $by['about']['title'] === 'О нас' && $by['about']['href'] === '/about/');
od_test('…and holds the pages under it', count($by['about']['children']) === 2);
od_test('a childless section is still listed', $by['faq']['children'] === [] && $by['faq']['href'] === '/faq/');
/* `/materials/` has no index page of its own on production, and a section with
   no heading link must not silently swallow its children. */
od_test('a section with no index page keeps the segment as its heading', $by['materials']['title'] === 'materials');
od_test('…and no href to a page that does not exist', $by['materials']['href'] === '');
od_test('…but still lists what is under it', count($by['materials']['children']) === 1);

/* Ordering is by heading under the site's collation. Byte order would put
   «Частые вопросы» before «О нас» and «Наши книги». */
$titles = array_map(static function (array $section) {
    return $section['title'];
}, $sections);
$expected = $titles;
usort($expected, 'strcoll');
od_test('sections are ordered by heading, not by byte value', $titles === $expected);

/* Within a section the query's title order survives — the grouping must not
   re-sort what the database already ordered. */
od_test(
    'children keep the order they arrived in',
    array_column($by['about']['children'], 'title') === ['Устав', 'Письма и отзывы']
);

// -- the HTML ----------------------------------------------------------------

$html = od_sitemap_html($sections);

od_test('every section is a heading', substr_count($html, 'wp-block-heading') === 3);
od_test('a section with a page links it', strpos($html, '<a href="/about/">О нас</a>') !== false);
od_test('a section without one does not', strpos($html, '>materials</a>') === false);
od_test('a child is a list item with its path', strpos($html, '<li><a href="/about/ustav/">Устав</a></li>') !== false);
od_test('the list uses core\'s own class, so the page styles it like any other', strpos($html, 'wp-block-list') !== false);
od_test('an empty tree renders nothing at all', od_sitemap_html([]) === '');

/* Titles are database strings: an editor with `unfiltered_html` can put a tag
   in one, and this list is rendered inside a page body. */
$escaped = od_sitemap_html(od_sitemap_sections([
    ['path' => 'x', 'title' => '<script>alert(1)</script>'],
    ['path' => 'x/y', 'title' => 'Ампер & Ом'],
]));
od_test('a title is escaped', strpos($escaped, '<script>') === false);
od_test('…entities included', strpos($escaped, 'Ампер &amp; Ом') !== false);

/* The redirect list and the self-exclusion are the plugin's, not the frontend's:
   `/video/short/` 301s to `/video/`, so offering it here is a dead end. */
od_test('the redirected paths are named, and `video/short` is one', in_array('video/short', OD_SITEMAP_REDIRECTED, true));
od_test('the page excludes itself by slug', OD_SITEMAP_SELF === 'sitemap');

od_test_summary();
