import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<Hero />', () => {
  it('renders the H1 heading with the canonical title', () => {
    renderInTheme(<Hero />);

    expect(screen.getByRole('heading', { level: 1, name: 'Здоровая Россия — общее дело' })).toBeInTheDocument();
  });

  it('renders both hero CTAs as links to their destinations', () => {
    renderInTheme(<Hero />);

    const donate = screen.getByRole('link', { name: 'Оказать помощь' });
    expect(donate).toHaveAttribute('href', 'https://xn--d1aadek5agm.xn----9sbkcac6brh7h.xn--p1ai/');
    expect(donate).toHaveAttribute('rel', 'noopener noreferrer');

    expect(screen.getByRole('link', { name: 'Прими участие' })).toHaveAttribute('href', '/get-involved');
  });
});
