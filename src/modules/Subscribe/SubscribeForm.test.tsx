import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubscribeForm } from './SubscribeForm';

const renderWithinTheme = (ui: React.ReactElement) => render(<Theme>{ui}</Theme>);

describe('<SubscribeForm />', () => {
  it('renders the default variant with full heading, email field, consent checkbox, and submit button', () => {
    renderWithinTheme(<SubscribeForm />);

    expect(screen.getByRole('heading', { name: 'Подписаться на новости' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Адрес электронной почты')).toHaveAttribute('type', 'email');
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подписаться' })).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('link', { name: 'обработку персональных данных' })).toBeInTheDocument();
  });

  it('renders the small variant with a compact heading', () => {
    renderWithinTheme(<SubscribeForm variant="small" />);

    expect(screen.getByRole('heading', { name: 'Подписаться' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Подписаться на новости' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Адрес электронной почты')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подписаться' })).toBeInTheDocument();
  });
});
