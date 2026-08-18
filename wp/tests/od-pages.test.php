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
$after = od_pages_healthy_russia($before, 665);

// -- structure --------------------------------------------------------------

assert(str_contains($after, 'wp-block-image size-full od-programme-logo'), 'logo card');
assert(str_contains($after, '<div class="wp-block-group od-card od-card--goal">'), 'goal card');
assert(str_contains($after, 'cb-carousel-block od-cards"'), 'task carousel');
assert(str_contains($after, '<div class="wp-block-columns od-card od-card--flush">'), 'methodology card');
assert(str_contains($after, 'cb-carousel-block od-poster-cards"'), 'poster carousel');

assert(substr_count($after, '<!-- wp:cb/slide-v2 -->') === 3, 'one slide per task card');
assert(substr_count($after, '<!-- wp:column -->') === 2, 'only the methodology card is still a columns block');
assert(substr_count($after, '<!-- wp:image ') === 2, 'the logo and the booklet — the posters come from the query');
assert(substr_count($after, 'data-cb-pagination="true"') === 2, 'both carousels carry dots');

// -- the projects row is a query over the programme's tag ------------------

assert(str_contains($after, '"tagIds":[665]'), 'the row queries the tag it was given');
assert(str_contains($after, '"inherit":false'), 'and not the page\'s own query');
assert(str_contains($after, '"className":"swiper"'), 'the query block is what Swiper mounts on');
assert(str_contains($after, '<!-- wp:post-template {"className":"swiper-wrapper"} -->'), 'the post template is the track');
// Not `core/post-featured-image`: that is the 16∶9 still `/video/` wants.
assert(str_contains($after, '"key":"od_card_cover"'), 'the cover is bound to the portrait one');
assert(str_contains($after, '"source":"core/post-meta"'), 'through the block bindings API');
assert(!str_contains($after, 'post-featured-image'), 'the 16∶9 still is not what this card shows');
assert(str_contains($after, '<!-- wp:post-title {"level":3,"isLink":true} /-->'), 'the title is the card\'s link');
assert(str_contains($after, 'alt="" loading="lazy"'), 'a плакат is heavy and the row is below the fold');
assert(!str_contains($after, 'drugs.jpg'), 'the migrator\'s hand-picked posters are gone');

// Arrows on the projects row, which can outgrow its three slots; none on the
// tasks, which are three cards on desktop and a swipe on a phone.
assert(str_contains($after, '"className":"od-cards","spaceBetween":40,"navigation":false'), 'tasks have no arrows');
assert(str_contains($after, '"className":"od-poster-cards","spaceBetween":40,"navigation":true'), 'projects have arrows');

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
assert(str_contains($after, 'href="https://metodic.obshee-delo.ru/">Сайт методички'), 'methodology button kept');
assert(str_contains($after, 'href="https://metodic.obshee-delo.ru/download.html">Методические материалы'), 'downloads link kept');

// -- buttons ----------------------------------------------------------------

// Twice per button: once in the block attributes, once in the rendered class.
assert(substr_count($after, 'is-style-outline') === 4, 'the two methodology buttons, and no others');

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
assert(substr_count($after, 'alt=""') === 1, 'only the bound cover, which the title beside it names');

// -- idempotency ------------------------------------------------------------

assert(od_pages_healthy_russia($after, 665) === $after, 'converted content is left alone');

// -- refuses input it does not recognise ------------------------------------

$threw = false;
try {
    od_pages_healthy_russia('<!-- wp:paragraph --><p>что-то другое</p><!-- /wp:paragraph -->', 665);
} catch (RuntimeException $e) {
    $threw = true;
}
assert($threw, 'unexpected input is refused, not half-converted');

// -- helpers ----------------------------------------------------------------

assert(od_pages_inline_text("раз<br />\nдва") === 'раз два', 'line breaks become spaces');
assert(od_pages_inline_text('<span class="fontstyle0">текст</span>') === 'текст', 'old theme span stripped');
assert(od_pages_inline_text('  два   слова  ') === 'два слова', 'whitespace collapsed');

assert(od_pages_site_link('https://общее-дело.рф/materials/x/') === '/materials/x/', 'the live domain becomes a path');
assert(od_pages_site_link('https://xn----9sbkcac6brh7h.xn--p1ai/x/') === '/x/', 'and so does its Punycode form');
assert(od_pages_site_link('https://metodic.obshee-delo.ru/') === 'https://metodic.obshee-delo.ru/', 'another site keeps its origin');
assert(od_pages_site_link('https://disk.yandex.ru/i/abc') === 'https://disk.yandex.ru/i/abc', 'and so does a download');

// ===========================================================================
// `/healthy-youth/` — Figma `project-2`.
// ===========================================================================

$youthBefore = file_get_contents(__DIR__ . '/fixtures/healthy-youth.before.html');
$youth = od_pages_healthy_youth($youthBefore, 666);

assert(str_contains($youth, 'wp-block-image size-full od-programme-logo'), 'logo card');
assert(str_contains($youth, '<div class="wp-block-group od-card od-card--goal">'), 'goal card');
assert(str_contains($youth, 'cb-carousel-block od-cards od-cards--numbered"'), 'numbered task carousel');
assert(str_contains($youth, 'cb-carousel-block od-poster-cards"'), 'poster carousel');
assert(str_contains($youth, '<p class="od-note">Программа прошла экспертизу'), 'the note stands on its own');

// Two tasks, so two cards — and the carousel is told, or the row keeps a
// third slot the mock fills by widening the cards instead.
assert(substr_count($youth, '<!-- wp:cb/slide-v2 -->') === 2, 'one slide per task');
assert(str_contains($youth, '"slidesPerView":2'), 'two slots, not the template three');
assert(str_contains($youth, 'data-cb-slides-per-view="2"'), 'and the frontend is told the same');
assert(!str_contains($youth, '<h3'), 'the number replaces the card heading, and it is a CSS counter');

assert(str_contains($youth, '"tagIds":[666]'), 'the row queries the tag it was given');
assert(str_contains($youth, '"key":"od_card_cover"'), 'covers come from the bound meta key');
assert(str_contains($youth, '<!-- wp:post-title {"level":3,"isLink":true} /-->'), 'the title is the card\'s link');

assert(str_contains($youth, '<h2 class="wp-block-heading">Цель программы</h2>'), 'goal heading');
assert(str_contains($youth, '<h2 class="wp-block-heading">Задачи программы</h2>'), 'tasks heading');
assert(str_contains($youth, '<h2 class="wp-block-heading">Проекты программы</h2>'), 'projects heading');
assert(str_contains($youth, '<p>Развитие мотивационной сферы личности подростков'), 'goal body kept');
assert(str_contains($youth, '<p>Создать условия для включения новых сведений'), 'first task kept');
assert(str_contains($youth, '<p>Сформировать у подростков мотивационную основу'), 'second task kept');

// The booklet cover has no slot in the mock; the file it linked to does.
assert(str_contains($youth, 'href="https://disk.yandex.ru/i/V2VRI2tY04OC1Q">Скачать методичку PDF'), 'the download survives');
assert(substr_count($youth, 'disk.yandex.ru') === 1, 'once — the trailing heading pointed at the same file');
assert(str_contains($youth, '"className":"od-materials"'), 'and it is the page\'s trailing button');
assert(!str_contains($youth, 'metodischka2.jpg'), 'the booklet cover is gone');
assert(!str_contains($youth, 'plakats_2office_man.jpg'), 'and so are the hand-picked posters');
assert(substr_count($youth, '<!-- wp:image ') === 1, 'only the logo — the covers come from the query');

assert(!str_contains($youth, '<hr'), 'migrator separators gone');
assert(!str_contains($youth, 'cmsms_heading'), 'migrator heading class gone');
assert(!str_contains($youth, 'fontstyle0'), 'old theme span gone');
assert(!str_contains($youth, 'Документальные фильмы'), 'empty trailing heading gone');
assert(!str_contains($youth, 'text-align: center'), 'inline alignment gone');

assert(od_pages_healthy_youth($youth, 666) === $youth, 'converted content is left alone');

// ===========================================================================
// `/healthy-kids/` — Figma `project-3`.
// ===========================================================================

$kidsBefore = file_get_contents(__DIR__ . '/fixtures/healthy-kids.before.html');
$kids = od_pages_healthy_kids($kidsBefore);

assert(str_contains($kids, 'wp-block-image size-full od-programme-logo'), 'logo card');
assert(str_contains($kids, 'alt="Здоровые дети"'), 'logo alt');
assert(str_contains($kids, '/wp-content/uploads/2021/02/healthy_kids.png'), 'logo path kept');
assert(str_contains($kids, '"id":60060'), 'logo attachment id kept');
assert(str_contains($kids, '<div class="wp-block-group od-card od-card--goal">'), 'goal card');
assert(str_contains($kids, 'cb-carousel-block od-cards od-cards--numbered"'), 'numbered task carousel');
assert(str_contains($kids, '<p class="od-note">Программа прошла экспертизу'), 'the note stands on its own');

assert(substr_count($kids, '<!-- wp:cb/slide-v2 -->') === 3, 'one slide per task');
assert(str_contains($kids, '"slidesPerView":3'), 'three tasks, three slots');
assert(str_contains($kids, '<p>Разработать учебно-методический комплекс'), 'first task kept');
assert(str_contains($kids, '<p>Обеспечить образовательные организации разработанными материалами.</p>'), 'last task kept');
assert(str_contains($kids, '<p>Содействие воспитательным процессам, направленным на формирование ценности здорового образа жизни среди детей.</p>'), 'goal body, line break collapsed');

// This page has no film row at all, so no query and no term id.
assert(!str_contains($kids, 'wp:query'), 'no projects row on this programme');
assert(!str_contains($kids, 'od-poster-cards'), 'and no poster carousel');
assert(substr_count($kids, '<!-- wp:image ') === 1, 'only the logo — the portrait went with the mock');
assert(!str_contains($kids, 'poznovalov.jpg'), 'the portrait is gone; its playlist link is a button');

// Both trailing headings were links, and both survive.
assert(str_contains($kids, '"className":"od-materials"'), 'the buttons carry the class the stylesheet keys on');
assert(str_contains($kids, 'href="/materials/pppuiv-ted-6/">Методические рекомендации'), 'and the live-domain link became a path');
assert(str_contains($kids, 'href="https://www.youtube.com/playlist?list=PLlNywkCI4IKyNXLKzGyM43Orp41Qm1plo">Фильмы программы'), 'the playlist keeps its origin');
assert(substr_count($kids, 'is-style-outline') === 4, 'the two buttons, and no others');

assert(!str_contains($kids, 'cmsms_heading'), 'migrator heading class gone');
assert(!str_contains($kids, 'fontstyle0'), 'old theme span gone');
assert(!str_contains($kids, '<br'), 'hard line break gone');
assert(!str_contains($kids, '<ul>'), 'the task list became cards');

assert(od_pages_healthy_kids($kids) === $kids, 'converted content is left alone');

// -- both refuse input they do not recognise --------------------------------

foreach (['od_pages_healthy_youth', 'od_pages_healthy_kids'] as $transform) {
    $threw = false;
    try {
        $transform('<!-- wp:paragraph --><p>что-то другое</p><!-- /wp:paragraph -->', 666);
    } catch (RuntimeException $e) {
        $threw = true;
    }
    assert($threw, $transform . ': unexpected input is refused, not half-converted');
}

echo "od-pages: ok\n";
