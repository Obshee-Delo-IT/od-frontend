/**
 * Container health probe for the Coolify deployment.
 *
 * Deliberately does NOT touch WordPress: a probe that fetched WP would report
 * the container unhealthy whenever the (slow, occasionally 503ing) WP host
 * hiccups, and Coolify would restart a perfectly good process. This answers
 * "is the Node server up and routing?" — nothing more. Probing `/` instead
 * would trigger a full homepage render plus its WP fetches on every check.
 *
 * **Probe `/health/` with the trailing slash.** `trailingSlash: true` (A8, to
 * match the live site's URLs) makes `/health` answer a 308 to `/health/`; a
 * probe that doesn't follow redirects would never see the 200.
 */
export const dynamic = 'force-dynamic';

export const GET = () =>
  new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
