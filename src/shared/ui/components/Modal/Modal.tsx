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
  /**
   * Where focus goes when the dialog closes — normally whatever opened it.
   *
   * Radix's own close handler focuses its `Dialog.Trigger`, and it
   * `preventDefault()`s the focus-scope restore on the way, unconditionally.
   * This dialog is opened programmatically and has no trigger, so that ref is
   * null and focus falls to `<body>`: a keyboard reader who opened the fourth
   * image in an article and pressed Escape would land at the top of the
   * document. Callers that open from an element pass it here.
   */
  restoreFocusTo?: HTMLElement | null;
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
export const Modal = ({ isOpen, onClose, title, restoreFocusTo, children }: PropsWithChildren<ModalProps>) => (
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
    <Dialog.Content
      className={css.content}
      aria-describedby={undefined}
      onCloseAutoFocus={(event) => {
        if (restoreFocusTo) {
          event.preventDefault();
          restoreFocusTo.focus();
        }
      }}
    >
      <VisuallyHidden>
        <Dialog.Title>{title}</Dialog.Title>
      </VisuallyHidden>
      {children}
    </Dialog.Content>
  </Dialog.Root>
);
