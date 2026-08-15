import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NEWSLETTER_SIGNUP_ENABLED } from '@/shared/config/features';
import { NewsletterSignup, NewsletterSignupForm } from './NewsletterSignup';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<NewsletterSignup />', () => {
  it('disables submit until both email and consent are provided', async () => {
    const user = userEvent.setup();
    renderInTheme(<NewsletterSignupForm />);

    const submit = screen.getByRole('button', { name: 'Подписаться' });
    expect(submit).toBeDisabled();

    const email = screen.getByPlaceholderText('Адрес электронной почты');
    await user.type(email, 'a@b.ru');
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });

  it('gives the email field an accessible name', () => {
    renderInTheme(<NewsletterSignupForm />);

    expect(screen.getByRole('textbox', { name: 'Адрес электронной почты' })).toBeInTheDocument();
  });

  // The gate, not the form: a dead form is worse than none, so it stays hidden
  // until the Unisender integration exists (docs/newsletter-unisender.md).
  it('renders nothing while the feature switch is off', () => {
    const { container } = renderInTheme(<NewsletterSignup />);

    expect(container.querySelector('form')).toBeNull();
    expect(NEWSLETTER_SIGNUP_ENABLED).toBe(false);
  });
});
