import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// jsdom has no layout, so stub Swiper to render every slide as a plain child.
vi.mock('swiper/modules', () => ({ Navigation: {}, Pagination: {}, A11y: {} }));
vi.mock('swiper/react', () => ({
  Swiper: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SwiperSlide: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}));

// next/image needs the Next runtime; render a plain <img> passing src/alt through.
vi.mock('next/image', () => ({
  default: ({ src, alt, fill: _fill, sizes: _sizes, ...rest }: Record<string, unknown>) =>
    createElement('img', { src, alt, ...rest }),
}));

import { FilmsCarousel } from './FilmsCarousel';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

const FILMS = [
  { id: 1, title: 'Спасибо за жизнь', href: '/news/1', thumbnailUrl: 'https://wp.example/1.jpg' },
  { id: 2, title: 'История с зависимостью', href: '/news/2', thumbnailUrl: null },
];

describe('<FilmsCarousel />', () => {
  it('renders the section heading', () => {
    renderInTheme(<FilmsCarousel films={FILMS} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Наши фильмы и мультфильмы' })).toBeInTheDocument();
  });

  it('renders a card per film linking to its href', () => {
    renderInTheme(<FilmsCarousel films={FILMS} />);

    expect(screen.getByRole('link', { name: 'Спасибо за жизнь' })).toHaveAttribute('href', '/news/1');
    expect(screen.getByRole('link', { name: 'История с зависимостью' })).toHaveAttribute('href', '/news/2');
  });

  it('renders a decorative thumbnail only when a thumbnailUrl is present', () => {
    renderInTheme(<FilmsCarousel films={FILMS} />);

    const withThumb = screen.getByRole('link', { name: 'Спасибо за жизнь' });
    const withoutThumb = screen.getByRole('link', { name: 'История с зависимостью' });

    expect(withThumb.querySelector('img')).toHaveAttribute('src', 'https://wp.example/1.jpg');
    expect(withThumb.querySelector('img')).toHaveAttribute('alt', '');
    expect(withoutThumb.querySelector('img')).toBeNull();
  });

  // The rendered href is slashless here on purpose: the component asks
  // `catalogueHref` for `/video/`, and next/link normalises it against
  // `trailingSlash`, which is app config the test runtime doesn't load.
  it('links the "Все видео" CTA to the video index', () => {
    renderInTheme(<FilmsCarousel films={FILMS} />);

    expect(screen.getByRole('link', { name: 'Все видео' })).toHaveAttribute('href', '/video');
  });

  it('puts the catalogue total on the CTA when the row is a slice of it', () => {
    renderInTheme(<FilmsCarousel films={FILMS} catalogueTotal={83} />);

    expect(screen.getByRole('link', { name: 'Все видео (83)' })).toBeInTheDocument();
  });

  it('leaves the CTA bare when the row already shows everything', () => {
    renderInTheme(<FilmsCarousel films={FILMS} catalogueTotal={2} />);

    expect(screen.getByRole('link', { name: 'Все видео' })).toBeInTheDocument();
  });

  it('still renders heading and CTA when there are no films', () => {
    renderInTheme(<FilmsCarousel films={[]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Наши фильмы и мультфильмы' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все видео' })).toHaveAttribute('href', '/video');
    expect(screen.queryByRole('link', { name: 'Спасибо за жизнь' })).not.toBeInTheDocument();
  });
});
