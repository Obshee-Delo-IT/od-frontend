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
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
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

// jsdom does not load images, so `currentSrc` stays empty unless it is set.
const withCurrentSrc = (src = 'https://cdn.test/poster.jpg') => {
  const img = document.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'currentSrc', { value: src, configurable: true });
  return img;
};

const dialog = () => screen.queryByRole('dialog');

describe('ImagePreviewClient', () => {
  it('opens the lightbox on an image linked to its own upload', async () => {
    render(linked('/wp-content/uploads/2021/02/poster.jpg'));
    const img = withCurrentSrc();

    await userEvent.click(img);

    expect(dialog()).not.toBeNull();
    expect(screen.getByAltText('')).toHaveAttribute('src', 'https://cdn.test/poster.jpg');
  });

  /**
   * The whole reason for `preventDefault`: WordPress writes that href
   * root-relative, so following it lands on our own origin — a 404 — with the
   * modal open behind it.
   */
  it('prevents the anchor from navigating', async () => {
    render(linked('/wp-content/uploads/2021/02/poster.jpg'));
    withCurrentSrc();

    const anchor = document.querySelector('a') as HTMLAnchorElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    (document.querySelector('img') as HTMLImageElement).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(anchor.getAttribute('href')).toBe('/wp-content/uploads/2021/02/poster.jpg');
  });

  it('leaves an image that links to a page as a link', async () => {
    render(linked('/healthy-russia/'));
    const img = withCurrentSrc();

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
    const img = withCurrentSrc('https://cdn.test/plain.jpg');

    await userEvent.click(img);

    expect(dialog()).not.toBeNull();
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
