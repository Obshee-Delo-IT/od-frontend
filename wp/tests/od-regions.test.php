<?php
/**
 * Tests for `wp/mu-plugins/od-regions.php` — the `[od_regions]` accordion.
 *
 *     php wp/tests/od-regions.test.php
 *
 * WordPress is not loaded. `ABSPATH` plus stubs for the eight functions the file
 * calls are enough, the same trick `od-revalidate.test.php` uses: what matters
 * is the HTML the builder emits and which block it decides is the card, and
 * neither needs a database.
 *
 * Why this file exists: the accordion is now the *only* place 75 regions are
 * listed, so a wrong selector here does not look like a bug — it looks like a
 * region that has no coordinator. The three failure modes it guards are a card
 * that stops being found (silently empty spoilers), the link losing its
 * permalink (a dead «Страница отделения» on every item), and an unescaped title.
 *
 * @package od-frontend
 */

declare(strict_types=1);

require __DIR__ . '/harness.php';

define('ABSPATH', __DIR__);
define('OBJECT', 'OBJECT');

/** Captured `get_posts()` arguments — the orderby is load-bearing, see below. */
$GLOBALS['od_get_posts_args'] = [];

function add_action(string $hook, $callback, int $priority = 10, int $args = 1): bool
{
    return true;
}

function add_shortcode(string $tag, $callback): bool
{
    return true;
}

/** WordPress's own escapers, near enough for what this file passes them. */
function esc_html(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function esc_url(string $url): string
{
    return htmlspecialchars(str_replace(' ', '%20', $url), ENT_QUOTES, 'UTF-8');
}

function get_posts(array $args): array
{
    $GLOBALS['od_get_posts_args'] = $args;

    return $GLOBALS['od_pages_table'] ?? [];
}

function get_page_by_path(string $path, string $output = 'OBJECT', string $type = 'page')
{
    return $GLOBALS['od_extra_page'] ?? null;
}

function get_the_title($post): string
{
    return $post->post_title;
}

function get_permalink($post): string
{
    return 'https://od-dev.tmweb.ru/contacts/' . $post->post_name . '/';
}

/** `od_regions_card()` is handed the body; the parse is WordPress's job. */
function parse_blocks(string $content): array
{
    return $GLOBALS['od_parsed'][$content] ?? [];
}

function render_block(array $block): string
{
    return '<div class="wp-block-group ' . $block['attrs']['className'] . '">CARD</div>';
}

/** The five fields `od_regions_records()` reads off a page. */
class WP_Post
{
    public $post_title;

    public $post_name;

    public $post_status;

    public $post_content;

    public $menu_order;

    public function __construct(
        string $title,
        string $name,
        string $status = 'publish',
        string $content = '',
        int $menuOrder = 0
    ) {
        $this->post_title   = $title;
        $this->post_name    = $name;
        $this->post_status  = $status;
        $this->post_content = $content;
        $this->menu_order   = $menuOrder;
    }
}

require __DIR__ . '/../mu-plugins/od-regions.php';

// -- the builder, which is the pure half -------------------------------------

$regions = [
    [
        'title' => 'Центральный Аппарат',
        'permalink' => 'https://od-dev.tmweb.ru/contacts/moscow/',
        'card' => '<div class="wp-block-group od-branch">CARD</div>',
    ],
    [
        'title' => 'Амурская область',
        'permalink' => 'https://od-dev.tmweb.ru/contacts/amurskaya/',
        'card' => '<div class="wp-block-group od-branch">AMUR</div>',
    ],
];

$html = od_regions_html($regions);

od_test('one wrapper for the whole accordion', 1 === substr_count($html, '<div class="od-regions">'));
od_test('one native disclosure per region', 2 === substr_count($html, '<details class="wp-block-details od-region">'));
od_test('each carries a real <summary>', 2 === substr_count($html, '<summary>'));
od_test('the summary is the page title', false !== strpos($html, '<summary>Амурская область</summary>'));
od_test('nothing renders open — the Figma frame shows a state, not a default', false === strpos($html, '<details open'));
od_test('the card is embedded as rendered', false !== strpos($html, '<div class="wp-block-group od-branch">AMUR</div>'));
od_test('the card sits inside the disclosure body', false !== strpos($html, '<div class="od-region__body"><div class="wp-block-group od-branch">AMUR</div>'));
od_test(
    'and «Страница отделения» links to the region\'s own page',
    false !== strpos(
        $html,
        '<a class="wp-block-button__link wp-element-button od-region__link"'
            . ' href="https://od-dev.tmweb.ru/contacts/amurskaya/">Страница отделения</a>'
    )
);
od_test('the link is a filled core button, so gutenberg.css already styles it', 2 === substr_count($html, 'wp-block-button__link wp-element-button'));

// «Центральный Аппарат» is first in the mock and last alphabetically, which is
// why `/contacts/moscow/` carries `menu_order = -1`. The builder's contract is
// that it does not reorder what it is handed.
od_test(
    'the builder preserves the order it is given — the central office first',
    strpos($html, 'Центральный Аппарат') < strpos($html, 'Амурская область')
);

od_test('an empty list renders nothing at all, not an empty wrapper', '' === od_regions_html([]));

// -- a region with no card: `/contacts/sverdlovskaya/` -----------------------

$bare = od_regions_html([
    ['title' => 'Свердловская область и УрФО', 'permalink' => 'https://od-dev.tmweb.ru/contacts/sverdlovskaya/', 'card' => ''],
]);

od_test('a region with no card still renders its disclosure', 1 === substr_count($bare, '<details class="wp-block-details od-region">'));
od_test('with its summary', false !== strpos($bare, '<summary>Свердловская область и УрФО</summary>'));
od_test('and its link', false !== strpos($bare, 'href="https://od-dev.tmweb.ru/contacts/sverdlovskaya/"'));
od_test('and no empty card in front of it', false !== strpos($bare, '<div class="od-region__body"><a class="wp-block-button__link'));

// -- escaping ----------------------------------------------------------------

$nasty = od_regions_html([
    ['title' => 'Крым & «Севастополь» <script>', 'permalink' => 'https://od-dev.tmweb.ru/contacts/"onmouseover="x/', 'card' => ''],
]);

od_test('a title is escaped', false !== strpos($nasty, 'Крым &amp; «Севастополь» &lt;script&gt;'));
od_test('and cannot open a tag', false === strpos($nasty, '<script>'));
od_test('a permalink is escaped, so a quote cannot break out of the attribute', false === strpos($nasty, '"onmouseover="'));

// -- finding the card in a parsed body ---------------------------------------

/** The shape `parse_blocks()` returns for the migrator's wrapper around a card. */
$nested = [
    [
        'blockName' => 'core/group',
        'attrs' => ['layout' => ['type' => 'constrained']],
        'innerBlocks' => [
            [
                'blockName' => 'core/columns',
                'attrs' => [],
                'innerBlocks' => [
                    [
                        'blockName' => 'core/column',
                        'attrs' => ['width' => '100%'],
                        'innerBlocks' => [
                            [
                                'blockName' => 'core/group',
                                'attrs' => ['className' => 'od-branch', 'layout' => ['type' => 'constrained']],
                                'innerBlocks' => [],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ],
    [
        'blockName' => 'core/query',
        'attrs' => ['className' => 'od-news-cards'],
        'innerBlocks' => [],
    ],
];

$found = od_regions_find_card($nested);
od_test('the card is found three levels down, inside the migrator\'s wrapper', $found !== null);
od_test('and it is the group, not the wrapper', 'od-branch' === $found['attrs']['className']);
od_test('a body with no such block gives null', null === od_regions_find_card([$nested[1]]));
od_test('and an empty body too', null === od_regions_find_card([]));

od_test('the class is matched as a whole token, not a substring', !od_regions_has_class(['attrs' => ['className' => 'od-branches']], 'od-branch'));
od_test('one class among several still matches', od_regions_has_class(['attrs' => ['className' => 'is-style-x od-branch']], 'od-branch'));
od_test('a block with no className does not match', !od_regions_has_class(['attrs' => []], 'od-branch'));
od_test('nor one with an empty className', !od_regions_has_class(['attrs' => ['className' => '']], 'od-branch'));

$GLOBALS['od_parsed'] = ['<!-- nested -->' => $nested, '<!-- bare -->' => []];
od_test('a body with a card renders it', '<div class="wp-block-group od-branch">CARD</div>' === od_regions_card('<!-- nested -->'));
od_test('a body without one renders nothing', '' === od_regions_card('<!-- bare -->'));

// -- the records, over the stubbed page table --------------------------------

$GLOBALS['od_pages_table'] = [new WP_Post('Амурская область', 'amurskaya', 'publish', '<!-- nested -->')];
$GLOBALS['od_extra_page'] = new WP_Post('Хабаровский край', 'khabarovskiy', 'publish', '<!-- bare -->');

$records = od_regions_records(529);
od_test('the children plus the one page outside the tree', 2 === count($records));
od_test('and that one takes its alphabetical place', 'Хабаровский край' === $records[1]['title']);
od_test('each record carries the permalink', 'https://od-dev.tmweb.ru/contacts/amurskaya/' === $records[0]['permalink']);
od_test('and the card lifted out of its own body', '<div class="wp-block-group od-branch">CARD</div>' === $records[0]['card']);
od_test('a body with no card gives an empty one, not a warning', '' === $records[1]['card']);

// A typo here alphabetises the whole accordion and buries «Центральный Аппарат»
// at the bottom, which is exactly the failure `menu_order = -1` is there to fix.
od_test('ordered by menu_order first, then title', 'menu_order title' === $GLOBALS['od_get_posts_args']['orderby']);
od_test('published children only', 'publish' === $GLOBALS['od_get_posts_args']['post_status']);
od_test('all of them, not a page of them', -1 === $GLOBALS['od_get_posts_args']['numberposts']);
od_test('children of the page the shortcode is on', 529 === $GLOBALS['od_get_posts_args']['post_parent']);

$GLOBALS['od_extra_page'] = new WP_Post('Хабаровский край', 'khabarovskiy', 'draft');
od_test('an unpublished page outside the tree is left out', 1 === count(od_regions_records(529)));

od_test('no post in scope renders nothing rather than every page on the site', [] === od_regions_records(0));

// -- where Хабаровский край lands --------------------------------------------
//
// It is the one page the query cannot return, so it is spliced in — and the
// alphabet is the whole reason the accordion is readable. Appending it would put
// it after «Ярославская», three screens past where a visitor looks for it.

$titles = static function (array $pages): array {
    return array_map(static function (WP_Post $page): string {
        return $page->post_title;
    }, $pages);
};

$khabarovsk = new WP_Post('Хабаровский край', 'khabarovskiy');
$children   = [
    new WP_Post('Центральный Аппарат', 'moscow', 'publish', '', -1),
    new WP_Post('Ульяновская область', 'uliyanovskaya'),
    new WP_Post('Ханты-Мансийский АО', 'hanty-mansiyskiy-ao'),
    new WP_Post('Ярославская область', 'yaroslavskaya'),
];

od_test(
    'inserted where the alphabet has it, not at the end',
    ['Центральный Аппарат', 'Ульяновская область', 'Хабаровский край', 'Ханты-Мансийский АО', 'Ярославская область']
        === $titles(od_regions_insert($children, $khabarovsk))
);

// `menu_order` outranks the title, or «Центральный Аппарат» stops being first.
od_test(
    'a negative menu_order still comes before it',
    'Центральный Аппарат' === $titles(od_regions_insert($children, $khabarovsk))[0]
);

od_test(
    'first of all when nothing sorts before it',
    ['Хабаровский край', 'Ярославская область']
        === $titles(od_regions_insert([new WP_Post('Ярославская область', 'yaroslavskaya')], $khabarovsk))
);

od_test('and the only one when there are no children', ['Хабаровский край'] === $titles(od_regions_insert([], $khabarovsk)));

od_test_summary();
