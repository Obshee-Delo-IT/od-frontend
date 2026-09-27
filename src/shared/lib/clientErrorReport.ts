/** What the beacon sends: the error, and just enough to find it again. */
export interface ClientErrorReport {
  message: string;
  source: string;
  line: number;
  column: number;
  /** The address the visitor was on — the one thing a stack frame never says. */
  url: string;
}

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
export const clientErrorReport = (event: ErrorEvent, origin: string): ClientErrorReport | null => {
  const source = event.filename ?? '';
  if (source && !source.startsWith(origin)) {
    return null;
  }

  const message = (event.message ?? '').slice(0, MAX_FIELD);
  if (!message) {
    return null;
  }

  return {
    message,
    source: source.slice(0, MAX_FIELD),
    line: event.lineno ?? 0,
    column: event.colno ?? 0,
    url: (typeof location === 'undefined' ? '' : location.pathname + location.search).slice(0, MAX_FIELD),
  };
};
