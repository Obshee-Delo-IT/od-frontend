import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatItem } from './StatItem';

describe('<StatItem />', () => {
  it('renders value, default "+" suffix, and label', () => {
    render(<StatItem value={2500} label="волонтеров" />);

    expect(screen.getByText('2500')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('волонтеров')).toBeInTheDocument();
  });

  it('respects a custom suffix and renders the illustration slot when given', () => {
    render(<StatItem value="12" label="лет работы" suffix="!" illustration={<svg data-testid="illu" />} />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();
    expect(screen.queryByText('+')).not.toBeInTheDocument();
    expect(screen.getByText('лет работы')).toBeInTheDocument();
    expect(screen.getByTestId('illu')).toBeInTheDocument();
  });
});
