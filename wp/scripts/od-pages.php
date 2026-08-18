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
function od_pages_heading(int $level, string $text): string
{
    $attrs = $level === 2 ? '' : sprintf(' {"level":%d}', $level);

    return sprintf("<!-- wp:heading%s -->\n<h%d class=\"wp-block-heading\">%s</h%d>\n<!-- /wp:heading -->\n\n", $attrs, $level, $text, $level);
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
 * Every record workstream D rewrites, newest last.
 *
 * `path` is resolved with `get_page_by_path()` — exact and hierarchy-aware.
 * `title` is the fallback for a record whose slug names somebody else (see the
 * constant above), and `post_type` defaults to `page`. `tag` is the `post_tag`
 * slug a transform's «Проекты программы» row queries — `wp/scripts/od-wp.php` is
 * what creates those tags. Term ids are per-environment, so the
 * runner resolves the slug and hands the transform the id.
 *
 * @return array<int, array{label: string, fix: callable-string, path?: string, title?: string, post_type?: string, tag?: string}>
 */
function od_pages_registry(): array
{
    return [
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
    ];
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
        $new = $entry['fix']($post->post_content, $filmTag ? (int) $filmTag->term_id : 0);
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
