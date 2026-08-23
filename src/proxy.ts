import { NextResponse, type NextRequest } from 'next/server';
import { resolveLegacyUrl } from '@/shared/config/legacyRedirects';
import { legacyFontTarget } from '@/shared/legacy/legacyFonts';
import { legacyOrigin } from '@/shared/legacy/legacyOrigin';

/**
 * Legacy-URL redirects (A8).
 *
 * `proxy.ts` is Next 16's name for what used to be `middleware.ts` — the old
 * filename still works but warns on every boot.
 *
 * These redirects live here rather than in `next.config.ts` `redirects()`
 * because that table produces two-hop chains under `trailingSlash: true`: Next
 * strips the trailing slash off the destination and then 308s it back on.
 * `resolveLegacyUrl` hands back the already-normalised path, so each legacy URL
 * takes exactly one hop. Config redirects also run *before* the proxy, so the
 * two can't coexist — a rule left in the config would shadow this.
 *
 * The `matcher` scopes execution to the four legacy prefixes, so ordinary
 * traffic — the home page, `/<id>` posts, static assets — never enters here.
 */
export const proxy = (request: NextRequest) => {
  /**
   * The A6 fallback's font relay (see `shared/legacy/legacyFonts.ts`). A rewrite
   * rather than a redirect on purpose: a redirect would send the browser back to
   * the legacy origin, which is the cross-origin fetch that is blocked in the
   * first place. It lives here rather than in `next.config.ts` `rewrites()`
   * because that table is baked at build time, and `WP_LEGACY_BASE` being
   * unset — the documented rollback — has to disable this with it.
   */
  const font = legacyFontTarget(request.nextUrl.pathname);
  if (font) {
    if (!legacyOrigin) {
      return new NextResponse(null, { status: 404 });
    }
    // A font is fetched with GET. Anything else was relayed verbatim, body and
    // all, to an origin this deployment does not own (SEC-09).
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new NextResponse(null, { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    // And the visitor's own credentials are none of that origin's business:
    // both a `Cookie` and an `Authorization` header arrived there untouched.
    const headers = new Headers(request.headers);
    for (const name of ['cookie', 'authorization', 'proxy-authorization']) {
      headers.delete(name);
    }

    return NextResponse.rewrite(new URL(font, legacyOrigin), { request: { headers } });
  }

  const destination = resolveLegacyUrl(request.nextUrl.pathname);
  if (!destination) {
    return NextResponse.next();
  }

  // 301, not 308. Both mean «moved permanently» and Google treats them as
  // equivalent, but Yandex — the engine most of this audience arrives from —
  // documents 301 and 302 only, and has never confirmed it consolidates
  // signals across a 308. Every URL in this table is a plain GET arriving from
  // search, so the one thing 308 buys over 301 (no POST→GET rewrite) is worth
  // nothing here.
  return NextResponse.redirect(new URL(destination, request.url), 301);
};

export const config = {
  matcher: ['/video/:path*', '/news/:path*', '/category/:path*', '/page/:path*', '/legacy-font/:path*'],
};
