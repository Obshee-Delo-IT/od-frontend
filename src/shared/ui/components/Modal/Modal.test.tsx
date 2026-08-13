import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

const renderModal = (props: Partial<React.ComponentProps<typeof Modal>> = {}) =>
  render(
    <Theme accentColor="red">
      <button type="button">Открыть</button>
      <Modal isOpen onClose={() => {}} title="Просмотр изображения" {...props}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photo.jpg" alt="Фото" />
      </Modal>
    </Theme>
  );

describe('<Modal />', () => {
  it('renders nothing while closed', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes a dialog with an accessible name', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Просмотр изображения' })).toHaveAttribute('data-state', 'open');
    expect(screen.getByAltText('Фото')).toBeInTheDocument();
  });

  it('keeps the title out of the visible layout', () => {
    renderModal();

    // Radix's VisuallyHidden clips it rather than hiding it from the a11y tree.
    const title = screen.getByText('Просмотр изображения');
    expect(getComputedStyle(title.parentElement as HTMLElement).position).toBe('absolute');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('takes focus and hides the rest of the page from assistive tech', async () => {
    renderModal();

    // Both are what the hand-rolled portal never did: focus moves into the
    // dialog, and everything behind it leaves the accessibility tree — the
    // button is still in the DOM but no longer has a role.
    const dialog = await screen.findByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    expect(screen.queryByRole('button', { name: 'Открыть' })).not.toBeInTheDocument();
    expect(screen.getByText('Открыть')).toBeInTheDocument();
  });
});
