/**
 * Where a browser's uncaught errors are written down.
 *
 * Readers reported articles flickering and sent a screenshot of a blank
 * «Application error»; the server logs held nothing, because nothing on this
 * site has ever reported a client-side error. Answering «is it still
 * happening?» took a Playwright harness replaying 156 pages. This route is the
 * cheap alternative: the beacon in `instrumentation-client.ts` posts the first
 * uncaught error of a page load, and it comes out in `docker logs` beside the
 * request that caused it.
 *
 * **A `console.error`, not a store.** Coolify already collects the container's
 * stdout and keeps it; a table would need a schema, a retention rule and a way
 * to read it, none of which exist yet and all of which can be added the day the
 * log is not enough.
 *
 * **Post to `/api/client-error/` with the trailing slash** — `trailingSlash:
 * true` makes the slashless form a 308, and `sendBeacon` does not follow
 * redirects. Same trap as `/api/revalidate/` and `/health/`.
 *
 * ⚠ Unauthenticated by necessity: the reporter is a browser that has just
 * crashed, so there is no secret it could hold. The bound on abuse is the size
 * cap below plus the fact that the body is only ever logged — never parsed into
 * anything, never echoed back, never stored.
 */
export const dynamic = 'force-dynamic';

/** Enough for a message and a stack frame; a crash report is not a payload. */
const MAX_BYTES = 2_000;

export const POST = async (request: Request): Promise<Response> => {
  const report = (await request.text()).slice(0, MAX_BYTES);

  // eslint-disable-next-line no-console -- the whole point of the route
  console.error('[client-error]', request.headers.get('user-agent') ?? '-', report);

  // 204: the browser is not waiting for an answer, and `sendBeacon` discards one.
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
