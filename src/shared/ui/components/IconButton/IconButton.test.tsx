import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './IconButton';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<IconButton />', () => {
  it('exposes the aria-label', () => {
    renderInTheme(<IconButton aria-label="Назад">←</IconButton>);

    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
  });

  it('applies curved radius by default', () => {
    renderInTheme(<IconButton aria-label="X">x</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('radius-curved');
  });

  it('applies circle radius when requested', () => {
    renderInTheme(
      <IconButton aria-label="X" radius="circle">
        x
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('radius-circle');
  });
});
