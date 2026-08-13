import { Theme } from '@radix-ui/themes';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HeaderClient } from './HeaderClient';
import { NavItem } from './types';

const mocks = vi.hoisted(() => ({ pathname: '/video/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

// The logo is a static `next/image` import, which carries no intrinsic size
// outside the Next build — same shim the card tests use.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} {...rest} />;
  },
}));

const navItems: NavItem[] = [
  { id: 1, parent: 0, href: '/', text: 'ГЛАВНАЯ', content: [] },
  {
    id: 2,
    parent: 0,
    href: '/about/',
    text: 'О НАС',
    content: [{ id: 21, parent: 2, href: '/about/team/', text: 'Команда', content: [] }],
  },
  { id: 3, parent: 0, href: '/video/', text: 'ВИДЕО', content: [] },
];

const renderHeader = () =>
  render(
    <Theme accentColor="red">
      <HeaderClient navItems={navItems} />
    </Theme>
  );

describe('<HeaderClient />', () => {
  it('marks the section that owns the current path, and only that one', () => {
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    const active = within(nav).getByRole('link', { name: 'ВИДЕО' });
    const idle = within(nav).getByRole('link', { name: 'ГЛАВНАЯ' });

    expect(active.className).toContain('baseActive');
    expect(idle.className).not.toContain('baseActive');
    // Colour and weight alone leave a screen reader with nothing.
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(idle).not.toHaveAttribute('aria-current');
  });

  it('keeps the donation CTA on the white Figma variant and opens it in a new tab', () => {
    renderHeader();

    const [cta] = screen.getAllByRole('link', { name: 'Оказать помощь' });
    expect(cta.className).toContain('variant-white');
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('does not render the drawer until the menu button is pressed', () => {
    renderHeader();

    const toggle = screen.getByRole('button', { name: 'Открыть меню' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Закрыть меню' })).not.toBeInTheDocument();
  });

  it('opens the drawer, colours the current section red and closes again', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    const close = screen.getByRole('button', { name: 'Закрыть меню' });
    expect(close).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');

    // The drawer repeats the nav, so each label now appears twice. The desktop
    // copy is a ButtonGroup cell (`base`); the drawer copy is a `Link`.
    const inDrawer = (name: string) =>
      screen.getAllByRole('link', { name }).find((el) => !el.className.includes('base'));

    expect(inDrawer('ВИДЕО')?.className).toContain('red');
    expect(inDrawer('ГЛАВНАЯ')?.className).toContain('primary');

    await user.click(close);
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the drawer on Escape', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
  });

  it('closes the drawer when a row is tapped, including the page already open', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    // ВИДЕО is the current path: nothing navigates, so a pathname-derived close
    // would leave the sheet up with body scroll still locked.
    const drawerRow = screen.getAllByRole('link', { name: 'ВИДЕО' }).find((el) => !el.className.includes('base'));
    await user.click(drawerRow as HTMLElement);

    expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('marks a current section that has children — it renders as the accordion label, not a row', async () => {
    mocks.pathname = '/about/';
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    // The desktop nav renders the same label, so pick the accordion's copy.
    const label = screen.getAllByText('О НАС').find((el) => el.className.includes('label'));
    expect(label?.className).toContain('labelActive');

    mocks.pathname = '/video/';
  });
});
