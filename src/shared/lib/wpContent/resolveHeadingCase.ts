const HEADING = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const TAG_OR_ENTITY = /(<[^>]+>|&[^;\s]{1,12};)/g;
/** No lowercase letter anywhere in the visible text — a heading that shouts. */
const SHOUTING = /^[^\p{Ll}]+$/u;
const FIRST_LETTER = /\p{L}/u;

/** Visible text, with tags and entities out of the way — `&laquo;` is not lowercase prose. */
const visibleText = (inner: string): string => inner.replace(TAG_OR_ENTITY, ' ');

/**
 * Sentence-case the text of a heading, leaving its markup and its entities as
 * they are: `<strong>`, a link's href and `&#171;` all pass through, only the
 * text between them is lowered, and the first letter *of the text* comes back
 * up — «&laquo;ОБЩЕЕ ДЕЛО&raquo;» must not capitalise the entity's own `l`, and
 * a heading that opens with a link must not capitalise its `a`.
 */
const sentenceCase = (inner: string): string => {
  let capitalised = false;

  return inner
    .split(TAG_OR_ENTITY)
    .map((part, index) => {
      if (index % 2 === 1) {
        return part; // the delimiter: a tag or an entity, never text
      }

      const lowered = part.toLocaleLowerCase('ru-RU');
      const at = capitalised ? -1 : lowered.search(FIRST_LETTER);
      if (at < 0) {
        return lowered;
      }

      capitalised = true;
      return lowered.slice(0, at) + lowered[at].toLocaleUpperCase('ru-RU') + lowered.slice(at + 1);
    })
    .join('');
};

/**
 * Sentence-case the **shouting** headings in a WordPress body, and only those.
 *
 * This replaces `gutenberg.css`'s `.wp-block-group h2 { text-transform: lowercase }`
 * (plus its `::first-letter` override), which could not tell the two cases
 * apart and so did the right thing to one of them and the wrong thing to the
 * other. Measured on od-dev 2026-08-20:
 *
 * - **Posts** are what the rule was for: of 600 sampled bodies, all 50 headings
 *   in them are typed in capitals, and none has a capitalised word past the
 *   first. Left as authored they shout at the reader.
 * - **Pages** are the opposite: 26 headings on 16 pages carry a proper noun past
 *   the first word — «Здоровая Россия — ОБЩЕЕ ДЕЛО!», «Абонентам Мегафон»,
 *   «Миф, который навязали России» — and every one of them was being lowercased.
 *   The only all-caps headings among all 169 published pages are on
 *   `/тестовая-страница/` and on the `/video/` page a native route shadows, so
 *   on pages the rule protected nothing at all.
 *
 * A case decision therefore needs the text, which CSS cannot see: "has no
 * lowercase letter" is the whole condition, and it is the only case where the
 * author's own casing carries no information to preserve.
 *
 * Applies to every level rather than to `h2` inside a group, because "in a
 * group" was never a fact about a heading — and there are no all-caps headings
 * at another level to change the outcome for.
 */
export const resolveHeadingCase = (html?: string | null): string => {
  if (!html) {
    return '';
  }

  return html.replace(HEADING, (whole, level, attrs, inner) => {
    const text = visibleText(inner).trim();
    if (!text || !SHOUTING.test(text) || !FIRST_LETTER.test(text)) {
      return whole;
    }

    return `<h${level}${attrs}>${sentenceCase(inner)}</h${level}>`;
  });
};
