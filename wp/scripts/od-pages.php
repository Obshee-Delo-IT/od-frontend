<?php
/**
 * One-shot content fixes for the pages workstream D, expressed as code so they
 * can be re-applied to any environment.
 *
 * **Why a script and not the admin.** od-dev's database does not travel to
 * production: prod is authoritative for content and is converted from its own
 * CMSMasters shortcodes by `cmsms-gutenberg-upgrade` as part of the cutover. A
 * page fixed by hand in od-dev's admin is therefore fixed nowhere — the cutover
 * re-converts prod and the hand work is gone. Running this file is how the whole
 * of workstream D reaches production. Full procedure in
 * `docs/wp-page-redesign.md`.
 *
 * **This repo holds the canonical copy** — edit here, upload, run, on the same
 * terms as `wp/mu-plugins/od-revalidate.php`:
 *
 *   scp wp/scripts/od-pages.php timeweb:od-dev/public_html/
 *   ssh timeweb 'cd ~/od-dev/public_html && \
 *     wp --skip-plugins=clearfy-pro eval-file od-pages.php --url=https://od-dev.tmweb.ru'
 *   #                                                       ^ dry run, writes nothing
 *   ssh timeweb 'cd ~/od-dev/public_html && \
 *     wp --skip-plugins=clearfy-pro eval-file od-pages.php apply --url=https://od-dev.tmweb.ru'
 *
 * `apply` is **positional**, not a flag: `wp eval-file` hands positionals to the
 * script in `$args` and rejects `--flags` it does not know itself. `--url=` is
 * required on od-dev — clearfy-pro redirects to HTTPS at `init` and without a
 * host WP-CLI dies before WordPress finishes loading.
 *
 * **PHP floor: CLI PHP**, which is 8.2 on both prod and od-dev, so modern syntax
 * is fine here. This is the opposite of `wp/mu-plugins/od-revalidate.php`, which
 * loads on every *site* request where prod is still `mod_php7` — do not copy
 * syntax from one to the other.
 *
 * Four rules everything below follows:
 *
 * 1. **Idempotent by detection, not by rewriting.** Every transform checks
 *    whether the content is already in its target shape and returns it
 *    untouched. This file gets run again, on every environment, possibly after
 *    an editor has worked on the same page.
 * 2. **Dry run by default.** As in the `film:*` tooling and the migrator's CLI.
 * 3. **Writes go through `$wpdb->update`, after `wp_save_post_revision`.**
 *    `wp_update_post` fires `cmsms-gutenberg-upgrade`'s `save_post` hook, which
 *    deletes the `nvp_content_copy` meta — the backup that both a re-run of the
 *    migrator and `wp cmsms restore` depend on. The migrator's own CLI writes
 *    this way for exactly this reason.
 * 4. **Records are addressed by slug, path or title — never by id.** Ids differ
 *    per environment (runbook blocker B4).
 *
 * The transforms are plain string→string functions with no WordPress in them, so
 * `php wp/tests/od-pages.test.php` can assert them — including `f(f(x)) === f(x)`
 * for each — with no install at all.
 *
 * @package od-frontend
 */

/* -------------------------------------------------------------------------
 * Pure transforms
 * ---------------------------------------------------------------------- */

/**
 * Escape a value for an HTML attribute without double-escaping entities the
 * content already carries (`&laquo;` must not become `&amp;laquo;`).
 */
function od_attr( string $value ): string {
	return htmlspecialchars( $value, ENT_QUOTES, 'UTF-8', false );
}

/**
 * Drop `group > columns > column{100%}` wrappers that contain nothing.
 *
 * CMSMasters rows were the old theme's vertical spacing, and an empty
 * `[cmsms_row][cmsms_column data_width="1/1"][/cmsms_column][/cmsms_row]` pair
 * came through the migrator as an empty group of an empty column. They render as
 * empty divs — invisible, but they are what makes "the first `wp:columns` block"
 * an unreliable thing to point at, so this runs first.
 *
 * Idempotent: after one pass there are none left to match.
 */
function od_drop_empty_layout_groups( string $content ): string {
	$pattern = '~<!--\s*wp:group\b[^>]*-->\s*<div class="wp-block-group">'
		. '\s*<!--\s*wp:columns\b[^>]*-->\s*<div class="wp-block-columns">'
		. '\s*<!--\s*wp:column\b[^>]*-->\s*<div class="wp-block-column"[^>]*>\s*</div>\s*<!--\s*/wp:column\s*-->'
		. '\s*</div>\s*<!--\s*/wp:columns\s*-->'
		. '\s*</div>\s*<!--\s*/wp:group\s*-->~s';

	return preg_replace( $pattern, '', $content );
}

/**
 * Whether any block in `$content` already declares `$class`.
 *
 * The `className` values are split and compared whole rather than searched for as
 * a substring: `str_contains( $content, 'b' )` is true of every body ever
 * written, because `wp-block-columns` contains a «b».
 */
function od_has_block_class( string $content, string $class ): bool {
	if ( ! preg_match_all( '~"className"\s*:\s*"([^"]*)"~', $content, $matches ) ) {
		return false;
	}

	foreach ( $matches[1] as $value ) {
		if ( in_array( $class, preg_split( '~\s+~', trim( $value ) ), true ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Put `$class` on the first `wp:columns` block — both in the block attributes
 * and on the rendered `<div>`, which is what the editor itself writes for the
 * «Дополнительные CSS-классы» field.
 *
 * A class is how a page-specific layout reaches CSS in this repo (ladder rung 2,
 * `docs/wp-page-redesign.md` §2): nothing in Gutenberg's markup distinguishes a
 * grid of poster covers from any other three-column row.
 *
 * Idempotent by detection — {@see od_has_block_class()}.
 */
function od_class_on_first_columns( string $content, string $class ): string {
	if ( od_has_block_class( $content, $class ) ) {
		return $content;
	}

	return preg_replace_callback(
		'~<!--\s*wp:columns\s*(\{.*?\})?\s*-->(\s*)<div class="wp-block-columns~s',
		static function ( array $m ) use ( $class ): string {
			$attrs              = isset( $m[1] ) && '' !== $m[1] ? json_decode( $m[1], true ) : array();
			$attrs              = is_array( $attrs ) ? $attrs : array();
			$attrs['className'] = trim( ( $attrs['className'] ?? '' ) . ' ' . $class );
			$json               = json_encode( $attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

			return "<!-- wp:columns {$json} -->{$m[2]}<div class=\"wp-block-columns {$class}";
		},
		$content,
		1
	);
}

/**
 * Move an `h2` that only labels the picture under it into that picture's `alt`,
 * and drop the heading.
 *
 * The `handbooks` mock draws the three covers with no captions: each poster's
 * title is printed on the artwork itself, so the heading above it was the same
 * words twice. Deleting it outright would lose them for a screen reader and for
 * search, hence the move rather than a delete.
 *
 * Only a heading whose **immediately** following block is a paragraph holding an
 * `<img>` qualifies, and the image has to be inside that same paragraph — the
 * `(?:(?!</p>).)*?` is what stops a heading with no picture of its own from
 * claiming the next column's.
 *
 * Idempotent: the heading it feeds on is gone afterwards.
 */
function od_headings_into_image_alt( string $content ): string {
	$pattern = '~<!--\s*wp:heading\b[^>]*-->\s*<h2\b[^>]*>(.*?)</h2>\s*<!--\s*/wp:heading\s*-->'
		. '(\s*<!--\s*wp:paragraph\s*-->\s*<p\b[^>]*>(?:(?!</p>).)*?<img\b)([^>]*?)(\s*/?>)~s';

	return preg_replace_callback(
		$pattern,
		static function ( array $m ): string {
			$alt   = od_attr( trim( strip_tags( $m[1] ) ) );
			$attrs = $m[3];
			// Replace the alt the migrator left («metodichka-mult» on two of the
			// three) rather than adding a second one.
			$attrs = preg_match( '~\salt=(["\']).*?\1~s', $attrs )
				? preg_replace( '~\salt=(["\']).*?\1~s', " alt=\"{$alt}\"", $attrs, 1 )
				: $attrs . " alt=\"{$alt}\"";

			return $m[2] . $attrs . $m[4];
		},
		$content
	);
}

/**
 * Replace a `wp:details` accordion with its summary as an `h2` and a link to the
 * `profile` record whose contact details the accordion held as prose.
 *
 * Two things happen here. The person **stops being duplicated**: the page had a
 * name, a role and three contact lines pasted out of Telegram, while the same
 * person's `profile` record held the same details again and neither copy was a
 * superset. The frontend swaps a `/profile/…` link alone in its paragraph for a
 * card built from the record (`src/modules/WpPage/profileEmbeds.tsx`), so the
 * link is both the marker and the fallback — remove the frontend code and what
 * is left is a working link to that person's page. And the block **stops being
 * an accordion**, because the mock shows the card open: the accordion was the old
 * theme's `[cmsms_toggle]`, not a decision anyone made about this content.
 *
 * The heading text is the summary's, verbatim.
 *
 * Idempotent: there is no `wp:details` left to match.
 */
function od_details_to_profile_link( string $content, string $href, string $label ): string {
	return preg_replace_callback(
		'~<!--\s*wp:details\b.*?<summary>(.*?)</summary>.*?<!--\s*/wp:details\s*-->~s',
		static function ( array $m ) use ( $href, $label ): string {
			$heading = trim( strip_tags( $m[1] ) );

			return '<!-- wp:heading {"level":2} --><h2 class="wp-block-heading">' . od_attr( $heading )
				. '</h2><!-- /wp:heading -->'
				. '<!-- wp:paragraph --><p><a href="' . od_attr( $href ) . '">' . od_attr( $label )
				. '</a></p><!-- /wp:paragraph -->';
		},
		$content,
		1
	);
}

/**
 * Add contact links to a `profile` body, at the end of its last paragraph block.
 *
 * The counterpart of {@link od_details_to_profile_link}: the page held this
 * person's Telegram handle and VK page and the record did not, so dropping the
 * page's prose without this would lose them. `profile` bodies keep their contacts
 * as `<p>`s inside one `wp:paragraph` block, which is where these go — appending
 * to the end of `post_content` instead would put them outside the two-column
 * group, below the photo.
 *
 * `$links` is a list of `[href, label]`. Idempotent per link: a href already
 * anywhere in the body is skipped, so a re-run adds nothing and an editor's own
 * later edit to the label survives.
 */
function od_append_contact_links( string $content, array $links ): string {
	foreach ( $links as list( $href, $label ) ) {
		if ( str_contains( $content, $href ) ) {
			continue;
		}

		$paragraph = '<p><a href="' . od_attr( $href ) . '">' . od_attr( $label ) . '</a></p>';
		$closing   = strrpos( $content, '<!-- /wp:paragraph -->' );
		$content   = false === $closing
			? rtrim( $content ) . "\n" . $paragraph
			: substr_replace( $content, $paragraph . "\n", $closing, 0 );
	}

	return $content;
}

/* -------------------------------------------------------------------------
 * The fixes — one entry per record, newest last
 * ---------------------------------------------------------------------- */

/**
 * The coordinator «Заказать методические пособия» names. The slug is the record's
 * own and it reads wrong on purpose: profile 46651 was Екатерина Гордикова and
 * was retitled to Андрей Рязанов without re-slugging (`_wp_old_slug` is
 * `екатерина-гордикова`). Re-slugging it is **not** safe from here — the A6
 * frozen copy is keyed on the live path, so a new slug would 404 in the iframe
 * that still serves `/profile/*`. Reported as a content bug instead.
 */
const OD_METODICHKI_COORDINATOR_HREF =
	'/profile/%d0%b3%d0%be%d1%80%d0%b4%d0%b8%d0%ba%d0%be%d0%b2%d0%b0-%d0%b5%d0%ba%d0%b0%d1%82%d0%b5%d1%80%d0%b8%d0%bd%d0%b0/';
const OD_METODICHKI_COORDINATOR_NAME = 'Андрей Алексеевич Рязанов';

/**
 * @return array<int, array{label: string, post_type: string, path?: string, title?: string, fix: callable}>
 */
function od_pages_fixes(): array {
	return array(
		array(
			'label'     => 'D8 · /materials/metodichki/ — Figma `handbooks` (779:4133)',
			'post_type' => 'page',
			'path'      => 'materials/metodichki',
			'fix'       => static function ( string $content ): string {
				$content = od_drop_empty_layout_groups( $content );
				$content = od_class_on_first_columns( $content, 'od-covers' );
				$content = od_headings_into_image_alt( $content );

				return od_details_to_profile_link(
					$content,
					OD_METODICHKI_COORDINATOR_HREF,
					OD_METODICHKI_COORDINATOR_NAME
				);
			},
		),
		array(
			'label'     => 'D8 · profile «Андрей Алексеевич Рязанов» — the two contacts only the page had',
			'post_type' => 'profile',
			'title'     => OD_METODICHKI_COORDINATOR_NAME,
			'fix'       => static function ( string $content ): string {
				return od_append_contact_links(
					$content,
					array(
						array( 'https://t.me/paramon1302', '@paramon1302' ),
						array( 'https://vk.com/id39335667', 'https://vk.com/id39335667' ),
					)
				);
			},
		),
	);
}

/* -------------------------------------------------------------------------
 * Runner — only under WP-CLI, so the tests can require this file
 * ---------------------------------------------------------------------- */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}

/**
 * The record a fix targets, or null. By path for pages (`get_page_by_path` is
 * exact and hierarchy-aware), by exact title otherwise — `profile` slugs are
 * unreliable on this install, see the constant above.
 *
 * @param array $fix One entry of {@see od_pages_fixes()}.
 */
function od_pages_resolve( array $fix ): ?WP_Post {
	if ( isset( $fix['path'] ) ) {
		return get_page_by_path( $fix['path'], OBJECT, $fix['post_type'] );
	}

	$found = get_posts(
		array(
			'post_type'        => $fix['post_type'],
			'title'            => $fix['title'],
			'post_status'      => 'publish',
			'numberposts'      => 2,
			'suppress_filters' => false,
		)
	);

	if ( count( $found ) !== 1 ) {
		WP_CLI::warning( sprintf( '%d records titled «%s» — expected exactly 1', count( $found ), $fix['title'] ) );

		return null;
	}

	return $found[0];
}

/**
 * Save a revision, then write the body straight to the table. Never
 * `wp_update_post` — see rule 3 in the file header.
 */
function od_pages_write( int $id, string $content ): void {
	global $wpdb;

	wp_save_post_revision( $id );
	$wpdb->update( $wpdb->posts, array( 'post_content' => $content ), array( 'ID' => $id ), array( '%s' ), array( '%d' ) );
	clean_post_cache( $id );
}

$apply  = in_array( 'apply', $args, true );
$prefix = $apply ? '' : '[dry-run] ';
$changed = 0;
$same    = 0;

foreach ( od_pages_fixes() as $fix ) {
	$post = od_pages_resolve( $fix );
	if ( ! $post ) {
		WP_CLI::warning( sprintf( 'not found: %s', $fix['label'] ) );
		continue;
	}

	$before = $post->post_content;
	$after  = ( $fix['fix'] )( $before );

	if ( $after === $before ) {
		++$same;
		WP_CLI::log( sprintf( 'unchanged  %d  %s', $post->ID, $fix['label'] ) );
		continue;
	}

	++$changed;
	WP_CLI::log(
		sprintf(
			'%schange     %d  %s  (%d → %d bytes, %+d)',
			$prefix,
			$post->ID,
			$fix['label'],
			strlen( $before ),
			strlen( $after ),
			strlen( $after ) - strlen( $before )
		)
	);

	if ( $apply ) {
		od_pages_write( $post->ID, $after );
	}
}

WP_CLI::success(
	sprintf(
		'%s%d changed, %d already in shape, %d checked.%s',
		$prefix,
		$changed,
		$same,
		$changed + $same,
		$apply ? '' : ' Re-run with `apply` to write.'
	)
);
