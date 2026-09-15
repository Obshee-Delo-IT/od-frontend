import Script from 'next/script';
import { Suspense } from 'react';
import { METRICA_COUNTER_ID, METRICA_ENABLED } from '@/shared/config/metrica';
import { MetricaRouteHits } from './MetricaRouteHits';

/**
 * Yandex's own snippet, verbatim — copied out of this counter's own **Настройка
 * → Счётчик → Скопировать** on 2026-09-15, which is the only authoritative copy
 * (the help pages publish an abridged loader, without the duplicate-script
 * guard). Do not tidy it: the indentation, the quoting and the option order are
 * as generated, so the next paste from that button is a clean diff.
 *
 * It carries two options production's older copy did not — `referrer:
 * document.referrer` and `url: location.href`, which pin the first view to the
 * document that was open rather than to whatever `tag.js` resolves when it
 * finishes loading. The counter id is the only substitution: it comes from
 * `METRICA_COUNTER_ID` rather than the literal the settings page pastes, so this
 * public repository does not carry the organisation's account number.
 *
 * Kept as the official loader rather than a bare `<Script src>` because `tag.js`
 * ends with `if (window.ym) { …flush the queue… }` and does nothing at all when
 * the stub is missing, with no error.
 *
 * **Two lines are Yandex's SPA setup and not ours to tidy either**
 * (yandex.ru/support/metrica/code/counter-spa-setup): `defer: true`, which turns
 * off the automatic view — «Это нужно, чтобы отключить автоматическую отправку
 * данных о просмотрах» — and the `hit` that then sends the landing view. It is
 * sent here rather than from `MetricaRouteHits` so that it cannot depend on which
 * effect React runs first, and so that its URL is the one that was open rather
 * than whichever is current when `tag.js` finishes loading.
 */
const LOADER_SNIPPET = `(function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js', 'ym');

    ym(${METRICA_COUNTER_ID}, 'init', {defer: true, webvisor:true, clickmap:true, referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
    ym(${METRICA_COUNTER_ID}, 'hit', location.pathname + location.search);`;

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
 *
 * ⚠ Scroll maps, form analytics and Webvisor 1.0 do not work on an SPA — the
 * same guide says so. Webvisor 2.0, the clickmap and the link map do.
 */
export const YandexMetrica: React.FC = () =>
  /* Only the tier that owns the counter renders it — see `METRICA_ENABLED`. */
  METRICA_ENABLED ? (
    <>
      <Script id="yandex-metrica" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: LOADER_SNIPPET }} />
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
      {/* `useSearchParams` in the root layout without a boundary would
          client-render every route above it — all 49 prerendered pages, the 42
          post pages that are this site's SEO surface included. The boundary keeps
          them static; its fallback is nothing, because the tag renders nothing. */}
      <Suspense fallback={null}>
        <MetricaRouteHits />
      </Suspense>
    </>
  ) : null;
