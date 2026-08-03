import { describe, expect, it } from 'vitest';
import { extractFilmPoster } from './extractFilmPoster';

const PLAKAT_BODY = `
<div class="wp-block-group"><div class="wp-block-group__inner-container">
<div class="wp-block-columns">
<div class="wp-block-column"><p>Описание фильма.</p></div>
<div class="wp-block-column">
<figure class="wp-block-image size-medium"><a href="https://wp.test/wp-content/uploads/2023/01/Плакат-фильма.jpg"><img src="https://wp.test/wp-content/uploads/2023/01/Плакат-фильма-212x300.jpg" alt=""/></a></figure>
<p><a href="https://disk.yandex.ru/d/poster">Скачать плакат</a></p>
<div class="wp-block-button has-text-align-center"><a class="wp-block-button__link" href="https://disk.yandex.ru/i/full-film">Скачать фильм (1,5 Гб, 54 мин)</a></div>
</div>
</div>
</div></div>`;

// The 71933 shape: a cover figure not named «плакат», plus two size variants.
const COVER_BODY = `
<div class="wp-block-column">
<figure class="wp-block-image size-medium"><a href="https://wp.test/uploads/2023/08/ThankYouForTheLife.jpg"><img src="https://wp.test/uploads/2023/08/ThankYouForTheLife-300x169.jpg"/></a></figure>
<div class="wp-block-button has-text-align-center"><a class="wp-block-button__link" href="https://disk.yandex.ru/i/sd">Скачать фильм (656 Мб, 35 мин)</a></div>
<div class="wp-block-button has-text-align-center"><a class="wp-block-button__link" href="https://disk.yandex.ru/i/hd">Скачать фильм (1,5 Гб, 35 мин)</a></div>
</div>`;

describe('extractFilmPoster', () => {
  it('extracts the плакат figure, its download anchor and the film download, removing all from the body', () => {
    const result = extractFilmPoster(PLAKAT_BODY);

    expect(result.posterImageUrl).toBe('https://wp.test/wp-content/uploads/2023/01/Плакат-фильма.jpg');
    expect(result.posterAspectRatio).toBe('212 / 300');
    expect(result.posterDownloadUrl).toBe('https://disk.yandex.ru/d/poster');
    expect(result.downloads).toEqual([{ url: 'https://disk.yandex.ru/i/full-film', label: '1,5 Гб • 54 мин' }]);
    expect(result.html).not.toContain('<figure');
    expect(result.html).not.toContain('Скачать');
    expect(result.html).toContain('Описание фильма.');
  });

  it('treats the figure directly above the download buttons as the poster even without a плакат name', () => {
    const result = extractFilmPoster(COVER_BODY);

    expect(result.posterImageUrl).toBe('https://wp.test/uploads/2023/08/ThankYouForTheLife.jpg');
    expect(result.posterAspectRatio).toBe('300 / 169');
    expect(result.posterDownloadUrl).toBeNull();
    expect(result.downloads).toEqual([
      { url: 'https://disk.yandex.ru/i/sd', label: '656 Мб • 35 мин' },
      { url: 'https://disk.yandex.ru/i/hd', label: '1,5 Гб • 35 мин' },
    ]);
    expect(result.html).not.toContain('wp-block-button');
  });

  it('lifts bare «СКАЧАТЬ» buttons and yadi.sk links from the older clip posts', () => {
    const body =
      '<p><a href="https://yadi.sk/i/abc">СКАЧАТЬ</a></p><p><a href="https://yadi.sk/i/def">СКАЧАТЬ РОЛИК В ХОРОШЕМ КАЧЕСТВЕ</a></p>';
    const { downloads } = extractFilmPoster(body);

    expect(downloads).toEqual([
      { url: 'https://yadi.sk/i/abc', label: 'Скачать' },
      { url: 'https://yadi.sk/i/def', label: 'В ХОРОШЕМ КАЧЕСТВЕ' },
    ]);
  });

  it('uses a «Скачать постер» image link as both the card image and its download', () => {
    const body = '<p><a href="https://wp.test/uploads/2016/04/film_poster.jpg">Скачать постер</a></p>';
    const result = extractFilmPoster(body);

    expect(result.posterDownloadUrl).toBe('https://wp.test/uploads/2016/04/film_poster.jpg');
    expect(result.posterImageUrl).toBe('https://wp.test/uploads/2016/04/film_poster.jpg');
    expect(result.downloads).toEqual([]);
  });

  it('leaves document downloads (буклет, экспертное заключение) and unrelated images in the body', () => {
    const body =
      '<p><a href="https://disk.yandex.ru/i/b">Скачать буклет (pdf)</a></p><p><a href="https://yadi.sk/i/e">Скачать экспертное заключение</a></p><figure class="wp-block-image"><img src="https://wp.test/kadr.jpg"/></figure>';
    const result = extractFilmPoster(body);

    expect(result.downloads).toEqual([]);
    expect(result.posterImageUrl).toBeNull();
    expect(result.html).toBe(body);
  });
});
