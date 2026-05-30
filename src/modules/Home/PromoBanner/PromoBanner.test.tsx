import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PromoBanner } from './PromoBanner';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<PromoBanner />', () => {
  it('renders the title and a default "Подробнее" link pointing at ctaHref', () => {
    renderWithinTheme(<PromoBanner title="Прими участие в конкурсе" ctaHref="/contest" />);

    expect(screen.getByRole('heading', { name: 'Прими участие в конкурсе', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', '/contest');
  });

  it('supports a custom ctaLabel', () => {
    renderWithinTheme(<PromoBanner title="X" ctaLabel="Перейти" ctaHref="/x" />);

    expect(screen.getByRole('link', { name: 'Перейти' })).toBeInTheDocument();
  });
});
