import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from './page';

/**
 * The hrefs are the point: this hub is the section's only navigation, and three
 * of the four targets are still WP pages served through the A6 fallback, so a
 * typo here is a dead end no other route would catch.
 */
describe('/materials/', () => {
  it('links the four groups at the addresses the live page uses', () => {
    render(<Theme>{Page()}</Theme>);

    expect(screen.getByRole('heading', { level: 1, name: 'Материалы' })).toBeInTheDocument();

    // Slashless: `next/link` normalises the trailing slash away in a bare
    // render, and `trailingSlash: true` puts it back in the app. Same as the
    // other link assertions in this repo.
    const hrefs = [
      ['Методические пособия', '/materials/metodichki'],
      ['Печатная продукция', '/materials/printed-products'],
      ['Статьи для газет и журналов', '/materials/articles'],
      ['Социальная реклама', '/materials/social-reklama'],
    ] as const;

    hrefs.forEach(([title, href]) => {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: `${title} — подробнее` })).toHaveAttribute('href', href);
    });
  });
});
