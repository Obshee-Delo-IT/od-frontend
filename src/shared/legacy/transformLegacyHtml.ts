import {
  applyEdits,
  attributeEquals,
  decodeEntities,
  encodeAttributeValue,
  findAttribute,
  findElementSpans,
  findTags,
  maskInertRegions,
  type Edit,
  type ElementSpan,
} from './html';
import { legacyRuntimeSource } from './legacyRuntime';
import type { LegacyDocument } from './types';

/**
 * The one pure function that turns a legacy WordPress page into the document we
 * serve from `/legacy/*` (LCP-005 … LCP-008, LCP-011).
 *
 * In fixed order:
 *
 * 1. **remove** `header#header`, `section#bottom`, `footer#footer` — never
 *    "keep only `#middle`". Measured, 40 of `/team/`'s 52 scripts and 52 of
 *    `/materials/plakati/`'s 64 sit *after* `</footer>`, and none inside any
 *    chrome element; keeping only the content section would throw away every
 *    `wp_footer` bootstrap, which is the exact interactivity the iframe exists
 *    to preserve (design D14);
 * 2. strip the counter, canonical, `og:url`, any upstream `<base>`, meta
 *    refresh and form `action` — each **per element**. A single greedy span
 *    over `<script>…needle…</script>` starts at the document's *first* script
 *    and swallowed 11 of 52 on `/team/` when it was measured;
 * 3. rewrite every navigational `href` that resolves to a legacy page onto our
 *    own origin, whatever shape it was written in, so the no-JS floor is
 *    complete;
 * 4. inject one `<base href>` with **no `target`** — a base target is the
 *    default browsing context for every link *and form* in the document, which
 *    would send an unrewritten link or an actionless form to the legacy origin
 *    in the visitor's top-level window;
 * 5. append the injected runtime (height reporter, click and submit handling).
 *
 * Idempotent by construction (invariant 14): the chrome is already gone, the
 * rewritten links no longer resolve to the legacy origin, the `<base>` is
 * stripped and re-injected at the same position, and the runtime is marked so
 * it is added once.
 */

export interface TransformOptions {
  /** The origin the document came from, e.g. `https://obshee-delo.ru`. */
  origin: string;
  /** The page's own path on that origin, e.g. `/materials/plakati/`. */
  path: string;
  /** Our origin — where in-content navigation must land. */
  siteOrigin: string;
}

export interface TransformResult extends LegacyDocument {
  /**
   * `section#middle` was not found. Informational only: since the transform
   * removes chrome rather than keeping the content section, a page without it
   * still renders correctly. It is the falsifier for ASM1, logged per path.
   */
  boundaryMiss: boolean;
  /**
   * Chrome elements left in place because their closing tag never arrived —
   * better a duplicated legacy header than a truncated document.
   */
  unbalanced: string[];
}

const CHROME = [
  { tag: 'header', id: 'header' },
  { tag: 'section', id: 'bottom' },
  { tag: 'footer', id: 'footer' },
] as const;

/** Paths that must keep resolving to the legacy origin: assets and downloads. */
const ASSET_PATH = /^\/(?:wp-content|wp-includes|wp-json)\//i;

/** Marks our own injected script so a second pass does not add another. */
const RUNTIME_MARKER = 'data-od-legacy-runtime';

interface ChromeResult {
  html: string;
  unbalanced: string[];
}

const removeChrome = (html: string): ChromeResult => {
  const mask = maskInertRegions(html);
  const unbalanced: string[] = [];
  const spans: ElementSpan[] = [];

  for (const { tag, id } of CHROME) {
    const span = findElementSpans(mask, tag).find((candidate) => attributeEquals(candidate.openTag, 'id', id));
    if (span) {
      spans.push(span);
      continue;
    }
    // An opening tag with no matching span means depth counting never got back
    // to zero. Absent entirely — a chromeless frozen-copy template — is fine
    // and silent.
    if (findTags(mask, tag).some((candidate) => attributeEquals(candidate.text, 'id', id))) {
      unbalanced.push(`${tag}#${id}`);
    }
  }

  // Drop any span contained in another, so a nested chrome element is removed
  // by its parent rather than fighting it for the same range.
  const outermost = spans.filter(
    (span) => !spans.some((other) => other !== span && other.start <= span.start && other.end >= span.end)
  );

  const edits: Edit[] = outermost.map((span) => ({ start: span.start, end: span.end, replacement: '' }));
  return { html: applyEdits(html, edits), unbalanced };
};

const stripElements = (html: string): string => {
  const mask = maskInertRegions(html);
  const edits: Edit[] = [];
  const remove = (start: number, end: number): void => {
    edits.push({ start, end, replacement: '' });
  };

  for (const span of findElementSpans(mask, 'script')) {
    const whole = html.slice(span.start, span.end);
    const body = html.slice(span.openTagEnd, span.end);
    // `\bym\(` rather than the bare substring: `everym(` and `displaym(` are
    // ordinary identifiers and must survive.
    if (/mc\.yandex\.ru/i.test(whole) || /\bym\(/.test(body)) {
      remove(span.start, span.end);
    }
  }

  for (const span of findElementSpans(mask, 'noscript')) {
    if (/mc\.yandex\.ru/i.test(html.slice(span.start, span.end))) {
      remove(span.start, span.end);
    }
  }

  for (const tag of findTags(mask, 'link')) {
    if (attributeEquals(tag.text, 'rel', 'canonical')) {
      remove(tag.start, tag.end);
    }
  }

  for (const tag of findTags(mask, 'meta')) {
    if (attributeEquals(tag.text, 'property', 'og:url') || attributeEquals(tag.text, 'http-equiv', 'refresh')) {
      remove(tag.start, tag.end);
    }
  }

  // Ours is injected afterwards, so exactly one survives.
  for (const tag of findTags(mask, 'base')) {
    remove(tag.start, tag.end);
  }

  for (const tag of findTags(mask, 'form')) {
    const action = findAttribute(tag.text, 'action');
    if (!action) {
      continue;
    }
    // Take the separating space with it, so the tag does not end up with a
    // double space where the attribute was.
    const leading = tag.text[action.start - 1] === ' ' ? 1 : 0;
    remove(tag.start + action.start - leading, tag.start + action.end);
  }

  return applyEdits(html, edits);
};

/**
 * The new value for one `href`, or `null` to leave it exactly as written.
 *
 * Every shape is resolved against the page's own legacy URL — the same
 * resolution the browser would do — so document-relative (`../about/`) and
 * query-only (`?p=2`) links are covered, not just rooted ones. Rewriting only
 * rooted hrefs was the round-3 design, and it left `<a href="../about/">`
 * navigating the frame to the legacy origin whenever scripting was unavailable.
 */
const rewriteHref = (value: string, pageUrl: URL, siteOrigin: string): string | null => {
  const written = value.trim();
  if (written.startsWith('#')) {
    // An in-document fragment is correct as written, with or without scripting.
    return null;
  }

  let url: URL;
  try {
    url = new URL(written, pageUrl);
  } catch (_error) {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null; // mailto:, tel:, javascript: — not navigation we own
  }
  if (url.origin !== pageUrl.origin) {
    return null; // third party, including protocol-relative `//host/…`
  }
  if (ASSET_PATH.test(url.pathname)) {
    return null; // a download that must stay on the legacy origin
  }
  if (url.hash && url.pathname === pageUrl.pathname && url.search === '') {
    // A link to *this* page plus a fragment, however it was written. Normalised
    // to fragment-only so it stays in the frame: rewriting it to the site URL
    // would turn an in-page scroll into a full navigation.
    return url.hash;
  }
  return `${siteOrigin}${url.pathname}${url.search}${url.hash}`;
};

const rewriteAnchors = (html: string, pageUrl: URL, siteOrigin: string): string => {
  const mask = maskInertRegions(html);
  const edits: Edit[] = [];

  for (const tagName of ['a', 'area']) {
    for (const tag of findTags(mask, tagName)) {
      const href = findAttribute(tag.text, 'href');
      if (!href || href.valueStart < 0) {
        continue;
      }
      const next = rewriteHref(href.value, pageUrl, siteOrigin);
      if (next === null) {
        continue;
      }
      edits.push({
        start: tag.start + href.valueStart,
        end: tag.start + href.valueEnd,
        replacement: encodeAttributeValue(next),
      });
    }
  }

  return applyEdits(html, edits);
};

/**
 * One `<base href>`, no `target`.
 *
 * This is what makes every relative reference in the document — root-relative,
 * document-relative, inside `srcset`, inside `url()` in an inline style —
 * resolve against the legacy origin without the transform having to enumerate a
 * single asset attribute. The alternative (rewriting each attribute) was built
 * first and is where the bodies were buried: two chained global replaces cancel
 * each other, and document-relative references were still missed.
 */
const injectBase = (html: string, pageUrl: URL): string => {
  const base = `<base href="${encodeAttributeValue(`${pageUrl.origin}${pageUrl.pathname}`)}">`;
  const mask = maskInertRegions(html);
  const anchor = findTags(mask, 'head')[0] ?? findTags(mask, 'html')[0];
  if (!anchor) {
    return base + html;
  }
  return html.slice(0, anchor.end) + base + html.slice(anchor.end);
};

const injectRuntime = (html: string, options: TransformOptions): string => {
  if (html.includes(RUNTIME_MARKER)) {
    return html;
  }
  const source = legacyRuntimeSource({ legacyOrigin: options.origin, siteOrigin: options.siteOrigin });
  const script = `<script ${RUNTIME_MARKER}>${source}</script>`;
  const mask = maskInertRegions(html).toLowerCase();
  const close = mask.lastIndexOf('</body>');
  return close < 0 ? html + script : html.slice(0, close) + script + html.slice(close);
};

const parseTitle = (html: string, mask: string): string | null => {
  const span = findElementSpans(mask, 'title')[0];
  if (!span) {
    return null;
  }
  return decodeEntities(html.slice(span.openTagEnd, span.closeTagStart)).trim() || null;
};

const parseDescription = (mask: string): string | null => {
  for (const tag of findTags(mask, 'meta')) {
    if (!attributeEquals(tag.text, 'name', 'description')) {
      continue;
    }
    // Read by name, so `<meta content="…" name="description">` — the order some
    // SEO plugins emit — is found just as readily.
    const content = findAttribute(tag.text, 'content');
    return content?.value.trim() || null;
  }
  return null;
};

/** Everything between `<body …>` and `</body>`, for the "never empty" invariant. */
const bodyContent = (html: string, mask: string): string | null => {
  const span = findElementSpans(mask, 'body')[0];
  return span ? html.slice(span.openTagEnd, span.closeTagStart) : null;
};

export const transformLegacyHtml = (html: string, options: TransformOptions): TransformResult => {
  const sourceMask = maskInertRegions(html);
  const title = parseTitle(html, sourceMask);
  const description = parseDescription(sourceMask);
  const boundaryMiss = !findElementSpans(sourceMask, 'section').some((span) =>
    attributeEquals(span.openTag, 'id', 'middle')
  );

  const pageUrl = new URL(encodeURI(options.path), options.origin);
  const chrome = removeChrome(html);

  // The transform must never hand back an empty body. Removal-based extraction
  // makes that all but impossible on a real page, but a document that is
  // *nothing but* chrome would do it, and an empty frame is worse than a
  // duplicated header.
  const stripped = bodyContent(chrome.html, maskInertRegions(chrome.html));
  const reduced = stripped !== null && stripped.trim() === '' ? html : chrome.html;

  let out = stripElements(reduced);
  out = rewriteAnchors(out, pageUrl, options.siteOrigin);
  out = injectBase(out, pageUrl);
  out = injectRuntime(out, options);

  return { html: out, title, description, boundaryMiss, unbalanced: chrome.unbalanced };
};
