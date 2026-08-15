'use client';

import Image from 'next/image';
import { useState, ReactNode } from 'react';
import { Modal } from '@/shared/ui/components/Modal';
import css from './ImagePreview.module.css';

interface ImagePreviewClientProps {
  children: ReactNode;
}

/**
 * Lightbox for the images inside WordPress content (news, films, pages).
 *
 * **One delegated listener on a wrapper, not per-image handlers.** The previous
 * version walked `children` with `cloneElement` to attach an `onClick` to every
 * `<img>` it found — which works in a unit test and attached to **nothing** in
 * the browser: the content arrives through a Server Component
 * (`GutenbergProvider` around `parsePost`'s output), and a client component
 * cannot introspect children it receives across that boundary. Measured on
 * three pages: 0 of 19 images carried the handler. Delegation does not care how
 * the subtree was produced.
 *
 * **Only media links are hijacked.** WordPress's "link to media file" wraps the
 * image in an `<a>` to the raw upload, and that is what the lightbox replaces —
 * `preventDefault`, or the browser navigates to the JPEG out from under the
 * modal (before this, it navigated to a 404: the href is written root-relative
 * and resolves against *our* origin). An image linking to a real page keeps its
 * link; hijacking that would break navigation to hide the destination behind a
 * picture of it.
 *
 * The modal shows `img.currentSrc`, not the anchor's href: `resolveContentImages`
 * has already pointed the `src` at the CDN or the WP origin, while the href is
 * whatever the editor typed.
 */

/** WordPress uploads live under this path on any host it serves them from. */
const MEDIA_PATH = '/wp-content/uploads/';

const previewSource = (target: EventTarget | null): HTMLImageElement | null => {
  if (!(target instanceof Element)) {
    return null;
  }
  const img = target.closest('img');
  if (!(img instanceof HTMLImageElement) || !img.currentSrc) {
    return null;
  }
  const href = img.closest('a')?.getAttribute('href');
  // No anchor at all is still a preview; an anchor to anything but the upload
  // is a link the reader asked for.
  return href === undefined || href === null || href.includes(MEDIA_PATH) ? img : null;
};

export const ImagePreviewClient = ({ children }: ImagePreviewClientProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  /**
   * The thumbnail that opened the lightbox, so closing puts focus back on it
   * instead of dropping the reader at the top of the document. State, not a ref:
   * it is read while rendering `<Modal>`, which `react-hooks/refs` rightly
   * forbids for a ref.
   */
  const [openedFrom, setOpenedFrom] = useState<HTMLElement | null>(null);

  const open = (event: React.SyntheticEvent) => {
    const img = previewSource(event.target);
    if (!img) {
      return;
    }
    event.preventDefault();
    setOpenedFrom(img.closest('a') ?? img);
    setSelectedImage(img.currentSrc);
  };

  const handleClose = () => {
    setSelectedImage(null);
  };

  return (
    <>
      {/* The keyboard path is the anchor WordPress already wraps the image in:
          it is focusable, and activating it fires the same click event this
          handler sees. An image with no link is decoration and stays inert,
          rather than being turned into a tab stop by script. */}
      <div className={css.root} onClick={open}>
        {children}
      </div>
      <Modal isOpen={!!selectedImage} onClose={handleClose} title="Просмотр изображения" restoreFocusTo={openedFrom}>
        {selectedImage && (
          <div className={css.imageWrapper}>
            <Image src={selectedImage} alt="" fill style={{ objectFit: 'contain' }} quality={80} />
          </div>
        )}
      </Modal>
    </>
  );
};
