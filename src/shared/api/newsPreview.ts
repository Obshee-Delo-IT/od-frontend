import { decodeEntities } from '@/shared/lib/decodeEntities';

const MAX_PREVIEW = 300;

/**
 * Reduce a fragment of WordPress-rendered HTML to plain text: drop
 * `<style>`/`<script>` blocks (WP post content often opens with an inline
 * style block), strip remaining tags, decode entities, collapse whitespace.
 *
 * A tag becomes a **space**, not nothing: `<p>a</p><p>b</p>` and a title broken
 * with `<br>` are two words, and deleting the tag outright glues them into one.
 * The cost is a stray space where a tag sits mid-word (`<b>но</b>вости`), which
 * is both rarer and less damaging in a title or meta description than a run-on.
 *
 * Every WordPress `title.rendered` goes through this on the way out of a
 * fetcher: it is HTML, and every place this site shows a title — cards, `<h1>`,
 * breadcrumbs, `<title>`, `alt`/`aria-label` — prints it as text, where a
 * `&#171;` would stay literal.
 */
export const stripHtml = (html?: string | null): string => {
  if (!html) {
    return '';
  }
  return decodeEntities(html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * WordPress appends its own read-more link to every auto-generated excerpt —
 * `<a class="more-link" href="…">Читать далее <span class="screen-reader-text">TITLE</span></a>`
 * — so the stripped text ended with «Читать далее» and the whole post title
 * again. 61 of the site's meta descriptions carried it (SEO-08).
 */
const MORE_LINK = /<a\b[^>]*\bmore-link\b[^>]*>[\s\S]*?<\/a>/gi;

/** Cut at a word boundary, never mid-word, and mark the cut. */
const truncate = (text: string): string =>
  text.length <= MAX_PREVIEW
    ? text
    : `${text
        .slice(0, MAX_PREVIEW)
        .replace(/\s+\S*$/, '')
        .trimEnd()}…`;

/** Two Russian words' worth of characters. Below this a title is too generic to be a safe signal. */
const MIN_TITLE_LEAD = 12;
/** Below this the remainder is a stub, not a description — try the next source. */
const MIN_REMAINDER = 40;
const EDGE_PUNCT = /^[\s.,;:!?…—–-]+|[\s.,;:!?…—–-]+$/g;
const LEADING_PUNCT = /^[\s.,;:!?…—–-]+/;

/** Case-, ё- and quote-insensitive fold. Comparison only — never emitted. */
const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»“”„‟"'’‘‚`]/g, '"');

/**
 * Where WordPress ends a line. Nesting is why this is a replace and not a
 * search: a Gutenberg body opens with `<div class="wp-block-group">` wrappers
 * and often a gallery, so «the first block» is a `</div>` several levels in,
 * while the first line a *reader* sees is the first block that carries text.
 */
const BLOCK_END = /<\/(?:p|h[1-6]|div|li|blockquote|figure|figcaption|section|article|tr|td)>|<br\s*\/?>/gi;

/** Ends a sentence, so a title ending in one is a whole sentence of the lede. */
const SENTENCE_END = /[.!?…]$/;

/** The first line of the body that carries any text at all; `''` when there is none. */
const firstTextLine = (html?: string | null): string => {
  if (!html) {
    return '';
  }
  const lines = stripHtml(html.replace(BLOCK_END, '\u0000')).split('\u0000');

  return lines.map((line) => line.trim()).find(Boolean) ?? '';
};

/**
 * Whether the **body** opens with the title — the editor's pasted headline, and
 * the only case where cutting the echo out of the description is safe.
 *
 * The signal has to be read here rather than off the excerpt, because
 * `wp_trim_excerpt` flattens the body's markup into one `<p>`: in
 * `excerpt.rendered` the pasted headline and the sentence after it are the same
 * paragraph, so a prefix match there cannot tell «ЗДОРОВЬЕ — ВАЖНЕЙШИЙ РЕСУРС /
 * 21 апреля в гимназии…» (two lines, an echo) from «3 февраля в Москве прошёл
 * «ПРО-форум» для команд-добровольцев, участвующих в…» (one sentence, whose
 * opening happens to be the title). Cut the second and the description is a
 * fragment starting mid-clause.
 *
 * Two shapes count, both measured on production's newest 25 posts. The line
 * **is** the title — 7 of the 13 echoes. Or the line **opens** with it and the
 * title ends in a full stop, which makes the copy a complete sentence and the
 * remainder another one — 3 more. The rest are titles the body reproduces with a
 * line break inside, where no cut can be made cleanly and none is.
 */
const opensWithTitleLine = (contentHtml?: string | null, title?: string | null): boolean => {
  const bare = (title ?? '').replace(EDGE_PUNCT, '');
  if (bare.length < MIN_TITLE_LEAD) {
    return false;
  }
  const line = firstTextLine(contentHtml);
  const folded = fold(line);
  const foldedTitle = fold(bare);

  return folded === foldedTitle || (SENTENCE_END.test((title ?? '').trim()) && folded.startsWith(foldedTitle));
};

/**
 * The same text with a leading verbatim copy of the title removed; `text`
 * unchanged when there is none, and `''` when nothing usable is left — which
 * the caller reads as "this source is exhausted" and moves to the next one.
 *
 * Editors paste the headline as the post's first line and leave the manual
 * excerpt empty; WordPress then builds `excerpt.rendered` from the body's first
 * ~55 words, so the excerpt opens with the title verbatim and the card prints
 * the headline twice. Measured against production: 16 of the newest 20 posts —
 * and 0 of 40 sampled across 2011-2022, so it is a recent editorial habit rather
 * than a property of the archive.
 *
 * Deliberately only a **leading** copy, and only the **whole** title: «САХАР
 * АТАКУЕТ» inside «ОПИСАНИЕ МУЛЬТФИЛЬМА «САХАР АТАКУЕТ» Ребенок снова…» is part
 * of a sentence, and excising it would wreck the sentence.
 *
 * The comparison folds both sides, the slice indexes the original: `toLowerCase`
 * is not length-preserving for every scalar (ẞ → ss), so folding before slicing
 * would drift the cut.
 */
const withoutLeadingTitle = (text: string, title?: string | null): string => {
  const bare = (title ?? '').replace(EDGE_PUNCT, '');
  const skip = (text.match(LEADING_PUNCT)?.[0] ?? '').length;
  if (bare.length < MIN_TITLE_LEAD || fold(text.slice(skip, skip + bare.length)) !== fold(bare)) {
    return text;
  }
  const rest = text
    .slice(skip + bare.length)
    .replace(LEADING_PUNCT, '')
    .trim();

  return rest.length >= MIN_REMAINDER ? rest : '';
};

/**
 * Build the text preview for a news item: prefer WP's `excerpt.rendered`,
 * fall back to a truncated `content.rendered` when the excerpt is empty
 * (common for posts with no manual excerpt). Returns null when neither
 * yields text.
 *
 * Pass the post's `title` — stripped, as the fetchers already have it — to drop
 * the headline echo described on {@link withoutLeadingTitle}. It is optional so
 * that a caller which doesn't have one degrades to the old behaviour rather
 * than to a wrong cut, and it is acted on only when {@link opensWithTitleLine}
 * says the body really does open with the headline on a line of its own.
 */
export const buildNewsPreview = (
  excerptHtml?: string | null,
  contentHtml?: string | null,
  title?: string | null
): string | null => {
  // The same MAX_PREVIEW bound as the content fallback: this feeds
  // `<meta name="description">`, and an unbounded excerpt ran to 793 chars.
  // Truncation runs *after* the cut, so the 300 chars are spent on text the
  // reader hasn't just read in the headline — on one measured post the echo
  // alone ate 170 of them.
  const echo = opensWithTitleLine(contentHtml, title);
  const excerpt = stripHtml(excerptHtml?.replace(MORE_LINK, ''));
  const fromExcerpt = echo ? withoutLeadingTitle(excerpt, title) : excerpt;
  if (fromExcerpt) {
    return truncate(fromExcerpt);
  }
  const content = stripHtml(contentHtml);
  // The echo-free body, else whatever text exists: a description that repeats
  // the title still beats no description at all, and a post whose whole text is
  // its own title («Письмо Путину. Откровение.») has nothing else to offer.
  const text = (echo ? withoutLeadingTitle(content, title) : content) || excerpt || content;

  return text ? truncate(text) : null;
};
