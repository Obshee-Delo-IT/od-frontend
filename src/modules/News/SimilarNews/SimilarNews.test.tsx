import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const fetchSimilarNews = vi.fn();

vi.mock('@/shared/api/fetchSimilarNews', () => ({
  fetchSimilarNews: (...args: unknown[]) => fetchSimilarNews(...args),
}));

import { SimilarNews } from './SimilarNews';

const rail = async (currentId?: number) => {
  const element = await SimilarNews({ category: 47, region: 100, currentId });
  render(<Theme accentColor="red">{element}</Theme>);
};

/**
 * The rail used to send every visitor off the site: it passed WordPress's own
 * REST `link` straight to `<Link>`, so all ten items resolved to the WP host —
 * and it listed the article being read among its own neighbours (JRN-07).
 */
describe('<SimilarNews />', () => {
  it('links each item to its /<id>/ on this site', async () => {
    fetchSimilarNews.mockResolvedValue({
      data: [
        { id: 74664, date: '2026-08-01T10:00:00', title: { rendered: 'Первая' }, link: 'https://od.webtm.ru/74664/' },
        { id: 74665, date: '2026-08-02T10:00:00', title: { rendered: 'Вторая' }, link: 'https://od.webtm.ru/74665/' },
      ],
    });

    await rail();

    // Slashless in the rendered attribute: `next/link` normalises it and
    // `trailingSlash: true` puts it back on navigation. What matters is that it
    // is a path on this site rather than an absolute WordPress URL.
    expect(screen.getByRole('link', { name: 'Первая' })).toHaveAttribute('href', '/74664');
    expect(screen.getByRole('link', { name: 'Вторая' })).toHaveAttribute('href', '/74665');
  });

  it('asks WordPress to leave out the article being read', async () => {
    fetchSimilarNews.mockResolvedValue({ data: [] });

    await rail(74664);

    expect(fetchSimilarNews).toHaveBeenCalledWith({ category: 47, region: 100, exclude: 74664 });
  });
});
