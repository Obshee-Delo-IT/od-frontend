import { describe, expect, it } from 'vitest';
import { absolutizeWpMedia } from './absolutizeWpMedia';

describe('absolutizeWpMedia', () => {
  it('absolutizes relative /wp-content src and href attributes', () => {
    const html = '<a href="/wp-content/uploads/a.pdf"><img src=\'/wp-content/uploads/b.jpg\'/></a>';

    expect(absolutizeWpMedia(html, 'https://wp.test')).toBe(
      '<a href="https://wp.test/wp-content/uploads/a.pdf"><img src=\'https://wp.test/wp-content/uploads/b.jpg\'/></a>'
    );
  });

  it('leaves absolute and non-upload URLs untouched', () => {
    const html = '<img src="https://cdn.test/wp-content/x.jpg"/><a href="/video">каталог</a>';

    expect(absolutizeWpMedia(html, 'https://wp.test')).toBe(html);
  });
});
