/**
 * HTML entity decoding, for the two places that read text out of WordPress
 * markup with a regex: the legacy transform's `<title>` / attribute values
 * (`shared/legacy/html.ts`) and the news preview (`shared/api/newsPreview.ts`).
 * There was a table in each, one with twenty entries and one with eleven.
 *
 * Named plus both numeric forms. An unrecognised entity is left exactly as
 * written rather than dropped: this text is displayed, and a stray `&sup2;`
 * beats a hole where a character was.
 */

/** The entities WordPress actually emits in titles, descriptions and attributes. */
const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export const decodeEntities = (value: string): string =>
  value.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const codePoint = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
        return whole;
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
