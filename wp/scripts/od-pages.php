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
 * - **Pages are addressed by path**, never by id — ids differ per environment.
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

/**
 * Page path => the transform that rebuilds it and the tag its «Проекты
 * программы» row queries. Every page workstream D has rebuilt. An empty tag slug
 * means the page has no such row — the transform is still called the same way,
 * with `0`. `wp/scripts/od-films.php` is what creates the tags.
 *
 * @return array<string, array{0: callable-string, 1: string}>
 */
function od_pages_registry(): array
{
    return [
        'healthy-russia' => ['od_pages_healthy_russia', 'programma-zdorovaya-rossiya'],
        'healthy-youth' => ['od_pages_healthy_youth', 'programma-zdorovaya-molodezh'],
        'healthy-kids' => ['od_pages_healthy_kids', 'programma-zdorovye-deti'],
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

foreach (od_pages_registry() as $path => [$transform, $tagSlug]) {
    $page = get_page_by_path($path);
    if (!$page) {
        WP_CLI::warning(sprintf('%s: no such page', $path));
        continue;
    }

    // Resolved here rather than written into a transform: term ids are
    // per-environment. `wp/scripts/od-films.php` is what creates them.
    $filmTag = $tagSlug === '' ? null : get_term_by('slug', $tagSlug, 'post_tag');
    if ($tagSlug !== '' && !$filmTag) {
        WP_CLI::warning(sprintf('%s: tag `%s` is missing — run `od-films.php apply` first.', $path, $tagSlug));
        continue;
    }

    try {
        $new = $transform($page->post_content, $filmTag ? (int) $filmTag->term_id : 0);
    } catch (Throwable $e) {
        WP_CLI::warning(sprintf('%s (#%d): %s', $path, $page->ID, $e->getMessage()));
        continue;
    }

    if ($new === $page->post_content) {
        WP_CLI::log(sprintf('%s (#%d): already in shape, skipped', $path, $page->ID));
        continue;
    }

    WP_CLI::log(sprintf('%s (#%d): %d bytes -> %d bytes', $path, $page->ID, strlen($page->post_content), strlen($new)));

    if (!$apply) {
        continue;
    }

    wp_save_post_revision($page->ID);
    $written = $wpdb->update($wpdb->posts, ['post_content' => $new], ['ID' => $page->ID], ['%s'], ['%d']);
    if ($written === false) {
        WP_CLI::warning(sprintf('%s (#%d): write failed', $path, $page->ID));
        continue;
    }

    clean_post_cache($page->ID);
    WP_CLI::success(sprintf('%s (#%d): written', $path, $page->ID));
}
