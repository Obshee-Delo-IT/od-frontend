<?php
/**
 * Tests for `wp/scripts/od-pages.php`. Plain `assert`, no PHPUnit and no
 * composer — WordPress is not loaded and never needs to be, because everything
 * the script does to content is a pure function.
 *
 *     php wp/tests/od-pages.test.php
 *
 * Fixtures under `fixtures/` are real `post_content` captured from od-dev; the
 * `.before.html` files are what the migrator leaves behind.
 */

declare(strict_types=1);

assert_options(ASSERT_ACTIVE, 1);
assert_options(ASSERT_BAIL, 1);

require __DIR__ . '/../scripts/od-pages.php';

$before = file_get_contents(__DIR__ . '/fixtures/healthy-russia.before.html');
$after = od_pages_healthy_russia($before);

// -- structure --------------------------------------------------------------

assert(str_contains($after, 'wp-block-image size-full od-programme-logo'), 'logo card');
assert(str_contains($after, '<div class="wp-block-group od-card od-card--goal">'), 'goal card');
assert(str_contains($after, '<div class="wp-block-columns od-cards">'), 'task cards');
assert(str_contains($after, '<div class="wp-block-columns od-card od-card--flush">'), 'methodology card');
assert(str_contains($after, '<div class="wp-block-columns od-poster-cards">'), 'poster row');

assert(substr_count($after, '<!-- wp:column -->') === 7, 'three task cards and four posters');
assert(substr_count($after, '<!-- wp:image ') === 6, 'logo, booklet and four posters');

// -- prose ------------------------------------------------------------------

assert(str_contains($after, '<h2 class="wp-block-heading">Цель программы</h2>'), 'goal heading');
assert(str_contains($after, '<h2 class="wp-block-heading">Задачи программы</h2>'), 'tasks heading');
assert(str_contains($after, '<h2 class="wp-block-heading">Здоровая Россия — ОБЩЕЕ ДЕЛО!</h2>'), 'methodology heading');
assert(str_contains($after, '<h2 class="wp-block-heading">Проекты программы</h2>'), 'projects heading');

foreach (['Обучающие', 'Развивающие', 'Воспитательные'] as $task) {
    assert(str_contains($after, sprintf('<h3 class="wp-block-heading">%s</h3>', $task)), $task . ' card');
}
assert(str_contains($after, '<p>сформировать понимание важности здорового'), 'task body kept');
assert(str_contains($after, 'Содействие воспитательным процессам по укреплению в молодежной среде'), 'goal body kept');
assert(str_contains($after, 'Программа прошла экспертизу'), 'methodology body kept');

// -- values read out of the page, not hardcoded -----------------------------

assert(str_contains($after, '"id":60061'), 'logo attachment id kept');
assert(str_contains($after, '/wp-content/uploads/2021/02/healthy_russia.png'), 'logo path kept');
foreach (['/19864/', '/19871/', '/58926/', '/22289/'] as $film) {
    assert(substr_count($after, sprintf('href="%s"', $film)) === 2, $film . ' links poster and button');
}
assert(str_contains($after, 'href="https://metodic.obshee-delo.ru/">Сайт методички'), 'methodology button kept');
assert(str_contains($after, 'href="https://metodic.obshee-delo.ru/download.html">Методические материалы'), 'downloads link kept');

// -- buttons ----------------------------------------------------------------

assert(substr_count($after, '>Подробнее</a>') === 4, 'the poster cards say what the mock says');
// Twice per button: once in the block attributes, once in the rendered class.
assert(substr_count($after, 'is-style-outline') === 4, 'only the two methodology buttons are outline buttons');

// -- what the template drops ------------------------------------------------

assert(!str_contains($after, '<hr'), 'migrator separators gone');
assert(!str_contains($after, 'cmsms_heading'), 'migrator heading class gone');
assert(!str_contains($after, 'fontstyle0'), 'old theme span gone');
assert(!str_contains($after, 'Документальные фильмы'), 'empty trailing heading gone');
assert(!str_contains($after, '<br'), 'hard line break gone');
assert(!str_contains($after, 'text-align: center'), 'inline alignment gone');
assert(!str_contains($after, 'flex-basis'), 'column widths are left to the stylesheet');

// -- alt text ---------------------------------------------------------------

assert(str_contains($after, 'alt="Здоровая Россия"'), 'logo alt');
assert(str_contains($after, 'alt="История одного обмана"'), 'poster alt from its own button');
assert(!str_contains($after, 'alt=""'), 'no image left without alt');

// -- idempotency ------------------------------------------------------------

assert(od_pages_healthy_russia($after) === $after, 'converted content is left alone');

// -- refuses input it does not recognise ------------------------------------

$threw = false;
try {
    od_pages_healthy_russia('<!-- wp:paragraph --><p>что-то другое</p><!-- /wp:paragraph -->');
} catch (RuntimeException $e) {
    $threw = true;
}
assert($threw, 'unexpected input is refused, not half-converted');

// -- helpers ----------------------------------------------------------------

assert(od_pages_inline_text("раз<br />\nдва") === 'раз два', 'line breaks become spaces');
assert(od_pages_inline_text('<span class="fontstyle0">текст</span>') === 'текст', 'old theme span stripped');
assert(od_pages_inline_text('  два   слова  ') === 'два слова', 'whitespace collapsed');

echo "od-pages: ok\n";
