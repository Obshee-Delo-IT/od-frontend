import { NextResponse, type NextRequest } from 'next/server';
import { resolveLegacyUrl } from '@/shared/config/legacyRedirects';

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
  const destination = resolveLegacyUrl(request.nextUrl.pathname);
  if (!destination) {
    return NextResponse.next();
  }

  // 308 rather than 307: these moves are permanent, and unlike 301 it forbids
  // the method rewrite that would turn a POST into a GET.
  return NextResponse.redirect(new URL(destination, request.url), 308);
};

export const config = {
  matcher: ['/video/:path*', '/news/:path*', '/category/:path*', '/page/:path*'],
};
