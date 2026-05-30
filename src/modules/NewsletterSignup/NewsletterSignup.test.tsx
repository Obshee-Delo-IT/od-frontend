import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NewsletterSignup } from './NewsletterSignup';

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

describe('<NewsletterSignup />', () => {
  it('disables submit until both email and consent are provided', async () => {
    const user = userEvent.setup();
    renderInTheme(<NewsletterSignup />);

    const submit = screen.getByRole('button', { name: 'Подписаться' });
    expect(submit).toBeDisabled();

    const email = screen.getByPlaceholderText('Адрес электронной почты');
    await user.type(email, 'a@b.ru');
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });
});
