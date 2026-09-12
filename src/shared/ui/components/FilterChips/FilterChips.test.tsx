import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterChips } from './FilterChips';

describe('<FilterChips />', () => {
  it('renders every chip as a link to its own destination', () => {
    render(
      <FilterChips
        label="Фильтр"
        chips={[
          { label: 'Все', href: '/news' },
          { label: 'Статьи', href: '/news?category=articles' },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'Все' })).toHaveAttribute('href', '/news');
    expect(screen.getByRole('link', { name: 'Статьи' })).toHaveAttribute('href', '/news?category=articles');
  });

  it('flags as many chips active as it is given — the strip is not single-select', () => {
    render(
      <FilterChips
        label="Фильтр"
        chips={[
          { label: 'Один', href: '/a', active: true },
          { label: 'Два', href: '/b', active: true },
          { label: 'Три', href: '/c' },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'Один' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Два' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Три' })).not.toHaveAttribute('aria-current');
  });

  it('names itself, because a page can carry two of these', () => {
    render(<FilterChips label="Темы фильмов" chips={[{ label: 'Один', href: '/a' }]} />);

    expect(screen.getByRole('navigation', { name: 'Темы фильмов' })).toBeInTheDocument();
  });

  it('shows the caption when it is given one, and nothing when it is not', () => {
    // Two unlabelled strips stacked on a phone read as one wall of buttons —
    // the caption is what says which question each of them answers.
    const { unmount } = render(<FilterChips label="Тема" caption="Тема" chips={[{ label: 'Один', href: '/a' }]} />);
    expect(screen.getByText('Тема')).toBeInTheDocument();
    unmount();

    render(<FilterChips label="Тема" chips={[{ label: 'Один', href: '/a' }]} />);
    expect(screen.queryByText('Тема')).not.toBeInTheDocument();
  });
});
