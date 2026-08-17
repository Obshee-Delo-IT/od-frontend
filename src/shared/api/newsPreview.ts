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
 * Build the text preview for a news item: prefer WP's `excerpt.rendered`,
 * fall back to a truncated `content.rendered` when the excerpt is empty
 * (common for posts with no manual excerpt). Returns null when neither
 * yields text.
 */
export const buildNewsPreview = (excerptHtml?: string | null, contentHtml?: string | null): string | null => {
  const excerpt = stripHtml(excerptHtml);
  if (excerpt) {
    return excerpt;
  }
  const content = stripHtml(contentHtml);
  if (!content) {
    return null;
  }
  if (content.length <= MAX_PREVIEW) {
    return content;
  }
  return `${content
    .slice(0, MAX_PREVIEW)
    .replace(/\s+\S*$/, '')
    .trimEnd()}…`;
};
