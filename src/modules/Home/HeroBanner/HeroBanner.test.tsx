import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBanner } from './HeroBanner';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<HeroBanner />', () => {
  it('renders the title as an h1 and an optional subtitle', () => {
    renderWithinTheme(<HeroBanner title="Общее дело" subtitle="Помогаем людям" />);

    expect(screen.getByRole('heading', { name: 'Общее дело', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Помогаем людям')).toBeInTheDocument();
  });

  it('renders each action as a link with its label and href', () => {
    renderWithinTheme(
      <HeroBanner
        title="Title"
        actions={[
          { label: 'Стать волонтером', href: '/volunteer' },
          { label: 'Оказать помощь', href: '/donate', variant: 'soft' },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'Стать волонтером' })).toHaveAttribute('href', '/volunteer');
    expect(screen.getByRole('link', { name: 'Оказать помощь' })).toHaveAttribute('href', '/donate');
  });

  it('does not render the action row when no actions are provided', () => {
    const { container } = renderWithinTheme(<HeroBanner title="No actions" />);

    expect(container.querySelector('[class*="actions"]')).toBeNull();
  });
});
