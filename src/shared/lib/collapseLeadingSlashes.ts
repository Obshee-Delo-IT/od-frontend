/**
 * The single address for a path a visitor reached with the slash doubled.
 *
 * `https://obshee-delo.ru//74794/` answers **200** and then renders a blank
 * «Application error: a client-side exception has occurred». The throw is in
 * Next's own `AppRouter`, which resolves its canonical URL with `new URL(url,
 * location.href)`: a path that begins with a second slash is a
 * *protocol-relative* URL, so `//` has no host at all (`Failed to construct
 * 'URL'`) and `//74794/` reads `74794` as one, which `replaceState` then
 * refuses as cross-origin. Either way the render never starts.
 *
 * **It cannot be fixed on the server.** Measured against od-stage on
 * 2026-09-27: a request for `//zzz-probe-2/` reaches the container as
 * `/zzz-probe-2/` — the reverse proxy in front collapses the run before Next
 * ever sees it, so `proxy.ts` has nothing to redirect. Only the browser still
 * holds the doubled slash, in its address bar, which is exactly where the
 * router reads it from. So the guard runs in `instrumentation-client.ts`,
 * which Next requires *before* `appBootstrap` hydrates (`client/app-next.js`).
 *
 * `null` for every path that is already fine, so the caller navigates once or
 * not at all — never on the replacement path, which would be a loop.
 */
export const collapseLeadingSlashes = (pathname: string): string | null =>
  pathname.startsWith('//') ? pathname.replace(/^\/+/, '/') : null;
