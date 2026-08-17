<?php
/**
 * od-terms.php — the taxonomy workstream D needs WordPress to carry.
 *
 *     wp --url=https://od-dev.tmweb.ru eval-file od-terms.php           # dry run
 *     wp --url=https://od-dev.tmweb.ru eval-file od-terms.php apply     # write
 *
 * Separate from `od-pages.php` on purpose: that one rewrites a page's
 * `post_content` and is re-run whenever a page's design changes, this one only
 * ever adds a term to a post. They also run at different moments — a tag has to
 * exist before anything can query it — and this file has to survive on
 * production, where the pages are rebuilt from their own CMSMasters originals.
 *
 * Why a script rather than nine clicks in the admin: od-dev's database never
 * travels to production, so a tag applied by hand here is applied nowhere.
 *
 * House rules, same as `od-pages.php`:
 *
 * - **Idempotent.** A term already on a post is left alone; the tag itself is
 *   created only if it is missing. Re-running changes nothing.
 * - **Dry run by default.** Writing takes the positional argument `apply`.
 * - **Posts are addressed by slug**, never by id — ids differ per environment.
 *   The slugs below are written in readable Cyrillic; WordPress stores them
 *   percent-encoded, which is what `sanitize_title()` produces.
 * - **Terms are added, never replaced.** `wp_set_post_terms(…, append: true)`
 *   leaves whatever else the post is tagged with.
 */

/**
 * Tag slug => the tag's name and the posts that carry it.
 *
 * «Здоровая Россия» is a programme of nine lessons, each built on one film, and
 * the page at `/healthy-russia/` shows four of them chosen by hand. Tagging the
 * films is what makes the set a query rather than a hand-kept list.
 *
 * Six of the nine exist on the site as film posts. The other three have no post
 * at all — not under any title, in any of the video categories:
 *
 * - Занятие №3, «Влияние алкоголя на репродуктивную систему человека»
 * - Занятие №5, «Алкоголь. Взгляд изнутри»
 * - Занятие №9, «Наркотики. Медицинские и социальные последствия»
 *
 * Add their slugs here when they are published; the script will pick them up on
 * the next run and leave the six already tagged alone.
 *
 * @return array<string, array{name: string, posts: array<int, string>}>
 */
function od_terms_registry(): array
{
    return [
        'programma-zdorovaya-rossiya' => [
            'name' => 'Программа «Здоровая Россия»',
            'posts' => [
                'документальный-фильм-алкоголь-секр', // №1 «Алкоголь. Секреты манипуляции»
                'никотин-секреты-манипуляции',        // №2 «Никотин. Секреты манипуляции»
                'курение-взгляд-изнутри',             // №4 «Курение. Взгляд изнутри»
                'one-deception-story',                // №6 «История одного обмана»
                'narkotiki-sekrety-manipuljacii',     // №7 «Наркотики. Секреты манипуляции»
                'алкоголь-незримый-враг',             // №8 «Алкоголь. Незримый враг»
            ],
        ],
    ];
}

// ---------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

$apply = in_array('apply', $args ?? [], true);
WP_CLI::log($apply ? 'Applying changes.' : 'Dry run — pass `apply` to write.');

foreach (od_terms_registry() as $slug => $tag) {
    $term = get_term_by('slug', $slug, 'post_tag');

    if (!$term) {
        WP_CLI::log(sprintf('%s: tag missing, to be created as «%s»', $slug, $tag['name']));

        if ($apply) {
            $created = wp_insert_term($tag['name'], 'post_tag', ['slug' => $slug]);
            if (is_wp_error($created)) {
                WP_CLI::warning(sprintf('%s: %s', $slug, $created->get_error_message()));
                continue;
            }

            $term = get_term($created['term_id'], 'post_tag');
            WP_CLI::success(sprintf('%s: tag created (#%d)', $slug, $term->term_id));
        }
        // A dry run carries on without a term: the point of it is the list of
        // posts below, and a missing tag would otherwise hide all of them.
    }

    foreach ($tag['posts'] as $path) {
        $post = get_page_by_path($path, OBJECT, 'post')
            ?: get_page_by_path(sanitize_title($path), OBJECT, 'post');

        if (!$post) {
            WP_CLI::warning(sprintf('%s: no post with slug %s', $slug, $path));
            continue;
        }

        if ($term && has_term($term->term_id, 'post_tag', $post->ID)) {
            WP_CLI::log(sprintf('%s: %s (#%d) already tagged, skipped', $slug, $path, $post->ID));
            continue;
        }

        WP_CLI::log(sprintf('%s: %s (#%d) «%s»', $slug, $path, $post->ID, get_the_title($post)));

        if (!$apply || !$term) {
            continue;
        }

        $set = wp_set_post_terms($post->ID, [$term->term_id], 'post_tag', true);
        if (is_wp_error($set)) {
            WP_CLI::warning(sprintf('%s: %s', $path, $set->get_error_message()));
            continue;
        }

        WP_CLI::success(sprintf('%s: %s (#%d) tagged', $slug, $path, $post->ID));
    }
}
