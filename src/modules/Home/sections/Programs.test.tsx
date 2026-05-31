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

import { Programs } from './Programs';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

const PROGRAMS = [
  { id: 1, title: 'Здоровая Россия', href: '/programs/healthy-russia' },
  { id: 2, title: 'Здоровые дети', href: '/programs/healthy-children' },
];

describe('<Programs />', () => {
  it('renders the section heading', () => {
    renderInTheme(<Programs programs={PROGRAMS} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Программы' })).toBeInTheDocument();
  });

  it('renders a card per program with its title as an h3', () => {
    renderInTheme(<Programs programs={PROGRAMS} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Здоровая Россия' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Здоровые дети' })).toBeInTheDocument();
  });

  it('links each card to its href with a descriptive aria-label', () => {
    renderInTheme(<Programs programs={PROGRAMS} />);

    expect(screen.getByRole('link', { name: 'Здоровая Россия — подробнее' })).toHaveAttribute(
      'href',
      '/programs/healthy-russia'
    );
    expect(screen.getByRole('link', { name: 'Здоровые дети — подробнее' })).toHaveAttribute(
      'href',
      '/programs/healthy-children'
    );
  });

  it('renders nothing card-like for an empty list but keeps the heading', () => {
    renderInTheme(<Programs programs={[]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Программы' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
