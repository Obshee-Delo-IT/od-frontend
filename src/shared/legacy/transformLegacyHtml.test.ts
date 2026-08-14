import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fixtureNames, LEGACY_FIXTURES, loadFixture, type LegacyFixtureName } from './__fixtures__/load';
import { attributeEquals, findAttribute, findElementSpans, findTags, maskInertRegions } from './html';
import { transformLegacyHtml } from './transformLegacyHtml';

const LEGACY = 'https://obshee-delo.ru';
const SITE = 'https://od.example';

const run = (name: LegacyFixtureName) =>
  transformLegacyHtml(loadFixture(name), { origin: LEGACY, path: LEGACY_FIXTURES[name].path, siteOrigin: SITE });

const scriptSources = (html: string): Set<string> => {
  const mask = maskInertRegions(html);
  const sources = new Set<string>();
  for (const span of findElementSpans(mask, 'script')) {
    const src = findAttribute(span.openTag, 'src');
    if (src?.value) {
      sources.add(src.value);
    }
  }
  return sources;
};

const countTags = (html: string, tag: string): number => findTags(maskInertRegions(html), tag).length;

const anchorHrefs = (html: string): string[] => {
  const mask = maskInertRegions(html);
  return findTags(mask, 'a')
    .concat(findTags(mask, 'area'))
    .map((tag) => findAttribute(tag.text, 'href'))
    .filter((href): href is NonNullable<typeof href> => Boolean(href) && href!.valueStart >= 0)
    .map((href) => href.value);
};

/** The base element the browser will resolve every relative reference against. */
const baseHref = (html: string): string | null => {
  const tag = findTags(maskInertRegions(html), 'base')[0];
  return tag ? (findAttribute(tag.text, 'href')?.value ?? null) : null;
};

describe('transformLegacyHtml — chrome removal (LCP-005)', () => {
  it.each(fixtureNames)('removes all three chrome elements from %s', (name) => {
    const { html } = run(name);
    const mask = maskInertRegions(html);

    expect(findElementSpans(mask, 'header').some((s) => attributeEquals(s.openTag, 'id', 'header'))).toBe(false);
    expect(findElementSpans(mask, 'section').some((s) => attributeEquals(s.openTag, 'id', 'bottom'))).toBe(false);
    expect(findElementSpans(mask, 'footer').some((s) => attributeEquals(s.openTag, 'id', 'footer'))).toBe(false);
  });

  it.each(fixtureNames)('keeps the content section of %s', (name) => {
    const { html, boundaryMiss } = run(name);
    expect(boundaryMiss).toBe(false);
    expect(
      findElementSpans(maskInertRegions(html), 'section').some((s) => attributeEquals(s.openTag, 'id', 'middle'))
    ).toBe(true);
  });

  /**
   * The load-bearing assertion of this whole change. Keeping only `#middle`
   * would drop the 40-of-52 scripts that sit after `</footer>`, i.e. every
   * `wp_footer` bootstrap — the interactivity the iframe exists to preserve.
   */
  it.each(fixtureNames)('loses no external script from %s except the counter', (name) => {
    const source = loadFixture(name);
    const { html } = run(name);

    const lost = [...scriptSources(source)].filter((src) => !scriptSources(html).has(src));
    expect(lost.filter((src) => !src.includes('mc.yandex.ru'))).toEqual([]);
  });

  it.each(fixtureNames)('keeps every stylesheet and inline style of %s', (name) => {
    const source = loadFixture(name);
    const { html } = run(name);

    /** Live stylesheets — the four inside `<!--[if lte IE 9]>` do not count. */
    const live = (doc: string) =>
      findTags(maskInertRegions(doc), 'link').filter((tag) => attributeEquals(tag.text, 'rel', 'stylesheet')).length;
    /** Every occurrence, conditional comments included, so none is lost either. */
    const written = (doc: string) => (doc.match(/rel=['"]stylesheet/g) ?? []).length;

    expect(live(html)).toBe(live(source));
    expect(live(html)).toBe(26);
    expect(written(html)).toBe(written(source));
    expect(written(html)).toBe(30);

    // `<head>` keeps all seven of its inline styles. The body has five more, of
    // which two style the chrome and go with it — that is the removal working,
    // not a loss. The eleventh is ours, appended last.
    const headStyles = (doc: string) => countTags(doc.slice(0, doc.toLowerCase().indexOf('</head>')), 'style');
    expect(headStyles(source)).toBe(7);
    expect(headStyles(html)).toBe(7);
    expect(countTags(source, 'style')).toBe(12);
    expect(countTags(html, 'style')).toBe(11);
  });

  it.each(fixtureNames)('never returns an empty body for %s', (name) => {
    const { html } = run(name);
    const span = findElementSpans(maskInertRegions(html), 'body')[0];
    expect(span).toBeDefined();
    expect(html.slice(span.openTagEnd, span.closeTagStart).trim().length).toBeGreaterThan(1000);
  });

  it('leaves an unbalanced chrome element in place rather than truncating', () => {
    const source = '<html><body><header id="header"><div>chrome<section id="middle">content</section></body></html>';
    const { html, unbalanced } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(unbalanced).toEqual(['header#header']);
    expect(html).toContain('chrome');
    expect(html).toContain('content');
  });

  it('is silent when a chrome element is simply absent', () => {
    const source = '<html><head></head><body><section id="middle">only content</section></body></html>';
    const { html, unbalanced, boundaryMiss } = transformLegacyHtml(source, {
      origin: LEGACY,
      path: '/x/',
      siteOrigin: SITE,
    });

    expect(unbalanced).toEqual([]);
    expect(boundaryMiss).toBe(false);
    expect(html).toContain('only content');
  });

  it('reports a boundary miss but still renders when there is no content section', () => {
    const source = '<html><body><footer id="footer">chrome</footer><div>real content</div></body></html>';
    const { html, boundaryMiss } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(boundaryMiss).toBe(true);
    expect(html).toContain('real content');
    expect(html).not.toContain('chrome');
  });

  it('keeps the document rather than emptying the body when it is nothing but chrome', () => {
    const source = '<html><body><footer id="footer">everything</footer></body></html>';
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).toContain('everything');
  });

  it('is not fooled by tag-like text inside a script, a style or a comment', () => {
    const source = [
      '<html><body>',
      '<footer id="footer">',
      '<script>var msg = "</footer>";</script>',
      '<style>#middle > div { color: red }</style>',
      '<!-- <section id="middle"> -->',
      '</footer>',
      '<section id="middle">survivor</section>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).toContain('survivor');
    expect(html).not.toContain('var msg');
    expect(html).not.toContain('color: red');
  });
});

describe('transformLegacyHtml — element-level strips (LCP-007)', () => {
  it.each(fixtureNames)('removes the counter, canonical and og:url from %s', (name) => {
    const { html } = run(name);

    expect(html).not.toMatch(/mc\.yandex\.ru/i);
    expect(html).not.toMatch(/\bym\(/);
    expect(findTags(maskInertRegions(html), 'link').some((t) => attributeEquals(t.text, 'rel', 'canonical'))).toBe(
      false
    );
    expect(findTags(maskInertRegions(html), 'meta').some((t) => attributeEquals(t.text, 'property', 'og:url'))).toBe(
      false
    );
  });

  it.each(fixtureNames)('removes every form action from %s', (name) => {
    const source = loadFixture(name);
    const { html } = run(name);
    const withAction = (doc: string) =>
      findTags(maskInertRegions(doc), 'form').filter((form) => findAttribute(form.text, 'action') !== null);

    // The upstream page really does carry one — the theme's search form posts
    // to the legacy origin — so the assertion below is not vacuous.
    expect(withAction(source).length).toBeGreaterThan(0);
    expect(withAction(html)).toEqual([]);
  });

  /**
   * The prototype's greedy `<script>…mc.yandex.ru…</script>` span started at the
   * document's *first* script and swallowed 11 of `/team/`'s 52. Every strip is
   * per element for exactly this reason.
   */
  it('removes only the matching script, not the span from the first one', () => {
    const source = [
      '<html><body>',
      '<script src="/a.js"></script>',
      '<script src="/b.js"></script>',
      '<script>ym(123, "init", {});</script>',
      '<script src="/c.js"></script>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(scriptSources(html)).toEqual(new Set(['/a.js', '/b.js', '/c.js']));
  });

  it('keeps a script that merely looks like the counter', () => {
    const source = '<html><body><script>var n = everym(1); displaym(2);</script></body></html>';
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).toContain('everym(1)');
  });

  it('removes a meta refresh, whatever the quoting', () => {
    const source = `<html><head><meta http-equiv='refresh' content="0;url=https://elsewhere.example/"></head><body>x</body></html>`;
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).not.toMatch(/http-equiv/i);
  });

  it('removes an unquoted and a space-padded form action', () => {
    const source = `<html><body><form action = 'https://obshee-delo.ru' role=search></form><form action=/go/></form></body></html>`;
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(findTags(maskInertRegions(html), 'form').filter((f) => findAttribute(f.text, 'action'))).toEqual([]);
    expect(html).toContain('role=search');
  });

  it('leaves a document with nothing to strip alone', () => {
    const source = '<html><head></head><body><p>plain</p></body></html>';
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).toContain('<p>plain</p>');
  });
});

describe('transformLegacyHtml — base element (LCP-006)', () => {
  it.each(fixtureNames)('injects exactly one base, with no target, into %s', (name) => {
    const { html } = run(name);
    const bases = findTags(maskInertRegions(html), 'base');

    expect(bases).toHaveLength(1);
    expect(findAttribute(bases[0].text, 'target')).toBeNull();
    expect(baseHref(html)).toBe(`${LEGACY}${LEGACY_FIXTURES[name].path}`);
  });

  it('replaces an upstream base rather than adding a second', () => {
    const source = '<html><head><base href="https://elsewhere.example/" target="_top"></head><body>x</body></html>';
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(findTags(maskInertRegions(html), 'base')).toHaveLength(1);
    expect(baseHref(html)).toBe(`${LEGACY}/x/`);
    expect(html).not.toContain('_top');
  });

  it.each(fixtureNames)('leaves asset references in %s untouched, whatever their shape', (name) => {
    const source = loadFixture(name);
    const { html } = run(name);

    // Counted on the transformed document: the base element is what resolves
    // these, so rewriting any of them would be the bug.
    const rooted = (doc: string) => (doc.match(/src="\/wp-content\//g) ?? []).length;
    const srcsets = (doc: string) => (doc.match(/srcset=/g) ?? []).length;

    expect(rooted(html)).toBe(rooted(source));
    expect(srcsets(html)).toBe(srcsets(source));
    expect(html).not.toContain(`${SITE}/wp-content/`);
  });

  it.each(fixtureNames)('is a fixed point over %s', (name) => {
    const once = run(name).html;
    const twice = transformLegacyHtml(once, {
      origin: LEGACY,
      path: LEGACY_FIXTURES[name].path,
      siteOrigin: SITE,
    }).html;

    expect(twice).toBe(once);
  });
});

describe('transformLegacyHtml — navigation rewriting (LCP-011)', () => {
  /**
   * The invariant, asserted the way a browser would see it: resolve every
   * emitted `href` against the document's own base URL and check that none of
   * them lands on a legacy *page*.
   */
  it.each(fixtureNames)('leaves no anchor in %s resolving to a legacy page', (name) => {
    const { html } = run(name);
    const base = baseHref(html);
    expect(base).not.toBeNull();

    const self = new URL(base!);
    const leaking = anchorHrefs(html)
      .map((href) => {
        try {
          return new URL(href, base!);
        } catch (_error) {
          return null;
        }
      })
      .filter((url): url is URL => url !== null)
      .filter((url) => url.origin === LEGACY)
      // Downloads are the deliberate exception, and a link that resolves to
      // *this* document plus a fragment never leaves it — the injected handler
      // scrolls it, and without scripting the browser does.
      .filter((url) => !/^\/(?:wp-content|wp-includes|wp-json)\//i.test(url.pathname))
      .filter((url) => !(url.pathname === self.pathname && url.search === self.search));

    expect(leaking.map((url) => url.href)).toEqual([]);
  });

  /**
   * Each capture carries exactly one `/wp-content/` link inside the footer,
   * which leaves with the footer — so the content's own downloads are the
   * source count minus one. `/materials/plakati/` is the page that matters: 33
   * captured, 32 in the content, and every one of them must still address the
   * legacy origin rather than ours, where it would 404.
   */
  it.each([
    ['team', 1, 0],
    ['plakati', 33, 32],
    ['faq', 4, 3],
  ] as const)('keeps the content downloads of %s on the legacy origin', (name, captured, kept) => {
    const source = loadFixture(name);
    const { html } = run(name);
    const downloads = (doc: string) => anchorHrefs(doc).filter((href) => href.startsWith('/wp-content/'));

    expect(downloads(source)).toHaveLength(captured);
    expect(downloads(html)).toHaveLength(kept);
    expect(html).not.toContain(`${SITE}/wp-content/`);
  });

  it('rewrites every shape a page link can be written in', () => {
    const source = [
      '<html><body>',
      '<a href="/contacts/">rooted</a>',
      '<a href="https://obshee-delo.ru/contacts/">absolute</a>',
      '<a href="../about/">relative</a>',
      '<a href="?tab=1">query only</a>',
      '<a href="">empty</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/materials/plakati/', siteOrigin: SITE });

    expect(anchorHrefs(html)).toEqual([
      `${SITE}/contacts/`,
      `${SITE}/contacts/`,
      `${SITE}/materials/about/`,
      `${SITE}/materials/plakati/?tab=1`,
      `${SITE}/materials/plakati/`,
    ]);
  });

  it('leaves fragment-only links alone and normalises same-page fragments', () => {
    const source = [
      '<html><body>',
      '<a href="#comments">fragment</a>',
      '<a href="#">bare</a>',
      '<a href="/team/#section">same page, rooted</a>',
      '<a href="https://obshee-delo.ru/team/#section">same page, absolute</a>',
      '<a href="/other/#section">another page</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(anchorHrefs(html)).toEqual(['#comments', '#', '#section', '#section', `${SITE}/other/#section`]);
  });

  it('leaves non-navigational schemes and third parties alone', () => {
    const source = [
      '<html><body>',
      '<a href="mailto:info@example.org">mail</a>',
      '<a href="tel:+7495">phone</a>',
      '<a href="javascript:void(0)">js</a>',
      '<a href="https://vk.com/obshedelo">vk</a>',
      '<a href="//i.ytimg.com/x.jpg">protocol relative</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(anchorHrefs(html)).toEqual([
      'mailto:info@example.org',
      'tel:+7495',
      'javascript:void(0)',
      'https://vk.com/obshedelo',
      '//i.ytimg.com/x.jpg',
    ]);
  });

  /**
   * A global `href=` rule also matches `<link rel="stylesheet" href="/css/x.css">`
   * and would send it to our origin, where it 404s and the page loses its
   * styling — the exact failure the base element exists to prevent.
   */
  it('rewrites anchors only, never another element carrying an href', () => {
    const source = [
      '<html><head>',
      '<link rel="stylesheet" href="/css/custom.css">',
      '<link rel="icon" href="/favicon.ico">',
      '</head><body>',
      '<a data-href="/decoy/" href="/real/">link</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(html).toContain('<link rel="stylesheet" href="/css/custom.css">');
    expect(html).toContain('<link rel="icon" href="/favicon.ico">');
    expect(html).toContain(`data-href="/decoy/" href="${SITE}/real/"`);
  });

  it('recognises single-quoted, unquoted and space-padded hrefs', () => {
    const source = [
      '<html><body>',
      `<a href='/single/'>a</a>`,
      '<a href=/unquoted/>b</a>',
      '<a href = "/padded/">c</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(anchorHrefs(html)).toEqual([`${SITE}/single/`, `${SITE}/unquoted/`, `${SITE}/padded/`]);
  });

  it('round-trips an encoded query without doubling its entities', () => {
    const source = '<html><body><a href="/search/?a=1&amp;b=2">q</a></body></html>';
    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(html).toContain(`href="${SITE}/search/?a=1&amp;b=2"`);
    expect(anchorHrefs(html)).toEqual([`${SITE}/search/?a=1&b=2`]);
  });
});

describe('transformLegacyHtml — injected runtime (LCP-008)', () => {
  it.each(fixtureNames)('appends exactly one runtime script to %s', (name) => {
    const { html } = run(name);
    expect(html.match(/data-od-legacy-runtime/g)).toHaveLength(1);
    expect(html.lastIndexOf('data-od-legacy-runtime')).toBeLessThan(html.lastIndexOf('</body>'));
  });

  it('carries no static overflow rule — suppression is the script\u2019s job', () => {
    const { html } = run('team');
    expect(html).not.toMatch(/overflow-y:\s*hidden\s*!important/i);
  });

  it('emits a parseable script', () => {
    const { html } = run('team');
    const span = findElementSpans(maskInertRegions(html), 'script')
      .filter((candidate) => candidate.openTag.includes('data-od-legacy-runtime'))
      .at(0);

    expect(span).toBeDefined();
    const source = html.slice(span!.openTagEnd, span!.closeTagStart);
    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('od:legacy-height');
    expect(source).toContain('https://od.example');
  });
});

describe('transformLegacyHtml — injected stylesheet', () => {
  const styleSource = (html: string): string => {
    const span = findElementSpans(maskInertRegions(html), 'style')
      .filter((candidate) => candidate.openTag.includes('data-od-legacy-style'))
      .at(0);
    expect(span).toBeDefined();
    return html.slice(span!.openTagEnd, span!.closeTagStart);
  };

  it.each(fixtureNames)('appends exactly one stylesheet to %s, last in the document', (name) => {
    const { html } = run(name);
    expect(html.match(/data-od-legacy-style/g)).toHaveLength(1);
    expect(html.lastIndexOf('data-od-legacy-style')).toBeLessThan(html.lastIndexOf('</body>'));
    // Every one of the theme's own inline styles is upstream of it, which is
    // what lets an unprefixed rule win without fighting specificity.
    const ours = html.indexOf('data-od-legacy-style');
    expect(findElementSpans(maskInertRegions(html), 'style').filter((span) => span.start > ours)).toHaveLength(0);
  });

  /** The header is gone, so its 130px of clearance is a strip of nothing. */
  it('zeroes the padding that cleared the removed header', () => {
    expect(styleSource(run('team').html)).toContain('#middle{padding-top:0!important}');
  });

  /**
   * Only the row, and only when it holds the form: the heading sits in the
   * row's other half, and hiding the form alone would strand «Хотите быть в
   * курсе…» above an empty column.
   */
  it('hides the newsletter row, heading included', () => {
    expect(styleSource(run('plakati').html)).toContain('.cmsms_row:has(.shortcode_wysija){display:none!important}');
  });

  it('is added once, not once per pass', () => {
    const once = run('team').html;
    const twice = transformLegacyHtml(once, { origin: LEGACY, path: '/team/', siteOrigin: SITE }).html;
    expect(twice.match(/data-od-legacy-style/g)).toHaveLength(1);
  });
});

describe('transformLegacyHtml — metadata (LPF-004)', () => {
  it('reads the title and decodes its entities', () => {
    expect(run('team').title).toBe('Команда организации — Общее дело');
    expect(run('plakati').title).toBe('Плакаты социальной рекламы — Общее дело');
    expect(run('faq').title).toBe('Частые вопросы — Общее дело');
  });

  it.each(fixtureNames)('reports no description for %s, which has none', (name) => {
    expect(run(name).description).toBeNull();
  });

  it('reads a description whichever order its attributes are in', () => {
    const ordered = '<html><head><meta name="description" content="Первый"></head><body>x</body></html>';
    const reversed = '<html><head><meta content="Второй &amp; третий" name="description"></head><body>x</body></html>';
    const options = { origin: LEGACY, path: '/x/', siteOrigin: SITE };

    expect(transformLegacyHtml(ordered, options).description).toBe('Первый');
    expect(transformLegacyHtml(reversed, options).description).toBe('Второй & третий');
  });

  it('treats a blank title or description as absent', () => {
    const source = '<html><head><title>   </title><meta name="description" content=""></head><body>x</body></html>';
    const { title, description } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(title).toBeNull();
    expect(description).toBeNull();
  });
});

/**
 * V18 — the golden check. A full HTML copy would be 270 KB of committed output
 * whose diffs are unreadable (the theme emits very long lines), so the snapshot
 * is a structural fingerprint plus a digest of the whole document: the digest
 * makes *any* byte change fail, and the fingerprint says which class of thing
 * moved.
 */
describe('transformLegacyHtml — golden fingerprint (V18)', () => {
  const fingerprint = (name: LegacyFixtureName) => {
    const { html, title, description, boundaryMiss, unbalanced } = run(name);
    const mask = maskInertRegions(html);
    return {
      digest: createHash('sha256').update(html).digest('hex').slice(0, 16),
      bytes: html.length,
      scripts: findElementSpans(mask, 'script').length,
      externalScripts: scriptSources(html).size,
      stylesheets: findTags(mask, 'link').filter((tag) => attributeEquals(tag.text, 'rel', 'stylesheet')).length,
      inlineStyles: findElementSpans(mask, 'style').length,
      anchors: anchorHrefs(html).length,
      siteLinks: anchorHrefs(html).filter((href) => href.startsWith(SITE)).length,
      downloads: anchorHrefs(html).filter((href) => href.startsWith('/wp-content/')).length,
      bases: findTags(mask, 'base').length,
      title,
      description,
      boundaryMiss,
      unbalanced,
    };
  };

  it('team', () => {
    expect(fingerprint('team')).toMatchInlineSnapshot(`
      {
        "anchors": 17,
        "bases": 1,
        "boundaryMiss": false,
        "bytes": 75552,
        "description": null,
        "digest": "3ff615473b612b6a",
        "downloads": 0,
        "externalScripts": 28,
        "inlineStyles": 11,
        "scripts": 46,
        "siteLinks": 3,
        "stylesheets": 26,
        "title": "Команда организации — Общее дело",
        "unbalanced": [],
      }
    `);
  });

  it('materials/plakati', () => {
    expect(fingerprint('plakati')).toMatchInlineSnapshot(`
      {
        "anchors": 52,
        "bases": 1,
        "boundaryMiss": false,
        "bytes": 117747,
        "description": null,
        "digest": "e690f26089c28971",
        "downloads": 32,
        "externalScripts": 38,
        "inlineStyles": 11,
        "scripts": 58,
        "siteLinks": 4,
        "stylesheets": 26,
        "title": "Плакаты социальной рекламы — Общее дело",
        "unbalanced": [],
      }
    `);
  });

  it('faq', () => {
    expect(fingerprint('faq')).toMatchInlineSnapshot(`
      {
        "anchors": 34,
        "bases": 1,
        "boundaryMiss": false,
        "bytes": 88286,
        "description": null,
        "digest": "cbda9ec4ee67643c",
        "downloads": 3,
        "externalScripts": 35,
        "inlineStyles": 11,
        "scripts": 54,
        "siteLinks": 1,
        "stylesheets": 26,
        "title": "Частые вопросы — Общее дело",
        "unbalanced": [],
      }
    `);
  });
});

/**
 * Findings from the GATE 2 refuter. Each of these was a real leak: a link the
 * transform left addressing the legacy origin, or a form that could still reach
 * it.
 */
describe('transformLegacyHtml — GATE 2 refuter findings', () => {
  it('rewrites a hard-coded http:// link to its own site', () => {
    const source = [
      '<html><body>',
      '<a id="a" href="http://obshee-delo.ru/about/">insecure absolute</a>',
      '<a id="b" href="https://obshee-delo.ru/about/">secure absolute</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    // Both must land on the new site. Comparing origins rather than hosts left
    // the first one alone, and the runtime then opened it in a new tab — on the
    // legacy origin, which is precisely what LCP-011 forbids.
    expect(anchorHrefs(html)).toEqual([`${SITE}/about/`, `${SITE}/about/`]);
  });

  /**
   * The refuter argued for treating any dotted last segment as an asset. It
   * measured false — across 40 legacy pages all 132 dotted links are already
   * under `/wp-content/` — and the rule's real effect was on `wp-login.php`,
   * which is an endpoint, not a file. A visitor sent to the old site's login
   * form is worse off than one who gets our 404, so a dotted path outside the
   * WordPress directories is treated as a page.
   */
  it('treats a dotted path outside the WordPress directories as a page', () => {
    const source = [
      '<html><body>',
      '<a href="/wp-content/uploads/poster.jpg">a real download</a>',
      '<a href="/wp-login.php">an endpoint</a>',
      '</body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(anchorHrefs(html)).toEqual(['/wp-content/uploads/poster.jpg', `${SITE}/wp-login.php`]);
  });

  it('strips formaction from a submit control, not just action from the form', () => {
    const source = [
      '<html><body>',
      `<form action="${LEGACY}/">`,
      '<button type="submit" formaction="https://obshee-delo.ru/search/">go</button>',
      '<input type="submit" formaction="/other/">',
      '</form></body></html>',
    ].join('');

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/team/', siteOrigin: SITE });

    expect(html).not.toMatch(/formaction/i);
    expect(findTags(maskInertRegions(html), 'form').filter((f) => findAttribute(f.text, 'action'))).toEqual([]);
  });

  it('keeps a body-less fragment that is nothing but chrome', () => {
    const source = '<header id="header">the only content there is</header>';

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).toContain('the only content there is');
  });

  it('still empties nothing when a body-less fragment has real content', () => {
    const source = '<header id="header">chrome</header><p>real</p>';

    const { html } = transformLegacyHtml(source, { origin: LEGACY, path: '/x/', siteOrigin: SITE });

    expect(html).toContain('real');
    expect(html).not.toContain('chrome');
  });
});
