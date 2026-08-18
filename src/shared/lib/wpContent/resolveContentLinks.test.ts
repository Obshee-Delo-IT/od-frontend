import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/httpClient', () => ({ wpBaseUrl: 'https://wp.test' }));
const ALIAS = 'https://xn----9sbkcac6brh7h.xn--p1ai';
vi.mock('@/shared/config/site', () => ({
  internalOrigins: (wp: string) => [wp, 'https://obshee-delo.ru', 'https://xn----9sbkcac6brh7h.xn--p1ai'],
}));

import { resolveContentLinks } from './resolveContentLinks';

/** A `wp:query` loop as WordPress renders it — the D6c case, ~80 `/contacts/*` pages. */
const QUERY_LOOP = `<ul class="wp-block-post-template">
  <li class="wp-block-post"><h3><a href="https://wp.test/72892/" target="_self">Заголовок</a></h3></li>
</ul>`;

describe('resolveContentLinks', () => {
  it('makes a WordPress-origin link root-relative', () => {
    expect(resolveContentLinks(QUERY_LOOP)).toContain('href="/72892/"');
  });

  it('leaves the rest of the anchor alone', () => {
    expect(resolveContentLinks(QUERY_LOOP)).toContain('<a href="/72892/" target="_self">');
  });

  it('is idempotent', () => {
    const once = resolveContentLinks(QUERY_LOOP);
    expect(resolveContentLinks(once)).toBe(once);
  });

  it('strips our own public origin too', () => {
    expect(resolveContentLinks('<a href="https://obshee-delo.ru/news/?category=articles#top">н</a>')).toBe(
      '<a href="/news/?category=articles#top">н</a>'
    );
  });

  it('strips the общее-дело.рф alias domain — two of three cards on /materials/metodichki/', () => {
    expect(resolveContentLinks(`<a href="${ALIAS}/materials/ppiz-zdorov-molodez/">Подробнее</a>`)).toBe(
      '<a href="/materials/ppiz-zdorov-molodez/">Подробнее</a>'
    );
  });

  it('keeps the alias domain subdomains — those are other services, not this site', () => {
    const donate = '<a href="https://xn--d1aadek5agm.xn----9sbkcac6brh7h.xn--p1ai/">Оказать помощь</a>';
    const stats = '<a href="http://xn--80a7adb.xn----9sbkcac6brh7h.xn--p1ai/">Наша статистика</a>';
    expect(resolveContentLinks(donate)).toBe(donate);
    expect(resolveContentLinks(stats)).toBe(stats);
  });

  it('keeps external destinations', () => {
    const html = '<a href="https://pro.obshee-delo.ru/course/">курс</a>';
    expect(resolveContentLinks(html)).toBe(html);
  });

  it('keeps a lookalike host', () => {
    const html = '<a href="https://wp.test.evil.example/phish/">п</a>';
    expect(resolveContentLinks(html)).toBe(html);
  });

  it('keeps links into WordPress own trees — those files live only there', () => {
    const html = '<a href="https://wp.test/wp-content/uploads/2024/буклет.pdf">буклет</a>';
    expect(resolveContentLinks(html)).toBe(html);
  });

  it('gives a root-relative WordPress path its origin back (D6d)', () => {
    const html = '<a href="/wp-content/uploads/2020/04/22-scaled.jpg">фото</a>';
    expect(resolveContentLinks(html)).toBe(
      '<a href="https://wp.test/wp-content/uploads/2020/04/22-scaled.jpg">фото</a>'
    );
  });

  it('is idempotent over the D6d rewrite — the absolute form is then left alone', () => {
    const once = resolveContentLinks('<a href="/wp-includes/js/x.js" download>с</a>');
    expect(once).toBe('<a href="https://wp.test/wp-includes/js/x.js" download>с</a>');
    expect(resolveContentLinks(once)).toBe(once);
  });

  it('leaves relative hrefs, anchors and mailto alone', () => {
    const html = '<a href="/materials/">м</a><a href="#top">в</a><a href="mailto:a@b.ru">п</a>';
    expect(resolveContentLinks(html)).toBe(html);
  });

  it('ignores non-anchor markup carrying the same origin', () => {
    const html = '<img src="https://wp.test/wp-content/x.jpg" /><p>https://wp.test/1/</p>';
    expect(resolveContentLinks(html)).toBe(html);
  });

  it('returns an empty string for empty input', () => {
    expect(resolveContentLinks(undefined)).toBe('');
    expect(resolveContentLinks(null)).toBe('');
    expect(resolveContentLinks('')).toBe('');
  });
});
