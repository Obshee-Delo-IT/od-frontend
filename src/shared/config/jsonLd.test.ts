import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, filmJsonLd, jsonLdHtml, newsJsonLd, organizationJsonLd } from './jsonLd';
import { siteUrl } from './site';

const NEWS = {
  id: '74794',
  headline: 'В Печорах прошёл съезд',
  description: 'Команда областного отделения приняла участие.',
  image: 'https://cdn.example/photo.jpg',
  datePublished: '2026-09-14T08:00:00Z',
  dateModified: '2026-09-15T09:00:00Z',
};

const FILM = {
  id: 71933,
  name: 'Секреты манипуляции. Алкоголь',
  description: 'Документальный фильм.',
  thumbnailUrl: 'https://cdn.example/poster.jpg',
  uploadDate: '2026-03-01T10:00:00Z',
  embedUrl: 'https://kinescope.io/embed/abc123',
};

describe('jsonLdHtml', () => {
  it('escapes every «<», so a title can never close the script element', () => {
    // The one reason this helper exists. WP titles reach the builders decoded,
    // so a post literally called «</script><img onerror=…>» would otherwise put
    // the rest of the payload into the document as markup.
    const html = jsonLdHtml({ headline: '</script><img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<');
    expect(html).toContain('\\u003c');
  });

  it('is still the same JSON after the escape', () => {
    const node = newsJsonLd({ ...NEWS, headline: 'A < B' });
    expect(JSON.parse(jsonLdHtml(node!))).toEqual(node);
  });
});

describe('newsJsonLd', () => {
  it('addresses the post at the legacy `/<id>/`, not at WordPress’s own permalink', () => {
    // `mainEntityOfPage` is what tells a crawler which URL this markup is about;
    // `post.link` would name the WP host (od.webtm.ru/74794/), which is the one
    // address this project spends A8 keeping visitors off.
    expect(newsJsonLd(NEWS)?.mainEntityOfPage).toBe(`${siteUrl}/74794/`);
  });

  it('carries the dates as instants and the organisation as both author and publisher', () => {
    const node = newsJsonLd(NEWS)!;
    expect(node['@type']).toBe('NewsArticle');
    expect(node.datePublished).toBe('2026-09-14T08:00:00Z');
    expect(node.dateModified).toBe('2026-09-15T09:00:00Z');
    expect(node.author).toEqual(node.publisher);
    expect((node.publisher as Record<string, string>).logo).toBe(`${siteUrl}/icon.png`);
  });

  it('omits what it has no value for, rather than stating null', () => {
    // A third of the archive has no featured image, and `"image": null` is a
    // property a validator reads as present and broken.
    const node = newsJsonLd({ id: '1', headline: 'Заголовок', image: null, description: null })!;
    expect('image' in node).toBe(false);
    expect('description' in node).toBe(false);
    expect('datePublished' in node).toBe(false);
  });

  it('is nothing without a headline', () => {
    expect(newsJsonLd({ ...NEWS, headline: '' })).toBeNull();
  });
});

describe('filmJsonLd', () => {
  it('emits the three properties Google requires, plus the player', () => {
    const node = filmJsonLd(FILM)!;
    expect(node['@type']).toBe('VideoObject');
    expect(node.name).toBe(FILM.name);
    expect(node.thumbnailUrl).toBe(FILM.thumbnailUrl);
    expect(node.uploadDate).toBe(FILM.uploadDate);
    expect(node.embedUrl).toBe('https://kinescope.io/embed/abc123');
    expect(node.url).toBe(`${siteUrl}/71933/`);
  });

  it('emits nothing at all when a required property is missing', () => {
    // `name`/`thumbnailUrl`/`uploadDate` are the properties Google marks
    // required: a VideoObject without one is invalid markup, not a partial win.
    expect(filmJsonLd({ ...FILM, thumbnailUrl: null })).toBeNull();
    expect(filmJsonLd({ ...FILM, uploadDate: null })).toBeNull();
    expect(filmJsonLd({ ...FILM, name: '' })).toBeNull();
  });

  it('says nothing about a page that has no player on it', () => {
    // The catch-all renders *every* `format=video` post through the film page —
    // 187 of them on production against 84 films — and the «Видео события»
    // reports among them are a photo and some text. /73220/ and /73141/ both
    // have a featured image and a date, so the three required properties would
    // have passed; neither page renders an iframe. Marking those up as videos is
    // the «content not visible on the page» case Google's guidelines name.
    expect(filmJsonLd({ ...FILM, embedUrl: null })).toBeNull();
  });
});

describe('organizationJsonLd', () => {
  it('states the registered name beside the wordmark', () => {
    const node = organizationJsonLd('Профилактика зависимостей');
    expect(node.name).toBe('ОБЩЕЕ ДЕЛО');
    expect(node.legalName).toBe('Общероссийская общественная организация «Общее дело»');
    expect(node.description).toBe('Профилактика зависимостей');
  });

  it('names profiles, not actions — https and no query string', () => {
    // The footer's own links are `http://vk.com/…` and a YouTube URL carrying
    // `?sub_confirmation=1`. A `sameAs` is an identity claim about a profile; a
    // subscribe link is a different resource.
    const sameAs = organizationJsonLd('x').sameAs as string[];
    expect(sameAs.length).toBeGreaterThan(0);
    sameAs.forEach((url) => {
      expect(url.startsWith('https://')).toBe(true);
      expect(url).not.toContain('?');
    });
  });

  it('links the logo as a file, so the URL is not slash-terminated into a 308', () => {
    expect(organizationJsonLd('x').logo).toBe(`${siteUrl}/icon.png`);
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers the trail from one and absolutises every link', () => {
    const node = breadcrumbJsonLd([
      { label: 'Главная', href: '/' },
      // Slashless on purpose: this is what `NewsArticle` passes, and
      // `canonicalUrl` is what keeps the markup off a 301.
      { label: 'Новости', href: '/news' },
      { label: 'Заголовок' },
    ])!;
    const items = node.itemListElement as Array<Record<string, unknown>>;

    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[1].item).toBe(`${siteUrl}/news/`);
  });

  it('leaves the current page without an `item`', () => {
    // Google's shape for the last crumb: it names the page you are on, so there
    // is nothing to link to.
    const items = breadcrumbJsonLd([{ label: 'Видео', href: '/video/' }, { label: 'Фильм' }])!.itemListElement as Array<
      Record<string, unknown>
    >;
    expect('item' in items[1]).toBe(false);
  });

  it('is nothing for a single crumb — one element is not a path', () => {
    expect(breadcrumbJsonLd([{ label: 'Видео', href: '/video/' }])).toBeNull();
    expect(breadcrumbJsonLd([])).toBeNull();
  });
});
