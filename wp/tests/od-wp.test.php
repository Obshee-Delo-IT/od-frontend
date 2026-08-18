<?php
/**
 * Tests for `wp/scripts/od-wp.php`. The script's only pure part is its
 * registry, and the failure it can actually have is a typo in it — a duplicated
 * slug silently tags one post twice and leaves another untagged, and neither
 * shows up in the run's output.
 *
 *     php wp/tests/od-wp.test.php
 */

declare(strict_types=1);

assert_options(ASSERT_ACTIVE, 1);
assert_options(ASSERT_BAIL, 1);

require __DIR__ . '/../scripts/od-wp.php';

$registry = od_wp_programmes();
assert($registry !== [], 'the registry is not empty');

$seen = [];
foreach ($registry as $slug => $programme) {
    // The tag's own slug is typed into URLs and query blocks, so it stays ASCII;
    // the films' slugs are WordPress's own and are Cyrillic on this site.
    assert((bool) preg_match('#^[a-z0-9-]+$#', $slug), $slug . ': tag slug is a plain ASCII slug');
    assert(!empty($programme['name']), $slug . ': tag has a name');
    assert(!empty($programme['films']), $slug . ': tag has films');

    foreach ($programme['films'] as $path => $poster) {
        assert(trim($path) === $path && $path !== '', $slug . ': film slug is trimmed and non-empty');
        assert(!str_contains($path, '/'), $path . ': a post slug, not a path');
        assert(!str_contains($path, '%'), $path . ': slugs are written decoded, sanitize_title() encodes them');

        // A film in two programmes would be tagged twice, which is fine — a film
        // listed twice in one is a typo that costs a film its place on a page.
        $key = $slug . '|' . $path;
        assert(!isset($seen[$key]), $path . ': listed twice under ' . $slug);
        $seen[$key] = true;

        if ($poster !== '') {
            assert(str_starts_with($poster, '/wp-content/'), $path . ': плакат is a root-relative upload path');
            assert(!str_contains($poster, '://'), $path . ': the origin is added at write time, not stored');
        }
    }
}

foreach (['programma-zdorovaya-rossiya', 'programma-zdorovaya-molodezh', 'programma-zdorovye-deti'] as $tag) {
    assert(array_key_exists($tag, $registry), $tag . ': the programme tag is registered');
}
assert(
    count($registry['programma-zdorovaya-rossiya']['films']) === 6,
    'six of the programme\'s nine lesson films exist as posts — see the registry docblock'
);
assert(
    count($registry['programma-zdorovaya-molodezh']['films']) === 7,
    'all seven «Здоровая молодежь» lessons have one'
);

echo "od-wp: ok\n";
