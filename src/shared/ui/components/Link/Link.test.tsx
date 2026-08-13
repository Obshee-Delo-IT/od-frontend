import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Link } from './Link';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<Link />', () => {
  it('renders a real anchor pointing at href', () => {
    // No trailing slash: `trailingSlash: true` is a next.config setting the
    // test renderer doesn't load, so next/link would strip one here.
    renderInTheme(<Link href="/news">Новости</Link>);

    expect(screen.getByRole('link', { name: 'Новости' })).toHaveAttribute('href', '/news');
  });

  it('defaults to the red colour', () => {
    renderInTheme(<Link href="/news">Новости</Link>);

    expect(screen.getByRole('link')).toHaveClass('red');
  });

  // The three colours of the Figma `Links` set, plus the documented repo extra.
  it.each(['primary', 'red', 'white', 'gray'] as const)('applies the %s colour class', (color) => {
    renderInTheme(
      <Link href="/" color={color}>
        Ссылка
      </Link>
    );

    expect(screen.getByRole('link')).toHaveClass(color);
  });

  it('marks the disabled state for assistive tech and takes it out of the tab order', () => {
    renderInTheme(
      <Link href="/" color="primary" disabled>
        Ссылка
      </Link>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveClass('disabled');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
  });

  it('leaves an enabled link untouched', () => {
    renderInTheme(<Link href="/">Ссылка</Link>);

    const link = screen.getByRole('link');
    expect(link).not.toHaveAttribute('aria-disabled');
    expect(link).not.toHaveAttribute('tabindex');
  });

  it('renders icon slots around the label and switches to inline-flex', () => {
    renderInTheme(
      <Link href="/" leftIcon={<span data-testid="left" />} rightIcon={<span data-testid="right" />}>
        Ссылка
      </Link>
    );

    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveClass('inlineFlex');
  });

  it('keeps a caller-supplied className alongside the colour class', () => {
    renderInTheme(
      <Link href="/" color="white" className="custom">
        Ссылка
      </Link>
    );

    expect(screen.getByRole('link')).toHaveClass('white', 'custom');
  });
});
