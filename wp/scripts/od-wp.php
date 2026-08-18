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
 * without WordPress. There are two today — {@see od_wp_tag_programme_films()} and
 * {@see od_wp_create_profiles()} — and still no framework for them, because two
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
 * Where a photograph is fetched from when the library this runs against has not
 * got it: production, whose media library is the one every other environment is
 * a stale copy of.
 *
 * It is only ever reached on a *non*-production environment — on production the
 * file is already an attachment, so the lookup above the import finds it and the
 * download never happens.
 */
const OD_WP_MEDIA_SOURCE = 'https://obshee-delo.ru';

/**
 * `profile` records the live `/team/` page needs and WordPress has not got.
 *
 * There is one, and it is not an oversight in this script: Анна Панферова is on
 * the team page in prose and has no record under any status, on either server
 * (checked 2026-08-18). `/team/` is eleven links to eleven records
 * (`od-pages.php`, `OD_TEAM`), so the eleventh has to exist before it can be
 * linked.
 *
 * **The body created here is a shell** — the photograph and an empty paragraph
 * block, in the shape all 139 records share. The role and the contacts are
 * `od-pages.php`'s to write, from `OD_TEAM`, exactly as they are for the ten
 * records that already exist: one dataset, and this file does not repeat it.
 * That is also why the run order matters — this script first, then that one.
 *
 * `photo` is the upload path production carries, root-relative because the origin
 * differs per environment.
 *
 * @return array<int, array{slug: string, title: string, photo: string}>
 */
function od_wp_profiles(): array
{
    return [
        [
            'slug' => 'panferova-anna-andreevna',
            'title' => 'Панферова Анна Андреевна',
            'photo' => '/wp-content/uploads/2026/05/Screenshot_20260507_220750_Gallery-scaled-e1778522350302.jpg',
        ],
    ];
}

/**
 * The body a new `profile` starts with: two columns, the photograph in the first
 * and an empty paragraph block in the second.
 *
 * The empty block is load-bearing rather than tidy — `od_prepend_profile_lead()`
 * writes the role and the contacts *into* it, and refuses a record that has none.
 *
 * No `esc_url()` on the path: it comes from the registry above, not from input,
 * and leaving WordPress out is what lets `od-wp.test.php` check the shape of this
 * string without a WordPress to load.
 */
function od_wp_profile_body(string $photo): string
{
    return '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group">'
        . '<!-- wp:columns --><div class="wp-block-columns">'
        . '<!-- wp:column {"width":"50%"} --><div class="wp-block-column" style="flex-basis:50%">'
        . '<!-- wp:image {"sizeSlug":"full","linkDestination":"media"} -->' . "\n"
        . '<figure class="wp-block-image size-full"><a href="' . $photo . '">'
        . '<img src="' . $photo . '" alt=""/></a></figure>' . "\n"
        . '<!-- /wp:image --></div><!-- /wp:column -->'
        . '<!-- wp:column {"width":"50%"} --><div class="wp-block-column" style="flex-basis:50%">'
        . '<!-- wp:paragraph -->' . "\n"
        . '<!-- /wp:paragraph --></div><!-- /wp:column -->'
        . '</div><!-- /wp:columns --></div><!-- /wp:group -->';
}

/**
 * Task: create the records {@see od_wp_profiles()} lists, and give each the
 * photograph the team page shows.
 *
 * Idempotent on both halves, and each guard asks the question that is true on
 * every environment: the record is looked up by slug, and the photograph by
 * «does this record have a featured image» rather than by file — an imported copy
 * lands in the importing month, so its path is not the one this file carries.
 */
function od_wp_create_profiles(bool $apply): void
{
    foreach (od_wp_profiles() as $entry) {
        $post = get_page_by_path($entry['slug'], OBJECT, 'profile');

        if (!$post) {
            WP_CLI::log(sprintf('%s: no record, to be created as «%s»', $entry['slug'], $entry['title']));

            if (!$apply) {
                continue;
            }

            $created = wp_insert_post([
                'post_type' => 'profile',
                'post_status' => 'publish',
                'post_title' => $entry['title'],
                'post_name' => $entry['slug'],
                'post_content' => od_wp_profile_body($entry['photo']),
            ], true);

            if (is_wp_error($created)) {
                WP_CLI::warning(sprintf('%s: %s', $entry['slug'], $created->get_error_message()));
                continue;
            }

            $post = get_post($created);
            WP_CLI::success(sprintf('%s: record created (#%d)', $entry['slug'], $post->ID));
        }

        od_wp_profile_photo($post, $entry['photo'], $apply);
    }
}

/**
 * Give a record the featured image `PersonCard` draws, when it has none.
 *
 * Prefers an attachment the library already holds for that path — production has
 * one, and importing over it would leave two copies of the same photograph. Only
 * an environment whose library predates the file downloads it, from
 * {@see OD_WP_MEDIA_SOURCE}.
 */
function od_wp_profile_photo(WP_Post $post, string $photo, bool $apply): void
{
    if (get_post_thumbnail_id($post->ID)) {
        WP_CLI::log(sprintf('%s (#%d): already has a photograph, skipped', $post->post_name, $post->ID));

        return;
    }

    $file = ltrim(str_replace('/wp-content/uploads/', '', $photo), '/');
    $found = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'numberposts' => 1,
        'fields' => 'ids',
        'meta_key' => '_wp_attached_file',
        'meta_value' => $file,
    ]);

    if ($found) {
        WP_CLI::log(sprintf('%s (#%d): photograph is attachment %d', $post->post_name, $post->ID, $found[0]));

        if ($apply) {
            set_post_thumbnail($post->ID, (int) $found[0]);
            WP_CLI::success(sprintf('%s (#%d): photograph set', $post->post_name, $post->ID));
        }

        return;
    }

    $source = OD_WP_MEDIA_SOURCE . $photo;
    WP_CLI::log(sprintf('%s (#%d): photograph not in this library, to be imported from %s', $post->post_name, $post->ID, $source));

    if (!$apply) {
        return;
    }

    // `media import` rather than `media_sideload_image()`: it is WP-CLI's own
    // command, it attaches and sets the featured image in one call, and its
    // failures come back as a non-zero exit rather than a `WP_Error` to unpack.
    $result = WP_CLI::runcommand(
        sprintf('media import %s --post_id=%d --featured_image --porcelain', escapeshellarg($source), $post->ID),
        ['return' => 'all', 'exit_error' => false]
    );

    if ($result->return_code !== 0) {
        WP_CLI::warning(sprintf('%s (#%d): import failed — %s', $post->post_name, $post->ID, trim($result->stderr)));

        return;
    }

    WP_CLI::success(sprintf('%s (#%d): photograph imported as attachment %s', $post->post_name, $post->ID, trim($result->stdout)));
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
od_wp_create_profiles($apply);
