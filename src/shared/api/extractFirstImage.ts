const IMG_TAG = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;

/**
 * Whether a src is an inline blob rather than a file this site can point at.
 *
 * Both forms appear in real bodies: a proper `data:` URI, and — on `/contacts/`,
 * four times — a **scheme-less** `image/png;base64,…`, which some editor or the
 * cmsms migration truncated. The second is the dangerous one: it looks relative,
 * so it resolves against the WordPress origin into a URL nothing answers, and
 * that is what an `og:image` then advertises.
 */
const isInlineBlob = (src: string): boolean => /^data:/i.test(src) || /;base64,/i.test(src);

/**
 * The first image in a WordPress body that is an actual file — inline blobs are
 * skipped rather than returned, since every caller wants something it can hand
 * to `next/image` or to a social crawler. Null when the body has none.
 */
export const extractFirstImage = (html: string | undefined | null, baseUrl?: string): string | null => {
  if (!html) {
    return null;
  }
  for (const match of html.matchAll(IMG_TAG)) {
    const src = match[1];
    if (!src || isInlineBlob(src)) {
      continue;
    }
    if (!baseUrl || /^(https?:)?\/\//i.test(src)) {
      return src;
    }
    return new URL(src, baseUrl).toString();
  }
  return null;
};
