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
 * without WordPress. There are five today — {@see od_wp_tag_programme_films()},
 * {@see od_wp_rename_pages()}, {@see od_wp_order_pages()}, {@see od_wp_edit_menu()}
 * and {@see od_wp_create_profiles()} — and still no framework between them,
 * because five calls in a row is not a thing that needs one.
 *
 * House rules, same as `od-pages.php`: dry run by default, writing takes the
 * positional argument `apply`, everything is idempotent, and **posts are
 * addressed by slug**, never by id, because ids differ per environment — and a
 * nav menu item, which has no slug, is addressed by the path it points at. The
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
 * Pages whose `menu_order` decides where something lists them, and the value.
 *
 * One entry. `/contacts/`'s accordion (`[od_regions]`,
 * `wp/mu-plugins/od-regions.php`) orders its 75 regions by `menu_order` then
 * title, and «Центральный Аппарат» — the page `/contacts/moscow/` — is first in
 * Figma `contact` (`754:587`) and **last** alphabetically. All 74 children sit at
 * 0, so a single negative value is the whole fix, and it is the cheapest one:
 * nothing has to be listed, nothing renumbers when a region is added, and an
 * editor can still reorder from the admin's own «Порядок» field.
 *
 * @return array<string, int> Page path => `menu_order`.
 */
function od_wp_page_order(): array
{
    return [
        'contacts/moscow' => -1,
    ];
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
 * Three, and none of them is an oversight in this script: Анна Панферова is on
 * the team page in prose, Дамир Нигматянов and Михаил Федоренко are on
 * `/about/supervisory/` the same way, and none of the three has a record under any
 * status on either server (checked 2026-08-18/19). Both pages are now links to
 * records (`od-pages.php`, `OD_TEAM` and `OD_SUPERVISORY`), so the records have to
 * exist before they can be linked.
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
        // The two members of the Наблюдательный совет who had no record either.
        // Their photographs have been on `/about/supervisory/` since 2019, so both
        // libraries already hold them and nothing is downloaded.
        [
            'slug' => 'nigmatyanov-damir-zinnurovich',
            'title' => 'Нигматянов Дамир Зиннурович',
            'photo' => '/wp-content/uploads/2019/08/НигматяновДамирЗиннурыч_min.jpeg',
        ],
        [
            'slug' => 'fedorenko-mihail-vladimirovich',
            'title' => 'Федоренко Михаил Владимирович',
            'photo' => '/wp-content/uploads/2019/08/ФедоренкоМихаилВладимирович_min.jpeg',
        ],
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

/**
 * Sets the `menu_order` in {@see od_wp_page_order()} on the pages that do not
 * already carry it. Through `$wpdb->update` for the same reason as above.
 */
function od_wp_order_pages(bool $apply): void
{
    global $wpdb;

    foreach (od_wp_page_order() as $path => $order) {
        $page = get_page_by_path($path);

        if (!$page) {
            WP_CLI::warning(sprintf('%s: no such page', $path));
            continue;
        }

        if ((int) $page->menu_order === $order) {
            WP_CLI::log(sprintf('%s (#%d): already menu_order %d, skipped', $path, $page->ID, $order));
            continue;
        }

        WP_CLI::log(sprintf('%s (#%d): menu_order %d -> %d', $path, $page->ID, (int) $page->menu_order, $order));

        if (!$apply) {
            continue;
        }

        $written = $wpdb->update($wpdb->posts, ['menu_order' => $order], ['ID' => $page->ID], ['%d'], ['%d']);
        if ($written === false) {
            WP_CLI::warning(sprintf('%s (#%d): write failed', $path, $page->ID));
            continue;
        }

        clean_post_cache($page->ID);
        WP_CLI::success(sprintf('%s (#%d): reordered', $path, $page->ID));
    }
}


/** The menu the site's header is built from — `wp menu list` calls it `primary`. */
const OD_WP_MENU = 'main-navigation';

/**
 * The «main-navigation» edits: one row per item, each naming how to find it and
 * what to do with it. No `rename` means delete it.
 *
 * **Found by `path`, per this file's house rule of never using an id** — and
 * rather than by label, which is the other stable-looking key: the two installs
 * disagree on the labels here (prod says «Документы и отчёты» where od-dev says
 * «Документы») but the pages are the same pages, so their paths agree. What the
 * items disagree on is the *origin* — several are still absolute against an old
 * `.рф` domain — which is why only the path is compared
 * ({@see od_wp_menu_path()}).
 *
 * **`title` is the matcher for an item that points off-site**, where the path
 * says nothing: the statistics site's url is a bare domain, so its path is `/`,
 * which is «ГЛАВНАЯ»'s path too — matching on it would delete the home link.
 * Both installs carry that item under the same label and the same url, and the
 * label is the half a human recognises. (`navOverrides`, the frontend's late
 * «ОБЩЕЕДЕЛО-ПРО» filter, matched by label for the same reason before the item
 * was deleted outright — see `implementation-notes.md`.)
 *
 * What each row is for:
 *
 *  - **`/about/ostavit-otziv/`** — «Написать отзыв» goes. The footer's «Отзывы»
 *    column already links the page, so the nav entry was a third route to one
 *    Contact Form 7 form, and `/about/` stopped carrying a card for it too.
 *  - **`/about/docs/` and `/about/ustav/`** — one item, «Устав и документы».
 *    They are a tabbed pair on the frontend now
 *    (`src/shared/config/pageSections.ts`), the way «Команда» and
 *    «Наблюдательный совет» are, and a section with a tab strip gets one entry.
 *  - **«Наша статистика»** — the statistics site it points at wants a refresh
 *    before the organisation sends readers to it. The `/about/` card came off
 *    first; this is the nav agreeing with it. Both come back together, and
 *    `next-steps.md` says how.
 *
 * **Order matters on production.** The merge leaves no link to `/about/docs/` for
 * anything that doesn't draw the tab strip, and the old theme doesn't — so this
 * runs in the cutover window, with the rest of workstream D, not before it.
 *
 * @return array<int, array{path?: string, title?: string, rename?: string}>
 */
function od_wp_menu_edits(): array
{
    return [
        ['path' => '/about/ostavit-otziv/'],
        ['path' => '/about/docs/'],
        ['path' => '/about/ustav/', 'rename' => 'Устав и документы'],
        ['title' => 'Наша статистика'],
    ];
}

/**
 * The comparable part of a menu item's url: its path, with both slashes on.
 *
 * A menu item's url is whatever was typed into the admin — this menu holds
 * absolute urls against three different origins — so the path is the only part
 * that means the same thing on both installs. Pure, and tested.
 */
function od_wp_menu_path(string $url): string
{
    $path = trim((string) parse_url($url, PHP_URL_PATH), '/');

    return $path === '' ? '/' : '/' . $path . '/';
}

/**
 * Applies {@see od_wp_menu_edits()} to the header menu.
 *
 * Retitling goes through `$wpdb->update`, the same way {@see od_wp_rename_pages()}
 * does and for the same reason; deleting goes through `wp_delete_post()`, which
 * is what `wp menu item delete` calls — a nav menu item carries five postmeta
 * keys and nothing else should be left holding them.
 */
function od_wp_edit_menu(bool $apply): void
{
    global $wpdb;

    $menu = wp_get_nav_menu_object(OD_WP_MENU);
    if (!$menu) {
        WP_CLI::warning(sprintf('%s: no such menu', OD_WP_MENU));

        return;
    }

    $items = wp_get_nav_menu_items($menu->term_id) ?: [];

    foreach (od_wp_menu_edits() as $edit) {
        $key = $edit['path'] ?? $edit['title'];
        $found = array_filter($items, static function ($item) use ($edit): bool {
            return isset($edit['path'])
                ? od_wp_menu_path($item->url) === $edit['path']
                : $item->title === $edit['title'];
        });

        if ($found === []) {
            // Which is the state this leaves behind, so it is a skip, not a
            // warning: a second run reports every deletion this way.
            WP_CLI::log(sprintf('%s: no item in %s, skipped', $key, OD_WP_MENU));
            continue;
        }

        foreach ($found as $item) {
            $title = $edit['rename'] ?? null;

            if ($title === null) {
                WP_CLI::log(sprintf('%s (#%d): «%s» to be deleted', $key, $item->db_id, $item->title));

                if ($apply && wp_delete_post($item->db_id, true)) {
                    WP_CLI::success(sprintf('%s (#%d): deleted', $key, $item->db_id));
                }

                continue;
            }

            if ($item->title === $title) {
                WP_CLI::log(sprintf('%s (#%d): already «%s», skipped', $key, $item->db_id, $title));
                continue;
            }

            WP_CLI::log(sprintf('%s (#%d): «%s» -> «%s»', $key, $item->db_id, $item->title, $title));

            if (!$apply) {
                continue;
            }

            $written = $wpdb->update($wpdb->posts, ['post_title' => $title], ['ID' => $item->db_id], ['%s'], ['%d']);
            if ($written === false) {
                WP_CLI::warning(sprintf('%s (#%d): write failed', $key, $item->db_id));
                continue;
            }

            clean_post_cache($item->db_id);
            WP_CLI::success(sprintf('%s (#%d): retitled', $key, $item->db_id));
        }
    }
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
od_wp_rename_pages($apply);
od_wp_order_pages($apply);
od_wp_edit_menu($apply);
od_wp_create_profiles($apply);
