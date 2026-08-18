<?php
/**
 * od-wp.php — the WordPress-side data workstream D needs, everything that is not
 * a page's own markup.
 *
 *     wp --url=https://od-dev.tmweb.ru eval-file od-wp.php           # dry run
 *     wp --url=https://od-dev.tmweb.ru eval-file od-wp.php apply     # write
 *
 * Separate from `od-pages.php` on purpose, and the line between them is what a
 * change is *made of*: that one rewrites a page's `post_content` and is re-run
 * whenever a page's design changes, this one edits WordPress objects — terms,
 * postmeta, attachment metadata — and only ever adds to them. They also run at
 * different moments: a tag has to exist before a page can query it.
 *
 * Why a script rather than clicks in the admin: od-dev's database never travels
 * to production, so anything set by hand here is set nowhere. Applying the whole
 * of workstream D to production is running these two files.
 *
 * **Adding a task.** One function, called from the runner at the bottom, taking
 * `$apply` and doing nothing but logging when it is false. Whatever it needs to
 * know goes in a registry function above it, so the data can be read and tested
 * without WordPress. There are two today — {@see od_wp_tag_programme_films()}
 * and {@see od_wp_rename_pages()} — and no framework between them, because two
 * calls in a row is not a thing that needs one.
 *
 * House rules, same as `od-pages.php`: dry run by default, writing takes the
 * positional argument `apply`, everything is idempotent, and **posts are
 * addressed by slug**, never by id, because ids differ per environment. The
 * slugs below are written in readable Cyrillic; WordPress stores them
 * percent-encoded, which is what `sanitize_title()` produces. Upload paths are
 * root-relative for the same reason — the origin is put back with `home_url()`
 * at write time.
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
 * **«Здоровая молодежь»** is seven lessons, and all seven have a film. Four
 * match by name; the other three are titled differently from the lesson they
 * belong to — «Тайна природы женщины» is «Девушка в современном социуме»,
 * «Как научиться любить?» is «Уровни развития отношений», and «Докажи, что
 * любишь» is «Опасность ВИЧ и других ЗППП».
 *
 * **«Здоровые дети»** is the «Команда Познавалова» cartoons. Two are the
 * lessons named on the page; a third, «Задача по зубам» (`70847`), is in the
 * catalogue and may be a later lesson — add its slug if it is.
 *
 * @return array<string, array{name: string, films: array<string, string>}>
 */
function od_wp_programmes(): array
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
                'woman-nature-secret' => '/wp-content/uploads/2021/02/plakats_2office_woman.jpg', // №2
                'man-five-secrets' => '/wp-content/uploads/2021/02/plakats_2office_man.jpg',      // №3
                'путь-героя-фильм-о-игровой-зависимост' => '', // №4 — only landscape artwork exists
                'фильм-как-научиться-любить-пошагова' => '/wp-content/uploads/2021/02/how-to-love.jpg', // №5
                'грязные-слова' => '/wp-content/uploads/2021/02/dirty-words.jpg',                 // №6
                'докажи-что-любишь' => '',                     // №7 «Опасность ВИЧ и других ЗППП»
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

/**
 * Task: every programme's films, as {@see od_wp_programmes()} describes them —
 * the tag, the cover's alt text and the портретный плакат. Three writes, all of
 * them additive, none of them ever overwriting a value already there.
 */
function od_wp_tag_programme_films(bool $apply): void
{
    foreach (od_wp_programmes() as $slug => $programme) {
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

            od_wp_alt_from_title($post, $apply);

            if ($poster !== '') {
                od_wp_poster($post, $poster, $apply);
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
}

/**
 * Name a post's featured image after the post, when it has no alt text of its
 * own. Never overwrites one — an editor's wording beats a title every time.
 */
function od_wp_alt_from_title(WP_Post $post, bool $apply): void
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
function od_wp_poster(WP_Post $post, string $path, bool $apply): void
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

/**
 * Page path => the title it should carry.
 *
 * A WP page's title is its H1, its `<title>` and its breadcrumb once the page
 * renders natively (D6g/D6h), so the two indexes were showing «Программы и
 * проекты» and «Наши материалы» where the mocks — and the site's own nav — say
 * «Программы» and «Материалы». That is a WordPress object rather than markup,
 * which is why it is here and not in `od-pages.php`.
 *
 * The slug is untouched: `post_name` is what the URL is made of, and every one
 * of these pages is a live address.
 *
 * @return array<string, string>
 */
function od_wp_page_titles(): array
{
    return [
        'projects' => 'Программы',
        'materials' => 'Материалы',
    ];
}

/**
 * Renames the pages in {@see od_wp_page_titles()} that do not already carry
 * their title.
 *
 * Through `$wpdb->update`, not `wp_update_post`, for the reason `od-pages.php`
 * gives: the latter fires `cmsms-gutenberg-upgrade`'s `save_post` hook, which
 * deletes the `nvp_content_copy` the migrator and `wp cmsms restore` both need.
 */
function od_wp_rename_pages(bool $apply): void
{
    global $wpdb;

    foreach (od_wp_page_titles() as $path => $title) {
        $page = get_page_by_path($path);

        if (!$page) {
            WP_CLI::warning(sprintf('%s: no such page', $path));
            continue;
        }

        if ($page->post_title === $title) {
            WP_CLI::log(sprintf('%s (#%d): already «%s», skipped', $path, $page->ID, $title));
            continue;
        }

        WP_CLI::log(sprintf('%s (#%d): «%s» -> «%s»', $path, $page->ID, $page->post_title, $title));

        if (!$apply) {
            continue;
        }

        $written = $wpdb->update($wpdb->posts, ['post_title' => $title], ['ID' => $page->ID], ['%s'], ['%d']);
        if ($written === false) {
            WP_CLI::warning(sprintf('%s (#%d): write failed', $path, $page->ID));
            continue;
        }

        clean_post_cache($page->ID);
        WP_CLI::success(sprintf('%s (#%d): renamed', $path, $page->ID));
    }
}

// ---------------------------------------------------------------------------
// Runner. Everything above is a function; this is the only thing that runs.
// ---------------------------------------------------------------------------

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

$apply = in_array('apply', $args ?? [], true);
WP_CLI::log($apply ? 'Applying changes.' : 'Dry run — pass `apply` to write.');

od_wp_tag_programme_films($apply);
od_wp_rename_pages($apply);
