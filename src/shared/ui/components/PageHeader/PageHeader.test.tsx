import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs } from '../Tabs';
import { PageHeader } from './PageHeader';

const renderWithTheme = (ui: React.ReactNode) => render(<Theme>{ui}</Theme>);

describe('<PageHeader />', () => {
  it('renders the title as an h1', () => {
    renderWithTheme(<PageHeader title="Новости" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Новости' })).toBeInTheDocument();
  });

  it('renders breadcrumbs when provided', () => {
    renderWithTheme(
      <PageHeader title="Новости" breadcrumbs={[{ label: 'Главная', href: '/' }, { label: 'Новости' }]} />
    );

    expect(screen.getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/');
  });

  it('omits the breadcrumb nav when no trail is given', () => {
    renderWithTheme(<PageHeader title="Программы" />);

    expect(screen.queryByRole('navigation', { name: 'Навигация' })).toBeNull();
  });

  it('renders the tabs slot', () => {
    renderWithTheme(
      <PageHeader
        title="Видео"
        tabs={<Tabs items={[{ label: 'Все', value: 'all', href: '/video' }]} activeValue="all" />}
      />
    );

    expect(screen.getByRole('link', { name: 'Все' })).toHaveAttribute('href', '/video');
  });
});
