import { NextResponse, type NextRequest } from 'next/server';
import { resolveLegacySearch, resolveLegacyUrl } from '@/shared/config/legacyRedirects';
import { resolveCanonicalRedirect } from '@/shared/config/site';
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
 * The `matcher` used to scope execution to the legacy prefixes plus `/` itself.
 * Host canonicalisation ended that: `общеедело.рф/about/` has to redirect as
 * surely as `общеедело.рф/`, so every path a visitor can ask for now enters
 * here. Nothing else changed with it — `resolveLegacyUrl` answers only under
 * `/video`, `/news`, `/page` and `/category` plus an exact-path table, so the
 * paths that newly arrive fall straight through.
 */
export const proxy = (request: NextRequest) => {
  /**
   * Alias domains first, before anything else can answer on one of them. The
   * organisation owns two `.рф` spellings and the `www.` form of all three
   * names, and until cutover the old install's `.htaccess` was what folded them
   * onto the apex — so this is that rule moving hosts, not a new policy.
   *
   * `x-forwarded-host` before `host`: behind the reverse proxy the latter is the
   * container's own name on some paths, and a redirect built from it would send
   * a visitor somewhere unreachable.
   */
  const canonical = resolveCanonicalRedirect(
    request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  if (canonical) {
    return NextResponse.redirect(canonical, 301);
  }

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

  // WordPress's `/?s=<term>` — the one legacy shape that is a query string, and
  // the reason `/` is in the matcher at all.
  const search = resolveLegacySearch(request.nextUrl.pathname, request.nextUrl.searchParams.get('s'));
  if (search) {
    return NextResponse.redirect(new URL(search, request.url), 301);
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
  // Every path except Next's own build output. An alias host has to be folded
  // onto the apex whatever was asked for, and a matcher is the only gate on
  // whether this file runs at all — so the list of legacy prefixes it used to
  // carry could not stay. `_next/static` and `_next/image` are excluded because
  // nothing there is ever requested on an alias host: the redirect happens on
  // the document, and the markup that asks for those assets is already canonical.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
