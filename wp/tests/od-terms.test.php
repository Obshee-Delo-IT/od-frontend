<?php
/**
 * Tests for `wp/scripts/od-terms.php`. The script's only pure part is its
 * registry, and the failure it can actually have is a typo in it — a duplicated
 * slug silently tags one post twice and leaves another untagged, and neither
 * shows up in the run's output.
 *
 *     php wp/tests/od-terms.test.php
 */

declare(strict_types=1);

assert_options(ASSERT_ACTIVE, 1);
assert_options(ASSERT_BAIL, 1);

require __DIR__ . '/../scripts/od-terms.php';

$registry = od_terms_registry();
assert($registry !== [], 'the registry is not empty');

foreach ($registry as $slug => $tag) {
    // The tag's own slug is typed into URLs and query blocks, so it stays ASCII;
    // the posts' slugs are WordPress's own and are Cyrillic on this site.
    assert((bool) preg_match('#^[a-z0-9-]+$#', $slug), $slug . ': tag slug is a plain ASCII slug');
    assert(!empty($tag['name']), $slug . ': tag has a name');
    assert(!empty($tag['posts']), $slug . ': tag has posts');
    assert(count($tag['posts']) === count(array_unique($tag['posts'])), $slug . ': no post is listed twice');

    foreach ($tag['posts'] as $path) {
        assert(trim($path) === $path && $path !== '', $slug . ': post slug is trimmed and non-empty');
        assert(!str_contains($path, '/'), $path . ': a post slug, not a path');
        assert(!str_contains($path, '%'), $path . ': slugs are written decoded, sanitize_title() encodes them');
    }
}

assert(
    array_key_exists('programma-zdorovaya-rossiya', $registry),
    'the «Здоровая Россия» programme tag is registered'
);
assert(
    count($registry['programma-zdorovaya-rossiya']['posts']) === 6,
    'six of the programme\'s nine lesson films exist as posts — see the registry docblock'
);

echo "od-terms: ok\n";
