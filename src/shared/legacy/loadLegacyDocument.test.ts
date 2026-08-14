import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConcurrencyGate, createLegacyStore } from './legacyStore';
import { createLegacyLoader } from './loadLegacyDocument';

const ORIGIN = 'https://legacy.example';
const SITE = 'https://od.example';

const PAGE = '<html><head><title>Страница</title></head><body><section id="middle">содержимое</section></body></html>';

const htmlResponse = (body = PAGE, init: ResponseInit = {}) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=UTF-8' },
    ...init,
  });

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A `fetch` double that records what was asked of it. */
const recorder = (respond: (url: string, call: number) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, calls.length);
  }) as unknown as typeof fetch;
  return { calls, impl };
};

const loader = (impl: typeof fetch, overrides = {}) =>
  createLegacyLoader({
    origin: ORIGIN,
    siteOrigin: SITE,
    fetch: impl,
    store: createLegacyStore({ now: () => 0 }),
    gate: createConcurrencyGate({ limit: 4, waitMs: 1000 }),
    ...overrides,
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the upstream request (LCP-002, LCP-003)', () => {
  it('fetches the composed URL and nothing else', async () => {
    const { calls, impl } = recorder(() => htmlResponse());

    await loader(impl)(['materials', 'plakati']);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ORIGIN}/materials/plakati/?od_embed=1`);
  });

  /**
   * The concrete leak this closes: `wpFetch` attaches the WordPress application
   * password to every request it makes, and the legacy origin is a different
   * host with no business seeing it.
   */
  it('sends no credentials and no cookies', async () => {
    const { calls, impl } = recorder(() => htmlResponse());

    await loader(impl)(['team']);

    const headers = calls[0].init?.headers as Record<string, string>;
    expect(Object.keys(headers).map((key) => key.toLowerCase())).toEqual(['accept', 'user-agent']);
    expect(JSON.stringify(headers).toLowerCase()).not.toContain('authorization');
    expect(JSON.stringify(headers).toLowerCase()).not.toContain('cookie');
    expect(JSON.stringify(headers)).not.toContain('Basic');
  });

  it('makes the fetch uncached and manually redirected by default', async () => {
    const { calls, impl } = recorder(() => htmlResponse());

    await loader(impl)(['team']);

    expect(calls[0].init?.cache).toBe('no-store');
    expect(calls[0].init?.redirect).toBe('manual');
    expect(calls[0].init?.signal).toBeDefined();
  });

  /**
   * The page surface cannot make an uncached fetch: the catch-all's
   * `revalidate` is module-level and shared with the numeric branch, so its
   * render must stay statically generatable, and an uncached fetch inside it
   * aborts the render with `DYNAMIC_SERVER_USAGE` — a **500** in production,
   * where `next dev` answers 200 and every test passes.
   */
  it('makes the fetch cacheable when the caller asks for the revalidate policy', async () => {
    const { calls, impl } = recorder(() => htmlResponse());

    await loader(impl, { revalidateSeconds: 3600 })(['team'], 'revalidate');

    expect(calls[0].init?.cache).toBeUndefined();
    expect((calls[0].init as { next?: { revalidate?: number } }).next).toEqual({ revalidate: 3600 });
  });

  it('never fetches at all when the path is rejected', async () => {
    const { calls, impl } = recorder(() => htmlResponse());

    const result = await loader(impl)(['..', 'etc']);

    expect(result.status).toBe('missing');
    expect(calls).toEqual([]);
  });

  it('is disabled, without fetching, when no origin is configured', async () => {
    const { calls, impl } = recorder(() => htmlResponse());

    const result = await createLegacyLoader({ origin: null, fetch: impl })(['team']);

    expect(result.status).toBe('disabled');
    expect(calls).toEqual([]);
  });
});

describe('redirects (LCP-003)', () => {
  it('follows a same-origin redirect', async () => {
    const { calls, impl } = recorder((_url, call) =>
      call === 1
        ? new Response(null, { status: 301, headers: { location: `${ORIGIN}/team-new/` } })
        : htmlResponse('<html><body><p>moved</p></body></html>')
    );

    const result = await loader(impl)(['team']);

    expect(result.status).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe(`${ORIGIN}/team-new/`);
  });

  it('refuses a redirect that leaves the origin, and returns none of its body', async () => {
    const { impl } = recorder(
      () => new Response('secret', { status: 302, headers: { location: 'https://evil.example/steal' } })
    );

    const result = await loader(impl)(['team']);

    expect(result.status).toBe('missing');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('gives up rather than following a redirect chain', async () => {
    const { calls, impl } = recorder(
      (_url, call) => new Response(null, { status: 301, headers: { location: `${ORIGIN}/hop-${call}/` } })
    );

    const result = await loader(impl)(['team']);

    expect(result.status).toBe('missing');
    expect(calls.length).toBeLessThanOrEqual(2);
  });
});

describe('upstream status mapping (LCP-004)', () => {
  it.each([404, 410])('maps an upstream %i to a definitive miss', async (status) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(() => new Response('not found', { status }));

    const result = await loader(impl)(['gone']);

    expect(result.status).toBe('missing');
    expect(warn).toHaveBeenCalledWith(`[legacy] upstream ${status} for /gone/`);
  });

  it.each([500, 502, 503])('maps an upstream %i to a transient failure', async (status) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(() => new Response('boom', { status }));

    expect((await loader(impl)(['team'])).status).toBe('unavailable');
  });

  it('maps a network error to a transient failure and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const impl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const result = await loader(impl)(['team']);

    expect(result.status).toBe('unavailable');
    expect(String(warn.mock.calls[0][0])).toContain('ECONNREFUSED');
  });

  it('refuses to proxy a non-HTML body', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(
      () => new Response('%PDF-1.4', { status: 200, headers: { 'content-type': 'application/pdf' } })
    );

    const result = await loader(impl)(['brochure']);

    expect(result.status).toBe('unavailable');
    expect(JSON.stringify(result)).not.toContain('PDF');
  });

  it('keeps answering consistently when the same path keeps failing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls, impl } = recorder(() => new Response(null, { status: 502 }));
    const load = loader(impl);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await load(['team'])).status).toBe('unavailable');
    }
    // Each one is a fresh attempt: nothing about the failure was retained.
    expect(calls).toHaveLength(3);
  });
});

describe('reuse and load control (LCP-010)', () => {
  it('serves a second request for the same path without a second render', async () => {
    const { calls, impl } = recorder(() => htmlResponse());
    const load = loader(impl);

    const first = await load(['team']);
    const second = await load(['team']);

    expect(first.status).toBe('ok');
    expect(second).toEqual(first);
    expect(calls).toHaveLength(1);
  });

  it('reuses a document the upstream declared uncacheable', async () => {
    const { calls, impl } = recorder(() =>
      htmlResponse(PAGE, {
        headers: {
          'content-type': 'text/html',
          'cache-control': 'no-cache, max-age=0',
          'set-cookie': 'wordpress_test_cookie=WP',
        },
      })
    );
    const load = loader(impl);

    await load(['team']);
    await load(['team']);

    expect(calls).toHaveLength(1);
  });

  it('never reuses a failure, and serves the real page the moment the origin recovers', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls, impl } = recorder((_url, call) =>
      call === 1 ? new Response(null, { status: 503 }) : htmlResponse()
    );
    const load = loader(impl);

    expect((await load(['team'])).status).toBe('unavailable');
    const recovered = await load(['team']);

    expect(recovered.status).toBe('ok');
    expect(calls).toHaveLength(2);
  });

  it('aborts a request the upstream never answers', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const impl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;

    const pending = loader(impl, { timeoutMs: 8000 })(['team']);
    await vi.advanceTimersByTimeAsync(8001);

    expect((await pending).status).toBe('unavailable');
  });

  /**
   * Two concurrent requests for a cold path share one upstream render — a
   * crawler hitting the same slug twice must not double the load — and both
   * still get the page.
   */
  it('collapses concurrent requests for the same cold path into one fetch', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { calls, impl } = recorder(async () => {
      await gate;
      return htmlResponse();
    });
    const load = loader(impl);

    const both = Promise.all([load(['team']), load(['team'])]);
    release!();
    const [first, second] = await both;

    expect(calls).toHaveLength(1);
    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');
  });

  /**
   * …but only when they asked for the same thing. The two policies make
   * materially different fetches, and joining them would serve the proxy — the
   * surface a visitor actually reads — a response fetched under the page's
   * cacheable policy, which is the one thing the split exists to prevent.
   */
  it('does not collapse two policies for the same path into one fetch', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { calls, impl } = recorder(async () => {
      await gate;
      return htmlResponse();
    });
    const load = loader(impl);

    const both = Promise.all([load(['team'], 'no-store'), load(['team'], 'revalidate')]);
    release!();
    await both;

    expect(calls).toHaveLength(2);
    // Sorted, so the assertion is about *which* two fetches happened rather
    // than the order two microtasks happened to settle in.
    expect(calls.map((entry) => entry.init?.cache).sort()).toEqual(['no-store', undefined]);
  });

  it('answers a request that cannot get a slot without storing that answer', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createLegacyStore({ now: () => 0 });
    const { impl } = recorder(() => new Promise<Response>(() => {}) as unknown as Response);
    const load = loader(impl, { store, gate: createConcurrencyGate({ limit: 1, waitMs: 500 }) });

    const held = load(['first']);
    const shed = load(['second']);
    await vi.advanceTimersByTimeAsync(501);

    expect((await shed).status).toBe('unavailable');
    expect(store.size()).toBe(0);
    void held;
  });
});

describe('the transformed result (LCP-005, LPF-004)', () => {
  it('returns the transformed document with its metadata', async () => {
    const { impl } = recorder(() => htmlResponse());

    const result = await loader(impl)(['team']);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.document.title).toBe('Страница');
    expect(result.document.description).toBeNull();
    expect(result.document.html).toContain(`<base href="${ORIGIN}/team/">`);
    expect(result.document.html).toContain('содержимое');
  });

  it('warns when a page has no content boundary', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(() => htmlResponse('<html><body><div>no boundary</div></body></html>'));

    await loader(impl)(['odd']);

    expect(warn).toHaveBeenCalledWith('[legacy] boundary miss for /odd/');
  });

  it('warns when a path is rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(() => htmlResponse());

    await loader(impl)(['bad path']);

    expect(warn).toHaveBeenCalledWith('[legacy] rejected path /bad path/');
  });
});

describe('bounded reading (security review, GATE 2)', () => {
  it('reads an ordinary page', async () => {
    const { impl } = recorder(() => htmlResponse());

    expect((await loader(impl)(['team'])).status).toBe('ok');
  });

  it('refuses a body larger than the cap rather than buffering it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(() => htmlResponse(`<html><body>${'x'.repeat(2000)}</body></html>`));

    const result = await loader(impl, { maxBytes: 500 })(['huge']);

    expect(result.status).toBe('unavailable');
  });

  /**
   * The body here is 13 bytes, well under the cap, so a refusal can only have
   * come from the *declared* length — which is the point: an origin claiming a
   * huge body is turned away before a single chunk is pulled.
   */
  it('refuses on a declared content-length over the cap', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(
      () =>
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html', 'content-length': '99999999' },
        })
    );

    const result = await loader(impl, { maxBytes: 1000 })(['liar']);

    expect(result.status).toBe('unavailable');
  });

  it('warns with the path when a body is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { impl } = recorder(() => htmlResponse(`<html><body>${'x'.repeat(2000)}</body></html>`));

    await loader(impl, { maxBytes: 500 })(['huge']);

    expect(warn).toHaveBeenCalledWith('[legacy] upstream oversized for /huge/');
  });
});
