import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewsGrid } from './NewsGrid';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} {...rest} />;
  },
}));

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

const ITEMS = [
  { id: 1, title: 'Article 1', date: '01.01.2026', href: '/news/1', excerpt: 'Lead story excerpt.' },
  { id: 2, title: 'Article 2', date: '02.01.2026', href: '/news/2' },
  { id: 3, title: 'Article 3', date: '03.01.2026', href: '/news/3' },
];

describe('<NewsGrid />', () => {
  it('renders the first item as a featured card with its excerpt', () => {
    renderInTheme(<NewsGrid items={ITEMS} />);

    expect(screen.getByRole('link', { name: /Article 1/ })).toHaveAttribute('href', '/news/1');
    expect(screen.getByText('Lead story excerpt.')).toBeInTheDocument();
  });

  it('renders the remaining items as a grid of links', () => {
    renderInTheme(<NewsGrid items={ITEMS} />);

    expect(screen.getByRole('link', { name: /Article 2/ })).toHaveAttribute('href', '/news/2');
    expect(screen.getByRole('link', { name: /Article 3/ })).toHaveAttribute('href', '/news/3');
  });

  it('links the "Все новости" CTA to the news index', () => {
    renderInTheme(<NewsGrid items={ITEMS} />);

    expect(screen.getByRole('link', { name: 'Все новости' })).toHaveAttribute('href', '/news');
  });

  it('keeps the heading and CTA with no items', () => {
    renderInTheme(<NewsGrid items={[]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Наши дела' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все новости' })).toHaveAttribute('href', '/news');
  });
});
