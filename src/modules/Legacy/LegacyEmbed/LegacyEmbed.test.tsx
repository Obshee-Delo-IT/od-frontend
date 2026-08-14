import { Theme } from '@radix-ui/themes';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LEGACY_HEIGHT_MESSAGE } from '@/shared/legacy';
import { LegacyEmbed, legacyEmbedSrc } from './LegacyEmbed';

const renderEmbed = (slug: string[]) => render(<LegacyEmbed slug={slug} />, { wrapper: Theme });

const frame = (): HTMLIFrameElement => screen.getByTitle('Содержимое страницы') as HTMLIFrameElement;

/**
 * `MessageEvent`'s `source` is read-only and cannot be set through its
 * constructor, so it is defined on the event directly. jsdom does give the
 * iframe a real `contentWindow`, which is what makes the source check testable
 * rather than a comparison of two nulls.
 */
const postHeight = (source: Window | null, height: unknown, type: string = LEGACY_HEIGHT_MESSAGE) => {
  const event = new MessageEvent('message', { data: { type, height }, origin: window.location.origin });
  Object.defineProperty(event, 'source', { value: source });
  window.dispatchEvent(event);
};

/** Let React flush any state update the message may have queued. */
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
};

/**
 * Assert that a message was ignored — **and prove the assertion could have
 * failed**, by following it with a well-formed message and watching the height
 * change.
 *
 * Without that second half these tests are vacuous: a single microtask is not
 * enough for React to re-render, so "the height is still 60vh" holds whether the
 * message was rejected or accepted. The mutation table caught exactly that —
 * deleting the `event.source` check left the whole suite green.
 */
const expectIgnored = async (iframe: HTMLIFrameElement, post: () => void) => {
  post();
  await settle();
  expect(iframe.style.height).toBe('60vh');

  postHeight(iframe.contentWindow, 1234);
  await settle();
  expect(iframe.style.height).toBe('1234px');
};

describe('legacyEmbedSrc (LPF-003)', () => {
  it('keeps a multi-segment path slashed exactly once', () => {
    expect(legacyEmbedSrc(['materials', 'printed-products'])).toBe('/legacy/materials/printed-products/');
  });

  it('encodes a non-ASCII slug exactly once', () => {
    const src = legacyEmbedSrc(['профиль']);

    expect(src).toBe('/legacy/%D0%BF%D1%80%D0%BE%D1%84%D0%B8%D0%BB%D1%8C/');
    expect(src).not.toContain('%25');
  });
});

describe('LegacyEmbed (LPF-003)', () => {
  it('renders exactly one frame, pointing at the proxy', () => {
    renderEmbed(['team']);

    const frames = document.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('src')).toBe('/legacy/team/');
  });

  it('gives the frame a Russian accessible name', () => {
    renderEmbed(['team']);

    const title = frame().getAttribute('title');
    expect(title).toBeTruthy();
    expect(title).toMatch(/[а-яА-Я]/);
  });

  it('renders no header, footer or nested frame of its own', () => {
    const { container } = renderEmbed(['team']);

    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('starts at a visible height, so a sync that never arrives still shows content', () => {
    renderEmbed(['team']);

    expect(frame().style.height).toBe('60vh');
  });
});

describe('LegacyEmbed height messages (LPF-006)', () => {
  it('grows to a reported height, and to a later larger one', async () => {
    renderEmbed(['team']);
    const iframe = frame();

    // If this were null the source check would compare `null !== null` and
    // every assertion below would pass for the wrong reason.
    expect(iframe.contentWindow).not.toBeNull();

    postHeight(iframe.contentWindow, 4200);
    await waitFor(() => expect(iframe.style.height).toBe('4200px'));

    postHeight(iframe.contentWindow, 5100);
    await waitFor(() => expect(iframe.style.height).toBe('5100px'));
  });

  it('ignores a message from another origin', async () => {
    renderEmbed(['team']);
    const iframe = frame();

    await expectIgnored(iframe, () => {
      const event = new MessageEvent('message', {
        data: { type: LEGACY_HEIGHT_MESSAGE, height: 4200 },
        origin: 'https://evil.example',
      });
      Object.defineProperty(event, 'source', { value: iframe.contentWindow });
      window.dispatchEvent(event);
    });
  });

  /**
   * A same-origin page can hold more than one frame, and any of them can post.
   * Without the source check, an unrelated frame could resize this one.
   */
  it('ignores a same-origin message from a window that is not this frame', async () => {
    renderEmbed(['team']);
    const iframe = frame();

    await expectIgnored(iframe, () => postHeight(window, 4200));
  });

  it.each([
    ['a string', 'tall'],
    ['zero', 0],
    ['a negative number', -100],
    ['an absurd number', 50_001],
    ['not a number', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['nothing', undefined],
  ])('ignores %s as a height', async (_label, height) => {
    renderEmbed(['team']);
    const iframe = frame();

    await expectIgnored(iframe, () => postHeight(iframe.contentWindow, height));
  });

  it('accepts the boundary height but not one past it', async () => {
    renderEmbed(['team']);
    const iframe = frame();

    postHeight(iframe.contentWindow, 50_000);
    await waitFor(() => expect(iframe.style.height).toBe('50000px'));

    postHeight(iframe.contentWindow, 50_001);
    await settle();
    expect(iframe.style.height).toBe('50000px');
  });

  it('ignores a message of another type', async () => {
    renderEmbed(['team']);
    const iframe = frame();

    await expectIgnored(iframe, () => postHeight(iframe.contentWindow, 4200, 'analytics:pageview'));
  });

  it('removes its listener on unmount', () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderEmbed(['team']);
    const handler = added.mock.calls.find(([type]) => type === 'message')?.[1];
    expect(handler).toBeDefined();

    unmount();

    expect(removed).toHaveBeenCalledWith('message', handler);
    added.mockRestore();
    removed.mockRestore();
  });
});
