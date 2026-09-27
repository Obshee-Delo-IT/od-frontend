import { clientErrorReport } from '@/shared/lib/clientErrorReport';
import { collapseLeadingSlashes } from '@/shared/lib/collapseLeadingSlashes';

/**
 * Client instrumentation — Next requires this module before it hydrates
 * anything (`next/dist/client/app-next.js` pulls it in ahead of
 * `appBootstrap`), which is what both halves below need.
 */

/**
 * A path whose leading slash is doubled crashes Next's own router before the
 * first render; `collapseLeadingSlashes` carries the whole explanation,
 * including why the redirect cannot live in `proxy.ts`. `replace`, not
 * `assign`, so the broken address leaves no history entry to go Back to.
 */
const collapsed = collapseLeadingSlashes(window.location.pathname);
if (collapsed) {
  window.location.replace(`${collapsed}${window.location.search}${window.location.hash}`);
}

/**
 * The first uncaught error of the page load, posted to `/api/client-error/`.
 *
 * **Registered here rather than in a component** because a hydration failure
 * happens before any of ours has mounted — an effect in the root layout would
 * miss the error it was added for. This module runs before hydration starts.
 *
 * **One report per page load.** A crashing render can throw on every retry, and
 * a visitor is not a load generator. The first is the one with the cause in it.
 *
 * `sendBeacon`, not `fetch`: it survives the navigation away that usually
 * follows a broken page, and it cannot delay one. `false` means the browser
 * refused to queue it (payload over its cap, or beacons disabled) — nothing to
 * be done about that from here, and nothing worth a fallback request.
 */
let reported = false;
window.addEventListener('error', (event) => {
  if (reported) {
    return;
  }
  const report = clientErrorReport(event, window.location.origin);
  if (!report) {
    return;
  }
  reported = true;
  navigator.sendBeacon?.('/api/client-error/', JSON.stringify(report));
});
