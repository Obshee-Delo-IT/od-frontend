import { stripHtml } from '@/shared/api/newsPreview';

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
 * So four things come out, and only four:
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
 *    contact. A bare `<div>` counts as a paragraph: text pasted from Word
 *    arrives as one `<div>` per line, and that is how `/team/`'s Дегтярёв came
 *    to show his phone, e-mail and VK twice.
 *
 * 4. **A paragraph or list item that only repeats the card** — once the name
 *    and the role are taken out of its text, nothing is left. That is
 *    «Тимашев Александр Валерьевич» on a line of its own, «<b>Координатор
 *    проекта</b> Кабаков Павел Дмитриевич», and the role as the first item of a
 *    bulleted list, which is where `parseProfileBody()` found it: 30 of the 136
 *    records on prod printed one of these twice (2026-10-05). A line that says
 *    anything more — «город Воркута Координатор проекта …», a phone typed as
 *    text — stays whole.
 *
 * Nothing else is touched, and a record whose body this empties renders no body
 * at all rather than an empty column.
 */

/** `<figure …>…</figure>`, first only: the card shows one photograph. */
const FIRST_FIGURE = /<figure\b[\s\S]*?<\/figure>/i;

/** A paragraph whose entire content is one bold run — the role line. */
const BOLD_ONLY_PARAGRAPH = /<p\b[^>]*>\s*<(strong|b)\b[^>]*>[\s\S]*?<\/\1>\s*<\/p>/i;

/**
 * An innermost paragraph or `<div>` containing a link to one of the four contact
 * schemes.
 *
 * `(?:(?!<\/?(?:p|div)\b)[\s\S])*` rather than `[\s\S]*?` — a lazy wildcard
 * would happily cross a `</p>` and swallow the paragraphs in between when the
 * *next* one holds the link, and a `<div>` that wraps others (every record's
 * column) must never match as a whole.
 */
const CONTACT_PARAGRAPH =
  /<(p|div)\b[^>]*>(?:(?!<\/?(?:p|div)\b)[\s\S])*<a\b[^>]*href=["'](?:tel:|mailto:|https?:\/\/(?:www\.)?(?:vk\.(?:com|ru)|t(?:elegram)?\.me))(?:(?!<\/?(?:p|div)\b)[\s\S])*<\/\1>/gi;

/** An innermost `<p>`, `<li>` or `<div>` — no paragraph, item or div nested inside it. */
const TEXT_BLOCK = /<(p|li|div)\b[^>]*>((?:(?!<\/?(?:p|li|div)\b)[\s\S])*)<\/\1>/gi;
const EMPTY_LIST = /<(ul|ol)\b[^>]*>\s*<\/\1>/gi;
const MEDIA = /<(?:img|figure|iframe|video|audio)\b/i;

/** Case-folded plain text, so «Департамента» in a heading matches the role's «департамента». */
const plain = (html: string): string => stripHtml(html).toLowerCase();

/** True when `html` holds text and all of it is `card`'s strings — punctuation aside. */
const repeatsCard = (html: string, card: string[]): boolean => {
  const text = plain(html);
  if (!text || MEDIA.test(html)) {
    return false;
  }
  const left = card.reduce((rest, field) => rest.split(field).join(' '), text);
  return !/[\p{L}\p{N}]/u.test(left);
};

/** Markup with no text and no media left — whitespace, `&nbsp;` and empty wrappers. */
const isBlank = (html: string): boolean =>
  html
    .replace(/<(?:img|figure|iframe|video|audio)\b[\s\S]*?(?:\/>|>)/gi, 'x')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|\s/g, '') === '';

/** What the card above the body already prints: its name and its subtitle. */
interface CardText {
  name?: string | null;
  role?: string | null;
}

export const stripProfileCardFields = (html?: string | null, { name, role }: CardText = {}): string => {
  if (!html) {
    return '';
  }

  // Longest first, so a role that contains the name is not cut in half by it.
  const card = [name, role]
    .map((field) => plain(field ?? ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const rest = html
    .replace(FIRST_FIGURE, '')
    .replace(BOLD_ONLY_PARAGRAPH, '')
    .replace(CONTACT_PARAGRAPH, '')
    .replace(TEXT_BLOCK, (block) => (card.length > 0 && repeatsCard(block, card) ? '' : block))
    .replace(EMPTY_LIST, '');

  return isBlank(rest) ? '' : rest;
};

/** Where one line of the body ends: a paragraph, an item, a div, a heading, a `<br>`. */
const LINE_END = /<\/(?:p|li|div|h[1-6])>|<br\s*\/?>/gi;

/**
 * The same remainder as plain text, one line per paragraph — for a card that
 * cannot hold the body's markup and clamps whatever it is given (the regional
 * `/contacts/<region>/` cards). Empty when the card already says everything.
 */
export const profileSummary = (html?: string | null, card: CardText = {}): string =>
  stripProfileCardFields(html, card)
    .split(LINE_END)
    .map((line) => stripHtml(line))
    .filter(Boolean)
    .join('\n');
