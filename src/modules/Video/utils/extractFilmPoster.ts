export interface FilmDownloadLink {
  url: string;
  /** Parenthetical part of the anchor, «•»-joined: «656 Мб • 35 мин». */
  label: string;
}

export interface ExtractFilmPosterResult {
  html: string;
  /** Full-size poster image URL (the figure's link target when it points at an image). */
  posterImageUrl: string | null;
  /** `width / height` CSS aspect-ratio parsed from the sized variant, e.g. `'212 / 300'`. */
  posterAspectRatio: string | null;
  /** «Скачать плакат» target (usually a disk.yandex.ru link). */
  posterDownloadUrl: string | null;
  /** Every in-body film download anchor (disk.yandex + «Скачать …»), in source order. */
  downloads: FilmDownloadLink[];
}

const IMAGE_FILE = /\.(?:jpe?g|png|webp|gif)(?:\?.*)?$/i;
const SIZED_VARIANT = /-(\d+)x(\d+)(?=\.\w+(?:\?.*)?$)/;
const FIGURE_BLOCK = /<figure\b[^>]*class="[^"]*wp-block-image[^"]*"[^>]*>[\s\S]*?<\/figure>/gi;
const POSTER_NAME = /плакат|постер|plakat|poster/i;
const ANCHOR = /<a\b[^>]*href="([^"]+)"[^>]*>((?:(?!<\/a>)[\s\S])*?)<\/a>/gi;
const DOWNLOAD_HOST = /disk\.yandex\.|yadi\.sk/i;
/* «Скачать …» anchor classification (content audit 2026-07-03): the word after
   «Скачать» decides. Film media words → download pill; poster words → the
   poster card; anything else (экспертное заключение, буклет, заставка,
   ролл ап, …) is a document that stays in the body. Bare «СКАЧАТЬ» (54 of
   the ~150 anchors) is the download button of the older clip posts. */
const POSTER_TEXT = /^(?:плакат|постер|афиш)/i;
// (?![а-яё]) instead of \b — JS word boundaries are ASCII-only and never
// match adjacent to Cyrillic letters.
const FILM_MEDIA_WORD = /^(?:фильм|мультфильм|ролик|видео)(?![а-яё])/i;

/** How close (chars) a figure must sit before the first download anchor to count as the poster column image. */
const POSTER_PROXIMITY = 600;

/** `…-212x300.jpg` → `'212 / 300'`; null when the URL carries no size suffix. */
export const aspectRatioFromUrl = (url: string): string | null => {
  const sized = url.match(SIZED_VARIANT);
  return sized ? `${sized[1]} / ${sized[2]}` : null;
};

const attr = (tag: string, name: string): string | null => {
  const match = tag.match(new RegExp(`\\b${name}="([^"]+)"`));
  return match ? match[1] : null;
};

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** «Скачать фильм (656 Мб, 35 мин)» → «656 Мб • 35 мин»; falls back to the de-prefixed text. */
const downloadLabel = (text: string): string => {
  const parens = text.match(/\(([^)]+)\)/);
  if (parens) {
    // Split only on «, » — a bare comma can be a Russian decimal («1,5 Гб»).
    return parens[1]
      .split(/,\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' • ');
  }
  return text.replace(/^скачать\s*(?:фильм|мультфильм|ролик|видео)?\s*/i, '').trim() || 'Скачать';
};

/** The smallest `<p>` or `wp-block-button` div wrapping the fragment at `index`, or the fragment itself. */
const enclosingBlock = (html: string, fragment: string, index: number): string => {
  for (const pattern of [
    /<p\b[^>]*>(?:(?!<\/?p\b)[\s\S])*?<\/p>/gi,
    /<div\b[^>]*class="[^"]*wp-block-button\b[^"]*"[^>]*>(?:(?!<\/?div\b)[\s\S])*?<\/div>/gi,
  ]) {
    for (const match of html.matchAll(pattern)) {
      const start = match.index;
      if (start <= index && index + fragment.length <= start + match[0].length) {
        return match[0];
      }
    }
  }
  return fragment;
};

/**
 * Film bodies carry a legacy right column with the film's poster/cover figure
 * and «Скачать …» links. The film page renders those as the structured poster
 * card + download pills (Figma `Frame 33945`/`Frame 33958`) instead, so this
 * pulls the data out of the HTML and drops the source blocks. The poster is a
 * figure whose image is named like a плакат, or — failing that — the figure
 * sitting directly above the first download anchor (the legacy column layout).
 */
export const extractFilmPoster = (html: string): ExtractFilmPosterResult => {
  let posterImageUrl: string | null = null;
  let posterAspectRatio: string | null = null;
  let posterDownloadUrl: string | null = null;
  const downloads: FilmDownloadLink[] = [];
  const removals: string[] = [];

  // Pass 1 — anchors: film downloads (lifted into pills) + «Скачать плакат/постер».
  let firstActionIndex = -1;
  for (const match of html.matchAll(ANCHOR)) {
    const [fragment, href, inner] = match;
    const text = stripTags(inner);
    const rest = text.match(/^скачать\s*(.*)$/i)?.[1]?.trim();
    if (rest === undefined) {
      continue;
    }
    if (POSTER_TEXT.test(rest)) {
      if (!posterDownloadUrl) {
        posterDownloadUrl = href;
        removals.push(enclosingBlock(html, fragment, match.index));
      }
    } else if (DOWNLOAD_HOST.test(href) && (rest === '' || rest.startsWith('(') || FILM_MEDIA_WORD.test(rest))) {
      downloads.push({ url: href, label: downloadLabel(text) });
      removals.push(enclosingBlock(html, fragment, match.index));
    } else {
      continue;
    }
    if (firstActionIndex === -1 || match.index < firstActionIndex) {
      firstActionIndex = match.index;
    }
  }

  // Pass 2 — the poster figure: named like a плакат, or adjacent above the
  // first download/плакат anchor (the legacy action column starts with it).
  for (const match of html.matchAll(FIGURE_BLOCK)) {
    const figure = match[0];
    const img = figure.match(/<img\b[^>]*>/i)?.[0];
    const src = img ? attr(img, 'src') : null;
    if (!src) {
      continue;
    }
    const named = POSTER_NAME.test(decodeURIComponent(src));
    const figureEnd = match.index + figure.length;
    const adjacent =
      firstActionIndex !== -1 && figureEnd <= firstActionIndex && firstActionIndex - figureEnd < POSTER_PROXIMITY;
    if (!named && !adjacent) {
      continue;
    }
    const link = figure.match(/<a\b[^>]*>/i)?.[0];
    const href = link ? attr(link, 'href') : null;
    // The figure link can itself point at a sized variant — always strip.
    posterImageUrl = (href && IMAGE_FILE.test(href) ? href : src).replace(SIZED_VARIANT, '');
    posterAspectRatio = aspectRatioFromUrl(src);
    removals.push(figure);
    break;
  }

  // Some old posts have no poster figure but «Скачать постер» links straight
  // to the artwork file — use it for the card image too.
  if (!posterImageUrl && posterDownloadUrl && IMAGE_FILE.test(posterDownloadUrl)) {
    posterImageUrl = posterDownloadUrl.replace(SIZED_VARIANT, '');
  }

  let result = html;
  for (const fragment of removals) {
    result = result.replace(fragment, '');
  }

  return { html: result, posterImageUrl, posterAspectRatio, posterDownloadUrl, downloads };
};
