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
 * **The modal shows the anchor's href, falling back to `img.currentSrc`.** Both
 * are real addresses now — `resolveContentAssets` resolves the media href the
 * same way it resolves the `src` — and on the materials pages they are
 * different files rather than two sizes of one: `/materials/plakati/` shows a
 * 270px-tall preview and links the print-quality poster behind it. Opening the
 * preview in a lightbox is opening the small picture bigger, which is what it
 * did before.
 */

/** WordPress uploads live under this path on any host it serves them from. */
const MEDIA_PATH = '/wp-content/uploads/';

interface PreviewSource {
  img: HTMLImageElement;
  /** The full-size upload behind the thumbnail, when the editor linked one. */
  href: string | null;
}

const previewSource = (target: EventTarget | null): PreviewSource | null => {
  if (!(target instanceof Element)) {
    return null;
  }
  const img = target.closest('img');
  if (!(img instanceof HTMLImageElement) || !img.currentSrc) {
    return null;
  }
  const href = img.closest('a')?.getAttribute('href') ?? null;
  // No anchor at all is still a preview; an anchor to anything but the upload
  // is a link the reader asked for.
  if (href !== null && !href.includes(MEDIA_PATH)) {
    return null;
  }

  return { img, href };
};

/**
 * How big to ask `next/image` for the full-size file.
 *
 * The dialog is capped at 90vw × 90vh, and the ratio has to come off the
 * thumbnail — it is the only thing on screen to measure, and the upload behind
 * it has not been fetched. Scaling that ratio up to a 1600px long side is what
 * makes the request a full-size one: passing the thumbnail's own 187 × 207
 * would have `next/image` serve a 187px-wide copy of the poster, which is the
 * bug this replaces.
 */
const PREVIEW_LONG_SIDE = 1600;

const previewSize = (width: number, height: number, scaleUp: boolean): { width: number; height: number } => {
  const scale = scaleUp ? PREVIEW_LONG_SIDE / Math.max(width, height) : 1;

  return scale > 1 ? { width: Math.round(width * scale), height: Math.round(height * scale) } : { width, height };
};

/**
 * What the lightbox shows. The size travels with the source because the dialog
 * has to be **exactly as big as the picture**: a `fill` image inside a fixed
 * 90vw × 90vh box letterboxes the picture but leaves the whole box part of the
 * dialog, so a click in the grey beside a portrait image landed on the dialog
 * and did not dismiss it — only clicks out at the viewport edge did.
 *
 * Taken off the clicked thumbnail, which is on screen and therefore measurable:
 * `naturalWidth` when the file has loaded, the laid-out size otherwise.
 */
interface Preview {
  src: string;
  width: number;
  height: number;
}

export const ImagePreviewClient = ({ children }: ImagePreviewClientProps) => {
  const [preview, setPreview] = useState<Preview | null>(null);
  /**
   * The thumbnail that opened the lightbox, so closing puts focus back on it
   * instead of dropping the reader at the top of the document. State, not a ref:
   * it is read while rendering `<Modal>`, which `react-hooks/refs` rightly
   * forbids for a ref.
   */
  const [openedFrom, setOpenedFrom] = useState<HTMLElement | null>(null);

  const open = (event: React.SyntheticEvent) => {
    const source = previewSource(event.target);
    if (!source) {
      return;
    }
    const { img, href } = source;
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      // Nothing measurable yet — leave the anchor to do whatever it does rather
      // than open a dialog around an image `next/image` would reject.
      return;
    }
    event.preventDefault();
    setOpenedFrom(img.closest('a') ?? img);
    setPreview({ src: href ?? img.currentSrc, ...previewSize(width, height, href !== null) });
  };

  const handleClose = () => {
    setPreview(null);
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
      <Modal isOpen={!!preview} onClose={handleClose} title="Просмотр изображения" restoreFocusTo={openedFrom}>
        {preview && (
          <Image
            src={preview.src}
            alt=""
            width={preview.width}
            height={preview.height}
            className={css.image}
            quality={80}
            // Eager: the default `loading="lazy"` leaves the dialog collapsed to
            // nothing until the file arrives, so it pops open a beat late and at
            // the wrong size. It is the only thing on screen — there is nothing
            // to defer it behind.
            priority
          />
        )}
      </Modal>
    </>
  );
};
