import { describe, expect, it, vi } from 'vitest';
import { LegacyEmbed } from '@/modules/Legacy';
import type { LegacyLoad } from '@/shared/legacy';

/**
 * The catch-all's non-numeric branch (LPF-001, LPF-003, LPF-005).
 *
 * Each test uses a **distinct slug**: the branch runs through React's `cache()`,
 * which memoises per call site, and reusing a slug across tests would serve one
 * test the previous one's answer.
 */

const loadLegacyDocument = vi.fn<(slug: readonly string[] | undefined, policy?: string) => Promise<LegacyLoad>>();

vi.mock('@/shared/legacy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/legacy')>()),
  loadLegacyDocument: (slug: readonly string[] | undefined, policy?: string) => loadLegacyDocument(slug, policy),
}));

class NotFound extends Error {}

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
}));

const { default: Page, generateMetadata } = await import('./page');

const render = (slug: string[]) => Page({ params: Promise.resolve({ slug }) });
const metadata = (slug: string[]) => generateMetadata({ params: Promise.resolve({ slug }) });

const ok = (title: string | null, description: string | null = null): LegacyLoad => ({
  status: 'ok',
  document: { html: '<p>x</p>', title, description },
});

describe('the legacy branch renders (LPF-003)', () => {
  it('renders the embed, and only the embed', async () => {
    loadLegacyDocument.mockResolvedValue(ok('Команда'));

    const element = await render(['branch-team']);

    expect(element.type).toBe(LegacyEmbed);
    expect(element.props).toEqual({ slug: ['branch-team'] });
  });

  it('passes a multi-segment path straight through', async () => {
    loadLegacyDocument.mockResolvedValue(ok(null));

    const element = await render(['branch-materials', 'plakati']);

    expect(element.props.slug).toEqual(['branch-materials', 'plakati']);
  });
});

describe('the legacy branch declines (LPF-001, LPF-005)', () => {
  it.each([['legacy'], ['_next'], ['api']])(
    '404s on the reserved prefix %s without loading anything',
    async (first) => {
      loadLegacyDocument.mockClear();

      await expect(render([first, 'anything'])).rejects.toBeInstanceOf(NotFound);
      expect(loadLegacyDocument).not.toHaveBeenCalled();
    }
  );

  it('404s on a dotted last segment without loading anything', async () => {
    loadLegacyDocument.mockClear();

    await expect(render(['favicon.png'])).rejects.toBeInstanceOf(NotFound);
    expect(loadLegacyDocument).not.toHaveBeenCalled();
  });

  it('404s when the origin is unconfigured', async () => {
    loadLegacyDocument.mockResolvedValue({ status: 'disabled' });

    await expect(render(['branch-disabled'])).rejects.toBeInstanceOf(NotFound);
  });

  it('404s when the upstream says the page is gone', async () => {
    loadLegacyDocument.mockResolvedValue({ status: 'missing' });

    await expect(render(['branch-missing'])).rejects.toBeInstanceOf(NotFound);
  });

  /**
   * The one that matters under ISR: a `notFound()` here would be cached for the
   * catch-all's whole `revalidate = 3600` window, freezing a one-second outage
   * into an hour of 404s. The iframe fetches independently, so rendering the
   * embed lets the page heal as soon as the origin does.
   */
  it('still renders the embed on a transient upstream failure', async () => {
    loadLegacyDocument.mockResolvedValue({ status: 'unavailable' });

    const element = await render(['branch-transient']);

    expect(element.type).toBe(LegacyEmbed);
  });
});

describe('the numeric branch is untouched (LPF-001)', () => {
  it('never asks the legacy loader about a post id', async () => {
    loadLegacyDocument.mockClear();

    // No WP environment in tests, so the post probe finds nothing and the
    // route 404s — the point here is only that it took the *other* branch.
    await expect(render(['73381'])).rejects.toBeInstanceOf(NotFound);
    expect(loadLegacyDocument).not.toHaveBeenCalled();
  });

  it('treats a multi-segment numeric path as a legacy page, not a post', async () => {
    loadLegacyDocument.mockResolvedValue(ok(null));

    const element = await render(['73381', 'extra']);

    expect(element.type).toBe(LegacyEmbed);
  });
});

describe('metadata for an embedded page (LPF-004)', () => {
  it('takes the title and description from the upstream document', async () => {
    loadLegacyDocument.mockResolvedValue(ok('Команда организации — Общее дело', 'Кто мы'));

    const result = await metadata(['meta-team']);

    expect(result.title).toBe('Команда организации — Общее дело');
    expect(result.description).toBe('Кто мы');
  });

  it('emits our own canonical, never the legacy origin', async () => {
    loadLegacyDocument.mockResolvedValue(ok('Плакаты'));

    const result = await metadata(['meta-materials', 'plakati']);

    expect(result.alternates?.canonical).toBe('https://obshee-delo.ru/meta-materials/plakati/');
    expect(JSON.stringify(result)).not.toContain('/legacy/');
  });

  it('omits a description the upstream does not have', async () => {
    loadLegacyDocument.mockResolvedValue(ok('Заголовок', null));

    const result = await metadata(['meta-nodesc']);

    expect(result.description).toBeUndefined();
    expect('description' in result).toBe(true);
  });

  it('falls back to the site defaults when the upstream is unavailable', async () => {
    loadLegacyDocument.mockResolvedValue({ status: 'unavailable' });

    const result = await metadata(['meta-down']);

    expect(result.title).toBeUndefined();
    expect(result.alternates?.canonical).toBe('https://obshee-delo.ru/meta-down/');
  });

  it('returns nothing at all for an ineligible path', async () => {
    loadLegacyDocument.mockClear();

    const result = await metadata(['favicon.ico']);

    expect(result).toEqual({});
    expect(loadLegacyDocument).not.toHaveBeenCalled();
  });

  /**
   * Both surfaces go through the same loader with the same key, which is what
   * makes the page cost one upstream render rather than two.
   *
   * The count is deliberately **not** asserted as 1: React's `cache()` dedups
   * only inside a render pass, and a unit test has no request scope to give it,
   * so both calls arrive here. What actually bounds the upstream is the
   * loader's own store — asserted in `loadLegacyDocument.test.ts`, where it can
   * be observed instead of assumed.
   */
  it('routes both surfaces through one loader, keyed identically', async () => {
    loadLegacyDocument.mockClear();
    loadLegacyDocument.mockResolvedValue(ok('Один запрос'));

    await metadata(['meta-shared']);
    await render(['meta-shared']);

    expect(loadLegacyDocument.mock.calls).toEqual([
      [['meta-shared'], 'revalidate'],
      [['meta-shared'], 'revalidate'],
    ]);
  });
});

/**
 * The guard on the bug a production build found and no test could: this route's
 * `revalidate` is module-level, so an uncached fetch inside its render aborts
 * with `DYNAMIC_SERVER_USAGE` and answers **500** — while `next dev` answers
 * 200. Only the policy is assertable here; gate 10 in the verification plan is
 * what actually exercises it.
 */
describe('the fetch policy this route requires', () => {
  it('always asks for the cacheable policy, never the uncached one', async () => {
    loadLegacyDocument.mockClear();
    loadLegacyDocument.mockResolvedValue(ok('Политика'));

    await render(['policy-page']);
    await metadata(['policy-meta']);

    expect(loadLegacyDocument.mock.calls.length).toBeGreaterThan(0);
    for (const [, policy] of loadLegacyDocument.mock.calls) {
      expect(policy).toBe('revalidate');
    }
  });
});
