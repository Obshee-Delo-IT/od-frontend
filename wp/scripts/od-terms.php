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
 * One entry per programme whose page carries a «Проекты программы» row: that row
 * is a `core/query` over the tag, so tagging a film in the admin is the whole
 * job of adding one. `/healthy-kids/` has no such row and no tag.
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
 * `alt_from_title` covers the other half of what a query block needs: the films'
 * featured images were uploaded with **no alt text at all**, and
 * `core/post-featured-image` renders them as a link — a link with no accessible
 * name. The post's own title is the right name for it, and setting it helps
 * every other place those covers render too.
 *
 * @return array<string, array{name: string, alt_from_title: bool, posts: array<int, string>}>
 */
function od_terms_registry(): array
{
    return [
        'programma-zdorovaya-rossiya' => [
            'name' => 'Программа «Здоровая Россия»',
            'alt_from_title' => true,
            'posts' => [
                'документальный-фильм-алкоголь-секр', // №1 «Алкоголь. Секреты манипуляции»
                'никотин-секреты-манипуляции',        // №2 «Никотин. Секреты манипуляции»
                'курение-взгляд-изнутри',             // №4 «Курение. Взгляд изнутри»
                'one-deception-story',                // №6 «История одного обмана»
                'narkotiki-sekrety-manipuljacii',     // №7 «Наркотики. Секреты манипуляции»
                'алкоголь-незримый-враг',             // №8 «Алкоголь. Незримый враг»
            ],
        ],
        'programma-zdorovaya-molodezh' => [
            'name' => 'Программа «Здоровая молодежь»',
            'alt_from_title' => true,
            // The six the page at `/healthy-youth/` linked by hand, in the order
            // the mock draws them. The row itself is ordered by date, so this
            // list is what belongs to the programme, not what it looks like.
            'posts' => [
                'man-five-secrets',                    // «Пять секретов настоящего мужчины»
                'грязные-слова',                       // «Грязные слова»
                'фильм-как-научиться-любить-пошагова',  // «Как научиться любить?»
                'woman-nature-secret',                 // «Тайна природы женщины»
                'путь-героя-фильм-о-игровой-зависимост', // «Путь героя»
                'фильм-четыре-ключа-к-твоим-победам',   // «Четыре ключа к твоим победам»
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

        if (!empty($tag['alt_from_title'])) {
            od_terms_alt_from_title($post, $apply);
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

/**
 * Name a post's featured image after the post, when it has no alt text of its
 * own. Never overwrites one — an editor's wording beats a title every time.
 */
function od_terms_alt_from_title(WP_Post $post, bool $apply): void
{
    $thumbnail = get_post_thumbnail_id($post->ID);
    if (!$thumbnail) {
        WP_CLI::warning(sprintf('%s (#%d): no featured image', $post->post_name, $post->ID));

        return;
    }

    if (trim((string) get_post_meta($thumbnail, '_wp_attachment_image_alt', true)) !== '') {
        return;
    }

    // Decoded, not just stripped: several film titles store their guillemets as
    // `&#171;`, and an alt attribute goes through `esc_attr()` on the way out —
    // which would escape the ampersand again and read the entity aloud.
    $alt = html_entity_decode(wp_strip_all_tags(get_the_title($post)), ENT_QUOTES, 'UTF-8');
    WP_CLI::log(sprintf('#%d: cover %d has no alt, to be «%s»', $post->ID, $thumbnail, $alt));

    if ($apply) {
        update_post_meta($thumbnail, '_wp_attachment_image_alt', $alt);
        WP_CLI::success(sprintf('#%d: cover %d alt set', $post->ID, $thumbnail));
    }
}
