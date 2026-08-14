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

import { Directions } from './Directions';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

const DIRECTIONS = [
  { id: 1, title: 'Бизнес-клуб', href: '/projects/business-club' },
  { id: 2, title: 'Общее дело ПРО', href: 'https://od-pro.ru' },
];

const TITLE = 'Направления деятельности';

describe('<Directions />', () => {
  it('renders the section heading', () => {
    renderInTheme(<Directions title={TITLE} directions={DIRECTIONS} />);

    expect(screen.getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
  });

  it('renders a card per direction with its title as an h3', () => {
    renderInTheme(<Directions title={TITLE} directions={DIRECTIONS} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Бизнес-клуб' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Общее дело ПРО' })).toBeInTheDocument();
  });

  it('links each card to its href with a descriptive aria-label', () => {
    renderInTheme(<Directions title={TITLE} directions={DIRECTIONS} />);

    expect(screen.getByRole('link', { name: 'Бизнес-клуб — подробнее' })).toHaveAttribute(
      'href',
      '/projects/business-club'
    );
    expect(screen.getByRole('link', { name: 'Общее дело ПРО — подробнее' })).toHaveAttribute(
      'href',
      'https://od-pro.ru'
    );
  });

  it('renders nothing card-like for an empty list but keeps the heading', () => {
    renderInTheme(<Directions title={TITLE} directions={[]} />);

    expect(screen.getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
