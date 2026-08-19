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

od_test_summary();
