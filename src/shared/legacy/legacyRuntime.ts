import { legacyFontFaces } from './legacyFonts';
import { LEGACY_HEIGHT_MESSAGE } from './legacyMessage';

/**
 * The script the proxy injects into every legacy document (LCP-008, LCP-011).
 *
 * It is written as a **real function** and serialised with `toString()` rather
 * than kept as a template string, so ESLint, TypeScript and the editor all see
 * it as code. That is not cosmetic: five of GATE 1's eight review rounds were
 * spent on these forty lines, and prose review of them has demonstrably reached
 * its limit — `e2e/legacy-embed.spec.ts` is where they are actually verified.
 *
 * Two constraints follow from being stringified:
 *
 * - it may not close over anything outside itself — everything it needs arrives
 *   in `config`, which is serialised alongside it;
 * - it avoids syntax a downlevelling transpiler would rewrite into a call to a
 *   module-scope helper (object spread, destructuring, `async`), because that
 *   helper would not exist in the browser.
 */
interface LegacyRuntimeConfig {
  /** The origin the document was fetched from. */
  legacyOrigin: string;
  /** Our own origin — where in-content navigation must land. */
  siteOrigin: string;
  /** {@link LEGACY_HEIGHT_MESSAGE}, passed in so the function closes over nothing. */
  messageType: string;
  /** {@link legacyFontFaces}, with `%SITE%` still in it for the document to fill in. */
  fontFaces: string;
}

const legacyRuntime = (config: LegacyRuntimeConfig): void => {
  const LEGACY = config.legacyOrigin;
  const SITE = config.siteOrigin;
  const ASSET = /^\/(?:wp-content|wp-includes|wp-json)\//i;
  const doc = document;

  /**
   * Compared by host rather than origin, in step with the transform: legacy
   * WordPress content carries hard-coded `http://` links to its own site, and an
   * origin comparison reads those as third-party — which would open the legacy
   * origin in a new tab.
   */
  const hostOf = (value: string): string => {
    try {
      return new URL(value).host;
    } catch (_error) {
      return '';
    }
  };
  const LEGACY_HOST = hostOf(LEGACY);
  const SITE_HOST = hostOf(SITE);

  // --- Webfonts -------------------------------------------------------------
  // Re-declared against whatever origin *this document* came from, because the
  // `<base href>` makes even a rooted path resolve to the legacy origin, and
  // fonts are the one subresource that is always fetched under CORS — which the
  // legacy origin does not answer. Appended last so it wins on document order.
  // Not gated on being framed: opened directly, this page wants its icons too.
  try {
    const faces = doc.createElement('style');
    faces.textContent = config.fontFaces.split('%SITE%').join(window.location.origin);
    (doc.head || doc.documentElement).appendChild(faces);
  } catch (_error) {
    // Missing icons are worth nothing else on this page breaking.
  }

  // --- Height reporting (LCP-008) -------------------------------------------
  // Only when framed: opened directly this must be an inert no-op.
  if (window.parent !== window) {
    let last = 0;
    let scrollSuppressed = false;

    /**
     * `force` re-sends a height the parent has already been told, which sounds
     * pointless and is the whole repair. The parent listens from a `useEffect`,
     * so on a back-navigation — frame served from cache, hydration still
     * pending — the first report lands before anything is listening. Without a
     * resend the `last` check then suppresses every later one and the frame is
     * stuck at its 60vh starting height with its own scrollbar already
     * suppressed, i.e. content that cannot be reached at all. Measured: 2149px
     * of page in a 540px box, permanently.
     */
    const report = (force?: boolean): void => {
      try {
        const body = doc.body;
        const height = Math.max(doc.documentElement.scrollHeight, body ? body.scrollHeight : 0);
        if (!force && Math.abs(height - last) < 2) {
          return;
        }
        last = height;
        window.parent.postMessage({ type: config.messageType, height: height }, window.location.origin);
        // Suppress the inner scrollbar only **after** the parent has been told
        // a height it can grow to. Doing it up front — or in static CSS — turns
        // any failure of this script into a page whose content cannot be
        // reached at all: the frame stays at its starting height and the
        // document can no longer scroll inside it.
        if (!scrollSuppressed) {
          scrollSuppressed = true;
          doc.documentElement.style.overflowY = 'hidden';
        }
      } catch (_error) {
        // A parent on another origin, or a frame detached mid-report. Neither
        // is worth breaking the page over.
      }
    };

    // Wrapped rather than passed by reference: a listener is called with an
    // Event, an observer with an entry list, and either would arrive as a
    // truthy `force` and turn every resize into a message.
    doc.addEventListener('DOMContentLoaded', () => report());
    window.addEventListener('load', () => report());
    // Restored from the back/forward cache: this document's timers are long
    // finished and `last` still holds the height nobody is listening for.
    window.addEventListener('pageshow', () => report(true));
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => report()).observe(doc.documentElement);
    }
    // A bounded settling window, not a permanent timer: lazy images and cmsms
    // sliders do not always trigger an observable resize, but nothing useful
    // happens ten seconds after load. Forced, so it doubles as the retry for a
    // parent that was not yet listening.
    let ticks = 0;
    const settling = setInterval(() => {
      report(true);
      ticks += 1;
      if (ticks > 10) {
        clearInterval(settling);
      }
    }, 1000);
  }

  // --- Navigation (LCP-011) --------------------------------------------------
  // Capture phase, so a legacy handler calling `stopPropagation` cannot let a
  // click through to the browser's default — which, under a cross-origin
  // `<base href>`, is a navigation to the legacy origin. We never call
  // `stopPropagation` ourselves, so the page's own handlers still run.
  doc.addEventListener(
    'click',
    (event: MouseEvent) => {
      const start = event.target as Element | null;
      const anchor = start && start.closest ? (start.closest('a[href], area[href]') as HTMLAnchorElement | null) : null;
      if (!anchor) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch (_error) {
        return;
      }

      if (url.protocol === 'javascript:' || url.protocol === 'data:') {
        event.preventDefault();
        return;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return; // mailto:, tel: — the browser's business, not ours
      }

      // 1. Same document plus a fragment. Judged against `document.baseURI`,
      //    never `location.pathname`: inside the frame the latter carries the
      //    `/legacy/` prefix and matches nothing. And the handler must own the
      //    whole behaviour — with a cross-origin base this is not a
      //    same-document navigation, so letting the default run would take the
      //    frame to the legacy origin.
      const written = anchor.getAttribute('href') || '';
      const here = (doc.baseURI || window.location.href).split('#')[0];
      if (written.charAt(0) === '#' || (written.indexOf('#') !== -1 && anchor.href.split('#')[0] === here)) {
        event.preventDefault();
        let id = url.hash.slice(1);
        try {
          id = decodeURIComponent(id);
        } catch (_error) {
          // A malformed escape; fall back to the raw fragment.
        }
        if (!id) {
          // The bare `href="#"` idiom. Deliberately **not** scrolled to the
          // top: on the legacy theme it is a JS hook — both occurrences in the
          // `/faq/` capture are accordion toggles — and jerking the page to the
          // top on every toggle is a regression the old site does not have. The
          // page's own handler runs immediately after this one and does the
          // toggling.
          return;
        }
        const target = doc.getElementById(id) || doc.getElementsByName(id)[0];
        if (target && target.scrollIntoView) {
          target.scrollIntoView();
        }
        return;
      }

      // 2. Correct the destination *before* deciding anything about context.
      //    This has to happen even for clicks we then hand back to the browser
      //    — a modified click, or `target="_blank"` — or a document-relative
      //    link opens the legacy origin in a new tab.
      //
      //    `isAsset` is tested independently of origin so that a deployment
      //    where the two origins are the same string still opens a download in
      //    its own context instead of replacing the page with a JPEG.
      const isAsset = ASSET.test(url.pathname);
      if (url.host === LEGACY_HOST && !isAsset) {
        anchor.href = SITE + url.pathname + url.search + url.hash;
      } else if (url.host !== SITE_HOST || isAsset) {
        // A download or a third-party link: genuinely off-site, so it opens in
        // its own context. An author's `target="_self"` is not consent to
        // replace the embedded page with a JPEG.
        if (!anchor.target || anchor.target === '_self') {
          anchor.target = '_blank';
        }
        const rel = anchor.getAttribute('rel') || '';
        if (rel.indexOf('noopener') === -1) {
          anchor.setAttribute('rel', (rel + ' noopener').replace(/^\s+/, ''));
        }
        return;
      }

      // 3. Only now, the browsing context.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
        return;
      }
      if (event.shiftKey || event.altKey) {
        return;
      }
      if (anchor.target && anchor.target !== '_self') {
        return;
      }
      event.preventDefault();
      // The top-level window, not the frame: otherwise the site's own shell
      // renders inside the box.
      (window.top || window).location.href = anchor.href;
    },
    true
  );

  // Removing `action` (LCP-007) is not neutralisation once a `<base href>`
  // exists — an actionless form submits to the base URL, i.e. the legacy
  // origin. This is what actually stops it.
  doc.addEventListener(
    'submit',
    (event: Event) => {
      event.preventDefault();
    },
    true
  );

  // …and a listener alone is not enough either: `form.submit()` called from
  // script does **not** dispatch a submit event, by specification. The legacy
  // theme's own widgets do call it. Neutralised at the prototype, inside this
  // document only.
  try {
    HTMLFormElement.prototype.submit = function neutralised(): void {
      /* the embedded document may not navigate itself off the page */
    };
  } catch (_error) {
    // A frozen prototype; the listener above still covers user submissions.
  }
};

/** The `<script>` body the transform inlines. */
export const legacyRuntimeSource = (config: Omit<LegacyRuntimeConfig, 'messageType' | 'fontFaces'>): string => {
  const full: LegacyRuntimeConfig = {
    ...config,
    messageType: LEGACY_HEIGHT_MESSAGE,
    fontFaces: legacyFontFaces(),
  };
  // `<` escaped inside the JSON literal only: a `</script>` in a configured
  // value would otherwise close the element early. The function source itself
  // must not be escaped — it contains `<` as an operator.
  const serialised = JSON.stringify(full).replace(/</g, '\\u003c');
  return `(${legacyRuntime.toString()})(${serialised});`;
};
