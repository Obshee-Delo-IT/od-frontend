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

describe('<NewsGrid />', () => {
  it('renders each item as a NewsCard link', () => {
    renderInTheme(
      <NewsGrid
        items={[
          { id: 1, title: 'Article 1', date: '01.01.2026', href: '/news/1' },
          { id: 2, title: 'Article 2', date: '02.01.2026', href: '/news/2' },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: /Article 1/ })).toHaveAttribute('href', '/news/1');
    expect(screen.getByRole('link', { name: /Article 2/ })).toHaveAttribute('href', '/news/2');
  });

  it('links the "Посмотреть все" CTA to the news index', () => {
    renderInTheme(<NewsGrid items={[{ id: 1, title: 'Article 1', href: '/news/1' }]} />);

    expect(screen.getByRole('link', { name: 'Посмотреть все' })).toHaveAttribute('href', '/news');
  });
});
