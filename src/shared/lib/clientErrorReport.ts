/** What the beacon sends: the error, and just enough to find it again. */
export interface ClientErrorReport {
  message: string;
  source: string;
  line: number;
  column: number;
  /** The address the visitor was on — the one thing a stack frame never says. */
  url: string;
  /** Where they came from. An in-app browser opened from search looks different here. */
  referrer: string;
  /**
   * The tag names of `<html>`'s children at the moment of the error, e.g.
   * `HEAD,BODY`. React's own hydration message lists «a browser extension
   * messes with the HTML before React loaded» among the causes, and this is the
   * cheapest way to see one: anything past `HEAD,BODY` was put there by
   * something that is not this application.
   */
  top: string;
  /**
   * `<body>`'s children as the document was parsed, before React touched it —
   * taken in `instrumentation-client.ts`, which Next loads ahead of hydration.
   */
  bodyBefore: string;
  /** The same list at the moment of the error. */
  bodyAfter: string;
}

/**
 * The tag names of an element's children, with runs collapsed — `DIV,SCRIPT×14`
 * rather than fourteen repetitions of the same word, because Next's bootstrap
 * alone puts a dozen `<script>` at the end of every body and the field has 300
 * characters to say something with.
 *
 * Exported because the «before» half is taken from `instrumentation-client.ts`,
 * a module no test can import without Next's own bootstrap around it.
 */
export const childTagNames = (parent: Element | null | undefined): string => {
  const runs: Array<[string, number]> = [];
  for (const { tagName } of Array.from(parent?.children ?? [])) {
    const last = runs.at(-1);
    if (last && last[0] === tagName) {
      last[1] += 1;
    } else {
      runs.push([tagName, 1]);
    }
  }

  return runs.map(([tag, count]) => (count > 1 ? `${tag}×${count}` : tag)).join(',');
};

/** Keeps one field from turning a crash report into a payload. */
const MAX_FIELD = 300;

/**
 * An `ErrorEvent` reduced to the fields worth logging, or `null` for the ones
 * not worth a request.
 *
 * **Third-party frames are dropped.** An extension, a translator toolbar or a
 * blocked analytics script throws through `window.onerror` exactly like our own
 * code does, and there is nothing to do about any of them — so only a `source`
 * on this origin is reported. A frameless error (`source` empty) is kept: that
 * is what a cross-origin script *or* a React recoverable error looks like, and
 * the second is the one being hunted.
 *
 * No `error.stack`: in a production build it is minified chunk offsets, which
 * cost 2 KB a report and say less than `message` plus `source:line`.
 */
export const clientErrorReport = (event: ErrorEvent, origin: string, bodyBefore = ''): ClientErrorReport | null => {
  const source = event.filename ?? '';
  if (source && !source.startsWith(origin)) {
    return null;
  }

  /**
   * `event.message` first looks like the obvious field and is not: production
   * reported `{"message":"Uncaught "}` for the router's own
   * `TypeError: Failed to construct 'URL'` — the browser had nothing to append
   * after «Uncaught». The `error` object carries the text in that case, so it
   * wins when it has one, and `event.message` stays the fallback for the
   * errors that arrive without an object at all (a cross-origin script, and
   * React's recoverable hydration report).
   */
  const thrown = event.error instanceof Error ? `${event.error.name}: ${event.error.message}`.trim() : '';
  const message = (thrown === ':' ? '' : thrown || (event.message ?? '')).trim().slice(0, MAX_FIELD);
  if (!message) {
    return null;
  }

  const doc = typeof document === 'undefined' ? null : document;

  return {
    message,
    source: source.slice(0, MAX_FIELD),
    line: event.lineno ?? 0,
    column: event.colno ?? 0,
    url: (typeof location === 'undefined' ? '' : location.pathname + location.search).slice(0, MAX_FIELD),
    referrer: (doc?.referrer ?? '').slice(0, MAX_FIELD),
    top: childTagNames(doc?.documentElement).slice(0, MAX_FIELD),
    bodyBefore: bodyBefore.slice(0, MAX_FIELD),
    bodyAfter: childTagNames(doc?.body).slice(0, MAX_FIELD),
  };
};
