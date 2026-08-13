/** A transformed legacy page: the HTML we serve plus what metadata it carried. */
export interface LegacyDocument {
  /** The rewritten document, ready to be the iframe's body. */
  html: string;
  /** The upstream `<title>`, entity-decoded, or `null` when it had none. */
  title: string | null;
  /** The upstream `<meta name="description">`, entity-decoded, or `null`. */
  description: string | null;
}

/**
 * What a legacy load produced. The three failures are kept apart because the
 * two surfaces answer them differently (decision D11): the proxy route 404s on
 * all of them, but the **page** may only `notFound()` on `missing` — a
 * `notFound()` under the catch-all's `revalidate = 3600` would freeze a
 * one-second outage into an hour of 404s.
 */
export type LegacyLoad =
  /** Fetched and transformed, or served from the store. */
  | { status: 'ok'; document: LegacyDocument }
  /** `WP_LEGACY_BASE` is unset, or the path is not one we will fetch. */
  | { status: 'disabled' }
  /** The upstream stated definitively that there is no such page: 404 or 410. */
  | { status: 'missing' }
  /** Transient: 5xx, network error, timeout, non-HTML body, or no free slot. */
  | { status: 'unavailable' };
