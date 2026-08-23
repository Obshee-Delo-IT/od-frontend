import createClient, { Middleware } from 'openapi-fetch';
import type { paths } from '../../types/generated/wp-json-openapi';

const { WP_BASE, WP_USER, WP_PASSWORD } = process.env;
const hasWpConfig = Boolean(WP_BASE && WP_USER && WP_PASSWORD);

if (!hasWpConfig) {
  // eslint-disable-next-line no-console
  console.warn(
    '[httpClient] WP_BASE / WP_USER / WP_PASSWORD missing — using stub client; all WP requests return empty data. ' +
      'This is expected in CI builds without secrets; in dev/prod it means the .env is incomplete.'
  );
}

const stubFetch: typeof fetch = async () =>
  new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });

const wpOrigin = WP_BASE || 'http://wp.invalid';
const baseUrl = `${wpOrigin}/wp-json`;
const auth = 'Basic ' + btoa(`${WP_USER || ''}:${WP_PASSWORD || ''}`);

export const wpBaseUrl = wpOrigin;

/**
 * A 200 that is not JSON is not data. A WAF challenge, a maintenance page, a
 * host's own error page and a login redirect all answer `200 text/html`, and
 * every caller here goes straight to `res.json()` — so the failure used to
 * surface as an unhandled `SyntaxError` naming neither the URL nor the content
 * type, and `/sitemap.xml` mistook it for the credentials-free CI stub and
 * published ten URLs at 200 (GAP-02).
 */
const isJson = (response: Response) => (response.headers.get('content-type') ?? '').toLowerCase().includes('json');

/** One deliberate line per upstream failure — the run found none at all. */
const logUpstream = (label: string, response: Response) => {
  // eslint-disable-next-line no-console
  console.error(
    `[httpClient] ${label}: ${response.url || '(no url)'} → ${response.status} ${response.statusText}, ` +
      `content-type=${response.headers.get('content-type') ?? 'none'}`
  );
};

const authMiddleware: Middleware = {
  onRequest: ({ request }) => {
    request.headers.set('Authorization', auth);
  },
};

const errorThrowingMiddleware: Middleware = {
  onResponse: ({ response }) => {
    if (!response.ok) {
      logUpstream('upstream error', response);
      throw new Error(`${response.url}: ${response.status} ${response.statusText}`);
    }
    if (!isJson(response)) {
      logUpstream('non-JSON 200', response);
      throw new Error(
        `${response.url}: 200 with content-type ${response.headers.get('content-type') ?? 'none'} — expected JSON`
      );
    }
  },
};

const client = createClient<paths>({ baseUrl, fetch: hasWpConfig ? fetch : stubFetch });

client.use(authMiddleware);
client.use(errorThrowingMiddleware);

export { client };

export const wpFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  if (!hasWpConfig) {
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...init?.headers,
    },
  });
  if (response.ok && !isJson(response)) {
    logUpstream('non-JSON 200', response);
    // Every caller parses JSON, and every caller already has a branch for a
    // failed response — so a WAF page goes down the path they have for an
    // outage instead of throwing `SyntaxError` out of `res.json()`.
    return new Response(null, { status: 502, statusText: 'Upstream did not return JSON' });
  }
  return response;
};
