import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CookieNotice } from './CookieNotice';

const renderNotice = () =>
  render(
    <Theme accentColor="red">
      <CookieNotice />
    </Theme>
  );

afterEach(() => {
  document.cookie = 'clearfy_cookie_hide=; path=/; max-age=0';
});

describe('<CookieNotice />', () => {
  it('asks when no consent cookie is set', () => {
    renderNotice();

    expect(screen.getByRole('complementary', { name: 'Использование cookie' })).toBeInTheDocument();
    // Slashless here, `trailingSlash: true` adds the slash at runtime.
    expect(screen.getByRole('link', { name: 'Политика конфиденциальности' })).toHaveAttribute('href', '/conf_politics');
  });

  it('stays away once the cookie is there', () => {
    document.cookie = 'clearfy_cookie_hide=yes; path=/';
    renderNotice();

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  /** The same name Clearfy uses, so consent given to the old notice carries. */
  it('sets that cookie on accept and dismisses itself', async () => {
    renderNotice();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(document.cookie).toContain('clearfy_cookie_hide=yes');
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
