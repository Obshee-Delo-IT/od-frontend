import Script from 'next/script';
import { Suspense } from 'react';
import { METRICA_COUNTER_ID, METRICA_ENABLED } from '@/shared/config/metrica';
import { MetricaRouteHits } from './MetricaRouteHits';

/**
 * Production's snippet, with production's four options and one addition — the tag
 * moves with the domain rather than being rewritten
 * (`docs/prod-migration-runbook.md` §4.9). Kept as the official loader instead of
 * a bare `<Script src>`: `tag.js` ends with `if (window.ym) { …flush the queue… }`
 * and does nothing at all when the stub is missing, with no error.
 *
 * **`defer:true` and an explicit landing `hit` are the addition, and they are what
 * Yandex documents for an SPA** (yandex.ru/support/metrica/code/counter-spa-setup).
 * Left on the default, `init` resolves the landing view's URL when `tag.js`
 * *finishes loading*, not when this ran — so a visitor who clicks through during
 * that window has the landing view recorded against the page they moved to, which
 * `MetricaRouteHits` then counts a second time. Queued with the URL read here, the
 * view is pinned to the page that was actually open. It also gives the tag a
 * first artificial hit to chain the next one's referrer from; without it the
 * second page reports the external referrer instead of this one.
 */
const LOADER_SNIPPET = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${METRICA_COUNTER_ID},"init",{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
ym(${METRICA_COUNTER_ID},"hit",location.pathname+location.search);`;

/**
 * The Yandex Metrica tag (A4).
 *
 * **Unconditional, and not gated on `CookieNotice`.** Production's is
 * unconditional, the published policy offers browser settings as the opt-out, and
 * F6's notice states what cookies are used rather than asking consent — so this is
 * parity. Gating it on the click would be a new decision, not this step.
 *
 * ⚠ Expect the counter's numbers to step up and do not read it as double
 * counting: production's copy is `type="rocketlazyloadscript"`, so it fires only
 * after the visitor's first interaction and a visit without one sends nothing at
 * all. `next/script` has no such delay, so every traffic figure in `docs/` comes
 * from a counter that saw less than this one will.
 */
export const YandexMetrica: React.FC = () => {
  /* Only the tier that owns the counter renders it — see `METRICA_ENABLED`. */
  if (!METRICA_ENABLED) {
    return null;
  }

  return (
    <>
      {/* `beforeInteractive`, and the rule that objects is a Pages Router rule —
          its message names `pages/_document.js`, which this project does not
          have; the App Router's documented home for the strategy is the root
          layout, which is where this renders. Measured on a production build:
          with `afterInteractive` the snippet is not in the served HTML at all
          (next/script appends it from an effect, so nothing is counted until
          hydration finishes), with `beforeInteractive` it ships in the document
          and runs before it — which is also what §4.9's gate greps for. */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="yandex-metrica" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: LOADER_SNIPPET }} />
      {/* Production's pixel, kept. It is the one part that must be in the served
        HTML, since it is what a visitor without JavaScript sends. */}
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- a tracking pixel,
            not an image: `next/image` would proxy it through the optimizer. */}
          <img
            src={`https://mc.yandex.ru/watch/${METRICA_COUNTER_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
      {/* `useSearchParams` in the root layout without a boundary would client-render
        every route above it — all 49 prerendered pages, the 42 post pages that are
        this site's SEO surface included. The boundary keeps them static; its
        fallback is nothing, because the tag renders nothing. */}
      <Suspense fallback={null}>
        <MetricaRouteHits />
      </Suspense>
    </>
  );
};
