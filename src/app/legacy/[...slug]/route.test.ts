import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyLoad } from '@/shared/legacy';

const loadLegacyDocument = vi.fn<(slug: readonly string[] | undefined) => Promise<LegacyLoad>>();

vi.mock('@/shared/legacy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/legacy')>()),
  loadLegacyDocument: (slug: readonly string[] | undefined) => loadLegacyDocument(slug),
}));

const { DELETE, GET, POST, PUT } = await import('./route');

const call = (handler: typeof GET, slug: string[]) =>
  handler(new Request('https://od.example/legacy/team/'), { params: Promise.resolve({ slug }) });

const ok = (html: string): LegacyLoad => ({ status: 'ok', document: { html, title: 'Т', description: null } });

beforeEach(() => {
  loadLegacyDocument.mockReset();
});

describe('GET /legacy/[...slug] (LCP-009)', () => {
  it('serves the transformed document as HTML', async () => {
    loadLegacyDocument.mockResolvedValue(ok('<html><body>содержимое</body></html>'));

    const response = await call(GET, ['team']);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html><body>содержимое</body></html>');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('marks the proxy copy noindex and frameable only by us', async () => {
    loadLegacyDocument.mockResolvedValue(ok('<p>x</p>'));

    const response = await call(GET, ['team']);

    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'self'");
  });

  /**
   * The response is constructed, never forwarded. Asserting the *complete* set
   * of header names is what makes a future "just copy the upstream headers
   * through" fail here rather than in production, where it would relay a
   * WordPress `Set-Cookie` onto this domain.
   */
  it('carries exactly the headers it constructs, and no others', async () => {
    loadLegacyDocument.mockResolvedValue(ok('<p>x</p>'));

    const response = await call(GET, ['team']);

    expect([...response.headers.keys()].sort()).toEqual([
      'cache-control',
      'content-security-policy',
      'content-type',
      'x-robots-tag',
    ]);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
  });

  it('lets a successful document be reused downstream', async () => {
    loadLegacyDocument.mockResolvedValue(ok('<p>x</p>'));

    const response = await call(GET, ['team']);

    expect(response.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
  });

  it.each([['disabled'], ['missing'], ['unavailable']] as const)('answers 404 when the load is %s', async (status) => {
    loadLegacyDocument.mockResolvedValue({ status } as LegacyLoad);

    const response = await call(GET, ['team']);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('never lets a failure be cached anywhere', async () => {
    loadLegacyDocument.mockResolvedValue({ status: 'unavailable' });

    const response = await call(GET, ['team']);

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('passes the slug through untouched, so validation happens in one place', async () => {
    loadLegacyDocument.mockResolvedValue(ok('<p>x</p>'));

    await call(GET, ['materials', 'plakati']);

    expect(loadLegacyDocument).toHaveBeenCalledWith(['materials', 'plakati']);
  });
});

describe('other methods (LCP-009)', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['DELETE', DELETE],
  ])('answers %s with 405 and fetches nothing', async (_name, handler) => {
    const response = await call(handler as typeof GET, ['team']);

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(loadLegacyDocument).not.toHaveBeenCalled();
  });
});

/**
 * The other half of the policy split. The proxy is the surface a visitor
 * actually reads, so it must never reuse a failure — and it is dynamic, so it
 * is free to say so.
 */
describe('the fetch policy the proxy requires (LCP-010)', () => {
  it('asks for the uncached policy, by taking the default', async () => {
    loadLegacyDocument.mockResolvedValue(ok('<p>x</p>'));

    await call(GET, ['team']);

    expect(loadLegacyDocument).toHaveBeenCalledWith(['team']);
    expect(loadLegacyDocument.mock.calls[0]).toHaveLength(1);
  });
});
