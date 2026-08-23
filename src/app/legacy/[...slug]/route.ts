import { isEmbeddable, loadLegacyDocument } from '@/shared/legacy';

/**
 * The same-origin proxy the legacy embed's iframe points at (A6).
 *
 * Internal, not a public contract: it exists to be an `<iframe src>` and is
 * `noindex`, so the page at `/<path>/` stays the only indexable address for a
 * legacy page. Everything it returns is **constructed** — no upstream response
 * header is ever copied onto ours, which is what keeps a WordPress `Set-Cookie`
 * off this domain and an upstream `cache-control: max-age=0` from defeating our
 * own reuse window.
 *
 * The fetch, path validation, origin pinning and caching all live in
 * `shared/legacy/loadLegacyDocument.ts`; this file is the HTTP surface.
 */

/**
 * Dynamic on purpose. Reuse is the proxy's own bounded, success-only store
 * (decision D13) rather than any framework cache, so that "a failure is never
 * reused" is a property of code in this repo instead of a claim about Next's
 * internals — three reviewers gave three incompatible accounts of those.
 */
export const dynamic = 'force-dynamic';

const SUCCESS_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  // Never the indexable copy of a legacy page: the parent route owns that, and
  // this one is a chromeless fragment that would rank worse.
  'x-robots-tag': 'noindex',
  // Framed by our own pages only. `sandbox` was considered and rejected: an
  // opaque origin makes `localStorage` throw, which breaks legacy widgets that
  // touch it, and no sandbox flag set can be combined with the top-level
  // navigation the click handler performs.
  'content-security-policy': "frame-ancestors 'self'",
  'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

const FAILURE_HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex',
  // A failure is never reused — not by us, not by anything downstream — so a
  // recovered origin serves the real page on the very next request.
  'cache-control': 'no-store',
};

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
): Promise<Response> => {
  const { slug } = await params;
  // The same eligibility test the page applies, so the two surfaces cannot
  // disagree about which paths exist: a slug the page would refuse for depth or
  // a reserved first segment must not still be fetchable here just because this
  // route is the internal one.
  if (!isEmbeddable(slug)) {
    return new Response(null, { status: 404, headers: FAILURE_HEADERS });
  }

  const result = await loadLegacyDocument(slug);

  if (result.status !== 'ok') {
    return new Response(null, { status: 404, headers: FAILURE_HEADERS });
  }

  return new Response(result.document.html, { status: 200, headers: SUCCESS_HEADERS });
};

/**
 * Read-only, and explicitly so: RFC 9110 requires `Allow` on a 405, and Next's
 * own rejection of an unexported method sends none (SEC-08).
 */
const methodNotAllowed = (): Response =>
  new Response(null, { status: 405, headers: { ...FAILURE_HEADERS, allow: 'GET, HEAD' } });

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
