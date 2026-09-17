import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/legacy/legacyOrigin', () => ({ legacyOrigin: 'https://legacy.test' }));

import { proxy } from './proxy';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const request = (path: string, init?: NextRequestInit) => new NextRequest(`https://site.test${path}`, init);

/**
 * The font relay is the one place this deployment makes a request to a foreign
 * origin on a visitor's behalf, so what it forwards is a security boundary: it
 * used to relay any method with its body, and both `Cookie` and `Authorization`
 * arrived at that origin untouched (SEC-09).
 */
describe('the legacy font relay', () => {
  it('rewrites a GET onto the legacy origin', () => {
    const response = proxy(request('/legacy-font/fonts/MyriadPro-Cond.woff'));

    expect(response?.headers.get('x-middleware-rewrite')).toBe(
      'https://legacy.test/wp-content/themes/welfare/fonts/MyriadPro-Cond.woff'
    );
  });

  it('forwards neither cookies nor credentials', () => {
    const response = proxy(
      request('/legacy-font/css/fonts/fontello.woff', {
        headers: { accept: 'font/woff', cookie: 'session=1', authorization: 'Basic zzz' },
      })
    );
    // Middleware carries the request headers it wants forwarded in this header,
    // base64-encoded; what matters is that neither name is in it.
    const forwarded = response?.headers.get('x-middleware-override-headers') ?? '';

    // Non-vacuous: the list is populated (with `accept`), just not with these.
    expect(forwarded).toContain('accept');
    expect(forwarded).not.toContain('cookie');
    expect(forwarded).not.toContain('authorization');
  });

  it.each(['POST', 'PUT', 'DELETE'])('refuses %s, which a font fetch never uses', (method) => {
    const response = proxy(request('/legacy-font/fonts/MyriadPro-Cond.woff', { method }));

    expect(response?.status).toBe(405);
    expect(response?.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe("WordPress's own search URL", () => {
  it('301s `/?s=<term>` onto the search page, term and all', () => {
    const response = proxy(request('/?s=%D1%82%D0%B0%D0%B1%D0%B0%D0%BA'));

    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe('https://site.test/search/?q=%D1%82%D0%B0%D0%B1%D0%B0%D0%BA');
  });

  it('leaves an ordinary home-page request untouched', () => {
    const response = proxy(request('/'));

    expect(response?.status).toBe(200);
    expect(response?.headers.get('location')).toBeNull();
  });
});

/**
 * Measured on production 2026-09-17: `https://obshee-delo.ru//` answered 200 and
 * rendered «Application error: a client-side exception has occurred», thrown by
 * Next's own `AppRouter` — `new URL('//', location.href)` has no host. `//74794/`
 * failed one step later, in `replaceState`, for being cross-origin.
 */
describe('a path with a doubled leading slash', () => {
  it.each([
    ['//', 'https://site.test/'],
    ['//74794/', 'https://site.test/74794/'],
    ['///news/', 'https://site.test/news/'],
    ['//search/?q=%D1%82%D0%B0%D0%B1%D0%B0%D0%BA', 'https://site.test/search/?q=%D1%82%D0%B0%D0%B1%D0%B0%D0%BA'],
  ])('301s %s onto %s', (path, location) => {
    const response = proxy(request(path));

    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe(location);
  });

  it('leaves a doubled slash anywhere but the front alone', () => {
    const response = proxy(request('/news//'));

    expect(response?.status).toBe(200);
  });
});
