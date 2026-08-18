import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImagePreviewClient } from './ImagePreviewClient';

/**
 * These exist because the component this replaced passed its own unit test and
 * did nothing in a browser: it attached handlers by walking `children`, and the
 * real content arrives across a Server Component boundary where that walk finds
 * nothing. So the fixtures below are plain DOM the component never introspects
 * — the same thing delegation sees either way.
 */

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} />
  ),
}));

const linked = (href: string, src = 'https://cdn.test/poster.jpg') => (
  <ImagePreviewClient>
    <div className="gutenberg">
      <figure>
        <a href={href}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Плакат" />
        </a>
      </figure>
    </div>
  </ImagePreviewClient>
);

/**
 * jsdom loads nothing and lays nothing out, so an `<img>` there has neither a
 * `currentSrc` nor a size — both of which the component reads off the thumbnail
 * it was clicked on. Stubbed here to what a loaded image would report.
 */
const asLoaded = (src = 'https://cdn.test/poster.jpg', natural: [number, number] = [1200, 800]) => {
  const img = document.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'currentSrc', { value: src, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: natural[0], configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: natural[1], configurable: true });
  return img;
};

const dialog = () => screen.queryByRole('dialog');

describe('ImagePreviewClient', () => {
  it('opens the lightbox on an image linked to its own upload', async () => {
    render(linked('https://cdn.test/wp-content/uploads/2021/02/poster.jpg'));
    const img = asLoaded();

    await userEvent.click(img);

    expect(dialog()).not.toBeNull();
    // The upload behind the thumbnail, not the thumbnail: on the materials
    // pages the two are different files, and `resolveContentAssets` has made
    // the href a real address.
    expect(screen.getByAltText('')).toHaveAttribute('src', 'https://cdn.test/wp-content/uploads/2021/02/poster.jpg');
  });

  /**
   * The whole reason for `preventDefault`: WordPress writes that href
   * root-relative, so following it lands on our own origin — a 404 — with the
   * modal open behind it.
   */
  it('prevents the anchor from navigating', async () => {
    render(linked('/wp-content/uploads/2021/02/poster.jpg'));
    asLoaded();

    const anchor = document.querySelector('a') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    (document.querySelector('img') as HTMLImageElement).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(anchor.getAttribute('href')).toBe('/wp-content/uploads/2021/02/poster.jpg');
  });

  it('leaves an image that links to a page as a link', async () => {
    render(linked('/healthy-russia/'));
    const img = asLoaded();

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    img.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('opens for an unlinked image too', async () => {
    render(
      <ImagePreviewClient>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://cdn.test/plain.jpg" alt="" />
      </ImagePreviewClient>
    );
    const img = asLoaded('https://cdn.test/plain.jpg');

    await userEvent.click(img);

    expect(dialog()).not.toBeNull();
  });

  /**
   * The dialog is sized from the thumbnail, so an image with no measurable size
   * has nothing to open around — and `next/image` rejects a zero width outright.
   */
  it('does nothing for an image that has not loaded', async () => {
    render(linked('/wp-content/uploads/2021/02/poster.jpg'));
    const img = asLoaded('https://cdn.test/poster.jpg', [0, 0]);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    img.dispatchEvent(event);

    expect(dialog()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  /**
   * The upload has not been fetched, so its size is unknown — the ratio comes
   * off the thumbnail and is scaled to a 1600px long side. Passing the
   * thumbnail's own pixels would have `next/image` serve a copy that small.
   */
  it("asks for the upload at full size, in the thumbnail's ratio", async () => {
    render(linked('/wp-content/uploads/2021/02/poster.jpg'));
    const img = asLoaded('https://cdn.test/poster.jpg', [300, 200]);

    await userEvent.click(img);

    const preview = screen.getByAltText('');
    expect(preview).toHaveAttribute('width', '1600');
    expect(preview).toHaveAttribute('height', '1067');
  });

  /**
   * Nothing to scale up to: the thumbnail *is* the picture, and its own size is
   * what keeps the dialog exactly as big as it — every pixel around it is
   * overlay and dismisses.
   */
  it('sizes an unlinked image from the thumbnail itself', async () => {
    render(
      <ImagePreviewClient>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://cdn.test/plain.jpg" alt="" />
      </ImagePreviewClient>
    );
    const img = asLoaded('https://cdn.test/plain.jpg', [1200, 800]);

    await userEvent.click(img);

    const preview = screen.getAllByAltText('')[1];
    expect(preview).toHaveAttribute('width', '1200');
    expect(preview).toHaveAttribute('height', '800');
  });

  it('ignores a click that is not on an image', async () => {
    render(
      <ImagePreviewClient>
        <p>Просто текст</p>
      </ImagePreviewClient>
    );

    await userEvent.click(screen.getByText('Просто текст'));

    expect(dialog()).toBeNull();
  });
});
