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
 * @param string $content Stored `post_content`.
 * @return string Rewritten content, or `$content` unchanged if it is already in
 *                the target shape.
 * @throws RuntimeException when the page does not look like the expected input.
 */
function od_pages_healthy_russia(string $content): string
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

    $out .= "<!-- wp:group {\"className\":\"od-card od-card--goal\",\"layout\":{\"type\":\"constrained\"}} -->\n"
        . "<div class=\"wp-block-group od-card od-card--goal\">"
        . od_pages_heading(2, 'Цель программы')
        . od_pages_paragraph(od_pages_inline_text($goal[1]))
        . "</div>\n<!-- /wp:group -->\n\n";

    $out .= od_pages_heading(2, 'Задачи программы');
    $out .= "<!-- wp:columns {\"className\":\"od-cards\"} -->\n<div class=\"wp-block-columns od-cards\">";
    foreach ($tasks as $task) {
        $out .= "<!-- wp:column -->\n<div class=\"wp-block-column\">"
            . od_pages_heading(3, od_pages_inline_text($task[1]))
            . od_pages_paragraph(od_pages_inline_text($task[2]))
            . "</div>\n<!-- /wp:column -->\n";
    }
    $out .= "</div>\n<!-- /wp:columns -->\n\n";

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

    $out .= od_pages_heading(2, 'Проекты программы');
    $out .= "<!-- wp:columns {\"className\":\"od-poster-cards\"} -->\n<div class=\"wp-block-columns od-poster-cards\">";
    foreach ($posters as $poster) {
        // «Подробнее» as the mock has it, not the film's title: the poster above
        // is itself a link and carries the title as its alt text, so the card
        // already reads out as the film to a screen reader.
        $label = od_pages_inline_text($poster['label']);
        $out .= "<!-- wp:column -->\n<div class=\"wp-block-column\">"
            . od_pages_image_block($poster['id'], $poster['src'], $label, $poster['href'])
            . od_pages_buttons([['href' => $poster['href'], 'label' => 'Подробнее']], '')
            . "</div>\n<!-- /wp:column -->\n";
    }
    $out .= "</div>\n<!-- /wp:columns -->";

    return $out;
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
 * A `core/buttons` block. `project-1` draws two kinds: the outline button that
 * is the default here, and the solid one the poster cards lay over the artwork —
 * which carries no block style, because its colours come from
 * `.od-poster-cards` in `gutenberg.css` rather than from a core style.
 *
 * @param array<int, array{href: string, label: string}> $buttons
 */
function od_pages_buttons(array $buttons, string $style = 'is-style-outline'): string
{
    $attrs = $style === '' ? '' : sprintf(' {"className":"%s"}', $style);
    $class = 'wp-block-button' . ($style === '' ? '' : ' ' . $style);

    $out = "<!-- wp:buttons -->\n<div class=\"wp-block-buttons\">";
    foreach ($buttons as $button) {
        $out .= sprintf("<!-- wp:button%s -->\n<div class=\"%s\">", $attrs, $class)
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

/** Page path => transform. Every page workstream D has rebuilt. */
function od_pages_registry(): array
{
    return [
        'healthy-russia' => 'od_pages_healthy_russia',
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

foreach (od_pages_registry() as $path => $transform) {
    $page = get_page_by_path($path);
    if (!$page) {
        WP_CLI::warning(sprintf('%s: no such page', $path));
        continue;
    }

    try {
        $new = $transform($page->post_content);
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
