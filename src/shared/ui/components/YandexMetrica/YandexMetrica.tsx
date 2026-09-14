import Script from 'next/script';
import { METRICA_COUNTER_ID, METRICA_ENABLED } from '@/shared/config/metrica';

/**
 * Yandex's own snippet, verbatim — the same text production's
 * `welfare/header.php` carried, with production's four options
 * (`docs/prod-migration-runbook.md` §4.9). The counter id is the only
 * substitution.
 *
 * Kept as the official loader rather than a bare `<Script src>` because `tag.js`
 * ends with `if (window.ym) { …flush the queue… }` and does nothing at all when
 * the stub is missing, with no error.
 */
const LOADER_SNIPPET = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(${METRICA_COUNTER_ID}, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
   });`;

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
 * ⚠ And `tag.js` counts one view per *document*, not per client-side navigation:
 * it patches `pushState`/`replaceState` only to feed Yandex Tag Manager triggers,
 * and `trackHash` listens to `hashchange` alone. Yandex's SPA guide covers that
 * case with `defer:true` plus a manual `hit` per route change; this deployment
 * deliberately runs the plain snippet instead, so «Просмотры» counts entries and
 * the bounce rate is not comparable with the WordPress-era figures.
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
    </>
  ) : null;
