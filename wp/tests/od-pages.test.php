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
 * `od_test()` rather than PHP's own `assert()`: `zend.assertions` is **`-1` on
 * this machine and on both servers**, which compiles `assert()` out entirely — the
 * file would have printed nothing and exited 0 whatever the transforms did. An
 * `if` and an `exit(1)` cannot be switched off.
 *
 * Fixtures in `__fixtures__/` are **real `post_content`**, captured from od-dev
 * 2026-08-17 with `wp post get <id> --field=post_content`. Recapture them rather
 * than editing them by hand.
 *
 * Every transform gets the idempotency case, `f(f(x)) === f(x)`: this script is
 * run again on every environment, and possibly after an editor has been in the
 * same page.
 *
 * @package od-frontend
 */

require_once __DIR__ . '/../scripts/od-pages.php';

$passed = 0;

/**
 * @param string $what Description, printed on failure.
 * @param bool   $ok   The assertion.
 */
function od_test( string $what, bool $ok ): void {
	global $passed;

	if ( ! $ok ) {
		fwrite( STDERR, "FAIL  {$what}\n" );
		exit( 1 );
	}

	++$passed;
	echo "ok    {$what}\n";
}

/** @param callable(string):string $transform */
function od_test_idempotent( string $what, callable $transform, string $input ): void {
	$once = $transform( $input );
	od_test( "{$what}: f(f(x)) === f(x)", $transform( $once ) === $once );
}

$page    = file_get_contents( __DIR__ . '/__fixtures__/page-metodichki.html' );
$profile = file_get_contents( __DIR__ . '/__fixtures__/profile-ryazanov.html' );

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
od_test( 'the first poster carries its heading as alt', str_contains( $alted, 'alt="Здоровая Россия - ОБЩЕЕ ДЕЛО"' ) );
od_test( 'the second too', str_contains( $alted, 'alt="Здоровые дети - ОБЩЕЕ ДЕЛО"' ) );
od_test( 'the third too', str_contains( $alted, 'alt="Здоровая молодежь - ОБЩЕЕ ДЕЛО"' ) );
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
	str_contains( $named, 'aria-label="Подробнее: Здоровая Россия - ОБЩЕЕ ДЕЛО"' )
	&& str_contains( $named, 'aria-label="Подробнее: Здоровые дети - ОБЩЕЕ ДЕЛО"' )
	&& str_contains( $named, 'aria-label="Подробнее: Здоровая молодежь - ОБЩЕЕ ДЕЛО"' )
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

$https = od_https_own_links( $named );
od_test( 'the first cover stops hopping through http', ! str_contains( $https, 'http://metodic' ) && 2 === substr_count( $https, 'https://metodic.obshee-delo.ru' ) );
od_test_idempotent( 'od_https_own_links', 'od_https_own_links', $named );
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

/* --------------------------------------- od_details_to_profile_link */

$linked = od_details_to_profile_link( $spaced, OD_METODICHKI_COORDINATOR_HREF, OD_METODICHKI_COORDINATOR_NAME );
od_test( 'the accordion is gone', ! str_contains( $linked, 'wp:details' ) );
od_test( 'its summary becomes an h2', str_contains( $linked, '<h2 class="wp-block-heading">Заказать методические пособия</h2>' ) );
od_test( 'the coordinator is one link, alone in its paragraph', str_contains( $linked, '<!-- wp:paragraph --><p><a href="' . OD_METODICHKI_COORDINATOR_HREF . '">' . OD_METODICHKI_COORDINATOR_NAME . '</a></p><!-- /wp:paragraph -->' ) );
od_test( 'the pasted Telegram prose is gone', ! str_contains( $linked, 'paramon1302' ) && ! str_contains( $linked, 'text-entity-link' ) );
od_test( 'and so is the duplicated phone number', ! str_contains( $linked, '89048180869' ) );
od_test_idempotent(
	'od_details_to_profile_link',
	static fn( string $c ): string => od_details_to_profile_link( $c, OD_METODICHKI_COORDINATOR_HREF, OD_METODICHKI_COORDINATOR_NAME ),
	$spaced
);

/* ------------------------------------------- the whole page fix, in order */

$fixes = od_pages_fixes();
$whole = ( $fixes[0]['fix'] )( $page );
od_test( 'the page fix composes to the same result', $whole === $linked );
od_test( 'the page fix is idempotent end to end', ( $fixes[0]['fix'] )( $whole ) === $whole );
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

echo "\n{$passed} assertions passed.\n";
