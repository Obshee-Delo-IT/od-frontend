<?php
/**
 * od-wp.php — the WordPress-side data workstream D needs, everything that is not
 * a page's own markup.
 *
 *     wp --url=https://od-dev.tmweb.ru eval-file od-wp.php           # dry run, every task
 *     wp --url=https://od-dev.tmweb.ru eval-file od-wp.php apply     # write, every task
 *     wp eval-file od-wp.php apply untag-video-events                # one task only
 *
 * The task names are the keys of the `$tasks` map in the runner at the bottom.
 * Naming one is how a tier takes a single fix without the rest of workstream D —
 * which is what production needs until it is migrated.
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
 * without WordPress. There are thirteen today — {@see od_wp_tag_programme_films()},
 * {@see od_wp_rename_pages()}, {@see od_wp_order_pages()},
 * {@see od_wp_draft_empty_branches()}, {@see od_wp_edit_menu()},
 * {@see od_wp_create_profiles()}, {@see od_wp_untag_video_events()},
 * {@see od_wp_rehost_posters()}, {@see od_wp_merge_duplicate_branches()},
 * {@see od_wp_strip_footer_links()}, {@see od_wp_create_short_category()},
 * {@see od_wp_tag_film_topics()} and {@see od_wp_author_footer()} — and still no
 * framework between them, because thirteen calls in a row is not a thing that
 * needs one.
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


/**
 * Whether a regional page's body states **no way to reach anybody** — no
 * telephone, no address, no page on a social network.
 *
 * 19 of od-dev's 74 regional bodies are like this, and the reason is always the
 * same: the accordion the branch card is built from holds «Адрес офиса:», «тел.»
 * and «e-mail:» with nothing after them. Pure, so `wp/tests/od-wp.test.php` can
 * check it against the real shapes.
 *
 * Reads the body whether or not `od-pages.php` has run on it: before the card the
 * contacts are plain text, after it they are `tel:` and `mailto:` links, and both
 * match.
 */
function od_wp_branch_contactless(string $content): bool
{
    $text = wp_strip_all_tags($content);

    return !preg_match('~[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}~', $text)
        && !preg_match('~(?:\+7|\b8)[\s\-()]*\d{3}[\s\-()]*\d{2,3}[\s\-]?\d{2}~', $text)
        && !preg_match('~(?:vk\.(?:com|ru)|t\.me)/~i', $content);
}

/**
 * The taxonomy terms a regional page's two `core/query` blocks list — its
 * coordinators (`pl-categs`) and its «События» (`category`).
 *
 * `-1` is the migrator's «match nothing» placeholder and is dropped, so a page
 * that asks for it counts as asking for nothing.
 *
 * @return array<string, int> Taxonomy => term id.
 */
function od_wp_branch_query_terms(string $content): array
{
    $terms = [];

    foreach (['pl-categs', 'category'] as $taxonomy) {
        if (preg_match('~"' . preg_quote($taxonomy, '~') . '":\[(-?\d+)\]~', $content, $found) && (int) $found[1] > 0) {
            $terms[$taxonomy] = (int) $found[1];
        }
    }

    return $terms;
}

/**
 * Drafts the regional pages that hold **nothing**: no contact in the body, no
 * coordinator in the loop, no event in the news query.
 *
 * Asked for as «пустые карточки переведи в статус черновик», and the three
 * conditions are why it is not just the first one. 19 of od-dev's 74 regional
 * cards carry only the branch's legal name — but `/contacts/arkhangelskaya/`
 * lists **8 coordinators** under it and 50 events, and unpublishing that page
 * would hide both. A page has to be empty in every sense before it is not worth
 * an address; on od-dev exactly one is (`/contacts/evreiskaya-ao/`).
 *
 * **What drafting a page does here:** the catch-all stops finding a published
 * page for that URL, so it falls through to the A6 iframe (`WP_LEGACY_BASE`) —
 * or to a 404 on a tier that has none — and the page leaves `sitemap.xml`. The
 * URL does not die, it stops being ours.
 *
 * Through `$wpdb->update` for the same reason as everything else in this file:
 * `wp_update_post()` would run the block parser over a body written by a script.
 */
function od_wp_draft_empty_branches(bool $apply): void
{
    global $wpdb;

    $index = get_page_by_path('contacts');
    if (!$index) {
        WP_CLI::warning('/contacts/: no such page — skipping the empty-branch pass');

        return;
    }

    $pages = get_posts([
        'post_type' => 'page',
        'post_status' => 'publish',
        'post_parent' => $index->ID,
        'numberposts' => -1,
        'orderby' => 'title',
        'order' => 'ASC',
    ]);

    $extra = get_page_by_path('khabarovskiy', OBJECT, 'page');
    if ($extra && $extra->post_status === 'publish') {
        $pages[] = $extra;
    }

    $drafted = 0;

    foreach ($pages as $page) {
        if (!od_wp_branch_contactless($page->post_content)) {
            continue;
        }

        $listed = [];
        foreach (od_wp_branch_query_terms($page->post_content) as $taxonomy => $term) {
            $listed[$taxonomy] = count(get_posts([
                'post_type' => $taxonomy === 'pl-categs' ? 'profile' : 'post',
                'post_status' => 'publish',
                'numberposts' => 1,
                'fields' => 'ids',
                'tax_query' => [['taxonomy' => $taxonomy, 'terms' => [$term]]],
            ]));
        }

        if (array_sum($listed) > 0) {
            WP_CLI::log(sprintf(
                '%s (#%d): no contacts, but the page lists %s — left published',
                $page->post_name,
                $page->ID,
                implode(', ', array_map(
                    function ($taxonomy) use ($listed) {
                        return $listed[$taxonomy] . ' × ' . $taxonomy;
                    },
                    array_keys(array_filter($listed))
                ))
            ));
            continue;
        }

        WP_CLI::log(sprintf('%s (#%d): nothing on the page — publish -> draft', $page->post_name, $page->ID));

        if (!$apply) {
            continue;
        }

        $written = $wpdb->update($wpdb->posts, ['post_status' => 'draft'], ['ID' => $page->ID], ['%s'], ['%d']);
        if ($written === false) {
            WP_CLI::warning(sprintf('%s (#%d): write failed', $page->post_name, $page->ID));
            continue;
        }

        clean_post_cache($page->ID);
        $drafted++;
    }

    WP_CLI::log(sprintf('%d regional page(s) drafted.', $drafted));
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

/**
 * Post slug => the catalogue categories that post must not carry.
 *
 * `/video/` and its four segment pages are a query over «Фильмы» (`movies`),
 * «Мультфильмы» (`mult`), «Ролики» (`roliki`) and «Известные люди» (`famous`) —
 * so a category is the whole of what puts a post in the film catalogue. These
 * three are «Видео события»: an event report, a volunteers' meet-up and a news
 * item about posters on Petersburg screens, each filed under a film category by
 * hand. Every one keeps its other categories, so it stays where it belongs in
 * «Новости»; nothing here strips a post's last category.
 *
 * How the three were found, and how to find the next one: a catalogue post that
 * carries a category outside {the four, «Видео события» 52, «Видео» 85,
 * «Новости» 47} is a news post wearing a film's clothes — a region, a country,
 * a programme. That test picked out exactly these three of the 86 published
 * catalogue posts and no film. It is not a rule the site enforces, so it is
 * written down here rather than coded: re-run it against `/wp/v2/posts` before
 * assuming the list is still complete.
 *
 * @return array<string, string[]>
 */
function od_wp_miscategorised_videos(): array
{
    return [
        // «"ПОЖИРАТЕЛИ МОЗГА" В СЕРБСКОМ ОПОВЕ» — a screening in Serbia.
        'пожиратели-мозга-в-сербском-опове' => ['movies'],
        // «Межрегиональный слёт волонтёров «Общее дело — 2019»».
        'межрегиональный-слёт-волонтёров-общ' => ['roliki'],
        // «Размещение видео роликов «Общее дело» на видео экранах Петербурга».
        'размещение-видео-ролико-общее-дело-н' => ['roliki'],
    ];
}

/**
 * Take the film category off the «Видео события» posts that carry one, which is
 * what puts a news item in the film catalogue ({@see od_wp_miscategorised_videos()}).
 *
 * Idempotent by reading the post's terms first, so a second run says «already»
 * rather than warning. A category the post does not carry is not an error — the
 * registry is a list of what must not be there, not a description of today.
 */
function od_wp_untag_video_events(bool $apply): void
{
    foreach (od_wp_miscategorised_videos() as $path => $categories) {
        $post = get_page_by_path($path, OBJECT, 'post')
            ?: get_page_by_path(sanitize_title($path), OBJECT, 'post');

        if (!$post) {
            WP_CLI::warning(sprintf('%s: no post with that slug', $path));
            continue;
        }

        foreach ($categories as $category) {
            $term = get_term_by('slug', $category, 'category');

            if (!$term) {
                WP_CLI::warning(sprintf('%s: no «%s» category on this install', $path, $category));
                continue;
            }

            if (!has_term($term->term_id, 'category', $post->ID)) {
                WP_CLI::log(sprintf('%s (#%d): already out of «%s», skipped', $path, $post->ID, $term->name));
                continue;
            }

            WP_CLI::log(sprintf('%s (#%d) «%s»: -«%s»', $path, $post->ID, get_the_title($post), $term->name));

            if (!$apply) {
                continue;
            }

            $removed = wp_remove_object_terms($post->ID, [$term->term_id], 'category');
            if (is_wp_error($removed)) {
                WP_CLI::warning(sprintf('%s: %s', $path, $removed->get_error_message()));
                continue;
            }

            WP_CLI::success(sprintf('%s (#%d): out of «%s»', $path, $post->ID, $term->name));
        }
    }
}

/**
 * A `poster_image_url` rehosted onto `$home`, or null when it already belongs
 * there — or is not this install's business at all.
 *
 * Only an absolute URL whose path starts with `/wp-content/` is touched: that is
 * a WordPress upload, and every install has its own copy of the same path
 * because each tier is a clone of the one before it. Anything else — a
 * Яндекс.Диск link, a root-relative path, an external image someone pasted —
 * is left exactly as the editor wrote it.
 *
 * The path is carried over as a substring rather than re-assembled, so its
 * percent-encoding survives: these filenames are Cyrillic, and re-encoding one
 * is how a working URL becomes a 404.
 */
function od_wp_rehost_url(string $url, string $home): ?string
{
    $url = trim($url);
    $home = rtrim($home, '/');

    if (!preg_match('#^https?://#i', $url)) {
        return null;
    }

    $at = strpos($url, '/wp-content/');
    if ($at === false || strpos($url, $home . '/') === 0) {
        return null;
    }

    return $home . substr($url, $at);
}

/**
 * Point every film's плакат at this install's own media, not another tier's.
 *
 * **Why this exists.** The film worksheet was filled against od-dev and carried
 * onto od-stage by `pnpm film:remap`, which rewrites post ids — they differ per
 * environment — but not the URLs inside the cells. So ten films arrived on the
 * clone with a `poster_image_url` on `od-dev.tmweb.ru`, and `next/image`
 * allowlists this tier's `WP_BASE` and the media CDN, not another tier's host:
 * the плакат card rendered and its image 400ed. The same sheet promotes to
 * production, so this is a step of the promotion, not a one-off repair.
 *
 * Reads `home_url()` rather than a registry — there is nothing per-film to know,
 * and that is what makes it safe to re-run on any tier.
 */
function od_wp_rehost_posters(bool $apply): void
{
    $home = home_url();
    $films = get_posts([
        'post_type' => 'post',
        'post_status' => 'any',
        'numberposts' => -1,
        'fields' => 'ids',
        'meta_query' => [['key' => 'poster_image_url', 'value' => '', 'compare' => '!=']],
    ]);

    $moved = 0;
    foreach ($films as $id) {
        $current = (string) get_post_meta($id, 'poster_image_url', true);
        $rehosted = od_wp_rehost_url($current, $home);

        if ($rehosted === null) {
            continue;
        }

        WP_CLI::log(sprintf('#%d «%s»: плакат on %s', $id, get_the_title($id), wp_parse_url($current, PHP_URL_HOST)));
        $moved++;

        if (!$apply) {
            continue;
        }

        update_post_meta($id, 'poster_image_url', $rehosted);
        update_post_meta($id, '_poster_image_url', 'field_film_poster_image_url');
        WP_CLI::success(sprintf('#%d: плакат rehosted', $id));
    }

    WP_CLI::log(sprintf('%d плакат(ов) %s.', $moved, $apply ? 'rehosted' : 'to rehost'));
}

/**
 * Region pages production holds **twice**, as `kept path => retired path`.
 *
 * Two regions have a second page each, made by an editor instead of an edit to
 * the first: `/contacts/rezan-oblast/` beside `/contacts/ryazanskaya/` and
 * `/contacts/smolenskaya-oblasti/` beside `/contacts/smolenskaya/`. Both live on
 * production, so both survive a clone — this is not od-dev clutter — and
 * `[od_regions]` lists one disclosure per published child, so `/contacts/`
 * draws «Рязанская область» twice: the first empty, the second holding the
 * coordinator. That is what О. В. Баранова reported («на новом сайте почему-то
 * две Рязанские области… при нажатии на Рязанскую область на карте не
 * открывается окошко с координатором») — the map links to the *kept* slug,
 * which is the empty one.
 *
 * **Which one is kept is not a judgement about content.** The kept path is the
 * one `src/modules/RussiaMap/regions.generated.ts` links and search has
 * indexed; the newer slug is the one nothing points at. The contacts move to
 * the kept page, and the duplicate is drafted, which is exactly what
 * `docs/test-scenarios.md` says this class of collision must end as.
 *
 * The third pair it names — `/materials/metodichka/` beside
 * `/materials/metodichki/` — is deliberately absent: it is not a branch, it has
 * no contacts to move, and the two bodies differ. It stays a decision, in
 * `docs/next-steps.md`.
 *
 * @return array<string, string>
 */
function od_wp_duplicate_branches(): array
{
    return [
        'contacts/ryazanskaya' => 'contacts/rezan-oblast',
        'contacts/smolenskaya' => 'contacts/smolenskaya-oblasti',
    ];
}

/**
 * Whether the retired page's body is the one worth keeping — the kept page has
 * no contact in it and the retired page has.
 *
 * Both directions of «no» matter and neither is an error: two contactless pages
 * mean the duplicate is simply redundant, and a kept page that already states
 * its coordinator means this has run before (or the editor fixed it), so the
 * body must not be overwritten.
 */
function od_wp_branch_takes_over(string $kept, string $retired): bool
{
    return od_wp_branch_contactless($kept) && !od_wp_branch_contactless($retired);
}

/**
 * Retires the second page of a region: its contacts move onto the page the map
 * links, and it is drafted.
 *
 * Drafting rather than deleting, for the reason {@see od_wp_draft_empty_branches()}
 * gives: the URL stops being ours and falls through to the A6 iframe, which is
 * recoverable by re-publishing. Through `$wpdb->update` like everything else
 * here, so the block parser never runs over a body a script wrote.
 */
function od_wp_merge_duplicate_branches(bool $apply): void
{
    global $wpdb;

    foreach (od_wp_duplicate_branches() as $keptPath => $retiredPath) {
        $kept = get_page_by_path($keptPath, OBJECT, 'page');
        $retired = get_page_by_path($retiredPath, OBJECT, 'page');

        if (!$kept || !$retired) {
            WP_CLI::log(sprintf('%s / %s: one of the pair is missing — nothing to merge', $keptPath, $retiredPath));
            continue;
        }

        if ($retired->post_status !== 'publish') {
            WP_CLI::log(sprintf('%s (#%d): already retired', $retiredPath, $retired->ID));
            continue;
        }

        if (od_wp_branch_takes_over($kept->post_content, $retired->post_content)) {
            WP_CLI::log(sprintf(
                '%s (#%d): no contacts here, taking the body of %s (#%d)',
                $keptPath,
                $kept->ID,
                $retiredPath,
                $retired->ID
            ));

            if ($apply) {
                $written = $wpdb->update(
                    $wpdb->posts,
                    ['post_content' => $retired->post_content],
                    ['ID' => $kept->ID],
                    ['%s'],
                    ['%d']
                );
                if ($written === false) {
                    WP_CLI::warning(sprintf('%s (#%d): write failed — the duplicate stays published', $keptPath, $kept->ID));
                    continue;
                }
                clean_post_cache($kept->ID);
                WP_CLI::success(sprintf('%s (#%d): body written', $keptPath, $kept->ID));
            }
        } else {
            WP_CLI::log(sprintf('%s (#%d): keeps its own body', $keptPath, $kept->ID));
        }

        WP_CLI::log(sprintf('%s (#%d): publish -> draft', $retiredPath, $retired->ID));

        if (!$apply) {
            continue;
        }

        $drafted = $wpdb->update($wpdb->posts, ['post_status' => 'draft'], ['ID' => $retired->ID], ['%s'], ['%d']);
        if ($drafted === false) {
            WP_CLI::warning(sprintf('%s (#%d): write failed', $retiredPath, $retired->ID));
            continue;
        }

        clean_post_cache($retired->ID);
        WP_CLI::success(sprintf('%s (#%d): drafted', $retiredPath, $retired->ID));
    }
}

/** The parent every catalogue category hangs off, by slug — «Видео». */
const OD_WP_VIDEO_PARENT = 'video';

/**
 * «Короткометражные» — the fifth catalogue category, and the twelve films that
 * go in it.
 *
 * The collection is not new: `/video/short/` is a **page**, curated by hand, and
 * the nav has always pointed at it. What it never had is a category, so the
 * catalogue could not draw it and `src/proxy.ts` sent the whole nav item to
 * `/video/`. These twelve are the page's own list, in its own order, read off
 * production's body for page 35015.
 *
 * Nine of them are already «Ролики» and stay so — a film carries as many
 * categories as it belongs to, and this one is a second shelf, not a move. The
 * tenth, «Межрегиональный слёт волонтёров», is a news post with a video format
 * and no catalogue category at all; tagging it is what puts it on `/video/`.
 *
 * The segment this becomes on the frontend is `short`, which is the address the
 * nav already holds — so `FILM_CATEGORIES` gains `short` and the
 * `/video/short/` redirect goes.
 *
 * @return array{slug: string, name: string, films: array<int, string>}
 */
function od_wp_short_films(): array
{
    return [
        'slug' => 'short',
        'name' => 'Короткометражные',
        'films' => [
            'что-такое-общее-дело-презентация-орга',
            'презентация-организации-общее-дело-к',
            'замечаем-ли-мы-как-нами-манипулируют-с-2',
            'почему-же-они-курят',
            'трезвый-разбор-мифы-об-алкоголе-разоб',
            'якутия-трезвые-сёла-правда-и-мифы',
            'межрегиональный-слёт-волонтёров-общ',
            'удивительная-история-о-женской-красо',
            'генетический-код-главное-сокровище',
            'pismo-putinu',
            'new-rolik',
            'seks-i-alco',
        ],
    ];
}

/**
 * Creates «Короткометражные» under «Видео» and tags {@see od_wp_short_films()}.
 *
 * Both halves are idempotent the way the rest of this file is: an existing term
 * is reused rather than duplicated, and `wp_set_post_categories()` is called with
 * `$append = true`, so a film that already carries the category keeps exactly the
 * categories it has.
 *
 * **The term id it prints is the one the frontend needs.** `FILM_CATEGORIES` in
 * `src/shared/config/filmCategories.ts` — and its copy in `scripts/lib/wp.mjs` —
 * maps the URL segment to a WordPress id, and ids differ per install, so this
 * task's output is the input for that edit on whichever tier it has just run
 * against.
 */
function od_wp_create_short_category(bool $apply): void
{
    $short = od_wp_short_films();

    $parent = get_term_by('slug', OD_WP_VIDEO_PARENT, 'category');
    if (!$parent) {
        WP_CLI::error(sprintf('no «%s» category — nothing to hang the segment off', OD_WP_VIDEO_PARENT));
    }

    $term = get_term_by('slug', $short['slug'], 'category');

    if ($term && (int) $term->parent !== (int) $parent->term_id) {
        // A category with this slug somewhere else in the tree is not ours to
        // re-parent: the catalogue queries by id, so the wrong one would draw
        // the wrong films under a name that looks right.
        WP_CLI::error(sprintf(
            '«%s» (#%d) exists outside «%s» (parent #%d) — resolve by hand',
            $short['slug'],
            $term->term_id,
            OD_WP_VIDEO_PARENT,
            $term->parent
        ));
    }

    if ($term) {
        WP_CLI::log(sprintf('«%s» (#%d): already under «%s», skipped', $term->name, $term->term_id, OD_WP_VIDEO_PARENT));
    } else {
        WP_CLI::log(sprintf('«%s»: to be created under «%s» (#%d)', $short['name'], OD_WP_VIDEO_PARENT, $parent->term_id));

        if (!$apply) {
            // Without the term there is no id to tag with, and reporting twelve
            // films against a term that does not exist would be a lie.
            return;
        }

        $created = wp_insert_term($short['name'], 'category', [
            'slug' => $short['slug'],
            'parent' => $parent->term_id,
        ]);

        if (is_wp_error($created)) {
            WP_CLI::error(sprintf('«%s»: %s', $short['name'], $created->get_error_message()));
        }

        $term = get_term((int) $created['term_id'], 'category');
        WP_CLI::success(sprintf('«%s» (#%d): created — this is the id `FILM_CATEGORIES` needs', $term->name, $term->term_id));
    }

    foreach ($short['films'] as $slug) {
        $posts = get_posts([
            'name' => sanitize_title($slug),
            'post_type' => 'post',
            'post_status' => 'any',
            'numberposts' => 1,
        ]);

        if (!$posts) {
            WP_CLI::warning(sprintf('%s: no such post', $slug));
            continue;
        }

        $post = $posts[0];

        if (has_category((int) $term->term_id, $post)) {
            WP_CLI::log(sprintf('%s (#%d): already «%s», skipped', $slug, $post->ID, $term->name));
            continue;
        }

        WP_CLI::log(sprintf('%s (#%d): to be added to «%s»', $slug, $post->ID, $term->name));

        if (!$apply) {
            continue;
        }

        $set = wp_set_post_categories($post->ID, [(int) $term->term_id], true);
        if (is_wp_error($set)) {
            WP_CLI::warning(sprintf('%s (#%d): %s', $slug, $post->ID, $set->get_error_message()));
            continue;
        }

        WP_CLI::success(sprintf('%s (#%d): tagged', $slug, $post->ID));
    }
}

/**
 * The «ОТЗЫВЫ» footer links that go, each as the substring that identifies its
 * `<li>`.
 *
 *  - **«Предложить идею»** points at `http://od1.reformal.ru/`, over plain HTTP,
 *    a third-party suggestion box that has not existed for years.
 *  - **«Оставить отзыв»** points at `/about/ostavit-otziv/`, whose Contact Form
 *    7 form cannot submit from the new site — and on production cannot submit at
 *    all, since REST is switched off there ({@see `next-steps.md`}).
 *
 * Matched by a substring of the item's own markup rather than by its label: the
 * two installs spell the surrounding markup differently (production's widget is
 * a classic `text` widget, the clone's is a block one), but the href inside is
 * the same string on both. The path is written without `href="` so an absolute
 * url against any of this site's three historical origins matches too.
 *
 * @return array<int, string>
 */
function od_wp_footer_links(): array
{
    return [
        '/about/ostavit-otziv/',
        'od1.reformal.ru',
    ];
}

/**
 * Every `<li>` whose markup contains one of `$needles`, removed from `$html`.
 *
 * Handles both widget dialects in one pass, because the block editor's list item
 * *is* an `<li>` with a pair of HTML comments around it — so the comments are
 * matched optionally and a classic widget simply has none. Anything else in the
 * document is returned byte for byte: this runs against a live footer, and the
 * two installs' markup is not ours to reformat.
 *
 * Pure, and tested without WordPress.
 */
function od_wp_strip_list_items(string $html, array $needles): string
{
    $pattern = '~(?:<!--\s*wp:list-item\s*-->\s*)?<li\b[^>]*>.*?</li>(?:\s*<!--\s*/wp:list-item\s*-->)?\s*~su';

    return (string) preg_replace_callback($pattern, static function (array $m) use ($needles): string {
        foreach ($needles as $needle) {
            if (strpos($m[0], $needle) !== false) {
                return '';
            }
        }

        return $m[0];
    }, $html);
}

/**
 * Applies {@see od_wp_footer_links()} to the footer widgets.
 *
 * Both widget options are swept rather than one named widget id, since the ids
 * differ per install (production keeps the column in `widget_text[2]`, the clone
 * in `widget_block[4]`) and the needles are specific enough that a widget which
 * does not carry the link is left untouched — which is also what makes a second
 * run a no-op.
 *
 * The write is `update_option()`, not `$wpdb->update`: widgets are one
 * serialized option and WordPress caches it.
 */
function od_wp_strip_footer_links(bool $apply): void
{
    $needles = od_wp_footer_links();

    foreach (['widget_text' => 'text', 'widget_block' => 'content'] as $option => $field) {
        $widgets = get_option($option);
        if (!is_array($widgets)) {
            WP_CLI::log(sprintf('%s: no such option, skipped', $option));
            continue;
        }

        $changed = false;

        foreach ($widgets as $id => $widget) {
            if (!is_array($widget) || !isset($widget[$field]) || !is_string($widget[$field])) {
                continue;
            }

            $stripped = od_wp_strip_list_items($widget[$field], $needles);
            if ($stripped === $widget[$field]) {
                continue;
            }

            $removed = substr_count($widget[$field], '<li') - substr_count($stripped, '<li');
            WP_CLI::log(sprintf('%s[%s] «%s»: %d item(s) to be removed', $option, $id, $widget['title'] ?? '', $removed));

            $widgets[$id][$field] = $stripped;
            $changed = true;
        }

        if (!$changed) {
            // The state this leaves behind, so a second run reports it this way.
            WP_CLI::log(sprintf('%s: no item carries either link, skipped', $option));
            continue;
        }

        if (!$apply) {
            continue;
        }

        if (!update_option($option, $widgets)) {
            WP_CLI::warning(sprintf('%s: write failed', $option));
            continue;
        }

        WP_CLI::success(sprintf('%s: written', $option));
    }
}

// ---------------------------------------------------------------------------
/**
 * The ten subjects the 84 catalogue films divide into, and which films each holds.
 *
 * Asked for on 2026-09-12 («группировку фильмов по тегам … алкоголь, курение и
 * предложить другие»), and a reviewer's suggestion before that: the catalogue's
 * five shelves are *forms* — фильм, мультфильм, ролик, короткометражный,
 * известные люди — so somebody looking for what to show at a lesson about smoking
 * has to read 84 titles. The subject is the axis nobody can filter on.
 *
 * **`post_tag`, not a new taxonomy.** The install already has 384 tags; they are
 * ten years of one-off keywords («Агидель», «Баннер», 45 of them on one post) and
 * useless as a filter, but two of them — «Алкоголь» (#213) and «Табак» (#216) —
 * are the right names with no posts on them, left by somebody who started this and
 * stopped. So the topics are ordinary tags and the frontend reads the eleven ids,
 * exactly as `FILM_CATEGORIES` reads five category ids: no taxonomy to register,
 * no mu-plugin, and an editor sees a familiar box.
 *
 * A film carries as many topics as it is about, which is the whole difference from
 * the categories — «Конвейер смерти» is alcohol *and* tobacco, «Секреты
 * манипуляции. Алкоголь» is alcohol *and* the manipulation it documents.
 *
 * **Five films are deliberately absent.** `pismo-putinu` («Письмо Путину») and
 * `ребенок-и-ангел-трогательная-истори` have empty bodies and empty excerpts on
 * both installs, so there is nothing to read them off — an editor assigns those
 * two. The other three are the presentations and the слёт: «Об организации» is
 * not a subject somebody browses the catalogue for, it is what `/about/` is, so
 * those films get no topic here (2026-09-12).
 *
 * Assigned from each film's own title and excerpt, not from the existing tags.
 *
 * @return array<string, array{name: string, films: array<int, string>}>
 */
function od_wp_film_topics(): array
{
    return [
        'alcohol' => [
            'name' => 'Алкоголь',
            'films' => [
                'алкоголь-взгляд-изнутри', // Алкоголь. Взгляд изнутри
                'документальный-фильм-алкоголь-секр', // Алкоголь. Секреты манипуляции
                'алкоголь-незримый-враг', // Алкоголь. НЕЗРИМЫЙ ВРАГ
                'скрытые-вопросы-опасное-погружение', // Скрытые вопросы. Опасное погружение
                'мультфильм-опасное-погружение-сер', // Мультфильм «Опасное погружение» сериала «Команда Познавалова».
                'трезвый-разбор-мифы-об-алкоголе-разоб', // Трезвый разбор Мифы об алкоголе. Разоблачение TrashSmash Валентина Конона
                'якутия-трезвые-сёла-правда-и-мифы', // Якутия. Трезвые сёла правда и мифы
                'история-трезвеннических-движений-в-р', // История трезвеннических движений в России!
                'конвейер-смерти-в-современной-россии', // Конвейер смерти в современной России. Владимир Жданов
                'konvejer-smerti', // Конвейер смерти в современной России Жданов Владимир Георгиевич
                'профессор-ефимов-в-а-прибыль-от-алкого', // Профессор Ефимов В.А. Прибыль от алкоголя и табака
                'professor-efimov', // Профессор Ефимов. Прибыль от алкоголя и табака
                'в-г-жданов-о-пиве-и-пивной-рекламе', // В.Г. Жданов. О пиве и пивной рекламе
                'zdanov-video', // Что скрывают от народа? Владимир Жданов
                'why-no-need-alcohol', // Почему России алкоголь больше не нужен!?
                'вопрос-алкоголя-в-исламе-ислам-зарипо', // Вопрос алкоголя в Исламе! Ислам Зарипов
                'belov', // Как алкоголь влияет на способность писать музыку?
                'butusov', // Вячеслав Бутусов – Откровенный разговор
                'manipulacia-alcogol', // Секреты манипуляции Алкоголь
                'one-deception-story', // История одного обмана
                'seks-i-alco', // Секс и алкоголь
                'new-rolik', // Увлекательный ролик
                '04-09-14-война-в-россии-уже-сейчас-сотни-поги', // Война в России УЖЕ СЕЙЧАС!!! Сотни погибших ежедневно!
            ],
        ],
        'tobacco' => [
            'name' => 'Табак',
            'films' => [
                'курение-взгляд-изнутри', // Курение. Взгляд изнутри
                'никотин-секреты-манипуляции', // Никотин. Секреты манипуляции
                'деньги-с-дымком', // Деньги с дымком
                'скрытые-вопросы-тайна-едкого-дыма', // Скрытые вопросы. Тайна едкого дыма
                'multfilm-tayna-edkogo-dyma', // Команда Познавалова Тайна едкого дыма
                '28749', // The Mystery of the Deadly Smoke
                'почему-же-они-курят', // Почему же они курят?
                'что-скрыто-от-курильщика-ведущий-врач-2', // Что скрыто от курильщика? Ведущий врач онколог
                'onkolog', // Непридуманная история от ведущего врача онколога
                'gandapas', // Легкий способ бросить курить. Радислав Гандапас
                'secrets-tabac', // Секреты манипуляции Табак
                'конвейер-смерти-в-современной-россии', // Конвейер смерти в современной России. Владимир Жданов
                'konvejer-smerti', // Конвейер смерти в современной России Жданов Владимир Георгиевич
                'профессор-ефимов-в-а-прибыль-от-алкого', // Профессор Ефимов В.А. Прибыль от алкоголя и табака
                'professor-efimov', // Профессор Ефимов. Прибыль от алкоголя и табака
                'butusov', // Вячеслав Бутусов – Откровенный разговор
            ],
        ],
        'drugs' => [
            'name' => 'Наркотики',
            'films' => [
                'наркотики-лучшее-что-придумал-дьявол', // Наркотики. Лучшее, что придумал дьявол
                'narkotiki-sekrety-manipuljacii', // Наркотики. СЕКРЕТЫ МАНИПУЛЯЦИИ!
                'в-г-жданов-о-наркотиках', // В.Г. Жданов. О наркотиках
                'gazmanov', // Олег Газманов о наркотиках
                'samoylov', // Творчество вместо наркотиков. Вадим Самойлов
                'drugs-legalize', // Как легализуют наркотики в России
            ],
        ],
        'manipulation' => [
            'name' => 'Манипуляция и реклама',
            'films' => [
                'ловцы-душ-секреты-манипуляции-фильмы', // Ловцы душ. Секреты манипуляции: Фильмы, Кино, Сериалы
                'документальный-фильм-алкоголь-секр', // Алкоголь. Секреты манипуляции
                'никотин-секреты-манипуляции', // Никотин. Секреты манипуляции
                'narkotiki-sekrety-manipuljacii', // Наркотики. СЕКРЕТЫ МАНИПУЛЯЦИИ!
                'secrets-tabac', // Секреты манипуляции Табак
                'manipulacia-alcogol', // Секреты манипуляции Алкоголь
                'one-deception-story', // История одного обмана
                'деньги-с-дымком', // Деньги с дымком
                'влияние-кино-на-общество-николай-бурл', // Влияние кино на общество Николай Бурляев
                'влияние-кино-на-общество-николай-бурл-2', // Влияние кино на общество. Николай Бурляев
                'замечаем-ли-мы-как-нами-манипулируют-с-2', // Замечаем ли мы как нами манипулируют? Социологическое исследование!
                'в-г-жданов-о-пиве-и-пивной-рекламе', // В.Г. Жданов. О пиве и пивной рекламе
            ],
        ],
        'family' => [
            'name' => 'Семья и отношения',
            'films' => [
                'спасибо-за-жизнь', // Спасибо за жизнь
                'мама-я-вырасту', // Мама, я вырасту!
                'докажи-что-любишь', // Докажи, что любишь
                'фильм-как-научиться-любить-пошагова', // Фильм Как научиться любить? . Пошаговая инструкция
                'генетический-код-главное-сокровище', // Генетический код – главное сокровище нации
                'удивительная-история-о-женской-красо', // Удивительная история о женской красоте
                'woman-nature-secret', // Тайна природы женщины
                'man-five-secrets', // Пять секретов настоящего мужчины
                '5-secrets-of-a-real-man', // 5 secrets of a real man!
                'real-man', // Кто такой настоящий мужчина? Александр Муромский
                'inna-gomes', // Актриса Инна Гомес о семейных ценностях
                'condoms', // Миф о защитных свойствах презерватива. Академик РАМН
                'juvenalnaja-justicija', // Ювенальная юстиция в России. Депутат Евгений Федоров
                'уникальный-православный-фильм-утеря', // Уникальный православный фильм Утерянная добродетель
                'seks-i-alco', // Секс и алкоголь
            ],
        ],
        'meaning' => [
            'name' => 'Смысл жизни',
            'films' => [
                'как-найти-призвание', // Как найти призвание
                'камертон-счастья-2', // Камертон счастья
                'фильм-четыре-ключа-к-твоим-победам', // Фильм «Четыре ключа к твоим победам»
                'грязные-слова', // Грязные слова
                'torsunov', // Поступая так, ты похож на животное О.Г. Торсунов
                'tolstoy', // Лев Николаевич Толстой – Путь Жизни
                'dorokhova', // Одежда это система знаков. Катерина Дорохова
                'kuklachev', // Удивительная история! Юрий Куклачев
                'пьер-эдель-обращение-музыканта-к-моло', // Пьер Эдель Обращение музыканта к молодёжи!
            ],
        ],
        'health' => [
            'name' => 'Здоровье',
            'films' => [
                'сахар-атакует', // САХАР АТАКУЕТ
                'большая-опасность-маленьких-размеро', // БОЛЬШАЯ ОПАСНОСТЬ МАЛЕНЬКИХ РАЗМЕРОВ
                'история-с-ушами', // История с ушами
                'команда-познавалова-задача-по-зубам', // Команда Познавалова – Задача по зубам
                'как-не-стать-импотентом-доктор-медици', // Как не стать импотентом? Доктор медицинских наук О.И. Аполихин
                'yugay', // Здоровье мужчины. Сергей Югай
                'condoms', // Миф о защитных свойствах презерватива. Академик РАМН
            ],
        ],
        'faith' => [
            'name' => 'Вера и традиция',
            'films' => [
                'уникальный-православный-фильм-утеря', // Уникальный православный фильм Утерянная добродетель
                'вопрос-алкоголя-в-исламе-ислам-зарипо', // Вопрос алкоголя в Исламе! Ислам Зарипов
                'lovchev', // Почему князь Владимир выбрал Христианство?
                'tolstoy', // Лев Николаевич Толстой – Путь Жизни
            ],
        ],
        'history' => [
            'name' => 'История и патриотизм',
            'films' => [
                'обращение-офицера-вдв-ко-дню-победы', // Обращение офицера ВДВ ко Дню Победы!!!
                'rolik-oficer-specnaza', // Офицер спецназа. Что я могу сделать для России?
                'emelyanenko', // 70 лет Великой Победы. Федор Емельяненко
                'lovchev', // Почему князь Владимир выбрал Христианство?
                'история-трезвеннических-движений-в-р', // История трезвеннических движений в России!
            ],
        ],
        'gadgets' => [
            'name' => 'Гаджеты и игры',
            'films' => [
                'пожиратели-мозга', // Пожиратели мозга
                'путь-героя-фильм-о-игровой-зависимост', // Путь героя. Фильм об игровой зависимости
            ],
        ],
    ];
}

/**
 * Task: create the eleven topic tags and put each film on the ones it belongs to.
 *
 * Additive and idempotent, like every other task here: an existing term is reused
 * rather than duplicated, and `wp_set_post_terms()` is called with `$append = true`
 * so the ten years of keywords a film already carries survive.
 *
 * A term is looked up by **slug and then by name**, because the two that already
 * exist were created through the editor and carry percent-encoded Cyrillic slugs —
 * `wp_insert_term()` would refuse the name as a duplicate and leave the topic with
 * no term at all.
 *
 * **The ids it prints are what the frontend needs**, the same way
 * `create-short-category` prints one: term ids are per-install.
 */
function od_wp_tag_film_topics(bool $apply): void
{
    foreach (od_wp_film_topics() as $slug => $topic) {
        $term = get_term_by('slug', $slug, 'post_tag') ?: get_term_by('name', $topic['name'], 'post_tag');

        if ($term) {
            WP_CLI::log(sprintf('%s: «%s» (#%d) exists, reused', $slug, $term->name, $term->term_id));
        } else {
            WP_CLI::log(sprintf('%s: tag missing, to be created as «%s»', $slug, $topic['name']));

            if ($apply) {
                $created = wp_insert_term($topic['name'], 'post_tag', ['slug' => $slug]);
                if (is_wp_error($created)) {
                    WP_CLI::warning(sprintf('%s: %s', $slug, $created->get_error_message()));
                    continue;
                }

                $term = get_term($created['term_id'], 'post_tag');
                WP_CLI::success(sprintf('%s: tag created (#%d)', $slug, $term->term_id));
            }
            // A dry run carries on without a term, so the film list below is still
            // the point of the run.
        }

        foreach ($topic['films'] as $path) {
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
}


/**
 * The six `sidebar_bottom` widgets, in slot order, as block HTML.
 *
 * The footer is laid out by `Footer.module.css` with `.footer aside:nth-child(N)`,
 * so the order here *is* the design: logo + socials, КОНТАКТЫ РЕДАКЦИИ, ОТЗЫВЫ,
 * ССЫЛКИ, a separator, and the legal row. Six is not decoration — five widgets
 * shift every column one slot left.
 *
 * **Why this is in a script at all.** Production's own footer is four legacy
 * `widget_text` instances, and `welfare` registered the area they live in; the
 * area comes back with {@see od-sidebars.php}, but its content has to be
 * authored. It was authored once by hand on the prod clone — the design's
 * structure with production's own words, which is the rule od-dev content never
 * satisfies — and that authoring existed nowhere but that install's database
 * until this task. A second clone would have come up with an empty footer at
 * status 200.
 *
 * `%HOME%` is the only per-environment value: the logo is a file under
 * `wp-content/uploads/`, not an attachment, so nothing here carries an id.
 * Production's four `widget_text` instances stay in `wp_inactive_widgets` as the
 * record of what the live site said.
 *
 * @return array<int, string>
 */
function od_wp_footer_widgets(): array
{
    return [
        // логотип, название организации и три соцсети
        <<<'HTML'
<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column {"width":"100%"} -->
<div class="wp-block-column" style="flex-basis:100%"><!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:columns {"verticalAlignment":"center","isStackedOnMobile":false} -->
<div class="wp-block-columns are-vertically-aligned-center is-not-stacked-on-mobile"><!-- wp:column {"verticalAlignment":"center","width":"30%","layout":{"type":"default"}} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:30%"><!-- wp:image {"width":"60px","height":"auto","sizeSlug":"full","linkDestination":"none","align":"center"} -->
<figure class="wp-block-image aligncenter size-full is-resized"><img src="%HOME%/wp-content/uploads/2026/08/logo-white.png" alt="" style="width:60px;height:auto"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"85%","layout":{"type":"default"}} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:85%"><!-- wp:paragraph {"fontSize":"small"} -->
<p class="has-small-font-size">ОБЩЕРОССИЙСКАЯ<br>ОБЩЕСТВЕННАЯ<br>ОРГАНИЗАЦИЯ</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->

<!-- wp:heading -->
<h2 class="wp-block-heading"><a class="cmsms-icon-vkontakte" title="VK" href="http://vk.com/obsheedelorf" target="_blank"> </a><a class="cmsms-icon-odnoklassniki" title="Одноклассники" href="http://ok.ru/obsheedelo" target="_blank"> </a><a class="cmsms-icon-youtube-2" title="YouTube" href="https://www.youtube.com/user/proektobsheedelo?sub_confirmation=1" target="_blank"> </a></h2>
<!-- /wp:heading --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
HTML,

        // КОНТАКТЫ РЕДАКЦИИ
        <<<'HTML'
<!-- wp:group {"layout":{"type":"flex","orientation":"vertical"}} -->
<div class="wp-block-group"><!-- wp:heading -->
<h2 class="wp-block-heading">КОНТАКТЫ РЕДАКЦИИ</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><b>Главный редактор:</b><br>Дегтярев А.А.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><b>Электронная почта:</b><br>web@obshee-delo.ru</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><b>Телефон:</b><br>+7 (962) 950-75-61</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->
HTML,

        // ОТЗЫВЫ
        <<<'HTML'
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group"><!-- wp:heading -->
<h2 class="wp-block-heading">ОТЗЫВЫ</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><a href="/about/reviews/">Письма и отзывы</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/about/smi/">СМИ о нас</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/about/experts-review/">Экспертные заключения</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/about/nashi_partnery/">Наши партнеры</a></li>
<!-- /wp:list-item -->

</ul>
<!-- /wp:list --></div>
<!-- /wp:group -->
HTML,

        // ССЫЛКИ
        <<<'HTML'
<!-- wp:group {"layout":{"type":"flex","orientation":"vertical"}} -->
<div class="wp-block-group"><!-- wp:heading -->
<h2 class="wp-block-heading">ССЫЛКИ</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><a href="/about/">О нас</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/news/">Наши дела</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/video/">Наши фильмы</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/get-involved/">Прими участие</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/materials/">Наши материалы</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/sitemap/">Карта сайта</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/faq/">Частые вопросы</a></li>
<!-- /wp:list-item --></ul>
<!-- /wp:list --></div>
<!-- /wp:group -->
HTML,

        // разделитель
        <<<'HTML'
<!-- wp:separator {"className":"is-style-wide"} -->
<hr class="wp-block-separator has-alpha-channel-opacity is-style-wide"/>
<!-- /wp:separator -->
HTML,

        // юридическая строка: СМИ, учредитель, 12+, политика конфиденциальности
        <<<'HTML'
<!-- wp:group {"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p><b>Средство массовой информации:</b><br>Сетевое издание "ОБЩЕЕ ДЕЛО"<br><a href="/wp-content/uploads/2019/04/2018-02-16-Выписка-из-реестра-СМИ-сайт-ОД.pdf" target="_blank">Зарегистрировано Роскомнадзором, свидетельство Эл № ФC77-72346 от 14 февраля 2018</a></p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><b>Учредитель:</b><br>Общероссийская общественная организация "Общее дело" ОГРН: 1127799010624<br>Учётный номер в реестре НКО №0012011716</p>
<!-- /wp:paragraph -->

<!-- wp:group {"layout":{"type":"flex","orientation":"vertical"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>При перепечатывании материалов ссылка на издание обязательна. 12+</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="/conf_politics/">Политика конфиденциальности</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
HTML,
    ];
}

/** The widget area `fetchFooter` reads — {@see od-sidebars.php} re-registers it. */
const OD_WP_FOOTER_SIDEBAR = 'sidebar_bottom';

/**
 * Which `widget_block` id each slot lands on, and which slots differ from what
 * is stored.
 *
 * Pure, so the allocation is testable without WordPress. A slot that already has
 * a widget keeps its id, so a re-run rewrites in place instead of growing the
 * option by six every time; a slot with none takes the next free integer key.
 *
 * @param array<int|string, mixed> $blocks  The `widget_block` option.
 * @param array<int, string>       $sidebar The ids currently in the area, in order.
 * @param array<int, string>       $wanted  Slot bodies, in order.
 * @return array{ids: array<int, int>, changed: array<int, int>}
 */
function od_wp_footer_plan(array $blocks, array $sidebar, array $wanted): array
{
    $next = 2;
    foreach (array_keys($blocks) as $key) {
        if (is_numeric($key)) {
            $next = max($next, (int) $key + 1);
        }
    }

    $ids = [];
    $changed = [];
    foreach ($wanted as $slot => $html) {
        $existing = isset($sidebar[$slot]) && preg_match('/^block-(\d+)$/', (string) $sidebar[$slot], $m)
            ? (int) $m[1]
            : null;
        $id = $existing ?? $next++;
        $ids[$slot] = $id;

        $stored = $blocks[$id]['content'] ?? null;
        if (!is_string($stored) || $stored !== $html) {
            $changed[] = $slot;
        }
    }

    return ['ids' => $ids, 'changed' => $changed];
}

/**
 * Writes {@see od_wp_footer_widgets()} into the footer area.
 *
 * Both halves are one `update_option()` each, because that is what a widget is —
 * `widget_block` holds the bodies, `sidebars_widgets` holds the assignment. Do
 * **not** reach for `wp widget move`: WP-CLI does not understand block widgets,
 * `wp widget list` shows an area holding them as empty, and moving one silently
 * drops it into `wp_inactive_widgets` (runbook §0.6 item 6).
 */
function od_wp_author_footer(bool $apply): void
{
    $home = untrailingslashit(home_url());
    $wanted = array_map(
        static fn (string $html): string => str_replace('%HOME%', $home, $html),
        od_wp_footer_widgets()
    );

    $blocks = get_option('widget_block');
    $blocks = is_array($blocks) ? $blocks : [];
    $areas = get_option('sidebars_widgets');
    $areas = is_array($areas) ? $areas : [];
    $sidebar = isset($areas[OD_WP_FOOTER_SIDEBAR]) && is_array($areas[OD_WP_FOOTER_SIDEBAR])
        ? array_values($areas[OD_WP_FOOTER_SIDEBAR])
        : [];

    $plan = od_wp_footer_plan($blocks, $sidebar, $wanted);
    $target = array_map(static fn (int $id): string => 'block-' . $id, $plan['ids']);

    if ($plan['changed'] === [] && $sidebar === $target) {
        WP_CLI::log(sprintf('%s: six widgets already in shape, skipped', OD_WP_FOOTER_SIDEBAR));

        return;
    }

    foreach ($plan['changed'] as $slot) {
        WP_CLI::log(sprintf(
            'block-%d (slot %d): %s',
            $plan['ids'][$slot],
            $slot + 1,
            isset($blocks[$plan['ids'][$slot]]) ? 'to be rewritten' : 'to be created'
        ));
    }
    if ($sidebar !== $target) {
        WP_CLI::log(sprintf('%s: [%s] → [%s]', OD_WP_FOOTER_SIDEBAR, implode(', ', $sidebar), implode(', ', $target)));
    }

    if (!$apply) {
        return;
    }

    foreach ($plan['ids'] as $slot => $id) {
        $blocks[$id] = ['content' => $wanted[$slot]];
    }
    $blocks['_multiwidget'] = 1;
    update_option('widget_block', $blocks);

    // A widget id in two areas renders twice. Ours belong to the footer, so they
    // come out of everywhere else — `wp_inactive_widgets` above all, which is
    // where a theme swap parks everything.
    foreach ($areas as $area => $ids) {
        if ($area === OD_WP_FOOTER_SIDEBAR || !is_array($ids)) {
            continue;
        }
        $areas[$area] = array_values(array_diff($ids, $target));
    }
    $areas[OD_WP_FOOTER_SIDEBAR] = $target;
    update_option('sidebars_widgets', $areas);

    WP_CLI::success(sprintf('%s: %d widget(s) written, area assigned', OD_WP_FOOTER_SIDEBAR, count($target)));
}


// Runner. Everything above is a function; this is the only thing that runs.
// ---------------------------------------------------------------------------

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

/**
 * Task name => the function that runs it. Naming them is what lets a tier take
 * *some* of workstream D: production is not migrated yet, so running the whole
 * runner there would create the programme tags, rename its indexes and draft its
 * empty branches — none of which production has asked for. A named task is one
 * fix, applied where it belongs.
 */
$tasks = [
    'tag-programme-films' => 'od_wp_tag_programme_films',
    'rename-pages' => 'od_wp_rename_pages',
    'order-pages' => 'od_wp_order_pages',
    'draft-empty-branches' => 'od_wp_draft_empty_branches',
    'merge-duplicate-branches' => 'od_wp_merge_duplicate_branches',
    'edit-menu' => 'od_wp_edit_menu',
    'create-profiles' => 'od_wp_create_profiles',
    'untag-video-events' => 'od_wp_untag_video_events',
    'rehost-posters' => 'od_wp_rehost_posters',
    'strip-footer-links' => 'od_wp_strip_footer_links',
    'create-short-category' => 'od_wp_create_short_category',
    'tag-film-topics' => 'od_wp_tag_film_topics',
    'author-footer' => 'od_wp_author_footer',
];

$positional = $args ?? [];
$apply = in_array('apply', $positional, true);
$named = array_values(array_diff($positional, ['apply']));
$unknown = array_diff($named, array_keys($tasks));

// Refuse rather than silently run everything: a typo'd task name on production
// would apply all eight.
if ($unknown) {
    WP_CLI::error(sprintf(
        "unknown task(s): %s\nKnown: %s",
        implode(', ', $unknown),
        implode(', ', array_keys($tasks))
    ));
}

$run = $named ?: array_keys($tasks);
WP_CLI::log(sprintf(
    '%s %s.',
    $apply ? 'Applying' : 'Dry run —',
    $named ? implode(', ', $named) : 'every task' . ($apply ? '' : '; pass `apply` to write')
));

foreach ($run as $name) {
    $tasks[$name]($apply);
}
