import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinkCard } from './LinkCard';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<LinkCard />', () => {
  it('renders title, illustration slot, and a default "Подробнее" link to href', () => {
    renderWithinTheme(<LinkCard title="Бизнес клуб" href="/business-club" illustration={<svg data-testid="illu" />} />);

    expect(screen.getByRole('heading', { name: 'Бизнес клуб', level: 3 })).toBeInTheDocument();
    expect(screen.getByTestId('illu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', '/business-club');
  });

  it('respects a custom linkLabel', () => {
    renderWithinTheme(<LinkCard title="Программа" href="/p" linkLabel="Перейти" />);

    expect(screen.getByRole('link', { name: 'Перейти' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Подробнее' })).not.toBeInTheDocument();
  });
});
