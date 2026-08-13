import { describe, expect, it } from 'vitest';
import { fixtureNames, loadFixture, type LegacyFixtureName } from './__fixtures__/load';
import { attributeEquals, findElementSpans, findTags, maskInertRegions } from './html';

/**
 * The measured properties of the captures, asserted as invariants of the
 * fixtures themselves.
 *
 * Every number the design argues from lives here, so a re-capture that changes
 * one fails loudly instead of quietly invalidating a decision. In particular
 * **ASM8** — no `wp_footer` script sits inside a chrome element — is the whole
 * justification for removing chrome rather than keeping `section#middle`, and
 * it is falsified here rather than in production.
 */

interface Measurements {
  bytes: number;
  /** `<script` occurrences, including six inside a `document.write` string. */
  rawScripts: number;
  /** Actual script *elements*, which is what the browser sees. */
  scriptElements: number;
  /** Elements that follow `</footer>` — the `wp_footer` bootstraps. */
  afterFooter: number;
  /** Live stylesheets; four more sit inside `<!--[if lte IE 9]>` comments. */
  stylesheets: number;
  inlineStyles: number;
  downloads: number;
  metricaReferences: number;
}

const EXPECTED: Record<LegacyFixtureName, Measurements> = {
  team: {
    bytes: 85_641,
    rawScripts: 52,
    scriptElements: 46,
    afterFooter: 34,
    stylesheets: 26,
    inlineStyles: 12,
    downloads: 1,
    metricaReferences: 2,
  },
  plakati: {
    bytes: 128_143,
    rawScripts: 64,
    scriptElements: 58,
    afterFooter: 46,
    stylesheets: 26,
    inlineStyles: 12,
    downloads: 33,
    metricaReferences: 2,
  },
  faq: {
    bytes: 110_550,
    rawScripts: 60,
    scriptElements: 54,
    afterFooter: 42,
    stylesheets: 26,
    inlineStyles: 12,
    downloads: 4,
    metricaReferences: 2,
  },
};

const CHROME = [
  ['header', 'header'],
  ['section', 'bottom'],
  ['footer', 'footer'],
] as const;

describe('legacy fixtures', () => {
  it.each(fixtureNames)('%s matches its recorded measurements', (name) => {
    const html = loadFixture(name);
    const mask = maskInertRegions(html);
    const expected = EXPECTED[name];

    // Bytes on disk, not string length: these pages are mostly Cyrillic, so the
    // two differ by about 20 %.
    expect(Buffer.byteLength(html, 'utf8')).toBe(expected.bytes);
    expect(html.match(/<script\b/gi) ?? []).toHaveLength(expected.rawScripts);
    expect(findElementSpans(mask, 'script')).toHaveLength(expected.scriptElements);
    expect(findTags(mask, 'link').filter((tag) => attributeEquals(tag.text, 'rel', 'stylesheet'))).toHaveLength(
      expected.stylesheets
    );
    expect(findElementSpans(mask, 'style')).toHaveLength(expected.inlineStyles);
    expect(html.match(/href="\/wp-content\//g) ?? []).toHaveLength(expected.downloads);
    expect(html.match(/mc\.yandex\.ru/g) ?? []).toHaveLength(expected.metricaReferences);
  });

  it.each(fixtureNames)('%s carries exactly one of each DOM boundary', (name) => {
    const mask = maskInertRegions(loadFixture(name));

    for (const [tag, id] of [...CHROME, ['section', 'middle'] as const]) {
      expect(findElementSpans(mask, tag).filter((span) => attributeEquals(span.openTag, 'id', id))).toHaveLength(1);
    }
  });

  /**
   * ASM8, measured. If this ever fails, removing chrome starts costing
   * interactivity and the design's central decision needs revisiting — which is
   * exactly the signal this assertion exists to give.
   */
  it.each(fixtureNames)('%s has no script inside any chrome element', (name) => {
    const html = loadFixture(name);
    const mask = maskInertRegions(html);

    const chrome = CHROME.map(([tag, id]) =>
      findElementSpans(mask, tag).find((span) => attributeEquals(span.openTag, 'id', id))
    ).filter((span): span is NonNullable<typeof span> => span !== undefined);
    expect(chrome).toHaveLength(3);

    const inside = findElementSpans(mask, 'script').filter((script) =>
      chrome.some((span) => script.start >= span.start && script.end <= span.end)
    );

    expect(inside).toHaveLength(0);
  });

  /**
   * The other half of D14: the great majority of scripts sit *after* the footer
   * closes, so a keep-only-`#middle` transform would discard them.
   */
  it.each(fixtureNames)('%s puts most of its scripts after the footer', (name) => {
    const html = loadFixture(name);
    const mask = maskInertRegions(html);
    const footer = findElementSpans(mask, 'footer').find((span) => attributeEquals(span.openTag, 'id', 'footer'));

    expect(footer).toBeDefined();
    const after = findElementSpans(mask, 'script').filter((script) => script.start >= footer!.end);
    expect(after).toHaveLength(EXPECTED[name].afterFooter);
    expect(after.length / EXPECTED[name].scriptElements).toBeGreaterThan(0.7);
  });

  it.each(fixtureNames)('%s has no meta description, so the fallback must cope without one', (name) => {
    const mask = maskInertRegions(loadFixture(name));
    expect(findTags(mask, 'meta').filter((tag) => attributeEquals(tag.text, 'name', 'description'))).toHaveLength(0);
  });
});
