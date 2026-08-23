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
