import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<Button />', () => {
  it('renders children', () => {
    renderInTheme(<Button>Кнопка</Button>);

    expect(screen.getByRole('button', { name: 'Кнопка' })).toBeInTheDocument();
  });

  it('applies the contained variant class by default', () => {
    renderInTheme(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveClass('variant-contained');
  });

  it('applies size classes', () => {
    renderInTheme(<Button size="xs">X</Button>);
    expect(screen.getByRole('button')).toHaveClass('size-xs');
  });

  it('respects native disabled', () => {
    renderInTheme(
      <Button disabled type="submit">
        X
      </Button>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
