<?php
/**
 * Tests for `wp/scripts/od-wp.php`, on the harness in `harness.php`. The script's only pure part is its
 * registry, and the failure it can actually have is a typo in it — a duplicated
 * slug silently tags one post twice and leaves another untagged, and neither
 * shows up in the run's output.
 *
 *     php wp/tests/od-wp.test.php
 */

declare(strict_types=1);

require __DIR__ . '/harness.php';

/** WordPress's own, near enough for the bodies these functions are handed. */
function wp_strip_all_tags(string $html): string
{
    return trim(preg_replace('~<[^>]*>~', ' ', preg_replace('~<(script|style)\b[\s\S]*?</\1>~i', '', $html)));
}

require __DIR__ . '/../scripts/od-wp.php';

$registry = od_wp_programmes();
od_test('the registry is not empty', $registry !== []);

$seen = [];
foreach ($registry as $slug => $programme) {
    // The tag's own slug is typed into URLs and query blocks, so it stays ASCII;
    // the films' slugs are WordPress's own and are Cyrillic on this site.
    od_test($slug . ': tag slug is a plain ASCII slug', (bool) preg_match('#^[a-z0-9-]+$#', $slug));
    od_test($slug . ': tag has a name', !empty($programme['name']));
    od_test($slug . ': tag has films', !empty($programme['films']));

    foreach ($programme['films'] as $path => $poster) {
        od_test($slug . ': film slug is trimmed and non-empty', trim($path) === $path && $path !== '');
        od_test($path . ': a post slug, not a path', !str_contains($path, '/'));
        od_test($path . ': slugs are written decoded, sanitize_title() encodes them', !str_contains($path, '%'));

        // A film in two programmes would be tagged twice, which is fine — a film
        // listed twice in one is a typo that costs a film its place on a page.
        $key = $slug . '|' . $path;
        od_test($path . ': listed twice under ' . $slug, !isset($seen[$key]));
        $seen[$key] = true;

        if ($poster !== '') {
            od_test($path . ': плакат is a root-relative upload path', str_starts_with($poster, '/wp-content/'));
            od_test($path . ': the origin is added at write time, not stored', !str_contains($poster, '://'));
        }
    }
}

foreach (['programma-zdorovaya-rossiya', 'programma-zdorovaya-molodezh', 'programma-zdorovye-deti'] as $tag) {
    od_test($tag . ': the programme tag is registered', array_key_exists($tag, $registry));
}
od_test('six of the programme\'s nine lesson films exist as posts — see the registry docblock', count($registry['programma-zdorovaya-rossiya']['films']) === 6);
od_test('all seven «Здоровая молодежь» lessons have one', count($registry['programma-zdorovaya-molodezh']['films']) === 7);

// -- the two indexes renamed to the label the nav uses ----------------------

$titles = od_wp_page_titles();
od_test('at least one page is renamed', $titles !== []);

foreach ($titles as $path => $title) {
    od_test($path . ': a page path of one segment, no slashes', $path !== '' && !str_contains($path, '/'));
    od_test($path . ': a trimmed, non-empty title', trim($title) === $title && $title !== '');
}

// The title is the H1, the `<title>` and the breadcrumb of a natively rendered
// page (D6g/D6h), so these two are what the mocks and the nav say.
od_test('/projects/ carries the nav\'s own label', ($titles['projects'] ?? null) === 'Программы');
od_test('/materials/ likewise', ($titles['materials'] ?? null) === 'Материалы');
/* ------------------------------------------------------- the nav-menu edits */

$edits = od_wp_menu_edits();
od_test('at least one menu edit is registered', $edits !== []);

$byPath = [];
$byTitle = [];
foreach ($edits as $edit) {
    $key = $edit['path'] ?? $edit['title'] ?? '(none)';

    // Exactly one matcher: a row with both would match two different items, and
    // a row with neither matches every item in the menu.
    od_test($key . ': one matcher, path or title', isset($edit['path']) !== isset($edit['title']));

    if (isset($edit['path'])) {
        // The path is compared against `od_wp_menu_path()`'s output, so it has to
        // be in that form or it silently matches nothing and the run skips.
        od_test($key . ': the path has both slashes on', od_wp_menu_path($edit['path']) === $edit['path']);
        od_test($key . ': a path matcher is not a bare origin — that is «/», which is ГЛАВНАЯ', $edit['path'] !== '/');
        $byPath[$edit['path']] = $edit;
    } else {
        od_test($key . ': the title is trimmed and non-empty', trim($edit['title']) === $edit['title'] && $edit['title'] !== '');
        $byTitle[$edit['title']] = $edit;
    }

    if (isset($edit['rename'])) {
        od_test($key . ': the new title is trimmed and non-empty', trim($edit['rename']) === $edit['rename'] && $edit['rename'] !== '');
    }
}

od_test('«Написать отзыв» is deleted — the footer links the page', isset($byPath['/about/ostavit-otziv/']) && !isset($byPath['/about/ostavit-otziv/']['rename']));
od_test('«Устав и документы» is one item: /about/docs/ goes, /about/ustav/ is retitled', isset($byPath['/about/docs/']) && !isset($byPath['/about/docs/']['rename']) && ($byPath['/about/ustav/']['rename'] ?? null) === 'Устав и документы');
od_test('«Наша статистика» is matched by label, its url being a bare domain', isset($byTitle['Наша статистика']) && !isset($byTitle['Наша статистика']['rename']));

// The urls in this menu carry three different origins, one of them a `.рф`
// domain — only the path is the same on both installs.
od_test('od_wp_menu_path takes the path off an absolute url', '/about/docs/' === od_wp_menu_path('https://obshee-delo.ru/about/docs/'));
od_test('od_wp_menu_path ignores the origin, punycode included', '/about/ostavit-otziv/' === od_wp_menu_path('https://xn----9sbkcac6brh7h.xn--p1ai/about/ostavit-otziv/'));
od_test('od_wp_menu_path puts a missing trailing slash back', '/about/ustav/' === od_wp_menu_path('/about/ustav'));
od_test('od_wp_menu_path drops the query and the fragment', '/team/' === od_wp_menu_path('https://obshee-delo.ru/team/?x=1#top'));
od_test('od_wp_menu_path leaves the root as one slash, not two', '/' === od_wp_menu_path('https://obshee-delo.ru/'));

/* ------------------------------------------------- the records to be created */

$profiles = od_wp_profiles();
od_test('three records are missing on both servers — Панферова, Нигматянов, Федоренко', count($profiles) === 3);

foreach ($profiles as $entry) {
    od_test($entry['slug'] . ': slug is a plain ASCII slug', (bool) preg_match('#^[a-z0-9-]+$#', $entry['slug']));
    od_test($entry['slug'] . ': has a title', trim($entry['title']) !== '');
    od_test($entry['slug'] . ': photograph is a root-relative upload path', str_starts_with($entry['photo'], '/wp-content/uploads/'));
    od_test($entry['slug'] . ': the origin is added at import time, not stored', !str_contains($entry['photo'], '://'));

    $body = od_wp_profile_body($entry['photo']);
    // The contract with `od-pages.php`: that script writes the role and the
    // contacts into this block, and refuses a record without one.
    od_test($entry['slug'] . ': the body has the paragraph block od-pages.php fills', str_contains($body, '<!-- wp:paragraph -->'));
    od_test($entry['slug'] . ': and it is left empty here', str_contains($body, "<!-- wp:paragraph -->\n<!-- /wp:paragraph -->"));
    od_test($entry['slug'] . ': the photograph is in the body as well as the thumbnail', 2 === substr_count($body, $entry['photo']));
    od_test($entry['slug'] . ': two columns, the shape all 139 records share', 2 === substr_count($body, '<!-- wp:column '));
}

$slugs = array_column($profiles, 'slug');
od_test('no slug is listed twice', count($slugs) === count(array_unique($slugs)));

// -- the one page whose menu_order decides where it lists -------------------

$order = od_wp_page_order();
od_test('exactly one page is reordered', 1 === count($order));
od_test('and it is «Центральный Аппарат»', array_key_exists('contacts/moscow', $order));
// The accordion sorts by `menu_order` then title, so anything below every other
// page's 0 puts it first. A 0 here would bury it at the bottom of 75 regions.
od_test('at a menu_order below the 0 every other region carries', $order['contacts/moscow'] < 0);

foreach ($order as $path => $value) {
    od_test($path . ': a page path, resolved with get_page_by_path()', $path !== '' && strpos($path, '/') !== 0);
    od_test($path . ': an integer menu_order', is_int($value));
}

// -- the pages that hold nothing --------------------------------------------
//
// «Пустая карточка» is not «пустая страница», and that distinction is the whole
// point of the pass: 19 of od-dev's 74 regional bodies state no contact at all,
// but `/contacts/arkhangelskaya/` lists 8 coordinators and 50 events under that
// empty card. Only a page with nothing in any of the three places is drafted.

$empty = '<!-- wp:details --><details><summary>Об отделении</summary><!-- wp:paragraph -->'
	. '<p><strong>Архангельское областное отделение Общероссийской общественной организации «Общее дело»</strong></p>'
	. '<p><b>Адрес офиса:</b></p><p>тел.</p><p>e-mail:</p><!-- /wp:paragraph --></details><!-- /wp:details -->';
od_test('a body whose labels have nothing after them states no contact', od_wp_branch_contactless($empty));
od_test('a telephone counts', ! od_wp_branch_contactless($empty . '<p>тел. 8-924-140-60-40</p>'));
od_test('so does one written as a link', ! od_wp_branch_contactless($empty . '<p><a href="tel:+79241406040">+7 924 140-60-40</a></p>'));
od_test('an e-mail counts', ! od_wp_branch_contactless($empty . '<p>e-mail: rabota-amur@mail.ru</p>'));
od_test('and a page on a social network counts', ! od_wp_branch_contactless($empty . '<p><a href="https://vk.com/od_bel">vk.com/od_bel</a></p>'));
// The card's own markup must not read as a contact: `mailto:` and `tel:` are what
// `od-pages.php` writes, and a page that has been through it is still contactless
// if the accordion held nothing.
od_test('the transform\'s own output does not invent one', od_wp_branch_contactless('<!-- wp:group {"className":"od-branch"} --><div class="wp-block-group od-branch"><p class="od-branch__title">Архангельское областное отделение</p></div><!-- /wp:group -->'));

$terms = od_wp_branch_query_terms('<!-- wp:query {"query":{"postType":"profile","taxQuery":{"pl-categs":[506]}}} --><!-- wp:query {"query":{"postType":"post","taxQuery":{"category":[75]}}} -->');
od_test('both query terms are read off the body', ['pl-categs' => 506, 'category' => 75] === $terms);
// `-1` is the migrator's «match nothing»: a page asking for it lists nobody, so it
// must not count as a reason to keep the page.
od_test('the «match nothing» placeholder is not a term', [] === od_wp_branch_query_terms('<!-- wp:query {"query":{"taxQuery":{"pl-categs":[-1]}}} -->'));

/* -------------------- the film categories taken off news posts ------------- */

$miscategorised = od_wp_miscategorised_videos();
od_test('at least one post is un-categorised', $miscategorised !== []);

foreach ($miscategorised as $path => $categories) {
    od_test($path . ': a post slug, not a path', $path !== '' && !str_contains($path, '/'));
    od_test($path . ': slugs are written decoded, sanitize_title() encodes them', !str_contains($path, '%'));
    od_test($path . ': names at least one category', $categories !== []);
    od_test($path . ': no category listed twice', count($categories) === count(array_unique($categories)));

    foreach ($categories as $category) {
        // Only the four catalogue categories put a post on `/video/`; stripping
        // anything else here would quietly edit «Новости» instead.
        od_test(
            $path . ': «' . $category . '» is one of the four catalogue categories',
            in_array($category, ['movies', 'mult', 'roliki', 'famous'], true)
        );
    }
}

od_test_summary();
