<?php
/**
 * Tests for the pure transforms in `wp/scripts/od-pages.php`.
 *
 *   php wp/tests/od-pages.test.php
 *
 * No PHPUnit and no composer — the point is that a transform is a string in and a
 * string out, so proving it needs neither WordPress nor a test framework.
 * Requiring the script is safe: its runner is behind a `WP_CLI` guard.
 *
 * `od_test()` from `harness.php`, never PHP's own `assert()` — that one is
 * compiled out here; the helper's header says why.
 *
 * Fixtures in `fixtures/` are **real `post_content`**, captured from od-dev
 * 2026-08-17 with `wp post get <id> --field=post_content`. Recapture them rather
 * than editing them by hand.
 *
 * Every transform gets the idempotency case, `f(f(x)) === f(x)`: this script is
 * run again on every environment, and possibly after an editor has been in the
 * same page.
 *
 * @package od-frontend
 */

require_once __DIR__ . '/harness.php';
require_once __DIR__ . '/../scripts/od-pages.php';

$page    = file_get_contents( __DIR__ . '/fixtures/page-metodichki.html' );
$profile = file_get_contents( __DIR__ . '/fixtures/profile-ryazanov.html' );

/* ---------------------------------------------------------------- od_attr */

od_test( 'od_attr escapes quotes', od_attr( 'a "b" \'c\'' ) === 'a &quot;b&quot; &#039;c&#039;' );
od_test( 'od_attr leaves an existing entity alone', od_attr( '&laquo;Общее дело&raquo;' ) === '&laquo;Общее дело&raquo;' );

/* ------------------------------------------ od_drop_empty_layout_groups */

od_test( 'the fixture really has two empty spacer groups', 4 === substr_count( $page, '<!-- wp:group' ) );

$dropped = od_drop_empty_layout_groups( $page );
od_test( 'drops both empty groups, keeps the two with content', 2 === substr_count( $dropped, '<!-- wp:group' ) );
od_test( 'keeps every column that has children', 3 === substr_count( $dropped, '{"width":"33.33%"}' ) );
od_test( 'keeps the full-width column that holds the accordion', str_contains( $dropped, '<!-- wp:details' ) );
od_test_idempotent( 'od_drop_empty_layout_groups', 'od_drop_empty_layout_groups', $page );

od_test(
	'a group whose column has content is never dropped',
	od_drop_empty_layout_groups(
		'<!-- wp:group --><div class="wp-block-group"><!-- wp:columns --><div class="wp-block-columns">'
		. '<!-- wp:column --><div class="wp-block-column"><p>текст</p></div><!-- /wp:column -->'
		. '</div><!-- /wp:columns --></div><!-- /wp:group -->'
	) !== ''
);

/* ------------------------------------------- od_class_on_first_columns */

$classed = od_class_on_first_columns( $dropped, 'od-covers' );
od_test( 'writes the class into the block attributes', str_contains( $classed, '{"className":"od-covers"}' ) );
od_test( 'and onto the rendered div, as the editor would', str_contains( $classed, 'class="wp-block-columns od-covers"' ) );
// Twice, and only twice: once in the attributes, once in the class list. The
// fixture has a second `wp:columns` (the accordion's) that must not get it.
od_test( 'only the first columns block gets it', 2 === substr_count( $classed, 'od-covers' ) );
od_test_idempotent( 'od_class_on_first_columns', static fn( string $c ): string => od_class_on_first_columns( $c, 'od-covers' ), $dropped );

od_test(
	'merges into attributes the block already has, rather than replacing them',
	str_contains(
		od_class_on_first_columns( '<!-- wp:columns {"verticalAlignment":"top"} --><div class="wp-block-columns">', 'x' ),
		'"verticalAlignment":"top"'
	)
);
od_test(
	'appends to a className the block already has',
	str_contains(
		od_class_on_first_columns( '<!-- wp:columns {"className":"a"} --><div class="wp-block-columns a">', 'b' ),
		'"className":"a b"'
	)
);
od_test(
	'the already-applied check compares whole class names — every body contains the letter b',
	! od_has_block_class( '<!-- wp:columns --><div class="wp-block-columns">', 'b' )
);
od_test(
	'…and does find a real one',
	od_has_block_class( '<!-- wp:columns {"className":"od-covers is-x"} -->', 'od-covers' )
);

/* ----------------------------------------- od_headings_into_image_alt */

$alted = od_headings_into_image_alt( $classed );
od_test( 'all three cover headings are gone', 0 === substr_count( $alted, '<!-- wp:heading' ) );
od_test( 'the first poster carries its heading as alt, site name stripped', str_contains( $alted, 'alt="Здоровая Россия"' ) );
od_test( 'the second too', str_contains( $alted, 'alt="Здоровые дети"' ) );
od_test( 'the third too', str_contains( $alted, 'alt="Здоровая молодежь"' ) );
od_test( 'the migrator alt is replaced, not joined', ! str_contains( $alted, 'metodichka-mult' ) );
od_test( 'one alt per image, still three images', 3 === substr_count( $alted, '<img' ) && 3 === substr_count( $alted, ' alt=' ) );
od_test( 'the pictures and their links survive', 3 === substr_count( $alted, 'wp-block-button__link' ) );
od_test_idempotent( 'od_headings_into_image_alt', 'od_headings_into_image_alt', $classed );

od_test(
	'a heading with no picture under it is left alone',
	str_contains(
		od_headings_into_image_alt(
			'<!-- wp:heading --><h2 class="wp-block-heading">Раздел</h2><!-- /wp:heading -->'
			. '<!-- wp:paragraph --><p>просто текст</p><!-- /wp:paragraph -->'
		),
		'<h2 class="wp-block-heading">Раздел</h2>'
	)
);
od_test(
	'…and does not reach across a paragraph to claim the next column\'s picture',
	str_contains(
		od_headings_into_image_alt(
			'<!-- wp:heading --><h2>Раздел</h2><!-- /wp:heading -->'
			. '<!-- wp:paragraph --><p>текст</p><!-- /wp:paragraph -->'
			. '<!-- wp:paragraph --><p><img src="/a.jpg" alt="старый" /></p><!-- /wp:paragraph -->'
		),
		'alt="старый"'
	)
);
od_test(
	'markup inside the heading is flattened, not carried into the attribute',
	str_contains(
		od_headings_into_image_alt(
			'<!-- wp:heading --><h2><strong>Здоровая</strong> Россия</h2><!-- /wp:heading -->'
			. '<!-- wp:paragraph --><p><img src="/a.jpg" /></p><!-- /wp:paragraph -->'
		),
		'alt="Здоровая Россия"'
	)
);

/* ------------------------------------------- od_cover_link_names */

$named = od_cover_link_names( $alted );
od_test( 'each poster link leaves the tab order', 3 === substr_count( $named, '<a tabindex="-1" aria-hidden="true"' ) );
od_test(
	'each button is named after its cover',
	str_contains( $named, 'aria-label="Подробнее: Здоровая Россия"' )
	&& str_contains( $named, 'aria-label="Подробнее: Здоровые дети"' )
	&& str_contains( $named, 'aria-label="Подробнее: Здоровая молодежь"' )
);
od_test( 'and no other link is touched', 3 === substr_count( $named, 'aria-label=' ) && 3 === substr_count( $named, 'tabindex=' ) );
od_test( 'the posters still link where they linked', substr_count( $named, 'metodic.obshee-delo.ru' ) === substr_count( $alted, 'metodic.obshee-delo.ru' ) );
od_test_idempotent( 'od_cover_link_names', 'od_cover_link_names', $alted );
od_test(
	'a column with no image is left alone — the coordinator\'s is one',
	od_cover_link_names( '<!-- wp:column --><div><a href="/a/">т</a></div><!-- /wp:column -->' )
	=== '<!-- wp:column --><div><a href="/a/">т</a></div><!-- /wp:column -->'
);
od_test(
	'an empty alt is not a name',
	! str_contains(
		od_cover_link_names( '<!-- wp:column --><a href="/a/"><img src="/a.jpg" alt="" /></a><!-- /wp:column -->' ),
		'tabindex'
	)
);
od_test(
	'quotes in a heading cannot break out of the attribute',
	str_contains(
		od_cover_link_names(
			'<!-- wp:column --><a href="/a/"><img src="/a.jpg" alt="&laquo;Общее дело&raquo;" /></a>'
			. '<div><a class="wp-block-button__link" href="/a/">Подробнее</a></div><!-- /wp:column -->'
		),
		'aria-label="Подробнее: &laquo;Общее дело&raquo;"'
	)
);

/* ------------------------------------------- od_https_own_links */

$stripped = od_strip_attr_site_suffix( $named );
$https = od_https_own_links( $stripped );
od_test( 'the first cover stops hopping through http', ! str_contains( $https, 'http://metodic' ) && 2 === substr_count( $https, 'https://metodic.obshee-delo.ru' ) );
od_test_idempotent( 'od_https_own_links', 'od_https_own_links', $stripped );
od_test(
	'an off-site http link is left alone — it may have no https to go to',
	od_https_own_links( '<a href="http://example.org/">т</a>' ) === '<a href="http://example.org/">т</a>'
);
od_test(
	'a lookalike host is not ours',
	od_https_own_links( '<a href="http://obshee-delo.ru.evil.tld/">т</a>' ) === '<a href="http://obshee-delo.ru.evil.tld/">т</a>'
);

/* ------------------------------------- od_strip_paragraph_spacing */

$spaced = od_strip_paragraph_spacing( $https );
od_test( 'the migrator\'s inline spacing is gone from all three covers', ! preg_match( '~<p[^>]*(margin|padding)~', $spaced ) );
od_test( 'text-align survives, and the attribute with it', 3 === substr_count( $spaced, 'style="text-align: center"' ) );
od_test_idempotent( 'od_strip_paragraph_spacing', 'od_strip_paragraph_spacing', $alted );

od_test(
	'an attribute left empty is dropped, not kept as style=""',
	od_strip_paragraph_spacing( '<p style="margin-bottom: 3px">т</p>' ) === '<p>т</p>'
);
od_test(
	'a declaration whose name merely contains margin is kept',
	str_contains( od_strip_paragraph_spacing( '<p style="scroll-margin-top: 4px">т</p>' ), 'scroll-margin-top' )
);
od_test(
	'other elements are untouched — only paragraphs carry this debris',
	od_strip_paragraph_spacing( '<div style="margin: 10px">т</div>' ) === '<div style="margin: 10px">т</div>'
);

/* --------------------------------------------- od_strip_attr_site_suffix */

// The page on od-dev was converted before the strip existed, so the suffix has to
// come off attributes that are already written — there is no heading left to clean.
od_test( 'an already-written alt is cleaned', str_contains( od_strip_attr_site_suffix( '<img alt="Здоровая Россия - ОБЩЕЕ ДЕЛО" />' ), 'alt="Здоровая Россия"' ) );
od_test( 'an already-written aria-label too', str_contains( od_strip_attr_site_suffix( '<a aria-label="Подробнее: Здоровые дети — Общее дело">x</a>' ), 'aria-label="Подробнее: Здоровые дети"' ) );
od_test( 'other attributes are left alone', od_strip_attr_site_suffix( '<a title="Здоровая Россия - ОБЩЕЕ ДЕЛО">x</a>' ) === '<a title="Здоровая Россия - ОБЩЕЕ ДЕЛО">x</a>' );
od_test( 'and an entity in the value is not re-encoded', od_strip_attr_site_suffix( '<img alt="&laquo;Общее дело&raquo; в школе" />' ) === '<img alt="&laquo;Общее дело&raquo; в школе" />' );
od_test_idempotent( 'od_strip_attr_site_suffix', 'od_strip_attr_site_suffix', $named );

/* -------------------------------------------------- od_strip_site_suffix */

od_test( 'the site name goes', od_strip_site_suffix( 'Здоровая Россия - ОБЩЕЕ ДЕЛО' ) === 'Здоровая Россия' );
od_test( 'an em dash too', od_strip_site_suffix( 'Здоровые дети — Общее Дело' ) === 'Здоровые дети' );
od_test( 'and a trailing full stop after it', od_strip_site_suffix( 'Здоровая молодежь – ОБЩЕЕ ДЕЛО.' ) === 'Здоровая молодежь' );
od_test( 'a heading without one is untouched', od_strip_site_suffix( 'Заказать методические пособия' ) === 'Заказать методические пособия' );
// Only at the end: «Общее дело» is the organisation's name and appears mid-heading
// all over the site.
od_test( 'not in the middle', od_strip_site_suffix( 'ОБЩЕЕ ДЕЛО в Магнитогорске' ) === 'ОБЩЕЕ ДЕЛО в Магнитогорске' );
od_test( 'the alt carries no site name', str_contains( $alted, 'alt="Здоровая Россия"' ) );

/* ------------------------------------------------------ od_cover_full_size */

$swapped = od_cover_full_size( $spaced, OD_METODICHKI_COVERS );
// All three, not one: the flat covers replace the booklet photographs the library
// held, so every cover in the row changes file.
foreach ( array( 'metodichka-232x300.jpg', 'metodic-mults-small220x300.jpg', 'New_small.jpg' ) as $gone ) {
	od_test( "the old file {$gone} is gone", ! str_contains( $swapped, $gone ) );
}
foreach ( array( 'metodichka-zdorovaya-rossiya.jpg', 'metodichka-zdorovye-deti.jpg', 'metodichka-zdorovaya-molodezh.jpg' ) as $cover ) {
	od_test( "the flat cover {$cover} took its place", str_contains( $swapped, '/wp-content/uploads/2026/08/' . $cover ) );
}
od_test( 'and the covers the page carried its own paths for are not still referenced', ! str_contains( $swapped, '/2016/07/' ) && ! str_contains( $swapped, '/2020/04/' ) );
// Each described the file that was there: 232×300, 220×300, 226×300, and two
// `<img>`s claimed the same per-environment attachment id, 27636.
od_test( 'the stale dimensions are dropped', ! str_contains( $swapped, 'width="' ) && ! str_contains( $swapped, 'height="' ) );
od_test( 'and the stale attachment classes with them', ! str_contains( $swapped, 'wp-image-' ) );
od_test( 'the classes that meant something survive', 3 === substr_count( $swapped, 'class="size-medium aligncenter"' ) );
// The page exists in two states and both have to land on the same cover: this is
// the one od-dev was left in by the previous run of this script.
$already = od_cover_full_size(
	'<img src="/wp-content/uploads/2020/04/' . rawurlencode( 'обложка_ЗдорМолодежьNew.jpg' ) . '" />',
	OD_METODICHKI_COVERS
);
od_test( 'a body already swapped once lands on the flat cover too', $already === '<img src="/wp-content/uploads/2026/08/metodichka-zdorovaya-molodezh.jpg" />' );
// The other half of the value's two readings, which nothing on this page uses any
// more: a bare basename keeps the directory the page carries.
od_test(
	'a basename target swaps the file and keeps the path',
	od_cover_full_size( '<img src="/a/b/x-1x1.jpg" width="1" />', array( 'x-1x1.jpg' => 'x.jpg' ) ) === '<img src="/a/b/x.jpg" />'
);
od_test( 'a page with none of the mapped files is returned as it is', od_cover_full_size( '<img src="/x/other.jpg" width="1" />', OD_METODICHKI_COVERS ) === '<img src="/x/other.jpg" width="1" />' );
od_test_idempotent(
	'od_cover_full_size',
	static fn( string $c ): string => od_cover_full_size( $c, OD_METODICHKI_COVERS ),
	$spaced
);

/* --------------------------------------- od_details_to_profile_link */

$linked = od_details_to_profile_link( $swapped, OD_METODICHKI_COORDINATOR_HREF, OD_METODICHKI_COORDINATOR_NAME );
od_test( 'the accordion is gone', ! str_contains( $linked, 'wp:details' ) );
od_test( 'its summary becomes an h2', str_contains( $linked, '<h2 class="wp-block-heading">Заказать методические пособия</h2>' ) );
od_test( 'the coordinator is one link, alone in its paragraph', str_contains( $linked, '<!-- wp:paragraph --><p><a href="' . OD_METODICHKI_COORDINATOR_HREF . '">' . OD_METODICHKI_COORDINATOR_NAME . '</a></p><!-- /wp:paragraph -->' ) );
od_test( 'the pasted Telegram prose is gone', ! str_contains( $linked, 'paramon1302' ) && ! str_contains( $linked, 'text-entity-link' ) );
od_test( 'and so is the duplicated phone number', ! str_contains( $linked, '89048180869' ) );
od_test_idempotent(
	'od_details_to_profile_link',
	static fn( string $c ): string => od_details_to_profile_link( $c, OD_METODICHKI_COORDINATOR_HREF, OD_METODICHKI_COORDINATOR_NAME ),
	$swapped
);

/* ------------------------------------------- the whole page fix, in order */

$whole = od_pages_metodichki( $page );
od_test( 'the page fix composes to the same result', $whole === $linked );
od_test( 'the page fix is idempotent end to end', od_pages_metodichki( $whole ) === $whole );
// What the page should end up as: two groups, one three-up cover row carrying the
// class, one heading (the order section's), three posters each still linked and
// still buttoned, and one profile link.
od_test( 'exactly one heading survives — the order section\'s', 1 === substr_count( $whole, '<!-- wp:heading' ) );
od_test( 'the cover row is the only classed columns block', 2 === substr_count( $whole, 'od-covers' ) );
od_test( 'three posters, three buttons, one profile link', 3 === substr_count( $whole, '<img' ) && 3 === substr_count( $whole, 'wp:button' ) * 1 / 2 && 1 === substr_count( $whole, '/profile/' ) );

/* ---------------------------------------- od_append_contact_links */

$appended = od_append_contact_links(
	$profile,
	array(
		array( 'https://t.me/paramon1302', '@paramon1302' ),
		array( 'https://vk.com/id39335667', 'https://vk.com/id39335667' ),
	)
);
od_test( 'the telegram handle is added as a link', str_contains( $appended, '<p><a href="https://t.me/paramon1302">@paramon1302</a></p>' ) );
od_test( 'the VK page too', str_contains( $appended, '<p><a href="https://vk.com/id39335667">https://vk.com/id39335667</a></p>' ) );
od_test( 'both land inside the paragraph block, not after it', strpos( $appended, 'paramon1302' ) < strrpos( $appended, '<!-- /wp:paragraph -->' ) );
od_test( 'the contacts already there are untouched', str_contains( $appended, 'tel:+7(904)818-08-69' ) && str_contains( $appended, 'obshcheedelo@inbox.ru' ) );
od_test( 'and so is the photo column', str_contains( $appended, 'wp:image' ) );
od_test_idempotent(
	'od_append_contact_links',
	static fn( string $c ): string => od_append_contact_links( $c, array( array( 'https://t.me/paramon1302', '@paramon1302' ) ) ),
	$profile
);
od_test(
	'a body with no paragraph block still gets the link',
	str_contains( od_append_contact_links( '<!-- wp:image --><figure></figure><!-- /wp:image -->', array( array( 'https://t.me/x', '@x' ) ) ), 'https://t.me/x' )
);

$before = file_get_contents(__DIR__ . '/fixtures/healthy-russia.before.html');
$after = od_pages_healthy_russia($before, 665);

// -- structure --------------------------------------------------------------

od_test('logo card', str_contains($after, 'wp-block-image size-full od-programme-logo'));
od_test('goal card', str_contains($after, '<div class="wp-block-group od-card od-card--goal">'));
od_test('task carousel', str_contains($after, 'cb-carousel-block od-cards"'));
od_test('methodology card', str_contains($after, '<div class="wp-block-columns od-card od-card--flush">'));
od_test('poster carousel', str_contains($after, 'cb-carousel-block od-poster-cards"'));

od_test('one slide per task card', substr_count($after, '<!-- wp:cb/slide-v2 -->') === 3);
od_test('only the methodology card is still a columns block', substr_count($after, '<!-- wp:column -->') === 2);
od_test('two literal images — the logo and the booklet', substr_count($after, '"sizeSlug":"full"') === 2);
od_test('the poster card\'s cover is bound, not pasted', substr_count($after, '<!-- wp:image {"metadata":{"bindings"') === 1);
od_test('both carousels carry dots', substr_count($after, 'data-cb-pagination="true"') === 2);

// -- the projects row is a query over the programme's tag ------------------

od_test('the row queries the tag it was given', str_contains($after, '"tagIds":[665]'));
od_test('and not the page\'s own query', str_contains($after, '"inherit":false'));
od_test('the query block is what Swiper mounts on', str_contains($after, '"className":"swiper"'));
od_test('the post template is the track', str_contains($after, '<!-- wp:post-template {"className":"swiper-wrapper"} -->'));
// Not `core/post-featured-image`: that is the 16∶9 still `/video/` wants.
od_test('the cover is bound to the portrait one', str_contains($after, '"key":"od_card_cover"'));
od_test('through the block bindings API', str_contains($after, '"source":"core/post-meta"'));
od_test('the 16∶9 still is not what this card shows', !str_contains($after, 'post-featured-image'));
od_test('the title is the card\'s link', str_contains($after, '<!-- wp:post-title {"level":3,"isLink":true} /-->'));
od_test('a плакат is heavy and the row is below the fold', str_contains($after, 'alt="" loading="lazy"'));
od_test('the migrator\'s hand-picked posters are gone', !str_contains($after, 'drugs.jpg'));

// Arrows on the projects row, which can outgrow its three slots; none on the
// tasks, which are three cards on desktop and a swipe on a phone.
od_test('tasks have no arrows', str_contains($after, '"className":"od-cards","spaceBetween":40,"navigation":false'));
od_test('projects have arrows', str_contains($after, '"className":"od-poster-cards","spaceBetween":40,"navigation":true'));

// -- prose ------------------------------------------------------------------

od_test('goal heading', str_contains($after, '<h2 class="wp-block-heading">Цель программы</h2>'));
od_test('tasks heading', str_contains($after, '<h2 class="wp-block-heading">Задачи программы</h2>'));
od_test('methodology heading', str_contains($after, '<h2 class="wp-block-heading">Здоровая Россия — ОБЩЕЕ ДЕЛО!</h2>'));
od_test('projects heading', str_contains($after, '<h2 class="wp-block-heading">Проекты программы</h2>'));

foreach (['Обучающие', 'Развивающие', 'Воспитательные'] as $task) {
    od_test($task . ' card', str_contains($after, sprintf('<h3 class="wp-block-heading">%s</h3>', $task)));
}
od_test('task body kept', str_contains($after, '<p>сформировать понимание важности здорового'));
od_test('goal body kept', str_contains($after, 'Содействие воспитательным процессам по укреплению в молодежной среде'));
od_test('methodology body kept', str_contains($after, 'Программа прошла экспертизу'));

// -- values read out of the page, not hardcoded -----------------------------

od_test('logo attachment id kept', str_contains($after, '"id":60061'));
od_test('logo path kept', str_contains($after, '/wp-content/uploads/2021/02/healthy_russia.png'));
od_test('methodology button kept', str_contains($after, 'href="https://metodic.obshee-delo.ru/">Сайт методички'));
od_test('downloads link kept', str_contains($after, 'href="https://metodic.obshee-delo.ru/download.html">Методические материалы'));

// -- buttons ----------------------------------------------------------------

// Twice per button: once in the block attributes, once in the rendered class.
od_test('the two methodology buttons, and no others', substr_count($after, 'is-style-outline') === 4);

// -- what the template drops ------------------------------------------------

od_test('migrator separators gone', !str_contains($after, '<hr'));
od_test('migrator heading class gone', !str_contains($after, 'cmsms_heading'));
od_test('old theme span gone', !str_contains($after, 'fontstyle0'));
od_test('empty trailing heading gone', !str_contains($after, 'Документальные фильмы'));
od_test('hard line break gone', !str_contains($after, '<br'));
od_test('inline alignment gone', !str_contains($after, 'text-align: center'));
od_test('column widths are left to the stylesheet', !str_contains($after, 'flex-basis'));

// -- alt text ---------------------------------------------------------------

od_test('logo alt', str_contains($after, 'alt="Здоровая Россия"'));
od_test('only the bound cover, which the title beside it names', substr_count($after, 'alt=""') === 1);

// -- idempotency ------------------------------------------------------------

od_test('converted content is left alone', od_pages_healthy_russia($after, 665) === $after);

// -- refuses input it does not recognise ------------------------------------

$threw = false;
try {
    od_pages_healthy_russia('<!-- wp:paragraph --><p>что-то другое</p><!-- /wp:paragraph -->', 665);
} catch (RuntimeException $e) {
    $threw = true;
}
od_test('unexpected input is refused, not half-converted', $threw);

// -- helpers ----------------------------------------------------------------

od_test('line breaks become spaces', od_pages_inline_text("раз<br />\nдва") === 'раз два');
od_test('old theme span stripped', od_pages_inline_text('<span class="fontstyle0">текст</span>') === 'текст');
od_test('whitespace collapsed', od_pages_inline_text('  два   слова  ') === 'два слова');

od_test('the live domain becomes a path', od_pages_site_link('https://общее-дело.рф/materials/x/') === '/materials/x/');
od_test('and so does its Punycode form', od_pages_site_link('https://xn----9sbkcac6brh7h.xn--p1ai/x/') === '/x/');
od_test('another site keeps its origin', od_pages_site_link('https://metodic.obshee-delo.ru/') === 'https://metodic.obshee-delo.ru/');
od_test('and so does a download', od_pages_site_link('https://disk.yandex.ru/i/abc') === 'https://disk.yandex.ru/i/abc');

// ====================================================================// `/healthy-youth/` — Figma `project-2`.
// ====================================================================
$youthBefore = file_get_contents(__DIR__ . '/fixtures/healthy-youth.before.html');
$youth = od_pages_healthy_youth($youthBefore, 666);

od_test('logo card', str_contains($youth, 'wp-block-image size-full od-programme-logo'));
od_test('goal card', str_contains($youth, '<div class="wp-block-group od-card od-card--goal">'));
od_test('numbered task carousel', str_contains($youth, 'cb-carousel-block od-cards od-cards--numbered"'));
od_test('poster carousel', str_contains($youth, 'cb-carousel-block od-poster-cards"'));
od_test('the note stands on its own', str_contains($youth, '<p class="od-note">Программа прошла экспертизу'));

// Two tasks, so two cards — and the carousel is told, or the row keeps a
// third slot the mock fills by widening the cards instead.
od_test('one slide per task', substr_count($youth, '<!-- wp:cb/slide-v2 -->') === 2);
od_test('two slots, not the template three', str_contains($youth, '"slidesPerView":2'));
od_test('and the frontend is told the same', str_contains($youth, 'data-cb-slides-per-view="2"'));
od_test('each card leads with its number', substr_count($youth, '<p class="od-task-number">') === 2);
od_test('padded to two digits, as the mock draws it', str_contains($youth, '<p class="od-task-number">01</p>'));
od_test('and the number replaces the card heading rather than joining it', !str_contains($youth, '<h3'));

od_test('the row queries the tag it was given', str_contains($youth, '"tagIds":[666]'));
od_test('covers come from the bound meta key', str_contains($youth, '"key":"od_card_cover"'));
od_test('the title is the card\'s link', str_contains($youth, '<!-- wp:post-title {"level":3,"isLink":true} /-->'));

od_test('goal heading', str_contains($youth, '<h2 class="wp-block-heading">Цель программы</h2>'));
od_test('tasks heading', str_contains($youth, '<h2 class="wp-block-heading">Задачи программы</h2>'));
od_test('projects heading', str_contains($youth, '<h2 class="wp-block-heading">Проекты программы</h2>'));
od_test('goal body kept', str_contains($youth, '<p>Развитие мотивационной сферы личности подростков'));
od_test('first task kept', str_contains($youth, '<p>Создать условия для включения новых сведений'));
od_test('second task kept', str_contains($youth, '<p>Сформировать у подростков мотивационную основу'));

// The booklet cover has no slot in the mock; the file it linked to does.
od_test('the download survives, under the goal', str_contains($youth, '<p class="od-card-link"><a href="https://disk.yandex.ru/i/V2VRI2tY04OC1Q">Скачать методичку PDF</a></p>'));
od_test('once — the trailing heading pointed at the same file', substr_count($youth, 'disk.yandex.ru') === 1);
od_test('and it is inside the goal card, not after the page', strpos($youth, 'od-card-link') < strpos($youth, 'Задачи программы'));
od_test('the booklet cover is gone', !str_contains($youth, 'metodischka2.jpg'));
od_test('and so are the hand-picked posters', !str_contains($youth, 'plakats_2office_man.jpg'));
od_test('one literal image — the logo', substr_count($youth, '"sizeSlug":"full"') === 1);
od_test('the covers come from the query, bound to post meta', substr_count($youth, '<!-- wp:image {"metadata":{"bindings"') === 1);

od_test('migrator separators gone', !str_contains($youth, '<hr'));
od_test('migrator heading class gone', !str_contains($youth, 'cmsms_heading'));
od_test('old theme span gone', !str_contains($youth, 'fontstyle0'));
od_test('empty trailing heading gone', !str_contains($youth, 'Документальные фильмы'));
od_test('inline alignment gone', !str_contains($youth, 'text-align: center'));

od_test('converted content is left alone', od_pages_healthy_youth($youth, 666) === $youth);

// ====================================================================// `/healthy-kids/` — Figma `project-3`.
// ====================================================================
$kidsBefore = file_get_contents(__DIR__ . '/fixtures/healthy-kids.before.html');
$kids = od_pages_healthy_kids($kidsBefore, 667);

od_test('logo card', str_contains($kids, 'wp-block-image size-full od-programme-logo'));
od_test('logo alt', str_contains($kids, 'alt="Здоровые дети"'));
od_test('logo path kept', str_contains($kids, '/wp-content/uploads/2021/02/healthy_kids.png'));
od_test('logo attachment id kept', str_contains($kids, '"id":60060'));
od_test('goal card', str_contains($kids, '<div class="wp-block-group od-card od-card--goal">'));
od_test('numbered task carousel', str_contains($kids, 'cb-carousel-block od-cards od-cards--numbered"'));
od_test('the note stands on its own', str_contains($kids, '<p class="od-note">Программа прошла экспертизу'));

od_test('one slide per task', substr_count($kids, '<!-- wp:cb/slide-v2 -->') === 3);
od_test('three tasks, three slots', str_contains($kids, '"slidesPerView":3'));
od_test('each card leads with its number', substr_count($kids, '<p class="od-task-number">') === 3);
od_test('numbered through to the last', str_contains($kids, '<p class="od-task-number">03</p>'));
od_test('first task kept', str_contains($kids, '<p>Разработать учебно-методический комплекс'));
od_test('last task kept', str_contains($kids, '<p>Обеспечить образовательные организации разработанными материалами.</p>'));
od_test('goal body, line break collapsed', str_contains($kids, '<p>Содействие воспитательным процессам, направленным на формирование ценности здорового образа жизни среди детей.</p>'));

// `project-3` draws no projects row, but the programme has films and the row
// is the same query block the other two pages carry.
od_test('projects heading', str_contains($kids, '<h2 class="wp-block-heading">Проекты программы</h2>'));
od_test('poster carousel', str_contains($kids, 'cb-carousel-block od-poster-cards"'));
od_test('over the tag it was given', str_contains($kids, '"tagIds":[667]'));
od_test('one literal image — the logo; the portrait went with the mock', substr_count($kids, '"sizeSlug":"full"') === 1);
od_test('the covers come from the query, bound to post meta', substr_count($kids, '<!-- wp:image {"metadata":{"bindings"') === 1);
od_test('the portrait is gone; its playlist link is a button', !str_contains($kids, 'poznovalov.jpg'));

// Both trailing headings were links, and both survive — under the goal.
od_test('both, and as links rather than buttons', substr_count($kids, 'class="od-card-link"') === 2);
od_test('the live-domain link became a path', str_contains($kids, '<a href="/materials/pppuiv-ted-6/">Методические рекомендации</a>'));
od_test('the playlist keeps its origin', str_contains($kids, '<a href="https://www.youtube.com/playlist?list=PLlNywkCI4IKyNXLKzGyM43Orp41Qm1plo">Фильмы программы</a>'));
od_test('and both sit in the goal card', strpos($kids, 'od-card-link') < strpos($kids, 'Задачи программы'));
od_test('no buttons on this page at all', !str_contains($kids, 'is-style-outline'));

od_test('migrator heading class gone', !str_contains($kids, 'cmsms_heading'));
od_test('old theme span gone', !str_contains($kids, 'fontstyle0'));
od_test('hard line break gone', !str_contains($kids, '<br'));
od_test('the task list became cards', !str_contains($kids, '<ul>'));

od_test('converted content is left alone', od_pages_healthy_kids($kids, 667) === $kids);

// ====================================================================// `/projects/` — Figma `projects`, the index of the three above.
// ====================================================================
$projectsBefore = file_get_contents(__DIR__ . '/fixtures/projects.before.html');
/**
 * Every card in a converted row has a drawing: a `background-image` rule in
 * `gutenberg.css` naming a file that exists. The card id is what the rule hangs
 * on, so the two are one contract — and the pairing is by name, not by
 * convention, since Figma reuses one drawing across pages.
 */
function od_test_tile_drawings(string $html, array $ids): void
{
    static $css = null;
    $css = $css ?? file_get_contents(__DIR__ . '/../../src/shared/ui/theme/gutenberg/gutenberg.css');

    foreach ($ids as $id) {
        od_test($id . ': card class', str_contains($html, 'od-tile od-tile--' . $id . '"'));

        $found = preg_match(
            '#\.od-tile--' . preg_quote($id, '#') . "::before \{\s*background-image: url\('([^']+)'\)#",
            $css,
            $rule
        );
        od_test($id . ': a drawing rule in gutenberg.css', $found === 1);
        od_test($id . ': the file that rule names', $found === 1 && file_exists(__DIR__ . '/../../public' . $rule[1]));
    }
}

$projects = od_pages_projects($projectsBefore, 0);

od_test('two rows of cards', substr_count($projects, '<div class="wp-block-columns od-tiles">') === 2);
od_test('six cards, each its own column', substr_count($projects, 'class="wp-block-column od-tile od-tile--') === 6);
od_test('each card links once — the heading is not a second link', substr_count($projects, '<p class="od-tile-link"><a href=') === 6);
od_test('the second row is the only one with a heading', str_contains($projects, '<h2 class="wp-block-heading">Проекты</h2>'));
od_test('the first is named by the page title', substr_count($projects, '<h2 ') === 1);

od_test_tile_drawings($projects, ['healthy-russia', 'healthy-kids', 'healthy-youth', 'od-pro', 'video', 'online-courses']);

od_test('programme title, as the mock sets it', str_contains($projects, '<h3 class="wp-block-heading">Здоровая Россия</h3>'));
od_test('and it points at the page WordPress serves', str_contains($projects, '<a href="/healthy-russia/">Подробнее</a>'));
od_test('the catalogue is this site\'s own route', str_contains($projects, '<a href="/video/">Подробнее</a>'));
od_test('the external directions keep their origin', str_contains($projects, '<a href="https://od-pro.ru">Подробнее</a>'));

// The old page is gone whole: its H1 is drawn from the page title, its CSS
// styled the theme this site replaces, and its covers are not these drawings.
od_test('no second H1', !str_contains($projects, '<h1'));
od_test('the old theme\'s CSS is gone', !str_contains($projects, '<style'));
od_test('and so is the class it styled', !str_contains($projects, 'program-box'));
od_test('booklet covers gone', !str_contains($projects, 'metodischka1.jpg'));
od_test('no images at all — the drawings are backgrounds', !str_contains($projects, '<!-- wp:image '));
od_test('the buttons became the card-wide link', !str_contains($projects, 'wp-block-button'));
od_test('the shouted programme names are gone', !str_contains($projects, 'ОБЩЕЕ ДЕЛО</h2>'));

od_test('converted content is left alone', od_pages_projects($projects, 0) === $projects);

// ====================================================================// `/materials/` — Figma `ads`, the same card at 598×280.
// ====================================================================
$materialsBefore = file_get_contents(__DIR__ . '/fixtures/materials.before.html');
$materials = od_pages_materials($materialsBefore, 0);

// One row of four, not two of two: `.od-tiles--wide` is a two-track grid.
od_test('one row block', substr_count($materials, '<div class="wp-block-columns od-tiles od-tiles--wide">') === 1);
od_test('four cards', substr_count($materials, 'class="wp-block-column od-tile od-tile--') === 4);
od_test('the page title names the only section', !str_contains($materials, '<h2 '));

od_test_tile_drawings($materials, ['metodichki', 'printed-products', 'articles', 'social-reklama']);

od_test('the mock\'s title, not the page\'s longer caption', str_contains($materials, '<h3 class="wp-block-heading">Методические пособия</h3>'));
od_test('the relative href became the real path', str_contains($materials, '<a href="/materials/printed-products/">Подробнее</a>'));
od_test('and the rest keep theirs', str_contains($materials, '<a href="/materials/social-reklama/">Подробнее</a>'));

od_test('the old theme\'s hover-zoom is gone', !str_contains($materials, '<style'));
od_test('and the class it styled', !str_contains($materials, 'textcapt'));
od_test('the dead MailPoet shortcode is gone', !str_contains($materials, 'wysija_form'));
od_test('the photos are not the mock\'s drawings', !str_contains($materials, '<!-- wp:image '));
od_test('the caption\'s tail went with it', !str_contains($materials, 'Общего Дела'));

od_test('converted content is left alone', od_pages_materials($materials, 0) === $materials);

// ====================================================================// `/materials/printed-products/` — Figma `printing`, the same hub one level down.
// ====================================================================
$printedBefore = file_get_contents(__DIR__ . '/fixtures/printed-products.before.html');
$printed = od_pages_printed_products($printedBefore, 0);

// 3 + 3, not the mock's 3 + 2: the page has a sixth card the mock predates, and
// a third wide card would sit alone at half width.
od_test('two rows of three', substr_count($printed, '<div class="wp-block-columns od-tiles">') === 2);
od_test('six cards', substr_count($printed, 'class="wp-block-column od-tile od-tile--') === 6);
od_test('no wide row here', !str_contains($printed, 'od-tiles--wide'));
od_test('the page title names the only section', !str_contains($printed, '<h2 '));

od_test_tile_drawings($printed, ['books', 'zakladki', 'booklet', 'disk', 'autosticker', 'plakaty']);

od_test('the mock\'s title', str_contains($printed, '<h3 class="wp-block-heading">Наши книги</h3>'));
od_test('«Общее дело» keeps its capitals, which the mock drops', str_contains($printed, '<h3 class="wp-block-heading">Диски Общего Дела</h3>'));
od_test('every card points where the page pointed', str_contains($printed, '<a href="/materials/zakladki/">Подробнее</a>'));
// Added to the live page in 2024, after `printing` was drawn — kept, because a
// mock predating a link is not a reason to drop it.
od_test('including the one the mock has no card for', str_contains($printed, '<a href="https://disk.yandex.ru/d/hm_77Uv33LH7vN">Подробнее</a>'));

od_test('the old theme\'s hover-zoom is gone', !str_contains($printed, '<style'));
od_test('and the class it styled', !str_contains($printed, 'textcapt'));
od_test('the photos are not the mock\'s drawings', !str_contains($printed, '<!-- wp:image '));

od_test('converted content is left alone', od_pages_printed_products($printed, 0) === $printed);

// ====================================================================// `/materials/social-reklama/` — Figma `social-ads`, the last hub on these cards.
// ====================================================================
$socialBefore = file_get_contents(__DIR__ . '/fixtures/social-reklama.before.html');
$social = od_pages_social_reklama($socialBefore, 0);

// 3 + 2, exactly as the mock draws it: five links, no sixth to reflow around.
od_test('a row of three', substr_count($social, '<div class="wp-block-columns od-tiles">') === 1);
od_test('then a row of two wide', substr_count($social, '<div class="wp-block-columns od-tiles od-tiles--wide">') === 1);
od_test('five cards', substr_count($social, 'class="wp-block-column od-tile od-tile--') === 5);
od_test('the page title names the only section', !str_contains($social, '<h2 '));

od_test_tile_drawings($social, ['plakati', 'billboards', 'audio-roliki-social-reklama', 'led-board-roliki', 'sticker']);

od_test('the mock\'s caption', str_contains($social, '<h3 class="wp-block-heading">Плакаты</h3>'));
od_test('shortened, on a page already named that', !str_contains($social, 'Плакаты социальной рекламы'));
// The mock paraphrases these as «световых»; the page and the slug say what they
// are, the same way «Диски Общего Дела» kept its capitals.
od_test('the page wins on the LED boards', str_contains($social, '<h3 class="wp-block-heading">Ролики для светодиодных щитов</h3>'));
od_test('every card points where its photo pointed', str_contains($social, '<a href="/materials/plakati/">Подробнее</a>'));
od_test('down to the wide row', str_contains($social, '<a href="/materials/led-board-roliki/">Подробнее</a>'));

od_test('the old theme\'s hover-zoom is gone', !str_contains($social, '<style'));
od_test('and the caption class it styled', !str_contains($social, 'textcapt'));
od_test('and the colour class on the column', !str_contains($social, 'redcapt'));
od_test('the photos are not the mock\'s drawings', !str_contains($social, '<!-- wp:image '));
od_test('the half-column the fifth photo left empty is gone', !str_contains($social, 'flex-basis:50%'));

od_test('converted content is left alone', od_pages_social_reklama($social, 0) === $social);

// ====================================================================// The five asset pages under `/materials/social-reklama/` — D6l.
// ====================================================================
/** Every card carries the download the page already had, on the mock's label. */
function od_test_asset_downloads(string $html, int $cards, string $label): void
{
    od_test('a card per item', substr_count($html, 'od-asset">') === $cards);
    od_test('each with one download row', substr_count($html, 'wp-block-buttons od-asset-actions') === $cards);
    od_test('on the shared label', substr_count($html, '>' . $label . '</a>') >= $cards);
    od_test('pointing at Yandex Disk, as the page did', substr_count($html, 'href="https://yadi.sk/') >= $cards);
    od_test('the old theme\'s spacing rules are gone', !str_contains($html, '<!-- wp:separator'));
    od_test('so is its stylesheet', !str_contains($html, '<style'));
    od_test('and the MailPoet form whose plugin is', !str_contains($html, 'wysija_form'));
}

// -- /materials/billboards/ — Figma `social-banners` -------------------------

$billboards = od_pages_billboards(file_get_contents(__DIR__ . '/fixtures/billboards.before.html'), 0);

od_test_asset_downloads($billboards, 13, OD_ASSET_DOWNLOAD);
od_test('one card per row, so no grid row at all', !str_contains($billboards, 'od-assets'));
od_test('the artwork is labelled as the mock labels it', substr_count($billboards, '>Макет</figcaption>') === 13);
od_test('and the photo beside it', substr_count($billboards, '>Примеры использования</figcaption>') === 13);
// It was a paragraph floating above the picture; a figcaption belongs to the
// picture and travels with it when an editor moves the block.
od_test('the caption is no longer a paragraph of its own', !str_contains($billboards, '<p>Примеры использования'));
od_test('the page\'s own wording is dropped for the mock\'s', !str_contains($billboards, 'Скачать в качестве для печати'));
od_test('every image keeps the full-size file it linked to', str_contains($billboards, '<a href="/wp-content/uploads/2020/05/Щит3на6-Здоровая-молодежь.jpg">'));
od_test('converted content is left alone', od_pages_billboards($billboards, 0) === $billboards);

// -- /materials/plakati/ — Figma `social-posters`, the #6 entry page ---------

$plakati = od_pages_plakati(file_get_contents(__DIR__ . '/fixtures/plakati.before.html'), 0);

od_test_asset_downloads($plakati, 15, OD_ASSET_DOWNLOAD);
// Fifteen cards two-up: seven full rows and one holding the odd poster out.
od_test('two per row', substr_count($plakati, '<div class="wp-block-columns od-assets">') === 8);
// Three pictures in a card go on one row, as the mock draws them — four cards
// carry a poster and two photos of it in use.
od_test('a card of three pictures is one row of three', substr_count($plakati, 'flex-basis:33.33%') === 12);
od_test('and a card of two, one row of two', substr_count($plakati, 'flex-basis:50.00%') === 20);
od_test('the fifteen buttons keep their own hrefs', substr_count($plakati, 'href="https://yadi.sk/') === 15);
od_test('the first poster keeps its own link', str_contains($plakati, 'https://yadi.sk/i/8ShaiNDuQab81Q'));
od_test('and the last', str_contains($plakati, 'https://yadi.sk/i/IW3PrSmgzfXkn'));
// The «36 000 рублей» row is the reason pairing is positional: its second
// column is the same poster in black and white and never got the label.
od_test('the black-and-white twin is a photo, not a sixteenth poster', substr_count($plakati, '36000_bw_270H.jpg') === 1);
od_test('the one poster with a name of its own keeps it', str_contains($plakati, '<h3 class="wp-block-heading">Серия плакатов'));
od_test('the empty 25% spacer columns are gone', !str_contains($plakati, 'flex-basis:25%'));
od_test('so is the old theme\'s border class', !str_contains($plakati, 'sectionborder'));
od_test('converted content is left alone', od_pages_plakati($plakati, 0) === $plakati);

// -- /materials/sticker/ — Figma `social-sticker` ---------------------------

$sticker = od_pages_sticker(file_get_contents(__DIR__ . '/fixtures/sticker.before.html'), 0);

od_test_asset_downloads($sticker, 6, OD_ASSET_DOWNLOAD);
od_test('six stickers, two per row', substr_count($sticker, '<div class="wp-block-columns od-assets">') === 3);
od_test('the photos of them in use get their own heading', str_contains($sticker, '<h2 class="wp-block-heading">Примеры использования</h2>'));
// Photographs of the material in use, with nothing to download — core's gallery
// is already the mock's two-up layout and needs no rule in `gutenberg.css`.
// A `columns` grid, not a `core/gallery`: block-library stretches a gallery's
// last lone picture to full width, and overriding it is a fight with a selector
// carrying an id inside a `:not()`.
od_test('and are a picture grid, not four more cards', substr_count($sticker, '"className":"od-figures od-figures--4"') === 1);
od_test('all four of them', substr_count($sticker, 'wp-block-image size-full') === 10);
od_test('the old theme\'s border class is gone', !str_contains($sticker, 'marginbottom'));
od_test('converted content is left alone', od_pages_sticker($sticker, 0) === $sticker);

// -- /materials/led-board-roliki/ — Figma `social-video` --------------------

$leds = od_pages_led_board_roliki(file_get_contents(__DIR__ . '/fixtures/led-board-roliki.before.html'), 0);

od_test('ten clips', substr_count($leds, 'od-asset">') === 10);
od_test('each with both aspect ratios', substr_count($leds, '>16 : 9</a>') === 10 && substr_count($leds, '>4 : 3</a>') === 10);
od_test('twenty downloads in ten rows', substr_count($leds, 'wp-block-buttons od-asset-actions') === 10);
od_test('the thirty separators are gone', !str_contains($leds, '<!-- wp:separator'));
// The migrator wrote one `h1` per row, so the page shipped ten of them under a
// title that is already the page's only first-level heading.
od_test('no second h1 on the page', !str_contains($leds, '<h1'));
od_test('the clip names survive as h3', str_contains($leds, '<h3 class="wp-block-heading">Аристотель</h3>'));
od_test('and the last of them', str_contains($leds, '<h3 class="wp-block-heading">Углов</h3>'));
od_test('the label over the buttons is a label, not a heading', str_contains($leds, '<p>Скачать в формате mp4</p>'));
// Kinescope, not YouTube — the same player the film pages use, and every one
// of the twelve clips across this page and `/materials/books/` was matched by
// an exact title match between the two services.
od_test('every clip plays from Kinescope', substr_count($leds, 'https://kinescope.io/embed/') === 10);
od_test('and none from YouTube', !str_contains($leds, 'youtu'));
od_test('in core\'s own embed markup, so the 16:9 rule reaches it', substr_count($leds, 'wp-embed-aspect-16-9') === 10);
od_test('converted content is left alone', od_pages_led_board_roliki($leds, 0) === $leds);

// -- /materials/audio-roliki-social-reklama/ — Figma `social-audio` ---------

$audio = od_pages_audio_roliki(file_get_contents(__DIR__ . '/fixtures/audio-roliki-social-reklama.before.html'), 0);

od_test('four spots', substr_count($audio, 'od-asset">') === 4);
// The mp3s were never migrated: they sat in the body as raw `[cmsms_audio]`
// shortcodes, rendering as their own file path with no way to play them.
od_test('each gets the player the mock draws', substr_count($audio, '<!-- wp:audio -->') === 4);
od_test('pointed at the file the shortcode held', str_contains($audio, 'src="/wp-content/uploads/2017/07/Принудительное-курение-и-ПДК.-Аудио-ролик.mp3"'));
od_test('and the shortcode itself is gone', !str_contains($audio, 'cmsms_audio'));
od_test('the titles the migrator left inside a paragraph are headings', str_contains($audio, '<h3 class="wp-block-heading">Принудительное курение и ПДК.</h3>'));
od_test('the script survives', str_contains($audio, 'Береги себя и подумай о близких.'));
od_test('the download names what it is', substr_count($audio, '>Скачать аудио-ролик</a>') === 4);
od_test('converted content is left alone', od_pages_audio_roliki($audio, 0) === $audio);

// ====================================================================// The five asset pages under `/materials/printed-products/` — D6m.
// ====================================================================
// -- /materials/autosticker/ — Figma `car sticker` --------------------------

$autosticker = od_pages_autosticker(file_get_contents(__DIR__ . '/fixtures/autosticker.before.html'), 0);

od_test('seven stickers', substr_count($autosticker, 'od-asset">') === 7);
od_test('three pictures each', substr_count($autosticker, '<!-- wp:image ') === 21);
od_test('two downloads each — one per size', substr_count($autosticker, '>' . OD_ASSET_DOWNLOAD . '</a>') === 14);
od_test('the page\'s shouted label is the section\'s', !str_contains($autosticker, 'СКАЧАТЬ МАКЕТ'));
// Twenty-one of them, one per column, under a title that is already the page's
// only first-level heading.
od_test('the h1 per column is gone', !str_contains($autosticker, '<h1'));
// Six say «Наклейка на стекло»; the seventh is the hood-and-doors set, which
// names its own three pieces — and which is the last row `car sticker` draws.
od_test('its text survives as the caption the mock draws', substr_count($autosticker, '>Наклейка на стекло</figcaption>') === 6);
od_test('including the odd one out', str_contains($autosticker, '>Наклейка на капот и двери</figcaption>'));
od_test('a number and its unit take a space', str_contains($autosticker, '>1130х745 мм</figcaption>'));
od_test('and the second size too', str_contains($autosticker, '>1350х480 мм</figcaption>'));
od_test('the separators are gone', !str_contains($autosticker, '<!-- wp:separator'));
od_test('converted content is left alone', od_pages_autosticker($autosticker, 0) === $autosticker);

// -- /materials/zakladki/ — no frame of its own -----------------------------

$zakladki = od_pages_zakladki(file_get_contents(__DIR__ . '/fixtures/zakladki.before.html'), 0);

// Nine bookmarks, one `.cdr` with all of them in it — so one card, not nine.
od_test('one card', substr_count($zakladki, 'od-asset">') === 1);
od_test('holding all nine bookmarks', substr_count($zakladki, '<!-- wp:image ') === 9);
od_test('four up', substr_count($zakladki, '"className":"od-figures od-figures--4"') === 3);
od_test('one download for the lot', substr_count($zakladki, 'wp-block-button__link') === 1);
od_test('named as the page named it', str_contains($zakladki, '>Скачать версию для печати .cdr</a>'));
od_test('the intro stays outside the card', strpos($zakladki, 'Представляем вашему вниманию') < strpos($zakladki, 'od-asset'));
od_test('converted content is left alone', od_pages_zakladki($zakladki, 0) === $zakladki);

// -- /materials/booklet/ — Figma `flyers` -----------------------------------

$booklet = od_pages_booklet(file_get_contents(__DIR__ . '/fixtures/booklet.before.html'), 0);

od_test('three cards', substr_count($booklet, 'od-asset">') === 3);
od_test('under the page\'s own two headings', str_contains($booklet, '<h2 class="wp-block-heading">Листовки</h2>') && str_contains($booklet, '<h2 class="wp-block-heading">Буклеты</h2>'));
// The mock replaces those headings with a «Все / Листовки / Буклеты» tab strip;
// a filter over three cards is a control to build and maintain for nothing.
od_test('and not the mock\'s tab strip', !str_contains($booklet, 'wp-block-buttons is-content-justification'));
od_test('the two faces are captions now', substr_count($booklet, '>Сторона А</figcaption>') === 2 && substr_count($booklet, '>Сторона Б</figcaption>') === 2);
od_test('not paragraphs above the picture', !str_contains($booklet, '<p>Сторона'));
od_test('one download per card', substr_count($booklet, 'wp-block-button__link') === 3);
od_test('the coordinator becomes the profile card', str_contains($booklet, OD_METODICHKI_COORDINATOR_HREF));
od_test('and stops being an accordion', !str_contains($booklet, 'wp:details'));
od_test('the MailPoet form is gone', !str_contains($booklet, 'wysija_form'));
od_test('so is the old theme\'s stylesheet', !str_contains($booklet, '<style'));
od_test('converted content is left alone', od_pages_booklet($booklet, 0) === $booklet);

// -- /materials/disk/ — Figma `disks` ---------------------------------------

$disk = od_pages_disk(file_get_contents(__DIR__ . '/fixtures/disk.before.html'), 0);

od_test('four discs', substr_count($disk, 'od-asset">') === 4);
od_test('the card holds the disc and its download', substr_count($disk, '>Скачать образ диска</a>') === 4);
// The shop's four pages were deleted in WordPress on 2026-08-17, so this link
// pointed at nothing — and it was the only reason the page was on the embed list.
od_test('the dead WooCommerce link is gone', !str_contains($disk, 'add-to-cart'));
od_test('with the old theme\'s classes on it', !str_contains($disk, 'cmsms_button'));
od_test('the prose reads beside the card, not inside it', strpos($disk, 'На диске представлены') > strpos($disk, 'od-asset'));
od_test('each disc keeps its name', str_contains($disk, '<h3 class="wp-block-heading">Диск «Тайна природы женщины»</h3>'));
od_test('the MailPoet form is gone', !str_contains($disk, 'wysija_form'));
od_test('converted content is left alone', od_pages_disk($disk, 0) === $disk);

// -- /materials/books/ — Figma `books` --------------------------------------

$books = od_pages_books(file_get_contents(__DIR__ . '/fixtures/books.before.html'), 0);

od_test('two books', substr_count($books, 'od-asset">') === 2);
od_test('each with its trailer, from Kinescope', substr_count($books, 'https://kinescope.io/embed/') === 2);
od_test('not YouTube', !str_contains($books, 'youtu'));
od_test('and its cover', substr_count($books, '<!-- wp:image ') === 2);
// The migrator left the whole aside as one paragraph block holding raw `<h3>`s,
// a bare `<img>` and three dash-and-`<br>` lists.
od_test('the cover keeps the id its class carried', str_contains($books, '<!-- wp:image {"id":28683'));
od_test('the shops are lists now', substr_count($books, '<!-- wp:list -->') === 6);
od_test('with an item each', substr_count($books, '<!-- wp:list-item -->') === 26);
od_test('under a heading per city', str_contains($books, '<h3 class="wp-block-heading">В Санкт-Петербурге</h3>'));
od_test('every shop keeps its link', str_contains($books, 'href="http://www.bookvoed.ru/book?id=6897044"'));
// The trailing «;» is sometimes inside the shop's own link.
od_test('and none of them keeps its semicolon', !str_contains($books, ';</a>'));
od_test('the dashes that made the list are gone', !str_contains($books, '<li>- '));
od_test('converted content is left alone', od_pages_books($books, 0) === $books);

/* ---------------------------------------------- /team/ and its records (D3) */

$team      = file_get_contents(__DIR__ . '/fixtures/page-team.html');
$chagaev   = file_get_contents(__DIR__ . '/fixtures/profile-chagaev.html');
$kasatikov = file_get_contents(__DIR__ . '/fixtures/profile-kasatikov.html');

od_test('the fixture is od-dev\'s stale roster', 13 === substr_count($team, 'class="team-member"'));

$roster = od_pages_team($team, 0);

od_test('the class both the grid CSS and the card variant read', str_contains($roster, '{"className":"od-team"}'));
od_test('and it is on the rendered wrapper too', str_contains($roster, 'class="wp-block-group od-team"'));
od_test('eleven links — production\'s roster, not the fixture\'s', 11 === substr_count($roster, '<a href="/profile/'));
od_test(
    'each alone in its own paragraph, which is what parsePost swaps for a card',
    11 === substr_count($roster, "<!-- wp:paragraph -->\n<p><a href=\"/profile/")
);
od_test('the old theme\'s stylesheet is gone', !str_contains($roster, '<style'));
od_test('and the boxes it styled', !str_contains($roster, 'team-member'));
od_test('and the body\'s own <h1>, which the page header draws', !str_contains($roster, '<h1'));
// The point of hardcoding the roster: od-dev lists six people the live site does
// not, and misses two it does.
od_test('nobody who has left the team is still listed', !str_contains($roster, 'Рябовичева') && !str_contains($roster, 'Максимченко'));
od_test('and the two od-dev was missing are on it', str_contains($roster, 'Панферова Анна Андреевна') && str_contains($roster, 'Чернов Евгений Павлович'));
od_test('converted content is left alone', od_pages_team($roster, 0) === $roster);

foreach (OD_TEAM as $member) {
    od_test(
        $member['name'] . ': linked from the page under their own name',
        str_contains($roster, '<a href="' . $member['href'] . '">' . $member['name'] . '</a>')
    );
}

/* -------------------------------------------------------- od_profile_slug */

od_test('od_profile_slug takes the last segment', od_profile_slug('/profile/varlamov/') === 'varlamov');
od_test(
    'and leaves percent-encoding spelled the way the record spells it',
    od_profile_slug('/profile/%d1%87%d0%b5%d1%80%d0%bd%d0%be%d0%b2/') === '%d1%87%d0%b5%d1%80%d0%bd%d0%be%d0%b2'
);

/* ------------------------------------------------------------ od_tel_href */

od_test('od_tel_href normalises a formatted number', od_tel_href('+7 (903) 037-77-08') === 'tel:+79030377708');
od_test('a leading 8 becomes +7', od_tel_href('8-925-190-66-99') === 'tel:+79251906699');
od_test('a year is not a phone number', od_tel_href('2008') === '');
od_test('nor is a ten-digit string', od_tel_href('903 123-45-67') === '');

/* ----------------------------------------------------------- od_tel_label */

od_test('od_tel_label groups a bare run of digits', od_tel_label('+79062755758') === '+7 906 275-57-58');
od_test('a leading 8 is grouped as +7 too', od_tel_label('89113592167') === '+7 911 359-21-67');
od_test('an editor\'s own grouping is left alone', od_tel_label('+7 (962) 950-75-61') === '+7 (962) 950-75-61');
od_test('and so is anything that is not a number', od_tel_label('обратитесь в приёмную') === 'обратитесь в приёмную');

/* -------------------------------------------------- od_canonical_tel_links */

od_test('the fixture writes both its hrefs with dashes', 2 === substr_count($chagaev, 'href="tel:+7-'));
$canon = od_canonical_tel_links($chagaev);
od_test('the city number\'s href is the digits form', str_contains($canon, 'href="tel:+74957225329"'));
od_test('the mobile number\'s too', str_contains($canon, 'href="tel:+79037225329"'));
od_test('and the visible number is left exactly as it was', str_contains($canon, '>+7-495-722-53-29</a>'));
od_test_idempotent('od_canonical_tel_links (already linked)', 'od_canonical_tel_links', $chagaev);

od_test('the second fixture writes its number as plain text', str_contains($kasatikov, 'Тел.: +7 903 037-77-08'));
$linked = od_canonical_tel_links($kasatikov);
od_test(
    'a plain-text number becomes a link, label untouched',
    str_contains($linked, 'Тел.: <a href="tel:+79030377708">+7 903 037-77-08</a>')
);
od_test('an address that was already a link is not linked twice', 1 === substr_count($linked, 'mailto:SilaOtechestva@mail.ru'));
od_test_idempotent('od_canonical_tel_links (plain text)', 'od_canonical_tel_links', $kasatikov);

// The label is fixed on the way past an existing link, not only when one is made:
// a record this script has already linked keeps its text inside the anchor.
$bare = od_canonical_tel_links('<p><a href="tel:+79062755758">+79062755758</a></p>');
od_test('an already-linked bare number is grouped', $bare === '<p><a href="tel:+79062755758">+7 906 275-57-58</a></p>');
od_test_idempotent('od_canonical_tel_links (bare label)', 'od_canonical_tel_links', '<p><a href="tel:+79062755758">+79062755758</a></p>');

// The guard that keeps prose out: a record with a date in it must come back with
// the date as text.
od_test(
    'a year in the prose is not turned into a phone link',
    od_canonical_tel_links('<p>Юридическое - 2008 г.</p>') === '<p>Юридическое - 2008 г.</p>'
);
od_test(
    'and a number inside an attribute is never seen',
    od_canonical_tel_links('<img alt="8-925-190-66-99" />') === '<img alt="8-925-190-66-99" />'
);

/* ---------------------------------------- od_pages_profile_contacts (sweep) */

$kotov     = file_get_contents( __DIR__ . '/fixtures/profile-kotov.html' );
$romanusha = file_get_contents( __DIR__ . '/fixtures/profile-romanusha.html' );

od_test( 'the sweep fixture types its phone and its e-mail as plain text', str_contains( $kotov, 'тел. +7 (963) 032-98-86' ) && str_contains( $kotov, 'e-mail: vvkotof@mail.ru' ) );

$swept = od_pages_profile_contacts( $kotov );
od_test( 'the phone becomes a link, label as typed', str_contains( $swept, 'тел. <a href="tel:+79630329886">+7 (963) 032-98-86</a> (Telegram, Whatsup)' ) );
od_test( 'the e-mail becomes a mailto', str_contains( $swept, '<a href="mailto:vvkotof@mail.ru">vvkotof@mail.ru</a>' ) );
/* The record's photo is `…5d98c0aa-70e7-48f0-a8b3-2c569068839f-300x257.jpg`, which
   reads like an address to any pattern loose enough to catch a real one. */
od_test( 'and a filename inside an attribute is never seen', 2 === substr_count( $swept, '5d98c0aa-70e7-48f0-a8b3-2c569068839f-300x257.jpg' ) && !str_contains( $swept, 'mailto:2c569068839f' ) );
od_test_idempotent( 'od_pages_profile_contacts (kotov)', 'od_pages_profile_contacts', $kotov );

$swept = od_pages_profile_contacts( $romanusha );
od_test( 'a bare run of digits is linked and grouped', str_contains( $swept, '<a href="tel:+79185700050">+7 918 570-00-50</a>' ) );
od_test( 'a VK URL becomes a link, text as typed', str_contains( $swept, '<a href="https://vk.com/romanusha">https://vk.com/romanusha</a>' ) );
od_test_idempotent( 'od_pages_profile_contacts (romanusha)', 'od_pages_profile_contacts', $romanusha );

/* --------------------------------------------------------- od_mailto_links */

od_test( 'an address already linked is not linked twice', od_mailto_links( '<p><a href="mailto:a@b.ru">a@b.ru</a></p>' ) === '<p><a href="mailto:a@b.ru">a@b.ru</a></p>' );
od_test( 'an address inside an attribute is never seen', od_mailto_links( '<img alt="a@b.ru" />' ) === '<img alt="a@b.ru" />' );
/* `\w` under `/u` matches Cyrillic, so a pattern written that way would link
   this. Every address in these records is ASCII, and the pattern says so. */
od_test( 'a Cyrillic pseudo-address is left as text', od_mailto_links( '<p>напишите@нам.рф</p>' ) === '<p>напишите@нам.рф</p>' );

/* --------------------------------------------------------- od_social_links */

od_test( 'a scheme-less VK URL still gets an absolute href', od_social_links( '<p>vk.com/id123</p>' ) === '<p><a href="https://vk.com/id123">vk.com/id123</a></p>' );
od_test( 'a Telegram URL too', od_social_links( '<p>t.me/obshee_delo</p>' ) === '<p><a href="https://t.me/obshee_delo">t.me/obshee_delo</a></p>' );
od_test( 'a trailing full stop stays outside the link', od_social_links( '<p>Мы тут: vk.com/odsamara.</p>' ) === '<p>Мы тут: <a href="https://vk.com/odsamara">vk.com/odsamara</a>.</p>' );
od_test( 'a URL that is already a link is left alone', od_social_links( '<p><a href="https://vk.com/x">https://vk.com/x</a></p>' ) === '<p><a href="https://vk.com/x">https://vk.com/x</a></p>' );
/* `parseProfileBody` reads the host, not a substring, so a link *about* VK on
   another domain is not a contact — and this must not manufacture one either. */
od_test( 'a lookalike host is not a social link', od_social_links( '<p>notvk.com.evil.ru/x</p>' ) === '<p>notvk.com.evil.ru/x</p>' );

/* ------------------------------------------------------ od_pages_profile_team */

$kasatikovMember = null;
foreach (OD_TEAM as $member) {
    if ($member['name'] === 'Касатиков Александр Юрьевич') {
        $kasatikovMember = $member;
    }
}
od_test('the roster holds the member the fixture is', $kasatikovMember !== null);

$led = od_pages_profile_team($kasatikov, 0, $kasatikovMember['role'], $kasatikovMember['contacts']);

// This is the whole reason the lead is prepended rather than appended:
// `parseProfileBody()` reads the *first* bold line as the card's subtitle.
od_test(
    'the merged role is the body\'s first bold line',
    str_contains($led, '<strong>Уполномоченный по развитию в ЦФО. Координатор по Тульской области</strong>')
);
od_test(
    'and the record\'s own regional line is still there, under it',
    strpos($led, '<strong>Уполномоченный') < strpos($led, '<strong>Координатор по Тульской области')
);
od_test('the lead sits inside the paragraph block, not before it', str_contains($led, "<!-- wp:paragraph -->\n<p><strong>Уполномоченный"));

// A run that follows an earlier one with a shorter role rewrites that line rather
// than stacking a second above it — which would leave the card right and the body
// carrying both halves.
$shorter = od_pages_profile_team($kasatikov, 0, 'Уполномоченный по развитию в ЦФО', []);
$upgraded = od_pages_profile_team($shorter, 0, $kasatikovMember['role'], $kasatikovMember['contacts']);
od_test('an earlier, shorter role line is rewritten in place', 1 === substr_count($upgraded, '<strong>Уполномоченный'));
od_test('and the result is what a first run would have written', $upgraded === $led);
od_test(
    'a bold line that is not a prefix of the role is left alone',
    str_contains(od_pages_profile_team($kasatikov, 0, 'Совсем другая роль', []), '<strong>Координатор по Тульской области')
);
od_test('the phone the card needs is now a link', str_contains($led, 'href="tel:+79030377708"'));
od_test('a contact the record already had is not repeated', 1 === substr_count($led, 'mailto:SilaOtechestva@mail.ru'));
od_test('nothing the record held is lost', str_contains($led, 'https://vk.com/id44507712'));
od_test_idempotent(
    'od_pages_profile_team',
    static fn(string $c): string => od_pages_profile_team($c, 0, $kasatikovMember['role'], $kasatikovMember['contacts']),
    $kasatikov
);

/* ------------------------------------------------ od_drop_superseded_lines */

// The bug this fixes, in the shape it shipped in: Варламов's own role line said
// what the merged role now says, so `/profile/varlamov/` printed it twice.
$varlamov = '<!-- wp:paragraph -->' . "\n"
    . '<p><strong>Председатель правления организации, член Межведомственного совета, член общественного совета при ФСИН России</strong></p>' . "\n"
    . '<p>Председатель правления организации, член общественного совета при ФСИН&nbsp;России</p>' . "\n"
    . '<p><a href="mailto:a@b.ru">a@b.ru</a></p>' . "\n"
    . '<!-- /wp:paragraph -->';

$deduped = od_drop_superseded_lines($varlamov, ['Председатель правления организации, член общественного совета при ФСИН России']);
od_test('the superseded line is gone', 1 === substr_count($deduped, 'член общественного совета при ФСИН'));
od_test('the role that swallowed it stays', str_contains($deduped, '<strong>Председатель правления организации, член Межведомственного'));
od_test('and so does everything else', str_contains($deduped, 'mailto:a@b.ru'));
od_test_idempotent(
    'od_drop_superseded_lines',
    static fn(string $c): string => od_drop_superseded_lines($c, ['Председатель правления организации, член общественного совета при ФСИН России']),
    $varlamov
);

od_test('an empty list changes nothing', od_drop_superseded_lines($varlamov, []) === $varlamov);
od_test(
    'a line nobody quoted stays',
    od_drop_superseded_lines('<p>Лектор</p>', ['Психолог-педагог']) === '<p>Лектор</p>'
);
// The corpus writes its lines three ways: a body pasted out of Word is
// `<div><span>`, and one CV is a `<ul>`.
od_test('a <div><span> line matches too', od_drop_superseded_lines('<div><span>Руководитель отделения</span></div>', ['Руководитель отделения']) === '');
od_test('and a bolded <li>', od_drop_superseded_lines('<ul><li><strong>Председатель СРОО «Общее дело»</strong></li></ul>', ['Председатель СРОО «Общее дело»']) === '<ul></ul>');
// What normalisation is for: an editor cannot see any of these three differences.
od_test('a trailing comma does not stop a match', od_drop_superseded_lines('<p><strong>Лектор,</strong></p>', ['Лектор']) === '');
od_test('nor a non-breaking space', od_drop_superseded_lines('<p>Лектор&nbsp;года</p>', ['Лектор года']) === '');
od_test('nor a run of whitespace', od_drop_superseded_lines("<p>Лектор\n  года</p>", ['Лектор года']) === '');

// Every quoted line has to be quoted *correctly*, or it silently matches nothing —
// the same failure mode as a cover swap whose source file is absent.
od_test('every listed line is written the way od_line_text() reads it', (static function (): bool {
    foreach (array_merge(OD_TEAM, OD_SUPERVISORY) as $member) {
        foreach ($member['supersedes'] ?? [] as $line) {
            if (od_line_text($line) !== $line) {
                return false;
            }
        }
    }

    return true;
})());

// A record whose body is not the shape every `profile` has is refused rather than
// led with a paragraph of its own.
$threw = false;
try {
    od_pages_profile_team('<h2>ничего похожего</h2>', 0, 'Роль', []);
} catch (RuntimeException $e) {
    $threw = true;
}
od_test('a record with no paragraph block is refused', $threw);

/* --------------------------------------- /about/supervisory/ (D3, team-2) */

$supervisory = file_get_contents(__DIR__ . '/fixtures/page-supervisory.html');

// The fixture is od-dev's copy, last edited 2021 — four members, one of whom has
// since left the council. Production's page is the roster; this is why it is not
// read out of the page.
od_test('the fixture is the 2021 four-member page', 4 === substr_count($supervisory, '<b>'));

$council = od_pages_supervisory($supervisory, 0);

od_test('the statement is the illustrated card', str_contains($council, 'od-card od-card--goal od-card--supervisory'));
od_test('headed by the page\'s own <h2>', str_contains($council, '<h2 class="wp-block-heading">Наблюдательный совет Общероссийской'));
od_test('with the remit under it', str_contains($council, 'Наблюдательный совет создан в целях обеспечения'));
od_test('and the aim under «Цель»', str_contains($council, '<h2 class="wp-block-heading">Цель</h2>') && str_contains($council, 'Основной целью Наблюдательного совета'));
od_test('the centring the old theme needed is gone', !str_contains($council, 'text-align'));

od_test('seven tasks, as tiles in a grid', str_contains($council, '{"className":"od-tasks"}') && 7 === substr_count($council, '{"className":"od-task"}'));
od_test('numbered 01 to 07', str_contains($council, '>01</p>') && str_contains($council, '>07</p>'));
od_test('the list they were is gone', !str_contains($council, '<li>') && !str_contains($council, '<ul>'));
od_test('and the bold paragraph that stood in for their heading', !str_contains($council, '<strong>Задачи'));
od_test('replaced by a real one', str_contains($council, '<h2 class="wp-block-heading">Задачи Наблюдательного совета</h2>'));

od_test('three members — production\'s roster, not the fixture\'s four', 3 === substr_count($council, '<a href="/profile/'));
od_test('as the same grid /team/ uses, so one component draws a person everywhere', 1 === substr_count($council, '{"className":"od-team"}'));
od_test('nobody who has left the council is listed', !str_contains($council, 'Варламов'));
od_test('the hand-built image rows are gone', !str_contains($council, '<figure') && !str_contains($council, 'wp-block-image'));
od_test('and so are the contacts the records now hold', !str_contains($council, 'mailto:'));
od_test('converted content is left alone', od_pages_supervisory($council, 0) === $council);

foreach (OD_SUPERVISORY as $member) {
    od_test(
        $member['name'] . ': linked from the council page',
        str_contains($council, '<a href="' . $member['href'] . '">' . $member['name'] . '</a>')
    );
}

// Павел Калашников sits on both councils and has one record, so his role is
// `OD_TEAM`'s and this page contributes only what it said about him.
$both = array_values(array_filter(OD_SUPERVISORY, static fn(array $m): bool => !isset($m['role'])));
od_test('the member on both councils carries no second role', count($both) === 1);
od_test('and it is Калашников', $both[0]['name'] === 'Калашников Павел Сергеевич');

$kalashnikov = null;
foreach (OD_TEAM as $member) {
    if ($member['name'] === 'Калашников Павел Сергеевич') {
        $kalashnikov = $member;
    }
}
od_test('his description reaches his record as prose', isset($kalashnikov['prose']));

$withProse = od_pages_profile_team(
    '<!-- wp:paragraph -->' . "\n" . '<p>Что-то ещё</p>' . "\n" . '<!-- /wp:paragraph -->',
    0,
    'Роль',
    [],
    'Предприниматель, отец двоих детей.'
);
od_test('prose lands inside the paragraph block, after what was there', str_contains($withProse, '<p>Что-то ещё</p>' . "\n" . '<p>Предприниматель, отец двоих детей.</p>'));
od_test('and the role still leads', strpos($withProse, '<strong>Роль</strong>') < strpos($withProse, 'Предприниматель'));
od_test_idempotent(
    'od_pages_profile_team (with prose)',
    static fn(string $c): string => od_pages_profile_team($c, 0, 'Роль', [], 'Предприниматель, отец двоих детей.'),
    '<!-- wp:paragraph -->' . "\n" . '<p>Что-то ещё</p>' . "\n" . '<!-- /wp:paragraph -->'
);

// -- every transform refuses input it does not recognise --------------------------------

foreach ([
    'od_pages_healthy_youth',
    'od_pages_healthy_kids',
    'od_pages_projects',
    'od_pages_materials',
    'od_pages_printed_products',
    'od_pages_social_reklama',
    'od_pages_billboards',
    'od_pages_plakati',
    'od_pages_sticker',
    'od_pages_led_board_roliki',
    'od_pages_audio_roliki',
    'od_pages_autosticker',
    'od_pages_zakladki',
    'od_pages_booklet',
    'od_pages_disk',
    'od_pages_books',
    'od_pages_team',
    'od_pages_supervisory',
    'od_pages_post_cards',
    'od_pages_documents',
    'od_pages_activist_stories',
    'od_pages_udostoverenie',
    'od_pages_ustav',
    'od_pages_partners',
] as $transform) {
    $threw = false;
    try {
        $transform('<!-- wp:paragraph --><p>что-то другое</p><!-- /wp:paragraph -->', 666);
    } catch (RuntimeException $e) {
        $threw = true;
    }
    od_test($transform . ': unexpected input is refused, not half-converted', $threw);
}

/* ------------------------------------------------- od_pages_post_cards (D6p) */

$reviews = file_get_contents( __DIR__ . '/fixtures/about-reviews.before.html' );
$smi     = file_get_contents( __DIR__ . '/fixtures/about-smi.before.html' );

od_test( 'the reviews fixture really carries the sidebar shortcode', false !== strpos( $reviews, '[cmsms_sidebar' ) );
od_test( 'the reviews fixture really carries the dead MailPoet form', false !== strpos( $reviews, '[wysija_form' ) );
od_test( 'the reviews fixture really carries the old theme CSS', false !== strpos( $reviews, '<style' ) );

$cards = od_pages_post_cards( $reviews, 0 );

od_test( 'post cards: the sidebar shortcode is gone', false === strpos( $cards, '[cmsms_sidebar' ) );
od_test( 'post cards: the MailPoet form is gone', false === strpos( $cards, '[wysija_form' ) );
od_test( 'post cards: the old theme CSS is gone', false === strpos( $cards, '<style' ) );
od_test( 'post cards: the two-column shell is gone', false === strpos( $cards, 'wp-block-column' ) );
od_test( 'post cards: the query keeps its own id', false !== strpos( $cards, '"queryId":96' ) );
od_test( 'post cards: the query keeps its own category', false !== strpos( $cards, '"category":[570]' ) );
od_test( 'post cards: the query keeps its page size', false !== strpos( $cards, '"perPage":12' ) );
od_test( 'post cards: the block is classed for gutenberg.css', false !== strpos( $cards, '"className":"od-post-cards"' ) );
od_test( 'post cards: and carries the class in its markup too', false !== strpos( $cards, 'class="wp-block-query od-post-cards"' ) );
od_test( 'post cards: three to a row', false !== strpos( $cards, '"columnCount":3' ) );
od_test( 'post cards: the cover links to the post', false !== strpos( $cards, '<!-- wp:post-featured-image {"isLink":true} /-->' ) );
od_test( 'post cards: so does the title', false !== strpos( $cards, '<!-- wp:post-title {"isLink":true} /-->' ) );
od_test( 'post cards: the excerpt is kept', false !== strpos( $cards, '<!-- wp:post-excerpt /-->' ) );
od_test( 'post cards: the date is dropped — the mock shows none', false === strpos( $cards, 'post-date' ) );
od_test( 'post cards: pagination survives', 1 === substr_count( $cards, '<!-- wp:query-pagination ' ) );
od_test( 'post cards: with all three of its parts', 3 === substr_count( $cards, '<!-- wp:query-pagination-' ) );
od_test( 'post cards: its arrows are the mock\'s chips, not spelled-out labels', false !== strpos( $cards, '<!-- wp:query-pagination {"paginationArrow":"chevron","showLabel":false} -->' ) );
od_test( 'post cards: it is idempotent', od_pages_post_cards( $cards, 0 ) === $cards );

$smiCards = od_pages_post_cards( $smi, 0 );

od_test( 'post cards: /about/smi/ keeps its own query id', false !== strpos( $smiCards, '"queryId":95' ) );
od_test( 'post cards: /about/smi/ keeps its own category', false !== strpos( $smiCards, '"category":[79]' ) );
od_test( 'post cards: the two pages differ only in that query', str_replace( array( '"queryId":95', '"category":[79]' ), array( '"queryId":96', '"category":[570]' ), $smiCards ) === $cards );

od_test( 'post cards: every /about/ post-card page is registered', 7 === count( array_filter( od_pages_registry(), function ( $entry ) {
	return 'od_pages_post_cards' === $entry['fix'];
} ) ) );

/* -------------------------------------------------- od_pages_documents (D6q) */

$experts = file_get_contents( __DIR__ . '/fixtures/about-experts-review.before.html' );
$docs    = file_get_contents( __DIR__ . '/fixtures/about-docs.before.html' );

od_test( 'the experts fixture really carries 33 download rows', 33 === count( od_pages_document_rows( $experts ) ) );
od_test( 'the docs fixture really carries 23 of them', 23 === count( od_pages_document_rows( $docs ) ) );

$rows = od_pages_document_rows( $experts );
od_test( 'document rows: the name comes back without its markup', 'Комплекное социокультурное исследование медиасреды видеопродуктов ООО "Общее Дело" - 2020.pdf' === $rows[0]['title'] );
od_test( 'document rows: so does the file it links to', 'https://yadi.sk/i/EuouI-VMlqZndA' === $rows[0]['href'] );

$built = od_pages_documents( $experts, 0 );

od_test( 'documents: one card per document', 33 === substr_count( $built, 'wp-block-column od-asset' ) );
od_test( 'documents: three to a row', 11 === substr_count( $built, '"className":"od-assets od-assets--3"' ) );
od_test( 'documents: every card has its download', 33 === substr_count( $built, '<!-- wp:buttons {"className":"od-asset-actions"} -->' ) );
od_test( 'documents: the button is the mock\'s outline one', 33 === substr_count( $built, '"className":"is-style-outline"' ) );
od_test( 'documents: and reads «Скачать» on all of them', 33 === substr_count( $built, '>Скачать</a>' ) );
od_test( 'documents: the stored label is gone', false === strpos( $built, 'Смотреть/Скачать' ) );
od_test( 'documents: the separators are gone', false === strpos( $built, 'wp:separator' ) );
od_test( 'documents: the MailPoet form is gone', false === strpos( $built, '[wysija_form' ) );
od_test( 'documents: the first file is still linked', false !== strpos( $built, 'href="https://yadi.sk/i/EuouI-VMlqZndA"' ) );
od_test( 'documents: it is idempotent', od_pages_documents( $built, 0 ) === $built );

$builtDocs = od_pages_documents( $docs, 0 );
od_test( 'documents: /about/docs/ splits its row 66.67/33.33 and is read the same way', 23 === substr_count( $builtDocs, 'wp-block-column od-asset' ) );
od_test( 'documents: its last row holds the two left over', 8 === substr_count( $builtDocs, '"className":"od-assets od-assets--3"' ) );
od_test( 'documents: a local upload keeps its root-relative path for the pipeline to fix', false !== strpos( $builtDocs, 'href="/wp-content/uploads/2019/03/2012-Устав-ОБЩЕЕ-ДЕЛО.pdf"' ) );

/* ------------------------------------------ od_pages_activist_stories (D6r) */

$stories = file_get_contents( __DIR__ . '/fixtures/about-activist-stories.before.html' );

od_test( 'the stories fixture really carries 25 video rows', 25 === count( od_pages_story_rows( $stories ) ) );

$storyRows = od_pages_story_rows( $stories );

od_test( 'story rows: the url is unescaped back out of the block attribute', 'https://youtu.be/5WFYZZRhjfo' === $storyRows[0]['url'] );
od_test( 'story rows: the name is the row\'s <strong>', 'Свиридов Алексей Владимирович' === $storyRows[0]['name'] );
od_test( 'story rows: the joining dash goes and the sentence starts itself', 'Режиссёр, руководитель киностудии ApostolFilms благодарит организацию ООО «Общее Дело» за неоценимый вклад в нравственное просвещение молодёжи' === $storyRows[0]['about'] );
od_test( 'story rows: a row that never had a dash reads the same way', 'Пастухов Сергей' === $storyRows[22]['name'] && 0 === mb_strpos( $storyRows[22]['about'], 'Родом из Магадана' ) );
od_test( 'story rows: the text half is read whichever column it sits in', 'https://youtu.be/JZRKwu3yPr8' === $storyRows[1]['url'] && 'Моисеев Олег Олегович' === $storyRows[1]['name'] );

$built = od_pages_activist_stories( $stories, 0 );

od_test( 'stories: one row per video', 25 === substr_count( $built, '"className":"od-story"' ) );
od_test( 'stories: each row is two columns', 50 === substr_count( $built, '<!-- wp:column -->' ) );
od_test( 'stories: every video is kept', 25 === substr_count( $built, '<!-- wp:embed ' ) );
od_test( 'stories: the video is always the first column', 25 === substr_count( $built, "<div class=\"wp-block-columns od-story\"><!-- wp:column -->\n<div class=\"wp-block-column\">\n<!-- wp:embed " ) );
od_test( 'stories: the name is a heading', 25 === substr_count( $built, '<!-- wp:heading {"level":3} -->' ) );
od_test( 'stories: the MailPoet form is gone', false === strpos( $built, '[wysija_form' ) );
od_test( 'stories: the separators are gone', false === strpos( $built, 'wp:separator' ) );
od_test( 'stories: it is idempotent', od_pages_activist_stories( $built, 0 ) === $built );

od_test( 'od_pages_sentence_case upper-cases a Cyrillic first letter', 'Режиссёр' === od_pages_sentence_case( 'режиссёр' ) );
od_test( 'od_pages_sentence_case leaves an empty string alone', '' === od_pages_sentence_case( '' ) );

/* ----------------------------------------------- od_pages_udostoverenie (D6s) */

$certificate = file_get_contents( __DIR__ . '/fixtures/about-udostoverenie.before.html' );
$built       = od_pages_udostoverenie( $certificate, 0 );

od_test( 'certificate: without an upload it falls back to the page\'s own photo', false !== strpos( $built, '"className":"od-hero"' ) && false !== strpos( $built, '"id":20112' ) );

$cropped = od_pages_udostoverenie( $certificate, 0, array( 'id' => '76023', 'src' => 'https://wp.test/wp-content/uploads/2026/08/udostoverenie-hero.jpg' ) );
od_test( 'certificate: the runner\'s upload is what the hero draws when there is one', false !== strpos( $cropped, '<!-- wp:image {"id":76023,"sizeSlug":"full"} -->' ) && false !== strpos( $cropped, 'src="https://wp.test/wp-content/uploads/2026/08/udostoverenie-hero.jpg"' ) );
od_test( 'certificate: and the uncropped original is not left behind with it', false === strpos( $cropped, 'c07f3ba5595b9713e6e46bcf417c9a3e' ) );
od_test( 'certificate: only the hero changes between the two', $cropped !== $built && substr( $cropped, strpos( $cropped, '<!-- wp:columns' ) ) === substr( $built, strpos( $built, '<!-- wp:columns' ) ) );
od_test( 'certificate: the cropped run is idempotent too', od_pages_udostoverenie( $cropped, 0, array( 'id' => '76023', 'src' => 'x' ) ) === $cropped );
od_test( 'certificate: the upload is named in the registry, not written into the transform', 1 === count( array_filter( od_pages_registry(), function ( $entry ) {
	return 'udostoverenie-hero' === ( $entry['attachment'] ?? '' );
} ) ) );
od_test( 'certificate: the hero image is out of the prose', 1 === substr_count( $built, '<!-- wp:image ' ) );
od_test( 'certificate: the row is 814 + 386', false !== strpos( $built, '"width":"65.65%"' ) && false !== strpos( $built, '"width":"31.13%"' ) );
od_test( 'certificate: the lead is set as one', false !== strpos( $built, '<p><strong>Общероссийская общественная организация' ) );
od_test( 'certificate: the note stops where the contacts start', false !== strpos( $built, '<p>Если у вас возникают сомнения в компетентности обратившегося к вам человека или группы лиц – пожалуйста, свяжитесь с нами для подтверждения.</p>' ) );
od_test( 'certificate: the phone is a row of its own', false !== strpos( $built, '<p class="od-contact od-contact--phone"><a href="tel:+79629507561">+7 (962) 950-75-61</a></p>' ) );
od_test( 'certificate: so is the mail', false !== strpos( $built, '<p class="od-contact od-contact--email"><a href="mailto:post27@bk.ru">post27@bk.ru</a></p>' ) );
od_test( 'certificate: Skype is dropped', false === strpos( $built, 'aleksey.od' ) );
od_test( 'certificate: the contact sentence is not left in the prose too', 1 === substr_count( $built, 'свяжитесь с нами для подтверждения' ) );
od_test( 'certificate: the membership document keeps its link', false !== strpos( $built, 'href="/wp-content/uploads/2019/10/Положение-о-членстве-4.docx"' ) );
od_test( 'certificate: under the heading the mock gives it', false !== strpos( $built, '<h3 class="wp-block-heading">Положение о членстве</h3>' ) );
od_test( 'certificate: the MailPoet form is gone', false === strpos( $built, '[wysija_form' ) );
od_test( 'certificate: the closing paragraph is kept', false !== strpos( $built, 'С уважением, председатель правления' ) );
od_test( 'certificate: it is idempotent', od_pages_udostoverenie( $built, 0 ) === $built );

/* ------------------------------------------------------ od_pages_ustav (D6t) */

$charter = file_get_contents( __DIR__ . '/fixtures/about-ustav.before.html' );

od_test( 'the charter fixture really holds 361 paragraphs in 4 blocks', 361 === substr_count( $charter, '<p' ) && 4 === substr_count( $charter, '<!-- wp:paragraph' ) );
od_test( 'and its headings really arrive in three shapes', 4 === substr_count( $charter, '<ol start=' ) && false !== strpos( $charter, '<p>1. ОБЩИЕ ПОЛОЖЕНИЯ.</p>' ) && false !== strpos( $charter, 'проводимых Организацией. 5. КОНТРОЛЬНО' ) );

$built = od_pages_ustav( $charter, 0 );

od_test( 'charter: nine sections, nine headings', 9 === substr_count( $built, '<!-- wp:heading' ) );
od_test( 'charter: each is an anchor the list can reach', 9 === substr_count( $built, '<h2 class="wp-block-heading" id="ustav-' ) );
od_test( 'charter: the contents list links all nine', 9 === substr_count( $built, '<li><a href="#ustav-' ) );
od_test( 'charter: the first heading is sentence-cased, not shouted', false !== strpos( $built, '<h2 class="wp-block-heading" id="ustav-1">Общие положения</h2>' ) );
od_test( 'charter: the one buried mid-paragraph is lifted out', false !== strpos( $built, '<h2 class="wp-block-heading" id="ustav-5">Контрольно-ревизионные органы организации</h2>' ) );
od_test( 'charter: and the paragraph it was stuck to keeps its own text', false !== strpos( $built, '<p>- принимать участие во всех мероприятиях, организуемых и проводимых Организацией.</p>' ) );
od_test( 'charter: the four one-item lists are gone', false === strpos( $built, '<ol start=' ) );
od_test( 'charter: every paragraph is a block of its own', 349 === substr_count( $built, '<!-- wp:paragraph' ) );
od_test( 'charter: which accounts for all 361 less the headings, the title, the download row and the dead form', 361 === 349 + 9 + 1 + 1 + 1 );
od_test( 'charter: the MailPoet form is gone', false === strpos( $built, '[wysija_form' ) );
od_test( 'charter: the row is the mock\'s 384 + 814', false !== strpos( $built, '"width":"30.97%"' ) && false !== strpos( $built, '"width":"65.65%"' ) );
od_test( 'charter: the duplicate «Положение о членстве» download is dropped', false === strpos( $built, 'Положение о членстве' ) );
od_test( 'charter: so is the «УСТАВ» line PageHeader already draws', false === strpos( $built, '<p class="od-charter-preamble"><strong>УСТАВ</strong></p>' ) );
od_test( 'charter: the approving protocol is kept', false !== strpos( $built, 'УТВЕРЖДЕН СЪЕЗДОМ ДЕЛЕГАТОВ ПРОТОКОЛ №3' ) );
od_test( 'charter: the migrator\'s inline font spans are gone', false === strpos( $built, 'font-size: 12pt' ) );
od_test( 'charter: it is idempotent', od_pages_ustav( $built, 0 ) === $built );

$threw = false;
try {
	od_pages_ustav( str_replace( 'ПОРЯДОК ВНЕСЕНИЯ ИЗМЕНЕНИЙ В УСТАВ', 'что-то другое', $charter ), 0 );
} catch ( RuntimeException $e ) {
	$threw = true;
}
od_test( 'charter: a missing section heading is refused, not silently dropped', $threw );

/* --------------------------------------------------- od_pages_partners (D6u) */

$partners = file_get_contents( __DIR__ . '/fixtures/about-nashi-partnery.before.html' );

od_test( 'the partners fixture really carries 49 logos and 41 rules', 49 === substr_count( $partners, '<img' ) && 41 === substr_count( $partners, '<!-- wp:separator' ) );

$built = od_pages_partners( $partners, 0 );

od_test( 'partners: every logo is kept', 49 === substr_count( $built, '<!-- wp:image' ) );
od_test( 'partners: four to a row, thirteen rows', 13 === substr_count( $built, '"className":"od-figures od-figures--4 od-figures--logos"' ) );
od_test( 'partners: the name travels with the picture as its caption', false !== strpos( $built, '<figcaption class="wp-element-caption">Агентство стратегических инициатив</figcaption>' ) );
od_test( 'partners: a logo with no name gets no empty caption', false === strpos( $built, '<figcaption class="wp-element-caption"></figcaption>' ) );
od_test( 'partners: no image block claims id 0', false === strpos( $built, '"id":0' ) );
od_test( 'partners: the rules between rows are gone', false === strpos( $built, 'wp:separator' ) );
od_test( 'partners: so are the three empty spacer groups', false === strpos( $built, 'wp:group' ) );
od_test( 'partners: the MailPoet form is gone', false === strpos( $built, '[wysija_form' ) );
od_test( 'partners: it is idempotent', od_pages_partners( $built, 0 ) === $built );

/* ------------------------------------------------------ od_pages_about (D6w) */

$about = file_get_contents( __DIR__ . '/fixtures/page-about.html' );

od_test( 'the about fixture really carries twelve tiles, three scans and the video', 12 === substr_count( $about, '>Смотреть</a>' ) && 3 === substr_count( $about, '<!-- wp:image' ) && 1 === substr_count( $about, '<!-- wp:embed' ) );

$built = od_pages_about( $about, 0 );

/* The lead — the mock's two columns out of one stored sentence. */
od_test( 'about: the lead keeps its own half and gains a stop', false !== strpos( $built, '<p class="od-lead-title">«Общее дело» — общероссийская общественная организация, основанная в 2012 году.</p>' ) );
od_test( 'about: the hyphen doing an em dash\'s job is replaced', false === strpos( $built, '«Общее дело» - общероссийская' ) );
od_test( 'about: the bold half opens with «Активно занимающаяся», not mid-sentence', false !== strpos( $built, '<p class="od-lead-text">Активно занимающаяся профилактикой' ) );
od_test( 'about: the shouting is left to the stylesheet', false === strpos( $built, 'ОБЩЕРОССИЙСКАЯ ОБЩЕСТВЕННАЯ' ) );
od_test( 'about: the history flows across two columns, unlabelled', false !== strpos( $built, '<p class="od-prose-2">В 2011 году' ) && false === strpos( $built, '<strong>История</strong>' ) );

/* The disclosure: `about` and `about-learn-more` are this one page. */
od_test( 'about: one core/details, opening on «Узнать больше»', 1 === substr_count( $built, '<!-- wp:details' ) && false !== strpos( $built, '<summary>Узнать больше</summary>' ) );

$read = substr( $built, strpos( $built, '<summary>' ), strpos( $built, '</details>' ) - strpos( $built, '<summary>' ) );

od_test( 'about: the mission card is inside the read, with its own drawing', false !== strpos( $read, 'od-card od-card--goal od-card--mission' ) && false !== strpos( $read, '<h2 class="wp-block-heading">Миссия</h2>' ) );
od_test( 'about: so are the four sections the expanded frame adds', 1 === substr_count( $read, '>Цели</h2>' ) && 1 === substr_count( $read, '>Задачи</h2>' ) && 1 === substr_count( $read, '>Описание деятельности</h2>' ) && 1 === substr_count( $read, '>Фильмы и мультфильмы организации</h2>' ) );
od_test( 'about: and the cards are not — they show whether the read is open or shut', false === strpos( $read, 'od-tiles' ) );

/* Цели and Задачи: the same tile, ordinals against icons. */
od_test( 'about: four numbered goals', 1 === substr_count( $built, '"className":"od-tasks"' ) && 4 === substr_count( $read, '"className":"od-task"' ) );
od_test( 'about: a goal is a sentence — no dash, no semicolon, a stop', false !== strpos( $read, '<p>Укрепление морально-нравственных, общечеловеческих и духовных ценностей в обществе.</p>' ) );
od_test( 'about: a goal that already ended in a stop does not gain a second', false === strpos( $built, 'образа жизни..' ) );
od_test( 'about: four task cards, two to a row, icons in the stored order', 1 === substr_count( $built, '"className":"od-tasks od-tasks--2"' ) && false !== strpos( $read, '"className":"od-task od-task--education"' ) && false !== strpos( $read, '"className":"od-task od-task--materials"' ) );

/* «Описание деятельности»: a label beside each project. */
od_test( 'about: three labelled project rows', 3 === substr_count( $built, '"className":"od-labelled"' ) );
od_test( 'about: the label is the project the paragraph names', false !== strpos( $read, '<p class="od-label">Проект «Путь героя»</p>' ) );
od_test( 'about: the state-cooperation paragraph flows across three columns', false !== strpos( $read, '<p class="od-prose-3">Общественная организация «Общее дело» тесно сотрудничает' ) );
od_test( 'about: its three sentences keep the space the `<br />`s stood for', false !== strpos( $read, 'наказаний. Совместную работу' ) && false === strpos( $read, 'наказаний.Совместную' ) );

/* The films, which have no frame and stay anyway. */
od_test( 'about: the films are a list of twelve under their own lead', 12 === substr_count( $read, '<!-- wp:list-item -->' ) && false !== strpos( $read, '<p>Общественной организацией «Общее дело» созданы следующие фильмы' ) );
od_test( 'about: a film keeps its whole sentence', false !== strpos( $read, '<li>«Тайна едкого дыма. Команда Познавалова» - мультфильм' ) );

/* The cards. */
od_test( 'about: seven cards — one wide row of four, one portrait row of three', 1 === substr_count( $built, '<!-- wp:columns {"className":"od-tiles od-tiles--wide"}' ) && 1 === substr_count( $built, '<!-- wp:columns {"className":"od-tiles"}' ) && 7 === substr_count( $built, '"className":"od-tile od-tile--about-' ) );

foreach ( array( '/team/', '/about/experts-review/', '/about/ustav/', '/about/smi/', '/about/activist-stories/', '/about/reviews/', '/about/udostoverenie/', '/about/nashi_partnery/' ) as $href ) {
	od_test( "about: «{$href}» is reachable from the page", false !== strpos( $built, sprintf( '<a href="%s">', $href ) ) );
}

od_test( 'about: the tile\'s stale /smi/ is written as the page\'s real address', false === strpos( $built, '<a href="/smi/">' ) );
od_test( 'about: «Устав» and «Документы» are one card into the tabbed pair', false !== strpos( $built, '>Устав и документы</h3>' ) && false === strpos( $built, '<a href="/about/docs/">' ) );
od_test( 'about: the council is the team card, not a second card of its own', false !== strpos( $built, '>Команда и наблюдательный совет</h3>' ) && false === strpos( $built, '/about/supervisory/' ) );
od_test( 'about: the statistics site is not linked until it is rebuilt', false === strpos( $built, 'xn--80a7adb' ) );
od_test( 'about: «Оставь свой отзыв» is left to the footer', false === strpos( $built, '/about/ostavit-otziv/' ) );
od_test( 'about: no card points at the private «Наши отчеты»', false === strpos( $built, '/about/reports/' ) && false === strpos( $built, '>Отчеты</h3>' ) );
od_test( 'about: the hero plays from Kinescope, not YouTube', 1 === substr_count( $built, 'kinescope.io/embed/54cb9a3e-b852-4c61-938f-b0b77d05d192' ) && false === strpos( $built, 'youtube' ) && false === strpos( $built, '>Видеопрезентация</h3>' ) );

/* The partner strip, and what it is the top of. */
od_test( 'about: four logos inside one card, named', 1 === substr_count( $built, '"className":"od-figures od-figures--4 od-figures--logos"' ) && false !== strpos( $built, '<figcaption class="wp-element-caption">Правительство Республики Татарстан</figcaption>' ) );
od_test( 'about: the strip is the partner page\'s own first four, in its order', OD_ABOUT_PARTNERS[0]['caption'] === 'Агентство стратегических инициатив' && 4 === count( OD_ABOUT_PARTNERS ) );

/* The legal details and the scans that prove them. */
od_test( 'about: the four legal lines are kept, labelled', 1 === substr_count( $built, '<strong>Полное название:</strong>' ) && false !== strpos( $built, '<strong>КПП:</strong> 772101001' ) );
od_test( 'about: the stored straight quote in the name is closed properly', false !== strpos( $built, 'нации «Общее дело»</p>' ) );
od_test( 'about: the three scans keep the ids and the paths the page stores', 3 === substr_count( $built, '"sizeSlug":"full","linkDestination":"custom"' ) && false !== strpos( $built, '"id":33139' ) && false !== strpos( $built, '"className":"od-figures od-figures--3"' ) );

/* What goes. */
od_test( 'about: the dead MailPoet form and its heading are gone', false === strpos( $built, 'wysija' ) && false === strpos( $built, 'Хотите быть в курсе' ) );
od_test( 'about: so is every cmsms icon box', false === strpos( $built, 'cmsms-icon-box' ) && false === strpos( $built, '>Смотреть</a>' ) );

od_test( 'about: it is idempotent', od_pages_about( $built, 0 ) === $built );

/* A page that is not this one is refused rather than rewritten. */
$threw = false;
try {
	od_pages_about( '<!-- wp:paragraph -->\n<p>Ни одной подписи.</p>\n<!-- /wp:paragraph -->', 0 );
} catch ( RuntimeException $e ) {
	$threw = true;
}
od_test( 'about: a body with none of the labels is refused', $threw );

/* Every card names a drawing the stylesheet has a rule for — a card with no rule
   renders as an empty box, which is the one failure this file can catch. */
$css = file_get_contents( __DIR__ . '/../../src/shared/ui/theme/gutenberg/gutenberg.css' );
foreach ( array_merge( OD_ABOUT_CARDS, OD_ABOUT_CARDS_SMALL ) as $card ) {
	od_test( "about: `.od-tile--{$card['id']}` has a drawing", false !== strpos( $css, ".od-tile--{$card['id']}::before" ) );
}
foreach ( OD_ABOUT_TASK_ICONS as $icon ) {
	od_test( "about: `.od-task--{$icon}` has an icon", false !== strpos( $css, ".od-task--{$icon}::before" ) );
}
/* The other half of the disclosure: the closed label is content, the open one
   can only be the stylesheet's — a `<details>` cannot swap its own summary. */
od_test( 'about: the stylesheet carries the label the summary cannot', false !== strpos( $css, "content: 'Свернуть'" ) );

/* --------------------------------------------------------- the about helpers */

od_test( 'od_about_items strips the dash, the semicolon and adds one stop', array( 'Первое.', 'Второе.' ) === od_about_items( '- первое;<br />- второе.' ) );
od_test( 'od_about_items drops an empty item', array( 'Одно.' ) === od_about_items( '- одно.<br />' ) );
od_test( 'od_about_lead ends the sentence it cuts', 'Организация, основанная в 2012 году.' === od_about_lead( 'Организация, основанная в 2012 году,' ) );
od_test( 'od_about_project_label reads the quoted name', 'Проект «Путь героя»' === od_about_project_label( 'Разработан и реализуется проект «Путь героя», направленный на…' ) );

$threw = false;
try {
	od_about_project_label( 'Никакого проекта здесь нет.' );
} catch ( RuntimeException $e ) {
	$threw = true;
}
od_test( 'od_about_project_label refuses a paragraph with no project in it', $threw );

od_test( 'od_pages_list writes one list-item block per item', "<!-- wp:list -->\n<ul class=\"wp-block-list\"><!-- wp:list-item -->\n<li>раз</li>\n<!-- /wp:list-item -->\n</ul>\n<!-- /wp:list -->\n\n" === od_pages_list( array( 'раз' ) ) );
od_test( 'od_pages_details closes the element it opens', false !== strpos( od_pages_details( 'Ещё', 'x' ), '<details class="wp-block-details od-more"><summary>Ещё</summary>' ) && false !== strpos( od_pages_details( 'Ещё', 'x' ), "</details>\n<!-- /wp:details -->" ) );
od_test( 'od_pages_icon_tasks marks a card with no icon rather than mislabelling it', false !== strpos( od_pages_icon_tasks( array( 'a', 'b' ), array( 'education' ) ), 'od-task od-task--none' ) );
od_test( 'od_pages_goal_card still heads the programme card as it did', false !== strpos( od_pages_goal_card( 'x' ), '>Цель программы</h2>' ) && false !== strpos( od_pages_goal_card( 'x' ), '"className":"od-card od-card--goal"' ) );

/* --------------------------------------- od_pages_samarskaya_coordinators */

$samarskaya = file_get_contents( __DIR__ . '/fixtures/contacts-samarskaya.before.html' );

od_test( 'samarskaya: the fixture really carries the "match nothing" placeholder', 1 === substr_count( $samarskaya, '"taxQuery":{"post_tag":[-1]}' ) );

$repointed = od_pages_samarskaya_coordinators( $samarskaya, 532 );
od_test( 'samarskaya: the coordinator query asks for the region', false !== strpos( $repointed, '"taxQuery":{"pl-categs":[532]}' ) );
od_test( 'samarskaya: no placeholder left', false === strpos( $repointed, '"post_tag":[-1]' ) );
/* The «События» query is the page's other block and is not this one's business. */
od_test( 'samarskaya: the news query is untouched', false !== strpos( $repointed, '"taxQuery":{"category":[61]}' ) );
od_test( 'samarskaya: nothing else moved', strlen( $samarskaya ) + strlen( '"pl-categs":[532]' ) - strlen( '"post_tag":[-1]' ) === strlen( $repointed ) );
od_test_idempotent( 'od_pages_samarskaya_coordinators', function ( $content ) { return od_pages_samarskaya_coordinators( $content, 532 ); }, $samarskaya );

/* Term ids are per-environment, so a page fixed on one install must not be
   "already in shape" on another — the id has to come from the runner. */
od_test( 'samarskaya: a different environment gets its own id', false !== strpos( od_pages_samarskaya_coordinators( $samarskaya, 7 ), '"pl-categs":[7]' ) );

$threw = false;
try {
	od_pages_samarskaya_coordinators( '<!-- wp:paragraph --><p>Другая страница</p><!-- /wp:paragraph -->', 532 );
} catch ( RuntimeException $e ) {
	$threw = true;
}
od_test( 'samarskaya: refuses a page that is not the one', $threw );

/* --------------------------------- od_pages_coordinator_heading_level */

$region = file_get_contents( __DIR__ . '/fixtures/contacts-samarskaya.before.html' );
od_test( 'the regional fixture writes its card title at level 3', str_contains( $region, '<!-- wp:post-title {"isLink":true,"level":3} /-->' ) );

$demoted = od_pages_coordinator_heading_level( $region );
od_test( 'the card title becomes level 2', str_contains( $demoted, '<!-- wp:post-title {"isLink":true,"level":3} /-->' ) === false && str_contains( $demoted, '"level":2} /-->' ) );
od_test( 'and the «События» heading it now sits level with is untouched', str_contains( $demoted, '<h2 id="news_section">События</h2>' ) );
od_test_idempotent( 'od_pages_coordinator_heading_level', 'od_pages_coordinator_heading_level', $region );

/* A sweep runs over a whole subtree, so a page of it with no query block has to
   come back unchanged rather than raise. */
od_test( 'a page with no card titles is left alone', od_pages_coordinator_heading_level( '<!-- wp:paragraph --><p>Текст</p><!-- /wp:paragraph -->' ) === '<!-- wp:paragraph --><p>Текст</p><!-- /wp:paragraph -->' );
/* Only the post-title block: a `level` in any other block is somebody else's. */
od_test( 'a level on another block is not touched', od_pages_coordinator_heading_level( '<!-- wp:heading {"level":3} --><h3>Раздел</h3><!-- /wp:heading -->' ) === '<!-- wp:heading {"level":3} --><h3>Раздел</h3><!-- /wp:heading -->' );

/* The level change is only safe because the stylesheet holds the look: the base
   `h2` rule is a size larger than the base `h3`, and a card title should not
   grow for being promoted. */
$gutenberg = file_get_contents( __DIR__ . '/../../src/shared/ui/theme/gutenberg/gutenberg.css' );
od_test( 'the stylesheet keeps a card title looking like one at level 2', (bool) preg_match( '~\.wp-block-post-title \{\s*font-size~', $gutenberg ) );

/* ------------------------------------------------ od_mailto_phone_links */

$vasilev = file_get_contents( __DIR__ . '/fixtures/profile-vasilev.html' );
od_test( 'the fixture really links a phone number as an e-mail', str_contains( $vasilev, '<a href="mailto:posoh74@mail.ru">8(927)211-56-04</a>' ) );

$relinked = od_mailto_phone_links( $vasilev );
od_test( 'a number linked as an address becomes a phone link', str_contains( $relinked, '<a href="tel:+79272115604">8(927)211-56-04</a>' ) );
od_test( 'and the address itself keeps its own link', str_contains( $relinked, '<a href="mailto:posoh74@mail.ru">posoh74@mail.ru</a>' ) );
od_test_idempotent( 'od_mailto_phone_links', 'od_mailto_phone_links', $vasilev );

/* The guard: an address stated *only* inside that one anchor would be deleted
   from the record by the rewrite, so it is left as it is. */
od_test(
	'an address the body states nowhere else is left alone',
	od_mailto_phone_links( '<p><a href="mailto:one@example.com">8(927)211-56-04</a></p>' ) === '<p><a href="mailto:one@example.com">8(927)211-56-04</a></p>'
);
od_test(
	'an anchor whose text is an address is not a phone number',
	od_mailto_phone_links( '<p><a href="mailto:one@example.com">one@example.com</a> one@example.com</p>' ) === '<p><a href="mailto:one@example.com">one@example.com</a> one@example.com</p>'
);
/* The sweep runs the repair before the canonical pass, so the card sees a `tel:`. */
od_test( 'the profile sweep includes it', str_contains( od_pages_profile_contacts( $vasilev ), '<a href="tel:+79272115604">8(927)211-56-04</a>' ) );

/* ------------------------------------------------- od_pages_branch_card */

$amurskaya = file_get_contents( __DIR__ . '/fixtures/contacts-amurskaya.before.html' );
od_test( 'the branch fixture really opens with an accordion', str_contains( $amurskaya, '<!-- wp:details -->' ) );

$card = od_pages_branch_card( $amurskaya );
od_test( 'branch card: the accordion is gone', str_contains( $card, 'wp:details' ) === false && str_contains( $card, '<summary>' ) === false );
od_test( 'branch card: a group carries the class the stylesheet draws', str_contains( $card, '{"className":"od-branch","layout":{"type":"constrained"}}' ) );
od_test( 'branch card: the legal name is the card title, and not bold', str_contains( $card, '<p class="od-branch__title">Амурское областное отделение' ) && str_contains( $card, '<strong>Амурское областное' ) === false );
/* One `<span>` around both lines, because the row is a flex box: two bare text
   nodes either side of a `<br>` become two flex items and lay the role out
   beside the name. */
od_test( 'branch card: the name is above the role, in one flex item', str_contains( $card, '<p class="od-contact od-contact--person"><span><strong>Титова Ирина Александровна</strong><br>Координатор</span></p>' ) );
od_test( 'branch card: the phone is a row and a canonical link', str_contains( $card, '<p class="od-contact od-contact--phone"><a href="tel:+79241406040">8-924-140-60-40</a></p>' ) );
od_test( 'branch card: the e-mail is a row', str_contains( $card, '<p class="od-contact od-contact--email"><a href="mailto:rabota-amur@mail.ru">rabota-amur@mail.ru</a></p>' ) );
/* The glyph says «телефон»; the mock has no word in front of it. */
od_test( 'branch card: the labels the glyphs replace are gone', str_contains( $card, 'тел.' ) === false && str_contains( $card, 'e-mail:' ) === false );
/* Everything below the card is the page — two queries and their pagination. */
od_test( 'branch card: the coordinator query is untouched', str_contains( $card, '"taxQuery":{"pl-categs":[635]}' ) );
od_test( 'branch card: the «События» query is untouched', str_contains( $card, '<h2 id="news_section">События</h2>' ) && str_contains( $card, '"taxQuery":{"category":[628]}' ) );
od_test_idempotent( 'od_pages_branch_card', 'od_pages_branch_card', $amurskaya );

/* 40 of the 74 pages carry the labels and no values — a card that drew a phone
   glyph beside an empty line would be stating something untrue. */
$empty = od_pages_branch_card( file_get_contents( __DIR__ . '/fixtures/contacts-chukotskiy.before.html' ) );
od_test( 'branch card: an unfilled field is dropped, not drawn', str_contains( $empty, 'od-branch__title' ) && str_contains( $empty, 'od-contact' ) === false );
od_test( 'branch card: and the bare role goes with it', str_contains( $empty, 'Координатор отделения' ) === false );

/* Half these bodies write a name, a number and a VK address as one paragraph
   split by `<br>`, so a line — not a paragraph — is what gets classified. */
$novosibirskaya = od_pages_branch_card( file_get_contents( __DIR__ . '/fixtures/contacts-novosibirskaya.before.html' ) );
od_test( 'branch card: a `<br>` line becomes its own row', str_contains( $novosibirskaya, '<p class="od-contact od-contact--phone"><a href="tel:+79185700050">+7 918 570-00-50</a></p>' ) );
od_test( 'branch card: a VK address becomes a row with its own glyph', str_contains( $novosibirskaya, '<p class="od-contact od-contact--vk"><a href="https://vk.com/romanusha">vk.com/romanusha</a></p>' ) );
/* No bold legal name in this one — the card simply has no title. */
od_test( 'branch card: a body with no legal name gets no title', str_contains( $novosibirskaya, 'od-branch__title' ) === false );
od_test( 'branch card: and its prose survives as prose', str_contains( $novosibirskaya, '<p>Романуша Артем Александрович</p>' ) );

$udmurtiya = od_pages_branch_card( file_get_contents( __DIR__ . '/fixtures/contacts-udmurtiya.before.html' ) );
od_test( 'branch card: a bulleted «- по тел.» is still a phone row', str_contains( $udmurtiya, '<p class="od-contact od-contact--phone"><a href="tel:+79658459832">8-965-845-98-32</a></p>' ) );
/* A link is not a contact just because it points at vk.com: this one is a wall
   post about the coordinator, in the middle of his biography. */
od_test( 'branch card: a VK link whose text is a sentence stays prose', str_contains( $udmurtiya, '<p><a href="https://vk.com/wall24503112_2035">Подробнее о Фамутдинове Р.З.</a></p>' ) );
od_test( 'branch card: the thirteen-link paragraph is left alone', str_contains( $udmurtiya, 'Полезная дополнительная информация' ) && substr_count( $udmurtiya, 'https://vk.com/wall24503112' ) >= 4 );

/* A sweep runs over the whole subtree: `/contacts/sverdlovskaya/` has no
   accordion at all, and one that has already been converted must not be
   converted twice. */
od_test( 'branch card: a page with no accordion is left alone', od_pages_branch_card( '<!-- wp:paragraph --><p>Текст</p><!-- /wp:paragraph -->' ) === '<!-- wp:paragraph --><p>Текст</p><!-- /wp:paragraph -->' );
od_test( 'branch card: a converted page is left alone', od_pages_branch_card( $card ) === $card );

/* `od_tel_href()` reads the digits of whatever it is handed, so a line has to be
   a number and nothing else before it can become one. */
od_test( 'branch card: a sentence carrying eleven digits is not a phone number', od_branch_contact_row( 'В 2024 году мы провели 1500 занятий для 89 000 школьников' ) === null );
od_test( 'branch card: a number on its own is', str_contains( (string) od_branch_contact_row( 'тел. 8 924 140 60 40' ), 'tel:+79241406040' ) );

od_test( 'branch social: an address on either network is recognised', od_branch_social( 'https://vk.com/od' ) === 'vk' && od_branch_social( 't.me/od' ) === 'telegram' );
od_test( 'branch social: anything else is not', od_branch_social( 'https://obshee-delo.ru/' ) === null && od_branch_social( 'Подробнее' ) === null );
od_test( 'branch social: an address typed without a scheme still leaves this site', od_branch_social_href( 'vk.com/od' ) === 'https://vk.com/od' );
od_test( 'branch social: the label drops the scheme the glyph makes redundant', od_branch_social_label( 'https://www.vk.com/od' ) === 'vk.com/od' );

/* The card's look is held by the stylesheet, the same coupling the heading level
   above has: without these two classes the transform writes markup nothing draws. */
od_test( 'the stylesheet draws the card the transform writes', str_contains( $gutenberg, '.od-branch {' ) && str_contains( $gutenberg, '.od-contact--person' ) );

/* ------------------------------------------------------- the registry itself */

foreach ( od_pages_registry() as $entry ) {
	od_test( "{$entry['label']}: its transform exists", is_callable( $entry['fix'] ) );
	od_test( "{$entry['label']}: the runner can find the record", isset( $entry['path'] ) || isset( $entry['title'] ) || ! empty( $entry['sweep'] ) );
	// An *unbounded* sweep addresses a whole post type, so it must name one —
	// `page` by default would put every published page through a profile
	// transform. One bounded by `parent` is already scoped to a subtree.
	od_test( "{$entry['label']}: a sweep names its post type or its parent", empty( $entry['sweep'] ) || isset( $entry['post_type'] ) || isset( $entry['parent'] ) );
}

od_test_summary();
