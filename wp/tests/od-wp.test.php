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

/* ------------------ the second page two regions have on production --------- */

$withContacts = $empty . '<p>Баранова Ольга Владимировна</p><p>8-960-570-67-07</p><p>OlgaVladimirovnaBaranova@yandex.ru</p>';

od_test('the kept page takes the duplicate\'s body when only the duplicate states a contact', od_wp_branch_takes_over($empty, $withContacts));
// Idempotency, and the whole reason the check is on the *content* rather than on
// a flag: run twice, the second run must not overwrite what the first wrote.
od_test('…and does not once it has one', ! od_wp_branch_takes_over($withContacts, $withContacts));
// A page an editor has since filled in must not be reverted to the duplicate.
od_test('a kept page with its own contacts is never overwritten', ! od_wp_branch_takes_over($withContacts, $empty));
// Two empty pages: the duplicate is redundant, not a source.
od_test('two contactless pages copy nothing', ! od_wp_branch_takes_over($empty, $empty));

$pairs = od_wp_duplicate_branches();
od_test('both pairs are addressed by path, never by id', $pairs === array_filter($pairs, static fn($path) => (bool) preg_match('~^contacts/[a-z-]+$~', $path)));
// The kept path is what the clickable map links; renaming one there 404s a region.
$map = file_get_contents(__DIR__ . '/../../src/modules/RussiaMap/regions.generated.ts');
foreach (array_keys($pairs) as $keptPath) {
    od_test(sprintf('the map links the kept page /%s/', $keptPath), str_contains($map, "'/" . $keptPath . "/'"));
}

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

/* ------------------ плакаты pointed back at this install's media ----------- */

$home = 'https://od.webtm.ru';
$dev = 'https://od-dev.tmweb.ru/wp-content/uploads/2023/01/%D0%9F%D0%BB%D0%B0%D0%BA%D0%B0%D1%82-A2.jpg';

od_test('another tier\'s upload is rehosted', od_wp_rehost_url($dev, $home) === $home . '/wp-content/uploads/2023/01/%D0%9F%D0%BB%D0%B0%D0%BA%D0%B0%D1%82-A2.jpg');
// The filenames are Cyrillic; re-encoding one turns a working URL into a 404.
od_test('the path is carried over byte for byte', str_contains((string) od_wp_rehost_url($dev, $home), '%D0%9F%D0%BB%D0%B0%D0%BA%D0%B0%D1%82'));
od_test('a trailing slash on home does not double', od_wp_rehost_url($dev, $home . '/') === $home . '/wp-content/uploads/2023/01/%D0%9F%D0%BB%D0%B0%D0%BA%D0%B0%D1%82-A2.jpg');
od_test('this install\'s own upload is left alone', od_wp_rehost_url($home . '/wp-content/uploads/a.jpg', $home) === null);
// Only `/wp-content/` is a path every clone shares. Everything else an editor
// pasted means what it says.
od_test('a Яндекс.Диск link is not an upload', od_wp_rehost_url('https://disk.yandex.ru/i/abc', $home) === null);
od_test('an external image is not this install\'s business', od_wp_rehost_url('https://example.org/poster.jpg', $home) === null);
od_test('a root-relative path is not absolute', od_wp_rehost_url('/wp-content/uploads/a.jpg', $home) === null);
od_test('and neither is an empty field', od_wp_rehost_url('', $home) === null);

/* ------------------ the two footer links that lead nowhere ----------------- */

// Both bodies are the live «ОТЗЫВЫ» column, byte for byte: production's classic
// `widget_text[2]` and the clone's block `widget_block[4]`. They are the two
// dialects one function has to handle.
$classic = <<<'HTML'
<ul>
<li><a href="/about/reviews/">Письма и отзывы</a></li>
<li><a href="/about/smi/">СМИ о нас</a></li>
<li><a href="/about/experts-review/">Экспертные заключения</a></li>
<li><a href="/about/nashi_partnery/">Наши партнеры</a></li>
<li><a href="/about/ostavit-otziv/">Оставить отзыв</a></li>
<li><a href="http://od1.reformal.ru/" target="_blank">Предложить идею</a></li>


</ul>
HTML;

$block = <<<'HTML'
<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li><a href="/about/reviews/">Письма и отзывы</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="/about/ostavit-otziv/">Оставить отзыв</a></li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li><a href="http://od1.reformal.ru/" target="_blank">Предложить идею</a></li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->
HTML;

$needles = od_wp_footer_links();
$strippedClassic = od_wp_strip_list_items($classic, $needles);
$strippedBlock = od_wp_strip_list_items($block, $needles);

od_test('the classic widget loses «Оставить отзыв»', !str_contains($strippedClassic, 'ostavit-otziv'));
od_test('…and «Предложить идею»', !str_contains($strippedClassic, 'reformal'));
od_test('…and keeps the other four', substr_count($strippedClassic, '<li>') === 4);
od_test('the block widget loses both too', !str_contains($strippedBlock, 'ostavit-otziv') && !str_contains($strippedBlock, 'reformal'));
// A stray `<!-- wp:list-item -->` with no `<li>` under it is markup the editor
// renders as an empty bullet, which is worse than the link it replaced.
od_test('…taking its comment wrappers with it', substr_count($strippedBlock, 'wp:list-item') === 2);
od_test('…and keeps the list itself', str_contains($strippedBlock, '<!-- wp:list -->') && str_contains($strippedBlock, '</ul>'));
od_test('the item that stays is untouched', str_contains($strippedBlock, '<li><a href="/about/reviews/">Письма и отзывы</a></li>'));
// The task writes only when the body changed, so a second pass has to be a no-op
// — and a footer column that carries neither link must come back byte for byte.
od_test('a second pass changes nothing', od_wp_strip_list_items($strippedBlock, $needles) === $strippedBlock);
$other = "<ul>\n<li><b>Телефон:</b><br>\n+7 (962) 950-75-61</li>\n</ul>";
od_test('a column with neither link is returned byte for byte', od_wp_strip_list_items($other, $needles) === $other);
// An absolute url against any of the site's three historical origins is the same
// link, and the needle is written without `href="` so that it matches.
od_test(
    'an absolute url to the same page matches',
    od_wp_strip_list_items('<ul><li><a href="https://obshee-delo.ru/about/ostavit-otziv/">x</a></li></ul>', $needles)
        === '<ul></ul>'
);

/* ------------------ «Короткометражные», the fifth catalogue category -------- */

$short = od_wp_short_films();

od_test('the segment is the address the nav already holds', $short['slug'] === 'short');
od_test('the category has a name', $short['name'] !== '');
od_test('it is the twelve films the curated page lists', count($short['films']) === 12);
od_test('no film is listed twice — a duplicate would tag one and hide another', count($short['films']) === count(array_unique($short['films'])));

foreach ($short['films'] as $slug) {
    od_test($slug . ': a post slug, not a path', $slug !== '' && !str_contains($slug, '/'));
    // WordPress stores these percent-encoded; the registry writes what a human
    // can read and `sanitize_title()` encodes it at lookup time.
    od_test($slug . ': slugs are written decoded', !str_contains($slug, '%'));
    od_test($slug . ': trimmed', trim($slug) === $slug);
}

// The frontend maps the segment to a term id, and the file that does it has to
// gain this segment or the category is created and nothing draws it.
$categories = file_get_contents(__DIR__ . '/../../src/shared/config/filmCategories.ts');
od_test('FILM_CATEGORIES carries the segment', str_contains($categories, $short['slug'] . ': '));
// `scripts/lib/wp.mjs` keeps its own copy — zero-dep Node cannot import TS.
$mjs = file_get_contents(__DIR__ . '/../../scripts/lib/wp.mjs');
od_test('and so does the scripts copy', str_contains($mjs, $short['name']));
// A redirect would beat the route: the proxy runs first, so a leftover
// `/video/short/` rule 301s the new category page onto the whole catalogue.
$redirects = file_get_contents(__DIR__ . '/../../src/shared/config/legacyRedirects.ts');
od_test('and no redirect shadows the segment any more', !str_contains($redirects, "=== '" . $short['slug'] . "'"));

/* --------------------------- The eleven film topics ------------------------ */

$topics = od_wp_film_topics();

od_test('there are ten topics', count($topics) === 10);
od_test('«Алкоголь» and «Табак» are among them, by the names the empty tags already carry', 'Алкоголь' === $topics['alcohol']['name'] && 'Табак' === $topics['tobacco']['name']);
od_test('every topic key is a latin URL segment', [] === array_filter(array_keys($topics), static fn(string $k): bool => (bool) preg_match('~[^a-z-]~', $k)));
od_test('no two topics share a name — the lookup falls back to the name', count($topics) === count(array_unique(array_column($topics, 'name'))));

$seen = [];
foreach ($topics as $key => $topic) {
    od_test($key . ': has a name', '' !== $topic['name']);
    od_test($key . ': holds at least two films', count($topic['films']) >= 2);
    od_test($key . ': no film listed twice', count($topic['films']) === count(array_unique($topic['films'])));

    foreach ($topic['films'] as $slug) {
        od_test($key . '/' . $slug . ': a post slug, not a path', '' !== $slug && !str_contains($slug, '/'));
        od_test($key . '/' . $slug . ': written decoded', !str_contains($slug, '%'));
        $seen[$slug] = true;
    }
}

/* The catalogue is 84 films on od-stage (2026-09-12); two carry no text at all
   and three are about the organisation rather than a subject. */
od_test('79 of the 84 catalogue films are placed', count($seen) === 79);
od_test('«Письмо Путину» is left for an editor', !isset($seen['pismo-putinu']));
od_test('and so is «Ребенок и Ангел»', !isset($seen['ребенок-и-ангел-трогательная-истори']));

/* «Об организации» is what `/about/` is, not a subject anyone browses the
   catalogue for, so the three presentations carry no topic (2026-09-12). */
od_test('there is no «Об организации» shelf', !isset($topics['about-us']));
od_test('and the presentations carry no topic', !isset($seen['что-такое-общее-дело-презентация-орга']) && !isset($seen['презентация-организации-общее-дело-к']) && !isset($seen['межрегиональный-слёт-волонтёров-общ']));

/* A film belongs to as many subjects as it is about — that is the difference from
   the five catalogue shelves, and the reason this is worth having. */
$multi = array_filter(
    array_count_values(array_merge(...array_column($topics, 'films'))),
    static fn(int $n): bool => $n > 1
);
od_test('films carry more than one topic where they are about more than one', count($multi) >= 10);
od_test('«Конвейер смерти» is alcohol and tobacco', in_array('konvejer-smerti', $topics['alcohol']['films'], true) && in_array('konvejer-smerti', $topics['tobacco']['films'], true));

od_test('the task is in the registry', str_contains(file_get_contents(__DIR__ . '/../scripts/od-wp.php'), "'tag-film-topics' => 'od_wp_tag_film_topics'"));

// -- the six footer widgets -------------------------------------------------

$widgets = od_wp_footer_widgets();
od_test('the footer is six widgets — Footer.module.css lays it out by aside:nth-child(N)', count($widgets) === 6);
od_test('slot 1 is the logo and the three socials', str_contains($widgets[0], '/wp-content/uploads/2026/08/logo-white.png') && str_contains($widgets[0], 'cmsms-icon-vkontakte'));
od_test('slot 2 is КОНТАКТЫ РЕДАКЦИИ', str_contains($widgets[1], 'КОНТАКТЫ РЕДАКЦИИ'));
od_test('slot 3 is ОТЗЫВЫ', str_contains($widgets[2], 'ОТЗЫВЫ'));
od_test('slot 4 is ССЫЛКИ', str_contains($widgets[3], 'ССЫЛКИ'));
od_test('slot 5 is the separator', str_contains($widgets[4], 'wp:separator'));
od_test('slot 6 carries the НКО number production has and the design instance never did', str_contains($widgets[5], '0012011716'));
od_test('and the СМИ registration, the ОГРН and 12+', str_contains($widgets[5], 'ФC77-72346') && str_contains($widgets[5], '1127799010624') && str_contains($widgets[5], '12+'));
od_test('the two dead links strip-footer-links removed are not authored back in', !str_contains(implode('', $widgets), 'ostavit-otziv') && !str_contains(implode('', $widgets), 'predlozhit-ideyu'));

/* An install-specific value in a body is the bug this whole file exists to
   prevent: it was authored on od-stage, and od-stage's host and attachment id
   are meaningless anywhere else. */
$bodies = implode('', $widgets);
od_test('no origin is stored — %HOME% is filled at write time', !str_contains($bodies, 'od.webtm.ru') && !str_contains($bodies, '//obshee-delo.ru'));
od_test('no attachment id travels with the logo', !str_contains($bodies, '80413'));
od_test('%HOME% appears only where an upload is addressed', substr_count($bodies, '%HOME%') === substr_count($bodies, '%HOME%/wp-content/'));

/* Allocation: an area that already holds widgets keeps their ids, or the option
   grows by six on every run and the footer collects orphans. */
$stored = ['2' => ['content' => $widgets[0]], '3' => ['content' => 'stale'], '_multiwidget' => 1];
$plan = od_wp_footer_plan($stored, ['block-2', 'block-3'], $widgets);
od_test('the first two slots keep the ids they have', $plan['ids'][0] === 2 && $plan['ids'][1] === 3);
od_test('the four with no widget yet take the next free keys', array_slice($plan['ids'], 2) === [4, 5, 6, 7]);
od_test('an identical body is not a write', !in_array(0, $plan['changed'], true));
od_test('a stale one is', in_array(1, $plan['changed'], true));

$fresh = od_wp_footer_plan([], [], $widgets);
od_test('an empty install allocates block-2..block-7', $fresh['ids'] === [2, 3, 4, 5, 6, 7]);
od_test('and every slot is a write', count($fresh['changed']) === 6);

$full = [];
foreach ($fresh['ids'] as $slot => $id) {
    $full[$id] = ['content' => $widgets[$slot]];
}
$again = od_wp_footer_plan($full, ['block-2', 'block-3', 'block-4', 'block-5', 'block-6', 'block-7'], $widgets);
od_test('a second run writes nothing', $again['changed'] === [] && $again['ids'] === $fresh['ids']);

od_test('the footer task is in the registry', str_contains(file_get_contents(__DIR__ . '/../scripts/od-wp.php'), "'author-footer' => 'od_wp_author_footer'"));

od_test_summary();
