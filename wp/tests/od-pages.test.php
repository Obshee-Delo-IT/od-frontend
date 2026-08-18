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
od_test( 'the small file is gone', ! str_contains( $swapped, 'New_small.jpg' ) );
od_test( 'the full-size original took its place', str_contains( $swapped, rawurlencode( 'обложка_ЗдорМолодежьNew.jpg' ) ) );
od_test( 'the upload path is the page\'s own, not ours', str_contains( $swapped, '/wp-content/uploads/2020/04/' ) );
// All three described the file that was there: 226×300, and an attachment id that
// is per-environment.
od_test( 'the stale dimensions are dropped', 2 === substr_count( $swapped, 'width="' ) );
od_test( 'and the stale attachment class with them', 2 === substr_count( $swapped, 'wp-image-' ) );
od_test( 'the other two covers are untouched', str_contains( $swapped, 'metodichka-232x300.jpg' ) && str_contains( $swapped, 'metodic-mults-small220x300.jpg' ) );
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

// ===========================================================================
// `/healthy-youth/` — Figma `project-2`.
// ===========================================================================

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

// ===========================================================================
// `/healthy-kids/` — Figma `project-3`.
// ===========================================================================

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

// ===========================================================================
// `/projects/` — Figma `projects`, the index of the three above.
// ===========================================================================

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

// ===========================================================================
// `/materials/` — Figma `ads`, the same card at 598×280.
// ===========================================================================

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

// ===========================================================================
// `/materials/printed-products/` — Figma `printing`, the same hub one level down.
// ===========================================================================

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

// -- every transform refuses input it does not recognise --------------------------------

foreach (['od_pages_healthy_youth', 'od_pages_healthy_kids', 'od_pages_projects', 'od_pages_materials', 'od_pages_printed_products'] as $transform) {
    $threw = false;
    try {
        $transform('<!-- wp:paragraph --><p>что-то другое</p><!-- /wp:paragraph -->', 666);
    } catch (RuntimeException $e) {
        $threw = true;
    }
    od_test($transform . ': unexpected input is refused, not half-converted', $threw);
}

/* ------------------------------------------------------- the registry itself */

foreach ( od_pages_registry() as $entry ) {
	od_test( "{$entry['label']}: its transform exists", is_callable( $entry['fix'] ) );
	od_test( "{$entry['label']}: the runner can find the record", isset( $entry['path'] ) || isset( $entry['title'] ) );
}

od_test_summary();
