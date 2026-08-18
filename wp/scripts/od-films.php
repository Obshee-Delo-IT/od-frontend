<?php
/**
 * od-films.php — the film-side data workstream D needs WordPress to carry:
 * which films belong to a programme, and the two fields a programme card reads
 * off each of them.
 *
 *     wp --url=https://od-dev.tmweb.ru eval-file od-films.php           # dry run
 *     wp --url=https://od-dev.tmweb.ru eval-file od-films.php apply     # write
 *
 * Separate from `od-pages.php` on purpose: that one rewrites a page's
 * `post_content` and is re-run whenever a page's design changes, this one only
 * ever adds to a film post. They also run at different moments — a tag has to
 * exist before a page can query it — and this file has to survive on
 * production, where the pages are rebuilt from their own CMSMasters originals.
 *
 * Why a script rather than clicks in the admin: od-dev's database never travels
 * to production, so anything set by hand here is set nowhere.
 *
 * Three things per film, all idempotent:
 *
 * - **The programme's tag.** `wp_set_post_terms(…, append: true)` leaves
 *   whatever else the post is tagged with; a term already on a post is skipped,
 *   and the tag itself is created only if missing.
 * - **Alt text on the featured image**, taken from the post's own title when it
 *   has none. An editor's wording always wins. A cover with no alt is a link
 *   with no accessible name wherever it renders as one.
 * - **`poster_image_url`**, the portrait плакат a programme card prefers over
 *   the 16∶9 still (see `wp/mu-plugins/od-film-meta.php`). Only ever filled in
 *   when empty, and only where the artwork exists and is portrait — a landscape
 *   file letterboxes in the card exactly as the still does, so it buys nothing.
 *
 * House rules, same as `od-pages.php`: dry run by default, writing takes the
 * positional argument `apply`, and **posts are addressed by slug**, never by id,
 * because ids differ per environment. The slugs below are written in readable
 * Cyrillic; WordPress stores them percent-encoded, which is what
 * `sanitize_title()` produces. Upload paths are relative for the same reason —
 * the origin is put back with `home_url()` at write time.
 */

/**
 * Tag slug => the tag's name and the films that carry it, each mapped to the
 * плакат it should have. An empty path means «leave `poster_image_url` alone»:
 * the film already has one, or the only artwork available is landscape.
 *
 * One entry per programme whose page carries a «Проекты программы» row: that
 * row is a `core/query` over the tag, so tagging a film in the admin is the
 * whole job of adding one to a page.
 *
 * **«Здоровая Россия»** is nine lessons, each built on one film. Six exist as
 * film posts; the other three have no post at all, under any title, in any
 * video category — «Влияние алкоголя на репродуктивную систему человека»,
 * «Алкоголь. Взгляд изнутри», «Наркотики. Медицинские и социальные
 * последствия». Add their slugs when they are published.
 *
 * **«Здоровая молодежь»** is seven lessons. Four map to a film outright; two
 * more are the films the page itself linked and read like the remaining
 * lessons under other names («Тайна природы женщины» for «Девушка в современном
 * социуме», «Как научиться любить?» for «Уровни развития отношений»). The
 * seventh, «Опасность ВИЧ и других ЗППП», has no film on the site.
 *
 * **«Здоровые дети»** is the «Команда Познавалова» cartoons. Two are the
 * lessons named on the page; a third, «Задача по зубам» (`70847`), is in the
 * catalogue and may be a later lesson — add its slug if it is.
 *
 * @return array<string, array{name: string, films: array<string, string>}>
 */
function od_films_registry(): array
{
    return [
        'programma-zdorovaya-rossiya' => [
            'name' => 'Программа «Здоровая Россия»',
            'films' => [
                'документальный-фильм-алкоголь-секр' => '', // №1 «Алкоголь. Секреты манипуляции»
                'никотин-секреты-манипуляции' => '',        // №2 «Никотин. Секреты манипуляции»
                'курение-взгляд-изнутри' => '',             // №4 «Курение. Взгляд изнутри»
                'one-deception-story' => '',                // №6 «История одного обмана»
                'narkotiki-sekrety-manipuljacii' => '',     // №7 «Наркотики. Секреты манипуляции»
                'алкоголь-незримый-враг' => '',             // №8 «Алкоголь. Незримый враг»
            ],
        ],
        'programma-zdorovaya-molodezh' => [
            'name' => 'Программа «Здоровая молодежь»',
            // The плакаты are the artwork `/healthy-youth/` itself carried
            // before it was rebuilt — 366×517, portrait, already in the media
            // library. «Путь героя»'s is 420×359 and stays unset.
            'films' => [
                'фильм-четыре-ключа-к-твоим-победам' => '',   // №1 — has a плакат of its own
                'woman-nature-secret' => '/wp-content/uploads/2021/02/plakats_2office_woman.jpg',
                'man-five-secrets' => '/wp-content/uploads/2021/02/plakats_2office_man.jpg',
                'путь-героя-фильм-о-игровой-зависимост' => '', // №4 — only landscape artwork exists
                'фильм-как-научиться-любить-пошагова' => '/wp-content/uploads/2021/02/how-to-love.jpg',
                'грязные-слова' => '/wp-content/uploads/2021/02/dirty-words.jpg',
            ],
        ],
        'programma-zdorovye-deti' => [
            'name' => 'Программа «Здоровые дети»',
            'films' => [
                'multfilm-tayna-edkogo-dyma' => '',      // Занятие №1 «Тайна едкого дыма»
                'мультфильм-опасное-погружение-сер' => '', // №2 — has a плакат of its own
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

foreach (od_films_registry() as $slug => $programme) {
    $term = get_term_by('slug', $slug, 'post_tag');

    if (!$term) {
        WP_CLI::log(sprintf('%s: tag missing, to be created as «%s»', $slug, $programme['name']));

        if ($apply) {
            $created = wp_insert_term($programme['name'], 'post_tag', ['slug' => $slug]);
            if (is_wp_error($created)) {
                WP_CLI::warning(sprintf('%s: %s', $slug, $created->get_error_message()));
                continue;
            }

            $term = get_term($created['term_id'], 'post_tag');
            WP_CLI::success(sprintf('%s: tag created (#%d)', $slug, $term->term_id));
        }
        // A dry run carries on without a term: the point of it is the list of
        // films below, and a missing tag would otherwise hide all of them.
    }

    foreach ($programme['films'] as $path => $poster) {
        $post = get_page_by_path($path, OBJECT, 'post')
            ?: get_page_by_path(sanitize_title($path), OBJECT, 'post');

        if (!$post) {
            WP_CLI::warning(sprintf('%s: no post with slug %s', $slug, $path));
            continue;
        }

        od_films_alt_from_title($post, $apply);

        if ($poster !== '') {
            od_films_poster($post, $poster, $apply);
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
function od_films_alt_from_title(WP_Post $post, bool $apply): void
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

/**
 * Give a film the portrait плакат a programme card wants, when it has none.
 *
 * Never overwrites: the field is `group_film_meta`'s, an editor owns it, and a
 * film that already has a плакат has a better one than this script can guess.
 * The ACF field key goes in beside the value — without it the admin renders the
 * field empty and would clear it on the next save.
 *
 * @param string $path Upload path, root-relative. The origin differs per
 *                     environment, so it is put back here rather than stored.
 */
function od_films_poster(WP_Post $post, string $path, bool $apply): void
{
    if (trim((string) get_post_meta($post->ID, 'poster_image_url', true)) !== '') {
        return;
    }

    $url = home_url($path);
    WP_CLI::log(sprintf('#%d: no плакат, to be %s', $post->ID, $path));

    if ($apply) {
        update_post_meta($post->ID, 'poster_image_url', $url);
        update_post_meta($post->ID, '_poster_image_url', 'field_film_poster_image_url');
        WP_CLI::success(sprintf('#%d: плакат set', $post->ID));
    }
}
