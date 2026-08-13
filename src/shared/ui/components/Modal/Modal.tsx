'use client';

import { Dialog, VisuallyHidden } from '@radix-ui/themes';
import { PropsWithChildren } from 'react';
import css from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The dialog's accessible name. Announced on open and otherwise hidden — the
   * one thing a lightbox has no room to show, and the one thing a screen reader
   * needs.
   */
  title: string;
}

/**
 * C10. Was a hand-rolled portal (`useClickAway` + an Escape listener + a body
 * `overflow` toggle) in an otherwise-Radix stack. It is now Radix's Dialog,
 * which brings the two things the custom one could not: a **focus trap** with
 * focus restored to the trigger on close, and `role="dialog"` +
 * `aria-modal="true"` with everything behind it inert.
 *
 * No new dependency — `@radix-ui/themes` already ships Dialog. Its content
 * panel is a padded white card, which a media lightbox is not, so the chrome is
 * reset in CSS and the children own their own frame.
 */
export const Modal = ({ isOpen, onClose, title, children }: PropsWithChildren<ModalProps>) => (
  <Dialog.Root
    open={isOpen}
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    {/* No description: `undefined` is how Radix is told the omission is
        deliberate rather than an oversight it should warn about. */}
    <Dialog.Content className={css.content} aria-describedby={undefined}>
      <VisuallyHidden>
        <Dialog.Title>{title}</Dialog.Title>
      </VisuallyHidden>
      {children}
    </Dialog.Content>
  </Dialog.Root>
);
