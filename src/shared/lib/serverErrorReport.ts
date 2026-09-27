/** What a server-side error is written down as — the client beacon's counterpart. */
export interface ServerErrorReport {
  message: string;
  /**
   * The one field that ties the two halves together. React sends this digest —
   * and nothing else — to the browser, so it is what `global-error.tsx` reports
   * back; the stack that produced it only ever exists here.
   */
  digest: string;
  path: string;
  method: string;
  /** Which half threw: `render`, `route`, `action` or `proxy`. */
  routeType: string;
  /** The route pattern, e.g. `/[...slug]` — `path` is the URL that asked for it. */
  routePath: string;
  /**
   * Kept, with a caveat: in a standalone build the app's own frames are chunk
   * offsets, so what earns its bytes here are the `node_modules` frames — which
   * is where a WordPress fetch fails, and that is the likeliest 500 on this site.
   */
  stack: string;
}

/** Keeps one field from turning a crash report into a payload. */
const MAX_FIELD = 300;

/** The stack is the reason this exists, so it gets room — but not a whole log line's worth. */
const MAX_STACK = 1_200;

/**
 * An `onRequestError` call reduced to the fields worth logging, or `null` for
 * the ones that are not errors at all.
 *
 * **Next's control flow throws.** `notFound()` and `redirect()` are exceptions
 * carrying a `NEXT_*` digest, and on this site the catch-all answers for every
 * unknown path, so a crawler sweeping made-up URLs would otherwise write a
 * stack trace per 404. Anything under that prefix is dropped; note that
 * `DYNAMIC_SERVER_USAGE` deliberately is not — an uncached fetch on the page
 * surface 500s production while `next dev` answers 200, and that is precisely
 * a thing to hear about.
 */
export const serverErrorReport = (
  error: unknown,
  request: Readonly<{ path: string; method: string }>,
  context: Readonly<{ routeType: string; routePath: string }>
): ServerErrorReport | null => {
  const carried = (error as { digest?: unknown } | null)?.digest;
  const digest = typeof carried === 'string' ? carried : '';
  if (digest.startsWith('NEXT_')) {
    return null;
  }

  const thrown = error instanceof Error ? `${error.name}: ${error.message}`.trim() : String(error ?? '').trim();
  const message = (thrown === ':' ? '' : thrown).slice(0, MAX_FIELD);
  if (!message) {
    return null;
  }

  return {
    message,
    digest: digest.slice(0, MAX_FIELD),
    path: request.path.slice(0, MAX_FIELD),
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath.slice(0, MAX_FIELD),
    stack: (error instanceof Error ? (error.stack ?? '') : '').slice(0, MAX_STACK),
  };
};
