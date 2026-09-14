'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { METRICA_COUNTER_ID } from '@/shared/config/metrica';

declare global {
  interface Window {
    /** Defined by the loader snippet in `YandexMetrica`, as a queueing stub first. */
    ym?: (counterId: number, method: string, url?: string) => void;
  }
}

/**
 * The last URL the counter has been told about — `null` until the first render,
 * which is the one `ym('init')` counted by itself.
 *
 * **Module scope, deliberately not `useRef`/`useState`.** React Strict Mode is on
 * by default in the App Router and mounts → runs the effect → discards → runs it
 * again, and Fast Refresh remounts the component outright; a ref is reset by both
 * and would send the same view twice. A module variable survives both, and the
 * guard is URL identity rather than a run counter, so a discarded Strict Mode pass
 * is a no-op instead of a skipped hit.
 */
let lastUrl: string | null = null;

/**
 * Counts a page view on client-side navigation.
 *
 * `tag.js` does **not** count History API navigations: it patches
 * `pushState`/`replaceState` only to feed Yandex Tag Manager triggers, and
 * `trackHash` listens to `hashchange` alone. Without this the whole site would
 * report one view per visit and a ~100 % bounce rate.
 *
 * The landing view is not this component's: the loader snippet initialises with
 * `defer:true` and sends it itself, with the URL read at the moment the snippet
 * ran, so the first effect run only records that URL and stays silent. Sending it
 * here as well is the standard way this ends up double-counted — the two hits are
 * not deduplicated, and a visit with two views is never a bounce.
 */
export const MetricaRouteHits: React.FC = () => {
  const pathname = usePathname();
  /* The query string has to be a dependency, not just the pathname: this site
     navigates by query — `/news/?category=…`, `?page=N` — without the pathname
     ever changing. */
  const search = useSearchParams().toString();

  useEffect(() => {
    const url = pathname + (search ? `?${search}` : '');
    if (url === lastUrl) {
      return;
    }
    const isLanding = lastUrl === null;
    lastUrl = url;
    if (!isLanding) {
      /* A root-relative path is documented as accepted and resolved against the
         host. No `title`/`referer` options: they default to `document.title` and
         to the previous artificial hit's URL, which the tag chains itself. */
      window.ym?.(METRICA_COUNTER_ID, 'hit', url);
    }
  }, [pathname, search]);

  return null;
};
