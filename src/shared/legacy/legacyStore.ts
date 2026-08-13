import type { LegacyDocument } from './types';

/**
 * Reuse and load control for the legacy proxy (LCP-010, decision D13).
 *
 * The proxy owns its cache instead of leaning on Next's. Three review rounds
 * produced three mutually incompatible accounts of Next's caching semantics —
 * whether an upstream `Set-Cookie` defeats the Data Cache, whether a route
 * `revalidate` persists a 404 for the full hour, whether the Data Cache retains
 * a failed response — and none of them cited a source. Rather than adjudicate
 * framework internals that move between minor versions, everything the
 * requirements depend on lives here, where it is directly testable:
 *
 * - reuse is **success-only**, so no failure can ever be served twice;
 * - the store is **bounded**, so ~170 crawlable slugs cannot grow it forever;
 * - the clock is **injected**, so expiry is tested without sleeping.
 *
 * Per-replica and discarded on redeploy, exactly like the ISR cache
 * (`output: 'standalone'`). A load reducer, not a durability guarantee.
 */

interface StoreEntry extends LegacyDocument {
  expires: number;
}

export interface LegacyStore {
  get: (key: string) => LegacyDocument | null;
  set: (key: string, document: LegacyDocument) => void;
  /** Test seam: how many entries are held right now. */
  size: () => number;
  clear: () => void;
}

export interface LegacyStoreOptions {
  capacity?: number;
  ttlMs?: number;
  now?: () => number;
}

/** ~170 legacy pages exist; 64 covers the trafficked ones without unbounded growth. */
export const LEGACY_STORE_CAPACITY = 64;

/** Matches the catch-all's `revalidate = 3600`, so both surfaces go stale together. */
export const LEGACY_STORE_TTL_MS = 60 * 60 * 1000;

export const createLegacyStore = ({
  capacity = LEGACY_STORE_CAPACITY,
  ttlMs = LEGACY_STORE_TTL_MS,
  now = Date.now,
}: LegacyStoreOptions = {}): LegacyStore => {
  const entries = new Map<string, StoreEntry>();

  return {
    get: (key) => {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expires <= now()) {
        // Dropped rather than served stale: LCP-010 allows a stale answer only
        // as an explicit, logged choice, and this change does not make one.
        entries.delete(key);
        return null;
      }
      return { html: entry.html, title: entry.title, description: entry.description };
    },

    set: (key, document) => {
      // Delete first so a rewrite moves to the back of the insertion order and
      // eviction stays honestly oldest-out.
      entries.delete(key);
      entries.set(key, { ...document, expires: now() + ttlMs });
      while (entries.size > capacity) {
        const oldest = entries.keys().next();
        if (oldest.done) {
          break;
        }
        entries.delete(oldest.value);
      }
    },

    size: () => entries.size,
    clear: () => entries.clear(),
  };
};

export interface ConcurrencyGate {
  /**
   * A release function once a slot is free, or `null` if the wait budget ran
   * out first. The caller **must** release in a `finally`.
   */
  acquire: () => Promise<(() => void) | null>;
  /** Test seam: slots currently held. */
  active: () => number;
}

export interface ConcurrencyGateOptions {
  limit?: number;
  waitMs?: number;
}

/** What this WordPress host is already asked to tolerate elsewhere (`sitemap.ts`). */
export const LEGACY_CONCURRENCY_LIMIT = 4;

/** Long enough for a slot to free on a healthy origin, short enough not to pile up. */
export const LEGACY_QUEUE_WAIT_MS = 4000;

/**
 * Caps simultaneous upstream requests by **queueing**, not shedding.
 *
 * Shedding turns a ten-page crawler sweep into six 404s, which is worse than
 * six slow pages — and worse still if any layer persisted them. Only a request
 * that cannot get a slot inside its wait budget is refused, and that refusal is
 * never stored.
 */
export const createConcurrencyGate = ({
  limit = LEGACY_CONCURRENCY_LIMIT,
  waitMs = LEGACY_QUEUE_WAIT_MS,
}: ConcurrencyGateOptions = {}): ConcurrencyGate => {
  interface Waiter {
    settle: (release: (() => void) | null) => void;
    timer: ReturnType<typeof setTimeout>;
  }

  let active = 0;
  const queue: Waiter[] = [];

  const grant = (): (() => void) => {
    active += 1;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      active -= 1;
      pump();
    };
  };

  // Mutually recursive with `grant` by design: releasing a slot is what wakes
  // the next waiter. Neither runs during module init, so the TDZ never bites.
  const pump = (): void => {
    while (active < limit && queue.length > 0) {
      const waiter = queue.shift();
      if (!waiter) {
        return;
      }
      clearTimeout(waiter.timer);
      waiter.settle(grant());
    }
  };

  return {
    acquire: () =>
      new Promise<(() => void) | null>((resolve) => {
        if (active < limit) {
          resolve(grant());
          return;
        }
        const waiter: Waiter = {
          settle: resolve,
          timer: setTimeout(() => {
            const index = queue.indexOf(waiter);
            if (index >= 0) {
              queue.splice(index, 1);
            }
            resolve(null);
          }, waitMs),
        };
        queue.push(waiter);
      }),
    active: () => active,
  };
};

/** The process-wide instances the proxy route and the page loader share. */
export const legacyStore = createLegacyStore();
export const legacyGate = createConcurrencyGate();
