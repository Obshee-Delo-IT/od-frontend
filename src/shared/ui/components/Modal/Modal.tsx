'use client';

import { useClickAway } from '@uidotdev/usehooks';
import { PropsWithChildren, useEffect } from 'react';
import { createPortal } from 'react-dom';
import css from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Modal = ({ isOpen, onClose, children }: PropsWithChildren<ModalProps>) => {
  const ref = useClickAway<HTMLDivElement>(() => {
    onClose();
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className={css.overlay}>
      <div ref={ref} className={css.content}>
        {children}
      </div>
    </div>,
    document.body
  );
};
