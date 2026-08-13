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

  /**
   * `data-radius` rescales the radius scale on the element it sits on, so this
   * is what decides whether `--radius-2` is Figma's 6px or Radix's 4px — see the
   * note on `radiusToRadix`. Nothing about the rendered class names would show
   * the difference, which is why it is asserted here.
   */
  it('hands Radix the radius factor the design tokens are scaled to', () => {
    renderInTheme(<IconButton aria-label="X">x</IconButton>);
    expect(screen.getByRole('button')).toHaveAttribute('data-radius', 'large');

    renderInTheme(
      <IconButton aria-label="Y" radius="circle">
        y
      </IconButton>
    );
    expect(screen.getByRole('button', { name: 'Y' })).toHaveAttribute('data-radius', 'full');
  });
});
