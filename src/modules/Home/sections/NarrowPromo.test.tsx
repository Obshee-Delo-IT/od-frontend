import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrowPromo, promoDate } from './NarrowPromo';

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

  it('shows the current season, which rolls over on 1 August', () => {
    expect(promoDate(new Date('2026-07-31T12:00:00Z'))).toBe('1 октября 2025 – 28 апреля 2026');
    expect(promoDate(new Date('2026-08-01T12:00:00Z'))).toBe('1 октября 2026 – 28 апреля 2027');
    expect(promoDate(new Date('2026-12-31T12:00:00Z'))).toBe('1 октября 2026 – 28 апреля 2027');
    expect(promoDate(new Date('2027-01-01T12:00:00Z'))).toBe('1 октября 2026 – 28 апреля 2027');
  });

  it('renders that date in the banner', () => {
    renderInTheme(<NarrowPromo />);

    expect(screen.getAllByText(promoDate(new Date())).length).toBeGreaterThan(0);
  });
});
