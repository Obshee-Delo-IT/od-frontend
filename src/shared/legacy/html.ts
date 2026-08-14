import { decodeEntities } from '@/shared/lib/decodeEntities';

/**
 * The small HTML primitives the legacy transform is built from.
 *
 * A string rewriter rather than a DOM library, for the reasons in decision D5:
 * the repo already rewrites WordPress HTML this way (`resolveContentImages`),
 * `jsdom` is a Vitest-only dependency and promoting it to runtime for one route
 * is a lot of dependency for a narrow job, and the input is a single known
 * theme's markup rather than the open web.
 *
 * What makes that safe here is this file: every operation works off a **masked**
 * copy of the document in which the contents of `<script>`, `<style>` and
 * comments have been replaced by spaces of equal length. Indices into the mask
 * are therefore indices into the original, and tag-like text inside a script
 * (`var msg = "</footer>";`) or a comment can never be mistaken for markup.
 */

/**
 * Matches the remainder of a tag after its name, respecting quoted attribute
 * values so a `>` inside one does not end the tag early.
 *
 * The three alternatives are disjoint by first character — `[^>"']` excludes
 * both quotes — so this cannot backtrack exponentially.
 */
const TAG_TAIL = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`;

/** Re-encode a value we computed so it is safe inside a double-quoted attribute. */
export const encodeAttributeValue = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const blank = (length: number): string => ' '.repeat(Math.max(0, length));

/**
 * A copy of the document with the *contents* of comments, `<script>` and
 * `<style>` replaced by spaces, preserving every index.
 *
 * This is what stops `var msg = "</footer>";` from ending the footer element,
 * and `<!-- <section> -->` from opening one.
 */
export const maskInertRegions = (html: string): string => {
  const lower = html.toLowerCase();
  let out = '';
  let index = 0;

  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, open);

    if (lower.startsWith('<!--', open)) {
      const close = lower.indexOf('-->', open + 4);
      const end = close < 0 ? html.length : close + 3;
      out += blank(end - open);
      index = end;
      continue;
    }

    const raw = /^<(script|style)\b/.exec(lower.slice(open, open + 8));
    if (raw) {
      const openTagEnd = html.indexOf('>', open);
      if (openTagEnd < 0) {
        out += html.slice(open);
        break;
      }
      // Per the HTML spec a raw-text element ends at the first `</script` /
      // `</style` whatever the JS or CSS around it looks like, so this is the
      // browser's own rule rather than an approximation of it.
      const close = lower.indexOf(`</${raw[1]}`, openTagEnd + 1);
      if (close < 0) {
        out += html.slice(open, openTagEnd + 1) + blank(html.length - openTagEnd - 1);
        break;
      }
      out += html.slice(open, openTagEnd + 1) + blank(close - openTagEnd - 1);
      index = close;
      continue;
    }

    out += '<';
    index = open + 1;
  }

  return out;
};

export interface ElementSpan {
  /** Index of the `<` that opens the element. */
  start: number;
  /** Index just past the `>` that closes it. */
  end: number;
  /** Index just past the opening tag's own `>`. */
  openTagEnd: number;
  /** Index of the `<` that begins the closing tag — the end of the content. */
  closeTagStart: number;
  /** The opening tag, verbatim. */
  openTag: string;
}

/**
 * **Every** `<tag …>…</tag>` span, nested ones included, matched by keeping a
 * stack so an inner element of the same name cannot end its parent early.
 *
 * Nested spans are not an edge case here: the welfare theme wraps the whole
 * document in `<section id="page">`, so `section#middle` and `section#bottom` —
 * one of the three chrome elements — are *both* nested. A version of this that
 * returned only outermost spans found neither, and every assertion written
 * against it passed vacuously.
 *
 * Spans come out in closing order, so a child precedes its parent. An element
 * whose closing tag never arrives is not returned at all: the caller leaves it
 * in place rather than truncating the document at a guess.
 */
export const findElementSpans = (mask: string, tag: string): ElementSpan[] => {
  const pattern = new RegExp(`<(/?)${tag}\\b${TAG_TAIL}>`, 'gi');
  const spans: ElementSpan[] = [];
  const open: Array<{ start: number; openTagEnd: number }> = [];

  for (let match = pattern.exec(mask); match !== null; match = pattern.exec(mask)) {
    if (match[1] === '/') {
      const element = open.pop();
      if (!element) {
        continue; // a stray closing tag; nothing is open to close
      }
      spans.push({
        start: element.start,
        end: match.index + match[0].length,
        openTagEnd: element.openTagEnd,
        closeTagStart: match.index,
        // Tags are byte-identical in the mask (only *contents* are blanked),
        // so slicing the mask here yields the source's own opening tag.
        openTag: mask.slice(element.start, element.openTagEnd),
      });
      continue;
    }
    if (match[0].endsWith('/>')) {
      continue; // self-closing: it never opens anything
    }
    open.push({ start: match.index, openTagEnd: match.index + match[0].length });
  }

  return spans;
};

export interface TagSpan {
  start: number;
  end: number;
  /** The tag text, verbatim. */
  text: string;
}

/** Every occurrence of a standalone tag — `<meta …>`, `<link …>`, `<base …>`, `<a …>`. */
export const findTags = (mask: string, tag: string): TagSpan[] => {
  const pattern = new RegExp(`<${tag}\\b${TAG_TAIL}>`, 'gi');
  const spans: TagSpan[] = [];
  for (let match = pattern.exec(mask); match !== null; match = pattern.exec(mask)) {
    spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return spans;
};

interface AttributeMatch {
  /** Index of the attribute name within the tag text. */
  start: number;
  /** Index just past the attribute (name, or name plus value). */
  end: number;
  /** Index of the raw value within the tag text, or `-1` when there is none. */
  valueStart: number;
  valueEnd: number;
  /** The value with entities decoded; `''` for a valueless attribute. */
  value: string;
}

/**
 * Find one attribute in a tag, tolerating single quotes, no quotes and spaces
 * around the `=` — LCP-011 requires all three to be recognised.
 *
 * The lookbehind is what keeps `href` from matching inside `data-href`.
 */
export const findAttribute = (tag: string, name: string): AttributeMatch | null => {
  const pattern = new RegExp(`(?<=^|[\\s/])${name}(\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s"'>\`]*)`, 'i');
  const match = pattern.exec(tag);
  if (!match) {
    // A valueless attribute (`<form action>` — rare, but it is still an action).
    const bare = new RegExp(`(?<=^|[\\s/])${name}(?=[\\s/>]|$)`, 'i').exec(tag);
    if (!bare) {
      return null;
    }
    return { start: bare.index, end: bare.index + bare[0].length, valueStart: -1, valueEnd: -1, value: '' };
  }

  const rawValue = match[2];
  const quoted = rawValue.startsWith('"') || rawValue.startsWith("'");
  const valueStart = match.index + name.length + match[1].length + (quoted ? 1 : 0);
  const inner = quoted ? rawValue.slice(1, -1) : rawValue;

  return {
    start: match.index,
    end: match.index + match[0].length,
    valueStart,
    valueEnd: valueStart + inner.length,
    value: decodeEntities(inner),
  };
};

/** Case-insensitive equality against an attribute's decoded value. */
export const attributeEquals = (tag: string, name: string, expected: string): boolean => {
  const attribute = findAttribute(tag, name);
  return attribute !== null && attribute.value.trim().toLowerCase() === expected.toLowerCase();
};

export interface Edit {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Apply non-overlapping edits to a string in one pass.
 *
 * Edits are computed against indices in the *input*, so they are applied back
 * to front; overlapping edits are a programming error and the later one wins
 * silently only because there is no sensible alternative at this level.
 */
export const applyEdits = (source: string, edits: readonly Edit[]): string => {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  let previousStart = source.length;
  for (const edit of ordered) {
    if (edit.end > previousStart) {
      continue;
    }
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    previousStart = edit.start;
  }
  return out;
};
