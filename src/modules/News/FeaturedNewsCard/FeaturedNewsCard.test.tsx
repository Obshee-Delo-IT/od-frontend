import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeaturedNewsCard } from './FeaturedNewsCard';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<FeaturedNewsCard />', () => {
  it('renders date, title link, and excerpt', () => {
    renderWithinTheme(
      <FeaturedNewsCard id={7} date="2024-06-01" title="<em>Главное</em> событие" excerpt="Краткое описание события." />
    );

    expect(screen.getByText('01.06.2024')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/news/7');
    expect(screen.getByText('Главное')).toBeInTheDocument();
    expect(screen.getByText('Краткое описание события.')).toBeInTheDocument();
  });

  it('omits the excerpt block when none is supplied', () => {
    const { container } = renderWithinTheme(<FeaturedNewsCard id={1} date="2024-01-01" title="No excerpt" />);

    expect(container.querySelector('[class*="excerpt"]')).toBeNull();
  });
});
