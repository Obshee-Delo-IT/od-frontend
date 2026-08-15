import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProjectsPage from './page';

const renderPage = () =>
  render(
    <Theme accentColor="red">
      <ProjectsPage />
    </Theme>
  );

describe('/projects/', () => {
  it('leads with the «Программы» H1 and keeps «Проекты» a second section', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Программы' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Проекты' })).toBeInTheDocument();
    // The programme grid draws no heading — the H1 names it. It is still a
    // labelled region, which is the whole point of passing the title anyway.
    expect(screen.getByRole('region', { name: 'Программы' })).toBeInTheDocument();
  });

  it('hides the same cards the home page hides', () => {
    renderPage();

    // H2 in the heading-less programmes section, H3 under the «Проекты» H2 —
    // the card follows its section so the outline never skips a level.
    expect(screen.getByRole('heading', { level: 2, name: 'Здоровая Россия' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Общее дело ПРО' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Онлайн курсы' })).toBeInTheDocument();
    // Hidden by omission from `programSections` — the config both surfaces read.
    expect(screen.queryByRole('heading', { name: 'ОД ИТ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Бизнес-клуб' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Наставничество' })).not.toBeInTheDocument();
  });

  it('has no breadcrumbs, unlike the per-project pages', () => {
    renderPage();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
