import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cardImageFits, NewsCard } from './NewsCard';

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

  it('fits an oversized cover whole rather than cropping its title away', () => {
    // 1568×682 — «Проблематизация деятельности…», reported on 2026-08-24 as a
    // title running out of frame. `cover` keeps 56 % of its width.
    renderInTheme(<NewsCard href="/1" title="X" imageSrc="/banner.jpg" imageAlt="c" imageRatio={1568 / 682} />);

    expect(screen.getByRole('img', { name: 'c' })).toHaveClass('whole');
  });

  it('still crops a photograph, and anything whose proportions it does not know', () => {
    const { unmount } = renderInTheme(
      <NewsCard href="/1" title="X" imageSrc="/photo.jpg" imageAlt="c" imageRatio={1200 / 800} />
    );
    expect(screen.getByRole('img', { name: 'c' })).not.toHaveClass('whole');
    unmount();

    renderInTheme(<NewsCard href="/1" title="X" imageSrc="/body.jpg" imageAlt="c" />);
    expect(screen.getByRole('img', { name: 'c' })).not.toHaveClass('whole');
  });

  it('renders without an image when imageSrc is missing', () => {
    renderInTheme(<NewsCard href="/news/1" title="X" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('cardImageFits', () => {
  // The real covers in category 578, the articles feed the report came from.
  it.each([
    ['1568×682 banner', 1568 / 682, false],
    ['1024×454 banner', 1024 / 454, false],
    ['763×1080 portrait scan', 763 / 1080, false],
    ['945×1134 portrait scan', 945 / 1134, false],
    ['1200×800 photo', 1200 / 800, true],
    ['807×454 16:9 photo', 807 / 454, true],
    ['550×340 photo', 550 / 340, true],
  ])('%s', (_name, ratio, fits) => {
    expect(cardImageFits(ratio)).toBe(fits);
  });

  it('crops when it is told nothing usable', () => {
    expect(cardImageFits(null)).toBe(true);
    expect(cardImageFits(undefined)).toBe(true);
    expect(cardImageFits(0)).toBe(true);
    expect(cardImageFits(Number.NaN)).toBe(true);
  });
});
