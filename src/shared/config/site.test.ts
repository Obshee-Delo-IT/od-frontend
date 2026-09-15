import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalUrl, fileUrl, ogCard, ogCardImage, resolveCanonicalRedirect, SITE_NAME, siteUrl } from './site';
import type { Metadata } from 'next';

describe('canonicalUrl', () => {
  it('defaults to the site root, slash included', () => {
    expect(canonicalUrl()).toBe(`${siteUrl}/`);
    expect(canonicalUrl('/')).toBe(`${siteUrl}/`);
    expect(canonicalUrl('')).toBe(`${siteUrl}/`);
  });

  it('appends the trailing slash exactly once', () => {
    expect(canonicalUrl('/news')).toBe(`${siteUrl}/news/`);
    expect(canonicalUrl('/news/')).toBe(`${siteUrl}/news/`);
    expect(canonicalUrl('news')).toBe(`${siteUrl}/news/`);
  });

  it('collapses empty segments', () => {
    expect(canonicalUrl('//video//filmy//')).toBe(`${siteUrl}/video/filmy/`);
  });

  it('slashes the pathname and keeps the query after it', () => {
    expect(canonicalUrl('/news?page=2')).toBe(`${siteUrl}/news/?page=2`);
    expect(canonicalUrl('/news/?page=2')).toBe(`${siteUrl}/news/?page=2`);
    expect(canonicalUrl('/news?category=articles&page=2')).toBe(`${siteUrl}/news/?category=articles&page=2`);
  });

  it('keeps the root slash when only a query is given', () => {
    expect(canonicalUrl('?page=2')).toBe(`${siteUrl}/?page=2`);
  });

  it('builds post URLs in the legacy /<id>/ form', () => {
    expect(canonicalUrl('/71561')).toBe(`${siteUrl}/71561/`);
  });

  it('never advertises a URL that trailingSlash would redirect', () => {
    const paths = ['/', '/news', '/video/filmy', '/71561', '/news?page=3'];
    paths.forEach((path) => {
      const url = canonicalUrl(path);
      expect(url.startsWith(`${siteUrl}/`)).toBe(true);
      expect(url.split('?')[0].endsWith('/')).toBe(true);
    });
  });
});

describe('fileUrl', () => {
  it('leaves dotted files slashless — the slashed twin is the one that 308s', () => {
    expect(fileUrl('/sitemap.xml')).toBe(`${siteUrl}/sitemap.xml`);
    expect(fileUrl('sitemap.xml')).toBe(`${siteUrl}/sitemap.xml`);
    expect(fileUrl('//robots.txt')).toBe(`${siteUrl}/robots.txt`);
  });
});

describe('resolveCanonicalRedirect', () => {
  const APEX = 'obshee-delo.ru';
  const RF_HYPHEN = 'xn----9sbkcac6brh7h.xn--p1ai'; // общее-дело.рф
  const RF_PLAIN = 'xn--90agcab0bpg7g.xn--p1ai'; // общеедело.рф

  it('leaves the canonical host alone', () => {
    expect(resolveCanonicalRedirect(APEX, '/news/')).toBeNull();
  });

  it('folds every alias onto the canonical host, path and query intact', () => {
    for (const host of [`www.${APEX}`, RF_HYPHEN, `www.${RF_HYPHEN}`, RF_PLAIN, `www.${RF_PLAIN}`]) {
      expect(resolveCanonicalRedirect(host, '/materials/plakati/')).toBe(`${siteUrl}/materials/plakati/`);
      expect(resolveCanonicalRedirect(host, '/news/?category=articles')).toBe(`${siteUrl}/news/?category=articles`);
    }
  });

  /**
   * The reason this is an allowlist. Coolify polls the container on
   * `localhost:3000` and reads anything but a 200 as a failure, so a rule that
   * redirected every non-canonical host would restart-loop the application.
   */
  it('never touches the health check, the fallback host or a preview host', () => {
    for (const host of ['localhost:3000', '127.0.0.1:3000', 'prod.obshee-delo.ru', 'new.obshee-delo.ru']) {
      expect(resolveCanonicalRedirect(host, '/health/')).toBeNull();
    }
  });

  it('ignores the port and the case of the host', () => {
    expect(resolveCanonicalRedirect(`WWW.${APEX.toUpperCase()}:443`, '/')).toBe(`${siteUrl}/`);
  });

  it('answers null when there is no host at all', () => {
    expect(resolveCanonicalRedirect(null, '/')).toBeNull();
    expect(resolveCanonicalRedirect(undefined, '/')).toBeNull();
    expect(resolveCanonicalRedirect('', '/')).toBeNull();
  });

  /**
   * `помощь.общее-дело.рф` takes donations and `xn--80a7adb.…` is the statistics
   * site — both are other people's services on a domain we happen to share.
   */
  it('leaves the sibling subdomains external', () => {
    expect(resolveCanonicalRedirect(`xn--d1aadek5agm.${RF_HYPHEN}`, '/')).toBeNull();
    expect(resolveCanonicalRedirect(`xn--80a7adb.${RF_HYPHEN}`, '/')).toBeNull();
  });
});

describe('ogCard', () => {
  it('restates the defaults a segment would otherwise drop', () => {
    // Next merges `openGraph` shallowly: whatever a route declares replaces the
    // root layout's object whole. This is the half nine call sites forgot.
    // Typed as Next sees it, which is the type the bug lived in: `ogCard`
    // returns the caller's own literal, and these four are what the merge
    // would otherwise drop.
    const card: Metadata['openGraph'] = ogCard({ type: 'website', title: 'Новости' });

    expect(card?.siteName).toBe(SITE_NAME);
    expect(card?.locale).toBe('ru_RU');
    // `countryName` deliberately absent: `og:country_name` is not a property of
    // `website`, `article` or `profile`.
    expect(card?.countryName).toBeUndefined();
    expect(card?.images).toEqual([{ url: '/og-default.png', width: 1200, height: 630 }]);
  });

  it("keeps the route's own fields, image included", () => {
    const card: Metadata['openGraph'] = ogCard({ type: 'article', title: 'Статья', images: ['/og-news.png'] });

    expect(card && 'type' in card && card.type).toBe('article');
    expect(card?.title).toBe('Статья');
    expect(card?.images).toEqual(['/og-news.png']);
    expect(card?.siteName).toBe(SITE_NAME);
  });
});

describe('ogCardImage', () => {
  it('states the pixels when a fetcher knew them', () => {
    expect(ogCardImage('https://cdn.test/photo.jpg', { width: 1280, height: 621 })).toEqual({
      url: 'https://cdn.test/photo.jpg',
      width: 1280,
      height: 621,
    });
  });

  it('passes an image of unknown size through untouched', () => {
    // Omitting the two tags is legal; guessing them is not.
    expect(ogCardImage('https://cdn.test/photo.jpg')).toEqual({ url: 'https://cdn.test/photo.jpg' });
    expect(ogCardImage('https://cdn.test/photo.jpg', { width: 900 })).toEqual({ url: 'https://cdn.test/photo.jpg' });
  });

  it('sends an image too small to render at all to the branded one', () => {
    // Under 200 px Facebook and WhatsApp show no image, so those cards are blank.
    const branded = { url: '/og-default.png', width: 1200, height: 630 };

    expect(ogCardImage('https://cdn.test/logo.png', { width: 160, height: 120 })).toEqual(branded);
    expect(ogCardImage('https://cdn.test/logo.png', { width: 150, height: 200 })).toEqual(branded);
    expect(ogCardImage(null)).toEqual(branded);
    expect(ogCardImage(undefined)).toEqual(branded);
  });

  it('keeps a real photograph that is merely small', () => {
    // 200-600 px is the *small* card, not a missing one — every network scales
    // it. Swapping the post's own photo for the wordmark there is the worse card.
    expect(ogCardImage('https://cdn.test/photo.jpg', { width: 452, height: 300 })).toEqual({
      url: 'https://cdn.test/photo.jpg',
      width: 452,
      height: 300,
    });
  });

  it('keeps anything from 600×315 up', () => {
    expect(ogCardImage('https://cdn.test/ok.jpg', { width: 600, height: 315 })).toEqual({
      url: 'https://cdn.test/ok.jpg',
      width: 600,
      height: 315,
    });
  });
});

/**
 * The check that fails when the tenth call site is hand-written — which is the
 * whole defect: every one of the nine that existed declared `images` and forgot
 * `siteName`, and no unit test over a helper nobody called would have caught it.
 */
describe('every route builds its card with ogCard', () => {
  const sources = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
    .map((file) => join('src', file));

  /* Comments talk about `openGraph` constantly — this module's own doc comments
     are half the reason the trap is documented at all — so they come out before
     the scan, or every explanation of the rule reads as a violation of it. */
  const code = (file: string): string =>
    readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

  it('finds no hand-written openGraph literal', () => {
    /* Every mention of the key, not only the colon form: `{ title, openGraph }`
       passes an object built in a variable and carries no colon at all, which is
       exactly the way round this a tenth call site would take. A closing
       bracket after the key — `Metadata['openGraph']` — is a type position, not
       a call site. */
    const offenders = sources.filter((file) =>
      [...code(file).matchAll(/openGraph(['"]?\s*\]|\s*:\s*(\w*))?/g)].some(
        ([, tail, callee]) => !tail?.includes(']') && callee !== 'ogCard'
      )
    );

    expect(offenders).toEqual([]);
  });

  it('is looking at the call sites it thinks it is', () => {
    // A guard on the guard: a rename that stops the scan matching anything at
    // all would otherwise pass silently for ever.
    const users = sources.filter((file) => readFileSync(file, 'utf8').includes('openGraph: ogCard('));

    expect(users.length).toBeGreaterThanOrEqual(9);
  });
});
