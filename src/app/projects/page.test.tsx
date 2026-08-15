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

import ProjectsPage from './page';

const renderPage = () =>
  render(
    <Theme accentColor="red">
      <ProjectsPage />
    </Theme>
  );

describe('/projects/', () => {
  it('keeps «Программы» and «Направления деятельности» as two sections', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 2, name: 'Программы' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Направления деятельности' })).toBeInTheDocument();
  });

  it('hides the same cards the home page hides', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 3, name: 'Здоровая Россия' })).toBeInTheDocument();
    // Hidden by omission from `programSections` — the config both surfaces read.
    expect(screen.queryByRole('heading', { level: 3, name: 'ОД ИТ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Бизнес-клуб' })).not.toBeInTheDocument();
  });

  it('has no breadcrumbs, unlike the per-project pages', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Проекты' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
