import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NewsCard } from './NewsCard';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<NewsCard />', () => {
  it('formats the date as DD.MM.YYYY and renders the title as a link to /news/[id]', () => {
    renderWithinTheme(<NewsCard id={42} date="2024-03-15T09:30:00" title="Заголовок &amp; тест" />);

    expect(screen.getByText('15.03.2024')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Заголовок/ });
    expect(link).toHaveAttribute('href', '/news/42');
    expect(link).toHaveTextContent('Заголовок & тест');
  });

  it('omits the next/image element when no cover URL is supplied', () => {
    const { container } = renderWithinTheme(<NewsCard id={1} date="2024-01-01" title="No image" />);

    expect(container.querySelector('img')).toBeNull();
  });
});
