import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsRow } from './StatsRow';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<StatsRow />', () => {
  it('renders all four stats with their labels', () => {
    renderInTheme(<StatsRow />);

    expect(screen.getByText('лет работы')).toBeInTheDocument();
    expect(screen.getByText('волонтеров')).toBeInTheDocument();
    expect(screen.getByText('регионов')).toBeInTheDocument();
    expect(screen.getByText('фильмов')).toBeInTheDocument();
  });

  it('renders the canonical stat values', () => {
    renderInTheme(<StatsRow />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
