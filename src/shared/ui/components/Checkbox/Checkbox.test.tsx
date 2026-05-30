import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<Checkbox />', () => {
  it('renders the label and links it to the checkbox via htmlFor/id', () => {
    renderInTheme(<Checkbox id="consent" label="Я согласен" />);

    const checkbox = screen.getByRole('checkbox');
    const label = screen.getByText('Я согласен');

    expect(checkbox).toHaveAttribute('id', 'consent');
    expect(label).toHaveAttribute('for', 'consent');
  });

  it('renders without a label container when no label is supplied', () => {
    renderInTheme(<Checkbox aria-label="naked" />);

    expect(screen.queryByText(/naked/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
