<?php
/**
 * od-pages.php — one-shot content fixes for the pages redesigned in workstream D.
 *
 * Run it with WP-CLI, from the WordPress root:
 *
 *     wp --url=https://od-dev.tmweb.ru eval-file od-pages.php            # dry run
 *     wp --url=https://od-dev.tmweb.ru eval-file od-pages.php apply      # write
 *
 * Why a script and not the admin: od-dev's database never travels to
 * production. Production is converted from its own CMSMasters shortcodes by
 * `cmsms-gutenberg-upgrade` during the cutover, so a page fixed by hand here is
 * fixed nowhere. Applying workstream D to production means running this file.
 * The full reasoning, and the ladder that decides what belongs here rather than
 * in CSS, is in `docs/wp-page-redesign.md`.
 *
 * House rules, all of which the tests in `wp/tests/od-pages.test.php` check:
 *
 * - **Idempotent by detection.** Every transform recognises its own output and
 *   returns the content untouched. A page is converted once; an editor's later
 *   work is never clobbered by a re-run.
 * - **Dry run by default.** Writing takes the positional argument `apply`,
 *   because `wp eval-file` hands positionals to the script in `$args` and
 *   rejects unknown `--flags`.
 * - **Volatile values are read out of the page, not hardcoded.** Attachment ids,
 *   upload paths and film post ids differ per environment; only prose and
 *   structure are written here.
 * - **Writes go through `$wpdb->update`.** `wp_update_post` fires
 *   `cmsms-gutenberg-upgrade`'s `save_post` hook, which deletes the
 *   `nvp_content_copy` meta that both a re-run of the migrator and
 *   `wp cmsms restore` depend on.
 * - **Records are addressed by path**, never by id — ids differ per environment.
 *   A `profile` whose slug names someone else is addressed by exact title
 *   instead; see `OD_METODICHKI_COORDINATOR_HREF`.
 *
 * PHP: this file only ever runs under WP-CLI (8.2 on production), so modern
 * syntax is fine here. The runtime half of the design system, if one is ever
 * needed, goes in `wp/mu-plugins/od-design.php` and is pinned to PHP 7.0.
 */

/**
 * `/healthy-russia/` — the «Здоровая Россия» programme page, rebuilt against the
 * Figma `project-1` template (`759:845`).
 *
 * The migrator leaves the page as six full-width `wp:group`s of `wp:columns`,
 * with the headings and the body text collapsed into a single `wp:paragraph`
 * block of raw HTML. The template wants cards: a goal card, three task cards, a
 * methodology card and a row of film posters. That is a structural rewrite, so
 * this transform reads the page's own images, links and prose back out and
 * re-emits them as proper blocks, tagged with the classes
 * `src/shared/ui/theme/gutenberg/gutenberg.css` styles.
 *
 * Dropped on purpose: the four trailing `<h3>`s. Three of them
 * («Документальные фильмы», «Полиграфические материалы», «Социальная реклама»)
 * are headings with nothing under them on the live site either — the lists they
 * once introduced are long gone. The fourth is a link, and it survives as the
 * methodology card's second button.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId  Term id of `programma-zdorovaya-rossiya`, which
 *                           «Проекты программы» queries. Ids are per-environment,
 *                           so the runner resolves it from the slug and the tests
 *                           pass one of their own.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_healthy_russia(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-card') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $cards = od_pages_column_media($content);

    $logo = null;
    $booklet = null;
    $posters = [];
    foreach ($cards as $card) {
        if ($card['href'] === '') {
            $logo = $logo ?? $card;
        } elseif (strpos($card['href'], 'metodic.') !== false) {
            $booklet = $booklet ?? $card;
        } else {
            $posters[] = $card;
        }
    }

    preg_match('#Цель программы</h2>\s*<p>(.*?)</p>#s', $content, $goal);
    preg_match_all('#<p><strong>([^<:]+):</strong>\s*(.*?)</p>#s', $content, $tasks, PREG_SET_ORDER);
    preg_match('#<p><span class="fontstyle0">(.*?)</span></p>#s', $content, $prose);
    preg_match('#<h3><a href="([^"]+)">([^<]+)</a></h3>#', $content, $downloads);

    if ($logo === null || $booklet === null || count($posters) !== 4) {
        throw new RuntimeException(
            sprintf('unexpected media: logo=%d booklet=%d posters=%d', $logo !== null, $booklet !== null, count($posters))
        );
    }
    if (count($tasks) !== 3 || empty($goal[1]) || empty($prose[1]) || empty($downloads[1])) {
        throw new RuntimeException(
            sprintf('unexpected prose: tasks=%d goal=%d note=%d downloads=%d', count($tasks), !empty($goal[1]), !empty($prose[1]), !empty($downloads[1]))
        );
    }

    $out = od_pages_image_block($logo['id'], $logo['src'], 'Здоровая Россия', '', 'od-programme-logo');

    $out .= od_pages_goal_card(od_pages_inline_text($goal[1]));

    $out .= od_pages_heading(2, 'Задачи программы');
    $slides = [];
    foreach ($tasks as $task) {
        $slides[] = od_pages_heading(3, od_pages_inline_text($task[1]))
            . od_pages_paragraph(od_pages_inline_text($task[2]));
    }
    // No arrows: three cards fit the desktop row, and the mobile mock swipes.
    $out .= od_pages_carousel(od_pages_slides($slides), 'od-cards', false);

    $out .= "<!-- wp:columns {\"className\":\"od-card od-card--flush\"} -->\n"
        . "<div class=\"wp-block-columns od-card od-card--flush\">"
        // No `width` on either column: the mock's 386/774 split is a proportion of
        // this card, not of the page, and an inline `flex-basis` would beat the
        // stylesheet that knows the difference.
        . "<!-- wp:column -->\n<div class=\"wp-block-column\">"
        . od_pages_image_block($booklet['id'], $booklet['src'], 'Обложка методички «Здоровая Россия — ОБЩЕЕ ДЕЛО!»')
        . "</div>\n<!-- /wp:column -->\n"
        . "<!-- wp:column -->\n<div class=\"wp-block-column\">"
        . od_pages_heading(2, 'Здоровая Россия — ОБЩЕЕ ДЕЛО!')
        . od_pages_paragraph(od_pages_inline_text($prose[1]))
        . od_pages_buttons([
            ['href' => $booklet['href'], 'label' => od_pages_inline_text($booklet['label'])],
            ['href' => $downloads[1], 'label' => od_pages_inline_text($downloads[2])],
        ])
        . "</div>\n<!-- /wp:column -->"
        . "</div>\n<!-- /wp:columns -->\n\n";

    // The four posters the migrator left are the page's fingerprint, checked
    // above — but they are not what is rendered. The row is a query over the
    // programme's tag, so tagging a film in the admin puts it on the page.
    $out .= od_pages_heading(2, 'Проекты программы');
    $out .= od_pages_carousel(od_pages_film_query($filmTagId), 'od-poster-cards', true);

    return rtrim($out) . "\n";
}

/**
 * `/healthy-youth/` — «Здоровая молодежь», Figma `project-2` (`759:1379`).
 *
 * The same template as `/healthy-russia/`, with three differences the mock
 * draws and this transform follows:
 *
 * - **The task cards are numbered, not titled.** `project-1` gives each card an
 *   `<h3>`; `project-2` and `project-3` give it «01», «02», … in the same red
 *   32px. That ordinal is not content — it is the position of the card in the
 *   row — so it is a CSS counter in `gutenberg.css` and nothing is written here.
 * - **Two tasks, so two cards, not three.** The mock widens them to 600px
 *   rather than leaving a hole, which is what the carousel's fourth argument
 *   buys: `slidesPerView` follows the number of slides.
 * - **The approval note stands alone.** On `/healthy-russia/` it is the body of
 *   the methodology card; here there is no such card and it is a 24px paragraph
 *   between the tasks and the projects.
 *
 * Dropped: the booklet cover, which the mock has no slot for — its download
 * link survives as the page's one trailing button, and so the trailing
 * «Методические материалы» heading, which pointed at that same file, goes with
 * it. The six poster images are the page's fingerprint and nothing more: the
 * row itself is a query over the programme's tag, exactly as on
 * `/healthy-russia/`.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Term id of `programma-zdorovaya-molodezh`.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_healthy_youth(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-card') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $logo = null;
    $booklet = null;
    $posters = [];
    foreach (od_pages_column_media($content) as $card) {
        if ($card['href'] === '') {
            $logo = $logo ?? $card;
        } elseif (strpos($card['href'], 'disk.yandex.ru') !== false) {
            $booklet = $booklet ?? $card;
        } else {
            $posters[] = $card;
        }
    }

    preg_match('#Цель программы</h2>\s*<p>(.*?)</p>#s', $content, $goal);
    preg_match('#<p><span class="fontstyle0">(.*?)</span></p>#s', $content, $note);
    $tasks = od_pages_task_paragraphs($content);

    if ($logo === null || $booklet === null || count($posters) !== 6) {
        throw new RuntimeException(
            sprintf('unexpected media: logo=%d booklet=%d posters=%d', $logo !== null, $booklet !== null, count($posters))
        );
    }
    if (count($tasks) !== 2 || empty($goal[1]) || empty($note[1])) {
        throw new RuntimeException(
            sprintf('unexpected prose: tasks=%d goal=%d note=%d', count($tasks), !empty($goal[1]), !empty($note[1]))
        );
    }

    $out = od_pages_image_block($logo['id'], $logo['src'], 'Здоровая молодежь', '', 'od-programme-logo');
    $out .= od_pages_goal_card(
        od_pages_inline_text($goal[1]),
        [['href' => $booklet['href'], 'label' => od_pages_inline_text($booklet['label'])]]
    );
    $out .= od_pages_heading(2, 'Задачи программы');
    $out .= od_pages_numbered_tasks($tasks);
    $out .= od_pages_note(od_pages_inline_text($note[1]));
    $out .= od_pages_heading(2, 'Проекты программы');
    $out .= od_pages_carousel(od_pages_film_query($filmTagId), 'od-poster-cards', true);

    return rtrim($out) . "\n";
}

/**
 * `/healthy-kids/` — «Здоровые дети», Figma `project-3` (`759:1117`).
 *
 * The shortest of the three: a logo, a goal card, three numbered task cards, the
 * approval note and the programme's films. `project-3` draws no «Проекты
 * программы» row — it was drawn before the «Команда Познавалова» cartoons were
 * identified as this programme's lessons — but the row is the same query block
 * the other two pages carry, over this programme's own tag.
 *
 * Dropped: the portrait beside the goal text, which linked to the same YouTube
 * playlist as the «Фильмы программы» heading below it and which the mock
 * replaces with the template's own drawing. Both trailing headings are links
 * and both survive under the goal paragraph.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Term id of `programma-zdorovye-deti`.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_healthy_kids(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-card') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $media = od_pages_column_media($content);
    $logo = $media[0] ?? null;

    preg_match('#Цель программы</h2>\s*<p>(.*?)</p>#s', $content, $goal);
    preg_match('#<p><span class="fontstyle0">(.*?)</span></p>#s', $content, $note);
    preg_match_all('#<li>(.*?)</li>#s', $content, $found, PREG_SET_ORDER);
    preg_match_all('#<h3><a href="([^"]+)">([^<]+)</a></h3>#', $content, $links, PREG_SET_ORDER);

    $tasks = array_map(static fn(array $task): string => od_pages_inline_text($task[1]), $found);

    if ($logo === null || count($tasks) !== 3 || count($links) !== 2) {
        throw new RuntimeException(
            sprintf('unexpected input: logo=%d tasks=%d links=%d', $logo !== null, count($tasks), count($links))
        );
    }
    if (empty($goal[1]) || empty($note[1])) {
        throw new RuntimeException(
            sprintf('unexpected prose: goal=%d note=%d', !empty($goal[1]), !empty($note[1]))
        );
    }

    $out = od_pages_image_block($logo['id'], $logo['src'], 'Здоровые дети', '', 'od-programme-logo');
    $out .= od_pages_goal_card(
        od_pages_inline_text($goal[1]),
        array_map(
            static fn(array $link): array => [
                'href' => od_pages_site_link($link[1]),
                'label' => od_pages_inline_text($link[2]),
            ],
            $links
        )
    );
    $out .= od_pages_heading(2, 'Задачи программы');
    $out .= od_pages_numbered_tasks($tasks);
    $out .= od_pages_note(od_pages_inline_text($note[1]));
    $out .= od_pages_heading(2, 'Проекты программы');
    $out .= od_pages_carousel(od_pages_film_query($filmTagId), 'od-poster-cards', true);

    return rtrim($out) . "\n";
}

/**
 * `/projects/` — the «Программы и проекты» index, Figma `projects` (`706:1775`).
 *
 * Not a programme page but the list of them: two rows of cards, the three
 * programmes above the three directions that have somewhere to point. It
 * shipped first as a native Next route reading an array in
 * `src/shared/config/programSections.ts`, which meant adding a card took a
 * deploy. The list is editorial, so it moved here (D6g) and the route was
 * deleted — order, titles, links and the number of cards are now blocks in the
 * admin, and the home page keeps the array it still needs for its carousel.
 *
 * The migrator leaves the page as an `<h1>`, a `<style>` block for the old
 * theme's grey `.program-box`, and three columns of booklet cover + name +
 * button. All of it goes: the H1 is drawn from the page title by `PageHeader`,
 * the CSS styles a theme this site replaces, and the covers are not the
 * drawings the mock puts on these cards.
 *
 * **The drawings are not content.** Each card carries a modifier class and
 * `gutenberg.css` supplies the drawing as a background — Figma exports under
 * `public/figma/projects/`, one per card id — the same arrangement the goal
 * card uses, and for the same reason: there is nothing decorative for an editor
 * to lose. A card added in the admin draws none, and reads as text.
 *
 * The three directions have no counterpart in the old content, so they are
 * written here rather than read out of it; they were the deleted route's second
 * array. This is the one transform that reads nothing back out of the page —
 * the old markup carries no attachment or post id that survives the rewrite.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no «Проекты программы» row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_projects(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-tile') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    // The fingerprint is the three programme columns. Nothing is read out of
    // them, but an input that is not this page is refused rather than replaced.
    $cards = od_pages_column_media($content);
    if (count($cards) !== 3) {
        throw new RuntimeException(sprintf('unexpected input: %d programme columns', count($cards)));
    }

    $out = od_pages_tiles([
        ['id' => 'healthy-russia', 'title' => 'Здоровая Россия', 'href' => '/healthy-russia/'],
        ['id' => 'healthy-kids', 'title' => 'Здоровые дети', 'href' => '/healthy-kids/'],
        ['id' => 'healthy-youth', 'title' => 'Здоровая молодёжь', 'href' => '/healthy-youth/'],
    ]);

    $out .= od_pages_heading(2, 'Проекты');
    $out .= od_pages_tiles([
        ['id' => 'od-pro', 'title' => 'Общее дело ПРО', 'href' => 'https://od-pro.ru'],
        ['id' => 'video', 'title' => 'Видеоматериалы', 'href' => '/video/'],
        ['id' => 'online-courses', 'title' => 'Онлайн курсы', 'href' => 'https://edu.obshee-delo.ru/'],
    ]);

    return rtrim($out) . "\n";
}

/**
 * A row of index cards: a `core/columns` where every column *is* a card, which
 * is what the old page did as well (`.program-box`) and what lets an editor add
 * a fourth without leaving the block they are already in.
 *
 * The card is one link, not two: `gutenberg.css` stretches the «Подробнее»
 * anchor over the whole column, so the title stays a heading and the card still
 * has a single accessible name — the same trick the film posters use.
 *
 * @param array<int, array{id: string, title: string, href: string}> $tiles
 * @param string $className Row class — `od-tiles` for the three-up portrait
 *                          cards, plus `od-tiles--wide` for the 598×280 pair
 *                          `/materials/` draws.
 */
function od_pages_tiles(array $tiles, string $className = 'od-tiles'): string
{
    $out = sprintf("<!-- wp:columns {\"className\":\"%s\"} -->\n<div class=\"wp-block-columns %s\">", $className, $className);

    foreach ($tiles as $tile) {
        $class = 'od-tile od-tile--' . $tile['id'];
        $out .= sprintf("<!-- wp:column {\"className\":\"%s\"} -->\n<div class=\"wp-block-column %s\">", $class, $class)
            . od_pages_heading(3, $tile['title'])
            . sprintf(
                "<!-- wp:paragraph {\"className\":\"od-tile-link\"} -->\n<p class=\"od-tile-link\"><a href=\"%s\">Подробнее</a></p>\n<!-- /wp:paragraph -->\n",
                $tile['href']
            )
            . "</div>\n<!-- /wp:column -->\n";
    }

    return $out . "</div>\n<!-- /wp:columns -->\n\n";
}

/**
 * `/materials/` — the section hub, Figma `ads` (`778:2206`).
 *
 * The same move as `/projects/` and for the same reason (D6g): four links with
 * a drawing each, shipped as `app/materials/page.tsx` over a hard-coded array
 * while WordPress had the page — #20225, «Наши материалы» — published at that
 * URL underneath it. The route is deleted and the four cards are blocks.
 *
 * What the migrator leaves is those same four links, as two rows of two columns
 * with a photo above a `<span class="textcapt">` caption, then a `<style>` block
 * of the old theme's hover-zoom, then a MailPoet form whose plugin is gone —
 * `[wysija_form id="2"]` renders as its own text. All of it goes: the captions
 * are longer than the mock's titles, the photos are not the mock's drawings,
 * and neither the CSS nor the dead shortcode has anywhere to be. `/materials/`
 * had no subscribe form on the redesigned page either — `NewsletterSignup` is
 * behind a feature flag that is off.
 *
 * The row is one `core/columns` of four, not two of two: `.od-tiles--wide` is a
 * two-track grid, so the cards flow 2 + 2 on their own and a fifth would open a
 * third row without an editor thinking about it.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_materials(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-tile') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $cards = od_pages_column_media($content);
    if (count($cards) !== 4) {
        throw new RuntimeException(sprintf('unexpected input: %d group columns', count($cards)));
    }

    return rtrim(od_pages_tiles(
        [
            ['id' => 'metodichki', 'title' => 'Методические пособия', 'href' => '/materials/metodichki/'],
            ['id' => 'printed-products', 'title' => 'Печатная продукция', 'href' => '/materials/printed-products/'],
            ['id' => 'articles', 'title' => 'Статьи для газет и журналов', 'href' => '/materials/articles/'],
            ['id' => 'social-reklama', 'title' => 'Социальная реклама', 'href' => '/materials/social-reklama/'],
        ],
        'od-tiles od-tiles--wide'
    )) . "\n";
}

/**
 * `/materials/printed-products/` — Figma `printing` (`966:2949`), the first of
 * the section's sub-pages and the same hub shape as its parent: the migrator
 * leaves three rows of two photo-and-caption columns, and they become cards.
 *
 * **Six cards where the mock draws five.** «Плакаты Общего Дела» was added to
 * the live page in 2024, after `printing` was drawn, and it points at a Yandex
 * Disk folder rather than a page here. Dropping a live link because a mock
 * predates it is the worse outcome — the call D6f made on the programme pages —
 * so it stays, and that is also why the rows are 3 + 3 portrait rather than the
 * mock's 3 + 2: a third wide card would sit alone at half width, where six read
 * as two full rows. Its drawing is the poster one, borrowed from «Социальная
 * реклама»; Figma reuses drawings across pages anyway.
 *
 * Titles are the mock's, which match the page's own captions bar «Диски общего
 * дела» — the mock lowercases the organisation's name and the page does not, so
 * the page wins that one.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_printed_products(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-tile') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $cards = od_pages_column_media($content);
    if (count($cards) !== 6) {
        throw new RuntimeException(sprintf('unexpected input: %d group columns', count($cards)));
    }

    $out = od_pages_tiles([
        ['id' => 'books', 'title' => 'Наши книги', 'href' => '/materials/books/'],
        ['id' => 'zakladki', 'title' => 'Закладки для книг', 'href' => '/materials/zakladki/'],
        ['id' => 'booklet', 'title' => 'Листовки и буклеты', 'href' => '/materials/booklet/'],
    ]);

    $out .= od_pages_tiles([
        ['id' => 'disk', 'title' => 'Диски Общего Дела', 'href' => '/materials/disk/'],
        ['id' => 'autosticker', 'title' => 'Наклейки на автомобиль', 'href' => '/materials/autosticker/'],
        ['id' => 'plakaty', 'title' => 'Плакаты Общего Дела', 'href' => 'https://disk.yandex.ru/d/hm_77Uv33LH7vN'],
    ]);

    return rtrim($out) . "\n";
}

/**
 * `/materials/social-reklama/` — Figma `social-ads` (`966:8538`), the section's
 * second sub-page and the last of the four hubs built on the same cards.
 *
 * **Three portrait cards then two wide ones**, which is what the mock draws and
 * what the page has — five links, no sixth to reflow around, so unlike
 * `/materials/printed-products/` this one follows the frame exactly.
 *
 * `social-ads` is drawn with bare rectangles (387×400 and 601×300) rather than
 * the card components `printing` uses (385×358 and 598×280), and its drawings
 * sit 170 wide against the left edge instead of 335 centred. That is the frame
 * being older, not a second card design: it is the only page mock in the set
 * that does not instance `Frame 33823`, and every measurement it disagrees on
 * is one the components fix. So the shipped cards follow `printing`.
 *
 * The captions are the mock's, shortened — «Плакаты», not «Плакаты социальной
 * рекламы», on a page already titled «Социальная реклама». The exception is the
 * LED boards: the mock paraphrases them as «световых», the page and the slug
 * (`led-board-roliki`) both say «светодиодных», and the page is right about
 * what the thing is — the same call the printed-products «Диски Общего Дела»
 * capitals got.
 *
 * The page also carries a `wp:html` block of the old theme's hover-zoom CSS,
 * which styled the caption-over-photo tiles this replaces. It goes with them.
 */
function od_pages_social_reklama(string $content, int $filmTagId): string
{
    if (strpos($content, 'od-tile') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $cards = od_pages_column_media($content);
    if (count($cards) !== 5) {
        throw new RuntimeException(sprintf('unexpected input: %d group columns', count($cards)));
    }

    $out = od_pages_tiles([
        ['id' => 'plakati', 'title' => 'Плакаты', 'href' => '/materials/plakati/'],
        ['id' => 'billboards', 'title' => 'Придорожные щиты', 'href' => '/materials/billboards/'],
        [
            'id' => 'audio-roliki-social-reklama',
            'title' => 'Аудио-ролики',
            'href' => '/materials/audio-roliki-social-reklama/',
        ],
    ]);

    $out .= od_pages_tiles(
        [
            ['id' => 'led-board-roliki', 'title' => 'Ролики для светодиодных щитов', 'href' => '/materials/led-board-roliki/'],
            ['id' => 'sticker', 'title' => 'Стикеры', 'href' => '/materials/sticker/'],
        ],
        'od-tiles od-tiles--wide'
    );

    return rtrim($out) . "\n";
}

/**
 * Every `wp:column` of the page that holds an image, paired with the button that
 * sits under it in the same column — which is how the migrator lays out both the
 * methodology block and the film posters. Reading them out this way keeps the
 * attachment ids, the upload paths and the film post ids the page already has,
 * all three of which differ between od-dev and production.
 *
 * @return array<int, array{id: string, src: string, href: string, label: string}>
 */
function od_pages_column_media(string $content): array
{
    $cards = [];

    foreach (explode('<!-- /wp:column -->', $content) as $column) {
        if (!preg_match('#<!-- wp:image \{"id":(\d+)#', $column, $id)) {
            continue;
        }
        if (!preg_match('#<img src="([^"]+)"#', $column, $src)) {
            continue;
        }

        $card = ['id' => $id[1], 'src' => $src[1], 'href' => '', 'label' => ''];
        if (preg_match('#wp-block-button__link[^>]*href="([^"]*)"[^>]*>(.*?)</a>#s', $column, $button)) {
            $card['href'] = $button[1];
            $card['label'] = $button[2];
        }

        $cards[] = $card;
    }

    return $cards;
}

/* -------------------------------------------------------------------------
 * The asset pages under `/materials/` — a preview, an optional photo of the
 * thing in use, and one download link per item. Nine Figma frames draw the same
 * card (`social-posters` `998:9524`, `social-banners` `1009:10590`,
 * `social-sticker` `1013:11191`, `social-video` `1012:11084`, `social-audio`
 * `1009:10756`, `car sticker` `966:8388`, `flyers` `966:7747`, `disks`
 * `966:8062`, `books` `966:6650`) and they disagree with each other about it:
 * the download is a solid red button on every `social-*` frame, an outline one
 * on `disks` and `flyers`, and a bare red text link on `car sticker`. The
 * design system has one CTA, so every page below uses it.
 * ---------------------------------------------------------------------- */

/**
 * The download label every asset page uses.
 *
 * The pages say «Скачать в качестве для печати», the mocks say «Скачать файл
 * для печати». Same promise, fewer words, and it is what eight of the nine
 * frames print — so the mocks win this one. (`/materials/audio-roliki-social-
 * reklama/` and `/materials/led-board-roliki/` are not print material and name
 * their own thing.)
 */
const OD_ASSET_DOWNLOAD = 'Скачать файл для печати';

/**
 * A grid of pictures with nothing to download — the material in use, or the
 * nine bookmarks that share one file.
 *
 * Deliberately **not** `core/gallery`. Block-library sizes a gallery figure as
 * `width: calc(25% - …)` with `flex-grow: 1`, which means the last row's lone
 * picture stretches to the full width, and every override of it is a
 * specificity fight with a rule carrying an id inside a `:not()`. A `columns`
 * block classed `od-figures` is the same markup this file already writes
 * everywhere else and the CSS for it is four lines.
 *
 * @param array<int, array{id: string, src: string, href: string}> $images
 */
function od_pages_figures(array $images, int $perRow = 2): string
{
    $out = '';
    $class = sprintf('od-figures od-figures--%d', $perRow);

    foreach (array_chunk($images, $perRow) as $row) {
        $out .= sprintf("<!-- wp:columns {\"className\":\"%s\"} -->\n<div class=\"wp-block-columns %s\">", $class, $class);
        foreach ($row as $image) {
            $out .= "<!-- wp:column -->\n<div class=\"wp-block-column\">\n"
                . od_pages_asset_image(['id' => $image['id'], 'src' => $image['src'], 'href' => $image['href']])
                . "</div>\n<!-- /wp:column -->\n";
        }
        $out .= "</div>\n<!-- /wp:columns -->\n\n";
    }

    return $out;
}

/**
 * A full-width asset card: one `core/group` classed `od-asset`, standing on its
 * own. This is the shape for the pages whose cards are one per row — a
 * thirteen-column `core/columns` block would be a grid of one to the reader and
 * an unusable thing in the editor.
 */
function od_pages_asset_card(string $blocks): string
{
    return "<!-- wp:group {\"className\":\"od-asset\",\"layout\":{\"type\":\"constrained\"}} -->\n"
        . "<div class=\"wp-block-group od-asset\">\n" . $blocks . "</div>\n<!-- /wp:group -->\n\n";
}

/**
 * Asset cards side by side: `core/columns` classed `od-assets`, one
 * `core/column` classed `od-asset` per card. The same shape as
 * {@see od_pages_tiles()} and for the same reason — a card is a column, so the
 * admin can move or drop one and the design follows.
 *
 * Chunked into rows of `$perRow` rather than emitted as one long block: the CSS
 * is a two-track grid either way, but fifteen columns in one `core/columns` is
 * a thing nobody can edit. A row left holding a single card is half width,
 * which is what the mock draws for its odd one out.
 *
 * @param array<int, string> $cards     Block HTML for each card.
 * @param int                $perRow    Cards per row.
 * @param string             $className Row class — `od-assets` is the two-track
 *                                      grid, plus `od-assets--3` for the
 *                                      three-up `documents` pages.
 */
function od_pages_assets(array $cards, int $perRow = 2, string $className = 'od-assets'): string
{
    $out = '';

    foreach (array_chunk($cards, $perRow) as $row) {
        $out .= sprintf("<!-- wp:columns {\"className\":\"%s\"} -->\n<div class=\"wp-block-columns %s\">", $className, $className);
        foreach ($row as $card) {
            $out .= "<!-- wp:column {\"className\":\"od-asset\"} -->\n<div class=\"wp-block-column od-asset\">\n"
                . $card
                . "</div>\n<!-- /wp:column -->\n";
        }
        $out .= "</div>\n<!-- /wp:columns -->\n\n";
    }

    return $out;
}

/**
 * A plain `core/columns` block — the row *inside* a card, where the preview sits
 * beside the photo of it in use. Deliberately unclassed: `.od-assets` is a grid
 * and this is not, so it keeps core's own flex layout and its `flex-basis`.
 *
 * @param array<int, array{width: string, blocks: string}> $columns
 * @param string $className Row class, when the row is a layout of its own —
 *                          `od-aside` is `/about/udostoverenie/`'s 814 + 386.
 */
function od_pages_columns(array $columns, string $className = ''): string
{
    $out = $className === ''
        ? "<!-- wp:columns -->\n<div class=\"wp-block-columns\">"
        : sprintf("<!-- wp:columns {\"className\":\"%s\"} -->\n<div class=\"wp-block-columns %s\">", $className, $className);

    foreach ($columns as $column) {
        $out .= sprintf(
            "<!-- wp:column {\"width\":\"%s\"} -->\n<div class=\"wp-block-column\" style=\"flex-basis:%s\">\n",
            $column['width'],
            $column['width']
        ) . $column['blocks'] . "</div>\n<!-- /wp:column -->\n";
    }

    return $out . "</div>\n<!-- /wp:columns -->\n";
}

/**
 * A `core/image`, captioned and linked to the full-size file the page already
 * links to. The caption is a real `figcaption` rather than the paragraph the old
 * markup laid above the picture: `gutenberg.css` already styles
 * `.wp-element-caption` as the mock's small grey label, and a caption that
 * belongs to the image travels with it when an editor moves the block.
 *
 * The `alt` stays empty on a captioned image on purpose: «Макет» and «Примеры
 * использования» name the *role* of the picture, not what is in it, and a
 * screen reader reading the figcaption and then the same words again as the
 * image's name is worse than the empty alt the page already had.
 *
 * @param array{id: string, src: string, href: string} $image
 */
function od_pages_asset_image(array $image, string $caption = ''): string
{
    $attrs = ['sizeSlug' => 'full'];
    // A partner logo has no `wp-image-N` class to read an id back out of, and
    // `"id":0` in the block attributes is worse than no id at all.
    if ((int) $image['id'] !== 0) {
        $attrs = ['id' => (int) $image['id']] + $attrs;
    }
    if ($image['href'] !== '') {
        $attrs['linkDestination'] = 'custom';
    }

    $img   = sprintf('<img src="%s" alt=""/>', $image['src']);
    $inner = $image['href'] === '' ? $img : sprintf('<a href="%s">%s</a>', $image['href'], $img);
    if ($caption !== '') {
        $inner .= sprintf('<figcaption class="wp-element-caption">%s</figcaption>', $caption);
    }

    return sprintf(
        "<!-- wp:image %s -->\n<figure class=\"wp-block-image size-full\">%s</figure>\n<!-- /wp:image -->\n",
        json_encode($attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $inner
    );
}

/**
 * The download action, as one `core/buttons` of primary buttons — `4 : 3` and
 * `16 : 9` sit side by side on `/materials/led-board-roliki/`, everything else
 * passes a single button.
 *
 * @param array<int, array{href: string, label: string}> $buttons
 * @param string $style Block style slug — `''` for the primary button every
 *                      `/materials/` card uses, `is-style-outline` for the
 *                      `documents` pages, which is what their mock draws.
 */
function od_pages_downloads(array $buttons, string $style = ''): string
{
    $attrs  = $style === '' ? '' : sprintf(' {"className":"%s"}', $style);
    $classes = $style === '' ? 'wp-block-button' : 'wp-block-button ' . $style;

    $out = "<!-- wp:buttons {\"className\":\"od-asset-actions\"} -->\n<div class=\"wp-block-buttons od-asset-actions\">";
    foreach ($buttons as $button) {
        $out .= "<!-- wp:button" . $attrs . " -->\n"
            . sprintf('<div class="%s">', $classes)
            . sprintf(
                '<a class="wp-block-button__link wp-element-button" href="%s" target="_blank" rel="noopener">%s</a>',
                $button['href'],
                $button['label']
            )
            . "</div>\n<!-- /wp:button -->\n";
    }

    return $out . "</div>\n<!-- /wp:buttons -->\n";
}

/**
 * YouTube video id → Kinescope video id, for every clip a materials page
 * embeds.
 *
 * **Matched by title, and every one of the twelve is an exact match** — the
 * YouTube oEmbed title and the Kinescope title are the same string, so this is
 * a verified mapping rather than an order-of-appearance guess.
 *
 * A Kinescope id is not environment-specific: the same asset answers for
 * od-dev and production, which is why these are written here rather than read
 * out of the page. Nothing in WordPress records the relation — the film posts
 * carry a `kinescope_id` ACF field, but these are advertising clips, not films.
 */
const OD_KINESCOPE_EMBEDS = [
    // `/materials/led-board-roliki/`
    'Jd5gnZ7FzxA' => ['306f45e7-be28-4612-bc26-68768b5a399e', 'Аристотель. Ролик «Общего дела» для светодиодного щита'],
    'rUr6OjmfP-4' => ['e9525d33-56de-4231-8c3b-4ac8874cd97c', 'Бехтерев. Ролик «Общего дела» для светодиодного щита'],
    'YJAqTTzixnA' => ['c3d7c71d-1f96-4db5-8eca-cf752bc074e8', 'Дарвин. Ролик «Общего дела» для светодиодного щита'],
    'qYjUQmFiwS0' => ['b3fc5641-ece5-43c4-be0a-c2e02175aa9d', 'Достоевский. Ролик «Общего дела» для светодиодного щита'],
    '39L_-8-pXVg' => ['c1382dc5-63f6-4355-a115-f09b8623b41e', 'Иоганн Гёте. Ролик «Общего дела» для светодиодного щита'],
    's2pNzBkJVJQ' => ['31702700-24b4-4166-9510-70b0c62c9dd2', 'Лев Толстой, вариант 1. Ролик «Общего дела» для светодиодного щита'],
    'mXw3gcMVa4U' => ['4a8c3a4a-853c-4d29-9672-bd22e4862f49', 'Лев Толстой, вариант 2. Ролик «Общего дела» для светодиодного щита'],
    'WgOM91U9mpg' => ['4dbaac4a-439d-405a-be11-39f0ee68a69f', 'Лев Толстой, вариант 3. Ролик «Общего дела» для светодиодного щита'],
    '8EGyJvNIheg' => ['af2aa816-c295-4c19-b3b1-ed58a0bfaa64', 'Семашко Н.А. Ролик «Общего дела» для светодиодного щита'],
    'ww534o1NIPY' => ['a38a9b91-7c66-4677-8f7e-819b54317c99', 'Углов. Ролик «Общего дела» для светодиодного щита'],
    // `/materials/books/`
    'rCORvPx9cR4' => ['939be838-34ec-4e95-88bf-7f31244c3be2', 'Правда про алкоголь. История одного обмана'],
    'ZOqohiNifK0' => ['7bd4b8cb-6107-46a7-a7cc-d715d5c51bf1', 'Тайна природы женщины — фильм организации «Общее дело»'],
];

/**
 * The Kinescope player, as a `core/html` block.
 *
 * `core/embed` cannot carry it: WordPress has no oEmbed provider for
 * kinescope.io, so the block would store the url and render it as its own text.
 * The `<figure>` around the frame is core's embed markup, which is what the
 * `wp-embed-aspect-16-9` rule in `gutenberg.css` reads — the iframe is 16:9
 * whatever column it lands in, and `FilmPlayer` already iframes the same host,
 * so nothing new is allowed through.
 *
 * No `allowfullscreen` beside the `allow` list: the browser logs «Allow
 * attribute will take precedence over 'allowfullscreen'» when both are set, and
 * `fullscreen` is already in the list.
 *
 * @throws RuntimeException when the page embeds a clip nothing has been matched
 *                          for — better than silently leaving a YouTube frame.
 */
function od_pages_kinescope(string $youtubeUrl): string
{
    if (!preg_match('~(?:youtu\.be/|v=)([A-Za-z0-9_-]{6,})~', $youtubeUrl, $found)) {
        throw new RuntimeException(sprintf('unexpected input: «%s» is not a YouTube url', $youtubeUrl));
    }
    if (!isset(OD_KINESCOPE_EMBEDS[$found[1]])) {
        throw new RuntimeException(sprintf('no Kinescope video matched for YouTube id «%s»', $found[1]));
    }

    [$id, $title] = OD_KINESCOPE_EMBEDS[$found[1]];

    return "<!-- wp:html -->\n"
        . '<figure class="wp-block-embed is-type-video wp-block-embed-kinescope wp-embed-aspect-16-9 wp-has-aspect-ratio">'
        . '<div class="wp-block-embed__wrapper">'
        . sprintf(
            '<iframe src="https://kinescope.io/embed/%s" title="%s" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;" loading="lazy"></iframe>',
            $id,
            od_attr($title)
        )
        . "</div></figure>\n<!-- /wp:html -->\n";
}

/** A `core/audio` block. */
function od_pages_audio(string $src): string
{
    return sprintf(
        "<!-- wp:audio -->\n<figure class=\"wp-block-audio\"><audio controls src=\"%s\"></audio></figure>\n<!-- /wp:audio -->\n",
        $src
    );
}

/**
 * Read a page apart into rows of columns, keeping everything a card is built
 * from: the images with their ids and the full-size file each links to, the
 * download buttons, the headings, the prose, the YouTube urls and the mp3 that
 * only ever existed inside an unmigrated `[cmsms_audio]` shortcode.
 *
 * One reader for all ten asset pages, because the migrator gave them all the
 * same skeleton — a `group > columns` per row — and they differ only in what
 * sits in the columns. Rows that hold nothing a card needs (the old theme's
 * `<style>`, the empty spacer groups, the MailPoet form whose plugin is gone)
 * come back empty and every transform drops them.
 *
 * @return array<int, array<int, array{
 *     images: array<int, array{id: string, src: string, href: string}>,
 *     buttons: array<int, array{href: string, label: string}>,
 *     headings: array<int, string>,
 *     texts: array<int, string>,
 *     embeds: array<int, string>,
 *     audio: string,
 *     labelled: bool,
 *     sides: string,
 *     raw: string
 * }>>
 */
function od_pages_asset_rows(string $content): array
{
    $rows = [];

    foreach (explode('<!-- /wp:columns -->', $content) as $chunk) {
        $start = strpos($chunk, '<!-- wp:columns');
        if ($start === false) {
            continue;
        }

        $row = [];
        foreach (explode('<!-- /wp:column -->', substr($chunk, $start)) as $column) {
            if (strpos($column, '<!-- wp:column') === false) {
                continue;
            }
            $row[] = od_pages_asset_column($column);
        }

        $rows[] = $row;
    }

    return $rows;
}

/**
 * One column of {@see od_pages_asset_rows()}.
 *
 * `labelled` records that the column carried the old «Примеры использования»
 * heading — the one thing that tells a photo of a poster on a wall apart from
 * the poster itself, and it is a paragraph rather than anything structural.
 *
 * @return array{images: array, buttons: array, headings: array, texts: array, embeds: array, audio: string, labelled: bool, sides: string, raw: string}
 */
function od_pages_asset_column(string $column): array
{
    $out = [
        'images' => [], 'buttons' => [], 'headings' => [], 'texts' => [], 'embeds' => [],
        'audio' => '', 'labelled' => false, 'sides' => '', 'raw' => $column,
    ];

    if (preg_match_all('#<!-- wp:image \{"id":(\d+).*?<figure[^>]*>(?:<a href="([^"]*)">)?<img src="([^"]+)"#s', $column, $images, PREG_SET_ORDER)) {
        foreach ($images as $image) {
            $out['images'][] = ['id' => $image[1], 'href' => $image[2], 'src' => $image[3]];
        }
    }

    if (preg_match_all('#wp-block-button__link[^>]*href="([^"]*)"[^>]*>(.*?)</a>#s', $column, $buttons, PREG_SET_ORDER)) {
        foreach ($buttons as $button) {
            $out['buttons'][] = ['href' => $button[1], 'label' => od_pages_inline_text($button[2])];
        }
    }

    if (preg_match_all('#<h([1-6])[^>]*>(.*?)</h\1>#s', $column, $headings, PREG_SET_ORDER)) {
        foreach ($headings as $heading) {
            $out['headings'][] = od_pages_inline_text($heading[2]);
        }
    }

    if (preg_match_all('#<p[^>]*>(.*?)</p>#s', $column, $texts, PREG_SET_ORDER)) {
        foreach ($texts as $text) {
            $prose = od_pages_inline_text($text[1]);
            if ($prose === '') {
                continue;
            }
            if (mb_stripos($prose, 'Примеры использования') === 0) {
                $out['labelled'] = true;
                continue;
            }
            // `/materials/booklet/` labels the two faces of a flyer this way,
            // as a paragraph above the picture rather than a caption on it.
            if (preg_match('~^Сторона\s+[АБ]$~u', $prose)) {
                $out['sides'] = $prose;
                continue;
            }
            $out['texts'][] = $prose;
        }
    }

    if (preg_match_all('#<!-- wp:embed \{[^}]*"url":"([^"]+)"#', $column, $embeds, PREG_SET_ORDER)) {
        foreach ($embeds as $embed) {
            $out['embeds'][] = str_replace('\\/', '/', $embed[1]);
        }
    }

    if (preg_match('#\[cmsms_audio\](.*?)\[/cmsms_audio\]#s', $column, $audio)) {
        $out['audio'] = trim($audio[1]);
    }

    return $out;
}

/**
 * A `cb/carousel-v2` block — the Carousel Block plugin, which is what both mocks
 * draw for these rows and the only carousel this site already runs: the frontend
 * mounts a Swiper on every `.cb-carousel-block` it renders
 * (`src/shared/ui/theme/gutenberg/Carousel/`), so a section written this way
 * needs almost no frontend code at all.
 *
 * The `data-cb-*` attributes are what the frontend reads; the block comment is
 * what the editor reads. Both say the same thing, as the plugin's own `save`
 * does. Three slides per view above 900px — which is what both rows are on
 * desktop — and one-and-a-bit below it, from the slide width in CSS.
 *
 * @param string $track The element Swiper scrolls: {@see od_pages_slides()} for
 *                      hand-written slides, {@see od_pages_film_query()} for a
 *                      query. Either way it is the block's `.swiper`.
 */
function od_pages_carousel(string $track, string $className, bool $navigation, int $slidesPerView = 3): string
{
    $attrs = json_encode(
        [
            'className' => $className,
            'spaceBetween' => 40,
            'navigation' => $navigation,
            'breakpoints' => [['width' => 900, 'slidesPerView' => $slidesPerView, 'slidesPerGroup' => 1]],
        ],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    return sprintf(
        "<!-- wp:cb/carousel-v2 %s -->\n"
            . '<div class="wp-block-cb-carousel-v2 cb-carousel-block %s" data-cb-slides-per-view="%d"'
            . ' data-cb-slides-per-group="1" data-cb-space-between="40" data-cb-speed="300"'
            . ' data-cb-navigation="%s" data-cb-pagination="true" data-cb-loop="false"'
            . ' data-cb-breakpoints="{&quot;900&quot;:{&quot;slidesPerView&quot;:%d,&quot;slidesPerGroup&quot;:1}}">'
            . '%s'
            . '<div class="cb-pagination swiper-pagination"></div>'
            . '<div class="cb-button-prev swiper-button-prev"></div>'
            . '<div class="cb-button-next swiper-button-next"></div>'
            . "</div>\n<!-- /wp:cb/carousel-v2 -->\n\n",
        $attrs,
        $className,
        $slidesPerView,
        $navigation ? 'true' : 'false',
        $slidesPerView,
        $track
    );
}

/**
 * Hand-written slides, the plugin's own shape. An editor adds a fourth card by
 * adding a slide, and nothing in this repo changes.
 *
 * @param array<int, string> $slides Inner markup of each slide.
 */
function od_pages_slides(array $slides): string
{
    $out = '<div class="swiper"><div class="cb-wrapper swiper-wrapper">';
    foreach ($slides as $slide) {
        $out .= "<!-- wp:cb/slide-v2 -->\n<div class=\"wp-block-cb-slide-v2 cb-slide swiper-slide\">"
            . $slide
            . "</div>\n<!-- /wp:cb/slide-v2 -->\n";
    }

    return $out . '</div></div>';
}

/**
 * The films of a programme, as a `core/query` — so the row follows the tag and
 * tagging a film in the admin is the whole job of adding one.
 *
 * Three attributes carry the trick that lets a dynamic list drive a Swiper: the
 * query renders as `.wp-block-query`, so `className: swiper` makes it the
 * element the adapter mounts on, and `core/post-template` renders the `<ul>`
 * Swiper needs as its track, so it takes `swiper-wrapper`. The `<li>`s come out
 * as `.wp-block-post` rather than `.swiper-slide`, which the adapter passes to
 * Swiper as `slideClass`.
 *
 * The cover is **not** `core/post-featured-image`: that is the 16∶9 still
 * `/video/` wants, and this card is 3∶4. It is a `core/image` bound to
 * `od_card_cover` — the film's printable плакат, falling back to the still —
 * through the Block Bindings API, which `wp/mu-plugins/od-film-meta.php`
 * registers. A binding cannot produce a permalink, so the cover is not a link
 * and the film's own title is, which is the better accessible name anyway.
 *
 * The permalink structure on this site is `/%post_id%/`, so every link a query
 * block emits is already the URL the frontend serves a film at — no rewriting,
 * beyond `resolveContentLinks` making it root-relative.
 */
function od_pages_film_query(int $tagId): string
{
    $query = json_encode(
        [
            'queryId' => 0,
            'query' => [
                'perPage' => 12,
                'pages' => 0,
                'offset' => 0,
                'postType' => 'post',
                'order' => 'desc',
                'orderBy' => 'date',
                'author' => '',
                'search' => '',
                'exclude' => [],
                'sticky' => '',
                'inherit' => false,
                'tagIds' => [$tagId],
            ],
            'className' => 'swiper',
        ],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    $cover = json_encode(
        [
            'metadata' => [
                'bindings' => [
                    'url' => ['source' => 'core/post-meta', 'args' => ['key' => 'od_card_cover']],
                ],
            ],
        ],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    return sprintf("<!-- wp:query %s -->\n", $query)
        . '<div class="wp-block-query swiper">'
        . "<!-- wp:post-template {\"className\":\"swiper-wrapper\"} -->\n"
        // `alt=""` on purpose: the title below is the card's accessible name, and
        // the cover repeats it. `loading="lazy"` because WordPress does not add
        // it here and a printable плакат is heavy — the row is the last thing on
        // the page, and six of them at ~800 KB each is a megabyte-scale download
        // nobody has scrolled to yet.
        . sprintf("<!-- wp:image %s -->\n", $cover)
        . '<figure class="wp-block-image"><img src="" alt="" loading="lazy" decoding="async"/></figure>'
        . "\n<!-- /wp:image -->\n\n"
        . "<!-- wp:post-title {\"level\":3,\"isLink\":true} /-->\n"
        . "<!-- /wp:post-template -->"
        . "</div>\n<!-- /wp:query -->\n\n";
}

/**
 * The goal card — the same `core/group` on all three programme pages: a heading,
 * one paragraph, and the template's drawing, which `gutenberg.css` supplies as a
 * background so there is nothing decorative for an editor to lose.
 *
 * The programme's own materials hang under that paragraph. Neither mock draws
 * them, and neither mock has anywhere else to put a live download either — this
 * is the one place on the page where a link about the programme reads as being
 * about the programme.
 *
 * @param array<int, array{href: string, label: string}> $links
 */
function od_pages_goal_card(string $text, array $links = []): string
{
    $out = "<!-- wp:group {\"className\":\"od-card od-card--goal\",\"layout\":{\"type\":\"constrained\"}} -->\n"
        . '<div class="wp-block-group od-card od-card--goal">'
        . od_pages_heading(2, 'Цель программы')
        . od_pages_paragraph($text);

    foreach ($links as $link) {
        $out .= sprintf(
            "<!-- wp:paragraph {\"className\":\"od-card-link\"} -->\n<p class=\"od-card-link\"><a href=\"%s\">%s</a></p>\n<!-- /wp:paragraph -->\n\n",
            $link['href'],
            $link['label']
        );
    }

    return $out . "</div>\n<!-- /wp:group -->\n\n";
}

/**
 * The «Задачи программы» row of `project-2`/`project-3`: «01», «02», … above one
 * paragraph per card, where `project-1` puts a title. The number is written into
 * the block rather than drawn by a CSS counter — it is one short string an
 * editor can see and retype, against a rule that has to be understood before it
 * can be changed.
 *
 * `slidesPerView` follows the number of cards rather than the template's three,
 * because the mock widens two cards to fill the row instead of leaving a hole.
 * No arrows either way: the whole row is on screen above 900px, and below it the
 * cards are a swipe.
 *
 * @param array<int, string> $tasks Plain text of each card.
 */
function od_pages_numbered_tasks(array $tasks): string
{
    $slides = [];
    foreach (array_values($tasks) as $index => $task) {
        $slides[] = sprintf(
            "<!-- wp:paragraph {\"className\":\"od-task-number\"} -->\n<p class=\"od-task-number\">%02d</p>\n<!-- /wp:paragraph -->\n\n",
            $index + 1
        ) . od_pages_paragraph($task);
    }

    return od_pages_carousel(od_pages_slides($slides), 'od-cards od-cards--numbered', false, count($slides));
}

/**
 * The approval note. On `/healthy-russia/` the same sentence is the methodology
 * card's body; the other two pages have no such card and the mock sets it as a
 * standalone 24px paragraph of its own.
 */
function od_pages_note(string $text): string
{
    return sprintf("<!-- wp:paragraph {\"className\":\"od-note\"} -->\n<p class=\"od-note\">%s</p>\n<!-- /wp:paragraph -->\n\n", $text);
}

/**
 * A link the old content wrote against the live site's own domain, made
 * root-relative — `resolveContentLinks` only rewrites the WordPress origin, so
 * without this the reader is sent to the site this one replaces.
 *
 * Exact hosts, and only the bare and `www.` forms: `metodic.obshee-delo.ru` is a
 * different site that has to keep its origin. The Punycode form is what a
 * browser sends and what some of the content already carries.
 */
function od_pages_site_link(string $href): string
{
    $hosts = 'общее-дело\.рф|xn----9sbkcac6brh7h\.xn--p1ai|obshee-delo\.ru';

    return preg_replace(sprintf('#^https?://(?:www\.)?(?:%s)(?=/)#ui', $hosts), '', $href);
}

/**
 * The «Задачи программы» paragraphs of `/healthy-youth/`, where the migrator
 * left the tasks as ordinary `<p>`s between that heading and the approval note
 * rather than as the `<strong>`-labelled pairs `/healthy-russia/` carries or the
 * `<ul>` `/healthy-kids/` does.
 *
 * @return array<int, string>
 */
function od_pages_task_paragraphs(string $content): array
{
    if (!preg_match('#Задачи программы</h2>(.*?)<p><span#s', $content, $block)) {
        return [];
    }

    preg_match_all('#<p>(.*?)</p>#s', $block[1], $found, PREG_SET_ORDER);

    return array_map(static fn(array $task): string => od_pages_inline_text($task[1]), $found);
}

/** A `core/image` block, optionally wrapped in a link and optionally classed. */
function od_pages_image_block(string $id, string $src, string $alt, string $href = '', string $className = ''): string
{
    $attrs = ['id' => (int) $id, 'sizeSlug' => 'full'];
    if ($href !== '') {
        $attrs['linkDestination'] = 'custom';
    }
    if ($className !== '') {
        $attrs['className'] = $className;
    }

    $figureClass = 'wp-block-image size-full' . ($className === '' ? '' : ' ' . $className);
    $img = sprintf('<img src="%s" alt="%s"/>', $src, $alt);
    $inner = $href === '' ? $img : sprintf('<a href="%s">%s</a>', $href, $img);

    return sprintf(
        "<!-- wp:image %s -->\n<figure class=\"%s\">%s</figure>\n<!-- /wp:image -->\n\n",
        json_encode($attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $figureClass,
        $inner
    );
}

/** A `core/heading` block. */
function od_pages_heading(int $level, string $text, string $anchor = ''): string
{
    $attrs = [];
    if ($level !== 2) {
        $attrs['level'] = $level;
    }
    if ($anchor !== '') {
        $attrs['anchor'] = $anchor;
    }

    $json = $attrs === [] ? '' : ' ' . json_encode($attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $id   = $anchor === '' ? '' : sprintf(' id="%s"', od_attr($anchor));

    return sprintf(
        "<!-- wp:heading%s -->\n<h%d class=\"wp-block-heading\"%s>%s</h%d>\n<!-- /wp:heading -->\n\n",
        $json,
        $level,
        $id,
        $text,
        $level
    );
}

/** A `core/paragraph` block. */
function od_pages_paragraph(string $text): string
{
    return sprintf("<!-- wp:paragraph -->\n<p>%s</p>\n<!-- /wp:paragraph -->\n\n", $text);
}

/**
 * A `core/buttons` block of outline buttons — the only button style left in the
 * hand-written markup, now that the poster cards draw their own from
 * `core/read-more`.
 *
 * @param array<int, array{href: string, label: string}> $buttons
 */
function od_pages_buttons(array $buttons): string
{
    $out = "<!-- wp:buttons -->\n<div class=\"wp-block-buttons\">";
    foreach ($buttons as $button) {
        $out .= "<!-- wp:button {\"className\":\"is-style-outline\"} -->\n"
            . '<div class="wp-block-button is-style-outline">'
            . sprintf('<a class="wp-block-button__link wp-element-button" href="%s">%s</a>', $button['href'], $button['label'])
            . "</div>\n<!-- /wp:button -->\n";
    }

    return $out . "</div>\n<!-- /wp:buttons -->\n\n";
}

/**
 * Prose lifted out of the old markup: the migrator's line breaks and the old
 * theme's `<span class="fontstyle0">` carry no meaning in the new layout.
 */
function od_pages_inline_text(string $html): string
{
    $text = preg_replace('#<br\s*/?>#i', ' ', $html);
    $text = preg_replace('#</?span[^>]*>#i', '', $text);

    return trim(preg_replace('#\s+#u', ' ', $text));
}

/* -------------------------------------------------------------------------
 * Pure transforms
 * ---------------------------------------------------------------------- */

/**
 * Escape a value for an HTML attribute without double-escaping entities the
 * content already carries (`&laquo;` must not become `&amp;laquo;`).
 */
function od_attr(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8', false);
}

/**
 * Drop a trailing «— ОБЩЕЕ ДЕЛО» from a heading.
 *
 * The old theme's headings carried the site name because they doubled as the
 * link's `title`, and «Здоровая Россия - ОБЩЕЕ ДЕЛО» is what
 * {@see od_headings_into_image_alt()} would otherwise put in three `alt`s and
 * three `aria-label`s on one page — a screen reader reading the site's own name
 * out three times between the covers.
 *
 * Any of the four dashes, either case, and only at the end.
 */
function od_strip_site_suffix(string $heading): string
{
    return trim(preg_replace('~\s*[-–—−]\s*ОБЩЕЕ\s+ДЕЛО[.!]?\s*$~ui', '', $heading));
}

/**
 * Drop `group > columns > column{100%}` wrappers that contain nothing.
 *
 * CMSMasters rows were the old theme's vertical spacing, and an empty
 * `[cmsms_row][cmsms_column data_width="1/1"][/cmsms_column][/cmsms_row]` pair
 * came through the migrator as an empty group of an empty column. They render as
 * empty divs — invisible, but they are what makes "the first `wp:columns` block"
 * an unreliable thing to point at, so this runs first.
 *
 * Idempotent: after one pass there are none left to match.
 */
function od_drop_empty_layout_groups(string $content): string
{
    $pattern = '~<!--\s*wp:group\b[^>]*-->\s*<div class="wp-block-group">'
        . '\s*<!--\s*wp:columns\b[^>]*-->\s*<div class="wp-block-columns">'
        . '\s*<!--\s*wp:column\b[^>]*-->\s*<div class="wp-block-column"[^>]*>\s*</div>\s*<!--\s*/wp:column\s*-->'
        . '\s*</div>\s*<!--\s*/wp:columns\s*-->'
        . '\s*</div>\s*<!--\s*/wp:group\s*-->~s';

    return preg_replace($pattern, '', $content);
}

/**
 * Whether any block in `$content` already declares `$class`.
 *
 * The `className` values are split and compared whole rather than searched for as
 * a substring: `str_contains( $content, 'b' )` is true of every body ever
 * written, because `wp-block-columns` contains a «b».
 */
function od_has_block_class(string $content, string $class): bool
{
    if (!preg_match_all('~"className"\s*:\s*"([^"]*)"~', $content, $matches)) {
        return false;
    }

    foreach ($matches[1] as $value) {
        if (in_array($class, preg_split('~\s+~', trim($value)), true)) {
            return true;
        }
    }

    return false;
}

/**
 * Put `$class` on the first `wp:columns` block — both in the block attributes
 * and on the rendered `<div>`, which is what the editor itself writes for the
 * «Дополнительные CSS-классы» field.
 *
 * A class is how a page-specific layout reaches CSS in this repo (ladder rung 2,
 * `docs/wp-page-redesign.md` §2): nothing in Gutenberg's markup distinguishes a
 * grid of poster covers from any other three-column row.
 *
 * Idempotent by detection — {@see od_has_block_class()}.
 */
function od_class_on_first_columns(string $content, string $class): string
{
    if (od_has_block_class($content, $class)) {
        return $content;
    }

    return preg_replace_callback(
        '~<!--\s*wp:columns\s*(\{.*?\})?\s*-->(\s*)<div class="wp-block-columns~s',
        static function (array $m) use ($class): string {
            $attrs = isset($m[1]) && '' !== $m[1] ? json_decode($m[1], true) : [];
            $attrs = is_array($attrs) ? $attrs : [];
            $attrs['className'] = trim(($attrs['className'] ?? '') . ' ' . $class);
            $json               = json_encode($attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            return "<!-- wp:columns {$json} -->{$m[2]}<div class=\"wp-block-columns {$class}";
        },
        $content,
        1
    );
}

/**
 * Move an `h2` that only labels the picture under it into that picture's `alt`,
 * and drop the heading.
 *
 * The `handbooks` mock draws the three covers with no captions: each poster's
 * title is printed on the artwork itself, so the heading above it was the same
 * words twice. Deleting it outright would lose them for a screen reader and for
 * search, hence the move rather than a delete.
 *
 * Only a heading whose **immediately** following block is a paragraph holding an
 * `<img>` qualifies, and the image has to be inside that same paragraph — the
 * `(?:(?!</p>).)*?` is what stops a heading with no picture of its own from
 * claiming the next column's.
 *
 * Idempotent: the heading it feeds on is gone afterwards.
 */
function od_headings_into_image_alt(string $content): string
{
    $pattern = '~<!--\s*wp:heading\b[^>]*-->\s*<h2\b[^>]*>(.*?)</h2>\s*<!--\s*/wp:heading\s*-->'
        . '(\s*<!--\s*wp:paragraph\s*-->\s*<p\b[^>]*>(?:(?!</p>).)*?<img\b)([^>]*?)(\s*/?>)~s';

    return preg_replace_callback(
        $pattern,
        static function (array $m): string {
            $alt   = od_attr(od_strip_site_suffix(trim(strip_tags($m[1]))));
            $attrs = $m[3];
            // Replace the alt the migrator left («metodichka-mult» on two of the
            // three) rather than adding a second one.
            $attrs = preg_match('~\salt=(["\']).*?\1~s', $attrs)
                ? preg_replace('~\salt=(["\']).*?\1~s', " alt=\"{$alt}\"", $attrs, 1)
                : $attrs . " alt=\"{$alt}\"";

            return $m[2] . $attrs . $m[4];
        },
        $content
    );
}

/**
 * Strip `margin` and `padding` declarations from the inline `style` attribute of
 * every paragraph, leaving the rest of the attribute alone.
 *
 * CMSMasters rows carried their spacing per element, and the migrator brought it
 * across as inline style: the three cover paragraphs on `/materials/metodichki/`
 * arrive with `padding: 0px`, `margin-bottom: 3px` and `margin-bottom: 0px`
 * respectively. Inline style beats any stylesheet, so the odd `3px` in the middle
 * made that column 3px taller than its poster — and because block-library forces
 * `align-items` on a columns row, **all three** pills then sat 11px above their
 * poster's edge instead of the 14 the mock draws, with the stacked layout showing
 * 14/11/14. Spacing is the stylesheet's job; this hands it back.
 *
 * Idempotent: nothing is left to strip. `text-align` and anything else the author
 * set survive, and a `style` attribute left empty is removed rather than kept as
 * `style=""`.
 */
function od_strip_paragraph_spacing(string $content): string
{
    return preg_replace_callback(
        '~(<p\b[^>]*?\sstyle=")([^"]*)(")~i',
        static function (array $m): string {
            $kept = array_filter(
                array_map('trim', explode(';', $m[2])),
                static function (string $declaration): bool {
                    if ('' === $declaration) {
                        return false;
                    }
                    $property = strtolower(trim(strtok($declaration, ':')));

                    return 0 !== strpos($property, 'margin') && 0 !== strpos($property, 'padding');
                }
            );

            if (!$kept) {
                // Drop the whole attribute, including the space before it.
                return rtrim(substr($m[1], 0, -strlen(' style="')));
            }

            return $m[1] . implode(';', $kept) . $m[3];
        },
        $content
    );
}

/**
 * Name each cover's button after the cover, and take the poster's own link out of
 * the tab order.
 *
 * A cover column is a linked poster followed by a `wp:button` to the same place,
 * so a keyboard reached every cover **twice** — six stops for three
 * destinations — and a screen reader listing the page's links got «Подробнее»
 * three times over, with nothing to tell them apart. The poster's link is the
 * redundant one (`tabindex="-1"` plus `aria-hidden`, the pair that keeps an
 * `aria-hidden` element from being focusable), and the button takes the cover's
 * name from the image's `alt` — which {@see od_headings_into_image_alt} has just
 * put there, so this has to run after it.
 *
 * Idempotent: both edits are guarded on the attribute they add. A column with no
 * image, or an image with an empty `alt`, is left alone — the empty layout
 * columns and the coordinator's are exactly that.
 */
function od_cover_link_names(string $content): string
{
    return preg_replace_callback(
        '~<!--\s*wp:column\b.*?<!--\s*/wp:column\s*-->~s',
        static function (array $m): string {
            $column = $m[0];

            if (!preg_match('~<img\b[^>]*\salt="([^"]+)"~', $column, $alt)) {
                return $column;
            }

            // Verbatim, not decoded and re-encoded: the value already survived one
            // `"`-quoted attribute, so it is safe in the next one, entities and all.
            $name = trim($alt[1]);
            if ('' === $name) {
                return $column;
            }

            $column = preg_replace(
                '~<a\b(?![^>]*\stabindex=)([^>]*)(>\s*<img\b)~',
                '<a tabindex="-1" aria-hidden="true"$1$2',
                $column,
                1
            );

            return preg_replace(
                '~(<a\b(?![^>]*\saria-label=)[^>]*\sclass="[^"]*wp-block-button__link[^"]*"[^>]*)>~',
                '$1 aria-label="' . od_attr('Подробнее: ' . $name) . '">',
                $column,
                1
            );
        },
        $content
    );
}

/**
 * Upgrade `http://` links to our own hosts to `https://`.
 *
 * The first cover points at `http://metodic.obshee-delo.ru/`, which answers 301
 * to the `https` copy — so every visit paid for a redirect, and the page mixed
 * schemes for no reason. Scoped to `obshee-delo.ru` and its subdomains: an
 * off-site `http` link may genuinely have no `https` to go to, and this script
 * has no way to find out.
 *
 * Idempotent: there is no `http://` left to match.
 */
function od_https_own_links(string $content): string
{
    // The lookahead is the point: without it `obshee-delo.ru.evil.tld` matches as a
    // prefix and gets its scheme upgraded too.
    return preg_replace('~\bhref="http://((?:[a-z0-9-]+\.)*obshee-delo\.ru)(?=[/"?#])~i', 'href="https://$1', $content);
}

/**
 * Replace a `wp:details` accordion with its summary as an `h2` and a link to the
 * `profile` record whose contact details the accordion held as prose.
 *
 * Two things happen here. The person **stops being duplicated**: the page had a
 * name, a role and three contact lines pasted out of Telegram, while the same
 * person's `profile` record held the same details again and neither copy was a
 * superset. The frontend swaps a `/profile/…` link alone in its paragraph for a
 * card built from the record (`src/modules/WpPage/profileEmbeds.tsx`), so the
 * link is both the marker and the fallback — remove the frontend code and what
 * is left is a working link to that person's page. And the block **stops being
 * an accordion**, because the mock shows the card open: the accordion was the old
 * theme's `[cmsms_toggle]`, not a decision anyone made about this content.
 *
 * The heading text is the summary's, verbatim.
 *
 * Idempotent: there is no `wp:details` left to match.
 */
function od_details_to_profile_link(string $content, string $href, string $label): string
{
    return preg_replace_callback(
        '~<!--\s*wp:details\b.*?<summary>(.*?)</summary>.*?<!--\s*/wp:details\s*-->~s',
        static function (array $m) use ($href, $label): string {
            $heading = trim(strip_tags($m[1]));

            return '<!-- wp:heading {"level":2} --><h2 class="wp-block-heading">' . od_attr($heading)
                . '</h2><!-- /wp:heading -->'
                . '<!-- wp:paragraph --><p><a href="' . od_attr($href) . '">' . od_attr($label)
                . '</a></p><!-- /wp:paragraph -->';
        },
        $content,
        1
    );
}

/**
 * Add contact links to a `profile` body, at the end of its last paragraph block.
 *
 * The counterpart of {@link od_details_to_profile_link}: the page held this
 * person's Telegram handle and VK page and the record did not, so dropping the
 * page's prose without this would lose them. `profile` bodies keep their contacts
 * as `<p>`s inside one `wp:paragraph` block, which is where these go — appending
 * to the end of `post_content` instead would put them outside the two-column
 * group, below the photo.
 *
 * `$links` is a list of `[href, label]`. Idempotent per link: a href already
 * anywhere in the body is skipped, so a re-run adds nothing and an editor's own
 * later edit to the label survives.
 */
function od_append_contact_links(string $content, array $links): string
{
    foreach ($links as list($href, $label)) {
        if (str_contains($content, $href)) {
            continue;
        }

        $paragraph = '<p><a href="' . od_attr($href) . '">' . od_attr($label) . '</a></p>';
        $closing   = strrpos($content, '<!-- /wp:paragraph -->');
        $content   = false === $closing
            ? rtrim($content) . "\n" . $paragraph
            : substr_replace($content, $paragraph . "\n", $closing, 0);
    }

    return $content;
}

/**
 * The coordinator «Заказать методические пособия» names. The slug is the record's
 * own and it reads wrong on purpose: profile 46651 was Екатерина Гордикова and
 * was retitled to Андрей Рязанов without re-slugging (`_wp_old_slug` is
 * `екатерина-гордикова`). Re-slugging it is **not** safe from here — the A6
 * frozen copy is keyed on the live path, so a new slug would 404 in the iframe
 * that still serves `/profile/*`. Reported as a content bug instead.
 */
const OD_METODICHKI_COORDINATOR_HREF =
    '/profile/%d0%b3%d0%be%d1%80%d0%b4%d0%b8%d0%ba%d0%be%d0%b2%d0%b0-%d0%b5%d0%ba%d0%b0%d1%82%d0%b5%d1%80%d0%b8%d0%bd%d0%b0/';
const OD_METODICHKI_COORDINATOR_NAME = 'Андрей Алексеевич Рязанов';

/**
 * The covers whose file the page should not be using, and the one it should.
 *
 * All three are the flat print covers from Figma `handbooks`, exported at the
 * row's own 775×1092. What the library held instead was photographs of the
 * printed booklets on white grounds — the same publications, a different
 * presentation, and the mock draws artwork to the card's edges. Two were also too
 * small for the 387-wide slot (500×647 and **220×300**), and «Здоровые дети» had
 * no larger copy anywhere in the library: the `wp-image-27636` its `<img>` claims
 * is a different booklet altogether. Approved as a departure from the library on
 * 2026-08-18; `docs/next-steps.md` has the measurements.
 *
 * «Здоровая молодежь» is here **twice** because the page exists in two states: a
 * freshly converted body references `обложка_ЗдорМолодежьNew_small.jpg`, and a
 * body this script already ran over references the full-size file it swapped in
 * before the flat covers existed. Both have to land on the same cover.
 *
 * **These four paths are the one thing in this file that is not true everywhere.**
 * Every other address here is a slug or a path the content already carried; these
 * are uploads *we* added, so they exist only where they have been put. Production
 * needs the same three files under the same `2026/08/` path before this runs —
 * `docs/prod-migration-runbook.md` §2.8 — and a swap whose source basename is
 * absent matches nothing and says nothing, so a missed step looks like success.
 */
const OD_METODICHKI_COVERS = [
    'metodichka-232x300.jpg'            => '/wp-content/uploads/2026/08/metodichka-zdorovaya-rossiya.jpg',
    'metodic-mults-small220x300.jpg'    => '/wp-content/uploads/2026/08/metodichka-zdorovye-deti.jpg',
    'обложка_ЗдорМолодежьNew_small.jpg' => '/wp-content/uploads/2026/08/metodichka-zdorovaya-molodezh.jpg',
    'обложка_ЗдорМолодежьNew.jpg'       => '/wp-content/uploads/2026/08/metodichka-zdorovaya-molodezh.jpg',
];

/**
 * Strip the site name from every `alt` and `aria-label` already in the body.
 *
 * {@see od_headings_into_image_alt()} cleans the heading it moves, but it is
 * idempotent by "the heading is gone afterwards" — on a page converted before
 * this strip existed there is no heading left to clean, and the suffix sits in
 * three `alt`s and three `aria-label`s. Cleaning the attributes themselves fixes
 * both the converted and the fresh page, and is what makes the whole chain
 * idempotent either way.
 *
 * The value is rewritten in place, never decoded and re-encoded: it already
 * survived one `"`-quoted attribute.
 */
function od_strip_attr_site_suffix(string $content): string
{
    return preg_replace_callback(
        '~\s(alt|aria-label)="([^"]*)"~u',
        static function (array $m): string {
            $cleaned = od_strip_site_suffix($m[2]);

            return $cleaned === $m[2] ? $m[0] : ' ' . $m[1] . '="' . $cleaned . '"';
        },
        $content
    );
}

/**
 * Point a cover at the file it should be using.
 *
 * The key is always a **basename**, because that is what identifies a cover
 * wherever the page lives — the row's three `<img>`s were written by hand over ten
 * years and carry three different upload directories. The value is read two ways:
 *
 * - a **basename** swaps the file inside whatever directory the page already
 *   carries, which is the form to use when the replacement sits beside the
 *   original in the library — the map then stays true on every environment;
 * - a **root-relative path** (leading `/`) replaces the whole `src`, which is the
 *   form to use when the replacement is somewhere else. It is the stronger claim:
 *   that path has to exist on the environment this runs against.
 *
 * `width`, `height` and `wp-image-<id>` are dropped from a swapped image on
 * purpose: all three described the old file. The size the stylesheet gives the
 * cover is fixed (`aspect-ratio` on `.od-covers img`), and an attachment id is
 * per-environment, so writing the new one here would be exactly the hardcoding
 * this file avoids — the editor re-attaches it on the next save.
 *
 * Idempotent: a swapped image no longer matches its own key.
 *
 * @param array<string, string> $covers old basename => new basename, or new
 *                                      root-relative path.
 */
function od_cover_full_size(string $content, array $covers): string
{
    foreach ($covers as $from => $to) {
        $pattern = '~<img\b[^>]*\bsrc="[^"]*/(?:' . preg_quote(rawurlencode($from), '~')
            . '|' . preg_quote($from, '~') . ')"[^>]*>~u';

        $content = preg_replace_callback(
            $pattern,
            static function (array $m) use ($from, $to): string {
                if ($to[0] === '/') {
                    // Segment by segment: a path with a Cyrillic name in it has to
                    // arrive encoded, and the slashes must survive.
                    $encoded = implode('/', array_map('rawurlencode', explode('/', $to)));
                    $img     = preg_replace('~\bsrc="[^"]*"~', 'src="' . $encoded . '"', $m[0]);
                } else {
                    $img = str_replace([rawurlencode($from), $from], rawurlencode($to), $m[0]);
                }

                $img = preg_replace('~\s(?:width|height)="[^"]*"~', '', $img);
                $img = preg_replace('~\s?\bwp-image-\d+~', '', $img);

                return preg_replace('~\sclass="\s*"~', '', $img);
            },
            $content
        );
    }

    return $content;
}

/**
 * `/materials/metodichki/` — Figma `handbooks` (`779:4133`).
 *
 * Seven transforms in a fixed order, and the order is load-bearing twice: the
 * class has to be on the row before anything keys on it, and
 * `od_cover_link_names()` names each button from the `alt` that
 * `od_headings_into_image_alt()` has just written.
 *
 * @param string $content    Stored `post_content`.
 * @param int    $_filmTagId Unused — this page has no film row, but the runner
 *                           calls every transform the same way.
 */
function od_pages_metodichki(string $content, int $_filmTagId = 0): string
{
    $content = od_drop_empty_layout_groups($content);
    $content = od_class_on_first_columns($content, 'od-covers');
    $content = od_headings_into_image_alt($content);
    $content = od_cover_link_names($content);
    $content = od_strip_attr_site_suffix($content);
    $content = od_https_own_links($content);
    $content = od_strip_paragraph_spacing($content);
    $content = od_cover_full_size($content, OD_METODICHKI_COVERS);

    return od_details_to_profile_link($content, OD_METODICHKI_COORDINATOR_HREF, OD_METODICHKI_COORDINATOR_NAME);
}

/**
 * The coordinator's own `profile` record — the Telegram handle and the VK page
 * that the page carried and the record did not.
 *
 * The card on `/materials/metodichki/` is built from this record, so a contact
 * only the page held would have disappeared when the accordion did. Neither copy
 * was a superset of the other; this is the merge, in the record's own shape.
 *
 * @param string $content    Stored `post_content`.
 * @param int    $_filmTagId Unused — see {@see od_pages_metodichki()}.
 */
function od_pages_profile_ryazanov(string $content, int $_filmTagId = 0): string
{
    return od_append_contact_links(
        $content,
        [
            ['https://t.me/paramon1302', '@paramon1302'],
            ['https://vk.com/id39335667', 'https://vk.com/id39335667'],
        ]
    );
}

/**
 * `/materials/billboards/` — Figma `social-banners` (`1009:10590`).
 *
 * The most regular page in the set and the one the card is named after: the
 * migrator left thirteen `group > columns` rows, each already the mock's card —
 * the artwork and its download link on the left, a photo of the board in the
 * street on the right. All this does is make that structure explicit: the row
 * becomes a card, the «Примеры использования» paragraph that floated above the
 * photo becomes that photo's `figcaption`, the artwork gains the mock's «Макет»
 * label, and the button moves out of the left column to sit under both.
 *
 * The mock's button copy wins over the page's — «Скачать файл для печати» says
 * the same thing as «Скачать в качестве для печати» in fewer words, and it is
 * the wording every other frame in the set uses.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_billboards(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $out = '';
    $cards = 0;
    foreach (od_pages_asset_rows($content) as $row) {
        if (count($row) !== 2 || $row[0]['images'] === [] || $row[0]['buttons'] === [] || $row[1]['images'] === []) {
            continue;
        }

        $out .= od_pages_asset_card(
            od_pages_columns([
                ['width' => '66.67%', 'blocks' => od_pages_asset_image($row[0]['images'][0], 'Макет')],
                ['width' => '33.33%', 'blocks' => od_pages_asset_image($row[1]['images'][0], 'Примеры использования')],
            ])
            . od_pages_downloads([['href' => $row[0]['buttons'][0]['href'], 'label' => OD_ASSET_DOWNLOAD]])
        );
        $cards++;
    }

    if ($cards !== 13) {
        throw new RuntimeException(sprintf('unexpected input: %d billboard rows', $cards));
    }

    return rtrim($out) . "\n";
}

/**
 * `/materials/plakati/` — Figma `social-posters` (`998:9524`), and the #6 entry
 * page on the whole site.
 *
 * Fifteen posters in a two-up grid. The page does not store them that way: the
 * migrator left rows of four columns (two posters and their photos), then rows
 * of two buttons, then rows narrowed to 50 % and 75 % as the artwork got wider,
 * with empty 25 % columns padding the sides. So the posters are read out in
 * document order and the buttons separately, and the two lists are zipped —
 * fifteen of each, which is what the count guard checks.
 *
 * **Pairing is positional, not by label.** Inside one row the columns that hold
 * pictures alternate poster, photo-of-it-in-use — except in the «36 000 рублей»
 * row, where the second column is the same poster in black and white and never
 * got the «Примеры использования» paragraph the others carry. Reading the label
 * would split that row into two posters and leave the page one button short.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_plakati(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $posters = [];
    $buttons = [];

    foreach (od_pages_asset_rows($content) as $row) {
        $withPictures = array_values(array_filter($row, static fn(array $c): bool => $c['images'] !== []));

        foreach ($row as $column) {
            foreach ($column['buttons'] as $button) {
                $buttons[] = $button;
            }
        }

        for ($i = 0; $i < count($withPictures); $i += 2) {
            $poster = $withPictures[$i];
            $posters[] = [
                'title' => $poster['headings'][0] ?? '',
                'artwork' => $poster['images'][0],
                'examples' => $withPictures[$i + 1]['images'] ?? [],
            ];
        }
    }

    if (count($posters) !== 15 || count($buttons) !== 15) {
        throw new RuntimeException(sprintf('unexpected input: %d posters, %d buttons', count($posters), count($buttons)));
    }

    $cards = [];
    foreach ($posters as $index => $poster) {
        $card = $poster['title'] === '' ? '' : od_pages_heading(3, $poster['title']);

        if ($poster['examples'] === []) {
            $card .= od_pages_asset_image($poster['artwork'], 'Макет');
        } else {
            // One column per picture, not one for the artwork and one holding
            // the photos stacked: the mock puts everything in a card on a single
            // row, and three of these carry two photos rather than one.
            $columns = [['image' => $poster['artwork'], 'caption' => 'Макет']];
            foreach ($poster['examples'] as $n => $example) {
                $columns[] = ['image' => $example, 'caption' => $n === 0 ? 'Примеры использования' : ''];
            }

            $width = sprintf('%.2f%%', 100 / count($columns));
            $card .= od_pages_columns(array_map(
                static fn(array $column): array => [
                    'width' => $width,
                    'blocks' => od_pages_asset_image($column['image'], $column['caption']),
                ],
                $columns
            ));
        }

        $cards[] = $card . od_pages_downloads([['href' => $buttons[$index]['href'], 'label' => OD_ASSET_DOWNLOAD]]);
    }

    return rtrim(od_pages_assets($cards)) . "\n";
}

/**
 * `/materials/sticker/` — Figma `social-sticker` (`1013:11191`).
 *
 * Six stickers two-up, then the photos of them on a minibus window under their
 * own heading. The page alternates a row of two pictures with a row of two
 * buttons, which is the same zip `/materials/plakati/` needs and for the same
 * reason; the examples are the last row that carries pictures and no button.
 *
 * They become an `od-figures` grid rather than more cards: they are photographs
 * of the material in use, with nothing to download. Four across rather than the
 * mock's two — the mock draws them as two empty placeholders the size of a
 * sticker card, and the files behind them are 267 x 215, so a two-up row
 * upscales each one to twice its width.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_sticker(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $stickers = [];
    $buttons = [];
    $examples = [];

    foreach (od_pages_asset_rows($content) as $row) {
        foreach ($row as $column) {
            foreach ($column['buttons'] as $button) {
                $buttons[] = $button;
            }
            foreach ($column['images'] as $image) {
                if ($column['labelled']) {
                    $examples[] = $image;
                } else {
                    $stickers[] = $image;
                }
            }
        }
    }

    if (count($stickers) !== 6 || count($buttons) !== 6 || count($examples) !== 4) {
        throw new RuntimeException(sprintf(
            'unexpected input: %d stickers, %d buttons, %d examples',
            count($stickers),
            count($buttons),
            count($examples)
        ));
    }

    $cards = [];
    foreach ($stickers as $index => $sticker) {
        $cards[] = od_pages_asset_image($sticker)
            . od_pages_downloads([['href' => $buttons[$index]['href'], 'label' => OD_ASSET_DOWNLOAD]]);
    }

    return rtrim(
        od_pages_assets($cards)
        . od_pages_heading(2, 'Примеры использования')
        . od_pages_figures($examples, 4)
    ) . "\n";
}

/**
 * `/materials/led-board-roliki/` — Figma `social-video` (`1012:11084`).
 *
 * Ten clips, each already the mock's card: the video on the left, «Скачать в
 * формате mp4» and the two aspect ratios on the right. Three things change.
 *
 * The separators go — they were the old theme's vertical spacing and there are
 * thirty of them. The «Скачать в формате mp4:» heading becomes a paragraph,
 * because it labels two buttons rather than opening a section. And the clip's
 * name stops being an `h1`: the migrator wrote one per row, so the page ships
 * ten of them, and the page's own title is already the only `h1` a reader gets.
 *
 * The mock's title for the page is «Ролики для световых щитов»; the page and the
 * slug say «светодиодных», which is what the boards are — the same call D6k
 * made on the card that links here.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_led_board_roliki(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $out = '';
    $cards = 0;
    foreach (od_pages_asset_rows($content) as $row) {
        if (count($row) !== 2 || $row[0]['embeds'] === [] || count($row[1]['buttons']) !== 2) {
            continue;
        }

        $out .= od_pages_asset_card(
            od_pages_columns([
                [
                    'width' => '66.67%',
                    'blocks' => od_pages_heading(3, $row[0]['headings'][0] ?? '') . od_pages_kinescope($row[0]['embeds'][0]),
                ],
                [
                    'width' => '33.33%',
                    'blocks' => od_pages_paragraph('Скачать в формате mp4') . od_pages_downloads($row[1]['buttons']),
                ],
            ])
        );
        $cards++;
    }

    if ($cards !== 10) {
        throw new RuntimeException(sprintf('unexpected input: %d clip rows', $cards));
    }

    return rtrim($out) . "\n";
}

/**
 * `/materials/audio-roliki-social-reklama/` — Figma `social-audio`
 * (`1009:10756`).
 *
 * Four spots: the title and the script on the left, a player and the download on
 * the right. **The player is the point of this one.** The mp3 was never
 * migrated — it sits in the body as a raw `[cmsms_audios][cmsms_audio]…` pair
 * left over from the old theme, rendering as its own text, so the page has been
 * showing the file path and no way to play it. The url inside becomes a
 * `core/audio` block, which is what the mock draws.
 *
 * The migrator also left each spot's title as a bare `<h2>` *inside* the
 * paragraph block rather than a heading of its own; it becomes the card's `h3`.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_audio_roliki(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $out = '';
    $cards = 0;
    foreach (od_pages_asset_rows($content) as $row) {
        if (count($row) !== 2 || $row[0]['headings'] === [] || $row[1]['buttons'] === [] || $row[1]['audio'] === '') {
            continue;
        }

        $prose = '';
        foreach ($row[0]['texts'] as $paragraph) {
            $prose .= od_pages_paragraph($paragraph);
        }

        $out .= od_pages_asset_card(
            od_pages_columns([
                ['width' => '66.67%', 'blocks' => od_pages_heading(3, $row[0]['headings'][0]) . $prose],
                [
                    'width' => '33.33%',
                    'blocks' => od_pages_audio($row[1]['audio'])
                        . od_pages_downloads([['href' => $row[1]['buttons'][0]['href'], 'label' => 'Скачать аудио-ролик']]),
                ],
            ])
        );
        $cards++;
    }

    if ($cards !== 4) {
        throw new RuntimeException(sprintf('unexpected input: %d audio rows', $cards));
    }

    return rtrim($out) . "\n";
}

/**
 * `/materials/autosticker/` — Figma `car sticker` (`966:8388`).
 *
 * Seven stickers, each already three columns: the artwork, then the two sizes
 * it is printed at with a photo of a car wearing it and a download under each.
 * The mock draws exactly that, so the row becomes a card and the headings that
 * sat *above* each picture become the captions the mock puts below them.
 *
 * They were `h1`s — the migrator wrote one per column, so the page shipped
 * twenty-one of them under a title that is already its only first-level
 * heading. As captions they stop being headings at all.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_autosticker(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $out = '';
    $cards = 0;
    foreach (od_pages_asset_rows($content) as $row) {
        if (count($row) !== 3) {
            continue;
        }

        $columns = [];
        foreach ($row as $column) {
            if ($column['images'] === []) {
                continue 2;
            }
            $blocks = od_pages_asset_image($column['images'][0], od_pages_spaced_unit($column['headings'][0] ?? ''));
            if ($column['buttons'] !== []) {
                $blocks .= od_pages_downloads([['href' => $column['buttons'][0]['href'], 'label' => OD_ASSET_DOWNLOAD]]);
            }
            $columns[] = ['width' => '33.33%', 'blocks' => $blocks];
        }

        $out .= od_pages_asset_card(od_pages_columns($columns));
        $cards++;
    }

    if ($cards !== 7) {
        throw new RuntimeException(sprintf('unexpected input: %d sticker rows', $cards));
    }

    return rtrim($out) . "\n";
}

/** «1130х745мм» → «1130х745 мм». A number and its unit take a space between. */
function od_pages_spaced_unit(string $caption): string
{
    return preg_replace('~(\d)\s*мм~u', '$1 мм', $caption);
}

/**
 * `/materials/zakladki/` — no frame of its own; built on the card the rest of
 * the section uses.
 *
 * Nine bookmarks and **one** download for all of them — a single `.cdr` with
 * the lot in it, which is why this is one card holding a gallery rather than
 * nine cards holding one picture each. The intro paragraph stays outside it:
 * it introduces the page, not the file.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_zakladki(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $intro = '';
    $images = [];
    $buttons = [];

    foreach (od_pages_asset_rows($content) as $row) {
        foreach ($row as $column) {
            foreach ($column['images'] as $image) {
                $images[] = $image;
            }
            foreach ($column['buttons'] as $button) {
                $buttons[] = $button;
            }
            foreach ($column['texts'] as $text) {
                $intro = $intro === '' ? $text : $intro;
            }
        }
    }

    if (count($images) !== 9 || count($buttons) !== 1 || $intro === '') {
        throw new RuntimeException(sprintf('unexpected input: %d bookmarks, %d buttons', count($images), count($buttons)));
    }

    return rtrim(
        od_pages_paragraph($intro)
        . od_pages_asset_card(od_pages_figures($images, 4) . od_pages_downloads([$buttons[0]]))
    ) . "\n";
}

/**
 * `/materials/booklet/` — Figma `flyers` (`966:7747`).
 *
 * Three cards under the page's own two headings: the pair of A5 flyers that
 * share one file, the «Твои ответные санкции» flyer with its two sides, and the
 * booklet with its two sides. The mock replaces the headings with a
 * «Все / Листовки / Буклеты» tab strip; the headings ship instead, because a
 * filter over three cards is a control to build and maintain for nothing, and
 * the mock's own tabs are decoration on a page that shows everything anyway.
 *
 * The «Сторона А» / «Сторона Б» labels were paragraphs floating above their
 * pictures and become the pictures' captions, the same as «Примеры
 * использования» elsewhere in the section.
 *
 * The accordion at the foot goes through {@see od_details_to_profile_link()} —
 * the same coordinator, the same card, as `/materials/metodichki/`.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_booklet(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $sections = [];
    $cards = [];

    foreach (od_pages_asset_rows($content) as $row) {
        $heading = $row[0]['headings'][0] ?? '';
        if (count($row) === 1 && $heading !== '' && $row[0]['images'] === []) {
            $sections[] = ['title' => $heading, 'cards' => count($cards)];
            continue;
        }

        $columns = [];
        $download = null;
        foreach ($row as $column) {
            if ($column['images'] === []) {
                continue;
            }
            if ($column['buttons'] !== []) {
                $download = $column['buttons'][0];
            }
            $columns[] = [
                'width' => $column['sides'] === '' ? '50%' : '25%',
                'blocks' => od_pages_asset_image($column['images'][0], $column['sides']),
            ];
        }

        if ($columns === [] || $download === null) {
            continue;
        }

        $cards[] = od_pages_columns($columns)
            . od_pages_downloads([['href' => $download['href'], 'label' => OD_ASSET_DOWNLOAD]]);
    }

    if (count($sections) !== 2 || count($cards) !== 3) {
        throw new RuntimeException(sprintf('unexpected input: %d headings, %d cards', count($sections), count($cards)));
    }

    $out = '';
    foreach ($sections as $index => $section) {
        $out .= od_pages_heading(2, $section['title']);
        $next = $sections[$index + 1]['cards'] ?? count($cards);
        foreach (array_slice($cards, $section['cards'], $next - $section['cards']) as $card) {
            $out .= od_pages_asset_card($card);
        }
    }

    return rtrim($out . od_pages_contact_block($content)) . "\n";
}

/**
 * The «Заказать листовки и буклеты» accordion, as the heading and profile link
 * {@see od_details_to_profile_link()} makes of it — read off the original body,
 * because everything else on this page is rebuilt from scratch.
 */
function od_pages_contact_block(string $content): string
{
    if (!preg_match('~<!--\s*wp:details\b.*?<!--\s*/wp:details\s*-->~s', $content, $found)) {
        return '';
    }

    return "\n" . od_details_to_profile_link($found[0], OD_METODICHKI_COORDINATOR_HREF, OD_METODICHKI_COORDINATOR_NAME) . "\n";
}

/**
 * `/materials/disk/` — Figma `disks` (`966:8062`).
 *
 * Four discs. Unlike the rest of the section these carry a paragraph of real
 * prose each, so the card holds the thing you download — the disc and its
 * button — and the description sits beside it on the page, which is what the
 * frame draws and the rule the section follows: **the card is around the
 * asset**, and prose long enough to read is not part of it.
 *
 * The «Добавить в корзину» link under every button goes. It is what is left of
 * the WooCommerce shop, and the shop's four pages were deleted in WordPress on
 * 2026-08-17 — the link points at `/materials/disk/?add-to-cart=19772`, which
 * now does nothing. It is also the only reason this page was on the legacy
 * embed list, so the entry goes with it.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_disk(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $discs = [];
    foreach (od_pages_asset_rows($content) as $row) {
        if (count($row) !== 1) {
            continue;
        }
        $column = $row[0];

        if ($column['images'] !== [] && $column['headings'] !== []) {
            $discs[] = ['title' => $column['headings'][0], 'cover' => $column['images'][0], 'texts' => $column['texts']];
            continue;
        }
        if ($column['buttons'] !== [] && $discs !== []) {
            $discs[count($discs) - 1]['download'] = $column['buttons'][0];
        }
    }

    $out = '';
    foreach ($discs as $disc) {
        if (!isset($disc['download'])) {
            throw new RuntimeException(sprintf('unexpected input: «%s» has no download', $disc['title']));
        }

        $prose = od_pages_heading(3, $disc['title']);
        foreach ($disc['texts'] as $paragraph) {
            $prose .= od_pages_paragraph($paragraph);
        }

        $out .= od_pages_columns([
            [
                'width' => '33.33%',
                'blocks' => od_pages_asset_card(
                    od_pages_asset_image($disc['cover'])
                    . od_pages_downloads([['href' => $disc['download']['href'], 'label' => 'Скачать образ диска']])
                ),
            ],
            ['width' => '66.67%', 'blocks' => $prose],
        ]) . "\n";
    }

    if (count($discs) !== 4) {
        throw new RuntimeException(sprintf('unexpected input: %d discs', count($discs)));
    }

    return rtrim($out) . "\n";
}

/**
 * `/materials/books/` — Figma `books` (`966:6650`).
 *
 * Two books, each a long pitch with the film's trailer under it and a list of
 * where to buy the thing beside it. The same call as `/materials/disk/`: the
 * card is around the asset — here the cover and the shops — and the prose reads
 * on the page.
 *
 * The page stores that aside as one `core/paragraph` block holding raw
 * `<h3>`s, a cover `<img>` that never became a `wp:image`, and three
 * dash-and-`<br>` lists. All of it comes apart into the blocks it should have
 * been: a heading per city and a `core/list` under each, with every shop's link
 * kept as it was written.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $filmTagId Unused: this page carries no film row.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_books(string $content, int $filmTagId): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $books = [];
    foreach (od_pages_asset_rows($content) as $row) {
        if (count($row) === 1 && $row[0]['headings'] !== [] && $row[0]['images'] === []) {
            $books[] = ['title' => $row[0]['headings'][0], 'texts' => [], 'embeds' => [], 'aside' => ''];
            continue;
        }
        if (count($row) !== 2 || $books === []) {
            continue;
        }

        $book = count($books) - 1;
        $books[$book]['texts'] = $row[0]['texts'];
        $books[$book]['embeds'] = $row[0]['embeds'];
        $books[$book]['aside'] = $row[1]['raw'];
    }

    if (count($books) !== 2) {
        throw new RuntimeException(sprintf('unexpected input: %d books', count($books)));
    }

    $out = '';
    foreach ($books as $book) {
        $prose = '';
        foreach ($book['texts'] as $paragraph) {
            $prose .= od_pages_paragraph($paragraph);
        }
        foreach ($book['embeds'] as $embed) {
            $prose .= od_pages_kinescope($embed);
        }

        $out .= od_pages_heading(2, $book['title'])
            . od_pages_columns([
                ['width' => '66.67%', 'blocks' => $prose],
                ['width' => '33.33%', 'blocks' => od_pages_asset_card(od_pages_shop_list($book['aside']))],
            ])
            . "\n";
    }

    return rtrim($out) . "\n";
}

/**
 * The «где купить» aside of `/materials/books/`, as blocks.
 *
 * The cover is a bare `<img>` with a `wp-image-NNN` class rather than a
 * `wp:image` block — the migrator left it inside a paragraph — so the id comes
 * off the class. Everything after it is `<h3>` followed by a paragraph of
 * `- shop;<br>` lines.
 */
function od_pages_shop_list(string $aside): string
{
    $out = '';

    if (preg_match('~<img[^>]*\bwp-image-(\d+)[^>]*\bsrc="([^"]+)"~', $aside, $cover)) {
        $out .= od_pages_asset_image(['id' => $cover[1], 'src' => $cover[2], 'href' => '']);
    }

    preg_match_all('~<h3>(.*?)</h3>\s*<p>(.*?)</p>~s', $aside, $blocks, PREG_SET_ORDER);
    foreach ($blocks as $block) {
        $items = '';
        foreach (preg_split('~<br\s*/?>~i', $block[2]) as $line) {
            $item = trim(preg_replace('~^\s*[-–—]\s*~u', '', trim($line)));
            // The trailing «;» is sometimes inside the shop's own link
            // («Библио-Глобус;»), so it cannot just be trimmed off the end.
            $item = preg_replace('~[;.]\s*(</a>)?\s*$~u', '$1', od_pages_inline_text($item));
            if ($item !== '') {
                $items .= sprintf("<!-- wp:list-item -->\n<li>%s</li>\n<!-- /wp:list-item -->\n", $item);
            }
        }
        if ($items === '') {
            continue;
        }

        $out .= od_pages_heading(3, rtrim(od_pages_inline_text($block[1]), ':'))
            . "<!-- wp:list -->\n<ul class=\"wp-block-list\">\n" . $items . "</ul>\n<!-- /wp:list -->\n\n";
    }

    return $out;
}

/**
 * The post-card pages under `/about/` — Figma `Letters-of-appreciation`
 * (`706:3602`).
 *
 * Seven pages share one shape: a `core/query` over a single category, a
 * `[cmsms_sidebar]` beside it, a MailPoet form whose plugin is gone and a
 * `<style>` block that sizes the old theme's thumbnails. Only the query is
 * content, so it is all this keeps.
 *
 * The query itself is copied through **verbatim** — its `queryId` and its
 * category id differ per page and per environment, and neither is ours to
 * decide. What changes is the template inside it: three columns instead of one,
 * the date dropped (the mock shows none), and an `od-post-cards` class for
 * `gutenberg.css` to key the card on. That class is also the idempotency mark.
 *
 * The pagination arrows are core's `chevron` with `showLabel` off, which is the
 * mock's two round chips — «Предыдущая страница» spelled out would be a
 * 200px-wide link where the design has a 36px circle. Both attributes go on the
 * **parent** `core/query-pagination`: it is what provides them as context, and
 * the same keys written on the previous/next blocks are read by nobody.
 *
 * Scoping matters here. ~80 regional `/contacts/*` pages carry a `wp:query`
 * too, so the card rules hang off `od-post-cards` rather than off
 * `.wp-block-post-template` — a bare rule would restyle all of them.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $_filmTagId Unused: these pages carry no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page carries no query block.
 */
function od_pages_post_cards(string $content, int $_filmTagId = 0): string
{
    if (strpos($content, 'od-post-cards') !== false) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    if (!preg_match('/<!-- wp:query (\{.*?\}) -->/s', $content, $m)) {
        throw new RuntimeException('unexpected input: no query block');
    }

    $attrs = json_decode($m[1], true);
    if (!is_array($attrs) || !isset($attrs['queryId'], $attrs['query'])) {
        throw new RuntimeException('unexpected input: unreadable query attributes');
    }

    $attrs['className'] = 'od-post-cards';

    return sprintf("<!-- wp:query %s -->\n<div class=\"wp-block-query od-post-cards\">\n", od_pages_json($attrs))
        . "<!-- wp:post-template {\"layout\":{\"type\":\"grid\",\"columnCount\":3}} -->\n"
        . "<!-- wp:post-featured-image {\"isLink\":true} /-->\n"
        . "<!-- wp:post-title {\"isLink\":true} /-->\n"
        . "<!-- wp:post-excerpt /-->\n"
        . "<!-- /wp:post-template -->\n\n"
        . "<!-- wp:query-pagination {\"paginationArrow\":\"chevron\",\"showLabel\":false} -->\n"
        . "<!-- wp:query-pagination-previous /-->\n"
        . "<!-- wp:query-pagination-numbers /-->\n"
        . "<!-- wp:query-pagination-next /-->\n"
        . "<!-- /wp:query-pagination -->\n"
        . "</div>\n<!-- /wp:query -->\n";
}

/**
 * `/about/experts-review/` and `/about/docs/` — Figma `documents` (`706:3499`).
 *
 * Two pages, one shape: a document's name in a 75 % column and a download
 * button in the 25 % one, that pair repeated behind a separator — 33 expert
 * opinions on one page, 23 statutory documents on the other. They become the
 * mock's three-up grid of cards, on the `od-asset` card the `/materials/` pages
 * already use, with `od-assets--3` for the third track.
 *
 * **The mock's page preview is not built, because there is nothing to build it
 * from.** Each card in Figma is a 387 × 544 image of the PDF's first page. All
 * 33 files on `/about/experts-review/` live on Yandex Disk, not in the library;
 * the 23 on `/about/docs/` are local, but WordPress generated no preview for
 * any of the install's 49 PDF attachments (none carries
 * `_wp_attachment_metadata`). A placeholder repeated 56 times is noise, so the
 * card is its title and its button — which is the rest of what the mock draws.
 *
 * The button is `is-style-outline` and reads «Скачать» on every card, both as
 * drawn. The stored labels are «Скачать устав», «Скачать отчёт» and
 * «Смотреть/Скачать», which said what the button did when it was the only thing
 * on the row; above a title in a card, the noun is already there.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $_filmTagId Unused: these pages carry no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_documents(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-asset')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $documents = od_pages_document_rows($content);
    if (count($documents) < 2) {
        throw new RuntimeException(sprintf('unexpected input: %d document rows', count($documents)));
    }

    $cards = [];
    foreach ($documents as $document) {
        $cards[] = od_pages_paragraph($document['title'])
            . od_pages_downloads([['href' => $document['href'], 'label' => 'Скачать']], 'is-style-outline');
    }

    return rtrim(od_pages_assets($cards, 3, 'od-assets od-assets--3')) . "\n";
}

/**
 * The document rows of a `documents` page: every `core/columns` whose first
 * column holds a name and whose second holds one link.
 *
 * The two pages split their row differently — 75/25 on
 * `/about/experts-review/`, 66.67/33.33 on `/about/docs/` — so the widths are
 * matched loosely and the shape is what identifies a row.
 *
 * @return array<int, array{title: string, href: string}>
 */
function od_pages_document_rows(string $content): array
{
    $pattern = '#<!-- wp:column \{"width":"(?:75|66\.67)%"\}.*?<p[^>]*>(.*?)</p>'
        . '.*?<!-- wp:column \{"width":"(?:25|33\.33)%"\}.*?href="([^"]+)"#s';

    if (!preg_match_all($pattern, $content, $matches, PREG_SET_ORDER)) {
        return [];
    }

    $rows = [];
    foreach ($matches as $match) {
        $title = od_pages_inline_text(strip_tags($match[1], '<em>'));
        if ($title === '') {
            continue;
        }
        $rows[] = ['title' => $title, 'href' => $match[2]];
    }

    return $rows;
}

/**
 * `/about/activist-stories/` — Figma `story` (`706:3568`).
 *
 * Twenty-five videos, each beside a sentence naming the person in it. The
 * stored page already pairs them in a 50/50 `core/columns`, but the halves
 * alternate — thirteen rows put the video first and twelve put the text first —
 * which reads as a mistake rather than a rhythm, and the mock draws the video
 * on the left every time. So the pair is rebuilt in that order.
 *
 * The sentence is split where it already is: the person's name is the row's
 * `<strong>`, what follows is what they say or do. The mock sets the two as a
 * heading and a paragraph, so that is what they become — which also drops the
 * dash the stored text uses to join them («Свиридов Алексей Владимирович –
 * режиссёр…»), leaving the description to start as its own sentence. One row of
 * the twenty-five has no dash at all («Пастухов Сергей родом из Магадана»),
 * which is why the split is on the tag and not on the punctuation.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $_filmTagId Unused: this page carries no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_activist_stories(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-story')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $stories = od_pages_story_rows($content);
    if (count($stories) < 2) {
        throw new RuntimeException(sprintf('unexpected input: %d story rows', count($stories)));
    }

    $out = '';
    foreach ($stories as $story) {
        $out .= "<!-- wp:columns {\"className\":\"od-story\"} -->\n<div class=\"wp-block-columns od-story\">"
            . "<!-- wp:column -->\n<div class=\"wp-block-column\">\n"
            . od_pages_embed($story['url'])
            . "</div>\n<!-- /wp:column -->\n"
            . "<!-- wp:column -->\n<div class=\"wp-block-column\">\n"
            . od_pages_heading(3, $story['name'])
            . od_pages_paragraph($story['about'])
            . "</div>\n<!-- /wp:column -->\n"
            . "</div>\n<!-- /wp:columns -->\n\n";
    }

    return rtrim($out) . "\n";
}

/**
 * The video/sentence pairs of `/about/activist-stories/`, in document order and
 * regardless of which half of the row each sits in.
 *
 * @return array<int, array{url: string, name: string, about: string}>
 */
function od_pages_story_rows(string $content): array
{
    if (!preg_match_all('#<!-- wp:columns -->(.*?)<!-- /wp:columns -->#s', $content, $matches)) {
        return [];
    }

    $rows = [];
    foreach ($matches[1] as $row) {
        if (
            !preg_match('#<!-- wp:embed \{"url":"(.*?)"#', $row, $embed)
            || !preg_match('#<strong>(.*?)</strong>(.*?)</p>#s', $row, $text)
        ) {
            continue;
        }

        $about = od_pages_inline_text(strip_tags($text[2]));
        // The joining dash and any space around it, multibyte-safe: `ltrim()`
        // takes a byte list and would eat the lead byte of a Cyrillic letter.
        $about = preg_replace('/^[\s\x{00a0}–—-]+/u', '', $about);

        $rows[] = [
            'url' => str_replace('\\/', '/', $embed[1]),
            'name' => od_pages_inline_text(strip_tags($text[1])),
            'about' => od_pages_sentence_case($about),
        ];
    }

    return $rows;
}

/**
 * First letter upper-cased, the rest left alone — `ucfirst()` is byte-wise and
 * would corrupt a Cyrillic first character.
 */
function od_pages_sentence_case(string $text): string
{
    if ($text === '') {
        return $text;
    }

    return mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1);
}

/**
 * A `core/embed`, in the shape WordPress stores one: the bare URL on its own
 * line, and the provider read back out of it at render time.
 */
function od_pages_embed(string $url): string
{
    return sprintf(
        "<!-- wp:embed {\"url\":\"%s\",\"type\":\"video\",\"providerNameSlug\":\"youtube\",\"responsive\":true,"
        . "\"className\":\"wp-embed-aspect-16-9 wp-has-aspect-ratio\"} -->\n"
        . "<figure class=\"wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube "
        . "wp-embed-aspect-16-9 wp-has-aspect-ratio\"><div class=\"wp-block-embed__wrapper\">\n%s\n</div></figure>\n"
        . "<!-- /wp:embed -->\n",
        od_attr($url),
        $url
    );
}

/**
 * `/about/udostoverenie/` — Figma `Certificate` (`760:1662`).
 *
 * The page is one `wp:paragraph` block holding six `<p>`s and a floated photo,
 * plus an `<h2>` with a download link. The mock reads them as four things: the
 * photo as a hero, the first sentence as a lead, the rest as the body, and — in
 * a 386-wide rail beside it — the «свяжитесь с нами» sentence with the two
 * contacts under it, then «Положение о членстве» with its button.
 *
 * **The contact sentence is split, not moved whole.** The stored paragraph runs
 * the note and the contacts together («…для подтверждения по телефону +7 (962)
 * 950-75-61 E-mail: post27@bk.ru Skype: aleksey.od»); the mock ends the note at
 * «для подтверждения.» and sets the phone and the mail as two icon rows. Skype
 * is dropped — the mock draws two rows, and the account has not been reachable
 * since Skype closed.
 *
 * **The hero is not the mock's 1241 × 508.** The library holds this photo at
 * 600 × 445 and nothing larger, so that band would be a 2× upscale of a
 * photograph of a document. It is drawn at the mock's *height* instead, 508
 * with the width following, which is a 1.14× upscale and keeps it sharp.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $_filmTagId Unused: this page carries no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_udostoverenie(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-hero')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    if (!preg_match('#<img[^>]*wp-image-(\d+)[^>]*src="([^"]+)"#', $content, $photo)) {
        throw new RuntimeException('unexpected input: no photo');
    }

    preg_match_all('#<p[^>]*>(.*?)</p>#s', $content, $found);
    $paragraphs = [];
    foreach ($found[1] as $paragraph) {
        $text = od_pages_inline_text(preg_replace('#<img[^>]*>#', '', $paragraph));
        // `[wysija_form]` is the MailPoet form whose plugin is gone; every other
        // page in this file drops it too.
        if ($text !== '' && $text !== '&nbsp;' && strpos($text, '[wysija_form') === false) {
            $paragraphs[] = $text;
        }
    }

    if (count($paragraphs) < 6) {
        throw new RuntimeException(sprintf('unexpected input: %d paragraphs', count($paragraphs)));
    }

    $contactIndex = null;
    foreach ($paragraphs as $index => $paragraph) {
        if (strpos($paragraph, 'по телефону') !== false && strpos($paragraph, '@') !== false) {
            $contactIndex = $index;
            break;
        }
    }

    if ($contactIndex === null) {
        throw new RuntimeException('unexpected input: no contact paragraph');
    }

    $contacts = $paragraphs[$contactIndex];
    $note     = rtrim(od_pages_inline_text(strip_tags(substr($contacts, 0, strpos($contacts, ' по телефону')))), " .") . '.';

    if (
        !preg_match('#\+7[\s(]*(\d{3})[\s)]*(\d{3})-(\d{2})-(\d{2})#u', $contacts, $phone)
        || !preg_match('#mailto:([^"]+)"#', $contacts, $mail)
        || !preg_match('#<h2[^>]*>\s*(.*?):\s*<a href="([^"]+)"#s', $content, $membership)
    ) {
        throw new RuntimeException('unexpected input: no contacts or membership link');
    }

    $body = '';
    foreach ($paragraphs as $index => $paragraph) {
        if ($index === 0 || $index === $contactIndex) {
            continue;
        }
        $body .= od_pages_paragraph($paragraph);
    }

    $phoneLabel = sprintf('+7 (%s) %s-%s-%s', $phone[1], $phone[2], $phone[3], $phone[4]);
    $phoneHref  = sprintf('tel:+7%s%s%s%s', $phone[1], $phone[2], $phone[3], $phone[4]);

    $aside = od_pages_group(
        'od-asset',
        od_pages_paragraph($note)
        . od_pages_contact_row('phone', $phoneHref, $phoneLabel)
        . od_pages_contact_row('email', 'mailto:' . $mail[1], $mail[1])
    ) . od_pages_group(
        'od-asset',
        od_pages_heading(3, od_pages_inline_text(strip_tags($membership[1])))
        . od_pages_downloads([['href' => $membership[2], 'label' => 'Скачать']])
    );

    return "<!-- wp:group {\"className\":\"od-hero\",\"layout\":{\"type\":\"constrained\"}} -->\n"
        . "<div class=\"wp-block-group od-hero\">\n"
        . od_pages_image_block($photo[1], $photo[2], '')
        . "</div>\n<!-- /wp:group -->\n\n"
        . od_pages_columns([
            ['width' => '65.65%', 'blocks' => od_pages_paragraph('<strong>' . $paragraphs[0] . '</strong>') . $body],
            ['width' => '31.13%', 'blocks' => $aside],
        ], 'od-aside')
        . "\n";
}

/**
 * A `core/group` with a class — the shape every card in this file that is not a
 * column of a row takes.
 */
function od_pages_group(string $className, string $blocks): string
{
    return sprintf(
        "<!-- wp:group {\"className\":\"%s\",\"layout\":{\"type\":\"constrained\"}} -->\n<div class=\"wp-block-group %s\">\n",
        $className,
        $className
    ) . $blocks . "</div>\n<!-- /wp:group -->\n\n";
}

/**
 * One contact row: a paragraph that is nothing but the link, classed so
 * `gutenberg.css` can hang the 24px glyph the mock draws in front of it.
 *
 * The glyph is a `mask-image` over `currentColor` rather than a coloured copy of
 * the SVG: the icons are stroked with `currentColor` in
 * `src/shared/ui/assets/icons/`, and a background copy would have to bake the
 * brand red into a file under `public/`.
 */
function od_pages_contact_row(string $kind, string $href, string $label): string
{
    return sprintf(
        "<!-- wp:paragraph {\"className\":\"od-contact od-contact--%s\"} -->\n"
        . "<p class=\"od-contact od-contact--%s\"><a href=\"%s\">%s</a></p>\n<!-- /wp:paragraph -->\n\n",
        $kind,
        $kind,
        od_attr($href),
        od_attr($label)
    );
}

/**
 * The nine sections of the charter, in order, as the mock's contents list names
 * them and as the stored text spells them.
 *
 * `match` is the upper-case string to find in `post_content` — it is what the
 * three shapes the headings arrive in have in common. `title` is what the page
 * shows: Figma sets them sentence-cased, and this is content rather than a
 * `text-transform`, for the reason `docs/wp-page-redesign.md` gives.
 */
const OD_USTAV_SECTIONS = [
    ['id' => 'ustav-1', 'match' => 'ОБЩИЕ ПОЛОЖЕНИЯ', 'title' => 'Общие положения'],
    ['id' => 'ustav-2', 'match' => 'ЦЕЛИ И НАПРАВЛЕНИЯ ДЕЯТЕЛЬНОСТИ ОРГАНИЗАЦИИ. ПРАВА И ОБЯЗАННОСТИ ОРГАНИЗАЦИИ', 'title' => 'Цели и направления деятельности организации. Права и обязанности организации'],
    ['id' => 'ustav-3', 'match' => 'ПРАВА И ОБЯЗАННОСТИ ЧЛЕНОВ ОРГАНИЗАЦИИ', 'title' => 'Права и обязанности членов организации'],
    ['id' => 'ustav-4', 'match' => 'СТРУКТУРА ОРГАНИЗАЦИИ', 'title' => 'Структура организации'],
    ['id' => 'ustav-5', 'match' => 'КОНТРОЛЬНО-РЕВИЗИОННЫЕ ОРГАНЫ ОРГАНИЗАЦИИ', 'title' => 'Контрольно-ревизионные органы организации'],
    ['id' => 'ustav-6', 'match' => 'СРЕДСТВА, ИМУЩЕСТВО И ВЕДЕНИЕ УЧЕТА В ОРГАНИЗАЦИИ', 'title' => 'Средства, имущество и ведение учёта в организации'],
    ['id' => 'ustav-7', 'match' => 'ПРЕДПРИНИМАТЕЛЬСКАЯ ДЕЯТЕЛЬНОСТЬ', 'title' => 'Предпринимательская деятельность'],
    ['id' => 'ustav-8', 'match' => 'ПОРЯДОК РЕОРГАНИЗАЦИИ И ЛИКВИДАЦИИ ОРГАНИЗАЦИИ', 'title' => 'Порядок реорганизации и ликвидации организации'],
    ['id' => 'ustav-9', 'match' => 'ПОРЯДОК ВНЕСЕНИЯ ИЗМЕНЕНИЙ В УСТАВ', 'title' => 'Порядок внесения изменений в устав'],
];

/**
 * `/about/ustav/` — Figma `charter` (`706:3695`).
 *
 * 361 paragraphs in four `wp:paragraph` blocks, with the charter's nine section
 * headings buried in them in **three different shapes**: five as their own
 * numbered paragraph («1. ОБЩИЕ ПОЛОЖЕНИЯ.»), four as a one-item `<ol
 * start="6"><li>`, and the fifth appended to the end of the paragraph before it
 * («…проводимых Организацией. 5. КОНТРОЛЬНО-РЕВИЗИОННЫЕ ОРГАНЫ ОРГАНИЗАЦИИ»).
 * Each is found by its upper-case text and replaced by a marker, which is what
 * makes the three shapes one thing to split on.
 *
 * Out of that comes the mock: a sticky contents list in a 384-wide column and
 * the charter in the 814 beside it, each section an `<h2>` the list links to.
 * Every paragraph becomes a block of its own — the migrator left them as raw
 * `<p>`s inside four blocks, which is one thing to edit rather than 361.
 *
 * **The headings are written sentence-cased**, not lower-cased by CSS: the
 * stored text shouts, Figma does not, and a `text-transform` would be invisible
 * to an editor and to a grep (`docs/wp-page-redesign.md` §4).
 *
 * **The mock draws no «you are here» state on the list** and neither does this:
 * a scrollspy needs JavaScript, and there is none to be had in a WordPress body.
 * The links work; the highlight is the one thing in the frame that is not built.
 *
 * **The «Положение о членстве: Скачать» line at the top goes.** The mock has no
 * such row, and the same document is a card of its own on
 * `/about/udostoverenie/` — see `od_pages_udostoverenie()`.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $_filmTagId Unused: this page carries no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when a section heading cannot be found.
 */
function od_pages_ustav(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-charter')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    $marked = $content;
    foreach (OD_USTAV_SECTIONS as $index => $section) {
        $marked = od_pages_mark_heading($marked, $section['match'], sprintf('@@od-ustav-%d@@', $index));
    }

    $parts = preg_split('/@@od-ustav-(\d+)@@/u', $marked, -1, PREG_SPLIT_DELIM_CAPTURE);
    if (count($parts) !== 2 * count(OD_USTAV_SECTIONS) + 1) {
        throw new RuntimeException(sprintf('unexpected input: %d section boundaries', (count($parts) - 1) / 2));
    }

    $body = '';
    foreach (od_pages_ustav_paragraphs($parts[0]) as $paragraph) {
        // The download row the mock has no place for — `/about/udostoverenie/`
        // carries that document as a card — and the «УСТАВ» line, which is the
        // page title `PageHeader` already draws.
        if (strpos($paragraph, 'Положение о членстве') !== false || strip_tags($paragraph) === 'УСТАВ') {
            continue;
        }
        $body .= od_pages_classed_paragraph($paragraph, 'od-charter-preamble');
    }

    for ($i = 1; $i < count($parts); $i += 2) {
        $section = OD_USTAV_SECTIONS[(int) $parts[$i]];
        $body   .= od_pages_heading(2, $section['title'], $section['id']);
        foreach (od_pages_ustav_paragraphs($parts[$i + 1]) as $paragraph) {
            $body .= od_pages_paragraph($paragraph);
        }
    }

    return od_pages_columns([
        ['width' => '30.97%', 'blocks' => od_pages_ustav_contents()],
        ['width' => '65.65%', 'blocks' => $body],
    ], 'od-charter') . "\n";
}

/**
 * Replace one charter heading, whatever markup it arrived in, with `$marker`.
 *
 * Three shapes, tried in order: the `<ol start="N"><li>` core's list block left,
 * a numbered paragraph of its own, and a heading run onto the end of the
 * paragraph before it — that last one closes the paragraph it was stuck to.
 *
 * @throws RuntimeException when none of the three matches.
 */
function od_pages_mark_heading(string $content, string $heading, string $marker): string
{
    $quoted = preg_quote($heading, '#');

    $patterns = [
        '#<ol[^>]*>\s*<li>\s*' . $quoted . '\.?\s*</li>\s*</ol>#u' => $marker,
        '#<p[^>]*>\s*\d+\.\s*' . $quoted . '\.?\s*</p>#u' => $marker,
        '#\s*\d+\.\s*' . $quoted . '\.?\s*(?=</p>)#u' => '</p>' . $marker . '<p>',
    ];

    foreach ($patterns as $pattern => $replacement) {
        $replaced = preg_replace($pattern, $replacement, $content, 1, $count);
        if ($count === 1) {
            return $replaced;
        }
    }

    throw new RuntimeException(sprintf('unexpected input: heading «%s» not found', $heading));
}

/**
 * The `<p>`s of one slice of the charter, as plain text: the migrator's inline
 * `<span style="font-size: 12pt">` goes, `<em>` and `<strong>` stay.
 *
 * @return array<int, string>
 */
function od_pages_ustav_paragraphs(string $html): array
{
    preg_match_all('#<p[^>]*>(.*?)</p>#s', $html, $found);

    $paragraphs = [];
    foreach ($found[1] as $paragraph) {
        $text = od_pages_inline_text(strip_tags($paragraph, '<em><strong><a><br>'));
        $text = trim(str_replace('&nbsp;', ' ', $text));
        $text = trim(preg_replace('#\s+#u', ' ', $text));
        if ($text !== '') {
            $paragraphs[] = $text;
        }
    }

    return $paragraphs;
}

/**
 * The contents list — a `core/list` of in-page links, which is the mock's column
 * of buttons and, unlike a set of nine `core/button` blocks, still reads as a
 * list of links with nothing but CSS removed.
 */
function od_pages_ustav_contents(): string
{
    $items = '';
    foreach (OD_USTAV_SECTIONS as $section) {
        $items .= sprintf(
            "<!-- wp:list-item -->\n<li><a href=\"#%s\">%s</a></li>\n<!-- /wp:list-item -->\n",
            $section['id'],
            od_attr($section['title'])
        );
    }

    return "<!-- wp:list {\"className\":\"od-charter-contents\"} -->\n"
        . "<ul class=\"wp-block-list od-charter-contents\">\n" . $items . "</ul>\n<!-- /wp:list -->\n";
}

/**
 * A paragraph with a class of its own.
 */
function od_pages_classed_paragraph(string $text, string $className): string
{
    return sprintf(
        "<!-- wp:paragraph {\"className\":\"%s\"} -->\n<p class=\"%s\">%s</p>\n<!-- /wp:paragraph -->\n\n",
        $className,
        $className,
        $text
    );
}

/**
 * `/team/` — the roster, and the eleven records behind it. Figma `team-1`
 * (`706:1584`) and `team-1-mob` (`1256:5981`), D3.
 *
 * Every fact this page states about a person — the role, the phone, the e-mail,
 * the photograph — is stated again in that person's `profile` record. It is the
 * relation `/materials/metodichki/` has with its one coordinator, eleven times
 * over, so it goes the same way: the page keeps one link per person and nothing
 * else, the record keeps the data, and `PersonCard` draws it
 * (`src/modules/WpPage/profileEmbeds.tsx`).
 *
 * **The roster is written here rather than read out of the page, and that is
 * deliberate.** od-dev's copy of this page is stale — it lists 13 people, six of
 * whom are no longer on it, and two of the current eleven are missing. The live
 * site is the roster; this list is production's, read 2026-08-18, and it is the
 * content fix rather than incidental structure.
 *
 * **The role is the half that cannot come from the record as it stands.** A
 * record holds its person's *regional* role — «Координатор по Тульской области» —
 * because that is what the 75 `/contacts/<region>/` pages are about, and the team
 * page is about the same person's federal one. One record, two true answers. So
 * the federal role is *prepended* as the record's new first bold line, which is
 * the line {@see parseProfileBody()} reads, and the regional line stays right
 * under it: `/profile/<slug>/` now states both, and neither page loses anything.
 *
 * **`role` below is therefore both roles, and it is written out rather than
 * composed.** Joining «federal» to «whatever the record bolds first» reads as
 * nonsense on more than half the roster: Калашников's own first bold *is* his
 * federal role, Моисеев's is one of four lines each ending in a comma, Бальцевич's
 * is the first of seven, and five of the eleven bold nothing at all — their role
 * is plain text. Every tail here is quoted from the record it belongs to; the
 * record keeps its own lines untouched underneath, so `/profile/<slug>/` still
 * shows the long form and this is the short one.
 *
 * The same pass gives each record the contacts the team page had and it did not,
 * and canonicalises its phone numbers into `tel:` links — most were plain text,
 * which is why cards drew no phone row (`docs/next-steps.md`).
 */
const OD_TEAM = [
    [
        'name' => 'Варламов Леонид Геннадьевич',
        'href' => '/profile/varlamov/',
        'role' => 'Председатель правления организации, член Межведомственного совета по общественному здоровью Департамента здравоохранения города Москвы, член общественного совета при ФСИН России',
        'contacts' => [
            ['mailto:l.varlamov@obshee-delo.ru', 'l.varlamov@obshee-delo.ru'],
            ['https://vk.com/l.varlamov', 'https://vk.com/l.varlamov'],
        ],
    ],
    [
        'name' => 'Калашников Павел Сергеевич',
        'href' => '/profile/kalashnikov-pavel/',
        'role' => 'Руководитель департамента фандрайзинга, член Наблюдательного совета организации',
        // The one thing `/about/supervisory/` said about him that his record did
        // not; his role is this page's, so the description arrives as prose.
        'prose' => 'Предприниматель, общественный деятель, ведёт здоровый образ жизни, увлекается альпинизмом и каратэ кёкусинкай, отец двоих детей.',
        'contacts' => [
            ['tel:+79251906699', '+7 925 190-66-99'],
            ['mailto:p.kalashnikov@obshee-delo.ru', 'p.kalashnikov@obshee-delo.ru'],
        ],
    ],
    [
        'name' => 'Чагаев Дмитрий Владимирович',
        'href' => '/profile/chagaev/',
        'role' => 'Руководитель департамента по связям с госструктурами',
        'contacts' => [
            ['tel:+79037225329', '+7 903 722-53-29'],
            ['mailto:chagaev@mail.ru', 'chagaev@mail.ru'],
        ],
    ],
    [
        'name' => 'Васильев Михаил Геннадьевич',
        'href' => '/profile/%d0%b2%d0%b0%d1%81%d0%b8%d0%bb%d1%8c%d0%b5%d0%b2-%d0%bc%d0%b8%d1%85%d0%b0%d0%b8%d0%bb-%d0%b3%d0%b5%d0%bd%d0%bd%d0%b0%d0%b4%d1%8c%d0%b5%d0%b2%d0%b8%d1%87/',
        'role' => 'Руководитель департамента по развитию добровольчества, руководитель оргкомитета ежегодного Всероссийского конкурса «Общее дело — ПРО». Руководитель отделения, Псков',
        'contacts' => [
            ['tel:+79113592167', '+7 911 359-21-67'],
            ['mailto:pro@obshee-delo.ru', 'pro@obshee-delo.ru'],
            ['https://vk.com/newpskovregion', 'https://vk.com/newpskovregion'],
        ],
    ],
    [
        'name' => 'Дегтярёв Алексей Анатольевич',
        'href' => '/profile/%d0%b4%d0%b5%d0%b3%d1%82%d1%8f%d1%80%d1%91%d0%b2-%d0%b0%d0%bb%d0%b5%d0%ba%d1%81%d0%b5%d0%b9-%d0%b0%d0%bd%d0%b0%d1%82%d0%be%d0%bb%d1%8c%d0%b5%d0%b2%d0%b8%d1%87/',
        'role' => 'Руководитель медиа департамента. Режиссер, продюсер',
        'contacts' => [
            ['tel:+79629507561', '+7 962 950-75-61'],
            ['mailto:post27@bk.ru', 'post27@bk.ru'],
        ],
    ],
    [
        'name' => 'Моисеев Олег Олегович',
        'href' => '/profile/moiseev-oleg-olegovich/',
        'role' => 'Руководитель департамента профилактики. Руководитель Московского городского отделения',
        'contacts' => [
            ['tel:+79037748061', '+7 903 774-80-61'],
            ['mailto:moiseev_od@mail.ru', 'moiseev_od@mail.ru'],
        ],
    ],
    [
        'name' => 'Бальцевич Вячеслав Павлович',
        'href' => '/profile/baltsevich/',
        'role' => 'Уполномоченный по развитию в УФО. Член Правления организации, председатель СРОО «Общее дело»',
        'contacts' => [
            ['tel:+79826119777', '+7 982 611-97-77'],
            ['tel:+79292211999', '+7 929 221-19-99'],
            ['mailto:baltsevich77@bk.ru', 'baltsevich77@bk.ru'],
        ],
    ],
    [
        'name' => 'Касатиков Александр Юрьевич',
        'href' => '/profile/%d0%ba%d0%b0%d1%81%d0%b0%d1%82%d0%b8%d0%ba%d0%be%d0%b2-%d0%b0%d0%bb%d0%b5%d0%ba%d1%81%d0%b0%d0%bd%d0%b4%d1%80-%d1%8e%d1%80%d1%8c%d0%b5%d0%b2%d0%b8%d1%87/',
        'role' => 'Уполномоченный по развитию в ЦФО. Координатор по Тульской области',
        'contacts' => [
            ['tel:+79030377708', '+7 903 037-77-08'],
            ['mailto:SilaOtechestva@mail.ru', 'SilaOtechestva@mail.ru'],
        ],
    ],
    [
        'name' => 'Панферова Анна Андреевна',
        'href' => '/profile/panferova-anna-andreevna/',
        'role' => 'Первый заместитель Уполномоченного по развитию в ЦФО',
        'contacts' => [
            ['tel:+79653536761', '+7 965 353-67-61'],
            ['mailto:anyapan88@yandex.ru', 'anyapan88@yandex.ru'],
        ],
    ],
    [
        'name' => 'Тарасов Сергей Валентинович',
        'href' => '/profile/%d1%82%d0%b0%d1%80%d0%b0%d1%81%d0%be%d0%b2-%d1%81%d0%b5%d1%80%d0%b3%d0%b5%d0%b9-%d0%b2%d0%b0%d0%bb%d0%b5%d0%bd%d1%82%d0%b8%d0%bd%d0%be%d0%b2%d0%b8%d1%87/',
        'role' => 'Заместитель руководителя департамента информационной политики и комплексной безопасности. Координатор по Кингисеппскому, Сланцевскому, Волосовскому району',
        'contacts' => [
            ['tel:+79062755758', '+7 906 275-57-58'],
            ['mailto:politbez_od@mail.ru', 'politbez_od@mail.ru'],
        ],
    ],
    [
        'name' => 'Чернов Евгений Павлович',
        'href' => '/profile/%d1%87%d0%b5%d1%80%d0%bd%d0%be%d0%b2-%d0%b5%d0%b2%d0%b3%d0%b5%d0%bd%d0%b8%d0%b9-%d0%bf%d0%b0%d0%b2%d0%bb%d0%be%d0%b2%d0%b8%d1%87/',
        'role' => 'Руководитель департамента информационной политики и комплексной безопасности. Региональный координатор по развитию добровольчества в Ленинградской области',
        'contacts' => [
            ['tel:+79111620252', '+7 911 162-02-52'],
            ['mailto:politbez@obshee-delo.ru', 'politbez@obshee-delo.ru'],
        ],
    ],
];

/**
 * `/profile/<slug>/` → `<slug>`, the form `get_page_by_path()` takes.
 *
 * Left percent-encoded when that is how the record spells it: `get_page_by_path()`
 * round-trips the string through `urldecode`/`rawurlencode` and `post_name` is
 * stored in a case-insensitive collation, so the lowercase hex the content
 * carries matches the uppercase hex WordPress builds.
 */
function od_profile_slug(string $href): string
{
    $segments = explode('/', trim($href, '/'));

    return (string) end($segments);
}

/**
 * `/team/` — the page itself: eleven profile links in one grid, and nothing else.
 *
 * Dropped: the `<h1>`, because the route draws the page title itself; the
 * `wp:html` block holding the old theme's `.team-member` CSS; and the grey
 * rounded boxes that CSS styled. What replaces them is `od-team`, the class both
 * `gutenberg.css` (the two-column grid) and `profileEmbeds.tsx` (draw these cards
 * with a portrait) key on.
 *
 * @param string $content    Stored `post_content`.
 * @param int    $_filmTagId Unused — see {@see od_pages_metodichki()}.
 * @throws RuntimeException when the page is neither converted nor the shape this
 *                          converts.
 */
function od_pages_team(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-team')) {
        return $content;
    }

    if (!str_contains($content, 'team-member')) {
        throw new RuntimeException('no `.team-member` boxes — not the shape this converts');
    }

    return rtrim(od_pages_profile_grid(OD_TEAM));
}

/**
 * `+7 (903) 037-77-08` → `tel:+79030377708`, or `''` when the text is not a
 * Russian phone number.
 *
 * Eleven digits beginning `7` or `8` — the one shape every number in these
 * records has, and a strict enough test that a year or a house number in the
 * prose beside them cannot pass it.
 */
function od_tel_href(string $text): string
{
    $digits = preg_replace('~\D+~', '', $text);

    if (strlen($digits) !== 11 || !in_array($digits[0], ['7', '8'], true)) {
        return '';
    }

    return 'tel:+7' . substr($digits, 1);
}

/**
 * `+79062755758` → `+7 906 275-57-58` — a number stored as one run of digits, in
 * the grouping the mock and most of the corpus use.
 *
 * Only that case. A number an editor has already grouped — `+7 (962) 950-75-61`,
 * `8-903-774-8061` — keeps its own spelling, because that spelling is a choice and
 * a bare run of eleven digits is the absence of one.
 */
function od_tel_label(string $text): string
{
    $trimmed = trim($text);

    if (!preg_match('~^\+?\d{11}$~', $trimmed)) {
        return $text;
    }

    $digits = preg_replace('~\D+~', '', $trimmed);

    return sprintf(
        '+7 %s %s-%s-%s',
        substr($digits, 1, 3),
        substr($digits, 4, 3),
        substr($digits, 7, 2),
        substr($digits, 9, 2)
    );
}

/**
 * `/about/nashi_partnery/` — no mock; the section's own picture grid.
 *
 * Fifty-two 25 % columns of a logo over its name, separated by 41 `<hr>`s and
 * led by three empty spacer groups — so the page opened on a screenful of
 * nothing and every fourth logo sat under a stray rule. It becomes the
 * `od-figures` grid `/materials/` already uses, four across, with the name as
 * the picture's own `figcaption` so it travels with it.
 *
 * `od-figures--logos` is the one thing that is new: these are logos on white,
 * not photographs, so the box holds them whole (`contain`) rather than filling
 * it, which is what `/materials/sticker/`'s photos want.
 *
 * Six of the 49 logos carry no name and two name files that are not on the
 * origin — both are content, and both are left as they are rather than guessed
 * at here.
 *
 * @param string $content   Stored `post_content`.
 * @param int    $_filmTagId Unused: this page carries no film row.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_partners(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-figures--logos')) {
        return $content; // Already converted — leave the editor's copy alone.
    }

    preg_match_all('#<!-- wp:column \{"width":"25%"\}(.*?)<!-- /wp:column -->#s', $content, $found);

    $logos = [];
    foreach ($found[1] as $column) {
        if (!preg_match('#<img[^>]*src="([^"]+)"#', $column, $image)) {
            continue;
        }
        preg_match('#<p[^>]*>(.*?)</p>#s', $column, $caption);
        $logos[] = [
            'src' => $image[1],
            'caption' => isset($caption[1]) ? od_pages_inline_text(strip_tags($caption[1])) : '',
        ];
    }

    if (count($logos) < 2) {
        throw new RuntimeException(sprintf('unexpected input: %d partner logos', count($logos)));
    }

    $out   = '';
    $class = 'od-figures od-figures--4 od-figures--logos';

    foreach (array_chunk($logos, 4) as $row) {
        $out .= sprintf("<!-- wp:columns {\"className\":\"%s\"} -->\n<div class=\"wp-block-columns %s\">", $class, $class);
        foreach ($row as $logo) {
            $out .= "<!-- wp:column -->\n<div class=\"wp-block-column\">\n"
                . od_pages_asset_image(['id' => '0', 'src' => $logo['src'], 'href' => ''], $logo['caption'])
                . "</div>\n<!-- /wp:column -->\n";
        }
        $out .= "</div>\n<!-- /wp:columns -->\n\n";
    }

    return rtrim($out) . "\n";
}

/**
 * Block attributes as WordPress writes them: no escaped slashes, no unicode
 * escapes, and the key order the block had.
 */
function od_pages_json(array $attrs): string
{
    return json_encode($attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

/**
 * Every phone number in a `profile` body as one `tel:` link, spelled one way.
 *
 * Two halves, and both are needed by the third caller downstream. Existing
 * `tel:` hrefs are rewritten to the digits-only form, because a record that
 * writes `tel:+7-903-722-53-29` and a merge that offers `tel:+79037225329` are
 * the same number and would otherwise both end up on the card. Then plain-text
 * numbers — 92 of the 139 records write them that way, which is why their cards
 * drew no phone row at all — become links.
 *
 * Both halves also pass their **visible** text through {@see od_tel_label()}, so
 * a number stored as one run of digits reads as a number on the card. The label
 * has to be fixed on the way past an existing link too, not only on the way in:
 * a record linked by an earlier run of this script is the common case, and its
 * text is inside the anchor where the plain-text pass will never look again.
 *
 * The split keeps whole anchors and every tag as delimiters, so only text
 * *outside* markup is rewritten: a number already linked is left alone, and one
 * inside an attribute is never seen.
 */
function od_canonical_tel_links(string $content): string
{
    $content = preg_replace_callback(
        '~<a\b([^>]*)href="tel:([^"]*)"([^>]*)>([^<]*)</a>~i',
        static function (array $m): string {
            $href = od_tel_href($m[2]);

            return $href === ''
                ? $m[0]
                : '<a' . $m[1] . 'href="' . $href . '"' . $m[3] . '>' . od_tel_label($m[4]) . '</a>';
        },
        $content
    );

    $parts = preg_split('~(<a\b[^>]*>.*?</a>|<[^>]+>)~si', $content, -1, PREG_SPLIT_DELIM_CAPTURE);

    foreach ($parts as $i => $part) {
        if ($i % 2 === 1 || (!str_contains($part, '7') && !str_contains($part, '8'))) {
            continue;
        }

        $parts[$i] = preg_replace_callback(
            '~(?<![\d\-])(?:\+7|8)[\s\-()]*\d[\d\s\-()]{7,}\d~u',
            static function (array $m): string {
                $href = od_tel_href($m[0]);

                return $href === '' ? $m[0] : '<a href="' . $href . '">' . od_tel_label($m[0]) . '</a>';
            },
            $part
        );
    }

    return implode('', $parts);
}

/**
 * The team role and the team page's contacts, as the record's **first** lines.
 *
 * First, not appended, and that is the point: {@see parseProfileBody()} reads the
 * body's first bold line as the role and takes contacts in document order, so a
 * card leads with whatever the record leads with. Several of these records lead
 * with a contact that has not been current since 2017.
 *
 * A line already there is not written twice, which is what makes a re-run a
 * no-op — and a bold-only line this script wrote *before*, whose text the current
 * role begins with, is rewritten in place rather than joined by a second one.
 *
 * @param array<int, array{0: string, 1: string}> $contacts href, label.
 * @throws RuntimeException when the record has no paragraph block to lead.
 */
function od_prepend_profile_lead(string $content, string $role, array $contacts): string
{
    $line = '<p><strong>' . $role . '</strong></p>';

    if (!str_contains($content, $line)) {
        // An earlier run may have written a **shorter** role — the federal half,
        // before the record's own regional line was merged into it. Rewrite that
        // paragraph instead of stacking a second one above it, which would leave
        // the card right and the body carrying both halves separately. Only a
        // bold-*only* paragraph qualifies, which is the shape this writes and
        // never the shape a record's own role line has.
        $content = preg_replace_callback(
            '~<p>\s*<strong>([^<]*)</strong>\s*</p>~',
            static function (array $m) use ($role, $line): string {
                $text = trim($m[1]);

                return $text !== '' && str_starts_with($role, $text) ? $line : $m[0];
            },
            $content,
            1
        );
    }

    $lines = str_contains($content, $line) ? '' : $line . "\n";

    foreach ($contacts as list($href, $label)) {
        if (!str_contains($content, $href)) {
            $lines .= '<p><a href="' . od_attr($href) . '">' . od_attr($label) . '</a></p>' . "\n";
        }
    }

    if ($lines === '') {
        return $content;
    }

    $open = strpos($content, '<!-- wp:paragraph -->');
    if ($open === false) {
        throw new RuntimeException('no `wp:paragraph` block to lead — not the shape this converts');
    }

    return substr_replace($content, "\n" . rtrim($lines), $open + strlen('<!-- wp:paragraph -->'), 0);
}

/**
 * One member's `profile` record: canonical phone links, then the role and the
 * contacts only the page carried, then anything the page said about them that the
 * record did not.
 *
 * @param string                                  $content    Stored `post_content`.
 * @param int                                     $_filmTagId Unused — see {@see od_pages_metodichki()}.
 * @param string                                  $role       The role, from {@see OD_TEAM} or {@see OD_SUPERVISORY}.
 * @param array<int, array{0: string, 1: string}> $contacts   href, label.
 * @param string                                  $prose      A sentence about the person, appended once.
 */
function od_pages_profile_team(string $content, int $_filmTagId, string $role, array $contacts, string $prose = ''): string
{
    $content = od_prepend_profile_lead(od_canonical_tel_links($content), $role, $contacts);

    if ($prose === '' || str_contains($content, $prose)) {
        return $content;
    }

    // At the end of the record's own paragraph block, where a description reads as
    // a description and not as the role line the card takes.
    $closing = strrpos($content, '<!-- /wp:paragraph -->');

    return false === $closing
        ? rtrim($content) . "\n<p>" . $prose . '</p>'
        : substr_replace($content, '<p>' . $prose . "</p>\n", $closing, 0);
}

/**
 * `/about/supervisory/` — the “Наблюдательный совет” tab of the same section,
 * Figma `team-2` (`708:3736`) and `team-2-mob` (`1258:6333`), D3.
 *
 * Three members, and they are listed here for the same reason `OD_TEAM` is: this
 * page proves the point twice over. Production's copy was last edited
 * **2026-04-29** and names three people; od-dev's was last edited **2021-05-10**
 * and names four, Леонид Варламов among them — he has since left the council. The
 * mock draws four as well, because it was traced from that same 2021 page. A
 * transform that read the roster out of whichever page it happened to run against
 * would put a five-year-old council on production.
 *
 * Two of the three had no `profile` record at all; `od_wp_create_profiles()` makes
 * them, and their photographs are already in both libraries — the page has been
 * showing them since 2019.
 *
 * **The role is «Член Наблюдательного совета организации» plus what the page says
 * about the person.** The page's own text for each is a description rather than a
 * post («Тренер-консультант, бизнес- и лайф-коуч, …»), and the mock puts it where
 * a role goes; merged, the card states both and neither is invented. Павел
 * Калашников is on both councils, so his role belongs to `OD_TEAM` — his entry
 * here carries no role, and the description this page had reaches his record as
 * that entry's `prose`.
 */
const OD_SUPERVISORY = [
    // Role and contacts live in `OD_TEAM`: the same record cannot take two.
    [
        'name' => 'Калашников Павел Сергеевич',
        'href' => '/profile/kalashnikov-pavel/',
    ],
    [
        'name' => 'Нигматянов Дамир Зиннурович',
        'href' => '/profile/nigmatyanov-damir-zinnurovich/',
        'role' => 'Член Наблюдательного совета организации. Тренер-консультант, бизнес- и лайф-коуч, автор программ по развитию персональной эффективности руководителей, многодетный отец',
        'contacts' => [
            ['mailto:d.nigmatyanov@obshee-delo.ru', 'd.nigmatyanov@obshee-delo.ru'],
        ],
    ],
    [
        'name' => 'Федоренко Михаил Владимирович',
        'href' => '/profile/fedorenko-mihail-vladimirovich/',
        'role' => 'Член Наблюдательного совета организации. Советник руководителя Федеральной антимонопольной службы России, член экспертного совета Агентства стратегических инициатив, кандидат экономических наук, предприниматель, отец двоих детей',
        'contacts' => [
            ['mailto:team@fedmix.ru', 'team@fedmix.ru'],
        ],
    ],
];

/**
 * The roster as a grid of profile links — the markup `parsePost` swaps for cards.
 *
 * Shared by `/team/` and `/about/supervisory/` on purpose: the second page's mock
 * draws a wider card with a full-bleed photograph, and using the first page's card
 * instead is a deliberate call (2026-08-19) so that one component draws a person
 * everywhere. `od-team` is the class both `gutenberg.css` and `profileEmbeds.tsx`
 * read.
 *
 * @param array<int, array{name: string, href: string}> $members
 */
function od_pages_profile_grid(array $members): string
{
    $links = '';
    foreach ($members as $member) {
        $links .= od_pages_paragraph('<a href="' . od_attr($member['href']) . '">' . $member['name'] . '</a>');
    }

    return "<!-- wp:group {\"className\":\"od-team\"} -->\n<div class=\"wp-block-group od-team\">\n"
        . rtrim($links) . "\n</div>\n<!-- /wp:group -->\n\n";
}

/**
 * Numbered task cards as a **grid**, four to a row — Figma `team-2` draws seven
 * of them at 276.5 wide with 44 between, wrapping onto a second row.
 *
 * The programme pages put the same cards in a carousel ({@see
 * od_pages_numbered_tasks()}), which is right for three or four and wrong here:
 * with seven and no arrows the last three would be unreachable. The tile shares
 * `od-task-number`, so the 32px red ordinal is one rule for both.
 *
 * @param array<int, string> $tasks Inline HTML, one per card.
 */
function od_pages_tasks_grid(array $tasks): string
{
    $tiles = '';
    foreach (array_values($tasks) as $index => $task) {
        $tiles .= "<!-- wp:group {\"className\":\"od-task\"} -->\n<div class=\"wp-block-group od-task\">\n"
            . sprintf(
                "<!-- wp:paragraph {\"className\":\"od-task-number\"} -->\n<p class=\"od-task-number\">%02d</p>\n<!-- /wp:paragraph -->\n\n",
                $index + 1
            )
            . od_pages_paragraph($task)
            . "</div>\n<!-- /wp:group -->\n\n";
    }

    return "<!-- wp:group {\"className\":\"od-tasks\"} -->\n<div class=\"wp-block-group od-tasks\">\n"
        . rtrim($tiles) . "\n</div>\n<!-- /wp:group -->\n\n";
}

/**
 * `/about/supervisory/` — the illustrated statement, the seven tasks, the three
 * members.
 *
 * Everything the page says is read back out of it; only the drawing is ours (a
 * background on `.od-card--supervisory`, the same card `.od-card--goal` is) and
 * only the roster is written down ({@see OD_SUPERVISORY} for why). What goes: the
 * centred `<h2>`s' inline `text-align`, the `<strong>Задачи…</strong>` paragraph
 * that stood in for a heading, the `<ul>` the tasks were, and the three
 * hand-built image/text rows the members were.
 *
 * @param string $content    Stored `post_content`.
 * @param int    $_filmTagId Unused — see {@see od_pages_metodichki()}.
 * @throws RuntimeException when the page is neither converted nor the shape this
 *                          converts.
 */
function od_pages_supervisory(string $content, int $_filmTagId = 0): string
{
    if (od_has_block_class($content, 'od-tasks')) {
        return $content;
    }

    if (!preg_match('~<h2[^>]*>(.*?)</h2>~s', $content, $title)) {
        throw new RuntimeException('no <h2> to head the card with');
    }

    // The two paragraphs before the task list: the council's remit, then its aim.
    // Anything bolded is the heading the list used to have, not prose.
    preg_match_all('~<p>((?:(?!</p>).)*)</p>~s', $content, $paragraphs);
    $prose = [];
    foreach ($paragraphs[1] as $paragraph) {
        if (!str_contains($paragraph, '<strong>') && trim(strip_tags($paragraph)) !== '') {
            $prose[] = od_pages_inline_text($paragraph);
        }
    }

    if (count($prose) < 2) {
        throw new RuntimeException('expected the remit and the aim as the first two paragraphs');
    }

    if (!preg_match_all('~<li>(.*?)</li>~s', $content, $items) || count($items[1]) < 2) {
        throw new RuntimeException('no task list to convert');
    }

    $out = "<!-- wp:group {\"className\":\"od-card od-card--goal od-card--supervisory\",\"layout\":{\"type\":\"constrained\"}} -->\n"
        . '<div class="wp-block-group od-card od-card--goal od-card--supervisory">'
        . od_pages_heading(2, od_pages_inline_text($title[1]))
        . od_pages_paragraph($prose[0])
        . od_pages_heading(2, 'Цель')
        . od_pages_paragraph($prose[1])
        . "</div>\n<!-- /wp:group -->\n\n";

    $out .= od_pages_heading(2, 'Задачи Наблюдательного совета');
    $out .= od_pages_tasks_grid(array_map('od_pages_inline_text', $items[1]));
    $out .= od_pages_heading(2, 'Члены Наблюдательного совета');

    return rtrim($out . od_pages_profile_grid(OD_SUPERVISORY)) . "\n";
}

/**
 * Every record workstream D rewrites, newest last.
 *
 * `path` is resolved with `get_page_by_path()` — exact and hierarchy-aware.
 * `title` is the fallback for a record whose slug names somebody else (see the
 * constant above), and `post_type` defaults to `page`. `tag` is the `post_tag`
 * slug a transform's «Проекты программы» row queries — `wp/scripts/od-wp.php` is
 * what creates those tags. Term ids are per-environment, so the
 * runner resolves the slug and hands the transform the id.
 *
 * `args` is passed on to the transform after those two, which is what lets one
 * function serve eleven records that differ only in their data (see `OD_TEAM`).
 *
 * ⚠️ **`title` needs WordPress 5.7 and production runs 5.5.5.** The query var did
 * not exist before then, so 5.5 ignores it, `get_posts()` returns the two newest
 * records of that type and the runner refuses the entry rather than writing to the
 * wrong one — a warning, not damage, but the entry does nothing there. Address a
 * record by `path` where it matters on production; the slug is a valid address
 * even when it names the wrong person.
 *
 * @return array<int, array{label: string, fix: callable-string, path?: string, title?: string, post_type?: string, tag?: string, args?: array<int, mixed>}>
 */
function od_pages_registry(): array
{
    $registry = [
        [
            'label' => 'D6e · /healthy-russia/ — Figma `project-1` (759:845)',
            'path' => 'healthy-russia',
            'tag' => 'programma-zdorovaya-rossiya',
            'fix' => 'od_pages_healthy_russia',
        ],
        [
            'label' => 'D6f · /healthy-youth/ — the same template',
            'path' => 'healthy-youth',
            'tag' => 'programma-zdorovaya-molodezh',
            'fix' => 'od_pages_healthy_youth',
        ],
        [
            'label' => 'D6f · /healthy-kids/ — the same template',
            'path' => 'healthy-kids',
            'tag' => 'programma-zdorovye-deti',
            'fix' => 'od_pages_healthy_kids',
        ],
        [
            'label' => 'D8 · /materials/metodichki/ — Figma `handbooks` (779:4133)',
            'path' => 'materials/metodichki',
            'fix' => 'od_pages_metodichki',
        ],
        [
            'label' => 'D8 · profile «Андрей Алексеевич Рязанов» — the two contacts only the page had',
            'post_type' => 'profile',
            'title' => OD_METODICHKI_COORDINATOR_NAME,
            'fix' => 'od_pages_profile_ryazanov',
        ],
        [
            'label' => 'D6g · /projects/ — the index, as a WordPress page',
            'path' => 'projects',
            'fix' => 'od_pages_projects',
        ],
        [
            'label' => 'D6h · /materials/ — the section index, as a WordPress page',
            'path' => 'materials',
            'fix' => 'od_pages_materials',
        ],
        [
            'label' => 'D6j · /materials/printed-products/ — Figma `printing` (966:2949)',
            'path' => 'materials/printed-products',
            'fix' => 'od_pages_printed_products',
        ],
        [
            'label' => 'D6k · /materials/social-reklama/ — Figma `social-ads` (966:8538)',
            'path' => 'materials/social-reklama',
            'fix' => 'od_pages_social_reklama',
        ],
        [
            'label' => 'D6l · /materials/plakati/ — Figma `social-posters` (998:9524)',
            'path' => 'materials/plakati',
            'fix' => 'od_pages_plakati',
        ],
        [
            'label' => 'D6l · /materials/billboards/ — Figma `social-banners` (1009:10590)',
            'path' => 'materials/billboards',
            'fix' => 'od_pages_billboards',
        ],
        [
            'label' => 'D6l · /materials/sticker/ — Figma `social-sticker` (1013:11191)',
            'path' => 'materials/sticker',
            'fix' => 'od_pages_sticker',
        ],
        [
            'label' => 'D6l · /materials/led-board-roliki/ — Figma `social-video` (1012:11084)',
            'path' => 'materials/led-board-roliki',
            'fix' => 'od_pages_led_board_roliki',
        ],
        [
            'label' => 'D6l · /materials/audio-roliki-social-reklama/ — Figma `social-audio` (1009:10756)',
            'path' => 'materials/audio-roliki-social-reklama',
            'fix' => 'od_pages_audio_roliki',
        ],
        [
            'label' => 'D6m · /materials/books/ — Figma `books` (966:6650)',
            'path' => 'materials/books',
            'fix' => 'od_pages_books',
        ],
        [
            'label' => 'D6m · /materials/zakladki/ — no frame; the section\'s card',
            'path' => 'materials/zakladki',
            'fix' => 'od_pages_zakladki',
        ],
        [
            'label' => 'D6m · /materials/booklet/ — Figma `flyers` (966:7747)',
            'path' => 'materials/booklet',
            'fix' => 'od_pages_booklet',
        ],
        [
            'label' => 'D6m · /materials/disk/ — Figma `disks` (966:8062)',
            'path' => 'materials/disk',
            'fix' => 'od_pages_disk',
        ],
        [
            'label' => 'D6m · /materials/autosticker/ — Figma `car sticker` (966:8388)',
            'path' => 'materials/autosticker',
            'fix' => 'od_pages_autosticker',
            'label' => 'D3 · /team/ — Figma `team-1` (706:1584)',
            'path' => 'team',
            'fix' => 'od_pages_team',
        ],
        [
            'label' => 'D3 · /about/supervisory/ — Figma `team-2` (708:3736)',
            'path' => 'about/supervisory',
            'fix' => 'od_pages_supervisory',
        ],
        [
            'label' => 'D6u · /about/nashi_partnery/ — no frame; the section\'s picture grid',
            'path' => 'about/nashi_partnery',
            'fix' => 'od_pages_partners',
        ],
        [
            'label' => 'D6t · /about/ustav/ — Figma `charter` (706:3695)',
            'path' => 'about/ustav',
            'fix' => 'od_pages_ustav',
        ],
        [
            'label' => 'D6s · /about/udostoverenie/ — Figma `Certificate` (760:1662)',
            'path' => 'about/udostoverenie',
            'fix' => 'od_pages_udostoverenie',
        ],
        [
            'label' => 'D6r · /about/activist-stories/ — Figma `story` (706:3568)',
            'path' => 'about/activist-stories',
            'fix' => 'od_pages_activist_stories',
        ],
        [
            'label' => 'D6q · /about/experts-review/ — Figma `documents` (706:3499)',
            'path' => 'about/experts-review',
            'fix' => 'od_pages_documents',
        ],
        [
            'label' => 'D6q · /about/docs/ — the same template',
            'path' => 'about/docs',
            'fix' => 'od_pages_documents',
        ],
        [
            'label' => 'D6p · /about/reviews/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/reviews',
            'fix' => 'od_pages_post_cards',
        ],
        [
            'label' => 'D6p · /about/reviews/letters/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/reviews/letters',
            'fix' => 'od_pages_post_cards',
        ],
        [
            'label' => 'D6p · /about/reviews/school/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/reviews/school',
            'fix' => 'od_pages_post_cards',
        ],
        [
            'label' => 'D6p · /about/reviews/middle/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/reviews/middle',
            'fix' => 'od_pages_post_cards',
        ],
        [
            'label' => 'D6p · /about/reviews/vuz/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/reviews/vuz',
            'fix' => 'od_pages_post_cards',
        ],
        [
            'label' => 'D6p · /about/reviews/mvd/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/reviews/mvd',
            'fix' => 'od_pages_post_cards',
        ],
        [
            'label' => 'D6p · /about/smi/ — Figma `Letters-of-appreciation` (706:3602)',
            'path' => 'about/smi',
            'fix' => 'od_pages_post_cards',
        ],
    ];

    // One entry per person, because each is a record of its own — the lists are
    // the same ones the pages are built from, so a page's links and the records
    // they address cannot drift apart. A person on both councils is written once:
    // one record holds one role, and `OD_TEAM` is where theirs is.
    $seen = [];
    foreach (array_merge(OD_TEAM, OD_SUPERVISORY) as $member) {
        $slug = od_profile_slug($member['href']);

        if (!isset($member['role']) || isset($seen[$slug])) {
            continue;
        }

        $seen[$slug] = true;
        $registry[] = [
            'label' => sprintf('D3 · profile «%s» — the role and the contacts only the page had', $member['name']),
            'post_type' => 'profile',
            'path' => $slug,
            'fix' => 'od_pages_profile_team',
            'args' => [$member['role'], $member['contacts'], $member['prose'] ?? ''],
        ];
    }

    return $registry;
}

// ---------------------------------------------------------------------------
// Runner. Everything above is a pure function and is what the tests exercise.
// ---------------------------------------------------------------------------

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

global $wpdb; // `eval-file` runs the script in a function scope, where it is not in view.

$apply = in_array('apply', $args ?? [], true);
WP_CLI::log($apply ? 'Applying changes.' : 'Dry run — pass `apply` to write.');

foreach (od_pages_registry() as $entry) {
    $postType = $entry['post_type'] ?? 'page';

    if (isset($entry['path'])) {
        $post = get_page_by_path($entry['path'], OBJECT, $postType);
    } else {
        $found = get_posts([
            'post_type' => $postType,
            'title' => $entry['title'],
            'post_status' => 'publish',
            'numberposts' => 2,
            'suppress_filters' => false,
        ]);

        if (count($found) !== 1) {
            WP_CLI::warning(sprintf('%s: %d records titled «%s» — expected exactly 1', $entry['label'], count($found), $entry['title']));
            continue;
        }

        $post = $found[0];
    }

    if (!$post) {
        WP_CLI::warning(sprintf('%s: no such %s', $entry['label'], $postType));
        continue;
    }

    // Resolved here rather than written into a transform: term ids are
    // per-environment. `wp/scripts/od-wp.php` is what creates them.
    $tagSlug = $entry['tag'] ?? '';
    $filmTag = $tagSlug === '' ? null : get_term_by('slug', $tagSlug, 'post_tag');
    if ($tagSlug !== '' && !$filmTag) {
        WP_CLI::warning(sprintf('%s: tag `%s` is missing — run `od-wp.php apply` first.', $entry['label'], $tagSlug));
        continue;
    }

    try {
        $new = $entry['fix']($post->post_content, $filmTag ? (int) $filmTag->term_id : 0, ...($entry['args'] ?? []));
    } catch (Throwable $e) {
        WP_CLI::warning(sprintf('%s (#%d): %s', $entry['label'], $post->ID, $e->getMessage()));
        continue;
    }

    if ($new === $post->post_content) {
        WP_CLI::log(sprintf('%s (#%d): already in shape, skipped', $entry['label'], $post->ID));
        continue;
    }

    WP_CLI::log(sprintf('%s (#%d): %d bytes -> %d bytes', $entry['label'], $post->ID, strlen($post->post_content), strlen($new)));

    if (!$apply) {
        continue;
    }

    wp_save_post_revision($post->ID);
    $written = $wpdb->update($wpdb->posts, ['post_content' => $new], ['ID' => $post->ID], ['%s'], ['%d']);
    if ($written === false) {
        WP_CLI::warning(sprintf('%s (#%d): write failed', $entry['label'], $post->ID));
        continue;
    }

    clean_post_cache($post->ID);
    WP_CLI::success(sprintf('%s (#%d): written', $entry['label'], $post->ID));
}
