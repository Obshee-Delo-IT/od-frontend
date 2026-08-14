'use client';

import { useEffect, useRef, useState } from 'react';
import { decodeSegments, LEGACY_HEIGHT_MESSAGE, LEGACY_INITIAL_HEIGHT, LEGACY_MAX_HEIGHT } from '@/shared/legacy';
import css from './LegacyEmbed.module.css';

/**
 * The parent half of the A6 legacy-page fallback (LPF-003, LPF-006).
 *
 * Renders **only** the frame: the root layout already supplies the header,
 * `Container` and footer, so a page that rendered its own would show two of
 * each. The frame is same-origin — `/legacy/*` is served by this app — so no
 * CORS or `X-Frame-Options` handling is involved.
 */

/**
 * `/legacy/materials/plakati/`, with each segment encoded exactly once.
 *
 * Decoded first because the router hands segments percent-encoded: encoding what
 * is already encoded turns `%D0%B4` into `%25D0%25B4`, and the proxy then refuses
 * the doubly-encoded slug. `decodeSegments` returns `null` only for a slug the
 * page would never have rendered, so falling back to the raw value is safe.
 */
export const legacyEmbedSrc = (slug: readonly string[]): string => {
  const segments = decodeSegments(slug) ?? slug;
  return `/legacy/${segments.map((segment) => encodeURIComponent(segment)).join('/')}/`;
};

export interface LegacyEmbedProps {
  /** The catch-all's slug for the page being embedded. */
  slug: readonly string[];
  /** Announced to assistive technology in place of an unnamed region. */
  title?: string;
}

export const LegacyEmbed: React.FC<LegacyEmbedProps> = ({ slug, title = 'Содержимое страницы' }) => {
  const [height, setHeight] = useState<number | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Three gates, all load-bearing. The origin check keeps a foreign frame
      // from resizing us; the source check keeps *another* same-origin frame
      // from doing it; the shape check keeps an unrelated `postMessage` on the
      // page — analytics libraries send plenty — from being read as a height.
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) {
        return;
      }
      const message = event.data as { type?: unknown; height?: unknown } | null;
      if (!message || message.type !== LEGACY_HEIGHT_MESSAGE) {
        return;
      }
      const reported = Number(message.height);
      if (!Number.isFinite(reported) || reported <= 0 || reported > LEGACY_MAX_HEIGHT) {
        return;
      }
      setHeight(reported);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    /*
     * No `sandbox`: the embedded document is our own origin's proxy of a site
     * we own, and the two flags that would matter here cannot both be had —
     * dropping `allow-same-origin` gives the frame an opaque origin, which
     * makes `localStorage` throw and breaks the legacy widgets that use it,
     * while omitting top-level navigation would break the in-content links
     * this fallback exists to keep working. Recorded as ASM5 in the change's
     * decisions, with an explicit revisit trigger: the first authenticated
     * feature on this site.
     */
    // eslint-disable-next-line react/iframe-missing-sandbox
    <iframe
      ref={frameRef}
      className={css.frame}
      src={legacyEmbedSrc(slug)}
      title={title}
      // A non-zero starting height, so a sync that never arrives leaves a
      // visible page rather than an invisible one.
      style={{ height: height === null ? LEGACY_INITIAL_HEIGHT : `${height}px` }}
    />
  );
};
