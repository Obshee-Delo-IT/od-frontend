import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NewsFilter, type NewsFilterOption } from './NewsFilter';

const OPTIONS: NewsFilterOption[] = [
  { label: 'Все', value: null },
  { label: 'Наши дела', value: 'nashi-dela' },
  { label: 'Статьи', value: 'articles' },
];

const buildHref = (value: string | null) => (value ? `/news?category=${value}` : '/news');

describe('<NewsFilter />', () => {
  it('renders every option as a link', () => {
    render(<NewsFilter options={OPTIONS} active={null} buildHref={buildHref} />);

    expect(screen.getByRole('link', { name: 'Все' })).toHaveAttribute('href', '/news');
    expect(screen.getByRole('link', { name: 'Наши дела' })).toHaveAttribute('href', '/news?category=nashi-dela');
    expect(screen.getByRole('link', { name: 'Статьи' })).toHaveAttribute('href', '/news?category=articles');
  });

  it('flags the active option with aria-current', () => {
    render(<NewsFilter options={OPTIONS} active="articles" buildHref={buildHref} />);

    expect(screen.getByRole('link', { name: 'Статьи' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Все' })).not.toHaveAttribute('aria-current');
  });
});
