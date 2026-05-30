import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs } from './Breadcrumbs';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<Breadcrumbs />', () => {
  it('renders a nav landmark with a Russian aria-label', () => {
    renderWithinTheme(<Breadcrumbs items={[{ label: 'Главная', href: '/' }]} />);

    expect(screen.getByRole('navigation', { name: 'Навигация' })).toBeInTheDocument();
  });

  it('renders linked items as anchors and the last item as plain text with aria-current="page"', () => {
    renderWithinTheme(
      <Breadcrumbs
        items={[{ label: 'Главная', href: '/' }, { label: 'Новости', href: '/news' }, { label: 'Заголовок статьи' }]}
      />
    );

    expect(screen.getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Новости' })).toHaveAttribute('href', '/news');

    const current = screen.getByText('Заголовок статьи');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).not.toBe('A');
  });

  it('renders one fewer separator than the number of items', () => {
    const { container } = renderWithinTheme(
      <Breadcrumbs
        Separator={<span data-testid="sep">/</span>}
        items={[{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }, { label: 'C' }]}
      />
    );

    expect(container.querySelectorAll('[data-testid="sep"]')).toHaveLength(2);
  });
});
