/**
 * What is left of a `profile` record's body once the card above it has said its
 * part — for `/profile/[slug]`, which draws the same `PersonCard` the team page
 * embeds and then the rest of the record underneath.
 *
 * **There is a rest, on 121 of the 139 records** (measured on od-dev 2026-08-19:
 * 18 records say nothing beyond the card, 63 add under 40 characters, 51 add up to
 * 200, and 8 add more than that). What they add is real content — a second and
 * third role, education, a bio, and the phone numbers that are still typed as
 * plain text and therefore never became contact rows. Dropping the body would
 * lose all of it; keeping it whole would print the role and every contact twice.
 * So three things come out, and only three:
 *
 * 1. **The first `<figure>`** — the photograph, which the card shows.
 * 2. **A paragraph that is nothing but a bold run** — which is exactly the shape
 *    `od_prepend_profile_lead()` writes the role in, and `parseProfileBody()`
 *    reads it as the card's subtitle. A bold run *followed by text* stays: that is
 *    a record's own «<b>Координатор по Тульской области</b> Касатиков Александр
 *    Юрьевич», which says more than the bold alone.
 * 3. **A paragraph holding a contact link** — `tel:`, `mailto:`, `vk.com`,
 *    `t.me`; the four schemes `parseProfileBody()` turns into rows. The whole
 *    paragraph goes, label and all, because «E-mail: <a…>» is one line about one
 *    contact.
 *
 * Nothing else is touched, and a record whose body this empties renders no body
 * at all rather than an empty column.
 */

/** `<figure …>…</figure>`, first only: the card shows one photograph. */
const FIRST_FIGURE = /<figure\b[\s\S]*?<\/figure>/i;

/** A paragraph whose entire content is one bold run — the role line. */
const BOLD_ONLY_PARAGRAPH = /<p\b[^>]*>\s*<(strong|b)\b[^>]*>[\s\S]*?<\/\1>\s*<\/p>/i;

/**
 * A paragraph containing a link to one of the four contact schemes.
 *
 * `(?:(?!<\/p>)[\s\S])*` rather than `[\s\S]*?` — a lazy wildcard would happily
 * cross a `</p>` and swallow the paragraphs in between when the *next* one holds
 * the link.
 */
const CONTACT_PARAGRAPH =
  /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<a\b[^>]*href=["'](?:tel:|mailto:|https?:\/\/(?:www\.)?(?:vk\.(?:com|ru)|t(?:elegram)?\.me))(?:(?!<\/p>)[\s\S])*<\/p>/gi;

/** Markup with no text and no media left — whitespace, `&nbsp;` and empty wrappers. */
const isBlank = (html: string): boolean =>
  html
    .replace(/<(?:img|figure|iframe|video|audio)\b[\s\S]*?(?:\/>|>)/gi, 'x')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|\s/g, '') === '';

export const stripProfileCardFields = (html?: string | null): string => {
  if (!html) {
    return '';
  }

  const rest = html.replace(FIRST_FIGURE, '').replace(BOLD_ONLY_PARAGRAPH, '').replace(CONTACT_PARAGRAPH, '');

  return isBlank(rest) ? '' : rest;
};
