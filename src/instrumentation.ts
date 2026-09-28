import { serverErrorReport } from '@/shared/lib/serverErrorReport';
import type { Instrumentation } from 'next';

/**
 * Where the server's own errors are written down (A4b).
 *
 * The companion to `instrumentation-client.ts`. That file reports what the
 * browser throws; this one reports what this process throws while rendering a
 * page, answering a route handler or running a Server Action — and until it
 * existed, none of it was recorded anywhere but an unhandled stack trace Next
 * happens to print.
 *
 * **It is what makes a `digest` usable.** React refuses to send an error's text
 * to the browser and sends an opaque hash instead, so a visitor hitting
 * `global-error.tsx` can report `digest: "2951913545"` and nothing more. That
 * hash is only a key if something on this side wrote down which stack it
 * belongs to. This is that something: grep the same digest in the container log
 * and the page's crash is there with its message and stack.
 *
 * **A `console.error`, not a store** — the same reasoning as
 * `app/api/client-error/route.ts`, and the same JSON-on-one-line shape, so the
 * day these logs are shipped somewhere searchable both halves parse alike.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const report = serverErrorReport(error, request, context);
  if (!report) {
    return;
  }

  /**
   * **A failure nobody was waiting for is a warning, not an error.** There is
   * no retry anywhere in this app — `httpClient` has none, and Next's
   * `staticGenerationRetryCount` is a build-time export setting — but ISR is
   * the next best thing: when a *cached* page fails to refresh, Next goes on
   * serving the copy it has and tries again on the next request, so a visitor
   * saw a page and never knew. `revalidateReason` is empty only when someone
   * was actually waiting, and that is the case worth waking anyone for.
   */
  // eslint-disable-next-line no-console -- the whole point of the hook
  const write = report.revalidateReason ? console.warn : console.error;

  write('[server-error]', JSON.stringify(report));
};
