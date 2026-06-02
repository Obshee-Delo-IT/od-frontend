import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrowPromo } from './NarrowPromo';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<NarrowPromo />', () => {
  it('renders the promo heading', () => {
    renderInTheme(<NarrowPromo />);

    expect(screen.getByRole('heading', { level: 2, name: /Прими участие/ })).toBeInTheDocument();
  });

  it('links "Подробнее" to the competition site in a new tab', () => {
    renderInTheme(<NarrowPromo />);

    const link = screen.getByRole('link', { name: 'Подробнее' });
    expect(link).toHaveAttribute('href', 'https://od-pro.ru/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the promo date', () => {
    renderInTheme(<NarrowPromo />);

    expect(screen.getAllByText(/1 октября 2022/).length).toBeGreaterThan(0);
  });
});
