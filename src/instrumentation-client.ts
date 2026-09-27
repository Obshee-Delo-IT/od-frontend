import { collapseLeadingSlashes } from '@/shared/lib/collapseLeadingSlashes';

/**
 * Client instrumentation — Next requires this module before it hydrates
 * anything (`next/dist/client/app-next.js` pulls it in ahead of
 * `appBootstrap`), which is the only window in which the fix below still has a
 * router to save.
 *
 * A path whose leading slash is doubled crashes that router before the first
 * render; `collapseLeadingSlashes` carries the whole explanation, including why
 * the redirect cannot live in `proxy.ts`. `replace`, not `assign`, so the
 * broken address leaves no history entry to go Back to.
 */
const collapsed = collapseLeadingSlashes(window.location.pathname);
if (collapsed) {
  window.location.replace(`${collapsed}${window.location.search}${window.location.hash}`);
}
