import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewsCard } from './NewsCard';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} {...rest} />;
  },
}));

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<NewsCard />', () => {
  it('links to the article and renders title + date', () => {
    renderInTheme(
      <NewsCard
        href="/news/42"
        title="Заголовок"
        date="01.01.2026"
        imageSrc="https://example.com/cover.jpg"
        imageAlt="cover"
      />
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/news/42');
    expect(screen.getByRole('heading', { name: 'Заголовок' })).toBeInTheDocument();
    expect(screen.getByText('01.01.2026')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'cover' })).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });

  it('renders without an image when imageSrc is missing', () => {
    renderInTheme(<NewsCard href="/news/1" title="X" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
