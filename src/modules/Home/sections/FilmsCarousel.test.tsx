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

    expect(screen.getByRole('heading', { level: 2, name: 'Наши фильмы, мультфильмы и ролики' })).toBeInTheDocument();
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

  it('links the "Все фильмы" CTA to the video index', () => {
    renderInTheme(<FilmsCarousel films={FILMS} />);

    expect(screen.getByRole('link', { name: 'Все фильмы' })).toHaveAttribute('href', '/video');
  });

  it('still renders heading and CTA when there are no films', () => {
    renderInTheme(<FilmsCarousel films={[]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Наши фильмы, мультфильмы и ролики' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все фильмы' })).toHaveAttribute('href', '/video');
    expect(screen.queryByRole('link', { name: 'Спасибо за жизнь' })).not.toBeInTheDocument();
  });
});
