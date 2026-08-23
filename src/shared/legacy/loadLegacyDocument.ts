import { siteUrl } from '@/shared/config/site';
import { legacyWarn } from './legacyLog';
import { legacyOrigin } from './legacyOrigin';
import { buildLegacyUrl, decodeSegments, legacyPathname } from './legacyPath';
import { legacyGate, legacyStore, type ConcurrencyGate, type LegacyStore } from './legacyStore';
import { transformLegacyHtml } from './transformLegacyHtml';
import type { LegacyLoad } from './types';

/**
 * Fetching one legacy page and turning it into the document we serve
 * (LCP-002 … LCP-004, LCP-010).
 *
 * Used by both surfaces: the proxy route serves the iframe's document, and the
 * catch-all's page + `generateMetadata` need the same page's title. They are
 * separate HTTP requests, so React's `cache()` cannot join them, and Next bundles
 * them separately, so **this module is instantiated once per bundle** — one build
 * prints the boot warning three times. The store and the concurrency gate are
 * therefore process singletons on `globalThis` (see `legacyStore.ts`) rather than
 * module-level values; without that the two surfaces would each keep their own
 * reuse window and their own budget, and a page would cost two upstream renders
 * where LPF-004 promises one.
 *
 * A bare `fetch`, never `wpFetch`: that one attaches the WordPress application
 * password to every request it makes, and the legacy origin is a different host
 * that has no business seeing it.
 */

/** Node's `fetch` has no default timeout; an origin that accepts and never answers would hold a request forever. */
const LEGACY_TIMEOUT_MS = 8000;

/** Followed only when the `Location` stays on the configured origin, and only once. */
const MAX_REDIRECTS = 1;

/** Fixed, so the upstream has nothing to vary on and the stored document has one variant. */
const USER_AGENT = 'od-frontend/1.0 (legacy-page fallback)';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Trailing slashes, case and percent-encoding removed — the parts a normalising redirect changes. */
const normalisePath = (pathname: string): string => {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_error) {
    // A malformed escape compares in its raw form; it is still a path.
  }
  return decoded.replace(/\/+$/, '').toLowerCase();
};

/**
 * A same-origin redirect is followed only when it lands on the **same** page —
 * a trailing-slash, case or encoding normalisation.
 *
 * WordPress also 301s a path it cannot resolve onto whatever page its canonical
 * guessing thinks was meant: `/a/b/c/d/e/f/` → `/video/famous-people/`. Following
 * that served an unrelated page at 200 under the invented address, an unbounded
 * soft-404 family up to the depth limit (ROUTE-07).
 */
const isSamePage = (from: string, to: URL): boolean =>
  normalisePath(new URL(from).pathname) === normalisePath(to.pathname);

/**
 * The largest legacy page measured is 128 KB, so 5 MB is forty times the real
 * ceiling and still bounds the damage.
 *
 * Without it, `response.text()` buffers whatever the origin sends into the
 * container's memory — the timeout and the concurrency cap bound *time* and
 * *sockets*, but nothing bounded *bytes*. That matters more once the legacy
 * origin is a frozen copy someone else stands up: "the origin is ours" is
 * exactly the assumption this change is designed to stop relying on.
 */
const LEGACY_MAX_BYTES = 5_000_000;

/**
 * Read a response body, giving up the moment it exceeds the cap.
 *
 * Streamed rather than `text()`-then-measure, so an oversized body is never
 * fully in memory even once, and a `content-length` that lies cannot get past
 * it.
 */
const readBounded = async (response: Response, limit: number): Promise<string | null> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    return null;
  }
  if (!response.body) {
    const text = await response.text();
    // Encoded length, not `text.length`: the cap is in bytes and this content is
    // largely Cyrillic, which is two bytes per character in UTF-8. Comparing
    // UTF-16 code units would silently allow roughly twice the limit.
    return new TextEncoder().encode(text).length > limit ? null : text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(body);
};

interface LegacyLoaderDeps {
  origin: string | null;
  fetch: typeof fetch;
  store: LegacyStore;
  gate: ConcurrencyGate;
  siteOrigin: string;
  timeoutMs: number;
  /** How long Next may hold the upstream response for the `'revalidate'` policy. */
  revalidateSeconds: number;
  /** Largest upstream body we will read into memory. */
  maxBytes: number;
}

/**
 * How the *caller's* surface needs the upstream fetch treated.
 *
 * - `'no-store'` — the proxy route. Nothing outside this module may retain the
 *   response, so a failure can never be reused and a recovered origin serves the
 *   real page on the next request (decision D13).
 * - `'revalidate'` — the catch-all page. Its `revalidate = 3600` is module-level
 *   and shared with the numeric branch that carries 46 % of site entries, so the
 *   render **must** stay statically generatable; an uncached fetch discovered
 *   during it aborts the render and answers 500 in production, where `next dev`
 *   answers 200. A cacheable fetch is the only shape that route accepts.
 *
 * The asymmetry is safe, and narrower than it looks. The page's only definitive
 * outcome is `missing` (upstream 404/410), which `notFound()` would have cached
 * for the same window anyway; every other failure renders the embed regardless.
 * So the worst a retained failure can cost on this surface is a generic
 * `<title>` until the window rolls — which LPF-005 already accepts in writing.
 * The **content** surface keeps `no-store`, so what the visitor actually reads
 * heals the moment the origin does.
 */
type LegacyFetchPolicy = 'no-store' | 'revalidate';

/** Both of the types the request's own `accept` header asks for, and nothing else. */
const isHtml = (contentType: string | null): boolean =>
  /^(?:text\/html|application\/xhtml\+xml)\b/i.test((contentType ?? '').trim());

export const createLegacyLoader = (overrides: Partial<LegacyLoaderDeps> = {}) => {
  const deps: LegacyLoaderDeps = {
    origin: legacyOrigin,
    fetch: (...args) => globalThis.fetch(...args),
    store: legacyStore,
    gate: legacyGate,
    siteOrigin: siteUrl,
    timeoutMs: LEGACY_TIMEOUT_MS,
    revalidateSeconds: 3600,
    maxBytes: LEGACY_MAX_BYTES,
    ...overrides,
  };

  /**
   * Requests for the same cold path share one upstream attempt. This is
   * deduplication of a single in-flight fetch, not reuse of a result: nothing
   * is stored unless it succeeded, and the next request after this one settles
   * starts afresh.
   *
   * Keyed by **policy and path**, not path alone. The two policies make
   * materially different fetches — one uncached, one cacheable — so joining them
   * would hand the proxy route a response fetched under the page's cacheable
   * policy. Self-healing rather than persistent (the next request re-enters with
   * its own policy), but the whole point of the split is that the surface a
   * visitor reads never depends on a cacheable fetch.
   */
  const inflight = new Map<string, Promise<LegacyLoad>>();

  const fetchUpstream = async (
    url: string,
    signal: AbortSignal,
    policy: LegacyFetchPolicy
  ): Promise<Response | null> => {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await deps.fetch(current, {
        // Uncached at every layer we do not own, so no framework cache can
        // retain a failure behind our back (decision D13) — except on the
        // page surface, which cannot legally make an uncached fetch. See
        // `LegacyFetchPolicy`.
        ...(policy === 'no-store' ? { cache: 'no-store' as const } : { next: { revalidate: deps.revalidateSeconds } }),
        // Manual, so a redirect off the origin is refused rather than followed.
        redirect: 'manual',
        signal,
        // Constructed, never copied from the inbound request: that is what
        // guarantees no cookie and no `Authorization` goes out.
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': USER_AGENT },
      });

      if (!REDIRECT_STATUSES.has(response.status)) {
        return response;
      }

      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch (_error) {
        return null;
      }
      if (next.origin !== deps.origin || !isSamePage(current, next)) {
        return null;
      }
      current = next.toString();
    }
    return null;
  };

  const attempt = async (path: string, url: string, policy: LegacyFetchPolicy): Promise<LegacyLoad> => {
    const release = await deps.gate.acquire();
    if (!release) {
      legacyWarn(`upstream busy for ${path}`);
      return { status: 'unavailable' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs);

    try {
      const response = await fetchUpstream(url, controller.signal, policy);
      if (!response) {
        legacyWarn(`upstream redirect refused for ${path}`);
        return { status: 'missing' };
      }
      if (response.status === 404 || response.status === 410) {
        legacyWarn(`upstream ${response.status} for ${path}`);
        return { status: 'missing' };
      }
      if (!response.ok) {
        legacyWarn(`upstream ${response.status} for ${path}`);
        return { status: 'unavailable' };
      }
      if (!isHtml(response.headers.get('content-type'))) {
        legacyWarn(`upstream non-HTML for ${path}`);
        return { status: 'unavailable' };
      }

      const html = await readBounded(response, deps.maxBytes);
      if (html === null) {
        legacyWarn(`upstream oversized for ${path}`);
        return { status: 'unavailable' };
      }

      const result = transformLegacyHtml(html, {
        // `buildLegacyUrl` already asserted the origin, so this cannot be null
        // by the time we get here.
        origin: deps.origin as string,
        path,
        siteOrigin: deps.siteOrigin,
      });

      if (result.boundaryMiss) {
        legacyWarn(`boundary miss for ${path}`);
      }
      for (const element of result.unbalanced) {
        legacyWarn(`unbalanced ${element} for ${path}`);
      }

      const document = { html: result.html, title: result.title, description: result.description };
      // Success only. A failure is never written and therefore never reused.
      deps.store.set(path, document);
      return { status: 'ok', document };
    } catch (error) {
      legacyWarn(`upstream error for ${path}: ${error instanceof Error ? error.message : String(error)}`);
      return { status: 'unavailable' };
    } finally {
      clearTimeout(timer);
      release();
    }
  };

  return async (
    segments: readonly string[] | undefined,
    policy: LegacyFetchPolicy = 'no-store'
  ): Promise<LegacyLoad> => {
    if (!deps.origin) {
      return { status: 'disabled' };
    }

    // Decoded first, so the store key, the log line and the upstream URL all
    // describe the same path — and so a percent-encoded Cyrillic slug, which is
    // how the router actually hands them over, is not mistaken for an attack.
    const decoded = decodeSegments(segments);
    if (!decoded) {
      legacyWarn(`rejected path ${legacyPathname(segments ?? [])}`);
      return { status: 'missing' };
    }

    const path = legacyPathname(decoded);
    const url = buildLegacyUrl(decoded, deps.origin);
    if (!url) {
      legacyWarn(`rejected path ${path}`);
      return { status: 'missing' };
    }

    const cached = deps.store.get(path);
    if (cached) {
      return { status: 'ok', document: cached };
    }

    const key = `${policy} ${path}`;
    const existing = inflight.get(key);
    if (existing) {
      return existing;
    }

    const pending = attempt(path, url, policy);
    inflight.set(key, pending);
    pending.finally(() => inflight.delete(key)).catch(() => undefined);
    return pending;
  };
};

/**
 * One loader per bundle — but they share one store and one concurrency budget,
 * because those two are `globalThis` singletons rather than module-level values.
 */
export const loadLegacyDocument = createLegacyLoader();
